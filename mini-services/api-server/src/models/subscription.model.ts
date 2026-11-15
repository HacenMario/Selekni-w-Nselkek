import { Schema, model, Document } from 'mongoose';

export interface ISubscription extends Document {
  user: unknown;
  status: 'pending' | 'active' | 'rejected' | 'expired';
  packageKey?: string;
  packageName?: { ar: string; fr: string; en: string };
  amountDA: number;
  durationDays?: number;
  maxActiveOffers?: number;
  reference: string;
  proofImage?: { _id: unknown; mime: string; size: number; data: Buffer };
  startsAt?: Date;
  endsAt?: Date;
  decidedBy?: unknown;
  decidedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ProofImageSchema = new Schema(
  {
    mime: { type: String, required: true },
    size: { type: Number, required: true },
    data: { type: Buffer, required: true, select: 0 },
  },
  { _id: true }
);

const SubscriptionSchema = new Schema<ISubscription>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: { type: String, enum: ['pending', 'active', 'rejected', 'expired'], default: 'pending', index: true },
    packageKey: { type: String },
    packageName: {
      type: { ar: { type: String }, fr: { type: String }, en: { type: String } },
      default: undefined,
    },
    amountDA: { type: Number, required: true },
    durationDays: { type: Number },
    maxActiveOffers: { type: Number },
    reference: { type: String, required: true, trim: true, maxlength: 100 },
    proofImage: { type: ProofImageSchema },
    startsAt: { type: Date },
    endsAt: { type: Date },
    decidedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    decidedAt: { type: Date },
  },
  { timestamps: true, toJSON: { transform: (_doc, retAny) => { const ret = retAny as any; if (ret.proofImage) ret.proofImage = { _id: ret.proofImage._id, mime: ret.proofImage.mime, size: ret.proofImage.size }; return ret; } } }
);

export const Subscription = model<ISubscription>('Subscription', SubscriptionSchema);
