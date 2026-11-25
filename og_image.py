"""OGP画像（SNSでリンクを貼ったときに出る画像）を作る。gen.py から呼ばれる。
日本語フォントがない環境では作らない（gen.py は止まらない）。"""
import glob
import os

from PIL import Image, ImageDraw, ImageFont

# 2026-11-25 刷新：ピンクは「押す」（下の帯）だけ。事実の印は青灰
INK, PINK, GRID, BOARD, MUTE = (28, 28, 33), (194, 48, 111), (228, 227, 224), (250, 249, 247), (90, 90, 100)
FACT, FACT_TINT = (43, 63, 81), (238, 242, 245)
CANDIDATES = [
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts", "NotoSansJP-Bold-subset.otf"),
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc", "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc", "/System/Library/Fonts/ヒラギノ角ゴシック W8.ttc",
    "/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc", "C:/Windows/Fonts/YuGothB.ttc", "C:/Windows/Fonts/meiryob.ttc",
] + glob.glob("/usr/share/fonts/**/*CJK*JP*", recursive=True)


def font(size):
    for p in CANDIDATES:
        if not os.path.exists(p):
            continue
        for idx in range(0, 10):
            try:
                f = ImageFont.truetype(p, size, index=idx)
            except Exception:
                break
            if "JP" in " ".join(f.getname()) or not p.endswith(".ttc"):
                return f
        try:
            return ImageFont.truetype(p, size)
        except Exception:
            continue
    raise RuntimeError("日本語フォントが見つかりません")


def wrap(draw, text, f, width):
    lines, line = [], ""
    for ch in text:
        if draw.textlength(line + ch, font=f) > width and line:
            lines.append(line)
            line = ch
        else:
            line += ch
    if line:
        lines.append(line)
    return lines


def card(path, label, text, sub, img_path):
    W, H = 1200, 630
    im = Image.new("RGB", (W, H), BOARD)
    d = ImageDraw.Draw(im)
    if img_path and os.path.exists(img_path):
        art = Image.open(img_path).convert("RGB")
        h = H
        w = int(art.width * h / art.height)
        art = art.resize((w, h))
        art = Image.blend(art, Image.new("RGB", art.size, BOARD), 0.55)
        im.paste(art, (W - w, 0))
    d.rounded_rectangle([30, 30, 760, H - 40], radius=24, fill=(255, 255, 255), outline=GRID, width=2)
    d.text((64, 62), "HagiiZ 災害レビュー", font=font(26), fill=MUTE)
    fl = font(28)
    lw = d.textlength(label, font=fl)
    d.rounded_rectangle([64, 108, 64 + lw + 24, 152], radius=8, fill=FACT_TINT)
    d.text((76, 112), label, font=fl, fill=FACT)
    fb = font(54)
    lines = wrap(d, text, fb, 650)[:4]
    if len(lines) > 3:
        fb = font(46)
        lines = wrap(d, text, fb, 650)[:4]
    y = 180
    for ln in lines:
        d.text((64, y), ln, font=fb, fill=INK)
        y += int(fb.size * 1.32)
    d.rounded_rectangle([64, H - 130, 740, H - 70], radius=12, fill=PINK)
    d.text((86, H - 120), sub, font=font(30), fill=(255, 255, 255))
    im.convert("RGB").quantize(colors=96, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG).save(path, optimize=True)


def make_all(out, M, imgdir):
    os.makedirs(os.path.join(out, "og"), exist_ok=True)
    card(os.path.join(out, "og.png"), "未来への問い " + str(len(M["qs"])) + "件",
         "過去の災害を教訓に、未来に託された問いに答える。", "根拠カードを選んで、1文で答える →", os.path.join(imgdir, "typhoon.jpg"))
    for t in M["qs"]:
        img = os.path.join(imgdir, ((t.get("d") or {}).get("img") or "typhoon") + ".jpg")
        label = "未来への問い " + t["no"]
        card(os.path.join(out, "og", t["slug"] + ".png"), label, t["q"], "あなたなら、どう答える？ →", img)
