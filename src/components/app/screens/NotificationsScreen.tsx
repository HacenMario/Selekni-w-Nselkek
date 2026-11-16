'use client';

/**
 * v4.15 — notifications became a bell-in-header panel:
 *  - the bell (TopBar) opens this responsive bottom-sheet window;
 *  - the old bottom-bar page is gone — same actions live here:
 *    mark-all-read, clear-all, tap-to-open the related offer/section;
 *  - a push row lets the user switch ON phone notifications (background
 *    delivery even when the app or screen is closed).
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApp } from '@/store/app';
import { useLang } from '@/lib/language-context';
import { api } from '@/lib/api';
import { subscribePush, isPushSubscribed } from '@/lib/push';
import { AppNotification, Paged } from '@/lib/types';
import { EmptyState, Pager, timeAgo } from '@/components/app/ui-bits';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  BadgeCheck, BellRing, BellOff, CheckCheck, Gavel, HandCoins, Handshake, Hourglass, IdCard, Inbox, LifeBuoy,
  Megaphone, Smartphone, Trash2, Wrench, XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

/** The shared notification list (used inside the bell panel). */
export function NotificationsContent({ onNavigate }: { onNavigate?: () => void }) {
  const { t, lang } = useLang();
  const user = useApp((s) => s.user);
  const openOfferDetail = useApp((s) => s.openOfferDetail);
  const setTab = useApp((s) => s.setTab);
  const setAdminTab = useApp((s) => s.setAdminTab);
  const qc = useQueryClient();
  const [clearOpen, setClearOpen] = useState(false);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', page],
    queryFn: () => api.get<Paged<AppNotification>>('/notifications', { page, limit: 15 }),
    refetchInterval: 15_000,
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['notifications'] });
    qc.invalidateQueries({ queryKey: ['notifications-unread'] });
  }

  async function markAllRead() {
    try {
      await api.post('/notifications/read-all');
      invalidate();
    } catch {
      toast.error(t('error'));
    }
  }

  async function clearAll() {
    try {
      await api.del('/notifications/all');
      setClearOpen(false);
      invalidate();
    } catch {
      toast.error(t('error'));
    }
  }

  /** Tap → mark that one read immediately + navigate to the related page/offer. */
  async function open(n: AppNotification) {
    api.post(`/notifications/${n._id}/read`).catch(() => {});
    invalidate();
    const d = n.data || {};
    const offerId = d.offerId ? String(d.offerId) : '';
    onNavigate?.();

    switch (n.type) {
      case 'new_offer_match':
        if (offerId) openOfferDetail(offerId);
        break;
      case 'offer_accepted':
      case 'offer_awaiting':
        // owner side: go to my offers and open the offer
        if (offerId) { setTab(user?.role === 'owner' ? 'offers' : 'tasks'); openOfferDetail(offerId); }
        break;
      case 'offer_done':
        if (offerId) { setTab(user?.role === 'owner' ? 'offers' : 'tasks'); openOfferDetail(offerId); }
        break;
      case 'offer_cancelled':
        setTab(user?.role === 'owner' ? 'offers' : 'tasks');
        if (offerId) openOfferDetail(offerId);
        break;
      case 'dues_reminder':
      case 'dues_paid':
      case 'dues_proof_approved':
      case 'dues_proof_rejected':
        // commission dues: open the dedicated dues page
        setTab('dues');
        break;
      case 'dues_proof_submitted':
        // administration: straight to the dues tab for the receipt review
        if (user?.isSuperAdmin) { setTab('admin'); setAdminTab('dues'); }
        break;
      case 'id_pending':
        // administration: straight to the users tab for the ID-card review
        if (user?.isSuperAdmin) { setTab('admin'); setAdminTab('users'); }
        else setTab('profile');
        break;
      case 'complaint_new':
        setTab('admin');
        setAdminTab('complaints');
        break;
      case 'complaint_resolved':
        if (offerId) openOfferDetail(offerId);
        else setTab('profile');
        break;
      case 'broadcast':
      case 'system':
      default:
        break; // stay where the reader is — the message itself is the content
    }
  }

  const items = data?.items || [];

  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 pb-8 pt-3 space-y-2.5">
        {isLoading ? (
          <Spinner />
        ) : items.length === 0 ? (
          <EmptyState icon={Inbox} title={t('notificationsEmpty')} />
        ) : (
          items.map((n) => {
            const unread = !n.readAt;
            return (
              <button
                key={n._id}
                onClick={() => open(n)}
                className={`w-full text-start rounded-2xl border p-4 flex items-start gap-3 transition-all active:scale-[0.99] ${
                  unread ? 'border-primary/40 bg-primary/5 shadow-sm' : 'border-border bg-card hover:bg-muted/40'
                }`}
              >
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${unread ? 'bg-primary/15' : 'bg-muted'}`}>
                  <NotifIcon type={n.type} className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm leading-snug break-words ${unread ? 'font-bold' : 'font-medium text-muted-foreground'}`}>
                      {notifText(n, t, Boolean(user?.isSuperAdmin), lang)}
                    </p>
                    {unread && <span className="h-2.5 w-2.5 rounded-full bg-primary shrink-0 mt-1.5" />}
                  </div>
                  {notifRawExtra(n, lang) && (
                    <p className="text-xs text-muted-foreground/90 italic leading-snug break-words mt-0.5">{notifRawExtra(n, lang)}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-1">{timeAgo(n.createdAt, t)}</p>
                </div>
              </button>
            );
          })
        )}
        {data && <Pager page={data.page || page} pages={data.pages} onChange={setPage} />}
      </div>

      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent className="rounded-2xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('clearAll')}</AlertDialogTitle>
            <AlertDialogDescription>{t('clearAllConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl h-11">{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={clearAll} className="rounded-xl h-11 bg-destructive text-destructive-foreground font-bold">
              {t('clearAll')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** The bell window — elegant bottom sheet, fully responsive, safe-area aware. */
export function NotificationsPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useLang();
  const qc = useQueryClient();
  const [pushState, setPushState] = useState<'unknown' | 'on' | 'off'>('unknown');
  const [pushBusy, setPushBusy] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ['notifications-unread'],
    queryFn: () => api.get<Paged<AppNotification>>('/notifications', { limit: 1 }),
    enabled: open,
    refetchInterval: 15_000,
  });
  const unread = data?.unreadCount || 0;

  // reflect the phone-notification state while the panel is open
  useEffect(() => {
    if (!open) return;
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      isPushSubscribed().then((s) => setPushState(s ? 'on' : 'off'));
    } else {
      setPushState('off');
    }
  }, [open]);

  async function enablePush() {
    setPushBusy(true);
    try {
      const r = await subscribePush();
      if (r === 'granted') {
        setPushState('on');
        qc.invalidateQueries({ queryKey: ['notifications-unread'] });
        toast.success(t('pushEnabled'));
      } else if (r === 'denied') {
        setPushState('off');
        toast.error(t('pushBlocked'));
      } else {
        toast.error(t('pushUnsupported'));
      }
    } catch {
      toast.error(t('error'));
    } finally {
      setPushBusy(false);
    }
  }

  async function markAllRead() {
    try {
      await api.post('/notifications/read-all');
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications-unread'] });
    } catch {
      toast.error(t('error'));
    }
  }

  async function clearAll() {
    try {
      await api.del('/notifications/all');
      setClearOpen(false);
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications-unread'] });
    } catch {
      toast.error(t('error'));
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* v4.16 — the built-in sheet ✕ (a direct button child) is hidden for THIS
          panel only ([&>button]:hidden) so it can no longer collide with the
          clear-all button; the panel carries its own close button in the row */}
      <SheetContent side="bottom" className="rounded-t-3xl h-[82dvh] max-w-lg mx-auto inset-x-0 p-0 flex flex-col [&>button]:hidden" aria-describedby={undefined}>
        <SheetHeader className="ps-3 pe-4 pt-4 pb-3 border-b space-y-0">
          <div className="flex items-center gap-2">
            {/* dedicated close button — sits at the row start, never overlapping */}
            <button
              onClick={() => onOpenChange(false)}
              aria-label={t('close')}
              title={t('close')}
              className="h-10 w-10 rounded-xl border bg-card flex items-center justify-center hover:bg-muted active:scale-90 transition-all shrink-0"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M18 6 6 18" /><path d="m6 6 12 12" />
              </svg>
            </button>
            <span className="h-10 w-10 rounded-xl bg-primary/12 flex items-center justify-center shrink-0 relative">
              <BellRing className="h-5 w-5 text-primary" />
              {unread > 0 && (
                <span className="absolute -top-1 -end-1 min-w-5 h-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center shadow">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </span>
            <SheetTitle className="text-lg flex-1 min-w-0">{t('notifications')}</SheetTitle>
            {/* icon-only actions: mark all read + clear all (same as before) */}
            <button
              onClick={markAllRead}
              disabled={!data || unread === 0}
              aria-label={t('markAllRead')}
              title={t('markAllRead')}
              className="h-10 w-10 rounded-xl border bg-card flex items-center justify-center hover:bg-muted active:scale-90 transition-all disabled:opacity-40 shrink-0"
            >
              <CheckCheck className="h-4.5 w-4.5 text-foreground" />
            </button>
            <button
              onClick={() => setClearOpen(true)}
              disabled={!data || (data.items || []).length === 0}
              aria-label={t('clearAll')}
              title={t('clearAll')}
              className="h-10 w-10 rounded-xl border bg-card flex items-center justify-center hover:bg-destructive/10 hover:border-destructive/40 active:scale-90 transition-all disabled:opacity-40 shrink-0"
            >
              <Trash2 className="h-4.5 w-4.5 text-destructive" />
            </button>
          </div>
        </SheetHeader>

        {/* phone notifications — the toggle the user controls with one tap */}
        <div className="px-4 pt-3">
          {pushState !== 'on' ? (
            <button
              onClick={enablePush}
              disabled={pushBusy}
              className="w-full rounded-2xl border-2 border-primary/40 bg-primary/5 px-4 py-3 flex items-center gap-3 text-start active:scale-[0.99] transition-all hover:border-primary/70"
            >
              <span className="h-10 w-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                {pushBusy ? <SpinnerIcon /> : <Smartphone className="h-5 w-5" />}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold text-foreground break-words">{t('pushEnablePanelTitle')}</span>
                <span className="block text-xs text-muted-foreground leading-snug break-words mt-0.5">{t('pushEnablePanelBody')}</span>
              </span>
              <BellOff className="h-4.5 w-4.5 text-muted-foreground shrink-0" />
            </button>
          ) : (
            <div className="w-full rounded-2xl border border-emerald-300/70 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800 px-4 py-2.5 flex items-center gap-2.5">
              <span className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300 flex items-center justify-center shrink-0">
                <BellRing className="h-4 w-4" />
              </span>
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 break-words">{t('pushActivePanelTitle')}</p>
            </div>
          )}
        </div>

        <NotificationsContent onNavigate={() => onOpenChange(false)} />

        {/* clear-all confirmation lives at the panel level (the header button opens it) */}
        <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
          <AlertDialogContent className="rounded-2xl max-w-sm">
            <AlertDialogHeader>
              <AlertDialogTitle>{t('clearAll')}</AlertDialogTitle>
              <AlertDialogDescription>{t('clearAllConfirm')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel className="rounded-xl h-11">{t('cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={clearAll} className="rounded-xl h-11 bg-destructive text-destructive-foreground font-bold">
                {t('clearAll')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}

function SpinnerIcon() {
  return <span className="h-5 w-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin inline-block" />;
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="h-7 w-7 rounded-full border-[3px] border-primary/25 border-t-primary animate-spin" />
    </div>
  );
}

function NotifIcon({ type, className }: { type: string; className?: string }) {
  switch (type) {
    case 'new_offer_match': return <BellRing className={`${className} text-primary`} />;
    case 'offer_accepted': return <Handshake className={`${className} text-teal-600`} />;
    case 'offer_awaiting': return <Hourglass className={`${className} text-amber-500`} />;
    case 'offer_done': return <BadgeCheck className={`${className} text-emerald-600`} />;
    case 'offer_cancelled': return <XCircle className={`${className} text-rose-500`} />;
    // v4.14 — commission dues notifications
    case 'dues_reminder': return <Hourglass className={`${className} text-amber-500`} />;
    case 'dues_paid': return <BadgeCheck className={`${className} text-emerald-600`} />;
    // v4.15 — payment-proof lifecycle
    case 'dues_proof_submitted': return <HandCoins className={`${className} text-amber-600`} />;
    case 'dues_proof_approved': return <BadgeCheck className={`${className} text-emerald-600`} />;
    case 'dues_proof_rejected': return <XCircle className={`${className} text-rose-500`} />;
    case 'id_pending': return <IdCard className={`${className} text-amber-600`} />;
    case 'complaint_new': return <Gavel className={`${className} text-amber-600`} />;
    case 'complaint_resolved': return <LifeBuoy className={`${className} text-emerald-600`} />;
    case 'broadcast': return <Megaphone className={`${className} text-orange-600`} />;
    default: return <Wrench className={`${className} text-muted-foreground`} />;
  }
}

/** Trilingual data helper — reads titleAr/titleFr/titleEn style keys, falls back to the plain key (legacy). */
function pickL(d: Record<string, unknown>, base: string, lang: string): string {
  const suffix = lang === 'ar' ? 'Ar' : lang === 'fr' ? 'Fr' : 'En';
  const v = d[`${base}${suffix}`] ?? d[base];
  return v ? String(v) : '';
}

function notifText(n: AppNotification, t: (k: string, p?: Record<string, string | number>) => string, isAdmin = false, lang = 'ar'): string {
  const d = n.data || {};
  const actor = String(d.actorName || '');
  switch (n.type) {
    case 'new_offer_match': return t('notifNewOfferBody', { actor, title: String(d.offerTitle || ''), amount: Number(d.amountDA || 0).toLocaleString('fr-DZ') });
    case 'offer_accepted': return t('notifOfferAcceptedBody', { actor, title: String(d.offerTitle || '') });
    case 'offer_awaiting': return t('notifOfferAwaitingBody', { actor, title: String(d.offerTitle || '') });
    case 'offer_done': return t('notifOfferDoneBody', { title: String(d.offerTitle || ''), amount: Number(d.amountDA || 0).toLocaleString('fr-DZ') });
    case 'offer_cancelled': return t('notifOfferCancelledBody', { title: String(d.offerTitle || '') });
    // v4.14 — commission dues notifications (rendered in the reader's language)
    case 'dues_reminder': return t('notifDuesReminderBody', { amount: Number(d.amountDA || 0).toLocaleString('fr-DZ'), month: String(d.month || '') });
    case 'dues_paid': return t('notifDuesPaidBody', { amount: Number(d.amountDA || 0).toLocaleString('fr-DZ'), month: String(d.month || '') });
    // v4.15 — payment-proof lifecycle
    case 'dues_proof_submitted': return t('notifDuesProofSubmittedBody', { actor, amount: Number(d.amountDA || 0).toLocaleString('fr-DZ'), month: String(d.month || '') });
    case 'dues_proof_approved': return t('notifDuesProofApprovedBody', { amount: Number(d.amountDA || 0).toLocaleString('fr-DZ'), month: String(d.month || '') });
    case 'dues_proof_rejected': return t('notifDuesProofRejectedBody', { month: String(d.month || '') });
    case 'id_pending': return t('notifAdminIdNew', { actor });
    case 'complaint_new': return t('notifComplaintNewBody', { actorName: actor, subject: String(d.subject || '') });
    case 'complaint_resolved': return t('notifComplaintResolvedBody', { subject: String(d.subject || '') });
    // admin announcements carry per-language data — always render the reader's language
    case 'broadcast': return pickL(d, 'title', lang);
    case 'system': return pickL(d, 'title', lang);
    default: return pickL(d, 'title', lang) || String(d.body || '');
  }
}

/** Free text the administration wrote itself (reason / resolution / announcement body) — shown as its own muted line, never mixed into the localized sentence. */
function notifRawExtra(n: AppNotification, lang: string): string {
  const d = n.data || {};
  switch (n.type) {
    case 'system': return pickL(d, 'body', lang);
    case 'broadcast': return pickL(d, 'body', lang);
    case 'complaint_resolved': return String(d.resolution || '');
    case 'offer_cancelled': return String(d.reason || '');
    case 'dues_proof_rejected': return String(d.reason || '');
    default: return '';
  }
}
