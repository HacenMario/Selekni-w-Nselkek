import { Schema, model, Document } from 'mongoose';

/**
 * v4.15 — payment-proof submitted by a task executor for their monthly dues.
 * The executor uploads a photo of the payment receipt (CCP/BaridiMob transfer…)
 * → the administration reviews it → approving it records the MonthlySettlement
 * receipt automatically and confirms the dues as paid.
 * The image is wiped from the database as soon as a decision is made (privacy,
 * same policy as the ID-card review).
 */
export type ProofStatus = 'pending' | 'approved' | 'rejected';

export interface IDuesPaymentProof extends Document {
  user: unknown;
  /** Dues month bucket the payment covers, 'YYYY-MM'. */
  month: string;
  image: Buffer;
  imageMime: string;
  /** Free-form note from the executor (payment reference, method…). */
  note?: string;
  status: ProofStatus;
  /** The administration's own words on approve/reject. */
  reviewNote?: string;
  decidedBy?: unknown;
  decidedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DuesPaymentProofSchema = new Schema<IDuesPaymentProof>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    month: { type: String, required: true, match: /^\d{4}-\d{2}$/, index: true },
    // NOT required: the buffer is emptied (v4.15) as soon as the administration decides,
    // so reviewed proofs keep only their metadata
    image: { type: Buffer, select: 0 },
    imageMime: { type: String },
    note: { type: String, trim: true, maxlength: 300 },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    reviewNote: { type: String, trim: true, maxlength: 300 },
    decidedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    decidedAt: { type: Date },
  },
  { timestamps: true }
);

// one live proof per (user, month) — re-submitting replaces the old one
DuesPaymentProofSchema.index({ user: 1, month: 1 }, { unique: true });

export const DuesPaymentProof = model<IDuesPaymentProof>('DuesPaymentProof', DuesPaymentProofSchema);
