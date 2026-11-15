'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createPortal } from 'react-dom';
import { BellRing, LoaderCircle, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { api, mediaUrl } from '@/lib/api';
import { useApp, addDismissed, getDismissed } from '@/store/app';
import { useLang } from '@/lib/language-context';
import { playAlertSound } from '@/lib/sound';
import { Offer } from '@/lib/types';
import { AmountPill, StatusBadge, timeAgo } from '@/components/app/ui-bits';
import { ImageGallery } from '@/components/app/ImageGallery';
import { Button } from '@/components/ui/button';
import { wilayaShort } from '@/lib/wilayas';

/**
 * Watches for brand-new open offers and pops them up for every job seeker at
 * the same time — with the alert sound, an accept button and a skip button.
 * Also fires right after login for offers the seeker has not skipped yet.
 */
export function LiveOfferWatcher() {
  const user = useApp((s) => s.user);
  const setLiveOffer = useApp((s) => s.setLiveOffer);
  const setLiveTaken = useApp((s) => s.setLiveTaken);
  const liveOffer = useApp((s) => s.liveOffer);
  const liveState = useApp((s) => s.liveState);
  const qc = useQueryClient();
  const lastId = useRef<string | null>(null);
  const takenShown = useRef(false);

  const enabled = Boolean(user && user.role === 'seeker' && user.profileComplete !== false);

  const { data } = useQuery({
    queryKey: ['live-offer', user?._id],
    queryFn: () => api.get<{ offer: Offer | null }>('/offers/live'),
    enabled,
    refetchInterval: 8000,
  });

  useEffect(() => {
    if (!enabled || !data) return;
    const offer = data.offer;
    const uid = user!._id;

    if (!offer) {
      // the popup was showing something that is no longer open → it was taken
      if (liveOffer && liveState === 'view') setLiveTaken();
      lastId.current = null;
      return;
    }
    if (offer._id === lastId.current) return;

    const dismissed = getDismissed(uid);
    if (dismissed.includes(offer._id)) {
      if (liveOffer && liveState === 'view' && offer._id !== liveOffer._id) setLiveTaken();
      lastId.current = offer._id;
      return;
    }

    lastId.current = offer._id;
    takenShown.current = false;
    qc.invalidateQueries({ queryKey: ['feed'] });
    playAlertSound();
    setLiveOffer(offer);
     
  }, [data, enabled]);

  // poll detected the open offer vanished while the viewer had the popup open
  useEffect(() => {
    if (liveState !== 'taken') takenShown.current = false;
  }, [liveState]);

  return null;
}

/** The popup itself — centered modal with all offer details + accept / skip. */
export function LiveOfferModal() {
  const { t, lang } = useLang();
  const user = useApp((s) => s.user);
  const liveOffer = useApp((s) => s.liveOffer);
  const liveState = useApp((s) => s.liveState);
  const setLiveTaken = useApp((s) => s.setLiveTaken);
  const hideLive = useApp((s) => s.hideLive);
  const bumpFeed = useApp((s) => s.bumpFeed);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  // auto-close the "taken" message after a few seconds
  useEffect(() => {
    if (liveState !== 'taken') return;
    const id = setTimeout(() => hideLive(), 4000);
    return () => clearTimeout(id);
  }, [liveState, hideLive]);

  if (!user || liveState === 'hidden' || !liveOffer) return null;

  async function accept() {
    if (!liveOffer) return;
    setBusy(true);
    try {
      const updated = await api.post<Offer>(`/offers/${liveOffer._id}/accept`);
      toast.success(t('accepted'));
      qc.invalidateQueries({ queryKey: ['feed'] });
      qc.invalidateQueries({ queryKey: ['my-tasks'] });
      qc.invalidateQueries({ queryKey: ['notifications-unread'] });
      bumpFeed();
      hideLive();
      useApp.getState().openOfferDetail(updated._id);
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === 'ALREADY_TAKEN') {
        setLiveTaken();
        qc.invalidateQueries({ queryKey: ['feed'] });
      } else {
        toast.error(t('error'));
      }
    } finally {
      setBusy(false);
    }
  }

  function skip() {
    if (liveOffer) addDismissed(user!._id, liveOffer._id);
    hideLive();
    bumpFeed();
  }

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[85] flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-200" />
      <div className="relative w-full sm:max-w-md max-h-[92dvh] rounded-t-3xl sm:rounded-3xl bg-background border shadow-2xl overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-6 duration-300">
        {liveState === 'taken' ? (
          <div className="p-7 text-center space-y-4">
            <div className="mx-auto h-16 w-16 rounded-2xl bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center">
              <BellRing className="h-8 w-8 text-rose-600 dark:text-rose-400" />
            </div>
            <p className="text-[15px] font-semibold leading-relaxed break-words">{t('offerTakenMsg')}</p>
            <Button onClick={hideLive} variant="outline" className="w-full h-11 rounded-xl font-bold">
              {t('close')}
            </Button>
          </div>
        ) : (
          <>
            <div className="px-5 pt-4 pb-3 border-b flex items-center gap-3 shrink-0">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-3 py-1 text-xs font-extrabold animate-pulse">
                <BellRing className="h-3.5 w-3.5" /> {t('liveBadge')}
              </span>
              <span className="text-sm font-bold text-muted-foreground">{t('liveTitle')}</span>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
              {liveOffer.images?.length > 0 && <ImageGallery offerId={liveOffer._id} images={liveOffer.images} alt={liveOffer.title} />}
              {liveOffer.videos?.length > 0 && (
                <video
                  src={mediaUrl(`/media/video/${liveOffer._id}/${liveOffer.videos[0].gridId}`)}
                  controls
                  playsInline
                  preload="metadata"
                  className="w-full max-h-64 rounded-2xl border bg-black"
                />
              )}

              <div className="flex items-start justify-between gap-3">
                <h3 className="font-extrabold text-lg leading-snug break-words">{liveOffer.title}</h3>
                <AmountPill amount={liveOffer.amountDA} className="shrink-0 text-base" />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={liveOffer.status} t={t} />
                {liveOffer.wilaya && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-semibold">
                    <MapPin className="h-3.5 w-3.5" /> {wilayaShort(liveOffer.wilaya, lang)}
                  </span>
                )}
                <span className="text-xs text-muted-foreground ms-auto">{timeAgo(liveOffer.createdAt, t)}</span>
              </div>

              <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">{liveOffer.description}</p>
              <p className="text-[11px] text-muted-foreground">{t('showAddress')}</p>
            </div>

            <div className="border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))] grid grid-cols-[1fr_auto] gap-2.5 shrink-0">
              <Button onClick={accept} disabled={busy} className="h-12 rounded-xl font-extrabold text-base shadow-lg shadow-primary/25">
                {busy && <LoaderCircle className="h-5 w-5 animate-spin" />}
                {t('acceptOffer')}
              </Button>
              <Button onClick={skip} variant="outline" disabled={busy} className="h-12 rounded-xl font-bold px-5">
                {t('skipNow')}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

