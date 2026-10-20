# Compositing photoreal plates into an interactive site

## The plate pattern (superseded: see "Photographic navigation" below)
This was the first version, and people disliked it: the 3D showed during every move. Use it only when there is no time to film transitions.
Keep the 3D or interactive build as the camera rig and the transitions. Layer a full-bleed `<img>` per station between the canvas and the labels/UI:

- On arrival (the camera animation finishes), fade the station's plate in (about 1 s).
- At rest, add a slow drift (scale 1.00 to 1.035 over about 24 s) so it isn't a dead still.
- Dragging or looking around fades the plate out so the live 3D shows; navigating away fades it out faster.
- Stations without a plate simply stay 3D, so plates can ship incrementally.
- Respect `prefers-reduced-motion`: no drift.

CSS:
```css
#photos{position:fixed;inset:0;z-index:2;pointer-events:none;overflow:hidden}
#photos img{position:absolute;inset:-4%;width:108%;height:108%;object-fit:cover;opacity:0;will-change:opacity,transform}
@media (prefers-reduced-motion:reduce){#photos img{inset:0;width:100%;height:100%}}
```

Per-frame JS (`stop` is the current station, `anim` is non-null while flying, `yaw`/`pitch` are the drag look offsets):
```js
const PHOTOS = {4:'05-entry', 6:'07-launch-control'}; // station index -> file in stations/
const plates = {};
Object.keys(PHOTOS).forEach(k => { const img = new Image(); img.alt = ''; img.decoding = 'async';
  const pl = {img, ready:false, a:0, t0:0}; img.onload = () => { pl.ready = true; };
  img.src = 'stations/' + PHOTOS[k] + '.jpg'; photosEl.appendChild(img); plates[k] = pl; });
let plateLast = 0;
function updatePlates(now){ const dt = plateLast ? Math.min(0.1, (now - plateLast)/1000) : 0; plateLast = now;
  const look = Math.min(1, Math.max(Math.abs(yaw)/0.3, Math.abs(pitch)/0.25));
  for (const k in plates){ const pl = plates[k], here = +k === stop && !anim && pl.ready;
    const target = here ? 1 - smoothstep(0.35, 1, look) : 0;
    if (here && pl.a === 0) pl.t0 = now;
    const rate = target > pl.a ? 1.1 : 2.6; pl.a += Math.sign(target - pl.a) * Math.min(Math.abs(target - pl.a), dt*rate);
    pl.img.style.opacity = pl.a.toFixed(3);
    if (pl.a > 0 && !reduceMotion){ const z = 1 + Math.min(1, (now - pl.t0)/24000)*0.035;
      pl.img.style.transform = `translate(${(-yaw*3).toFixed(2)}%,${(pitch*3).toFixed(2)}%) scale(${z.toFixed(4)})`; } } }
```

## Photographic navigation
State to keep: `tr = {from, to, t0, dur, clip, fadeIn, pending}`, plus a `plates` map (img, ready) and a `clips` map (video, ready).
- **`go(i)`:** call `photoTransition(stop, i)` and use its duration for the camera animation, so readouts and labels stay in sync.
- **`photoTransition`:** for a forward move, use the clip that ends at the destination (`clips[to-1]`). If it's loaded, start it now; `fadeIn` is true when the jump is more than one step. If it isn't loaded, call `warmClip(to-1)` and hold on the current plate (`pending`) for up to 3 s. Otherwise use the dissolve.
- **Each frame:**
  - Resting: the current plate at opacity 1 with drift and drag pan.
  - Dissolve (`p` = progress): plate A fades out and pushes in (opacity `1 - smooth(0.1, 0.7, p)`, scale up to 1.18); plate B fades in from scale 1.14 (opacity `smooth(0.3, 0.9, p)`).
  - Clip: the video at opacity 1, or fading in over about 1.4 s if `fadeIn`.
  - Canvas: hide it (`opacity: 0`, which keeps pointer events) and skip `renderer.render` whenever plates or a clip cover the view. Treat the mid-dissolve state as covered as long as both plates are loaded.
- **Loading:** photos load on demand (current station, its neighbors, and the target on navigation). Clips preload under `(pointer:fine)`; otherwise only the clip leaving the current station.
- **Audio:** `preload="none"` on background music, so it doesn't download before the tap that starts it.

## Real-people cutouts in the 3D scene (three.js)
```js
const cutouts = [], shadowMat = new THREE.MeshBasicMaterial({color:'#000', transparent:true, opacity:0.4, depthWrite:false});
function cutout(file, x, y, z, h){ const g = new THREE.PlaneGeometry(1, 1); g.translate(0, 0.5, 0); // origin at the feet
  const mat = new THREE.MeshStandardMaterial({roughness:1, alphaTest:0.5, side:THREE.DoubleSide, emissive:new THREE.Color(1,1,1), emissiveIntensity:0.22});
  const m = new THREE.Mesh(g, mat); m.scale.set(h*0.36, h, 1); m.position.set(x, y, z); scene.add(m);
  new THREE.TextureLoader().load('people/' + file + '.webp', t => { t.encoding = THREE.sRGBEncoding; mat.map = t; mat.emissiveMap = t; mat.needsUpdate = true; m.scale.x = h*t.image.width/t.image.height; });
  const sh = new THREE.Mesh(new THREE.CircleGeometry(0.95, 24), shadowMat); sh.rotation.x = -Math.PI/2; sh.scale.y = 0.55; sh.position.set(x, y + 0.03, z); scene.add(sh);
  cutouts.push(m); return m; }
// each frame: face the camera around the vertical axis
cutouts.forEach(m => { m.rotation.y = Math.atan2(camera.position.x - m.position.x, camera.position.z - m.position.z); });
```
The small emissive term keeps faces readable under dim scene lights; point lights still shade them.

Add a `?3d` URL flag that skips the plates, so the live 3D can be checked on its own.

## Assets
- Web plates: JPEG at about q84, progressive, the generated resolution (usually 1280×720), about 150–250 KB each. Keep the originals in `concepts/`.
- Share image (`og.png`, 1200×630): crop the strongest plate and update `og:image:alt`.
- Labels positioned by 3D projection still line up as long as the plate kept the reference framing; check this in screenshots.

## Verify
- Headless Chromium with SwiftShader works for screenshots but runs at about 2 fps, so give each page 25–40 s and screenshot one station per page load.
- Check the plate opacity at rest (1) and after a drag (0) with `page.evaluate` on the img styles.
- Check a phone portrait viewport (390×844): `object-fit: cover` crops the center.
