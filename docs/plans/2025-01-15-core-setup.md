# Desk Agent Core Setup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Set up the monorepo foundation with API server, Worker service, and core domain packages.

**Architecture:** TypeScript monorepo using pnpm workspaces + Turborepo. API server (Hono) handles HTTP/SSE, Worker consumes Redis Streams and executes Claude SDK agent loops. Domain packages contain pure business logic with DDD structure.

**Tech Stack:** TypeScript, pnpm, Turborepo, Hono, Redis (ioredis), PostgreSQL (Drizzle ORM), Claude SDK (@anthropic-ai/sdk)

---

## Phase 1: Monorepo Foundation

### Task 1: Initialize pnpm Workspace

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `tsconfig.base.json`
- Create: `.nvmrc`

**Step 1: Create root package.json**

```json
{
  "name": "desk-agent",
  "private": true,
  "packageManager": "pnpm@9.15.4",
  "engines": {
    "node": ">=20.0.0"
  },
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "clean": "turbo run clean && rm -rf node_modules"
  },
  "devDependencies": {
    "turbo": "^2.3.0",
    "typescript": "^5.7.0",
    "@types/node": "^22.0.0"
  }
}
```

**Step 2: Create pnpm-workspace.yaml**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

**Step 3: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["build"]
    },
    "lint": {},
    "clean": {
      "cache": false
    }
  }
}
```

**Step 4: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true
  }
}
```

**Step 5: Create .nvmrc**

```
20
```

**Step 6: Install dependencies**

Run: `pnpm install`
Expected: Dependencies installed, node_modules created

**Step 7: Commit**

```bash
git add -A
git commit -m "chore: initialize pnpm monorepo with turborepo

- Add workspace configuration
- Add base TypeScript config
- Configure turbo tasks"
```

---

### Task 2: Create Shared Package

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/types/common.ts`
- Create: `packages/shared/src/utils/id.ts`

**Step 1: Create packages/shared/package.json**

```json
{
  "name": "@desk-agent/shared",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "clean": "rm -rf dist",
    "lint": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

**Step 2: Create packages/shared/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

**Step 3: Create packages/shared/src/types/common.ts**

```typescript
export type UUID = string;

export interface Timestamp {
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginationParams {
  limit: number;
  offset: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
```

**Step 4: Create packages/shared/src/utils/id.ts**

```typescript
import { randomUUID } from "node:crypto";

export function generateId(): string {
  return randomUUID();
}

export function generatePrefixedId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "")}`;
}
```

**Step 5: Create packages/shared/src/index.ts**

```typescript
export * from "./types/common.js";
export * from "./utils/id.js";
```

**Step 6: Build and verify**

Run: `pnpm --filter @desk-agent/shared build`
Expected: dist/ folder created with compiled JS and .d.ts files

**Step 7: Commit**

```bash
git add -A
git commit -m "feat(shared): add shared types and utilities

- Common types (UUID, Timestamp, Result)
- ID generation utilities"
```

---

### Task 3: Create Domain Package Structure

**Files:**
- Create: `packages/domain/package.json`
- Create: `packages/domain/tsconfig.json`
- Create: `packages/domain/src/index.ts`
- Create: `packages/domain/src/task/index.ts`
- Create: `packages/domain/src/task/entity/task.ts`
- Create: `packages/domain/src/task/entity/task-run.ts`
- Create: `packages/domain/src/task/event/task-event.ts`

**Step 1: Create packages/domain/package.json**

```json
{
  "name": "@desk-agent/domain",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./task": {
      "types": "./dist/task/index.d.ts",
      "import": "./dist/task/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "clean": "rm -rf dist",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@desk-agent/shared": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

**Step 2: Create packages/domain/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

**Step 3: Create packages/domain/src/task/entity/task.ts**

```typescript
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
```

**Step 4: Create packages/domain/src/task/entity/task-run.ts**

```typescript
import type { UUID } from "@desk-agent/shared";

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
  taskId: UUID;
  userId: UUID;
  agentId: UUID;
  prompt: string;
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
```

**Step 5: Create packages/domain/src/task/event/task-event.ts**

```typescript
import type { UUID } from "@desk-agent/shared";

export type TaskEvent =
  | TaskStartedEvent
  | StepStartedEvent
  | StepCompletedEvent
  | LogAppendedEvent
  | HumanInputNeededEvent
  | TaskProgressEvent
  | TaskCompletedEvent
  | TaskFailedEvent;

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
```

**Step 6: Create packages/domain/src/task/index.ts**

```typescript
export * from "./entity/task.js";
export * from "./entity/task-run.js";
export * from "./event/task-event.js";
```

**Step 7: Create packages/domain/src/index.ts**

```typescript
export * from "./task/index.js";
```

**Step 8: Install workspace dependencies and build**

Run: `pnpm install && pnpm --filter @desk-agent/domain build`
Expected: dist/ folder created

**Step 9: Commit**

```bash
git add -A
git commit -m "feat(domain): add task domain entities and events

- Task and TaskRun entities
- TaskEvent union type for all events
- TaskRunStatus enum"
```

---

### Task 4: Create API Server Skeleton

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/src/main.ts`
- Create: `apps/api/src/config.ts`
- Create: `apps/api/src/routes/health.ts`

**Step 1: Create apps/api/package.json**

```json
{
  "name": "@desk-agent/api",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/main.ts",
    "start": "node dist/main.js",
    "clean": "rm -rf dist",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@desk-agent/domain": "workspace:*",
    "@desk-agent/shared": "workspace:*",
    "hono": "^4.6.0",
    "@hono/node-server": "^1.13.0",
    "ioredis": "^5.4.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "tsx": "^4.19.0",
    "@types/node": "^22.0.0"
  }
}
```

**Step 2: Create apps/api/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

**Step 3: Create apps/api/src/config.ts**

```typescript
export interface Config {
  port: number;
  host: string;
  redisUrl: string;
  databaseUrl: string;
  nodeEnv: "development" | "production" | "test";
}

export function loadConfig(): Config {
  return {
    port: parseInt(process.env.API_PORT ?? "3000", 10),
    host: process.env.API_HOST ?? "0.0.0.0",
    redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
    databaseUrl: process.env.DATABASE_URL ?? "postgresql://localhost:5432/desk_agent",
    nodeEnv: (process.env.NODE_ENV as Config["nodeEnv"]) ?? "development",
  };
}
```

**Step 4: Create apps/api/src/routes/health.ts**

```typescript
import { Hono } from "hono";

export const healthRoutes = new Hono();

healthRoutes.get("/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

healthRoutes.get("/health/ready", (c) => {
  // TODO: Check database and redis connections
  return c.json({
    status: "ok",
    checks: {
      database: "ok",
      redis: "ok",
    },
  });
});
```

**Step 5: Create apps/api/src/main.ts**

```typescript
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { loadConfig } from "./config.js";
import { healthRoutes } from "./routes/health.js";

const config = loadConfig();
const app = new Hono();

// Middleware
app.use("*", logger());
app.use("*", cors());

// Routes
app.route("/", healthRoutes);

// 404 handler
app.notFound((c) => {
  return c.json({ error: "Not Found" }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json({ error: "Internal Server Error" }, 500);
});

// Start server
console.log(`Starting API server on ${config.host}:${config.port}`);
serve({
  fetch: app.fetch,
  port: config.port,
  hostname: config.host,
});
```

**Step 6: Install dependencies**

Run: `pnpm install`
Expected: All dependencies installed

**Step 7: Build all packages**

Run: `pnpm build`
Expected: All packages build successfully

**Step 8: Test API server**

Run: `pnpm --filter @desk-agent/api dev &` then `curl http://localhost:3000/health`
Expected: `{"status":"ok","timestamp":"..."}`

**Step 9: Stop dev server and commit**

```bash
git add -A
git commit -m "feat(api): add API server skeleton with Hono

- Health check endpoints
- Config loading from env
- Logger and CORS middleware"
```

---

### Task 5: Create Worker Skeleton

**Files:**
- Create: `apps/worker/package.json`
- Create: `apps/worker/tsconfig.json`
- Create: `apps/worker/src/main.ts`
- Create: `apps/worker/src/config.ts`

**Step 1: Create apps/worker/package.json**

```json
{
  "name": "@desk-agent/worker",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/main.ts",
    "start": "node dist/main.js",
    "clean": "rm -rf dist",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@desk-agent/domain": "workspace:*",
    "@desk-agent/shared": "workspace:*",
    "@anthropic-ai/sdk": "^0.32.0",
    "ioredis": "^5.4.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "tsx": "^4.19.0",
    "@types/node": "^22.0.0"
  }
}
```

**Step 2: Create apps/worker/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

**Step 3: Create apps/worker/src/config.ts**

```typescript
export interface Config {
  redisUrl: string;
  databaseUrl: string;
  anthropicApiKey: string;
  dataDir: string;
  consumerGroup: string;
  consumerId: string;
  nodeEnv: "development" | "production" | "test";
}

export function loadConfig(): Config {
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY is required");
  }

  return {
    redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
    databaseUrl: process.env.DATABASE_URL ?? "postgresql://localhost:5432/desk_agent",
    anthropicApiKey,
    dataDir: process.env.DATA_DIR ?? "/data/desk-agent",
    consumerGroup: process.env.CONSUMER_GROUP ?? "workers",
    consumerId: process.env.CONSUMER_ID ?? `worker-${process.pid}`,
    nodeEnv: (process.env.NODE_ENV as Config["nodeEnv"]) ?? "development",
  };
}
```

**Step 4: Create apps/worker/src/main.ts**

```typescript
import { loadConfig } from "./config.js";

const config = loadConfig();

console.log(`Starting Worker ${config.consumerId}`);
console.log(`Consumer Group: ${config.consumerGroup}`);
console.log(`Data Directory: ${config.dataDir}`);

// TODO: Initialize Redis consumer
// TODO: Start consuming tasks from stream

// Keep process alive
process.on("SIGINT", () => {
  console.log("Shutting down worker...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("Shutting down worker...");
  process.exit(0);
});

console.log("Worker started, waiting for tasks...");

// Placeholder: keep alive
setInterval(() => {}, 1000);
```

**Step 5: Install dependencies and build**

Run: `pnpm install && pnpm build`
Expected: All packages build successfully

**Step 6: Commit**

```bash
git add -A
git commit -m "feat(worker): add Worker skeleton

- Config loading with Anthropic API key validation
- Graceful shutdown handling
- Consumer group configuration"
```

---

### Task 6: Add Redis Stream Service

**Files:**
- Create: `packages/domain/src/task/service/stream.service.ts`
- Modify: `packages/domain/src/task/index.ts`
- Modify: `packages/domain/src/index.ts`

**Step 1: Create packages/domain/src/task/service/stream.service.ts**

```typescript
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
```

**Step 2: Update packages/domain/src/task/index.ts**

```typescript
export * from "./entity/task.js";
export * from "./entity/task-run.js";
export * from "./event/task-event.js";
export * from "./service/stream.service.js";
```

**Step 3: Build domain package**

Run: `pnpm --filter @desk-agent/domain build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add -A
git commit -m "feat(domain): add TaskStreamService interface

- Redis Streams abstraction for task queue
- Event publishing/subscribing
- Human input channel"
```

---

### Task 7: Implement Redis Stream Service

**Files:**
- Create: `apps/api/src/services/redis-stream.service.ts`

**Step 1: Create apps/api/src/services/redis-stream.service.ts**

```typescript
import Redis from "ioredis";
import type { UUID } from "@desk-agent/shared";
import type {
  TaskStreamService,
  StreamMessage,
  HumanInput,
  STREAMS,
} from "@desk-agent/domain/task";
import type { TaskRun } from "@desk-agent/domain";
import type { TaskEvent } from "@desk-agent/domain";

const STREAM_KEYS = {
  TASKS_PENDING: "stream:tasks:pending",
  taskEvents: (taskRunId: UUID) => `stream:tasks:${taskRunId}:events`,
  taskInput: (taskRunId: UUID) => `stream:tasks:${taskRunId}:input`,
} as const;

export class RedisStreamService implements TaskStreamService {
  private redis: Redis;
  private subscriber: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
    this.subscriber = new Redis(redisUrl);
  }

  async enqueueTask(taskRun: TaskRun): Promise<string> {
    const id = await this.redis.xadd(
      STREAM_KEYS.TASKS_PENDING,
      "*",
      "taskRunId",
      taskRun.id,
      "payload",
      JSON.stringify(taskRun)
    );
    return id!;
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
      STREAM_KEYS.TASKS_PENDING,
      ">"
    );

    if (!results) return [];

    return this.parseStreamResults<TaskRun>(results);
  }

  async ackTask(messageId: string): Promise<void> {
    await this.redis.xack(STREAM_KEYS.TASKS_PENDING, "workers", messageId);
  }

  async publishEvent(taskRunId: UUID, event: TaskEvent): Promise<string> {
    const id = await this.redis.xadd(
      STREAM_KEYS.taskEvents(taskRunId),
      "*",
      "type",
      event.type,
      "data",
      JSON.stringify(event)
    );
    return id!;
  }

  async subscribeEvents(
    taskRunId: UUID,
    lastId = "$",
    blockMs = 0
  ): Promise<StreamMessage<TaskEvent>[]> {
    const results = await this.redis.xread(
      "BLOCK",
      blockMs,
      "STREAMS",
      STREAM_KEYS.taskEvents(taskRunId),
      lastId
    );

    if (!results) return [];

    return this.parseStreamResults<TaskEvent>(results);
  }

  async getEventHistory(
    taskRunId: UUID,
    fromId = "-",
    count = 100
  ): Promise<StreamMessage<TaskEvent>[]> {
    const results = await this.redis.xrange(
      STREAM_KEYS.taskEvents(taskRunId),
      fromId,
      "+",
      "COUNT",
      count
    );

    return results.map(([id, fields]) => ({
      id,
      data: JSON.parse(fields[fields.indexOf("data") + 1]) as TaskEvent,
    }));
  }

  async publishInput(taskRunId: UUID, input: HumanInput): Promise<string> {
    const id = await this.redis.xadd(
      STREAM_KEYS.taskInput(taskRunId),
      "*",
      "data",
      JSON.stringify(input)
    );
    return id!;
  }

  async waitForInput(taskRunId: UUID, timeoutMs = 3600000): Promise<HumanInput | null> {
    const results = await this.redis.xread(
      "BLOCK",
      timeoutMs,
      "STREAMS",
      STREAM_KEYS.taskInput(taskRunId),
      "$"
    );

    if (!results) return null;

    const messages = this.parseStreamResults<HumanInput>(results);
    return messages[0]?.data ?? null;
  }

  async createConsumerGroup(groupName: string): Promise<void> {
    try {
      await this.redis.xgroup(
        "CREATE",
        STREAM_KEYS.TASKS_PENDING,
        groupName,
        "0",
        "MKSTREAM"
      );
    } catch (error) {
      // Group already exists, ignore
      if (!(error instanceof Error) || !error.message.includes("BUSYGROUP")) {
        throw error;
      }
    }
  }

  async close(): Promise<void> {
    await this.redis.quit();
    await this.subscriber.quit();
  }

  private parseStreamResults<T>(
    results: [string, [string, string[]][]][]
  ): StreamMessage<T>[] {
    const messages: StreamMessage<T>[] = [];

    for (const [, entries] of results) {
      for (const [id, fields] of entries) {
        const dataIndex = fields.indexOf("data");
        const payloadIndex = fields.indexOf("payload");
        const jsonIndex = dataIndex !== -1 ? dataIndex : payloadIndex;

        if (jsonIndex !== -1) {
          messages.push({
            id,
            data: JSON.parse(fields[jsonIndex + 1]) as T,
          });
        }
      }
    }

    return messages;
  }
}
```

**Step 2: Build API**

Run: `pnpm --filter @desk-agent/api build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add -A
git commit -m "feat(api): implement RedisStreamService

- Task queue with consumer groups
- Event publishing and subscribing
- Human input channel with timeout
- History retrieval with XRANGE"
```

---

### Task 8: Add Environment Files

**Files:**
- Create: `.env.example`
- Create: `docker-compose.yml`

**Step 1: Create .env.example**

```bash
# ============ General ============
NODE_ENV=development

# ============ API Server ============
API_PORT=3000
API_HOST=0.0.0.0

# ============ Database ============
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/desk_agent

# ============ Redis ============
REDIS_URL=redis://localhost:6379

# ============ Claude ============
ANTHROPIC_API_KEY=sk-ant-xxxxx

# ============ Worker ============
DATA_DIR=/data/desk-agent
CONSUMER_GROUP=workers
```

**Step 2: Create docker-compose.yml**

```yaml
version: "3.8"

services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: desk_agent
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data

volumes:
  postgres-data:
  redis-data:
```

**Step 3: Update .gitignore**

Add to .gitignore:
```
# Environment
.env
.env.local

# Dependencies
node_modules/

# Build output
dist/

# IDE
.vscode/
.idea/

# OS
.DS_Store
```

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: add environment configuration

- .env.example with all config vars
- docker-compose for local dev (postgres + redis)
- Update .gitignore"
```

---

## Phase 2: Claude SDK Integration

### Task 9: Create Claude Client Wrapper

**Files:**
- Create: `apps/worker/src/claude/client.ts`
- Create: `apps/worker/src/claude/types.ts`

**Step 1: Create apps/worker/src/claude/types.ts**

```typescript
import type Anthropic from "@anthropic-ai/sdk";

export interface AgentConfig {
  model: "claude-sonnet-4-20250514" | "claude-opus-4-20250514";
  maxTokens: number;
  systemPrompt: string;
  tools: Anthropic.Tool[];
}

export interface AgentResult {
  status: "completed" | "failed" | "cancelled";
  output?: string;
  error?: string;
  tokensInput: number;
  tokensOutput: number;
}

export interface ToolExecutionContext {
  taskRunId: string;
  workDir: string;
  logger: Logger;
}

export interface Logger {
  log(message: string): void;
  error(message: string): void;
}
```

**Step 2: Create apps/worker/src/claude/client.ts**

```typescript
import Anthropic from "@anthropic-ai/sdk";
import type { AgentConfig } from "./types.js";

export function createClaudeClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey });
}

export function createDefaultAgentConfig(
  systemPrompt: string,
  tools: Anthropic.Tool[] = []
): AgentConfig {
  return {
    model: "claude-sonnet-4-20250514",
    maxTokens: 4096,
    systemPrompt,
    tools,
  };
}
```

**Step 3: Build worker**

Run: `pnpm --filter @desk-agent/worker build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add -A
git commit -m "feat(worker): add Claude SDK client wrapper

- AgentConfig and AgentResult types
- Client factory function
- Default config builder"
```

---

### Task 10: Create Tool Registry

**Files:**
- Create: `apps/worker/src/tools/registry.ts`
- Create: `apps/worker/src/tools/types.ts`
- Create: `apps/worker/src/tools/builtin/shell.ts`

**Step 1: Create apps/worker/src/tools/types.ts**

```typescript
import type Anthropic from "@anthropic-ai/sdk";
import type { ToolExecutionContext } from "../claude/types.js";

export interface Tool {
  name: string;
  description: string;
  inputSchema: Anthropic.Tool["input_schema"];
  requiresApproval?: boolean;
  execute(input: unknown, ctx: ToolExecutionContext): Promise<unknown>;
}
```

**Step 2: Create apps/worker/src/tools/registry.ts**

```typescript
import type Anthropic from "@anthropic-ai/sdk";
import type { Tool } from "./types.js";

export class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }
    return tool;
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  toClaudeTools(): Anthropic.Tool[] {
    return Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    }));
  }

  list(): Tool[] {
    return Array.from(this.tools.values());
  }
}
```

**Step 3: Create apps/worker/src/tools/builtin/shell.ts**

```typescript
import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { Tool } from "../types.js";

const execAsync = promisify(exec);

interface ShellInput {
  command: string;
  cwd?: string;
  timeout?: number;
}

interface ShellOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export const shellTool: Tool = {
  name: "execute_shell",
  description: "Execute a shell command on the remote machine. Use for running scripts, builds, tests, etc.",
  inputSchema: {
    type: "object" as const,
    properties: {
      command: {
        type: "string",
        description: "The shell command to execute",
      },
      cwd: {
        type: "string",
        description: "Working directory for command execution",
      },
      timeout: {
        type: "number",
        description: "Timeout in milliseconds (default: 60000)",
      },
    },
    required: ["command"],
  },
  requiresApproval: true,

  async execute(input: unknown, ctx): Promise<ShellOutput> {
    const { command, cwd, timeout = 60000 } = input as ShellInput;

    ctx.logger.log(`[Shell] $ ${command}`);

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: cwd ?? ctx.workDir,
        timeout,
        maxBuffer: 10 * 1024 * 1024, // 10MB
      });

      ctx.logger.log(`[Shell] Command completed successfully`);

      return {
        stdout,
        stderr,
        exitCode: 0,
      };
    } catch (error) {
      const execError = error as { code?: number; stdout?: string; stderr?: string };

      ctx.logger.error(`[Shell] Command failed with code ${execError.code}`);

      return {
        stdout: execError.stdout ?? "",
        stderr: execError.stderr ?? (error as Error).message,
        exitCode: execError.code ?? 1,
      };
    }
  },
};
```

**Step 4: Build worker**

Run: `pnpm --filter @desk-agent/worker build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(worker): add tool registry and shell tool

- ToolRegistry for managing tools
- Shell tool with timeout and approval flag
- Tool interface with Claude schema support"
```

---

## Summary

This plan covers Phase 1 (Core Setup) with 10 tasks:

1. Initialize pnpm workspace
2. Create shared package
3. Create domain package structure
4. Create API server skeleton
5. Create Worker skeleton
6. Add Redis Stream service interface
7. Implement Redis Stream service
8. Add environment files
9. Create Claude client wrapper
10. Create tool registry

Each task is broken into 2-5 minute steps with exact file paths, complete code, and specific commands.

---

**Next phases (separate plans):**
- Phase 2: Complete Claude SDK agent loop
- Phase 3: Database schema with Drizzle
- Phase 4: SSE and Webhook notifications
- Phase 5: Account and Billing domains
