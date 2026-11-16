'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApp } from '@/store/app';
import { useLang } from '@/lib/language-context';
import { api, mediaUrl } from '@/lib/api';
import { Complaint, Offer, Settings } from '@/lib/types';
import { AmountPill, StatusBadge, timeAgo } from '@/components/app/ui-bits';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoaderCircle, MapPin, CalendarDays, HandCoins, Navigation, ShieldCheck, MessageSquareWarning, Users } from 'lucide-react';
import { toast } from 'sonner';
import { ImageGallery } from '@/components/app/ImageGallery';
import { UserCard } from '@/components/app/UserCard';
import { wilayaShort } from '@/lib/wilayas';

export function OfferDetailSheet() {
  const { t, lang } = useLang();
  const detailOfferId = useApp((s) => s.detailOfferId);
  const closeOfferDetail = useApp((s) => s.closeOfferDetail);
  const isSuperAdmin = useApp((s) => s.user?.isSuperAdmin ?? false);
  const qc = useQueryClient();
  const [busy, setBusy] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [confirmDoneOpen, setConfirmDoneOpen] = useState(false);
  const [complaintOpen, setComplaintOpen] = useState(false);
  const [cSubject, setCSubject] = useState('');
  const [cDesc, setCDesc] = useState('');

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<Settings>('/settings'),
    staleTime: 60_000,
  });

  const { data: offer, isLoading } = useQuery({
    queryKey: ['offer', detailOfferId],
    queryFn: () => api.get<Offer>(`/offers/${detailOfferId}`),
    enabled: !!detailOfferId,
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['offer', detailOfferId] });
    qc.invalidateQueries({ queryKey: ['feed'] });
    qc.invalidateQueries({ queryKey: ['my-offers'] });
    qc.invalidateQueries({ queryKey: ['my-tasks'] });
    qc.invalidateQueries({ queryKey: ['stats'] });
    qc.invalidateQueries({ queryKey: ['notifications-unread'] });
  }

  async function accept() {
    if (!offer) return;
    setBusy('accept');
    try {
      await api.post(`/offers/${offer._id}/accept`);
      toast.success(t('accepted'), { duration: 5000 });
      // v4.15 — close the sheet after accepting: the executor will continue the
      // flow from "my tasks" once the work is actually done, not right away
      closeOfferDetail();
      invalidate();
    } catch (e) {
      const code = (e as { code?: string }).code;
      toast.error(code === 'ALREADY_TAKEN' ? t('offerTakenMsg') : t('error'));
      invalidate();
    } finally {
      setBusy('');
    }
  }

  async function complete() {
    if (!offer) return;
    setBusy('complete');
    try {
      await api.post(`/offers/${offer._id}/complete`);
      toast.success(t('details'), { description: t('statusAwaiting') });
      invalidate();
    } catch {
      toast.error(t('error'));
    } finally {
      setBusy('');
    }
  }

  async function confirm() {
    if (!offer) return;
    setBusy('confirm');
    try {
      await api.post(`/offers/${offer._id}/confirm`);
      toast.success(t('offerDone'));
      invalidate();
    } catch {
      toast.error(t('error'));
    } finally {
      setBusy('');
    }
  }

  async function cancel() {
    if (!offer) return;
    setBusy('cancel');
    try {
      await api.post(`/offers/${offer._id}/cancel`, { reason: cancelReason });
      toast.success(t('offerCancelled'));
      setCancelOpen(false);
      invalidate();
    } catch {
      toast.error(t('error'));
    } finally {
      setBusy('');
    }
  }

  async function sendComplaint() {
    if (!offer) return;
    if (!cSubject.trim() || cSubject.trim().length < 3) { toast.error(t('required')); return; }
    if (!cDesc.trim() || cDesc.trim().length < 5) { toast.error(t('required')); return; }
    setBusy('complaint');
    try {
      await api.post<Complaint>('/complaints', { offerId: offer._id, subject: cSubject.trim(), description: cDesc.trim() });
      toast.success(t('complaintSent'), { duration: 5000 });
      setComplaintOpen(false);
      setCSubject('');
      setCDesc('');
    } catch (e) {
      const code = (e as { code?: string }).code;
      toast.error(code === 'NOT_PARTY' ? t('error') : t('error'));
    } finally {
      setBusy('');
    }
  }

  const ownerDoc = typeof offer?.owner === 'object' ? offer.owner : null;
  const workerDoc = typeof offer?.acceptedBy === 'object' && offer?.acceptedBy ? offer.acceptedBy : null;
  const canComplain = Boolean(offer && (offer.viewerIsOwner || offer.viewerIsWorker));

  return (
    <Sheet open={!!detailOfferId} onOpenChange={(o) => !o && closeOfferDetail()}>
      <SheetContent side="bottom" className="rounded-t-3xl h-[92dvh] max-w-md mx-auto inset-x-0 p-0 flex flex-col" aria-describedby={undefined}>
        {isLoading || !offer ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-7 w-7 rounded-full border-[3px] border-primary/25 border-t-primary animate-spin" />
          </div>
        ) : (
          <>
            {/* ps/pe split keeps the amount pill clear of the absolute close button */}
            <SheetHeader className="ps-5 pe-14 pt-4 pb-3 border-b">
              <SheetTitle className="flex items-start justify-between gap-3 text-start text-lg">
                <span className="break-words leading-snug">{offer.title}</span>
                <AmountPill amount={offer.amountDA} className="shrink-0 text-base" />
              </SheetTitle>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {/* photos: swipe on touch, arrows on desktop, fullscreen lightbox */}
              <ImageGallery offerId={offer._id} images={offer.images} alt={offer.title} />

              {/* video: robust player — on failure offers retry or direct open */}
              {offer.videos?.length > 0 && (
                <OfferVideoPlayer offerId={offer._id} gridId={offer.videos[0].gridId} t={t} />
              )}

              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={offer.status} t={t} />
                {offer.wilaya && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-semibold">
                    <MapPin className="h-3.5 w-3.5" /> {wilayaShort(offer.wilaya, lang)}
                  </span>
                )}
                {/* v4.15 — how many people the task needs */}
                {(offer.workersNeeded || 1) > 1 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-bold">
                    <Users className="h-3 w-3" /> {offer.workersNeeded}
                  </span>
                )}
                <span className="text-xs text-muted-foreground ms-auto">{timeAgo(offer.createdAt, t)}</span>
              </div>

              <div>
                <h4 className="text-sm font-bold text-muted-foreground mb-1">{t('details')}</h4>
                <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">{offer.description}</p>
              </div>

              {/* owner card: photo, gender, age, wilaya + phone */}
              <UserCard
                user={ownerDoc}
                title={t('ownerInfo')}
                phone={offer.ownerPhone}
              />

              {/* worker card for the owner or the super admin (photo, gender, age, wilaya, blood group + phone) */}
              {workerDoc && (offer.viewerIsOwner || isSuperAdmin) && (
                <UserCard
                  user={workerDoc}
                  title={t('workerInfo')}
                  phone={workerDoc.phone}
                  phoneLabel={t('callWorker')}
                />
              )}

              <div className="rounded-2xl border bg-card divide-y">
                <div className="flex items-start gap-3 p-3.5">
                  <CalendarDays className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{t('scheduledAt')}</p>
                    <p className="text-sm font-semibold break-words">{offer.scheduledAt ? new Date(offer.scheduledAt).toLocaleString() : t('noScheduled')}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3.5">
                  <ShieldCheck className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{t('addressLabel')}</p>
                    <p className="text-sm font-semibold break-words">{offer.address || t('showAddress')}</p>
                  </div>
                </div>
                {/* v4.15 — precise GPS location: taps straight into Google Maps directions */}
                {offer.location && (
                  <div className="flex items-start gap-3 p-3.5">
                    <Navigation className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">{t('locationLabel')}</p>
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${offer.location.lat},${offer.location.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-0.5 inline-flex max-w-full items-center gap-1.5 rounded-xl border-2 border-primary/40 bg-primary/5 px-3 py-1.5 text-sm font-bold text-primary hover:border-primary active:scale-[0.98] transition-all break-all"
                        dir="ltr"
                      >
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="break-all">{offer.location.lat}, {offer.location.lng}</span>
                        <span className="shrink-0 text-[11px]">— {t('openDirections')}</span>
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* actions */}
            <div className="border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-2 bg-background">
              {/* v4.14 — transparency before committing: the executor sees the net after commission */}
              {(() => {
                const showNet =
                  (offer.status === 'open' && !offer.viewerIsOwner) ||
                  (['assigned', 'awaiting_confirmation'].includes(offer.status) && offer.viewerIsWorker);
                if (!showNet) return null;
                const rate = Math.min(50, Math.max(0, Math.round(settings?.commissionPercent ?? 15)));
                const net = Math.round((offer.amountDA * (100 - rate)) / 100);
                return (
                  <div className="flex items-start gap-2 rounded-xl border bg-muted/40 px-3 py-2">
                    <HandCoins className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                    <span className="text-xs text-muted-foreground break-words leading-relaxed">
                      {t('duesNetHint', { rate: String(rate), net: net.toLocaleString('fr-DZ') })}
                    </span>
                  </div>
                );
              })()}
              {offer.status === 'open' && !offer.viewerIsOwner && !offer.viewerIsWorker && (
                <Button onClick={accept} disabled={!!busy} className="w-full h-12 rounded-xl font-bold text-base shadow-lg shadow-primary/25">
                  {busy === 'accept' && <LoaderCircle className="h-5 w-5 animate-spin" />}
                  {t('acceptOffer')}
                </Button>
              )}
              {offer.status === 'open' && offer.viewerIsOwner && (
                <Button variant="outline" onClick={() => setCancelOpen(true)} disabled={!!busy} className="w-full h-12 rounded-xl font-bold text-destructive border-destructive/30 hover:bg-destructive/10">
                  {t('cancelOffer')}
                </Button>
              )}
              {offer.status === 'assigned' && offer.viewerIsWorker && (
                <Button onClick={complete} disabled={!!busy} className="w-full h-12 rounded-xl font-bold text-base shadow-lg shadow-primary/25">
                  {busy === 'complete' && <LoaderCircle className="h-5 w-5 animate-spin" />}
                  {t('markDone')}
                </Button>
              )}
              {offer.status === 'awaiting_confirmation' && offer.viewerIsOwner && (
                <div className="space-y-2">
                  <p className="text-sm text-amber-600 dark:text-amber-400 font-medium text-center break-words">{t('awaitingConfirm')}</p>
                  <Button onClick={() => setConfirmDoneOpen(true)} disabled={!!busy} className="w-full h-12 rounded-xl font-bold text-base shadow-lg shadow-primary/25">
                    {busy === 'confirm' && <LoaderCircle className="h-5 w-5 animate-spin" />}
                    {t('confirmDone')}
                  </Button>
                  <Button variant="outline" onClick={() => setCancelOpen(true)} disabled={!!busy} className="w-full h-11 rounded-xl font-semibold text-destructive border-destructive/30 hover:bg-destructive/10">
                    {t('cancelOffer')}
                  </Button>
                </div>
              )}
              {offer.status === 'assigned' && offer.viewerIsOwner && (
                <Button variant="outline" onClick={() => setCancelOpen(true)} disabled={!!busy} className="w-full h-11 rounded-xl font-semibold text-destructive border-destructive/30 hover:bg-destructive/10">
                  {t('cancelOffer')}
                </Button>
              )}

              {/* complaint — available to both parties of the deal */}
              {canComplain && (
                <Button variant="ghost" onClick={() => setComplaintOpen(true)} disabled={!!busy} className="w-full h-11 rounded-xl font-semibold text-muted-foreground hover:text-foreground">
                  <MessageSquareWarning className="h-4 w-4 me-2" /> {t('complaint')}
                </Button>
              )}
              <p className="text-[11px] text-muted-foreground text-center pt-1">{t('published')} {timeAgo(offer.createdAt, t)}</p>
            </div>
          </>
        )}

        {/* cancel dialog */}
        <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
          <AlertDialogContent className="rounded-2xl max-w-sm" aria-describedby={undefined}>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('cancelOfferConfirm')}</AlertDialogTitle>
            </AlertDialogHeader>
            <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder={t('cancelReason')} className="min-h-20 rounded-xl" maxLength={300} />
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel className="rounded-xl h-11">{t('close')}</AlertDialogCancel>
              <AlertDialogAction onClick={cancel} disabled={!!busy} className="rounded-xl h-11 bg-destructive text-destructive-foreground font-bold">
                {busy === 'cancel' && <LoaderCircle className="h-4 w-4 animate-spin" />}
                {t('cancelOffer')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* confirm done dialog */}
        <AlertDialog open={confirmDoneOpen} onOpenChange={setConfirmDoneOpen}>
          <AlertDialogContent className="rounded-2xl max-w-sm">
            <AlertDialogHeader>
              <AlertDialogTitle>{t('confirmDone')}</AlertDialogTitle>
              <AlertDialogDescription>{t('confirmDoneDesc')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel className="rounded-xl h-11">{t('cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={confirm} disabled={!!busy} className="rounded-xl h-11 font-bold">
                {busy === 'confirm' && <LoaderCircle className="h-4 w-4 animate-spin" />}
                {t('yes')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* complaint dialog */}
        <AlertDialog open={complaintOpen} onOpenChange={(o) => !busy && setComplaintOpen(o)}>
          <AlertDialogContent className="rounded-2xl max-w-sm" aria-describedby={undefined}>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <MessageSquareWarning className="h-5 w-5 text-amber-500" /> {t('complaintTitle')}
              </AlertDialogTitle>
            </AlertDialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="c-subject">{t('complaintSubject')} *</Label>
                <Input id="c-subject" value={cSubject} onChange={(e) => setCSubject(e.target.value)} placeholder={t('complaintSubjectPlaceholder')} className="h-11 rounded-xl" maxLength={120} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-desc">{t('complaintDesc')} *</Label>
                <Textarea id="c-desc" value={cDesc} onChange={(e) => setCDesc(e.target.value)} className="min-h-24 rounded-xl" maxLength={1500} />
              </div>
            </div>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel className="rounded-xl h-11">{t('cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={sendComplaint} disabled={!!busy} className="rounded-xl h-11 font-bold">
                {busy === 'complaint' && <LoaderCircle className="h-4 w-4 animate-spin" />}
                {t('complaint')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Offer video player. The stream endpoint supports HTTP Range (seekable),
 * so a plain <video> works on desktop and mobile. If the browser still fails
 * (codec mismatch e.g. webm on iOS Safari), show a clear fallback: retry with
 * a cache-busting attempt or open the raw stream in a new tab (play/download).
 */
function OfferVideoPlayer({
  offerId,
  gridId,
  t,
}: {
  offerId: string;
  gridId: string;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const base = mediaUrl(`/media/video/${offerId}/${gridId}`);
  // cache-bust on retry so the browser re-requests instead of replaying a cached error
  const src = attempt === 0 ? base : `${base}${base.includes('?') ? '&' : '?'}r=${attempt}`;

  if (failed) {
    return (
      <div className="rounded-2xl border bg-muted/40 p-4 space-y-3 text-center">
        <p className="text-sm font-semibold text-muted-foreground">{t('videoLoadError')}</p>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <Button variant="outline" className="rounded-xl h-10" onClick={() => { setFailed(false); setAttempt((a) => a + 1); }}>
            {t('retry')}
          </Button>
          <a href={src} target="_blank" rel="noreferrer">
            <Button variant="secondary" className="rounded-xl h-10">{t('videoOpenDirect')}</Button>
          </a>
        </div>
      </div>
    );
  }

  return (
    <video
      key={attempt}
      src={src}
      controls
      playsInline
      preload="metadata"
      onError={() => setFailed(true)}
      className="w-full max-h-72 rounded-2xl border bg-black"
    />
  );
}
