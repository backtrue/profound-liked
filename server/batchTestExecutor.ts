import * as db from "./db";
import { queryEngine } from "./aiEngines";
import type { SeedKeyword, TargetEngine, ApiKey } from "../drizzle/schema";
import { emitProgress, emitError } from "./_core/socket";
import { analyzeBrandMentions } from "./llmBrandAnalysis";
import { detectHallucination } from "./hallucinationDetection";
import { generateAndSaveStrategicActions } from "./strategicActionEngine";

interface BatchTestParams {
  sessionId: number;
  userId: number;
  projectId: number;
  seedKeywords: SeedKeyword[];
  userApiKeys: Array<Omit<ApiKey, "apiKey"> & { maskedKey: string }>;
  targetEngines: TargetEngine[];
  brandName: string;
  competitors: string[];
}

// Rate limit configuration for different providers
const RATE_LIMITS: Record<string, { delayMs: number; maxRetries: number }> = {
  gemini: { delayMs: 2500, maxRetries: 5 }, // 2.5 seconds delay for Gemini 2.0 Flash-Lite (30 RPM with buffer)
  openai: { delayMs: 1000, maxRetries: 3 }, // 1 second delay for OpenAI
  perplexity: { delayMs: 1000, maxRetries: 3 }, // 1 second delay for Perplexity
};

// Helper function to check if error is retryable
function isRetryableError(error: any): boolean {
  const errorMessage = error instanceof Error ? error.message : String(error);
  return errorMessage.includes('503') || errorMessage.includes('429') || errorMessage.includes('overloaded');
}

// Helper function to calculate exponential backoff retry delay with jitter
function getRetryDelay(error: any, attempt: number): number {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  // Check if error message contains suggested retry delay
  const match = errorMessage.match(/retry in (\d+)/);
  if (match && match[1]) {
    return parseInt(match[1]) * 1000; // Convert seconds to milliseconds
  }
  
  // Exponential backoff: 5s, 10s, 20s, 40s, 80s
  const baseDelay = 5000;
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  
  // Add random jitter (±20%) to avoid thundering herd
  const jitter = exponentialDelay * 0.2 * (Math.random() - 0.5);
  const finalDelay = Math.floor(exponentialDelay + jitter);
  
  // Cap at 2 minutes
  return Math.min(finalDelay, 120000);
}

/**
 * Execute batch tests for all derivative queries across all configured engines
 */
export async function executeBatchTests(params: BatchTestParams): Promise<void> {
  const { sessionId, userId, seedKeywords, userApiKeys, targetEngines, brandName, competitors } = params;

  // Set timeout for the entire batch test (30 minutes)
  const timeoutMs = 30 * 60 * 1000;
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Batch test execution timeout (30 minutes)')), timeoutMs);
  });

  try {
    await Promise.race([
      executeBatchTestsInternal(params),
      timeoutPromise
    ]);
  } catch (error) {
    console.error(`[BatchTest] Session ${sessionId} failed:`, error);
    await db.updateAnalysisSessionStatus(sessionId, "failed");
    emitError(sessionId, {
      message: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

async function executeBatchTestsInternal(params: BatchTestParams): Promise<void> {
  const { sessionId, userId, seedKeywords, userApiKeys, targetEngines, brandName, competitors } = params;

  console.log(`[BatchTest] Starting session ${sessionId} with ${seedKeywords.length} seed keywords`);
  
  // Log session start
  await db.createExecutionLog({
    sessionId,
    level: "info",
    message: `批次測試開始：${seedKeywords.length} 個種子關鍵字`,
    details: { seedKeywordCount: seedKeywords.length, engineCount: targetEngines.length },
  });

  try {
    // Get all derivative queries for all seed keywords
    const allQueries: Array<{ seedKeywordId: number; queryText: string; queryId: number }> = [];
    
    for (const seedKeyword of seedKeywords) {
      const queries = await db.getDerivativeQueriesBySeedKeywordId(seedKeyword.id);
      allQueries.push(...queries.map(q => ({
        seedKeywordId: seedKeyword.id,
        queryText: q.queryText,
        queryId: q.id,
      })));
    }

    console.log(`[BatchTest] Found ${allQueries.length} derivative queries`);
    
    await db.createExecutionLog({
      sessionId,
      level: "info",
      message: `找到 ${allQueries.length} 個衍生問句`,
      details: { queryCount: allQueries.length },
    });

    if (allQueries.length === 0) {
      await db.updateAnalysisSessionStatus(sessionId, "completed");
      await db.createExecutionLog({
        sessionId,
        level: "warning",
        message: "沒有問句可測試，分析結束",
        details: {},
      });
      console.log(`[BatchTest] No queries to test, marking session as completed`);
      return;
    }

    // Check if there are any engines to test
    if (targetEngines.length === 0) {
      await db.updateAnalysisSessionStatus(sessionId, "failed");
      await db.createExecutionLog({
        sessionId,
        level: "error",
        message: "沒有啟用的引擎可測試，分析失敗",
        details: { engineCount: 0 },
      });
      console.log(`[BatchTest] No engines to test, marking session as failed`);
      
      // Emit error to frontend
      emitError(sessionId, {
        message: "沒有啟用的引擎可測試。請前往 API 設定頁面配置至少一個引擎。",
      });
      
      return;
    }

    // Map user API keys to providers
    const providerMap = new Map<string, string>();
    for (const key of userApiKeys) {
      const decryptedKey = await db.getDecryptedApiKey(userId, key.provider);
      if (decryptedKey) {
        providerMap.set(key.provider, decryptedKey);
      }
    }

    // Execute queries for each engine
    let totalTests = 0;
    let successfulTests = 0;
    let failedTests = 0;
    const startTime = Date.now();

    for (const engine of targetEngines) {
      // Map engine name to provider
      const provider = mapEngineToProvider(engine.engineName);
      if (!provider) {
        console.log(`[BatchTest] Skipping ${engine.engineName} - unknown provider`);
        continue;
      }
      
      const apiKey = providerMap.get(provider);
      if (!apiKey) {
        console.log(`[BatchTest] Skipping ${engine.engineName} - no API key configured`);
        await db.createExecutionLog({
          sessionId,
          level: "warning",
          message: `跳過引擎 ${engine.engineName}：未配置 API Key`,
          details: { engineName: engine.engineName, provider },
        });
        continue;
      }

      console.log(`[BatchTest] Testing with ${engine.engineName} (${allQueries.length} queries)`);
      
      // Get rate limit for current provider
      const currentRateLimit = RATE_LIMITS[provider] || { delayMs: 1000, maxRetries: 3 };

      for (const query of allQueries) {
        totalTests++;
        
        // Calculate estimated time remaining with rate limit consideration
        const elapsedTime = Date.now() - startTime;
        const avgTimePerQuery = totalTests > 1 ? elapsedTime / (totalTests - 1) : 0;
        
        // Calculate remaining queries for each engine
        const currentEngineIndex = targetEngines.findIndex(e => e.id === engine.id);
        const remainingEngines = targetEngines.length - currentEngineIndex;
        const currentQueryIndex = allQueries.findIndex(q => q.queryId === query.queryId);
        const remainingQueriesThisEngine = allQueries.length - currentQueryIndex;
        const remainingQueriesOtherEngines = (remainingEngines - 1) * allQueries.length;
        const totalRemainingQueries = remainingQueriesThisEngine + remainingQueriesOtherEngines;
        
        // Use actual average if we have enough data, otherwise use theoretical estimate
        let estimatedTimeRemaining;
        if (totalTests > 5 && avgTimePerQuery > 0) {
          // Use actual average time (more accurate after initial queries)
          estimatedTimeRemaining = Math.round(avgTimePerQuery * totalRemainingQueries / 1000);
        } else {
          // Use theoretical estimate based on rate limits (more accurate initially)
          const avgApiCallTime = 3000; // Assume 3 seconds for API call + processing
          const theoreticalTimePerQuery = avgApiCallTime + currentRateLimit.delayMs;
          estimatedTimeRemaining = Math.round(theoreticalTimePerQuery * totalRemainingQueries / 1000);
        }
        
        // Emit progress update before processing
        emitProgress(sessionId, {
          status: "running",
          currentQuery: totalTests,
          totalQueries: allQueries.length * targetEngines.length,
          currentEngine: engine.engineName,
          successCount: successfulTests,
          failedCount: failedTests,
          estimatedTimeRemaining,
          message: `[${engine.engineName}] 正在測試 (${currentQueryIndex + 1}/${allQueries.length})：${query.queryText.substring(0, 40)}...`,
          rateLimit: `${provider} 速率限制：每個問句約 ${Math.round(currentRateLimit.delayMs / 1000)} 秒`,
        });
        
        try {
          // Get rate limit config for this provider
          const rateLimit = RATE_LIMITS[provider] || { delayMs: 1000, maxRetries: 3 };
          
          // Query the engine with retry logic
          let response;
          let lastError;
          
          for (let attempt = 0; attempt <= rateLimit.maxRetries; attempt++) {
            try {
              response = await queryEngine(provider, apiKey, query.queryText);
              break; // Success, exit retry loop
            } catch (error) {
              lastError = error;
              
              if (attempt < rateLimit.maxRetries && isRetryableError(error)) {
                const retryDelay = getRetryDelay(error, attempt);
                console.log(`[BatchTest] Retry attempt ${attempt + 1}/${rateLimit.maxRetries} after ${retryDelay}ms for query: ${query.queryText.substring(0, 50)}...`);
                
                await db.createExecutionLog({
                  sessionId,
                  level: "warning",
                  message: `API 呼叫失敗，重試中 (${attempt + 1}/${rateLimit.maxRetries})`,
                  details: {
                    queryId: query.queryId,
                    queryText: query.queryText,
                    engineName: engine.engineName,
                    error: error instanceof Error ? error.message : String(error),
                    retryDelay,
                  },
                });
                
                await delay(retryDelay);
              } else {
                throw lastError; // Max retries reached or non-retryable error
              }
            }
          }
          
          if (!response) {
            throw lastError || new Error('Failed to get response after retries');
          }
          
          // Detect hallucination
          let hallucinationAnalysis;
          try {
            hallucinationAnalysis = await detectHallucination(
              query.queryText,
              response.content,
              response.citations?.map(c => c.url)
            );
          } catch (error) {
            console.error(`[Hallucination Detection] Failed for query ${query.queryId}:`, error);
          }

          // Save engine response
          const engineResponse = await db.createEngineResponse({
            sessionId,
            queryId: query.queryId,
            engineId: engine.id,
            rawContent: response.content,
            citations: response.citations?.map(c => c.url) || null,
            hallucinationScore: hallucinationAnalysis?.hallucinationScore ?? null,
            hallucinationConfidence: hallucinationAnalysis?.confidence ?? null,
            hallucinationIssues: hallucinationAnalysis?.issues ?? null,
            hallucinationSummary: hallucinationAnalysis?.summary ?? null,
          });

          // Extract citations if available
          if (response.citations && response.citations.length > 0) {
            const citationData = response.citations.map(citation => {
              const url = new URL(citation.url);
              return {
                responseId: engineResponse.id,
                url: citation.url,
                domain: url.hostname,
                sourceType: classifySourceType(citation.url),
              };
            });
            await db.createCitationSources(citationData);
          }

          // Use LLM to analyze brand mentions
          try {
            const llmAnalysis = await analyzeBrandMentions(
              query.queryText,
              response.content,
              brandName,
              competitors
            );

            // Save brand mentions with LLM analysis
            const mentionedBrands = llmAnalysis.brands.filter((b: any) => b.mentioned);
            if (mentionedBrands.length > 0) {
              const mentionData = mentionedBrands.map((brand: any) => ({
                responseId: engineResponse.id,
                brandName: brand.brandName,
                sentimentScore: brand.sentimentScore,
                rankPosition: brand.rankPosition,
                isSarcastic: brand.isSarcastic,
                context: brand.context,
                recommendationStrength: brand.recommendationStrength,
                mentionContext: brand.mentionContext,
                llmAnalysis: brand.llmAnalysis,
              }));
              await db.createBrandMentions(mentionData);
            }
          } catch (llmError) {
            console.error(`[BatchTest] LLM analysis failed for query ${query.queryId}:`, llmError);
            // Fallback to simple keyword matching
            const mentions = detectBrandMentions(response.content, brandName, competitors);
            if (mentions.length > 0) {
              const mentionData = mentions.map(mention => ({
                responseId: engineResponse.id,
                brandName: mention.brandName,
                context: mention.context,
                rankPosition: mention.rankPosition,
                sentimentScore: mention.sentimentScore,
                isSarcastic: mention.isSarcastic,
                recommendationStrength: null,
                mentionContext: null,
                llmAnalysis: "LLM 分析失敗，使用關鍵字匹配",
              }));
              await db.createBrandMentions(mentionData);
            }
          }

          successfulTests++;
          console.log(`[BatchTest] ✓ Query ${totalTests}/${allQueries.length * targetEngines.length}: ${query.queryText.substring(0, 50)}...`);
          
          // Emit success progress
          emitProgress(sessionId, {
            status: "running",
            currentQuery: totalTests,
            totalQueries: allQueries.length * targetEngines.length,
            currentEngine: engine.engineName,
            successCount: successfulTests,
            failedCount: failedTests,
            message: `✓ 完成：${query.queryText.substring(0, 50)}...`,
          });
          
          // Add delay based on provider rate limits
          await delay(rateLimit.delayMs);
          
        } catch (error) {
          failedTests++;
          console.error(`[BatchTest] ✗ Query ${totalTests}/${allQueries.length * targetEngines.length} failed:`, error);
          
          // Log error
          await db.createExecutionLog({
            sessionId,
            level: "error",
            message: `查詢失敗：${query.queryText.substring(0, 50)}...`,
            details: {
              queryId: query.queryId,
              queryText: query.queryText,
              engineName: engine.engineName,
              error: error instanceof Error ? error.message : String(error),
            },
          });
          
          // Emit failure progress
          emitProgress(sessionId, {
            status: "running",
            currentQuery: totalTests,
            totalQueries: allQueries.length * targetEngines.length,
            currentEngine: engine.engineName,
            successCount: successfulTests,
            failedCount: failedTests,
            message: `✗ 失敗：${query.queryText.substring(0, 50)}...`,
          });
          
          // Continue with next query even if one fails
          await delay(500);
        }
      }
    }

    // Update session status
    await db.updateAnalysisSessionStatus(sessionId, "completed");
    console.log(`[BatchTest] Session ${sessionId} completed: ${successfulTests} successful, ${failedTests} failed out of ${totalTests} total tests`);
    
    // Log completion
    await db.createExecutionLog({
      sessionId,
      level: "info",
      message: `批次測試完成：成功 ${successfulTests} 筆，失敗 ${failedTests} 筆`,
      details: { totalTests, successfulTests, failedTests },
    });
    
    // Generate strategic action recommendations
    try {
      console.log(`[BatchTest] Generating strategic actions for session ${sessionId}...`);
      await generateAndSaveStrategicActions(sessionId);
      console.log(`[BatchTest] Strategic actions generated successfully`);
    } catch (error) {
      console.error(`[BatchTest] Failed to generate strategic actions:`, error);
      // Don't fail the entire session if action generation fails
    }
    
    // Emit completion progress
    emitProgress(sessionId, {
      status: "completed",
      currentQuery: totalTests,
      totalQueries: allQueries.length * targetEngines.length,
      currentEngine: "",
      successCount: successfulTests,
      failedCount: failedTests,
      message: `分析完成！成功 ${successfulTests} 筆，失敗 ${failedTests} 筆`,
    });
    
    // Send notification to owner
    try {
      const { notifyOwner } = await import("./_core/notification");
      const project = await db.getProjectById(params.projectId);
      const projectName = project?.projectName || `分析 #${sessionId}`;
      
      await notifyOwner({
        title: `🎉 分析完成：${projectName}`,
        content: `您的批次分析已經完成！\n\n結果統計：\n- 成功：${successfulTests} 筆\n- 失敗：${failedTests} 筆\n- 總計：${totalTests} 筆\n\n請前往分析結果頁面查看詳細報告。`,
      });
      console.log(`[BatchTest] Owner notification sent for session ${sessionId}`);
    } catch (notifyError) {
      console.error(`[BatchTest] Failed to send owner notification:`, notifyError);
      // Don't fail the session if notification fails
    }
  } catch (error) {
    console.error(`[BatchTest] Fatal error in session ${sessionId}:`, error);
    await db.updateAnalysisSessionStatus(sessionId, "failed");
    
    // Log fatal error
    await db.createExecutionLog({
      sessionId,
      level: "error",
      message: "批次測試發生致命錯誤",
      details: {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    });
    
    // Emit error
    emitError(sessionId, {
      message: error instanceof Error ? error.message : "未知錯誤",
    });
    
    // Send failure notification to owner
    try {
      const { notifyOwner } = await import("./_core/notification");
      const project = await db.getProjectById(params.projectId);
      const projectName = project?.projectName || `分析 #${sessionId}`;
      
      await notifyOwner({
        title: `⚠️ 分析失敗：${projectName}`,
        content: `您的批次分析執行失敗。\n\n錯誤訊息：${error instanceof Error ? error.message : "未知錯誤"}\n\n請查看執行日誌以獲取更多詳細資訊。`,
      });
      console.log(`[BatchTest] Failure notification sent for session ${sessionId}`);
    } catch (notifyError) {
      console.error(`[BatchTest] Failed to send failure notification:`, notifyError);
    }
    
    throw error;
  }
}

/**
 * Map engine name to provider
 */
function mapEngineToProvider(engineName: string): "openai" | "perplexity" | "google" | null {
  const nameLower = engineName.toLowerCase();
  
  if (nameLower.includes("chatgpt") || nameLower.includes("openai") || nameLower.includes("gpt")) {
    return "openai";
  }
  
  if (nameLower.includes("perplexity")) {
    return "perplexity";
  }
  
  if (nameLower.includes("gemini") || nameLower.includes("google")) {
    return "google";
  }
  
  return null;
}

/**
 * Classify URL into source type
 */
function classifySourceType(url: string): "official" | "ecommerce" | "forum" | "media" | "video" | "competitor" | "unknown" {
  const urlLower = url.toLowerCase();
  
  // E-commerce
  if (urlLower.includes("shopee") || urlLower.includes("pchome") || urlLower.includes("momo") || 
      urlLower.includes("amazon") || urlLower.includes("rakuten")) {
    return "ecommerce";
  }
  
  // Forum
  if (urlLower.includes("ptt.cc") || urlLower.includes("dcard") || urlLower.includes("mobile01") ||
      urlLower.includes("reddit") || urlLower.includes("2ch") || urlLower.includes("5ch")) {
    return "forum";
  }
  
  // Video
  if (urlLower.includes("youtube") || urlLower.includes("youtu.be") || urlLower.includes("vimeo")) {
    return "video";
  }
  
  // Media
  if (urlLower.includes("news") || urlLower.includes("blog") || urlLower.includes("medium") ||
      urlLower.includes("udn") || urlLower.includes("chinatimes") || urlLower.includes("ltn")) {
    return "media";
  }
  
  return "unknown";
}

/**
 * Detect brand mentions in response text
 * This is a simple implementation - can be enhanced with LLM-based analysis
 */
function detectBrandMentions(
  text: string,
  brandName: string,
  competitors: string[]
): Array<{
  brandName: string;
  context: string;
  rankPosition: number | null;
  sentimentScore: number;
  isSarcastic: boolean;
}> {
  const mentions: Array<{
    brandName: string;
    context: string;
    rankPosition: number | null;
    sentimentScore: number;
    isSarcastic: boolean;
  }> = [];
  
  const allBrands = [brandName, ...competitors];
  
  for (const brand of allBrands) {
    const regex = new RegExp(brand, "gi");
    const matches = text.match(regex);
    
    if (matches && matches.length > 0) {
      // Find context around the mention
      const index = text.toLowerCase().indexOf(brand.toLowerCase());
      const start = Math.max(0, index - 50);
      const end = Math.min(text.length, index + brand.length + 50);
      const context = text.substring(start, end);
      
      // Simple sentiment analysis based on keywords
      const sentimentScore = analyzeSentiment(context);
      
      // Detect sarcasm (basic implementation)
      const isSarcastic = detectSarcasm(context);
      
      mentions.push({
        brandName: brand,
        context,
        rankPosition: null, // Will be determined by position in list
        sentimentScore,
        isSarcastic,
      });
    }
  }
  
  return mentions;
}

/**
 * Simple sentiment analysis
 */
function analyzeSentiment(text: string): number {
  const positiveWords = ["好", "推薦", "優秀", "棒", "讚", "excellent", "great", "good", "recommend"];
  const negativeWords = ["爛", "差", "不推", "雷", "bad", "poor", "terrible", "avoid"];
  
  const textLower = text.toLowerCase();
  let score = 0;
  
  for (const word of positiveWords) {
    if (textLower.includes(word)) score += 0.3;
  }
  
  for (const word of negativeWords) {
    if (textLower.includes(word)) score -= 0.3;
  }
  
  return Math.max(-1, Math.min(1, score));
}

/**
 * Detect sarcasm (basic implementation)
 */
function detectSarcasm(text: string): boolean {
  const sarcasticPatterns = [
    "呵呵", "笑死", "真香", "反串", "酸", "諷刺",
    "lol", "yeah right", "sure", "totally"
  ];
  
  const textLower = text.toLowerCase();
  return sarcasticPatterns.some(pattern => textLower.includes(pattern));
}

/**
 * Delay helper
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
