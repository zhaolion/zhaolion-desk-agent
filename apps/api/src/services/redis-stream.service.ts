import { Redis } from "ioredis";
import type { UUID } from "@desk-agent/shared";
import type {
  TaskStreamService,
  StreamMessage,
  HumanInput,
} from "@desk-agent/domain/task";
import type { TaskRun, TaskEvent } from "@desk-agent/domain";

const STREAM_KEYS = {
  TASKS_PENDING: "stream:tasks:pending",
  taskEvents: (taskRunId: UUID) => `stream:tasks:${taskRunId}:events`,
  taskInput: (taskRunId: UUID) => `stream:tasks:${taskRunId}:input`,
} as const;

export class RedisStreamService implements TaskStreamService {
  private redis: Redis;
  private subscriber: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
    this.subscriber = new Redis(redisUrl);
  }

  async enqueueTask(taskRun: TaskRun): Promise<string> {
    const id = await this.redis.xadd(
      STREAM_KEYS.TASKS_PENDING,
      "*",
      "taskRunId",
      taskRun.id,
      "payload",
      JSON.stringify(taskRun)
    );
    return id!;
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
      STREAM_KEYS.TASKS_PENDING,
      ">"
    );

    if (!results) return [];

    return this.parseStreamResults<TaskRun>(results as [string, [string, string[]][]][]);
  }

  async ackTask(messageId: string): Promise<void> {
    await this.redis.xack(STREAM_KEYS.TASKS_PENDING, "workers", messageId);
  }

  async publishEvent(taskRunId: UUID, event: TaskEvent): Promise<string> {
    const id = await this.redis.xadd(
      STREAM_KEYS.taskEvents(taskRunId),
      "*",
      "type",
      event.type,
      "data",
      JSON.stringify(event)
    );
    return id!;
  }

  async subscribeEvents(
    taskRunId: UUID,
    lastId = "$",
    blockMs = 0
  ): Promise<StreamMessage<TaskEvent>[]> {
    const results = await this.redis.xread(
      "BLOCK",
      blockMs,
      "STREAMS",
      STREAM_KEYS.taskEvents(taskRunId),
      lastId
    );

    if (!results) return [];

    return this.parseStreamResults<TaskEvent>(results as [string, [string, string[]][]][]);
  }

  async getEventHistory(
    taskRunId: UUID,
    fromId = "-",
    count = 100
  ): Promise<StreamMessage<TaskEvent>[]> {
    const results = await this.redis.xrange(
      STREAM_KEYS.taskEvents(taskRunId),
      fromId,
      "+",
      "COUNT",
      count
    );

    return results.map(([id, fields]: [string, string[]]) => ({
      id,
      data: JSON.parse(fields[fields.indexOf("data") + 1]!) as TaskEvent,
    }));
  }

  async publishInput(taskRunId: UUID, input: HumanInput): Promise<string> {
    const id = await this.redis.xadd(
      STREAM_KEYS.taskInput(taskRunId),
      "*",
      "data",
      JSON.stringify(input)
    );
    return id!;
  }

  async waitForInput(taskRunId: UUID, timeoutMs = 3600000): Promise<HumanInput | null> {
    const results = await this.redis.xread(
      "BLOCK",
      timeoutMs,
      "STREAMS",
      STREAM_KEYS.taskInput(taskRunId),
      "$"
    );

    if (!results) return null;

    const messages = this.parseStreamResults<HumanInput>(results as [string, [string, string[]][]][]);
    return messages[0]?.data ?? null;
  }

  async createConsumerGroup(groupName: string): Promise<void> {
    try {
      await this.redis.xgroup(
        "CREATE",
        STREAM_KEYS.TASKS_PENDING,
        groupName,
        "0",
        "MKSTREAM"
      );
    } catch (error) {
      // Group already exists, ignore
      if (!(error instanceof Error) || !error.message.includes("BUSYGROUP")) {
        throw error;
      }
    }
  }

  async close(): Promise<void> {
    await this.redis.quit();
    await this.subscriber.quit();
  }

  private parseStreamResults<T>(
    results: [string, [string, string[]][]][]
  ): StreamMessage<T>[] {
    const messages: StreamMessage<T>[] = [];

    for (const [, entries] of results) {
      for (const [id, fields] of entries) {
        const dataIndex = fields.indexOf("data");
        const payloadIndex = fields.indexOf("payload");
        const jsonIndex = dataIndex !== -1 ? dataIndex : payloadIndex;

        if (jsonIndex !== -1) {
          messages.push({
            id,
            data: JSON.parse(fields[jsonIndex + 1]!) as T,
          });
        }
      }
    }

    return messages;
  }
}
