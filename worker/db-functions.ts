/**
 * Database functions for Cloudflare Workers
 * 
 * This file contains all database operations migrated from server/db.ts
 * Adapted to work with PlanetScale HTTP driver in Workers environment
 */

import type { Database } from './db';
import type { Env } from './index';
import { drizzle, DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, desc, and, inArray, sql } from 'drizzle-orm';
import { encrypt, decrypt, maskApiKey } from './encryption';
import { queryEngine } from './aiEngines';
import {
    users,
    projects,
    seedKeywords,
    derivativeQueries,
    analysisSessions,
    engineResponses,
    brandMentions,
    citationSources,
    actionItems,
    sarcasmCorpus,
    targetEngines,
    apiKeys,
    executionLogs,
} from '../drizzle/schema';

// ============ Project Functions ============

export async function getProjectsByUserId(db: Database, userId: number) {
    return db.query.projects.findMany({
        where: eq(projects.userId, userId),
        orderBy: [desc(projects.createdAt)],
    });
}

export async function createProject(
    db: Database,
    data: {
        userId: number;
        projectName: string;
        targetMarket: 'TW' | 'JP';
        brandName: string;
        competitors: string[];
    }
) {
    const result = await db.insert(projects).values(data).returning();
    return result[0];
}

export async function getProjectById(db: Database, projectId: number) {
    return db.query.projects.findFirst({
        where: eq(projects.id, projectId),
    });
}

export async function updateProject(
    db: Database,
    projectId: number,
    updates: Partial<{
        projectName: string;
        brandName: string;
        competitors: string[];
    }>
) {
    await db.update(projects).set(updates).where(eq(projects.id, projectId));
}

export async function deleteProject(db: Database, projectId: number) {
    await db.delete(projects).where(eq(projects.id, projectId));
}

// ============ Seed Keyword Functions ============

export async function createSeedKeyword(
    db: Database,
    data: {
        projectId: number;
        keyword: string;
        searchVolume?: number;
    }
) {
    const result = await db.insert(seedKeywords).values(data).returning();
    return result[0];
}

export async function getSeedKeywordsWithCount(db: Database, projectId: number) {
    const keywords = await db.query.seedKeywords.findMany({
        where: eq(seedKeywords.projectId, projectId),
    });

    // Get query count for each keyword
    const keywordsWithCount = await Promise.all(
        keywords.map(async (kw) => {
            const queries = await db.query.derivativeQueries.findMany({
                where: eq(derivativeQueries.seedKeywordId, kw.id),
            });
            return {
                ...kw,
                queryCount: queries.length,
            };
        })
    );

    return keywordsWithCount;
}

export async function deleteSeedKeyword(db: Database, keywordId: number) {
    // First delete all derivative queries
    await db.delete(derivativeQueries).where(eq(derivativeQueries.seedKeywordId, keywordId));
    // Then delete the keyword itself
    await db.delete(seedKeywords).where(eq(seedKeywords.id, keywordId));
}

export async function getDerivativeQueriesBySeedKeywordId(
    db: Database,
    seedKeywordId: number
) {
    return db.query.derivativeQueries.findMany({
        where: eq(derivativeQueries.seedKeywordId, seedKeywordId),
    });
}

// ============ Query Generation ============

export async function generateQueries(
    db: Database,
    env: Env,
    input: {
        seedKeywordId: number;
        seedKeyword: string;
        targetMarket: 'TW' | 'JP';
    }
) {
    console.log(`[Generate Queries] Starting for keyword: ${input.seedKeyword} (ID: ${input.seedKeywordId})`);

    // 0. Delete existing queries for this keyword (for regeneration)
    await db
        .delete(derivativeQueries)
        .where(eq(derivativeQueries.seedKeywordId, input.seedKeywordId))
        .run();

    console.log(`[Generate Queries] Deleted existing queries`);

    // 1. Generate template queries
    const templateQueries = generateTemplateQueries(input.seedKeyword, input.targetMarket);
    console.log(`[Generate Queries] Generated ${templateQueries.length} template queries`);

    // 2. Generate AI creative queries
    let aiQueries: string[] = [];
    let aiError: string | null = null;
    try {
        aiQueries = await generateAIQueries(env, input.seedKeyword, input.targetMarket);
        console.log(`[Generate Queries] Generated ${aiQueries.length} AI queries`);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        aiError = errorMessage;
        console.error('[Generate Queries] Failed to generate AI queries:', errorMessage);
        // Continue with template queries only
    }

    // Combine all queries
    const allQueries = [
        ...templateQueries.map(q => ({
            seedKeywordId: input.seedKeywordId,
            queryText: q,
            generationType: 'template' as const,
        })),
        ...aiQueries.map(q => ({
            seedKeywordId: input.seedKeywordId,
            queryText: q,
            generationType: 'ai_creative' as const,
        })),
    ];

    // Save to database
    if (allQueries.length > 0) {
        await db.insert(derivativeQueries).values(allQueries);
        console.log(`[Generate Queries] Saved ${allQueries.length} queries to database`);
    }

    return {
        total: allQueries.length,
        template: templateQueries.length,
        aiCreative: aiQueries.length,
        aiError,  // Include error message if AI generation failed
        queries: allQueries,
    };
}

async function generateAIQueries(
    env: Env,
    seedKeyword: string,
    market: 'TW' | 'JP'
): Promise<string[]> {
    // Check for Gemini API key
    if (!env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not configured');
    }

    const marketContext = market === 'TW'
        ? '台灣市場，使用繁體中文'
        : '日本市場，使用日文';

    const prompt = `你是一個專業的 SEO 和市場研究專家。請為關鍵字「${seedKeyword}」生成 10 個創意搜尋問句。

市場：${marketContext}

要求：
1. 問句要符合真實用戶的搜尋習慣
2. 涵蓋不同的搜尋意圖：資訊型、比較型、購買型
3. 包含長尾關鍵字
4. 考慮當地文化和語言習慣
5. 每個問句一行，不要編號，不要任何前綴

範例格式：
${seedKeyword} 2025 最新推薦
${seedKeyword} 和 XX 哪個好
${seedKeyword} 使用心得分享

請直接輸出 10 個問句，每行一個，不要任何額外說明：`;

    try {
        console.log(`[AI Query Generation] Starting for keyword: ${seedKeyword}`);

        // Call Gemini API directly
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${env.GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.8,
                        maxOutputTokens: 1000,
                    }
                }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini API error: ${response.status} ${errorText}`);
        }

        const data = await response.json() as {
            candidates?: Array<{
                content?: {
                    parts?: Array<{
                        text?: string;
                    }>;
                };
            }>;
        };

        console.log(`[AI Query Generation] Gemini response received`);

        // Extract text from response
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!content || typeof content !== 'string') {
            console.error('[AI Query Generation] Invalid Gemini response format:', JSON.stringify(data));
            return [];
        }

        console.log(`[AI Query Generation] Raw content:`, content);

        // Split by newlines and filter empty lines
        const queries = content
            .split('\n')
            .map((line: string) => line.trim())
            .filter((line: string) => {
                // Filter out empty lines, numbered lines, and lines that are just punctuation
                return line.length > 0
                    && !line.match(/^\d+[\.):]/)  // Remove numbered lines
                    && !line.match(/^[-*•]/)      // Remove bullet points
                    && line.length > 3;           // Remove very short lines
            })
            .slice(0, 10); // Take first 10

        console.log(`[AI Query Generation] Generated ${queries.length} queries:`, queries);

        return queries;
    } catch (error) {
        console.error('[AI Query Generation] Failed:', error);
        // Log more details
        if (error instanceof Error) {
            console.error('[AI Query Generation] Error details:', error.message, error.stack);
        }
        throw error; // Re-throw to show error in toast
    }
}

function generateTemplateQueries(seedKeyword: string, market: 'TW' | 'JP'): string[] {
    const templates = [
        `${seedKeyword} PTT 推薦`,
        `${seedKeyword} Dcard 評價`,
        `${seedKeyword} Mobile01 心得`,
        `${seedKeyword} 2025 推薦`,
        `${seedKeyword} 哪裡買`,
        `${seedKeyword} 優缺點`,
        `${seedKeyword} 價格比較`,
        `${seedKeyword} 使用心得`,
        `${seedKeyword} 好用嗎`,
        `${seedKeyword} 評測`,
    ];

    if (market === 'JP') {
        templates.push(
            `${seedKeyword} 口コミ`,
            `${seedKeyword} レビュー`,
            `${seedKeyword} おすすめ`,
            `${seedKeyword} 比較`,
            `${seedKeyword} 価格`
        );
    }

    return templates;
}

// ============ Analysis Session Functions ============

export async function createAnalysisSession(
    db: Database,
    data: {
        projectId: number;
        status: 'pending' | 'running' | 'completed' | 'failed';
    }
) {
    const result = await db.insert(analysisSessions).values(data).returning();
    return result[0];
}

export async function getAnalysisSessionsByProjectId(db: Database, projectId: number) {
    return db.query.analysisSessions.findMany({
        where: eq(analysisSessions.projectId, projectId),
        orderBy: [desc(analysisSessions.startedAt)],
    });
}

export async function getAnalysisSessionById(db: Database, sessionId: number) {
    return db.query.analysisSessions.findFirst({
        where: eq(analysisSessions.id, sessionId),
    });
}

export async function getExecutionLogsBySessionId(db: Database, sessionId: number) {
    return db.query.executionLogs.findMany({
        where: eq(executionLogs.sessionId, sessionId),
        orderBy: [desc(executionLogs.createdAt)],
    });
}

// ============ Placeholder Functions ============
// These need full implementation based on original server/db.ts

export async function startBatchTest(
    db: Database,
    env: Env,
    userId: number,
    sessionId: number
) {
    // 1. Get session data
    const session = await db
        .select()
        .from(analysisSessions)
        .where(eq(analysisSessions.id, sessionId))
        .get();

    if (!session) {
        throw new Error('Session not found');
    }

    // 2. Get project data
    const project = await db
        .select()
        .from(projects)
        .where(eq(projects.id, session.projectId))
        .get();

    if (!project) {
        throw new Error('Project not found');
    }

    // 3. Update session status to 'running'
    await db
        .update(analysisSessions)
        .set({
            status: 'running',
            startedAt: new Date(),
        })
        .where(eq(analysisSessions.id, sessionId))
        .run();

    // 4. Get Durable Object instance
    const doId = env.SESSION_PROGRESS.idFromName(`session-${sessionId}`);
    const stub = env.SESSION_PROGRESS.get(doId);

    // 5. Start batch test execution
    try {
        await stub.fetch('https://fake-host/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId,
                projectId: session.projectId,
                userId,
                targetMarket: project.targetMarket,
            }),
        });

        return { success: true };
    } catch (error) {
        // Update session status to 'failed' if DO initialization fails
        await db
            .update(analysisSessions)
            .set({
                status: 'failed',
                completedAt: new Date(),
            })
            .where(eq(analysisSessions.id, sessionId))
            .run();

        throw error;
    }
}

export async function getSessionMetrics(db: Database, sessionId: number) {
    // 1. Get all engine responses
    const responses = await db
        .select()
        .from(engineResponses)
        .where(eq(engineResponses.sessionId, sessionId))
        .all();

    // 2. Get all brand mentions
    // We need to join or fetch separately. Let's fetch separately for now.
    // Actually, we can just get all mentions linked to these responses
    const mentions = await db
        .select()
        .from(brandMentions)
        .where(sql`${brandMentions.responseId} IN (SELECT id FROM engineResponses WHERE sessionId = ${sessionId})`)
        .all();

    // 3. Calculate Summary Metrics
    const totalSentiment = mentions.reduce((acc, m) => acc + m.sentimentScore, 0);
    const sentimentBreakdown = {
        positive: mentions.filter(m => m.sentimentScore > 0).length,
        neutral: mentions.filter(m => m.sentimentScore === 0).length,
        negative: mentions.filter(m => m.sentimentScore < 0).length,
        sarcastic: mentions.filter(m => m.isSarcastic).length,
    };

    const summaryMetrics = {
        shareOfVoiceFrequency: mentions.length,
        shareOfVoiceWeighted: mentions.length > 0 ? totalSentiment / mentions.length : 0,
        sentimentBreakdown,
    };

    // 4. Citation Analysis
    const citationAnalysis: Record<string, number> = {
        ecommerce: 0,
        forum: 0,
        media: 0,
        video: 0,
        competitor: 0,
        official: 0,
        other: 0
    };

    // Parse citations from responses
    for (const response of responses) {
        if (response.citations && Array.isArray(response.citations)) {
            for (const item of response.citations) {
                // Handle both string and object citations
                const url = typeof item === 'string' ? item : (item as any).url;

                if (!url) continue;

                // Enhanced heuristic for citation classification
                const lowerUrl = url.toLowerCase();

                if (
                    lowerUrl.includes('shopee') || lowerUrl.includes('momo') || lowerUrl.includes('amazon') ||
                    lowerUrl.includes('pchome') || lowerUrl.includes('ruten') || lowerUrl.includes('yahoo') ||
                    lowerUrl.includes('books.com') || lowerUrl.includes('rakuten') || lowerUrl.includes('pinkoi') ||
                    lowerUrl.includes('etmall') || lowerUrl.includes('pinecone') || lowerUrl.includes('mercari') ||
                    lowerUrl.includes('zozo') || lowerUrl.includes('kakaku')
                ) {
                    citationAnalysis.ecommerce++;
                } else if (
                    lowerUrl.includes('ptt.cc') || lowerUrl.includes('dcard') || lowerUrl.includes('reddit') ||
                    lowerUrl.includes('mobile01') || lowerUrl.includes('gamer.com') || lowerUrl.includes('bahamut') ||
                    lowerUrl.includes('vocus') || lowerUrl.includes('medium') || lowerUrl.includes('facebook') ||
                    lowerUrl.includes('instagram') || lowerUrl.includes('threads') || lowerUrl.includes('pixnet') ||
                    lowerUrl.includes('chiebukuro') || lowerUrl.includes('5ch') || lowerUrl.includes('2ch') ||
                    lowerUrl.includes('note.com') || lowerUrl.includes('twitter') || lowerUrl.includes('x.com') ||
                    lowerUrl.includes('ameblo') || lowerUrl.includes('blog')
                ) {
                    citationAnalysis.forum++;
                } else if (
                    lowerUrl.includes('youtube') || lowerUrl.includes('tiktok') || lowerUrl.includes('bilibili') ||
                    lowerUrl.includes('twitch') || lowerUrl.includes('vimeo')
                ) {
                    citationAnalysis.video++;
                } else if (
                    lowerUrl.includes('news') || lowerUrl.includes('udn') || lowerUrl.includes('ltn') ||
                    lowerUrl.includes('chinatimes') || lowerUrl.includes('ettoday') || lowerUrl.includes('setn') ||
                    lowerUrl.includes('tvbs') || lowerUrl.includes('cna.com') || lowerUrl.includes('storm.mg') ||
                    lowerUrl.includes('cw.com') || lowerUrl.includes('businessweekly') || lowerUrl.includes('elle') ||
                    lowerUrl.includes('vogue') || lowerUrl.includes('marieclaire') || lowerUrl.includes('popdaily') ||
                    lowerUrl.includes('beauty') || lowerUrl.includes('nikkei') || lowerUrl.includes('asahi') ||
                    lowerUrl.includes('mainichi') || lowerUrl.includes('yomiuri') || lowerUrl.includes('oricon') ||
                    lowerUrl.includes('modelpress')
                ) {
                    citationAnalysis.media++;
                } else {
                    citationAnalysis.other++;
                }
            }
        }
    }

    // 5. Hallucination Stats
    const hallucinationStats = {
        averageScore: 0,
        totalAnalyzed: responses.length,
        lowRiskCount: responses.filter(r => (r.hallucinationScore || 0) < 40).length,
        mediumRiskCount: responses.filter(r => (r.hallucinationScore || 0) >= 40 && (r.hallucinationScore || 0) < 70).length,
        highRiskCount: responses.filter(r => (r.hallucinationScore || 0) >= 70).length,
    };

    if (responses.length > 0) {
        const totalScore = responses.reduce((acc, r) => acc + (r.hallucinationScore || 0), 0);
        hallucinationStats.averageScore = Math.round(totalScore / responses.length);
    }

    // 6. Get Action Plans
    const actionPlan = await db
        .select()
        .from(actionItems)
        .where(eq(actionItems.sessionId, sessionId))
        .all();

    return {
        summaryMetrics,
        citationAnalysis,
        hallucinationStats,
        actionPlan,
    };
}

export async function generateAnalysisReport(
    db: Database,
    env: Env,
    sessionId: number
) {
    // 1. Get metrics and session info
    const metrics = await getSessionMetrics(db, sessionId);
    const session = await getAnalysisSessionById(db, sessionId);

    if (!session) {
        throw new Error('Session not found');
    }

    const project = await getProjectById(db, session.projectId);
    if (!project) {
        throw new Error('Project not found');
    }

    // 2. Prepare context for LLM
    const context = {
        project: {
            name: project.projectName,
            brand: project.brandName,
            market: project.targetMarket,
            competitors: project.competitors
        },
        metrics: {
            shareOfVoice: metrics.summaryMetrics.shareOfVoiceFrequency,
            sentiment: metrics.summaryMetrics.sentimentBreakdown,
            citations: metrics.citationAnalysis,
            hallucination: metrics.hallucinationStats.averageScore
        }
    };

    // 3. Generate Report using Gemini
    if (!env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not configured');
    }

    const prompt = `你是一個專業的品牌聲譽分析師。請根據以下數據為品牌「${project.brandName}」生成一份詳細的分析報告。

專案背景：
- 市場：${project.targetMarket === 'TW' ? '台灣' : '日本'}
- 競品：${project.competitors?.join(', ') || '無'}

分析數據：
- 總提及次數：${metrics.summaryMetrics.shareOfVoiceFrequency}
- 情感分佈：正面 ${metrics.summaryMetrics.sentimentBreakdown.positive}, 負面 ${metrics.summaryMetrics.sentimentBreakdown.negative}, 中性 ${metrics.summaryMetrics.sentimentBreakdown.neutral}, 反串/酸文 ${metrics.summaryMetrics.sentimentBreakdown.sarcastic}
- 引用來源分佈：${JSON.stringify(metrics.citationAnalysis)}
- AI 幻覺風險指數：${metrics.hallucinationStats.averageScore} (分數越高風險越高)

請生成一份 Markdown 格式的報告，包含以下章節：
1. **執行摘要**：整體品牌表現的快速總結。
2. **AI 聲量與情感分析**：深入分析品牌在 AI 搜尋結果中的能見度和情感傾向。
3. **引用來源分析**：分析 AI 回答主要引用的來源類型（如媒體、論壇、電商等）。
4. **關鍵發現**：數據中顯示的重要趨勢或異常。
5. **戰略建議**：針對發現的問題提出的具體改善建議（SEO、公關、內容策略等）。

報告語氣要專業、客觀且具洞察力。使用繁體中文。`;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${env.GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                }),
            }
        );

        if (!response.ok) {
            throw new Error(`Gemini API error: ${response.statusText}`);
        }

        const data = await response.json() as any;
        const reportContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!reportContent) {
            throw new Error('Failed to generate report content');
        }

        return { report: reportContent };

    } catch (error) {
        console.error('Report generation failed:', error);
        throw error;
    }
}

export async function getAllSarcasmCorpus(db: Database) {
    return db.query.sarcasmCorpus.findMany();
}

export async function getSarcasmCorpusByMarket(
    db: Database,
    market: 'taiwan' | 'japan'
) {
    return db.query.sarcasmCorpus.findMany({
        where: eq(sarcasmCorpus.market, market),
    });
}

export async function createSarcasmCorpusEntry(
    db: Database,
    data: {
        market: 'taiwan' | 'japan';
        platform: string;
        text: string;
        explanation?: string;
        category: 'irony' | 'sarcasm' | 'understatement' | 'exaggeration' | 'other';
        createdBy: number;
    }
) {
    const result = await db.insert(sarcasmCorpus).values(data).returning();
    return result[0];
}

export async function deleteSarcasmCorpusEntry(
    db: Database,
    id: number,
    userId: number
) {
    await db.delete(sarcasmCorpus).where(
        and(eq(sarcasmCorpus.id, id), eq(sarcasmCorpus.createdBy, userId))
    );
}

export async function updateActionItemStatus(
    db: Database,
    itemId: number,
    status: 'pending' | 'in_progress' | 'completed'
) {
    await db.update(actionItems).set({ status }).where(eq(actionItems.id, itemId));
}

export async function getActiveTargetEngines(db: Database) {
    return db.query.targetEngines.findMany({
        where: eq(targetEngines.isActive, true),
    });
}

// ============ API Key Functions ============

export async function getApiKeysByUserId(db: Database, userId: number) {
    const keys = await db.query.apiKeys.findMany({
        where: eq(apiKeys.userId, userId),
    });

    // Don't return the actual API key, mask it
    return keys.map(k => ({
        ...k,
        apiKey: maskApiKey(k.apiKey),
    }));
}

export async function createApiKey(
    db: Database,
    env: Env,
    userId: number,
    provider: 'openai' | 'perplexity' | 'google' | 'valueserp',
    apiKey: string,
    additionalConfig?: Record<string, any>
) {
    // Encrypt the API key
    const encryptedKey = await encrypt(apiKey, env);

    const result = await db.insert(apiKeys).values({
        userId,
        provider,
        apiKey: encryptedKey,
        additionalConfig,
        isActive: true,
    }).returning();

    const newKey = result[0];

    if (!newKey) {
        throw new Error('Failed to create API key');
    }

    return {
        ...newKey,
        apiKey: maskApiKey(apiKey), // Return masked version
    };
}

export async function updateApiKey(
    db: Database,
    env: Env,
    keyId: number,
    userId: number,
    apiKey: string,
    additionalConfig?: Record<string, any>
) {
    // Encrypt the new API key
    const encryptedKey = await encrypt(apiKey, env);

    await db.update(apiKeys)
        .set({
            apiKey: encryptedKey,
            additionalConfig
        })
        .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)));
}

export async function deleteApiKey(db: Database, keyId: number, userId: number) {
    await db.delete(apiKeys).where(
        and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId))
    );
}

export async function getDecryptedApiKey(
    db: Database,
    env: Env,
    userId: number,
    provider: 'openai' | 'perplexity' | 'google' | 'valueserp'
): Promise<string | null> {
    const key = await db.query.apiKeys.findFirst({
        where: and(
            eq(apiKeys.userId, userId),
            eq(apiKeys.provider, provider),
            eq(apiKeys.isActive, true)
        ),
    });

    if (!key) {
        return null;
    }

    // Decrypt the API key
    return decrypt(key.apiKey, env);
}

export async function testApiKey(
    db: Database,
    env: Env,
    userId: number,
    provider: 'openai' | 'perplexity' | 'google' | 'valueserp',
    query: string
) {
    const apiKey = await getDecryptedApiKey(db, env, userId, provider);

    if (!apiKey) {
        throw new Error(`No API key found for ${provider}`);
    }

    // Test the API key by making a simple query
    const response = await queryEngine(provider, apiKey, query);

    return {
        content: response.content,
        citations: response.citations || [],
    };
}

export async function deleteAnalysisSession(db: Database, sessionId: number) {
    // Use subqueries to avoid "too many SQL variables" error

    // 1. Delete brand mentions
    await db.delete(brandMentions)
        .where(sql`${brandMentions.responseId} IN (SELECT id FROM engineResponses WHERE sessionId = ${sessionId})`)
        .run();

    // 2. Delete citation sources
    await db.delete(citationSources)
        .where(sql`${citationSources.responseId} IN (SELECT id FROM engineResponses WHERE sessionId = ${sessionId})`)
        .run();

    // 3. Delete engine responses
    await db.delete(engineResponses)
        .where(eq(engineResponses.sessionId, sessionId))
        .run();

    // 4. Delete action items
    await db.delete(actionItems)
        .where(eq(actionItems.sessionId, sessionId))
        .run();

    // 5. Delete the session itself
    await db.delete(analysisSessions)
        .where(eq(analysisSessions.id, sessionId))
        .run();

    return { success: true };
}

