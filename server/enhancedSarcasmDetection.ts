import { invokeLLM } from "./_core/llm";
import * as db from "./db";

interface SarcasmAnalysisResult {
  isSarcastic: boolean;
  confidence: number; // 0-100
  explanation: string;
  matchedPatterns: string[]; // 匹配到的語料庫範例
}

/**
 * Enhanced Sarcasm Detection using corpus-based few-shot learning
 */
export async function detectSarcasm(
  text: string,
  market: "taiwan" | "japan"
): Promise<SarcasmAnalysisResult> {
  // Get relevant sarcasm examples from corpus
  const corpusExamples = await db.getSarcasmCorpusByMarket(market);
  
  // Build few-shot examples for LLM
  const fewShotExamples = corpusExamples.slice(0, 10).map(example => ({
    text: example.text,
    explanation: example.explanation || "",
    category: example.category,
  }));

  const marketName = market === "taiwan" ? "台灣" : "日本";
  const platformExamples = market === "taiwan" 
    ? "PTT、Dcard 等台灣論壇"
    : "2ch、5ch 等日本論壇";

  const prompt = `你是一位專精於${marketName}網路文化的語言分析專家，特別擅長識別${platformExamples}中的反串、諷刺、酸文等非字面意義的表達方式。

**任務：**
判斷以下文字是否包含反串/諷刺/酸文成分。

**待分析文字：**
${text}

**${marketName}常見反串模式範例：**
${fewShotExamples.map((ex, i) => `
${i + 1}. 文字：「${ex.text}」
   解釋：${ex.explanation}
   類型：${ex.category}
`).join('\n')}

**分析要點：**
1. 檢查是否使用${marketName}特有的反串用語（例如：${market === "taiwan" ? "「der」、「真香」、「笑死」、「484」、「87」" : "「（笑）」、「棒読み」、「ステマ」、「草」、「www」"}）
2. 檢查語氣是否過度誇張或平淡（可能是反串）
3. 檢查是否使用雙重否定或輕描淡寫
4. 檢查上下文是否與字面意義矛盾
5. 檢查是否質疑內容真實性（例如：業配、收錢）

**輸出格式（JSON）：**
{
  "isSarcastic": true/false,
  "confidence": 0-100的整數（信心程度），
  "explanation": "詳細解釋為什麼判斷為反串或非反串",
  "matchedPatterns": ["匹配到的語料庫範例文字1", "匹配到的語料庫範例文字2"]
}

**注意事項：**
- 如果文字很短且沒有明顯反串特徵，confidence 應該較低
- 如果匹配到多個語料庫範例，confidence 應該較高
- 解釋要具體指出哪些用語或語氣特徵導致判斷
- matchedPatterns 只列出真正匹配的範例，沒有則為空陣列`;

  try {
    const llmResponse = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `你是一位專精於${marketName}網路文化的語言分析專家，特別擅長識別反串、諷刺、酸文等非字面意義的表達方式。`,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "sarcasm_detection",
          strict: true,
          schema: {
            type: "object",
            properties: {
              isSarcastic: { type: "boolean" },
              confidence: { type: "number" },
              explanation: { type: "string" },
              matchedPatterns: {
                type: "array",
                items: { type: "string" },
              },
            },
            required: ["isSarcastic", "confidence", "explanation", "matchedPatterns"],
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
    const result: SarcasmAnalysisResult = JSON.parse(contentStr);
    
    return result;
  } catch (error) {
    console.error("[Enhanced Sarcasm Detection] Error:", error);
    
    // Fallback: simple keyword matching
    const taiwanSarcasmKeywords = ["der", "真香", "笑死", "484", "87", "廠廠", "呵呵", "業配", "棒讀"];
    const japanSarcasmKeywords = ["（笑）", "棒読み", "ステマ", "草", "www", "皮肉", "失笑", "嘲笑"];
    
    const keywords = market === "taiwan" ? taiwanSarcasmKeywords : japanSarcasmKeywords;
    const matched = keywords.filter(keyword => text.includes(keyword));
    
    return {
      isSarcastic: matched.length > 0,
      confidence: matched.length > 0 ? 60 : 20,
      explanation: matched.length > 0 
        ? `檢測到可能的反串關鍵字：${matched.join("、")}（LLM 分析失敗，使用關鍵字匹配）`
        : "未檢測到明顯反串特徵（LLM 分析失敗，使用關鍵字匹配）",
      matchedPatterns: matched,
    };
  }
}

/**
 * Batch sarcasm detection for multiple texts
 */
export async function batchDetectSarcasm(
  texts: string[],
  market: "taiwan" | "japan"
): Promise<SarcasmAnalysisResult[]> {
  const results: SarcasmAnalysisResult[] = [];
  
  for (const text of texts) {
    const result = await detectSarcasm(text, market);
    results.push(result);
  }
  
  return results;
}
