'use client';

/**
 * Alert sound for the live-offer popup.
 * Tries the bundled chime (public/sounds/new-offer.wav) and falls back to a
 * WebAudio double-beep so it still rings if the file fails to load.
 */
let audioEl: HTMLAudioElement | null = null;

function ensureEl(): HTMLAudioElement {
  if (!audioEl) {
    audioEl = new Audio('/sounds/new-offer.wav');
    audioEl.preload = 'auto';
  }
  return audioEl;
}

function webAudioChime(): void {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    const play = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(0.28, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.05);
    };
    play(659.25, 0, 0.35); // E5
    play(880, 0.34, 0.6);  // A5
    setTimeout(() => ctx.close().catch(() => {}), 1300);
  } catch {
    /* silence is acceptable */
  }
}

/** Play the new-offer alert. Must be triggered after a user gesture on iOS for full volume. */
export function playAlertSound(): void {
  try {
    const el = ensureEl();
    el.currentTime = 0;
    el.volume = 0.9;
    el.play().catch(() => webAudioChime());
  } catch {
    webAudioChime();
  }
}
