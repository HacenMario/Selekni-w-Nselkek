/** v4.9 — accent palettes (pure data + DOM helpers, no React) shared by the
 * theme dialog and the language-context server adoption. CSS overrides live in
 * globals.css under html[data-accent='…'] / .dark[data-accent='…']. */

export const ACCENTS = [
  { key: 'violet', from: '#7c3aed', to: '#4c1d95' },
  { key: 'indigo', from: '#6366f1', to: '#312e81' },
  { key: 'blue', from: '#3b82f6', to: '#1e3a8a' },
  { key: 'cyan', from: '#06b6d4', to: '#164e63' },
  { key: 'teal', from: '#14b8a6', to: '#134e4a' },
  { key: 'emerald', from: '#10b981', to: '#064e3b' },
  { key: 'amber', from: '#f59e0b', to: '#78350f' },
  { key: 'orange', from: '#f97316', to: '#7c2d12' },
  { key: 'rose', from: '#f43f5e', to: '#881337' },
  { key: 'pink', from: '#ec4899', to: '#831843' },
] as const;

export type AccentKey = (typeof ACCENTS)[number]['key'];

export const DEFAULT_ACCENT: AccentKey = 'violet';

const LS_KEY = 'slekni.accent';

export function currentAccent(): string {
  if (typeof window === 'undefined') return DEFAULT_ACCENT;
  try {
    const v = localStorage.getItem(LS_KEY);
    return ACCENTS.some((a) => a.key === v) ? (v as string) : DEFAULT_ACCENT;
  } catch {
    return DEFAULT_ACCENT;
  }
}

/** Apply the accent to <html> (data-accent) and persist it locally. */
export function applyAccent(key: string): void {
  if (typeof document !== 'undefined') {
    if (key === DEFAULT_ACCENT) delete document.documentElement.dataset.accent;
    else document.documentElement.dataset.accent = key;
  }
  try {
    localStorage.setItem(LS_KEY, key);
  } catch {
    /* private mode — in-memory only */
  }
}
