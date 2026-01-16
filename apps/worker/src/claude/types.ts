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
  log(message: string): void | Promise<void>;
  error(message: string): void | Promise<void>;
}
