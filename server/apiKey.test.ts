import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { encrypt, decrypt, maskApiKey } from "./encryption";

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

describe("encryption", () => {
  it("encrypts and decrypts API keys correctly", () => {
    const originalKey = "sk-test-1234567890abcdef";
    const encrypted = encrypt(originalKey);
    const decrypted = decrypt(encrypted);

    expect(decrypted).toBe(originalKey);
    expect(encrypted).not.toBe(originalKey);
  });

  it("masks API keys for display", () => {
    const apiKey = "sk-test-1234567890abcdef";
    const masked = maskApiKey(apiKey);

    expect(masked).toContain("sk-test-");
    expect(masked).toContain("cdef");
    expect(masked).toContain("*");
    expect(masked.length).toBe(apiKey.length);
  });
});

describe("apiKey.create", () => {
  it("creates and encrypts an API key", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.apiKey.create({
      provider: "openai",
      apiKey: "sk-test-openai-key",
    });

    expect(result).toBeDefined();
    expect(result.provider).toBe("openai");
    expect(result.userId).toBe(1);
    expect(result.isActive).toBe(true);
  });
});

describe("apiKey.list", () => {
  it("returns masked API keys for the user", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a key first
    await caller.apiKey.create({
      provider: "perplexity",
      apiKey: "pplx-test-key-12345",
    });

    const keys = await caller.apiKey.list();

    expect(Array.isArray(keys)).toBe(true);
    expect(keys.length).toBeGreaterThan(0);
    
    const key = keys.find(k => k.provider === "perplexity");
    expect(key).toBeDefined();
    expect(key?.maskedKey).toContain("*");
  });
});

describe("apiKey.delete", () => {
  it("soft deletes an API key", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a key
    const created = await caller.apiKey.create({
      provider: "google",
      apiKey: "google-test-key",
    });

    // Delete it
    const result = await caller.apiKey.delete({ keyId: created.id });
    expect(result.success).toBe(true);

    // Verify it's no longer in the list
    const keys = await caller.apiKey.list();
    const deletedKey = keys.find(k => k.id === created.id);
    expect(deletedKey).toBeUndefined();
  });
});
