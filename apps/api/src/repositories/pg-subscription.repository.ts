import { eq } from "drizzle-orm";
import type { Database } from "../db/index.js";
import { subscriptions } from "../db/schema.js";
import type { SubscriptionRepository } from "@desk-agent/domain/billing";
import type { Subscription, CreateSubscriptionInput, UpdateSubscriptionInput, SubscriptionStatus } from "@desk-agent/domain";

export class PgSubscriptionRepository implements SubscriptionRepository {
  constructor(private db: Database) {}

  async create(input: CreateSubscriptionInput): Promise<Subscription> {
    const [result] = await this.db.insert(subscriptions).values({
      userId: input.userId ?? null,
      teamId: input.teamId ?? null,
      planId: input.planId,
      stripeSubscriptionId: input.stripeSubscriptionId ?? null,
      stripeCustomerId: input.stripeCustomerId ?? null,
    }).returning();

    if (!result) {
      throw new Error("Failed to create subscription");
    }

    return this.mapToSubscription(result);
  }

  async findById(id: string): Promise<Subscription | null> {
    const [result] = await this.db.select().from(subscriptions).where(eq(subscriptions.id, id));
    return result ? this.mapToSubscription(result) : null;
  }

  async findByUserId(userId: string): Promise<Subscription | null> {
    const [result] = await this.db.select().from(subscriptions).where(eq(subscriptions.userId, userId));
    return result ? this.mapToSubscription(result) : null;
  }

  async findByTeamId(teamId: string): Promise<Subscription | null> {
    const [result] = await this.db.select().from(subscriptions).where(eq(subscriptions.teamId, teamId));
    return result ? this.mapToSubscription(result) : null;
  }

  async findByStripeSubscriptionId(stripeSubscriptionId: string): Promise<Subscription | null> {
    const [result] = await this.db.select().from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId));
    return result ? this.mapToSubscription(result) : null;
  }

  async update(id: string, input: UpdateSubscriptionInput): Promise<Subscription> {
    const updateData: Partial<typeof subscriptions.$inferInsert> = { updatedAt: new Date() };

    if (input.planId !== undefined) updateData.planId = input.planId;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.stripeSubscriptionId !== undefined) updateData.stripeSubscriptionId = input.stripeSubscriptionId;
    if (input.stripeCustomerId !== undefined) updateData.stripeCustomerId = input.stripeCustomerId;
    if (input.currentPeriodStart !== undefined) updateData.currentPeriodStart = input.currentPeriodStart;
    if (input.currentPeriodEnd !== undefined) updateData.currentPeriodEnd = input.currentPeriodEnd;
    if (input.cancelAt !== undefined) updateData.cancelAt = input.cancelAt;

    const [result] = await this.db.update(subscriptions)
      .set(updateData)
      .where(eq(subscriptions.id, id))
      .returning();

    if (!result) {
      throw new Error(`Subscription not found: ${id}`);
    }

    return this.mapToSubscription(result);
  }

  async cancel(id: string, cancelAt?: Date): Promise<Subscription> {
    const updateData: Partial<typeof subscriptions.$inferInsert> = {
      updatedAt: new Date(),
      status: "canceled",
    };

    if (cancelAt) {
      updateData.cancelAt = cancelAt;
    }

    const [result] = await this.db.update(subscriptions)
      .set(updateData)
      .where(eq(subscriptions.id, id))
      .returning();

    if (!result) {
      throw new Error(`Subscription not found: ${id}`);
    }

    return this.mapToSubscription(result);
  }

  private mapToSubscription(row: typeof subscriptions.$inferSelect): Subscription {
    return {
      id: row.id,
      userId: row.userId ?? undefined,
      teamId: row.teamId ?? undefined,
      planId: row.planId,
      status: row.status as SubscriptionStatus,
      stripeSubscriptionId: row.stripeSubscriptionId ?? undefined,
      stripeCustomerId: row.stripeCustomerId ?? undefined,
      currentPeriodStart: row.currentPeriodStart ?? undefined,
      currentPeriodEnd: row.currentPeriodEnd ?? undefined,
      cancelAt: row.cancelAt ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
