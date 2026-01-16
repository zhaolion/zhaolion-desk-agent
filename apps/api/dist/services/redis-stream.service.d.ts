import type { UUID } from "@desk-agent/shared";
import type { TaskStreamService, StreamMessage, HumanInput } from "@desk-agent/domain/task";
import type { TaskRun, TaskEvent } from "@desk-agent/domain";
export declare class RedisStreamService implements TaskStreamService {
    private redis;
    private subscriber;
    constructor(redisUrl: string);
    enqueueTask(taskRun: TaskRun): Promise<string>;
    consumeTasks(groupName: string, consumerId: string, count?: number, blockMs?: number): Promise<StreamMessage<TaskRun>[]>;
    ackTask(messageId: string): Promise<void>;
    publishEvent(taskRunId: UUID, event: TaskEvent): Promise<string>;
    subscribeEvents(taskRunId: UUID, lastId?: string, blockMs?: number): Promise<StreamMessage<TaskEvent>[]>;
    getEventHistory(taskRunId: UUID, fromId?: string, count?: number): Promise<StreamMessage<TaskEvent>[]>;
    publishInput(taskRunId: UUID, input: HumanInput): Promise<string>;
    waitForInput(taskRunId: UUID, timeoutMs?: number): Promise<HumanInput | null>;
    createConsumerGroup(groupName: string): Promise<void>;
    close(): Promise<void>;
    private parseStreamResults;
}
//# sourceMappingURL=redis-stream.service.d.ts.map