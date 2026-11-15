'use client';

import { Lang } from '@/lib/i18n';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApp } from '@/store/app';
import { useLang } from '@/lib/language-context';
import { api } from '@/lib/api';
import { compressImage } from '@/lib/image';
import { Settings, SubPackage, Subscription } from '@/lib/types';
import { packageImageUrl } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoaderCircle, Wallet, BadgeCheck, Hourglass, XCircle, Upload, FileText, TriangleAlert, CalendarClock, Layers, Sparkles, ShieldBan } from 'lucide-react';
import { toast } from 'sonner';

export function SubscriptionScreen() {
  const { t, lang } = useLang();
  const user = useApp((s) => s.user);
  const [reference, setReference] = useState('');
  const [selectedPkgState, setSelectedPkg] = useState('');
  const [proof, setProof] = useState<{ mime: string; dataBase64: string } | null>(null);
  const [sending, setSending] = useState(false);

  const { data, refetch, isLoading } = useQuery({
    queryKey: ['my-subscription'],
    queryFn: () => api.get<{ current: Subscription | null; locked?: boolean; packages: SubPackage[]; subscription: Settings['subscription'] }>('/subscriptions/mine'),
    enabled: user?.role === 'owner',
    // keeps an admin grant/activation visible within seconds — no stale 'expired' banner
    refetchInterval: 30_000,
  });

  const sub = data?.current;
  const status = sub?.status;
  const pkgs = data?.packages || [];
  const selectedPkg = selectedPkgState || pkgs[0]?.key || '';

  // live clock: days-left and the progress bar tick every 30s without a server round-trip,
  // and server status (lazy expiry) stays fresh via the refetchInterval above
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // days remaining for the active subscription
  const daysLeft = useMemo(() => {
    if (status !== 'active' || !sub?.endsAt) return null;
    return Math.max(0, Math.ceil((new Date(sub.endsAt).getTime() - now) / 86400000));
  }, [status, sub?.endsAt, now]);


  // renewal reminder toast once per session when <= 5 days remain
  useEffect(() => {
    if (daysLeft === null) return;
    if (daysLeft <= 5 && !sessionStorage.getItem('slekni.subwarn')) {
      sessionStorage.setItem('slekni.subwarn', '1');
      toast.warning(daysLeft === 0 ? t('dayLeftOne') : t('subExpiringSoon'), { duration: 7000 });
    }
     
  }, [daysLeft]);

  async function onProof(files: FileList | null) {
    if (!files?.[0]) return;
    try {
      const c = await compressImage(files[0]);
      setProof({ mime: c.mime, dataBase64: c.dataBase64 });
    } catch {
      toast.error(t('error'));
    }
  }

  async function send() {
    if (!reference.trim() || reference.trim().length < 4) return;
    setSending(true);
    try {
      await api.post('/subscriptions', { reference: reference.trim(), packageKey: selectedPkg || undefined, proofImage: proof || undefined });
      toast.success(t('subscriptionSent'));
      setReference('');
      setProof(null);
      refetch();
    } catch {
      toast.error(t('error'));
    } finally {
      setSending(false);
    }
  }

  if (!user || user.role !== 'owner') return null;

  const info = data?.subscription;
  const isActive = status === 'active';

  return (
    <div className="flex-1 overflow-y-auto px-4 pb-28 pt-4 space-y-5">
      <div>
        <h1 className="text-xl font-extrabold">{t('subscriptionTitle')}</h1>
        <p className="text-sm text-muted-foreground mt-1 break-words">{t('subscriptionFree')}</p>
      </div>

      {/* subscription disabled by the administration (v4) */}
      {data?.locked && (
        <div className="rounded-2xl border-2 border-rose-400 bg-rose-50 dark:bg-rose-950/40 p-4 flex items-start gap-3">
          <ShieldBan className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="font-bold text-sm text-rose-700 dark:text-rose-300 break-words">{t('subLockedTitle')}</p>
            <p className="text-xs text-rose-600 dark:text-rose-400 mt-0.5 break-words">{t('subLockedBody')}</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-muted" />
      ) : (
        <>
          {/* ═══ ACTIVE subscription: celebrate it, hide everything that invites to subscribe ═══ */}
          {isActive && (
            <>
              <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-500 text-white p-5 shadow-lg shadow-emerald-500/25 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center gap-2.5">
                  <BadgeCheck className="h-7 w-7" />
                  <div className="min-w-0">
                    <p className="font-extrabold text-lg leading-tight">{t('subActiveBadge')}</p>
                    {sub?.packageName && (
                      <p className="text-sm opacity-90">{sub.packageName[lang] || sub.packageName.en}</p>
                    )}
                  </div>
                </div>

                {/* big days-left counter */}
                <div className="mt-4 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-xs opacity-85 font-semibold">{t('subscriptionActiveUntil')}</p>
                    <p className="text-sm font-bold">{sub?.endsAt ? new Date(sub.endsAt).toLocaleDateString() : ''}</p>
                  </div>
                  <div className="text-end">
                    <p className="text-4xl font-extrabold leading-none tabular-nums">{daysLeft}</p>
                    <p className="text-xs opacity-90 font-semibold mt-1">{daysLeft === 1 ? t('dayLeftOne') : t('daysLeft', { count: daysLeft || 0 })}</p>
                  </div>
                </div>

                {/* progress bar of the elapsed period */}
                {sub?.startsAt && sub?.endsAt && (
                  <div className="mt-3">
                    <div className="h-2 rounded-full bg-white/25 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-white transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(0, ((now - new Date(sub.startsAt!).getTime()) / (new Date(sub.endsAt!).getTime() - new Date(sub.startsAt!).getTime())) * 100))}%` }}
                      />
                    </div>
                    <p className="text-[11px] opacity-85 mt-1.5">{t('subProgress')}</p>
                  </div>
                )}
              </div>

              {/* renewal warning when <= 5 days */}
              {daysLeft !== null && daysLeft <= 5 && (
                <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/40 p-4 flex items-start gap-3 animate-in fade-in">
                  <TriangleAlert className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-amber-700 dark:text-amber-300 break-words">{t('subExpiringSoon')}</p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">{daysLeft === 1 ? t('dayLeftOne') : t('daysLeft', { count: daysLeft })}</p>
                  </div>
                </div>
              )}

              {/* what the plan includes — informational only */}
              <div className="rounded-2xl border bg-card p-4 grid grid-cols-3 gap-3 text-center">
                <MiniStat icon={Wallet} label={t('subscriptionPrice')} value={`${(sub?.amountDA ?? 0).toLocaleString('fr-DZ')}`} unit="DA" />
                <MiniStat icon={CalendarClock} label={t('subscriptionDuration')} value={String(sub?.durationDays ?? info?.durationDays ?? '-')} unit={t('days')} />
                <MiniStat icon={Layers} label={t('packageOffers')} value={String(sub?.maxActiveOffers ?? info?.maxActiveOffers ?? '-')} unit="" />
              </div>
            </>
          )}

          {/* ═══ NOT active: pending / rejected / expired / none ═══ */}
          {!isActive && (
            <>
              <div className="rounded-2xl border bg-card p-4 flex items-center gap-3">
                {status === 'pending' ? (
                  <>
                    <Hourglass className="h-6 w-6 text-amber-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-amber-600 dark:text-amber-400">{t('subscriptionPending')}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 break-words">{t('reference')}: {sub?.reference}</p>
                    </div>
                  </>
                ) : status === 'rejected' ? (
                  <>
                    <XCircle className="h-6 w-6 text-rose-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-rose-600 dark:text-rose-400">{t('subscriptionRejected')}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 break-words">{t('paymentReference')}: {sub?.reference}</p>
                    </div>
                  </>
                ) : status === 'expired' ? (
                  <>
                    <XCircle className="h-6 w-6 text-rose-500 shrink-0" />
                    <p className="font-bold text-sm text-rose-600 dark:text-rose-400">{t('subscriptionExpired')}</p>
                  </>
                ) : (
                  <>
                    <Wallet className="h-6 w-6 text-muted-foreground shrink-0" />
                    <p className="font-bold text-sm text-muted-foreground">{t('subscriptionNone')}</p>
                  </>
                )}
              </div>

              {/* packages */}
              <div className="space-y-2.5">
                <h3 className="font-bold text-sm flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-primary" /> {t('choosePackage')}
                </h3>
                {pkgs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('noPackages')}</p>
                ) : (
                  <div className="grid gap-3">
                    {pkgs.map((p) => {
                      const sel = selectedPkg === p.key;
                      return (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => setSelectedPkg(p.key)}
                          className={`text-start rounded-2xl border-2 p-4 transition-all active:scale-[0.99] card-hover ${sel ? 'border-primary bg-primary/8 shadow-md shadow-primary/10' : 'border-border bg-card hover:border-primary/40'}`}
                        >
                          {p.imageGridId && (
                            <img src={packageImageUrl(p.imageGridId)} alt="" className="w-full h-36 object-contain bg-muted rounded-xl border mb-3" loading="lazy" />
                          )}
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-extrabold">{p.name[lang] || p.name.en}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {t('subscriptionDuration')}: <b>{p.durationDays}</b> {t('days')} · {t('packageOffers')}: <b>{p.maxActiveOffers}</b>
                              </p>
                            </div>
                            <div className="text-end shrink-0">
                              <p className="text-2xl font-extrabold text-primary leading-none">{p.priceDA.toLocaleString('fr-DZ')}</p>
                              <p className="text-[11px] font-bold text-muted-foreground mt-0.5">DA</p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* payment instructions + form */}
              {info?.isEnabled && (
                <div className="rounded-2xl border bg-card p-4 space-y-4">
                  <div className="space-y-1">
                    <h3 className="font-bold text-sm flex items-center gap-1.5">
                      <FileText className="h-4 w-4 text-primary" /> {t('paymentInstructions')}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">
                      {pickLangText(info?.paymentInstructions || '', lang)}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="pay-ref">{t('paymentReference')} *</Label>
                    <Input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder={t('paymentReferencePlaceholder')} className="h-11 rounded-xl" maxLength={100} />
                  </div>

                  <div className="space-y-1.5">
                    <Label>{t('attachProof')}</Label>
                    <label className="flex items-center justify-center gap-2 h-11 rounded-xl border-2 border-dashed border-muted-foreground/40 cursor-pointer hover:border-primary/60 hover:bg-primary/5 transition-colors text-sm font-semibold text-muted-foreground">
                      {proof ? <BadgeCheck className="h-4 w-4 text-emerald-600" /> : <Upload className="h-4 w-4" />}
                      {proof ? '1 ' + t('images') : t('addImages')}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => { onProof(e.target.files); e.currentTarget.value = ''; }} />
                    </label>
                  </div>

                  <Button onClick={send} disabled={sending || reference.trim().length < 4} className="w-full h-12 rounded-xl font-bold shadow-lg shadow-primary/25">
                    {sending && <LoaderCircle className="h-5 w-5 animate-spin" />}
                    {t('subscribe')}
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, unit }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; unit: string }) {
  return (
    <div className="rounded-xl bg-muted/60 p-3">
      <Icon className="h-4 w-4 text-primary mx-auto" />
      <p className="text-lg font-extrabold mt-1 leading-none">
        {value} <span className="text-[11px] font-bold text-muted-foreground">{unit}</span>
      </p>
      <p className="text-[10px] text-muted-foreground font-semibold mt-1 break-words">{label}</p>
    </div>
  );
}

/** paymentInstructions may contain ar|fr|en segments separated by '|' */
function pickLangText(text: string, lang: Lang): string {
  const parts = text.split('|').map((s) => s.trim()).filter(Boolean);
  if (parts.length <= 1) return text;
  const idx = lang === 'ar' ? 0 : lang === 'fr' ? 1 : 2;
  return parts[idx] ?? parts[parts.length - 1];
}
