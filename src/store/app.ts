'use client';

import { create } from 'zustand';
import { User, Offer } from '@/lib/types';

export type Screen = 'splash' | 'auth' | 'interests' | 'main';
// v4.14 — 'subscription' tab replaced by 'dues' (commission model)
// v4.15 — 'notifications' left the bottom bar: the bell in the header opens its panel
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
  /** v4.15 — visited tabs (newest last) powering the elegant back button. */
  tabHistory: Tab[];
  notifPanelOpen: boolean;
  /** v4.15 — the "create offer" overlay (shared so overlays never stack). */
  creating: boolean;
  setScreen: (s: Screen) => void;
  setTab: (t: Tab) => void;
  back: () => void;
  setAdminTab: (t: AdminTab) => void;
  setUser: (u: User | null) => void;
  setBooted: (b: boolean) => void;
  openOfferDetail: (id: string) => void;
  closeOfferDetail: () => void;
  bumpFeed: () => void;
  setLiveOffer: (o: Offer | null) => void;
  setLiveTaken: () => void;
  hideLive: () => void;
  setNotifPanel: (open: boolean) => void;
  setCreating: (v: boolean) => void;
}

export const useApp = create<AppState>((set, get) => ({
  screen: 'splash',
  tab: 'feed',
  adminTab: 'dashboard',
  user: null,
  booted: false,
  detailOfferId: null,
  refreshFeedNonce: 0,
  liveOffer: null,
  liveState: 'hidden',
  tabHistory: [],
  notifPanelOpen: false,
  creating: false,
  setScreen: (s) => set({ screen: s }),
  setTab: (t) =>
    set((st) => {
      // record navigation so the back button can return to the previous page
      const hist = st.tab === t ? st.tabHistory : [...st.tabHistory.slice(-19), st.tab];
      return { tab: t, tabHistory: hist };
    }),
  back: () => {
    const { tabHistory, tab } = get();
    // walk from the newest entry back, skipping repeats of the current tab
    const hist = [...tabHistory];
    while (hist.length > 0 && hist[hist.length - 1] === tab) hist.pop();
    if (hist.length === 0) return;
    const prev = hist.pop() as Tab;
    set({ tab: prev, tabHistory: hist });
  },
  setAdminTab: (t) => set({ adminTab: t }),
  setUser: (u) => set({ user: u }),
  setBooted: (b) => set({ booted: b }),
  openOfferDetail: (id) => set({ detailOfferId: id }),
  closeOfferDetail: () => set({ detailOfferId: null }),
  bumpFeed: () => set((st) => ({ refreshFeedNonce: st.refreshFeedNonce + 1 })),
  setLiveOffer: (o) => set({ liveOffer: o, liveState: o ? 'view' : 'hidden' }),
  setLiveTaken: () => set({ liveState: 'taken' }),
  hideLive: () => set({ liveOffer: null, liveState: 'hidden' }),
  setNotifPanel: (open) => set({ notifPanelOpen: open }),
  setCreating: (v) => set({ creating: v }),
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
