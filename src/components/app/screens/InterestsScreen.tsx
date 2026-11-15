'use client';

import { useEffect, useState } from 'react';
import { useApp } from '@/store/app';
import { useLang } from '@/lib/language-context';
import { api } from '@/lib/api';
import { Settings, User } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CategoryChip, Spinner } from '@/components/app/ui-bits';
import { CheckCircle2, LoaderCircle, Wrench } from 'lucide-react';

export function InterestsScreen() {
  const { t, lang } = useLang();
  const user = useApp((s) => s.user);
  const setUser = useApp((s) => s.setUser);
  const setScreen = useApp((s) => s.setScreen);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [selected, setSelected] = useState<string[]>(user?.interests || []);
  const [skills, setSkills] = useState(user?.skills || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<Settings>('/settings').then(setSettings).catch(() => {});
  }, []);

  function toggle(key: string) {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  async function save() {
    setSaving(true);
    try {
      const updated = await api.patch<User>('/me', { interests: selected, skills: skills.trim() });
      setUser(updated);
      setScreen('main');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <div className="max-w-md w-full mx-auto px-5 py-8 flex-1 flex flex-col">
        <div className="animate-in fade-in slide-in-from-top-3 duration-500">
          <h1 className="text-xl font-extrabold">{t('interestsTitle')}</h1>
          <p className="text-sm text-muted-foreground mt-1.5">{t('interestsSubtitle')}</p>
        </div>

        {!settings ? (
          <Spinner />
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mt-6">
              {settings.categories.map((c) => {
                const active = selected.includes(c.key);
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => toggle(c.key)}
                    className={`inline-flex items-center gap-1.5 rounded-full border-2 px-3.5 py-2 text-sm font-semibold transition-all active:scale-95 ${
                      active
                        ? 'border-primary bg-primary text-primary-foreground shadow-md shadow-primary/25'
                        : 'border-border bg-card text-foreground hover:border-primary/50'
                    }`}
                  >
                    <CategoryChip cat={c} lang={lang} />
                    {active && <CheckCircle2 className="h-3.5 w-3.5" />}
                  </button>
                );
              })}
            </div>

            <div className="mt-7 space-y-2">
              <Label htmlFor="skills" className="text-sm font-semibold">{t('skillsTitle')}</Label>
              <p className="text-xs text-muted-foreground">{t('skillsSubtitle')}</p>
              <Textarea id="skills" value={skills} onChange={(e) => setSkills(e.target.value)} placeholder={t('skillsPlaceholder')} className="min-h-24 rounded-xl" maxLength={300} />
            </div>

            <div className="mt-auto pt-8 space-y-3 pb-4">
              <Button onClick={save} disabled={saving} className="w-full h-12 rounded-xl text-base font-bold shadow-lg shadow-primary/20">
                {saving && <LoaderCircle className="h-5 w-5 animate-spin" />}
                {t('continueBtn')}
              </Button>
              <Button variant="ghost" onClick={() => setScreen('main')} className="w-full h-11 rounded-xl">
                {t('skip')}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
