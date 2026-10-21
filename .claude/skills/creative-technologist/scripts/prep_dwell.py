"""Rest footage from a dwell shot: aligns the tail onto the head (camera drift) and blends it in, so forward repeats
have no doubled image. Usage: python prep_dwell.py dwell.mp4 out_base [blend_s=1.5] -> out_base.mp4 + .webm"""
import cv2, numpy as np, sys, subprocess, os
src, out = sys.argv[1], sys.argv[2]; B = float(sys.argv[3]) if len(sys.argv) > 3 else 1.5
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
dx, dy = M[0, 2], M[1, 2]; sc = np.hypot(M[0, 0], M[0, 1]); print(f'{src}: drift dx={dx:.1f}px dy={dy:.1f}px scale={sc:.4f} inliers={int(inl.sum()) if inl is not None else 0}')
tmp = out + '.tmp.mp4'; wr = cv2.VideoWriter(tmp, cv2.VideoWriter_fourcc(*'mp4v'), fps, (W, H)); I = np.eye(2, 3, dtype=np.float32)
def tail_into_head(j):                    # tail frame j, warped onto the head's framing and cross-blended with head frame j
    t = (j + 1) / nb; Mt = I * (1 - t) + M * t
    tail = cv2.warpAffine(frames[n - nb + j], Mt, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    return cv2.addWeighted(tail, 1 - t, frames[j], t, 0)
# part A (played once): the shot from its first frame, its tail blended into the head. Ends on ~head frame nb-1.
for k in range(n - nb): wr.write(frames[k])
for j in range(nb): wr.write(tail_into_head(j))
# part B (repeated): continues from head frame nb, same blended tail. Its end connects to its own start.
for k in range(nb, n - nb): wr.write(frames[k])
for j in range(nb): wr.write(tail_into_head(j))
wr.release(); restart = n / fps                     # part B starts here: the player seeks back to this keyframe at the end
open(out + '.json', 'w').write('{"restart": %.4f}' % restart)
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', tmp, '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '26', '-pix_fmt', 'yuv420p', '-force_key_frames', '%.4f' % restart, '-movflags', '+faststart', out + '.mp4'], check=True); os.remove(tmp)
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', out + '.mp4', '-an', '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '38', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '3', '-force_key_frames', '%.4f' % restart, out + '.webm'], check=True)
