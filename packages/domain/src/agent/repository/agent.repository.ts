import type { UUID } from "@desk-agent/shared";
import type { Agent, CreateAgentInput, UpdateAgentInput } from "../entity/agent.js";

export interface AgentRepository {
  create(input: CreateAgentInput): Promise<Agent>;
  findById(id: UUID): Promise<Agent | null>;
  findByUserId(userId: UUID): Promise<Agent[]>;
  update(id: UUID, input: UpdateAgentInput): Promise<Agent>;
  delete(id: UUID): Promise<void>;
}
