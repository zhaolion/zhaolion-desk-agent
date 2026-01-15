# Desk Agent 架构设计文档

> 日期: 2025-01-15
> 状态: 已验证

## 概述

Desk Agent 是一个远程 AI Agent 系统，能够在远程机器上执行代码开发、数据处理和通用 AI 任务，同时允许用户在本地监控 Agent 的工作状态、日志和产物。

### 核心功能

- **代码开发任务**: 写代码、跑测试、CI/CD 相关
- **数据处理/分析**: ETL、数据清洗、生成报告
- **通用 AI Agent**: 调用 LLM 执行各种任务（类似 Claude Code 但远程运行）

### 设计原则

- **API 优先**: 先建 API，CLI/Web 都是可选的客户端
- **混合观察模式**: 重要事件实时推送，详细日志按需查看
- **AI 自动 + 人类异步介入**: 大多数场景 AI 自动完成，需要时人类可异步介入
- **渐进式扩展**: 从单机起步，架构支持未来水平扩展

---

## 技术选型

| 模块 | 技术选型 | 说明 |
|------|---------|------|
| 语言 | TypeScript | 全栈统一 |
| 包管理 | pnpm + Turborepo | Monorepo 支持 |
| API 框架 | Fastify / Hono | 高性能 |
| 数据库 | PostgreSQL | 主数据存储 |
| 缓存/队列 | Redis Streams | 任务队列 + 事件流 |
| AI | Claude SDK (TS) | Agent 核心 |
| 存储 | 本地文件 + S3 | 日志/产物 |
| 实时通信 | SSE | 用户端推送 |
| 外部集成 | Webhook | 规则触发 |
| 支付 | Stripe | 订阅/计费 |
| 部署 | Docker Compose | 起步方案 |

---

## 架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│                        系统架构                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────┐    ┌─────────┐    ┌─────────────────────────────┐│
│   │   Web   │    │   CLI   │    │     External (Webhook)      ││
│   └────┬────┘    └────┬────┘    └──────────────┬──────────────┘│
│        │              │                        │                │
│        └──────────────┼────────────────────────┘                │
│                       ▼                                         │
│              ┌─────────────────┐                                │
│              │    API Server   │◄──── SSE 推送                  │
│              └────────┬────────┘                                │
│                       │                                         │
│                       ▼                                         │
│              ┌─────────────────┐                                │
│              │  Redis Streams  │                                │
│              └────────┬────────┘                                │
│                       │                                         │
│                       ▼                                         │
│              ┌─────────────────┐                                │
│              │     Worker      │──── Claude SDK                 │
│              └────────┬────────┘                                │
│                       │                                         │
│         ┌─────────────┼─────────────┐                          │
│         ▼             ▼             ▼                          │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐                    │
│   │ PostgreSQL│  │ Local FS │  │    S3    │                    │
│   └──────────┘  └──────────┘  └──────────┘                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Monorepo 结构

```
desk-agent/
├── apps/
│   ├── api/                    # API 网关服务
│   │   ├── src/
│   │   │   ├── routes/         # HTTP 路由
│   │   │   ├── middleware/     # 认证、限流、计费中间件
│   │   │   ├── sse/            # SSE 推送处理
│   │   │   └── main.ts
│   │   └── package.json
│   │
│   ├── worker/                 # Agent 执行服务
│   │   ├── src/
│   │   │   ├── executor/       # 任务执行引擎
│   │   │   ├── claude/         # Claude SDK 集成
│   │   │   ├── tools/          # Agent 可用工具
│   │   │   └── main.ts
│   │   └── package.json
│   │
│   └── web/                    # 前端应用
│       └── package.json
│
├── packages/
│   ├── domain/                 # DDD 领域层
│   │   ├── account/            # 账号领域（用户、认证、权限）
│   │   ├── billing/            # 支付领域（订阅、账单、用量）
│   │   ├── task/               # 任务领域
│   │   ├── agent/              # Agent 领域
│   │   ├── storage/            # 存储领域
│   │   └── notify/             # 通知领域
│   │
│   ├── shared/                 # 共享类型、工具函数
│   └── sdk/                    # 客户端 SDK
│
├── tools/                      # 构建脚本、代码生成等
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

---

## DDD 领域层详细设计

```
packages/domain/
├── account/                      # 账号领域
│   ├── entity/
│   │   ├── user.ts               # 用户实体
│   │   ├── team.ts               # 团队/组织
│   │   └── api-key.ts            # API Key
│   ├── repository/
│   │   └── user.repository.ts    # 用户存储接口
│   ├── service/
│   │   ├── auth.service.ts       # 认证服务（JWT、OAuth）
│   │   └── permission.service.ts # 权限校验
│   └── index.ts
│
├── billing/                      # 支付领域
│   ├── entity/
│   │   ├── subscription.ts       # 订阅计划
│   │   ├── usage.ts              # 用量记录
│   │   └── invoice.ts            # 账单
│   ├── service/
│   │   ├── meter.service.ts      # 用量计量
│   │   └── payment.service.ts    # 支付网关
│   └── index.ts
│
├── task/                         # 任务领域
│   ├── entity/
│   │   ├── task.ts               # 任务实体
│   │   ├── task-run.ts           # 任务执行记录
│   │   └── task-step.ts          # 执行步骤
│   ├── repository/
│   │   └── task.repository.ts
│   ├── service/
│   │   ├── task.service.ts       # 任务 CRUD
│   │   └── scheduler.service.ts  # 任务调度
│   ├── event/
│   │   └── task.event.ts         # 任务事件定义
│   └── index.ts
│
├── agent/                        # Agent 领域
│   ├── entity/
│   │   ├── agent.ts              # Agent 配置
│   │   ├── tool.ts               # 可用工具定义
│   │   └── conversation.ts       # 对话上下文
│   ├── service/
│   │   ├── agent.service.ts      # Agent 生命周期
│   │   └── tool-registry.ts      # 工具注册
│   └── index.ts
│
├── storage/                      # 存储领域
│   ├── entity/
│   │   ├── artifact.ts           # 产物元数据
│   │   └── log-file.ts           # 日志文件
│   ├── service/
│   │   ├── local.service.ts      # 本地文件操作
│   │   └── s3.service.ts         # S3 上传/下载
│   └── index.ts
│
└── notify/                       # 通知领域
    ├── entity/
    │   ├── notification.ts       # 通知记录
    │   └── webhook.ts            # Webhook 配置
    ├── service/
    │   ├── sse.service.ts        # SSE 推送
    │   └── webhook.service.ts    # Webhook 调用
    └── index.ts
```

### 设计原则

- 每个领域独立，通过 `index.ts` 暴露公共接口
- `entity/` 是纯数据结构，无外部依赖
- `repository/` 定义存储接口，具体实现在 `apps/` 层注入
- `service/` 包含业务逻辑，依赖接口而非实现

---

## API 与 Worker 通信机制

### Redis Streams 架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    Redis Streams 架构                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────┐                                                   │
│   │   API   │                                                   │
│   └────┬────┘                                                   │
│        │                                                        │
│        │ XADD                              XREAD (SSE)          │
│        ▼                                        ▲               │
│   ┌─────────────────────────────────────────────┴────────┐      │
│   │                    Redis Streams                     │      │
│   │                                                      │      │
│   │  stream:tasks:pending     ← 待执行任务               │      │
│   │  stream:tasks:{id}:events ← 单任务事件流             │      │
│   │  stream:events:global     ← 全局事件（可选）         │      │
│   │                                                      │      │
│   └─────────────────────────────────────────────────────────┘   │
│        │                                                        │
│        │ XREADGROUP (消费组)                                    │
│        ▼                                                        │
│   ┌───────────┐                                                 │
│   │  Worker   │ ──► 写本地日志/产物                             │
│   │  (消费组) │ ──► 更新 PG 状态                                │
│   └───────────┘ ──► XADD 事件到任务流                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 为什么选 Redis Streams

| 对比项 | BullMQ + Pub/Sub | Redis Streams |
|--------|------------------|---------------|
| 依赖 | 需要 BullMQ 库 | 原生 Redis 命令 |
| 消息持久化 | ✅ / ❌ (Pub/Sub 丢失) | ✅ 全部持久化 |
| 消费确认 | BullMQ 实现 | 原生 XACK |
| 历史回放 | ❌ Pub/Sub 无法回放 | ✅ XRANGE 任意读取 |
| 统一模型 | 两套机制 | 一套搞定 |

### Stream 服务接口

```typescript
interface TaskStreamService {
  // 任务入队
  enqueueTask(taskRun: TaskRun): Promise<string>

  // Worker 消费（消费组模式）
  consumeTasks(groupName: string, consumerId: string): AsyncIterable<TaskRun>

  // 确认完成
  ackTask(messageId: string): Promise<void>

  // 发布任务事件
  publishEvent(taskRunId: string, event: TaskEvent): Promise<string>

  // 订阅任务事件（SSE 用）
  subscribeEvents(taskRunId: string, lastId?: string): AsyncIterable<TaskEvent>

  // 获取历史事件（断线重连/回放）
  getEventHistory(taskRunId: string, fromId?: string): Promise<TaskEvent[]>
}
```

### 核心命令示例

```typescript
// 1. 任务入队
await redis.xadd('stream:tasks:pending', '*',
  'taskRunId', taskRun.id,
  'payload', JSON.stringify(taskRun)
)

// 2. Worker 消费（消费组）
await redis.xreadgroup('GROUP', 'workers', 'worker-1',
  'COUNT', 1, 'BLOCK', 5000,
  'STREAMS', 'stream:tasks:pending', '>'
)

// 3. 发布事件到任务专属流
await redis.xadd(`stream:tasks:${taskRunId}:events`, '*',
  'type', 'STEP_COMPLETED',
  'data', JSON.stringify(step)
)

// 4. SSE 订阅（支持断线续传）
await redis.xread('BLOCK', 0,
  'STREAMS', `stream:tasks:${taskRunId}:events`, lastEventId
)
```

---

## 任务执行数据流

```
用户                API                    Redis              Worker
 │                   │                       │                   │
 │ POST /tasks       │                       │                   │
 │──────────────────►│                       │                   │
 │                   │ 1.创建 TaskRun (PG)   │                   │
 │                   │─────────┐             │                   │
 │                   │◄────────┘             │                   │
 │                   │                       │                   │
 │                   │ 2.入队 XADD           │                   │
 │                   │──────────────────────►│                   │
 │                   │                       │                   │
 │   202 Accepted    │                       │                   │
 │◄──────────────────│                       │                   │
 │   {taskRunId}     │                       │                   │
 │                   │                       │ 3.拉取任务        │
 │                   │                       │◄──────────────────│
 │                   │                       │                   │
 │ SSE /tasks/:id    │                       │   4.执行 Agent    │
 │──────────────────►│                       │   ┌───────────────│
 │                   │                       │   │ Claude SDK    │
 │                   │                       │   │ 调用工具      │
 │                   │                       │   │ 写日志文件    │
 │                   │                       │   └───────────────│
 │                   │                       │                   │
 │                   │      5.发布事件       │◄──────────────────│
 │                   │◄──────────────────────│  STEP_COMPLETED   │
 │   SSE: event      │                       │                   │
 │◄──────────────────│                       │                   │
 │                   │                       │                   │
 │                   │                       │  6.需人工介入?    │
 │                   │      发布事件         │◄──────────────────│
 │                   │◄──────────────────────│ HUMAN_INPUT_NEEDED│
 │   SSE: 等待输入   │                       │                   │
 │◄──────────────────│                       │                   │
 │                   │                       │                   │
 │ POST /tasks/:id   │                       │                   │
 │    /input         │──────────────────────►│                   │
 │──────────────────►│      发布输入         │──────────────────►│
 │                   │                       │   7.继续执行      │
 │                   │                       │                   │
 │                   │      8.任务完成       │◄──────────────────│
 │                   │◄──────────────────────│   TASK_COMPLETED  │
 │   SSE: 完成       │                       │                   │
 │◄──────────────────│                       │   9.上传产物 S3   │
 │                   │                       │   (异步)          │
 └───────────────────┴───────────────────────┴───────────────────┘
```

### 任务状态流转

```typescript
enum TaskRunStatus {
  PENDING = 'pending',           // 已创建，等待执行
  QUEUED = 'queued',             // 已入队
  RUNNING = 'running',           // 执行中
  WAITING_INPUT = 'waiting_input', // 等待人工输入
  COMPLETED = 'completed',       // 成功完成
  FAILED = 'failed',             // 执行失败
  CANCELLED = 'cancelled',       // 用户取消
}
```

### 事件类型

```typescript
type TaskEvent =
  | { type: 'TASK_STARTED'; taskRunId: string }
  | { type: 'STEP_STARTED'; taskRunId: string; step: TaskStep }
  | { type: 'STEP_COMPLETED'; taskRunId: string; step: TaskStep }
  | { type: 'LOG_APPENDED'; taskRunId: string; line: string }
  | { type: 'HUMAN_INPUT_NEEDED'; taskRunId: string; prompt: string }
  | { type: 'TASK_PROGRESS'; taskRunId: string; progress: number }
  | { type: 'TASK_COMPLETED'; taskRunId: string; result: TaskResult }
  | { type: 'TASK_FAILED'; taskRunId: string; error: string }
```

---

## API 路由设计

```typescript
// ============ 账号领域 ============
POST   /auth/register              // 注册
POST   /auth/login                 // 登录
POST   /auth/logout                // 登出
POST   /auth/refresh               // 刷新 token
GET    /auth/oauth/:provider       // OAuth 跳转
GET    /auth/oauth/:provider/callback

GET    /users/me                   // 当前用户信息
PATCH  /users/me                   // 更新资料

GET    /api-keys                   // 列出 API Keys
POST   /api-keys                   // 创建 API Key
DELETE /api-keys/:id               // 删除 API Key

// ============ 团队 ============
GET    /teams                      // 我的团队
POST   /teams                      // 创建团队
GET    /teams/:id/members          // 成员列表
POST   /teams/:id/members          // 邀请成员

// ============ 支付领域 ============
GET    /billing/plans              // 可用订阅计划
GET    /billing/subscription       // 当前订阅
POST   /billing/subscription       // 订阅/升级
DELETE /billing/subscription       // 取消订阅
GET    /billing/usage              // 用量统计
GET    /billing/invoices           // 账单列表
POST   /billing/payment-method     // 添加支付方式

// ============ 任务领域 ============
GET    /tasks                      // 任务模板列表
POST   /tasks                      // 创建任务模板
GET    /tasks/:id                  // 任务详情
PATCH  /tasks/:id                  // 更新任务
DELETE /tasks/:id                  // 删除任务

POST   /tasks/:id/runs             // 执行任务 → 返回 taskRunId
GET    /tasks/:id/runs             // 执行历史

GET    /runs/:runId                // 执行详情
GET    /runs/:runId/events         // SSE 事件流
GET    /runs/:runId/logs           // 日志内容
GET    /runs/:runId/artifacts      // 产物列表
GET    /runs/:runId/artifacts/:name // 下载产物
POST   /runs/:runId/input          // 提交人工输入
POST   /runs/:runId/cancel         // 取消执行

// ============ Agent 领域 ============
GET    /agents                     // Agent 配置列表
POST   /agents                     // 创建 Agent 配置
GET    /agents/:id                 // Agent 详情
PATCH  /agents/:id                 // 更新配置
DELETE /agents/:id                 // 删除

GET    /agents/:id/tools           // 可用工具列表
POST   /agents/:id/tools           // 添加工具
DELETE /agents/:id/tools/:toolId   // 移除工具

// ============ 通知领域 ============
GET    /webhooks                   // Webhook 列表
POST   /webhooks                   // 创建 Webhook
PATCH  /webhooks/:id               // 更新
DELETE /webhooks/:id               // 删除
POST   /webhooks/:id/test          // 测试触发

GET    /notifications              // 通知历史
PATCH  /notifications/:id/read     // 标记已读
```

### 认证方式

```typescript
// 支持两种认证
// 1. JWT Bearer Token（Web/移动端）
Authorization: Bearer eyJhbGc...

// 2. API Key（CLI/脚本/外部集成）
X-API-Key: dsk_live_xxxxxxxxxxxx
```

### SSE 事件流示例

```
GET /runs/:runId/events?lastEventId=xxx

Response: text/event-stream

event: TASK_STARTED
id: 1705312345678-0
data: {"taskRunId":"run_abc123","timestamp":"2024-01-15T10:00:00Z"}

event: STEP_STARTED
id: 1705312345679-0
data: {"taskRunId":"run_abc123","step":{"name":"analyze_code","index":0}}

event: LOG_APPENDED
id: 1705312345680-0
data: {"taskRunId":"run_abc123","line":"Reading file src/main.ts..."}

event: HUMAN_INPUT_NEEDED
id: 1705312345681-0
data: {"taskRunId":"run_abc123","prompt":"需要确认：是否删除这个文件？","options":["是","否"]}
```

---

## Worker 集成 Claude SDK

### 目录结构

```
apps/worker/
├── src/
│   ├── main.ts                    # 入口，启动消费者
│   ├── claude/
│   │   ├── client.ts              # Claude SDK 封装
│   │   ├── agent-loop.ts          # Agent 执行循环
│   │   └── message-handler.ts     # 消息/工具调用处理
│   ├── tools/
│   │   ├── registry.ts            # 工具注册中心
│   │   ├── builtin/               # 内置工具
│   │   │   ├── shell.ts           # 执行命令
│   │   │   ├── file.ts            # 文件读写
│   │   │   ├── http.ts            # HTTP 请求
│   │   │   └── code-analysis.ts   # 代码分析
│   │   └── custom/                # 用户自定义工具
│   ├── executor/
│   │   ├── task-executor.ts       # 任务执行器
│   │   └── context.ts             # 执行上下文
│   └── logger/
│       └── file-logger.ts         # 本地日志写入
```

### Claude SDK 客户端封装

```typescript
// apps/worker/src/claude/client.ts
import Anthropic from "@anthropic-ai/sdk";

export function createClaudeClient() {
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
}

export interface AgentConfig {
  model: "claude-sonnet-4-20250514" | "claude-opus-4-20250514";
  maxTokens: number;
  systemPrompt: string;
  tools: ToolDefinition[];
}
```

### Agent 执行循环

```typescript
// apps/worker/src/claude/agent-loop.ts
import Anthropic from "@anthropic-ai/sdk";

interface AgentLoopContext {
  taskRunId: string;
  config: AgentConfig;
  streamService: TaskStreamService;
  logger: FileLogger;
  toolRegistry: ToolRegistry;
}

export async function runAgentLoop(
  client: Anthropic,
  ctx: AgentLoopContext,
  initialPrompt: string
): Promise<AgentResult> {
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: initialPrompt }
  ];

  // 发布开始事件
  await ctx.streamService.publishEvent(ctx.taskRunId, {
    type: "TASK_STARTED",
    timestamp: new Date().toISOString(),
  });

  while (true) {
    // 1. 调用 Claude
    ctx.logger.log(`[Agent] Calling Claude API...`);

    const response = await client.messages.create({
      model: ctx.config.model,
      max_tokens: ctx.config.maxTokens,
      system: ctx.config.systemPrompt,
      tools: ctx.config.tools,
      messages,
    });

    // 2. 记录 token 用量（计费用）
    await recordUsage(ctx.taskRunId, response.usage);

    // 3. 处理响应
    const assistantMessage: Anthropic.MessageParam = {
      role: "assistant",
      content: response.content,
    };
    messages.push(assistantMessage);

    // 4. 检查是否结束
    if (response.stop_reason === "end_turn") {
      const textContent = response.content.find(c => c.type === "text");
      await ctx.streamService.publishEvent(ctx.taskRunId, {
        type: "TASK_COMPLETED",
        result: textContent?.text || "",
      });
      return { status: "completed", output: textContent?.text };
    }

    // 5. 处理工具调用
    if (response.stop_reason === "tool_use") {
      const toolResults = await handleToolCalls(
        response.content,
        ctx
      );
      messages.push({ role: "user", content: toolResults });
    }
  }
}
```

### 工具调用处理

```typescript
// apps/worker/src/claude/message-handler.ts

async function handleToolCalls(
  content: Anthropic.ContentBlock[],
  ctx: AgentLoopContext
): Promise<Anthropic.ToolResultBlockParam[]> {
  const toolUseBlocks = content.filter(
    (c): c is Anthropic.ToolUseBlock => c.type === "tool_use"
  );

  const results: Anthropic.ToolResultBlockParam[] = [];

  for (const toolUse of toolUseBlocks) {
    // 发布步骤开始事件
    await ctx.streamService.publishEvent(ctx.taskRunId, {
      type: "STEP_STARTED",
      step: { name: toolUse.name, input: toolUse.input },
    });

    ctx.logger.log(`[Tool] Executing: ${toolUse.name}`);

    try {
      // 检查是否需要人工确认
      if (await requiresHumanApproval(toolUse, ctx)) {
        const humanInput = await waitForHumanInput(ctx, toolUse);
        if (!humanInput.approved) {
          results.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: "User rejected this action.",
          });
          continue;
        }
      }

      // 执行工具
      const tool = ctx.toolRegistry.get(toolUse.name);
      const output = await tool.execute(toolUse.input, ctx);

      ctx.logger.log(`[Tool] ${toolUse.name} completed`);

      results.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: typeof output === "string" ? output : JSON.stringify(output),
      });

      // 发布步骤完成事件
      await ctx.streamService.publishEvent(ctx.taskRunId, {
        type: "STEP_COMPLETED",
        step: { name: toolUse.name, output },
      });

    } catch (error) {
      ctx.logger.log(`[Tool] ${toolUse.name} failed: ${error.message}`);
      results.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: `Error: ${error.message}`,
        is_error: true,
      });
    }
  }

  return results;
}
```

### 人工介入机制

```typescript
// apps/worker/src/claude/human-input.ts

async function waitForHumanInput(
  ctx: AgentLoopContext,
  toolUse: Anthropic.ToolUseBlock
): Promise<HumanInput> {
  // 1. 发布等待事件
  await ctx.streamService.publishEvent(ctx.taskRunId, {
    type: "HUMAN_INPUT_NEEDED",
    prompt: `Agent wants to execute: ${toolUse.name}`,
    toolUse,
    timeout: 3600, // 1小时超时
  });

  // 2. 更新任务状态
  await ctx.taskRepository.updateStatus(ctx.taskRunId, "waiting_input");

  // 3. 监听输入流
  const inputStream = `stream:tasks:${ctx.taskRunId}:input`;

  // 阻塞等待用户输入（带超时）
  const result = await ctx.redis.xread(
    "BLOCK", 3600000, // 1小时
    "STREAMS", inputStream, "$"
  );

  if (!result) {
    return { approved: false, reason: "timeout" };
  }

  const input = parseHumanInput(result);

  // 4. 恢复执行状态
  await ctx.taskRepository.updateStatus(ctx.taskRunId, "running");

  return input;
}
```

### 工具定义与注册

```typescript
// apps/worker/src/tools/registry.ts

export interface Tool {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  requiresApproval?: boolean;  // 是否需要人工确认
  execute(input: unknown, ctx: AgentLoopContext): Promise<unknown>;
}

// apps/worker/src/tools/builtin/shell.ts
export const shellTool: Tool = {
  name: "execute_shell",
  description: "Execute a shell command on the remote machine",
  inputSchema: {
    type: "object",
    properties: {
      command: { type: "string", description: "The command to execute" },
      cwd: { type: "string", description: "Working directory" },
    },
    required: ["command"],
  },
  requiresApproval: true,  // 危险操作需确认

  async execute(input: { command: string; cwd?: string }, ctx) {
    ctx.logger.log(`[Shell] $ ${input.command}`);
    const result = await execAsync(input.command, { cwd: input.cwd });
    ctx.logger.log(`[Shell] Exit code: ${result.code}`);
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.code,
    };
  },
};
```

---

## 存储层设计

### 存储架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        存储架构                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Worker 本地                                                    │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  /data/desk-agent/                                      │    │
│  │  ├── runs/                                              │    │
│  │  │   └── {taskRunId}/                                   │    │
│  │  │       ├── run.json          # 运行元数据             │    │
│  │  │       ├── logs/                                      │    │
│  │  │       │   ├── agent.log     # Agent 主日志           │    │
│  │  │       │   ├── tool.log      # 工具调用日志           │    │
│  │  │       │   └── stderr.log    # 错误日志               │    │
│  │  │       ├── artifacts/        # 产物                   │    │
│  │  │       │   ├── report.pdf                             │    │
│  │  │       │   └── output.csv                             │    │
│  │  │       └── state/            # 中间状态               │    │
│  │  │           ├── messages.json # 对话历史               │    │
│  │  │           └── context.json  # 执行上下文             │    │
│  │  └── tmp/                      # 临时文件               │    │
│  └────────────────────────────────────────────────────────┘    │
│         │                                                       │
│         │ Log Collector (定时/规则触发)                         │
│         ▼                                                       │
│  ┌────────────────────────────────────────────────────────┐    │
│  │                         S3                              │    │
│  │  bucket: desk-agent-storage                             │    │
│  │  ├── runs/{userId}/{taskRunId}/                         │    │
│  │  │   ├── logs/                                          │    │
│  │  │   ├── artifacts/                                     │    │
│  │  │   └── state/                                         │    │
│  │  └── archives/                 # 归档（超过 N 天）       │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 本地存储服务

```typescript
// packages/domain/storage/service/local.service.ts

export interface LocalStorageService {
  getRunDir(taskRunId: string): string;
  appendLog(taskRunId: string, channel: string, line: string): Promise<void>;
  readLog(taskRunId: string, channel: string, tail?: number): Promise<string>;
  saveArtifact(taskRunId: string, name: string, data: Buffer): Promise<string>;
  getArtifact(taskRunId: string, name: string): Promise<Buffer>;
  listArtifacts(taskRunId: string): Promise<ArtifactMeta[]>;
  saveState(taskRunId: string, key: string, data: unknown): Promise<void>;
  loadState<T>(taskRunId: string, key: string): Promise<T | null>;
}
```

### S3 同步服务

```typescript
// packages/domain/storage/service/s3.service.ts

export interface S3SyncService {
  upload(localPath: string, s3Key: string): Promise<string>;
  syncRun(taskRunId: string, options?: SyncOptions): Promise<SyncResult>;
  download(s3Key: string): Promise<Buffer>;
  getPresignedUrl(s3Key: string, expiresIn?: number): Promise<string>;
}

interface SyncOptions {
  includePatterns?: string[];
  excludePatterns?: string[];
  deleteLocal?: boolean;
}
```

### 日志收集器

```typescript
// apps/worker/src/collector/log-collector.ts

export class LogCollector {
  // 定时运行
  async run() {
    const runs = await this.findSyncableRuns();
    for (const taskRunId of runs) {
      await this.syncRun(taskRunId);
    }
  }

  private async findSyncableRuns(): Promise<string[]> {
    // 规则：
    // 1. 已完成/失败的任务
    // 2. 或者运行中但超过 N 分钟未同步
    // 3. 或者日志文件超过 N MB
  }
}

// 启动定时任务
cron.schedule("*/5 * * * *", () => collector.run());  // 每 5 分钟
```

---

## 通知层设计

### 通知架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        通知架构                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                      Redis Streams                              │
│                           │                                     │
│         ┌─────────────────┼─────────────────┐                   │
│         ▼                 ▼                 ▼                   │
│   ┌──────────┐     ┌──────────┐     ┌──────────────┐           │
│   │   SSE    │     │ Webhook  │     │ Notification │           │
│   │ Manager  │     │ Dispatch │     │   Storage    │           │
│   └────┬─────┘     └────┬─────┘     └──────┬───────┘           │
│        │                │                  │                    │
│        ▼                ▼                  ▼                    │
│   在线用户实时      外部系统回调        离线用户稍后查看         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### SSE 管理器

```typescript
// apps/api/src/sse/sse-manager.ts

export class SSEManager {
  private connections = new Map<string, SSEConnection>();

  async connect(req: Request, res: Response, taskRunId: string, userId: string);
  async push(taskRunId: string, event: TaskEvent, eventId: string);
  async pushToUser(userId: string, event: UserNotification);
}
```

### Webhook 服务

```typescript
// packages/domain/notify/entity/webhook.ts

interface Webhook {
  id: string;
  userId: string;
  name: string;
  url: string;
  secret: string;
  events: WebhookEventType[];
  filters?: {
    taskIds?: string[];
    status?: TaskRunStatus[];
  };
  enabled: boolean;
  lastTriggeredAt?: Date;
  failureCount: number;
}

type WebhookEventType =
  | "task.started"
  | "task.completed"
  | "task.failed"
  | "task.waiting_input"
  | "artifact.created";
```

### Webhook 分发器

```typescript
// packages/domain/notify/service/webhook.service.ts

export class WebhookDispatcher {
  async dispatch(userId: string, event: TaskEvent);

  private async send(webhook: Webhook, event: TaskEvent) {
    const payload = { id, timestamp, event: event.type, data: event };
    const signature = this.sign(payload, webhook.secret);

    await this.httpClient.post(webhook.url, payload, {
      headers: {
        "X-Webhook-Signature": signature,
        "X-Webhook-Id": webhook.id,
      },
    });
  }

  // 重试策略：指数退避，最多 3 次
  private async scheduleRetry(webhook: Webhook, payload: unknown);
}
```

---

## 数据库设计 (PostgreSQL)

### 账号领域

```sql
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  name          VARCHAR(100),
  avatar_url    TEXT,
  oauth_provider VARCHAR(50),
  oauth_id       VARCHAR(255),
  status        VARCHAR(20) DEFAULT 'active',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE teams (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(100) NOT NULL,
  owner_id      UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE team_members (
  team_id       UUID REFERENCES teams(id),
  user_id       UUID REFERENCES users(id),
  role          VARCHAR(20) DEFAULT 'member',
  joined_at     TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (team_id, user_id)
);

CREATE TABLE api_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id),
  name          VARCHAR(100),
  key_hash      VARCHAR(255) NOT NULL,
  key_prefix    VARCHAR(20) NOT NULL,
  scopes        TEXT[],
  last_used_at  TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

### 支付领域

```sql
CREATE TABLE plans (
  id            VARCHAR(50) PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  price_monthly DECIMAL(10,2),
  price_yearly  DECIMAL(10,2),
  limits        JSONB NOT NULL,
  features      TEXT[],
  active        BOOLEAN DEFAULT true
);

CREATE TABLE subscriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id),
  team_id       UUID REFERENCES teams(id),
  plan_id       VARCHAR(50) REFERENCES plans(id),
  status        VARCHAR(20) DEFAULT 'active',
  stripe_subscription_id VARCHAR(255),
  stripe_customer_id     VARCHAR(255),
  current_period_start   TIMESTAMPTZ,
  current_period_end     TIMESTAMPTZ,
  cancel_at              TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE usage_records (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id),
  task_run_id   UUID,
  type          VARCHAR(50) NOT NULL,
  amount        BIGINT NOT NULL,
  period_start  DATE NOT NULL,
  period_end    DATE NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE invoices (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id),
  stripe_invoice_id VARCHAR(255),
  amount            DECIMAL(10,2),
  currency          VARCHAR(3) DEFAULT 'USD',
  status            VARCHAR(20),
  period_start  TIMESTAMPTZ,
  period_end    TIMESTAMPTZ,
  pdf_url       TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

### 任务领域

```sql
CREATE TABLE agents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id),
  name          VARCHAR(100) NOT NULL,
  description   TEXT,
  model         VARCHAR(50) DEFAULT 'claude-sonnet-4-20250514',
  system_prompt TEXT,
  max_tokens    INT DEFAULT 4096,
  tools         TEXT[],
  config        JSONB,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id),
  agent_id      UUID REFERENCES agents(id),
  name          VARCHAR(200) NOT NULL,
  description   TEXT,
  prompt        TEXT NOT NULL,
  variables     JSONB,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE task_runs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id       UUID REFERENCES tasks(id),
  user_id       UUID REFERENCES users(id),
  agent_id      UUID REFERENCES agents(id),
  prompt        TEXT NOT NULL,
  variables     JSONB,
  status        VARCHAR(20) DEFAULT 'pending',
  progress      INT DEFAULT 0,
  result        TEXT,
  error         TEXT,
  tokens_input  BIGINT DEFAULT 0,
  tokens_output BIGINT DEFAULT 0,
  local_path    TEXT,
  s3_prefix     TEXT,
  synced_at     TIMESTAMPTZ,
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE task_steps (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_run_id   UUID REFERENCES task_runs(id),
  index         INT NOT NULL,
  name          VARCHAR(100),
  type          VARCHAR(50),
  input         JSONB,
  output        JSONB,
  error         TEXT,
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ
);
```

### 存储领域

```sql
CREATE TABLE artifacts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_run_id   UUID REFERENCES task_runs(id),
  name          VARCHAR(255) NOT NULL,
  mime_type     VARCHAR(100),
  size_bytes    BIGINT,
  local_path    TEXT,
  s3_key        TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  synced_at     TIMESTAMPTZ
);

CREATE TABLE log_files (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_run_id   UUID REFERENCES task_runs(id),
  channel       VARCHAR(50) NOT NULL,
  local_path    TEXT,
  s3_key        TEXT,
  line_count    INT DEFAULT 0,
  size_bytes    BIGINT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  last_appended_at TIMESTAMPTZ,
  synced_at     TIMESTAMPTZ
);
```

### 通知领域

```sql
CREATE TABLE webhooks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id),
  name          VARCHAR(100),
  url           TEXT NOT NULL,
  secret        VARCHAR(255) NOT NULL,
  events        TEXT[] NOT NULL,
  filters       JSONB,
  enabled       BOOLEAN DEFAULT true,
  failure_count INT DEFAULT 0,
  last_triggered_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id),
  type          VARCHAR(50) NOT NULL,
  title         VARCHAR(200),
  body          TEXT,
  data          JSONB,
  read          BOOLEAN DEFAULT false,
  read_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 部署配置

### Docker Compose

```yaml
version: "3.8"

services:
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/desk_agent
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis

  worker:
    build:
      context: .
      dockerfile: apps/worker/Dockerfile
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/desk_agent
      - REDIS_URL=redis://redis:6379
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    volumes:
      - worker-data:/data/desk-agent
    depends_on:
      - db
      - redis

  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=desk_agent
    volumes:
      - postgres-data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis-data:/data
    ports:
      - "6379:6379"

volumes:
  postgres-data:
  redis-data:
  worker-data:
```

### 单机部署架构

```
┌─────────────────────────────────────────────────────────────────┐
│                     单台服务器部署                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                    Nginx / Caddy                         │  │
│   │              (反向代理 + HTTPS + 静态文件)                │  │
│   └─────────────────────────────────────────────────────────┘  │
│                │                              │                 │
│                ▼                              ▼                 │
│   ┌───────────────────────┐    ┌───────────────────────────┐  │
│   │   API Container       │    │   Web Static Files        │  │
│   │   (Port 3000)         │    │   (Nginx serve)           │  │
│   └───────────────────────┘    └───────────────────────────┘  │
│                │                                               │
│   ┌───────────────────────┐                                   │
│   │   Worker Container    │                                   │
│   │   (1-N instances)     │                                   │
│   └───────────────────────┘                                   │
│                │                                               │
│   ┌────────────┴────────────┐                                 │
│   ▼                         ▼                                  │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│   │  PostgreSQL │  │    Redis    │  │   /data (Volume)    │  │
│   │  Container  │  │  Container  │  │   日志/产物存储      │  │
│   └─────────────┘  └─────────────┘  └─────────────────────┘  │
│                                                                │
└─────────────────────────────────────────────────────────────────┘
```

### 未来扩展路径

```
阶段 1 (当前): 单机部署
├── 1 API + 1 Worker + PG + Redis
└── 适合: 个人/小团队使用

阶段 2: 垂直扩展
├── 增加 Worker 实例 (同一台机器)
├── PG/Redis 迁移到托管服务 (RDS/ElastiCache)
└── 适合: 中等负载

阶段 3: 水平扩展
├── API 多实例 + Load Balancer
├── Worker 多机器部署
├── Redis Cluster
└── 适合: 高负载/多租户

阶段 4: Kubernetes
├── 全面容器编排
├── 自动伸缩
├── 多区域部署
└── 适合: 企业级
```

---

## 实施建议

### 第一阶段：核心功能

1. 搭建 Monorepo 基础结构
2. 实现 API 基础框架 + 认证
3. 实现 Worker + Claude SDK 集成
4. Redis Streams 通信机制
5. 本地文件存储

### 第二阶段：用户体验

1. SSE 实时推送
2. Web 前端基础版
3. 人工介入流程
4. Webhook 通知

### 第三阶段：商业化

1. 账号系统完善
2. Stripe 支付集成
3. 用量计费
4. S3 存储 + 日志收集

### 第四阶段：扩展

1. 多 Worker 支持
2. 自定义工具系统
3. 团队协作功能
4. 监控与告警
