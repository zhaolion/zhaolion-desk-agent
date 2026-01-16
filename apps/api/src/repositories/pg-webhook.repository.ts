import { eq, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import type { Database } from "../db/index.js";
import { webhooks } from "../db/schema.js";
import type { WebhookRepository } from "@desk-agent/domain/notify";
import type { Webhook, CreateWebhookInput, UpdateWebhookInput } from "@desk-agent/domain";

export class PgWebhookRepository implements WebhookRepository {
  constructor(private db: Database) {}

  async create(input: CreateWebhookInput): Promise<Webhook> {
    const [result] = await this.db.insert(webhooks).values({
      userId: input.userId,
      name: input.name,
      url: input.url,
      secret: randomBytes(32).toString("hex"),
      events: input.events,
    }).returning();

    if (!result) {
      throw new Error("Failed to create webhook");
    }

    return this.mapToWebhook(result);
  }

  async findById(id: string): Promise<Webhook | null> {
    const [result] = await this.db.select().from(webhooks).where(eq(webhooks.id, id));
    return result ? this.mapToWebhook(result) : null;
  }

  async findByUserId(userId: string): Promise<Webhook[]> {
    const results = await this.db.select().from(webhooks).where(eq(webhooks.userId, userId));
    return results.map(this.mapToWebhook);
  }

  async update(id: string, input: UpdateWebhookInput): Promise<Webhook> {
    const [result] = await this.db.update(webhooks)
      .set(input)
      .where(eq(webhooks.id, id))
      .returning();

    if (!result) {
      throw new Error(`Webhook not found: ${id}`);
    }

    return this.mapToWebhook(result);
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(webhooks).where(eq(webhooks.id, id));
  }

  async incrementFailureCount(id: string): Promise<void> {
    await this.db.update(webhooks)
      .set({
        failureCount: sql`${webhooks.failureCount} + 1`,
        enabled: sql`CASE WHEN ${webhooks.failureCount} >= 4 THEN false ELSE ${webhooks.enabled} END`
      })
      .where(eq(webhooks.id, id));
  }

  async resetFailureCount(id: string): Promise<void> {
    await this.db.update(webhooks)
      .set({ failureCount: 0, lastTriggeredAt: new Date() })
      .where(eq(webhooks.id, id));
  }

  private mapToWebhook(row: typeof webhooks.$inferSelect): Webhook {
    return {
      id: row.id,
      userId: row.userId,
      name: row.name ?? "",
      url: row.url,
      secret: row.secret,
      events: row.events as Webhook["events"],
      enabled: row.enabled ?? true,
      failureCount: row.failureCount ?? 0,
      lastTriggeredAt: row.lastTriggeredAt,
      createdAt: row.createdAt,
    };
  }
}
