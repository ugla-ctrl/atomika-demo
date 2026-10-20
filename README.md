# Enter the Silo

Interactive 3D prototype for ATOMIKA: a descent from the sky over Roswell into the Twistflower missile silo, through the launch control center, and up through the open silo doors.

Live at https://demo.atomikafest.com

- Single static page (`index.html`), three.js r128 from cdnjs, plus the r128 post-processing add-ons (EffectComposer, UnrealBloomPass) from jsDelivr.
- Rendering: linear HDR scene, ACES filmic tone mapping, bloom, film grain and vignette; moonlight shadows; image-based reflections (procedural night sky outside, a fluorescent-room environment underground); exposure adapts when you go below grade. Pixel ratio steps down automatically on slower devices; add `?hq` to turn that off.
- `tex/` holds photo-scanned PBR textures (color, normal, roughness at 1k) from [Poly Haven](https://polyhaven.com), CC0. Each is tinted in code so it averages to the color it replaced in the original palette.
- `?station=N` opens straight at station N (1 to 11).
- `stations/` holds photoreal plates for stations 2–7 and 11. The camera flies through the 3D scene, and on arrival the view dissolves into the plate; dragging to look around fades back to the live 3D. Stations without a plate stay 3D. The plates are AI re-renders of the 3D frames; sources, every variation and the prompts are in `concepts/` (see `concepts/README.md`).
- `og.png` is the social share image.
- Hosted on GitHub Pages; `CNAME` sets the custom domain.

Layout follows historical engineering records, satellite views, the LiDAR views and renders in the sponsor deck, and the festival map. Interior geometry is approximate.
