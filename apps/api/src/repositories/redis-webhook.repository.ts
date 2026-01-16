import type { Redis } from "ioredis";
import { generateId } from "@desk-agent/shared";
import type { WebhookRepository } from "@desk-agent/domain/notify";
import type { Webhook, CreateWebhookInput, UpdateWebhookInput } from "@desk-agent/domain";
import { randomBytes } from "node:crypto";

const WEBHOOKS_KEY = "webhooks";
const USER_WEBHOOKS_KEY = (userId: string) => `user:${userId}:webhooks`;

export class RedisWebhookRepository implements WebhookRepository {
  constructor(private redis: Redis) {}

  async create(input: CreateWebhookInput): Promise<Webhook> {
    const webhook: Webhook = {
      id: generateId(),
      userId: input.userId,
      name: input.name,
      url: input.url,
      secret: randomBytes(32).toString("hex"),
      events: input.events,
      enabled: true,
      failureCount: 0,
      lastTriggeredAt: null,
      createdAt: new Date(),
    };

    await this.redis.hset(WEBHOOKS_KEY, webhook.id, JSON.stringify(webhook, this.dateReplacer));
    await this.redis.sadd(USER_WEBHOOKS_KEY(input.userId), webhook.id);

    return webhook;
  }

  async findById(id: string): Promise<Webhook | null> {
    const data = await this.redis.hget(WEBHOOKS_KEY, id);
    if (!data) return null;
    return JSON.parse(data, this.dateReviver) as Webhook;
  }

  async findByUserId(userId: string): Promise<Webhook[]> {
    const ids = await this.redis.smembers(USER_WEBHOOKS_KEY(userId));
    if (ids.length === 0) return [];

    const webhooks: Webhook[] = [];
    for (const id of ids) {
      const webhook = await this.findById(id);
      if (webhook) webhooks.push(webhook);
    }
    return webhooks;
  }

  async update(id: string, input: UpdateWebhookInput): Promise<Webhook> {
    const existing = await this.findById(id);
    if (!existing) throw new Error(`Webhook ${id} not found`);

    const updated: Webhook = { ...existing, ...input };
    await this.redis.hset(WEBHOOKS_KEY, id, JSON.stringify(updated, this.dateReplacer));
    return updated;
  }

  async delete(id: string): Promise<void> {
    const webhook = await this.findById(id);
    if (webhook) {
      await this.redis.hdel(WEBHOOKS_KEY, id);
      await this.redis.srem(USER_WEBHOOKS_KEY(webhook.userId), id);
    }
  }

  async incrementFailureCount(id: string): Promise<void> {
    const webhook = await this.findById(id);
    if (webhook) {
      await this.update(id, { enabled: webhook.failureCount >= 4 ? false : webhook.enabled });
      const data = await this.redis.hget(WEBHOOKS_KEY, id);
      if (data) {
        const w = JSON.parse(data) as Webhook;
        w.failureCount++;
        await this.redis.hset(WEBHOOKS_KEY, id, JSON.stringify(w));
      }
    }
  }

  async resetFailureCount(id: string): Promise<void> {
    const data = await this.redis.hget(WEBHOOKS_KEY, id);
    if (data) {
      const w = JSON.parse(data) as Webhook;
      w.failureCount = 0;
      w.lastTriggeredAt = new Date();
      await this.redis.hset(WEBHOOKS_KEY, id, JSON.stringify(w, this.dateReplacer));
    }
  }

  private dateReplacer(_key: string, value: unknown): unknown {
    return value instanceof Date ? value.toISOString() : value;
  }

  private dateReviver(key: string, value: unknown): unknown {
    const dateKeys = ["createdAt", "lastTriggeredAt"];
    return dateKeys.includes(key) && typeof value === "string" ? new Date(value) : value;
  }
}
