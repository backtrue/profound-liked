import { describe, expect, it } from "vitest";
import { analyzeBrandMentions } from "./llmBrandAnalysis";
import { detectHallucination } from "./hallucinationDetection";
import { detectSarcasm } from "./enhancedSarcasmDetection";

describe("LLM Analysis Functions", () => {
  describe("analyzeBrandMentions", () => {
    it("should analyze brand mentions in AI response", async () => {
      const query = "推薦好用的筆記型電腦";
      const response = "我推薦 MacBook Pro，它的效能很好，適合專業工作。另外 ThinkPad 也是不錯的選擇。";
      const brandName = "MacBook";
      const competitors = ["ThinkPad", "Dell XPS"];

      const result = await analyzeBrandMentions(query, response, brandName, competitors);

      expect(result).toHaveProperty("brands");
      expect(Array.isArray(result.brands)).toBe(true);
      expect(result.brands.length).toBeGreaterThan(0);

      const macbookMention = result.brands.find((b: any) => b.brandName === "MacBook");
      expect(macbookMention).toBeDefined();
      expect(macbookMention.mentioned).toBe(true);
    }, 30000); // LLM calls may take longer
  });

  describe("detectHallucination", () => {
    it("should detect hallucination in AI response without citations", async () => {
      const query = "2024 年台灣 GDP 成長率是多少？";
      const response = "根據最新數據，2024 年台灣 GDP 成長率達到 8.5%，創下歷史新高。";
      const citations: string[] = [];

      const result = await detectHallucination(query, response, citations);

      expect(result).toHaveProperty("hallucinationScore");
      expect(result).toHaveProperty("confidence");
      expect(result).toHaveProperty("issues");
      expect(result).toHaveProperty("summary");

      expect(typeof result.hallucinationScore).toBe("number");
      expect(result.hallucinationScore).toBeGreaterThanOrEqual(0);
      expect(result.hallucinationScore).toBeLessThanOrEqual(100);

      expect(["high", "medium", "low"]).toContain(result.confidence);
    }, 30000);

    it("should give lower hallucination score with citations", async () => {
      const query = "2024 年台灣 GDP 成長率是多少？";
      const response = "根據行政院主計總處發布的數據，2024 年台灣 GDP 成長率預估為 3.2%。";
      const citations = ["https://www.dgbas.gov.tw/"];

      const result = await detectHallucination(query, response, citations);

      expect(result.hallucinationScore).toBeLessThan(50); // Should be lower with citations
    }, 30000);
  });

  describe("detectSarcasm", () => {
    it("should detect sarcasm in Taiwan market context", async () => {
      const text = "這產品真的超棒der，用了馬上壞掉，讚啦！";
      const market = "taiwan";

      const result = await detectSarcasm(text, market);

      expect(result).toHaveProperty("isSarcastic");
      expect(result).toHaveProperty("confidence");
      expect(result).toHaveProperty("reasoning");

      expect(typeof result.isSarcastic).toBe("boolean");
      expect(["high", "medium", "low"]).toContain(result.confidence);
    }, 30000);

    it("should detect non-sarcastic positive review", async () => {
      const text = "這個產品真的很好用，品質優良，值得推薦！";
      const market = "taiwan";

      const result = await detectSarcasm(text, market);

      expect(result.isSarcastic).toBe(false);
    }, 30000);

    it("should detect sarcasm in Japan market context", async () => {
      const text = "素晴らしい製品ですね（棒読み）";
      const market = "japan";

      const result = await detectSarcasm(text, market);

      expect(result.isSarcastic).toBe(true);
    }, 30000);
  });
});
