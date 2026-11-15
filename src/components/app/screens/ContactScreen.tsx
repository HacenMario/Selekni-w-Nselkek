'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLang } from '@/lib/language-context';
import { api } from '@/lib/api';
import { Settings } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowRight, Instagram, Mail, MapPin, MessageSquarePlus, Phone, Send, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

/** v4.6 — professional "contact us" page: admin-managed contact info + suggestion/report form.
 *  v4.9 — its own bottom-nav tab (onClose returns to the previous tab) + a callback
 *  phone number so the administration can reach the sender. */
export function ContactScreen({ onClose }: { onClose?: () => void }) {
  const { t } = useLang();
  const [kind, setKind] = useState<'suggestion' | 'report' | 'complaint'>('suggestion');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<Settings>('/settings'),
    staleTime: 60_000,
  });
  const contact = settings?.contact;

  const info = [
    { icon: Phone, label: t('contactPhone'), value: contact?.phone, href: contact?.phone ? `tel:${contact.phone}` : undefined },
    { icon: Mail, label: t('contactEmail'), value: contact?.email, href: contact?.email ? `mailto:${contact.email}` : undefined },
    { icon: Instagram, label: t('contactInstagram'), value: contact?.instagram, href: contact?.instagram || undefined },
    { icon: MapPin, label: t('contactAddress'), value: contact?.address, href: undefined },
  ].filter((i) => i.value);

  async function send() {
    if (subject.trim().length < 3 || message.trim().length < 5) return;
    setSending(true);
    try {
      await api.post('/complaints/contact', {
        kind,
        subject: subject.trim(),
        message: message.trim(),
        ...(phone.trim().length >= 6 ? { phone: phone.trim() } : {}),
      });
      toast.success(t('contactSent'));
      setSubject('');
      setMessage('');
      setPhone('');
      onClose?.();
    } catch {
      toast.error(t('error'));
    } finally {
      setSending(false);
    }
  }

  const kinds = [
    { key: 'suggestion' as const, icon: MessageSquarePlus, label: t('kindSuggestion'), cls: 'border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300' },
    { key: 'report' as const, icon: ShieldAlert, label: t('kindReport'), cls: 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' },
    { key: 'complaint' as const, icon: Send, label: t('kindComplaint'), cls: 'border-destructive bg-destructive/10 text-destructive' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* header */}
      <div className="bg-gradient-to-br from-primary to-sky-600 text-primary-foreground px-4 pt-3 pb-6 rounded-b-3xl">
        <div className="flex items-center gap-2">
          <button onClick={onClose} aria-label={t('close')} className="h-10 w-10 rounded-full bg-white/15 flex items-center justify-center active:scale-90 transition-transform">
            <ArrowRight className="h-5 w-5 rtl:rotate-180" />
          </button>
          <h1 className="text-lg font-extrabold">{t('contactUs')}</h1>
        </div>
        <p className="text-sm opacity-90 mt-2 break-words">{t('contactIntro')}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-28 max-w-lg w-full mx-auto">
        {/* admin-managed contact info */}
        {info.length > 0 ? (
          <div className="rounded-2xl border bg-card p-4 space-y-3">
            <h2 className="font-bold text-sm">{t('contactInfo')}</h2>
            {info.map(({ icon: Icon, label, value, href }) => (
              <a key={label} href={href} className={`flex items-center gap-3 rounded-xl border bg-muted/30 p-3 ${href ? 'hover:border-primary/50 active:scale-[0.99] transition-all' : 'cursor-default'}`}>
                <span className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[11px] text-muted-foreground">{label}</span>
                  <span className="block text-sm font-bold break-all" dir="auto">{value}</span>
                </span>
              </a>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-2 break-words">{t('contactUnavailable')}</p>
        )}

        {/* message form */}
        <div className="rounded-2xl border bg-card p-4 space-y-3">
          <h2 className="font-bold text-sm">{t('contactMessage')}</h2>
          <div className="grid grid-cols-3 gap-2">
            {kinds.map(({ key, icon: Icon, label, cls }) => (
              <button
                key={key}
                type="button"
                onClick={() => setKind(key)}
                aria-pressed={kind === key}
                className={`flex flex-col items-center gap-1 rounded-xl border-2 p-2.5 text-[11px] font-bold transition-all active:scale-95 ${kind === key ? cls : 'border-border bg-card text-muted-foreground'}`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cphone">{t('phone')} — {t('contactUs')}</Label>
            <Input
              id="cphone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={20}
              inputMode="tel"
              dir="ltr"
              placeholder="05 55 00 00 00"
              className="h-11 rounded-xl"
            />
            <p className="text-[11px] text-muted-foreground leading-snug break-words">{t('contactPhoneHint')}</p>
          </div>
          <div className="space-y-1.5">
            <Label>{t('contactSubject')} *</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} className="h-11 rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label>{t('contactMessage')} *</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1500} className="min-h-28 rounded-xl text-sm" />
          </div>
          <Button onClick={send} disabled={sending || subject.trim().length < 3 || message.trim().length < 5} className="w-full h-11 rounded-xl font-bold">
            {sending ? <Send className="h-4 w-4 animate-pulse" /> : <Send className="h-4 w-4 me-1.5" />} {t('contactSend')}
          </Button>
          <p className="text-center text-[11px] font-semibold text-muted-foreground/80 pt-1">{t('madeBy')}</p>
        </div>
      </div>
    </div>
  );
}
