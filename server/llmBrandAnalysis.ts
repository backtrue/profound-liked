import { invokeLLM } from "./_core/llm";

interface BrandMentionAnalysis {
  brandName: string;
  mentioned: boolean;
  rankPosition: number | null;
  sentimentScore: number; // -100 to 100
  isSarcastic: boolean;
  recommendationStrength: "strong_positive" | "positive" | "neutral" | "negative" | "strong_negative" | null;
  mentionContext: "comparison" | "review" | "qa" | "purchase_advice" | "tutorial" | "other" | null;
  context: string;
  llmAnalysis: string;
}

interface AnalysisResult {
  brands: BrandMentionAnalysis[];
  summary: string;
  recommendations: string[];
}

/**
 * Analyze brand mentions in AI response using LLM
 */
export async function analyzeBrandMentions(
  query: string,
  response: string,
  brandName: string,
  competitors: string[]
): Promise<AnalysisResult> {
  const allBrands = [brandName, ...competitors];
  
  const prompt = `你是一位專業的品牌分析師，請分析以下 AI 回應中的品牌提及情況。

**使用者問題：**
${query}

**AI 回應：**
${response}

**目標品牌：**
${brandName}

**競品列表：**
${competitors.join(", ")}

**分析要求：**
請針對每個品牌（目標品牌 + 競品）進行以下分析：

1. **是否被提及**：品牌是否在回應中出現
2. **排名位置**：如果回應中有明確的推薦順序或排名，該品牌排第幾名（1 = 第一名）
3. **情感分數**：對該品牌的整體情感傾向（-100 到 100，-100 = 極度負面，0 = 中性，100 = 極度正面）
4. **是否反串/酸文**：提及是否帶有諷刺、反串、酸言酸語的語氣
5. **推薦強度**：
   - strong_positive: 強烈推薦、首選、最佳選擇
   - positive: 推薦、不錯的選擇
   - neutral: 中性提及、僅列出選項
   - negative: 不推薦、有缺點
   - strong_negative: 強烈不推薦、警告避免
6. **提及情境**：
   - comparison: 品牌比較、優缺點對比
   - review: 使用心得、評測
   - qa: 問題解答、疑難排解
   - purchase_advice: 購買建議、選購指南
   - tutorial: 教學、使用說明
   - other: 其他情境
7. **提及上下文**：品牌被提及的具體句子或段落（原文引用）
8. **詳細分析**：對該品牌提及的深入分析（為什麼給這個評分、推薦強度的依據、語氣特徵等）

**輸出格式（JSON）：**
請以 JSON 格式輸出分析結果，包含以下欄位：
{
  "brands": [
    {
      "brandName": "品牌名稱",
      "mentioned": true/false,
      "rankPosition": 數字或null,
      "sentimentScore": -100到100的整數,
      "isSarcastic": true/false,
      "recommendationStrength": "strong_positive" | "positive" | "neutral" | "negative" | "strong_negative" | null,
      "mentionContext": "comparison" | "review" | "qa" | "purchase_advice" | "tutorial" | "other" | null,
      "context": "提及的原文引用",
      "llmAnalysis": "詳細分析說明"
    }
  ],
  "summary": "整體摘要：分析這個 AI 回應對目標品牌的整體態度、與競品的比較情況、關鍵發現",
  "recommendations": [
    "具體改善建議 1",
    "具體改善建議 2",
    "具體改善建議 3"
  ]
}

**注意事項：**
- 如果品牌未被提及，mentioned 為 false，其他欄位設為 null 或空字串
- 排名位置只在有明確順序時填寫（例如「推薦順序：A > B > C」）
- 反串檢測要特別注意台灣/日本網路用語（例如：「超棒der」、「真香」、「神作」等可能是反串）
- 推薦強度要基於整體語氣和用詞，不只看情感分數
- 改善建議要具體可執行，例如「增加 YouTube 教學影片」而非「提升品牌形象」`;

  try {
    const llmResponse = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "你是一位專業的品牌分析師，擅長分析 AI 生成內容中的品牌提及情況。你的分析精準、客觀，能夠識別細微的語氣差異和反串用語。",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "brand_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              brands: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    brandName: { type: "string" },
                    mentioned: { type: "boolean" },
                    rankPosition: { type: ["number", "null"] },
                    sentimentScore: { type: "number" },
                    isSarcastic: { type: "boolean" },
                    recommendationStrength: {
                      type: ["string", "null"],
                      enum: ["strong_positive", "positive", "neutral", "negative", "strong_negative", null],
                    },
                    mentionContext: {
                      type: ["string", "null"],
                      enum: ["comparison", "review", "qa", "purchase_advice", "tutorial", "other", null],
                    },
                    context: { type: "string" },
                    llmAnalysis: { type: "string" },
                  },
                  required: [
                    "brandName",
                    "mentioned",
                    "rankPosition",
                    "sentimentScore",
                    "isSarcastic",
                    "recommendationStrength",
                    "mentionContext",
                    "context",
                    "llmAnalysis",
                  ],
                  additionalProperties: false,
                },
              },
              summary: { type: "string" },
              recommendations: {
                type: "array",
                items: { type: "string" },
              },
            },
            required: ["brands", "summary", "recommendations"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = llmResponse.choices[0]?.message?.content;
    if (!content) {
      throw new Error("LLM response is empty");
    }

    const contentStr = typeof content === "string" ? content : JSON.stringify(content);
    const result: AnalysisResult = JSON.parse(contentStr);
    
    // Validate that all brands are analyzed
    const analyzedBrands = new Set(result.brands.map(b => b.brandName));
    for (const brand of allBrands) {
      if (!analyzedBrands.has(brand)) {
        // Add missing brand with default values
        result.brands.push({
          brandName: brand,
          mentioned: false,
          rankPosition: null,
          sentimentScore: 0,
          isSarcastic: false,
          recommendationStrength: null,
          mentionContext: null,
          context: "",
          llmAnalysis: "未在回應中提及此品牌",
        });
      }
    }

    return result;
  } catch (error) {
    console.error("[LLM Brand Analysis] Error:", error);
    
    // Fallback: return basic analysis
    return {
      brands: allBrands.map(brand => ({
        brandName: brand,
        mentioned: false,
        rankPosition: null,
        sentimentScore: 0,
        isSarcastic: false,
        recommendationStrength: null,
        mentionContext: null,
        context: "",
        llmAnalysis: "LLM 分析失敗，使用預設值",
      })),
      summary: "LLM 分析過程發生錯誤",
      recommendations: [],
    };
  }
}

/**
 * Generate comprehensive analysis report
 */
export async function generateAnalysisReport(
  sessionId: number,
  brandName: string,
  competitors: string[],
  analysisResults: AnalysisResult[]
): Promise<string> {
  // Aggregate statistics
  const totalResponses = analysisResults.length;
  const brandMentions = analysisResults.flatMap(r => r.brands.filter(b => b.brandName === brandName && b.mentioned));
  const competitorMentions = analysisResults.flatMap(r =>
    r.brands.filter(b => competitors.includes(b.brandName) && b.mentioned)
  );

  const avgSentiment = brandMentions.length > 0
    ? brandMentions.reduce((sum, m) => sum + m.sentimentScore, 0) / brandMentions.length
    : 0;

  const sarcasticCount = brandMentions.filter(m => m.isSarcastic).length;
  const strongPositiveCount = brandMentions.filter(m => m.recommendationStrength === "strong_positive").length;
  const positiveCount = brandMentions.filter(m => m.recommendationStrength === "positive").length;
  const negativeCount = brandMentions.filter(m => m.recommendationStrength === "negative").length;
  const strongNegativeCount = brandMentions.filter(m => m.recommendationStrength === "strong_negative").length;

  const prompt = `你是一位資深的品牌策略顧問，請根據以下數據生成一份專業的品牌分析報告。

**分析概況：**
- 分析 Session ID: ${sessionId}
- 目標品牌：${brandName}
- 競品：${competitors.join(", ")}
- 總測試問句數：${totalResponses}
- 品牌提及次數：${brandMentions.length}
- 競品提及次數：${competitorMentions.length}
- 平均情感分數：${avgSentiment.toFixed(1)} / 100
- 反串/酸文次數：${sarcasticCount}

**推薦強度分佈：**
- 強烈推薦：${strongPositiveCount}
- 推薦：${positiveCount}
- 負面：${negativeCount}
- 強烈負面：${strongNegativeCount}

**詳細分析結果：**
${JSON.stringify(analysisResults.slice(0, 10), null, 2)}
（僅顯示前 10 筆，完整數據共 ${totalResponses} 筆）

**報告要求：**
請生成一份結構完整的分析報告，包含以下章節：

1. **執行摘要**（200-300 字）
   - 核心發現
   - 品牌在 AI 搜尋中的整體表現
   - 與競品的比較

2. **AI 聲量分析**
   - 品牌提及率（提及次數 / 總問句數）
   - 與競品的聲量對比
   - 提及情境分佈（比較、評測、購買建議等）

3. **情感與推薦強度分析**
   - 整體情感傾向
   - 推薦強度分佈
   - 反串/酸文風險評估

4. **關鍵發現**
   - 品牌優勢（哪些場景表現好）
   - 品牌劣勢（哪些場景被忽略或負評）
   - 競品威脅（哪些競品表現更好）

5. **戰略建議**（至少 5 條具體可執行的建議）
   - 內容策略（需要補充哪些內容）
   - SEO/GEO 優化方向
   - 競品應對策略

請使用 Markdown 格式輸出報告，包含適當的標題、列表、粗體強調等格式。`;

  try {
    const llmResponse = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "你是一位資深的品牌策略顧問，擅長撰寫專業的分析報告。你的報告數據驅動、洞察深刻、建議具體可執行。",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const content = llmResponse.choices[0]?.message?.content;
    if (!content) {
      return "# 分析報告生成失敗\n\n報告生成過程發生錯誤，請稍後重試。";
    }
    const report = typeof content === "string" ? content : JSON.stringify(content);
    return report;
  } catch (error) {
    console.error("[Generate Report] Error:", error);
    return "# 分析報告生成失敗\n\n報告生成過程發生錯誤，請稍後重試。";
  }
}
