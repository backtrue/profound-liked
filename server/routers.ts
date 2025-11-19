import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { generateAnalysisReport } from "./llmBrandAnalysis";
import * as db from "./db";
import { queryEngine } from "./aiEngines";
import { invokeLLM } from "./_core/llm";
import { executeBatchTests } from "./batchTestExecutor";

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // ============ Project Management ============
  project: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getProjectsByUserId(ctx.user.id);
    }),

    create: protectedProcedure
      .input(z.object({
        projectName: z.string().min(1),
        targetMarket: z.enum(["TW", "JP"]),
        brandName: z.string().min(1),
        competitors: z.array(z.string()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.createProject({
          userId: ctx.user.id,
          projectName: input.projectName,
          targetMarket: input.targetMarket,
          brandName: input.brandName,
          competitors: input.competitors || [],
        });
      }),

    getById: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ input }) => {
        return db.getProjectById(input.projectId);
      }),

    update: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        projectName: z.string().min(1).optional(),
        brandName: z.string().min(1).optional(),
        competitors: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input }) => {
        const { projectId, ...updates } = input;
        await db.updateProject(projectId, updates);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteProject(input.projectId);
        return { success: true };
      }),
  }),

  // ============ Seed Keywords ============
  seedKeyword: router({
    create: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        keyword: z.string().min(1),
        searchVolume: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        return db.createSeedKeyword(input);
      }),

    listByProject: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ input }) => {
        return db.getSeedKeywordsByProjectId(input.projectId);
      }),
  }),

  // ============ Query Generation ============
  queryGeneration: router({
    generate: protectedProcedure
      .input(z.object({
        seedKeywordId: z.number(),
        seedKeyword: z.string(),
        targetMarket: z.enum(["TW", "JP"]),
      }))
      .mutation(async ({ input }) => {
        const { seedKeywordId, seedKeyword, targetMarket } = input;
        
        // Template-based queries (50%)
        const templateQueries = generateTemplateQueries(seedKeyword, targetMarket);
        
        // AI-Creative queries (50%)
        const aiQueries = await generateAICreativeQueries(seedKeyword, targetMarket);
        
        // Combine and save to database
        const allQueries = [
          ...templateQueries.map(q => ({
            seedKeywordId,
            queryText: q,
            generationType: "template" as const,
          })),
          ...aiQueries.map(q => ({
            seedKeywordId,
            queryText: q,
            generationType: "ai_creative" as const,
          })),
        ];
        
        await db.createDerivativeQueries(allQueries);
        
        return {
          total: allQueries.length,
          template: templateQueries.length,
          aiCreative: aiQueries.length,
          queries: allQueries,
        };
      }),

    listBySeedKeyword: protectedProcedure
      .input(z.object({ seedKeywordId: z.number() }))
      .query(async ({ input }) => {
        return db.getDerivativeQueriesBySeedKeywordId(input.seedKeywordId);
      }),
  }),

  // ============ Analysis Sessions ============
  analysis: router({
    create: protectedProcedure
      .input(z.object({
        projectId: z.number(),
      }))
      .mutation(async ({ input }) => {
        return db.createAnalysisSession({
          projectId: input.projectId,
          status: "pending",
        });
      }),

    generateReport: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const session = await db.getAnalysisSessionById(input.sessionId);
        if (!session) {
          throw new Error("分析 Session 不存在");
        }

        const project = await db.getProjectById(session.projectId);
        if (!project) {
          throw new Error("專案不存在");
        }

        // Get all responses and brand mentions for this session
        const responses = await db.getEngineResponsesBySessionId(input.sessionId);
        
        // Get all brand mentions for all responses
        const allBrandMentions: any[] = [];
        for (const response of responses) {
          const mentions = await db.getBrandMentionsByResponseId(response.id);
          allBrandMentions.push(...mentions);
        }

        // Group by response to reconstruct analysis results
        const analysisResults = responses.map((response: any) => {
          const mentions = allBrandMentions.filter((m: any) => m.responseId === response.id);
          return {
            brands: mentions.map((m: any) => ({
              brandName: m.brandName,
              mentioned: true,
              rankPosition: m.rankPosition,
              sentimentScore: m.sentimentScore,
              isSarcastic: m.isSarcastic,
              recommendationStrength: m.recommendationStrength,
              mentionContext: m.mentionContext,
              context: m.context || "",
              llmAnalysis: m.llmAnalysis || "",
            })),
            summary: "",
            recommendations: [],
          };
        });

        const report = await generateAnalysisReport(
          input.sessionId,
          project.brandName,
          project.competitors || [],
          analysisResults
        );

        return { report };
      }),

    runBatchTest: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const session = await db.getAnalysisSessionById(input.sessionId);
        if (!session) {
          throw new Error("Analysis session not found");
        }

        // Update session status to running
        await db.updateAnalysisSessionStatus(input.sessionId, "running");

        // Get project to determine which engines to use
        const project = await db.getProjectById(session.projectId);
        if (!project) {
          throw new Error("Project not found");
        }

        // Get all seed keywords and their derivative queries
        const seedKeywords = await db.getSeedKeywordsByProjectId(project.id);
        
        // Get available API keys for the user
        const userApiKeys = await db.getApiKeysByUserId(ctx.user.id);
        if (userApiKeys.length === 0) {
          await db.updateAnalysisSessionStatus(input.sessionId, "failed");
          throw new Error("No API keys configured. Please add at least one API key in settings.");
        }

        // Get active target engines
        const targetEngines = await db.getActiveTargetEngines();

        // Execute tests in background (don't await)
        executeBatchTests({
          sessionId: input.sessionId,
          userId: ctx.user.id,
          seedKeywords,
          userApiKeys,
          targetEngines,
          brandName: project.brandName,
          competitors: project.competitors || [],
        }).catch(async (error: unknown) => {
          console.error("Batch test execution failed:", error);
          await db.updateAnalysisSessionStatus(input.sessionId, "failed");
        });

        return {
          success: true,
          message: "Batch test started. This may take several minutes.",
        };
      }),

    listByProject: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ input }) => {
        return db.getAnalysisSessionsByProjectId(input.projectId);
      }),

    getById: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ input }) => {
        return db.getAnalysisSessionById(input.sessionId);
      }),

    getMetrics: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ input }) => {
        const responses = await db.getEngineResponsesBySessionId(input.sessionId);
        const actionItems = await db.getActionItemsBySessionId(input.sessionId);
        
        // Calculate metrics from responses
        let totalMentions = 0;
        let weightedScore = 0;
        const sentimentBreakdown = { positive: 0, neutral: 0, negative: 0, sarcastic: 0 };
        const citationAnalysis: Record<string, number> = {};
        
        for (const response of responses) {
          const mentions = await db.getBrandMentionsByResponseId(response.id);
          const citations = await db.getCitationSourcesByResponseId(response.id);
          
          totalMentions += mentions.length;
          
          for (const mention of mentions) {
            // Calculate weighted score based on rank
            if (mention.rankPosition === 1) weightedScore += 10;
            else if (mention.rankPosition && mention.rankPosition <= 3) weightedScore += 5;
            else if (mention.rankPosition && mention.rankPosition <= 10) weightedScore += 3;
            else weightedScore += 1;
            
            // Sentiment breakdown
            if (mention.isSarcastic) {
              sentimentBreakdown.sarcastic++;
            } else if (mention.sentimentScore > 0) {
              sentimentBreakdown.positive++;
            } else if (mention.sentimentScore < 0) {
              sentimentBreakdown.negative++;
            } else {
              sentimentBreakdown.neutral++;
            }
          }
          
          for (const citation of citations) {
            citationAnalysis[citation.sourceType] = (citationAnalysis[citation.sourceType] || 0) + 1;
          }
        }
        
        return {
          sessionId: input.sessionId,
          summaryMetrics: {
            shareOfVoiceFrequency: totalMentions,
            shareOfVoiceWeighted: weightedScore,
            sentimentBreakdown,
          },
          citationAnalysis,
          actionPlan: actionItems,
        };
      }),
  }),

  // ============ Action Items ============
  actionItem: router({
    updateStatus: protectedProcedure
      .input(z.object({
        itemId: z.number(),
        status: z.enum(["pending", "in_progress", "completed"]),
      }))
      .mutation(async ({ input }) => {
        await db.updateActionItemStatus(input.itemId, input.status);
        return { success: true };
      }),
  }),

  // ============ Target Engines ============
  targetEngine: router({
    list: protectedProcedure.query(async () => {
      return db.getActiveTargetEngines();
    }),
  }),

  // ============ API Keys (BYOK) ============
  apiKey: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getApiKeysByUserId(ctx.user.id);
    }),

    create: protectedProcedure
      .input(z.object({
        provider: z.enum(["openai", "perplexity", "google"]),
        apiKey: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.createApiKey(ctx.user.id, input.provider, input.apiKey);
      }),

    update: protectedProcedure
      .input(z.object({
        keyId: z.number(),
        apiKey: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.updateApiKey(input.keyId, ctx.user.id, input.apiKey);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ keyId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteApiKey(input.keyId, ctx.user.id);
        return { success: true };
      }),

    test: protectedProcedure
      .input(z.object({
        provider: z.enum(["openai", "perplexity", "google"]),
        query: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const apiKey = await db.getDecryptedApiKey(ctx.user.id, input.provider);
        if (!apiKey) {
          throw new Error(`No API key found for ${input.provider}`);
        }

        const { queryEngine } = await import("./aiEngines");
        const response = await queryEngine(input.provider, apiKey, input.query);
        
        return {
          content: response.content,
          citations: response.citations || [],
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;

// ============ Helper Functions ============

function generateTemplateQueries(seedKeyword: string, market: "TW" | "JP"): string[] {
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
  
  if (market === "JP") {
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

async function generateAICreativeQueries(seedKeyword: string, market: "TW" | "JP"): Promise<string[]> {
  const marketContext = market === "TW" 
    ? "你是一個 25 歲注重 CP 值的台灣大學生，經常在 PTT、Dcard 上尋找產品推薦。"
    : "あなたは25歳の日本の大学生で、コストパフォーマンスを重視し、よく口コミサイトで製品レビューを探します。";
  
  const prompt = `${marketContext}
請針對「${seedKeyword}」這個產品，提出 10 個你會在搜尋引擎或 AI 助手（如 ChatGPT）上詢問的問題。
這些問題應該：
1. 反映真實消費者的疑慮和需求
2. 包含不同購買階段（認知、考慮、決策）
3. 可能帶有口語化或網路用語

請直接列出問題，每行一個問題，不需要編號。`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "你是一個協助生成搜尋問句的助手。" },
        { role: "user", content: prompt },
      ],
    });
    
    const content = response.choices[0]?.message?.content || "";
    const contentStr = typeof content === 'string' ? content : '';
    const queries = contentStr
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0 && !line.match(/^\d+[\.\)]/)) // Remove numbered lines
      .slice(0, 10);
    
    return queries;
  } catch (error) {
    console.error("Failed to generate AI creative queries:", error);
    // Fallback to template-based queries
    return generateTemplateQueries(seedKeyword, market).slice(0, 10);
  }
}
