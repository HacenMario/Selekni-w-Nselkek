'use client';

import { useQuery } from '@tanstack/react-query';
import { useApp } from '@/store/app';
import { useLang } from '@/lib/language-context';
import { api, imageUrl } from '@/lib/api';
import { Offer } from '@/lib/types';
import { AmountPill, EmptyState, StatusBadge, timeAgo } from '@/components/app/ui-bits';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Plus, Inbox } from 'lucide-react';
import { UserAvatar } from '@/components/app/UserAvatar';

/** Owner's offers — v4.14: no subscription gate, posting is open to everyone
 *  (the platform earns a commission on completed tasks instead). */
export function MyOffersScreen({ onCreate }: { onCreate: () => void }) {
  const { t } = useLang();
  const openOfferDetail = useApp((s) => s.openOfferDetail);

  const { data, isLoading } = useQuery({
    queryKey: ['my-offers'],
    queryFn: () => api.get<{ items: Offer[] }>('/offers/mine'),
    // v4.15 — silent 5-second refresh: the worker's acceptance shows up on its own
    refetchInterval: 5_000,
  });

  return (
    <div className="flex-1 flex flex-col min-h-0">
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
          onClick={onCreate}
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
