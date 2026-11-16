'use client';

import { useLang } from '@/lib/language-context';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

/**
 * v4.15 — clearable fields: a discreet ✕ appears whenever a text field has
 * content, wiping it in one tap — no more select-all + delete dance on mobile.
 * Drop-in replacements for the shadcn Input/Textarea (same props).
 */
export function ClearInput({ value, className = '', ...props }: React.ComponentProps<'input'> & { value: string | number | readonly string[] | undefined }) {
  const { t } = useLang();
  const has = typeof value === 'string' ? value.length > 0 : value !== undefined && value !== null && String(value).length > 0;
  return (
    <span className="relative block w-full">
      <Input value={value} className={`${className} ${has ? 'pe-10' : ''}`} {...props} />
      {has && (
        <button
          type="button"
          tabIndex={-1}
          onClick={() => {
            const setter = props.onChange as ((e: { target: { value: string } }) => void) | undefined;
            setter?.({ target: { value: '' } });
          }}
          aria-label={t('clearField')}
          title={t('clearField')}
          className="absolute top-1/2 -translate-y-1/2 end-2.5 h-6 w-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground active:scale-90 transition-all"
        >
          <span className="text-xs font-bold">✕</span>
        </button>
      )}
    </span>
  );
}

export function ClearTextarea({ value, className = '', ...props }: React.ComponentProps<'textarea'> & { value: string | undefined }) {
  const { t } = useLang();
  const has = typeof value === 'string' && value.length > 0;
  return (
    <span className="relative block w-full">
      <Textarea value={value} className={`${className} ${has ? 'pe-10' : ''}`} {...props} />
      {has && (
        <button
          type="button"
          tabIndex={-1}
          onClick={() => {
            const setter = props.onChange as ((e: { target: { value: string } }) => void) | undefined;
            setter?.({ target: { value: '' } });
          }}
          aria-label={t('clearField')}
          title={t('clearField')}
          className="absolute top-2 end-2.5 h-6 w-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground active:scale-90 transition-all"
        >
          <span className="text-xs font-bold">✕</span>
        </button>
      )}
    </span>
  );
}
