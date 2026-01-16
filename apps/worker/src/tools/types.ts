import type Anthropic from "@anthropic-ai/sdk";
import type { ToolExecutionContext } from "../claude/types.js";

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Anthropic.Tool["input_schema"];
}

export interface ToolHandler {
  definition: ToolDefinition;
  execute(
    input: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult>;
}

export interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
}

export type ToolInput = Record<string, unknown>;
