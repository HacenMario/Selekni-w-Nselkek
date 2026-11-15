import { Notification, INotification } from '../models/notification.model';
import { pushToUser, pushPayload } from './push.service';
import { User, IUser } from '../models/user.model';

export type NotificationType = INotification['type'];

/** Create in-app notifications + fire-and-forget web push. Never throws. */
export async function notifyUsers(
  users: (unknown | IUser)[],
  type: NotificationType,
  data: Record<string, unknown>
): Promise<void> {
  const ids = users.map((u) => (typeof u === 'object' && u !== null && '_id' in (u as any) ? (u as any)._id : u));
  if (ids.length === 0) return;
  try {
    const docs = ids.map((id) => ({ user: id, type, data }));
    await Notification.insertMany(docs, { ordered: false });
    // v4.10 — keep only the newest 150 notifications per user (free MongoDB tier protection)
    void pruneNotifications(ids as string[]);
    await Promise.allSettled(ids.map((id) => pushToUser(id, pushPayload(type, data))));
  } catch (err) {
    console.error('[notify] failed (ignored)', err);
  }
}

/** v4.10 — fire-and-forget: trim each user's inbox to the newest NOTIF_CAP docs. */
const NOTIF_CAP = 150;

async function pruneNotifications(ids: string[]): Promise<void> {
  try {
    for (const id of ids) {
      const count = await Notification.countDocuments({ user: id });
      if (count <= NOTIF_CAP) continue;
      const cutoffDoc = await Notification.find({ user: id }).sort({ createdAt: -1 }).skip(NOTIF_CAP).limit(1).select('createdAt');
      if (cutoffDoc[0]) {
        await Notification.deleteMany({ user: id, createdAt: { $lte: cutoffDoc[0].createdAt } });
      }
    }
  } catch (err) {
    console.error('[notify] prune failed (ignored)', err);
  }
}

/** Notify all super admins. */
export async function notifyAdmins(type: NotificationType, data: Record<string, unknown>): Promise<void> {
  try {
    const admins = await User.find({ isSuperAdmin: true, isBanned: false }).select('_id');
    await notifyUsers(admins.map((a) => a._id), type, data);
  } catch (err) {
    console.error('[notifyAdmins] failed (ignored)', err);
  }
}
