"""Station rest footage from the arrival film itself, for scenes where nothing generated is steady enough to rest on.
Takes the first W seconds of a film (a gentle drone move), removes baked-in plate artefacts (optional dome patch), and re-times them with a
cosine profile so the camera drifts forward and back at a crawl: zero velocity at both turning points, no loop seam, never stops.
When the user moves on, the player plays the SAME film from the current position (see index.html), so the hand-over is the same footage.

Usage: python hover.py film.mp4 out_base [--window 1.8] [--period 48] [--patch x0,x1,ytop,ybot,cx]
Writes out_base.mp4, out_base.webm and out_base.json ({"hover":true,"window":s,"period":s,"fps":src_fps})."""
import argparse, json, subprocess, sys, numpy as np, cv2, math
a = argparse.ArgumentParser(); a.add_argument('film'); a.add_argument('out'); a.add_argument('--window', type=float, default=1.8)
a.add_argument('--period', type=float, default=48); a.add_argument('--patch', default=''); a.add_argument('--crf', default='22'); o = a.parse_args()
cap = cv2.VideoCapture(o.film); sfps = cap.get(cv2.CAP_PROP_FPS) or 30; N = int(o.window * sfps) + 1; frames = []
for _ in range(N):
    ok, f = cap.read()
    if not ok: break
    frames.append(f)
N = len(frames); H, W = frames[0].shape[:2]

def luma(f): return cv2.cvtColor(f, cv2.COLOR_BGR2GRAY).astype(np.float32)
def make_mask(shape, x0, x1, ytop, ybot, cx):
    h, w = shape; m = np.zeros((h, w), np.float32); r = (x1 - x0) / 2; cy = ytop + r
    yy, xx = np.mgrid[0:h, 0:w]
    dome = ((xx - (x0 + x1) / 2) ** 2 / r ** 2 + (yy - cy) ** 2 / r ** 2) <= 1; body = (xx >= x0) & (xx <= x1) & (yy >= cy) & (yy <= ybot)
    m[(dome & (yy <= cy)) | body] = 1
    m = cv2.GaussianBlur(m, (0, 0), 7)
    m *= np.clip(np.abs(xx - cx) / 30.0, 0, 1)                    # leave the beam core alone
    return m
if o.patch:
    x0, x1, ytop, ybot, cx = [float(v) for v in o.patch.split(',')]
    M0 = make_mask((H, W), x0, x1, ytop, ybot, cx)
    # excess brightness of the patch, per channel, measured against the sky either side of it (row-wise interpolation)
    f0 = frames[0].astype(np.float32); exc = []
    for c in range(3):
        L = cv2.GaussianBlur(f0[..., c], (0, 0), 5); left = L[:, int(x0) - 110:int(x0) - 30].mean(axis=1); right = L[:, int(x1) + 30:int(x1) + 110].mean(axis=1)
        t = np.clip((np.arange(W)[None, :] - (x0 - 70)) / ((x1 + 70) - (x0 - 70)), 0, 1); bg = left[:, None] * (1 - t) + right[:, None] * t
        sel = M0 > 0.9; exc.append(float(np.median((L - bg)[sel])))
    print('patch excess per channel (BGR): %s' % [round(e, 2) for e in exc])
    for k in range(N):
        f = frames[k].astype(np.float32)
        for c in range(3): f[..., c] -= M0 * exc[c]
        frames[k] = np.clip(f, 0, 255).astype(np.uint8)

fps = 24.0; P = o.period; T = int(P * fps); Wsrc = N - 1
cmd = ['ffmpeg', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{W}x{H}', '-r', str(fps), '-i', '-', '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', o.crf,
       '-pix_fmt', 'yuv420p', '-g', '48', '-movflags', '+faststart', o.out + '.mp4']
pr = subprocess.Popen(cmd, stdin=subprocess.PIPE)
for j in range(T):
    x = Wsrc * (1 - math.cos(2 * math.pi * j / T)) / 2; i = int(x); t = x - i; k = min(N - 1, i + 1)
    pr.stdin.write(cv2.addWeighted(frames[i], 1 - t, frames[k], t, 0).tobytes())
pr.stdin.close(); pr.wait()
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', o.out + '.mp4', '-an', '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '36', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '3', o.out + '.webm'], check=True)
json.dump({'hover': True, 'window': Wsrc / sfps, 'period': P, 'fps': sfps}, open(o.out + '.json', 'w')); print('wrote', o.out, 'window %.2fs period %.0fs' % (Wsrc / sfps, P))
