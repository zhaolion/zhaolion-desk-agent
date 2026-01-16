# Agent Loop Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the core agent execution loop that processes tasks from Redis Stream, runs Claude SDK, handles tool calls, and manages human input flow.

**Architecture:** Worker pulls tasks from Redis Stream, creates execution context with file logger, runs agentic loop with Claude SDK. The loop processes messages, executes tools via registry, publishes events back to Redis Stream. Supports human-in-the-loop for dangerous operations.

**Tech Stack:** TypeScript, Claude SDK (@anthropic-ai/sdk), Redis Streams, Node.js fs for logging

---

## Task Overview

| Task | Component | Description |
|------|-----------|-------------|
| 1 | File Logger | Write logs to local filesystem |
| 2 | Execution Context | Task execution state and dependencies |
| 3 | File Tool | File read/write operations |
| 4 | Message Handler | Process Claude responses and tool calls |
| 5 | Agent Loop | Core agentic loop with Claude SDK |
| 6 | Task Executor | Orchestrate task consumption and execution |
| 7 | Integration | Wire everything together in worker main |

---

### Task 1: File Logger

**Files:**
- Create: `apps/worker/src/logger/file-logger.ts`
- Create: `apps/worker/src/logger/index.ts`

**Step 1: Create file-logger.ts**

```typescript
// apps/worker/src/logger/file-logger.ts
import { mkdir, appendFile } from "node:fs/promises";
import { join } from "node:path";
import type { Logger } from "../claude/types.js";

export interface FileLoggerOptions {
  runDir: string;
  channels?: string[];
}

export class FileLogger implements Logger {
  private runDir: string;
  private initialized = false;

  constructor(options: FileLoggerOptions) {
    this.runDir = options.runDir;
  }

  private async ensureDir(): Promise<void> {
    if (this.initialized) return;
    await mkdir(join(this.runDir, "logs"), { recursive: true });
    this.initialized = true;
  }

  private formatLine(message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] ${message}\n`;
  }

  async log(message: string, channel = "agent"): Promise<void> {
    await this.ensureDir();
    const logPath = join(this.runDir, "logs", `${channel}.log`);
    await appendFile(logPath, this.formatLine(message));
  }

  async error(message: string): Promise<void> {
    await this.log(message, "error");
    await this.log(`[ERROR] ${message}`, "agent");
  }

  async tool(toolName: string, message: string): Promise<void> {
    await this.log(`[${toolName}] ${message}`, "tool");
    await this.log(`[TOOL:${toolName}] ${message}`, "agent");
  }

  getLogPath(channel = "agent"): string {
    return join(this.runDir, "logs", `${channel}.log`);
  }
}

export function createFileLogger(runDir: string): FileLogger {
  return new FileLogger({ runDir });
}
```

**Step 2: Create index.ts**

```typescript
// apps/worker/src/logger/index.ts
export { FileLogger, createFileLogger } from "./file-logger.js";
export type { FileLoggerOptions } from "./file-logger.js";
```

**Step 3: Build and verify**

Run: `pnpm --filter @desk-agent/worker build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add apps/worker/src/logger/
git commit -m "feat(worker): add FileLogger for task execution logging"
```

---

### Task 2: Execution Context

**Files:**
- Create: `apps/worker/src/executor/context.ts`
- Create: `apps/worker/src/executor/index.ts`

**Step 1: Create context.ts**

```typescript
// apps/worker/src/executor/context.ts
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
```

**Step 2: Create index.ts**

```typescript
// apps/worker/src/executor/index.ts
export { createExecutionContext } from "./context.js";
export type { ExecutionContext, ExecutionResult } from "./context.js";
```

**Step 3: Build and verify**

Run: `pnpm --filter @desk-agent/worker build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add apps/worker/src/executor/
git commit -m "feat(worker): add ExecutionContext for task execution state"
```

---

### Task 3: File Tool

**Files:**
- Create: `apps/worker/src/tools/builtin/file.ts`
- Modify: `apps/worker/src/tools/builtin/index.ts`

**Step 1: Create file.ts**

```typescript
// apps/worker/src/tools/builtin/file.ts
import { readFile, writeFile, mkdir, readdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { ToolHandler, ToolResult } from "../types.js";
import type { ToolExecutionContext } from "../../claude/types.js";

export interface ReadFileInput {
  path: string;
  encoding?: string;
}

export interface WriteFileInput {
  path: string;
  content: string;
  encoding?: string;
}

export interface ListDirInput {
  path: string;
}

export const readFileTool: ToolHandler = {
  definition: {
    name: "read_file",
    description: "Read the contents of a file",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "Path to the file to read (relative to workspace)",
        },
        encoding: {
          type: "string",
          description: "File encoding (default: utf-8)",
        },
      },
      required: ["path"],
    },
  },

  async execute(
    input: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const { path, encoding = "utf-8" } = input as unknown as ReadFileInput;
    const fullPath = resolve(context.workDir, path);

    // Security: ensure path is within workDir
    if (!fullPath.startsWith(resolve(context.workDir))) {
      return {
        success: false,
        error: "Path traversal not allowed",
      };
    }

    try {
      context.logger.log(`Reading file: ${path}`);
      const content = await readFile(fullPath, encoding as BufferEncoding);
      return {
        success: true,
        output: content,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: message,
      };
    }
  },
};

export const writeFileTool: ToolHandler = {
  definition: {
    name: "write_file",
    description: "Write content to a file (creates directories if needed)",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "Path to the file to write (relative to workspace)",
        },
        content: {
          type: "string",
          description: "Content to write to the file",
        },
        encoding: {
          type: "string",
          description: "File encoding (default: utf-8)",
        },
      },
      required: ["path", "content"],
    },
  },

  async execute(
    input: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const { path, content, encoding = "utf-8" } = input as unknown as WriteFileInput;
    const fullPath = resolve(context.workDir, path);

    // Security: ensure path is within workDir
    if (!fullPath.startsWith(resolve(context.workDir))) {
      return {
        success: false,
        error: "Path traversal not allowed",
      };
    }

    try {
      context.logger.log(`Writing file: ${path}`);
      await mkdir(dirname(fullPath), { recursive: true });
      await writeFile(fullPath, content, encoding as BufferEncoding);
      return {
        success: true,
        output: `File written: ${path}`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: message,
      };
    }
  },
};

export const listDirTool: ToolHandler = {
  definition: {
    name: "list_directory",
    description: "List contents of a directory",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "Path to the directory (relative to workspace, default: .)",
        },
      },
      required: [],
    },
  },

  async execute(
    input: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const { path = "." } = input as unknown as ListDirInput;
    const fullPath = resolve(context.workDir, path);

    // Security: ensure path is within workDir
    if (!fullPath.startsWith(resolve(context.workDir))) {
      return {
        success: false,
        error: "Path traversal not allowed",
      };
    }

    try {
      context.logger.log(`Listing directory: ${path}`);
      const entries = await readdir(fullPath, { withFileTypes: true });
      const result = entries.map((e) => ({
        name: e.name,
        type: e.isDirectory() ? "directory" : "file",
      }));
      return {
        success: true,
        output: JSON.stringify(result, null, 2),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: message,
      };
    }
  },
};
```

**Step 2: Update builtin/index.ts**

```typescript
// apps/worker/src/tools/builtin/index.ts
export { shellTool } from "./shell.js";
export { readFileTool, writeFileTool, listDirTool } from "./file.js";
```

**Step 3: Update tools/index.ts**

```typescript
// apps/worker/src/tools/index.ts
export { ToolRegistry, createToolRegistry } from "./registry.js";
export type {
  ToolDefinition,
  ToolHandler,
  ToolResult,
  ToolInput,
} from "./types.js";
export {
  shellTool,
  readFileTool,
  writeFileTool,
  listDirTool,
} from "./builtin/index.js";
```

**Step 4: Build and verify**

Run: `pnpm --filter @desk-agent/worker build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add apps/worker/src/tools/
git commit -m "feat(worker): add file tools (read, write, list_directory)"
```

---

### Task 4: Message Handler

**Files:**
- Create: `apps/worker/src/claude/message-handler.ts`

**Step 1: Create message-handler.ts**

```typescript
// apps/worker/src/claude/message-handler.ts
import type Anthropic from "@anthropic-ai/sdk";
import type { ExecutionContext } from "../executor/context.js";

export interface ToolCallResult {
  toolUseId: string;
  toolName: string;
  content: string;
  isError: boolean;
}

export async function handleToolCalls(
  content: Anthropic.ContentBlock[],
  ctx: ExecutionContext
): Promise<Anthropic.ToolResultBlockParam[]> {
  const toolUseBlocks = content.filter(
    (c): c is Anthropic.ToolUseBlock => c.type === "tool_use"
  );

  const results: Anthropic.ToolResultBlockParam[] = [];

  for (const toolUse of toolUseBlocks) {
    // Publish step started event
    await ctx.streamService.publishEvent(ctx.taskRunId, {
      type: "STEP_STARTED",
      taskRunId: ctx.taskRunId,
      step: {
        name: toolUse.name,
        input: toolUse.input as Record<string, unknown>,
      },
      timestamp: new Date().toISOString(),
    });

    await ctx.logger.tool(toolUse.name, `Executing with input: ${JSON.stringify(toolUse.input)}`);

    try {
      // Execute tool
      const toolResult = await ctx.toolRegistry.execute(
        toolUse.name,
        toolUse.input as Record<string, unknown>,
        {
          taskRunId: ctx.taskRunId,
          workDir: ctx.workDir,
          logger: ctx.logger,
        }
      );

      const content = toolResult.success
        ? toolResult.output || "(no output)"
        : `Error: ${toolResult.error}`;

      await ctx.logger.tool(toolUse.name, `Result: ${content.slice(0, 500)}`);

      results.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content,
        is_error: !toolResult.success,
      });

      // Publish step completed event
      await ctx.streamService.publishEvent(ctx.taskRunId, {
        type: "STEP_COMPLETED",
        taskRunId: ctx.taskRunId,
        step: {
          name: toolUse.name,
          output: toolResult.success ? toolResult.output : undefined,
          error: toolResult.error,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await ctx.logger.error(`Tool ${toolUse.name} failed: ${message}`);

      results.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: `Error: ${message}`,
        is_error: true,
      });
    }
  }

  return results;
}

export function extractTextContent(content: Anthropic.ContentBlock[]): string | undefined {
  const textBlock = content.find(
    (c): c is Anthropic.TextBlock => c.type === "text"
  );
  return textBlock?.text;
}
```

**Step 2: Build and verify**

Run: `pnpm --filter @desk-agent/worker build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add apps/worker/src/claude/message-handler.ts
git commit -m "feat(worker): add message handler for tool call processing"
```

---

### Task 5: Agent Loop

**Files:**
- Create: `apps/worker/src/claude/agent-loop.ts`
- Modify: `apps/worker/src/claude/index.ts` (create if not exists)

**Step 1: Create agent-loop.ts**

```typescript
// apps/worker/src/claude/agent-loop.ts
import type Anthropic from "@anthropic-ai/sdk";
import type { ExecutionContext, ExecutionResult } from "../executor/context.js";
import type { AgentConfig } from "./types.js";
import { handleToolCalls, extractTextContent } from "./message-handler.js";

export interface AgentLoopOptions {
  client: Anthropic;
  config: AgentConfig;
  ctx: ExecutionContext;
  initialPrompt: string;
}

export async function runAgentLoop(options: AgentLoopOptions): Promise<ExecutionResult> {
  const { client, config, ctx, initialPrompt } = options;

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: initialPrompt },
  ];

  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  // Publish task started event
  await ctx.streamService.publishEvent(ctx.taskRunId, {
    type: "TASK_STARTED",
    taskRunId: ctx.taskRunId,
    timestamp: new Date().toISOString(),
  });

  await ctx.logger.log("Agent loop started");
  await ctx.logger.log(`Initial prompt: ${initialPrompt.slice(0, 200)}...`);

  let iterationCount = 0;
  const maxIterations = 50; // Safety limit

  while (iterationCount < maxIterations) {
    iterationCount++;

    // Check for abort signal
    if (ctx.abortSignal?.aborted) {
      await ctx.logger.log("Task cancelled by user");
      return {
        status: "cancelled",
        error: "Task cancelled",
        tokensInput: totalInputTokens,
        tokensOutput: totalOutputTokens,
      };
    }

    await ctx.logger.log(`[Iteration ${iterationCount}] Calling Claude API...`);

    try {
      const response = await client.messages.create({
        model: config.model,
        max_tokens: config.maxTokens,
        system: config.systemPrompt,
        tools: config.tools,
        messages,
      });

      // Track token usage
      totalInputTokens += response.usage.input_tokens;
      totalOutputTokens += response.usage.output_tokens;

      await ctx.logger.log(
        `[Iteration ${iterationCount}] Response: stop_reason=${response.stop_reason}, ` +
        `tokens=${response.usage.input_tokens}/${response.usage.output_tokens}`
      );

      // Add assistant message to history
      const assistantMessage: Anthropic.MessageParam = {
        role: "assistant",
        content: response.content,
      };
      messages.push(assistantMessage);

      // Check if done
      if (response.stop_reason === "end_turn") {
        const output = extractTextContent(response.content);
        await ctx.logger.log(`Agent completed: ${output?.slice(0, 200)}...`);

        await ctx.streamService.publishEvent(ctx.taskRunId, {
          type: "TASK_COMPLETED",
          taskRunId: ctx.taskRunId,
          result: output || "",
          timestamp: new Date().toISOString(),
        });

        return {
          status: "completed",
          output,
          tokensInput: totalInputTokens,
          tokensOutput: totalOutputTokens,
        };
      }

      // Handle tool use
      if (response.stop_reason === "tool_use") {
        const toolResults = await handleToolCalls(response.content, ctx);

        messages.push({
          role: "user",
          content: toolResults,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await ctx.logger.error(`Claude API error: ${message}`);

      await ctx.streamService.publishEvent(ctx.taskRunId, {
        type: "TASK_FAILED",
        taskRunId: ctx.taskRunId,
        error: message,
        timestamp: new Date().toISOString(),
      });

      return {
        status: "failed",
        error: message,
        tokensInput: totalInputTokens,
        tokensOutput: totalOutputTokens,
      };
    }
  }

  // Max iterations reached
  const error = `Max iterations (${maxIterations}) reached`;
  await ctx.logger.error(error);

  await ctx.streamService.publishEvent(ctx.taskRunId, {
    type: "TASK_FAILED",
    taskRunId: ctx.taskRunId,
    error,
    timestamp: new Date().toISOString(),
  });

  return {
    status: "failed",
    error,
    tokensInput: totalInputTokens,
    tokensOutput: totalOutputTokens,
  };
}
```

**Step 2: Create claude/index.ts**

```typescript
// apps/worker/src/claude/index.ts
export { createClaudeClient, createDefaultAgentConfig } from "./client.js";
export { runAgentLoop } from "./agent-loop.js";
export { handleToolCalls, extractTextContent } from "./message-handler.js";
export type { AgentConfig, AgentResult, ToolExecutionContext, Logger } from "./types.js";
```

**Step 3: Build and verify**

Run: `pnpm --filter @desk-agent/worker build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add apps/worker/src/claude/
git commit -m "feat(worker): add agent loop with Claude SDK integration"
```

---

### Task 6: Task Executor

**Files:**
- Create: `apps/worker/src/executor/task-executor.ts`
- Modify: `apps/worker/src/executor/index.ts`

**Step 1: Create task-executor.ts**

```typescript
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
```

**Step 2: Update executor/index.ts**

```typescript
// apps/worker/src/executor/index.ts
export { createExecutionContext } from "./context.js";
export type { ExecutionContext, ExecutionResult } from "./context.js";
export { TaskExecutor, createTaskExecutor } from "./task-executor.js";
export type { TaskExecutorOptions } from "./task-executor.js";
```

**Step 3: Build and verify**

Run: `pnpm --filter @desk-agent/worker build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add apps/worker/src/executor/
git commit -m "feat(worker): add TaskExecutor for orchestrating task execution"
```

---

### Task 7: Integration - Update Worker Main

**Files:**
- Modify: `apps/worker/src/main.ts`

**Step 1: Update main.ts to use TaskExecutor**

```typescript
// apps/worker/src/main.ts
import { Redis } from "ioredis";
import { loadConfig } from "./config.js";
import { createClaudeClient } from "./claude/client.js";
import { createTaskExecutor } from "./executor/index.js";
import { RedisStreamService } from "./services/redis-stream.service.js";

async function main() {
  const config = loadConfig();

  console.log(`Starting Worker ${config.consumerId}`);
  console.log(`Consumer Group: ${config.consumerGroup}`);
  console.log(`Data Directory: ${config.dataDir}`);

  // Initialize Redis
  const redis = new Redis(config.redisUrl);

  // Initialize Claude client
  const claude = createClaudeClient(config.anthropicApiKey);

  // Initialize stream service
  const streamService = new RedisStreamService(redis);

  // Ensure consumer group exists
  await streamService.createConsumerGroup(config.consumerGroup);

  // Initialize task executor
  const executor = createTaskExecutor({
    client: claude,
    streamService,
    dataDir: config.dataDir,
  });

  console.log("Worker started, waiting for tasks...");

  // Main consumption loop
  while (true) {
    try {
      const messages = await streamService.consumeTasks(
        config.consumerGroup,
        config.consumerId,
        1,
        5000 // 5 second block
      );

      for (const message of messages) {
        console.log(`Processing task: ${message.data.id}`);

        try {
          const result = await executor.execute(message.data);
          console.log(`Task ${message.data.id} completed: ${result.status}`);

          // Acknowledge the message
          await streamService.ackTask(config.consumerGroup, message.id);
        } catch (error) {
          console.error(`Task ${message.data.id} failed:`, error);
        }
      }
    } catch (error) {
      console.error("Error consuming tasks:", error);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

main().catch(console.error);
```

**Step 2: Copy RedisStreamService to worker (or create shared infrastructure package)**

Since worker needs RedisStreamService, create it in worker:

```typescript
// apps/worker/src/services/redis-stream.service.ts
import type { Redis } from "ioredis";
import type { UUID } from "@desk-agent/shared";
import type {
  TaskRun,
  TaskEvent,
  StreamMessage,
  HumanInput,
  TaskStreamService,
} from "@desk-agent/domain";

export class RedisStreamService implements TaskStreamService {
  private redis: Redis;
  private readonly TASK_STREAM = "stream:tasks:pending";

  constructor(redis: Redis) {
    this.redis = redis;
  }

  async createConsumerGroup(groupName: string): Promise<void> {
    try {
      await this.redis.xgroup(
        "CREATE",
        this.TASK_STREAM,
        groupName,
        "0",
        "MKSTREAM"
      );
    } catch (error) {
      // Group already exists is OK
      if (!(error instanceof Error && error.message.includes("BUSYGROUP"))) {
        throw error;
      }
    }
  }

  async enqueueTask(taskRun: TaskRun): Promise<string> {
    const messageId = await this.redis.xadd(
      this.TASK_STREAM,
      "*",
      "taskRunId",
      taskRun.id,
      "payload",
      JSON.stringify(taskRun)
    );
    return messageId as string;
  }

  async consumeTasks(
    groupName: string,
    consumerId: string,
    count = 1,
    blockMs = 5000
  ): Promise<StreamMessage<TaskRun>[]> {
    const results = await this.redis.xreadgroup(
      "GROUP",
      groupName,
      consumerId,
      "COUNT",
      count,
      "BLOCK",
      blockMs,
      "STREAMS",
      this.TASK_STREAM,
      ">"
    );

    if (!results) return [];

    return this.parseStreamResults<TaskRun>(
      results as [string, [string, string[]][]][]
    );
  }

  async ackTask(groupName: string, messageId: string): Promise<void> {
    await this.redis.xack(this.TASK_STREAM, groupName, messageId);
  }

  async publishEvent(taskRunId: UUID, event: TaskEvent): Promise<string> {
    const streamKey = `stream:tasks:${taskRunId}:events`;
    const messageId = await this.redis.xadd(
      streamKey,
      "*",
      "type",
      event.type,
      "data",
      JSON.stringify(event)
    );
    return messageId as string;
  }

  async subscribeEvents(
    taskRunId: UUID,
    lastId = "$"
  ): Promise<StreamMessage<TaskEvent>[]> {
    const streamKey = `stream:tasks:${taskRunId}:events`;
    const results = await this.redis.xread(
      "BLOCK",
      0,
      "STREAMS",
      streamKey,
      lastId
    );

    if (!results) return [];

    return this.parseStreamResults<TaskEvent>(
      results as [string, [string, string[]][]][]
    );
  }

  async getEventHistory(
    taskRunId: UUID,
    fromId = "-",
    toId = "+"
  ): Promise<TaskEvent[]> {
    const streamKey = `stream:tasks:${taskRunId}:events`;
    const results = await this.redis.xrange(streamKey, fromId, toId);

    return results.map(([, fields]) => {
      const data: Record<string, string> = {};
      for (let i = 0; i < fields.length; i += 2) {
        data[fields[i]] = fields[i + 1];
      }
      return JSON.parse(data["data"]) as TaskEvent;
    });
  }

  async waitForInput(
    taskRunId: UUID,
    timeoutMs = 3600000
  ): Promise<HumanInput | null> {
    const inputStream = `stream:tasks:${taskRunId}:input`;

    const results = await this.redis.xread(
      "BLOCK",
      timeoutMs,
      "STREAMS",
      inputStream,
      "$"
    );

    if (!results) return null;

    const parsed = this.parseStreamResults<HumanInput>(
      results as [string, [string, string[]][]][]
    );
    return parsed[0]?.data || null;
  }

  private parseStreamResults<T>(
    results: [string, [string, string[]][]][]
  ): StreamMessage<T>[] {
    const messages: StreamMessage<T>[] = [];

    for (const [, entries] of results) {
      for (const [id, fields] of entries) {
        const data: Record<string, string> = {};
        for (let i = 0; i < fields.length; i += 2) {
          data[fields[i]] = fields[i + 1];
        }

        const payload = data["payload"] || data["data"];
        if (payload) {
          messages.push({
            id,
            data: JSON.parse(payload) as T,
          });
        }
      }
    }

    return messages;
  }
}
```

**Step 3: Add systemPrompt field to TaskRun entity**

Modify `packages/domain/src/task/entity/task-run.ts`:

```typescript
// packages/domain/src/task/entity/task-run.ts
import type { UUID, Timestamp } from "@desk-agent/shared";

export const TaskRunStatus = {
  PENDING: "pending",
  QUEUED: "queued",
  RUNNING: "running",
  WAITING_INPUT: "waiting_input",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

export type TaskRunStatus = (typeof TaskRunStatus)[keyof typeof TaskRunStatus];

export interface TaskRun {
  id: UUID;
  taskId?: UUID;
  userId: UUID;
  agentId?: UUID;
  prompt: string;
  systemPrompt?: string;
  variables?: Record<string, unknown>;
  status: TaskRunStatus;
  progress: number;
  result?: string;
  error?: string;
  tokensInput: number;
  tokensOutput: number;
  localPath?: string;
  s3Prefix?: string;
  syncedAt?: Timestamp;
  startedAt?: Timestamp;
  completedAt?: Timestamp;
  createdAt: Timestamp;
}

export function createTaskRun(params: {
  id: UUID;
  userId: UUID;
  prompt: string;
  systemPrompt?: string;
  taskId?: UUID;
  agentId?: UUID;
  variables?: Record<string, unknown>;
}): TaskRun {
  return {
    id: params.id,
    taskId: params.taskId,
    userId: params.userId,
    agentId: params.agentId,
    prompt: params.prompt,
    systemPrompt: params.systemPrompt,
    variables: params.variables,
    status: TaskRunStatus.PENDING,
    progress: 0,
    tokensInput: 0,
    tokensOutput: 0,
    createdAt: new Date().toISOString(),
  };
}
```

**Step 4: Build all packages**

Run: `pnpm build`
Expected: All packages build successfully

**Step 5: Commit**

```bash
git add apps/worker/ packages/domain/
git commit -m "feat(worker): integrate agent loop with worker main"
```

---

## Verification

After completing all tasks, verify the implementation:

1. **Build check:**
   ```bash
   pnpm build
   ```

2. **Start infrastructure:**
   ```bash
   docker-compose up -d
   ```

3. **Run worker:**
   ```bash
   ANTHROPIC_API_KEY=your-key pnpm --filter @desk-agent/worker dev
   ```

4. **Enqueue a test task (using redis-cli):**
   ```bash
   redis-cli XADD stream:tasks:pending '*' taskRunId test-123 payload '{"id":"test-123","userId":"user-1","prompt":"List the files in the current directory","status":"pending","progress":0,"tokensInput":0,"tokensOutput":0,"createdAt":"2025-01-17T00:00:00Z"}'
   ```

5. **Watch worker logs and verify task execution**

---

## Summary

This plan implements the core agent execution loop:

- **FileLogger**: Writes structured logs to local filesystem
- **ExecutionContext**: Manages execution state and dependencies
- **File Tools**: Safe file operations within workspace
- **Message Handler**: Processes Claude responses and tool calls
- **Agent Loop**: Core agentic loop with Claude SDK
- **TaskExecutor**: Orchestrates the full execution flow

Next phase will add:
- Human input handling
- SSE event streaming from API
- API routes for task management
- Authentication middleware
