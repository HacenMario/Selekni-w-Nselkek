'use client';

import { Lang } from '@/lib/i18n';

/**
 * Official flags: Algeria uses the official flag file provided by the client
 * (public/flags/dz.webp). Every other country is a precise inline SVG —
 * official proportions (3:2) and colours. v4.9 adds tr/es/it/de/ru/zh.
 */

/** 5-pointed star polygon points (vertex up by default). */
function starPoints(cx: number, cy: number, outer: number, rotDeg = 0): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : outer * 0.382;
    const a = (Math.PI / 5) * i - Math.PI / 2 + (rotDeg * Math.PI) / 180;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}

export function Flag({ code, className = 'h-4 w-6' }: { code: Lang; className?: string }) {
  switch (code) {
    case 'tr': return <FlagTR className={className} />;
    case 'es': return <FlagES className={className} />;
    case 'it': return <FlagIT className={className} />;
    case 'de': return <FlagDE className={className} />;
    case 'ru': return <FlagRU className={className} />;
    case 'zh': return <FlagZH className={className} />;
    case 'fr': return <FlagFR className={className} />;
    case 'en': return <FlagGB className={className} />;
    default: return <FlagDZ className={className} />;
  }
}

export function FlagDZ({ className }: { className?: string }) {
  return (
    <img
      src="/flags/dz.webp"
      alt="علم الجزائر — Algeria"
      className={`${className} rounded-[2px] shadow-sm object-cover`}
      draggable={false}
    />
  );
}

export function FlagFR({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 30 20" className={`${className} rounded-[2px] shadow-sm`} aria-hidden="true">
      <rect width="10" height="20" fill="#002395" />
      <rect x="10" width="10" height="20" fill="#fff" />
      <rect x="20" width="10" height="20" fill="#ed2939" />
    </svg>
  );
}

export function FlagGB({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 30" className={`${className} rounded-[2px] shadow-sm`} aria-hidden="true">
      <clipPath id="gb-c">
        <rect width="60" height="30" />
      </clipPath>
      <g clipPath="url(#gb-c)">
        <rect width="60" height="30" fill="#012169" />
        <path d="M0,0 60,30 M60,0 0,30" stroke="#fff" strokeWidth="6" />
        <path d="M0,0 60,30 M60,0 0,30" stroke="#C8102E" strokeWidth="3.6" />
        <path d="M30,0 V30 M0,15 H60" stroke="#fff" strokeWidth="10" />
        <path d="M30,0 V30 M0,15 H60" stroke="#C8102E" strokeWidth="6" />
      </g>
    </svg>
  );
}

/** Türkiye — red field, white crescent and star (Law 947/1982 geometry). */
export function FlagTR({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 30 20" className={`${className} rounded-[2px] shadow-sm`} aria-hidden="true">
      <rect width="30" height="20" fill="#E30A17" />
      {/* crescent: white disc + red disc offset to the right */}
      <circle cx="10.75" cy="10" r="5" fill="#fff" />
      <circle cx="12.35" cy="10" r="4" fill="#E30A17" />
      {/* star, vertex pointing toward the hoist */}
      <polygon points={starPoints(17.75, 10, 2)} fill="#fff" transform="rotate(-90 17.75 10)" />
    </svg>
  );
}

/** España — red–yellow–red horizontal 1:2:1 (Constitution 1978). */
export function FlagES({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 30 20" className={`${className} rounded-[2px] shadow-sm`} aria-hidden="true">
      <rect width="30" height="20" fill="#AA151B" />
      <rect y="5" width="30" height="10" fill="#F1BF00" />
    </svg>
  );
}

/** Italia — vertical green–white–red thirds (Resolution 1/1946). */
export function FlagIT({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 30 20" className={`${className} rounded-[2px] shadow-sm`} aria-hidden="true">
      <rect width="10" height="20" fill="#009246" />
      <rect x="10" width="10" height="20" fill="#fff" />
      <rect x="20" width="10" height="20" fill="#CE2B37" />
    </svg>
  );
}

/** Deutschland — black–red–gold horizontal (Art. 22 Grundgesetz). */
export function FlagDE({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 30 20" className={`${className} rounded-[2px] shadow-sm`} aria-hidden="true">
      <rect width="30" height="20" fill="#000" />
      <rect y="6.67" width="30" height="6.67" fill="#DD0000" />
      <rect y="13.33" width="30" height="6.67" fill="#FFCE00" />
    </svg>
  );
}

/** Российская Федерация — white–blue–red horizontal (1192-FZ). */
export function FlagRU({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 30 20" className={`${className} rounded-[2px] shadow-sm`} aria-hidden="true">
      <rect width="30" height="20" fill="#fff" />
      <rect y="6.67" width="30" height="6.67" fill="#0039A6" />
      <rect y="13.33" width="30" height="6.67" fill="#D52B1E" />
    </svg>
  );
}

/** 中华人民共和国 — red field, one large star + four small stars arced toward it. */
export function FlagZH({ className }: { className?: string }) {
  // small stars each point one vertex toward the big star's centre (5,5)
  const smalls = [
    { x: 10.2, y: 2.6 },
    { x: 11.8, y: 5 },
    { x: 11.8, y: 7.9 },
    { x: 10.2, y: 10.3 },
  ].map((s) => {
    const deg = (Math.atan2(5 - s.y, 5 - s.x) * 180) / Math.PI + 90;
    return { ...s, rot: deg };
  });
  return (
    <svg viewBox="0 0 30 20" className={`${className} rounded-[2px] shadow-sm`} aria-hidden="true">
      <rect width="30" height="20" fill="#DE2910" />
      <polygon points={starPoints(5, 5, 3)} fill="#FFDE00" />
      {smalls.map((s, i) => (
        <polygon key={i} points={starPoints(s.x, s.y, 1, s.rot)} fill="#FFDE00" />
      ))}
    </svg>
  );
}
