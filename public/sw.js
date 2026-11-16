/* Slekni service worker: web-push display + offline shell */
importScripts('/sw-i18n.js');
const CACHE = 'slekni-v4-16';
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png?v=3', '/icons/icon-512.png?v=3'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // never cache API or cross-origin media
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api')) return;

  // stale-while-revalidate for shell & assets
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      const fetchPromise = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

/* Push notifications — always-on background delivery, richly detailed and in the
   reader's chosen language (all 9) via SW_NOTIF (public/sw-i18n.js). */
const APP_NAME = { ar: 'سلكني ونسلكك', fr: 'Selekni w Nselkek', en: 'Selekni w Nselkek' };

/** amount → grouped digits (the templates already carry the DA / دج unit). */
function fmt(n) {
  try { return Number(n || 0).toLocaleString('fr-DZ'); } catch { return String(n || 0); }
}

/** v4.16 — payload data → template parameters, mirroring the in-app notification texts. */
const PARAMS = {
  new_offer_match: (d) => ({ actor: d.actorName || d.actor || '', title: d.offerTitle || '', amount: fmt(d.amountDA) }),
  offer_accepted: (d) => ({ actor: d.actorName || d.actor || '', title: d.offerTitle || '' }),
  offer_awaiting: (d) => ({ actor: d.actorName || d.actor || '', title: d.offerTitle || '' }),
  offer_done: (d) => ({ title: d.offerTitle || '', amount: fmt(d.amountDA) }),
  offer_cancelled: (d) => ({ title: d.offerTitle || '' }),
  dues_reminder: (d) => ({ amount: fmt(d.amountDA), month: d.month || '' }),
  dues_paid: (d) => ({ amount: fmt(d.amountDA), month: d.month || '' }),
  dues_proof_submitted: (d) => ({ actor: d.actorName || d.actor || '', amount: fmt(d.amountDA), month: d.month || '' }),
  dues_proof_approved: (d) => ({ amount: fmt(d.amountDA), month: d.month || '' }),
  dues_proof_rejected: (d) => ({ month: d.month || '' }),
  id_pending: (d) => ({ actor: d.actorName || d.actor || '' }),
  complaint_new: (d) => ({ actorName: d.actorName || d.actor || '', subject: d.subject || '' }),
  complaint_resolved: (d) => ({ subject: d.subject || '' }),
};

function fill(tpl, params) {
  return String(tpl || '').replace(/\{(\w+)\}/g, (m, k) => (params && params[k] !== undefined && params[k] !== '') ? params[k] : m);
}

/** v4.16 — exact deep-link routing on tap (mirrors the in-app notification routing). */
const NAV = {
  dues_reminder: 'dues',
  dues_paid: 'dues',
  dues_proof_approved: 'dues',
  dues_proof_rejected: 'dues',
  dues_proof_submitted: 'admin-dues',
  id_pending: 'id-review',
  complaint_new: 'admin-complaints',
};

/** Ask any open app window for the UI language (the page answers via postMessage). */
function getUiLang() {
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    if (!cs.length) return 'ar';
    return Promise.race([
      new Promise((resolve) => {
        const ch = new MessageChannel();
        const timer = setTimeout(() => resolve('ar'), 400);
        ch.port1.onmessage = (e) => { clearTimeout(timer); resolve(e.data || 'ar'); };
        try { cs[0].postMessage({ type: 'get-lang' }, [ch.port2]); } catch { clearTimeout(timer); resolve('ar'); }
      }),
      new Promise((resolve) => setTimeout(() => resolve('ar'), 500)),
    ]).catch(() => 'ar');
  }).catch(() => 'ar');
}

/** Trilingual data helper — titleAr/titleFr/titleEn style keys, falls back to the plain key. */
function pickL(d, base, lang) {
  const suffix = lang === 'fr' ? 'Fr' : lang === 'en' ? 'En' : 'Ar';
  const v = d[base + suffix] !== undefined ? d[base + suffix] : d[base];
  return v ? String(v) : '';
}

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { data: { body: event.data ? event.data.text() : '' } };
  }
  const d = payload.data || payload || {};
  const type = d.type || 'system';

  event.waitUntil(
    getUiLang().then((lang) => {
      const pack = self.SW_NOTIF && (self.SW_NOTIF[lang] || self.SW_NOTIF.ar);
      const entry = pack && pack[type];
      let title;
      let body;
      if (type === 'broadcast' || type === 'system') {
        // administration messages carry their own per-language data (Ar/Fr/En)
        title = pickL(d, 'title', lang) || APP_NAME[lang] || APP_NAME.en;
        body = pickL(d, 'body', lang);
      } else if (entry) {
        title = entry.t;
        body = fill(entry.b, PARAMS[type] ? PARAMS[type](d) : {});
      } else {
        // unknown type: a neutral title with whatever detail the payload carries
        title = APP_NAME[lang] || APP_NAME.en;
        body = d.offerTitle || d.subject || pickL(d, 'title', lang) || '';
      }
      const offerId = d.offerId ? String(d.offerId) : '';
      const month = d.month ? String(d.month) : '';
      const nav = NAV[type] || (offerId ? 'offer' : '');

      return self.registration.showNotification(String(title), {
        body: String(body || '').slice(0, 240),
        icon: '/icons/icon-192.png?v=4',
        badge: '/icons/icon-192.png?v=4',
        vibrate: [90, 50, 90],
        lang, // helps the OS pick the right rendering/voice for the text
        tag: `${type}:${offerId || month || ''}`.slice(0, 64),
        renotify: true, // same kind of event re-alerts instead of silently replacing
        data: { type, offerId, month, nav },
      });
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const offerId = data.offerId;
  const nav = data.nav || (offerId ? 'offer' : '');
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          client.postMessage({ type: 'notificationclick', offerId, nav });
          return client.focus();
        }
      }
      const q = nav ? `?nav=${encodeURIComponent(nav)}${offerId ? `&offer=${encodeURIComponent(offerId)}` : ''}` : (offerId ? `/?offer=${encodeURIComponent(offerId)}` : '/');
      return self.clients.openWindow(nav || offerId ? `/${q}` : '/');
    })
  );
});

/* v4.15 — the browser rotated/revoked the push subscription in the background:
   ask any open app window to rebuild and re-upload it (ensurePushSubscribed).
   If the app is closed, the subscription is rebuilt on the next app start. */
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) client.postMessage({ type: 'resubscribe-push' });
      return Promise.resolve();
    }).catch(() => {})
  );
});
