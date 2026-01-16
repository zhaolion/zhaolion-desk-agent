import { createMiddleware } from "hono/factory";
import type { Context, Next } from "hono";
import type { JwtService } from "../services/jwt.service.js";

export interface AuthContext {
  userId: string;
  email?: string;
  apiKeyId?: string;
  isTestKey?: boolean;
}

declare module "hono" {
  interface ContextVariableMap {
    auth: AuthContext;
    jwtService: JwtService;
  }
}

// Simple API key store (replace with DB lookup later)
const API_KEYS: Record<string, { userId: string; keyId: string }> = {
  "dsk_test_development123456789": {
    userId: "user-dev-123",
    keyId: "key-dev-123",
  },
};

export function createAuthMiddleware(jwtService: JwtService) {
  return createMiddleware(async (c: Context, next: Next) => {
    // Try API Key first
    const apiKey = c.req.header("X-API-Key");
    if (apiKey) {
      if (!apiKey.startsWith("dsk_live_") && !apiKey.startsWith("dsk_test_")) {
        return c.json({ error: "Invalid API key format" }, 401);
      }

      const keyData = API_KEYS[apiKey];
      if (!keyData) {
        return c.json({ error: "Invalid API key" }, 401);
      }

      c.set("auth", {
        userId: keyData.userId,
        apiKeyId: keyData.keyId,
        isTestKey: apiKey.startsWith("dsk_test_"),
      });

      return next();
    }

    // Try JWT Bearer token
    const authHeader = c.req.header("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      try {
        const payload = await jwtService.verifyToken(token);
        c.set("auth", {
          userId: payload.userId,
          email: payload.email,
        });
        return next();
      } catch {
        return c.json({ error: "Invalid token" }, 401);
      }
    }

    return c.json({ error: "Authentication required" }, 401);
  });
}

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
