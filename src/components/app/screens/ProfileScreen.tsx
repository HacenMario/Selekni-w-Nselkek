'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApp } from '@/store/app';
import { useLang, LANGS } from '@/lib/language-context';
import { useTheme } from 'next-themes';
import { api, setToken } from '@/lib/api';
import { Settings, Stats, User, BLOOD_TYPES, BloodType } from '@/lib/types';
import { Flag } from '@/components/app/flags';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ClearInput } from '@/components/app/ClearableField';
import { WilayaSelect } from '@/components/app/WilayaSelect';
import { UserAvatar } from '@/components/app/UserAvatar';
import { PwaSetupCard } from '@/components/app/PwaSetupCard';
import { FontSizeControl } from '@/components/app/FontSizeControl';
import { compressAvatar, compressIdCard } from '@/lib/image';
import { wilayaShort } from '@/lib/wilayas';
import { TermsScreen } from '@/components/app/screens/TermsScreen';
import { levelInfo } from '@/components/app/ui-bits';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  AArrowUp, BadgeCheck, Coins, FileText, Handshake, IdCard, LogOut, Moon, ShieldCheck,
  Sparkles, Sun, TrendingUp, TriangleAlert, UserRound, Wrench,
} from 'lucide-react';
import { toast } from 'sonner';

export function ProfileScreen() {
  const { t, lang, setLang, enabledLangs, toggleEnabled } = useLang();
  const user = useApp((s) => s.user);
  const setUser = useApp((s) => s.setUser);
  const setScreen = useApp((s) => s.setScreen);
  const setTab = useApp((s) => s.setTab);
  const { theme, setTheme } = useTheme();

  const [showTerms, setShowTerms] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [wilaya, setWilaya] = useState(user?.wilaya || '');
  const [gender, setGender] = useState<'male' | 'female' | ''>(user?.gender || '');
  const [age, setAge] = useState(user?.age ? String(user.age) : '');
  const [blood, setBlood] = useState<BloodType | ''>(user?.bloodType || '');
  const [avatar, setAvatar] = useState<{ mime: string; dataBase64: string } | null>(null);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<Settings>('/settings'),
    staleTime: 60_000,
  });

  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: () => api.get<Stats>('/stats'),
    // keeps the gamification level bar and stat cards live without a manual refresh
    refetchInterval: 30_000,
  });

  async function pickAvatar(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    setSavingAvatar(true);
    try {
      const c = await compressAvatar(f);
      setAvatar({ mime: c.mime, dataBase64: c.dataBase64 }); // instant preview while it uploads
      // v4.5 — the photo saves immediately, no need to press "update profile"
      const updated = await api.patch<User>('/me', { avatar: { mime: c.mime, dataBase64: c.dataBase64 } });
      setUser(updated);
      setAvatar(null);
      toast.success(t('profileUpdated'));
    } catch {
      setAvatar(null);
      toast.error(t('error'));
    } finally {
      setSavingAvatar(false);
    }
  }

  async function saveProfile() {
    const ageNum = Number(age);
    setSavingProfile(true);
    try {
      const updated = await api.patch<User>('/me', {
        name: name.trim(),
        phone: phone.trim(),
        wilaya,
        gender,
        bloodType: blood || undefined,
        ...(ageNum >= 12 && ageNum <= 100 ? { age: ageNum } : {}),
        // v4.11 — persist the chosen interface languages with the account
        // (they were only written to localStorage before, never sent to the server)
        languages: enabledLangs,
      });
      setUser(updated);
      toast.success(t('profileUpdated'));
    } catch {
      toast.error(t('error'));
    } finally {
      setSavingProfile(false);
    }
  }

  async function changeRole(r: 'owner' | 'seeker') {
    try {
      const updated = await api.patch<User>('/me', { role: r });
      setUser(updated);
      setTab(r === 'owner' ? 'offers' : 'feed');
      toast.success(t('roleChanged'));
    } catch {
      toast.error(t('error'));
    }
  }

  async function logout() {
    setToken(null);
    setUser(null);
    setScreen('auth');
  }

  if (!user) return null;
  const genderLabel = user.gender === 'male' ? t('male') : user.gender === 'female' ? t('female') : '';

  return (
    <div className="flex-1 overflow-y-auto px-4 pb-28 pt-4 space-y-5">
      {/* header card */}
      <div className="rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground p-5 shadow-lg shadow-primary/25">
        <div className="flex items-center gap-4">
          <label className="cursor-pointer relative shrink-0">
            <UserAvatar user={user} size="h-20 w-20" textClass="text-2xl" />
            {avatar && (
              // v4.15 — object-contain: the freshly picked photo previews complete, never cropped
              <img src={`data:${avatar.mime};base64,${avatar.dataBase64}`} alt="" className="absolute inset-0 h-20 w-20 rounded-2xl object-contain bg-background" />
            )}
            {savingAvatar && (
              <span className="absolute inset-0 h-20 w-20 rounded-2xl bg-black/35 flex items-center justify-center">
                <span className="h-5 w-5 rounded-full border-2 border-white/50 border-t-white animate-spin" />
              </span>
            )}
            <span className="absolute -bottom-1 -end-1 h-8 w-8 rounded-full bg-white text-primary flex items-center justify-center shadow-md">
              <UserRound className="h-4.5 w-4.5" />
            </span>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => { pickAvatar(e.target.files); e.currentTarget.value = ''; }} />
          </label>
          <div className="min-w-0">
            <p className="font-bold text-lg leading-tight break-words">{user.name}</p>
            <p className="text-sm opacity-85 break-all">{user.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          <Badge variant="outline" className="bg-white/15 text-white border-white/30 text-xs">
            {user.role === 'owner' ? t('roleOwner') : t('roleSeeker')}
          </Badge>
          {genderLabel && (
            <Badge variant="outline" className="bg-white/15 text-white border-white/30 text-xs">{genderLabel}</Badge>
          )}
          {Boolean(user.age) && (
            <Badge variant="outline" className="bg-white/15 text-white border-white/30 text-xs">{t('yearsOld', { age: user.age })}</Badge>
          )}
          {user.wilaya && (
            <Badge variant="outline" className="bg-white/15 text-white border-white/30 text-xs">{wilayaShort(user.wilaya, lang)}</Badge>
          )}
          {user.bloodType && (
            <Badge variant="outline" className="bg-white/15 text-white border-white/30 text-xs font-extrabold">🩸 {user.bloodType}</Badge>
          )}
          {user.role === 'seeker' && user.idVerified === 'verified' && (
            <Badge variant="outline" className="bg-white/15 text-white border-white/30 text-xs">{t('idVerifiedBadge')}</Badge>
          )}
          <Badge variant="outline" className="bg-white/15 text-white border-white/30 text-xs">
            {t('memberSince')} {new Date(user.createdAt).toLocaleDateString()}
          </Badge>
        </div>
      </div>

      {/* ID-card verification status (seekers) — re-upload after a rejection */}
      {user.role === 'seeker' && user.idVerified !== 'verified' && user.idVerified !== 'none' && (
        <div className={`rounded-2xl border-2 p-4 flex items-start gap-3 card-hover ${user.idVerified === 'pending' ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/40' : 'border-rose-400 bg-rose-50 dark:bg-rose-950/40'}`}>
          <BadgeCheck className={`h-5 w-5 shrink-0 mt-0.5 ${user.idVerified === 'pending' ? 'text-amber-500' : 'text-rose-500'}`} />
          <div className="min-w-0 flex-1">
            <p className={`font-bold text-sm break-words ${user.idVerified === 'pending' ? 'text-amber-700 dark:text-amber-300' : 'text-rose-700 dark:text-rose-300'}`}>
              {user.idVerified === 'pending' ? t('idPendingBadge') : t('idRejectedBadge')}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 break-words">
              {user.idVerified === 'pending'
                ? t('idPendingHint')
                : t('idRejectedHint', { reason: user.idRejectReason || t('idRejectedBadge') })}
            </p>
            {user.idVerified === 'rejected' && (
              <label className="mt-2.5 inline-flex items-center gap-2 h-10 px-4 rounded-xl border-2 border-dashed border-rose-400/60 cursor-pointer hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors text-sm font-bold text-rose-700 dark:text-rose-300">
                <IdCard className="h-4 w-4" /> {t('idReupload')}
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.currentTarget.value = '';
                  if (!f) return;
                  try {
                    const c = await compressIdCard(f);
                    const updated = await api.patch<User>('/me', { idCard: { mime: c.mime, dataBase64: c.dataBase64 } });
                    setUser(updated);
                    toast.success(t('idPendingHint'));
                  } catch { toast.error(t('error')); }
                }} />
              </label>
            )}
          </div>
        </div>
      )}

      {/* quick stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={Handshake} label={t('postedOffers')} value={stats.owner.posted} />
          <StatCard icon={Coins} label={t('totalSpent')} value={`${stats.owner.totalSpentDA.toLocaleString('fr-DZ')} ${t('da')}`} />
          <StatCard icon={Wrench} label={t('tasksAccepted')} value={stats.seeker.accepted} />
          <StatCard icon={TrendingUp} label={t('totalEarned')} value={`${stats.seeker.earnedDA.toLocaleString('fr-DZ')} ${t('da')}`} />
        </div>
      )}

      {/* gamification level + progress to the next one (v4) — live from /stats, falls back to the stored user snapshot */}
      <LevelProgressCard
        tasks={user.role === 'owner' ? (stats?.owner.done ?? user.tasksCompleted ?? 0) : (stats?.seeker.done ?? user.tasksDone ?? 0)}
        label={user.role === 'owner' ? t('levelOwnerMetric') : t('levelSeekerMetric')}
      />

      {/* install app + notifications (v4) — rendered ONCE here (duplicate removed in v4.4) */}
      <PwaSetupCard />

      {/* v4.9 — "contact us" moved to its own bottom-nav tab */}

      {/* v4.15 — the dues section moved OUT of "my account": executors have a
          dedicated dues page in the bottom bar; clients see nothing dues-related */}

      {/* languages */}
      <SectionCard icon={UserRound} title={t('languages')}>
        <p className="text-xs text-muted-foreground mb-3 break-words">{t('languagesHint')}</p>
        <div className="space-y-1">
          {LANGS.map((l) => {
            const on = enabledLangs.includes(l.code);
            return (
              <div key={l.code} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${lang === l.code ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted/60'}`}>
                <Flag code={l.code} className="h-5 w-8 rounded-[3px]" />
                <button
                  onClick={() => on && setLang(l.code)}
                  disabled={!on}
                  className={`flex-1 text-start text-sm font-semibold disabled:opacity-50 ${lang === l.code ? 'text-primary' : ''}`}
                >
                  {l.name}
                </button>
                {lang === l.code && <BadgeCheck className="h-4 w-4 text-primary shrink-0" />}
                <Switch checked={on} onCheckedChange={() => toggleEnabled(l.code)} aria-label={`${l.name} On/Off`} className="shrink-0" />
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* theme */}
      <SectionCard icon={theme === 'dark' ? Moon : Sun} title={t('theme')}>
        <div className="flex items-center justify-between py-1">
          <span className="text-sm font-medium">{theme === 'dark' ? t('darkMode') : t('lightMode')}</span>
          <div className="flex gap-1.5">
            <button onClick={() => setTheme('light')} aria-label={t('lightMode')} className={`h-9 w-9 rounded-xl border flex items-center justify-center ${theme !== 'dark' ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground'}`}>
              <Sun className="h-4 w-4" />
            </button>
            <button onClick={() => setTheme('dark')} aria-label={t('darkMode')} className={`h-9 w-9 rounded-xl border flex items-center justify-center ${theme === 'dark' ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground'}`}>
              <Moon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </SectionCard>

      {/* v4.16 — text-size control moved out of the header into "my account" */}
      <SectionCard icon={AArrowUp} title={t('fontSizeCard')}>
        <div className="flex items-center justify-between py-1 gap-3">
          <span className="text-sm text-muted-foreground break-words min-w-0">{t('fontSizeHint')}</span>
          <div className="shrink-0"><FontSizeControl /></div>
        </div>
      </SectionCard>

      {/* edit profile */}
      <SectionCard icon={UserRound} title={t('editProfile')}>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="p-name">{t('name')}</Label>
            <ClearInput id="p-name" value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p-phone">{t('phone')}</Label>
              <ClearInput id="p-phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-11 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-age">{t('age')}</Label>
              <ClearInput id="p-age" type="number" inputMode="numeric" min={12} max={100} value={age} onChange={(e) => setAge(e.target.value)} placeholder={t('agePlaceholder')} className="h-11 rounded-xl" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t('gender')}</Label>
            <div className="grid grid-cols-2 gap-2">
              {(['male', 'female'] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGender(g)}
                  className={`h-11 rounded-xl border-2 text-sm font-bold transition-all active:scale-95 ${gender === g ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground'}`}
                >
                  {t(g)}
                </button>
              ))}
            </div>
          </div>
          {/* blood group — visible to the other party, may save a life */}
          <div className="space-y-1.5">
            <Label>{t('bloodType')}</Label>
            <select
              value={blood}
              onChange={(e) => setBlood(e.target.value as BloodType | '')}
              className="h-12 w-full rounded-xl border bg-card px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">— {t('bloodType')} —</option>
              {BLOOD_TYPES.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground leading-snug">{t('bloodTypeHint')}</p>
          </div>
          <div className="space-y-1.5">
            <Label>{t('wilaya')}</Label>
            <WilayaSelect value={wilaya} onChange={setWilaya} />
          </div>
          <Button onClick={saveProfile} disabled={savingProfile || !name.trim()} className="w-full h-11 rounded-xl font-bold">
            {savingProfile && <span className="h-4 w-4 rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground animate-spin me-2" />}
            {t('updateProfile')}
          </Button>
          <div className="space-y-1.5 pt-1">
            <Label>{t('changeRole')}</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button variant={user.role === 'owner' ? 'default' : 'outline'} size="sm" onClick={() => changeRole('owner')} className="rounded-xl h-10">{t('roleOwner')}</Button>
              <Button variant={user.role === 'seeker' ? 'default' : 'outline'} size="sm" onClick={() => changeRole('seeker')} className="rounded-xl h-10">{t('roleSeeker')}</Button>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* about / safety */}
      <SectionCard icon={TriangleAlert} title={t('safetyTitle')}>
        <p className="text-sm text-muted-foreground leading-relaxed break-words">{t('aboutBody')}</p>
      </SectionCard>

      {/* v4.10 — Terms of Use & Privacy: elegant card opening the legal page */}
      <SectionCard icon={FileText} title={t('termsTitle')} action={
        <Button variant="ghost" size="sm" onClick={() => setShowTerms(true)} className="text-primary font-bold">
          {t('seeAll')}
        </Button>
      }>
        <p className="text-sm text-muted-foreground break-words">{t('termsIntro')}</p>
      </SectionCard>
      <p className="text-center text-[11px] font-semibold text-muted-foreground/80">{t('madeBy')}</p>
      {showTerms && <TermsScreen onClose={() => setShowTerms(false)} />}

      {/* logout */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" className="w-full h-12 rounded-xl text-destructive border-destructive/30 hover:bg-destructive/10 font-bold">
            <LogOut className="h-4 w-4 me-2" /> {t('logout')}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="rounded-2xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('logout')}</AlertDialogTitle>
            <AlertDialogDescription>{t('logoutConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl h-11">{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={logout} className="rounded-xl h-11 bg-destructive text-destructive-foreground font-bold">{t('logout')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border bg-card p-4 flex flex-col gap-1.5 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold">{label}</span>
      </div>
      <p className="text-xl font-extrabold tracking-tight">{value}</p>
    </div>
  );
}

/** Gamification: current level + progress bar toward the next one (v4). */
function LevelProgressCard({ tasks, label }: { tasks: number | undefined; label: string }) {
  const { t } = useLang();
  const n = tasks || 0;
  const lvl = levelInfo(n);

  // progress toward the next rung of the ladder — with no level yet, rung #1 is bronze (1 task)
  const curBase = lvl ? lvl.at : 0;
  const next = lvl ? lvl.next : 1;
  const maxed = Boolean(lvl) && lvl!.next === null;
  const pct = maxed ? 100 : Math.min(100, Math.round(((n - curBase) / Math.max(1, next! - curBase)) * 100));

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
        <p className="font-bold text-sm flex-1">{t('levelTitle')}</p>
        {lvl ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700 px-2.5 py-1 text-xs font-extrabold">
            <span aria-hidden="true">{lvl.icon}</span> {t(lvl.key)}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground font-semibold">{t('levelNone')}</span>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-2.5 break-words">{label}: <b className="text-foreground">{n}</b></p>
      {maxed ? (
        <p className="text-[11px] font-bold text-amber-600 dark:text-amber-300 break-words">{t('levelMaxReached')}</p>
      ) : (
        <>
          <div className="h-2.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5 break-words">
            {t('levelNextHint', { count: next! - n })}
          </p>
        </>
      )}
    </div>
  );
}

function SectionCard({ icon: Icon, title, children, action }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <h3 className="font-bold text-sm">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}
