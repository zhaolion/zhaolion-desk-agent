import type { Redis } from "ioredis";
import { generateId } from "@desk-agent/shared";
import type { TaskRunRepository } from "@desk-agent/domain/task";
import type { TaskRun, CreateTaskRunInput, UpdateTaskRunInput } from "@desk-agent/domain";

const TASK_RUNS_KEY = "task-runs";

export class RedisTaskRunRepository implements TaskRunRepository {
  constructor(private redis: Redis) {}

  async create(input: CreateTaskRunInput): Promise<TaskRun> {
    const now = new Date();
    const taskRun: TaskRun = {
      id: generateId(),
      taskId: input.taskId,
      userId: input.userId,
      agentId: input.agentId,
      prompt: input.prompt,
      systemPrompt: null,
      variables: input.variables ?? null,
      status: "pending",
      progress: 0,
      result: null,
      error: null,
      tokensInput: 0,
      tokensOutput: 0,
      localPath: null,
      s3Prefix: null,
      syncedAt: null,
      startedAt: null,
      completedAt: null,
      createdAt: now,
    };

    await this.redis.hset(
      TASK_RUNS_KEY,
      taskRun.id,
      JSON.stringify(taskRun, this.dateReplacer)
    );

    return taskRun;
  }

  async findById(id: string): Promise<TaskRun | null> {
    const data = await this.redis.hget(TASK_RUNS_KEY, id);
    if (!data) return null;

    return JSON.parse(data, this.dateReviver) as TaskRun;
  }

  async update(id: string, input: UpdateTaskRunInput): Promise<TaskRun> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`TaskRun ${id} not found`);
    }

    const updated: TaskRun = {
      ...existing,
      ...input,
    };

    await this.redis.hset(
      TASK_RUNS_KEY,
      id,
      JSON.stringify(updated, this.dateReplacer)
    );

    return updated;
  }

  private dateReplacer(_key: string, value: unknown): unknown {
    if (value instanceof Date) {
      return value.toISOString();
    }
    return value;
  }

  private dateReviver(key: string, value: unknown): unknown {
    const dateKeys = ["createdAt", "startedAt", "completedAt", "syncedAt"];
    if (dateKeys.includes(key) && typeof value === "string") {
      return new Date(value);
    }
    return value;
  }
}
