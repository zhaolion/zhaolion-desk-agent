import type { UUID } from "@desk-agent/shared";
import type { TaskRun } from "../entity/task-run.js";
import type { TaskEvent } from "../event/task-event.js";
export declare const STREAMS: {
    readonly TASKS_PENDING: "stream:tasks:pending";
    readonly taskEvents: (taskRunId: UUID) => string;
    readonly taskInput: (taskRunId: UUID) => string;
};
export interface StreamMessage<T> {
    id: string;
    data: T;
}
export interface TaskStreamService {
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
}
export interface HumanInput {
    approved: boolean;
    value?: string;
    reason?: string;
}
//# sourceMappingURL=stream.service.d.ts.map