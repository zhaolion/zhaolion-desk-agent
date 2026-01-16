import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { PgApiKeyRepository } from "../../repositories/pg-apikey.repository.js";

const createApiKeySchema = z.object({
  name: z.string().max(100).optional(),
  expiresInDays: z.number().min(1).max(365).optional(),
});

export function createApiKeyRoutes(repository: PgApiKeyRepository): Hono {
  const routes = new Hono();

  // GET /api-keys - List user's API keys
  routes.get("/", async (c) => {
    const auth = c.get("auth");
    const keys = await repository.findByUserId(auth.userId);
    return c.json(keys.map(k => ({
      ...k,
      createdAt: k.createdAt.toISOString(),
      lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
      expiresAt: k.expiresAt?.toISOString() ?? null,
    })));
  });

  // POST /api-keys - Create new API key
  routes.post("/", zValidator("json", createApiKeySchema), async (c) => {
    const auth = c.get("auth");
    const body = c.req.valid("json");

    const expiresAt = body.expiresInDays
      ? new Date(Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000)
      : undefined;

    const apiKey = await repository.create({
      userId: auth.userId,
      name: body.name,
      expiresAt,
    });

    // Return full key only on creation
    return c.json({
      id: apiKey.id,
      name: apiKey.name,
      key: apiKey.key, // Only time user sees full key!
      keyPrefix: apiKey.keyPrefix,
      expiresAt: apiKey.expiresAt?.toISOString() ?? null,
      createdAt: apiKey.createdAt.toISOString(),
    }, 201);
  });

  // DELETE /api-keys/:id - Delete API key
  routes.delete("/:id", async (c) => {
    const auth = c.get("auth");
    const deleted = await repository.delete(c.req.param("id"), auth.userId);

    if (!deleted) {
      return c.json({ error: "API key not found" }, 404);
    }

    return c.json({ success: true });
  });

  return routes;
}
