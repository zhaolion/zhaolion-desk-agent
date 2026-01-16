import type { UUID } from "@desk-agent/shared";
import type { Task, CreateTaskInput, VariableDefinition } from "../entity/task.js";

export interface UpdateTaskInput {
  name?: string;
  description?: string;
  prompt?: string;
  variables?: Record<string, VariableDefinition>;
}

export interface TaskRepository {
  create(input: CreateTaskInput): Promise<Task>;
  findById(id: UUID): Promise<Task | null>;
  findByUserId(userId: UUID): Promise<Task[]>;
  update(id: UUID, input: UpdateTaskInput): Promise<Task>;
  delete(id: UUID): Promise<void>;
}
