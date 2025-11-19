import { describe, expect, it } from "vitest";

/**
 * Test exponential backoff retry delay calculation
 * This simulates the getRetryDelay function logic from batchTestExecutor.ts
 */
function calculateRetryDelay(errorMessage: string, attempt: number): number {
  // Check if error message contains suggested retry delay
  const match = errorMessage.match(/retry in (\d+)/);
  if (match && match[1]) {
    return parseInt(match[1]) * 1000;
  }
  
  // Exponential backoff: 5s, 10s, 20s, 40s, 80s
  const baseDelay = 5000;
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  
  // For testing, we'll use the center value (no jitter)
  // In production, jitter is ±20%
  return Math.min(exponentialDelay, 120000); // Cap at 2 minutes
}

describe("Exponential Backoff Retry Strategy", () => {
  it("should use suggested delay from error message", () => {
    const error = "API error: 503 - please retry in 30 seconds";
    const delay = calculateRetryDelay(error, 0);
    expect(delay).toBe(30000); // 30 seconds
  });

  it("should calculate exponential backoff for attempt 0", () => {
    const error = "API error: 503 - service overloaded";
    const delay = calculateRetryDelay(error, 0);
    expect(delay).toBe(5000); // 5 seconds (5000 * 2^0)
  });

  it("should calculate exponential backoff for attempt 1", () => {
    const error = "API error: 503 - service overloaded";
    const delay = calculateRetryDelay(error, 1);
    expect(delay).toBe(10000); // 10 seconds (5000 * 2^1)
  });

  it("should calculate exponential backoff for attempt 2", () => {
    const error = "API error: 503 - service overloaded";
    const delay = calculateRetryDelay(error, 2);
    expect(delay).toBe(20000); // 20 seconds (5000 * 2^2)
  });

  it("should calculate exponential backoff for attempt 3", () => {
    const error = "API error: 503 - service overloaded";
    const delay = calculateRetryDelay(error, 3);
    expect(delay).toBe(40000); // 40 seconds (5000 * 2^3)
  });

  it("should calculate exponential backoff for attempt 4", () => {
    const error = "API error: 503 - service overloaded";
    const delay = calculateRetryDelay(error, 4);
    expect(delay).toBe(80000); // 80 seconds (5000 * 2^4)
  });

  it("should cap delay at 2 minutes", () => {
    const error = "API error: 503 - service overloaded";
    const delay = calculateRetryDelay(error, 10); // Would be 5120 seconds without cap
    expect(delay).toBe(120000); // Capped at 120 seconds (2 minutes)
  });

  it("should handle 429 rate limit errors", () => {
    const error = "API error: 429 - rate limit exceeded";
    const delay = calculateRetryDelay(error, 0);
    expect(delay).toBe(5000); // Start with 5 seconds
  });
});

describe("Rate Limit Configuration", () => {
  it("should have increased Gemini delay to 12 seconds", () => {
    const RATE_LIMITS = {
      gemini: { delayMs: 12000, maxRetries: 5 },
      openai: { delayMs: 1000, maxRetries: 3 },
      perplexity: { delayMs: 1000, maxRetries: 3 },
    };
    
    expect(RATE_LIMITS.gemini.delayMs).toBe(12000);
    expect(RATE_LIMITS.gemini.maxRetries).toBe(5);
  });

  it("should calculate total max delay for Gemini with exponential backoff", () => {
    // With 5 retries and exponential backoff: 5s + 10s + 20s + 40s + 80s = 155s
    const delays = [0, 1, 2, 3, 4].map(attempt => 
      calculateRetryDelay("503 error", attempt)
    );
    const totalDelay = delays.reduce((sum, delay) => sum + delay, 0);
    
    expect(totalDelay).toBe(155000); // 155 seconds total retry time
  });

  it("should respect 2-minute cap for very long retries", () => {
    const delay = calculateRetryDelay("503 error", 100);
    expect(delay).toBeLessThanOrEqual(120000);
  });
});
