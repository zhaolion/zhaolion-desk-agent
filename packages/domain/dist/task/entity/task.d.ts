import type { UUID, Timestamp } from "@desk-agent/shared";
export interface Task extends Timestamp {
    id: UUID;
    userId: UUID;
    agentId: UUID;
    name: string;
    description: string | null;
    prompt: string;
    variables: Record<string, VariableDefinition> | null;
}
export interface VariableDefinition {
    type: "string" | "number" | "boolean";
    description?: string;
    required?: boolean;
    default?: unknown;
}
export interface CreateTaskInput {
    userId: UUID;
    agentId: UUID;
    name: string;
    description?: string;
    prompt: string;
    variables?: Record<string, VariableDefinition>;
}
//# sourceMappingURL=task.d.ts.map