#!/usr/bin/env python3
"""Generate Slekni PWA icons: rounded handshake mark on orange gradient."""
import math
import os

try:
    from PIL import Image, ImageDraw
except ImportError:
    os.system('pip install pillow -q')
    from PIL import Image, ImageDraw

OUT = '/home/z/my-project/public/icons'
os.makedirs(OUT, exist_ok=True)

BG_TOP = (234, 88, 12)     # orange-600
BG_BOT = (194, 65, 12)     # orange-700


def gradient(size):
    img = Image.new('RGB', (size, size))
    px = img.load()
    for y in range(size):
        t = y / (size - 1)
        r = int(BG_TOP[0] + (BG_BOT[0] - BG_TOP[0]) * t)
        g = int(BG_TOP[1] + (BG_BOT[1] - BG_TOP[1]) * t)
        b = int(BG_TOP[2] + (BG_BOT[2] - BG_TOP[2]) * t)
        for x in range(size):
            px[x, y] = (r, g, b)
    return img


def draw_icon(size):
    img = gradient(size).convert('RGBA')
    d = ImageDraw.Draw(img)
    s = size

    # two opposing arrows meeting in the middle (work exchange)
    cx, cy = s * 0.5, s * 0.52
    w = s * 0.30  # arrow half-width
    thick = s * 0.085
    head = s * 0.11

    white = (255, 255, 255, 255)

    # right-pointing arrow (from left)
    y1 = cy - s * 0.11
    d.polygon(
        [
            (cx - w, y1 - thick / 2),
            (cx - head, y1 - thick / 2),
            (cx - head, y1 - thick),
            (cx + head * 1.15, y1),
            (cx - head, y1 + thick),
            (cx - head, y1 + thick / 2),
            (cx - w, y1 + thick / 2),
        ],
        fill=white,
    )
    # left-pointing arrow (from right)
    y2 = cy + s * 0.11
    d.polygon(
        [
            (cx + w, y2 - thick / 2),
            (cx + head, y2 - thick / 2),
            (cx + head, y2 - thick),
            (cx - head * 1.15, y2),
            (cx + head, y2 + thick),
            (cx + head, y2 + thick / 2),
            (cx + w, y2 + thick / 2),
        ],
        fill=white,
    )
    # handshake dot in center
    r = s * 0.055
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 237, 213, 255))  # orange-100

    return img


def rounded(img, radius_ratio=0.22):
    size = img.size[0]
    mask = Image.new('L', (size, size), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * radius_ratio), fill=255)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


for name, size, rounded_on in [
    ('icon-192.png', 192, True),
    ('icon-512.png', 512, True),
    ('maskable-512.png', 512, False),
    ('apple-touch-icon.png', 180, True),
]:
    img = draw_icon(size)
    if rounded_on and name != 'apple-touch-icon.png':
        img = rounded(img)
    img.save(f'{OUT}/{name}')
    print('saved', name)

# favicon copy
img = draw_icon(64)
rounded(img).resize((48, 48), Image.LANCZOS).save('/home/z/my-project/public/favicon-slekni.png')
print('done')
