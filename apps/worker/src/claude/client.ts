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
