'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLang } from '@/lib/language-context';
import { subscribePush, isPushSubscribed } from '@/lib/push';
import { Bell, BellRing, CheckCircle2, ChevronDown, Download, HelpCircle, Monitor, Smartphone } from 'lucide-react';
import { toast } from 'sonner';

type InstallState = 'unknown' | 'installable' | 'installed' | 'manual';
type NotifState = 'unknown' | 'on' | 'off' | 'blocked' | 'unsupported';
type Platform = 'ios' | 'android' | 'desktop';

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in document)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

/**
 * Elegant install + notifications card (v4):
 *  - one-tap install when the browser supports it, with per-platform instructions otherwise
 *  - instant "installed" badge after confirming, instant "notifications enabled" badge after allowing
 */
export function PwaSetupCard() {
  const { t } = useLang();
  const [installState, setInstallState] = useState<InstallState>('unknown');
  const [notifState, setNotifState] = useState<NotifState>('unknown');
  const [promptEvt, setPromptEvt] = useState<{ prompt: () => Promise<void> } | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [busy, setBusy] = useState(false);
  const platform = useMemo(detectPlatform, []);

  useEffect(() => {
    // install state — badge appears instantly when the app runs standalone
    if (isStandalone()) setInstallState('installed');
    const onInstalled = () => setInstallState('installed');
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvt({ prompt: () => (e as Event & { prompt: () => Promise<void> }).prompt() });
      if (!isStandalone()) setInstallState('installable');
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    // notifications state
    if (typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window) {
      const perm = Notification.permission;
      if (perm === 'denied') setNotifState('blocked');
      else if (perm === 'granted') {
        isPushSubscribed().then((s) => setNotifState(s ? 'on' : 'off'));
      } else setNotifState('off');
    } else setNotifState('unsupported');
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function install() {
    if (promptEvt) {
      try {
        await promptEvt.prompt();
        // 'appinstalled' flips the badge; also re-check in case the event was missed
        setTimeout(() => { if (isStandalone()) setInstallState('installed'); }, 1200);
      } catch { /* user dismissed */ }
    } else {
      setShowHelp(true);
    }
  }

  async function enableNotifs() {
    setBusy(true);
    try {
      const r = await subscribePush();
      if (r === 'granted') {
        setNotifState('on');
        toast.success(t('pushEnabled'));
      } else if (r === 'denied') {
        setNotifState('blocked');
        toast.error(t('pushBlocked'));
      } else {
        setNotifState('unsupported');
        toast.error(t('pushUnsupported'));
      }
    } catch {
      toast.error(t('error'));
    } finally {
      setBusy(false);
    }
  }

  const installed = installState === 'installed';

  return (
    <div className="rounded-2xl bg-gradient-to-br from-violet-600 via-violet-500 to-indigo-500 text-white p-4 shadow-lg shadow-violet-500/25 space-y-3">
      <div className="flex items-center gap-2">
        <Smartphone className="h-5 w-5 shrink-0" />
        <h3 className="font-extrabold text-sm flex-1">{t('pwaTitle')}</h3>
        {installed && (
          <span className="inline-flex items-center gap-1 rounded-full bg-white/25 px-2.5 py-1 text-[11px] font-extrabold">
            <CheckCircle2 className="h-3.5 w-3.5" /> {t('pwaInstalledBadge')}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* install */}
        <button
          onClick={install}
          disabled={installed}
          className={`h-11 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 ${installed ? 'bg-white/20 cursor-default' : 'bg-white text-violet-700 hover:bg-violet-50 shadow'}`}
        >
          {installed ? <CheckCircle2 className="h-4 w-4" /> : <Download className="h-4 w-4" />}
          {installed ? t('pwaInstalledBadge') : t('installApp')}
        </button>

        {/* notifications */}
        <button
          onClick={notifState === 'on' ? undefined : enableNotifs}
          disabled={busy || notifState === 'on' || notifState === 'unsupported'}
          className={`h-11 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 border ${notifState === 'on' ? 'bg-emerald-400/95 text-emerald-950 border-emerald-200 cursor-default' : 'bg-white/15 border-white/40 hover:bg-white/25'}`}
        >
          {notifState === 'on' ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
          {notifState === 'on' ? t('pushOnBadge') : notifState === 'blocked' ? t('pushBlockedShort') : notifState === 'unsupported' ? t('pushUnsupportedShort') : t('enablePush')}
        </button>
      </div>

      {notifState === 'blocked' && (
        <p className="text-[11px] text-white/85 leading-relaxed break-words">{t('pushBlockedHelp')}</p>
      )}

      <button onClick={() => setShowHelp((v) => !v)} className="w-full flex items-center justify-center gap-1 text-[11px] font-bold text-white/85 hover:text-white transition-colors">
        <HelpCircle className="h-3.5 w-3.5" /> {t('howToInstall')}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showHelp ? 'rotate-180' : ''}`} />
      </button>

      {showHelp && (
        <div className="rounded-xl bg-white/12 border border-white/25 p-3 space-y-3 text-[12px] leading-relaxed animate-in fade-in slide-in-from-top-1">
          {/* every platform, detected one first — so any device can follow along */}
          {[...new Set<Platform>([platform, 'desktop', 'android', 'ios'])].map((p, idx) => (
            <div key={p} className={idx === 0 ? 'rounded-lg bg-white/15 border border-white/30 p-2.5' : ''}>
              <p className={`font-extrabold text-[11px] flex items-center gap-1 ${idx === 0 ? 'text-white' : 'text-white/90'}`}>
                {p === 'desktop' ? <Monitor className="h-3 w-3" /> : <Smartphone className="h-3 w-3" />}
                {t(p === 'desktop' ? 'installDesktopTitle' : p === 'android' ? 'installAndroidTitle' : 'installIosTitle')}
                {idx === 0 && <span className="rounded-full bg-white/30 px-1.5 py-0.5 text-[9px]">✓</span>}
              </p>
              <ol className="list-decimal ms-4 mt-1 space-y-0.5 text-white/85">
                {t(p === 'desktop' ? 'installDesktopSteps' : p === 'android' ? 'installAndroidSteps' : 'installIosSteps').split('|').map((s, i) => (
                  <li key={i} className="break-words">{s.trim()}</li>
                ))}
              </ol>
            </div>
          ))}
          <p className="text-white/75 break-words">{t('installNotifsHint')}</p>
        </div>
      )}
    </div>
  );
}
