#!/usr/bin/env bash
# Turn a generated transition clip into web-ready files plus a frame strip for review.
# Usage: prep_clip.sh <source.mp4> <out_basename> [slowdown=1.0]
#   -> <out_basename>.mp4 (H.264, 720p, faststart), <out_basename>.webm (VP9), <out_basename>-frames.jpg
# slowdown > 1 stretches the clip with motion interpolation (e.g. 1.75 turns 4 s into 7 s without stutter).
# Ship both formats: some Chromium builds (including headless test browsers) have no H.264, so pick per browser with
# canPlayType('video/mp4; codecs="avc1.640028"').
set -euo pipefail
src="$1"; out="$2"; slow="${3:-1.0}"
vf="scale=1280:720:flags=lanczos"
if [ "$slow" != "1.0" ] && [ "$slow" != "1" ]; then vf="$vf,setpts=${slow}*PTS,minterpolate=fps=30:mi_mode=mci:mc_mode=aobmc:vsbmc=1"; fi
ffmpeg -loglevel error -y -i "$src" -vf "$vf" -an -c:v libx264 -preset slow -crf 24 -pix_fmt yuv420p -movflags +faststart "$out.mp4"
ffmpeg -loglevel error -y -i "$out.mp4" -an -c:v libvpx-vp9 -b:v 0 -crf 36 -row-mt 1 -deadline good -cpu-used 2 "$out.webm"
dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$out.mp4")
ffmpeg -loglevel error -y -i "$out.mp4" -vf "fps=8/${dur},scale=480:-1,tile=4x2" -frames:v 1 "$out-frames.jpg"
echo "$out.mp4 $(stat -c %s "$out.mp4") bytes, $out.webm $(stat -c %s "$out.webm") bytes, ${dur}s"
