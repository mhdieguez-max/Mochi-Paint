#!/usr/bin/env python3
"""Generate public/share-card.png (1200x630 Open Graph card) from the master mascot.
Usage: python3 scripts/make_share_card.py assets/mochi-logo-transparent.png public
The mascot artwork is used verbatim (Lanczos downscale only), placed on the pastel
pink->blue brand gradient beside the wordmark + tagline."""
import sys
from PIL import Image, ImageDraw, ImageFont

BG_TOP, BG_BOT = (253, 231, 241), (219, 232, 250)


def font(size):
    for p in ("/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf",
              "/System/Library/Fonts/SFNSRounded.ttf",
              "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
              "/System/Library/Fonts/Helvetica.ttc"):
        try:
            return ImageFont.truetype(p, size)
        except OSError:
            continue
    return ImageFont.load_default()


def main(master_path, pub):
    tile = Image.open(master_path).convert("RGBA")
    tile = tile.crop(tile.getbbox())
    W, H = 1200, 630
    card = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(card)
    for y in range(H):
        f = y / (H - 1)
        d.line([(0, y), (W, y)], fill=tuple(int(BG_TOP[i] + (BG_BOT[i] - BG_TOP[i]) * f) for i in range(3)))
    card = card.convert("RGBA")
    d = ImageDraw.Draw(card)
    d.ellipse([-150, -170, 250, 230], fill=(251, 211, 229, 150))
    d.ellipse([W - 260, H - 230, W + 170, H + 190], fill=(214, 229, 251, 160))
    r = 430 / max(tile.size)
    mw, mh = round(tile.width * r), round(tile.height * r)
    m = tile.resize((mw, mh), Image.LANCZOS)
    mx, my = 70, (H - mh) // 2
    card.alpha_composite(m, (mx, my))
    d = ImageDraw.Draw(card)
    tx = mx + mw + 60
    d.text((tx, 205), "Mochi Paint", font=font(96), fill=(107, 83, 80, 255))
    for i, line in enumerate(("A cozy kawaii coloring studio.", "Grab a color, meet a pal,", "make something cute.")):
        d.text((tx + 4, 320 + i * 50), line, font=font(38), fill=(129, 112, 106, 255))
    card.convert("RGB").save(pub + "/share-card.png")
    print("wrote", pub + "/share-card.png")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
