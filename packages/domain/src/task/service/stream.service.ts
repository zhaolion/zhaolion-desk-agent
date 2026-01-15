import type { UUID } from "@desk-agent/shared";
import type { TaskRun } from "../entity/task-run.js";
import type { TaskEvent } from "../event/task-event.js";

export const STREAMS = {
  TASKS_PENDING: "stream:tasks:pending",
  taskEvents: (taskRunId: UUID) => `stream:tasks:${taskRunId}:events`,
  taskInput: (taskRunId: UUID) => `stream:tasks:${taskRunId}:input`,
} as const;

export interface StreamMessage<T> {
  id: string;
  data: T;
}

export interface TaskStreamService {
  // Task queue operations
  enqueueTask(taskRun: TaskRun): Promise<string>;
  consumeTasks(
    groupName: string,
    consumerId: string,
    count?: number,
    blockMs?: number
  ): Promise<StreamMessage<TaskRun>[]>;
  ackTask(messageId: string): Promise<void>;

  // Event operations
  publishEvent(taskRunId: UUID, event: TaskEvent): Promise<string>;
  subscribeEvents(
    taskRunId: UUID,
    lastId?: string,
    blockMs?: number
  ): Promise<StreamMessage<TaskEvent>[]>;
  getEventHistory(taskRunId: UUID, fromId?: string, count?: number): Promise<StreamMessage<TaskEvent>[]>;

  // Human input operations
  publishInput(taskRunId: UUID, input: HumanInput): Promise<string>;
  waitForInput(taskRunId: UUID, timeoutMs?: number): Promise<HumanInput | null>;

  // Lifecycle
  createConsumerGroup(groupName: string): Promise<void>;
  close(): Promise<void>;
}

export interface HumanInput {
  approved: boolean;
  value?: string;
  reason?: string;
}
