import { eq } from "drizzle-orm";
import type { Database } from "../db/index.js";
import { tasks } from "../db/schema.js";
import type { TaskRepository, UpdateTaskInput } from "@desk-agent/domain/task";
import type { Task, CreateTaskInput, VariableDefinition } from "@desk-agent/domain";

export class PgTaskRepository implements TaskRepository {
  constructor(private db: Database) {}

  async create(input: CreateTaskInput): Promise<Task> {
    const [result] = await this.db.insert(tasks).values({
      userId: input.userId,
      agentId: input.agentId,
      name: input.name,
      description: input.description ?? null,
      prompt: input.prompt,
      variables: input.variables ?? null,
    }).returning();

    if (!result) {
      throw new Error("Failed to create task");
    }

    return this.mapToTask(result);
  }

  async findById(id: string): Promise<Task | null> {
    const [result] = await this.db.select().from(tasks).where(eq(tasks.id, id));
    return result ? this.mapToTask(result) : null;
  }

  async findByUserId(userId: string): Promise<Task[]> {
    const results = await this.db.select().from(tasks).where(eq(tasks.userId, userId));
    return results.map(this.mapToTask);
  }

  async update(id: string, input: UpdateTaskInput): Promise<Task> {
    const [result] = await this.db.update(tasks)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();

    if (!result) {
      throw new Error(`Task not found: ${id}`);
    }

    return this.mapToTask(result);
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(tasks).where(eq(tasks.id, id));
  }

  private mapToTask(row: typeof tasks.$inferSelect): Task {
    return {
      id: row.id,
      userId: row.userId,
      agentId: row.agentId,
      name: row.name,
      description: row.description,
      prompt: row.prompt,
      variables: row.variables as Record<string, VariableDefinition> | null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
