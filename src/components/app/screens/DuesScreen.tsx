'use client';

/**
 * v4.15 — DuesScreen, the executor's dedicated dues PAGE (bottom-bar tab):
 *  - honest states: no completed tasks yet ≠ "everything paid";
 *  - rich month-by-month ledger (tasks, earnings, commission, settlement, proof);
 *  - "how to pay" with the administration's official CCP/RIP (one-tap copy),
 *    a clickable email (mailto) and phone (tel);
 *  - payment-proof upload: a receipt photo the administration reviews before
 *    the month is confirmed as paid.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApp } from '@/store/app';
import { useLang } from '@/lib/language-context';
import { api } from '@/lib/api';
import { compressIdCard, CompressedImage } from '@/lib/image';
import { MyDues, DuesMonth, DuesProof } from '@/lib/types';
import { EmptyState } from '@/components/app/ui-bits';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BadgeCheck, ChevronLeft, Coins, HandCoins, Hourglass, Inbox, LoaderCircle, Mail, Phone, Smartphone, Wallet, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

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
  const qc = useQueryClient();

  // v4.15 — silent refresh every 5 s: the ledger stays live without any spinner
  const { data, isLoading } = useQuery({
    queryKey: ['my-dues'],
    queryFn: () => api.get<MyDues>('/dues/mine'),
    refetchInterval: 5_000,
  });

  // payment-proof submissions and their review state
  const { data: proofsData } = useQuery({
    queryKey: ['my-dues-proofs'],
    queryFn: () => api.get<{ items: DuesProof[] }>('/dues/proofs/mine'),
    refetchInterval: 10_000,
  });
  const proofByMonth = useMemo(() => {
    const m = new Map<string, DuesProof>();
    for (const p of proofsData?.items || []) m.set(p.month, p);
    return m;
  }, [proofsData]);

  const rate = data?.rate ?? 15;
  const totals = data?.totals;
  const months = data?.months || [];
  const hasTasks = (totals?.tasks || 0) > 0;
  const unpaid = totals?.unpaidDA || 0;

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
          {/* ═══ honest hero: three precise states — nothing yet / unpaid / settled ═══ */}
          {!hasTasks ? (
            <div className="rounded-2xl border-2 border-dashed border-muted-foreground/40 bg-card p-5 text-center space-y-2.5 animate-in fade-in slide-in-from-bottom-2">
              <div className="h-12 w-12 rounded-2xl bg-muted mx-auto flex items-center justify-center">
                <Inbox className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="font-extrabold text-lg break-words">{t('duesNothingYetTitle')}</p>
              <p className="text-sm text-muted-foreground leading-relaxed break-words">{t('duesNothingYetHint')}</p>
              <Badge variant="outline" className="font-semibold">0 {t('duesTasksCount')}</Badge>
            </div>
          ) : (
            <div
              className={`rounded-2xl p-5 text-white shadow-lg animate-in fade-in slide-in-from-bottom-2 ${
                unpaid > 0
                  ? 'bg-gradient-to-br from-amber-600 to-amber-500 shadow-amber-500/25'
                  : 'bg-gradient-to-br from-emerald-600 to-emerald-500 shadow-emerald-500/25'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {unpaid > 0 ? <Hourglass className="h-7 w-7" /> : <BadgeCheck className="h-7 w-7" />}
                <div className="min-w-0">
                  <p className="font-extrabold text-lg leading-tight break-words">
                    {unpaid > 0 ? t('duesUnpaidTitle') : t('duesAllPaidTitle')}
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
                  <p className="text-3xl font-extrabold leading-none tabular-nums">{unpaid.toLocaleString('fr-DZ')}</p>
                  <p className="text-xs opacity-90 font-semibold mt-1">DA</p>
                </div>
              </div>
            </div>
          )}

          {/* totals grid */}
          <div className="grid grid-cols-3 gap-3">
            <MiniStat icon={Wallet} label={t('duesEarned')} value={da(totals?.earnedDA || 0)} />
            <MiniStat icon={Coins} label={t('duesCommission', { rate: String(rate) })} value={da(totals?.commissionDA || 0)} />
            <MiniStat icon={BadgeCheck} label={t('duesPaid')} value={da(totals?.paidDA || 0)} />
          </div>

          {/* ═══ per-month breakdown (with the payment-proof state) ═══ */}
          <div className="space-y-2.5">
            <h3 className="font-bold text-sm flex items-center gap-1.5">
              <HandCoins className="h-4 w-4 text-primary" /> {t('duesByMonth')}
            </h3>
            {months.length === 0 ? (
              <EmptyState icon={HandCoins} title={t('duesNoTasks')} hint={t('duesNoTasksHint')} />
            ) : (
              months.map((m, idx) => (
                <MonthRow key={m.month} m={m} lang={lang} t={t} idx={idx} proof={proofByMonth.get(m.month)} />
              ))
            )}
          </div>

          {/* ═══ submit a payment proof for the unsettled months ═══ */}
          {unpaid > 0 && (
            <ProofUploadCard
              unpaidMonths={months.filter((m) => m.unpaidDA > 0)}
              lang={lang}
              t={t}
              proofByMonth={proofByMonth}
              onSubmitted={() => {
                qc.invalidateQueries({ queryKey: ['my-dues-proofs'] });
                qc.invalidateQueries({ queryKey: ['notifications-unread'] });
              }}
            />
          )}

          {/* ═══ how to pay: phone, clickable email, official CCP/RIP with copy ═══ */}
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
                  <a
                    href={`mailto:${data.contact.email}?subject=${encodeURIComponent('Slekni — ' + t('duesTitle'))}`}
                    dir="ltr"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-sky-300 dark:border-sky-700 bg-sky-50 dark:bg-sky-950/40 px-3 py-1.5 text-sm font-bold text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/40 transition-colors break-all max-w-full"
                  >
                    <Mail className="h-3.5 w-3.5 shrink-0" /> <span className="break-all">{data.contact.email}</span>
                  </a>
                )}
              </div>
            )}

            {/* official payment coordinates — tap a row to copy it */}
            {data?.payment && (data.payment.ccp || data.payment.rip) && (
              <div className="rounded-xl border bg-muted/40 p-3 space-y-2">
                <p className="text-xs font-bold text-muted-foreground">{t('duesPaymentCoords')}</p>
                {data.payment.ccp && (
                  <CopyRow
                    icon={<Wallet className="h-3.5 w-3.5" />}
                    label={t('duesCcp')}
                    value={data.payment.ccpKey ? `${data.payment.ccp} clé ${data.payment.ccpKey}` : data.payment.ccp}
                    t={t}
                  />
                )}
                {data.payment.rip && (
                  <CopyRow icon={<Coins className="h-3.5 w-3.5" />} label={t('duesRip')} value={data.payment.rip} t={t} />
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- one month of the ledger ---------- */
function MonthRow({
  m,
  lang,
  t,
  idx,
  proof,
}: {
  m: DuesMonth;
  lang: string;
  t: (k: string, p?: Record<string, string | number>) => string;
  idx: number;
  proof?: DuesProof;
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
      {/* v4.15 — where the submitted receipt stands */}
      {proof && !paid && (
        <div className={`rounded-xl border px-3 py-2 flex items-start gap-2 ${proof.status === 'pending' ? 'border-sky-300 dark:border-sky-700 bg-sky-50 dark:bg-sky-950/40' : 'border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-950/40'}`}>
          {proof.status === 'pending' ? (
            <Hourglass className="h-3.5 w-3.5 text-sky-600 shrink-0 mt-0.5" />
          ) : (
            <X className="h-3.5 w-3.5 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div className="min-w-0">
            <p className={`text-xs font-bold break-words ${proof.status === 'pending' ? 'text-sky-700 dark:text-sky-300' : 'text-rose-700 dark:text-rose-300'}`}>
              {proof.status === 'pending' ? t('duesProofPending') : t('duesProofRejectedRow')}
            </p>
            {(proof.status === 'rejected' && proof.reviewNote) && (
              <p className="text-[11px] text-muted-foreground break-words mt-0.5">{proof.reviewNote}</p>
            )}
          </div>
        </div>
      )}
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

/** One tappable coordinate row — copies CCP/RIP values with a confirmation toast. */
function CopyRow({ icon, label, value, t }: { icon: React.ReactNode; label: string; value: string; t: (k: string) => string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    toast.success(t('duesCopied'));
  }
  return (
    <button
      onClick={copy}
      className="w-full flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2 text-start hover:border-primary/50 active:scale-[0.99] transition-all"
      title={t('duesTapCopy')}
    >
      <span className="text-primary shrink-0">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-bold text-muted-foreground">{label}</span>
        <span className="block text-sm font-extrabold tracking-wide break-all" dir="ltr">{value}</span>
      </span>
      <span className="text-[10px] font-bold text-primary shrink-0">{t('duesTapCopy')}</span>
    </button>
  );
}

/* ---------- payment-proof upload (v4.15) ---------- */
function ProofUploadCard({
  unpaidMonths,
  lang,
  t,
  proofByMonth,
  onSubmitted,
}: {
  unpaidMonths: DuesMonth[];
  lang: string;
  t: (k: string, p?: Record<string, string | number>) => string;
  proofByMonth: Map<string, DuesProof>;
  onSubmitted: () => void;
}) {
  const [month, setMonth] = useState<string>(unpaidMonths[0]?.month || '');
  const [image, setImage] = useState<CompressedImage | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const active = unpaidMonths.find((m) => m.month === month) || unpaidMonths[0];
  const pendingForMonth = active ? proofByMonth.get(active.month) : undefined;

  async function pick(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    setCompressing(true);
    try {
      setImage(await compressIdCard(f));
    } catch {
      toast.error(t('error'));
    } finally {
      setCompressing(false);
    }
  }

  async function submit() {
    if (!active || !image) return;
    setBusy(true);
    try {
      await api.post('/dues/proof', {
        month: active.month,
        image: { mime: image.mime, dataBase64: image.dataBase64 },
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      toast.success(t('duesProofSent'), { duration: 5000 });
      setImage(null);
      setNote('');
      onSubmitted();
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === 'ALREADY_SETTLED') toast.error(t('duesNothingUnpaid'));
      else toast.error(t('error'));
    } finally {
      setBusy(false);
    }
  }

  if (!active) return null;

  return (
    <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
      <h3 className="font-bold text-sm flex items-center gap-1.5">
        <Smartphone className="h-4 w-4 text-primary" /> {t('duesProofTitle')}
      </h3>
      <p className="text-xs text-muted-foreground leading-relaxed break-words">{t('duesProofBody')}</p>

      {/* month picker — only months that still owe money */}
      <div className="space-y-1.5">
        <p className="text-xs font-bold">{t('duesProofMonth')}</p>
        <div className="flex gap-2 flex-wrap">
          {unpaidMonths.map((m) => (
            <button
              key={m.month}
              type="button"
              onClick={() => setMonth(m.month)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all active:scale-95 ${(active.month) === m.month ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}
            >
              {monthLabel(m.month, lang)} · <span dir="ltr">{m.unpaidDA.toLocaleString('fr-DZ')}</span>
            </button>
          ))}
        </div>
      </div>

      {pendingForMonth?.status === 'pending' && (
        <div className="rounded-xl border border-sky-300 dark:border-sky-700 bg-sky-50 dark:bg-sky-950/40 px-3 py-2 flex items-center gap-2">
          <Hourglass className="h-3.5 w-3.5 text-sky-600 shrink-0" />
          <p className="text-xs font-bold text-sky-700 dark:text-sky-300 break-words">{t('duesProofPending')}</p>
        </div>
      )}

      {image ? (
        <div className="space-y-2">
          <img src={`data:${image.mime};base64,${image.dataBase64}`} alt="" className="w-full max-h-44 object-contain rounded-xl border bg-muted/40" />
          <button type="button" onClick={() => setImage(null)} className="text-xs font-bold text-destructive hover:underline">
            {t('deleteImages')}
          </button>
        </div>
      ) : (
        <label className="h-20 rounded-xl border-2 border-dashed border-muted-foreground/40 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-primary/60 hover:bg-primary/5 transition-colors text-sm font-semibold text-muted-foreground">
          {compressing ? <LoaderCircle className="h-5 w-5 animate-spin text-primary" /> : <Smartphone className="h-5 w-5" />}
          {t('duesProofPick')}
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { pick(e.target.files); e.currentTarget.value = ''; }} />
        </label>
      )}

      <div className="space-y-1.5">
        <p className="text-xs font-bold">{t('duesProofNote')}</p>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={300}
          placeholder={t('duesNotePlaceholder')}
          className="h-11 w-full rounded-xl border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      <Button onClick={submit} disabled={busy || !image} className="w-full h-11 rounded-xl font-bold shadow-lg shadow-primary/25">
        {busy && <LoaderCircle className="h-4 w-4 animate-spin me-1.5" />}
        {t('duesProofSend')}
      </Button>
    </div>
  );
}

/** Compact dues strip shown at the top of "My tasks" — tap opens the dues page. */
export function DuesStrip() {
  const { t } = useLang();
  const setTab = useApp((s) => s.setTab);
  const { data } = useQuery({
    queryKey: ['my-dues'],
    queryFn: () => api.get<MyDues>('/dues/mine'),
    refetchInterval: 5_000,
  });
  const unpaid = data?.totals.unpaidDA || 0;
  const hasTasks = (data?.totals.tasks || 0) > 0;

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
          ) : hasTasks ? (
            t('duesStripClear')
          ) : (
            t('duesStripNoTasks')
          )}
        </p>
      </div>
      <ChevronLeft className="h-4 w-4 text-muted-foreground rtl:rotate-180 shrink-0" />
    </button>
  );
}
