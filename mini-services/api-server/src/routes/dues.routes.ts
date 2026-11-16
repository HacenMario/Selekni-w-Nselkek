import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Offer } from '../models/offer.model';
import { MonthlySettlement, commissionRate } from '../models/commission.model';
import { DuesPaymentProof } from '../models/duesproof.model';
import { Settings } from '../models/settings.model';
import { User } from '../models/user.model';
import { auth, adminOnly, AuthRequest } from '../middleware/auth';
import { asyncH } from '../middleware/error';
import { getSettings } from '../services/settings.service';
import { notifyUsers, notifyAdmins } from '../services/notification.service';
import { decodeAvatar } from '../utils/images';

const router = Router();

const PUB = 'name email phone role tasksDone';

/**
 * v4.16 — per-task dues model:
 *  - the OFFER carries `duesState` ('pending' | 'paid'); confirming a task NEVER
 *    pays it — only an administration action does (per-task toggle, month settle,
 *    or an approved payment proof);
 *  - the MonthlySettlement receipt stays as the month's derived aggregate so the
 *    receipts history keeps working (amountDA = Σ commissions of paid tasks);
 *  - `ensureDuesTaskMigration` runs once: pre-v4.16 settlements mark their
 *    month's tasks paid so historical receipts keep their meaning.
 */
let migrated = false;

async function ensureDuesTaskMigration(): Promise<void> {
  if (migrated) return;
  try {
    const s = await Settings.findOne({ key: 'main' }).select('duesMigrated');
    if (s && s.get('duesMigrated')) { migrated = true; return; }
    const settlements = await MonthlySettlement.find({}).lean();
    for (const st of settlements as any[]) {
      if (!st?.month || !st?.user) continue;
      await Offer.updateMany(
        {
          acceptedBy: st.user,
          status: 'done',
          completedAt: { $gte: new Date(`${st.month}-01T00:00:00.000Z`), $lt: new Date(endOfMonth(st.month)) },
          duesState: { $ne: 'paid' },
        },
        { $set: { duesState: 'paid', duesPaidAt: st.paidAt || new Date(), duesPaidBy: st.decidedBy } }
      );
    }
    await Settings.updateOne({ key: 'main' }, { $set: { duesMigrated: true } });
    migrated = true;
    console.log('[dues] v4.16 per-task migration done');
  } catch (err) {
    console.error('[dues] migration failed (retried on next request)', err);
  }
}

function monthRange(month: string) {
  return {
    $gte: new Date(`${month}-01T00:00:00.000Z`),
    $lt: new Date(endOfMonth(month)),
  };
}

type MonthAgg = {
  month: string;
  tasksCount: number;
  earnedDA: number;
  paidEarnedDA: number;
  paidTasks: number;
  lastPaidAt: Date | null;
};

/** Aggregate DONE offers of one executor into 'YYYY-MM' buckets, split by duesState. */
async function monthsForUser(userId: unknown): Promise<MonthAgg[]> {
  const rows = await Offer.aggregate([
    { $match: { acceptedBy: new mongoose.Types.ObjectId(String(userId)), status: 'done' } },
    { $match: { completedAt: { $ne: null } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$completedAt' } },
        tasksCount: { $sum: 1 },
        earnedDA: { $sum: '$amountDA' },
        paidEarnedDA: { $sum: { $cond: [{ $eq: ['$duesState', 'paid'] }, '$amountDA', 0] } },
        paidTasks: { $sum: { $cond: [{ $eq: ['$duesState', 'paid'] }, 1, 0] } },
        lastPaidAt: { $max: { $cond: [{ $eq: ['$duesState', 'paid'] }, '$duesPaidAt', null] } },
      },
    },
    { $sort: { _id: -1 } },
  ]);
  return rows.map((r: any) => ({
    month: r._id as string,
    tasksCount: r.tasksCount || 0,
    earnedDA: r.earnedDA || 0,
    paidEarnedDA: r.paidEarnedDA || 0,
    paidTasks: r.paidTasks || 0,
    lastPaidAt: r.lastPaidAt || null,
  }));
}

/** Keep the month's settlement receipt in sync with the tasks actually marked paid. */
async function syncMonthReceipt(userId: unknown, month: string, rate: number, decidedBy: unknown): Promise<void> {
  const rows = await Offer.aggregate([
    { $match: { acceptedBy: new mongoose.Types.ObjectId(String(userId)), status: 'done', completedAt: monthRange(month) } },
    { $group: {
      _id: null,
      paidEarnedDA: { $sum: { $cond: [{ $eq: ['$duesState', 'paid'] }, '$amountDA', 0] } },
      paidTasks: { $sum: { $cond: [{ $eq: ['$duesState', 'paid'] }, 1, 0] } },
    } },
  ]);
  const paidDA = Math.round((((rows[0] as any)?.paidEarnedDA || 0) * rate) / 100);
  const paidTasks = (rows[0] as any)?.paidTasks || 0;
  if (paidDA <= 0) {
    await MonthlySettlement.deleteOne({ user: userId, month }).catch(() => {});
    return;
  }
  await MonthlySettlement.findOneAndUpdate(
    { user: userId, month },
    {
      $set: {
        user: userId,
        month,
        amountDA: paidDA,
        tasksCount: paidTasks,
        decidedBy: decidedBy || undefined,
        paidAt: new Date(),
      },
    },
    { upsert: true, setDefaultsOnInsert: true }
  );
}

/** Build the full dues view (months split by paid tasks + receipts) for one user. */
async function duesForUser(userId: unknown, rate: number) {
  await ensureDuesTaskMigration();
  const [months, settlements] = await Promise.all([
    monthsForUser(userId),
    MonthlySettlement.find({ user: userId }).sort({ month: -1 }).lean(),
  ]);
  const paidByMonth = new Map<string, any>(settlements.map((s: any) => [s.month, s]));
  const items = months.map((m) => {
    const commissionDA = Math.round((m.earnedDA * rate) / 100);
    const paidDA = Math.round((m.paidEarnedDA * rate) / 100);
    const paid = paidByMonth.get(m.month);
    return {
      month: m.month,
      tasksCount: m.tasksCount,
      paidTasks: m.paidTasks,
      earnedDA: m.earnedDA,
      commissionDA,
      paidDA,
      unpaidDA: Math.max(0, commissionDA - paidDA),
      paidAt: (m.lastPaidAt as Date | null) || (paid ? paid.paidAt : null),
      note: paid?.note || '',
    };
  });
  const totals = items.reduce(
    (acc, m) => ({
      tasks: acc.tasks + m.tasksCount,
      earnedDA: acc.earnedDA + m.earnedDA,
      commissionDA: acc.commissionDA + m.commissionDA,
      paidDA: acc.paidDA + m.paidDA,
      unpaidDA: acc.unpaidDA + m.unpaidDA,
    }),
    { tasks: 0, earnedDA: 0, commissionDA: 0, paidDA: 0, unpaidDA: 0 }
  );
  return { items, totals, settlements };
}

/* ---- Executor side ---- */

/** My monthly dues as the task executor: per-month tasks / earnings / 15% / paid state,
 *  the payment-proof status of each month, and the administration's payment coordinates. */
router.get('/mine', auth, asyncH(async (req: AuthRequest, res) => {
  const settings = await getSettings();
  const rate = commissionRate(settings);
  const { items, totals } = await duesForUser(req.user!._id, rate);
  // the administration's contact info + official CCP/RIP so the executor knows where to pay
  const dp: any = (settings as any).duesPayment || {};
  res.json({
    rate,
    months: items,
    totals,
    contact: {
      phone: settings.contact?.phone || '',
      email: settings.contact?.email || '',
    },
    // v4.15 — official payment coordinates (admin-editable in settings)
    payment: {
      ccp: dp.ccp || '',
      ccpKey: dp.ccpKey || '',
      rip: dp.rip || '',
    },
    policy: {
      charge: 'on_completion', // commission charged when the owner confirms the task
      billing: 'monthly', // settled once a month
    },
  });
}));

/** v4.15 — submit a payment proof for a month's dues: a receipt photo the
 *  administration reviews before confirming the payment. */
router.post('/proof', auth, asyncH(async (req: AuthRequest, res) => {
  const body = z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/),
    image: z.object({ mime: z.string(), dataBase64: z.string() }),
    note: z.string().trim().max(300).optional(),
  }).parse(req.body);
  const settings = await getSettings();
  const rate = commissionRate(settings);
  // the month must actually have unsettled dues for THIS executor
  const { items } = await duesForUser(req.user!._id, rate);
  const target = items.find((m) => m.month === body.month);
  if (!target) { res.status(404).json({ error: 'No dues recorded for this month', code: 'NO_MONTH' }); return; }
  if (target.unpaidDA <= 0) { res.status(400).json({ error: 'This month is already fully settled', code: 'ALREADY_SETTLED' }); return; }

  const { data: img, error } = decodeAvatar(body.image, 1500 * 1024, 'Payment proof image too large (max 1.5MB)');
  if (error || !img) { res.status(400).json({ error: error || 'Invalid image', code: 'BAD_IMAGE' }); return; }

  // one live proof per (user, month) — re-submitting replaces the previous one
  const proof = await DuesPaymentProof.findOneAndUpdate(
    { user: req.user!._id, month: body.month },
    {
      $set: {
        user: req.user!._id,
        month: body.month,
        image: img.data,
        imageMime: img.mime,
        note: body.note || '',
        status: 'pending',
        reviewNote: '',
        decidedBy: undefined,
        decidedAt: undefined,
      },
    },
    { upsert: true, new: true }
  );
  // let the administration know a receipt is waiting for review
  notifyAdmins('dues_proof_submitted', {
    offerId: null,
    amountDA: target.unpaidDA,
    month: body.month,
    tasksCount: target.tasksCount,
    actorName: req.user!.name,
    userId: String(req.user!._id),
    proofId: String(proof._id),
  }).catch(() => {});
  res.status(201).json({
    _id: String(proof._id),
    month: proof.month,
    status: proof.status,
    submittedAt: proof.createdAt,
  });
}));

/** My payment proofs (status of each submission). */
router.get('/proofs/mine', auth, asyncH(async (req: AuthRequest, res) => {
  const proofs = await DuesPaymentProof.find({ user: req.user!._id })
    .sort({ createdAt: -1 })
    .select('-image')
    .lean();
  res.json({ items: proofs });
}));

/* ---- Administration side ---- */
router.use('/admin', auth, adminOnly);

/* ---- Administration: payment-proof review (v4.15) ---- */

/** All payment proofs (optionally filtered by status) with the sender's public info. */
router.get('/admin/proofs', asyncH(async (req: AuthRequest, res) => {
  const status = String(req.query.status || '');
  const filter: Record<string, unknown> = status ? { status } : {};
  const items = await DuesPaymentProof.find(filter).sort({ createdAt: -1 }).limit(100).select('-image').lean();
  const users = await User.find({ _id: { $in: items.map((p: any) => p.user) } }).select(PUB).lean();
  const byId = new Map<string, any>(users.map((u: any) => [String(u._id), u]));
  res.json({
    items: items.map((p: any) => ({
      ...p,
      user: byId.get(String(p.user)) || null,
    })),
  });
}));

/** The proof photo itself — super admin only, never cached (privacy). */
router.get('/admin/proofs/:id/image', asyncH(async (req: AuthRequest, res) => {
  const proof = await DuesPaymentProof.findById(req.params.id).select('image imageMime status');
  if (!proof || !proof.image?.length) { res.status(404).json({ error: 'Proof image not found', code: 'NOT_FOUND' }); return; }
  res.set('Content-Type', proof.imageMime || 'image/jpeg');
  res.set('Cache-Control', 'no-store');
  res.set('Content-Length', String(proof.image.length));
  res.end(proof.image);
}));

/** Approve a payment proof → records the settlement receipt automatically and
 *  wipes the image from the database. */
router.post('/admin/proofs/:id/approve', asyncH(async (req: AuthRequest, res) => {
  const { note } = z.object({ note: z.string().trim().max(300).optional() }).parse(req.body || {});
  const proof = await DuesPaymentProof.findById(req.params.id);
  if (!proof) { res.status(404).json({ error: 'Proof not found', code: 'NOT_FOUND' }); return; }
  if (proof.status !== 'pending') { res.status(400).json({ error: 'Proof already reviewed', code: 'BAD_STATE' }); return; }
  const settings = await getSettings();
  const rate = commissionRate(settings);
  const months = await monthsForUser(proof.user);
  const m = months.find((x) => x.month === proof.month);
  const duesDA = m ? Math.round((m.earnedDA * rate) / 100) : 0;
  if (!m || duesDA <= 0) { res.status(400).json({ error: 'No dues for this month anymore', code: 'NO_MONTH' }); return; }

  proof.status = 'approved';
  proof.reviewNote = note || '';
  proof.decidedBy = req.user!._id;
  proof.decidedAt = new Date();
  proof.image = Buffer.alloc(0); // the receipt photo leaves the database on decision
  proof.imageMime = '';
  await proof.save();

  // the approved proof IS the settlement receipt — mark the month paid
  // v4.16: the administration's approval marks every task of that month's dues paid
  await Offer.updateMany(
    { acceptedBy: proof.user, status: 'done', completedAt: monthRange(proof.month), duesState: { $ne: 'paid' } },
    { $set: { duesState: 'paid', duesPaidAt: new Date(), duesPaidBy: req.user!._id } }
  );
  const settlement = await MonthlySettlement.findOneAndUpdate(
    { user: proof.user, month: proof.month },
    {
      $set: {
        user: proof.user,
        month: proof.month,
        amountDA: duesDA,
        tasksCount: m.tasksCount,
        note: note || 'Payment proof approved',
        decidedBy: req.user!._id,
        paidAt: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  notifyUsers([proof.user], 'dues_proof_approved', {
    amountDA: settlement.amountDA,
    month: proof.month,
    tasksCount: m.tasksCount,
    actorName: 'Slekni',
  }).catch(() => {});
  res.json({ ok: true, settlement });
}));

/** Reject a payment proof — the executor can re-submit a clearer receipt. */
router.post('/admin/proofs/:id/reject', asyncH(async (req: AuthRequest, res) => {
  const { reason } = z.object({ reason: z.string().trim().max(300).default('') }).parse(req.body || {});
  const proof = await DuesPaymentProof.findById(req.params.id);
  if (!proof) { res.status(404).json({ error: 'Proof not found', code: 'NOT_FOUND' }); return; }
  if (proof.status !== 'pending') { res.status(400).json({ error: 'Proof already reviewed', code: 'BAD_STATE' }); return; }
  proof.status = 'rejected';
  proof.reviewNote = reason;
  proof.decidedBy = req.user!._id;
  proof.decidedAt = new Date();
  proof.image = Buffer.alloc(0); // the receipt photo leaves the database on decision
  proof.imageMime = '';
  await proof.save();
  notifyUsers([proof.user], 'dues_proof_rejected', {
    month: proof.month,
    actorName: 'Slekni',
    reason,
  }).catch(() => {});
  res.json({ ok: true });
}));

/** Month picker data + per-user aggregation for the admin dues tab.
 *  `month` = 'YYYY-MM' narrows the rows to that month; '' aggregates everything. */
router.get('/admin/summary', asyncH(async (req: AuthRequest, res) => {
  await ensureDuesTaskMigration();
  const settings = await getSettings();
  const rate = commissionRate(settings);
  const month = String(req.query.month || '');
  const monthFilter = /^\d{4}-\d{2}$/.test(month) ? { $eq: month } : null;

  // executors with at least one done offer (optionally narrowed to a month);
  // v4.16 — paid/unpaid split comes from each task's duesState, NOT from receipts
  const match: Record<string, unknown> = { status: 'done', completedAt: { $ne: null } };
  if (monthFilter) {
    match.completedAt = monthRange(month);
  }
  const byUser = await Offer.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$acceptedBy',
        tasksCount: { $sum: 1 },
        paidTasks: { $sum: { $cond: [{ $eq: ['$duesState', 'paid'] }, 1, 0] } },
        earnedDA: { $sum: '$amountDA' },
        paidEarnedDA: { $sum: { $cond: [{ $eq: ['$duesState', 'paid'] }, '$amountDA', 0] } },
      },
    },
    { $sort: { earnedDA: -1 } },
  ]);

  const userIds = byUser.map((r: any) => r._id).filter(Boolean);
  const users = await User.find({ _id: { $in: userIds } }).select(PUB).lean();
  const userById = new Map<string, any>(users.map((u: any) => [String(u._id), u]));

  const items = byUser.map((r: any) => {
    const u = userById.get(String(r._id));
    const duesDA = Math.round(((r.earnedDA || 0) * rate) / 100);
    const paidDA = Math.round(((r.paidEarnedDA || 0) * rate) / 100);
    return {
      user: u ? { _id: u._id, name: u.name, phone: u.phone, email: u.email, role: u.role } : { _id: r._id, name: '—', phone: '', email: '', role: 'seeker' },
      tasksCount: r.tasksCount || 0,
      paidTasks: r.paidTasks || 0,
      earnedDA: r.earnedDA || 0,
      duesDA,
      paidDA,
      unpaidDA: Math.max(0, duesDA - paidDA),
    };
  });

  // months that actually have done tasks (for the chip picker), newest first
  const monthRows = await Offer.aggregate([
    { $match: { status: 'done', completedAt: { $ne: null } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$completedAt' } }, tasks: { $sum: 1 } } },
    { $sort: { _id: -1 } },
    { $limit: 24 },
  ]);

  const totals = items.reduce(
    (acc, r) => ({
      tasks: acc.tasks + r.tasksCount,
      earnedDA: acc.earnedDA + r.earnedDA,
      duesDA: acc.duesDA + r.duesDA,
      paidDA: acc.paidDA + r.paidDA,
      unpaidDA: acc.unpaidDA + r.unpaidDA,
    }),
    { tasks: 0, earnedDA: 0, duesDA: 0, paidDA: 0, unpaidDA: 0 }
  );

  res.json({
    rate,
    month: monthFilter ? month : '',
    months: monthRows.map((r: any) => ({ month: r._id as string, tasks: r.tasks || 0 })),
    items: items.filter((r) => r.tasksCount > 0),
    totals,
  });
}));

/** Per-month breakdown for ONE user (details dialog in the admin panel),
 *  v4.16 — includes every done task with its dues state for full control. */
router.get('/admin/user/:id', asyncH(async (req: AuthRequest, res) => {
  await ensureDuesTaskMigration();
  const settings = await getSettings();
  const rate = commissionRate(settings);
  const target = await User.findById(req.params.id).select(PUB);
  if (!target) { res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' }); return; }
  const { items, totals } = await duesForUser(target._id, rate);
  const tasks = await Offer.find({ acceptedBy: target._id, status: 'done', completedAt: { $ne: null } })
    .sort({ completedAt: -1 })
    .select('title amountDA completedAt duesState duesPaidAt')
    .lean();
  const byMonth = new Map<string, any[]>();
  for (const t of tasks as any[]) {
    const m = new Date(t.completedAt);
    const key = `${m.getUTCFullYear()}-${String(m.getUTCMonth() + 1).padStart(2, '0')}`;
    const list = byMonth.get(key) || [];
    list.push({
      _id: String(t._id),
      title: t.title,
      amountDA: t.amountDA,
      commissionDA: Math.round(((t.amountDA || 0) * rate) / 100),
      duesState: t.duesState || 'pending',
      duesPaidAt: t.duesPaidAt || null,
      completedAt: t.completedAt,
    });
    byMonth.set(key, list);
  }
  res.json({
    rate,
    user: target,
    months: items.map((m) => ({ ...m, tasks: byMonth.get(m.month) || [] })),
    totals,
  });
}));

/** v4.16 — full administration control over ONE task's dues state:
 *  flip it between pending (معلقة) and paid (مسددة) freely; the month's
 *  receipt is kept in sync automatically. */
router.post('/admin/task/:id/state', asyncH(async (req: AuthRequest, res) => {
  const body = z.object({ state: z.enum(['pending', 'paid']) }).parse(req.body);
  const offer = await Offer.findById(req.params.id).select('title acceptedBy status completedAt amountDA duesState');
  if (!offer) { res.status(404).json({ error: 'Offer not found', code: 'NOT_FOUND' }); return; }
  if (offer.status !== 'done' || !offer.acceptedBy || !offer.completedAt) {
    res.status(400).json({ error: 'Dues state applies to completed tasks only', code: 'BAD_STATE' });
    return;
  }
  const settings = await getSettings();
  const rate = commissionRate(settings);
  const month = `${offer.completedAt.getUTCFullYear()}-${String(offer.completedAt.getUTCMonth() + 1).padStart(2, '0')}`;
  offer.duesState = body.state;
  if (body.state === 'paid') {
    offer.duesPaidAt = new Date();
    offer.duesPaidBy = req.user!._id;
  } else {
    offer.duesPaidAt = undefined;
    offer.duesPaidBy = undefined;
  }
  await offer.save();
  await syncMonthReceipt(offer.acceptedBy, month, rate, req.user!._id);
  if (body.state === 'paid') {
    notifyUsers([offer.acceptedBy], 'dues_paid', {
      amountDA: Math.round(((offer.amountDA || 0) * rate) / 100),
      month,
      tasksCount: 1,
      offerId: String(offer._id),
      offerTitle: offer.title,
      actorName: 'Slekni',
    }).catch(() => {});
  }
  res.json({ ok: true, duesState: offer.duesState, month });
}));

/** Mark a (user, month) pair as PAID — creates the settlement receipt AND
 *  v4.16: marks every task of that month's dues as paid (admin action required). */
router.post('/admin/settle', asyncH(async (req: AuthRequest, res) => {
  const body = z.object({
    userId: z.string().min(10),
    month: z.string().regex(/^\d{4}-\d{2}$/),
    amountDA: z.number().int().min(0).max(999999999).optional(),
    note: z.string().trim().max(300).optional(),
  }).parse(req.body);
  const settings = await getSettings();
  const rate = commissionRate(settings);
  const months = await monthsForUser(body.userId);
  const m = months.find((x) => x.month === body.month);
  if (!m) { res.status(404).json({ error: 'No completed tasks in this month', code: 'NO_MONTH' }); return; }
  const duesDA = Math.round((m.earnedDA * rate) / 100);
  // v4.16 — the administration's decision marks the tasks themselves paid
  await Offer.updateMany(
    { acceptedBy: body.userId, status: 'done', completedAt: monthRange(body.month), duesState: { $ne: 'paid' } },
    { $set: { duesState: 'paid', duesPaidAt: new Date(), duesPaidBy: req.user!._id } }
  );
  const settlement = await MonthlySettlement.findOneAndUpdate(
    { user: body.userId, month: body.month },
    {
      $set: {
        user: body.userId,
        month: body.month,
        amountDA: body.amountDA ?? duesDA,
        tasksCount: m.tasksCount,
        note: body.note || '',
        decidedBy: req.user!._id,
        paidAt: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  // receipt notification — rendered in the executor's chosen language
  notifyUsers([body.userId], 'dues_paid', {
    amountDA: settlement.amountDA,
    month: body.month,
    tasksCount: m.tasksCount,
    actorName: 'Slekni',
  }).catch(() => {});
  res.status(201).json(settlement);
}));

/** Reopen a settled month (admin mistake fix) — removes the receipt AND
 *  v4.16: flips that month's tasks back to pending (fully admin-controlled). */
router.post('/admin/unsettle', asyncH(async (req: AuthRequest, res) => {
  const body = z.object({
    userId: z.string().min(10),
    month: z.string().regex(/^\d{4}-\d{2}$/),
  }).parse(req.body);
  const del = await MonthlySettlement.findOneAndDelete({ user: body.userId, month: body.month });
  if (!del) { res.status(404).json({ error: 'No settlement found', code: 'NOT_FOUND' }); return; }
  await Offer.updateMany(
    { acceptedBy: body.userId, status: 'done', completedAt: monthRange(body.month), duesState: 'paid' },
    { $set: { duesState: 'pending' }, $unset: { duesPaidAt: '', duesPaidBy: '' } }
  );
  res.json({ ok: true });
}));

/** Remind one executor about their unpaid dues — trilingual system message. */
router.post('/admin/remind', asyncH(async (req: AuthRequest, res) => {
  const body = z.object({
    userId: z.string().min(10),
    month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  }).parse(req.body);
  const settings = await getSettings();
  const rate = commissionRate(settings);
  const { items, totals } = await duesForUser(body.userId, rate);
  const month = body.month || items.find((m) => m.unpaidDA > 0)?.month || '';
  const target = items.find((m) => m.month === month);
  const unpaidDA = target ? target.unpaidDA : totals.unpaidDA;
  if (unpaidDA <= 0) { res.status(400).json({ error: 'Nothing unpaid for this user', code: 'NOTHING_UNPAID' }); return; }
  await notifyUsers([body.userId], 'dues_reminder', {
    amountDA: unpaidDA,
    month,
    tasksCount: target?.tasksCount ?? 0,
    actorName: 'Slekni',
  });
  res.json({ ok: true, unpaidDA, month });
}));

function endOfMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m, 1)); // month is 1-based here → next month day 1
  return d.toISOString();
}

export default router;
