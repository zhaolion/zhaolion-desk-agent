import { eq, and, gte, lte, sql } from "drizzle-orm";
import type { Database } from "../db/index.js";
import { usageRecords } from "../db/schema.js";
import type { UsageRepository } from "@desk-agent/domain/billing";
import type { UsageRecord, CreateUsageRecordInput, UsageSummary, UsageType } from "@desk-agent/domain";

export class PgUsageRepository implements UsageRepository {
  constructor(private db: Database) {}

  async create(input: CreateUsageRecordInput): Promise<UsageRecord> {
    const [result] = await this.db.insert(usageRecords).values({
      userId: input.userId,
      taskRunId: input.taskRunId ?? null,
      type: input.type,
      amount: input.amount,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
    }).returning();

    if (!result) {
      throw new Error("Failed to create usage record");
    }

    return this.mapToUsageRecord(result);
  }

  async findByUserId(userId: string, periodStart: string, periodEnd: string): Promise<UsageRecord[]> {
    const results = await this.db.select().from(usageRecords)
      .where(and(
        eq(usageRecords.userId, userId),
        gte(usageRecords.periodStart, periodStart),
        lte(usageRecords.periodEnd, periodEnd)
      ));

    return results.map(this.mapToUsageRecord);
  }

  async getSummary(userId: string, periodStart: string, periodEnd: string): Promise<UsageSummary> {
    const results = await this.db
      .select({
        type: usageRecords.type,
        total: sql<number>`sum(${usageRecords.amount})::int`,
      })
      .from(usageRecords)
      .where(and(
        eq(usageRecords.userId, userId),
        gte(usageRecords.periodStart, periodStart),
        lte(usageRecords.periodEnd, periodEnd)
      ))
      .groupBy(usageRecords.type);

    const summary: UsageSummary = {
      userId,
      periodStart,
      periodEnd,
      tokensInput: 0,
      tokensOutput: 0,
      taskRuns: 0,
      apiCalls: 0,
    };

    for (const row of results) {
      switch (row.type) {
        case "tokens_input":
          summary.tokensInput = row.total ?? 0;
          break;
        case "tokens_output":
          summary.tokensOutput = row.total ?? 0;
          break;
        case "task_runs":
          summary.taskRuns = row.total ?? 0;
          break;
        case "api_calls":
          summary.apiCalls = row.total ?? 0;
          break;
      }
    }

    return summary;
  }

  async getMonthlyUsage(userId: string, year: number, month: number): Promise<UsageSummary> {
    const periodStart = `${year}-${String(month).padStart(2, "0")}-01`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const periodEnd = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

    return this.getSummary(userId, periodStart, periodEnd);
  }

  private mapToUsageRecord(row: typeof usageRecords.$inferSelect): UsageRecord {
    return {
      id: row.id,
      userId: row.userId,
      taskRunId: row.taskRunId ?? undefined,
      type: row.type as UsageType,
      amount: Number(row.amount),
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      createdAt: row.createdAt,
    };
  }
}
