import type { UUID } from "@desk-agent/shared";
import type { TaskRun, TaskStreamService } from "@desk-agent/domain";
import type { FileLogger } from "../logger/file-logger.js";
import type { ToolRegistry } from "../tools/registry.js";

export interface ExecutionContext {
  taskRunId: UUID;
  taskRun: TaskRun;
  workDir: string;
  runDir: string;
  logger: FileLogger;
  toolRegistry: ToolRegistry;
  streamService: TaskStreamService;
  abortSignal?: AbortSignal;
}

export interface ExecutionResult {
  status: "completed" | "failed" | "cancelled";
  output?: string;
  error?: string;
  tokensInput: number;
  tokensOutput: number;
}

export function createExecutionContext(params: {
  taskRun: TaskRun;
  dataDir: string;
  logger: FileLogger;
  toolRegistry: ToolRegistry;
  streamService: TaskStreamService;
  abortSignal?: AbortSignal;
}): ExecutionContext {
  const runDir = `${params.dataDir}/runs/${params.taskRun.id}`;
  const workDir = `${runDir}/workspace`;

  return {
    taskRunId: params.taskRun.id,
    taskRun: params.taskRun,
    workDir,
    runDir,
    logger: params.logger,
    toolRegistry: params.toolRegistry,
    streamService: params.streamService,
    abortSignal: params.abortSignal,
  };
}
