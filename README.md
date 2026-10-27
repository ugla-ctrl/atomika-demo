# Enter the Silo

Interactive 3D prototype for ATOMIKA: a descent from the sky over Roswell into the Twistflower missile silo, through the launch control center, and up through the open silo doors.

Live at https://demo.atomikafest.com

- Single static page (`index.html`), three.js r128 from cdnjs, plus the r128 post-processing add-ons (EffectComposer, UnrealBloomPass) from jsDelivr.
- Rendering: linear HDR scene, ACES filmic tone mapping, bloom, film grain and vignette; moonlight shadows; image-based reflections (procedural night sky outside, a fluorescent-room environment underground); exposure adapts when you go below grade. Pixel ratio steps down automatically on slower devices; add `?hq` to turn that off.
- `tex/` holds photo-scanned PBR textures (color, normal, roughness at 1k) from [Poly Haven](https://polyhaven.com), CC0. Each is tinted in code so it averages to the color it replaced in the original palette.
- `?station=N` opens straight at station N (1 to 11).
- `people/` holds real-person cutouts (crew and visitors) that stand in the live 3D in place of modeled figures.
- `.claude/skills/creative-technologist/` is the Claude Code skill used to make all of this: how to turn a 3D build into human-realistic plates and cutouts with OpenArt or ElevenLabs.
- `stations/` holds photoreal plates, with real people, for all 11 stations. Navigation is photographic end to end: moving between stations plays a filmed transition clip from `transitions/` when one exists, otherwise a camera-push dissolve from photo to photo; dragging pans the photo. The 3D scene still drives the path, depth readout and label positions but isn't drawn behind the photos. `?3d` shows the 3D scene instead. The plates are AI re-renders of the 3D frames; sources, every variation and the prompts are in `concepts/` (see `concepts/README.md`).
- `og.png` is the social share image.
- Hosted on GitHub Pages; `CNAME` sets the custom domain.

Layout follows historical engineering records, satellite views, the LiDAR views and renders in the sponsor deck, and the festival map. Interior geometry is approximate.


## Film player performance

The default tour loads `film-player.js` without initializing Three.js, WebGL, scene textures or procedural geometry. The optional `?3d` view loads its libraries and `scene-player.js` on demand.

The current station's main and prepared repeat players load first. Once the visible film decodes, the outgoing transition and next station's main player preload. Previous video sources release after the handoff; revisiting a station reloads its original media. Hidden tabs pause film playback and resume without consuming transition deadlines. Idle UI work runs at 10Hz; transitions use animation frames and native video always keeps its encoded frame rate.

This optimization changes no video assets, source resolution, bitrate, timing or playback rate. Some existing footage is 720p; this change preserves it rather than presenting an upscale as native 1080p.

Checks (Node, no packages required):

```sh
node tests/player.cjs
node tests/navigation.cjs
node tests/scheduler.cjs
```
