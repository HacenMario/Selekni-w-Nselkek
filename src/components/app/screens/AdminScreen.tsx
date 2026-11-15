'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApp, AdminTab } from '@/store/app';
import { useLang } from '@/lib/language-context';
import { api, idCardUrl, packageImageUrl, subProofUrl } from '@/lib/api';
import { badgeDelta, getClicked, markClicked, markTabSeen } from '@/lib/admin-badges';
import { AdminDashboard, AdminStats, Complaint, ExpiringSub, Offer, Paged, PublicUser, Settings, SubPackage, Subscription, User } from '@/lib/types';
import { compressImage } from '@/lib/image';
import { AmountPill, Pager, StatusBadge, timeAgo } from '@/components/app/ui-bits';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { WilayaSelect } from '@/components/app/WilayaSelect';
import { wilayaLabel } from '@/lib/wilayas';
import { UserAvatar } from '@/components/app/UserAvatar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import {
  BadgeCheck, Ban, BarChart3, Check, ClipboardList, Coins, Crown, Droplets, Gavel, Gift, Handshake, Hourglass, IdCard, ImagePlus, LoaderCircle,
  LayoutDashboard, Layers3, Lock, LockOpen, MapPin, Megaphone, Pencil, Phone, Plus, Send, Settings2,
  TrendingUp, Trash2, Users, UsersRound, Wallet, Wrench, X, CalendarClock,
} from 'lucide-react';
import { toast } from 'sonner';

export function AdminScreen() {
  const { t } = useLang();
  const adminTab = useApp((s) => s.adminTab);
  const setAdminTab = useApp((s) => s.setAdminTab);
  const token = typeof window !== 'undefined' ? localStorage.getItem('slekni.token') || '' : '';

  // live pending counts that drive the numeric tab badges
  const { data: badgeData } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => api.get<AdminDashboard>('/admin/dashboard'),
    refetchInterval: 20_000,
  });
  const counts: Record<string, number> = {
    subs: badgeData?.subscriptions.pending || 0,
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
            <TabsTrigger value="subs" className="rounded-lg gap-1.5 px-2.5 h-9 data-[state=active]:bg-background data-[state=active]:shadow-sm"><Wallet className="h-4 w-4 shrink-0" /><span className="text-xs font-bold">{t('manageSubscriptions')}</span><TabBadge count={badgeDelta('subs', counts.subs)} /></TabsTrigger>
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
        <TabsContent value="subs" className="flex-1 overflow-y-auto px-4 pb-28 pt-4 mt-0">
          <SubsTab token={token} />
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
  const { data } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => api.get<AdminDashboard>('/admin/dashboard'),
    refetchInterval: 30_000,
  });

  if (!data) return <Spinner />;

  return (
    <div className="space-y-5">
      {/* 12 overview KPI cards (v4.6 — accounts, subscriptions, moderation, offers funnel) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Kpi icon={Users} label={t('totalUsers')} value={data.users.total} />
        <Kpi icon={Handshake} label={t('owners')} value={data.users.owners} />
        <Kpi icon={Wrench} label={t('seekers')} value={data.users.seekers} />
        <Kpi icon={BadgeCheck} label={t('verifiedKpi')} value={data.users.verified ?? 0} />
        <Kpi icon={Ban} label={t('bannedKpi')} value={data.users.banned ?? 0} />
        <Kpi icon={Wallet} label={t('subsActiveKpi')} value={data.subscriptions.active} />
        <Kpi icon={Hourglass} label={t('pendingSubs')} value={data.subscriptions.pending} highlight={data.subscriptions.pending > 0} />
        <Kpi icon={Gavel} label={t('complaintsOpenCount')} value={data.complaintsOpen} highlight={data.complaintsOpen > 0} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Kpi icon={Check} label={t('statusOpen')} value={data.offers.open} />
        <Kpi icon={Handshake} label={t('statusAssigned')} value={data.offers.assigned} />
        <Kpi icon={Coins} label={t('statusAwaiting')} value={data.offers.awaiting} />
        <Kpi icon={BadgeCheck} label={t('statusDone')} value={data.offers.done} />
      </div>

      {/* subscriptions needing renewal so the admin can contact owners */}
      {data.expiringSubs?.length > 0 && (
        <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/30 p-4 space-y-3">
          <h3 className="font-bold text-sm flex items-center gap-2 text-amber-700 dark:text-amber-300">
            <CalendarClock className="h-4 w-4" /> {t('expiringSubs')} ({data.expiringSubs.length})
          </h3>
          {data.expiringSubs.map((s) => (
            <ExpiringRow key={s._id} sub={s} />
          ))}
        </div>
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

function ExpiringRow({ sub }: { sub: ExpiringSub }) {
  const { t } = useLang();
  const u = typeof sub.user === 'object' ? sub.user : null;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-amber-300 bg-card p-2.5">
      <UserAvatar user={u as PublicUser} size="h-11 w-11" textClass="text-sm" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold break-words leading-tight">{u?.name || '—'}</p>
        <p className="text-xs text-muted-foreground break-all">{u?.phone || u?.email || ''}</p>
      </div>
      <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-300 shrink-0">
        {sub.daysLeft === 0 ? t('dayLeftOne') : t('daysLeft', { count: sub.daysLeft })}
      </Badge>
      {u?.phone && (
        <a
          href={`tel:${u.phone}`}
          aria-label={t('contactAccount')}
          className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 active:scale-90 transition-all shrink-0"
        >
          <Phone className="h-4 w-4" />
        </a>
      )}
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

              {/* subscription management for this account (v4) */}
              {!detailUser.isSuperAdmin && <UserSubPanel userId={detailUser._id} />}

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

/* ---------- Subscriptions (v4: full details + full control) ---------- */
const SUB_STATUSES = ['', 'pending', 'active', 'expired', 'rejected'] as const;

function subDaysLeft(s: Subscription): number | null {
  if (!s.endsAt) return null;
  return Math.max(0, Math.ceil((new Date(s.endsAt).getTime() - Date.now()) / 86400000));
}

function SubsTab({ token }: { token: string }) {
  const { t, lang } = useLang();
  const qc = useQueryClient();
  const adminSubsFilter = useApp((s) => s.adminSubsFilter);
  const setAdminSubsFilter = useApp((s) => s.setAdminSubsFilter);
  const [busy, setBusy] = useState(false);
  const status = adminSubsFilter;
  const [page, setPage] = useState(1);
  const [proof, setProof] = useState<string | null>(null);
  const [extendSub, setExtendSub] = useState<Subscription | null>(null);
  const [extendDays, setExtendDays] = useState('7');
  // cards the administration has already clicked — their bounce stops for good
  const [clickedIds, setClickedIds] = useState<string[]>(() => getClicked('subs'));

  function viewCard(id: string) {
    if (!clickedIds.includes(id)) {
      markClicked('subs', id);
      setClickedIds(getClicked('subs'));
    }
  }

  const { data, isLoading } = useQuery({
    queryKey: ['admin-subs', status, page],
    // 5 cards per page — comfortable spacing for detailed review
    queryFn: () => api.get<Paged<Subscription>>('/admin/subscriptions', { status: status || undefined, page, limit: 5 }),
    refetchInterval: 25_000,
  });

  async function decide(id: string, action: 'approve' | 'reject') {
    setBusy(true);
    try {
      await api.post(`/admin/subscriptions/${id}/decide`, { action });
      toast.success(t('done'));
      qc.invalidateQueries({ queryKey: ['admin-subs'] });
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
    } catch {
      toast.error(t('error'));
    } finally {
      setBusy(false);
    }
  }

  async function act(fn: () => Promise<unknown>, okMsg = 'done') {
    setBusy(true);
    try {
      await fn();
      toast.success(t(okMsg));
      qc.invalidateQueries({ queryKey: ['admin-subs'] });
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
    } catch {
      toast.error(t('error'));
    } finally {
      setBusy(false);
    }
  }

  const pkgLabel = (s: Subscription) => {
    if (s.packageName) return s.packageName[lang] || s.packageName.en;
    return s.packageKey || t('legacyPlan');
  };

  const items = data?.items || [];

  return (
    <div className="space-y-4">
      {/* status filter — real buttons, desktop-safe */}
      <div className="flex gap-2 flex-wrap">
        {SUB_STATUSES.map((s) => (
          <button key={s || 'all'} onClick={() => { setAdminSubsFilter(s); setPage(1); }} className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all active:scale-95 ${status === s ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}>
            {s === '' ? t('allCategories') : t(s === 'pending' ? 'pendingSubs' : s === 'active' ? 'subActiveBadge' : s === 'expired' ? 'subscriptionExpired' : 'subRejectedBadge')}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">{t('noPendingSubs')}</p>
      ) : (
        items.map((s) => {
          const u = typeof s.user === 'object' ? s.user : null;
          const daysLeft = subDaysLeft(s);
          const isPending = s.status === 'pending';
          const isActive = s.status === 'active';
          return (
            <div
              key={s._id}
              onClick={() => viewCard(s._id)}
              className={`rounded-2xl border bg-card p-4 space-y-3 card-hover cursor-pointer ${isPending ? 'border-2 border-primary/40' : ''} ${isPending && !clickedIds.includes(s._id) ? 'animate-bounce-new' : ''}`}
            >
              {/* user header */}
              <div className="flex items-center gap-3">
                <UserAvatar user={u as PublicUser} size="h-12 w-12" textClass="text-base" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm break-words leading-tight">{u?.name || '—'}</p>
                  <p className="text-xs text-muted-foreground break-all">{u?.email}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <SubStatusBadge status={s.status} t={t} />
                  {u?.role && (
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {u.isSuperAdmin ? t('roleAdmin') : u.role === 'owner' ? t('roleOwner') : t('roleSeeker')}
                    </Badge>
                  )}
                </div>
              </div>

              {/* full subscription details */}
              <div className="rounded-xl bg-muted/50 p-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                <DetailChip label={t('subPackageType')} value={pkgLabel(s)} />
                <DetailChip label={t('subscriptionPrice')} value={`${s.amountDA.toLocaleString('fr-DZ')} ${t('da')}`} />
                <DetailChip label={t('subscriptionDuration')} value={`${s.durationDays ?? '—'} ${t('days')}`} />
                <DetailChip label={t('maxActiveOffers')} value={String(s.maxActiveOffers ?? '—')} />
                <div className="col-span-2 break-words"><b className="text-xs text-muted-foreground">{t('reference')}:</b> <span className="text-sm font-semibold" dir="ltr">{s.reference}</span></div>
                {s.startsAt && <DetailChip label={t('subStarted')} value={new Date(s.startsAt).toLocaleDateString()} />}
                {s.endsAt && <DetailChip label={t('subscriptionActiveUntil')} value={new Date(s.endsAt).toLocaleDateString()} />}
                {daysLeft !== null && (
                  <div className="col-span-2">
                    <Badge variant="outline" className={`text-[11px] ${isActive && daysLeft <= 5 ? 'border-amber-400 text-amber-700 dark:text-amber-300' : ''}`}>
                      {isActive ? (daysLeft === 0 ? t('dayLeftOne') : t('daysLeft', { count: daysLeft })) : `—`}
                    </Badge>
                  </div>
                )}
                <div className="col-span-2 text-[11px] text-muted-foreground">{t('requested')} {timeAgo(s.createdAt, t)}</div>
              </div>

              {/* payment proof */}
              {s.proofImage && (
                <button onClick={() => setProof(subProofUrl(s._id, s.proofImage!._id, token))} className="relative w-full text-start">
                  <img src={subProofUrl(s._id, s.proofImage._id, token)} alt={t('proof')} className="max-h-40 rounded-xl border w-full object-cover" />
                  <span className="absolute bottom-2 end-2 rounded-lg bg-black/60 text-white text-[11px] font-bold px-2 py-1">{t('viewFull')}</span>
                </button>
              )}

              {/* actions */}
              <div className="grid grid-cols-2 gap-2">
                {isPending && (
                  <>
                    <Button onClick={() => decide(s._id, 'approve')} disabled={busy} className="rounded-xl h-10 font-bold">
                      <Check className="h-4 w-4 me-1" /> {t('decideApprove')}
                    </Button>
                    <Button onClick={() => decide(s._id, 'reject')} disabled={busy} variant="outline" className="rounded-xl h-10 font-bold text-destructive border-destructive/40">
                      <X className="h-4 w-4 me-1" /> {t('decideReject')}
                    </Button>
                  </>
                )}
                {isActive && (
                  <>
                    <Button onClick={() => setExtendSub(s)} disabled={busy} variant="outline" className="rounded-xl h-10 font-bold border-primary/40 text-primary">
                      <CalendarClock className="h-4 w-4 me-1" /> {t('extendSub')}
                    </Button>
                    <Button onClick={() => act(() => api.post(`/admin/subscriptions/${s._id}/expire`), 'subDisabled')} disabled={busy} variant="outline" className="rounded-xl h-10 font-bold text-destructive border-destructive/40">
                      <Ban className="h-4 w-4 me-1" /> {t('disableSub')}
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })
      )}

      {data && <Pager page={data.page || page} pages={data.pages} onChange={setPage} />}

      {/* full-screen proof viewer */}
      <AlertDialog open={!!proof} onOpenChange={(o) => !o && setProof(null)}>
        <AlertDialogContent className="rounded-2xl max-w-lg" aria-describedby={undefined}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('proof')}</AlertDialogTitle>
          </AlertDialogHeader>
          {proof && <img src={proof} alt={t('proof')} className="w-full rounded-xl border max-h-[60dvh] object-contain" />}
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl h-11">{t('close')}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* extend dialog */}
      <AlertDialog open={!!extendSub} onOpenChange={(o) => !o && setExtendSub(null)}>
        <AlertDialogContent className="rounded-2xl max-w-sm" aria-describedby={undefined}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('extendSub')}</AlertDialogTitle>
            <AlertDialogDescription>{t('extendSubHint')}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="ext-days">{t('subscriptionDuration')} ({t('days')})</Label>
            <Input id="ext-days" type="number" inputMode="numeric" min={1} max={3650} value={extendDays} onChange={(e) => setExtendDays(e.target.value)} className="h-11 rounded-xl" />
            <div className="flex gap-2 pt-1">
              {[7, 30, 90].map((d) => (
                <button key={d} type="button" onClick={() => setExtendDays(String(d))} className="flex-1 h-9 rounded-xl border-2 text-xs font-bold hover:border-primary/60 active:scale-95 transition-all">{d} {t('days')}</button>
              ))}
            </div>
          </div>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl h-11">{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => extendSub && act(() => api.post(`/admin/subscriptions/${extendSub._id}/extend`, { days: Math.max(1, Number(extendDays) || 0) }), 'subExtended')}
              disabled={busy || Number(extendDays) < 1}
              className="rounded-xl h-11 font-bold"
            >
              {t('confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DetailChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold text-muted-foreground leading-tight">{label}</p>
      <p className="text-sm font-semibold break-words leading-snug">{value}</p>
    </div>
  );
}

function SubStatusBadge({ status, t }: { status: string; t: (k: string, p?: Record<string, string | number>) => string }) {
  const map: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300',
    active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300',
    expired: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border-rose-300',
    rejected: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border-rose-300',
  };
  const key = status === 'pending' ? 'pendingSubs' : status === 'active' ? 'subActiveBadge' : status === 'expired' ? 'subscriptionExpired' : 'subRejectedBadge';
  return <Badge variant="outline" className={`text-[10px] font-bold ${map[status] || ''}`}>{t(key)}</Badge>;
}

/* ---------- Settings (incl. packages editor) ---------- */
function SettingsTab() {
  const { t, lang } = useLang();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [instructions, setInstructions] = useState<string | null>(null);
  const [subEnabled, setSubEnabled] = useState<boolean | null>(null);
  const [pkgs, setPkgs] = useState<SubPackage[] | null>(null);
  const [contact, setContact] = useState<{ phone: string; email: string; instagram: string; address: string } | null>(null);

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<Settings>('/settings'),
    staleTime: 30_000,
  });

  const curPkg = pkgs ?? settings?.packages ?? [];
  const curEnabled = subEnabled ?? settings?.subscription.isEnabled ?? true;
  const curInstr = instructions ?? settings?.subscription.paymentInstructions ?? '';
  const curContact = contact ?? settings?.contact ?? { phone: '', email: '', instagram: '', address: '' };

  async function save() {
    setSaving(true);
    try {
      await api.put('/admin/settings', {
        subscription: { isEnabled: curEnabled, paymentInstructions: curInstr },
        packages: curPkg,
        contact: curContact,
      });
      toast.success(t('settingsSaved'));
      qc.invalidateQueries({ queryKey: ['settings'] });
      qc.invalidateQueries({ queryKey: ['my-subscription'] });
    } catch {
      toast.error(t('error'));
    } finally {
      setSaving(false);
    }
  }

  function updatePkg(i: number, patch: Partial<SubPackage>) {
    setPkgs((prev) => (prev ?? [...(settings?.packages ?? [])]).map((p, j) => (j === i ? { ...p, ...patch } : p)));
  }

  async function uploadPkgImage(i: number, files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    try {
      const c = await compressImage(f);
      const res = await api.post<{ gridId: string }>('/admin/package-image', { mime: c.mime, dataBase64: c.dataBase64 });
      updatePkg(i, { imageGridId: res.gridId });
      toast.success(t('saved'));
    } catch {
      toast.error(t('error'));
    }
  }

  return (
    <div className="space-y-4 max-w-xl">
      <div className="rounded-2xl border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-bold text-sm">{t('subEnabled')}</span>
          <Switch checked={curEnabled} onCheckedChange={setSubEnabled} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('paymentInstructions')}</Label>
          <Textarea value={curInstr} onChange={(e) => setInstructions(e.target.value)} className="min-h-24 rounded-xl text-sm" maxLength={3000} />
        </div>
      </div>

      {/* v4.6 — contact page content, edited here and shown to all users */}
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

      {/* packages */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm">{t('packages')}</h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPkgs((prev) => [...(prev ?? [...(settings?.packages ?? [])]), { key: `pkg-${Date.now()}`, name: { ar: 'باقة جديدة', fr: 'Nouveau forfait', en: 'New package' }, priceDA: 1000, durationDays: 30, maxActiveOffers: 5, active: true }])}
            className="rounded-xl h-9"
          >
            <Plus className="h-4 w-4 me-1" /> {t('addPackage')}
          </Button>
        </div>
        {curPkg.map((p, i) => (
          <div key={p.key + i} className="rounded-2xl border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Input value={p.name[lang] || p.name.en} onChange={(e) => updatePkg(i, { name: { ...p.name, [lang]: e.target.value } })} className="h-10 rounded-xl font-bold" placeholder={t('packageName')} />
              <button
                onClick={() => setPkgs((prev) => (prev ?? [...(settings?.packages ?? [])]).filter((_, j) => j !== i))}
                aria-label={t('removePackage')}
                className="h-9 w-9 rounded-xl border border-destructive/40 text-destructive flex items-center justify-center hover:bg-destructive/10 active:scale-90 shrink-0"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            {/* promotional image of the package (v4) */}
            <div className="flex items-center gap-3">
              {p.imageGridId ? (
                <div className="relative shrink-0">
                  <img src={packageImageUrl(p.imageGridId)} alt="" className="h-20 w-28 rounded-xl border object-contain bg-muted" />
                  <button
                    onClick={() => updatePkg(i, { imageGridId: undefined })}
                    aria-label={t('removePackageImage')}
                    className="absolute -top-2 -end-2 h-6 w-6 rounded-full bg-destructive text-white flex items-center justify-center shadow active:scale-90 transition-transform"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <label className="h-16 w-28 rounded-xl border-2 border-dashed border-muted-foreground/40 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-primary/60 hover:bg-primary/5 transition-colors text-muted-foreground shrink-0">
                  <ImagePlus className="h-4 w-4" />
                  <span className="text-[10px] font-bold">{t('packageImage')}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadPkgImage(i, e.target.files)} />
                </label>
              )}
              <p className="text-xs text-muted-foreground leading-relaxed break-words">{t('packageImageHint')}</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <NumField label={t('subscriptionPrice')} value={p.priceDA} onChange={(v) => updatePkg(i, { priceDA: v })} />
              <NumField label={t('subscriptionDuration')} value={p.durationDays} onChange={(v) => updatePkg(i, { durationDays: v })} />
              <NumField label={t('maxActiveOffers')} value={p.maxActiveOffers} onChange={(v) => updatePkg(i, { maxActiveOffers: v })} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">{t('active')}</span>
              <Switch checked={p.active} onCheckedChange={(v) => updatePkg(i, { active: v })} />
            </div>
          </div>
        ))}
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

/* ---------- Per-user subscription management (v4) ---------- */
function UserSubPanel({ userId }: { userId: string }) {
  const { t, lang } = useLang();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [showGrant, setShowGrant] = useState(false);
  const [showActivate, setShowActivate] = useState(false);

  const { data } = useQuery({
    queryKey: ['admin-user-subs', userId],
    queryFn: () => api.get<{ items: Subscription[]; subLocked: boolean }>(`/admin/users/${userId}/subscriptions`),
  });

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<Settings>('/settings'),
    staleTime: 60_000,
  });

  async function run(fn: () => Promise<unknown>, msg: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(t(msg));
      qc.invalidateQueries({ queryKey: ['admin-user-subs', userId] });
      qc.invalidateQueries({ queryKey: ['admin-subs'] });
    } catch {
      toast.error(t('error'));
    } finally {
      setBusy(false);
    }
  }

  const locked = data?.subLocked;
  const subs = data?.items || [];
  const activeSub = subs.find((s) => s.status === 'active');

  return (
    <div className="rounded-xl border-2 border-primary/25 bg-primary/5 p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-extrabold text-primary flex items-center gap-1.5"><Coins className="h-3.5 w-3.5" /> {t('userSubscription')}</p>
        <Badge variant="outline" className={`text-[10px] ${locked ? 'border-rose-300 text-rose-600' : 'border-emerald-300 text-emerald-600'}`}>
          {locked ? t('subLockedBadge') : t('subUnlockedBadge')}
        </Badge>
      </div>

      {activeSub ? (
        <div className="text-xs space-y-0.5">
          <p><b>{t('subPackageType')}:</b> {activeSub.packageName?.[lang] || activeSub.packageKey || t('legacyPlan')} · {activeSub.amountDA.toLocaleString('fr-DZ')} {t('da')}</p>
          <p>
            <b>{t('subscriptionActiveUntil')}:</b> {activeSub.endsAt ? new Date(activeSub.endsAt).toLocaleDateString() : '—'}
            {(() => {
              const d = subDaysLeft(activeSub);
              return d !== null ? ` · ${d === 0 ? t('dayLeftOne') : t('daysLeft', { count: d })}` : '';
            })()}
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{t('subscriptionNone')}</p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => run(() => api.post(`/admin/users/${userId}/sub-lock`, { locked: !locked }), locked ? 'subEnabled' : 'subDisabled')}
          className={`h-9 rounded-xl text-xs font-bold ${locked ? 'text-emerald-600 border-emerald-300' : 'text-destructive border-destructive/40'}`}
        >
          {locked ? <LockOpen className="h-3.5 w-3.5 me-1" /> : <Lock className="h-3.5 w-3.5 me-1" />}
          {locked ? t('enableUserSub') : t('disableUserSub')}
        </Button>
        <Button size="sm" onClick={() => setShowGrant(true)} disabled={busy} className="h-9 rounded-xl text-xs font-bold">
          <Gift className="h-3.5 w-3.5 me-1" /> {t('grantSub')}
        </Button>
      </div>
      {/* v4.5 — activate a PAID subscription directly (counts as revenue, unlike a free grant) */}
      <Button size="sm" variant="outline" onClick={() => setShowActivate(true)} disabled={busy} className="w-full h-9 rounded-xl text-xs font-bold text-emerald-600 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40">
        <Wallet className="h-3.5 w-3.5 me-1" /> {t('activateSub')}
      </Button>

      {/* history (compact) */}
      {subs.length > 1 && (
        <div className="pt-1 border-t space-y-1">
          {subs.slice(0, 4).map((s) => (
            <div key={s._id} className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <SubStatusBadge status={s.status} t={t} />
              <span className="break-words">{s.packageName?.[lang] || s.packageKey || t('legacyPlan')} · {s.amountDA.toLocaleString('fr-DZ')} {t('da')}</span>
            </div>
          ))}
        </div>
      )}

      <GrantSubDialog
        open={showGrant}
        onClose={() => setShowGrant(false)}
        packages={settings?.packages || []}
        busy={busy}
        onGrant={(payload) => run(() => api.post(`/admin/users/${userId}/grant-sub`, payload), 'subGranted')}
      />
      <ActivateSubDialog
        open={showActivate}
        onClose={() => setShowActivate(false)}
        packages={settings?.packages || []}
        busy={busy}
        onActivate={(payload) => run(() => api.post(`/admin/users/${userId}/activate-sub`, payload), 'subActivated')}
      />
    </div>
  );
}

function GrantSubDialog({
  open,
  onClose,
  packages,
  busy,
  onGrant,
}: {
  open: boolean;
  onClose: () => void;
  packages: SubPackage[];
  busy: boolean;
  onGrant: (payload: { days: number; packageKey?: string; maxActiveOffers?: number }) => void;
}) {
  const { t, lang } = useLang();
  const [days, setDays] = useState('30');
  const [pkgKey, setPkgKey] = useState('');
  const [maxOffers, setMaxOffers] = useState('');

  const pkg = packages.find((p) => p.key === pkgKey);

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent className="rounded-2xl max-w-sm" aria-describedby={undefined}>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2"><Gift className="h-5 w-5 text-primary" /> {t('grantSub')}</AlertDialogTitle>
          <AlertDialogDescription>{t('grantSubHint')}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t('subscriptionDuration')} ({t('days')}) *</Label>
            <Input type="number" inputMode="numeric" min={1} max={3650} value={days} onChange={(e) => setDays(e.target.value)} className="h-11 rounded-xl" />
            <div className="flex gap-2">
              {[7, 30, 90, 365].map((d) => (
                <button key={d} type="button" onClick={() => setDays(String(d))} className="flex-1 h-8 rounded-lg border-2 text-xs font-bold hover:border-primary/60 active:scale-95 transition-all">{d}</button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t('subPackageType')}</Label>
            <select
              value={pkgKey}
              onChange={(e) => { setPkgKey(e.target.value); setMaxOffers(''); }}
              className="h-11 w-full rounded-xl border bg-card px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">{t('legacyPlan')}</option>
              {packages.map((p) => (
                <option key={p.key} value={p.key}>{p.name[lang] || p.name.en}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('maxActiveOffers')}</Label>
            <Input
              type="number" inputMode="numeric" min={1} max={100}
              value={maxOffers || (pkg ? String(pkg.maxActiveOffers) : '')}
              onChange={(e) => setMaxOffers(e.target.value)}
              placeholder={pkg ? String(pkg.maxActiveOffers) : '—'}
              className="h-11 rounded-xl"
            />
          </div>
        </div>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel className="rounded-xl h-11">{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onGrant({
              days: Math.max(1, Number(days) || 0),
              ...(pkgKey ? { packageKey: pkgKey } : {}),
              ...(Number(maxOffers) > 0 ? { maxActiveOffers: Number(maxOffers) } : {}),
            })}
            disabled={busy || Number(days) < 1}
            className="rounded-xl h-11 font-bold"
          >
            {busy && <Hourglass className="h-4 w-4 animate-spin" />} {t('confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** v4.5 — activate a PAID subscription directly on a user account: the amount counts as revenue. */
function ActivateSubDialog({
  open,
  onClose,
  packages,
  busy,
  onActivate,
}: {
  open: boolean;
  onClose: () => void;
  packages: SubPackage[];
  busy: boolean;
  onActivate: (payload: { days: number; amountDA: number; packageKey?: string; maxActiveOffers?: number; reference?: string }) => void;
}) {
  const { t, lang } = useLang();
  const [pkgKey, setPkgKey] = useState('');
  const [days, setDays] = useState('');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');

  const pkg = packages.find((p) => p.key === pkgKey);
  const effectiveDays = days || (pkg ? String(pkg.durationDays) : '');
  const effectiveAmount = amount || (pkg ? String(pkg.priceDA) : '');

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent className="rounded-2xl max-w-sm" aria-describedby={undefined}>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2"><Wallet className="h-5 w-5 text-emerald-600" /> {t('activateSub')}</AlertDialogTitle>
          <AlertDialogDescription>{t('activateSubHint')}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t('subPackageType')}</Label>
            <select
              value={pkgKey}
              onChange={(e) => { setPkgKey(e.target.value); setDays(''); setAmount(''); }}
              className="h-11 w-full rounded-xl border bg-card px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">{t('legacyPlan')}</option>
              {packages.map((p) => (
                <option key={p.key} value={p.key}>{p.name[lang] || p.name.en} · {p.priceDA.toLocaleString('fr-DZ')} {t('da')} · {p.durationDays} {t('days')}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>{t('subscriptionDuration')} ({t('days')}) *</Label>
              <Input type="number" inputMode="numeric" min={1} max={3650} value={effectiveDays} onChange={(e) => setDays(e.target.value)} placeholder={pkg ? String(pkg.durationDays) : '30'} className="h-11 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>{t('subAmountDA')} *</Label>
              <Input type="number" inputMode="numeric" min={1} value={effectiveAmount} onChange={(e) => setAmount(e.target.value)} placeholder={pkg ? String(pkg.priceDA) : '2000'} className="h-11 rounded-xl" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t('paymentReference')}</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={40} placeholder="TR-XXXXXX" className="h-11 rounded-xl" dir="ltr" />
          </div>
        </div>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel className="rounded-xl h-11">{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onActivate({
              days: Math.max(1, Number(effectiveDays) || 0),
              amountDA: Math.max(1, Number(effectiveAmount) || 0),
              ...(pkgKey ? { packageKey: pkgKey } : {}),
              ...(reference.trim() ? { reference: reference.trim() } : {}),
            })}
            disabled={busy || Number(effectiveDays) < 1 || Number(effectiveAmount) < 1}
            className="rounded-xl h-11 font-bold bg-emerald-600 text-white"
          >
            {busy && <Hourglass className="h-4 w-4 animate-spin" />} {t('confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
        <Kpi icon={Wallet} label={t('subsActiveKpi')} value={data.smart.subsActive} />
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
      <ChartCard title={t('dailyRevenue')} icon={Coins}>
        <Bars data={data.revenueSeries.map((d) => ({ label: dayLabel(d.date), value: d.amount }))} color="#10b981" money />
      </ChartCard>

      <div className="grid sm:grid-cols-2 gap-4">
        <ChartCard title={t('subsByStatus')} icon={Coins}>
          <Donut
            slices={[
              { label: t('pendingSubs'), value: data.subsByStatus.pending || 0, color: '#f59e0b' },
              { label: t('subActiveBadge'), value: data.subsByStatus.active || 0, color: '#10b981' },
              { label: t('subscriptionExpired'), value: data.subsByStatus.expired || 0, color: '#f43f5e' },
              { label: t('subRejectedBadge'), value: data.subsByStatus.rejected || 0, color: '#94a3b8' },
            ].filter((s) => s.value > 0)}
          />
        </ChartCard>
        <ChartCard title={t('subsByPackagePaid')} icon={Layers3}>
          <HBars items={data.subsByPackage.map((p) => ({ label: p.key === 'legacy' ? t('legacyPlan') : (settings?.packages?.find((x) => x.key === p.key)?.name[lang] || p.key), value: p.count, sub: `${t('revenueShort')}: ${p.DA.toLocaleString('fr-DZ')} ${t('da')}` }))} color="#8b5cf6" />
        </ChartCard>
      </div>

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

/** Donut chart with legend (subscription statuses) — the share of each slice
 *  appears in an elegant floating badge on hover (desktop) or tap (mobile). */
function Donut({ slices }: { slices: { label: string; value: number; color: string }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const total = slices.reduce((a, s) => a + s.value, 0);
  if (!total) return <p className="text-xs text-muted-foreground py-4 text-center">—</p>;
  const R = 15.915; // circumference = 100
  let offset = 0;
  const hovered = hover != null ? slices[hover] : null;
  const pct = hovered ? Math.round((hovered.value / total) * 100) : null;
  const pick = (i: number) => setHover((cur) => (cur === i ? null : i));
  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0">
        <svg viewBox="0 0 40 40" className="h-24 w-24 -rotate-90">
          <circle cx="20" cy="20" r={R} fill="none" stroke="currentColor" className="text-muted" strokeWidth="6" />
          {slices.map((s, i) => {
            const len = (s.value / total) * 100;
            const el = (
              <circle
                key={i}
                cx="20" cy="20" r={R}
                fill="none" stroke={s.color}
                strokeWidth={hover === i ? 8 : 6}
                strokeDasharray={`${len} ${100 - len}`}
                strokeDashoffset={-offset}
                className="transition-all cursor-pointer"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onClick={() => pick(i)}
              />
            );
            offset += len;
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
