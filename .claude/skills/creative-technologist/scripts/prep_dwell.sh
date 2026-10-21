#!/usr/bin/env bash
# prep_dwell.sh <dwell.mp4> <out_base>  : a station's rest footage. Blends the last 1.5 s into the first 1.5 s so forward
# repeats have no visible join, then writes the MP4, the WebM and a frames strip.
set -e; src="$1"; out="$2"; d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$src"); c=$(python3 -c "print($d-1.5)")
ffmpeg -loglevel error -y -i "$src" -filter_complex "[0:v]split[a][b];[a]trim=0:$c,setpts=PTS-STARTPTS[main];[b]trim=$c,setpts=PTS-STARTPTS[tail];[0:v]trim=0:1.5,setpts=PTS-STARTPTS[head];[tail][head]blend=all_expr='A*(1-T/1.5)+B*(T/1.5)':shortest=1[x];[main][x]concat=n=2:v=1[v]" -map "[v]" -an -c:v libx264 -preset slow -crf 22 -pix_fmt yuv420p -movflags +faststart "$out.mp4"
ffmpeg -loglevel error -y -i "$out.mp4" -an -c:v libvpx-vp9 -b:v 0 -crf 34 -row-mt 1 -deadline good -cpu-used 3 "$out.webm"
ffmpeg -loglevel error -y -i "$out.mp4" -vf "fps=1,scale=400:-1,tile=8x1" -frames:v 1 "$out-frames.jpg"
