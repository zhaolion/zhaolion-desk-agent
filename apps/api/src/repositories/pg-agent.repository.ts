import { eq } from "drizzle-orm";
import type { Database } from "../db/index.js";
import { agents } from "../db/schema.js";
import type { AgentRepository } from "@desk-agent/domain/agent";
import type { Agent, CreateAgentInput, UpdateAgentInput } from "@desk-agent/domain";

export class PgAgentRepository implements AgentRepository {
  constructor(private db: Database) {}

  async create(input: CreateAgentInput): Promise<Agent> {
    const [result] = await this.db.insert(agents).values({
      userId: input.userId,
      name: input.name,
      description: input.description ?? null,
      model: input.model ?? "claude-sonnet-4-20250514",
      systemPrompt: input.systemPrompt ?? null,
      maxTokens: input.maxTokens ?? 4096,
      tools: input.tools ?? [],
    }).returning();

    if (!result) {
      throw new Error("Failed to create agent");
    }

    return this.mapToAgent(result);
  }

  async findById(id: string): Promise<Agent | null> {
    const [result] = await this.db.select().from(agents).where(eq(agents.id, id));
    return result ? this.mapToAgent(result) : null;
  }

  async findByUserId(userId: string): Promise<Agent[]> {
    const results = await this.db.select().from(agents).where(eq(agents.userId, userId));
    return results.map(this.mapToAgent);
  }

  async update(id: string, input: UpdateAgentInput): Promise<Agent> {
    const [result] = await this.db.update(agents)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(agents.id, id))
      .returning();

    if (!result) {
      throw new Error(`Agent not found: ${id}`);
    }

    return this.mapToAgent(result);
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(agents).where(eq(agents.id, id));
  }

  private mapToAgent(row: typeof agents.$inferSelect): Agent {
    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      description: row.description,
      model: row.model ?? "claude-sonnet-4-20250514",
      systemPrompt: row.systemPrompt,
      maxTokens: row.maxTokens ?? 4096,
      tools: row.tools ?? [],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
