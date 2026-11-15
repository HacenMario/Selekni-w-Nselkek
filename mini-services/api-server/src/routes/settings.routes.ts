import { Router } from 'express';
import { getSettings } from '../services/settings.service';
import { asyncH } from '../middleware/error';

const router = Router();

router.get('/', asyncH(async (_req, res) => {
  const s = await getSettings();
  res.json({
    subscription: {
      isEnabled: s.subscription.isEnabled,
      priceDA: s.subscription.priceDA,
      durationDays: s.subscription.durationDays,
      maxActiveOffers: s.subscription.maxActiveOffers,
      paymentInstructions: s.subscription.paymentInstructions,
    },
    // v4.14 — commission model: public so the offer sheet can show the executor's net
    commissionPercent: typeof s.commissionPercent === 'number' ? s.commissionPercent : 15,
    categories: s.categories,
    // v4.6 — contact info shown on the "contact us" page (edited from the admin account)
    contact: s.contact || { phone: '', email: '', instagram: '', address: '' },
  });
}));

export default router;
