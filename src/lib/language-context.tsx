'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';
import { Lang, LANGS, isRtl, translate } from '@/lib/i18n';
import { applyAccent } from '@/lib/theme-accents';
import { useApp } from '@/store/app';
import { api } from '@/lib/api';

interface LangCtx {
  lang: Lang;
  enabledLangs: Lang[];
  setLang: (l: Lang) => void;
  toggleEnabled: (l: Lang) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const ALL: Lang[] = ['ar', 'fr', 'en'];
const DEFAULT: LangStore = { lang: 'ar', enabled: ALL };

interface LangStore {
  lang: Lang;
  enabled: Lang[];
}

/* ---- tiny external store (useSyncExternalStore pattern) ---- */
let store: LangStore = DEFAULT;
let hydrated = false;
const listeners = new Set<() => void>();

function ensureHydrated(): LangStore {
  if (hydrated || typeof window === 'undefined') return store;
  hydrated = true;
  let lang = store.lang;
  let enabled = store.enabled;
  const saved = localStorage.getItem('slekni.lang') as Lang | null;
  if (saved && ALL.includes(saved)) lang = saved;
  try {
    const raw = localStorage.getItem('slekni.enabledLangs');
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length > 0 && arr.every((x: string) => ALL.includes(x as Lang))) enabled = arr;
    }
  } catch {}
  if (lang !== store.lang || enabled !== store.enabled) {
    store = { lang, enabled };
  }
  return store;
}

function getSnapshot(): LangStore {
  ensureHydrated();
  return store;
}

function getServerSnapshot(): LangStore {
  return DEFAULT;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function update(next: Partial<LangStore>): void {
  store = { ...store, ...next };
  try {
    localStorage.setItem('slekni.lang', store.lang);
    localStorage.setItem('slekni.enabledLangs', JSON.stringify(store.enabled));
  } catch {}
  listeners.forEach((l) => l());
}

/* ---- server-side preference adoption (called from effect; no setState) ---- */
function adoptServerLanguages(languages: string[] | undefined): void {
  if (!languages || languages.length === 0) return;
  const valid = languages.filter((l): l is Lang => ALL.includes(l as Lang));
  if (valid.length > 0 && valid.join() !== store.enabled.join()) {
    store = { ...store, enabled: valid };
    if (!valid.includes(store.lang)) store = { ...store, lang: valid[0] };
    listeners.forEach((l) => l());
  }
}

/* ---- react context ---- */
const Ctx = createContext<LangCtx | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const user = useApp((s) => s.user);
  const userLangs = user?.languages;

  // adopt server prefs when the session loads — MUST run in an effect: calling the
  // external-store listeners during render triggered React's setstate-in-render error
  useEffect(() => {
    if (userLangs) adoptServerLanguages(userLangs);
    // v4.9 — the account's saved interface colour follows the user onto every device
    const saved = user?.uiTheme;
    if (saved) applyAccent(saved);
  }, [userLangs, user?.uiTheme]);

  // reflect lang on <html> (external system — allowed inside effect)
  useEffect(() => {
    const html = document.documentElement;
    html.lang = snap.lang;
    html.dir = isRtl(snap.lang) ? 'rtl' : 'ltr';
  }, [snap.lang]);

  // the service worker asks the open page for the UI language when a push arrives,
  // so background notifications are shown in the user's chosen language
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === 'get-lang' && e.ports?.[0]) e.ports[0].postMessage(snap.lang);
    };
    navigator.serviceWorker.addEventListener('message', onMsg);
    return () => navigator.serviceWorker.removeEventListener('message', onMsg);
  }, [snap.lang]);

  const setLang = useCallback((l: Lang) => update({ lang: l }), []);

  const toggleEnabled = useCallback(
    (l: Lang) => {
      const s = getSnapshot();
      if (s.enabled.includes(l)) {
        if (s.enabled.length === 1) return; // at least one language stays on
        const enabled = s.enabled.filter((x) => x !== l);
        update({ enabled, lang: enabled.includes(s.lang) ? s.lang : enabled[0] });
      } else {
        update({ enabled: [...s.enabled, l] });
      }
    },
    []
  );

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => translate(snap.lang, key, params),
    [snap.lang]
  );

  const value = useMemo(
    () => ({ lang: snap.lang, enabledLangs: snap.enabled, setLang, toggleEnabled, t }),
    [snap, setLang, toggleEnabled, t]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLang(): LangCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLang outside LanguageProvider');
  return ctx;
}

export { LANGS };
