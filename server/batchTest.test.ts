import { describe, expect, it, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";

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

describe("analysis.runBatchTest", () => {
  let projectId: number;
  let sessionId: number;

  beforeAll(async () => {
    // Create a test project
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const project = await caller.project.create({
      projectName: "Batch Test Project",
      brandName: "TestBrand",
      targetMarket: "TW",
      competitors: ["CompetitorA", "CompetitorB"],
    });

    projectId = project.id;

    // Create a seed keyword
    const keyword = await caller.seedKeyword.create({
      projectId,
      keyword: "測試產品",
    });

    // Generate queries
    await caller.queryGeneration.generate({
      seedKeywordId: keyword.id,
      seedKeyword: keyword.keyword,
      targetMarket: "TW",
    });

    // Create an analysis session
    const session = await caller.analysis.create({
      projectId,
    });

    sessionId = session.id;
  });

  it("validates that session exists before running batch test", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.analysis.runBatchTest({ sessionId: 99999 })
    ).rejects.toThrow("Analysis session not found");
  });

  it("requires at least one API key to be configured", async () => {
    // Create a new user context without any API keys
    const { ctx } = createAuthContext(999); // Different user ID
    const caller = appRouter.createCaller(ctx);

    // Create a project for this new user
    const project = await caller.project.create({
      projectName: "Test Project for No Keys",
      brandName: "TestBrand",
      targetMarket: "TW",
      competitors: [],
    });

    // Create an analysis session
    const session = await caller.analysis.create({
      projectId: project.id,
    });

    await expect(
      caller.analysis.runBatchTest({ sessionId: session.id })
    ).rejects.toThrow("No API keys configured");
  });

  it("starts batch test successfully when API keys are configured", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Add a test API key (this will fail in actual execution, but should start)
    await caller.apiKey.create({
      provider: "openai",
      apiKey: "sk-test-key-for-batch-test",
    });

    const result = await caller.analysis.runBatchTest({ sessionId });

    expect(result.success).toBe(true);
    expect(result.message).toContain("Batch test started");

    // Check that session status was updated to running
    const session = await db.getAnalysisSessionById(sessionId);
    expect(session?.status).toBe("running");
  });
});
