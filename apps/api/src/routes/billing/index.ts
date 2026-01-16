import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { PlanRepository, SubscriptionRepository, UsageRepository, InvoiceRepository } from "@desk-agent/domain/billing";
import type { Plan, Subscription, UsageSummary, Invoice } from "@desk-agent/domain";

const createSubscriptionSchema = z.object({
  planId: z.string().min(1),
});

const usageQuerySchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

interface BillingDependencies {
  planRepository: PlanRepository;
  subscriptionRepository: SubscriptionRepository;
  usageRepository: UsageRepository;
  invoiceRepository: InvoiceRepository;
}

export function createBillingRoutes(deps: BillingDependencies): Hono {
  const routes = new Hono();

  // GET /billing/plans - List available plans
  routes.get("/plans", async (c) => {
    const plans = await deps.planRepository.findActive();
    return c.json(plans.map(serializePlan));
  });

  // GET /billing/subscription - Get current subscription
  routes.get("/subscription", async (c) => {
    const auth = c.get("auth");
    const subscription = await deps.subscriptionRepository.findByUserId(auth.userId);

    if (!subscription) {
      return c.json({ subscription: null });
    }

    return c.json({ subscription: serializeSubscription(subscription) });
  });

  // POST /billing/subscription - Create subscription
  routes.post("/subscription", zValidator("json", createSubscriptionSchema), async (c) => {
    const auth = c.get("auth");
    const body = c.req.valid("json");

    // Check if plan exists
    const plan = await deps.planRepository.findById(body.planId);
    if (!plan) {
      return c.json({ error: "Plan not found" }, 404);
    }

    // Check if user already has a subscription
    const existing = await deps.subscriptionRepository.findByUserId(auth.userId);
    if (existing) {
      // Update existing subscription
      const updated = await deps.subscriptionRepository.update(existing.id, {
        planId: body.planId,
      });
      return c.json({ subscription: serializeSubscription(updated) });
    }

    // Create new subscription
    const subscription = await deps.subscriptionRepository.create({
      userId: auth.userId,
      planId: body.planId,
    });

    return c.json({ subscription: serializeSubscription(subscription) }, 201);
  });

  // DELETE /billing/subscription - Cancel subscription
  routes.delete("/subscription", async (c) => {
    const auth = c.get("auth");
    const subscription = await deps.subscriptionRepository.findByUserId(auth.userId);

    if (!subscription) {
      return c.json({ error: "No active subscription" }, 404);
    }

    const canceled = await deps.subscriptionRepository.cancel(subscription.id);
    return c.json({ subscription: serializeSubscription(canceled) });
  });

  // GET /billing/usage - Get usage summary
  routes.get("/usage", zValidator("query", usageQuerySchema), async (c) => {
    const auth = c.get("auth");
    const { year, month } = c.req.valid("query");

    const usage = await deps.usageRepository.getMonthlyUsage(auth.userId, year, month);
    return c.json(usage);
  });

  // GET /billing/invoices - List invoices
  routes.get("/invoices", async (c) => {
    const auth = c.get("auth");
    const invoices = await deps.invoiceRepository.findByUserId(auth.userId);
    return c.json(invoices.map(serializeInvoice));
  });

  // GET /billing/invoices/:id - Get single invoice
  routes.get("/invoices/:id", async (c) => {
    const auth = c.get("auth");
    const invoice = await deps.invoiceRepository.findById(c.req.param("id"));

    if (!invoice || invoice.userId !== auth.userId) {
      return c.json({ error: "Invoice not found" }, 404);
    }

    return c.json(serializeInvoice(invoice));
  });

  return routes;
}

function serializePlan(plan: Plan): Record<string, unknown> {
  return {
    ...plan,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  };
}

function serializeSubscription(subscription: Subscription): Record<string, unknown> {
  return {
    ...subscription,
    currentPeriodStart: subscription.currentPeriodStart?.toISOString() ?? null,
    currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
    cancelAt: subscription.cancelAt?.toISOString() ?? null,
    createdAt: subscription.createdAt.toISOString(),
    updatedAt: subscription.updatedAt.toISOString(),
  };
}

function serializeInvoice(invoice: Invoice): Record<string, unknown> {
  return {
    ...invoice,
    periodStart: invoice.periodStart?.toISOString() ?? null,
    periodEnd: invoice.periodEnd?.toISOString() ?? null,
    paidAt: invoice.paidAt?.toISOString() ?? null,
    createdAt: invoice.createdAt.toISOString(),
  };
}
