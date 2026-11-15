import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "سلكني ونسلكك | Selekni w Nselkek",
  description:
    "منصة جزائرية تربط أصحاب المهام بمنفّذين موثوقين في 69 ولاية — بأجر عادل وثقة | Plateforme algérienne de tâches avec intervenants vérifiés",
  applicationName: "Selekni",
  authors: [{ name: "MADOUNINE Hacene" }],
  creator: "MADOUNINE Hacene",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Selekni",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png?v=3", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png?v=3", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png?v=3", sizes: "192x192" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#7C3AED" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1917" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        {/* v4.9 — apply the saved accent before first paint (no colour flash) */}
        <script
          dangerouslySetInnerHTML={{
            __html: "try{var a=localStorage.getItem('slekni.accent');if(a&&a!=='violet')document.documentElement.dataset.accent=a}catch(e){}",
          }}
        />
      </head>
      <body
        className={`${cairo.variable} font-sans antialiased bg-background text-foreground overflow-x-hidden`}
      >
        {children}
      </body>
    </html>
  );
}
