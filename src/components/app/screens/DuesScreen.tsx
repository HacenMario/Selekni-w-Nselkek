'use client';

/**
 * v4.14 — DuesScreen (replaces SubscriptionScreen — commission model).
 * The executor pays a configurable percentage (default 15%) of every completed
 * task's agreed amount; dues are settled once a month with the administration.
 * Shows: policy, totals, per-month breakdown, and where/how to pay.
 */

import { useQuery } from '@tanstack/react-query';
import { useApp } from '@/store/app';
import { useLang } from '@/lib/language-context';
import { api } from '@/lib/api';
import { MyDues, DuesMonth } from '@/lib/types';
import { EmptyState } from '@/components/app/ui-bits';
import { Badge } from '@/components/ui/badge';
import { BadgeCheck, ChevronLeft, Coins, HandCoins, Hourglass, Phone, Wallet } from 'lucide-react';

const da = (n: number) => `${(n || 0).toLocaleString('fr-DZ')} DA`;

/** Localized month label for a 'YYYY-MM' bucket. */
function monthLabel(month: string, lang: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, (m || 1) - 1, 1));
  try {
    return d.toLocaleDateString(lang === 'ar' ? 'ar-DZ' : lang === 'fr' ? 'fr-FR' : lang === 'tr' ? 'tr-TR' : lang === 'es' ? 'es-ES' : lang === 'it' ? 'it-IT' : lang === 'de' ? 'de-DE' : lang === 'ru' ? 'ru-RU' : lang === 'zh' ? 'zh-CN' : 'en-GB', { month: 'long', year: 'numeric' });
  } catch {
    return month;
  }
}

export function DuesScreen() {
  const { t, lang } = useLang();

  const { data, isLoading } = useQuery({
    queryKey: ['my-dues'],
    queryFn: () => api.get<MyDues>('/dues/mine'),
    refetchInterval: 30_000,
  });

  const rate = data?.rate ?? 15;
  const totals = data?.totals;
  const months = data?.months || [];

  return (
    <div className="flex-1 overflow-y-auto px-4 pb-28 pt-4 space-y-4">
      <div>
        <h1 className="text-xl font-extrabold break-words">{t('duesTitle')}</h1>
        <p className="text-sm text-muted-foreground mt-1 break-words">{t('duesPolicyBody', { rate: String(rate) })}</p>
      </div>

      {isLoading ? (
        <>
          <div className="h-36 animate-pulse rounded-2xl bg-muted" />
          <div className="h-24 animate-pulse rounded-2xl bg-muted" />
        </>
      ) : (
        <>
          {/* ═══ totals hero: unpaid dues highlighted ═══ */}
          <div
            className={`rounded-2xl p-5 text-white shadow-lg animate-in fade-in slide-in-from-bottom-2 ${
              (totals?.unpaidDA || 0) > 0
                ? 'bg-gradient-to-br from-amber-600 to-amber-500 shadow-amber-500/25'
                : 'bg-gradient-to-br from-emerald-600 to-emerald-500 shadow-emerald-500/25'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {(totals?.unpaidDA || 0) > 0 ? <Hourglass className="h-7 w-7" /> : <BadgeCheck className="h-7 w-7" />}
              <div className="min-w-0">
                <p className="font-extrabold text-lg leading-tight break-words">
                  {(totals?.unpaidDA || 0) > 0 ? t('duesUnpaidTitle') : t('duesAllPaidTitle')}
                </p>
                <p className="text-sm opacity-90 break-words">{t('duesUnpaidSubtitle')}</p>
              </div>
            </div>
            <div className="mt-4 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs opacity-85 font-semibold">{t('duesUnpaid')}</p>
                <p className="text-xs opacity-85 mt-1 break-words">{t('duesBillingNote')}</p>
              </div>
              <div className="text-end shrink-0">
                <p className="text-3xl font-extrabold leading-none tabular-nums">{(totals?.unpaidDA || 0).toLocaleString('fr-DZ')}</p>
                <p className="text-xs opacity-90 font-semibold mt-1">DA</p>
              </div>
            </div>
          </div>

          {/* totals grid */}
          <div className="grid grid-cols-3 gap-3">
            <MiniStat icon={Wallet} label={t('duesEarned')} value={da(totals?.earnedDA || 0)} />
            <MiniStat icon={Coins} label={t('duesCommission', { rate: String(rate) })} value={da(totals?.commissionDA || 0)} />
            <MiniStat icon={BadgeCheck} label={t('duesPaid')} value={da(totals?.paidDA || 0)} />
          </div>

          {/* ═══ per-month breakdown ═══ */}
          <div className="space-y-2.5">
            <h3 className="font-bold text-sm flex items-center gap-1.5">
              <HandCoins className="h-4 w-4 text-primary" /> {t('duesByMonth')}
            </h3>
            {months.length === 0 ? (
              <EmptyState icon={HandCoins} title={t('duesNoTasks')} hint={t('duesNoTasksHint')} />
            ) : (
              months.map((m, idx) => <MonthRow key={m.month} m={m} lang={lang} t={t} idx={idx} />)
            )}
          </div>

          {/* ═══ how to pay ═══ */}
          <div className="rounded-2xl border bg-card p-4 space-y-3">
            <h3 className="font-bold text-sm flex items-center gap-1.5">
              <HandCoins className="h-4 w-4 text-primary" /> {t('duesPayTitle')}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed break-words">{t('duesPayBody')}</p>
            {(data?.contact?.phone || data?.contact?.email) && (
              <div className="flex flex-wrap items-center gap-2">
                {data?.contact?.phone && (
                  <a
                    href={`tel:${data.contact.phone}`}
                    dir="ltr"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 text-sm font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
                  >
                    <Phone className="h-3.5 w-3.5" /> {data.contact.phone}
                  </a>
                )}
                {data?.contact?.email && (
                  <span className="inline-flex items-center gap-1.5 rounded-xl border bg-muted/50 px-3 py-1.5 text-xs font-bold break-all" dir="ltr">
                    {data.contact.email}
                  </span>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function MonthRow({
  m,
  lang,
  t,
  idx,
}: {
  m: DuesMonth;
  lang: string;
  t: (k: string, p?: Record<string, string | number>) => string;
  idx: number;
}) {
  const paid = m.unpaidDA <= 0 && m.commissionDA > 0;
  return (
    <div
      className={`rounded-2xl border bg-card p-4 space-y-2.5 card-hover animate-in fade-in slide-in-from-bottom-2 duration-300 ${m.unpaidDA > 0 ? 'border-amber-300 dark:border-amber-700' : ''}`}
      style={{ animationDelay: `${Math.min(idx * 40, 200)}ms`, animationFillMode: 'backwards' }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-bold text-sm break-words">{monthLabel(m.month, lang)}</p>
        {paid ? (
          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-0 shrink-0 gap-1">
            <BadgeCheck className="h-3 w-3" /> {t('duesPaidBadge')}
          </Badge>
        ) : (
          <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-300 shrink-0">
            {t('duesUnpaidBadge')}
          </Badge>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
        <Row label={t('duesTasksCount')} value={String(m.tasksCount)} />
        <Row label={t('duesEarnedShort')} value={da(m.earnedDA)} />
        <Row label={t('duesCommissionShort', { rate: '' })} value={da(m.commissionDA)} />
        {m.paidDA > 0 && <Row label={t('duesPaidShort')} value={da(m.paidDA)} />}
        {m.unpaidDA > 0 && (
          <Row
            label={t('duesUnpaid')}
            value={da(m.unpaidDA)}
            strong
          />
        )}
        {m.paidAt && <Row label={t('duesPaidOn')} value={new Date(m.paidAt).toLocaleDateString()} />}
        {m.note && <div className="col-span-2 text-[11px] text-muted-foreground break-words">{m.note}</div>}
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 min-w-0">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className={`text-sm font-semibold text-end break-words ${strong ? 'text-amber-700 dark:text-amber-300 font-extrabold' : ''}`}>{value}</span>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/60 p-3 text-center">
      <Icon className="h-4 w-4 text-primary mx-auto" />
      <p className="text-sm font-extrabold mt-1.5 leading-tight break-words" dir="ltr">{value}</p>
      <p className="text-[10px] text-muted-foreground font-semibold mt-1 break-words leading-tight">{label}</p>
    </div>
  );
}

/** Compact dues strip shown at the top of "My tasks" — tap opens the dues tab. */
export function DuesStrip() {
  const { t } = useLang();
  const setTab = useApp((s) => s.setTab);
  const { data } = useQuery({
    queryKey: ['my-dues'],
    queryFn: () => api.get<MyDues>('/dues/mine'),
    refetchInterval: 30_000,
  });
  const unpaid = data?.totals.unpaidDA || 0;

  return (
    <button
      onClick={() => setTab('dues')}
      className={`w-full text-start rounded-2xl border-2 p-3.5 flex items-center gap-3 transition-all active:scale-[0.99] card-hover ${
        unpaid > 0 ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30' : 'border-border bg-card'
      }`}
    >
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${unpaid > 0 ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300' : 'bg-primary/10 text-primary'}`}>
        <HandCoins className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground font-semibold break-words">{t('duesStripLabel', { rate: String(data?.rate ?? 15) })}</p>
        <p className="text-sm font-extrabold break-words">
          {unpaid > 0 ? (
            <>
              {t('duesStripUnpaid')}: <span dir="ltr">{unpaid.toLocaleString('fr-DZ')} DA</span>
            </>
          ) : (
            t('duesStripClear')
          )}
        </p>
      </div>
      <ChevronLeft className="h-4 w-4 text-muted-foreground rtl:rotate-180 shrink-0" />
    </button>
  );
}
