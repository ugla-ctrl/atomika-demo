"""Key a green-screen lineup of people into one transparent cutout per person.

Generate the lineup first (text2image): full-body people standing in a row on a flat chroma-key
green backdrop, evenly spaced with clear gaps. This script mattes the green, removes green spill,
splits people by the empty columns between them, trims each one, and saves height-normalised WebP.

Usage: python key_cutouts.py lineup.png out_dir prefix [height=1000]
  -> out_dir/prefix-1.webp, prefix-2.webp, ...
"""
import os
import sys
import numpy as np
from PIL import Image, ImageFilter

def main():
    if len(sys.argv) < 4:
        sys.exit(__doc__)
    src, out_dir, prefix = sys.argv[1:4]
    target_h = int(sys.argv[4]) if len(sys.argv) > 4 else 1000
    os.makedirs(out_dir, exist_ok=True)
    im = np.asarray(Image.open(src).convert('RGB')).astype(np.float32) / 255
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    greenness = g - np.maximum(r, b)
    alpha = 1 - np.clip((greenness - 0.08) / 0.14, 0, 1)              # soft matte
    a8 = Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    alpha = np.asarray(a8).astype(np.float32) / 255                      # choke the edge 1px, then soften
    rgb = np.stack([r, np.minimum(g, np.maximum(r, b) * 1.02), b], -1)   # despill
    occupied = (alpha > 0.5).sum(0) > 8
    runs, x, W = [], 0, len(occupied)
    while x < W:
        if occupied[x]:
            x1 = x
            while x1 < W and occupied[x1]:
                x1 += 1
            if x1 - x > 40:
                runs.append((x, x1))
            x = x1
        else:
            x += 1
    for k, (x0, x1) in enumerate(runs, 1):
        rows = np.where((alpha[:, x0:x1] > 0.5).sum(1) > 2)[0]
        pad = 12
        X0, X1 = max(0, x0 - pad), min(W, x1 + pad)
        Y0, Y1 = max(0, rows[0] - pad), min(alpha.shape[0], rows[-1] + 1 + pad)
        rgba = np.dstack([rgb[Y0:Y1, X0:X1], alpha[Y0:Y1, X0:X1]])
        img = Image.fromarray((rgba * 255).astype(np.uint8), 'RGBA')
        img = img.resize((round(img.width * target_h / img.height), target_h), Image.LANCZOS)
        path = os.path.join(out_dir, f'{prefix}-{k}.webp')
        img.save(path, quality=88, method=6)
        print('saved', path, img.size)
    print(len(runs), 'people')

if __name__ == '__main__':
    main()
