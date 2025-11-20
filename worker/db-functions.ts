/**
 * Database functions for Cloudflare Workers
 * 
 * This file contains all database operations migrated from server/db.ts
 * Adapted to work with PlanetScale HTTP driver in Workers environment
 */

import { eq, desc, and } from 'drizzle-orm';
import type { Database } from './db';
import type { Env } from './index';
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
    // This is a placeholder - full implementation would include:
    // 1. Template-based query generation
    // 2. AI-creative query generation using LLM
    // For now, return a simple structure

    const templateQueries = generateTemplateQueries(input.seedKeyword, input.targetMarket);

    // Save to database
    const allQueries = templateQueries.map(q => ({
        seedKeywordId: input.seedKeywordId,
        queryText: q,
        generationType: 'template' as const,
    }));

    await db.insert(derivativeQueries).values(allQueries);

    return {
        total: allQueries.length,
        template: templateQueries.length,
        aiCreative: 0,
        queries: allQueries,
    };
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
    // TODO: Implement batch test execution
    // This would involve:
    // 1. Getting session and project data
    // 2. Getting user API keys
    // 3. Starting async execution (using Durable Objects or Queues)
    throw new Error('Not implemented yet');
}

export async function getSessionMetrics(db: Database, sessionId: number) {
    // TODO: Implement metrics calculation
    throw new Error('Not implemented yet');
}

export async function generateAnalysisReport(
    db: Database,
    env: Env,
    sessionId: number
) {
    // TODO: Implement report generation
    throw new Error('Not implemented yet');
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
    provider: 'openai' | 'perplexity' | 'google',
    apiKey: string
) {
    // Encrypt the API key
    const encryptedKey = await encrypt(apiKey, env);

    const result = await db.insert(apiKeys).values({
        userId,
        provider,
        apiKey: encryptedKey,
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
    apiKey: string
) {
    // Encrypt the new API key
    const encryptedKey = await encrypt(apiKey, env);

    await db.update(apiKeys)
        .set({ apiKey: encryptedKey })
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
    provider: 'openai' | 'perplexity' | 'google'
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
    provider: 'openai' | 'perplexity' | 'google',
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
