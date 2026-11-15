'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { LoaderCircle, ShieldCheck, IdCard } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useApp } from '@/store/app';
import { useLang } from '@/lib/language-context';
import { compressAvatar, compressIdCard, CompressedImage } from '@/lib/image';
import { User, BLOOD_TYPES, BloodType } from '@/lib/types';
import { UserAvatar } from '@/components/app/UserAvatar';
import { WilayaSelect } from '@/components/app/WilayaSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Mandatory onboarding dialog for Google users: it cannot be
 * dismissed until every required field is filled, and it never appears again
 * once the account is complete (profileComplete = true).
 */
export function CompleteProfileModal() {
  const { t } = useLang();
  const user = useApp((s) => s.user);
  const setUser = useApp((s) => s.setUser);
  const [name, setName] = useState(user?.name === user?.email.split('@')[0] ? '' : user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [wilaya, setWilaya] = useState(user?.wilaya || '');
  const [gender, setGender] = useState<'male' | 'female' | ''>(user?.gender || '');
  const [age, setAge] = useState(user?.age ? String(user.age) : '');
  const [role, setRole] = useState<'owner' | 'seeker'>(user?.role || 'seeker');
  const [blood, setBlood] = useState<BloodType | ''>(user?.bloodType || '');
  const [avatar, setAvatar] = useState<CompressedImage | null>(null);
  // seeker verification: ID card required here too, same as password signup
  const [idCard, setIdCard] = useState<CompressedImage | null>(null);
  const [busy, setBusy] = useState(false);

  if (!user || user.profileComplete !== false || typeof document === 'undefined') return null;

  async function pickAvatar(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    try {
      setAvatar(await compressAvatar(f));
    } catch {
      toast.error(t('error'));
    }
  }

  async function pickIdCard(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    try {
      setIdCard(await compressIdCard(f));
    } catch {
      toast.error(t('error'));
    }
  }

  async function submit() {
    const ageNum = Number(age);
    if (!name.trim() || name.trim().length < 2) { toast.error(t('required')); return; }
    if (!phone.trim() || phone.trim().length < 6) { toast.error(t('required')); return; }
    if (!wilaya) { toast.error(t('required')); return; }
    if (!gender) { toast.error(t('required')); return; }
    if (!ageNum || ageNum < 12 || ageNum > 100) { toast.error(t('required')); return; }
    if (!blood) { toast.error(t('chooseBloodType')); return; }
    if (role === 'seeker' && !idCard) { toast.error(t('idCardRequired')); return; }
    setBusy(true);
    try {
      const updated = await api.patch<User>('/me', {
        name: name.trim(),
        phone: phone.trim(),
        wilaya,
        gender,
        age: ageNum,
        role,
        bloodType: blood,
        ...(avatar ? { avatar: { mime: avatar.mime, dataBase64: avatar.dataBase64 } } : {}),
        ...(role === 'seeker' && idCard ? { idCard: { mime: idCard.mime, dataBase64: idCard.dataBase64 } } : {}),
        profileComplete: true as const,
      });
      setUser(updated);
      toast.success(t('profileCompleted'));
    } catch (e) {
      const code = (e as { code?: string }).code;
      toast.error(code === 'PROFILE_INCOMPLETE' ? t('required') : t('error'));
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70" />
      <div className="relative w-full max-w-md max-h-[92dvh] rounded-3xl bg-background border shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-300">
        <div className="px-6 pt-6 pb-4 text-center shrink-0">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
            <ShieldCheck className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-xl font-extrabold">{t('completeProfileTitle')}</h2>
          <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{t('completeProfileDesc')}</p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-4 min-h-0">
          {/* photo */}
          <div className="flex items-center gap-4">
            <label className="cursor-pointer relative">
              <UserAvatar user={avatar ? { _id: '', name: name || '?', hasAvatar: false } : user} size="h-20 w-20" textClass="text-2xl" />
              {avatar && (
                <img src={`data:${avatar.mime};base64,${avatar.dataBase64}`} alt="" className="absolute inset-0 h-20 w-20 rounded-2xl object-cover" />
              )}
              <span className="absolute -bottom-1 -end-1 h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shadow">
                +
              </span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { pickAvatar(e.target.files); e.currentTarget.value = ''; }} />
            </label>
            <div>
              <p className="text-sm font-bold">{t('profilePhoto')}</p>
              <p className="text-xs text-muted-foreground">{avatar ? t('changePhoto') : t('addPhoto')}</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cp-name">{t('name')} *</Label>
            <Input id="cp-name" value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl" autoComplete="name" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp-phone">{t('phone')} *</Label>
            <Input id="cp-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05XXXXXXXX" className="h-11 rounded-xl" autoComplete="tel" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cp-gender">{t('gender')} *</Label>
              <div className="grid grid-cols-2 gap-1.5">
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
            <div className="space-y-1.5">
              <Label htmlFor="cp-age">{t('age')} *</Label>
              <Input id="cp-age" type="number" inputMode="numeric" min={12} max={100} value={age} onChange={(e) => setAge(e.target.value)} placeholder={t('agePlaceholder')} className="h-11 rounded-xl" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t('wilaya')} *</Label>
            <WilayaSelect value={wilaya} onChange={setWilaya} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('chooseRole')} *</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole('owner')}
                className={`rounded-2xl border-2 p-3 text-start transition-all active:scale-[0.98] ${role === 'owner' ? 'border-primary bg-primary/8' : 'border-border bg-card'}`}
              >
                <p className="font-bold text-sm">{t('roleOwner')}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{t('roleOwnerDesc')}</p>
              </button>
              <button
                type="button"
                onClick={() => setRole('seeker')}
                className={`rounded-2xl border-2 p-3 text-start transition-all active:scale-[0.98] ${role === 'seeker' ? 'border-primary bg-primary/8' : 'border-border bg-card'}`}
              >
                <p className="font-bold text-sm">{t('roleSeeker')}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{t('roleSeekerDesc')}</p>
              </button>
            </div>
          </div>

          {/* blood group — mandatory, shown to the other party */}
          <div className="space-y-1.5">
            <Label>{t('bloodType')} *</Label>
            <div className="grid grid-cols-4 gap-1.5">
              {BLOOD_TYPES.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBlood(b)}
                  className={`h-10 rounded-xl border-2 text-sm font-extrabold transition-all active:scale-95 ${blood === b ? 'border-destructive/70 bg-destructive/10 text-destructive' : 'border-border bg-card text-muted-foreground hover:border-destructive/30'}`}
                >
                  {b}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">{t('bloodTypeHint')}</p>
          </div>

          {/* ID card — required for taskers, reviewed by the super admin then wiped */}
          {role === 'seeker' && (
            <div className="space-y-2 rounded-2xl border bg-card p-3.5">
              <div className="flex items-center gap-2">
                <IdCard className="h-4.5 w-4.5 text-primary" />
                <p className="text-sm font-bold">{t('idCardUpload')} *</p>
              </div>
              {idCard ? (
                <img src={`data:${idCard.mime};base64,${idCard.dataBase64}`} alt="" className="w-full max-h-44 object-contain rounded-xl border bg-muted/40" />
              ) : (
                <label className="flex flex-col items-center justify-center gap-1.5 h-20 rounded-xl border-2 border-dashed border-muted-foreground/40 cursor-pointer hover:border-primary/60 hover:bg-primary/5 transition-colors text-sm font-semibold text-muted-foreground">
                  <IdCard className="h-5 w-5" /> {t('addImages')}
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { pickIdCard(e.target.files); e.currentTarget.value = ''; }} />
                </label>
              )}
              <p className="text-[11px] text-muted-foreground leading-snug">{t('idCardUploadHint')}</p>
            </div>
          )}
        </div>

        <div className="border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shrink-0">
          <Button onClick={submit} disabled={busy} className="w-full h-12 rounded-xl text-base font-extrabold shadow-lg shadow-primary/25">
            {busy && <LoaderCircle className="h-5 w-5 animate-spin" />}
            {t('done')}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
