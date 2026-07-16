#!/usr/bin/env python3
"""Generate the complete Mochi Paint production icon package from ONE master.

The master mascot (transparent PNG) is used verbatim: never redrawn or
reinterpreted. Every output is produced by cropping / compositing / Lanczos
downscaling the master, so the artwork, colors, and watercolor style are
preserved exactly.

Usage:
    python3 make_icon_package.py /path/to/mochi-logo-transparent.png /path/to/output_dir

Produces `<output_dir>/mochi-paint-icons/` with the full tree, plus a copy of
this script inside it, then prints a QA report.
"""
import json
import struct
import sys
from pathlib import Path

from PIL import Image, ImageDraw

# ----------------------------------------------------------------------------- config
BG_TOP = (253, 231, 241)      # pale pink  (top)
BG_BOT = (219, 232, 250)      # pale blue  (bottom)
MONO_COLOR = (60, 60, 60)     # Android themed-icon layer (system re-tints it)
LANCZOS = Image.LANCZOS

# fraction of the canvas the mascot's longest side occupies, per use-case
FULL_SCALE = 0.80             # standard app/pwa icons — comfortable squircle margin
MASKABLE_SCALE = 0.60         # PWA maskable — inside the 80%-diameter safe circle
ADAPTIVE_SCALE = 0.60         # Android adaptive foreground — inside the 66.6% safe zone


# ----------------------------------------------------------------------------- helpers
def load_master(path):
    im = Image.open(path).convert("RGBA")
    bbox = im.getbbox()
    tile = im.crop(bbox)                       # tight mascot cutout, full resolution
    return im, tile


def face_crop(master):
    """Square crop centred on the smiling face (ears -> cheeks). Fractions of the
    full master, derived from the content bbox — used for tiny favicons."""
    l, t, r, b = master.getbbox()
    w = r - l
    cx = l + 0.60 * w                          # head sits right-of-centre (brush on left)
    side = 0.66 * w
    left = cx - side / 2
    top = t                                    # include ear tips
    return master.crop((int(left), int(top), int(left + side), int(top + side)))


def gradient(size):
    """Vertical pale-pink -> pale-blue gradient, fully opaque RGB."""
    g = Image.new("RGB", (size, size))
    px = g.load()
    for y in range(size):
        f = y / max(1, size - 1)
        col = tuple(int(BG_TOP[i] + (BG_BOT[i] - BG_TOP[i]) * f) for i in range(3))
        for x in range(size):
            px[x, y] = col
    return g


def fit(tile, size, scale):
    """Return an RGBA `size`x`size` canvas (transparent) with the mascot tile
    scaled so its longest side == scale*size and centred. Only ever downscales."""
    target = scale * size
    ratio = target / max(tile.size)
    w = max(1, round(tile.width * ratio))
    h = max(1, round(tile.height * ratio))
    if ratio > 1.0:
        raise RuntimeError("would upscale the master — abort")   # safety guard
    m = tile.resize((w, h), LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.alpha_composite(m, ((size - w) // 2, (size - h) // 2))
    return canvas


def on_gradient(tile, size, scale):
    """Mascot on the pastel gradient, flattened opaque RGB (no alpha)."""
    base = gradient(size).convert("RGBA")
    base.alpha_composite(fit(tile, size, scale))
    return base.convert("RGB")


def face_on_gradient(face, size):
    """Simplified face crop on the gradient, opaque RGB — for favicons."""
    base = gradient(size).convert("RGBA")
    # face fills more of the frame; small margin
    ratio = (0.92 * size) / max(face.size)
    ratio = min(ratio, 1.0)
    w, h = round(face.width * ratio), round(face.height * ratio)
    m = face.resize((w, h), LANCZOS)
    base.alpha_composite(m, ((size - w) // 2, (size - h) // 2))
    return base.convert("RGB")


def circle_mask(size):
    m = Image.new("L", (size, size), 0)
    ImageDraw.Draw(m).ellipse((0, 0, size - 1, size - 1), fill=255)
    return m


def squircle_mask(size, radius_frac=0.45):
    m = Image.new("L", (size, size), 0)
    r = int(size * radius_frac)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, size - 1, size - 1), radius=r, fill=255)
    return m


def teardrop_mask(size):
    m = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(m)
    r = size // 2
    d.ellipse((0, 0, size - 1, size - 1), fill=255)          # round body
    d.pieslice((0, 0, size - 1, size - 1), start=-90, end=0, fill=255)  # filled corner
    d.rectangle((r, r, size - 1, size - 1), fill=255)
    return m


def apply_mask(img_rgb, mask):
    out = img_rgb.convert("RGBA")
    out.putalpha(mask)
    return out


def save_png(img, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG")


def save_ico(face, path, sizes=(16, 32, 48)):
    """Hand-pack a real multi-size ICO from individually Lanczos-rendered frames."""
    frames = []
    for s in sizes:
        frames.append((s, face_on_gradient(face, s).convert("RGBA")))
    # Build ICONDIR + entries, each image stored as PNG (valid, widely supported).
    path.parent.mkdir(parents=True, exist_ok=True)
    import io
    blobs = []
    for s, im in frames:
        buf = io.BytesIO()
        im.save(buf, "PNG")
        blobs.append((s, buf.getvalue()))
    with open(path, "wb") as f:
        f.write(struct.pack("<HHH", 0, 1, len(blobs)))       # reserved, type=1(icon), count
        offset = 6 + 16 * len(blobs)
        for s, data in blobs:
            wb = s if s < 256 else 0
            f.write(struct.pack("<BBBBHHII", wb, wb, 0, 0, 1, 32, len(data), offset))
            offset += len(data)
        for _, data in blobs:
            f.write(data)


# ----------------------------------------------------------------------------- build
def build(master_path, out_root):
    master, tile = load_master(master_path)
    face = face_crop(master)
    pkg = out_root / "mochi-paint-icons"

    manifest = []   # (relpath, expect_alpha)  expect_alpha: True=needs transparency, False=must be opaque

    def emit(img, rel, expect_alpha):
        p = pkg / rel
        save_png(img, p)
        manifest.append((rel, expect_alpha))

    # ---- master/
    side = max(tile.size)
    pad = int(side * 0.06)
    sq = Image.new("RGBA", (side + 2 * pad, side + 2 * pad), (0, 0, 0, 0))
    sq.alpha_composite(tile, ((sq.width - tile.width) // 2, (sq.height - tile.height) // 2))
    emit(sq, "master/mascot-transparent.png", True)
    emit(on_gradient(tile, 1024, FULL_SCALE), "master/app-icon-master-1024.png", False)

    # ---- website/
    for s in (16, 32, 48):
        emit(face_on_gradient(face, s), f"website/favicon-{s}x{s}.png", False)
    emit(on_gradient(tile, 180, FULL_SCALE), "website/apple-touch-icon.png", False)
    emit(on_gradient(tile, 192, FULL_SCALE), "website/icon-192.png", False)
    emit(on_gradient(tile, 512, FULL_SCALE), "website/icon-512.png", False)
    emit(on_gradient(tile, 512, MASKABLE_SCALE), "website/icon-512-maskable.png", False)
    save_ico(face, pkg / "website/favicon.ico")
    manifest.append(("website/favicon.ico", False))

    # ---- apple/  (opaque, no baked rounding)
    appiconset = pkg / "apple/AppIcon.appiconset"
    apple_specs = [   # (idiom, size_pt, scale)
        ("iphone", 20, 2), ("iphone", 20, 3),
        ("iphone", 29, 2), ("iphone", 29, 3),
        ("iphone", 40, 2), ("iphone", 40, 3),
        ("iphone", 60, 2), ("iphone", 60, 3),
        ("ipad", 20, 1), ("ipad", 20, 2),
        ("ipad", 29, 1), ("ipad", 29, 2),
        ("ipad", 40, 1), ("ipad", 40, 2),
        ("ipad", 76, 1), ("ipad", 76, 2),
        ("ipad", 83.5, 2),
        ("ios-marketing", 1024, 1),
    ]
    images_json = []
    made = {}
    for idiom, pt, scale in apple_specs:
        px = int(round(pt * scale))
        fname = f"AppIcon-{idiom}-{pt}@{scale}x-{px}.png"
        if px not in made:
            img = on_gradient(tile, px, FULL_SCALE)
            save_png(img, appiconset / fname)
            made[px] = fname
            manifest.append((f"apple/AppIcon.appiconset/{fname}", False))
        entry = {"idiom": idiom, "scale": f"{scale}x",
                 "size": f"{pt:g}x{pt:g}", "filename": made[px]}
        if idiom == "ios-marketing":
            entry.pop("scale"); entry["scale"] = "1x"
        images_json.append(entry)
    contents = {"images": images_json, "info": {"version": 1, "author": "xcode"}}
    (appiconset).mkdir(parents=True, exist_ok=True)
    (appiconset / "Contents.json").write_text(json.dumps(contents, indent=2))
    emit(on_gradient(tile, 1024, FULL_SCALE), "apple/app-store-icon-1024.png", False)

    # ---- android/  adaptive layers
    emit(fit(tile, 1024, ADAPTIVE_SCALE), "android/foreground.png", True)
    save_png(gradient(1024), pkg / "android/background.png")
    manifest.append(("android/background.png", False))
    # monochrome silhouette from the mascot alpha, tinted, in the safe zone
    fg = fit(tile, 1024, ADAPTIVE_SCALE)
    sil = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    solid = Image.new("RGBA", (1024, 1024), MONO_COLOR + (255,))
    sil = Image.composite(solid, sil, fg.split()[-1])
    emit(sil, "android/monochrome.png", True)

    # ---- android/res/  density folders
    dens = {"mdpi": (48, 108), "hdpi": (72, 162), "xhdpi": (96, 216),
            "xxhdpi": (144, 324), "xxxhdpi": (192, 432)}
    for name, (legacy, adaptive) in dens.items():
        d = pkg / f"android/res/mipmap-{name}"
        # legacy launcher icons (square + round), opaque
        sq_launch = on_gradient(tile, legacy, FULL_SCALE)
        save_png(sq_launch, d / "ic_launcher.png"); manifest.append((f"android/res/mipmap-{name}/ic_launcher.png", False))
        rnd = apply_mask(on_gradient(tile, legacy, FULL_SCALE), circle_mask(legacy))
        save_png(rnd, d / "ic_launcher_round.png"); manifest.append((f"android/res/mipmap-{name}/ic_launcher_round.png", True))
        # adaptive layers at 108dp * density
        save_png(fit(tile, adaptive, ADAPTIVE_SCALE), d / "ic_launcher_foreground.png"); manifest.append((f"android/res/mipmap-{name}/ic_launcher_foreground.png", True))
        save_png(gradient(adaptive), d / "ic_launcher_background.png"); manifest.append((f"android/res/mipmap-{name}/ic_launcher_background.png", False))
        fga = fit(tile, adaptive, ADAPTIVE_SCALE)
        sa = Image.composite(Image.new("RGBA", (adaptive, adaptive), MONO_COLOR + (255,)),
                             Image.new("RGBA", (adaptive, adaptive), (0, 0, 0, 0)), fga.split()[-1])
        save_png(sa, d / "ic_launcher_monochrome.png"); manifest.append((f"android/res/mipmap-{name}/ic_launcher_monochrome.png", True))
    # adaptive-icon XML
    anydpi = pkg / "android/res/mipmap-anydpi-v26"
    anydpi.mkdir(parents=True, exist_ok=True)
    xml = ('<?xml version="1.0" encoding="utf-8"?>\n'
           '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
           '    <background android:drawable="@mipmap/ic_launcher_background"/>\n'
           '    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n'
           '    <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>\n'
           '</adaptive-icon>\n')
    (anydpi / "ic_launcher.xml").write_text(xml)
    (anydpi / "ic_launcher_round.xml").write_text(xml)

    # ---- google-play/
    emit(on_gradient(tile, 512, FULL_SCALE), "google-play/play-store-icon-512.png", False)

    return pkg, manifest


# ----------------------------------------------------------------------------- QA
def has_transparency(path):
    im = Image.open(path)
    if im.mode not in ("RGBA", "LA") and not (im.mode == "P" and "transparency" in im.info):
        return False
    a = im.convert("RGBA").split()[-1]
    return a.getextrema()[0] < 250


def qa(pkg, manifest):
    print("\n===== QA REPORT =====")
    ok = True
    for rel, expect_alpha in manifest:
        p = pkg / rel
        if not p.exists():
            print(f"  MISSING  {rel}"); ok = False; continue
        im = Image.open(p)
        w, h = im.size
        trans = has_transparency(p)
        if expect_alpha and not trans:
            print(f"  FAIL(alpha)  {rel}  {w}x{h}  expected transparency, none found"); ok = False
        elif (not expect_alpha) and trans:
            print(f"  FAIL(opaque) {rel}  {w}x{h}  has transparent pixels"); ok = False
        else:
            tag = "transparent" if trans else "opaque"
            print(f"  ok  {rel:60s} {w}x{h:<5} {tag}")
    print("===== %s =====" % ("ALL CHECKS PASSED" if ok else "SOME CHECKS FAILED"))
    return ok


def main():
    master_path = Path(sys.argv[1])
    out_root = Path(sys.argv[2])
    pkg, manifest = build(master_path, out_root)
    # ship the script inside the package for reproducibility
    save_target = pkg / "make_icon_package.py"
    save_target.write_text(Path(__file__).read_text())
    qa(pkg, manifest)
    print("\nPackage:", pkg)


if __name__ == "__main__":
    main()
