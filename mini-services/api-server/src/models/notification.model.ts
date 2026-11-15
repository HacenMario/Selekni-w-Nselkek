import { Schema, model, Document } from 'mongoose';

export interface INotification extends Document {
  user: unknown;
  type:
    | 'new_offer_match'
    | 'offer_accepted'
    | 'offer_awaiting'
    | 'offer_done'
    | 'offer_cancelled'
    // v4.14 — commission model: legacy subscription_* types retired,
    // dues notifications replace them
    | 'dues_reminder'
    | 'dues_paid'
    | 'id_pending'
    | 'complaint_new'
    | 'complaint_resolved'
    | 'broadcast'
    | 'system';
  data: Record<string, unknown>;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, required: true },
    data: { type: Schema.Types.Mixed, default: {} },
    readAt: { type: Date },
  },
  { timestamps: true }
);

NotificationSchema.index({ user: 1, createdAt: -1 });
NotificationSchema.index({ user: 1, readAt: 1 });

export const Notification = model<INotification>('Notification', NotificationSchema);
