"""Rest footage from a dwell shot (a Veo shot that starts and ends on the station plate).
Aligns the tail onto the head (camera drift) and blends it in, so a forward repeat has no doubled image, and encodes with a
keyframe every 4 s PLUS keyframes exactly where the player lands after its jump back, so the jump is a cheap seek.

  file = A (plays once: the shot, its last `blend` seconds blended tail->head)  +  B (repeats: continues from the head, same blended tail)
  The last `blend` seconds of the file are frame-for-frame the `blend` seconds before `restart`. The player, at currentTime >= duration - blend,
  jumps back by (duration - restart): same picture, no seam. loops/NN.json = {"restart": ..., "blend": ...}.

Usage: python3 prep_dwell.py dwell.mp4 out_base [blend_s=1.5] [crf=24]  ->  out_base.mp4 + out_base.webm + out_base.json
Streams frames to ffmpeg (one encode pass, both formats); holds the 8 s shot in memory only (~1.2 GB at 1080p): run one at a time."""
import cv2, numpy as np, sys, subprocess
src, out = sys.argv[1], sys.argv[2]; B = float(sys.argv[3]) if len(sys.argv) > 3 else 1.5; crf = sys.argv[4] if len(sys.argv) > 4 else '24'
cap = cv2.VideoCapture(src); fps = cap.get(cv2.CAP_PROP_FPS) or 24; frames = []
while True:
    ok, f = cap.read()
    if not ok: break
    frames.append(f)
n = len(frames); H, W = frames[0].shape[:2]; nb = int(B * fps)
g0 = cv2.cvtColor(frames[0], cv2.COLOR_BGR2GRAY); g1 = cv2.cvtColor(frames[-1], cv2.COLOR_BGR2GRAY)
# global drift from last frame to first frame (translation + rotation + scale), from tracked corners
p1 = cv2.goodFeaturesToTrack(g1, 2000, 0.01, 8); p0, st, _ = cv2.calcOpticalFlowPyrLK(g1, g0, p1, None, winSize=(41, 41), maxLevel=4)
good = st.ravel() == 1; M, inl = cv2.estimateAffinePartial2D(p1[good], p0[good], method=cv2.RANSAC, ransacReprojThreshold=3)
if M is None: M = np.eye(2, 3, dtype=np.float32)
dx, dy = M[0, 2], M[1, 2]; sc = np.hypot(M[0, 0], M[0, 1]); print(f'{src}: {n} frames, drift dx={dx:.1f}px dy={dy:.1f}px scale={sc:.4f} inliers={int(inl.sum()) if inl is not None else 0}', flush=True)
I = np.eye(2, 3, dtype=np.float32)
def tail_into_head(j):                    # tail frame j, warped onto the head's framing and cross-blended with head frame j
    t = (j + 1) / nb; Mt = I * (1 - t) + M * t
    tail = cv2.warpAffine(frames[n - nb + j], Mt, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    return cv2.addWeighted(tail, 1 - t, frames[j], t, 0)
restart = n / fps; land = (n - nb) / fps          # B starts at `restart`; the player lands on `land` (start of the blended tail) when it jumps
keys = '%.4f,%.4f' % (land, restart)
cmd = ['ffmpeg', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{W}x{H}', '-r', str(fps), '-i', '-', '-an',
       '-c:v', 'libx264', '-preset', 'slow', '-crf', crf, '-pix_fmt', 'yuv420p', '-g', str(int(fps*4)), '-keyint_min', str(int(fps)), '-force_key_frames', keys, '-movflags', '+faststart', out + '.mp4',
       '-an', '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '36', '-pix_fmt', 'yuv420p', '-g', str(int(fps*4)), '-keyint_min', str(int(fps)), '-row-mt', '1', '-deadline', 'good', '-cpu-used', '3', '-force_key_frames', keys, out + '.webm']
pr = subprocess.Popen(cmd, stdin=subprocess.PIPE)
def put(fr): pr.stdin.write(np.ascontiguousarray(fr).tobytes())
for k in range(n - nb): put(frames[k])                              # part A (played once): the shot, then its tail blended into the head
for j in range(nb): put(tail_into_head(j))
for k in range(nb, n - nb): put(frames[k])                          # part B (repeated): continues from head frame nb, same blended tail
for j in range(nb): put(tail_into_head(j))
pr.stdin.close(); rc = pr.wait()
if rc: sys.exit(f'ffmpeg failed ({rc})')
open(out + '.json', 'w').write('{"restart": %.4f, "blend": %.4f}' % (restart, nb / fps))
print(f'{out}: restart={restart:.3f}s blend={nb/fps:.3f}s duration={(2*n - nb)/fps:.3f}s', flush=True)
