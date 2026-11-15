#!/usr/bin/env python3
"""v4.9 UI layer:
- header: palette button opens the new appearance dialog (light/dark inside)
- language-context adopts the account's saved accent at login
- layout: early accent script (no flash), violet theme-color, CJK/Cyrillic font chain
- globals.css: 10 accent palettes (light+dark), color-mix accents, font fallback
- bottom nav: dedicated 'contact us' tab; profile contact card removed
- ContactScreen: optional onClose + phone input sent to the administration
- 14 new i18n keys (ar/fr/en) — the 6 new dictionaries get them in the merge step"""
import io

def patch(path, pairs):
    p = '/home/z/my-project/' + path
    s = io.open(p, encoding='utf-8').read()
    for old, new in pairs:
        if new in s:
            print('SKIP', path, old[:40].replace('\n', ' '))
            continue
        assert s.count(old) == 1, f"{path}: expected 1 of {old[:64]!r}, found {s.count(old)}"
        s = s.replace(old, new)
    io.open(p, 'w', encoding='utf-8').write(s)
    print('OK', path)

# ---------- 1) header: palette button -> appearance dialog ----------
patch('src/components/app/chrome.tsx', [
    ("import { Bell, Compass, CreditCard, LayoutDashboard, Moon, Sun, UserRound, Wrench } from 'lucide-react';\nimport { useTheme } from 'next-themes';",
     "import { Bell, Compass, CreditCard, Headset, LayoutDashboard, Palette, UserRound, Wrench } from 'lucide-react';"),
    ("""import { LanguageMenu } from '@/components/app/LanguageMenu';
import { FontSizeControl } from '@/components/app/FontSizeControl';""",
     """import { LanguageMenu } from '@/components/app/LanguageMenu';
import { FontSizeControl } from '@/components/app/FontSizeControl';
import { ThemeDialog } from '@/components/app/ThemeDialog';"""),
    ("""export function TopBar() {
  const { t } = useLang();
  const { theme, setTheme } = useTheme();
  const user = useApp((s) => s.user);
  const setTab = useApp((s) => s.setTab);
  const bumpFeed = useApp((s) => s.bumpFeed);""",
     """export function TopBar() {
  const { t } = useLang();
  const user = useApp((s) => s.user);
  const setTab = useApp((s) => s.setTab);
  const bumpFeed = useApp((s) => s.bumpFeed);
  const [showTheme, setShowTheme] = useState(false);"""),
    ("""        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label={theme === 'dark' ? t('lightMode') : t('darkMode')}
          className="h-9 w-9 rounded-xl border bg-card flex items-center justify-center hover:bg-muted active:scale-95 transition-all shrink-0"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>
    </header>
  );
}""",
     """        {/* v4.9 — appearance dialog: accent colour + light/dark in one window */}
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
    </header>
  );
}"""),
    # bottom nav: dedicated contact tab (5th item for every role)
    ("""  items.push({ key: 'notifications', label: t('notifications'), icon: Bell });
  items.push({ key: 'profile', label: t('profile'), icon: UserRound });""",
     """  items.push({ key: 'notifications', label: t('notifications'), icon: Bell });
  // v4.9 — "contact us" gets its own tab in the bottom navigation
  items.push({ key: 'contact', label: t('contactUs'), icon: Headset });
  items.push({ key: 'profile', label: t('profile'), icon: UserRound });"""),
])

# ---------- 2) language-context: adopt the account accent (DOM, no setState) ----------
patch('src/lib/language-context.tsx', [
    ("import { Lang, LANGS, isRtl, translate } from '@/lib/i18n';",
     "import { Lang, LANGS, isRtl, translate } from '@/lib/i18n';\nimport { applyAccent } from '@/lib/theme-accents';"),
    ("""  // adopt server prefs when the session loads — MUST run in an effect: calling the
  // external-store listeners during render triggered React's setstate-in-render error
  useEffect(() => {
    if (userLangs) adoptServerLanguages(userLangs);
  }, [userLangs]);""",
     """  // adopt server prefs when the session loads — MUST run in an effect: calling the
  // external-store listeners during render triggered React's setstate-in-render error
  useEffect(() => {
    if (userLangs) adoptServerLanguages(userLangs);
    // v4.9 — the account's saved interface colour follows the user onto every device
    const saved = user?.uiTheme;
    if (saved) applyAccent(saved);
  }, [userLangs, user?.uiTheme]);"""),
])

# ---------- 3) layout: early accent script + violet theme color ----------
patch('src/app/layout.tsx', [
    ("""  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#EA580C" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1917" },
  ],""",
     """  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#7C3AED" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1917" },
  ],"""),
    ("""    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body""",
     """    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        {/* v4.9 — apply the saved accent before first paint (no colour flash) */}
        <script
          dangerouslySetInnerHTML={{
            __html: "try{var a=localStorage.getItem('slekni.accent');if(a&&a!=='violet')document.documentElement.dataset.accent=a}catch(e){}",
          }}
        />
      </head>
      <body"""),
])

# ---------- 4) globals.css: 10 accent palettes + color-mix + font chain ----------
patch('src/app/globals.css', [
    ("  --font-sans: var(--font-cairo);",
     "  --font-sans: var(--font-cairo), 'Noto Sans', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', 'Segoe UI', sans-serif;"),
    ("""  ::selection {
    background: oklch(0.545 0.218 286 / 0.25);
  }""",
     """  ::selection {
    background: color-mix(in oklab, var(--primary) 25%, transparent);
  }"""),
    ("""::selection {
  background: oklch(0.545 0.218 286 / 0.18);
}""",
     """::selection {
  background: color-mix(in oklab, var(--primary) 18%, transparent);
}"""),
    ("""  .btn-glow:hover {
    box-shadow: 0 10px 26px -6px oklch(0.545 0.218 286 / 0.45);
    @apply -translate-y-px;
  }""",
     """  .btn-glow:hover {
    box-shadow: 0 10px 26px -6px color-mix(in oklab, var(--primary) 45%, transparent);
    @apply -translate-y-px;
  }"""),
    ("""html:not(.dark) input:focus-visible,
html:not(.dark) textarea:focus-visible {
  box-shadow: 0 0 0 3px oklch(0.545 0.218 286 / 0.14);
}""",
     """html:not(.dark) input:focus-visible,
html:not(.dark) textarea:focus-visible {
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--primary) 14%, transparent);
}"""),
    ("""@layer components {
  .card-hover:hover {
    box-shadow:
      0 1px 2px oklch(0.22 0.03 280 / 0.07),
      0 16px 36px -12px oklch(0.545 0.218 286 / 0.3);
  }""",
     """@layer components {
  .card-hover:hover {
    box-shadow:
      0 1px 2px oklch(0.22 0.03 280 / 0.07),
      0 16px 36px -12px color-mix(in oklab, var(--primary) 30%, transparent);
  }"""),
    ("""/* light-mode inputs & buttons feel more tactile */""",
     """/* ── v4.9: 10 user-selectable accent palettes (ThemeDialog) — light + dark ── */
html[data-accent='indigo'] { --primary: oklch(0.52 0.21 280); --primary-deep: oklch(0.42 0.2 285); --ring: oklch(0.52 0.21 280); }
html[data-accent='blue'] { --primary: oklch(0.55 0.19 255); --primary-deep: oklch(0.45 0.18 258); --ring: oklch(0.55 0.19 255); }
html[data-accent='cyan'] { --primary: oklch(0.6 0.14 220); --primary-deep: oklch(0.48 0.13 225); --ring: oklch(0.6 0.14 220); }
html[data-accent='teal'] { --primary: oklch(0.6 0.13 190); --primary-deep: oklch(0.48 0.12 192); --ring: oklch(0.6 0.13 190); }
html[data-accent='emerald'] { --primary: oklch(0.58 0.16 155); --primary-deep: oklch(0.46 0.15 158); --ring: oklch(0.58 0.16 155); }
html[data-accent='amber'] { --primary: oklch(0.62 0.16 70); --primary-deep: oklch(0.5 0.15 62); --ring: oklch(0.62 0.16 70); }
html[data-accent='orange'] { --primary: oklch(0.62 0.19 50); --primary-deep: oklch(0.5 0.18 45); --ring: oklch(0.62 0.19 50); }
html[data-accent='rose'] { --primary: oklch(0.58 0.2 15); --primary-deep: oklch(0.47 0.19 12); --ring: oklch(0.58 0.2 15); }
html[data-accent='pink'] { --primary: oklch(0.58 0.21 340); --primary-deep: oklch(0.47 0.2 345); --ring: oklch(0.58 0.21 340); }
.dark[data-accent='violet'] { --primary: oklch(0.74 0.13 295); --primary-deep: oklch(0.36 0.1 298); --ring: oklch(0.74 0.13 295); }
.dark[data-accent='indigo'] { --primary: oklch(0.74 0.14 280); --primary-deep: oklch(0.35 0.09 285); --ring: oklch(0.74 0.14 280); }
.dark[data-accent='blue'] { --primary: oklch(0.72 0.14 255); --primary-deep: oklch(0.32 0.08 258); --ring: oklch(0.72 0.14 255); }
.dark[data-accent='cyan'] { --primary: oklch(0.76 0.12 220); --primary-deep: oklch(0.34 0.07 225); --ring: oklch(0.76 0.12 220); }
.dark[data-accent='teal'] { --primary: oklch(0.74 0.12 190); --primary-deep: oklch(0.33 0.07 192); --ring: oklch(0.74 0.12 190); }
.dark[data-accent='emerald'] { --primary: oklch(0.72 0.14 155); --primary-deep: oklch(0.32 0.08 158); --ring: oklch(0.72 0.14 155); }
.dark[data-accent='amber'] { --primary: oklch(0.78 0.14 75); --primary-deep: oklch(0.36 0.08 65); --ring: oklch(0.78 0.14 75); }
.dark[data-accent='orange'] { --primary: oklch(0.75 0.15 55); --primary-deep: oklch(0.35 0.09 48); --ring: oklch(0.75 0.15 55); }
.dark[data-accent='rose'] { --primary: oklch(0.72 0.16 15); --primary-deep: oklch(0.34 0.09 12); --ring: oklch(0.72 0.16 15); }
.dark[data-accent='pink'] { --primary: oklch(0.72 0.17 340); --primary-deep: oklch(0.34 0.09 345); --ring: oklch(0.72 0.17 340); }

/* light-mode inputs & buttons feel more tactile */"""),
])

# ---------- 5) App.tsx: contact renders as its own tab ----------
patch('src/components/app/App.tsx', [
    ("""        ) : tab === 'notifications' ? (""",
     """        ) : tab === 'contact' ? (
          <ContactScreen onClose={() => setTab('profile')} />
        ) : tab === 'notifications' ? ("""),
])

# ---------- 6) ProfileScreen: contact card removed (it is a bottom-nav tab now) ----------
patch('src/components/app/screens/ProfileScreen.tsx', [
    ("""      {/* v4.6 — contact us: admin-managed info + suggestion/report form */}
      <SectionCard icon={Mail} title={t('contactUs')} action={
        <Button variant="ghost" size="sm" onClick={() => setShowContact(true)} className="text-primary font-bold">
          {t('contactSend')}
        </Button>
      }>
        <p className="text-sm text-muted-foreground break-words">{t('contactIntro')}</p>
      </SectionCard>

""",
     """      {/* v4.9 — "contact us" moved to its own bottom-nav tab */}

"""),
])

# ---------- 7) ContactScreen: optional onClose + phone field ----------
patch('src/components/app/screens/ContactScreen.tsx', [
    ("""/** v4.6 — professional "contact us" page: admin-managed contact info + suggestion/report form. */
export function ContactScreen({ onClose }: { onClose: () => void }) {""",
     """/** v4.6 — professional "contact us" page: admin-managed contact info + suggestion/report form.
 *  v4.9 — its own bottom-nav tab (onClose returns to the previous tab) + a callback
 *  phone number so the administration can reach the sender. */
export function ContactScreen({ onClose }: { onClose?: () => void }) {"""),
    ("""  const [kind, setKind] = useState<'suggestion' | 'report' | 'complaint'>('suggestion');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);""",
     """  const [kind, setKind] = useState<'suggestion' | 'report' | 'complaint'>('suggestion');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);"""),
    ("""      await api.post('/complaints/contact', { kind, subject: subject.trim(), message: message.trim() });
      toast.success(t('contactSent'));
      setSubject('');
      setMessage('');
      onClose();""",
     """      await api.post('/complaints/contact', {
        kind,
        subject: subject.trim(),
        message: message.trim(),
        ...(phone.trim().length >= 6 ? { phone: phone.trim() } : {}),
      });
      toast.success(t('contactSent'));
      setSubject('');
      setMessage('');
      setPhone('');
      onClose?.();"""),
    ("""          <div className="space-y-1.5">
            <Label>{t('contactSubject')} *</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} className="h-11 rounded-xl" />
          </div>""",
     """          <div className="space-y-1.5">
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
          </div>"""),
])

# ---------- 8) chrome.tsx needs useState import ----------
patch('src/components/app/chrome.tsx', [
    ("'use client';\n\nimport { Bell, Compass, CreditCard, Headset, LayoutDashboard, Palette, UserRound, Wrench } from 'lucide-react';",
     "'use client';\n\nimport { useState } from 'react';\nimport { Bell, Compass, CreditCard, Headset, LayoutDashboard, Palette, UserRound, Wrench } from 'lucide-react';"),
])

# ---------- 9) 14 new i18n keys (ar/fr/en) — new dictionaries carry them too ----------
patch('src/lib/i18n.ts', [
    ("  broadcastAllLangsHint: 'اكتب العنوان والنص في اللغات الثلاث — كل مستخدم يقرأ الإعلان بلغته المختارة',\n};",
     """  broadcastAllLangsHint: 'اكتب العنوان والنص في اللغات الثلاث — كل مستخدم يقرأ الإعلان بلغته المختارة',
  // ── v4.9: appearance dialog + contact phone + category fallback ──
  themeAccent: 'لون الواجهة',
  themeHint: 'اختر اللون الذي يناسبك ووضع العرض — يُحفظ المظهر في حسابك ويُطبَّق على كل أجهزتك',
  accentViolet: 'بنفسجي',
  accentIndigo: 'نيلي',
  accentBlue: 'أزرق',
  accentCyan: 'سماوي',
  accentTeal: 'تركوازي',
  accentEmerald: 'زمرد',
  accentAmber: 'كهرمان',
  accentOrange: 'برتقالي',
  accentRose: 'وردي أحمر',
  accentPink: 'وردي',
  contactPhoneHint: 'رقم تتركه للإدارة للتواصل معك بخصوص رسالتك (اختياري — لكنه يسرّع المعالجة)',
  categoryFallbackHint: 'اللغات الإضافية تعرض التسمية الإنجليزية تلقائياً إن لم تُدخل ترجمتها',
};"""),
    ("""  broadcastAllLangsHint: 'Rédigez le titre et le texte dans les trois langues — chaque utilisateur lit l\\'annonce dans la sienne',
};""",
     """  broadcastAllLangsHint: 'Rédigez le titre et le texte dans les trois langues — chaque utilisateur lit l\\'annonce dans la sienne',
  // ── v4.9: dialogue d'apparence + téléphone contact + repli des catégories ──
  themeAccent: 'Couleur de l\\'interface',
  themeHint: 'Choisissez la couleur et le mode d\\'affichage — enregistrés dans votre compte, appliqués sur tous vos appareils',
  accentViolet: 'Violet',
  accentIndigo: 'Indigo',
  accentBlue: 'Bleu',
  accentCyan: 'Cyan',
  accentTeal: 'Turquoise',
  accentEmerald: 'Émeraude',
  accentAmber: 'Ambre',
  accentOrange: 'Orange',
  accentRose: 'Rose foncé',
  accentPink: 'Rose',
  contactPhoneHint: 'Numéro laissé à l\\'administration pour vous joindre au sujet de votre message (facultatif — mais accélère le traitement)',
  categoryFallbackHint: 'Les langues supplémentaires affichent automatiquement le libellé anglais si aucune traduction n\\'est saisie',
};"""),
    ("""  broadcastAllLangsHint: 'Write the title and body in all three languages — every user reads the announcement in their own',
};""",
     """  broadcastAllLangsHint: 'Write the title and body in all three languages — every user reads the announcement in their own',
  // ── v4.9: appearance dialog + contact phone + category fallback ──
  themeAccent: 'Interface colour',
  themeHint: 'Pick your colour and display mode — saved to your account and applied on all your devices',
  accentViolet: 'Violet',
  accentIndigo: 'Indigo',
  accentBlue: 'Blue',
  accentCyan: 'Cyan',
  accentTeal: 'Teal',
  accentEmerald: 'Emerald',
  accentAmber: 'Amber',
  accentOrange: 'Orange',
  accentRose: 'Rose red',
  accentPink: 'Pink',
  contactPhoneHint: 'A number the administration can use to reach you about your message (optional — but it speeds things up)',
  categoryFallbackHint: 'Additional languages automatically show the English label when no translation is provided',
};"""),
])
print('V4.9 UI PATCHES DONE')
