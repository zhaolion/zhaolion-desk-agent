import type { UUID } from "@desk-agent/shared";
export declare const TaskRunStatus: {
    readonly PENDING: "pending";
    readonly QUEUED: "queued";
    readonly RUNNING: "running";
    readonly WAITING_INPUT: "waiting_input";
    readonly COMPLETED: "completed";
    readonly FAILED: "failed";
    readonly CANCELLED: "cancelled";
};
export type TaskRunStatus = (typeof TaskRunStatus)[keyof typeof TaskRunStatus];
export interface TaskRun {
    id: UUID;
    taskId: UUID;
    userId: UUID;
    agentId: UUID;
    prompt: string;
    systemPrompt: string | null;
    variables: Record<string, unknown> | null;
    status: TaskRunStatus;
    progress: number;
    result: string | null;
    error: string | null;
    tokensInput: number;
    tokensOutput: number;
    localPath: string | null;
    s3Prefix: string | null;
    syncedAt: Date | null;
    startedAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
}
export interface CreateTaskRunInput {
    taskId: UUID;
    userId: UUID;
    agentId: UUID;
    prompt: string;
    variables?: Record<string, unknown>;
}
export interface UpdateTaskRunInput {
    status?: TaskRunStatus;
    progress?: number;
    result?: string;
    error?: string;
    tokensInput?: number;
    tokensOutput?: number;
    localPath?: string;
    s3Prefix?: string;
    syncedAt?: Date;
    startedAt?: Date;
    completedAt?: Date;
}
//# sourceMappingURL=task-run.d.ts.map