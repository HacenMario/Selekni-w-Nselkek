'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useLang } from '@/lib/language-context';
import { imageUrl } from '@/lib/api';
import { OfferImageMeta } from '@/lib/types';

/**
 * Horizontally snappable gallery: smooth touch swipe on phones (always), arrow
 * buttons on desktop. Clicking an image opens a fullscreen lightbox that shows
 * the whole picture without any distortion (object-contain) — swipeable too.
 */
export function ImageGallery({ offerId, images, alt }: { offerId: string; images: OfferImageMeta[]; alt: string }) {
  const { t } = useLang();
  const trackRef = useRef<HTMLDivElement>(null);
  const [lightbox, setLightbox] = useState<number | null>(null);

  const scrollBy = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  const onKey = useCallback((e: KeyboardEvent) => {
    if (lightbox === null) return;
    if (e.key === 'Escape') setLightbox(null);
    if (e.key === 'ArrowRight') setLightbox((i) => (i === null ? null : (i + 1) % images.length));
    if (e.key === 'ArrowLeft') setLightbox((i) => (i === null ? null : (i - 1 + images.length) % images.length));
  }, [lightbox, images.length]);

  useEffect(() => {
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onKey]);

  // lock the page behind the lightbox, restore exactly afterwards
  useEffect(() => {
    if (lightbox === null) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [lightbox]);

  if (images.length === 0) return null;

  return (
    <>
      <div className="relative group" data-testid="image-gallery">
        <div
          ref={trackRef}
          className="flex gap-2 overflow-x-auto no-scrollbar snap-x snap-proximity pb-1"
          style={{ touchAction: 'pan-x pan-y', WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain' }}
        >
          {images.map((img, i) => (
            <button
              key={img._id}
              type="button"
              onClick={() => setLightbox(i)}
              className="shrink-0 snap-start relative rounded-2xl overflow-hidden border bg-muted active:scale-[0.99] transition-transform"
              aria-label={`${alt} — ${i + 1}/${images.length}`}
            >
              <img
                src={imageUrl(offerId, img._id)}
                alt={`${alt} ${i + 1}`}
                loading="lazy"
                className="h-44 w-64 max-w-full object-cover pointer-events-none"
                draggable={false}
              />
              <span className="absolute bottom-1.5 end-1.5 text-[10px] font-bold bg-black/55 text-white rounded-full px-2 py-0.5">
                {i + 1}/{images.length}
              </span>
            </button>
          ))}
        </div>

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => scrollBy(-1)}
              aria-label={t('back')}
              className="hidden sm:flex absolute top-1/2 -translate-y-1/2 start-1.5 h-9 w-9 rounded-full bg-black/55 text-white items-center justify-center hover:bg-black/75 active:scale-90 transition-all shadow-md"
            >
              <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
            </button>
            <button
              type="button"
              onClick={() => scrollBy(1)}
              aria-label={t('continueBtn')}
              className="hidden sm:flex absolute top-1/2 -translate-y-1/2 end-1.5 h-9 w-9 rounded-full bg-black/55 text-white items-center justify-center hover:bg-black/75 active:scale-90 transition-all shadow-md"
            >
              <ChevronRight className="h-5 w-5 rtl:rotate-180" />
            </button>
          </>
        )}
      </div>

      {lightbox !== null && createPortal(
        <Lightbox
          offerId={offerId}
          images={images}
          index={lightbox}
          alt={alt}
          onClose={() => setLightbox(null)}
          onNav={(i) => setLightbox(((i % images.length) + images.length) % images.length)}
        />,
        document.body
      )}
    </>
  );
}

function Lightbox({
  offerId,
  images,
  index,
  alt,
  onClose,
  onNav,
}: {
  offerId: string;
  images: OfferImageMeta[];
  index: number;
  alt: string;
  onClose: () => void;
  onNav: (i: number) => void;
}) {
  const { t } = useLang();
  const touch = useRef<{ x: number; y: number } | null>(null);

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      onTouchStart={(e) => {
        const tt = e.touches[0];
        touch.current = { x: tt.clientX, y: tt.clientY };
      }}
      onTouchEnd={(e) => {
        if (!touch.current || images.length < 2) return;
        const tt = e.changedTouches[0];
        const dx = tt.clientX - touch.current.x;
        const dy = tt.clientY - touch.current.y;
        touch.current = null;
        if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) {
          onNav(index + (dx < 0 ? 1 : -1)); // swipe left → next
        }
      }}
    >
      <button
        onClick={onClose}
        aria-label={t('close')}
        className="absolute top-4 end-4 h-11 w-11 rounded-xl border border-white/20 bg-white/10 text-white flex items-center justify-center hover:bg-white/25 hover:rotate-90 active:scale-90 transition-all duration-200 z-10"
      >
        <X className="h-5 w-5" strokeWidth={2.4} />
      </button>
      <img
        src={imageUrl(offerId, images[index]._id)}
        alt={alt}
        className="max-w-full max-h-[86dvh] object-contain select-none pointer-events-none"
        draggable={false}
      />
      {images.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); onNav(index - 1); }}
            aria-label={t('back')}
            className="absolute top-1/2 -translate-y-1/2 start-3 h-12 w-12 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/25 active:scale-90 transition-all"
          >
            <ChevronLeft className="h-6 w-6 rtl:rotate-180" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onNav(index + 1); }}
            aria-label={t('continueBtn')}
            className="absolute top-1/2 -translate-y-1/2 end-3 h-12 w-12 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/25 active:scale-90 transition-all"
          >
            <ChevronRight className="h-6 w-6 rtl:rotate-180" />
          </button>
          <p className="absolute bottom-5 text-white/80 text-sm font-semibold tabular-nums">
            {index + 1} / {images.length}
          </p>
        </>
      )}
    </div>
  );
}
