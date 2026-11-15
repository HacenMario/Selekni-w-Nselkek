import { Router } from 'express';
import { z } from 'zod';
import { Subscription } from '../models/subscription.model';
import { auth, AuthRequest } from '../middleware/auth';
import { asyncH } from '../middleware/error';
import { getSettings } from '../services/settings.service';
import { notifyAdmins } from '../services/notification.service';
import { decodeImages } from '../utils/images';

const router = Router();

async function lazyExpire(userId: unknown) {
  await Subscription.updateMany({ user: userId, status: 'active', endsAt: { $lt: new Date() } }, { $set: { status: 'expired' } });
}

router.get('/mine', auth, asyncH(async (req: AuthRequest, res) => {
  await lazyExpire(req.user!._id);
  // an active subscription always wins — after an admin grant/activation the account
  // must present itself as subscribed immediately, never as "expired, contact administration"
  const current =
    (await Subscription.findOne({ user: req.user!._id, status: 'active' }).sort({ createdAt: -1 })) ||
    (await Subscription.findOne({ user: req.user!._id }).sort({ createdAt: -1 }));
  const settings = await getSettings();
  res.json({
    current,
    locked: Boolean(req.user!.subLocked),
    packages: settings.packages.filter((p) => p.active),
    subscription: {
      isEnabled: settings.subscription.isEnabled,
      priceDA: settings.subscription.priceDA,
      durationDays: settings.subscription.durationDays,
      maxActiveOffers: settings.subscription.maxActiveOffers,
      paymentInstructions: settings.subscription.paymentInstructions,
    },
  });
}));

router.post('/', auth, asyncH(async (req: AuthRequest, res) => {
  const body = z.object({
    reference: z.string().min(4).max(100),
    packageKey: z.string().max(60).optional(),
    proofImage: z.object({ mime: z.string(), dataBase64: z.string() }).optional(),
  }).parse(req.body);
  const settings = await getSettings();
  if (!settings.subscription.isEnabled) { res.status(400).json({ error: 'Subscriptions are disabled', code: 'SUB_DISABLED' }); return; }
  // the super admin can disable a specific account's ability to subscribe
  if (req.user!.subLocked) { res.status(403).json({ error: 'Your subscription was disabled by the administration', code: 'SUB_LOCKED' }); return; }

  // chosen package (falls back to the legacy single plan)
  const pkg = body.packageKey ? settings.packages.find((p) => p.key === body.packageKey && p.active) : undefined;
  const priceDA = pkg?.priceDA ?? settings.subscription.priceDA;
  const durationDays = pkg?.durationDays ?? settings.subscription.durationDays;
  const maxActiveOffers = pkg?.maxActiveOffers ?? settings.subscription.maxActiveOffers;

  let proofImage: { mime: string; size: number; data: Buffer } | undefined;
  if (body.proofImage) {
    const { images, error } = decodeImages([body.proofImage]);
    if (error) { res.status(400).json({ error, code: 'BAD_IMAGE' }); return; }
    proofImage = images[0];
  }

  const sub = await Subscription.create({
    user: req.user!._id,
    status: 'pending',
    packageKey: pkg?.key,
    packageName: pkg?.name,
    amountDA: priceDA,
    durationDays,
    maxActiveOffers,
    reference: body.reference,
    proofImage,
  });
  notifyAdmins('subscription_pending', {
    subscriptionId: String(sub._id),
    actorName: req.user!.name,
    amountDA: sub.amountDA,
    reference: sub.reference,
  }).catch(() => {});
  res.status(201).json(sub);
}));

export default router;
