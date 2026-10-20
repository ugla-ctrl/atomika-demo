"""Composite a hero stair render into a photograph, matching the photo's wear, softness and grain.
Usage: python composite.py photo.png beauty.png mask.png rails.png out.png [--rail-level 150] [--grain 4.5] [--soft 0.7]
       [--wear x0,y0,x1,y1] (a diamond-plate region of the photo to sample scuffs and dirt from) [--dirt 0.35]
Photo keeps everything outside the mask. Inside, plates are colour-matched to the photo's stair region, overlaid with the photo's own
plate wear (high-pass) and a low-frequency dirt map, rails get a dull galvanized tone, the render is softened to the photo's sharpness,
and grain is added over the whole stair."""
import argparse, numpy as np, cv2
from PIL import Image, ImageFilter
a=argparse.ArgumentParser(); a.add_argument('photo'); a.add_argument('beauty'); a.add_argument('mask'); a.add_argument('rails'); a.add_argument('out')
a.add_argument('--rail-level',type=float,default=150); a.add_argument('--grain',type=float,default=4.5); a.add_argument('--soft',type=float,default=0.7)
a.add_argument('--wear',default=''); a.add_argument('--dirt',type=float,default=0.35); o=a.parse_args()
photo=np.asarray(Image.open(o.photo).convert('RGB')).astype(np.float32)
rend=np.asarray(Image.open(o.beauty).convert('RGB')).astype(np.float32)
if o.soft>0: rend=cv2.GaussianBlur(rend,(0,0),o.soft)                         # the photo is softer than a raw render
m=np.asarray(Image.open(o.mask).convert('L').filter(ImageFilter.GaussianBlur(2.5))).astype(np.float32)/255
rails=np.asarray(Image.open(o.rails).convert('L').filter(ImageFilter.GaussianBlur(1))).astype(np.float32)/255
sel=(m>0.5)&(rails<0.2); out=rend.copy()
for c in range(3):
    ps,rs=photo[...,c][sel],rend[...,c][sel]; out[...,c]=(rend[...,c]-rs.mean())*(ps.std()/max(rs.std(),1e-3))*0.9+ps.mean()
H,W=out.shape[:2]; rng=np.random.default_rng(7)
if o.wear:                                                                     # scuffs, dust and dull patches from the photo's own plate
    x0,y0,x1,y1=[int(v) for v in o.wear.split(',')]; tile=photo[y0:y1,x0:x1]; hp=cv2.GaussianBlur(tile,(0,0),4)-cv2.GaussianBlur(tile,(0,0),16)   # scuffs and dull patches only, not the diamond pattern itself
    th,tw=hp.shape[:2]; wear=np.zeros_like(out)
    for yy in range(0,H,th):
        for xx in range(0,W,tw):
            t=np.roll(np.roll(hp,rng.integers(0,th),0),rng.integers(0,tw),1); t=t[::(1 if rng.random()<.5 else -1),::(1 if rng.random()<.5 else -1)]; wear[yy:yy+th,xx:xx+tw]=t[:min(th,H-yy),:min(tw,W-xx)]
    out=out+cv2.GaussianBlur(wear,(0,0),2)*0.6
low=cv2.GaussianBlur(rng.normal(0,1,(H//8,W//8)).astype(np.float32),(0,0),12); low=cv2.resize(low,(W,H)); low=(low-low.min())/(low.max()-low.min()+1e-6)
out=out*(1-o.dirt*0.6+o.dirt*0.6*low[...,None])                              # low-frequency dirt: some treads darker than others
lum=out.mean(axis=2); lo,hi=np.percentile(lum[rails>0.6],5),np.percentile(lum[rails>0.6],95)
t=np.clip((lum-lo)/max(hi-lo,1),0,1)**1.3; railv=(55+t*(o.rail_level+40-55))[...,None]*np.array([0.90,0.90,0.92])
out=out*(1-rails[...,None])+railv*rails[...,None]
out=np.clip(out+rng.normal(0,o.grain,out.shape),0,255)
comp=photo*(1-m[...,None])+out*m[...,None]
Image.fromarray(comp.astype(np.uint8)).save(o.out); print('wrote',o.out)
