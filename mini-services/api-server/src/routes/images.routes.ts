import { Router, Response } from 'express';
import { Offer } from '../models/offer.model';
import { Subscription } from '../models/subscription.model';
import { User } from '../models/user.model';
import { auth, AuthRequest } from '../middleware/auth';
import { asyncH } from '../middleware/error';

const router = Router();

/** Profile picture of any user (auth required). */
router.get('/avatar/:userId', auth, asyncH(async (req: AuthRequest, res: Response) => {
  const user = await User.findById(req.params.userId).select('avatar avatarMime');
  if (!user || !user.avatar?.length) { res.status(404).json({ error: 'No avatar', code: 'NOT_FOUND' }); return; }
  res.set('Content-Type', user.avatarMime || 'image/jpeg');
  // URL carries an updatedAt version — long cache is safe AND new uploads show instantly
  res.set('Cache-Control', 'private, max-age=86400');
  res.set('Content-Length', String(user.avatar.length));
  res.end(user.avatar);
}));


/** ID-card image of a seeker — super admin only, for account verification review.
 *  NOTE: must be declared BEFORE `/:offerId/:imageId` or Express would capture "idcard" as an offer id. */
router.get('/idcard/:userId', auth, asyncH(async (req: AuthRequest, res: Response) => {
  if (!req.user!.isSuperAdmin) { res.status(403).json({ error: 'Super admin only', code: 'NOT_ADMIN' }); return; }
  const user = await User.findById(req.params.userId).select('idCard idCardMime');
  if (!user || !user.idCard?.length) { res.status(404).json({ error: 'No ID card on file', code: 'NOT_FOUND' }); return; }
  res.set('Content-Type', user.idCardMime || 'image/jpeg');
  res.set('Cache-Control', 'no-store'); // sensitive document: never cache it
  res.set('Content-Length', String(user.idCard.length));
  res.end(user.idCard);
}));


router.get('/:offerId/:imageId', asyncH(async (req: AuthRequest, res: Response) => {
  const offer = await Offer.findOne({ _id: req.params.offerId, 'images._id': req.params.imageId }).select('images');
  if (!offer) { res.status(404).json({ error: 'Image not found', code: 'NOT_FOUND' }); return; }
  const img = offer.images.find((i) => String(i._id) === req.params.imageId);
  if (!img) { res.status(404).json({ error: 'Image not found', code: 'NOT_FOUND' }); return; }
  res.set('Content-Type', img.mime);
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.set('Content-Length', String(img.data.length));
  res.end(img.data);
}));

router.get('/sub/:subscriptionId/:imageId', auth, asyncH(async (req: AuthRequest, res: Response) => {
  if (!req.user!.isSuperAdmin) { res.status(403).json({ error: 'Super admin only', code: 'NOT_ADMIN' }); return; }
  const sub = await Subscription.findOne({ _id: req.params.subscriptionId, 'proofImage._id': req.params.imageId }).select('proofImage');
  if (!sub?.proofImage) { res.status(404).json({ error: 'Image not found', code: 'NOT_FOUND' }); return; }
  res.set('Content-Type', sub.proofImage.mime);
  res.set('Cache-Control', 'private, max-age=86400');
  res.end(sub.proofImage.data);
}));

export default router;
