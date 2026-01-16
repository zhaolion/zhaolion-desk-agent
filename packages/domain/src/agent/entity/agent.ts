import type { UUID } from "@desk-agent/shared";

export interface Agent {
  id: UUID;
  userId: UUID;
  name: string;
  description: string | null;
  model: string;
  systemPrompt: string | null;
  maxTokens: number;
  tools: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAgentInput {
  userId: UUID;
  name: string;
  description?: string;
  model?: string;
  systemPrompt?: string;
  maxTokens?: number;
  tools?: string[];
}

export interface UpdateAgentInput {
  name?: string;
  description?: string;
  model?: string;
  systemPrompt?: string;
  maxTokens?: number;
  tools?: string[];
}
