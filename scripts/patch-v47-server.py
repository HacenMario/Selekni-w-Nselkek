#!/usr/bin/env python3
"""v4.7 server patches:
- granting / paid-activating / approving a subscription always clears subLocked,
  so the red 'your subscription was disabled' banner disappears the moment a new sub is live
- contact info: instagram replaces facebook end-to-end (model, interface, GET, PUT)"""
import io

def patch(path, pairs):
    p = '/home/z/my-project/mini-services/api-server/src/' + path
    s = io.open(p, encoding='utf-8').read()
    changed = 0
    for old, new in pairs:
        if new in s:
            print('SKIP', path, old[:44].replace('\n', ' '))
            continue
        assert s.count(old) == 1, f"{path}: expected 1 of {old[:70]!r}, found {s.count(old)}"
        s = s.replace(old, new)
        changed += 1
    io.open(p, 'w', encoding='utf-8').write(s)
    print('OK', path, changed, 'patches')

patch('routes/admin.routes.ts', [
    # decide → approve: a newly approved subscription re-enables the account automatically
    ("""  sub.decidedBy = req.user!._id;
  sub.decidedAt = new Date();
  await sub.save();
  await notifyUsers([sub.user], action === 'approve' ? 'subscription_confirmed' : 'subscription_rejected', {""",
     """  sub.decidedBy = req.user!._id;
  sub.decidedAt = new Date();
  await sub.save();
  // v4.7 — a live subscription clears the "disabled by administration" state right away
  if (action === 'approve') await User.updateOne({ _id: sub.user }, { $set: { subLocked: false } });
  await notifyUsers([sub.user], action === 'approve' ? 'subscription_confirmed' : 'subscription_rejected', {"""),
    # grant-sub (free): same rule
    ("""    decidedBy: req.user!._id,
    decidedAt: new Date(),
  });
  adminNotify(
    user._id,
    `تم منحك اشتراكاً مجانياً لمدة ${body.days} يوم`,""",
     """    decidedBy: req.user!._id,
    decidedAt: new Date(),
  });
  // v4.7 — the granted subscription lifts the "disabled" state instantly
  await User.updateOne({ _id: user._id }, { $set: { subLocked: false } });
  adminNotify(
    user._id,
    `تم منحك اشتراكاً مجانياً لمدة ${body.days} يوم`,"""),
    # activate-sub (paid): same rule
    ("""    decidedBy: req.user!._id,
    decidedAt: new Date(),
  });
  adminNotify(
    user._id,
    `تم تفعيل اشتراكك لمدة ${body.days} يوم — شكراً لك`,""",
     """    decidedBy: req.user!._id,
    decidedAt: new Date(),
  });
  // v4.7 — the paid activation lifts the "disabled" state instantly
  await User.updateOne({ _id: user._id }, { $set: { subLocked: false } });
  adminNotify(
    user._id,
    `تم تفعيل اشتراكك لمدة ${body.days} يوم — شكراً لك`,"""),
    # contact info schema: instagram instead of facebook
    ("""    contact: z.object({
      phone: z.string().max(40).optional(),
      email: z.string().max(120).optional(),
      facebook: z.string().max(200).optional(),
      address: z.string().max(200).optional(),
    }).optional(),""",
     """    contact: z.object({
      phone: z.string().max(40).optional(),
      email: z.string().max(120).optional(),
      instagram: z.string().max(200).optional(),
      address: z.string().max(200).optional(),
    }).optional(),"""),
])

patch('routes/subscriptions.routes.ts', [])
patch('models/settings.model.ts', [
    ("""  contact: {
    phone: string;
    email: string;
    facebook: string;
    address: string;
  };""",
     """  contact: {
    phone: string;
    email: string;
    instagram: string;
    address: string;
  };"""),
    ("""    contact: {
      type: { phone: String, email: String, facebook: String, address: String },
      default: { phone: '', email: '', facebook: '', address: '' },
    },""",
     """    contact: {
      type: { phone: String, email: String, instagram: String, address: String },
      default: { phone: '', email: '', instagram: '', address: '' },
    },"""),
])
patch('routes/settings.routes.ts', [
    ("""    contact: s.contact || { phone: '', email: '', facebook: '', address: '' },""",
     """    contact: s.contact || { phone: '', email: '', instagram: '', address: '' },"""),
])
print('SERVER PATCHES DONE')
