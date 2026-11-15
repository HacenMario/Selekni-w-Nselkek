import { Router, Response } from 'express';
import { z } from 'zod';
import { Complaint } from '../models/complaint.model';
import { Offer } from '../models/offer.model';
import { auth, AuthRequest } from '../middleware/auth';
import { asyncH } from '../middleware/error';
import { notifyAdmins } from '../services/notification.service';

const router = Router();

const createSchema = z.object({
  offerId: z.string().min(10),
  subject: z.string().min(3).max(120),
  description: z.string().min(5).max(1500),
});

/** File a complaint about an offer — available to the offer owner and to the worker who accepted it. */
router.post('/', auth, asyncH(async (req: AuthRequest, res: Response) => {
  const body = createSchema.parse(req.body);
  const offer = await Offer.findById(body.offerId).select('owner acceptedBy status');
  if (!offer) { res.status(404).json({ error: 'Offer not found', code: 'NOT_FOUND' }); return; }

  const uid = String(req.user!._id);
  const isOwner = String(offer.owner) === uid;
  const isWorker = offer.acceptedBy ? String(offer.acceptedBy) === uid : false;
  if (!isOwner && !isWorker) {
    res.status(403).json({ error: 'Only the offer owner or the assigned worker can file a complaint', code: 'NOT_PARTY' });
    return;
  }

  // the counterpart is the other party of the deal (null if nobody accepted yet)
  const against = isOwner ? offer.acceptedBy ?? null : offer.owner;
  const complaint = await Complaint.create({
    offer: offer._id,
    by: req.user!._id,
    byRole: isOwner ? 'owner' : 'seeker',
    against,
    subject: body.subject,
    description: body.description,
    status: 'open',
  });

  notifyAdmins('complaint_new', {
    complaintId: String(complaint._id),
    offerId: String(offer._id),
    subject: body.subject,
    actorName: req.user!.name,
  }).catch(() => {});

  res.status(201).json(complaint);
}));

/** My complaints. */
router.get('/mine', auth, asyncH(async (req: AuthRequest, res) => {
  const items = await Complaint.find({ by: req.user!._id }).sort({ createdAt: -1 }).limit(50).populate('offer', 'title status');
  res.json({ items });
}));

/** v4.6 — contact page: a suggestion, a report or a general message, no offer needed.
 *  Lands in the same admin pipeline as complaints (open → resolved). */
router.post('/contact', auth, asyncH(async (req: AuthRequest, res: Response) => {
  const body = z.object({
    kind: z.enum(['suggestion', 'report', 'complaint']).default('suggestion'),
    subject: z.string().min(3).max(120),
    message: z.string().min(5).max(1500),
    // v4.9 — optional callback number so the administration can reach the sender
    phone: z.string().max(20).optional(),
  }).parse(req.body);
  const complaint = await Complaint.create({
    kind: body.kind,
    by: req.user!._id,
    byRole: req.user!.role,
    subject: body.subject,
    description: body.message,
    ...(body.phone && body.phone.trim().length >= 6 ? { phone: body.phone.trim() } : {}),
    status: 'open',
  });
  notifyAdmins('complaint_new', {
    complaintId: String(complaint._id),
    offerId: null,
    subject: body.subject,
    actorName: req.user!.name,
  }).catch(() => {});
  res.status(201).json(complaint);
}));

export default router;
