import { describe, it, expect } from "vitest";

describe("Estimated Time Calculation", () => {
  const RATE_LIMITS: Record<string, { delayMs: number; maxRetries: number }> = {
    gemini: { delayMs: 7000, maxRetries: 3 },
    openai: { delayMs: 1000, maxRetries: 3 },
    perplexity: { delayMs: 1000, maxRetries: 3 },
  };

  it("should calculate theoretical time correctly for Gemini", () => {
    const avgApiCallTime = 3000; // 3 seconds for API call + processing
    const theoreticalTimePerQuery = avgApiCallTime + RATE_LIMITS.gemini.delayMs;
    
    // Expected: 3000ms (API call) + 7000ms (rate limit) = 10000ms = 10 seconds per query
    expect(theoreticalTimePerQuery).toBe(10000);
    
    // For 40 queries, expected time: 40 * 10 = 400 seconds = 6.67 minutes
    const totalQueries = 40;
    const estimatedSeconds = Math.round(theoreticalTimePerQuery * totalQueries / 1000);
    expect(estimatedSeconds).toBe(400);
  });

  it("should calculate theoretical time correctly for OpenAI", () => {
    const avgApiCallTime = 3000;
    const theoreticalTimePerQuery = avgApiCallTime + RATE_LIMITS.openai.delayMs;
    
    // Expected: 3000ms + 1000ms = 4000ms = 4 seconds per query
    expect(theoreticalTimePerQuery).toBe(4000);
    
    // For 40 queries: 40 * 4 = 160 seconds = 2.67 minutes
    const totalQueries = 40;
    const estimatedSeconds = Math.round(theoreticalTimePerQuery * totalQueries / 1000);
    expect(estimatedSeconds).toBe(160);
  });

  it("should calculate remaining queries correctly for multiple engines", () => {
    const allQueries = Array.from({ length: 20 }, (_, i) => ({ queryId: i + 1 }));
    const targetEngines = [
      { id: 1, engineName: "ChatGPT" },
      { id: 2, engineName: "Gemini" },
      { id: 3, engineName: "Perplexity" },
      { id: 4, engineName: "Claude" },
    ];

    // Simulate being at query 5 of engine 2 (Gemini)
    const currentEngineIndex = 1; // Second engine
    const currentQueryIndex = 4; // Fifth query (0-indexed)
    
    const remainingEngines = targetEngines.length - currentEngineIndex;
    const remainingQueriesThisEngine = allQueries.length - currentQueryIndex;
    const remainingQueriesOtherEngines = (remainingEngines - 1) * allQueries.length;
    const totalRemainingQueries = remainingQueriesThisEngine + remainingQueriesOtherEngines;

    // Expected: 16 queries left in Gemini + 2 engines * 20 queries = 16 + 40 = 56
    expect(remainingQueriesThisEngine).toBe(16);
    expect(remainingQueriesOtherEngines).toBe(40);
    expect(totalRemainingQueries).toBe(56);
  });

  it("should use actual average when enough data is available", () => {
    const totalTests = 10; // More than 5, should use actual average
    const elapsedTime = 50000; // 50 seconds elapsed
    const avgTimePerQuery = elapsedTime / (totalTests - 1);
    
    // Expected: 50000ms / 9 = ~5555ms per query
    expect(Math.round(avgTimePerQuery)).toBe(5556);
    
    // For 30 remaining queries: 30 * 5.556 = 166.68 seconds
    const totalRemainingQueries = 30;
    const estimatedTimeRemaining = Math.round(avgTimePerQuery * totalRemainingQueries / 1000);
    expect(estimatedTimeRemaining).toBe(167);
  });

  it("should use theoretical estimate when data is insufficient", () => {
    const totalTests = 3; // Less than 5, should use theoretical estimate
    const avgApiCallTime = 3000;
    const currentRateLimit = RATE_LIMITS.gemini;
    const theoreticalTimePerQuery = avgApiCallTime + currentRateLimit.delayMs;
    
    const totalRemainingQueries = 37;
    const estimatedTimeRemaining = Math.round(theoreticalTimePerQuery * totalRemainingQueries / 1000);
    
    // Expected: 37 * 10 = 370 seconds
    expect(estimatedTimeRemaining).toBe(370);
  });

  it("should format time correctly for display", () => {
    const formatTime = (seconds: number) => {
      if (seconds < 60) return `${seconds} 秒`;
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes} 分 ${remainingSeconds} 秒`;
    };

    expect(formatTime(45)).toBe("45 秒");
    expect(formatTime(60)).toBe("1 分 0 秒");
    expect(formatTime(125)).toBe("2 分 5 秒");
    expect(formatTime(400)).toBe("6 分 40 秒");
  });
});
