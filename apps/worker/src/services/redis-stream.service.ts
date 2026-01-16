// apps/worker/src/services/redis-stream.service.ts
import type { Redis } from "ioredis";
import type { UUID } from "@desk-agent/shared";
import {
  STREAMS,
  type TaskRun,
  type TaskEvent,
  type StreamMessage,
  type HumanInput,
  type TaskStreamService,
} from "@desk-agent/domain";

export class RedisStreamService implements TaskStreamService {
  private redis: Redis;
  private consumerGroup: string;

  constructor(redis: Redis, consumerGroup: string) {
    this.redis = redis;
    this.consumerGroup = consumerGroup;
  }

  async createConsumerGroup(groupName: string): Promise<void> {
    try {
      await this.redis.xgroup(
        "CREATE",
        STREAMS.TASKS_PENDING,
        groupName,
        "0",
        "MKSTREAM"
      );
    } catch (error) {
      // Group already exists is OK
      if (!(error instanceof Error && error.message.includes("BUSYGROUP"))) {
        throw error;
      }
    }
  }

  async enqueueTask(taskRun: TaskRun): Promise<string> {
    const messageId = await this.redis.xadd(
      STREAMS.TASKS_PENDING,
      "*",
      "taskRunId",
      taskRun.id,
      "payload",
      JSON.stringify(taskRun)
    );
    return messageId as string;
  }

  async consumeTasks(
    groupName: string,
    consumerId: string,
    count = 1,
    blockMs = 5000
  ): Promise<StreamMessage<TaskRun>[]> {
    const results = await this.redis.xreadgroup(
      "GROUP",
      groupName,
      consumerId,
      "COUNT",
      count,
      "BLOCK",
      blockMs,
      "STREAMS",
      STREAMS.TASKS_PENDING,
      ">"
    );

    if (!results) return [];

    return this.parseStreamResults<TaskRun>(
      results as [string, [string, string[]][]][]
    );
  }

  async ackTask(messageId: string): Promise<void> {
    await this.redis.xack(STREAMS.TASKS_PENDING, this.consumerGroup, messageId);
  }

  async publishEvent(taskRunId: UUID, event: TaskEvent): Promise<string> {
    const streamKey = STREAMS.taskEvents(taskRunId);
    const messageId = await this.redis.xadd(
      streamKey,
      "*",
      "type",
      event.type,
      "data",
      JSON.stringify(event)
    );
    return messageId as string;
  }

  async subscribeEvents(
    taskRunId: UUID,
    lastId = "$",
    blockMs = 0
  ): Promise<StreamMessage<TaskEvent>[]> {
    const streamKey = STREAMS.taskEvents(taskRunId);
    const results = await this.redis.xread(
      "BLOCK",
      blockMs,
      "STREAMS",
      streamKey,
      lastId
    );

    if (!results) return [];

    return this.parseStreamResults<TaskEvent>(
      results as [string, [string, string[]][]][]
    );
  }

  async getEventHistory(
    taskRunId: UUID,
    fromId = "-",
    count = 100
  ): Promise<StreamMessage<TaskEvent>[]> {
    const streamKey = STREAMS.taskEvents(taskRunId);
    const results = await this.redis.xrange(streamKey, fromId, "+", "COUNT", count);

    return results.map(([id, fields]) => {
      const data: Record<string, string> = {};
      for (let i = 0; i < fields.length; i += 2) {
        const key = fields[i];
        const value = fields[i + 1];
        if (key !== undefined && value !== undefined) {
          data[key] = value;
        }
      }
      return {
        id,
        data: JSON.parse(data["data"] || "{}") as TaskEvent,
      };
    });
  }

  async publishInput(taskRunId: UUID, input: HumanInput): Promise<string> {
    const inputStream = STREAMS.taskInput(taskRunId);
    const messageId = await this.redis.xadd(
      inputStream,
      "*",
      "data",
      JSON.stringify(input)
    );
    return messageId as string;
  }

  async waitForInput(
    taskRunId: UUID,
    timeoutMs = 3600000
  ): Promise<HumanInput | null> {
    const inputStream = STREAMS.taskInput(taskRunId);

    const results = await this.redis.xread(
      "BLOCK",
      timeoutMs,
      "STREAMS",
      inputStream,
      "$"
    );

    if (!results) return null;

    const parsed = this.parseStreamResults<HumanInput>(
      results as [string, [string, string[]][]][]
    );
    return parsed[0]?.data || null;
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }

  private parseStreamResults<T>(
    results: [string, [string, string[]][]][]
  ): StreamMessage<T>[] {
    const messages: StreamMessage<T>[] = [];

    for (const [, entries] of results) {
      for (const [id, fields] of entries) {
        const data: Record<string, string> = {};
        for (let i = 0; i < fields.length; i += 2) {
          const key = fields[i];
          const value = fields[i + 1];
          if (key !== undefined && value !== undefined) {
            data[key] = value;
          }
        }

        const payload = data["payload"] || data["data"];
        if (payload) {
          messages.push({
            id,
            data: JSON.parse(payload) as T,
          });
        }
      }
    }

    return messages;
  }
}
