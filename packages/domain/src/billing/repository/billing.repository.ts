import type {
  Plan,
  CreatePlanInput,
  UpdatePlanInput,
} from "../entity/plan.js";
import type {
  Subscription,
  CreateSubscriptionInput,
  UpdateSubscriptionInput,
} from "../entity/subscription.js";
import type {
  UsageRecord,
  CreateUsageRecordInput,
  UsageSummary,
} from "../entity/usage.js";
import type {
  Invoice,
  CreateInvoiceInput,
  UpdateInvoiceInput,
} from "../entity/invoice.js";

export interface PlanRepository {
  create(input: CreatePlanInput): Promise<Plan>;
  findById(id: string): Promise<Plan | null>;
  findAll(): Promise<Plan[]>;
  findActive(): Promise<Plan[]>;
  update(id: string, input: UpdatePlanInput): Promise<Plan>;
  delete(id: string): Promise<void>;
}

export interface SubscriptionRepository {
  create(input: CreateSubscriptionInput): Promise<Subscription>;
  findById(id: string): Promise<Subscription | null>;
  findByUserId(userId: string): Promise<Subscription | null>;
  findByTeamId(teamId: string): Promise<Subscription | null>;
  findByStripeSubscriptionId(stripeSubscriptionId: string): Promise<Subscription | null>;
  update(id: string, input: UpdateSubscriptionInput): Promise<Subscription>;
  cancel(id: string, cancelAt?: Date): Promise<Subscription>;
}

export interface UsageRepository {
  create(input: CreateUsageRecordInput): Promise<UsageRecord>;
  findByUserId(userId: string, periodStart: string, periodEnd: string): Promise<UsageRecord[]>;
  getSummary(userId: string, periodStart: string, periodEnd: string): Promise<UsageSummary>;
  getMonthlyUsage(userId: string, year: number, month: number): Promise<UsageSummary>;
}

export interface InvoiceRepository {
  create(input: CreateInvoiceInput): Promise<Invoice>;
  findById(id: string): Promise<Invoice | null>;
  findByUserId(userId: string): Promise<Invoice[]>;
  findByStripeInvoiceId(stripeInvoiceId: string): Promise<Invoice | null>;
  update(id: string, input: UpdateInvoiceInput): Promise<Invoice>;
}
