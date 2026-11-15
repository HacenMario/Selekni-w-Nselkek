'use client';

import { Badge } from '@/components/ui/badge';
import { Lang, categoryLabel } from '@/lib/i18n';
import { useLang } from '@/lib/language-context';
import {
  Truck, Sparkles, Hammer, Package, Leaf, Paintbrush, Wrench, Ellipsis, HelpCircle,
  Droplets, Zap, ChefHat, Scissors, Baby, GraduationCap, Monitor, Heart, Camera, PartyPopper,
} from 'lucide-react';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  truck: Truck,
  sparkles: Sparkles,
  hammer: Hammer,
  package: Package,
  leaf: Leaf,
  paintbrush: Paintbrush,
  wrench: Wrench,
  ellipsis: Ellipsis,
  droplets: Droplets,
  zap: Zap,
  'chef-hat': ChefHat,
  scissors: Scissors,
  baby: Baby,
  'graduation-cap': GraduationCap,
  monitor: Monitor,
  heart: Heart,
  camera: Camera,
  'party-popper': PartyPopper,
};

export function CategoryIcon({ icon, className = 'h-5 w-5' }: { icon: string; className?: string }) {
  const C = ICONS[icon] || HelpCircle;
  return <C className={className} />;
}

export function CategoryChip({ cat, lang }: { cat: { key: string; label: { ar: string; fr: string; en: string; tr?: string; es?: string; it?: string; de?: string; ru?: string; zh?: string }; icon: string }; lang: Lang }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <CategoryIcon icon={cat.icon} className="h-3.5 w-3.5" />
      <span>{categoryLabel(cat, lang)}</span>
    </span>
  );
}

const STATUS_STYLES: Record<string, { className: string; key: string }> = {
  open: { className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800', key: 'statusOpen' },
  assigned: { className: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800', key: 'statusAssigned' },
  awaiting_confirmation: { className: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border-sky-200 dark:border-sky-800', key: 'statusAwaiting' },
  done: { className: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border-teal-200 dark:border-teal-800', key: 'statusDone' },
  cancelled: { className: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border-rose-200 dark:border-rose-800', key: 'statusCancelled' },
};

type TFn = (key: string, params?: Record<string, string | number>) => string;

export function StatusBadge({ status, t }: { status: string; t: TFn }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.open;
  return (
    <Badge variant="outline" className={`${s.className} border text-[11px] font-semibold px-2 py-0.5 rounded-full`}>
      {t(s.key)}
    </Badge>
  );
}

export function AmountPill({ amount, className = '' }: { amount: number; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full bg-primary/10 text-primary font-bold text-sm px-2.5 py-1 ${className}`}>
      {amount.toLocaleString('fr-DZ')} <span className="text-[10px] font-semibold ms-1">DA</span>
    </span>
  );
}

export function timeAgo(dateStr: string, t: TFn): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return t('justNow');
  if (m < 60) return t('ago', { time: `${m} ${t('minutes')}` });
  const h = Math.floor(m / 60);
  if (h < 24) return t('ago', { time: `${h} ${t('hours')}` });
  const d = Math.floor(h / 24);
  return t('ago', { time: `${d} ${t('daysWord')}` });
}

export function EmptyState({ icon: Icon, title, hint }: { icon: React.ComponentType<{ className?: string }>; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
        <Icon className="h-8 w-8 text-primary" />
      </div>
      <p className="font-semibold text-foreground">{title}</p>
      {hint && <p className="text-sm text-muted-foreground mt-1.5 max-w-xs">{hint}</p>}
    </div>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center py-10 ${className}`}>
      <div className="h-7 w-7 rounded-full border-[3px] border-primary/25 border-t-primary animate-spin" />
    </div>
  );
}

/* ---------- Gamification levels (v4) ---------- */
export interface Level {
  icon: string;
  key: string;
  next: number | null;
  at: number;
}

/** Level from completed tasks: 🥉 1+ · 🥈 5+ · 🥇 15+ · 💎 30+. */
export function levelInfo(tasks: number | undefined): Level | null {
  const n = tasks || 0;
  if (n >= 30) return { icon: '💎', key: 'levelDiamond', next: null, at: 30 };
  if (n >= 15) return { icon: '🥇', key: 'levelGold', next: 30, at: 15 };
  if (n >= 5) return { icon: '🥈', key: 'levelSilver', next: 15, at: 5 };
  if (n >= 1) return { icon: '🥉', key: 'levelBronze', next: 5, at: 1 };
  return null;
}

/** Small level badge for cards (counterpart name rows). */
export function LevelBadge({ tasks, className = '' }: { tasks: number | undefined; className?: string }) {
  const { t } = useLang();
  const lvl = levelInfo(tasks);
  if (!lvl) return null;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700 px-2 py-0.5 text-[10px] font-extrabold shrink-0 ${className}`}>
      <span aria-hidden="true">{lvl.icon}</span> {t(lvl.key)}
    </span>
  );
}

/** Shared pagination control: prev/next + "page x of y", RTL-aware, touch friendly. */
export function Pager({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  const { t } = useLang();
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 pt-2">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="h-10 px-4 rounded-xl border bg-card font-bold text-sm disabled:opacity-40 active:scale-95 transition-all hover:bg-muted"
      >
        ← {t('prevPage')}
      </button>
      <span className="text-sm font-bold text-muted-foreground tabular-nums">{t('pageOf', { page, pages })}</span>
      <button
        type="button"
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
        className="h-10 px-4 rounded-xl border bg-card font-bold text-sm disabled:opacity-40 active:scale-95 transition-all hover:bg-muted"
      >
        {t('nextPage')} →
      </button>
    </div>
  );
}
