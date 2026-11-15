'use client';

/**
 * Site-wide text size control (A− / A+ in the header).
 * Scales the root font-size so every rem-based Tailwind size follows.
 */
export const FONT_STEPS = [0.9, 1, 1.12, 1.25] as const;
const KEY = 'slekni.fontscale';

type Listener = () => void;
const listeners = new Set<Listener>();

function clamp(i: number): number {
  return Math.min(FONT_STEPS.length - 1, Math.max(0, i));
}

function initial(): number {
  if (typeof window === 'undefined') return 1;
  try {
    const v = Number(localStorage.getItem(KEY));
    if (v >= 0 && v < FONT_STEPS.length) return v;
  } catch {}
  return 1;
}

let index = 0;
let hydrated = false;

function ensureHydrated(): void {
  if (hydrated || typeof window === 'undefined') return;
  hydrated = true;
  index = initial();
  apply();
}

function apply(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.style.fontSize = `${FONT_STEPS[index] * 100}%`;
}

export function getFontIndex(): number {
  ensureHydrated();
  return index;
}

export function setFontIndex(i: number): void {
  index = clamp(i);
  apply();
  try { localStorage.setItem(KEY, String(index)); } catch {}
  listeners.forEach((l) => l());
}

export function fontUp(): void { setFontIndex(getFontIndex() + 1); }
export function fontDown(): void { setFontIndex(getFontIndex() - 1); }

export function subscribeFont(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
