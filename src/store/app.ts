'use client';

import { create } from 'zustand';
import { User, Offer } from '@/lib/types';

export type Screen = 'splash' | 'auth' | 'interests' | 'main';
// v4.14 — 'subscription' tab replaced by 'dues' (commission model)
export type Tab = 'feed' | 'tasks' | 'offers' | 'dues' | 'notifications' | 'profile' | 'contact' | 'admin';
export type AdminTab = 'dashboard' | 'dues' | 'complaints' | 'users' | 'offers' | 'settings' | 'broadcast';
export type LiveState = 'hidden' | 'view' | 'taken';

interface AppState {
  screen: Screen;
  tab: Tab;
  adminTab: AdminTab;
  user: User | null;
  booted: boolean;
  detailOfferId: string | null;
  refreshFeedNonce: number;
  liveOffer: Offer | null;
  liveState: LiveState;
  setScreen: (s: Screen) => void;
  setTab: (t: Tab) => void;
  setAdminTab: (t: AdminTab) => void;
  setUser: (u: User | null) => void;
  setBooted: (b: boolean) => void;
  openOfferDetail: (id: string) => void;
  closeOfferDetail: () => void;
  bumpFeed: () => void;
  setLiveOffer: (o: Offer | null) => void;
  setLiveTaken: () => void;
  hideLive: () => void;
}

export const useApp = create<AppState>((set) => ({
  screen: 'splash',
  tab: 'feed',
  adminTab: 'dashboard',
  user: null,
  booted: false,
  detailOfferId: null,
  refreshFeedNonce: 0,
  liveOffer: null,
  liveState: 'hidden',
  setScreen: (s) => set({ screen: s }),
  setTab: (t) => set({ tab: t }),
  setAdminTab: (t) => set({ adminTab: t }),
  setUser: (u) => set({ user: u }),
  setBooted: (b) => set({ booted: b }),
  openOfferDetail: (id) => set({ detailOfferId: id }),
  closeOfferDetail: () => set({ detailOfferId: null }),
  bumpFeed: () => set((st) => ({ refreshFeedNonce: st.refreshFeedNonce + 1 })),
  setLiveOffer: (o) => set({ liveOffer: o, liveState: o ? 'view' : 'hidden' }),
  setLiveTaken: () => set({ liveState: 'taken' }),
  hideLive: () => set({ liveOffer: null, liveState: 'hidden' }),
}));

/* ---- per-user dismissed live offers (localStorage) ---- */
export function dismissedKey(userId: string): string {
  return `slekni.dismissed.${userId}`;
}

export function getDismissed(userId: string): string[] {
  try {
    const raw = localStorage.getItem(dismissedKey(userId));
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function addDismissed(userId: string, offerId: string): void {
  try {
    const arr = getDismissed(userId);
    if (!arr.includes(offerId)) arr.push(offerId);
    localStorage.setItem(dismissedKey(userId), JSON.stringify(arr.slice(-300)));
  } catch {}
}
