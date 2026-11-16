'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApp, AdminTab } from '@/store/app';
import { useLang } from '@/lib/language-context';
import { api, idCardUrl, mediaUrl } from '@/lib/api';
import { badgeDelta, getClicked, markClicked, markTabSeen } from '@/lib/admin-badges';
import { AdminDashboard, AdminDuesRow, AdminDuesSummary, AdminStats, Complaint, DuesMonth, DuesProof, DuesTask, MyDues, Offer, Paged, PublicUser, Settings, User } from '@/lib/types';
import { AmountPill, Pager, StatusBadge, timeAgo } from '@/components/app/ui-bits';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { WilayaSelect } from '@/components/app/WilayaSelect';
import { wilayaLabel } from '@/lib/wilayas';
import { UserAvatar } from '@/components/app/UserAvatar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import {
  BadgeCheck, Ban, BarChart3, Check, ClipboardList, Coins, Crown, Droplets, Gavel, HandCoins, Handshake, Hourglass, IdCard, ImagePlus, LoaderCircle,
  LayoutDashboard, MapPin, Megaphone, Pencil, Phone, Send, Settings2, ShieldCheck, Wallet, X,
  TrendingUp, Trash2, Users, UsersRound, Wrench,
} from 'lucide-react';
import { toast } from 'sonner';

export function AdminScreen() {
  const { t } = useLang();
  const adminTab = useApp((s) => s.adminTab);
  const setAdminTab = useApp((s) => s.setAdminTab);

  // live pending counts that drive the numeric tab badges
  const { data: badgeData } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => api.get<AdminDashboard>('/admin/dashboard'),
    refetchInterval: 20_000,
  });
  const counts: Record<string, number> = {
    // v4.14 — the dues tab badge counts executors with UNPAID dues
    dues: badgeData?.dues.unpaidUsers || 0,
    complaints: badgeData?.complaintsOpen || 0,
    users: badgeData?.users.idPending || 0,
    offers: badgeData?.offers.open || 0,
  };

  /** Opening a tab resets its badge instantly (it re-arms when new items arrive). */
  function switchTab(v: string) {
    const tab = v as AdminTab;
    if (counts[tab] !== undefined) markTabSeen(tab, counts[tab]);
    setAdminTab(tab);
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <Tabs value={adminTab} onValueChange={switchTab} className="flex-1 flex flex-col min-h-0">
        {/* wrapping grid — every tab is a real button, clickable on desktop AND mobile (no scroll needed) */}
        <div className="px-3 pt-3">
          <TabsList className="flex flex-wrap justify-center gap-1 h-auto rounded-xl bg-muted/70 p-1.5 w-full">
            <TabsTrigger value="dashboard" className="rounded-lg gap-1.5 px-2.5 h-9 data-[state=active]:bg-background data-[state=active]:shadow-sm"><LayoutDashboard className="h-4 w-4 shrink-0" /><span className="text-xs font-bold">{t('dashboard')}</span></TabsTrigger>
            <TabsTrigger value="dues" className="rounded-lg gap-1.5 px-2.5 h-9 data-[state=active]:bg-background data-[state=active]:shadow-sm"><HandCoins className="h-4 w-4 shrink-0" /><span className="text-xs font-bold">{t('duesAdminTab')}</span><TabBadge count={badgeDelta('dues', counts.dues)} /></TabsTrigger>
            <TabsTrigger value="complaints" className="rounded-lg gap-1.5 px-2.5 h-9 data-[state=active]:bg-background data-[state=active]:shadow-sm"><Gavel className="h-4 w-4 shrink-0" /><span className="text-xs font-bold">{t('complaintsLabel')}</span><TabBadge count={badgeDelta('complaints', counts.complaints)} /></TabsTrigger>
            <TabsTrigger value="users" className="rounded-lg gap-1.5 px-2.5 h-9 data-[state=active]:bg-background data-[state=active]:shadow-sm"><UsersRound className="h-4 w-4 shrink-0" /><span className="text-xs font-bold">{t('users')}</span><TabBadge count={badgeDelta('users', counts.users)} /></TabsTrigger>
            <TabsTrigger value="offers" className="rounded-lg gap-1.5 px-2.5 h-9 data-[state=active]:bg-background data-[state=active]:shadow-sm"><ClipboardList className="h-4 w-4 shrink-0" /><span className="text-xs font-bold">{t('offers')}</span><TabBadge count={badgeDelta('offers', counts.offers)} /></TabsTrigger>
            <TabsTrigger value="settings" className="rounded-lg gap-1.5 px-2.5 h-9 data-[state=active]:bg-background data-[state=active]:shadow-sm"><Settings2 className="h-4 w-4 shrink-0" /><span className="text-xs font-bold">{t('manageSettings')}</span></TabsTrigger>
            <TabsTrigger value="broadcast" className="rounded-lg gap-1.5 px-2.5 h-9 data-[state=active]:bg-background data-[state=active]:shadow-sm"><Megaphone className="h-4 w-4 shrink-0" /><span className="text-xs font-bold">{t('broadcast')}</span></TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="dashboard" className="flex-1 overflow-y-auto px-4 pb-28 pt-4 mt-0">
          <DashboardTab />
        </TabsContent>
        <TabsContent value="dues" className="flex-1 overflow-y-auto px-4 pb-28 pt-4 mt-0">
          <DuesTab />
        </TabsContent>
        <TabsContent value="complaints" className="flex-1 overflow-y-auto px-4 pb-28 pt-4 mt-0">
          <ComplaintsTab />
        </TabsContent>
        <TabsContent value="users" className="flex-1 overflow-y-auto px-4 pb-28 pt-4 mt-0">
          <UsersTab />
        </TabsContent>
        <TabsContent value="offers" className="flex-1 overflow-y-auto px-4 pb-28 pt-4 mt-0">
          <OffersTab />
        </TabsContent>
        <TabsContent value="settings" className="flex-1 overflow-y-auto px-4 pb-28 pt-4 mt-0">
          <SettingsTab />
        </TabsContent>
        <TabsContent value="broadcast" className="flex-1 overflow-y-auto px-4 pb-28 pt-4 mt-0">
          <BroadcastTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------- Dashboard ---------- */
/** Numeric attention badge for a tab — bounces while there is something unseen. */
function TabBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="min-w-5 h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-extrabold inline-flex items-center justify-center animate-bounce-new shadow-sm shrink-0">
      {count > 99 ? '99+' : count}
    </span>
  );
}

function DashboardTab() {
  const { t } = useLang();
  const setAdminTab = useApp((s) => s.setAdminTab);
  const { data } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => api.get<AdminDashboard>('/admin/dashboard'),
    refetchInterval: 20_000,
  });

  if (!data) return <Spinner />;
  const switchTabFrom = (tab: AdminTab) => setAdminTab(tab);

  /** Share of the commission that has actually been collected (0-100). */
  function duesCollectionPct(d: AdminDashboard['dues']): number {
    if (!d.duesDA || d.duesDA <= 0) return 100;
    return Math.min(100, Math.max(0, Math.round(((d.duesDA - d.unpaidDA) / d.duesDA) * 100)));
  }

  return (
    <div className="space-y-5">
      {/* overview KPI cards (v4.14 — accounts, commission dues, moderation, offers funnel) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Kpi icon={Users} label={t('totalUsers')} value={data.users.total} />
        <Kpi icon={Handshake} label={t('owners')} value={data.users.owners} />
        <Kpi icon={Wrench} label={t('seekers')} value={data.users.seekers} />
        <Kpi icon={BadgeCheck} label={t('verifiedKpi')} value={data.users.verified ?? 0} />
        <Kpi icon={Ban} label={t('bannedKpi')} value={data.users.banned ?? 0} />
        {/* v4.14 — commission dues replace the subscription KPIs */}
        <Kpi icon={HandCoins} label={t('duesUnpaidKpi')} value={`${(data.dues.unpaidDA || 0).toLocaleString('fr-DZ')}`} highlight={(data.dues.unpaidDA || 0) > 0} />
        <Kpi icon={Hourglass} label={t('duesUnpaidUsersKpi')} value={data.dues.unpaidUsers || 0} highlight={(data.dues.unpaidUsers || 0) > 0} />
        <Kpi icon={Gavel} label={t('complaintsOpenCount')} value={data.complaintsOpen} highlight={data.complaintsOpen > 0} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Kpi icon={Check} label={t('statusOpen')} value={data.offers.open} />
        <Kpi icon={Handshake} label={t('statusAssigned')} value={data.offers.assigned} />
        <Kpi icon={Coins} label={t('statusAwaiting')} value={data.offers.awaiting} />
        <Kpi icon={BadgeCheck} label={t('statusDone')} value={data.offers.done} />
      </div>

      {/* v4.15 — dues control rings: collection, unpaid share, month share */}
      <div className="grid grid-cols-3 gap-2.5">
        <RingStat
          pct={duesCollectionPct(data.dues)}
          icon={BadgeCheck}
          label={t('duesRingCollected')}
          value={`${duesCollectionPct(data.dues)}%`}
          tone="emerald"
        />
        <RingStat
          pct={data.dues.duesDA > 0 ? Math.min(100, Math.round(((data.dues.unpaidDA || 0) / data.dues.duesDA) * 100)) : 0}
          icon={Hourglass}
          label={t('duesRingUnpaid')}
          value={`${(data.dues.unpaidDA || 0).toLocaleString('fr-DZ')}`}
          tone="amber"
          small="DA"
        />
        <RingStat
          pct={data.dues.duesDA > 0 ? Math.min(100, Math.round(((data.dues.monthCommissionsDA || 0) / data.dues.duesDA) * 100)) : 0}
          icon={Coins}
          label={t('duesRingMonth')}
          value={`${(data.dues.monthCommissionsDA || 0).toLocaleString('fr-DZ')}`}
          tone="sky"
          small="DA"
        />
      </div>

      {/* v4.14 — this month's commission expectation, so the admin knows what to collect */}
      <div className="rounded-2xl border bg-card p-4 flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <HandCoins className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground font-semibold break-words">{t('duesMonthKpi')}</p>
          <p className="text-lg font-extrabold break-words" dir="ltr">{(data.dues.monthCommissionsDA || 0).toLocaleString('fr-DZ')} DA</p>
        </div>
        <Badge variant="outline" className="shrink-0">{t('duesRateBadge', { rate: data.dues.rate ?? 15 })}</Badge>
      </div>

      {/* v4.15 — payment proofs waiting for review, straight from the dashboard */}
      {Boolean(data.dues.proofsPending) && (
        <button
          onClick={() => switchTabFrom('dues')}
          className="w-full rounded-2xl border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/40 p-4 flex items-center gap-3 text-start active:scale-[0.99] transition-all"
        >
          <span className="h-11 w-11 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-300 flex items-center justify-center shrink-0">
            <ImagePlus className="h-5 w-5" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block font-bold text-sm text-amber-700 dark:text-amber-300 break-words">{t('duesProofsPendingTitle')}</span>
            <span className="block text-xs text-muted-foreground break-words mt-0.5">{t('duesProofsPendingHint')}</span>
          </span>
          <Badge className="bg-amber-500 text-white border-0 shrink-0">{data.dues.proofsPending}</Badge>
        </button>
      )}

      <div className="rounded-2xl border bg-card p-4">
        <h3 className="font-bold text-sm mb-3">{t('seeAll')} — {t('users')}</h3>
        <div className="space-y-2">
          {data.recentUsers.map((u) => (
            <div key={u._id} className="flex items-center gap-3 rounded-xl border bg-muted/30 p-2.5">
              <UserAvatar user={u} size="h-11 w-11" textClass="text-sm" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold break-words leading-tight">{u.name}</p>
                <p className="text-xs text-muted-foreground break-all">{u.email}</p>
              </div>
              <RoleBadge user={u} />
            </div>
          ))}
        </div>
      </div>

      {/* smart statistics + charts (v4) */}
      <AnalyticsSection />
    </div>
  );
}

function Kpi({ icon: Icon, label, value, highlight }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 space-y-1 ${highlight ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/40' : 'bg-card'}`}>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[11px] font-semibold break-words">{label}</span>
      </div>
      <p className="text-2xl font-extrabold tracking-tight">{value}</p>
    </div>
  );
}

/* ---------- v4.15 — circular dues control cards ---------- */
const RING_TONES: Record<string, string> = {
  emerald: '#10b981',
  amber: '#f59e0b',
  sky: '#0ea5e9',
  primary: '#8b5cf6',
};

/** A circular progress card (SVG ring) — one glance says how dues stand. */
function RingStat({
  pct,
  icon: Icon,
  label,
  value,
  tone = 'primary',
  small,
}: {
  pct: number;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: string | number;
  tone?: keyof typeof RING_TONES;
  small?: string;
}) {
  const color = RING_TONES[tone] || RING_TONES.primary;
  const p = Math.min(100, Math.max(0, pct || 0));
  return (
    <div className="rounded-2xl border bg-card p-3 flex flex-col items-center text-center gap-1.5">
      <div className="relative h-16 w-16 shrink-0">
        <svg viewBox="0 0 40 40" className="h-16 w-16 -rotate-90">
          <circle cx="20" cy="20" r="15.915" fill="none" stroke="currentColor" className="text-muted" strokeWidth="5.5" />
          <circle
            cx="20" cy="20" r="15.915"
            fill="none" stroke={color}
            strokeWidth="5.5" strokeLinecap="round"
            strokeDasharray={`${p} ${100 - p}`}
            className="transition-all duration-500"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[13px] font-extrabold tabular-nums">{p}%</span>
      </div>
      <Icon className="h-3.5 w-3.5" style={{ color }} />
      <p className="text-sm font-extrabold leading-none tabular-nums break-all" dir="ltr">
        {value}
        {small && <span className="text-[9px] font-bold text-muted-foreground ms-0.5">{small}</span>}
      </p>
      <p className="text-[10px] font-semibold text-muted-foreground leading-tight break-words">{label}</p>
    </div>
  );
}

function RoleBadge({ user }: { user: User }) {
  const { t } = useLang();
  if (user.isSuperAdmin) {
    return (
      <Badge className="bg-gradient-to-r from-amber-500 to-amber-600 text-white border-0 shrink-0 gap-1">
        <Crown className="h-3 w-3" /> {t('roleAdmin')}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={`shrink-0 ${user.role === 'owner' ? 'text-teal-700 dark:text-teal-300 border-teal-300' : 'text-sky-700 dark:text-sky-300 border-sky-300'}`}>
      {user.role === 'owner' ? t('roleOwner') : t('roleSeeker')}
    </Badge>
  );
}

/* ---------- Complaints ---------- */
function ComplaintsTab() {
  const { t } = useLang();
  const qc = useQueryClient();
  const [status, setStatus] = useState('open');
  const [page, setPage] = useState(1);
  const [resolveId, setResolveId] = useState<string | null>(null);
  const [resolution, setResolution] = useState('');
  const [busy, setBusy] = useState(false);
  // open complaints the administration has not clicked yet — they bounce
  const [clickedIds, setClickedIds] = useState<string[]>(() => getClicked('complaints'));

  function viewCard(id: string) {
    if (!clickedIds.includes(id)) {
      markClicked('complaints', id);
      setClickedIds(getClicked('complaints'));
    }
  }

  const { data, isLoading } = useQuery({
    queryKey: ['admin-complaints', status, page],
    queryFn: () => api.get<Paged<Complaint>>('/admin/complaints', { status, page, limit: 10 }),
  });

  async function resolve() {
    if (!resolveId) return;
    setBusy(true);
    try {
      await api.post(`/admin/complaints/${resolveId}/resolve`, { resolution });
      toast.success(t('complaintResolved'));
      setResolveId(null);
      setResolution('');
      qc.invalidateQueries({ queryKey: ['admin-complaints'] });
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
    } catch {
      toast.error(t('error'));
    } finally {
      setBusy(false);
    }
  }

  const name = (u: Complaint['by'] | Complaint['against']) => (typeof u === 'object' && u ? u.name : '—');

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        {['open', 'resolved'].map((s) => (
          <button key={s} onClick={() => { setStatus(s); setPage(1); }} className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${status === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
            {s === 'open' ? t('complaintStatusOpen') : t('complaintStatusResolved')}
          </button>
        ))}
      </div>
      {isLoading ? (
        <Spinner />
      ) : !data || data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">{t('noComplaints')}</p>
      ) : (
        data.items.map((c) => {
          const offer = typeof c.offer === 'object' ? c.offer : null;
          return (
            <div
              key={c._id}
              onClick={() => viewCard(c._id)}
              className={`rounded-2xl border bg-card p-4 space-y-2.5 card-hover cursor-pointer ${c.status === 'open' && !clickedIds.includes(c._id) ? 'animate-bounce-new border-2 border-amber-400' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-sm break-words">{c.subject}</p>
                  <p className="text-xs text-muted-foreground break-words">
                    {offer ? `${t('offers')}: ${offer.title}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {(c.kind === 'suggestion' || c.kind === 'report') && (
                    <Badge variant="outline" className={`text-[10px] ${c.kind === 'suggestion' ? 'border-sky-300 text-sky-600' : 'border-amber-300 text-amber-600'}`}>
                      {c.kind === 'suggestion' ? t('kindSuggestion') : t('kindReport')}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-[10px]">
                    {c.byRole === 'owner' ? t('byRoleOwner') : t('byRoleSeeker')}
                  </Badge>
                </div>
              </div>
              <p className="text-sm text-muted-foreground break-words leading-relaxed">{c.description}</p>
              <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                <span>{t('requester')}: <b className="text-foreground">{name(c.by)}</b></span>
                {c.against && <span>· {t('againstUser')}: <b className="text-foreground">{name(c.against)}</b></span>}
                <span className="ms-auto">{timeAgo(c.createdAt, t)}</span>
              </div>
              {/* v4.9 — callback phone the sender left on the contact page */}
              {c.phone && (
                <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 w-fit hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors" dir="ltr">
                  <Phone className="h-3 w-3" /> {c.phone}
                </a>
              )}
              {c.status === 'resolved' ? (
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-3 py-2">
                  <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 mb-0.5">{t('complaintStatusResolved')}</p>
                  <p className="text-xs text-emerald-800 dark:text-emerald-200 break-words">{c.resolution}</p>
                </div>
              ) : (
                <Button
                  onClick={() => { setResolveId(c._id); setResolution(''); }}
                  className="w-full h-10 rounded-xl font-bold"
                >
                  <Check className="h-4 w-4 me-1.5" /> {t('resolveComplaint')}
                </Button>
              )}
            </div>
          );
        })
      )}

      {data && <Pager page={data.page || page} pages={data.pages} onChange={setPage} />}

      <AlertDialog open={!!resolveId} onOpenChange={(o) => !o && setResolveId(null)}>
        <AlertDialogContent className="rounded-2xl max-w-sm" aria-describedby={undefined}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('resolveComplaint')}</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="res-text">{t('resolutionLabel')}</Label>
            <Textarea id="res-text" value={resolution} onChange={(e) => setResolution(e.target.value)} className="min-h-24 rounded-xl" maxLength={1000} />
          </div>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl h-11">{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={resolve} disabled={busy || !resolution.trim()} className="rounded-xl h-11 font-bold">
              {busy && <Hourglass className="h-4 w-4 animate-spin" />}
              {t('resolveComplaint')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ---------- Users ---------- */
function UsersTab() {
  const { t, lang } = useLang();
  const qc = useQueryClient();
  // query-token for <img> sources (ID-card photos) — must live inside this tab
  const token = typeof window !== 'undefined' ? localStorage.getItem('slekni.token') || '' : '';
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [detailUser, setDetailUser] = useState<User | null>(null);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const [proof, setProof] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // pending-verification cards the administration has already clicked
  const [clickedIds, setClickedIds] = useState<string[]>(() => getClicked('users'));

  function viewCard(id: string) {
    if (!clickedIds.includes(id)) {
      markClicked('users', id);
      setClickedIds(getClicked('users'));
    }
  }

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', q, filter, page],
    queryFn: () => api.get<Paged<User>>('/admin/users', { q: q || undefined, f: filter || undefined, page, limit: 10 }),
  });

  /** Confirm the seeker's ID card — wipes the image from the database immediately. */
  async function verifyId(u: User, decision: 'verify-id' | 'reject-id', reason = '') {
    setBusy(true);
    try {
      await api.post(`/admin/users/${u._id}/${decision}`, { reason });
      toast.success(decision === 'verify-id' ? t('idCardVerifiedToast') : t('idCardRejectedToast'), { duration: 6000 });
      setDetailUser(null);
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
    } catch {
      toast.error(t('error'));
    } finally {
      setBusy(false);
    }
  }

  async function toggleBan(u: User) {
    setBusy(true);
    try {
      await api.post(`/admin/users/${u._id}/${u.isBanned ? 'unban' : 'ban'}`);
      toast.success(u.isBanned ? t('enableUser') : t('disableUser'));
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      setDetailUser(null);
    } catch {
      toast.error(t('error'));
    } finally {
      setBusy(false);
    }
  }

  async function doDelete() {
    if (!deleteUser) return;
    setBusy(true);
    try {
      await api.del(`/admin/users/${deleteUser._id}`);
      toast.success(t('deleteUser'));
      setDeleteUser(null);
      setDetailUser(null);
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
    } catch (e) {
      toast.error((e as { code?: string }).code === 'FORBIDDEN' ? t('error') : t('error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder={t('search')} className="h-11 rounded-xl bg-card" inputMode="search" />
      {/* smart filters: role / verification status / banned */}
      <div className="flex gap-2 flex-wrap">
        {([
          ['', 'usersFilterAll'],
          ['owner', 'usersFilterOwners'],
          ['seeker', 'usersFilterSeekers'],
          ['idpending', 'usersFilterIdPending'],
          ['idverified', 'usersFilterIdVerified'],
          ['idrejected', 'usersFilterIdRejected'],
          ['banned', 'usersFilterBanned'],
        ] as const).map(([v, key]) => (
          <button key={v || 'all'} onClick={() => { setFilter(v); setPage(1); }} className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all active:scale-95 ${filter === v ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}>
            {t(key)}
          </button>
        ))}
      </div>
      {isLoading ? (
        <Spinner />
      ) : !data || data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">{t('userNotFound')}</p>
      ) : (
        data.items.map((u) => (
          <div
            key={u._id}
            onClick={() => viewCard(u._id)}
            className={`rounded-2xl border bg-card p-3.5 card-hover cursor-pointer ${u.idVerified === 'pending' ? 'border-2 border-amber-400' : ''} ${u.idVerified === 'pending' && !clickedIds.includes(u._id) ? 'animate-bounce-new' : ''}`}
          >
            {/* card click → details modal */}
            <button onClick={() => setDetailUser(u)} className="w-full flex items-center gap-3 text-start">
              <UserAvatar user={u} size="h-12 w-12" ring />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-sm break-words leading-tight">{u.name}</p>
                <p className="text-xs text-muted-foreground break-all">{u.email}</p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <RoleBadge user={u} />
                {u.idVerified === 'pending' && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-300">
                    <IdCard className="h-3 w-3" /> {t('idPendingBadge')}
                  </span>
                )}
              </div>
            </button>
            {/* full control row: edit / disable / delete */}
            <div className="flex items-center gap-2 mt-3 pt-3 border-t">
              <button
                onClick={() => setEditUser(u)}
                className="flex-1 h-9 rounded-xl border bg-card text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-muted active:scale-95 transition-all"
              >
                <Pencil className="h-3.5 w-3.5" /> {t('editUser')}
              </button>
              <button
                onClick={() => toggleBan(u)}
                disabled={busy || u.isSuperAdmin}
                className={`flex-1 h-9 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all disabled:opacity-40 ${u.isBanned ? 'border-emerald-300 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40' : 'border-amber-300 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40'}`}
              >
                <Ban className="h-3.5 w-3.5" /> {u.isBanned ? t('enableUser') : t('disableUser')}
              </button>
              <button
                onClick={() => setDeleteUser(u)}
                disabled={busy || u.isSuperAdmin}
                aria-label={t('deleteUser')}
                className="h-9 px-3 rounded-xl border border-destructive/40 text-destructive flex items-center justify-center hover:bg-destructive/10 active:scale-95 transition-all disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))
      )}

      {data && <Pager page={data.page || page} pages={data.pages} onChange={setPage} />}
      <AlertDialog open={!!detailUser} onOpenChange={(o) => !o && setDetailUser(null)}>
        <AlertDialogContent className="rounded-2xl max-w-md max-h-[85dvh] overflow-y-auto" aria-describedby={undefined}>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" /> {t('userDetails')}
            </AlertDialogTitle>
          </AlertDialogHeader>
          {detailUser && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <UserAvatar user={detailUser} size="h-16 w-16" ring />
                <div className="min-w-0">
                  <p className="font-extrabold break-words leading-tight">{detailUser.name}</p>
                  <p className="text-xs text-muted-foreground break-all">{detailUser.email}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <RoleBadge user={detailUser} />
                {detailUser.bloodType && (
                  <Badge variant="outline" className="border-rose-300 text-rose-600 gap-1">
                    <Droplets className="h-3 w-3" /> {detailUser.bloodType}
                  </Badge>
                )}
                <Badge variant="outline" className={detailUser.isBanned ? 'text-rose-600 border-rose-300' : 'text-emerald-600 border-emerald-300'}>
                  {detailUser.isBanned ? t('banned') : t('active')}
                </Badge>
                {detailUser.role === 'seeker' && (
                  <Badge variant="outline" className={
                    detailUser.idVerified === 'verified' ? 'text-emerald-600 border-emerald-300'
                      : detailUser.idVerified === 'pending' ? 'text-amber-600 border-amber-300'
                        : detailUser.idVerified === 'rejected' ? 'text-rose-600 border-rose-300' : ''
                  }>
                    {detailUser.idVerified === 'verified' ? t('idVerifiedBadge')
                      : detailUser.idVerified === 'pending' ? t('idPendingBadge')
                        : detailUser.idVerified === 'rejected' ? t('idRejectedBadge') : t('idVerifiedLabel')}
                  </Badge>
                )}
                {detailUser.profileComplete === false && (
                  <Badge variant="outline" className="text-amber-600 border-amber-300">⚠ {t('completeProfileTitle')}</Badge>
                )}
              </div>

              {/* ID-card verification review — the photo is wiped from the DB on either decision */}
              {detailUser.role === 'seeker' && detailUser.idVerified === 'pending' && detailUser.hasIdCard && (
                <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/40 p-3.5 space-y-3">
                  <div className="flex items-center gap-2">
                    <IdCard className="h-4.5 w-4.5 text-amber-600 dark:text-amber-300" />
                    <p className="font-bold text-sm text-amber-700 dark:text-amber-300">{t('idVerifiedLabel')}</p>
                  </div>
                  <button onClick={() => setProof(idCardUrl(detailUser._id, token))} className="relative w-full text-start">
                    <img src={idCardUrl(detailUser._id, token)} alt={t('idCardUpload')} className="max-h-60 rounded-xl border w-full object-contain bg-muted" />
                    <span className="absolute bottom-2 end-2 rounded-lg bg-black/60 text-white text-[11px] font-bold px-2 py-1">{t('viewFull')}</span>
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button onClick={() => verifyId(detailUser, 'verify-id')} disabled={busy} className="rounded-xl h-10 font-bold bg-emerald-600 hover:bg-emerald-700">
                      <BadgeCheck className="h-4 w-4 me-1" /> {t('verifyIdCard')}
                    </Button>
                    <Button onClick={() => verifyId(detailUser, 'reject-id', t('idCardUpload'))} disabled={busy} variant="outline" className="rounded-xl h-10 font-bold text-destructive border-destructive/40">
                      <X className="h-4 w-4 me-1" /> {t('rejectIdCard')}
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground break-words">{t('idCardUploadHint')}</p>
                </div>
              )}
              <div className="rounded-xl border bg-muted/30 divide-y text-sm">
                <DetailRow label={t('phone')} value={detailUser.phone || '—'} />
                <DetailRow label={t('wilaya')} value={detailUser.wilaya || '—'} />
                <DetailRow label={t('gender')} value={detailUser.gender === 'male' ? t('male') : detailUser.gender === 'female' ? t('female') : '—'} />
                <DetailRow label={t('age')} value={detailUser.age ? `${detailUser.age}` : '—'} />
                <DetailRow label="Provider" value={detailUser.authProvider || 'password'} />
                <DetailRow label={t('memberSince')} value={new Date(detailUser.createdAt).toLocaleDateString()} />
                <DetailRow label={t('skillsTitle')} value={detailUser.skills || '—'} />
                <DetailRow label={t('interestsTitle')} value={(detailUser.interests || []).join(' · ') || '—'} />
              </div>

              {/* commission dues for this account (v4.14) */}
              {!detailUser.isSuperAdmin && <UserDuesPanel userId={detailUser._id} />}

              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => { setEditUser(detailUser); setDetailUser(null); }} className="rounded-xl h-10 font-bold">
                  <Pencil className="h-4 w-4 me-1.5" /> {t('editUser')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => toggleBan(detailUser)}
                  disabled={busy || detailUser.isSuperAdmin}
                  className={`rounded-xl h-10 font-bold ${detailUser.isBanned ? 'text-emerald-600 border-emerald-300' : 'text-amber-600 border-amber-300'}`}
                >
                  <Ban className="h-4 w-4 me-1.5" /> {detailUser.isBanned ? t('enableUser') : t('disableUser')}
                </Button>
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl h-11">{t('close')}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ID-card full-size viewer (sensitive document — never cached) */}
      <AlertDialog open={!!proof} onOpenChange={(o) => !o && setProof(null)}>
        <AlertDialogContent className="rounded-2xl max-w-lg" aria-describedby={undefined}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('idCardUpload')}</AlertDialogTitle>
          </AlertDialogHeader>
          {proof && <img src={proof} alt={t('idCardUpload')} className="w-full rounded-xl border max-h-[60dvh] object-contain" />}
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl h-11">{t('close')}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* edit dialog */}
      <EditUserDialog user={editUser} onClose={() => setEditUser(null)} />

      {/* delete confirm */}
      <AlertDialog open={!!deleteUser} onOpenChange={(o) => !o && setDeleteUser(null)}>
        <AlertDialogContent className="rounded-2xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">{t('deleteUser')}</AlertDialogTitle>
            <AlertDialogDescription>{t('deleteUserConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl h-11">{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} disabled={busy} className="rounded-xl h-11 bg-destructive text-destructive-foreground font-bold">
              <Trash2 className="h-4 w-4 me-1.5" /> {t('deleteUser')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 px-3 py-2">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-semibold text-end break-words">{value}</span>
    </div>
  );
}

function EditUserDialog({ user, onClose }: { user: User | null; onClose: () => void }) {
  const { t } = useLang();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [wilaya, setWilaya] = useState('');
  const [role, setRole] = useState<'owner' | 'seeker'>('seeker');
  const [gender, setGender] = useState<'male' | 'female' | ''>('');
  const [age, setAge] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  if (user && loadedFor !== user._id) {
    setName(user.name); setPhone(user.phone); setWilaya(user.wilaya);
    setRole(user.role); setGender(user.gender || ''); setAge(user.age ? String(user.age) : '');
    setLoadedFor(user._id);
  }
  if (!user && loadedFor) setLoadedFor(null);

  async function save() {
    if (!user) return;
    setBusy(true);
    try {
      await api.patch(`/admin/users/${user._id}`, {
        name: name.trim(),
        phone: phone.trim(),
        wilaya,
        role,
        gender,
        ...(Number(age) > 0 ? { age: Number(age) } : {}),
      });
      toast.success(t('saved'));
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
      onClose();
    } catch {
      toast.error(t('error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent className="rounded-2xl max-w-md max-h-[85dvh] overflow-y-auto" aria-describedby={undefined}>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" /> {t('editUser')}
          </AlertDialogTitle>
        </AlertDialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t('name')}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('phone')}</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="h-11 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>{t('age')}</Label>
              <Input type="number" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} className="h-11 rounded-xl" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('gender')}</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {(['male', 'female'] as const).map((g) => (
                  <button key={g} type="button" onClick={() => setGender(g)} className={`h-10 rounded-xl border-2 text-xs font-bold ${gender === g ? 'border-primary bg-primary/10 text-primary' : 'border-border'}`}>
                    {t(g)}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t('accountType')}</Label>
              <div className="grid grid-cols-2 gap-1.5">
                <button type="button" onClick={() => setRole('owner')} className={`h-10 rounded-xl border-2 text-xs font-bold ${role === 'owner' ? 'border-primary bg-primary/10 text-primary' : 'border-border'}`}>{t('roleOwner')}</button>
                <button type="button" onClick={() => setRole('seeker')} className={`h-10 rounded-xl border-2 text-xs font-bold ${role === 'seeker' ? 'border-primary bg-primary/10 text-primary' : 'border-border'}`}>{t('roleSeeker')}</button>
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t('wilaya')}</Label>
            <WilayaSelect value={wilaya} onChange={setWilaya} className="h-11 rounded-xl" />
          </div>
        </div>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel className="rounded-xl h-11">{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={save} disabled={busy || name.trim().length < 2} className="rounded-xl h-11 font-bold">
            {busy && <Hourglass className="h-4 w-4 animate-spin" />}
            {t('save')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ---------- Offers (full visibility for the super admin) ---------- */
function OffersTab() {
  const { t } = useLang();
  const openOfferDetail = useApp((s) => s.openOfferDetail);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  // open offers the administration has not opened yet — they bounce
  const [clickedIds, setClickedIds] = useState<string[]>(() => getClicked('offers'));
  // v4.8 — per-offer delete with confirmation
  const qcOffers = useQueryClient();
  const [delOffer, setDelOffer] = useState<Offer | null>(null);
  const [busyDel, setBusyDel] = useState(false);

  async function doDeleteOffer() {
    if (!delOffer) return;
    setBusyDel(true);
    try {
      await api.del(`/admin/offers/${delOffer._id}`);
      toast.success(t('done'));
      qcOffers.invalidateQueries({ queryKey: ['admin-offers'] });
      qcOffers.invalidateQueries({ queryKey: ['admin-dashboard'] });
      setDelOffer(null);
    } catch {
      toast.error(t('error'));
    } finally {
      setBusyDel(false);
    }
  }

  function viewCard(id: string) {
    if (!clickedIds.includes(id)) {
      markClicked('offers', id);
      setClickedIds(getClicked('offers'));
    }
  }

  const { data, isLoading } = useQuery({
    queryKey: ['admin-offers', status, page],
    queryFn: () => api.get<Paged<Offer>>('/admin/offers', { status: status || undefined, page, limit: 10 }),
  });

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        {['', 'open', 'assigned', 'awaiting_confirmation', 'done', 'cancelled'].map((s) => (
          <button key={s || 'all'} onClick={() => { setStatus(s); setPage(1); }} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${status === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
            {s ? t(s === 'open' ? 'statusOpen' : s === 'assigned' ? 'statusAssigned' : s === 'awaiting_confirmation' ? 'statusAwaiting' : s === 'done' ? 'statusDone' : 'statusCancelled') : t('allCategories')}
          </button>
        ))}
      </div>
      {isLoading ? (
        <Spinner />
      ) : !data || data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">{t('feedEmpty')}</p>
      ) : (
        data.items.map((o) => {
          const owner = typeof o.owner === 'object' ? o.owner : null;
          return (
            <div
              key={o._id}
              role="button"
              tabIndex={0}
              // opens the SAME final detail sheet users see — owner card, worker card,
              // status, photos, video, address (backend gives the super admin full visibility)
              onClick={() => { viewCard(o._id); openOfferDetail(o._id); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { viewCard(o._id); openOfferDetail(o._id); } }}
              className={`w-full text-start rounded-2xl border bg-card p-3.5 hover:border-primary/40 hover:shadow-md active:scale-[0.99] transition-all card-hover cursor-pointer ${o.status === 'open' && !clickedIds.includes(o._id) ? 'animate-bounce-new border-2 border-primary/50' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-bold text-sm break-words leading-snug text-primary">{o.title}</p>
                <AmountPill amount={o.amountDA} className="shrink-0" />
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap text-xs text-muted-foreground">
                <StatusBadge status={o.status} t={t} />
                {owner?.name && <span>{owner.name}</span>}
                <span className="ms-auto">{timeAgo(o.createdAt, t)}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); setDelOffer(o); }}
                  aria-label={t('delete')}
                  title={t('delete')}
                  className="h-7 w-7 grid place-items-center rounded-lg text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 transition-colors shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })
      )}

      {data && <Pager page={data.page || page} pages={data.pages} onChange={setPage} />}

      {/* v4.8 — delete-offer confirmation */}
      <AlertDialog open={!!delOffer} onOpenChange={(o) => !o && setDelOffer(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete')}</AlertDialogTitle>
            <AlertDialogDescription>{t('deleteOfferConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl" disabled={busyDel}>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={doDeleteOffer}
              disabled={busyDel}
              className="rounded-xl bg-destructive text-white hover:bg-destructive/90"
            >
              {busyDel ? <LoaderCircle className="h-4 w-4 animate-spin" /> : t('confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ---------- Dues (v4.14: commission model — monthly settlements per executor) ---------- */

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

const da = (n: number) => `${(n || 0).toLocaleString('fr-DZ')} DA`;

function DuesTab() {
  const { t, lang } = useLang();
  const qc = useQueryClient();
  const [month, setMonth] = useState('');
  // cards the administration has already clicked — their bounce stops for good
  const [clickedIds, setClickedIds] = useState<string[]>(() => getClicked('dues'));
  const [settleUser, setSettleUser] = useState<AdminDuesRow | null>(null);
  const [detailUser, setDetailUser] = useState<AdminDuesRow | null>(null);
  const [busy, setBusy] = useState(false);

  function viewCard(id: string) {
    if (!clickedIds.includes(id)) {
      markClicked('dues', id);
      setClickedIds(getClicked('dues'));
    }
  }

  const { data, isLoading } = useQuery({
    queryKey: ['admin-dues', month],
    queryFn: () => api.get<AdminDuesSummary>('/dues/admin/summary', { month: month || undefined }),
    refetchInterval: 30_000,
  });

  const items = data?.items || [];
  const totals = data?.totals;

  async function remind(row: AdminDuesRow) {
    setBusy(true);
    try {
      const res = await api.post<{ unpaidDA: number }>('/dues/admin/remind', { userId: row.user._id, ...(month ? { month } : {}) });
      toast.success(t('duesRemindSent') + ` (${res.unpaidDA.toLocaleString('fr-DZ')} DA)`);
    } catch (e) {
      toast.error((e as { code?: string }).code === 'NOTHING_UNPAID' ? t('duesNothingUnpaid') : t('error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground leading-relaxed break-words">{t('duesAdminHint', { rate: String(data?.rate ?? 15) })}</p>

      {/* month picker — '' aggregates everything */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setMonth('')} className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all active:scale-95 ${month === '' ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}>
          {t('duesAllMonths')}
        </button>
        {(data?.months || []).map((m) => (
          <button key={m.month} onClick={() => setMonth(m.month)} className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all active:scale-95 ${month === m.month ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}>
            {monthLabel(m.month, lang)} <span className="opacity-70">· {m.tasks}</span>
          </button>
        ))}
      </div>

      {/* totals strip */}
      {totals && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <Kpi icon={ClipboardList} label={t('duesTasksCount')} value={totals.tasks} />
          <Kpi icon={Wallet} label={t('duesDuesTotal')} value={`${(totals.duesDA || 0).toLocaleString('fr-DZ')}`} />
          <Kpi icon={HandCoins} label={t('duesUnpaid')} value={`${totals.unpaidDA.toLocaleString('fr-DZ')}`} highlight={totals.unpaidDA > 0} />
        </div>
      )}

      {/* v4.15 — dues control rings: collection, unpaid share, executors owing */}
      {totals && (
        <div className="grid grid-cols-3 gap-2.5">
          <RingStat
            pct={(totals.duesDA || 0) > 0 ? Math.min(100, Math.max(0, Math.round(((totals.paidDA || 0) / (totals.duesDA || 1)) * 100))) : 100}
            icon={BadgeCheck}
            label={t('duesRingCollected')}
            value={`${(totals.paidDA || 0).toLocaleString('fr-DZ')}`}
            tone="emerald"
            small="DA"
          />
          <RingStat
            pct={(totals.duesDA || 0) > 0 ? Math.min(100, Math.round(((totals.unpaidDA || 0) / (totals.duesDA || 1)) * 100)) : 0}
            icon={Hourglass}
            label={t('duesRingUnpaid')}
            value={`${(totals.unpaidDA || 0).toLocaleString('fr-DZ')}`}
            tone="amber"
            small="DA"
          />
          <RingStat
            pct={items.length > 0 ? Math.round((items.filter((r) => r.unpaidDA > 0).length / items.length) * 100) : 0}
            icon={UsersRound}
            label={t('duesRingOwing')}
            value={items.filter((r) => r.unpaidDA > 0).length}
            tone="sky"
          />
        </div>
      )}

      {/* v4.15 — payment-proof review: approve → the month is marked paid automatically */}
      <DuesProofs />

      {isLoading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">{t('duesNoUsers')}</p>
      ) : (
        items.map((row) => (
          <div
            key={row.user._id}
            onClick={() => viewCard(row.user._id)}
            className={`rounded-2xl border bg-card p-4 space-y-3 card-hover ${row.unpaidDA > 0 ? 'border-2 border-amber-400' : ''} ${row.unpaidDA > 0 && !clickedIds.includes(row.user._id) ? 'animate-bounce-new' : ''}`}
          >
            {/* user header */}
            <div className="flex items-center gap-3">
              <UserAvatar user={row.user as PublicUser} size="h-12 w-12" textClass="text-base" />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-sm break-words leading-tight">{row.user.name}</p>
                <p className="text-xs text-muted-foreground break-all">{row.user.phone || row.user.email}</p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <Badge variant="outline" className="text-[10px] shrink-0">
                  {row.user.role === 'owner' ? t('roleOwner') : t('roleSeeker')}
                </Badge>
                {row.unpaidDA > 0 && (
                  <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-700 dark:text-amber-300 shrink-0" dir="ltr">
                    {row.unpaidDA.toLocaleString('fr-DZ')} DA
                  </Badge>
                )}
              </div>
            </div>

            {/* numbers */}
            <div className="rounded-xl bg-muted/50 p-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
              <DetailChip label={t('duesTasksCount')} value={String(row.tasksCount)} />
              <DetailChip label={t('duesEarned')} value={da(row.earnedDA)} />
              <DetailChip label={t('duesDuesShort', { rate: String(data?.rate ?? 15) })} value={da(row.duesDA)} />
              <DetailChip label={t('duesPaid')} value={da(row.paidDA)} />
              <div className="col-span-2">
                <DetailChip label={t('duesUnpaid')} value={da(row.unpaidDA)} />
              </div>
            </div>

            {/* actions */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => setSettleUser(row)}
                disabled={busy}
                variant={row.unpaidDA > 0 ? 'default' : 'outline'}
                className="rounded-xl h-10 font-bold"
              >
                <Check className="h-4 w-4 me-1" /> {t('duesSettle')}
              </Button>
              <Button
                onClick={() => remind(row)}
                disabled={busy || row.unpaidDA <= 0}
                variant="outline"
                className="rounded-xl h-10 font-bold border-primary/40 text-primary"
              >
                <Send className="h-4 w-4 me-1" /> {t('duesRemind')}
              </Button>
            </div>
            <button onClick={() => setDetailUser(row)} className="text-xs font-bold text-primary underline underline-offset-2">
              {t('duesViewMonths')}
            </button>
          </div>
        ))
      )}

      {/* settle dialog */}
      {settleUser && (
        <SettleDialog
          userId={settleUser.user._id}
          userName={settleUser.user.name}
          defaultMonth={month}
          onClose={() => setSettleUser(null)}
          onDone={() => {
            setSettleUser(null);
            qc.invalidateQueries({ queryKey: ['admin-dues'] });
            qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
            qc.invalidateQueries({ queryKey: ['admin-stats'] });
          }}
        />
      )}

      {/* per-month breakdown dialog */}
      {detailUser && (
        <UserMonthsDialog
          userId={detailUser.user._id}
          onClose={() => setDetailUser(null)}
          onChanged={() => {
            qc.invalidateQueries({ queryKey: ['admin-dues'] });
            qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
            qc.invalidateQueries({ queryKey: ['admin-stats'] });
          }}
        />
      )}
    </div>
  );
}

function DetailChip({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold text-muted-foreground leading-tight">{label}</p>
      <p className={`text-sm font-semibold break-words leading-snug ${strong ? 'text-amber-700 dark:text-amber-300 font-extrabold' : ''}`}>{value}</p>
    </div>
  );
}

/* ---------- v4.15 — payment-proof review (approve = settle automatically) ---------- */
function DuesProofs() {
  const { t, lang } = useLang();
  const qc = useQueryClient();
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [viewImg, setViewImg] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [busy, setBusy] = useState(false);
  // query-token for <img> sources (the receipt photo)
  const token = typeof window !== 'undefined' ? localStorage.getItem('slekni.token') || '' : '';

  const { data, isLoading } = useQuery({
    queryKey: ['admin-dues-proofs', status],
    queryFn: () => api.get<{ items: DuesProof[] }>('/dues/admin/proofs', { status: status === 'all' ? undefined : status }),
    refetchInterval: 15_000,
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['admin-dues-proofs'] });
    qc.invalidateQueries({ queryKey: ['admin-dues'] });
    qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
  }

  async function approve(id: string) {
    setBusy(true);
    try {
      await api.post(`/dues/admin/proofs/${id}/approve`);
      toast.success(t('duesProofApprovedToast'));
      invalidate();
    } catch {
      toast.error(t('error'));
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    if (!rejectId) return;
    setBusy(true);
    try {
      await api.post(`/dues/admin/proofs/${rejectId}/reject`, { reason: rejectReason.trim() });
      toast.success(t('duesProofRejectedToast'));
      setRejectId(null);
      setRejectReason('');
      invalidate();
    } catch {
      toast.error(t('error'));
    } finally {
      setBusy(false);
    }
  }

  const items = data?.items || [];

  return (
    <div className="rounded-2xl border bg-card p-3.5 space-y-2.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="font-bold text-sm flex items-center gap-1.5">
          <ImagePlus className="h-4 w-4 text-primary" /> {t('duesProofsAdminTitle')}
        </p>
        <div className="flex gap-1.5 flex-wrap">
          {(['pending', 'approved', 'rejected', 'all'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-all active:scale-95 ${status === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}
            >
              {t(s === 'pending' ? 'duesProofTabPending' : s === 'approved' ? 'duesProofTabApproved' : s === 'rejected' ? 'duesProofTabRejected' : 'allCategories')}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">{t('duesProofsEmpty')}</p>
      ) : (
        items.map((p) => {
          const u = p.user;
          return (
            <div key={p._id} className={`rounded-xl border p-3 space-y-2 ${p.status === 'pending' ? 'border-amber-300 dark:border-amber-700' : ''}`}>
              <div className="flex items-center gap-2.5">
                {u && <UserAvatar user={u as PublicUser} size="h-9 w-9" textClass="text-xs" />}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold break-words leading-tight">{u?.name || '—'}</p>
                  <p className="text-[11px] text-muted-foreground break-all">{u?.phone || u?.email || ''}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge variant="outline" className="text-[10px] shrink-0">{monthLabel(p.month, lang)}</Badge>
                  <Badge
                    variant="outline"
                    className={`text-[10px] shrink-0 ${p.status === 'pending' ? 'border-amber-400 text-amber-700 dark:text-amber-300' : p.status === 'approved' ? 'border-emerald-300 text-emerald-600' : 'border-rose-300 text-rose-600'}`}
                  >
                    {t(p.status === 'pending' ? 'duesProofTabPending' : p.status === 'approved' ? 'duesProofTabApproved' : 'duesProofTabRejected')}
                  </Badge>
                </div>
              </div>
              {p.note && <p className="text-xs text-muted-foreground break-words">📝 {p.note}</p>}
              {p.status === 'rejected' && p.reviewNote && (
                <p className="text-[11px] text-rose-600 dark:text-rose-300 break-words">{p.reviewNote}</p>
              )}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setViewImg(mediaUrl(`/dues/admin/proofs/${p._id}/image`))}
                  className="h-8 rounded-lg text-xs font-bold flex-1"
                >
                  <ImagePlus className="h-3.5 w-3.5 me-1" /> {t('viewFull')}
                </Button>
                {p.status === 'pending' && (
                  <>
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => approve(p._id)}
                      className="h-8 rounded-lg text-xs font-bold flex-1 bg-emerald-600 text-white"
                    >
                      <Check className="h-3.5 w-3.5 me-1" /> {t('duesProofApprove')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => { setRejectId(p._id); setRejectReason(''); }}
                      className="h-8 rounded-lg text-xs font-bold flex-1 text-destructive border-destructive/40"
                    >
                      <X className="h-3.5 w-3.5 me-1" /> {t('duesProofReject')}
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })
      )}

      {/* full-size receipt viewer — sensitive: never cached (server sets no-store) */}
      <AlertDialog open={!!viewImg} onOpenChange={(o) => !o && setViewImg(null)}>
        <AlertDialogContent className="rounded-2xl max-w-lg" aria-describedby={undefined}>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /> {t('duesProofViewTitle')}</AlertDialogTitle>
          </AlertDialogHeader>
          {viewImg && <img src={viewImg} alt={t('duesProofViewTitle')} className="w-full rounded-xl border max-h-[60dvh] object-contain bg-muted" />}
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl h-11">{t('close')}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* rejection reason */}
      <AlertDialog open={!!rejectId} onOpenChange={(o) => !o && setRejectId(null)}>
        <AlertDialogContent className="rounded-2xl max-w-sm" aria-describedby={undefined}>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">{t('duesProofReject')}</AlertDialogTitle>
            <AlertDialogDescription>{t('duesProofRejectHint')}</AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder={t('duesProofRejectPlaceholder')} className="min-h-20 rounded-xl" maxLength={300} />
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl h-11">{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={reject} disabled={busy} className="rounded-xl h-11 bg-destructive text-destructive-foreground font-bold">
              {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
              {t('duesProofReject')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Mark ONE month of ONE executor as paid — amount prefilled with the computed dues. */
function SettleDialog({
  userId,
  userName,
  defaultMonth,
  onClose,
  onDone,
}: {
  userId: string;
  userName: string;
  defaultMonth: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t, lang } = useLang();
  const [busy, setBusy] = useState(false);
  const { data } = useQuery({
    queryKey: ['admin-dues-user', userId],
    queryFn: () => api.get<{ rate: number; months: DuesMonth[]; totals: MyDues['totals'] }>(`/dues/admin/user/${userId}`),
  });
  const unpaidMonths = (data?.months || []).filter((m) => m.unpaidDA > 0);
  const [selMonth, setSelMonth] = useState<string>('');
  const active = unpaidMonths.find((m) => m.month === selMonth) || unpaidMonths[0];
  const [amount, setAmount] = useState<string>('');
  const [note, setNote] = useState('');
  const amountValue = amount === '' ? (active ? String(active.unpaidDA) : amount) : amount;

  async function settle() {
    if (!active) return;
    setBusy(true);
    try {
      await api.post('/dues/admin/settle', {
        userId,
        month: active.month,
        amountDA: Math.max(0, Number(amountValue) || 0),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      toast.success(t('duesSettledToast'));
      onDone();
    } catch {
      toast.error(t('error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent className="rounded-2xl max-w-sm max-h-[85dvh] overflow-y-auto" aria-describedby={undefined}>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2"><HandCoins className="h-5 w-5 text-primary" /> {t('duesSettle')}</AlertDialogTitle>
          <AlertDialogDescription className="break-words">{t('duesSettleHint')}: {userName}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-3">
          {unpaidMonths.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('duesNothingUnpaid')}</p>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label>{t('duesMonth')} *</Label>
                <div className="flex gap-2 flex-wrap">
                  {unpaidMonths.map((m) => (
                    <button
                      key={m.month}
                      type="button"
                      onClick={() => { setSelMonth(m.month); setAmount(''); }}
                      className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all active:scale-95 ${(active?.month) === m.month ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}
                    >
                      {monthLabel(m.month, lang)} · <span dir="ltr">{m.unpaidDA.toLocaleString('fr-DZ')}</span>
                    </button>
                  ))}
                </div>
                {!defaultMonth && unpaidMonths.length === 0 && null}
              </div>
              <div className="space-y-1.5">
                <Label>{t('duesAmount')} (DA) *</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={amountValue}
                  onChange={(e) => setAmount(e.target.value)}
                  className="h-11 rounded-xl"
                  dir="ltr"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('duesNote')}</Label>
                <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} className="h-11 rounded-xl" placeholder={t('duesNotePlaceholder')} />
              </div>
            </>
          )}
        </div>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel className="rounded-xl h-11">{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={settle}
            disabled={busy || !active}
            className="rounded-xl h-11 font-bold bg-emerald-600 text-white"
          >
            {busy ? <Hourglass className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 me-1" />}
            {t('duesMarkPaid')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Per-month breakdown of one executor — reopen mistakes, settle, remind.
 *  v4.16 — every task of the month is listed with its dues state and a one-tap
 *  toggle (معلقة ↔ مسددة) giving the administration full per-task control. */
function UserMonthsDialog({
  userId,
  onClose,
  onChanged,
}: {
  userId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t, lang } = useLang();
  const qc = useQueryClient();
  const [busy, setBusy] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['admin-dues-user', userId],
    queryFn: () => api.get<{ rate: number; user: { name: string }; months: (DuesMonth & { tasks?: DuesTask[] })[]; totals: MyDues['totals'] }>(`/dues/admin/user/${userId}`),
  });

  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    try {
      await fn();
      qc.invalidateQueries({ queryKey: ['admin-dues-user', userId] });
      onChanged();
    } catch {
      toast.error(t('error'));
    } finally {
      setBusy('');
    }
  }

  /** Flip ONE task's dues state between pending and paid (admin control). */
  function toggleTask(taskId: string, next: 'pending' | 'paid') {
    run(`task-${taskId}`, () => api.post(`/dues/admin/task/${taskId}/state`, { state: next }));
  }

  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent className="rounded-2xl max-w-md max-h-[85dvh] overflow-y-auto" aria-describedby={undefined}>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-primary" /> {t('duesViewMonths')}</AlertDialogTitle>
          <AlertDialogDescription className="break-words">{data?.user?.name || ''}</AlertDialogDescription>
        </AlertDialogHeader>
        {isLoading ? (
          <Spinner />
        ) : (
          <div className="space-y-2.5">
            {(data?.months || []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">{t('duesNoTasks')}</p>
            ) : (
              data?.months.map((m) => {
                // v4.16 — precise badge: fully paid / partially paid / pending
                const full = m.commissionDA > 0 && m.unpaidDA <= 0;
                const partial = m.unpaidDA > 0 && (m.paidDA || 0) > 0;
                return (
                <div key={m.month} className={`rounded-xl border p-3 space-y-2 ${m.unpaidDA > 0 ? 'border-amber-300 dark:border-amber-700' : ''}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-sm">{monthLabel(m.month, lang)}</p>
                    {full ? (
                      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-0 text-[10px] shrink-0">{t('duesPaidBadge')}</Badge>
                    ) : partial ? (
                      <Badge variant="outline" className="text-[10px] border-sky-300 text-sky-700 dark:text-sky-300 shrink-0">{t('duesPartiallyPaidBadge')}</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-700 dark:text-amber-300 shrink-0">{t('duesUnpaidBadge')}</Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 text-xs">
                    <DetailChip label={t('duesTasksCount')} value={String(m.tasksCount)} />
                    <DetailChip label={t('duesEarned')} value={da(m.earnedDA)} />
                    <DetailChip label={t('duesCommissionShort', { rate: '' })} value={da(m.commissionDA)} />
                    <DetailChip label={t('duesUnpaid')} value={da(m.unpaidDA)} strong={m.unpaidDA > 0} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      disabled={Boolean(busy) || m.unpaidDA <= 0}
                      onClick={() => run('settle', () => api.post('/dues/admin/settle', { userId, month: m.month }))}
                      className="h-9 rounded-xl text-xs font-bold bg-emerald-600 text-white"
                    >
                      {busy === 'settle' ? <Hourglass className="h-3.5 w-3.5 animate-spin me-1" /> : <Check className="h-3.5 w-3.5 me-1" />} {t('duesMarkPaid')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={Boolean(busy) || (m.paidDA || 0) <= 0}
                      onClick={() => run('unsettle', () => api.post('/dues/admin/unsettle', { userId, month: m.month }))}
                      className="h-9 rounded-xl text-xs font-bold text-destructive border-destructive/40"
                    >
                      {busy === 'unsettle' ? <Hourglass className="h-3.5 w-3.5 animate-spin me-1" /> : <X className="h-3.5 w-3.5 me-1" />} {t('duesUnsettle')}
                    </Button>
                  </div>

                  {/* v4.16 — per-task dues state with a one-tap flip */}
                  {(m.tasks || []).length > 0 && (
                    <div className="rounded-lg bg-muted/50 p-2 space-y-1.5">
                      <p className="text-[10px] font-bold text-muted-foreground">{t('duesTaskSection')}</p>
                      {m.tasks!.map((task) => {
                        const taskBusy = busy === `task-${task._id}`;
                        return (
                          <div key={task._id} className="rounded-lg border bg-card p-2 flex items-center gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold break-words leading-tight">{task.title}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5" dir="ltr">
                                {da(task.amountDA)} · {t('duesCommissionShort', { rate: '' })} {da(task.commissionDA)}
                              </p>
                            </div>
                            <button
                              onClick={() => toggleTask(task._id, task.duesState === 'paid' ? 'pending' : 'paid')}
                              disabled={Boolean(busy)}
                              aria-label={task.duesState === 'paid' ? t('duesUnsettle') : t('duesMarkPaid')}
                              title={task.duesState === 'paid' ? t('duesUnsettle') : t('duesMarkPaid')}
                              className={`h-8 px-2.5 rounded-lg text-[10px] font-bold shrink-0 flex items-center gap-1 transition-all active:scale-95 disabled:opacity-50 ${
                                task.duesState === 'paid'
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 hover:bg-destructive/10 hover:text-destructive'
                                  : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 hover:bg-emerald-600 hover:text-white'
                              }`}
                            >
                              {taskBusy ? (
                                <Hourglass className="h-3 w-3 animate-spin" />
                              ) : task.duesState === 'paid' ? (
                                <><Check className="h-3 w-3" /> {t('duesPaidBadge')}</>
                              ) : (
                                <><Hourglass className="h-3 w-3" /> {t('duesPendingBadge')}</>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                );
              })
            )}
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-xl h-11">{t('close')}</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ---------- Settings (commission rate + payment coordinates + contact page) ---------- */
function SettingsTab() {
  const { t } = useLang();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [rate, setRate] = useState<number | null>(null);
  const [payment, setPayment] = useState<{ ccp: string; ccpKey: string; rip: string } | null>(null);
  const [contact, setContact] = useState<{ phone: string; email: string; instagram: string; address: string } | null>(null);

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<Settings>('/settings'),
    staleTime: 30_000,
  });

  const curRate = rate ?? settings?.commissionPercent ?? 15;
  const curPayment = payment ?? settings?.duesPayment ?? { ccp: '', ccpKey: '', rip: '' };
  const curContact = contact ?? settings?.contact ?? { phone: '', email: '', instagram: '', address: '' };

  async function save() {
    setSaving(true);
    try {
      await api.put('/admin/settings', {
        commissionPercent: Math.min(50, Math.max(0, Math.round(curRate))),
        duesPayment: {
          ccp: curPayment.ccp.trim(),
          ccpKey: curPayment.ccpKey.trim(),
          rip: curPayment.rip.trim(),
        },
        contact: curContact,
      });
      toast.success(t('settingsSaved'));
      qc.invalidateQueries({ queryKey: ['settings'] });
      qc.invalidateQueries({ queryKey: ['admin-dues'] });
    } catch {
      toast.error(t('error'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 max-w-xl">
      {/* v4.14 — commission model: the platform earns a % of every completed task */}
      <div className="rounded-2xl border-2 border-primary/25 bg-primary/5 p-4 space-y-3">
        <h3 className="font-bold text-sm flex items-center gap-1.5"><HandCoins className="h-4 w-4 text-primary" /> {t('commissionTitle')}</h3>
        <NumField label={t('commissionPercent')} value={curRate} onChange={(v) => setRate(Math.min(50, Math.max(0, v)))} />
        <p className="text-[11px] text-muted-foreground leading-relaxed break-words">{t('commissionPercentHint')}</p>
      </div>

      {/* v4.15 — the official dues payment coordinates shown on the executors' dues page */}
      <div className="rounded-2xl border-2 border-emerald-500/25 bg-emerald-50 dark:bg-emerald-950/30 p-4 space-y-3">
        <h3 className="font-bold text-sm flex items-center gap-1.5"><Wallet className="h-4 w-4 text-emerald-600" /> {t('duesPaymentSettingsTitle')}</h3>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs">{t('duesCcp')}</Label>
            <Input value={curPayment.ccp} onChange={(e) => setPayment({ ...curPayment, ccp: e.target.value })} className="h-10 rounded-xl" dir="ltr" maxLength={30} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('duesCcpKey')}</Label>
            <Input value={curPayment.ccpKey} onChange={(e) => setPayment({ ...curPayment, ccpKey: e.target.value })} className="h-10 rounded-xl" dir="ltr" maxLength={4} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('duesRip')}</Label>
          <Input value={curPayment.rip} onChange={(e) => setPayment({ ...curPayment, rip: e.target.value })} className="h-10 rounded-xl" dir="ltr" maxLength={40} />
        </div>
        <p className="text-[11px] text-muted-foreground leading-snug break-words">{t('duesPaymentSettingsHint')}</p>
      </div>

      {/* v4.6 — contact page content, edited here and shown to all users
          (v4.14: also the contact the executors use to pay their dues) */}
      <div className="rounded-2xl border bg-card p-4 space-y-3">
        <h3 className="font-bold text-sm flex items-center gap-1.5"><Phone className="h-4 w-4 text-primary" /> {t('contactInfo')}</h3>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs">{t('contactPhone')}</Label>
            <Input value={curContact.phone} onChange={(e) => setContact({ ...curContact, phone: e.target.value })} className="h-10 rounded-xl" dir="ltr" placeholder="0555 00 00 00" maxLength={40} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('contactEmail')}</Label>
            <Input value={curContact.email} onChange={(e) => setContact({ ...curContact, email: e.target.value })} className="h-10 rounded-xl" dir="ltr" type="email" maxLength={120} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('contactInstagram')}</Label>
            <Input value={curContact.instagram} onChange={(e) => setContact({ ...curContact, instagram: e.target.value })} className="h-10 rounded-xl" dir="ltr" placeholder="instagram.com/…" maxLength={200} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('contactAddress')}</Label>
            <Input value={curContact.address} onChange={(e) => setContact({ ...curContact, address: e.target.value })} className="h-10 rounded-xl" maxLength={200} />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground leading-snug">{t('contactIntro')}</p>
      </div>

      <Button onClick={save} disabled={saving} className="w-full h-12 rounded-xl font-bold shadow-lg shadow-primary/25">
        {saving && <Hourglass className="h-5 w-5 animate-spin" />}
        {t('saveSettings')}
      </Button>
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-bold text-muted-foreground block break-words">{label}</label>
      <Input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className="h-10 rounded-xl text-sm"
      />
    </div>
  );
}

/* ---------- Broadcast + targeted notify ---------- */
function BroadcastTab() {
  const { t } = useLang();
  const qc = useQueryClient();
  const [mode, setMode] = useState<'all' | 'user'>('all');
  const [userId, setUserId] = useState('');
  // per-language content — every user receives the announcement in their chosen language
  const [tab, setTab] = useState<'ar' | 'fr' | 'en'>('ar');
  const [fields, setFields] = useState<Record<'ar' | 'fr' | 'en', { title: string; body: string }>>({
    ar: { title: '', body: '' },
    fr: { title: '', body: '' },
    en: { title: '', body: '' },
  });
  const [busy, setBusy] = useState(false);
  const allFilled = (['ar', 'fr', 'en'] as const).every((l) => fields[l].title.trim() && fields[l].body.trim());

  const { data: users } = useQuery({
    queryKey: ['admin-users-all'],
    queryFn: () => api.get<Paged<User>>('/admin/users', { limit: 50 }),
  });

  async function send() {
    setBusy(true);
    try {
      const res = await api.post<{ notified: number }>('/admin/notify', {
        ...(mode === 'user' && userId ? { userId } : {}),
        titleAr: fields.ar.title.trim(),
        titleFr: fields.fr.title.trim(),
        titleEn: fields.en.title.trim(),
        bodyAr: fields.ar.body.trim(),
        bodyFr: fields.fr.body.trim(),
        bodyEn: fields.en.body.trim(),
      });
      toast.success(t('notifSent') + ` (${res.notified})`);
      setFields({ ar: { title: '', body: '' }, fr: { title: '', body: '' }, en: { title: '', body: '' } });
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
    } catch {
      toast.error(t('error'));
    } finally {
      setBusy(false);
    }
  }

  const cur = fields[tab];
  const setCur = (patch: Partial<{ title: string; body: string }>) =>
    setFields((f) => ({ ...f, [tab]: { ...f[tab], ...patch } }));

  return (
    <div className="space-y-4 max-w-xl">
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => setMode('all')} className={`h-11 rounded-xl border-2 font-bold text-sm transition-all ${mode === 'all' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground'}`}>
          {t('sendToAll')}
        </button>
        <button onClick={() => setMode('user')} className={`h-11 rounded-xl border-2 font-bold text-sm transition-all ${mode === 'user' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground'}`}>
          {t('sendToUser')}
        </button>
      </div>

      {mode === 'user' && (
        <div className="space-y-1.5">
          <Label>{t('selectUser')} *</Label>
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="h-12 w-full rounded-xl border bg-card px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="">— {t('selectUser')} —</option>
            {(users?.items || []).map((u) => (
              <option key={u._id} value={u._id}>
                {u.name} · {u.email} · {u.isSuperAdmin ? t('roleAdmin') : u.role === 'owner' ? t('roleOwner') : t('roleSeeker')}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* language chips — the announcement is written once per language */}
      <div className="flex gap-2">
        {([['ar', 'العربية'], ['fr', 'Français'], ['en', 'English']] as const).map(([l, label]) => (
          <button key={l} onClick={() => setTab(l)} className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all active:scale-95 ${tab === l ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}>
            {label}{fields[l].title.trim() && fields[l].body.trim() ? ' ✓' : ''}
          </button>
        ))}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="b-title">{t('broadcastTitle')} *</Label>
        <Input id="b-title" value={cur.title} onChange={(e) => setCur({ title: e.target.value })} className="h-11 rounded-xl" maxLength={120} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="b-body">{t('broadcastBody')} *</Label>
        <Textarea id="b-body" value={cur.body} onChange={(e) => setCur({ body: e.target.value })} className="min-h-24 rounded-xl" maxLength={1000} />
      </div>
      <Button onClick={send} disabled={busy || !allFilled || (mode === 'user' && !userId)} className="w-full h-12 rounded-xl font-bold shadow-lg shadow-primary/25">
        {busy ? <Hourglass className="h-5 w-5 animate-spin" /> : <Send className="h-4 w-4 me-1.5" />}
        {mode === 'user' ? t('sendToUser') : t('sendToAll')}
      </Button>
      {!allFilled && (
        <p className="text-[11px] text-muted-foreground">{t('broadcastAllLangsHint')}</p>
      )}
    </div>
  );
}

/* ---------- Per-user dues summary (v4.14, in the user-details modal) ---------- */
function UserDuesPanel({ userId }: { userId: string }) {
  const { t } = useLang();
  const setAdminTab = useApp((s) => s.setAdminTab);
  const { data } = useQuery({
    queryKey: ['admin-dues-user', userId],
    queryFn: () => api.get<{ rate: number; months: DuesMonth[]; totals: MyDues['totals'] }>(`/dues/admin/user/${userId}`),
  });

  const totals = data?.totals;
  const unpaidMonths = (data?.months || []).filter((m) => m.unpaidDA > 0);

  return (
    <div className="rounded-xl border-2 border-primary/25 bg-primary/5 p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-extrabold text-primary flex items-center gap-1.5"><HandCoins className="h-3.5 w-3.5" /> {t('duesTitle')}</p>
        {/* v4.15 — honest wording: no completed tasks ≠ "everything paid" */}
        <Badge variant="outline" className={`text-[10px] ${(totals?.unpaidDA || 0) > 0 ? 'border-amber-300 text-amber-600' : (totals?.tasks || 0) === 0 ? 'border-border text-muted-foreground' : 'border-emerald-300 text-emerald-600'}`}>
          {(totals?.unpaidDA || 0) > 0 ? t('duesUnpaidBadge') : (totals?.tasks || 0) === 0 ? t('duesNothingYetTitle') : t('duesAllPaidTitle')}
        </Badge>
      </div>

      <div className="text-xs space-y-0.5">
        <p><b>{t('duesTasksCount')}:</b> {totals?.tasks ?? 0}</p>
        <p><b>{t('duesEarned')}:</b> <span dir="ltr">{da(totals?.earnedDA || 0)}</span></p>
        <p><b>{t('duesUnpaid')}:</b> <span dir="ltr" className="font-extrabold text-amber-700 dark:text-amber-300">{da(totals?.unpaidDA || 0)}</span></p>
        {unpaidMonths.length > 0 && (
          <p className="text-[11px] text-muted-foreground break-words">
            {unpaidMonths.map((m) => monthLabel(m.month, 'ar')).join(' · ')}
          </p>
        )}
      </div>

      <Button
        size="sm"
        variant="outline"
        onClick={() => setAdminTab('dues')}
        className="w-full h-9 rounded-xl text-xs font-bold border-primary/40 text-primary"
      >
        <HandCoins className="h-3.5 w-3.5 me-1" /> {t('duesAdminTab')}
      </Button>
    </div>
  );
}

/* ---------- Smart statistics + charts (v4, dependency-free SVG) ---------- */
function AnalyticsSection() {
  const { t, lang } = useLang();
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<Settings>('/settings'),
    staleTime: 60_000,
  });
  const { data, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get<AdminStats>('/admin/stats'),
    // v4.15 — the daily cards (accounts/tasks/income) now move on their own
    refetchInterval: 30_000,
  });

  if (isLoading) return <Spinner />;
  if (!data) return null;

  const dayLabel = (d: string) => d.slice(5).replace('-', '/');
  const catLabel = (key: string) => settings?.categories.find((c) => c.key === key)?.label[lang] || key;

  return (
    <div className="space-y-4">
      <h3 className="font-extrabold text-sm flex items-center gap-1.5 pt-2">
        <BarChart3 className="h-4 w-4 text-primary" /> {t('smartStats')}
      </h3>

      {/* smart KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Kpi icon={Coins} label={t('totalRevenue')} value={`${data.revenueTotalDA.toLocaleString('fr-DZ')} ${t('da')}`} />
        <Kpi icon={TrendingUp} label={t('avgOfferAmount')} value={`${data.smart.avgOfferDA.toLocaleString('fr-DZ')} ${t('da')}`} />
        <Kpi icon={BadgeCheck} label={t('completionRate')} value={`${data.smart.completionRate}%`} />
        <Kpi icon={X} label={t('cancelRate')} value={`${data.smart.cancelRate}%`} />
        <Kpi icon={Wrench} label={t('totalOffersCount')} value={data.smart.totalOffers} />
        <Kpi icon={Users} label={t('totalUsers')} value={data.smart.usersTotal} />
      </div>

      {/* system-control KPIs (v4.5) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Kpi icon={Handshake} label={t('tasksDoneKpi')} value={data.smart.tasksDone} />
        {/* v4.14 — commission dues replace the subscription KPIs */}
        <Kpi icon={HandCoins} label={t('duesUnpaidKpi')} value={`${(data.dues.unpaidDA || 0).toLocaleString('fr-DZ')}`} highlight={(data.dues.unpaidDA || 0) > 0} />
        <Kpi icon={Hourglass} label={t('duesUnpaidUsersKpi')} value={data.dues.unpaidUsers || 0} highlight={(data.dues.unpaidUsers || 0) > 0} />
        <Kpi icon={BadgeCheck} label={t('verifiedKpi')} value={data.smart.idStatus.verified || 0} />
        <Kpi icon={Ban} label={t('bannedKpi')} value={data.smart.usersBanned} />
        <Kpi icon={Gavel} label={t('complaintsOpenCount')} value={data.smart.complaints.open || 0} />
        {/* roles — each count clearly labelled (v4.6, replaces the unclear "2 / 1") */}
        <div className="rounded-2xl border bg-card p-4 space-y-1.5">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground"><UsersRound className="h-3.5 w-3.5" /> {t('rolesSplit')}</p>
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="flex items-center gap-1.5"><Handshake className="h-3.5 w-3.5 text-primary" /> {t('owners')}</span>
            <span className="text-base">{data.smart.usersByRole.owner || 0}</span>
          </div>
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="flex items-center gap-1.5"><Wrench className="h-3.5 w-3.5 text-sky-500" /> {t('seekers')}</span>
            <span className="text-base">{data.smart.usersByRole.seeker || 0}</span>
          </div>
        </div>
      </div>

      {/* daily activity chart */}
      <ChartCard title={t('dailyNewUsers')} icon={Users}>
        <Bars data={data.usersSeries.map((d) => ({ label: dayLabel(d.date), value: d.count }))} color="#0ea5e9" />
      </ChartCard>
      <ChartCard title={t('dailyNewOffers')} icon={Wrench}>
        <Bars data={data.offersSeries.map((d) => ({ label: dayLabel(d.date), value: d.count }))} color="#f59e0b" />
      </ChartCard>
      <ChartCard title={t('dailyRevenue')} icon={HandCoins}>
        <Bars data={data.revenueSeries.map((d) => ({ label: dayLabel(d.date), value: d.amount }))} color="#10b981" money />
      </ChartCard>

      <div className="grid sm:grid-cols-2 gap-4">
        <ChartCard title={t('offersByCategory')} icon={LayoutDashboard}>
          <HBars items={data.byCategory.map((c) => ({ label: catLabel(c.key), value: c.count }))} color="#f97316" />
        </ChartCard>
        <ChartCard title={t('offersByWilaya')} icon={MapPin}>
          <HBars items={data.byWilaya.map((w) => ({ label: wilayaLabel(w.wilaya, lang), value: w.count }))} color="#0ea5e9" />
        </ChartCard>
      </div>

      {/* system-control charts (v4.5) */}
      <div className="grid sm:grid-cols-2 gap-4">
        <ChartCard title={t('rolesSplit')} icon={UsersRound}>
          <Donut
            slices={[
              { label: t('roleOwner'), value: data.smart.usersByRole.owner || 0, color: '#8b5cf6' },
              { label: t('roleSeeker'), value: data.smart.usersByRole.seeker || 0, color: '#0ea5e9' },
            ].filter((s) => s.value > 0)}
          />
        </ChartCard>
        <ChartCard title={t('idSplitLabel')} icon={IdCard}>
          <Donut
            slices={[
              { label: t('verifiedKpi'), value: data.smart.idStatus.verified || 0, color: '#10b981' },
              { label: t('idPendingShort'), value: data.smart.idStatus.pending || 0, color: '#f59e0b' },
              { label: t('idRejectedShort'), value: data.smart.idStatus.rejected || 0, color: '#f43f5e' },
              { label: t('idNoneShort'), value: data.smart.idStatus.none || 0, color: '#94a3b8' },
            ].filter((s) => s.value > 0)}
          />
        </ChartCard>
      </div>
      <ChartCard title={t('offersStatusSplit')} icon={ClipboardList}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Donut
            slices={[
              { label: t('statusOpen'), value: data.smart.offersByStatus.open || 0, color: '#10b981' },
              { label: t('statusAssigned'), value: data.smart.offersByStatus.assigned || 0, color: '#f59e0b' },
              { label: t('statusAwaiting'), value: data.smart.offersByStatus.awaiting_confirmation || 0, color: '#38bdf8' },
              { label: t('statusDone'), value: data.smart.offersByStatus.done || 0, color: '#14b8a6' },
              { label: t('statusCancelled'), value: data.smart.offersByStatus.cancelled || 0, color: '#f43f5e' },
            ].filter((s) => s.value > 0)}
          />
          <HBars items={[
            { label: t('statusOpen'), value: data.smart.offersByStatus.open || 0 },
            { label: t('statusAssigned'), value: data.smart.offersByStatus.assigned || 0 },
            { label: t('statusAwaiting'), value: data.smart.offersByStatus.awaiting_confirmation || 0 },
            { label: t('statusDone'), value: data.smart.offersByStatus.done || 0 },
            { label: t('statusCancelled'), value: data.smart.offersByStatus.cancelled || 0 },
          ].filter((i) => i.value > 0)} color="#14b8a6" />
        </div>
      </ChartCard>
    </div>
  );
}

function ChartCard({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 mb-3">
        <Icon className="h-3.5 w-3.5 text-primary" /> {title}
      </p>
      {children}
    </div>
  );
}

/** Simple vertical bar chart (SVG, no dependencies). */
function Bars({ data, color, money = false }: { data: { label: string; value: number }[]; color: string; money?: boolean }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div>
      <div className="flex items-end gap-[3px] h-28" dir="ltr">
        {data.map((d, i) => (
          <div key={i} className="flex-1 min-w-0 flex flex-col items-center justify-end gap-1 group relative">
            <span className="text-[9px] font-bold text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap" dir="ltr">
              {money ? `${d.value.toLocaleString('fr-DZ')}` : d.value}
            </span>
            <div
              className="w-full rounded-t-md transition-all group-hover:opacity-80"
              style={{ height: `${Math.max(2, (d.value / max) * 100)}%`, backgroundColor: color, opacity: d.value === 0 ? 0.15 : 1 }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-[3px] mt-1" dir="ltr">
        {data.map((d, i) => (
          <span key={i} className="flex-1 min-w-0 text-center text-[8px] text-muted-foreground break-words">{d.label}</span>
        ))}
      </div>
    </div>
  );
}

/** Horizontal labeled bars (top categories / wilayas / packages). */
function HBars({ items, color }: { items: { label: string; value: number; sub?: string }[]; color: string }) {
  if (!items.length) return <p className="text-xs text-muted-foreground py-4 text-center">—</p>;
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-2.5">
      {items.map((it, i) => (
        <div key={i}>
          <div className="flex items-center justify-between gap-2 text-[11px] font-semibold mb-1">
            <span className="break-words min-w-0">{it.label}</span>
            <span className="shrink-0 text-muted-foreground">{it.sub ? `${it.value} · ${it.sub}` : it.value}</span>
          </div>
          <div className="h-2.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${(it.value / max) * 100}%`, backgroundColor: color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Donut chart with legend — the share of each slice
 *  appears in an elegant floating badge on hover (desktop) or tap (mobile). */
function Donut({ slices }: { slices: { label: string; value: number; color: string }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const total = slices.reduce((a, s) => a + s.value, 0);
  if (!total) return <p className="text-xs text-muted-foreground py-4 text-center">—</p>;
  const R = 15.915; // circumference = 100
  // precompute arc lengths/offsets immutably (eslint react-hooks/immutability)
  const arcs = slices.reduce<{ s: (typeof slices)[number]; len: number; off: number }[]>((arr, s) => {
    const prev = arr[arr.length - 1];
    const off = prev ? prev.off + prev.len : 0;
    arr.push({ s, len: (s.value / total) * 100, off });
    return arr;
  }, []);
  const hovered = hover != null ? slices[hover] : null;
  const pct = hovered ? Math.round((hovered.value / total) * 100) : null;
  const pick = (i: number) => setHover((cur) => (cur === i ? null : i));
  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0">
        <svg viewBox="0 0 40 40" className="h-24 w-24 -rotate-90">
          <circle cx="20" cy="20" r={R} fill="none" stroke="currentColor" className="text-muted" strokeWidth="6" />
          {arcs.map(({ s, len, off }, i) => {
            const el = (
              <circle
                key={i}
                cx="20" cy="20" r={R}
                fill="none" stroke={s.color}
                strokeWidth={hover === i ? 8 : 6}
                strokeDasharray={`${len} ${100 - len}`}
                strokeDashoffset={-off}
                className="transition-all cursor-pointer"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onClick={() => pick(i)}
              />
            );
            return el;
          })}
        </svg>
        {hovered && pct != null && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="rounded-xl bg-slate-900/90 dark:bg-slate-800/95 text-white px-2.5 py-1.5 text-center shadow-lg max-w-[94%]">
              <p className="text-sm font-extrabold leading-none" dir="ltr">{pct}%</p>
              <p className="text-[9px] font-semibold text-white/85 truncate mt-0.5">{hovered.label}</p>
            </div>
          </div>
        )}
      </div>
      <div className="space-y-1 min-w-0">
        {slices.map((s, i) => (
          <div
            key={i}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onClick={() => pick(i)}
            className={`flex items-center gap-2 text-xs rounded-lg px-1.5 py-0.5 cursor-pointer transition-colors ${hover === i ? 'bg-muted font-bold' : ''}`}
          >
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
            <span className="font-semibold break-words">{s.label}</span>
          </div>
        ))}
      </div>
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
