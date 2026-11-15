'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { useApp } from '@/store/app';
import { useLang } from '@/lib/language-context';
import { api, setToken, buildApiUrl } from '@/lib/api';
import { User, BLOOD_TYPES, BloodType } from '@/lib/types';
import { compressAvatar, compressIdCard, CompressedImage } from '@/lib/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LanguageMenu } from '@/components/app/LanguageMenu';
import { WilayaSelect } from '@/components/app/WilayaSelect';
import { UserAvatar } from '@/components/app/UserAvatar';
import { LoaderCircle, Moon, Sun, TriangleAlert, IdCard, ShieldCheck } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { toast } from 'sonner';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06L5.84 9.9C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

export function AuthScreen() {
  const { t } = useLang();
  const { theme, setTheme } = useTheme();
  const setUser = useApp((s) => s.setUser);
  const setScreen = useApp((s) => s.setScreen);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // login state
  const [lemail, setLemail] = useState('');
  const [lpass, setLpass] = useState('');
  // register state
  const [rname, setRname] = useState('');
  const [remail, setRemail] = useState('');
  const [rphone, setRphone] = useState('');
  const [rwilaya, setRwilaya] = useState('');
  const [rgender, setRgender] = useState<'male' | 'female' | ''>('');
  const [rage, setRage] = useState('');
  const [ravatar, setRavatar] = useState<CompressedImage | null>(null);
  // blood group is mandatory for every account (emergency medical info)
  const [rblood, setRblood] = useState<BloodType | ''>('');
  // seekers must attach the front side of their ID card for verification
  const [ridCard, setRidCard] = useState<CompressedImage | null>(null);
  const [rpass, setRpass] = useState('');
  const [rpass2, setRpass2] = useState('');
  const [role, setRole] = useState<'owner' | 'seeker'>('seeker');

  // social
  const [providers, setProviders] = useState<{ google: boolean }>({ google: false });

  const errText = (e: unknown): string => {
    if (e instanceof ApiError) {
      if (e.code === 'NETWORK') return t('networkError');
      return e.message;
    }
    return t('error');
  };

  async function afterAuth(data: { token: string; user: User }) {
    setToken(data.token);
    setUser(data.user);
    if (data.user.profileComplete === false) {
      // the mandatory completion modal is rendered globally in the shell
      setScreen('main');
      return;
    }
    if (data.user.role === 'seeker' && data.user.interests.length === 0) {
      setScreen('interests');
    } else {
      setScreen('main');
    }
  }

  // handle OAuth return links (#social-token / #social-error)
  useEffect(() => {
    api.get<{ google: boolean }>('/auth/providers').then(setProviders).catch(() => {});
  }, []);

  // runs on mount AND whenever the hash changes (OAuth redirect back into the SPA)
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      if (!hash) return;
      const social = /social-token=([^&]+)/.exec(hash);
      const socialErr = /social-error=([^&]+)/.exec(hash);
      if (social) {
        history.replaceState(null, '', window.location.pathname);
        setToken(decodeURIComponent(social[1]));
        api.get<User>('/me')
          .then((u) => afterAuth({ token: decodeURIComponent(social[1]), user: u }))
          .catch(() => setError(t('socialError')));
      } else if (socialErr) {
        history.replaceState(null, '', window.location.pathname);
        setError(t('socialError'));
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);

  }, []);

  async function login() {
    setError('');
    setLoading(true);
    try {
      const data = await api.post<{ token: string; user: User }>('/auth/login', { email: lemail.trim(), password: lpass });
      await afterAuth(data);
    } catch (e) {
      setError(errText(e));
    } finally {
      setLoading(false);
    }
  }

  async function register() {
    setError('');
    const ageNum = Number(rage);
    if (!rgender) { setError(t('required')); return; }
    if (!rblood) { setError(t('chooseBloodType')); return; }
    if (!ageNum || ageNum < 12 || ageNum > 100) { setError(t('required')); return; }
    if (rpass.length < 6) { setError(t('passwordTooShort')); return; }
    if (rpass !== rpass2) { setError(t('passwordMismatch')); return; }
    if (role === 'seeker' && !ridCard) { setError(t('idCardRequired')); return; }
    setLoading(true);
    try {
      const data = await api.post<{ token: string; user: User }>('/auth/register', {
        name: rname.trim(),
        email: remail.trim(),
        phone: rphone.trim(),
        password: rpass,
        wilaya: rwilaya,
        gender: rgender,
        age: ageNum,
        bloodType: rblood,
        ...(ravatar ? { avatar: { mime: ravatar.mime, dataBase64: ravatar.dataBase64 } } : {}),
        ...(role === 'seeker' && ridCard ? { idCard: { mime: ridCard.mime, dataBase64: ridCard.dataBase64 } } : {}),
        role,
      });
      await afterAuth(data);
    } catch (e) {
      setError(errText(e));
    } finally {
      setLoading(false);
    }
  }

  function googleLogin() {
    if (!providers.google) { toast.error(t('googleNotConfigured'), { duration: 6000 }); return; }
    window.location.href = buildApiUrl('/auth/google');
  }

  return (
    <div className="min-h-dvh flex flex-col bg-gradient-to-b from-primary/8 via-background to-background">
      {/* language + theme controls (always visible on auth) */}
      <div className="w-full max-w-md mx-auto flex items-center justify-end gap-2 px-5 pt-4">
        <LanguageMenu />
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label={theme === 'dark' ? t('lightMode') : t('darkMode')}
          className="h-9 w-9 rounded-xl border bg-card flex items-center justify-center hover:bg-muted active:scale-95 transition-all"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>

      <div className="flex-1 flex flex-col justify-center max-w-md w-full mx-auto px-5 py-6">
        {/* Brand */}
        <div className="flex flex-col items-center mb-6 animate-in fade-in slide-in-from-top-3 duration-700">
          <img src="/icons/icon-192.png" alt="" className="h-20 w-20 rounded-[1.75rem] shadow-lg shadow-primary/25 rotate-3" />
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-center">{t('appName')}</h1>
          <p className="text-sm text-muted-foreground mt-1 text-center">{t('appTagline')}</p>
        </div>

        <Tabs defaultValue="login" className="animate-in fade-in slide-in-from-bottom-3 duration-700">
          <TabsList className="grid grid-cols-2 w-full h-11 rounded-xl bg-muted/70 p-1">
            <TabsTrigger value="login" className="rounded-lg font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm">
              {t('login')}
            </TabsTrigger>
            <TabsTrigger value="register" className="rounded-lg font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm">
              {t('register')}
            </TabsTrigger>
          </TabsList>

          {/* Login */}
          <TabsContent value="login" className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="lemail">{t('email')}</Label>
              <Input id="lemail" type="email" inputMode="email" autoComplete="email" value={lemail} onChange={(e) => setLemail(e.target.value)} className="h-11 rounded-xl" placeholder="you@mail.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lpass">{t('password')}</Label>
              <Input id="lpass" type="password" autoComplete="current-password" value={lpass} onChange={(e) => setLpass(e.target.value)} className="h-11 rounded-xl" onKeyDown={(e) => e.key === 'Enter' && login()} />
            </div>
            {error && (
              <p className="text-sm text-destructive flex items-start gap-1.5">
                <TriangleAlert className="h-4 w-4 shrink-0 mt-0.5" /> <span className="break-words">{error}</span>
              </p>
            )}
            <Button onClick={login} disabled={loading || !lemail || !lpass} className="w-full h-12 rounded-xl text-base font-bold shadow-lg shadow-primary/20">
              {loading && <LoaderCircle className="h-5 w-5 animate-spin" />}
              {t('login')}
            </Button>
          </TabsContent>

          {/* Register */}
          <TabsContent value="register" className="mt-5 space-y-4">
            <p className="text-sm font-medium text-muted-foreground">{t('chooseRole')}</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole('owner')}
                className={`rounded-2xl border-2 p-3.5 text-start transition-all active:scale-[0.98] ${role === 'owner' ? 'border-primary bg-primary/8 shadow-md shadow-primary/10' : 'border-border bg-card hover:border-primary/40'}`}
              >
                <p className="font-bold text-sm">{t('roleOwner')}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-snug">{t('roleOwnerDesc')}</p>
              </button>
              <button
                type="button"
                onClick={() => setRole('seeker')}
                className={`rounded-2xl border-2 p-3.5 text-start transition-all active:scale-[0.98] ${role === 'seeker' ? 'border-primary bg-primary/8 shadow-md shadow-primary/10' : 'border-border bg-card hover:border-primary/40'}`}
              >
                <p className="font-bold text-sm">{t('roleSeeker')}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-snug">{t('roleSeekerDesc')}</p>
              </button>
            </div>

            {/* profile photo */}
            <div className="flex items-center gap-4">
              <label className="cursor-pointer relative shrink-0">
                <UserAvatar user={ravatar ? { _id: '', name: rname || '?', hasAvatar: false } : null} size="h-20 w-20" textClass="text-2xl" />
                {ravatar && (
                  <img src={`data:${ravatar.mime};base64,${ravatar.dataBase64}`} alt="" className="absolute inset-0 h-20 w-20 rounded-2xl object-cover" />
                )}
                <span className="absolute -bottom-1 -end-1 h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shadow">
                  +
                </span>
                <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.currentTarget.value = '';
                  if (!f) return;
                  try { setRavatar(await compressAvatar(f)); } catch { toast.error(t('error')); }
                }} />
              </label>
              <div>
                <p className="text-sm font-bold">{t('profilePhoto')}</p>
                <p className="text-xs text-muted-foreground">{ravatar ? t('changePhoto') : t('addPhoto')}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rname">{t('name')} *</Label>
              <Input id="rname" value={rname} onChange={(e) => setRname(e.target.value)} className="h-11 rounded-xl" autoComplete="name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="remail">{t('email')} *</Label>
                <Input id="remail" type="email" inputMode="email" value={remail} onChange={(e) => setRemail(e.target.value)} className="h-11 rounded-xl" autoComplete="email" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rphone">{t('phone')} *</Label>
                <Input id="rphone" type="tel" inputMode="tel" value={rphone} onChange={(e) => setRphone(e.target.value)} className="h-11 rounded-xl" placeholder="05XXXXXXXX" autoComplete="tel" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('gender')} *</Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['male', 'female'] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setRgender(g)}
                      className={`h-11 rounded-xl border-2 text-sm font-bold transition-all active:scale-95 ${rgender === g ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground'}`}
                    >
                      {t(g)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rage">{t('age')} *</Label>
                <Input id="rage" type="number" inputMode="numeric" min={12} max={100} value={rage} onChange={(e) => setRage(e.target.value)} placeholder={t('agePlaceholder')} className="h-11 rounded-xl" />
              </div>
            </div>

            {/* blood group — mandatory dropdown for every account, shown to the other party */}
            <div className="space-y-1.5">
              <Label htmlFor="rblood">{t('bloodType')} *</Label>
              <select
                id="rblood"
                value={rblood}
                onChange={(e) => setRblood(e.target.value as BloodType)}
                className="h-11 w-full rounded-xl border-2 bg-card px-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="" disabled>— {t('bloodType')} —</option>
                {BLOOD_TYPES.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground leading-snug">{t('bloodTypeHint')}</p>
            </div>

            <div className="space-y-1.5">
              <Label>{t('wilaya')}</Label>
              <WilayaSelect value={rwilaya} onChange={setRwilaya} />
            </div>

            {/* ID card — required for seekers, reviewed by the super admin then wiped */}
            {role === 'seeker' && (
              <div className="space-y-2 rounded-2xl border bg-card p-3.5 card-hover">
                <div className="flex items-center gap-2">
                  <IdCard className="h-4.5 w-4.5 text-primary" />
                  <p className="text-sm font-bold">{t('idCardUpload')} *</p>
                </div>
                {ridCard ? (
                  <div className="space-y-2">
                    <img src={`data:${ridCard.mime};base64,${ridCard.dataBase64}`} alt="" className="w-full max-h-44 object-contain rounded-xl border bg-muted/40" />
                    <button
                      type="button"
                      onClick={() => setRidCard(null)}
                      className="text-xs font-bold text-destructive hover:underline"
                    >
                      {t('deleteImages')}
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center gap-1.5 h-20 rounded-xl border-2 border-dashed border-muted-foreground/40 cursor-pointer hover:border-primary/60 hover:bg-primary/5 transition-colors text-sm font-semibold text-muted-foreground">
                    <IdCard className="h-5 w-5" /> {t('addImages')}
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={async (e) => {
                      const f = e.target.files?.[0];
                      e.currentTarget.value = '';
                      if (!f) return;
                      try { setRidCard(await compressIdCard(f)); } catch { toast.error(t('error')); }
                    }} />
                  </label>
                )}
                <p className="text-[11px] text-muted-foreground leading-snug flex items-start gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
                  <span>{t('idCardUploadHint')}</span>
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="rpass">{t('password')} *</Label>
                <Input id="rpass" type="password" value={rpass} onChange={(e) => setRpass(e.target.value)} className="h-11 rounded-xl" autoComplete="new-password" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rpass2">{t('confirmPassword')} *</Label>
                <Input id="rpass2" type="password" value={rpass2} onChange={(e) => setRpass2(e.target.value)} className="h-11 rounded-xl" autoComplete="new-password" />
              </div>
            </div>
            {error && (
              <p className="text-sm text-destructive flex items-start gap-1.5">
                <TriangleAlert className="h-4 w-4 shrink-0 mt-0.5" /> <span className="break-words">{error}</span>
              </p>
            )}
            <Button onClick={register} disabled={loading || !rname || !remail || !rphone || !rpass} className="w-full h-12 rounded-xl text-base font-bold shadow-lg shadow-primary/20">
              {loading && <LoaderCircle className="h-5 w-5 animate-spin" />}
              {t('register')}
            </Button>
          </TabsContent>
        </Tabs>

        {/* social auth */}
        <div className="mt-6 space-y-2.5 animate-in fade-in duration-700">
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-semibold">
            <span className="h-px bg-border flex-1" /> {t('orDivider')} <span className="h-px bg-border flex-1" />
          </div>
          <button
            onClick={googleLogin}
            className="w-full h-12 rounded-xl border bg-card flex items-center justify-center gap-2.5 font-bold text-sm hover:bg-muted active:scale-[0.98] transition-all shadow-sm"
          >
            <GoogleIcon /> {t('continueWithGoogle')}
          </button>
          <p className="text-xs text-muted-foreground text-center pt-1">{t('commissionNote')}</p>
          <p className="text-[11px] font-semibold text-muted-foreground/80 text-center pt-3">{t('madeBy')}</p>
        </div>
      </div>
    </div>
  );
}

// shared helper: absolute URL for the Google OAuth redirect
// (exported from api.ts as buildApiUrl)
