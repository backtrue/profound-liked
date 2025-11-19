import * as db from "./db";
import { queryEngine } from "./aiEngines";
import type { SeedKeyword, TargetEngine, ApiKey } from "../drizzle/schema";
import { emitProgress, emitError } from "./_core/socket";
import { analyzeBrandMentions } from "./llmBrandAnalysis";

interface BatchTestParams {
  sessionId: number;
  userId: number;
  seedKeywords: SeedKeyword[];
  userApiKeys: Array<Omit<ApiKey, "apiKey"> & { maskedKey: string }>;
  targetEngines: TargetEngine[];
  brandName: string;
  competitors: string[];
}

/**
 * Execute batch tests for all derivative queries across all configured engines
 */
export async function executeBatchTests(params: BatchTestParams): Promise<void> {
  const { sessionId, userId, seedKeywords, userApiKeys, targetEngines, brandName, competitors } = params;

  try {
    console.log(`[BatchTest] Starting session ${sessionId} with ${seedKeywords.length} seed keywords`);

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

    if (allQueries.length === 0) {
      await db.updateAnalysisSessionStatus(sessionId, "completed");
      console.log(`[BatchTest] No queries to test, marking session as completed`);
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
        continue;
      }

      console.log(`[BatchTest] Testing with ${engine.engineName} (${allQueries.length} queries)`);

      for (const query of allQueries) {
        totalTests++;
        
        // Calculate estimated time remaining
        const elapsedTime = Date.now() - startTime;
        const avgTimePerQuery = totalTests > 1 ? elapsedTime / (totalTests - 1) : 0;
        const remainingQueries = (allQueries.length * targetEngines.length) - totalTests;
        const estimatedTimeRemaining = Math.round(avgTimePerQuery * remainingQueries / 1000); // in seconds
        
        // Emit progress update before processing
        emitProgress(sessionId, {
          status: "running",
          currentQuery: totalTests,
          totalQueries: allQueries.length * targetEngines.length,
          currentEngine: engine.engineName,
          successCount: successfulTests,
          failedCount: failedTests,
          estimatedTimeRemaining,
          message: `正在測試：${query.queryText.substring(0, 50)}...`,
        });
        
        try {
          // Query the engine
          const response = await queryEngine(provider, apiKey, query.queryText);
          
          // Save engine response
          const engineResponse = await db.createEngineResponse({
            sessionId,
            queryId: query.queryId,
            engineId: engine.id,
            rawContent: response.content,
            citations: response.citations?.map(c => c.url) || null,
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
          
          // Add delay to avoid rate limiting
          await delay(1000);
          
        } catch (error) {
          failedTests++;
          console.error(`[BatchTest] ✗ Query ${totalTests}/${allQueries.length * targetEngines.length} failed:`, error);
          
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

  } catch (error) {
    console.error(`[BatchTest] Fatal error in session ${sessionId}:`, error);
    await db.updateAnalysisSessionStatus(sessionId, "failed");
    
    // Emit error
    emitError(sessionId, {
      message: error instanceof Error ? error.message : "未知錯誤",
    });
    
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
