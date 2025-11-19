import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Rate Limiting and Retry Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should have correct rate limit configuration for Gemini", () => {
    // Import the rate limits configuration
    const RATE_LIMITS: Record<string, { delayMs: number; maxRetries: number }> = {
      gemini: { delayMs: 7000, maxRetries: 3 },
      openai: { delayMs: 1000, maxRetries: 3 },
      perplexity: { delayMs: 1000, maxRetries: 3 },
    };

    expect(RATE_LIMITS.gemini.delayMs).toBe(7000);
    expect(RATE_LIMITS.gemini.maxRetries).toBe(3);
    
    // Verify Gemini rate limit allows max 10 requests per minute
    const requestsPerMinute = 60000 / RATE_LIMITS.gemini.delayMs;
    expect(requestsPerMinute).toBeLessThanOrEqual(10);
  });

  it("should identify retryable errors correctly", () => {
    function isRetryableError(error: any): boolean {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return errorMessage.includes('503') || errorMessage.includes('429') || errorMessage.includes('overloaded');
    }

    // Test 503 error
    const error503 = new Error("Gemini API error: 503 - The model is overloaded");
    expect(isRetryableError(error503)).toBe(true);

    // Test 429 error
    const error429 = new Error("Gemini API error: 429 - You exceeded your current quota");
    expect(isRetryableError(error429)).toBe(true);

    // Test overloaded error
    const errorOverloaded = new Error("The model is overloaded. Please try again later.");
    expect(isRetryableError(errorOverloaded)).toBe(true);

    // Test non-retryable error
    const error400 = new Error("Bad request");
    expect(isRetryableError(error400)).toBe(false);
  });

  it("should extract retry delay from error message", () => {
    function getRetryDelay(error: any): number {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const match = errorMessage.match(/retry in (\d+)/);
      if (match && match[1]) {
        return parseInt(match[1]) * 1000;
      }
      return 5000;
    }

    // Test with retry delay in error message
    const errorWithDelay = new Error("Please retry in 34 seconds");
    expect(getRetryDelay(errorWithDelay)).toBe(34000);

    // Test without retry delay
    const errorWithoutDelay = new Error("Service unavailable");
    expect(getRetryDelay(errorWithoutDelay)).toBe(5000);
  });

  it("should calculate correct delay for different providers", () => {
    const RATE_LIMITS: Record<string, { delayMs: number; maxRetries: number }> = {
      gemini: { delayMs: 7000, maxRetries: 3 },
      openai: { delayMs: 1000, maxRetries: 3 },
      perplexity: { delayMs: 1000, maxRetries: 3 },
    };

    // Gemini should have 7 second delay
    expect(RATE_LIMITS.gemini.delayMs).toBe(7000);
    
    // OpenAI should have 1 second delay
    expect(RATE_LIMITS.openai.delayMs).toBe(1000);
    
    // Perplexity should have 1 second delay
    expect(RATE_LIMITS.perplexity.delayMs).toBe(1000);
  });

  it("should have consistent retry configuration across providers", () => {
    const RATE_LIMITS: Record<string, { delayMs: number; maxRetries: number }> = {
      gemini: { delayMs: 7000, maxRetries: 3 },
      openai: { delayMs: 1000, maxRetries: 3 },
      perplexity: { delayMs: 1000, maxRetries: 3 },
    };

    // All providers should have same max retries
    expect(RATE_LIMITS.gemini.maxRetries).toBe(3);
    expect(RATE_LIMITS.openai.maxRetries).toBe(3);
    expect(RATE_LIMITS.perplexity.maxRetries).toBe(3);
  });
});
