import webpush from 'web-push';
import { env } from '../config/env';
import { PushSubscription } from '../models/pushsubscription.model';

let configured = false;

function configure(): boolean {
  if (configured) return true;
  if (!env.vapid.publicKey || !env.vapid.privateKey) return false;
  webpush.setVapidDetails(env.vapid.subject, env.vapid.publicKey, env.vapid.privateKey);
  configured = true;
  return true;
}

/** Fire-and-forget push. Never throws. Deletes stale subs on 404/410. */
export async function pushToUser(userId: unknown, payload: Record<string, unknown>): Promise<void> {
  if (!configure()) return;
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
