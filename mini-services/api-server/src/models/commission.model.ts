import { Schema, model, Document } from 'mongoose';

/**
 * v4.14 — commission-based monetization (replaces the subscription system).
 * The platform takes a percentage (settings.commissionPercent, default 15%) of
 * every DONE offer's agreed amount, charged to the EXECUTOR (acceptedBy).
 * Dues are settled once a month: the administration marks a (user, month) pair
 * as paid and this document is the receipt.
 * The ledger itself is NOT stored here — done offers are the single source of
 * truth; this model only records settlements (payments actually received).
 */
export interface IMonthlySettlement extends Document {
  user: unknown;
  /** Settlement month bucket, formatted 'YYYY-MM' (by offer.completedAt). */
  month: string;
  /** Commission amount actually received for that month's tasks (DA). */
  amountDA: number;
  /** Number of completed tasks the payment covers (snapshot for the receipt). */
  tasksCount: number;
  /** Free-form note from the administration (payment reference, method…). */
  note?: string;
  decidedBy: unknown;
  paidAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MonthlySettlementSchema = new Schema<IMonthlySettlement>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    month: { type: String, required: true, match: /^\d{4}-\d{2}$/, index: true },
    amountDA: { type: Number, required: true, min: 0 },
    tasksCount: { type: Number, required: true, min: 0, default: 0 },
    note: { type: String, trim: true, maxlength: 300 },
    decidedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    paidAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

// one settlement receipt per user per month (re-settling replaces it)
MonthlySettlementSchema.index({ user: 1, month: 1 }, { unique: true });

export const MonthlySettlement = model<IMonthlySettlement>('MonthlySettlement', MonthlySettlementSchema);

/** Clamp + default for the configurable commission rate stored in settings. */
export function commissionRate(settings: { commissionPercent?: number } | null | undefined): number {
  const v = Number(settings?.commissionPercent);
  if (!Number.isFinite(v)) return 15;
  return Math.min(50, Math.max(0, Math.round(v)));
}
