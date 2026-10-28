"""Generate the README illustration for dsh-codex-account-switcher.

Drawn from scratch with Pillow: no screenshots, no personal data.
Run: python docs/images/generate.py
"""
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ORANGE = (255, 122, 26)
INK = (232, 236, 240)
DIM = (139, 148, 158)
BG = (13, 17, 23)
PANEL = (22, 27, 34)
LINE = (48, 54, 61)
CJK = [r"C:\Windows\Fonts\msyh.ttc", r"C:\Windows\Fonts\msyhbd.ttc"]
MONO = [r"C:\Windows\Fonts\consola.ttf", r"C:\Windows\Fonts\consolab.ttf"]


def font(paths, size):
    for p in paths:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except OSError:
                pass
    return ImageFont.load_default(size)


def mono(size):
    return font(MONO, size)


def cjk(size):
    return font(CJK, size)


def main():
    w, h = 1280, 900
    img = Image.new("RGBA", (w, h), (*BG, 255))
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle([40, 40, w - 40, h - 40], radius=16, fill=(*PANEL, 255), outline=LINE, width=2)

    draw.text((72, 68), "Plugins / Codex Account Switcher", font=mono(30), fill=INK)
    draw.text((72, 112), "Snapshot and switch the Codex login; read its quota on the same card.", font=mono(19), fill=DIM)

    # accounts card
    draw.rounded_rectangle([72, 160, w - 72, 470], radius=12, fill=(17, 22, 28, 255), outline=LINE)
    draw.text((96, 180), "Accounts", font=mono(22), fill=ORANGE)
    rows = [
        ("Account 001", "当前 / active", True),
        ("Account 002", "已保存 / saved", False),
        ("Account 003", "已保存 / saved", False),
    ]
    y = 222
    for name, state, active in rows:
        draw.rounded_rectangle([96, y, w - 96, y + 58], radius=9, fill=(22, 28, 35, 255), outline=(48, 54, 61))
        draw.text((118, y + 15), name, font=mono(21), fill=INK)
        draw.text((330, y + 17), state, font=cjk(18), fill=ORANGE if active else DIM)
        btn = "切换 / switch" if not active else "已启用"
        bw = 150
        draw.rounded_rectangle([w - 260, y + 11, w - 260 + bw, y + 47], radius=8, fill=(34, 40, 48), outline=LINE)
        draw.text((w - 246, y + 18), btn, font=cjk(17), fill=INK if not active else DIM)
        y += 72
    draw.text((96, 432), "保存当前登录 / Save current login", font=cjk(18), fill=ORANGE)

    # quota card
    draw.rounded_rectangle([72, 500, w - 72, 760], radius=12, fill=(17, 22, 28, 255), outline=LINE)
    draw.text((96, 520), "Quota", font=mono(22), fill=ORANGE)
    draw.text((96, 560), "Plan", font=mono(18), fill=DIM)
    draw.text((200, 556), "Plus", font=mono(22), fill=INK)
    for i, (title, pct, remain) in enumerate([
        ("5 小时窗口 / 5h window", 0.42, "42%"),
        ("7 天窗口 / 7d window", 0.16, "16%"),
    ]):
        y = 606 + i * 58
        draw.text((96, y), title, font=cjk(18), fill=INK)
        draw.rectangle([420, y + 10, 900, y + 18], fill=(255, 255, 255, 30))
        draw.rectangle([420, y + 10, 420 + int(480 * pct), y + 18], fill=(*ORANGE, 240))
        draw.text((930, y), remain, font=mono(18), fill=DIM)
    draw.text((96, 720), "代理（可选）: http://127.0.0.1:10090", font=mono(18), fill=DIM)

    ImageDraw.Draw(img).text((40, h - 44), "illustration - not a screenshot", font=mono(20), fill=(255, 255, 255, 80))
    img.convert("RGB").save(os.path.join(HERE, "plugins-card.png"), optimize=True)
    print("wrote plugins-card.png into", HERE)


if __name__ == "__main__":
    main()