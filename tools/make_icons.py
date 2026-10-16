#!/usr/bin/env python3
"""Zeichnet das Logsmith-Symbol: ein frisch geschmiedeter Schlüssel mit Funken auf dunklem Grund.
Erzeugt icons/icon.svg sowie icons/icon-<n>.png und icons/icon-off-<n>.png (grau, für ausgeschaltete Seiten)."""
import math
import os

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "icons")
SIZES = [16, 32, 48, 128]
S = 1024  # Zeichenfläche, danach verkleinert
U = S / 128.0

BG_TOP, BG_BOTTOM = (0x35, 0x28, 0x6b), (0x14, 0x10, 0x2c)
GOLD_TOP, GOLD_BOTTOM = (0xff, 0xe0, 0x8a), (0xe8, 0x84, 0x1a)
SPARK = (0xff, 0xf1, 0xb8)
EMBER = (0xff, 0x8a, 0x3d)

# Geometrie in 128er-Einheiten
BOW = (44.0, 44.0)      # Mittelpunkt des Rings
R_OUT, R_IN = 25.0, 11.5
SHAFT_W = 12.0
TIP = (103.0, 103.0)    # Ende des Schafts
DIR = (math.sqrt(0.5), math.sqrt(0.5))
PERP = (-DIR[1], DIR[0])


def along(p, d, t):
    return (p[0] + d[0] * t, p[1] + d[1] * t)


def rect(start, length, width, d=DIR, p=PERP):
    """Rechteck ab start entlang d, quer um die Mittellinie."""
    a = along(along(start, p, -width / 2), d, 0)
    pts = [along(start, p, -width / 2), along(start, p, width / 2),
           along(along(start, d, length), p, width / 2), along(along(start, d, length), p, -width / 2)]
    return pts


def key_polygons():
    shaft_start = along(BOW, DIR, R_OUT - 4)
    shaft_len = math.hypot(TIP[0] - shaft_start[0], TIP[1] - shaft_start[1])
    shaft = rect(shaft_start, shaft_len, SHAFT_W)
    teeth = []
    for back, ln in ((6.5, 15.0), (19.0, 11.0)):
        base = along(TIP, DIR, -back)
        teeth.append(rect(along(base, PERP, -SHAFT_W / 2 + 1), ln, 8.5, PERP, (-PERP[0], -PERP[1]) if False else DIR))
    return shaft, teeth


def tooth(back, length, width):
    # Zähne ragen zur linken unteren Seite aus dem Schaft
    base = along(TIP, DIR, -back)
    side = (-PERP[0], -PERP[1])  # (+, -) ... wird unten gewählt
    d = (-1 / math.sqrt(2), 1 / math.sqrt(2))  # nach links unten
    start = along(base, d, SHAFT_W / 2 - 1)
    p = DIR
    return [along(start, p, -width / 2), along(start, p, width / 2),
            along(along(start, d, length), p, width / 2), along(along(start, d, length), p, -width / 2)]


def star(c, r, k=0.28):
    pts = []
    for i in range(8):
        ang = math.pi / 4 * i - math.pi / 2
        rad = r if i % 2 == 0 else r * k
        pts.append((c[0] + math.cos(ang) * rad, c[1] + math.sin(ang) * rad))
    return pts


def gradient(size, top, bottom):
    im = Image.new("RGB", (size, size))
    px = im.load()
    for y in range(size):
        t = y / (size - 1)
        col = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        for x in range(size):
            px[x, y] = col
    return im


def scale(pts):
    return [(x * U, y * U) for x, y in pts]


def draw_master():
    # Hintergrund: abgerundetes Quadrat mit Verlauf
    bg = gradient(S, BG_TOP, BG_BOTTOM).convert("RGBA")
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=int(28 * U), fill=255)
    base = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    base.paste(bg, (0, 0), mask)

    # warmes Glühen hinter dem Schlüsselbart
    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    cx, cy = 98 * U, 98 * U
    gd.ellipse([cx - 40 * U, cy - 40 * U, cx + 40 * U, cy + 40 * U], fill=EMBER + (110,))
    glow = glow.filter(ImageFilter.GaussianBlur(14 * U))
    base = Image.alpha_composite(base, Image.composite(glow, Image.new("RGBA", (S, S), (0, 0, 0, 0)), mask))

    # Schlüssel als Maske, dann mit Goldverlauf füllen
    km = Image.new("L", (S, S), 0)
    kd = ImageDraw.Draw(km)
    kd.ellipse([(BOW[0] - R_OUT) * U, (BOW[1] - R_OUT) * U, (BOW[0] + R_OUT) * U, (BOW[1] + R_OUT) * U], fill=255)
    shaft_start = along(BOW, DIR, R_OUT - 4)
    shaft_len = math.hypot(TIP[0] - shaft_start[0], TIP[1] - shaft_start[1])
    kd.polygon(scale(rect(shaft_start, shaft_len, SHAFT_W)), fill=255)
    kd.polygon(scale(tooth(7.0, 15.0, 8.5)), fill=255)
    kd.polygon(scale(tooth(20.5, 11.0, 8.5)), fill=255)
    kd.ellipse([(BOW[0] - R_IN) * U, (BOW[1] - R_IN) * U, (BOW[0] + R_IN) * U, (BOW[1] + R_IN) * U], fill=0)
    gold = gradient(S, GOLD_TOP, GOLD_BOTTOM).convert("RGBA")
    # Schatten unter dem Schlüssel
    shadow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    shadow.paste((0, 0, 0, 120), (int(2.5 * U), int(3.5 * U)), km)
    shadow = shadow.filter(ImageFilter.GaussianBlur(3 * U))
    base = Image.alpha_composite(base, shadow)
    base.paste(gold, (0, 0), km)

    # Glanzlicht auf dem Ring
    hl = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(hl).arc([(BOW[0] - 19) * U, (BOW[1] - 19) * U, (BOW[0] + 19) * U, (BOW[1] + 19) * U],
                           start=200, end=262, fill=(255, 255, 255, 170), width=int(3.2 * U))
    base = Image.alpha_composite(base, Image.composite(hl, Image.new("RGBA", (S, S), (0, 0, 0, 0)), km))

    # Funken
    d = ImageDraw.Draw(base)
    d.polygon(scale(star((101, 27), 13)), fill=SPARK)
    d.polygon(scale(star((116, 46), 6.5)), fill=EMBER)
    d.polygon(scale(star((84, 14), 5.5)), fill=EMBER)
    return base, mask


def grey(img):
    r, g, b, a = img.split()
    l = Image.merge("RGB", (r, g, b)).convert("L").point(lambda v: int(v * 0.62 + 24))
    return Image.merge("RGBA", (l, l, l, a))


def svg():
    shaft_start = along(BOW, DIR, R_OUT - 4)
    shaft_len = math.hypot(TIP[0] - shaft_start[0], TIP[1] - shaft_start[1])
    pts = lambda poly: " ".join("%.2f,%.2f" % p for p in poly)
    ring_r = (R_OUT + R_IN) / 2
    ring_w = R_OUT - R_IN
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#{BG_TOP[0]:02x}{BG_TOP[1]:02x}{BG_TOP[2]:02x}"/><stop offset="1" stop-color="#{BG_BOTTOM[0]:02x}{BG_BOTTOM[1]:02x}{BG_BOTTOM[2]:02x}"/></linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#{GOLD_TOP[0]:02x}{GOLD_TOP[1]:02x}{GOLD_TOP[2]:02x}"/><stop offset="1" stop-color="#{GOLD_BOTTOM[0]:02x}{GOLD_BOTTOM[1]:02x}{GOLD_BOTTOM[2]:02x}"/></linearGradient>
    <radialGradient id="glow" cx="98" cy="98" r="40" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ff8a3d" stop-opacity=".45"/><stop offset="1" stop-color="#ff8a3d" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="128" height="128" rx="28" fill="url(#bg)"/>
  <circle cx="98" cy="98" r="40" fill="url(#glow)"/>
  <g fill="url(#gold)" stroke="none">
    <circle cx="{BOW[0]}" cy="{BOW[1]}" r="{ring_r}" fill="none" stroke="url(#gold)" stroke-width="{ring_w}"/>
    <polygon points="{pts(rect(shaft_start, shaft_len, SHAFT_W))}"/>
    <polygon points="{pts(tooth(7.0, 15.0, 8.5))}"/>
    <polygon points="{pts(tooth(20.5, 11.0, 8.5))}"/>
  </g>
  <polygon points="{pts(star((101, 27), 13))}" fill="#fff1b8"/>
  <polygon points="{pts(star((116, 46), 6.5))}" fill="#ff8a3d"/>
  <polygon points="{pts(star((84, 14), 5.5))}" fill="#ff8a3d"/>
</svg>
'''


def main():
    os.makedirs(OUT, exist_ok=True)
    master, _ = draw_master()
    off = grey(master)
    for n in SIZES:
        master.resize((n, n), Image.LANCZOS).save(os.path.join(OUT, f"icon-{n}.png"))
        off.resize((n, n), Image.LANCZOS).save(os.path.join(OUT, f"icon-off-{n}.png"))
    with open(os.path.join(OUT, "icon.svg"), "w", encoding="utf-8") as f:
        f.write(svg())
    master.resize((512, 512), Image.LANCZOS).save("/tmp/logsmith-preview.png")
    print("Symbole geschrieben:", ", ".join(str(n) for n in SIZES))


if __name__ == "__main__":
    main()
