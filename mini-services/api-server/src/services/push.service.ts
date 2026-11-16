import webpush from 'web-push';
import { env } from '../config/env';
import { PushSubscription } from '../models/pushsubscription.model';
import { Settings } from '../models/settings.model';

/**
 * v4.15 — self-healing VAPID configuration:
 *  1) explicit VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY env vars win when present;
 *  2) otherwise the keys are generated ONCE and persisted in the settings
 *     document, so background push works out of the box on any deployment
 *     (Railway) without touching the environment — subscriptions survive
 *     restarts because the same keys keep being served.
 */
let cached: { publicKey: string; privateKey: string; subject: string } | null = null;

async function configure(): Promise<boolean> {
  if (cached) return true;
  try {
    if (env.vapid.publicKey && env.vapid.privateKey) {
      cached = { publicKey: env.vapid.publicKey, privateKey: env.vapid.privateKey, subject: env.vapid.subject };
    } else {
      let s = await Settings.findOne({ key: 'main' }).select('vapid');
      if (!s) s = await Settings.create({ key: 'main' });
      const stored = (s as any).vapid as { publicKey?: string; privateKey?: string } | undefined;
      if (stored?.publicKey && stored?.privateKey) {
        cached = { publicKey: stored.publicKey, privateKey: stored.privateKey, subject: env.vapid.subject };
      } else {
        const keys = webpush.generateVAPIDKeys();
        await Settings.updateOne(
          { key: 'main' },
          { $set: { vapid: { publicKey: keys.publicKey, privateKey: keys.privateKey } } },
          { upsert: true }
        );
        cached = { publicKey: keys.publicKey, privateKey: keys.privateKey, subject: env.vapid.subject };
        console.log('[push] generated + persisted new VAPID keys');
      }
    }
    webpush.setVapidDetails(cached.subject, cached.publicKey, cached.privateKey);
    return true;
  } catch (err) {
    console.error('[push] vapid setup failed (ignored)', err);
    return false;
  }
}

/** Public VAPID key for the browser subscription (null = push unavailable). */
export async function getVapidPublicKey(): Promise<string | null> {
  const ok = await configure();
  return ok ? cached!.publicKey : null;
}

/** Fire-and-forget push. Never throws. Deletes stale subs on 404/410. */
export async function pushToUser(userId: unknown, payload: Record<string, unknown>): Promise<void> {
  if (!(await configure())) return;
  try {
    const subs = await PushSubscription.find({ user: userId });
    const body = JSON.stringify(payload);
    await Promise.allSettled(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys } as any, body);
        } catch (err: any) {
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await PushSubscription.deleteOne({ _id: s._id }).catch(() => {});
          }
        }
      })
    );
  } catch (err) {
    console.error('[push] failed (ignored)', err);
  }
}

export function pushPayload(type: string, data: Record<string, unknown>) {
  return { type, data };
}
