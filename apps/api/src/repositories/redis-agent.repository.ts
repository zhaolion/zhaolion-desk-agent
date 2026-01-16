import type { Redis } from "ioredis";
import { generateId } from "@desk-agent/shared";
import type { AgentRepository } from "@desk-agent/domain/agent";
import type { Agent, CreateAgentInput, UpdateAgentInput } from "@desk-agent/domain";

const AGENTS_KEY = "agents";
const USER_AGENTS_KEY = (userId: string) => `user:${userId}:agents`;

const DEFAULT_MODEL = "gpt-4";
const DEFAULT_MAX_TOKENS = 4096;

export class RedisAgentRepository implements AgentRepository {
  constructor(private redis: Redis) {}

  async create(input: CreateAgentInput): Promise<Agent> {
    const now = new Date();
    const agent: Agent = {
      id: generateId(),
      userId: input.userId,
      name: input.name,
      description: input.description ?? null,
      model: input.model ?? DEFAULT_MODEL,
      systemPrompt: input.systemPrompt ?? null,
      maxTokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
      tools: input.tools ?? [],
      createdAt: now,
      updatedAt: now,
    };

    await this.redis.hset(AGENTS_KEY, agent.id, JSON.stringify(agent, this.dateReplacer));
    await this.redis.sadd(USER_AGENTS_KEY(input.userId), agent.id);

    return agent;
  }

  async findById(id: string): Promise<Agent | null> {
    const data = await this.redis.hget(AGENTS_KEY, id);
    if (!data) return null;
    return JSON.parse(data, this.dateReviver) as Agent;
  }

  async findByUserId(userId: string): Promise<Agent[]> {
    const ids = await this.redis.smembers(USER_AGENTS_KEY(userId));
    if (ids.length === 0) return [];

    const agents: Agent[] = [];
    for (const id of ids) {
      const agent = await this.findById(id);
      if (agent) agents.push(agent);
    }
    return agents;
  }

  async update(id: string, input: UpdateAgentInput): Promise<Agent> {
    const existing = await this.findById(id);
    if (!existing) throw new Error(`Agent ${id} not found`);

    const updated: Agent = {
      ...existing,
      ...input,
      updatedAt: new Date(),
    };
    await this.redis.hset(AGENTS_KEY, id, JSON.stringify(updated, this.dateReplacer));
    return updated;
  }

  async delete(id: string): Promise<void> {
    const agent = await this.findById(id);
    if (agent) {
      await this.redis.hdel(AGENTS_KEY, id);
      await this.redis.srem(USER_AGENTS_KEY(agent.userId), id);
    }
  }

  private dateReplacer(_key: string, value: unknown): unknown {
    return value instanceof Date ? value.toISOString() : value;
  }

  private dateReviver(key: string, value: unknown): unknown {
    const dateKeys = ["createdAt", "updatedAt"];
    return dateKeys.includes(key) && typeof value === "string" ? new Date(value) : value;
  }
}
