import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(userId: number = 1): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: userId,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("project.create", () => {
  it("creates a new project with valid input", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.project.create({
      projectName: "Test Project",
      brandName: "Test Brand",
      targetMarket: "TW",
      competitors: ["Competitor A", "Competitor B"],
    });

    expect(result).toBeDefined();
    expect(result.projectName).toBe("Test Project");
    expect(result.brandName).toBe("Test Brand");
    expect(result.targetMarket).toBe("TW");
    expect(result.userId).toBe(1);
  });

  it("creates a project without competitors", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.project.create({
      projectName: "Simple Project",
      brandName: "Simple Brand",
      targetMarket: "JP",
    });

    expect(result).toBeDefined();
    expect(result.projectName).toBe("Simple Project");
    expect(result.targetMarket).toBe("JP");
  });
});

describe("project.list", () => {
  it("returns projects for authenticated user", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a project first
    await caller.project.create({
      projectName: "List Test Project",
      brandName: "List Test Brand",
      targetMarket: "TW",
    });

    const projects = await caller.project.list();

    expect(Array.isArray(projects)).toBe(true);
    expect(projects.length).toBeGreaterThan(0);
  });
});

describe("seedKeyword.create", () => {
  it("creates a seed keyword for a project", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a project first
    const project = await caller.project.create({
      projectName: "Keyword Test Project",
      brandName: "Keyword Test Brand",
      targetMarket: "TW",
    });

    const keyword = await caller.seedKeyword.create({
      projectId: project.id,
      keyword: "洗面乳",
    });

    expect(keyword).toBeDefined();
    expect(keyword.keyword).toBe("洗面乳");
    expect(keyword.projectId).toBe(project.id);
  });
});

describe("queryGeneration.generate", () => {
  it("generates derivative queries for a seed keyword", { timeout: 30000 }, async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create project and keyword
    const project = await caller.project.create({
      projectName: "Query Gen Test",
      brandName: "Query Gen Brand",
      targetMarket: "TW",
    });

    const keyword = await caller.seedKeyword.create({
      projectId: project.id,
      keyword: "測試產品",
    });

    const result = await caller.queryGeneration.generate({
      seedKeywordId: keyword.id,
      seedKeyword: keyword.keyword,
      targetMarket: "TW",
    });

    expect(result).toBeDefined();
    expect(result.total).toBeGreaterThan(0);
    expect(result.template).toBeGreaterThan(0);
    expect(result.aiCreative).toBeGreaterThanOrEqual(0);
  });
});

describe("analysis.create", () => {
  it("creates an analysis session for a project", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a project first
    const project = await caller.project.create({
      projectName: "Analysis Test Project",
      brandName: "Analysis Test Brand",
      targetMarket: "TW",
    });

    const session = await caller.analysis.create({
      projectId: project.id,
    });

    expect(session).toBeDefined();
    expect(session.projectId).toBe(project.id);
    expect(session.status).toBe("pending");
  });
});
