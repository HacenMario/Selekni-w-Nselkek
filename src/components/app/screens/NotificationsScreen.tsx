'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApp } from '@/store/app';
import { useLang } from '@/lib/language-context';
import { api } from '@/lib/api';
import { AppNotification, Paged } from '@/lib/types';
import { EmptyState, Pager, timeAgo } from '@/components/app/ui-bits';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  BadgeCheck, BellRing, CheckCheck, Gavel, Handshake, Hourglass, IdCard, Inbox, LifeBuoy,
  Megaphone, ShieldCheck, Trash2, Wallet, Wrench, XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export function NotificationsScreen() {
  const { t, lang } = useLang();
  const user = useApp((s) => s.user);
  const openOfferDetail = useApp((s) => s.openOfferDetail);
  const setTab = useApp((s) => s.setTab);
  const setAdminTab = useApp((s) => s.setAdminTab);
  const setAdminSubsFilter = useApp((s) => s.setAdminSubsFilter);
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
      case 'subscription_pending':
        // administration: jump straight to pending subscription requests
        if (user?.isSuperAdmin) { setTab('admin'); setAdminTab('subs'); setAdminSubsFilter('pending'); break; }
        setTab('profile');
        break;
      case 'subscription_confirmed':
      case 'subscription_rejected':
        setTab('profile');
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
        break; // already on the notifications page
    }
  }

  const items = data?.items || [];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* icon-only actions */}
      <div className="flex items-center justify-end gap-2 px-4 pt-3">
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={markAllRead}
                disabled={!data || data.unreadCount === 0}
                aria-label={t('markAllRead')}
                className="h-10 w-10 rounded-xl border bg-card flex items-center justify-center hover:bg-muted active:scale-90 transition-all disabled:opacity-40"
              >
                <CheckCheck className="h-4.5 w-4.5 text-foreground" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t('markAllRead')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setClearOpen(true)}
                disabled={items.length === 0}
                aria-label={t('clearAll')}
                className="h-10 w-10 rounded-xl border bg-card flex items-center justify-center hover:bg-destructive/10 hover:border-destructive/40 active:scale-90 transition-all disabled:opacity-40"
              >
                <Trash2 className="h-4.5 w-4.5 text-destructive" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t('clearAll')}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 pt-3 space-y-2.5">
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
    </div>
  );
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
    case 'subscription_pending': return <Wallet className={`${className} text-sky-600`} />;
    case 'subscription_confirmed': return <ShieldCheck className={`${className} text-emerald-600`} />;
    case 'subscription_rejected': return <XCircle className={`${className} text-rose-500`} />;
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
    case 'subscription_pending':
      // administration gets a professional, action-oriented message
      if (isAdmin) return t('notifAdminSubNew', { actor, amount: Number(d.amountDA || 0).toLocaleString('fr-DZ'), reference: String(d.reference || '') });
      return t('notifSubPendingBody', { actor, reference: String(d.reference || '') });
    case 'id_pending': return t('notifAdminIdNew', { actor });
    case 'subscription_confirmed': return t('notifSubConfirmedBody');
    case 'subscription_rejected': return t('notifSubRejectedBody');
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
    default: return '';
  }
}
