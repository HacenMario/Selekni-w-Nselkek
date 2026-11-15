import { Router } from 'express';
import { z } from 'zod';
import { Notification } from '../models/notification.model';
import { PushSubscription } from '../models/pushsubscription.model';
import { auth, AuthRequest } from '../middleware/auth';
import { asyncH } from '../middleware/error';

const router = Router();

router.get('/', auth, asyncH(async (req: AuthRequest, res) => {
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit || 30)));
  const filter = { user: req.user!._id };
  const total = await Notification.countDocuments(filter);
  const unreadCount = await Notification.countDocuments({ ...filter, readAt: { $exists: false } });
  const items = await Notification.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit);
  res.json({ items, total, unreadCount, page, pages: Math.ceil(total / limit) || 1 });
}));

router.post('/read-all', auth, asyncH(async (req: AuthRequest, res) => {
  await Notification.updateMany({ user: req.user!._id, readAt: { $exists: false } }, { $set: { readAt: new Date() } });
  res.json({ ok: true });
}));

/** Mark a single notification as read (fired when the user taps it). */
router.post('/:id/read', auth, asyncH(async (req: AuthRequest, res) => {
  await Notification.updateOne({ _id: req.params.id, user: req.user!._id }, { $set: { readAt: new Date() } });
  res.json({ ok: true });
}));

router.delete('/all', auth, asyncH(async (req: AuthRequest, res) => {
  await Notification.deleteMany({ user: req.user!._id });
  res.json({ ok: true });
}));

router.post('/subscribe', auth, asyncH(async (req: AuthRequest, res) => {
  const body = z.object({
    endpoint: z.string().url(),
    keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
  }).parse(req.body);
  await PushSubscription.findOneAndUpdate(
    { endpoint: body.endpoint },
    { $set: { user: req.user!._id, endpoint: body.endpoint, keys: body.keys } },
    { upsert: true, new: true }
  );
  res.json({ ok: true });
}));

router.delete('/subscribe', auth, asyncH(async (req: AuthRequest, res) => {
  const endpoint = z.string().parse(req.body?.endpoint || req.query.endpoint || '');
  if (endpoint) await PushSubscription.deleteOne({ endpoint });
  res.json({ ok: true });
}));

export default router;
