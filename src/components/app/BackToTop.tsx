'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { useLang } from '@/lib/language-context';

/**
 * Elegant floating Back-to-Top button.
 * Appears while scrolling down, auto-hides after a few seconds, and comes
 * right back the moment you scroll up again.
 */
export function BackToTop() {
  const { t } = useLang();
  const [visible, setVisible] = useState(false);
  const lastY = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const goingUp = y < lastY.current;
      lastY.current = y;

      if (y > 320) {
        setVisible(true);
        if (timer.current) clearTimeout(timer.current);
        // auto-hide a few seconds after it appears (unless scrolling up again)
        timer.current = setTimeout(() => setVisible(false), goingUp ? 6000 : 3500);
      } else {
        setVisible(false);
        if (timer.current) clearTimeout(timer.current);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label={t('backToTop')}
      title={t('backToTop')}
      className={`fixed bottom-24 end-4 z-[55] h-11 w-11 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/40 flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-90 ${
        visible ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'
      }`}
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
}
