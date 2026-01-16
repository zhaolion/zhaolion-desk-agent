export type UsageType = "tokens_input" | "tokens_output" | "task_runs" | "api_calls";

export interface UsageRecord {
  id: string;
  userId: string;
  taskRunId?: string;
  type: UsageType;
  amount: number;
  periodStart: string;
  periodEnd: string;
  createdAt: Date;
}

export interface CreateUsageRecordInput {
  userId: string;
  taskRunId?: string;
  type: UsageType;
  amount: number;
  periodStart: string;
  periodEnd: string;
}

export interface UsageSummary {
  userId: string;
  periodStart: string;
  periodEnd: string;
  tokensInput: number;
  tokensOutput: number;
  taskRuns: number;
  apiCalls: number;
}
