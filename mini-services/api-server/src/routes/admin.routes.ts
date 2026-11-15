import { Router } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { User } from '../models/user.model';
import { Offer } from '../models/offer.model';
import { Subscription } from '../models/subscription.model';
import { Complaint } from '../models/complaint.model';
import { Settings, DEFAULT_CATEGORIES } from '../models/settings.model';
import { Notification } from '../models/notification.model';
import { auth, adminOnly, AuthRequest } from '../middleware/auth';
import { asyncH } from '../middleware/error';
import { notifyUsers } from '../services/notification.service';
import { decodeImages } from '../utils/images';

const router = Router();
router.use(auth, adminOnly);

/** Notify a user with a direct system message — trilingual data; the app renders the recipient's language. */
function adminNotify(userId: unknown, ar: string, fr: string, en: string, extra: Record<string, unknown> = {}) {
  notifyUsers([userId], 'system', { titleAr: ar, titleFr: fr, titleEn: en, ...extra }).catch(() => {});
}

/* ---- Dashboard ---- */
router.get('/dashboard', asyncH(async (_req: AuthRequest, res) => {
  const [usersTotal, owners, seekers, idPendingUsers, verifiedUsers, bannedUsers, offersOpen, offersAssigned, offersAwaiting, offersDone, offersCancelled, subsPending, subsActive, complaintsOpen, recentUsers, expiringSubDocs] = await Promise.all([
    User.countDocuments({ isSuperAdmin: { $ne: true } }),
    User.countDocuments({ role: 'owner', isSuperAdmin: { $ne: true } }),
    User.countDocuments({ role: 'seeker', isSuperAdmin: { $ne: true } }),
    // accounts awaiting ID-card verification (drives the users-tab badge)
    User.countDocuments({ role: 'seeker', idVerified: 'pending' }),
    // v4.6 — verified accounts & banned accounts for the overview KPI cards
    User.countDocuments({ idVerified: 'verified', isSuperAdmin: { $ne: true } }),
    User.countDocuments({ isBanned: true, isSuperAdmin: { $ne: true } }),
    Offer.countDocuments({ status: 'open' }),
    Offer.countDocuments({ status: 'assigned' }),
    Offer.countDocuments({ status: 'awaiting_confirmation' }),
    Offer.countDocuments({ status: 'done' }),
    Offer.countDocuments({ status: 'cancelled' }),
    Subscription.countDocuments({ status: 'pending' }),
    Subscription.countDocuments({ status: 'active', endsAt: { $gt: new Date() } }),
    Complaint.countDocuments({ status: 'open' }),
    User.find({ isSuperAdmin: { $ne: true } }).sort({ createdAt: -1 }).limit(10).select('name email phone role wilaya isBanned createdAt'),
    // subscriptions that need renewal soon (<= 7 days left) so the admin can contact owners
    Subscription.find({ status: 'active', endsAt: { $gt: new Date(), $lt: new Date(Date.now() + 7 * 24 * 3600 * 1000) } })
      .populate('user', 'name email phone role')
      .sort({ endsAt: 1 })
      .limit(20),
  ]);
  const expiringSubs = (expiringSubDocs as any[]).map((s) => ({
    _id: String(s._id),
    user: s.user,
    endsAt: s.endsAt,
    packageKey: s.packageKey,
    amountDA: s.amountDA,
    daysLeft: Math.max(0, Math.ceil((new Date(s.endsAt).getTime() - Date.now()) / 86400000)),
  }));
  res.json({
    users: { total: usersTotal, owners, seekers, idPending: idPendingUsers, verified: verifiedUsers, banned: bannedUsers },
    offers: { open: offersOpen, assigned: offersAssigned, awaiting: offersAwaiting, done: offersDone, cancelled: offersCancelled },
    subscriptions: { pending: subsPending, active: subsActive },
    complaintsOpen,
    expiringSubs,
    recentUsers,
  });
}));

/* ---- Users ---- */
router.get('/users', asyncH(async (req: AuthRequest, res) => {
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(50, Math.max(1, Number(req.query.limit || 20)));
  const q = ((req.query.q as string) || '').trim();
  const filter: Record<string, unknown> = { isSuperAdmin: { $ne: true } };
  if (q) filter.$or = [{ name: { $regex: q, $options: 'i' } }, { email: { $regex: q, $options: 'i' } }, { phone: { $regex: q, $options: 'i' } }];
  // smart filters: role / verification status / banned
  const f = String(req.query.f || '');
  if (f === 'owner') filter.role = 'owner';
  else if (f === 'seeker') filter.role = 'seeker';
  else if (f === 'idpending') { filter.role = 'seeker'; filter.idVerified = 'pending'; }
  else if (f === 'idverified') { filter.role = 'seeker'; filter.idVerified = 'verified'; }
  else if (f === 'idrejected') { filter.role = 'seeker'; filter.idVerified = 'rejected'; }
  else if (f === 'banned') filter.isBanned = true;
  const total = await User.countDocuments(filter);
  const items = await User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit);
  res.json({ items, total, page, pages: Math.ceil(total / limit) || 1 });
}));

router.post('/users/:id/ban', asyncH(async (req: AuthRequest, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { $set: { isBanned: true } }, { new: true });
  if (!user) { res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' }); return; }
  res.json(user);
}));

router.post('/users/:id/unban', asyncH(async (req: AuthRequest, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { $set: { isBanned: false } }, { new: true });
  if (!user) { res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' }); return; }
  res.json(user);
}));

/** Edit any account field. */
router.patch('/users/:id', asyncH(async (req: AuthRequest, res) => {
  const body = z.object({
    name: z.string().min(2).max(80).optional(),
    email: z.string().email().optional(),
    phone: z.string().max(20).optional(),
    wilaya: z.string().max(80).optional(),
    gender: z.enum(['male', 'female', '']).optional(),
    age: z.number().int().min(0).max(120).optional(),
    role: z.enum(['owner', 'seeker']).optional(),
    isBanned: z.boolean().optional(),
  }).parse(req.body);
  if (body.email) body.email = body.email.toLowerCase().trim();
  const user = await User.findByIdAndUpdate(req.params.id, { $set: body }, { new: true, runValidators: true });
  if (!user) { res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' }); return; }
  res.json(user);
}));

/** Delete an account and everything attached to it. */
router.delete('/users/:id', asyncH(async (req: AuthRequest, res) => {
  const target = await User.findById(req.params.id);
  if (!target) { res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' }); return; }
  if (target.isSuperAdmin) { res.status(403).json({ error: 'The super admin account cannot be deleted', code: 'FORBIDDEN' }); return; }
  // v4.10 — purge the GridFS video blobs of the deleted user's offers (free-tier protection)
  const gdb = mongoose.connection.db;
  if (gdb) {
    const gb = new mongoose.mongo.GridFSBucket(gdb, { bucketName: 'videos' });
    const own = await Offer.find({ owner: target._id }).select('videos.gridId').limit(2000);
    const ids = own.flatMap((o) => ((o.videos || []) as any[]).map((v) => v.gridId));
    if (ids.length > 0) await Promise.all(ids.map((id) => gb.delete(id).catch(() => {})));
  }
  await Promise.all([
    Offer.deleteMany({ owner: target._id }),
    Offer.updateMany({ acceptedBy: target._id }, { $set: { status: 'open', acceptedBy: undefined, acceptedAt: undefined } }),
    Subscription.deleteMany({ user: target._id }),
    Notification.deleteMany({ user: target._id }),
    Complaint.deleteMany({ $or: [{ by: target._id }, { against: target._id }] }),
    (await import('../models/pushsubscription.model')).PushSubscription.deleteMany({ user: target._id }),
  ]);
  await target.deleteOne();
  res.json({ ok: true });
}));

/* ---- ID-card verification (seeker accounts) ---- */
/** Approve: wipe the card image immediately (privacy) and mark the account verified. */
router.post('/users/:id/verify-id', asyncH(async (req: AuthRequest, res) => {
  const user = await User.findById(req.params.id);
  if (!user) { res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' }); return; }
  if (!user.idCardMime) { res.status(400).json({ error: 'No ID card submitted', code: 'NO_ID_CARD' }); return; }
  await User.findByIdAndUpdate(user._id, {
    $set: { idVerified: 'verified', idRejectReason: '' },
    $unset: { idCard: 1, idCardMime: 1 }, // the photo leaves the database the moment a decision is made
  });
  adminNotify(user._id, 'تم تأكيد حسابك بنجاح ✓', 'Votre compte a été vérifié avec succès ✓', 'Your account has been verified successfully ✓');
  res.json({ ok: true, idVerified: 'verified' });
}));

/** Reject: wipe the card image too — the user can re-upload a clearer photo from their profile. */
router.post('/users/:id/reject-id', asyncH(async (req: AuthRequest, res) => {
  const { reason } = z.object({ reason: z.string().max(300).default('') }).parse(req.body || {});
  const user = await User.findById(req.params.id);
  if (!user) { res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' }); return; }
  if (!user.idCardMime) { res.status(400).json({ error: 'No ID card submitted', code: 'NO_ID_CARD' }); return; }
  await User.findByIdAndUpdate(user._id, {
    $set: { idVerified: 'rejected', idRejectReason: reason },
    $unset: { idCard: 1, idCardMime: 1 },
  });
  // the reason is the admin's own words — sent raw; the localized verdict wraps it in the app
  adminNotify(
    user._id,
    'تعذر تأكيد حسابك — راجع سبب الرفض',
    'Vérification refusée — voir le motif',
    'Verification refused — see the reason',
    { body: reason || '' }
  );
  res.json({ ok: true, idVerified: 'rejected' });
}));

/** Send a notification to one specific user (or everyone when userId omitted). */
router.post('/notify', asyncH(async (req: AuthRequest, res) => {
  // trilingual message — the app renders each reader's chosen language
  const { userId, titleAr, titleFr, titleEn, bodyAr, bodyFr, bodyEn } = z.object({
    userId: z.string().min(10).optional(),
    titleAr: z.string().min(1).max(120),
    titleFr: z.string().min(1).max(120),
    titleEn: z.string().min(1).max(120),
    bodyAr: z.string().min(1).max(1000),
    bodyFr: z.string().min(1).max(1000),
    bodyEn: z.string().min(1).max(1000),
  }).parse(req.body);
  const data = { titleAr, titleFr, titleEn, bodyAr, bodyFr, bodyEn, actorName: 'Slekni' };
  if (userId) {
    const target = await User.findById(userId);
    if (!target) { res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' }); return; }
    await notifyUsers([target._id], 'system', data);
    res.json({ ok: true, notified: 1 });
    return;
  }
  const users = await User.find({ isBanned: false, isSuperAdmin: { $ne: true } }).select('_id');
  await notifyUsers(users.map((u) => u._id), 'broadcast', data);
  res.json({ ok: true, notified: users.length });
}));

/* ---- Offers moderation ---- */
/** v4.8 — remove an offer entirely: the document + every notification pointing to it. */
router.delete('/offers/:id', asyncH(async (req: AuthRequest, res) => {
  // .select('+videos') — the schema hides video metadata by default (select: 0)
  const offer = await Offer.findByIdAndDelete(req.params.id).select('+videos');
  if (!offer) { res.status(404).json({ error: 'Offer not found', code: 'NOT_FOUND' }); return; }
  // v4.10 — purge the offer's GridFS video blobs so the free Mongo tier never leaks
  const db = mongoose.connection.db;
  if (db && offer.videos?.length) {
    const b = new mongoose.mongo.GridFSBucket(db, { bucketName: 'videos' });
    await Promise.all(offer.videos.map((v: any) => b.delete(v.gridId).catch(() => {})));
  }
  await Notification.deleteMany({ 'data.offerId': req.params.id });
  res.json({ ok: true });
}));

router.get('/offers', asyncH(async (req: AuthRequest, res) => {
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(50, Math.max(1, Number(req.query.limit || 20)));
  const status = (req.query.status as string) || '';
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  const total = await Offer.countDocuments(filter);
  const items = await Offer.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('owner', 'name email').populate('acceptedBy', 'name');
  res.json({ items, total, page, pages: Math.ceil(total / limit) || 1 });
}));

router.post('/offers/:id/cancel', asyncH(async (req: AuthRequest, res) => {
  const { reason } = z.object({ reason: z.string().max(300).default('') }).parse(req.body || {});
  const offer = await Offer.findOne({ _id: req.params.id });
  if (!offer) { res.status(404).json({ error: 'Offer not found', code: 'NOT_FOUND' }); return; }
  if (!['open', 'assigned', 'awaiting_confirmation'].includes(offer.status)) {
    res.status(400).json({ error: 'Offer cannot be cancelled in current state', code: 'BAD_STATE' });
    return;
  }
  offer.status = 'cancelled';
  offer.cancelledBy = 'admin';
  offer.cancelReason = reason || 'Cancelled by administration';
  await offer.save();
  const targets = [offer.owner, offer.acceptedBy].filter(Boolean);
  await notifyUsers(targets, 'offer_cancelled', { offerId: String(offer._id), offerTitle: offer.title, reason: offer.cancelReason });
  res.json(offer);
}));

/* ---- Complaints ---- */
router.get('/complaints', asyncH(async (req: AuthRequest, res) => {
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(50, Math.max(1, Number(req.query.limit || 20)));
  const status = (req.query.status as string) || '';
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  const total = await Complaint.countDocuments(filter);
  const items = await Complaint.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('offer', 'title status')
    .populate('by', 'name email phone role')
    .populate('against', 'name email phone role');
  res.json({ items, total, page, pages: Math.ceil(total / limit) || 1 });
}));

router.post('/complaints/:id/resolve', asyncH(async (req: AuthRequest, res) => {
  const { resolution } = z.object({ resolution: z.string().max(1000).default('') }).parse(req.body || {});
  const complaint = await Complaint.findById(req.params.id);
  if (!complaint) { res.status(404).json({ error: 'Complaint not found', code: 'NOT_FOUND' }); return; }
  if (complaint.status !== 'open') { res.status(400).json({ error: 'Complaint already resolved', code: 'BAD_STATE' }); return; }
  complaint.status = 'resolved';
  complaint.resolution = resolution || 'Reviewed by administration';
  await complaint.save();
  // inform the complainant that justice was served
  notifyUsers([complaint.by], 'complaint_resolved', {
    complaintId: String(complaint._id),
    offerId: complaint.offer ? String(complaint.offer) : null,
    subject: complaint.subject,
    resolution: complaint.resolution,
  }).catch(() => {});
  const populated = await Complaint.findById(complaint._id)
    .populate('offer', 'title status')
    .populate('by', 'name email phone role')
    .populate('against', 'name email phone role');
  res.json(populated);
}));

/* ---- Subscriptions ---- */
router.get('/subscriptions', asyncH(async (req: AuthRequest, res) => {
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(50, Math.max(1, Number(req.query.limit || 20)));
  const status = (req.query.status as string) || '';
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  const total = await Subscription.countDocuments(filter);
  const items = await Subscription.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('user', 'name email phone role subLocked isSuperAdmin');
  res.json({ items, total, page, pages: Math.ceil(total / limit) || 1 });
}));

/** All subscriptions of one account (details modal in the admin panel). */
router.get('/users/:id/subscriptions', asyncH(async (req: AuthRequest, res) => {
  const target = await User.findById(req.params.id);
  if (!target) { res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' }); return; }
  await Subscription.updateMany({ user: target._id, status: 'active', endsAt: { $lt: new Date() } }, { $set: { status: 'expired' } });
  const items = await Subscription.find({ user: target._id }).sort({ createdAt: -1 }).limit(30);
  res.json({ items, subLocked: Boolean(target.subLocked) });
}));

/** Disable / re-enable the subscription of a specific account. */
router.post('/users/:id/sub-lock', asyncH(async (req: AuthRequest, res) => {
  const { locked } = z.object({ locked: z.boolean() }).parse(req.body);
  const user = await User.findById(req.params.id);
  if (!user) { res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' }); return; }
  if (user.isSuperAdmin) { res.status(403).json({ error: 'Cannot change the super admin subscription', code: 'FORBIDDEN' }); return; }
  user.subLocked = locked;
  await user.save();
  if (locked) {
    // disabling a subscription kills all of their active ones immediately
    await Subscription.updateMany({ user: user._id, status: 'active' }, { $set: { status: 'expired', decidedBy: req.user!._id, decidedAt: new Date() } });
  }
  adminNotify(
    user._id,
    locked ? 'تم تعطيل اشتراكك بواسطة الإدارة' : 'تم إعادة تفعيل اشتراكك بواسطة الإدارة',
    locked ? 'Votre abonnement a été désactivé par l administration' : 'Votre abonnement a été réactivé par l administration',
    locked ? 'Your subscription was disabled by the administration' : 'Your subscription was re-enabled by the administration'
  );
  // v4.6 — re-enabling an account revives its latest expired subscription so the
  // user sees an ACTIVE subscription right away (fresh window from now)
  if (!locked) {
    const latestExpired = await Subscription.findOne({ user: user._id, status: 'expired' }).sort({ createdAt: -1 });
    if (latestExpired) {
      latestExpired.status = 'active';
      latestExpired.startsAt = new Date();
      latestExpired.endsAt = new Date(Date.now() + (latestExpired.durationDays || 30) * 24 * 3600 * 1000);
      latestExpired.decidedBy = req.user!._id;
      latestExpired.decidedAt = new Date();
      await latestExpired.save();
    }
  }
  res.json({ ok: true, subLocked: locked });
}));

/** Grant a manual (free) subscription to an account — a super-admin power. */
router.post('/users/:id/grant-sub', asyncH(async (req: AuthRequest, res) => {
  const body = z.object({
    days: z.number().int().min(1).max(3650),
    packageKey: z.string().max(60).optional(),
    maxActiveOffers: z.number().int().min(1).max(100).optional(),
  }).parse(req.body);
  const user = await User.findById(req.params.id);
  if (!user) { res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' }); return; }

  let pkgName: { ar: string; fr: string; en: string } | undefined;
  let maxOffers = body.maxActiveOffers;
  const settings = await Settings.findOne({ key: 'main' });
  if (body.packageKey && settings) {
    const pkg = settings.packages.find((p) => p.key === body.packageKey);
    if (pkg) { pkgName = pkg.name; maxOffers = maxOffers ?? pkg.maxActiveOffers; }
  }

  await Subscription.updateMany({ user: user._id, status: 'active' }, { $set: { status: 'expired' } });
  const sub = await Subscription.create({
    user: user._id,
    status: 'active',
    packageKey: body.packageKey,
    packageName: pkgName,
    amountDA: 0,
    durationDays: body.days,
    maxActiveOffers: maxOffers,
    reference: `GRANT-${Date.now().toString(36).toUpperCase()}`,
    startsAt: new Date(),
    endsAt: new Date(Date.now() + body.days * 24 * 3600 * 1000),
    decidedBy: req.user!._id,
    decidedAt: new Date(),
  });
  // v4.7 — the granted subscription lifts the "disabled" state instantly
  await User.updateOne({ _id: user._id }, { $set: { subLocked: false } });
  adminNotify(
    user._id,
    `تم منحك اشتراكاً مجانياً لمدة ${body.days} يوم`,
    `Un abonnement gratuit de ${body.days} jours vous a été accordé`,
    `You were granted a free subscription for ${body.days} days`
  );
  res.status(201).json(sub);
}));

/** Activate a PAID subscription on a user account directly — the amount counts as revenue (v4.5).
 *  Unlike grant-sub (free gift), this records a real payment confirmed by the administration. */
router.post('/users/:id/activate-sub', asyncH(async (req: AuthRequest, res) => {
  const body = z.object({
    days: z.number().int().min(1).max(3650),
    amountDA: z.number().int().min(1).max(10000000),
    packageKey: z.string().max(60).optional(),
    maxActiveOffers: z.number().int().min(1).max(100).optional(),
    reference: z.string().max(40).optional(),
  }).parse(req.body);
  const user = await User.findById(req.params.id);
  if (!user) { res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' }); return; }

  let pkgName: { ar: string; fr: string; en: string } | undefined;
  let maxOffers = body.maxActiveOffers;
  const settings = await Settings.findOne({ key: 'main' });
  if (body.packageKey && settings) {
    const pkg = settings.packages.find((p) => p.key === body.packageKey);
    if (pkg) { pkgName = pkg.name; maxOffers = maxOffers ?? pkg.maxActiveOffers; }
  }

  await Subscription.updateMany({ user: user._id, status: 'active' }, { $set: { status: 'expired', decidedBy: req.user!._id, decidedAt: new Date() } });
  const sub = await Subscription.create({
    user: user._id,
    status: 'active',
    packageKey: body.packageKey,
    packageName: pkgName,
    amountDA: body.amountDA,
    durationDays: body.days,
    maxActiveOffers: maxOffers,
    reference: body.reference || `ADMIN-${Date.now().toString(36).toUpperCase()}`,
    startsAt: new Date(),
    endsAt: new Date(Date.now() + body.days * 24 * 3600 * 1000),
    decidedBy: req.user!._id,
    decidedAt: new Date(),
  });
  // v4.7 — the paid activation lifts the "disabled" state instantly
  await User.updateOne({ _id: user._id }, { $set: { subLocked: false } });
  adminNotify(
    user._id,
    `تم تفعيل اشتراكك لمدة ${body.days} يوم — شكراً لك`,
    `Votre abonnement a été activé pour ${body.days} jours — merci`,
    `Your subscription was activated for ${body.days} days — thank you`
  );
  res.status(201).json(sub);
}));

/** Immediately disable an active subscription. */
router.post('/subscriptions/:id/expire', asyncH(async (req: AuthRequest, res) => {
  const sub = await Subscription.findById(req.params.id);
  if (!sub) { res.status(404).json({ error: 'Subscription not found', code: 'NOT_FOUND' }); return; }
  sub.status = 'expired';
  sub.endsAt = new Date();
  sub.decidedBy = req.user!._id;
  sub.decidedAt = new Date();
  await sub.save();
  adminNotify(sub.user, 'تم تعطيل اشتراكك بواسطة الإدارة', 'Votre abonnement a été désactivé par l administration', 'Your subscription was disabled by the administration');
  const populated = await Subscription.findById(sub._id).populate('user', 'name email phone role subLocked');
  res.json(populated);
}));

/** Extend an active subscription by N days. */
router.post('/subscriptions/:id/extend', asyncH(async (req: AuthRequest, res) => {
  const { days } = z.object({ days: z.number().int().min(1).max(3650) }).parse(req.body);
  const sub = await Subscription.findById(req.params.id);
  if (!sub) { res.status(404).json({ error: 'Subscription not found', code: 'NOT_FOUND' }); return; }
  const base = sub.endsAt && sub.endsAt > new Date() ? new Date(sub.endsAt) : new Date();
  sub.status = 'active';
  sub.endsAt = new Date(base.getTime() + days * 24 * 3600 * 1000);
  if (!sub.startsAt) sub.startsAt = new Date();
  sub.decidedBy = req.user!._id;
  sub.decidedAt = new Date();
  await sub.save();
  adminNotify(sub.user, `تم تمديد اشتراكك ${days} يوم`, `Votre abonnement a été prolongé de ${days} jours`, `Your subscription was extended by ${days} days`);
  const populated = await Subscription.findById(sub._id).populate('user', 'name email phone role subLocked');
  res.json(populated);
}));

/** Upload a promotional image for a subscription package → GridFS. */
router.post('/package-image', asyncH(async (req: AuthRequest, res) => {
  const body = z.object({ mime: z.string().regex(/^image\//), dataBase64: z.string().min(50) }).parse(req.body);
  const { images, error } = decodeImages([{ mime: body.mime, dataBase64: body.dataBase64 }]);
  if (error || !images.length) { res.status(400).json({ error: error || 'Bad image', code: 'BAD_IMAGE' }); return; }
  const img = images[0];
  if (img.data.length > 1.5 * 1024 * 1024) { res.status(400).json({ error: 'Image too large (max 1.5MB)', code: 'TOO_LARGE' }); return; }
  const db = mongoose.connection.db;
  if (!db) { res.status(500).json({ error: 'DB not ready', code: 'ERROR' }); return; }
  const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: 'packageImages' });
  const gridId = await new Promise<mongoose.mongo.ObjectId>((resolve, reject) => {
    const stream = bucket.openUploadStream(`package-${Date.now()}`, { contentType: img.mime });
    stream.on('error', reject);
    stream.on('finish', () => resolve(stream.id as mongoose.mongo.ObjectId));
    stream.end(img.data);
  });
  res.status(201).json({ gridId: String(gridId), mime: img.mime });
}));

/* ---- Smart statistics (charts on the dashboard) ---- */
router.get('/stats', asyncH(async (_req: AuthRequest, res) => {
  const since = new Date(Date.now() - 13 * 24 * 3600 * 1000);
  since.setHours(0, 0, 0, 0);

  const dayKeys: string[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(since.getTime() + i * 24 * 3600 * 1000);
    dayKeys.push(d.toISOString().slice(0, 10));
  }

  const [usersByDay, offersByDay, subsApproved] = await Promise.all([
    User.aggregate([
      // the administration account is not a real app user — never count it in stats
      { $match: { createdAt: { $gte: since }, isSuperAdmin: { $ne: true } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
    ]),
    Offer.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 }, amount: { $sum: '$amountDA' } } },
    ]),
    Subscription.find({ status: { $in: ['active', 'expired'] }, decidedAt: { $ne: null } }).select('amountDA packageKey packageName decidedAt createdAt'),
  ]);

  const series = (rows: { _id: string; count: number }[]) => dayKeys.map((d) => ({ date: d, count: rows.find((r) => r._id === d)?.count || 0 }));
  const usersSeries = series(usersByDay as any);
  const offersSeries = (offersByDay as any[]).length ? series(offersByDay as any) : dayKeys.map((d) => ({ date: d, count: 0 }));
  const offersAmountSeries = dayKeys.map((d) => ({ date: d, amount: (offersByDay as any[]).find((r) => r._id === d)?.amount || 0 }));

  // revenue: approved subscriptions grouped by day of decision
  const revenueSeries = dayKeys.map((d) => {
    const daySubs = subsApproved.filter((s) => (s.decidedAt || s.createdAt).toISOString().slice(0, 10) === d);
    return { date: d, amount: daySubs.reduce((acc, s) => acc + (s.amountDA || 0), 0), count: daySubs.length };
  });

  const [byCategory, byWilaya, subsByStatus, subsByPackage, offerAgg, usersCount, roleSplit, idSplit, bannedCount, subsActive, complaintSplit, offerStatusSplit] = await Promise.all([
    Offer.aggregate([{ $group: { _id: '$categoryKey', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }]),
    Offer.aggregate([{ $group: { _id: '$wilaya', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 8 }]),
    Subscription.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Subscription.aggregate([
      { $match: { status: { $in: ['active', 'expired'] }, amountDA: { $gt: 0 } } },
      { $group: { _id: '$packageKey', count: { $sum: 1 }, DA: { $sum: '$amountDA' } } },
      { $sort: { count: -1 } },
    ]),
    Offer.aggregate([
      { $group: { _id: null, avg: { $avg: '$amountDA' }, done: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } }, cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } }, total: { $sum: 1 }, budget: { $sum: '$amountDA' } } },
    ]),
    User.countDocuments({ isSuperAdmin: { $ne: true } }),
    // v4.5 — deeper system-control metrics
    User.aggregate([{ $match: { isSuperAdmin: { $ne: true } } }, { $group: { _id: { $ifNull: ['$role', 'seeker'] }, count: { $sum: 1 } } }]),
    User.aggregate([{ $match: { isSuperAdmin: { $ne: true } } }, { $group: { _id: { $ifNull: ['$idVerified', 'none'] }, count: { $sum: 1 } } }]),
    User.countDocuments({ isBanned: true, isSuperAdmin: { $ne: true } }),
    Subscription.countDocuments({ status: 'active' }),
    Complaint.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Offer.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  const a = offerAgg[0] || { avg: 0, done: 0, cancelled: 0, total: 0, budget: 0 };
  const statusMap: Record<string, number> = {};
  for (const r of subsByStatus as any[]) statusMap[r._id] = r.count;
  const revenueTotal = revenueSeries.reduce((acc, r) => acc + r.amount, 0);

  // v4.5 helper — turn [{_id, count}] aggregates into named maps
  const toMap = (rows: any[]) => { const m: Record<string, number> = {}; for (const r of rows) m[r._id] = r.count; return m; };

  res.json({
    usersSeries,
    offersSeries,
    offersAmountSeries,
    revenueSeries,
    revenueTotalDA: revenueTotal,
    byCategory: (byCategory as any[]).map((r) => ({ key: r._id, count: r.count })),
    byWilaya: (byWilaya as any[]).map((r) => ({ wilaya: r._id || '—', count: r.count })),
    subsByStatus: statusMap,
    subsByPackage: (subsByPackage as any[]).map((r) => ({ key: r._id || 'legacy', count: r.count, DA: r.DA })),
    smart: {
      avgOfferDA: Math.round(a.avg || 0),
      totalBudgetDA: a.budget || 0,
      completionRate: a.total ? Math.round((a.done / a.total) * 100) : 0,
      cancelRate: a.total ? Math.round((a.cancelled / a.total) * 100) : 0,
      totalOffers: a.total || 0,
      usersTotal: usersCount,
      // v4.5 — system-control metrics
      usersByRole: toMap(roleSplit as any[]),
      idStatus: toMap(idSplit as any[]),
      offersByStatus: toMap(offerStatusSplit as any[]),
      usersBanned: bannedCount,
      subsActive,
      complaints: toMap(complaintSplit as any[]),
      tasksDone: a.done || 0,
    },
  });
}));

router.post('/subscriptions/:id/decide', asyncH(async (req: AuthRequest, res) => {
  const { action } = z.object({ action: z.enum(['approve', 'reject']) }).parse(req.body);
  const sub = await Subscription.findById(req.params.id);
  if (!sub) { res.status(404).json({ error: 'Subscription not found', code: 'NOT_FOUND' }); return; }
  if (sub.status !== 'pending') { res.status(400).json({ error: 'Subscription already decided', code: 'BAD_STATE' }); return; }
  const settings = await Settings.findOne({ key: 'main' });
  // honor the package the user subscribed to; fall back to the legacy plan
  const durationDays = sub.durationDays || settings?.subscription.durationDays || 30;

  if (action === 'approve') {
    await Subscription.updateMany({ user: sub.user, status: 'active', _id: { $ne: sub._id } }, { $set: { status: 'expired' } });
    sub.status = 'active';
    sub.startsAt = new Date();
    sub.endsAt = new Date(Date.now() + durationDays * 24 * 3600 * 1000);
  } else {
    sub.status = 'rejected';
  }
  sub.decidedBy = req.user!._id;
  sub.decidedAt = new Date();
  await sub.save();
  // v4.7 — a live subscription clears the "disabled by administration" state right away
  if (action === 'approve') await User.updateOne({ _id: sub.user }, { $set: { subLocked: false } });
  await notifyUsers([sub.user], action === 'approve' ? 'subscription_confirmed' : 'subscription_rejected', {
    subscriptionId: String(sub._id),
    amountDA: sub.amountDA,
    endsAt: sub.endsAt ? sub.endsAt.toISOString() : undefined,
  });
  const populated = await Subscription.findById(sub._id).populate('user', 'name email phone');
  res.json(populated);
}));

/* ---- Settings ---- */
const labelSchema = z.object({ ar: z.string().max(80), fr: z.string().max(80), en: z.string().max(80) });
const packageSchema = z.object({
  key: z.string().min(1).max(60),
  name: labelSchema,
  priceDA: z.number().min(0).max(999999999),
  durationDays: z.number().min(1).max(3650),
  maxActiveOffers: z.number().min(1).max(100),
  active: z.boolean().default(true),
  imageGridId: z.string().max(120).optional(),
});

router.put('/settings', asyncH(async (req: AuthRequest, res) => {
  const body = z.object({
    subscription: z.object({
      isEnabled: z.boolean().optional(),
      priceDA: z.number().min(0).max(999999999).optional(),
      durationDays: z.number().min(1).max(3650).optional(),
      maxActiveOffers: z.number().min(1).max(100).optional(),
      paymentInstructions: z.string().max(3000).optional(),
    }).optional(),
    categories: z.array(z.object({ key: z.string().min(1).max(60), label: labelSchema, icon: z.string().max(60) })).max(30).optional(),
    packages: z.array(packageSchema).max(20).optional(),
    // v4.6 — "contact us" page content, edited from the admin account
    contact: z.object({
      phone: z.string().max(40).optional(),
      email: z.string().max(120).optional(),
      instagram: z.string().max(200).optional(),
      address: z.string().max(200).optional(),
    }).optional(),
  }).parse(req.body);

  let settings = await Settings.findOne({ key: 'main' });
  if (!settings) settings = await Settings.create({ key: 'main' });
  if (body.subscription) Object.assign(settings.subscription, body.subscription);
  if (body.contact) settings.contact = { ...settings.contact, ...body.contact };
  if (body.categories) settings.categories = body.categories;
  if (body.packages) {
    // carry over uploaded package images when the editor didn't send them (same key)
    const oldByKey = new Map(settings.packages.map((p) => [p.key, p.imageGridId]));
    settings.packages = body.packages.map((p) => ({
      ...p,
      imageGridId: p.imageGridId || oldByKey.get(p.key) || undefined,
    }));
  }
  await settings.save();
  res.json(settings);
}));

/* ---- Broadcast ---- */
router.post('/broadcast', asyncH(async (req: AuthRequest, res) => {
  // trilingual announcement — every user reads it in their chosen language
  const { titleAr, titleFr, titleEn, bodyAr, bodyFr, bodyEn } = z.object({
    titleAr: z.string().min(1).max(120),
    titleFr: z.string().min(1).max(120),
    titleEn: z.string().min(1).max(120),
    bodyAr: z.string().min(1).max(1000),
    bodyFr: z.string().min(1).max(1000),
    bodyEn: z.string().min(1).max(1000),
  }).parse(req.body);
  const users = await User.find({ isBanned: false, isSuperAdmin: { $ne: true } }).select('_id');
  await notifyUsers(users.map((u) => u._id), 'broadcast', { titleAr, titleFr, titleEn, bodyAr, bodyFr, bodyEn, actorName: 'Slekni' });
  res.json({ ok: true, notified: users.length });
}));

/* ---- Cleanup utility (removes non-admin users' artifacts) ---- */
router.post('/purge-test-data', asyncH(async (req: AuthRequest, res) => {
  // Danger: removes everything except settings + superadmin. Only for dev verification cleanup.
  if (process.env.NODE_ENV === 'production') { res.status(403).json({ error: 'Disabled in production', code: 'FORBIDDEN' }); return; }
  await User.deleteMany({ isSuperAdmin: { $ne: true } });
  await Offer.deleteMany({});
  await Subscription.deleteMany({});
  await Complaint.deleteMany({});
  await Notification.deleteMany({});
  await (await import('../models/pushsubscription.model')).PushSubscription.deleteMany({});
  res.json({ ok: true });
}));

export default router;
