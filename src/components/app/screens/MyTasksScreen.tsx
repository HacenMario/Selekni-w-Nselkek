'use client';

import { useQuery } from '@tanstack/react-query';
import { useApp } from '@/store/app';
import { useLang } from '@/lib/language-context';
import { api, imageUrl } from '@/lib/api';
import { Offer } from '@/lib/types';
import { AmountPill, EmptyState, StatusBadge, timeAgo } from '@/components/app/ui-bits';
import { Skeleton } from '@/components/ui/skeleton';
import { DuesStrip } from '@/components/app/screens/DuesScreen';
import { BadgeCheck, ListChecks } from 'lucide-react';

/** Seeker's accepted tasks (assigned / awaiting / done) + the monthly dues strip (v4.14). */
export function MyTasksScreen() {
  const { t } = useLang();
  const openOfferDetail = useApp((s) => s.openOfferDetail);

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['accepted-tasks'],
    queryFn: () => api.get<{ items: Offer[] }>('/offers/accepted'),
    // v4.15 — silent 5-second refresh: statuses move without any spinner
    refetchInterval: 5_000,
  });

  return (
    <div className="flex-1 overflow-y-auto px-4 pb-24 pt-4 space-y-3">
      {/* v4.14 — commission dues at a glance (tap → the dedicated dues page) */}
      <DuesStrip />
      {isLoading ? (
        [...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)
      ) : !tasks || tasks.items.length === 0 ? (
        <EmptyState icon={ListChecks} title={t('feedEmpty')} hint={t('feedEmptyHint')} />
      ) : (
        tasks.items.map((o, idx) => (
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
                <p className="text-sm text-muted-foreground break-words mt-1">{o.description}</p>
              </div>
            </div>
            <div className="flex items-center justify-between mt-2.5">
              <StatusBadge status={o.status} t={t} />
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <BadgeCheck className="h-3.5 w-3.5" /> {timeAgo(o.createdAt, t)}
              </span>
            </div>
          </button>
        ))
      )}
    </div>
  );
}
