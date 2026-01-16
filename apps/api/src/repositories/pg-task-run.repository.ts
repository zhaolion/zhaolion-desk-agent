import { eq } from "drizzle-orm";
import type { Database } from "../db/index.js";
import { taskRuns } from "../db/schema.js";
import type { TaskRunRepository } from "@desk-agent/domain/task";
import type { TaskRun, CreateTaskRunInput, UpdateTaskRunInput } from "@desk-agent/domain";

export class PgTaskRunRepository implements TaskRunRepository {
  constructor(private db: Database) {}

  async create(input: CreateTaskRunInput): Promise<TaskRun> {
    const [result] = await this.db.insert(taskRuns).values({
      taskId: input.taskId,
      userId: input.userId,
      agentId: input.agentId,
      prompt: input.prompt,
      variables: input.variables ?? null,
    }).returning();

    if (!result) {
      throw new Error("Failed to create task run");
    }

    return this.mapToTaskRun(result);
  }

  async findById(id: string): Promise<TaskRun | null> {
    const [result] = await this.db.select().from(taskRuns).where(eq(taskRuns.id, id));
    return result ? this.mapToTaskRun(result) : null;
  }

  async update(id: string, input: UpdateTaskRunInput): Promise<TaskRun> {
    const [result] = await this.db.update(taskRuns)
      .set(input)
      .where(eq(taskRuns.id, id))
      .returning();

    if (!result) {
      throw new Error(`Task run not found: ${id}`);
    }

    return this.mapToTaskRun(result);
  }

  private mapToTaskRun(row: typeof taskRuns.$inferSelect): TaskRun {
    return {
      id: row.id,
      taskId: row.taskId,
      userId: row.userId,
      agentId: row.agentId,
      prompt: row.prompt,
      systemPrompt: row.systemPrompt,
      variables: row.variables as Record<string, unknown> | null,
      status: row.status as TaskRun["status"],
      progress: row.progress ?? 0,
      result: row.result,
      error: row.error,
      tokensInput: row.tokensInput ?? 0,
      tokensOutput: row.tokensOutput ?? 0,
      localPath: row.localPath,
      s3Prefix: row.s3Prefix,
      syncedAt: row.syncedAt,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      createdAt: row.createdAt,
    };
  }
}
