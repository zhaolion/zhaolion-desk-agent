import type { UUID } from "@desk-agent/shared";
export type TaskEvent = TaskStartedEvent | StepStartedEvent | StepCompletedEvent | LogAppendedEvent | HumanInputNeededEvent | TaskProgressEvent | TaskCompletedEvent | TaskFailedEvent;
export interface TaskStartedEvent {
    type: "TASK_STARTED";
    taskRunId: UUID;
    timestamp: string;
}
export interface StepStartedEvent {
    type: "STEP_STARTED";
    taskRunId: UUID;
    step: TaskStep;
}
export interface StepCompletedEvent {
    type: "STEP_COMPLETED";
    taskRunId: UUID;
    step: TaskStep;
}
export interface LogAppendedEvent {
    type: "LOG_APPENDED";
    taskRunId: UUID;
    line: string;
}
export interface HumanInputNeededEvent {
    type: "HUMAN_INPUT_NEEDED";
    taskRunId: UUID;
    prompt: string;
    options?: string[];
    timeout?: number;
}
export interface TaskProgressEvent {
    type: "TASK_PROGRESS";
    taskRunId: UUID;
    progress: number;
}
export interface TaskCompletedEvent {
    type: "TASK_COMPLETED";
    taskRunId: UUID;
    result: string;
}
export interface TaskFailedEvent {
    type: "TASK_FAILED";
    taskRunId: UUID;
    error: string;
}
export interface TaskStep {
    name: string;
    index?: number;
    input?: unknown;
    output?: unknown;
}
//# sourceMappingURL=task-event.d.ts.map