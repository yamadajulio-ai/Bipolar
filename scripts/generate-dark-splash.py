"""
Generate iOS launch-screen splash variants (light + dark) from the brand logo.

Source: public/logo-square.png (brain + "SUPORTE BIPOLAR", 768x768). The PNG has
two background tones baked in (an outer #f7f6f4 frame and an inner #ffffff card)
with alpha fully opaque, so we chroma-key:

  min_rgb >= 240  -> pure background, show target canvas
  min_rgb <= 120  -> pure logo pixel, show source color directly
  otherwise       -> anti-aliased edge, blend source over target by ramp alpha

This preserves the native teal of the logo (no wash-out from unmix) while killing
both the outer cream frame and the inner white card cleanly on any background.

Light bg: #f6f3ee (brand cream — matches --background token + Instagram grid)
Dark  bg: #171411 (matches .dark --background token em globals.css + ViewController.swift)
                   Any drift reintroduz flash na transição splash → WebView.
"""
from PIL import Image
from pathlib import Path

SRC = Path("public/logo-square.png")
OUT_DIR = Path("ios/App/App/Assets.xcassets/Splash.imageset")
CANVAS = 2732
LOGO_TARGET = 1200

LIGHT_BG = (246, 243, 238)  # #f6f3ee
DARK_BG = (23, 20, 17)      # #171411

BG_CUTOFF = 240  # min_rgb >= this -> pure background
LOGO_CUTOFF = 120  # min_rgb <= this -> pure logo

LIGHT_NAMES = [
    "splash-2732x2732.png",
    "splash-2732x2732-1.png",
    "splash-2732x2732-2.png",
]
DARK_NAMES = [
    "splash-2732x2732-dark.png",
    "splash-2732x2732-1-dark.png",
    "splash-2732x2732-2-dark.png",
]


def composite_logo(src: Path, bg_rgb: tuple[int, int, int]) -> Image.Image:
    """Render source logo over solid-color canvas using chroma-key alpha ramp."""
    src_img = Image.open(src).convert("RGB")
    sw, sh = src_img.size
    src_px = src_img.load()

    out = Image.new("RGB", (sw, sh), bg_rgb)
    out_px = out.load()
    br, bg, bb = bg_rgb

    for y in range(sh):
        for x in range(sw):
            r, g, b = src_px[x, y]
            m = min(r, g, b)
            if m >= BG_CUTOFF:
                continue  # pure bg, keep canvas color
            if m <= LOGO_CUTOFF:
                out_px[x, y] = (r, g, b)
                continue
            t = (BG_CUTOFF - m) / (BG_CUTOFF - LOGO_CUTOFF)
            out_px[x, y] = (
                round(t * r + (1 - t) * br),
                round(t * g + (1 - t) * bg),
                round(t * b + (1 - t) * bb),
            )
    return out


def render(bg_rgb, src: Path) -> Image.Image:
    logo = composite_logo(src, bg_rgb)
    scale = LOGO_TARGET / max(logo.size)
    logo = logo.resize(
        (round(logo.width * scale), round(logo.height * scale)),
        Image.LANCZOS,
    )
    canvas = Image.new("RGB", (CANVAS, CANVAS), bg_rgb)
    canvas.paste(
        logo,
        ((CANVAS - logo.width) // 2, (CANVAS - logo.height) // 2),
    )
    return canvas


for bg_rgb, names in ((LIGHT_BG, LIGHT_NAMES), (DARK_BG, DARK_NAMES)):
    print(f"rendering {names[0]}…")
    img = render(bg_rgb, SRC)
    first = OUT_DIR / names[0]
    img.save(first, format="PNG", optimize=True)
    data = first.read_bytes()
    for n in names[1:]:
        (OUT_DIR / n).write_bytes(data)

print(f"done: {len(LIGHT_NAMES)} light + {len(DARK_NAMES)} dark in {OUT_DIR}")
