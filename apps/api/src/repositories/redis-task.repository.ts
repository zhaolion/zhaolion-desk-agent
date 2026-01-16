import type { Redis } from "ioredis";
import { generateId } from "@desk-agent/shared";
import type { TaskRepository, UpdateTaskInput } from "@desk-agent/domain/task";
import type { Task, CreateTaskInput } from "@desk-agent/domain";

const TASKS_KEY = "tasks";
const USER_TASKS_KEY = (userId: string) => `user:${userId}:tasks`;

export class RedisTaskRepository implements TaskRepository {
  constructor(private redis: Redis) {}

  async create(input: CreateTaskInput): Promise<Task> {
    const now = new Date();
    const task: Task = {
      id: generateId(),
      userId: input.userId,
      agentId: input.agentId,
      name: input.name,
      description: input.description ?? null,
      prompt: input.prompt,
      variables: input.variables ?? null,
      createdAt: now,
      updatedAt: now,
    };

    await this.redis.hset(TASKS_KEY, task.id, JSON.stringify(task, this.dateReplacer));
    await this.redis.sadd(USER_TASKS_KEY(input.userId), task.id);

    return task;
  }

  async findById(id: string): Promise<Task | null> {
    const data = await this.redis.hget(TASKS_KEY, id);
    if (!data) return null;
    return JSON.parse(data, this.dateReviver) as Task;
  }

  async findByUserId(userId: string): Promise<Task[]> {
    const ids = await this.redis.smembers(USER_TASKS_KEY(userId));
    if (ids.length === 0) return [];

    const tasks: Task[] = [];
    for (const id of ids) {
      const task = await this.findById(id);
      if (task) tasks.push(task);
    }
    return tasks;
  }

  async update(id: string, input: UpdateTaskInput): Promise<Task> {
    const existing = await this.findById(id);
    if (!existing) throw new Error(`Task ${id} not found`);

    const updated: Task = {
      ...existing,
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.prompt !== undefined && { prompt: input.prompt }),
      ...(input.variables !== undefined && { variables: input.variables }),
      updatedAt: new Date(),
    };
    await this.redis.hset(TASKS_KEY, id, JSON.stringify(updated, this.dateReplacer));
    return updated;
  }

  async delete(id: string): Promise<void> {
    const task = await this.findById(id);
    if (task) {
      await this.redis.hdel(TASKS_KEY, id);
      await this.redis.srem(USER_TASKS_KEY(task.userId), id);
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
