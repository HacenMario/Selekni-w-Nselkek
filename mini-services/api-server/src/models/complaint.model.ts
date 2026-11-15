import { Schema, model, Document } from 'mongoose';

export interface IComplaint extends Document {
  offer?: unknown; // null for contact-page suggestions/reports (v4.6)
  kind: 'complaint' | 'suggestion' | 'report';
  by: unknown; // complainant
  byRole: 'owner' | 'seeker';
  against?: unknown; // the other party (null when there is no counterpart yet)
  subject: string;
  description: string;
  // v4.9 — optional phone number so the administration can call the sender back
  phone?: string;
  status: 'open' | 'resolved';
  resolution?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ComplaintSchema = new Schema<IComplaint>(
  {
    offer: { type: Schema.Types.ObjectId, ref: 'Offer', index: true },
    kind: { type: String, enum: ['complaint', 'suggestion', 'report'], default: 'complaint' },
    by: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    byRole: { type: String, enum: ['owner', 'seeker'], required: true },
    against: { type: Schema.Types.ObjectId, ref: 'User' },
    subject: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 1500 },
    phone: { type: String, trim: true, maxlength: 20 },
    status: { type: String, enum: ['open', 'resolved'], default: 'open', index: true },
    resolution: { type: String, maxlength: 1000 },
  },
  { timestamps: true }
);

ComplaintSchema.index({ status: 1, createdAt: -1 });

export const Complaint = model<IComplaint>('Complaint', ComplaintSchema);
