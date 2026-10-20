"""Composite a hero stair render into a photograph.
Usage: python composite.py photo.png beauty.png mask.png rails.png out.png [--rail-level 150] [--grain 4.5] [--patch x0,y0,x1,y1,dx ...]
The photo keeps everything outside the mask (walls, props, lights). Inside it, the render's plates are colour-matched to the photo's
stair region, rails keep a neutral galvanized tone at --rail-level, and film grain is added. --patch clones a photo rectangle from dx pixels right."""
import argparse, numpy as np
from PIL import Image, ImageFilter
a=argparse.ArgumentParser(); a.add_argument('photo'); a.add_argument('beauty'); a.add_argument('mask'); a.add_argument('rails'); a.add_argument('out')
a.add_argument('--rail-level',type=float,default=150); a.add_argument('--grain',type=float,default=4.5); a.add_argument('--patch',nargs='*',default=[])
o=a.parse_args()
photo=np.asarray(Image.open(o.photo).convert('RGB')).astype(np.float32)
for pt in o.patch:   # clone neighbouring photo texture over a leftover
    x0,y0,x1,y1,dx=[int(v) for v in pt.split(',')]; src=photo[y0:y1, x0+dx:x1+dx].copy()
    fe=np.ones((y1-y0,x1-x0,1),np.float32); fe=np.asarray(Image.fromarray((fe[...,0]*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(6))).astype(np.float32)[...,None]/255
    photo[y0:y1,x0:x1]=photo[y0:y1,x0:x1]*(1-fe)+src*fe
rend=np.asarray(Image.open(o.beauty).convert('RGB')).astype(np.float32)
m=np.asarray(Image.open(o.mask).convert('L').filter(ImageFilter.GaussianBlur(2.5))).astype(np.float32)/255
rails=np.asarray(Image.open(o.rails).convert('L').filter(ImageFilter.GaussianBlur(1))).astype(np.float32)/255
sel=(m>0.5)&(rails<0.2); out=rend.copy()
for c in range(3):
    ps,rs=photo[...,c][sel],rend[...,c][sel]; out[...,c]=(rend[...,c]-rs.mean())*(ps.std()/max(rs.std(),1e-3))*0.9+ps.mean()
# rails: galvanized steel = the render's shading, remapped to a dull grey range with a cool tint (not painted cream)
lum=rend.mean(axis=2); lo,hi=np.percentile(lum[rails>0.6],5),np.percentile(lum[rails>0.6],95)
t=np.clip((lum-lo)/max(hi-lo,1),0,1)**1.3; railv=(55+t*(o.rail_level+40-55))[...,None]*np.array([0.90,0.90,0.92])
out=out*(1-rails[...,None])+railv*rails[...,None]
rng=np.random.default_rng(7); out=np.clip(out+rng.normal(0,o.grain,out.shape),0,255)
comp=photo*(1-m[...,None])+out*m[...,None]
Image.fromarray(comp.astype(np.uint8)).save(o.out); print('wrote',o.out)
