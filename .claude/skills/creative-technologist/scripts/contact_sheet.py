"""Contact sheet: the reference frame first (top-left), then each variation, two per row.

Usage: python contact_sheet.py out.jpg reference.jpg variation1.png [variation2.png ...]
"""
import sys
from PIL import Image

def main():
    if len(sys.argv) < 4:
        sys.exit(__doc__)
    out, files = sys.argv[1], sys.argv[2:]
    tw, th = 640, 360
    rows = (len(files) + 1) // 2
    sheet = Image.new('RGB', (tw * 2, th * rows), 'black')
    for i, f in enumerate(files):
        sheet.paste(Image.open(f).convert('RGB').resize((tw, th)), ((i % 2) * tw, (i // 2) * th))
    sheet.save(out, quality=86)
    print('saved', out)

if __name__ == '__main__':
    main()
