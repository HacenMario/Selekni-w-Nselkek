'use client';

import { useLang } from '@/lib/language-context';
import { WILAYAS, wilayaLabel } from '@/lib/wilayas';
import { ChevronDown, MapPin } from 'lucide-react';

/**
 * Wilaya picker built on a native <select> — guaranteed to open on every
 * device (the Radix popover-based list failed to open in some cases).
 */
export function WilayaSelect({
  value,
  onChange,
  id,
  className = 'h-11 rounded-xl',
  allowEmpty = true,
  emptyLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  id?: string;
  className?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
}) {
  const { t, lang } = useLang();
  return (
    <div className={`relative ${className.includes('w-full') ? 'w-full' : ''}`}>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        dir="auto"
        className={`${className} w-full appearance-none border bg-card px-9 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/40 text-foreground`}
        aria-label={t('wilaya')}
      >
        {allowEmpty && <option value="">{emptyLabel ?? `— ${t('wilaya')} —`}</option>}
        {WILAYAS.map((w) => {
          const v = `${w.code} - ${w.fr}`;
          return (
            <option key={v} value={v}>
              {wilayaLabel(v, lang)}
            </option>
          );
        })}
      </select>
      <MapPin className="h-4 w-4 text-muted-foreground pointer-events-none absolute start-3 top-1/2 -translate-y-1/2" />
      <ChevronDown className="h-4 w-4 text-muted-foreground pointer-events-none absolute end-3 top-1/2 -translate-y-1/2" />
    </div>
  );
}
