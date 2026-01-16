import { createMiddleware } from "hono/factory";
import type { Context, Next } from "hono";

export interface AuthContext {
  userId: string;
  apiKeyId: string;
  isTestKey: boolean;
}

declare module "hono" {
  interface ContextVariableMap {
    auth: AuthContext;
  }
}

// For now, use a simple in-memory store. Replace with Redis/DB later.
const API_KEYS: Record<string, { userId: string; keyId: string }> = {
  // Test key for development
  "dsk_test_development123456789": {
    userId: "user-dev-123",
    keyId: "key-dev-123",
  },
};

export const authMiddleware = createMiddleware(async (c: Context, next: Next) => {
  const apiKey = c.req.header("X-API-Key");

  if (!apiKey) {
    return c.json({ error: "Missing API key" }, 401);
  }

  // Validate key format
  if (!apiKey.startsWith("dsk_live_") && !apiKey.startsWith("dsk_test_")) {
    return c.json({ error: "Invalid API key format" }, 401);
  }

  const keyData = API_KEYS[apiKey];
  if (!keyData) {
    return c.json({ error: "Invalid API key" }, 401);
  }

  const isTestKey = apiKey.startsWith("dsk_test_");

  c.set("auth", {
    userId: keyData.userId,
    apiKeyId: keyData.keyId,
    isTestKey,
  });

  await next();
});

// Optional: skip auth for certain paths
export const optionalAuthMiddleware = createMiddleware(async (c: Context, next: Next) => {
  const apiKey = c.req.header("X-API-Key");

  if (apiKey) {
    if (apiKey.startsWith("dsk_live_") || apiKey.startsWith("dsk_test_")) {
      const keyData = API_KEYS[apiKey];
      if (keyData) {
        c.set("auth", {
          userId: keyData.userId,
          apiKeyId: keyData.keyId,
          isTestKey: apiKey.startsWith("dsk_test_"),
        });
      }
    }
  }

  await next();
});
