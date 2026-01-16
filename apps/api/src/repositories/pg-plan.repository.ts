import { eq } from "drizzle-orm";
import type { Database } from "../db/index.js";
import { plans } from "../db/schema.js";
import type { PlanRepository } from "@desk-agent/domain/billing";
import type { Plan, CreatePlanInput, UpdatePlanInput, PlanLimits } from "@desk-agent/domain";

export class PgPlanRepository implements PlanRepository {
  constructor(private db: Database) {}

  async create(input: CreatePlanInput): Promise<Plan> {
    const [result] = await this.db.insert(plans).values({
      id: input.id,
      name: input.name,
      description: input.description ?? null,
      priceMonthly: input.priceMonthly ?? null,
      priceYearly: input.priceYearly ?? null,
      limits: input.limits,
      features: input.features ?? [],
    }).returning();

    if (!result) {
      throw new Error("Failed to create plan");
    }

    return this.mapToPlan(result);
  }

  async findById(id: string): Promise<Plan | null> {
    const [result] = await this.db.select().from(plans).where(eq(plans.id, id));
    return result ? this.mapToPlan(result) : null;
  }

  async findAll(): Promise<Plan[]> {
    const results = await this.db.select().from(plans);
    return results.map(this.mapToPlan);
  }

  async findActive(): Promise<Plan[]> {
    const results = await this.db.select().from(plans).where(eq(plans.active, true));
    return results.map(this.mapToPlan);
  }

  async update(id: string, input: UpdatePlanInput): Promise<Plan> {
    const updateData: Partial<typeof plans.$inferInsert> = { updatedAt: new Date() };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.priceMonthly !== undefined) updateData.priceMonthly = input.priceMonthly;
    if (input.priceYearly !== undefined) updateData.priceYearly = input.priceYearly;
    if (input.limits !== undefined) updateData.limits = input.limits;
    if (input.features !== undefined) updateData.features = input.features;
    if (input.active !== undefined) updateData.active = input.active;

    const [result] = await this.db.update(plans)
      .set(updateData)
      .where(eq(plans.id, id))
      .returning();

    if (!result) {
      throw new Error(`Plan not found: ${id}`);
    }

    return this.mapToPlan(result);
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(plans).where(eq(plans.id, id));
  }

  private mapToPlan(row: typeof plans.$inferSelect): Plan {
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      priceMonthly: row.priceMonthly ?? undefined,
      priceYearly: row.priceYearly ?? undefined,
      limits: row.limits as PlanLimits,
      features: row.features ?? undefined,
      active: row.active ?? true,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
