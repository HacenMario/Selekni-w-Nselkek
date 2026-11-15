'use client';

import { useSyncExternalStore } from 'react';
import { getFontIndex, fontUp, fontDown, subscribeFont, FONT_STEPS } from '@/lib/font-scale';
import { useLang } from '@/lib/language-context';
import { AArrowDown, AArrowUp } from 'lucide-react';

/** Elegant A− / A+ text-size control for the header. */
export function FontSizeControl() {
  const { t } = useLang();
  const index = useSyncExternalStore(subscribeFont, getFontIndex, () => 1);
  const canDown = index > 0;
  const canUp = index < FONT_STEPS.length - 1;

  return (
    <div
      className="h-9 rounded-xl border bg-card flex items-center shrink-0 overflow-hidden"
      role="group"
      aria-label={t('fontLarger')}
    >
      <button
        onClick={fontDown}
        disabled={!canDown}
        aria-label={t('fontSmaller')}
        title={t('fontSmaller')}
        className="h-full px-2 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-muted active:scale-90 transition-all disabled:opacity-30"
      >
        <AArrowDown className="h-4 w-4" />
      </button>
      <span className="w-px self-stretch bg-border" aria-hidden="true" />
      <button
        onClick={fontUp}
        disabled={!canUp}
        aria-label={t('fontLarger')}
        title={t('fontLarger')}
        className="h-full px-2 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-muted active:scale-90 transition-all disabled:opacity-30"
      >
        <AArrowUp className="h-4 w-4" />
      </button>
    </div>
  );
}
