/* Slekni service worker: web-push display + offline shell */
const CACHE = 'slekni-v4-15';
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

/* Push notifications — always-on background delivery, in the user's chosen language */
const TITLES = {
  new_offer_match: { ar: 'عرض جديد يناسبك!', fr: 'Nouvelle offre !', en: 'New offer for you!' },
  offer_accepted: { ar: 'تم قبول عرضك', fr: 'Offre acceptée', en: 'Your offer was accepted' },
  offer_awaiting: { ar: 'بانتظار تأكيدك', fr: 'En attente de confirmation', en: 'Awaiting your confirmation' },
  offer_done: { ar: 'تم تأكيد الإنجاز', fr: 'Travail confirmé', en: 'Task completion confirmed' },
  offer_cancelled: { ar: 'أُلغي عرض', fr: 'Offre annulée', en: 'An offer was cancelled' },
  subscription_pending: { ar: 'طلب اشتراك جديد', fr: 'Nouvelle demande', en: 'New subscription request' },
  subscription_confirmed: { ar: 'تم تأكيد اشتراكك', fr: 'Abonnement confirmé', en: 'Subscription confirmed' },
  subscription_rejected: { ar: 'تم رفض اشتراكك', fr: 'Abonnement refusé', en: 'Subscription rejected' },
  // v4.15 — dues payment-proof lifecycle
  dues_proof_submitted: { ar: 'إثبات سداد جديد', fr: 'Nouveau justificatif', en: 'New payment proof' },
  dues_proof_approved: { ar: 'تم تأكيد سداد مستحقاتك', fr: 'Paiement confirmé', en: 'Dues payment confirmed' },
  dues_proof_rejected: { ar: 'تعذر تأكيد إثبات السداد', fr: 'Justificatif refusé', en: 'Payment proof rejected' },
  id_pending: { ar: 'طلب توثيق حساب جديد', fr: 'Nouvelle demande de vérification', en: 'New verification request' },
  complaint_new: { ar: 'شكوى جديدة', fr: 'Nouvelle réclamation', en: 'New complaint' },
  complaint_resolved: { ar: 'تمت معالجة شكواك', fr: 'Réclamation traitée', en: 'Your complaint was resolved' },
  broadcast: { ar: 'إعلان', fr: 'Annonce', en: 'Announcement' },
  system: { ar: 'سلكني ونسلكك', fr: 'Selekni w Nselkek', en: 'Selekni w Nselkek' },
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
      const titles = TITLES[type] || TITLES.system;
      const title = pickL(d, 'title', lang) || titles[lang] || titles.ar || 'Selekni w Nselkek';
      let body = pickL(d, 'body', lang) || d.offerTitle || '';
      if (type === 'complaint_resolved' && d.resolution) body = `${d.subject || ''} — ${d.resolution}`;
      if (type === 'complaint_new' && d.subject) body = `${d.actorName || ''}: ${d.subject}`;
      const offerId = d.offerId || '';

      return self.registration.showNotification(String(title), {
        body: String(body).slice(0, 180),
        icon: '/icons/icon-192.png?v=3',
        badge: '/icons/icon-192.png?v=3',
        vibrate: [100, 50, 100],
        data: { type, offerId },
        tag: offerId || type,
      });
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const offerId = event.notification.data?.offerId;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          client.postMessage({ type: 'notificationclick', offerId });
          return client.focus();
        }
      }
      return self.clients.openWindow(offerId ? `/?offer=${offerId}` : '/');
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
