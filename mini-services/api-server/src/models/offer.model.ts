import { Schema, model, Document } from 'mongoose';

export interface IOfferVideo {
  _id: unknown;
  gridId: unknown; // GridFS file id
  mime: string;
  size: number;
}

export interface IOfferImage {
  _id: unknown;
  mime: string;
  size: number;
  data: Buffer;
}

export interface IOffer extends Document {
  owner: unknown;
  title: string;
  description: string;
  categoryKey: string;
  wilaya: string;
  address: string;
  amountDA: number;
  scheduledAt?: Date;
  images: IOfferImage[];
  videos: IOfferVideo[];
  status: 'open' | 'assigned' | 'awaiting_confirmation' | 'done' | 'cancelled';
  acceptedBy?: unknown;
  acceptedAt?: Date;
  completedAt?: Date;
  cancelledBy?: 'owner' | 'worker' | 'admin';
  cancelReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ImageSchema = new Schema<IOfferImage>(
  {
    mime: { type: String, required: true },
    size: { type: Number, required: true },
    data: { type: Buffer, required: true, select: 0 },
  },
  { _id: true }
);

const VideoSchema = new Schema<IOfferVideo>(
  {
    // the binary lives in GridFS (chunked), only metadata is kept on the offer
    gridId: { type: Schema.Types.ObjectId, required: true },
    mime: { type: String, required: true },
    size: { type: Number, required: true },
  },
  { _id: true }
);

const OfferSchema = new Schema<IOffer>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    categoryKey: { type: String, required: true, index: true },
    wilaya: { type: String, default: '' },
    address: { type: String, required: true, trim: true, maxlength: 300 },
    amountDA: { type: Number, required: true, min: 0 },
    scheduledAt: { type: Date },
    images: { type: [ImageSchema], default: [] },
    videos: { type: [VideoSchema], default: [] },
    status: { type: String, enum: ['open', 'assigned', 'awaiting_confirmation', 'done', 'cancelled'], default: 'open', index: true },
    acceptedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    acceptedAt: { type: Date },
    completedAt: { type: Date },
    cancelledBy: { type: String, enum: ['owner', 'worker', 'admin'] },
    cancelReason: { type: String, maxlength: 300 },
  },
  { timestamps: true, toJSON: { transform: (_doc, retAny) => { const ret = retAny as any; if (Array.isArray(ret.images)) ret.images = ret.images.map((i: IOfferImage) => ({ _id: i._id, mime: i.mime, size: i.size })); return ret; } } }
);

OfferSchema.index({ status: 1, createdAt: -1 });
OfferSchema.index({ categoryKey: 1, status: 1 });

export const Offer = model<IOffer>('Offer', OfferSchema);
