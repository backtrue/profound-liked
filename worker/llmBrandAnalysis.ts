
import { Env } from './index';

export interface BrandAnalysisResult {
    mentions: {
        brandName: string;
        sentimentScore: number;
        sentiment: 'positive' | 'negative' | 'neutral';
        isSarcastic: boolean;
        context: string;
        recommendationStrength: 'strong_positive' | 'positive' | 'neutral' | 'negative' | 'strong_negative';
        mentionContext: 'comparison' | 'review' | 'qa' | 'purchase_advice' | 'tutorial' | 'other';
    }[];
    hallucinationScore: number;
}

export async function analyzeBrandMentions(
    env: Env,
    content: string,
    targetBrand: string,
    competitors: string[] = []
): Promise<BrandAnalysisResult> {
    if (!env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not configured');
    }

    const prompt = `你是一個專業的品牌聲譽分析專家。請分析以下搜尋結果內容，找出關於品牌「${targetBrand}」的提及。

搜尋結果內容：
"""
${content.substring(0, 15000)}
"""

請分析以下項目：
1. 是否提及品牌「${targetBrand}」？
2. 提及的情感傾向（-1.0 到 1.0，負面到正面）
3. 是否有反串或酸文成分？
4. 提及的上下文（比較、評論、問答、購買建議等）
5. 推薦強度（強烈推薦、推薦、中立、不推薦、強烈不推薦）

競品列表（如果有提及也可分析）：${competitors.join(', ')}

請以 JSON 格式輸出結果，格式如下：
{
  "mentions": [
    {
      "brandName": "品牌名稱",
      "sentimentScore": 0.8,
      "sentiment": "positive",
      "isSarcastic": false,
      "context": "提及的具體內容摘要",
      "recommendationStrength": "strong_positive",
      "mentionContext": "review"
    }
  ],
  "hallucinationScore": 0
}

注意：
- 如果沒有提及目標品牌或競品，mentions 陣列請留空。
- hallucinationScore 在此階段設為 0 即可（由其他模組處理）。
- sentimentScore 範圍為 -1.0 (極負面) 到 1.0 (極正面)。
- isSarcastic 為 boolean。
- context 請摘錄約 50-100 字的相關內容。
- mentionContext 選項：comparison, review, qa, purchase_advice, tutorial, other。
- recommendationStrength 選項：strong_positive, positive, neutral, negative, strong_negative。

只輸出 JSON，不要有任何 markdown 標記。`;

    try {
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
                        responseMimeType: "application/json",
                    }
                }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini API error: ${response.status} ${errorText}`);
        }

        const data = await response.json() as any;
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            return { mentions: [], hallucinationScore: 0 };
        }

        try {
            // Strip markdown code blocks if present
            const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
            const result = JSON.parse(cleanText);
            return result;
        } catch (e) {
            console.error('Failed to parse JSON from LLM:', text);
            return { mentions: [], hallucinationScore: 0 };
        }

    } catch (error) {
        console.error('Brand analysis failed:', error);
        return { mentions: [], hallucinationScore: 0 };
    }
}
