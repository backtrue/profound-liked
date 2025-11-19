import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, json } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Project - 分析專案容器
 */
export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  projectName: varchar("projectName", { length: 255 }).notNull(),
  targetMarket: mysqlEnum("targetMarket", ["TW", "JP"]).notNull(),
  brandName: varchar("brandName", { length: 255 }).notNull(),
  competitors: json("competitors").$type<string[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

/**
 * SeedKeyword - 用戶輸入的種子關鍵字
 */
export const seedKeywords = mysqlTable("seedKeywords", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  keyword: varchar("keyword", { length: 255 }).notNull(),
  searchVolume: int("searchVolume"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SeedKeyword = typeof seedKeywords.$inferSelect;
export type InsertSeedKeyword = typeof seedKeywords.$inferInsert;

/**
 * DerivativeQuery - 衍生測試問句
 */
export const derivativeQueries = mysqlTable("derivativeQueries", {
  id: int("id").autoincrement().primaryKey(),
  seedKeywordId: int("seedKeywordId").notNull(),
  queryText: text("queryText").notNull(),
  generationType: mysqlEnum("generationType", ["template", "ai_creative"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DerivativeQuery = typeof derivativeQueries.$inferSelect;
export type InsertDerivativeQuery = typeof derivativeQueries.$inferInsert;

/**
 * TargetEngine - 被測試的引擎
 */
export const targetEngines = mysqlTable("targetEngines", {
  id: int("id").autoincrement().primaryKey(),
  engineName: varchar("engineName", { length: 100 }).notNull(),
  modelVersion: varchar("modelVersion", { length: 100 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TargetEngine = typeof targetEngines.$inferSelect;
export type InsertTargetEngine = typeof targetEngines.$inferInsert;

/**
 * AnalysisSession - 一次完整的掃描任務
 */
export const analysisSessions = mysqlTable("analysisSessions", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  status: mysqlEnum("status", ["pending", "running", "completed", "failed"]).default("pending").notNull(),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  errorMessage: text("errorMessage"),
});

export type AnalysisSession = typeof analysisSessions.$inferSelect;
export type InsertAnalysisSession = typeof analysisSessions.$inferInsert;

/**
 * EngineResponse - 引擎回傳的原始資料
 */
export const engineResponses = mysqlTable("engineResponses", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  queryId: int("queryId").notNull(),
  engineId: int("engineId").notNull(),
  rawContent: text("rawContent").notNull(),
  citations: json("citations").$type<string[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EngineResponse = typeof engineResponses.$inferSelect;
export type InsertEngineResponse = typeof engineResponses.$inferInsert;

/**
 * BrandMention - 品牌提及訊號
 */
export const brandMentions = mysqlTable("brandMentions", {
  id: int("id").autoincrement().primaryKey(),
  responseId: int("responseId").notNull(),
  brandName: varchar("brandName", { length: 200 }).notNull(),
  sentimentScore: int("sentimentScore").notNull(), // -100 to 100
  rankPosition: int("rankPosition"),
  isSarcastic: boolean("isSarcastic").default(false),
  context: text("context"),
  // LLM enhanced fields
  recommendationStrength: mysqlEnum("recommendationStrength", ["strong_positive", "positive", "neutral", "negative", "strong_negative"]),
  mentionContext: mysqlEnum("mentionContext", ["comparison", "review", "qa", "purchase_advice", "tutorial", "other"]),
  llmAnalysis: text("llmAnalysis"), // Detailed LLM analysis result
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BrandMention = typeof brandMentions.$inferSelect;
export type InsertBrandMention = typeof brandMentions.$inferInsert;

/**
 * CitationSource - 引用來源分析
 */
export const citationSources = mysqlTable("citationSources", {
  id: int("id").autoincrement().primaryKey(),
  responseId: int("responseId").notNull(),
  url: text("url").notNull(),
  domain: varchar("domain", { length: 255 }).notNull(),
  sourceType: mysqlEnum("sourceType", ["ecommerce", "forum", "media", "video", "competitor", "official", "unknown"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CitationSource = typeof citationSources.$inferSelect;
export type InsertCitationSource = typeof citationSources.$inferInsert;

/**
 * ActionItem - 行動建議
 */
export const actionItems = mysqlTable("actionItems", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  actionType: mysqlEnum("actionType", ["content_gap", "tech_seo", "pr_outreach", "trust_building"]).notNull(),
  priority: mysqlEnum("priority", ["high", "medium", "low"]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  tactic: text("tactic"),
  referenceSource: text("referenceSource"),
  status: mysqlEnum("status", ["pending", "in_progress", "completed"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ActionItem = typeof actionItems.$inferSelect;
export type InsertActionItem = typeof actionItems.$inferInsert;

/**
 * DomainCategory - 白名單域名分類（用於引用來源分類）
 */
export const domainCategories = mysqlTable("domainCategories", {
  id: int("id").autoincrement().primaryKey(),
  domain: varchar("domain", { length: 255 }).notNull().unique(),
  category: mysqlEnum("category", ["ecommerce", "forum", "media", "video", "competitor", "official"]).notNull(),
  market: mysqlEnum("market", ["TW", "JP", "BOTH"]).default("BOTH").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DomainCategory = typeof domainCategories.$inferSelect;
export type InsertDomainCategory = typeof domainCategories.$inferInsert;

/**
 * ApiKey - 使用者的 API Key 管理（BYOK）
 */
export const apiKeys = mysqlTable("apiKeys", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  provider: mysqlEnum("provider", ["openai", "perplexity", "google"]).notNull(),
  apiKey: text("apiKey").notNull(), // Encrypted
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = typeof apiKeys.$inferInsert;
