import { describe, it, expect, beforeAll } from "vitest";
import * as db from "./db";

describe("Execution Log Management", () => {
  let testSessionId: number;
  let testUserId: number;

  beforeAll(async () => {
    // Create a test user
    await db.upsertUser({
      openId: "test-execution-log-user",
      email: "executionlog@test.com",
      name: "Execution Log Test User",
      loginMethod: "test",
    });

    const user = await db.getUserByOpenId("test-execution-log-user");
    if (!user) throw new Error("Failed to create test user");
    testUserId = user.id;

    // Create a test project
    const project = await db.createProject({
      userId: testUserId,
      projectName: "Execution Log Test Project",
      targetMarket: "TW",
      brandName: "TestBrand",
      competitors: ["Competitor1"],
    });

    // Create a test analysis session
    const session = await db.createAnalysisSession({
      projectId: project.id,
      status: "running",
    });
    testSessionId = session.id;
  });

  it("should create execution log with info level", async () => {
    await db.createExecutionLog({
      sessionId: testSessionId,
      level: "info",
      message: "測試資訊日誌",
      details: { testKey: "testValue" },
    });

    const logs = await db.getExecutionLogsBySessionId(testSessionId);
    expect(logs.length).toBeGreaterThan(0);
    
    const infoLog = logs.find(log => log.message === "測試資訊日誌");
    expect(infoLog).toBeDefined();
    expect(infoLog?.level).toBe("info");
    expect(infoLog?.details).toEqual({ testKey: "testValue" });
  });

  it("should create execution log with warning level", async () => {
    await db.createExecutionLog({
      sessionId: testSessionId,
      level: "warning",
      message: "測試警告日誌",
      details: { warningType: "test" },
    });

    const logs = await db.getExecutionLogsByLevel(testSessionId, "warning");
    expect(logs.length).toBeGreaterThan(0);
    
    const warningLog = logs.find(log => log.message === "測試警告日誌");
    expect(warningLog).toBeDefined();
    expect(warningLog?.level).toBe("warning");
  });

  it("should create execution log with error level", async () => {
    await db.createExecutionLog({
      sessionId: testSessionId,
      level: "error",
      message: "測試錯誤日誌",
      details: { 
        error: "Test error message",
        stack: "Test stack trace",
      },
    });

    const logs = await db.getExecutionLogsByLevel(testSessionId, "error");
    expect(logs.length).toBeGreaterThan(0);
    
    const errorLog = logs.find(log => log.message === "測試錯誤日誌");
    expect(errorLog).toBeDefined();
    expect(errorLog?.level).toBe("error");
    expect(errorLog?.details).toHaveProperty("error");
    expect(errorLog?.details).toHaveProperty("stack");
  });

  it("should retrieve logs in chronological order", async () => {
    // Create multiple logs
    await db.createExecutionLog({
      sessionId: testSessionId,
      level: "info",
      message: "第一條日誌",
      details: {},
    });

    await db.createExecutionLog({
      sessionId: testSessionId,
      level: "info",
      message: "第二條日誌",
      details: {},
    });

    await db.createExecutionLog({
      sessionId: testSessionId,
      level: "info",
      message: "第三條日誌",
      details: {},
    });

    const logs = await db.getExecutionLogsBySessionId(testSessionId);
    
    // Find our test logs
    const testLogs = logs.filter(log => 
      log.message === "第一條日誌" || 
      log.message === "第二條日誌" || 
      log.message === "第三條日誌"
    );

    expect(testLogs.length).toBe(3);
    
    // Verify chronological order
    const firstLogIndex = testLogs.findIndex(log => log.message === "第一條日誌");
    const secondLogIndex = testLogs.findIndex(log => log.message === "第二條日誌");
    const thirdLogIndex = testLogs.findIndex(log => log.message === "第三條日誌");
    
    expect(firstLogIndex).toBeLessThan(secondLogIndex);
    expect(secondLogIndex).toBeLessThan(thirdLogIndex);
  });

  it("should filter logs by level correctly", async () => {
    const errorLogs = await db.getExecutionLogsByLevel(testSessionId, "error");
    const warningLogs = await db.getExecutionLogsByLevel(testSessionId, "warning");
    const infoLogs = await db.getExecutionLogsByLevel(testSessionId, "info");

    // All error logs should have level "error"
    errorLogs.forEach(log => {
      expect(log.level).toBe("error");
    });

    // All warning logs should have level "warning"
    warningLogs.forEach(log => {
      expect(log.level).toBe("warning");
    });

    // All info logs should have level "info"
    infoLogs.forEach(log => {
      expect(log.level).toBe("info");
    });
  });
});
