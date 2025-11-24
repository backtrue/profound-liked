import { Env } from './index';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, sql } from 'drizzle-orm';
import * as schema from '../drizzle/schema';
import {
    apiKeys,
    derivativeQueries,
    analysisSessions,
    targetEngines,
    engineResponses,
    seedKeywords
} from '../drizzle/schema';
import { decrypt } from './encryption';

export class BatchTestExecutor {
    private db;
    private env: Env;
    private sessionId: number;
    private projectId: number;
    private userId: number;
    private targetMarket: 'TW' | 'JP';
    private broadcastProgress: (progress: any) => Promise<void>;

    constructor(
        env: Env,
        params: {
            sessionId: number;
            projectId: number;
            userId: number;
            targetMarket: 'TW' | 'JP';
        },
        broadcastProgress: (progress: any) => Promise<void>
    ) {
        this.env = env;
        this.db = drizzle(env.DB, { schema });
        this.sessionId = params.sessionId;
        this.projectId = params.projectId;
        this.userId = params.userId;
        this.targetMarket = params.targetMarket;
        this.broadcastProgress = broadcastProgress;
    }

    async run() {
        try {
            // 1. Get enabled API keys
            const keys = await this.getEnabledApiKeys();

            if (keys.length === 0) {
                throw new Error('No active API keys found. Please configure at least one AI engine.');
            }

            // 2. Get queries to test
            // Get seed keywords for project and their derivative queries
            const allQueries = await this.db
                .select()
                .from(derivativeQueries)
                .innerJoin(seedKeywords, eq(derivativeQueries.seedKeywordId, seedKeywords.id))
                .where(eq(seedKeywords.projectId, this.projectId))
                .all();

            if (allQueries.length === 0) {
                throw new Error('No queries found for this project.');
            }

            const totalQueries = allQueries.length * keys.length;
            let processedCount = 0;
            let successCount = 0;
            let failedCount = 0;

            // 3. Execute tests
            for (const query of allQueries) {
                for (const key of keys) {
                    processedCount++;
                    const currentEngine = key.provider;

                    await this.broadcastProgress({
                        status: 'running',
                        currentQuery: processedCount,
                        totalQueries,
                        currentEngine,
                        successCount,
                        failedCount,
                        message: `Testing query: ${query.derivativeQueries.queryText} on ${currentEngine}...`
                    });

                    try {
                        const result = await this.executeQuery(query.derivativeQueries.queryText, key);

                        // Save result
                        await this.saveResult(query.derivativeQueries.id, key.provider, result);

                        successCount++;
                    } catch (error) {
                        console.error(`Failed to execute query ${query.derivativeQueries.id} on ${key.provider}: `, error);
                        failedCount++;
                        // Log error to database?
                    }

                    // Rate limiting delay
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            // 4. Complete
            await this.db.update(analysisSessions)
                .set({
                    status: 'completed',
                    completedAt: new Date()
                })
                .where(eq(analysisSessions.id, this.sessionId))
                .run();

            await this.broadcastProgress({
                status: 'completed',
                currentQuery: totalQueries,
                totalQueries,
                currentEngine: 'Completed',
                successCount,
                failedCount,
                message: 'Batch analysis completed successfully!'
            });

        } catch (error) {
            console.error('Batch execution failed:', error);

            await this.db.update(analysisSessions)
                .set({
                    status: 'failed',
                    completedAt: new Date(),
                    errorMessage: error instanceof Error ? error.message : 'Unknown error'
                })
                .where(eq(analysisSessions.id, this.sessionId))
                .run();

            throw error;
        }
    }


    private async getEnabledApiKeys() {
        const keys = await this.db
            .select()
            .from(apiKeys)
            .where(and(
                eq(apiKeys.userId, this.userId),
                eq(apiKeys.isActive, true)
            ))
            .all();

        const decryptedKeys: { provider: string, key: string | string[], additionalConfig?: any }[] = [];
        const valueSerpKeys: string[] = [];

        for (const k of keys) {
            try {
                const decrypted = await decrypt(k.apiKey, this.env);
                if (k.provider === 'valueserp') {
                    valueSerpKeys.push(decrypted);
                } else {
                    decryptedKeys.push({
                        provider: k.provider,
                        key: decrypted,
                        additionalConfig: k.additionalConfig
                    });
                }
            } catch (e) {
                console.error(`Failed to decrypt key for ${k.provider}: `, e);
            }
        }

        if (valueSerpKeys.length > 0) {
            decryptedKeys.push({
                provider: 'valueserp',
                key: valueSerpKeys,
                additionalConfig: {}
            });
        }

        return decryptedKeys;
    }

    private async executeQuery(query: string, key: { provider: string, key: string | string[], additionalConfig?: any }) {
        // Import dynamically to avoid circular dependency issues
        const { queryGemini } = await import('./aiEngines');

        switch (key.provider) {
            case 'google':
                if (typeof key.key !== 'string') throw new Error('Google API key must be a string.');
                // Use Gemini instead of Custom Search
                return queryGemini(key.key, query);
            case 'perplexity':
                if (typeof key.key !== 'string') throw new Error('Perplexity API key must be a string.');
                return this.executePerplexitySearch(query, key.key);
            case 'openai':
                if (typeof key.key !== 'string') throw new Error('OpenAI API key must be a string.');
                return this.executeOpenAI(query, key.key);
            case 'valueserp':
                if (!Array.isArray(key.key)) throw new Error('ValueSERP API keys must be an array.');
                return this.executeValueSerpWithFailover(query, key.key);
            default:
                throw new Error(`Unsupported provider: ${key.provider}`);
        }
    }

    private async executeValueSerpWithFailover(query: string, keys: string[]) {
        let lastError: Error | null = null;

        // Import dynamically to avoid circular dependency issues if any, though here it's fine
        const { executeValueSerpSearch } = await import('./aiEngines');

        for (const apiKey of keys) {
            try {
                return await executeValueSerpSearch(apiKey, query, this.targetMarket);
            } catch (error: any) {
                console.warn(`ValueSERP key failed: ${error.message}`);
                if (error.message === 'QUOTA_EXCEEDED') {
                    continue; // Try next key
                }
                lastError = error;
                // Failover on any error to be robust
                continue;
            }
        }

        throw lastError || new Error('All ValueSERP keys failed.');
    }



    private async executePerplexitySearch(query: string, apiKey: string) {
        const response = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey} `,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.1-sonar-small-128k-online',
                messages: [
                    { role: 'system', content: 'You are a helpful research assistant.' },
                    { role: 'user', content: query }
                ]
            })
        });

        if (!response.ok) {
            throw new Error(`Perplexity API error: ${response.statusText} `);
        }

        const data = await response.json() as any;
        return {
            content: data.choices[0].message.content,
            citations: data.citations || []
        };
    }

    private async executeOpenAI(query: string, apiKey: string) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey} `,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [
                    { role: 'system', content: 'You are a helpful assistant.' },
                    { role: 'user', content: query }
                ]
            })
        });

        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.statusText} `);
        }

        const data = await response.json() as any;
        return {
            content: data.choices[0].message.content,
            citations: [] // OpenAI doesn't provide citations by default in this endpoint
        };
    }

    private async saveResult(queryId: number, provider: string, result: any) {
        // Map provider to friendly engine name
        const engineName = provider === 'openai' ? 'ChatGPT' :
            provider === 'perplexity' ? 'Perplexity' :
                provider === 'google' ? 'Gemini' :
                    provider === 'valueserp' ? 'Google' : provider;

        // Let's find or create the engine
        let engineRecord = await this.db.select().from(targetEngines).where(eq(targetEngines.engineName, engineName)).get();
        if (!engineRecord) {
            const ret = await this.db.insert(targetEngines).values({
                engineName: engineName,
                isActive: true
            }).returning().get();
            engineRecord = ret;
        }

        const responseId = await this.db.insert(engineResponses).values({
            sessionId: this.sessionId,
            queryId: queryId,
            engineId: engineRecord.id,
            rawContent: result.content,
            citations: result.citations,
            createdAt: new Date()
        }).returning().get();

        // Perform Brand Analysis
        try {
            // Dynamically import to avoid circular dependencies
            const { analyzeBrandMentions } = await import('./llmBrandAnalysis');

            // Get project details for brand name and competitors
            const project = await this.db.query.projects.findFirst({
                where: eq(schema.projects.id, this.projectId)
            });

            if (project) {
                const analysis = await analyzeBrandMentions(
                    this.env,
                    result.content,
                    project.brandName,
                    project.competitors || []
                );

                if (analysis.mentions && analysis.mentions.length > 0) {
                    for (const mention of analysis.mentions) {
                        await this.db.insert(schema.brandMentions).values({
                            responseId: responseId.id,
                            brandName: mention.brandName,
                            sentimentScore: Math.round(mention.sentimentScore * 100), // Convert -1.0~1.0 to -100~100
                            isSarcastic: mention.isSarcastic,
                            context: mention.context,
                            recommendationStrength: mention.recommendationStrength,
                            mentionContext: mention.mentionContext,
                            llmAnalysis: JSON.stringify(mention),
                            createdAt: new Date()
                        }).run();
                    }
                }
            }
        } catch (error) {
            console.error('Error performing brand analysis:', error);
            // Don't fail the whole batch if analysis fails
        }
    }
}

