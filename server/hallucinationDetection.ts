import { invokeLLM } from "./_core/llm";

/**
 * AI 幻覺指數偵測模組
 * 分析 AI 回應中的事實準確性，檢測可能的幻覺內容
 */

export interface HallucinationAnalysis {
  hallucinationScore: number; // 0-100，越高表示幻覺風險越高
  confidence: "high" | "medium" | "low";
  issues: HallucinationIssue[];
  summary: string;
}

export interface HallucinationIssue {
  type: "unverifiable_claim" | "inconsistent_data" | "missing_citation" | "vague_statement" | "outdated_info";
  severity: "high" | "medium" | "low";
  description: string;
  excerpt: string; // 問題片段
}

/**
 * 使用 LLM 分析 AI 回應中的幻覺指數
 */
export async function detectHallucination(
  query: string,
  response: string,
  citations?: string[]
): Promise<HallucinationAnalysis> {
  const citationContext = citations && citations.length > 0
    ? `\n\n引用來源：\n${citations.map((c, i) => `${i + 1}. ${c}`).join("\n")}`
    : "\n\n（無引用來源）";

  const prompt = `你是一個專業的事實查核專家，請分析以下 AI 回應的可信度，檢測可能的幻覺內容（Hallucination）。

**使用者問句：**
${query}

**AI 回應：**
${response}
${citationContext}

請從以下角度分析：

1. **無法驗證的聲明**：回應中是否包含具體數據、統計資料、排名等資訊，但沒有提供來源？
2. **不一致的數據**：回應中的數據或事實是否前後矛盾？
3. **缺少引用**：重要聲明是否缺乏引用來源支持？
4. **模糊陳述**：是否使用過多模糊詞彙（如「可能」、「據說」、「有人認為」）來迴避具體事實？
5. **過時資訊**：是否可能包含過時的資訊或數據？

請以 JSON 格式回應，包含以下欄位：
{
  "hallucinationScore": 0-100 的分數（0=完全可信，100=高度可疑），
  "confidence": "high" | "medium" | "low"（分析信心水平），
  "issues": [
    {
      "type": "unverifiable_claim" | "inconsistent_data" | "missing_citation" | "vague_statement" | "outdated_info",
      "severity": "high" | "medium" | "low",
      "description": "問題描述",
      "excerpt": "問題片段（從回應中摘錄）"
    }
  ],
  "summary": "整體評估摘要（1-2 句話）"
}`;

  try {
    const llmResponse = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "你是一個專業的事實查核專家，擅長檢測 AI 生成內容中的幻覺（Hallucination）。請以 JSON 格式回應。",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "hallucination_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              hallucinationScore: {
                type: "number",
                description: "幻覺指數分數 0-100",
              },
              confidence: {
                type: "string",
                enum: ["high", "medium", "low"],
                description: "分析信心水平",
              },
              issues: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    type: {
                      type: "string",
                      enum: ["unverifiable_claim", "inconsistent_data", "missing_citation", "vague_statement", "outdated_info"],
                    },
                    severity: {
                      type: "string",
                      enum: ["high", "medium", "low"],
                    },
                    description: {
                      type: "string",
                    },
                    excerpt: {
                      type: "string",
                    },
                  },
                  required: ["type", "severity", "description", "excerpt"],
                  additionalProperties: false,
                },
              },
              summary: {
                type: "string",
                description: "整體評估摘要",
              },
            },
            required: ["hallucinationScore", "confidence", "issues", "summary"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = llmResponse.choices[0]?.message?.content;
    if (!content || typeof content !== "string") {
      throw new Error("LLM 未返回有效內容");
    }

    const analysis: HallucinationAnalysis = JSON.parse(content);
    return analysis;
  } catch (error) {
    console.error("[Hallucination Detection] 分析失敗：", error);
    // 返回預設值
    return {
      hallucinationScore: 50,
      confidence: "low",
      issues: [],
      summary: "幻覺檢測分析失敗，請稍後重試。",
    };
  }
}

/**
 * 批次分析多個回應的幻覺指數
 */
export async function batchDetectHallucination(
  items: Array<{ query: string; response: string; citations?: string[] }>
): Promise<HallucinationAnalysis[]> {
  const results: HallucinationAnalysis[] = [];

  for (const item of items) {
    const analysis = await detectHallucination(item.query, item.response, item.citations);
    results.push(analysis);
  }

  return results;
}

/**
 * 計算整體幻覺指數統計
 */
export function calculateHallucinationStats(analyses: HallucinationAnalysis[]) {
  if (analyses.length === 0) {
    return {
      averageScore: 0,
      highRiskCount: 0,
      mediumRiskCount: 0,
      lowRiskCount: 0,
      totalIssues: 0,
      issuesByType: {} as Record<string, number>,
    };
  }

  const averageScore = analyses.reduce((sum, a) => sum + a.hallucinationScore, 0) / analyses.length;
  const highRiskCount = analyses.filter((a) => a.hallucinationScore >= 70).length;
  const mediumRiskCount = analyses.filter((a) => a.hallucinationScore >= 40 && a.hallucinationScore < 70).length;
  const lowRiskCount = analyses.filter((a) => a.hallucinationScore < 40).length;

  const allIssues = analyses.flatMap((a) => a.issues);
  const issuesByType: Record<string, number> = {};
  allIssues.forEach((issue) => {
    issuesByType[issue.type] = (issuesByType[issue.type] || 0) + 1;
  });

  return {
    averageScore: Math.round(averageScore * 10) / 10,
    highRiskCount,
    mediumRiskCount,
    lowRiskCount,
    totalIssues: allIssues.length,
    issuesByType,
  };
}
