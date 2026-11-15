'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { X, Sparkles } from 'lucide-react';
import { useApp } from '@/store/app';
import { useLang } from '@/lib/language-context';
import { api } from '@/lib/api';
import { Subscription } from '@/lib/types';

/**
 * Floating promo bubble — only for task owners who have never sent a
 * subscription request. Shows once per day, closable, nudges toward the
 * subscription page.
 */
export function PromoBubble() {
  const { t } = useLang();
  const user = useApp((s) => s.user);
  const setTab = useApp((s) => s.setTab);
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);

  const ownerWithoutRequest = Boolean(
    user && user.role === 'owner' && user.profileComplete !== false && !user.isSuperAdmin
  );

  const { data } = useQuery({
    queryKey: ['my-subscription', 'promo'],
    queryFn: () => api.get<{ current: Subscription | null }>('/subscriptions/mine'),
    refetchInterval: 30_000, // no stale 'expired' state after an admin grant/activation
    enabled: ownerWithoutRequest,
    staleTime: 120_000,
  });

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 4000); // let the app settle first
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ownerWithoutRequest || !ready || !data || data.current) return;
    // defer the state update out of the effect body
    const id = setTimeout(() => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const last = localStorage.getItem('slekni.promo');
        if (last === today) return;
        localStorage.setItem('slekni.promo', today);
      } catch {}
      setVisible(true);
    }, 0);
    return () => clearTimeout(id);
  }, [ownerWithoutRequest, ready, data]);

  if (!visible || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed bottom-24 inset-x-3 z-[58] max-w-md mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary to-primary/75 text-primary-foreground shadow-xl shadow-primary/30 p-4 flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-extrabold text-sm leading-snug">{t('promoTitle')}</p>
          <p className="text-xs opacity-90 mt-1 leading-relaxed break-words">{t('promoBody')}</p>
          <button
            onClick={() => { setVisible(false); setTab('profile'); }}
            className="mt-2.5 inline-flex items-center rounded-full bg-white text-primary font-bold text-xs px-4 py-2 hover:scale-105 active:scale-95 transition-transform shadow"
          >
            {t('promoCta')}
          </button>
        </div>
        <button
          onClick={() => setVisible(false)}
          aria-label={t('close')}
          className="h-7 w-7 rounded-lg bg-white/15 flex items-center justify-center hover:bg-white/30 active:scale-90 transition-all shrink-0"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.4} />
        </button>
      </div>
    </div>,
    document.body
  );
}
