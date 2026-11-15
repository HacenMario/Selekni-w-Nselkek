#!/usr/bin/env python3
# v4.6 backend patches: dashboard verified/banned, settings contact, mine prefers active,
# sub-lock reactivation, contact messages (suggestion/report) route + model + GET exposure.
import io

def patch(path, pairs):
    s = io.open(path, encoding='utf-8').read()
    for old, new in pairs:
        found = s.count(old)
        assert found == 1, f"{path}: expected 1 of {old[:70]!r}, found {found}"
        s = s.replace(old, new)
    io.open(path, 'w', encoding='utf-8').write(s)
    print('OK', path, len(pairs), 'patches')

ROOT = '/home/z/my-project/mini-services/api-server/src/'

# 1) dashboard: + verified & banned users (3 new KPI cards in the admin overview)
patch(ROOT + 'routes/admin.routes.ts', [
    ("""  const [usersTotal, owners, seekers, idPendingUsers, offersOpen, offersAssigned, offersAwaiting, offersDone, offersCancelled, subsPending, subsActive, complaintsOpen, recentUsers, expiringSubDocs] = await Promise.all([""",
     """  const [usersTotal, owners, seekers, idPendingUsers, verifiedUsers, bannedUsers, offersOpen, offersAssigned, offersAwaiting, offersDone, offersCancelled, subsPending, subsActive, complaintsOpen, recentUsers, expiringSubDocs] = await Promise.all(["""),
    ("""    // accounts awaiting ID-card verification (drives the users-tab badge)
    User.countDocuments({ role: 'seeker', idVerified: 'pending' }),""",
     """    // accounts awaiting ID-card verification (drives the users-tab badge)
    User.countDocuments({ role: 'seeker', idVerified: 'pending' }),
    // v4.6 — verified accounts & banned accounts for the overview KPI cards
    User.countDocuments({ idVerified: 'verified', isSuperAdmin: { $ne: true } }),
    User.countDocuments({ isBanned: true, isSuperAdmin: { $ne: true } }),"""),
    ("""    users: { total: usersTotal, owners, seekers, idPending: idPendingUsers },""",
     """    users: { total: usersTotal, owners, seekers, idPending: idPendingUsers, verified: verifiedUsers, banned: bannedUsers },"""),
])

# 2) PUT /settings — accept editable contact info (contact page data comes from the admin)
patch(ROOT + 'routes/admin.routes.ts', [
    ("""    categories: z.array(z.object({ key: z.string().min(1).max(60), label: labelSchema, icon: z.string().max(60) })).max(30).optional(),
    packages: z.array(packageSchema).max(20).optional(),
  }).parse(req.body);""",
     """    categories: z.array(z.object({ key: z.string().min(1).max(60), label: labelSchema, icon: z.string().max(60) })).max(30).optional(),
    packages: z.array(packageSchema).max(20).optional(),
    // v4.6 — "contact us" page content, edited from the admin account
    contact: z.object({
      phone: z.string().max(40).optional(),
      email: z.string().max(120).optional(),
      facebook: z.string().max(200).optional(),
      address: z.string().max(200).optional(),
    }).optional(),
  }).parse(req.body);"""),
    ("""  if (body.subscription) Object.assign(settings.subscription, body.subscription);""",
     """  if (body.subscription) Object.assign(settings.subscription, body.subscription);
  if (body.contact) settings.contact = { ...settings.contact, ...body.contact };"""),
])

# 3) mine — an ACTIVE subscription always wins over older rejected/expired ones,
#    so a freshly granted/activated sub shows immediately (no lingering "expired" wording)
patch(ROOT + 'routes/subscriptions.routes.ts', [
    ("""  const current = await Subscription.findOne({ user: req.user!._id }).sort({ createdAt: -1 });""",
     """  // an active subscription always wins — after an admin grant/activation the account
  // must present itself as subscribed immediately, never as "expired, contact administration"
  const current =
    (await Subscription.findOne({ user: req.user!._id, status: 'active' }).sort({ createdAt: -1 })) ||
    (await Subscription.findOne({ user: req.user!._id }).sort({ createdAt: -1 }));"""),
])

# 4) sub-lock re-enable — bringing an account back also revives its latest expired
#    subscription with a fresh window, so the user is subscribed at once
patch(ROOT + 'routes/admin.routes.ts', [
    ("""  res.json({ ok: true, subLocked: locked });
}));""",
     """  // v4.6 — re-enabling an account revives its latest expired subscription so the
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
}));"""),
])

# 5) contact messages — suggestions & reports without an offer, same admin pipeline
patch(ROOT + 'models/complaint.model.ts', [
    ("""export interface IComplaint extends Document {
  offer: unknown;
  by: unknown; // complainant
  byRole: 'owner' | 'seeker';
  against?: unknown; // the other party (null when there is no counterpart yet)
  subject: string;
  description: string;
  status: 'open' | 'resolved';
  resolution?: string;
  createdAt: Date;
  updatedAt: Date;
}""",
     """export interface IComplaint extends Document {
  offer?: unknown; // null for contact-page suggestions/reports (v4.6)
  kind: 'complaint' | 'suggestion' | 'report';
  by: unknown; // complainant
  byRole: 'owner' | 'seeker';
  against?: unknown; // the other party (null when there is no counterpart yet)
  subject: string;
  description: string;
  status: 'open' | 'resolved';
  resolution?: string;
  createdAt: Date;
  updatedAt: Date;
}"""),
    ("""    offer: { type: Schema.Types.ObjectId, ref: 'Offer', required: true, index: true },""",
     """    offer: { type: Schema.Types.ObjectId, ref: 'Offer', index: true },
    kind: { type: String, enum: ['complaint', 'suggestion', 'report'], default: 'complaint' },"""),
])

# 6) settings model + public GET — expose the admin-edited contact info
patch(ROOT + 'models/settings.model.ts', [
    ("""    packages: { type: [{ key: String, name: { ar: String, fr: String, en: String }, priceDA: Number, durationDays: Number, maxActiveOffers: Number, active: Boolean, imageGridId: String }], default: DEFAULT_PACKAGES },""",
     """    packages: { type: [{ key: String, name: { ar: String, fr: String, en: String }, priceDA: Number, durationDays: Number, maxActiveOffers: Number, active: Boolean, imageGridId: String }], default: DEFAULT_PACKAGES },
    // v4.6 — "contact us" page, edited from the admin account
    contact: {
      type: { phone: String, email: String, facebook: String, address: String },
      default: { phone: '', email: '', facebook: '', address: '' },
    },"""),
])
patch(ROOT + 'routes/settings.routes.ts', [
    ("""    // public: only active packages are visible
    packages: (s.packages || []).filter((p) => p.active),
    categories: s.categories,
  });""",
     """    // public: only active packages are visible
    packages: (s.packages || []).filter((p) => p.active),
    categories: s.categories,
    // v4.6 — contact info shown on the "contact us" page (edited from the admin account)
    contact: s.contact || { phone: '', email: '', facebook: '', address: '' },
  });"""),
])

print('ALL BACKEND PATCHES DONE')
