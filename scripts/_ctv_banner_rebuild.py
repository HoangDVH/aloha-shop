"""Rebuild CTV banner at product-card aspect (1984x528) — clean left UI + photo."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ORIG = ROOT / "frontend/public/banners/banner-ctv-aloha.orig.png"
OUT = ROOT / "frontend/public/banners/banner-ctv-aloha.png"

W, H = 1984, 528
GREEN = (27, 94, 42)
GREEN_BTN = (33, 110, 52)
CREAM = (250, 251, 246)
INK = (40, 60, 45)
MUTED = (75, 100, 80)
LEAF = (120, 170, 110)


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    for p in (
        r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf",
        r"C:\Windows\Fonts\segoeuib.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf",
    ):
        try:
            return ImageFont.truetype(p, size)
        except OSError:
            continue
    return ImageFont.load_default()


def font_script(size: int) -> ImageFont.FreeTypeFont:
    for p in (
        r"C:\Windows\Fonts\segoesc.ttf",
        r"C:\Windows\Fonts\seguili.ttf",
        r"C:\Windows\Fonts\georgia.ttf",
        r"C:\Windows\Fonts\segoeui.ttf",
    ):
        try:
            return ImageFont.truetype(p, size)
        except OSError:
            continue
    return font(size)


def soft_leaves(canvas: Image.Image) -> None:
    """Simple decorative leaves — no pixels from original text panel."""
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)

    def leaf(cx, cy, rx, ry, rot_hint, alpha):
        # ellipse blob as soft leaf
        box = [cx - rx, cy - ry, cx + rx, cy + ry]
        d.ellipse(box, fill=(*LEAF, alpha))
        d.ellipse([cx - rx // 2, cy - ry, cx + rx // 3, cy + ry // 3], fill=(*LEAF, alpha // 2))

    # top-left cluster
    leaf(40, 30, 70, 40, 0, 55)
    leaf(110, 20, 55, 30, 0, 40)
    leaf(20, 90, 50, 35, 0, 45)
    # bottom-left
    leaf(50, H - 40, 80, 45, 0, 50)
    leaf(130, H - 25, 60, 35, 0, 35)
    leaf(30, H - 100, 55, 40, 0, 40)

    layer = layer.filter(ImageFilter.GaussianBlur(radius=6))
    canvas.alpha_composite(layer)


def draw_icon(draw: ImageDraw.ImageDraw, cx: int, cy: int, kind: str) -> None:
    r = 15
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(232, 245, 233), outline=GREEN, width=2)
    if kind == "coin":
        draw.ellipse((cx - 7, cy - 7, cx + 7, cy + 7), outline=GREEN, width=2)
        draw.ellipse((cx - 3, cy - 3, cx + 3, cy + 3), fill=GREEN)
    elif kind == "box":
        draw.rectangle((cx - 8, cy - 6, cx + 8, cy + 7), outline=GREEN, width=2)
        draw.line((cx - 8, cy - 1, cx + 8, cy - 1), fill=GREEN, width=2)
        draw.line((cx, cy - 6, cx, cy + 7), fill=GREEN, width=2)
    else:
        draw.ellipse((cx - 8, cy - 8, cx + 8, cy + 8), outline=GREEN, width=2)
        draw.line((cx, cy, cx, cy - 5), fill=GREEN, width=2)
        draw.line((cx, cy, cx + 4, cy + 2), fill=GREEN, width=2)


def main() -> None:
    orig = Image.open(ORIG).convert("RGB")
    ow, oh = orig.size

    photo_src = orig.crop((int(ow * 0.56), 0, ow, oh))
    panel_w = int(W * 0.54)
    scale = max(panel_w / photo_src.width, H / photo_src.height) * 1.04
    nw, nh = int(photo_src.width * scale), int(photo_src.height * scale)
    photo = photo_src.resize((nw, nh), Image.Resampling.LANCZOS)
    cx, cy = int(nw * 0.36), int(nh * 0.44)
    x0 = max(0, min(nw - panel_w, cx - panel_w // 2))
    y0 = max(0, min(nh - H, cy - H // 2))
    photo = photo.crop((x0, y0, x0 + panel_w, y0 + H)).convert("RGBA")

    wipe = Image.new("RGBA", (panel_w, H), (0, 0, 0, 0))
    wd = ImageDraw.Draw(wipe)
    hard, soft = 70, 150
    for i in range(hard + soft):
        a = 255 if i < hard else int(255 * (1 - (i - hard) / soft))
        wd.line([(i, 0), (i, H)], fill=(*CREAM, a))
    photo = Image.alpha_composite(photo, wipe)

    canvas = Image.new("RGBA", (W, H), (*CREAM, 255))
    photo_x = W - panel_w
    canvas.alpha_composite(photo, (photo_x, 0))

    fade_w = 120
    fade = Image.new("RGBA", (fade_w, H), (0, 0, 0, 0))
    fd = ImageDraw.Draw(fade)
    for i in range(fade_w):
        a = int(255 * (1 - i / (fade_w - 1)) ** 1.1)
        fd.line([(i, 0), (i, H)], fill=(*CREAM, a))
    canvas.alpha_composite(fade, (photo_x - 30, 0))

    soft_leaves(canvas)

    draw = ImageDraw.Draw(canvas)
    left = 52
    y = max(24, (H - 390) // 2)

    my = y + 6
    draw.polygon([(left, my + 16), (left + 20, my + 6), (left + 20, my + 30)], fill=GREEN)
    draw.arc((left + 16, my + 8, left + 34, my + 30), start=300, end=60, fill=GREEN, width=3)

    draw.text((left + 42, y), "TRỞ THÀNH CTV ALOHA", font=font(40, bold=True), fill=GREEN)
    y += 52
    draw.text((left, y), "Kiếm thêm thu nhập cùng Aloha ♡", font=font_script(26), fill=GREEN)
    y += 38
    for line in (
        "Chia sẻ sản phẩm cây/chậu của Aloha và nhận hoa hồng",
        "trên mỗi đơn hàng thành công.",
    ):
        draw.text((left, y), line, font=font(19), fill=MUTED)
        y += 26
    y += 14

    bx = left
    for kind, label in (
        ("coin", "Hoa hồng hấp dẫn"),
        ("box", "Không cần vốn"),
        ("clock", "Linh hoạt thời gian"),
    ):
        draw_icon(draw, bx + 14, y + 12, kind)
        draw.text((bx + 36, y + 2), label, font=font(16), fill=INK)
        bx += 235
    y += 46

    btn_label = "Đăng ký ngay  →"
    fbtn = font(22, bold=True)
    tw = int(draw.textlength(btn_label, font=fbtn))
    pad_x, pad_y = 26, 12
    btn_w, btn_h = tw + pad_x * 2, 26 + pad_y * 2
    draw.rounded_rectangle((left, y, left + btn_w, y + btn_h), radius=btn_h // 2, fill=GREEN_BTN)
    draw.text((left + pad_x, y + pad_y - 1), btn_label, font=fbtn, fill=(255, 255, 255))
    btn_top, btn_left = y, left

    link = "Tìm hiểu cách hoạt động  →"
    flink = font(17)
    link_x = left + btn_w + 22
    link_y = y + (btn_h - 20) // 2
    draw.text((link_x, link_y), link, font=flink, fill=GREEN)
    lw = int(draw.textlength(link, font=flink))
    draw.line((link_x, link_y + 22, link_x + lw, link_y + 22), fill=GREEN, width=2)

    rgb = ImageEnhance.Sharpness(canvas.convert("RGB")).enhance(1.12)
    rgb.save(OUT, "PNG", optimize=True)

    for p in (ROOT / "frontend/public/banners").glob("_dbg_*.png"):
        p.unlink(missing_ok=True)

    print(f"saved {OUT} {rgb.size}")
    print(
        "BTN1",
        {
            "left": round(btn_left / W * 100, 2),
            "top": round(btn_top / H * 100, 2),
            "width": round(btn_w / W * 100, 2),
            "height": round(btn_h / H * 100, 2),
        },
    )
    print(
        "LINK",
        {
            "left": round(link_x / W * 100, 2),
            "top": round(link_y / H * 100, 2),
            "width": round(lw / W * 100, 2),
            "height": round(26 / H * 100, 2),
        },
    )


if __name__ == "__main__":
    main()
