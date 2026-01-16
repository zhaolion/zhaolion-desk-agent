import { createMiddleware } from "hono/factory";
import type { Context, Next } from "hono";
import type { JwtService } from "../services/jwt.service.js";
import type { PgApiKeyRepository } from "../repositories/pg-apikey.repository.js";

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

export function createAuthMiddleware(jwtService: JwtService, apiKeyRepository?: PgApiKeyRepository) {
  return createMiddleware(async (c: Context, next: Next) => {
    // Try API Key first
    const apiKey = c.req.header("X-API-Key");
    if (apiKey) {
      if (!apiKey.startsWith("dsk_live_") && !apiKey.startsWith("dsk_test_")) {
        return c.json({ error: "Invalid API key format" }, 401);
      }

      // Dev key for testing
      if (apiKey === "dsk_test_development123456789") {
        c.set("auth", {
          userId: "user-dev-123",
          apiKeyId: "key-dev-123",
          isTestKey: true,
        });
        return next();
      }

      // Verify from database
      if (apiKeyRepository) {
        const keyData = await apiKeyRepository.verifyKey(apiKey);
        if (keyData) {
          c.set("auth", {
            userId: keyData.userId,
            apiKeyId: keyData.keyId,
            isTestKey: false,
          });
          return next();
        }
      }

      return c.json({ error: "Invalid API key" }, 401);
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
export function createOptionalAuthMiddleware(apiKeyRepository?: PgApiKeyRepository) {
  return createMiddleware(async (c: Context, next: Next) => {
    const apiKey = c.req.header("X-API-Key");

    if (apiKey) {
      if (apiKey.startsWith("dsk_live_") || apiKey.startsWith("dsk_test_")) {
        // Dev key for testing
        if (apiKey === "dsk_test_development123456789") {
          c.set("auth", {
            userId: "user-dev-123",
            apiKeyId: "key-dev-123",
            isTestKey: true,
          });
        } else if (apiKeyRepository) {
          // Verify from database
          const keyData = await apiKeyRepository.verifyKey(apiKey);
          if (keyData) {
            c.set("auth", {
              userId: keyData.userId,
              apiKeyId: keyData.keyId,
              isTestKey: false,
            });
          }
        }
      }
    }

    await next();
  });
}
