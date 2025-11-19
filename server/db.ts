import { eq, desc, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users, 
  projects, InsertProject, Project,
  seedKeywords, InsertSeedKeyword, SeedKeyword,
  derivativeQueries, InsertDerivativeQuery, DerivativeQuery,
  targetEngines, InsertTargetEngine, TargetEngine,
  analysisSessions, InsertAnalysisSession, AnalysisSession,
  engineResponses, InsertEngineResponse, EngineResponse,
  brandMentions, InsertBrandMention, BrandMention,
  citationSources, InsertCitationSource, CitationSource,
  actionItems, InsertActionItem, ActionItem,
  domainCategories, InsertDomainCategory, DomainCategory
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============ User Management ============
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ============ Project Management ============
export async function createProject(project: InsertProject): Promise<Project> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(projects).values(project);
  const insertedId = Number(result[0].insertId);
  
  const created = await db.select().from(projects).where(eq(projects.id, insertedId)).limit(1);
  return created[0]!;
}

export async function getProjectsByUserId(userId: number): Promise<Project[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(projects).where(eq(projects.userId, userId)).orderBy(desc(projects.createdAt));
}

export async function getProjectById(projectId: number): Promise<Project | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  return result[0];
}

export async function updateProject(projectId: number, updates: Partial<InsertProject>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(projects).set(updates).where(eq(projects.id, projectId));
}

export async function deleteProject(projectId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(projects).where(eq(projects.id, projectId));
}

// ============ Seed Keywords ============
export async function createSeedKeyword(keyword: InsertSeedKeyword): Promise<SeedKeyword> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(seedKeywords).values(keyword);
  const insertedId = Number(result[0].insertId);
  
  const created = await db.select().from(seedKeywords).where(eq(seedKeywords.id, insertedId)).limit(1);
  return created[0]!;
}

export async function getSeedKeywordsByProjectId(projectId: number): Promise<SeedKeyword[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(seedKeywords).where(eq(seedKeywords.projectId, projectId));
}

// ============ Derivative Queries ============
export async function createDerivativeQueries(queries: InsertDerivativeQuery[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (queries.length > 0) {
    await db.insert(derivativeQueries).values(queries);
  }
}

export async function getDerivativeQueriesBySeedKeywordId(seedKeywordId: number): Promise<DerivativeQuery[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(derivativeQueries).where(eq(derivativeQueries.seedKeywordId, seedKeywordId));
}

// ============ Target Engines ============
export async function getActiveTargetEngines(): Promise<TargetEngine[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(targetEngines).where(eq(targetEngines.isActive, true));
}

export async function createTargetEngine(engine: InsertTargetEngine): Promise<TargetEngine> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(targetEngines).values(engine);
  const insertedId = Number(result[0].insertId);
  
  const created = await db.select().from(targetEngines).where(eq(targetEngines.id, insertedId)).limit(1);
  return created[0]!;
}

// ============ Analysis Sessions ============
export async function createAnalysisSession(session: InsertAnalysisSession): Promise<AnalysisSession> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(analysisSessions).values(session);
  const insertedId = Number(result[0].insertId);
  
  const created = await db.select().from(analysisSessions).where(eq(analysisSessions.id, insertedId)).limit(1);
  return created[0]!;
}

export async function updateAnalysisSession(sessionId: number, updates: Partial<InsertAnalysisSession>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(analysisSessions).set(updates).where(eq(analysisSessions.id, sessionId));
}

export async function getAnalysisSessionsByProjectId(projectId: number): Promise<AnalysisSession[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(analysisSessions).where(eq(analysisSessions.projectId, projectId)).orderBy(desc(analysisSessions.startedAt));
}

export async function getAnalysisSessionById(sessionId: number): Promise<AnalysisSession | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(analysisSessions).where(eq(analysisSessions.id, sessionId)).limit(1);
  return result[0];
}

// ============ Engine Responses ============
export async function createEngineResponse(response: InsertEngineResponse): Promise<EngineResponse> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(engineResponses).values(response);
  const insertedId = Number(result[0].insertId);
  
  const created = await db.select().from(engineResponses).where(eq(engineResponses.id, insertedId)).limit(1);
  return created[0]!;
}

export async function getEngineResponsesBySessionId(sessionId: number): Promise<EngineResponse[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(engineResponses).where(eq(engineResponses.sessionId, sessionId));
}

// ============ Brand Mentions ============
export async function createBrandMentions(mentions: InsertBrandMention[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (mentions.length > 0) {
    await db.insert(brandMentions).values(mentions);
  }
}

export async function getBrandMentionsByResponseId(responseId: number): Promise<BrandMention[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(brandMentions).where(eq(brandMentions.responseId, responseId));
}

// ============ Citation Sources ============
export async function createCitationSources(sources: InsertCitationSource[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (sources.length > 0) {
    await db.insert(citationSources).values(sources);
  }
}

export async function getCitationSourcesByResponseId(responseId: number): Promise<CitationSource[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(citationSources).where(eq(citationSources.responseId, responseId));
}

// ============ Action Items ============
export async function createActionItems(items: InsertActionItem[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (items.length > 0) {
    await db.insert(actionItems).values(items);
  }
}

export async function getActionItemsBySessionId(sessionId: number): Promise<ActionItem[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(actionItems).where(eq(actionItems.sessionId, sessionId)).orderBy(desc(actionItems.createdAt));
}

export async function updateActionItemStatus(itemId: number, status: "pending" | "in_progress" | "completed"): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(actionItems).set({ status }).where(eq(actionItems.id, itemId));
}

// ============ Domain Categories ============
export async function getDomainCategory(domain: string): Promise<DomainCategory | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(domainCategories).where(eq(domainCategories.domain, domain)).limit(1);
  return result[0];
}

export async function createDomainCategory(category: InsertDomainCategory): Promise<DomainCategory> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(domainCategories).values(category);
  const insertedId = Number(result[0].insertId);
  
  const created = await db.select().from(domainCategories).where(eq(domainCategories.id, insertedId)).limit(1);
  return created[0]!;
}
