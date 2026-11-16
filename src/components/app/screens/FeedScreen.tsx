'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { LoaderCircle, MapPin, SlidersHorizontal, X } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApp } from '@/store/app';
import { useLang } from '@/lib/language-context';
import { api, imageUrl } from '@/lib/api';
import { Offer, Settings } from '@/lib/types';
import { AmountPill, CategoryChip, EmptyState, timeAgo } from '@/components/app/ui-bits';
import { Handshake, Inbox, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { WilayaSelect } from '@/components/app/WilayaSelect';
import { wilayaShort } from '@/lib/wilayas';
import { toast } from 'sonner';

type SortKey = 'new' | 'amount_asc' | 'amount_desc';

export function FeedScreen() {
  const { t, lang } = useLang();
  const openOfferDetail = useApp((s) => s.openOfferDetail);
  const nonce = useApp((s) => s.refreshFeedNonce);
  const qc = useQueryClient();
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [accepting, setAccepting] = useState<Offer | null>(null);
  const [busy, setBusy] = useState(false);

  // filters — custom overlay (reliable taps), applied on Apply
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftWilaya, setDraftWilaya] = useState('');
  const [draftMin, setDraftMin] = useState('');
  const [draftMax, setDraftMax] = useState('');
  const [draftSort, setDraftSort] = useState<SortKey>('new');
  const [fWilaya, setFWilaya] = useState('');
  const [fMin, setFMin] = useState('');
  const [fMax, setFMax] = useState('');
  const [fSort, setFSort] = useState<SortKey>('new');

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<Settings>('/settings'),
    staleTime: 60_000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['feed', category, search, fWilaya, fMin, fMax, fSort, nonce],
    queryFn: () =>
      api.get<{ items: Offer[]; total: number }>('/offers/feed', {
        categoryKey: category || undefined,
        // "الكل" (no chip selected) means all offers, not just matching interests
        scope: category ? undefined : 'all',
        q: search.trim() || undefined,
        wilaya: fWilaya || undefined,
        minAmount: fMin || undefined,
        maxAmount: fMax || undefined,
        sort: fSort !== 'new' ? fSort : undefined,
        limit: 30,
      }),
    refetchInterval: 5_000,
    staleTime: 10_000,
  });

  const activeFilterCount = [fWilaya, fMin, fMax, fSort !== 'new' ? fSort : ''].filter(Boolean).length;

  const catMap = useMemo(() => {
    const m = new Map<string, { key: string; label: { ar: string; fr: string; en: string }; icon: string }>();
    settings?.categories.forEach((c) => m.set(c.key, c));
    return m;
  }, [settings]);

  function openFilters() {
    setDraftWilaya(fWilaya);
    setDraftMin(fMin);
    setDraftMax(fMax);
    setDraftSort(fSort);
    setFilterOpen(true);
  }

  function applyFilters() {
    setFWilaya(draftWilaya);
    setFMin(draftMin);
    setFMax(draftMax);
    setFSort(draftSort);
    setFilterOpen(false);
  }

  function resetFilters() {
    setDraftWilaya('');
    setDraftMin('');
    setDraftMax('');
    setDraftSort('new');
    setFWilaya('');
    setFMin('');
    setFMax('');
    setFSort('new');
  }

  async function doAccept() {
    if (!accepting) return;
    setBusy(true);
    try {
      await api.post<Offer>(`/offers/${accepting._id}/accept`);
      await qc.invalidateQueries({ queryKey: ['feed'] });
      qc.invalidateQueries({ queryKey: ['notifications-unread'] });
      toast.success(t('accepted'), { duration: 5000 });
      // v4.15 — the sheet does NOT reopen with a "task done" button after
      // accepting: the executor continues from "my tasks" when work is finished
      setAccepting(null);
    } catch (e) {
      const msg = (e as { code?: string }).code === 'ALREADY_TAKEN' ? t('offerTaken') : t('error');
      toast.error(msg);
      qc.invalidateQueries({ queryKey: ['feed'] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col min-h-0 flex-1">
      {/* category chips */}
      <div className="flex gap-2 overflow-x-auto px-4 pt-3 pb-2 no-scrollbar" role="toolbar" aria-label={t('offerCategory')}>
        <button
          onClick={() => setCategory('')}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-all active:scale-95 ${!category ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}
        >
          {t('allCategories')}
        </button>
        {settings?.categories.map((c) => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key === category ? '' : c.key)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-all active:scale-95 ${category === c.key ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}
          >
            <CategoryChip cat={c} lang={lang} />
          </button>
        ))}
      </div>

      {/* text search + filters button */}
      <div className="px-4 pb-2 flex gap-2 items-center">
        <div className="relative flex-1 min-w-0">
          <Search className="h-4 w-4 text-muted-foreground absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="h-10 rounded-xl ps-9 pe-9 bg-card"
            inputMode="search"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              aria-label={t('close')}
              className="absolute top-1/2 -translate-y-1/2 end-2.5 h-6 w-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground active:scale-90"
            >
              <span className="text-xs font-bold">✕</span>
            </button>
          )}
        </div>
        <button
          onClick={openFilters}
          aria-label={t('filters')}
          className={`relative h-10 w-11 shrink-0 rounded-xl border bg-card flex items-center justify-center active:scale-95 transition-all ${activeFilterCount > 0 ? 'border-primary text-primary' : 'text-muted-foreground hover:bg-muted'}`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1.5 -end-1.5 h-5 min-w-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* result count */}
      <div className="px-4 pb-1.5">
        <p className="text-xs font-semibold text-muted-foreground">
          {data ? t('resultsCount', { count: data.total }) : ''}
        </p>
      </div>

      {/* list */}
      <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-3">
        {isLoading ? (
          <BrandedFeedSkeleton />
        ) : !data || data.items.length === 0 ? (
          <EmptyState icon={Inbox} title={t('feedEmpty')} hint={t('feedEmptyHint')} />
        ) : (
          data.items.map((offer, idx) => {
            const cat = catMap.get(offer.categoryKey);
            const imgs = offer.images || [];
            const owner = typeof offer.owner === 'object' ? offer.owner : null;
            return (
              <button
                key={offer._id}
                onClick={() => openOfferDetail(offer._id)}
                className="w-full text-start rounded-2xl border bg-card p-4 shadow-sm hover:shadow-md hover:border-primary/40 transition-all active:scale-[0.99] animate-in fade-in slide-in-from-bottom-2 duration-300"
                style={{ animationDelay: `${Math.min(idx * 40, 240)}ms`, animationFillMode: 'backwards' }}
              >
                <div className="flex items-start gap-3">
                  {imgs.length > 0 ? (
                    <img
                      src={imageUrl(offer._id, imgs[0]._id)}
                      alt={offer.title}
                      loading="lazy"
                      className="h-16 w-16 rounded-xl object-cover border bg-muted shrink-0"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      {cat ? (
                        <span className="text-primary [&_svg]:h-7 [&_svg]:w-7">
                          <CategoryChip cat={cat} lang={lang} />
                        </span>
                      ) : null}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-[15px] leading-snug break-words">{offer.title}</h3>
                      <AmountPill amount={offer.amountDA} className="shrink-0" />
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 break-words">{offer.description}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                      {cat && (
                        <span className="inline-flex items-center gap-1 text-primary font-semibold [&_svg]:h-3.5 [&_svg]:w-3.5">
                          <CategoryChip cat={cat} lang={lang} />
                        </span>
                      )}
                      {offer.wilaya && (
                        <span className="inline-flex items-center gap-0.5">
                          <MapPin className="h-3.5 w-3.5" /> {wilayaShort(offer.wilaya, lang)}
                        </span>
                      )}
                      {owner?.name && (
                        <span className="inline-flex items-center gap-1">
                          <Handshake className="h-3.5 w-3.5" /> {owner.name}
                        </span>
                      )}
                      <span className="ms-auto shrink-0">{timeAgo(offer.createdAt, t)}</span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* filters — custom bottom overlay (built without Radix so every tap lands) */}
      {filterOpen && createPortal(
        <div className="fixed inset-0 z-[75]" role="dialog" aria-modal="true" aria-label={t('filterTitle')}>
          <div className="absolute inset-0 bg-black/60" onClick={() => setFilterOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[88dvh] rounded-t-3xl bg-background border-t shadow-2xl flex flex-col animate-in fade-in slide-in-from-bottom-6 duration-250">
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b">
              <h2 className="text-lg font-extrabold">{t('filterTitle')}</h2>
              <button
                onClick={() => setFilterOpen(false)}
                aria-label={t('close')}
                className="h-9 w-9 rounded-xl border bg-card flex items-center justify-center hover:bg-muted hover:rotate-90 active:scale-90 transition-all duration-200"
              >
                <X className="h-4 w-4" strokeWidth={2.4} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4" onClick={(e) => e.stopPropagation()}>
              <div className="space-y-1.5">
                <label className="text-sm font-bold">{t('wilaya')}</label>
                <WilayaSelect value={draftWilaya} onChange={setDraftWilaya} className="h-12 rounded-xl" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="f-min" className="text-sm font-bold">{t('minAmount')}</label>
                  <Input
                    id="f-min"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={draftMin}
                    onChange={(e) => setDraftMin(e.target.value)}
                    placeholder="0"
                    className="h-12 rounded-xl text-base"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="f-max" className="text-sm font-bold">{t('maxAmount')}</label>
                  <Input
                    id="f-max"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={draftMax}
                    onChange={(e) => setDraftMax(e.target.value)}
                    placeholder="∞"
                    className="h-12 rounded-xl text-base"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-bold">{t('sortBy')}</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    ['new', 'sortNewest'],
                    ['amount_asc', 'sortAmountAsc'],
                    ['amount_desc', 'sortAmountDesc'],
                  ] as const).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setDraftSort(key)}
                      className={`h-12 rounded-xl border-2 text-xs font-bold px-1.5 transition-all active:scale-95 ${draftSort === key ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground'}`}
                    >
                      {t(label)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))] grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={resetFilters}
                className="h-12 rounded-xl border-2 font-bold text-sm hover:bg-muted active:scale-[0.98] transition-all"
              >
                {t('resetFilters')}
              </button>
              <button
                type="button"
                onClick={applyFilters}
                className="h-12 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/25 hover:brightness-105 active:scale-[0.98] transition-all"
              >
                {t('applyFilters')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <AlertDialog open={!!accepting} onOpenChange={(o) => !o && setAccepting(null)}>
        <AlertDialogContent className="rounded-2xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('acceptConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('acceptConfirmDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl h-11">{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={doAccept} disabled={busy} className="rounded-xl h-11 font-bold">
              {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
              {t('acceptOffer')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Elegant skeleton with the logo + app name while the feed loads. */
function BrandedFeedSkeleton() {
  const { lang } = useLang();
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex flex-col items-center py-4 gap-2.5">
        <img src="/icons/icon-192.png?v=3" alt="" className="h-14 w-14 rounded-2xl shadow-md shadow-primary/20 animate-bounce-sm" />
        <p className="text-sm font-extrabold text-primary">{lang === 'ar' ? 'سلكني ونسلكك' : 'Selekni w Nselkek'}</p>
      </div>
      {[...Array(4)].map((_, i) => (
        <div key={i} className="rounded-2xl border bg-card p-4 space-y-3" style={{ animationDelay: `${i * 120}ms` }}>
          <div className="flex gap-3">
            <Skeleton className="h-16 w-16 rounded-xl" />
            <div className="flex-1 space-y-2.5 pt-1">
              <Skeleton className="h-4 w-3/4 rounded-full" />
              <Skeleton className="h-3 w-full rounded-full" />
              <Skeleton className="h-3 w-2/3 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
