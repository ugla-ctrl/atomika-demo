"""Finish a harmonized stair: keep the AI skin pass only inside the stair mask, the guide photo everywhere else, and recolour the
rails to a sampled steel tone. Usage: python finish.py guide.png skin.png mask.png rails.png out.png --steel x0,y0,x1,y1 (a box on a
real pipe in the guide photo to sample tone from)"""
import argparse, numpy as np, cv2
from PIL import Image, ImageFilter
a=argparse.ArgumentParser(); a.add_argument('guide'); a.add_argument('skin'); a.add_argument('mask'); a.add_argument('rails'); a.add_argument('out'); a.add_argument('--steel',required=True); a.add_argument('--shade',help='beauty render: its rail shading is used instead of the skin pass'); o=a.parse_args()
g=np.asarray(Image.open(o.guide).convert('RGB')).astype(np.float32); s=np.asarray(Image.open(o.skin).convert('RGB').resize(Image.open(o.guide).size,Image.LANCZOS)).astype(np.float32)
m=np.asarray(Image.open(o.mask).convert('L').filter(ImageFilter.GaussianBlur(3))).astype(np.float32)/255
r=np.asarray(Image.open(o.rails).convert('L').filter(ImageFilter.GaussianBlur(0.8))).astype(np.float32)/255
x0,y0,x1,y1=[int(v) for v in o.steel.split(',')]; box=g[y0:y1,x0:x1].reshape(-1,3); lum=box.mean(axis=1)
dark=box[lum<=np.percentile(lum,15)].mean(axis=0); mid=box[(lum>np.percentile(lum,40))&(lum<np.percentile(lum,60))].mean(axis=0); light=box[lum>=np.percentile(lum,92)].mean(axis=0)   # the pipe's shadow and highlight colours
out=g*(1-m[...,None])+s*m[...,None]
sh=np.asarray(Image.open(o.shade).convert('RGB')).astype(np.float32) if o.shade else s
sl=sh.mean(axis=2); lo,hi=np.percentile(sl[r>0.6],3),np.percentile(sl[r>0.6],97); vals=np.sort(sl[r>0.6]); t=(np.searchsorted(vals,sl)/max(len(vals)-1,1)).astype(np.float32)   # rank remap: the pipe's tonal spread is set here, not by the render's exposure
t=np.clip(t,0,1)[...,None]**2.2                                                             # most of the pipe in shadow, highlight only on the lit edge
rail=np.where(t<0.6, dark+(mid-dark)*(t/0.6), mid+(light-mid)*((t-0.6)/0.4))   # most of the pipe sits in shadow-to-mid; only the top edge reaches the highlight
spec=np.clip((t-0.9)/0.1,0,1); rail=rail*(1-spec)+np.array([225,205,180])*spec
grime=(s.mean(axis=2)-cv2.GaussianBlur(s.mean(axis=2),(0,0),2))[...,None]; rail=rail+grime*0.5   # keep the skin pass's fine texture on the pipe
out=out*(1-r[...,None])+rail*r[...,None]
Image.fromarray(np.clip(out,0,255).astype(np.uint8)).save(o.out); print('steel dark',dark.round(),'light',light.round())
