import { Router } from 'express';
import { Offer } from '../models/offer.model';
import { auth, AuthRequest } from '../middleware/auth';
import { asyncH } from '../middleware/error';

const router = Router();

router.get('/', auth, asyncH(async (req: AuthRequest, res) => {
  const userId = req.user!._id;

  const [posted, open, assigned, awaiting, done, cancelled, spentAgg, accepted, activeAsWorker, doneAsWorker, earnedAgg] = await Promise.all([
    Offer.countDocuments({ owner: userId }),
    Offer.countDocuments({ owner: userId, status: 'open' }),
    Offer.countDocuments({ owner: userId, status: 'assigned' }),
    Offer.countDocuments({ owner: userId, status: 'awaiting_confirmation' }),
    Offer.countDocuments({ owner: userId, status: 'done' }),
    Offer.countDocuments({ owner: userId, status: 'cancelled' }),
    Offer.aggregate([{ $match: { owner: userId, status: 'done' } }, { $group: { _id: null, sum: { $sum: '$amountDA' } } }]),
    Offer.countDocuments({ acceptedBy: userId }),
    Offer.countDocuments({ acceptedBy: userId, status: { $in: ['assigned', 'awaiting_confirmation'] } }),
    Offer.countDocuments({ acceptedBy: userId, status: 'done' }),
    Offer.aggregate([{ $match: { acceptedBy: userId, status: 'done' } }, { $group: { _id: null, sum: { $sum: '$amountDA' } } }]),
  ]);

  res.json({
    owner: {
      posted, open, assigned, awaiting, done, cancelled,
      totalSpentDA: spentAgg[0]?.sum || 0,
    },
    seeker: {
      accepted,
      active: activeAsWorker,
      done: doneAsWorker,
      earnedDA: earnedAgg[0]?.sum || 0,
    },
  });
}));

export default router;
