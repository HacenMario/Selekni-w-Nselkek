'use client';

import { api } from './api';

/**
 * v4.15 — fully self-contained background push:
 *  - the VAPID public key is fetched from the server (GET /notifications/vapid-public),
 *    so no build-time env var is needed and the key follows the deployment;
 *  - the subscription is (re)posted to the server on every login/boot —
 *    browsers rotate the endpoint silently, so we resync when the app opens;
 *  - the service worker asks the open page to resubscribe via
 *    'pushsubscriptionchange' (see sw.js) — SwMessageBridge relays it.
 */

let cachedKey: string | null = null;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    return reg;
  } catch {
    return null;
  }
}

/** The server's VAPID public key (cached in the session; null = push unavailable). */
async function getVapidPublicKey(): Promise<string | null> {
  if (cachedKey) return cachedKey;
  try {
    const res = await api.get<{ publicKey: string }>('/notifications/vapid-public');
    cachedKey = res.publicKey || null;
  } catch {
    cachedKey = null;
  }
  return cachedKey;
}

/** Ask the OS for notification permission — MUST be called from a user gesture. */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
  return Notification.requestPermission();
}

/**
 * Subscribe this device to background push (idempotent):
 * permission prompt → push subscription → POSTed to the server and bound
 * to the logged-in account. Returns the resulting state.
 */
export async function subscribePush(): Promise<'granted' | 'denied' | 'unsupported'> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return 'unsupported';
  }
  const key = await getVapidPublicKey();
  if (!key) return 'unsupported';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
    });
  }
  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh: string; auth: string } };
  if (json.endpoint && json.keys) {
    await api.post('/notifications/subscribe', { endpoint: json.endpoint, keys: json.keys });
  }
  return 'granted';
}

/**
 * v4.15 — silent subscription keeper: when the user already granted permission,
 * make sure the server still holds a live subscription (browser endpoints rotate,
 * service workers can be re-registered). Safe to call on boot / focus / online.
 */
export async function ensurePushSubscribed(): Promise<void> {
  try {
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (Notification.permission !== 'granted') return; // never prompt silently
    const key = await getVapidPublicKey();
    if (!key) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) {
      // permission granted but the subscription vanished (cleared data, rotated keys) — rebuild it
      await subscribePush();
      return;
    }
    const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh: string; auth: string } };
    if (json.endpoint && json.keys) {
      await api.post('/notifications/subscribe', { endpoint: json.endpoint, keys: json.keys });
    }
  } catch {
    /* silent — push is an enhancement, never block the UI */
  }
}

export async function unsubscribePush(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      const json = sub.toJSON() as { endpoint?: string };
      if (json.endpoint) await api.del('/notifications/subscribe', { endpoint: json.endpoint });
      await sub.unsubscribe();
    }
  } catch {}
}

export async function isPushSubscribed(): Promise<boolean> {
  try {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return false;
    const reg = await navigator.serviceWorker.ready;
    return !!(await reg.pushManager.getSubscription());
  } catch {
    return false;
  }
}
