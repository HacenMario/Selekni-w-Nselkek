'use client';

import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import { LanguageProvider, useLang } from '@/lib/language-context';
import { useApp } from '@/store/app';
import { api, setToken } from '@/lib/api';
import { User, Paged, AppNotification } from '@/lib/types';
import { registerServiceWorker } from '@/lib/push';
import { AuthScreen } from '@/components/app/screens/AuthScreen';
import { InterestsScreen } from '@/components/app/screens/InterestsScreen';
import { FeedScreen } from '@/components/app/screens/FeedScreen';
import { MyTasksScreen } from '@/components/app/screens/MyTasksScreen';
import { MyOffersScreen } from '@/components/app/screens/MyOffersScreen';
import { CreateOfferScreen } from '@/components/app/screens/CreateOfferScreen';
import { NotificationsScreen } from '@/components/app/screens/NotificationsScreen';
import { ContactScreen } from '@/components/app/screens/ContactScreen';
import { ProfileScreen } from '@/components/app/screens/ProfileScreen';
import { AdminScreen } from '@/components/app/screens/AdminScreen';
import { SubscriptionScreen } from '@/components/app/screens/SubscriptionScreen';
import { OfferDetailSheet } from '@/components/app/screens/OfferDetailSheet';
import { LiveOfferWatcher, LiveOfferModal } from '@/components/app/screens/LiveOfferModal';
import { CompleteProfileModal } from '@/components/app/screens/CompleteProfileModal';
import { PromoBubble } from '@/components/app/PromoBubble';
import { BackToTop } from '@/components/app/BackToTop';
import { BottomNav, TopBar } from '@/components/app/chrome';
import { useQuery } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: true },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <LanguageProvider>
          <Boot />
          <Toaster position="top-center" richColors closeButton />
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function Boot() {
  const { booted, setBooted, setUser, setScreen, setTab, screen, tab } = useApp();

  useEffect(() => {
    registerServiceWorker();
    // reload keeps the user exactly where they were
    const savedScreen = sessionStorage.getItem('slekni.screen');
    const savedTab = sessionStorage.getItem('slekni.tab');
    if (savedTab) setTab(savedTab as never);
    const token = localStorage.getItem('slekni.token');
    if (!token) {
      setUser(null);
      setScreen('auth');
      setBooted(true);
      return;
    }
    api
      .get<User>('/me')
      .then((u) => {
        setUser(u);
        if (u.role === 'seeker' && u.interests.length === 0 && u.profileComplete !== false) setScreen('interests');
        else if (savedScreen === 'main' || savedScreen === 'interests') setScreen(savedScreen);
        else setScreen('main');
      })
      .catch(() => {
        setToken(null);
        setUser(null);
        setScreen('auth');
      })
      .finally(() => setBooted(true));
     
  }, [setBooted, setUser, setScreen]);

  // persist current location so a reload stays on the same page
  useEffect(() => {
    try {
      sessionStorage.setItem('slekni.screen', screen);
      sessionStorage.setItem('slekni.tab', tab);
    } catch {}
  }, [screen, tab]);

  if (!booted || screen === 'splash') return <BrandedSplash />;

  if (screen === 'auth') return <AuthScreen />;
  if (screen === 'interests') return <InterestsScreen />;

  return <MainShell />;
}

/** Skeleton loading branded with the logo + app name. */
export function BrandedSplash() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-gradient-to-b from-primary/10 via-background to-background gap-6 px-8">
      <img src="/icons/icon-192.png" alt="" className="h-24 w-24 rounded-[1.75rem] shadow-xl shadow-primary/30 animate-bounce-sm" />
      <div className="text-center">
        <AppTitle />
        <div className="mt-5 w-56 max-w-full space-y-2.5" aria-hidden="true">
          <div className="h-2.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full w-1/2 rounded-full bg-primary/40 animate-shimmer" />
          </div>
          <div className="h-2.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full w-3/4 rounded-full bg-primary/25 animate-shimmer" style={{ animationDelay: '0.15s' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function AppTitle() {
  const { lang } = useLang();
  return (
    <h1 className="text-2xl font-extrabold tracking-tight mt-2">
      {lang === 'ar' ? 'سلكني ونسلكك' : 'Selekni w Nselkek'}
    </h1>
  );
}

function MainShell() {
  const user = useApp((s) => s.user);
  const tab = useApp((s) => s.tab);
  const setTab = useApp((s) => s.setTab);
  const detailOfferId = useApp((s) => s.detailOfferId);
  const [creating, setCreating] = useState(false);

  if (!user) return null;

  const role = user.role;

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <TopBar />
      <main className="flex-1 flex flex-col min-h-0 relative w-full max-w-lg mx-auto">
        {tab === 'admin' && user.isSuperAdmin ? (
          <AdminScreen />
        ) : tab === 'contact' ? (
          <ContactScreen onClose={() => setTab('profile')} />
        ) : tab === 'notifications' ? (
          <NotificationsScreen />
        ) : tab === 'profile' ? (
          <ProfileScreen />
        ) : tab === 'subscription' && role === 'owner' ? (
          <SubscriptionScreen />
        ) : role === 'owner' ? (
          <MyOffersScreen onCreate={() => setCreating(true)} />
        ) : tab === 'tasks' ? (
          <MyTasksScreen />
        ) : (
          <FeedScreen />
        )}
      </main>
      {creating && <CreateOverlay onClose={() => setCreating(false)} />}
      <OfferDetailSheet />
      <LiveOfferWatcher />
      <LiveOfferModal />
      <CompleteProfileModal />
      <PromoBubble />
      <BackToTop />
      <BottomNav onCreate={() => setCreating(true)} />
      <SwMessageBridge />
    </div>
  );
}

/** Service-worker notification taps → open the related offer inside the app. */
function SwMessageBridge() {
  const openOfferDetail = useApp((s) => s.openOfferDetail);
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const data = e.data as { type?: string; offerId?: string } | null;
      if (data?.type === 'notificationclick' && data.offerId) openOfferDetail(data.offerId);
    };
    navigator.serviceWorker?.addEventListener('message', onMsg);
    return () => navigator.serviceWorker?.removeEventListener('message', onMsg);
  }, [openOfferDetail]);
  return null;
}

function CreateOverlay({ onClose }: { onClose: () => void }) {
  const { t } = useLang();
  return (
    <div className="fixed inset-0 z-[70] bg-background flex flex-col">
      <div className="flex items-center gap-2 px-3 py-3 border-b shrink-0">
        <button
          onClick={onClose}
          aria-label={t('close')}
          className="h-10 w-10 rounded-xl border bg-card flex items-center justify-center hover:bg-muted active:scale-90 transition-all"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
        <h2 className="font-bold">{t('createOffer')}</h2>
      </div>
      <CreateOfferScreen onDone={onClose} />
    </div>
  );
}

