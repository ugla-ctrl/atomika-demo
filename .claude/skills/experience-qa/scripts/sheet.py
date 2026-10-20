"""Grid every screenshot in a QA output folder into one sheet per device, for a fast visual review.

Usage: python sheet.py qa-out [columns=4]
  -> qa-out/sheet-<device>.jpg
"""
import glob
import os
import sys
from collections import defaultdict
from PIL import Image, ImageDraw

def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    folder = sys.argv[1]
    cols = int(sys.argv[2]) if len(sys.argv) > 2 else 4
    groups = defaultdict(list)
    for f in sorted(glob.glob(os.path.join(folder, '*.png'))):
        groups[os.path.basename(f).split('-')[0]].append(f)
    for dev, files in groups.items():
        ims = [Image.open(f).convert('RGB') for f in files]
        w = 420
        h = max(round(im.height * w / im.width) for im in ims)
        rows = (len(ims) + cols - 1) // cols
        sheet = Image.new('RGB', (cols * w, rows * (h + 22)), (17, 17, 17))
        d = ImageDraw.Draw(sheet)
        for i, (f, im) in enumerate(zip(files, ims)):
            x, y = (i % cols) * w, (i // cols) * (h + 22)
            sheet.paste(im.resize((w, round(im.height * w / im.width))), (x, y + 22))
            d.text((x + 6, y + 5), os.path.basename(f), fill='white')
        out = os.path.join(folder, f'sheet-{dev}.jpg')
        sheet.save(out, quality=84)
        print('saved', out)

if __name__ == '__main__':
    main()
