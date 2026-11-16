'use client';

import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import { LanguageProvider, useLang } from '@/lib/language-context';
import { useApp } from '@/store/app';
import { api, setToken } from '@/lib/api';
import { User } from '@/lib/types';
import { registerServiceWorker, ensurePushSubscribed } from '@/lib/push';
import { AuthScreen } from '@/components/app/screens/AuthScreen';
import { InterestsScreen } from '@/components/app/screens/InterestsScreen';
import { FeedScreen } from '@/components/app/screens/FeedScreen';
import { MyTasksScreen } from '@/components/app/screens/MyTasksScreen';
import { MyOffersScreen } from '@/components/app/screens/MyOffersScreen';
import { CreateOfferScreen } from '@/components/app/screens/CreateOfferScreen';
import { ContactScreen } from '@/components/app/screens/ContactScreen';
import { ProfileScreen } from '@/components/app/screens/ProfileScreen';
import { AdminScreen } from '@/components/app/screens/AdminScreen';
import { DuesScreen } from '@/components/app/screens/DuesScreen';
import { OfferDetailSheet } from '@/components/app/screens/OfferDetailSheet';
import { LiveOfferWatcher, LiveOfferModal } from '@/components/app/screens/LiveOfferModal';
import { CompleteProfileModal } from '@/components/app/screens/CompleteProfileModal';
import { BackToTop } from '@/components/app/BackToTop';
import { BottomNav, TopBar } from '@/components/app/chrome';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: true },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* v4.15 — light is the landing mode on first visit; next-themes keeps every
          explicit choice the user makes afterwards (per device + per account accent) */}
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
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
    let savedTab = sessionStorage.getItem('slekni.tab');
    // v4.15 — the notifications page became a header panel: don't restore it as a tab
    if (savedTab === 'notifications') savedTab = 'feed';
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
        // v4.15 — keep the background-push subscription alive on every start
        ensurePushSubscribed();
        if (u.role === 'seeker' && u.interests.length === 0 && u.profileComplete !== false) setScreen('interests');
        else if (savedScreen === 'main' || savedScreen === 'interests') setScreen(savedScreen);
        else setScreen('main');
        // v4.16 — cold start from a tapped phone notification: /?nav=dues&offer=…
        try {
          const params = new URLSearchParams(window.location.search);
          const nav = params.get('nav');
          const offerId = params.get('offer');
          if (nav || offerId) {
            routeNotificationNav(nav, Boolean(offerId), Boolean(u.isSuperAdmin));
            if (offerId) useApp.getState().openOfferDetail(offerId);
            // clean the URL so a reload does not re-trigger the routing
            window.history.replaceState({}, '', window.location.pathname);
          }
        } catch {}
      })
      .catch(() => {
        setToken(null);
        setUser(null);
        setScreen('auth');
      })
      .finally(() => setBooted(true));

  }, [setBooted, setUser, setScreen, setTab]);

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
  // v4.15 — "creating" moved to the shared store so overlays never stack
  const creating = useApp((s) => s.creating);
  const setCreating = useApp((s) => s.setCreating);

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
        ) : tab === 'profile' ? (
          <ProfileScreen />
        ) : tab === 'dues' && role === 'seeker' ? (
          // v4.15 — dedicated dues page, exclusive to executor accounts
          <DuesScreen />
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
      <BackToTop />
      <BottomNav onCreate={() => setCreating(true)} />
      <SwMessageBridge />
    </div>
  );
}

/** Service-worker messages → navigate to the exact page / open offers / rebuild the push subscription. */
function SwMessageBridge() {
  const openOfferDetail = useApp((s) => s.openOfferDetail);
  const isSuperAdmin = useApp((s) => Boolean(s.user?.isSuperAdmin));
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const data = e.data as { type?: string; offerId?: string; nav?: string } | null;
      // v4.16 — a tapped phone notification lands on its exact page
      if (data?.type === 'notificationclick') {
        routeNotificationNav(data.nav, Boolean(data.offerId), isSuperAdmin);
        if (data.offerId) openOfferDetail(data.offerId);
      }
      // v4.15 — the browser rotated the push subscription in the background:
      // rebuild it and re-upload it to the server (silent)
      if (data?.type === 'resubscribe-push') ensurePushSubscribed();
    };
    navigator.serviceWorker?.addEventListener('message', onMsg);
    return () => navigator.serviceWorker?.removeEventListener('message', onMsg);
  }, [openOfferDetail, isSuperAdmin]);

  // pending notifications + pages catch up the moment the device reconnects
  useEffect(() => {
    const onOnline = () => ensurePushSubscribed();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);

  return null;
}

/** v4.16 — shared deep-link routing (SW tap + cold-start ?nav= URL). */
function routeNotificationNav(nav: string | null | undefined, hasOffer: boolean, isSuperAdmin: boolean): void {
  const st = useApp.getState();
  switch (nav) {
    case 'dues': st.setTab('dues'); break;
    case 'admin-dues': st.setTab('admin'); st.setAdminTab('dues'); break;
    case 'admin-complaints': st.setTab('admin'); st.setAdminTab('complaints'); break;
    case 'id-review':
      if (isSuperAdmin) { st.setTab('admin'); st.setAdminTab('users'); }
      else st.setTab('profile');
      break;
    default: if (hasOffer) st.bumpFeed(); break;
  }
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

