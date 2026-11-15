'use client';

import { useEffect, useRef, useState } from 'react';
import { useLang, LANGS } from '@/lib/language-context';
import { Flag } from '@/components/app/flags';
import { Switch } from '@/components/ui/switch';
import { Check, ChevronDown, Languages } from 'lucide-react';

/**
 * Elegant language button that opens a dropdown with the three languages —
 * each row shows its official flag, its name, a check for the active one and
 * an On/Off switch. Click a row to switch; the switch enables/disables it.
 */
export function LanguageMenu({ align = 'end' }: { align?: 'start' | 'end' }) {
  const { t, lang, setLang, enabledLangs, toggleEnabled } = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={t('languages')}
        aria-expanded={open}
        className={`h-9 rounded-xl border bg-card flex items-center gap-1.5 px-2.5 hover:bg-muted active:scale-95 transition-all shrink-0 ${open ? 'ring-2 ring-primary/40' : ''}`}
      >
        <Flag code={lang} className="h-4 w-6 rounded-[2px]" />
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute top-[calc(100%+6px)] ${align === 'end' ? 'end-0' : 'start-0'} z-[90] w-64 max-w-[calc(100vw-2rem)] rounded-2xl border bg-popover text-popover-foreground shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 zoom-in-95 duration-150`}
        >
          <div className="px-3.5 pt-3 pb-2 flex items-center gap-2 border-b bg-muted/50">
            <Languages className="h-4 w-4 text-primary" />
            <p className="text-xs font-bold text-muted-foreground">{t('languages')}</p>
          </div>
          <div className="p-1.5">
            {LANGS.map((l) => {
              const on = enabledLangs.includes(l.code);
              const active = lang === l.code;
              return (
                <div
                  key={l.code}
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => on && setLang(l.code)}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 cursor-pointer transition-colors ${
                    active ? 'bg-primary/10 border border-primary/30' : 'border border-transparent hover:bg-muted/70'
                  }`}
                >
                  <Flag code={l.code} className="h-5 w-8 rounded-[3px]" />
                  <span className={`flex-1 text-sm font-semibold ${active ? 'text-primary' : ''}`}>{l.name}</span>
                  {active && <Check className="h-4 w-4 text-primary shrink-0" />}
                  <span onClick={(e) => e.stopPropagation()}>
                    <Switch
                      checked={on}
                      onCheckedChange={() => toggleEnabled(l.code)}
                      aria-label={`${l.name} On/Off`}
                      className="shrink-0"
                    />
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
