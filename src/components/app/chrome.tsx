'use client';

import { useState } from 'react';
import { Bell, Briefcase, Compass, HandCoins, Headset, LayoutDashboard, ListChecks, Palette, UserRound } from 'lucide-react';
import { useApp, Tab } from '@/store/app';
import { useLang } from '@/lib/language-context';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AppNotification, Paged } from '@/lib/types';
import { LanguageMenu } from '@/components/app/LanguageMenu';
import { FontSizeControl } from '@/components/app/FontSizeControl';
import { ThemeDialog } from '@/components/app/ThemeDialog';
import { NotificationsPanel } from '@/components/app/screens/NotificationsScreen';

export function TopBar() {
  const { t } = useLang();
  const user = useApp((s) => s.user);
  const setTab = useApp((s) => s.setTab);
  const back = useApp((s) => s.back);
  const tabHistory = useApp((s) => s.tabHistory);
  const bumpFeed = useApp((s) => s.bumpFeed);
  const notifPanelOpen = useApp((s) => s.notifPanelOpen);
  const setNotifPanel = useApp((s) => s.setNotifPanel);
  const [showTheme, setShowTheme] = useState(false);

  // unread badge for the header bell (the panel invalidates it on actions)
  const { data } = useQuery({
    queryKey: ['notifications-unread'],
    queryFn: () => api.get<Paged<AppNotification>>('/notifications', { limit: 1 }),
    enabled: !!user,
    refetchInterval: 15_000,
  });
  const unread = data?.unreadCount || 0;
  const canGoBack = tabHistory.length > 0;

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md">
      <div className="max-w-lg mx-auto flex items-center gap-2 px-2.5 h-14">
        {/* v4.15 — elegant back arrow once there is in-app history, otherwise the logo returns home */}
        {canGoBack ? (
          <button
            onClick={back}
            aria-label={t('back')}
            title={t('back')}
            className="h-9 w-9 rounded-xl border bg-card flex items-center justify-center hover:bg-muted active:scale-90 transition-all shrink-0"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="rtl:rotate-180">
              <path d="M19 12H5" />
              <path d="m12 19-7-7 7-7" />
            </svg>
          </button>
        ) : (
          <button
            onClick={() => { setTab('profile'); bumpFeed(); }}
            aria-label={t('profile')}
            title={t('profile')}
            className="h-9 w-9 rounded-xl overflow-hidden shadow-md shadow-primary/20 shrink-0 hover:scale-105 active:scale-95 transition-transform"
          >
            <img src="/icons/icon-192.png?v=4" alt={t('appName')} className="h-9 w-9 object-cover" draggable={false} />
          </button>
        )}
        <button
          onClick={() => { setTab('profile'); bumpFeed(); }}
          className="min-w-0 flex-1 text-start"
          aria-label={t('appName')}
        >
          <p className="font-extrabold text-[15px] leading-tight break-words">{t('appName')}</p>
          <p className="text-[11px] text-muted-foreground leading-tight break-words">
            {user?.role === 'owner' ? t('roleOwner') : user?.isSuperAdmin ? t('roleAdmin') : t('roleSeeker')}
          </p>
        </button>

        {/* v4.15 — the bell lives in the header: taps open the notifications panel */}
        <button
          onClick={() => setNotifPanel(true)}
          aria-label={t('notifications')}
          title={t('notifications')}
          className="relative h-9 w-9 rounded-xl border bg-card flex items-center justify-center hover:bg-muted active:scale-90 transition-all shrink-0"
        >
          <Bell className="h-4 w-4 text-foreground" />
          {unread > 0 && (
            <span className="absolute -top-1 -end-1 min-w-4.5 h-4.5 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center shadow-md">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>

        {/* A− / A+ site-wide text size */}
        <FontSizeControl />

        {/* language dropdown with official flags + On/Off switches */}
        <LanguageMenu />

        {/* v4.9 — appearance dialog: accent colour + light/dark in one window */}
        <button
          onClick={() => setShowTheme(true)}
          aria-label={t('theme')}
          title={t('theme')}
          className="h-9 w-9 rounded-xl border bg-card flex items-center justify-center hover:bg-muted active:scale-95 transition-all shrink-0"
        >
          <Palette className="h-4 w-4 text-primary" />
        </button>
      </div>
      {showTheme && <ThemeDialog open={showTheme} onOpenChange={setShowTheme} />}
      {/* v4.15 — notifications panel (bottom sheet) instead of the old page */}
      <NotificationsPanel open={notifPanelOpen} onOpenChange={setNotifPanel} />
    </header>
  );
}

/**
 * v4.15 — bottom navigation, ordered by account type:
 *  - "المهمة" first, "اتصل بنا" always last;
 *  - the notifications page left the bar (the header bell replaced it);
 *  - executors get their dedicated dues page in the bar; clients never see it.
 */
export function BottomNav({ onCreate }: { onCreate?: () => void }) {
  const { t } = useLang();
  const user = useApp((s) => s.user);
  const tab = useApp((s) => s.tab);
  const setTab = useApp((s) => s.setTab);

  if (!user) return null;

  const items: { key: Tab; label: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }> }[] = [];

  if (user.isSuperAdmin) {
    items.push({ key: 'admin', label: t('admin'), icon: LayoutDashboard });
  }
  if (user.role === 'owner') {
    // client account: offers first, contact last
    items.push({ key: 'offers', label: t('myOffers'), icon: Briefcase });
    items.push({ key: 'profile', label: t('profile'), icon: UserRound });
  } else {
    // executor account: the task feed first, then my tasks, dues, account
    items.push({ key: 'feed', label: t('feed'), icon: Compass });
    items.push({ key: 'tasks', label: t('tasksLabel'), icon: ListChecks });
    // v4.15 — dues are exclusive to executor accounts, as a dedicated page
    items.push({ key: 'dues', label: t('duesTitle'), icon: HandCoins });
    items.push({ key: 'profile', label: t('profile'), icon: UserRound });
  }
  // v4.9 — "contact us" always closes the navigation
  items.push({ key: 'contact', label: t('contactUs'), icon: Headset });

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 border-t bg-background/92 backdrop-blur-md"
      style={{ paddingBottom: 'max(0.25rem, env(safe-area-inset-bottom))', bottom: 0 }}
      aria-label="Main navigation"
    >
      <div className="max-w-lg mx-auto flex items-stretch justify-around h-16">
        {items.map(({ key, label, icon: Icon }, idx) => {
          const active = tab === key;
          return (
            <button
              key={key + idx}
              onClick={() => setTab(key)}
              aria-current={active ? 'page' : undefined}
              className={`relative flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 break-words active:scale-95 transition-transform ${active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <div className={`h-7 w-12 rounded-lg flex items-center justify-center transition-colors ${active ? 'bg-primary/12' : ''}`}>
                <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.8} />
              </div>
              <span className="text-[10px] font-semibold text-center leading-tight">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
