import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { WebhookRepository } from "@desk-agent/domain/notify";
import type { Webhook } from "@desk-agent/domain";
import { createWebhookSchema, updateWebhookSchema } from "./schemas.js";

export function createWebhookRoutes(repository: WebhookRepository): Hono {
  const routes = new Hono();

  // GET /webhooks - List user's webhooks
  routes.get("/", async (c) => {
    const auth = c.get("auth");
    const webhooks = await repository.findByUserId(auth.userId);
    return c.json(webhooks.map(serializeWebhook));
  });

  // POST /webhooks - Create webhook
  routes.post("/", zValidator("json", createWebhookSchema), async (c) => {
    const auth = c.get("auth");
    const body = c.req.valid("json");

    const webhook = await repository.create({
      userId: auth.userId,
      name: body.name,
      url: body.url,
      events: body.events,
    });

    return c.json(serializeWebhook(webhook), 201);
  });

  // GET /webhooks/:id - Get webhook
  routes.get("/:id", async (c) => {
    const auth = c.get("auth");
    const webhook = await repository.findById(c.req.param("id"));

    if (!webhook || webhook.userId !== auth.userId) {
      return c.json({ error: "Webhook not found" }, 404);
    }

    return c.json(serializeWebhook(webhook));
  });

  // PATCH /webhooks/:id - Update webhook
  routes.patch("/:id", zValidator("json", updateWebhookSchema), async (c) => {
    const auth = c.get("auth");
    const webhook = await repository.findById(c.req.param("id"));

    if (!webhook || webhook.userId !== auth.userId) {
      return c.json({ error: "Webhook not found" }, 404);
    }

    const updated = await repository.update(webhook.id, c.req.valid("json"));
    return c.json(serializeWebhook(updated));
  });

  // DELETE /webhooks/:id - Delete webhook
  routes.delete("/:id", async (c) => {
    const auth = c.get("auth");
    const webhook = await repository.findById(c.req.param("id"));

    if (!webhook || webhook.userId !== auth.userId) {
      return c.json({ error: "Webhook not found" }, 404);
    }

    await repository.delete(webhook.id);
    return c.json({ success: true });
  });

  return routes;
}

function serializeWebhook(webhook: Webhook): Record<string, unknown> {
  return {
    ...webhook,
    secret: webhook.secret.substring(0, 8) + "...", // Mask secret
    createdAt: webhook.createdAt.toISOString(),
    lastTriggeredAt: webhook.lastTriggeredAt?.toISOString() ?? null,
  };
}
