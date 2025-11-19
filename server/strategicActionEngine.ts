import { invokeLLM } from "./_core/llm";
import * as db from "./db";
import type { InsertActionItem } from "../drizzle/schema";

/**
 * 戰略行動建議引擎
 * 根據分析結果自動生成四大場景的行動建議
 */

interface AnalysisData {
  sessionId: number;
  brandName: string;
  competitors: string[];
  responses: Array<{
    id: number;
    rawContent: string;
    citations?: string[];
    hallucinationScore?: number | null;
  }>;
  brandMentions: Array<{
    brandName: string;
    sentimentScore: number;
    rankPosition: number | null;
    context: string;
    recommendationStrength: string | null;
    mentionContext: string | null;
  }>;
  citationSources: Array<{
    url: string;
    sourceType: string;
  }>;
}

/**
 * 生成所有場景的戰略行動建議
 */
export async function generateStrategicActions(data: AnalysisData): Promise<InsertActionItem[]> {
  const actions: InsertActionItem[] = [];

  // Scenario 1: 影片內容缺口偵測
  const videoActions = await detectVideoContentGaps(data);
  actions.push(...videoActions);

  // Scenario 2: 第三方評比文章缺席偵測
  const reviewActions = await detectThirdPartyReviewGaps(data);
  actions.push(...reviewActions);

  // Scenario 3: 內容結構化優化建議
  const structureActions = await suggestContentStructureOptimization(data);
  actions.push(...structureActions);

  // Scenario 4: 信任訊號不足偵測與 90 天行動計畫
  const trustActions = await detectTrustSignalGaps(data);
  actions.push(...trustActions);

  return actions;
}

/**
 * 場景 1：影片內容缺口偵測與建議
 * 檢測 AI 回應中是否缺少影片來源，並建議製作影片內容
 */
async function detectVideoContentGaps(data: AnalysisData): Promise<InsertActionItem[]> {
  const videoSources = data.citationSources.filter((c) => c.sourceType === "video");
  const totalSources = data.citationSources.length;
  const videoRatio = totalSources > 0 ? videoSources.length / totalSources : 0;

  // 如果影片來源佔比低於 10%，建議製作影片
  if (videoRatio < 0.1) {
    const prompt = `你是一個專業的內容策略顧問。根據以下分析數據，為品牌「${data.brandName}」生成影片內容製作建議。

**分析數據：**
- 總引用來源數：${totalSources}
- 影片來源數：${videoSources.length}
- 影片來源佔比：${(videoRatio * 100).toFixed(1)}%

**品牌提及情況：**
${data.brandMentions
  .filter((m) => m.brandName === data.brandName)
  .slice(0, 5)
  .map((m) => `- ${m.context}`)
  .join("\n")}

請生成 2-3 個具體的影片內容建議，每個建議包含：
1. 影片主題
2. 目標關鍵字
3. 預期效果

以 JSON 格式回應：
{
  "suggestions": [
    {
      "title": "建議標題",
      "description": "詳細說明",
      "tactic": "具體執行策略",
      "priority": "high" | "medium" | "low"
    }
  ]
}`;

    try {
      const llmResponse = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "你是一個專業的內容策略顧問，擅長分析 GEO 數據並提供可執行的行動建議。",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "video_content_suggestions",
            strict: true,
            schema: {
              type: "object",
              properties: {
                suggestions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      description: { type: "string" },
                      tactic: { type: "string" },
                      priority: {
                        type: "string",
                        enum: ["high", "medium", "low"],
                      },
                    },
                    required: ["title", "description", "tactic", "priority"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["suggestions"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = llmResponse.choices[0]?.message?.content;
      if (!content || typeof content !== "string") {
        throw new Error("LLM 未返回有效內容");
      }

      const result = JSON.parse(content);
      return result.suggestions.map((s: any) => ({
        sessionId: data.sessionId,
        scenario: "video_content_gap",
        title: s.title,
        description: s.description,
        priority: s.priority,
        status: "pending",
        tactic: s.tactic,
      }));
    } catch (error) {
      console.error("[Strategic Action] 影片內容缺口分析失敗：", error);
      return [];
    }
  }

  return [];
}

/**
 * 場景 2：第三方評比文章缺席偵測與建議
 * 檢測 AI 回應中是否缺少第三方評測來源
 */
async function detectThirdPartyReviewGaps(data: AnalysisData): Promise<InsertActionItem[]> {
  const mediaSources = data.citationSources.filter((c) => c.sourceType === "media");
  const forumSources = data.citationSources.filter((c) => c.sourceType === "forum");
  const totalSources = data.citationSources.length;
  const reviewRatio = totalSources > 0 ? (mediaSources.length + forumSources.length) / totalSources : 0;

  // 如果第三方評測來源佔比低於 20%，建議爭取評測
  if (reviewRatio < 0.2) {
    const prompt = `你是一個專業的 PR 與內容行銷顧問。根據以下分析數據，為品牌「${data.brandName}」生成第三方評測爭取建議。

**分析數據：**
- 總引用來源數：${totalSources}
- 媒體來源數：${mediaSources.length}
- 論壇來源數：${forumSources.length}
- 第三方評測來源佔比：${(reviewRatio * 100).toFixed(1)}%

**競品情況：**
${data.competitors.join(", ")}

請生成 2-3 個具體的第三方評測爭取建議，每個建議包含：
1. 目標媒體/平台
2. 合作方式
3. 預期效果

以 JSON 格式回應：
{
  "suggestions": [
    {
      "title": "建議標題",
      "description": "詳細說明",
      "tactic": "具體執行策略",
      "priority": "high" | "medium" | "low"
    }
  ]
}`;

    try {
      const llmResponse = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "你是一個專業的 PR 與內容行銷顧問，擅長規劃第三方評測與媒體合作策略。",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "third_party_review_suggestions",
            strict: true,
            schema: {
              type: "object",
              properties: {
                suggestions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      description: { type: "string" },
                      tactic: { type: "string" },
                      priority: {
                        type: "string",
                        enum: ["high", "medium", "low"],
                      },
                    },
                    required: ["title", "description", "tactic", "priority"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["suggestions"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = llmResponse.choices[0]?.message?.content;
      if (!content || typeof content !== "string") {
        throw new Error("LLM 未返回有效內容");
      }

      const result = JSON.parse(content);
      return result.suggestions.map((s: any) => ({
        sessionId: data.sessionId,
        scenario: "third_party_review_gap",
        title: s.title,
        description: s.description,
        priority: s.priority,
        status: "pending",
        tactic: s.tactic,
      }));
    } catch (error) {
      console.error("[Strategic Action] 第三方評測缺口分析失敗：", error);
      return [];
    }
  }

  return [];
}

/**
 * 場景 3：內容結構化優化建議
 * 分析品牌提及的情境，建議內容結構化改善
 */
async function suggestContentStructureOptimization(data: AnalysisData): Promise<InsertActionItem[]> {
  const brandMentions = data.brandMentions.filter((m) => m.brandName === data.brandName);

  if (brandMentions.length === 0) {
    return [];
  }

  const prompt = `你是一個專業的 SEO 與內容結構化專家。根據以下品牌提及分析，為品牌「${data.brandName}」生成內容結構化優化建議。

**品牌提及情況：**
${brandMentions
  .slice(0, 10)
  .map(
    (m) => `
- 情境：${m.mentionContext || "未分類"}
- 推薦強度：${m.recommendationStrength || "未知"}
- 排名位置：${m.rankPosition || "未排名"}
- 內容片段：${m.context}
`
  )
  .join("\n")}

請分析以下問題並生成建議：
1. 品牌在哪些情境下被提及？（比較評測、使用心得、購買建議等）
2. 哪些情境的提及較少或缺失？
3. 如何優化內容結構以提升在 AI 回應中的排名？

以 JSON 格式回應：
{
  "suggestions": [
    {
      "title": "建議標題",
      "description": "詳細說明",
      "tactic": "具體執行策略",
      "priority": "high" | "medium" | "low"
    }
  ]
}`;

  try {
    const llmResponse = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "你是一個專業的 SEO 與內容結構化專家，擅長優化內容以提升在 AI 搜尋中的可見度。",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "content_structure_suggestions",
          strict: true,
          schema: {
            type: "object",
            properties: {
              suggestions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    description: { type: "string" },
                    tactic: { type: "string" },
                    priority: {
                      type: "string",
                      enum: ["high", "medium", "low"],
                    },
                  },
                  required: ["title", "description", "tactic", "priority"],
                  additionalProperties: false,
                },
              },
            },
            required: ["suggestions"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = llmResponse.choices[0]?.message?.content;
    if (!content || typeof content !== "string") {
      throw new Error("LLM 未返回有效內容");
    }

    const result = JSON.parse(content);
    return result.suggestions.map((s: any) => ({
      sessionId: data.sessionId,
      scenario: "content_structure_optimization",
      title: s.title,
      description: s.description,
      priority: s.priority,
      status: "pending",
      tactic: s.tactic,
    }));
  } catch (error) {
    console.error("[Strategic Action] 內容結構化優化分析失敗：", error);
    return [];
  }
}

/**
 * 場景 4：信任訊號不足偵測與 90 天行動計畫
 * 檢測品牌的信任訊號（評測、推薦、引用）是否充足
 */
async function detectTrustSignalGaps(data: AnalysisData): Promise<InsertActionItem[]> {
  const brandMentions = data.brandMentions.filter((m) => m.brandName === data.brandName);
  const avgSentiment =
    brandMentions.length > 0
      ? brandMentions.reduce((sum, m) => sum + m.sentimentScore, 0) / brandMentions.length
      : 0;

  const strongRecommendations = brandMentions.filter(
    (m) => m.recommendationStrength === "strong" || m.recommendationStrength === "highly_recommended"
  ).length;

  const topRankings = brandMentions.filter((m) => m.rankPosition !== null && m.rankPosition <= 3).length;

  // 計算信任訊號分數 (0-100)
  const trustScore =
    (avgSentiment * 50 + // 情感分數佔 50%
      (strongRecommendations / Math.max(brandMentions.length, 1)) * 30 + // 強烈推薦佔 30%
      (topRankings / Math.max(brandMentions.length, 1)) * 20) * // 前三排名佔 20%
    100;

  // 如果信任訊號分數低於 60，生成 90 天行動計畫
  if (trustScore < 60) {
    const prompt = `你是一個專業的品牌策略顧問。根據以下分析數據，為品牌「${data.brandName}」生成 90 天信任訊號提升計畫。

**分析數據：**
- 品牌提及次數：${brandMentions.length}
- 平均情感分數：${avgSentiment.toFixed(2)}
- 強烈推薦次數：${strongRecommendations}
- 前三排名次數：${topRankings}
- 信任訊號分數：${trustScore.toFixed(1)}/100

**競品情況：**
${data.competitors.join(", ")}

請生成一個 90 天行動計畫，包含 3-5 個具體行動項目，每個項目包含：
1. 行動標題
2. 詳細說明
3. 執行策略
4. 優先級

以 JSON 格式回應：
{
  "suggestions": [
    {
      "title": "建議標題",
      "description": "詳細說明",
      "tactic": "具體執行策略（包含時間軸）",
      "priority": "high" | "medium" | "low"
    }
  ]
}`;

    try {
      const llmResponse = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "你是一個專業的品牌策略顧問，擅長制定可執行的品牌提升計畫。",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "trust_signal_action_plan",
            strict: true,
            schema: {
              type: "object",
              properties: {
                suggestions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      description: { type: "string" },
                      tactic: { type: "string" },
                      priority: {
                        type: "string",
                        enum: ["high", "medium", "low"],
                      },
                    },
                    required: ["title", "description", "tactic", "priority"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["suggestions"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = llmResponse.choices[0]?.message?.content;
      if (!content || typeof content !== "string") {
        throw new Error("LLM 未返回有效內容");
      }

      const result = JSON.parse(content);
      return result.suggestions.map((s: any) => ({
        sessionId: data.sessionId,
        scenario: "trust_signal_gap",
        title: s.title,
        description: s.description,
        priority: s.priority,
        status: "pending",
        tactic: s.tactic,
      }));
    } catch (error) {
      console.error("[Strategic Action] 信任訊號缺口分析失敗：", error);
      return [];
    }
  }

  return [];
}

/**
 * 為分析 session 生成並儲存戰略行動建議
 */
export async function generateAndSaveStrategicActions(sessionId: number): Promise<void> {
  try {
    // 獲取分析數據
    const session = await db.getAnalysisSessionById(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const project = await db.getProjectById(session.projectId);
    if (!project) {
      throw new Error(`Project ${session.projectId} not found`);
    }

    const responses = await db.getEngineResponsesBySessionId(sessionId);
    const allBrandMentions: any[] = [];
    const allCitationSources: any[] = [];

    for (const response of responses) {
      const mentions = await db.getBrandMentionsByResponseId(response.id);
      const citations = await db.getCitationSourcesByResponseId(response.id);
      allBrandMentions.push(...mentions);
      allCitationSources.push(...citations);
    }

    const analysisData: AnalysisData = {
      sessionId,
      brandName: project.brandName,
      competitors: project.competitors as string[],
      responses: responses.map((r) => ({
        id: r.id,
        rawContent: r.rawContent,
        citations: r.citations as string[] | undefined,
        hallucinationScore: r.hallucinationScore,
      })),
      brandMentions: allBrandMentions,
      citationSources: allCitationSources,
    };

    // 生成戰略行動建議
    const actions = await generateStrategicActions(analysisData);

    // 儲存到資料庫
    if (actions.length > 0) {
      await db.createActionItems(actions);
    }

    console.log(`[Strategic Action] Generated ${actions.length} action items for session ${sessionId}`);
  } catch (error) {
    console.error(`[Strategic Action] Failed to generate actions for session ${sessionId}:`, error);
    throw error;
  }
}
