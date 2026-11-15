import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Offer } from '../models/offer.model';
import { MonthlySettlement, commissionRate } from '../models/commission.model';
import { User } from '../models/user.model';
import { auth, adminOnly, AuthRequest } from '../middleware/auth';
import { asyncH } from '../middleware/error';
import { getSettings } from '../services/settings.service';
import { notifyUsers } from '../services/notification.service';

const router = Router();

const PUB = 'name email phone role tasksDone';

type MonthAgg = { month: string; tasksCount: number; earnedDA: number };

/** Aggregate DONE offers of one executor into 'YYYY-MM' buckets (single source of truth). */
async function monthsForUser(userId: unknown): Promise<MonthAgg[]> {
  const rows = await Offer.aggregate([
    { $match: { acceptedBy: new mongoose.Types.ObjectId(String(userId)), status: 'done' } },
    { $match: { completedAt: { $ne: null } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$completedAt' } },
        tasksCount: { $sum: 1 },
        earnedDA: { $sum: '$amountDA' },
      },
    },
    { $sort: { _id: -1 } },
  ]);
  return rows.map((r: any) => ({ month: r._id as string, tasksCount: r.tasksCount || 0, earnedDA: r.earnedDA || 0 }));
}

/** Build the full dues view (months + settlements) for one user at the given rate. */
async function duesForUser(userId: unknown, rate: number) {
  const [months, settlements] = await Promise.all([
    monthsForUser(userId),
    MonthlySettlement.find({ user: userId }).sort({ month: -1 }).lean(),
  ]);
  const paidByMonth = new Map<string, any>(settlements.map((s: any) => [s.month, s]));
  const items = months.map((m) => {
    const commissionDA = Math.round((m.earnedDA * rate) / 100);
    const paid = paidByMonth.get(m.month);
    const paidDA = paid ? paid.amountDA : 0;
    return {
      month: m.month,
      tasksCount: m.tasksCount,
      earnedDA: m.earnedDA,
      commissionDA,
      paidDA,
      unpaidDA: Math.max(0, commissionDA - paidDA),
      paidAt: paid ? paid.paidAt : null,
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

/** My monthly dues as the task executor: per-month tasks / earnings / 15% / paid state. */
router.get('/mine', auth, asyncH(async (req: AuthRequest, res) => {
  const settings = await getSettings();
  const rate = commissionRate(settings);
  const { items, totals } = await duesForUser(req.user!._id, rate);
  // the administration's contact info so the executor knows where to pay
  res.json({
    rate,
    months: items,
    totals,
    contact: {
      phone: settings.contact?.phone || '',
      email: settings.contact?.email || '',
    },
    policy: {
      charge: 'on_completion', // commission charged when the owner confirms the task
      billing: 'monthly', // settled once a month
    },
  });
}));

/* ---- Administration side ---- */
router.use('/admin', auth, adminOnly);

/** Month picker data + per-user aggregation for the admin dues tab.
 *  `month` = 'YYYY-MM' narrows the rows to that month; '' aggregates everything. */
router.get('/admin/summary', asyncH(async (req: AuthRequest, res) => {
  const settings = await getSettings();
  const rate = commissionRate(settings);
  const month = String(req.query.month || '');
  const monthFilter = /^\d{4}-\d{2}$/.test(month) ? { $eq: month } : null;

  // executors with at least one done offer (optionally narrowed to a month)
  const match: Record<string, unknown> = { status: 'done', completedAt: { $ne: null } };
  if (monthFilter) {
    match.completedAt = { $gte: new Date(`${month}-01T00:00:00.000Z`), $lt: new Date(endOfMonth(month)) };
  }
  const byUser = await Offer.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$acceptedBy',
        tasksCount: { $sum: 1 },
        earnedDA: { $sum: '$amountDA' },
      },
    },
    { $sort: { earnedDA: -1 } },
  ]);

  const settlements = await MonthlySettlement.find(
    monthFilter ? { month } : {}
  ).lean();
  const paidByUserMonth = new Map<string, number>();
  for (const s of settlements as any[]) {
    const key = `${s.user}`;
    paidByUserMonth.set(key, (paidByUserMonth.get(key) || 0) + (s.amountDA || 0));
  }

  const userIds = byUser.map((r: any) => r._id).filter(Boolean);
  const users = await User.find({ _id: { $in: userIds } }).select(PUB).lean();
  const userById = new Map<string, any>(users.map((u: any) => [String(u._id), u]));

  const items = byUser.map((r: any) => {
    const u = userById.get(String(r._id));
    const duesDA = Math.round(((r.earnedDA || 0) * rate) / 100);
    const paidDA = paidByUserMonth.get(String(r._id)) || 0;
    return {
      user: u ? { _id: u._id, name: u.name, phone: u.phone, email: u.email, role: u.role } : { _id: r._id, name: '—', phone: '', email: '', role: 'seeker' },
      tasksCount: r.tasksCount || 0,
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

/** Per-month breakdown for ONE user (details dialog in the admin panel). */
router.get('/admin/user/:id', asyncH(async (req: AuthRequest, res) => {
  const settings = await getSettings();
  const rate = commissionRate(settings);
  const target = await User.findById(req.params.id).select(PUB);
  if (!target) { res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' }); return; }
  const { items, totals } = await duesForUser(target._id, rate);
  res.json({ rate, user: target, months: items, totals });
}));

/** Mark a (user, month) pair as PAID — creates/replaces the settlement receipt. */
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

/** Reopen a settled month (admin mistake fix) — removes the receipt. */
router.post('/admin/unsettle', asyncH(async (req: AuthRequest, res) => {
  const body = z.object({
    userId: z.string().min(10),
    month: z.string().regex(/^\d{4}-\d{2}$/),
  }).parse(req.body);
  const del = await MonthlySettlement.findOneAndDelete({ user: body.userId, month: body.month });
  if (!del) { res.status(404).json({ error: 'No settlement found', code: 'NOT_FOUND' }); return; }
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
