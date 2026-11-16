import { Router } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { User } from '../models/user.model';
import { Offer } from '../models/offer.model';
import { MonthlySettlement, commissionRate } from '../models/commission.model';
import { DuesPaymentProof } from '../models/duesproof.model';
import { Complaint } from '../models/complaint.model';
import { Settings, DEFAULT_CATEGORIES } from '../models/settings.model';
import { Notification } from '../models/notification.model';
import { auth, adminOnly, AuthRequest } from '../middleware/auth';
import { asyncH } from '../middleware/error';
import { notifyUsers } from '../services/notification.service';
import { getSettings } from '../services/settings.service';

const router = Router();
router.use(auth, adminOnly);

/** Notify a user with a direct system message — trilingual data; the app renders the recipient's language. */
function adminNotify(userId: unknown, ar: string, fr: string, en: string, extra: Record<string, unknown> = {}) {
  notifyUsers([userId], 'system', { titleAr: ar, titleFr: fr, titleEn: en, ...extra }).catch(() => {});
}

/** Platform dues summary (v4.14 commission model): unpaid executors + totals.
 *  v4.16 — paid/unpaid split comes from each task's duesState (admin-controlled);
 *  confirming a task never pays it by itself. */
async function duesSummary() {
  const settings = await getSettings();
  const rate = commissionRate(settings);
  const byUser = await Offer.aggregate([
    { $match: { status: 'done', completedAt: { $ne: null }, acceptedBy: { $ne: null } } },
    { $group: {
      _id: '$acceptedBy',
      tasks: { $sum: 1 },
      earned: { $sum: '$amountDA' },
      paidEarned: { $sum: { $cond: [{ $eq: ['$duesState', 'paid'] }, '$amountDA', 0] } },
    } },
  ]);
  let unpaidUsers = 0, unpaidDA = 0, duesDA = 0;
  for (const r of byUser as any[]) {
    const d = Math.round(((r.earned || 0) * rate) / 100);
    duesDA += d;
    const paid = Math.round(((r.paidEarned || 0) * rate) / 100);
    const unpaid = Math.max(0, d - paid);
    if (unpaid > 0) { unpaidUsers += 1; unpaidDA += unpaid; }
  }
  const monthStart = new Date();
  monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const monthAgg = await Offer.aggregate([
    { $match: { status: 'done', completedAt: { $gte: monthStart }, acceptedBy: { $ne: null } } },
    { $group: { _id: null, earned: { $sum: '$amountDA' } } },
  ]);
  // v4.15 — payment proofs waiting for the administration's review
  const proofsPending = await DuesPaymentProof.countDocuments({ status: 'pending' });
  return { rate, unpaidUsers, unpaidDA, duesDA, monthCommissionsDA: Math.round((((monthAgg[0] as any)?.earned || 0) * rate) / 100), proofsPending };
}

/* ---- Dashboard ---- */
router.get('/dashboard', asyncH(async (_req: AuthRequest, res) => {
  const [usersTotal, owners, seekers, idPendingUsers, verifiedUsers, bannedUsers, offersOpen, offersAssigned, offersAwaiting, offersDone, offersCancelled, complaintsOpen, recentUsers, dues] = await Promise.all([
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
    Complaint.countDocuments({ status: 'open' }),
    User.find({ isSuperAdmin: { $ne: true } }).sort({ createdAt: -1 }).limit(10).select('name email phone role wilaya isBanned createdAt'),
    duesSummary(),
  ]);
  res.json({
    users: { total: usersTotal, owners, seekers, idPending: idPendingUsers, verified: verifiedUsers, banned: bannedUsers },
    offers: { open: offersOpen, assigned: offersAssigned, awaiting: offersAwaiting, done: offersDone, cancelled: offersCancelled },
    // v4.14 — commission model replaces the subscriptions block
    dues: { rate: dues.rate, unpaidUsers: dues.unpaidUsers, unpaidDA: dues.unpaidDA, duesDA: dues.duesDA, monthCommissionsDA: dues.monthCommissionsDA, proofsPending: dues.proofsPending || 0 },
    complaintsOpen,
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
    MonthlySettlement.deleteMany({ user: target._id }),
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

/* ---- v4.14: subscription endpoints removed — commission dues live in /dues/admin/* ---- */

/* ---- Smart statistics (charts on the dashboard) ---- */
router.get('/stats', asyncH(async (_req: AuthRequest, res) => {
  // v4.15 — UTC-anchored day buckets: the series always line up with the
  // $dateToString (UTC) aggregation keys, whatever the server's local timezone
  const since = new Date(Date.now() - 13 * 24 * 3600 * 1000);
  since.setUTCHours(0, 0, 0, 0);

  const dayKeys: string[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(since.getTime() + i * 24 * 3600 * 1000);
    dayKeys.push(d.toISOString().slice(0, 10));
  }

  const [usersByDay, offersByDay, settledDues] = await Promise.all([
    User.aggregate([
      // the administration account is not a real app user — never count it in stats
      { $match: { createdAt: { $gte: since }, isSuperAdmin: { $ne: true } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
    ]),
    Offer.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 }, amount: { $sum: '$amountDA' } } },
    ]),
    // v4.14 — platform revenue = settled commission receipts (not subscriptions)
    MonthlySettlement.find({}).select('amountDA paidAt'),
  ]);

  const series = (rows: { _id: string; count: number }[]) => dayKeys.map((d) => ({ date: d, count: rows.find((r) => r._id === d)?.count || 0 }));
  const usersSeries = series(usersByDay as any);
  const offersSeries = (offersByDay as any[]).length ? series(offersByDay as any) : dayKeys.map((d) => ({ date: d, count: 0 }));
  const offersAmountSeries = dayKeys.map((d) => ({ date: d, amount: (offersByDay as any[]).find((r) => r._id === d)?.amount || 0 }));

  // revenue: settled commissions grouped by the day the administration marked them paid
  const revenueSeries = dayKeys.map((d) => {
    const dayDues = settledDues.filter((s: any) => new Date(s.paidAt || s.createdAt).toISOString().slice(0, 10) === d);
    return { date: d, amount: dayDues.reduce((acc: number, s: any) => acc + (s.amountDA || 0), 0), count: dayDues.length };
  });

  const dues = await duesSummary();

  const [byCategory, byWilaya, offerAgg, usersCount, roleSplit, idSplit, bannedCount, complaintSplit, offerStatusSplit] = await Promise.all([
    Offer.aggregate([{ $group: { _id: '$categoryKey', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }]),
    Offer.aggregate([{ $group: { _id: '$wilaya', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 8 }]),
    Offer.aggregate([
      { $group: { _id: null, avg: { $avg: '$amountDA' }, done: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } }, cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } }, total: { $sum: 1 }, budget: { $sum: '$amountDA' } } },
    ]),
    User.countDocuments({ isSuperAdmin: { $ne: true } }),
    // v4.5 — deeper system-control metrics
    User.aggregate([{ $match: { isSuperAdmin: { $ne: true } } }, { $group: { _id: { $ifNull: ['$role', 'seeker'] }, count: { $sum: 1 } } }]),
    User.aggregate([{ $match: { isSuperAdmin: { $ne: true } } }, { $group: { _id: { $ifNull: ['$idVerified', 'none'] }, count: { $sum: 1 } } }]),
    User.countDocuments({ isBanned: true, isSuperAdmin: { $ne: true } }),
    Complaint.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Offer.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  const a = offerAgg[0] || { avg: 0, done: 0, cancelled: 0, total: 0, budget: 0 };
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
    // v4.14 — commission model replaces the subscription charts
    dues: { unpaidUsers: dues.unpaidUsers, unpaidDA: dues.unpaidDA, duesDA: dues.duesDA, monthCommissionsDA: dues.monthCommissionsDA, proofsPending: dues.proofsPending || 0 },
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
      complaints: toMap(complaintSplit as any[]),
      tasksDone: a.done || 0,
    },
  });
}));

/* ---- v4.14: subscription decide endpoint removed (was /subscriptions/:id/decide) ---- */

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
    // v4.14 — commission rate (percentage of each DONE task, charged to the executor)
    commissionPercent: z.number().min(0).max(50).optional(),
    // v4.15 — the administration's official dues payment coordinates (shown to executors)
    duesPayment: z.object({
      ccp: z.string().max(30).optional(),
      ccpKey: z.string().max(4).optional(),
      rip: z.string().max(40).optional(),
    }).optional(),
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
  if (body.commissionPercent !== undefined) settings.commissionPercent = body.commissionPercent;
  if (body.duesPayment) {
    settings.duesPayment = {
      ccp: body.duesPayment.ccp ?? (settings.duesPayment?.ccp || ''),
      ccpKey: body.duesPayment.ccpKey ?? (settings.duesPayment?.ccpKey || ''),
      rip: body.duesPayment.rip ?? (settings.duesPayment?.rip || ''),
    };
  }
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
  await MonthlySettlement.deleteMany({});
  await Complaint.deleteMany({});
  await Notification.deleteMany({});
  await (await import('../models/pushsubscription.model')).PushSubscription.deleteMany({});
  res.json({ ok: true });
}));

export default router;
