'use client';

import { useQuery } from '@tanstack/react-query';
import { useApp } from '@/store/app';
import { useLang } from '@/lib/language-context';
import { api, imageUrl } from '@/lib/api';
import { Offer, Settings, Subscription } from '@/lib/types';
import { AmountPill, EmptyState, StatusBadge, timeAgo } from '@/components/app/ui-bits';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Plus, Inbox, LoaderCircle, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/app/UserAvatar';

export function MyOffersScreen({ onCreate }: { onCreate: () => void }) {
  const { t } = useLang();
  const user = useApp((s) => s.user);
  const openOfferDetail = useApp((s) => s.openOfferDetail);
  const setTab = useApp((s) => s.setTab);

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<Settings>('/settings'),
    staleTime: 60_000,
  });

  const { data: subData } = useQuery({
    queryKey: ['my-subscription'],
    queryFn: () => api.get<{ current: Subscription | null; subscription: Settings['subscription'] }>('/subscriptions/mine'),
    enabled: user?.role === 'owner' && !!settings?.subscription.isEnabled,
    // keeps an admin grant/activation visible within seconds — no stale 'expired' banner
    refetchInterval: 30_000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['my-offers'],
    queryFn: () => api.get<{ items: Offer[] }>('/offers/mine'),
    refetchInterval: 20_000,
  });

  const sub = subData?.current;
  const subOk = !settings?.subscription.isEnabled || sub?.status === 'active';

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* subscription status strip */}
      {settings?.subscription.isEnabled && user?.role === 'owner' && (
        <div className="px-4 pt-3">
          {sub?.status === 'active' ? (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/50 px-3.5 py-2.5 text-sm">
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
              <span className="text-emerald-800 dark:text-emerald-300 font-semibold">
                {t('subscriptionActiveUntil')}{' '}
                {sub.endsAt ? new Date(sub.endsAt).toLocaleDateString() : ''}
              </span>
              <button onClick={() => setTab('subscription')} className="ms-auto text-xs font-bold text-emerald-700 dark:text-emerald-300 underline underline-offset-2">
                {t('renew')}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setTab('subscription')}
              className="w-full flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/50 px-3.5 py-2.5 text-sm text-start active:scale-[0.99] transition-transform"
            >
              <span className="text-amber-800 dark:text-amber-300 font-semibold flex-1">
                {sub?.status === 'pending' ? t('subscriptionPending') : sub?.status === 'rejected' ? t('subscriptionRejected') : sub?.status === 'expired' ? t('subscriptionExpired') : t('subscriptionRequired')}
              </span>
              <span className="text-xs font-bold text-amber-700 dark:text-amber-300 underline underline-offset-2 shrink-0">
                {t('subscription')}
              </span>
            </button>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 pb-28 pt-3 space-y-3">
        {isLoading ? (
          [...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)
        ) : !data || data.items.length === 0 ? (
          <EmptyState icon={Inbox} title={t('myOffersEmpty')} hint={t('myOffersEmptyHint')} />
        ) : (
          data.items.map((o, idx) => (
            <button
              key={o._id}
              onClick={() => openOfferDetail(o._id)}
              className="w-full text-start rounded-2xl border bg-card p-4 shadow-sm hover:shadow-md transition-all active:scale-[0.99] animate-in fade-in slide-in-from-bottom-2 duration-300"
              style={{ animationDelay: `${Math.min(idx * 40, 200)}ms`, animationFillMode: 'backwards' }}
            >
              <div className="flex items-start gap-3">
                {(o.images || []).length > 0 && (
                  <img src={imageUrl(o._id, o.images[0]._id)} alt={o.title} loading="lazy" className="h-14 w-14 rounded-xl object-cover border bg-muted shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-[15px] break-words leading-snug">{o.title}</h3>
                    <AmountPill amount={o.amountDA} className="shrink-0" />
                  </div>
                  {typeof o.acceptedBy === 'object' && o.acceptedBy && (
                    <div className="flex items-center gap-2 mt-2">
                      <UserAvatar user={o.acceptedBy} size="h-10 w-10" textClass="text-sm" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">{t('workerInfo')}</p>
                        <p className="text-sm font-bold text-foreground break-words leading-tight">{o.acceptedBy.name}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between mt-2.5">
                <StatusBadge status={o.status} t={t} />
                <span className="text-xs text-muted-foreground">{timeAgo(o.createdAt, t)}</span>
              </div>
            </button>
          ))
        )}
      </div>

      {/* FAB */}
      <div className="absolute bottom-20 end-4 z-40">
        <Button
          onClick={() => {
            if (!subOk) {
              toast.info(t('subscriptionRequired'));
              setTab('subscription');
              return;
            }
            onCreate();
          }}
          size="lg"
          className="h-14 rounded-2xl px-5 text-base font-bold shadow-xl shadow-primary/30 hover:shadow-primary/40 transition-all"
        >
          <Plus className="h-5 w-5 me-1" />
          {t('newOffer')}
        </Button>
      </div>
    </div>
  );
}
