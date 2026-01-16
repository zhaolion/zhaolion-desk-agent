import type { UUID } from "@desk-agent/shared";
import type { TaskRun, CreateTaskRunInput, UpdateTaskRunInput } from "../entity/task-run.js";

export interface TaskRunRepository {
  create(input: CreateTaskRunInput): Promise<TaskRun>;
  findById(id: UUID): Promise<TaskRun | null>;
  update(id: UUID, input: UpdateTaskRunInput): Promise<TaskRun>;
}
