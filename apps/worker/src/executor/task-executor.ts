// apps/worker/src/executor/task-executor.ts
import { mkdir } from "node:fs/promises";
import type Anthropic from "@anthropic-ai/sdk";
import type { TaskRun, TaskStreamService } from "@desk-agent/domain";
import { createFileLogger } from "../logger/file-logger.js";
import { createToolRegistry, shellTool, readFileTool, writeFileTool, listDirTool } from "../tools/index.js";
import { createDefaultAgentConfig, runAgentLoop } from "../claude/index.js";
import { createExecutionContext } from "./context.js";
import type { ExecutionResult } from "./context.js";

export interface TaskExecutorOptions {
  client: Anthropic;
  streamService: TaskStreamService;
  dataDir: string;
}

export class TaskExecutor {
  private client: Anthropic;
  private streamService: TaskStreamService;
  private dataDir: string;

  constructor(options: TaskExecutorOptions) {
    this.client = options.client;
    this.streamService = options.streamService;
    this.dataDir = options.dataDir;
  }

  async execute(taskRun: TaskRun): Promise<ExecutionResult> {
    const runDir = `${this.dataDir}/runs/${taskRun.id}`;
    const workDir = `${runDir}/workspace`;

    // Create directories
    await mkdir(workDir, { recursive: true });

    // Create logger
    const logger = createFileLogger(runDir);
    await logger.log(`Task execution started: ${taskRun.id}`);

    // Create tool registry with default tools
    const toolRegistry = createToolRegistry();
    toolRegistry.register(shellTool);
    toolRegistry.register(readFileTool);
    toolRegistry.register(writeFileTool);
    toolRegistry.register(listDirTool);

    // Create execution context
    const ctx = createExecutionContext({
      taskRun,
      dataDir: this.dataDir,
      logger,
      toolRegistry,
      streamService: this.streamService,
    });

    // Create agent config
    const config = createDefaultAgentConfig(
      taskRun.systemPrompt || "You are a helpful AI assistant that can execute tasks.",
      toolRegistry.getToolDefinitions()
    );

    // Run agent loop
    try {
      const result = await runAgentLoop({
        client: this.client,
        config,
        ctx,
        initialPrompt: taskRun.prompt,
      });

      await logger.log(`Task completed with status: ${result.status}`);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await logger.error(`Task failed with error: ${message}`);
      return {
        status: "failed",
        error: message,
        tokensInput: 0,
        tokensOutput: 0,
      };
    }
  }
}

export function createTaskExecutor(options: TaskExecutorOptions): TaskExecutor {
  return new TaskExecutor(options);
}
