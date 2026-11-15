#!/usr/bin/env python3
"""v4.8 visual overhaul — modern vivid light theme (indigo-violet + teal accent),
glassmorphism cards, animated gradient backdrop, 3D card depth, gradient CTAs."""
import io

P = '/home/z/my-project/src/app/globals.css'
s = io.open(P, encoding='utf-8').read()

def rep(old, new):
    global s
    if new in s:
        print('SKIP', old[:50].replace('\n', ' '))
        return
    assert s.count(old) == 1, f"expected 1 of {old[:70]!r}, found {s.count(old)}"
    s = s.replace(old, new)
    print('ok', old[:44].replace('\n', ' '))

# ---- 1) light palette: vivid modern indigo-violet, cool teal accent, glass cards ----
rep("""  --radius: 0.75rem;
  /* warm neutral + orange (work / energy) — v4.2: softer cream canvas, warmer borders */
  --background: oklch(0.977 0.007 82);
  --foreground: oklch(0.21 0.02 60);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.235 0.02 60);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.235 0.02 60);
  --primary: oklch(0.606 0.194 41);
  --primary-foreground: oklch(0.99 0.002 85);
  --secondary: oklch(0.955 0.008 80);
  --secondary-foreground: oklch(0.3 0.03 55);
  --muted: oklch(0.949 0.009 80);
  --muted-foreground: oklch(0.44 0.02 60);
  --accent: oklch(0.95 0.02 60);
  --accent-foreground: oklch(0.3 0.05 50);
  --destructive: oklch(0.577 0.245 27.3);
  --destructive-foreground: oklch(0.985 0 0);
  --border: oklch(0.902 0.014 78);
  --input: oklch(0.905 0.012 78);
  --ring: oklch(0.606 0.194 41);
  --chart-1: oklch(0.606 0.194 41);
  --chart-2: oklch(0.6 0.118 184.7);
  --chart-3: oklch(0.666 0.179 58.3);
  --chart-4: oklch(0.627 0.194 149.2);
  --chart-5: oklch(0.488 0.243 264.4);
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: oklch(0.606 0.194 41);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.97 0 0);
  --sidebar-accent-foreground: oklch(0.205 0 0);
  --sidebar-border: oklch(0.922 0 0);
  --sidebar-ring: oklch(0.708 0 0);""",
"""  --radius: 0.75rem;
  /* v4.8 — modern vivid light theme: indigo-violet primary + cool teal accent,
     glass cards over a soft animated gradient backdrop (eye-comfortable, high contrast) */
  --background: oklch(0.978 0.01 286);
  --foreground: oklch(0.225 0.028 278);
  --card: oklch(1 0 0 / 0.68);
  --card-foreground: oklch(0.24 0.028 278);
  --popover: oklch(0.995 0.004 286);
  --popover-foreground: oklch(0.24 0.028 278);
  --primary: oklch(0.545 0.218 286);
  --primary-deep: oklch(0.44 0.21 298);
  --primary-foreground: oklch(0.985 0.005 286);
  --secondary: oklch(0.938 0.024 200);
  --secondary-foreground: oklch(0.36 0.055 230);
  --muted: oklch(0.946 0.014 286);
  --muted-foreground: oklch(0.47 0.03 272);
  --accent: oklch(0.928 0.032 198);
  --accent-foreground: oklch(0.34 0.07 235);
  --destructive: oklch(0.577 0.245 27.3);
  --destructive-foreground: oklch(0.985 0 0);
  --border: oklch(0.902 0.022 286);
  --input: oklch(0.906 0.02 286);
  --ring: oklch(0.545 0.218 286);
  --chart-1: oklch(0.545 0.218 286);
  --chart-2: oklch(0.68 0.13 195);
  --chart-3: oklch(0.78 0.15 75);
  --chart-4: oklch(0.66 0.17 155);
  --chart-5: oklch(0.64 0.21 350);
  --sidebar: oklch(0.98 0.008 286);
  --sidebar-foreground: oklch(0.2 0.03 278);
  --sidebar-primary: oklch(0.545 0.218 286);
  --sidebar-primary-foreground: oklch(0.985 0.005 286);
  --sidebar-accent: oklch(0.945 0.02 286);
  --sidebar-accent-foreground: oklch(0.25 0.03 278);
  --sidebar-border: oklch(0.905 0.02 286);
  --sidebar-ring: oklch(0.545 0.218 286);""")

# ---- 2) dark: glass card + deeper gradient stop (rest of dark theme unchanged) ----
rep("""  --card: oklch(0.216 0.014 60);
  --card-foreground: oklch(0.955 0.006 80);""",
"""  --card: oklch(0.216 0.014 60 / 0.74);
  --card-foreground: oklch(0.955 0.006 80);""")
rep("""  --primary: oklch(0.803 0.114 82);
  --primary-foreground: oklch(0.226 0.03 70);""",
"""  --primary: oklch(0.803 0.114 82);
  --primary-deep: oklch(0.42 0.07 60);
  --primary-foreground: oklch(0.226 0.03 70);""")

# ---- 3) retire the hardcoded orange accents ----
rep("""  ::selection {
    background: oklch(0.606 0.194 41 / 0.25);
  }""",
"""  ::selection {
    background: oklch(0.545 0.218 286 / 0.25);
  }""")
rep("""::selection {
  background: oklch(0.606 0.194 41 / 0.18);
}""",
"""::selection {
  background: oklch(0.545 0.218 286 / 0.18);
}""")
rep("""  .btn-glow:hover {
    box-shadow: 0 10px 24px -6px oklch(0.606 0.194 41 / 0.35);
    @apply -translate-y-px;
  }""",
"""  .btn-glow:hover {
    box-shadow: 0 10px 26px -6px oklch(0.545 0.218 286 / 0.45);
    @apply -translate-y-px;
  }""")
rep("""html:not(.dark) input:focus-visible,
html:not(.dark) textarea:focus-visible {
  box-shadow: 0 0 0 3px oklch(0.606 0.194 41 / 0.12);
}""",
"""html:not(.dark) input:focus-visible,
html:not(.dark) textarea:focus-visible {
  box-shadow: 0 0 0 3px oklch(0.545 0.218 286 / 0.14);
}""")

# ---- 4) v4.8 block: animated gradient backdrop + glass + 3D depth ----
rep("""/* light-mode inputs & buttons feel more tactile */""",
"""/* ── v4.8: modern animated gradient backdrop (blobs drift slowly behind the glass) ── */
@keyframes blob-drift {
  0% { transform: translate3d(0, 0, 0) scale(1); }
  50% { transform: translate3d(2%, -2%, 0) scale(1.06); }
  100% { transform: translate3d(-1.5%, 1.5%, 0) scale(1); }
}
body::before {
  content: "";
  position: fixed;
  inset: -12%;
  z-index: -1;
  pointer-events: none;
  background:
    radial-gradient(42% 34% at 84% 4%, oklch(0.82 0.1 295 / 0.5), transparent 66%),
    radial-gradient(38% 30% at 2% 26%, oklch(0.86 0.085 200 / 0.44), transparent 66%),
    radial-gradient(46% 38% at 50% 110%, oklch(0.88 0.09 84 / 0.4), transparent 66%);
  animation: blob-drift 22s ease-in-out infinite alternate;
  will-change: transform;
}
.dark body::before {
  background:
    radial-gradient(42% 34% at 84% 4%, oklch(0.4 0.09 295 / 0.4), transparent 66%),
    radial-gradient(38% 30% at 2% 26%, oklch(0.42 0.07 200 / 0.32), transparent 66%),
    radial-gradient(46% 38% at 50% 110%, oklch(0.44 0.07 84 / 0.26), transparent 66%);
  animation-duration: 30s;
}
@media (prefers-reduced-motion: reduce) {
  body::before { animation: none; }
}

/* ── v4.8: glassmorphism — every card surface blurs the colorful backdrop ── */
.bg-card {
  backdrop-filter: blur(16px) saturate(1.55);
  -webkit-backdrop-filter: blur(16px) saturate(1.55);
}

/* ── v4.8: 3D depth on interactive cards — layered shadows + gentle lift ── */
@layer components {
  .card-hover:hover {
    box-shadow:
      0 1px 2px oklch(0.22 0.03 280 / 0.07),
      0 16px 36px -12px oklch(0.545 0.218 286 / 0.3);
  }
  .dark .card-hover:hover {
    box-shadow:
      0 1px 2px rgb(0 0 0 / 0.4),
      0 16px 36px -12px rgb(0 0 0 / 0.55);
  }
}

/* light-mode inputs & buttons feel more tactile */""")

io.open(P, 'w', encoding='utf-8').write(s)
print('GLOBALS.CSS OVERHAUL DONE')
