"""Remove objects from a photo plate without smearing: Telea inpaint for colour, then clone high-frequency texture from a
neighbouring area so the fill keeps the surface's grain. Usage: python clean_plate.py in.png out.png mask.png --shift dx,dy [--shift2 dx,dy --mask2 m2.png]"""
import argparse, cv2, numpy as np
a=argparse.ArgumentParser(); a.add_argument('inp'); a.add_argument('out'); a.add_argument('mask'); a.add_argument('--shift',default='0,-160')
a.add_argument('--mask2'); a.add_argument('--shift2',default='140,0'); o=a.parse_args()
img=cv2.imread(o.inp).astype(np.float32)
def fill(img,m,shift):
    dx,dy=[int(v) for v in shift.split(',')]
    base=cv2.inpaint(img.astype(np.uint8),m,9,cv2.INPAINT_TELEA).astype(np.float32)
    src=np.roll(np.roll(img,dy,axis=0),dx,axis=1)
    lum=cv2.cvtColor(src.astype(np.uint8),cv2.COLOR_BGR2GRAY).astype(np.float32)
    hp=np.clip(lum-cv2.GaussianBlur(lum,(0,0),9),-35,35)[...,None]            # luminance only: no colour speckle                       # grain and stains of the neighbouring wall
    mm=cv2.GaussianBlur(m.astype(np.float32)/255,(0,0),3)[...,None]
    return np.clip(base*(1-mm)+(base+hp)*mm,0,255)                       # clip here: a second pass would wrap overflow into colour speckle
m=cv2.imread(o.mask,0); img=fill(img,m,o.shift)
if o.mask2: img=fill(img,cv2.imread(o.mask2,0),o.shift2)
cv2.imwrite(o.out,np.clip(img,0,255).astype(np.uint8)); print('wrote',o.out)
