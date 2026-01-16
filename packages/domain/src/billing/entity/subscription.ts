export type SubscriptionStatus = "active" | "past_due" | "canceled" | "trialing" | "incomplete";

export interface Subscription {
  id: string;
  userId?: string;
  teamId?: string;
  planId: string;
  status: SubscriptionStatus;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSubscriptionInput {
  userId?: string;
  teamId?: string;
  planId: string;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
}

export interface UpdateSubscriptionInput {
  planId?: string;
  status?: SubscriptionStatus;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAt?: Date;
}
