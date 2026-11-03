#!/usr/bin/env python3
"""
앱 자원 생성 도구 (자주 돌릴 필요 없음).
    python3 tools/build_assets.py icons   아이콘 생성
    python3 tools/build_assets.py fonts   Noto Serif CJK KR에서 게임용 글꼴 추출
필요: Pillow, fonttools, brotli, Noto Serif CJK 글꼴 (fonts-noto-cjk)
"""
import glob
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
WWW = os.path.join(ROOT, "www")
TTC = "/usr/share/fonts/opentype/noto/NotoSerifCJK-{}.ttc"


def font_index(path):
    from fontTools.ttLib import TTCollection
    collection = TTCollection(path)
    for i, font in enumerate(collection.fonts):
        if "KR" in font["name"].getDebugName(1):
            return i
    raise SystemExit("KR 글꼴을 찾지 못했습니다")


def characters():
    chars = {chr(c) for c in range(0x20, 0x7F)}
    # KS X 1001 한글 2350자: 앞으로 쓸 문장도 대부분 표시되도록 넣는다
    for lead in range(0xB0, 0xC9):
        for trail in range(0xA1, 0xFF):
            try:
                chars.add(bytes([lead, trail]).decode("euc-kr"))
            except UnicodeDecodeError:
                pass
    patterns = ["data/*.json", "js/*.js", "index.html"]
    for pattern in patterns:
        for path in glob.glob(os.path.join(WWW, pattern)):
            chars.update(open(path, encoding="utf-8").read())
    return {c for c in chars if c.isprintable() and ord(c) < 0xE000 or c == " "}


def fonts():
    from fontTools import subset
    os.makedirs(os.path.join(WWW, "fonts"), exist_ok=True)
    text = "".join(sorted(characters()))
    for weight, name in (("Regular", "game-serif"), ("Bold", "game-serif-bold")):
        path = TTC.format(weight)
        out = os.path.join(WWW, "fonts", f"{name}.woff2")
        subset.main([
            path, f"--font-number={font_index(path)}", f"--text={text}", "--flavor=woff2",
            f"--output-file={out}", "--layout-features=kern,vert,vrt2,locl,palt,vpal",
            "--no-hinting", "--desubroutinize",
        ])
        print(name, os.path.getsize(out) // 1024, "KB")


def icons():
    from PIL import Image, ImageDraw, ImageFont
    os.makedirs(os.path.join(WWW, "icons"), exist_ok=True)
    path = TTC.format("Bold")
    index = font_index(path)

    def draw(size, seal_ratio):
        image = Image.new("RGB", (size, size), "#181d22")
        canvas = ImageDraw.Draw(image)
        side = int(size * seal_ratio)
        top = (size - side) // 2
        canvas.rounded_rectangle((top, top, top + side, top + side), radius=side // 12, fill="#b5372c")
        font = ImageFont.truetype(path, int(side * 0.72), index=index)
        canvas.text((size / 2, size / 2), "武", font=font, fill="#f6e7dc", anchor="mm")
        return image

    outputs = {"icon-192.png": (192, .74), "icon-512.png": (512, .74),
               "icon-maskable-512.png": (512, .56), "apple-touch-icon.png": (180, .74)}
    for name, (size, ratio) in outputs.items():
        draw(size, ratio).save(os.path.join(WWW, "icons", name))
    print("icons done")


if __name__ == "__main__":
    {"icons": icons, "fonts": fonts}[sys.argv[1]]()
