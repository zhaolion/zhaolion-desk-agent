// apps/worker/src/claude/index.ts
export { createClaudeClient, createDefaultAgentConfig } from "./client.js";
export { runAgentLoop } from "./agent-loop.js";
export type { AgentLoopOptions } from "./agent-loop.js";
export { handleToolCalls, extractTextContent } from "./message-handler.js";
export type { AgentConfig, AgentResult, ToolExecutionContext, Logger } from "./types.js";
