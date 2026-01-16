import { z } from "zod";
import { TaskRunStatus } from "@desk-agent/domain";

export const createTaskRunSchema = z.object({
  prompt: z.string().min(1, "Prompt is required"),
  variables: z.record(z.string(), z.unknown()).optional(),
});

export type CreateTaskRunRequest = z.infer<typeof createTaskRunSchema>;

export const taskRunResponseSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  userId: z.string(),
  agentId: z.string(),
  prompt: z.string(),
  systemPrompt: z.string().nullable(),
  variables: z.record(z.string(), z.unknown()).nullable(),
  status: z.enum(TaskRunStatus),
  progress: z.number(),
  result: z.string().nullable(),
  error: z.string().nullable(),
  tokensInput: z.number(),
  tokensOutput: z.number(),
  localPath: z.string().nullable(),
  s3Prefix: z.string().nullable(),
  syncedAt: z.string().nullable(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  createdAt: z.string(),
});

export type TaskRunResponse = z.infer<typeof taskRunResponseSchema>;

export const pathParamsSchema = z.object({
  id: z.string().uuid("Invalid task ID"),
});

export const runPathParamsSchema = z.object({
  runId: z.string().uuid("Invalid run ID"),
});
