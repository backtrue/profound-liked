import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from './trpc';
import { createDatabase } from './db';
import { COOKIE_NAME } from '@shared/const';
import { deleteCookie } from 'hono/cookie';

// Import database functions (we'll need to migrate these)
import * as dbFunctions from './db-functions';

export const appRouter = router({
    // System router (health check, etc.)
    system: router({
        health: publicProcedure.query(() => {
            return { status: 'ok', timestamp: new Date().toISOString() };
        }),
    }),

    // Auth router
    auth: router({
        me: publicProcedure.query(({ ctx }) => ctx.user),

        logout: publicProcedure.mutation(({ ctx }) => {
            // Note: In Workers, we need to handle cookie deletion differently
            // This will be handled in the response headers
            return { success: true } as const;
        }),
    }),

    // Project management
    project: router({
        list: protectedProcedure.query(async ({ ctx }) => {
            const db = createDatabase(ctx.env);
            return dbFunctions.getProjectsByUserId(db, ctx.user.id);
        }),

        create: protectedProcedure
            .input(z.object({
                projectName: z.string().min(1),
                targetMarket: z.enum(['TW', 'JP']),
                brandName: z.string().min(1),
                competitors: z.array(z.string()).optional(),
            }))
            .mutation(async ({ ctx, input }) => {
                const db = createDatabase(ctx.env);
                return dbFunctions.createProject(db, {
                    userId: ctx.user.id,
                    projectName: input.projectName,
                    targetMarket: input.targetMarket,
                    brandName: input.brandName,
                    competitors: input.competitors || [],
                });
            }),

        getById: protectedProcedure
            .input(z.object({ projectId: z.number() }))
            .query(async ({ ctx, input }) => {
                const db = createDatabase(ctx.env);
                return dbFunctions.getProjectById(db, input.projectId);
            }),

        update: protectedProcedure
            .input(z.object({
                projectId: z.number(),
                projectName: z.string().min(1).optional(),
                brandName: z.string().min(1).optional(),
                competitors: z.array(z.string()).optional(),
            }))
            .mutation(async ({ ctx, input }) => {
                const db = createDatabase(ctx.env);
                const { projectId, ...updates } = input;
                await dbFunctions.updateProject(db, projectId, updates);
                return { success: true };
            }),

        delete: protectedProcedure
            .input(z.object({ projectId: z.number() }))
            .mutation(async ({ ctx, input }) => {
                const db = createDatabase(ctx.env);
                await dbFunctions.deleteProject(db, input.projectId);
                return { success: true };
            }),
    }),

    // Seed keywords
    seedKeyword: router({
        create: protectedProcedure
            .input(z.object({
                projectId: z.number(),
                keyword: z.string().min(1),
                searchVolume: z.number().optional(),
            }))
            .mutation(async ({ ctx, input }) => {
                const db = createDatabase(ctx.env);
                return dbFunctions.createSeedKeyword(db, input);
            }),

        listByProject: protectedProcedure
            .input(z.object({ projectId: z.number() }))
            .query(async ({ ctx, input }) => {
                const db = createDatabase(ctx.env);
                return dbFunctions.getSeedKeywordsWithCount(db, input.projectId);
            }),
    }),

    // Query generation
    queryGeneration: router({
        generate: protectedProcedure
            .input(z.object({
                seedKeywordId: z.number(),
                seedKeyword: z.string(),
                targetMarket: z.enum(['TW', 'JP']),
            }))
            .mutation(async ({ ctx, input }) => {
                const db = createDatabase(ctx.env);
                return dbFunctions.generateQueries(db, ctx.env, input);
            }),

        listBySeedKeyword: protectedProcedure
            .input(z.object({ seedKeywordId: z.number() }))
            .query(async ({ ctx, input }) => {
                const db = createDatabase(ctx.env);
                return dbFunctions.getDerivativeQueriesBySeedKeywordId(db, input.seedKeywordId);
            }),
    }),

    // Analysis sessions
    analysis: router({
        create: protectedProcedure
            .input(z.object({ projectId: z.number() }))
            .mutation(async ({ ctx, input }) => {
                const db = createDatabase(ctx.env);
                return dbFunctions.createAnalysisSession(db, {
                    projectId: input.projectId,
                    status: 'pending',
                });
            }),

        runBatchTest: protectedProcedure
            .input(z.object({ sessionId: z.number() }))
            .mutation(async ({ ctx, input }) => {
                const db = createDatabase(ctx.env);
                // Start batch test execution
                await dbFunctions.startBatchTest(db, ctx.env, ctx.user.id, input.sessionId);
                return {
                    success: true,
                    message: 'Batch test started. This may take several minutes.',
                };
            }),

        listByProject: protectedProcedure
            .input(z.object({ projectId: z.number() }))
            .query(async ({ ctx, input }) => {
                const db = createDatabase(ctx.env);
                return dbFunctions.getAnalysisSessionsByProjectId(db, input.projectId);
            }),

        getById: protectedProcedure
            .input(z.object({ sessionId: z.number() }))
            .query(async ({ ctx, input }) => {
                const db = createDatabase(ctx.env);
                return dbFunctions.getAnalysisSessionById(db, input.sessionId);
            }),

        getExecutionLogs: protectedProcedure
            .input(z.object({ sessionId: z.number() }))
            .query(async ({ ctx, input }) => {
                const db = createDatabase(ctx.env);
                return dbFunctions.getExecutionLogsBySessionId(db, input.sessionId);
            }),

        getMetrics: protectedProcedure
            .input(z.object({ sessionId: z.number() }))
            .query(async ({ ctx, input }) => {
                const db = createDatabase(ctx.env);
                return dbFunctions.getSessionMetrics(db, input.sessionId);
            }),

        generateReport: protectedProcedure
            .input(z.object({ sessionId: z.number() }))
            .mutation(async ({ ctx, input }) => {
                const db = createDatabase(ctx.env);
                return dbFunctions.generateAnalysisReport(db, ctx.env, input.sessionId);
            }),

        // Sarcasm corpus management
        sarcasmCorpus: router({
            list: protectedProcedure.query(async ({ ctx }) => {
                const db = createDatabase(ctx.env);
                return dbFunctions.getAllSarcasmCorpus(db);
            }),

            listByMarket: protectedProcedure
                .input(z.object({ market: z.enum(['taiwan', 'japan']) }))
                .query(async ({ ctx, input }) => {
                    const db = createDatabase(ctx.env);
                    return dbFunctions.getSarcasmCorpusByMarket(db, input.market);
                }),

            create: protectedProcedure
                .input(z.object({
                    market: z.enum(['taiwan', 'japan']),
                    platform: z.string(),
                    text: z.string(),
                    explanation: z.string().optional(),
                    category: z.enum(['irony', 'sarcasm', 'understatement', 'exaggeration', 'other']),
                }))
                .mutation(async ({ ctx, input }) => {
                    const db = createDatabase(ctx.env);
                    return dbFunctions.createSarcasmCorpusEntry(db, {
                        ...input,
                        createdBy: ctx.user.id,
                    });
                }),

            delete: protectedProcedure
                .input(z.object({ id: z.number() }))
                .mutation(async ({ ctx, input }) => {
                    const db = createDatabase(ctx.env);
                    await dbFunctions.deleteSarcasmCorpusEntry(db, input.id, ctx.user.id);
                    return { success: true };
                }),
        }),
    }),

    // Action items
    actionItem: router({
        updateStatus: protectedProcedure
            .input(z.object({
                itemId: z.number(),
                status: z.enum(['pending', 'in_progress', 'completed']),
            }))
            .mutation(async ({ ctx, input }) => {
                const db = createDatabase(ctx.env);
                await dbFunctions.updateActionItemStatus(db, input.itemId, input.status);
                return { success: true };
            }),
    }),

    // Target engines
    targetEngine: router({
        list: protectedProcedure.query(async ({ ctx }) => {
            const db = createDatabase(ctx.env);
            return dbFunctions.getActiveTargetEngines(db);
        }),
    }),

    // API Keys (BYOK)
    apiKey: router({
        list: protectedProcedure.query(async ({ ctx }) => {
            const db = createDatabase(ctx.env);
            return dbFunctions.getApiKeysByUserId(db, ctx.user.id);
        }),

        create: protectedProcedure
            .input(z.object({
                provider: z.enum(['openai', 'perplexity', 'google']),
                apiKey: z.string().min(1),
            }))
            .mutation(async ({ ctx, input }) => {
                const db = createDatabase(ctx.env);
                return dbFunctions.createApiKey(db, ctx.env, ctx.user.id, input.provider, input.apiKey);
            }),

        update: protectedProcedure
            .input(z.object({
                keyId: z.number(),
                apiKey: z.string().min(1),
            }))
            .mutation(async ({ ctx, input }) => {
                const db = createDatabase(ctx.env);
                await dbFunctions.updateApiKey(db, ctx.env, input.keyId, ctx.user.id, input.apiKey);
                return { success: true };
            }),

        delete: protectedProcedure
            .input(z.object({ keyId: z.number() }))
            .mutation(async ({ ctx, input }) => {
                const db = createDatabase(ctx.env);
                await dbFunctions.deleteApiKey(db, input.keyId, ctx.user.id);
                return { success: true };
            }),

        test: protectedProcedure
            .input(z.object({
                provider: z.enum(['openai', 'perplexity', 'google']),
                query: z.string().min(1),
            }))
            .mutation(async ({ ctx, input }) => {
                const db = createDatabase(ctx.env);
                return dbFunctions.testApiKey(db, ctx.env, ctx.user.id, input.provider, input.query);
            }),
    }),
});

export type AppRouter = typeof appRouter;
