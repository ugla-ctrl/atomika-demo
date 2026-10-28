# Video delivery quality

The six previously 1280×720 active files listed below are delivered as 1920×1080 upscales. These are spatial upscales, not new native-HD captures. No motion synthesis, retiming, added frames or AI generation is used. The existing 720p assets remain in the repository for comparison or rollback.

| Active footage | Original | Delivery | Frame rate | Frames |
|---|---|---|---|---|
| loops/04-road-only.mp4 | 1280×720 | 1920×1080 | 48.0 | 384 |
| loops/05-entry-wide.mp4 | 1280×720 | 1920×1080 | 30.0 | 323 |
| loops/09-native-frames.mp4 | 1280×720 | 1920×1080 | 24.0 | 190 |
| transitions/03-04-road-only.mp4 | 1280×720 | 1920×1080 | 30.0 | 274 |
| transitions/04-05-entry-wide.mp4 | 1280×720 | 1920×1080 | 24.0 | 192 |
| transitions/08-09-native-frames.mp4 | 1280×720 | 1920×1080 | 24.0 | 216 |

Method: Lanczos resize and gentle spatial sharpening (luma 0.25), H.264 CRF20 with an 8Mbps ceiling and fast-start MP4, plus VP9 WebM. All original frame counts and timing retained. Repeat restart metadata is unchanged. No new credits were spent.

Other active files have 1080p encoded dimensions, but some contain reused 720p footage. In particular, Station 11 exterior remains the approved 720p crowd source inside a 1080p delivery file; Station 10 arrival contains an original 720p tunnel lead before its newly generated 1080p shot. Encoded dimensions alone are not evidence of native detail.

Small visual improvements should be assessed against the original at the same displayed size. Upscaling cannot restore absent fine detail, repair anatomy or remove pre-existing generative artifacts. Nearby-media loading and hidden-tab pause remain enabled; larger HD files can still need more bandwidth than their 720p originals.
