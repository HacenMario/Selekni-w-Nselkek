#!/usr/bin/env python3
"""Generate Selekni w Nselkek brand: logo.svg, PWA icons (via cairosvg) and alert sound (WAV)."""
import math
import os
import struct
import wave

OUT = '/home/z/my-project/public'

# ---------------------------------------------------------------- logo svg
# Squircle + white handshake (lucide path, ISC) on warm brand gradient.
LOGO = '''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#F59E0B"/>
      <stop offset="0.55" stop-color="#EA580C"/>
      <stop offset="1" stop-color="#C2410C"/>
    </linearGradient>
  </defs>
  <rect x="1" y="1" width="62" height="62" rx="17" fill="url(#bg)"/>
  <g transform="translate(8 8) scale(2)" fill="none" stroke="#FFFFFF" stroke-width="0.9"
     stroke-linecap="round" stroke-linejoin="round">
    <path d="m11 17 2 2a1 1 0 1 0 3-3"/>
    <path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"/>
    <path d="m21 3 1 11h-2"/>
    <path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3"/>
    <path d="M3 4h8"/>
  </g>
</svg>
'''

MASKABLE = '''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#F59E0B"/>
      <stop offset="0.55" stop-color="#EA580C"/>
      <stop offset="1" stop-color="#C2410C"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="64" height="64" fill="url(#bg)"/>
  <g transform="translate(12.8 12.8) scale(1.6)" fill="none" stroke="#FFFFFF" stroke-width="1.1"
     stroke-linecap="round" stroke-linejoin="round">
    <path d="m11 17 2 2a1 1 0 1 0 3-3"/>
    <path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"/>
    <path d="m21 3 1 11h-2"/>
    <path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3"/>
    <path d="M3 4h8"/>
  </g>
</svg>
'''

with open(f'{OUT}/logo.svg', 'w') as f:
    f.write(LOGO)
print('logo.svg written')

import cairosvg  # noqa: E402

jobs = [
    (f'{OUT}/icons/icon-192.png', 192, LOGO),
    (f'{OUT}/icons/icon-512.png', 512, LOGO),
    (f'{OUT}/icons/maskable-512.png', 512, MASKABLE),
    (f'{OUT}/icons/apple-touch-icon.png', 180, LOGO),
]
for path, size, svg in jobs:
    cairosvg.svg2png(bytestring=svg.encode(), write_to=path, output_width=size, output_height=size)
    print('saved', path, os.path.getsize(path), 'bytes')

cairosvg.svg2png(bytestring=LOGO.encode(), write_to='/tmp/_fav.png', output_width=64, output_height=64)
from PIL import Image  # noqa: E402
Image.open('/tmp/_fav.png').resize((48, 48), Image.LANCZOS).save(f'{OUT}/favicon-slekni.png')
print('favicon saved')

# ---------------------------------------------------------------- alert sound
# Two-tone friendly chime: E5 (659Hz) then A5 (880Hz), soft attack/decay.
SR = 22050
dur_note = 0.28
gap = 0.06
tail = 0.55
total = dur_note * 2 + gap + tail
n_total = int(SR * total)
samples = [0.0] * n_total


def add_note(freq, start, dur, amp=0.55):
    n0 = int(start * SR)
    n1 = min(n_total, int((start + dur) * SR))
    for i in range(n0, n1):
        t = (i - n0) / SR
        # envelope: quick attack, exponential decay
        env = min(1.0, t / 0.02) * math.exp(-3.2 * t)
        v = amp * env * (math.sin(2 * math.pi * freq * t) + 0.35 * math.sin(2 * math.pi * freq * 2 * t))
        samples[i] += v


add_note(659.25, 0.0, dur_note + 0.1)
add_note(880.0, dur_note + gap, dur_note + tail)

peak = max(abs(s) for s in samples) or 1.0
scale = 32767 * 0.85 / peak

with wave.open(f'{OUT}/sounds/new-offer.wav', 'wb') as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    frames = b''.join(struct.pack('<h', int(max(-1, min(1, s)) * scale)) for s in samples)
    w.writeframes(frames)
print('new-offer.wav saved', os.path.getsize(f'{OUT}/sounds/new-offer.wav'), 'bytes')
