# -*- coding: utf-8 -*-
"""生成应用图标 icon-192.png / icon-512.png"""
from PIL import Image, ImageDraw
import os

BASE = os.path.dirname(os.path.abspath(__file__))

def make_icon(size):
    u = size / 100.0
    c1, c2 = (79, 110, 247), (139, 92, 246)
    grad = Image.new('RGB', (size, size))
    dg = ImageDraw.Draw(grad)
    for y in range(size):  # 对角渐变近似：按行+列混合
        t = y / size
        col = tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))
        dg.line([(0, y), (size, y)], fill=col)
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.22), fill=255)
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    img.paste(grad, (0, 0), mask)
    d = ImageDraw.Draw(img)
    bolt = [(55*u, 18*u), (34*u, 52*u), (46*u, 52*u), (40*u, 82*u), (68*u, 44*u), (54*u, 44*u), (63*u, 18*u)]
    d.polygon(bolt, fill=(255, 213, 79))
    out = os.path.join(BASE, f'icon-{size}.png')
    img.save(out)
    print('saved', out)

make_icon(192)
make_icon(512)
