import { integer, sqliteTable, text, blob } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * Core user table backing auth flow.
 */
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  openId: text("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: text("email", { length: 320 }),
  loginMethod: text("loginMethod", { length: 64 }),
  role: text("role", { enum: ["user", "admin"] }).default("user").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  lastSignedIn: integer("lastSignedIn", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Project - 分析專案容器
 */
export const projects = sqliteTable("projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  projectName: text("projectName", { length: 255 }).notNull(),
  targetMarket: text("targetMarket", { enum: ["TW", "JP"] }).notNull(),
  brandName: text("brandName", { length: 255 }).notNull(),
  competitors: text("competitors", { mode: "json" }).$type<string[]>(),
  createdAt: integer("createdAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

/**
 * SeedKeyword - 用戶輸入的種子關鍵字
 */
export const seedKeywords = sqliteTable("seedKeywords", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("projectId").notNull(),
  keyword: text("keyword", { length: 255 }).notNull(),
  searchVolume: integer("searchVolume"),
  createdAt: integer("createdAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
});

export type SeedKeyword = typeof seedKeywords.$inferSelect;
export type InsertSeedKeyword = typeof seedKeywords.$inferInsert;

/**
 * DerivativeQuery - 衍生測試問句
 */
export const derivativeQueries = sqliteTable("derivativeQueries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  seedKeywordId: integer("seedKeywordId").notNull(),
  queryText: text("queryText").notNull(),
  generationType: text("generationType", { enum: ["template", "ai_creative"] }).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
});

export type DerivativeQuery = typeof derivativeQueries.$inferSelect;
export type InsertDerivativeQuery = typeof derivativeQueries.$inferInsert;

/**
 * TargetEngine - 被測試的引擎
 */
export const targetEngines = sqliteTable("targetEngines", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  engineName: text("engineName", { length: 100 }).notNull(),
  modelVersion: text("modelVersion", { length: 100 }),
  isActive: integer("isActive", { mode: "boolean" }).default(true).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
});

export type TargetEngine = typeof targetEngines.$inferSelect;
export type InsertTargetEngine = typeof targetEngines.$inferInsert;

/**
 * AnalysisSession - 一次完整的掃描任務
 */
export const analysisSessions = sqliteTable("analysisSessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("projectId").notNull(),
  status: text("status", { enum: ["pending", "running", "completed", "failed"] }).default("pending").notNull(),
  startedAt: integer("startedAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  completedAt: integer("completedAt", { mode: "timestamp" }),
  errorMessage: text("errorMessage"),
});

export type AnalysisSession = typeof analysisSessions.$inferSelect;
export type InsertAnalysisSession = typeof analysisSessions.$inferInsert;

/**
 * EngineResponse - 引擎回傳的原始資料
 */
export const engineResponses = sqliteTable("engineResponses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("sessionId").notNull(),
  queryId: integer("queryId").notNull(),
  engineId: integer("engineId").notNull(),
  rawContent: text("rawContent").notNull(),
  citations: text("citations", { mode: "json" }).$type<string[]>(),
  // Hallucination detection
  hallucinationScore: integer("hallucinationScore"), // 0-100
  hallucinationConfidence: text("hallucinationConfidence", { enum: ["high", "medium", "low"] }),
  hallucinationIssues: text("hallucinationIssues", { mode: "json" }).$type<Array<{
    type: string;
    severity: string;
    description: string;
    excerpt: string;
  }>>(),
  hallucinationSummary: text("hallucinationSummary"),
  createdAt: integer("createdAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
});

export type EngineResponse = typeof engineResponses.$inferSelect;
export type InsertEngineResponse = typeof engineResponses.$inferInsert;

/**
 * BrandMention - 品牌提及訊號
 */
export const brandMentions = sqliteTable("brandMentions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  responseId: integer("responseId").notNull(),
  brandName: text("brandName", { length: 200 }).notNull(),
  sentimentScore: integer("sentimentScore").notNull(), // -100 to 100
  rankPosition: integer("rankPosition"),
  isSarcastic: integer("isSarcastic", { mode: "boolean" }).default(false),
  context: text("context"),
  // LLM enhanced fields
  recommendationStrength: text("recommendationStrength", { enum: ["strong_positive", "positive", "neutral", "negative", "strong_negative"] }),
  mentionContext: text("mentionContext", { enum: ["comparison", "review", "qa", "purchase_advice", "tutorial", "other"] }),
  llmAnalysis: text("llmAnalysis"), // Detailed LLM analysis result
  createdAt: integer("createdAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
});

export type BrandMention = typeof brandMentions.$inferSelect;
export type InsertBrandMention = typeof brandMentions.$inferInsert;

/**
 * CitationSource - 引用來源分析
 */
export const citationSources = sqliteTable("citationSources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  responseId: integer("responseId").notNull(),
  url: text("url").notNull(),
  domain: text("domain", { length: 255 }).notNull(),
  sourceType: text("sourceType", { enum: ["ecommerce", "forum", "media", "video", "competitor", "official", "unknown"] }).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
});

export type CitationSource = typeof citationSources.$inferSelect;
export type InsertCitationSource = typeof citationSources.$inferInsert;

/**
 * ActionItem - 行動建議
 */
export const actionItems = sqliteTable("actionItems", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("sessionId").notNull(),
  actionType: text("actionType", { enum: ["content_gap", "tech_seo", "pr_outreach", "trust_building"] }).notNull(),
  priority: text("priority", { enum: ["high", "medium", "low"] }).notNull(),
  title: text("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  tactic: text("tactic"),
  referenceSource: text("referenceSource"),
  status: text("status", { enum: ["pending", "in_progress", "completed"] }).default("pending").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
});

export type ActionItem = typeof actionItems.$inferSelect;
export type InsertActionItem = typeof actionItems.$inferInsert;

/**
 * SarcasmCorpus - 反串語料庫
 */
export const sarcasmCorpus = sqliteTable("sarcasmCorpus", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  market: text("market", { enum: ["taiwan", "japan"] }).notNull(),
  platform: text("platform", { length: 50 }).notNull(), // PTT, Dcard, 2ch, 5ch
  text: text("text").notNull(), // 反串用語範例
  explanation: text("explanation"), // 解釋為什麼是反串
  category: text("category", { enum: ["irony", "sarcasm", "understatement", "exaggeration", "other"] }).notNull(),
  createdBy: integer("createdBy").notNull(), // user id
  createdAt: integer("createdAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
});

export type SarcasmCorpus = typeof sarcasmCorpus.$inferSelect;
export type InsertSarcasmCorpus = typeof sarcasmCorpus.$inferInsert;

/**
 * DomainCategory - 白名單域名分類（用於引用來源分類）
 */
export const domainCategories = sqliteTable("domainCategories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  domain: text("domain", { length: 255 }).notNull().unique(),
  category: text("category", { enum: ["ecommerce", "forum", "media", "video", "competitor", "official"] }).notNull(),
  market: text("market", { enum: ["TW", "JP", "BOTH"] }).default("BOTH").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
});

export type DomainCategory = typeof domainCategories.$inferSelect;
export type InsertDomainCategory = typeof domainCategories.$inferInsert;

/**
 * ApiKey - 使用者的 API Key 管理（BYOK）
 */
export const apiKeys = sqliteTable("apiKeys", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  provider: text("provider", { enum: ["openai", "perplexity", "google"] }).notNull(),
  apiKey: text("apiKey").notNull(), // Encrypted
  isActive: integer("isActive", { mode: "boolean" }).default(true).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
});

export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = typeof apiKeys.$inferInsert;

/**
 * ExecutionLog - 批次執行日誌（用於除錯和追蹤）
 */
export const executionLogs = sqliteTable("executionLogs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("sessionId").notNull(),
  level: text("level", { enum: ["info", "warning", "error"] }).notNull(),
  message: text("message").notNull(),
  details: text("details", { mode: "json" }).$type<Record<string, any>>(),
  createdAt: integer("createdAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
});

export type ExecutionLog = typeof executionLogs.$inferSelect;
export type InsertExecutionLog = typeof executionLogs.$inferInsert;
