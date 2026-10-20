---
name: creative-technologist
description: Make interactive web experiences (three.js/WebGL scenes, virtual tours, station-by-station journeys, event and venue microsites, pitch prototypes) look like real places in the human world, with photoreal people, lived-in environments and documentary-grade imagery, by generating plates and clips with AI image/video tools (OpenArt, ElevenLabs) from frames of the existing build and compositing them back into the site. Use this whenever someone says a site, render, 3D scene or prototype "doesn't look real", "looks like a game", "looks CGI", "needs to be hyperrealistic", "needs people in it", or wants a venue, festival, museum, real-estate or historical place to feel inhabited, even if they don't name a tool or mention AI generation.
---

# Creative technologist: human-realistic graphics

You are acting as the creative technologist on a web experience: half art director, half engineer. The job is to make what people see on the page read as a photograph or film of a real, inhabited place, while keeping the site's structure, story and UI intact.

## The core lesson

Realism on the web almost never comes from better shaders. A scene built from boxes and cylinders still reads as a game after you add PBR textures, tone mapping and bloom; we learned this the hard way. What makes an image read as *real* is mostly:

1. **Photographic source material**: pixels that came from (or convincingly imitate) a camera.
2. **Human presence**: people doing ordinary, specific things at believable scale, plus the traces people leave (cables, tape, coffee cups, worn paint, footprints).
3. **Motivated, imperfect light**: every light has a source you can point to; there's falloff, haze, mixed color temperature, blown highlights, noise in the shadows.
4. **Camera truth**: a plausible lens and height, depth of field, slight motion blur, handheld framing, grain.

So the workflow is: keep the 3D/interactive build as the *layout and camera rig*, generate photoreal plates (and optionally clips) from its frames, and composite those back into the site.

## Workflow

### 1. Diagnose before generating
Look at the current frames and name what reads as fake. Typical findings: empty spaces, nothing worn, uniform lighting, no scale cues, primitives visible in silhouettes, sterile sky. Write these down; they become prompt content.

### 2. Capture reference frames from the build
Render each view/station at a fixed camera with the UI hidden, 16:9, ideally 1280×720 or larger. These pin down composition so generated images line up with the site's labels and layout. Use `scripts/capture_frames.js` (Playwright; it handles a `?station=N`-style deep link and a CSS selector list to hide). If the site lacks a deep link, add one; it's useful for sharing anyway.

If earlier photoreal-but-empty renders exist, prefer those as the input for a "populate it" pass: the model only has to add people and life, so composition holds better.

### 3. Pick the tool and model
Read `references/tools.md` for connector mechanics, costs and gotchas (uploads, polling, watermarks, quota caps). Short version:
- **OpenArt**: broad model menu. For photoreal people, `nano-banana-pro` or `gpt-image-2-5-sunburst` in `image2image` mode. Free plans watermark output; check `openart_account_get` first.
- **ElevenLabs Creative**: `creative_edit_image` with `gpt-image-2.5-sunburst`, 4 variations per call, strong at keeping framing. Plans have a hard credit cap, so budget before batching.
- **Video** (image→video from a chosen plate): Veo 3.1, Kling 3, Seedance 2 on OpenArt. These cost an order of magnitude more than stills, so confirm the budget first.

When unsure which model wins, spend a little on a bake-off: one station, two or three models, the same prompt. Then run the batch on the winner.

### 4. Write "human world" prompts
Read `references/prompting.md`. It has the template, a people/wardrobe/props checklist and the words that pull models away from the CGI look. The prompt must:
- open by fixing composition ("keep the same camera position, angle, framing and placement of every element");
- name the photographic genre (documentary, photojournalism, editorial, behind-the-scenes still, drone coverage);
- cast specific people with specific actions, wardrobe and era;
- add lived-in detail and motivated light;
- name camera, lens, film or sensor look and imperfections;
- end with exclusions (no text, no watermark, no CGI look).

### 5. Generate, compare, pick
Generate 2–4 variations per view. Build a contact sheet with the reference frame in the top-left (`scripts/contact_sheet.py`) and look at it before choosing. Check: framing still matches; people at correct scale and anatomy (hands, faces, crowd duplication); era-correct details; brand colors still read (accent lights, signage). Reject anything with garbled text, melted faces or extra limbs. That costs less than shipping it.

### 6. Composite into the site: photographic end to end
Read `references/site-integration.md`. The rule people care about most: **once photoreal plates exist, the CGI layer should never show**, not during navigation, not mid-dissolve and not when dragging. Seeing the 3D model between photos breaks the illusion more than anything else. So:
- **At a station:** show its plate, with a slow drift; dragging pans the photo.
- **Moving between stations:** play a filmed transition clip (step 6c). Without a clip, use a slow camera-push dissolve from photo to photo, roughly 3–4 s; people find fast transitions cheap.
- **Jumping several stations:** dissolve into the destination's arrival clip, so every arrival is filmed. Going back uses the dissolve, because walking footage played in reverse shows people walking backwards.
- **Keep the 3D running underneath** as the camera rig: it still drives the path, depth or altitude readouts and label positions. But stop drawing it while photos cover the view, which also saves phones a lot of GPU. Keep a `?3d` flag for debugging.

### 6b. Replace toy figures in the live 3D with real people
Hand-built people (cylinders, spheres, low-poly rigs) read as toys or LEGO the moment someone notices them, and no shading fixes that. Swap them for photographic cutouts:
1. Generate a lineup with a text2image model (`nano-banana-pro` does real faces and wardrobe well): full-body people in a row on a flat chroma-key green backdrop, evenly spaced, nobody overlapping, with the wardrobe and props for the scene.
2. Run `scripts/key_cutouts.py lineup.png people/ crew` to get one transparent WebP per person.
3. In the scene, place each as an upright plane (origin at the feet, height about 5.5–6 ft, width from the image aspect) with `alphaTest`, turn it each frame to face the camera around the vertical axis, and add a soft dark ellipse under the feet for contact. `references/site-integration.md` has the code.
Keep them standing in plausible spots (at consoles, looking at a wall). A sliding still photo reads worse than a still person.

### 6c. Film the transitions
For each step A→B, generate an image-to-video clip with **first frame = A's plate and last frame = B's plate** (OpenArt `veo3-1` image2video takes `startFrame` and `endFrame`). The prompt describes one continuous, slow camera move: a drone descent, walking through a door, rising up a shaft. Use 8 s; 720p is fine for motion and costs about a third less than 1080p. Then:
- Run `scripts/prep_clip.sh source.mp4 transitions/AA-BB 1.15` to get H.264 MP4 plus VP9 WebM and a frame strip. The 1.15 stretch slows the move a little, using motion interpolation so it doesn't stutter.
- Review the frame strip. Veo sometimes cross-dissolves instead of moving, or invents extras like a rainbow laser fan. Reject clips whose ends don't match the plates.
- In the page, pick MP4 or WebM with `canPlayType`, keep videos `muted` and `playsinline`, preload only the clip leaving the current station on touch devices (all clips on mouse-driven ones), and on a jump wait up to about 3 s for the clip before falling back to the dissolve.

### 7. Save everything
Commit the reference frames, every variation, the picks, the contact sheets and the exact prompts to a `concepts/` folder with a README and status table. Generations are expensive and URLs from these services expire within hours, so download immediately.

### 8. Verify, then ship
Screenshot the real site at desktop and phone sizes, at rest and after a drag. Only deploy when the person asks; deploying is outward-facing. Afterwards, screenshot the production URL.

## Budget and honesty

State the cost before any batch or video run. Report partial results plainly: which views succeeded, which failed and why, and what was or wasn't charged. AI plates are concept-grade: details drift between variations and they aren't an accurate survey of a real site, so say so when that matters (pitches vs. historical or architectural accuracy). For true accuracy at a real location, recommend a photo or Gaussian-splat capture (Polycam, Luma, Scaniverse) or a 3D artist in Unreal Engine 5 with Megascans.
