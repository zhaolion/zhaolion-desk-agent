export type InvoiceStatus = "pending" | "paid" | "failed" | "void";

export interface Invoice {
  id: string;
  userId: string;
  subscriptionId?: string;
  stripeInvoiceId?: string;
  amount: string;
  currency: string;
  status: InvoiceStatus;
  periodStart?: Date;
  periodEnd?: Date;
  pdfUrl?: string;
  paidAt?: Date;
  createdAt: Date;
}

export interface CreateInvoiceInput {
  userId: string;
  subscriptionId?: string;
  stripeInvoiceId?: string;
  amount: string;
  currency?: string;
  periodStart?: Date;
  periodEnd?: Date;
}

export interface UpdateInvoiceInput {
  status?: InvoiceStatus;
  stripeInvoiceId?: string;
  pdfUrl?: string;
  paidAt?: Date;
}
