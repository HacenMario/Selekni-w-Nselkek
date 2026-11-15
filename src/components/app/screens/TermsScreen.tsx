'use client';

import { useLang } from '@/lib/language-context';
import { legalDoc } from '@/lib/legal';
import { ArrowRight, ShieldCheck } from 'lucide-react';

/**
 * v4.10 — "Terms of Use & Privacy" page: professional, fully translated legal
 * content, opened from the elegant card in "My account" (ProfileScreen).
 */
export function TermsScreen({ onClose }: { onClose?: () => void }) {
  const { t, lang } = useLang();
  const doc = legalDoc(lang);

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* header */}
      <div className="bg-gradient-to-br from-primary to-sky-600 text-primary-foreground px-4 pt-3 pb-6 rounded-b-3xl shrink-0">
        <div className="flex items-center gap-2">
          {onClose && (
            <button onClick={onClose} aria-label={t('close')} className="h-10 w-10 rounded-full bg-white/15 flex items-center justify-center active:scale-90 transition-transform">
              <ArrowRight className="h-5 w-5 rtl:rotate-180" />
            </button>
          )}
          <h1 className="text-lg font-extrabold">{doc.title}</h1>
        </div>
        <p className="text-sm opacity-90 mt-2 break-words">{doc.intro}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-24 max-w-lg w-full mx-auto">
        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> {doc.updated}
        </p>

        {doc.sections.map((s) => (
          <section key={s.h} className="rounded-2xl border bg-card p-4 space-y-2">
            <h2 className="font-bold text-sm text-primary break-words">{s.h}</h2>
            {s.p.map((para, i) => (
              <p key={i} className="text-sm text-muted-foreground leading-relaxed break-words">{para}</p>
            ))}
          </section>
        ))}

        {/* developer attribution */}
        <p className="text-center text-xs text-muted-foreground pt-2">{t('madeBy')}</p>
      </div>
    </div>
  );
}
