export interface PlanLimits {
  maxTaskRunsPerMonth: number;
  maxTokensPerMonth: number;
  maxAgents: number;
  maxWebhooks: number;
  maxTeamMembers?: number;
}

export interface Plan {
  id: string;
  name: string;
  description?: string;
  priceMonthly?: string;
  priceYearly?: string;
  limits: PlanLimits;
  features?: string[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePlanInput {
  id: string;
  name: string;
  description?: string;
  priceMonthly?: string;
  priceYearly?: string;
  limits: PlanLimits;
  features?: string[];
}

export interface UpdatePlanInput {
  name?: string;
  description?: string;
  priceMonthly?: string;
  priceYearly?: string;
  limits?: PlanLimits;
  features?: string[];
  active?: boolean;
}
