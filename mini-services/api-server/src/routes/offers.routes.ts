import { Router } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Offer } from '../models/offer.model';
import { User } from '../models/user.model';
import { auth, AuthRequest } from '../middleware/auth';
import { asyncH } from '../middleware/error';
import { getSettings } from '../services/settings.service';
import { decodeImages, MAX_IMAGES } from '../utils/images';
import { notifyUsers } from '../services/notification.service';
import { Notification } from '../models/notification.model';

const router = Router();

/** Public fields of a user as seen by the counterpart (no email, no avatar buffer). */
export const USER_PUB_FIELDS = 'name phone wilaya gender age avatarIsSet authProvider tasksDone tasksCompleted bloodType idVerified';

const createSchema = z.object({
  title: z.string().min(5).max(120),
  description: z.string().min(10).max(2000),
  categoryKey: z.string().min(1).max(60),
  wilaya: z.string().max(80).default(''),
  address: z.string().min(5).max(300),
  amountDA: z.number().min(0).max(999999999),
  scheduledAt: z.string().datetime().optional().nullable(),
  images: z.array(z.object({ mime: z.string(), dataBase64: z.string() })).max(MAX_IMAGES).optional(),
  videos: z.array(z.object({ gridId: z.string().min(10), mime: z.string() })).max(1).optional(),
});

/** Seeker feed: open offers with filters (category, wilaya, amount range, sort, text search). */
router.get('/feed', auth, asyncH(async (req: AuthRequest, res) => {
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(50, Math.max(1, Number(req.query.limit || 30)));
  const filter: Record<string, unknown> = { status: 'open', owner: { $ne: req.user!._id } };

  const explicitCategory = (req.query.categoryKey as string) || '';
  const scope = (req.query.scope as string) || '';
  if (explicitCategory) {
    filter.categoryKey = explicitCategory;
  } else if (scope !== 'all' && req.user!.interests && req.user!.interests.length > 0) {
    filter.categoryKey = { $in: req.user!.interests };
  }
  const wilaya = (req.query.wilaya as string) || '';
  if (wilaya) filter.wilaya = wilaya;

  const minAmount = Number(req.query.minAmount || 0);
  const maxAmount = Number(req.query.maxAmount || 0);
  if (minAmount > 0 || maxAmount > 0) {
    filter.amountDA = {
      ...(minAmount > 0 ? { $gte: minAmount } : {}),
      ...(maxAmount > 0 ? { $lte: maxAmount } : {}),
    };
  }
  const q = ((req.query.q as string) || '').trim();
  if (q) filter.$or = [{ title: { $regex: q, $options: 'i' } }, { description: { $regex: q, $options: 'i' } }];

  const sort = (req.query.sort as string) || 'new';
  const sortSpec: Record<string, 1 | -1> = sort === 'amount_asc' ? { amountDA: 1, createdAt: -1 }
    : sort === 'amount_desc' ? { amountDA: -1, createdAt: -1 }
    : { createdAt: -1 };

  const total = await Offer.countDocuments(filter);
  const items = await Offer.find(filter)
    .select('-address')
    .sort(sortSpec)
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('owner', USER_PUB_FIELDS)
    .lean({ virtuals: false });
  res.json({ items: items.map(sanitizeLean), total, page, pages: Math.ceil(total / limit) || 1 });
}));

/** Newest still-open offer for the live popup (client keeps its own dismissed list). */
router.get('/live', auth, asyncH(async (req: AuthRequest, res) => {
  const offer = await Offer.findOne({ status: 'open', owner: { $ne: req.user!._id } })
    .select('-address')
    .sort({ createdAt: -1 })
    .populate('owner', USER_PUB_FIELDS)
    .lean({ virtuals: false });
  res.json({ offer: offer ? sanitizeLean(offer) : null, now: new Date().toISOString() });
}));

function sanitizeLean(doc: any) {
  if (!doc) return doc;
  if (Array.isArray(doc.images)) doc.images = doc.images.map((i: any) => ({ _id: i._id, mime: i.mime, size: i.size }));
  return doc;
}

/** Seeker: offers assigned to me (accepted tasks). */
router.get('/accepted', auth, asyncH(async (req: AuthRequest, res) => {
  const items = await Offer.find({ acceptedBy: req.user!._id, status: { $in: ['assigned', 'awaiting_confirmation', 'done'] } })
    .sort({ acceptedAt: -1 })
    .populate('owner', USER_PUB_FIELDS);
  res.json({ items });
}));

/** Owner: my offers. */
router.get('/mine', auth, asyncH(async (req: AuthRequest, res) => {
  const items = await Offer.find({ owner: req.user!._id }).sort({ createdAt: -1 }).populate('acceptedBy', USER_PUB_FIELDS);
  res.json({ items });
}));

/** Verify the uploaded video (GridFS) belongs to this uploader and exists. */
async function validateVideos(ownerId: string, videos: { gridId: string; mime: string }[] | undefined) {
  if (!videos || videos.length === 0) return { docs: [] as any[], error: undefined as string | undefined };
  const db = mongoose.connection.db;
  if (!db) return { docs: [], error: 'Database not ready' };
  const b = new mongoose.mongo.GridFSBucket(db, { bucketName: 'videos' });
  const docs: any[] = [];
  for (const v of videos) {
    let gridId: mongoose.mongo.ObjectId;
    try { gridId = new mongoose.mongo.ObjectId(v.gridId); } catch { return { docs: [], error: 'Invalid video reference' }; }
    const found = await b.find({ _id: gridId, 'metadata.userId': ownerId }).limit(1).toArray();
    if (found.length === 0) return { docs: [], error: 'Video not found for this account' };
    docs.push({ gridId, mime: v.mime.startsWith('video/') ? v.mime : 'video/mp4', size: found[0].length });
  }
  return { docs, error: undefined };
}

/** Owner: create offer — v4.14 commission model: NO subscription required;
 *  a platform-wide cap on concurrently active offers stays as anti-spam. */
router.post('/', auth, asyncH(async (req: AuthRequest, res) => {
  if (req.user!.role !== 'owner') { res.status(403).json({ error: 'Switch to owner role to post offers', code: 'ROLE_OWNER_REQUIRED' }); return; }
  const body = createSchema.parse(req.body);
  const settings = await getSettings();

  const activeOffers = await Offer.countDocuments({ owner: req.user!._id, status: { $in: ['open', 'assigned', 'awaiting_confirmation'] } });
  const maxOffers = Math.max(1, settings.subscription.maxActiveOffers || 3);
  if (activeOffers >= maxOffers) {
    res.status(403).json({ error: `Maximum ${maxOffers} active offers reached`, code: 'MAX_OFFERS_REACHED' });
    return;
  }

  const categoryExists = settings.categories.some((c) => c.key === body.categoryKey);
  if (!categoryExists) { res.status(400).json({ error: 'Unknown category', code: 'BAD_CATEGORY' }); return; }

  const { images, error } = decodeImages(body.images);
  if (error) { res.status(400).json({ error, code: 'BAD_IMAGE' }); return; }

  const { docs: videos, error: vErr } = await validateVideos(String(req.user!._id), body.videos);
  if (vErr) { res.status(400).json({ error: vErr, code: 'BAD_VIDEO' }); return; }

  const offer = await Offer.create({
    owner: req.user!._id,
    title: body.title,
    description: body.description,
    categoryKey: body.categoryKey,
    wilaya: body.wilaya,
    address: body.address,
    amountDA: body.amountDA,
    scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
    images,
    videos,
    status: 'open',
  });

  // fire-and-forget: notify interested seekers
  const interested = await Offer.db!.model('User').find({ role: 'seeker', isBanned: false, _id: { $ne: req.user!._id }, interests: body.categoryKey }).limit(500).select('_id');
  notifyUsers(interested.map((u: any) => u._id), 'new_offer_match', {
    offerId: String(offer._id),
    offerTitle: offer.title,
    amountDA: offer.amountDA,
    categoryKey: offer.categoryKey,
    actorName: req.user!.name,
  }).catch(() => {});

  const json = (await Offer.findById(offer._id).populate('owner', USER_PUB_FIELDS))!;
  res.status(201).json(json);
}));

/** Offer detail — address + owner contact visible to owner / accepted worker. */
router.get('/:id', auth, asyncH(async (req: AuthRequest, res) => {
  const offer = await Offer.findById(req.params.id).populate('owner', USER_PUB_FIELDS).populate('acceptedBy', USER_PUB_FIELDS);
  if (!offer) { res.status(404).json({ error: 'Offer not found', code: 'NOT_FOUND' }); return; }
  const ownerDoc = offer.owner as any;
  const workerDoc = offer.acceptedBy as any;
  const isOwner = String(ownerDoc?._id || offer.owner) === String(req.user!._id);
  const isWorker = offer.acceptedBy && String(workerDoc?._id || offer.acceptedBy) === String(req.user!._id);
  const json = offer.toJSON() as any;
  // owner contact is shown in the details (photo/gender/age/phone card);
  // the precise address stays private until someone accepts
  json.ownerPhone = ownerDoc?.phone || '';
  // super admin has full visibility for moderation (address included)
  if (!isOwner && !isWorker && !req.user!.isSuperAdmin) {
    delete json.address;
  }
  json.viewerIsOwner = isOwner;
  // the super admin gets the same detail sheet as the owner: worker card visible,
  // but never "accept" actions (viewerIsWorker also hides them)
  json.viewerIsWorker = Boolean(isWorker) || Boolean(req.user!.isSuperAdmin);
  res.json(json);
}));

/** Atomic accept — first seeker wins. */
router.post('/:id/accept', auth, asyncH(async (req: AuthRequest, res) => {
  const offer = await Offer.findOneAndUpdate(
    { _id: req.params.id, status: 'open', owner: { $ne: req.user!._id } },
    { $set: { status: 'assigned', acceptedBy: req.user!._id, acceptedAt: new Date() } },
    { new: true }
  ).populate('owner', USER_PUB_FIELDS);
  if (!offer) { res.status(409).json({ error: 'Offer no longer available', code: 'ALREADY_TAKEN' }); return; }
  const owner = offer.owner as any;
  // v4.8 — the offer is taken: its "new offer" broadcast disappears for everyone
  // except the client (owner) and the worker who accepted it
  await Notification.deleteMany({
    type: 'new_offer_match',
    'data.offerId': String(offer._id),
    user: { $nin: [offer.acceptedBy, owner?._id ?? offer.owner] },
  });
  notifyUsers([owner?._id], 'offer_accepted', {
    offerId: String(offer._id),
    offerTitle: offer.title,
    amountDA: offer.amountDA,
    actorName: req.user!.name,
  }).catch(() => {});
  const json = offer.toJSON() as any;
  json.ownerPhone = owner?.phone || '';
  res.json(json);
}));

/** Worker: request completion. */
router.post('/:id/complete', auth, asyncH(async (req: AuthRequest, res) => {
  const offer = await Offer.findOne({ _id: req.params.id, status: 'assigned' });
  if (!offer) { res.status(404).json({ error: 'Offer not in assigned state', code: 'NOT_FOUND' }); return; }
  if (String(offer.acceptedBy) !== String(req.user!._id)) { res.status(403).json({ error: 'Only the assigned worker can complete', code: 'NOT_WORKER' }); return; }
  offer.status = 'awaiting_confirmation';
  await offer.save();
  notifyUsers([offer.owner], 'offer_awaiting', { offerId: String(offer._id), offerTitle: offer.title, actorName: req.user!.name }).catch(() => {});
  res.json(offer);
}));

/** Owner: confirm done. */
router.post('/:id/confirm', auth, asyncH(async (req: AuthRequest, res) => {
  const offer = await Offer.findOne({ _id: req.params.id, status: 'awaiting_confirmation' });
  if (!offer) { res.status(404).json({ error: 'Offer not awaiting confirmation', code: 'NOT_FOUND' }); return; }
  if (String(offer.owner) !== String(req.user!._id)) { res.status(403).json({ error: 'Only the owner can confirm', code: 'NOT_OWNER' }); return; }
  offer.status = 'done';
  offer.completedAt = new Date();
  await offer.save();
  // gamification counters: executor's completed tasks + owner's completed tasks
  if (offer.acceptedBy) await User.findByIdAndUpdate(offer.acceptedBy, { $inc: { tasksDone: 1 } });
  await User.findByIdAndUpdate(offer.owner, { $inc: { tasksCompleted: 1 } });
  notifyUsers([offer.acceptedBy], 'offer_done', { offerId: String(offer._id), offerTitle: offer.title, amountDA: offer.amountDA, actorName: req.user!.name }).catch(() => {});
  res.json(offer);
}));

/** Owner cancel. */
router.post('/:id/cancel', auth, asyncH(async (req: AuthRequest, res) => {
  const { reason } = z.object({ reason: z.string().max(300).default('') }).parse(req.body || {});
  const offer = await Offer.findOne({ _id: req.params.id });
  if (!offer) { res.status(404).json({ error: 'Offer not found', code: 'NOT_FOUND' }); return; }
  if (String(offer.owner) !== String(req.user!._id)) { res.status(403).json({ error: 'Only the owner can cancel', code: 'NOT_OWNER' }); return; }
  if (!['open', 'assigned', 'awaiting_confirmation'].includes(offer.status)) {
    res.status(400).json({ error: 'Offer cannot be cancelled in current state', code: 'BAD_STATE' });
    return;
  }
  offer.status = 'cancelled';
  offer.cancelledBy = 'owner';
  offer.cancelReason = reason;
  await offer.save();
  if (offer.acceptedBy) {
    notifyUsers([offer.acceptedBy], 'offer_cancelled', { offerId: String(offer._id), offerTitle: offer.title, actorName: req.user!.name, reason }).catch(() => {});
  }
  res.json(offer);
}));

export default router;
