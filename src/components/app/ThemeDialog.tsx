'use client';

import { useState } from 'react';
import { useTheme } from 'next-themes';
import { Check, Moon, Sun } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useLang } from '@/lib/language-context';
import { useApp } from '@/store/app';
import { api } from '@/lib/api';
import { ACCENTS, DEFAULT_ACCENT, applyAccent, currentAccent } from '@/lib/theme-accents';
import { cn } from '@/lib/utils';

/**
 * v4.9 — appearance dialog: the header palette button opens it. The user picks
 * the interface colour (10 vivid accents) and switches light/dark in the same
 * window. The accent is saved per account (user.uiTheme) + locally, so the
 * chosen look follows the user onto every device.
 */
export function ThemeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useLang();
  const { theme, setTheme } = useTheme();
  const user = useApp((s) => s.user);
  const [current, setCurrent] = useState<string>(() => currentAccent());

  function pick(key: string) {
    setCurrent(key);
    // violet is the default palette — applyAccent clears the data attribute for it
    applyAccent(key);
    // per-account persistence: every device adopts it at login (language-context effect)
    if (user) api.patch('/me', { uiTheme: key }).catch(() => {});
  }

  const modes = [
    { key: 'light', label: t('lightMode'), icon: Sun },
    { key: 'dark', label: t('darkMode'), icon: Moon },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('theme')}</DialogTitle>
          <DialogDescription>{t('themeHint')}</DialogDescription>
        </DialogHeader>

        {/* light / dark — inside the same window */}
        <div className="grid grid-cols-2 gap-2">
          {modes.map(({ key, label, icon: Icon }) => {
            const on = (theme ?? 'light') === key;
            return (
              <button
                key={key}
                onClick={() => setTheme(key)}
                aria-pressed={on}
                className={cn(
                  'flex items-center justify-center gap-2 h-11 rounded-xl border-2 font-bold text-sm transition-all active:scale-95',
                  on ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground hover:border-primary/40'
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            );
          })}
        </div>

        {/* the 10 accents */}
        <div className="grid grid-cols-5 gap-2 pt-1">
          {ACCENTS.map((a) => {
            const on = current === a.key;
            return (
              <button
                key={a.key}
                onClick={() => pick(a.key)}
                aria-pressed={on}
                aria-label={t(`accent${a.key.charAt(0).toUpperCase()}${a.key.slice(1)}`)}
                title={t(`accent${a.key.charAt(0).toUpperCase()}${a.key.slice(1)}`)}
                className="group flex flex-col items-center gap-1"
              >
                <span
                  className={cn(
                    'relative h-10 w-full rounded-xl transition-all active:scale-90',
                    on ? 'ring-2 ring-offset-2 ring-[var(--primary)] ring-offset-background scale-[1.04]' : 'hover:scale-105 opacity-85 group-hover:opacity-100'
                  )}
                  style={{ background: `linear-gradient(135deg, ${a.from}, ${a.to})` }}
                >
                  {on && (
                    <span className="absolute inset-0 grid place-items-center text-white">
                      <Check className="h-4 w-4 drop-shadow" />
                    </span>
                  )}
                </span>
                <span className={cn('text-[9px] font-semibold leading-tight text-center', on ? 'text-primary' : 'text-muted-foreground')}>
                  {t(`accent${a.key.charAt(0).toUpperCase()}${a.key.slice(1)}`)}
                </span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
