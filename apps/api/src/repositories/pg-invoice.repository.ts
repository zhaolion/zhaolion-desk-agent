import { eq, desc } from "drizzle-orm";
import type { Database } from "../db/index.js";
import { invoices } from "../db/schema.js";
import type { InvoiceRepository } from "@desk-agent/domain/billing";
import type { Invoice, CreateInvoiceInput, UpdateInvoiceInput, InvoiceStatus } from "@desk-agent/domain";

export class PgInvoiceRepository implements InvoiceRepository {
  constructor(private db: Database) {}

  async create(input: CreateInvoiceInput): Promise<Invoice> {
    const [result] = await this.db.insert(invoices).values({
      userId: input.userId,
      subscriptionId: input.subscriptionId ?? null,
      stripeInvoiceId: input.stripeInvoiceId ?? null,
      amount: input.amount,
      currency: input.currency ?? "USD",
      periodStart: input.periodStart ?? null,
      periodEnd: input.periodEnd ?? null,
    }).returning();

    if (!result) {
      throw new Error("Failed to create invoice");
    }

    return this.mapToInvoice(result);
  }

  async findById(id: string): Promise<Invoice | null> {
    const [result] = await this.db.select().from(invoices).where(eq(invoices.id, id));
    return result ? this.mapToInvoice(result) : null;
  }

  async findByUserId(userId: string): Promise<Invoice[]> {
    const results = await this.db.select().from(invoices)
      .where(eq(invoices.userId, userId))
      .orderBy(desc(invoices.createdAt));

    return results.map(this.mapToInvoice);
  }

  async findByStripeInvoiceId(stripeInvoiceId: string): Promise<Invoice | null> {
    const [result] = await this.db.select().from(invoices)
      .where(eq(invoices.stripeInvoiceId, stripeInvoiceId));
    return result ? this.mapToInvoice(result) : null;
  }

  async update(id: string, input: UpdateInvoiceInput): Promise<Invoice> {
    const updateData: Partial<typeof invoices.$inferInsert> = {};

    if (input.status !== undefined) updateData.status = input.status;
    if (input.stripeInvoiceId !== undefined) updateData.stripeInvoiceId = input.stripeInvoiceId;
    if (input.pdfUrl !== undefined) updateData.pdfUrl = input.pdfUrl;
    if (input.paidAt !== undefined) updateData.paidAt = input.paidAt;

    const [result] = await this.db.update(invoices)
      .set(updateData)
      .where(eq(invoices.id, id))
      .returning();

    if (!result) {
      throw new Error(`Invoice not found: ${id}`);
    }

    return this.mapToInvoice(result);
  }

  private mapToInvoice(row: typeof invoices.$inferSelect): Invoice {
    return {
      id: row.id,
      userId: row.userId,
      subscriptionId: row.subscriptionId ?? undefined,
      stripeInvoiceId: row.stripeInvoiceId ?? undefined,
      amount: row.amount,
      currency: row.currency,
      status: row.status as InvoiceStatus,
      periodStart: row.periodStart ?? undefined,
      periodEnd: row.periodEnd ?? undefined,
      pdfUrl: row.pdfUrl ?? undefined,
      paidAt: row.paidAt ?? undefined,
      createdAt: row.createdAt,
    };
  }
}
