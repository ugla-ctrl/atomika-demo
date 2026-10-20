# Hyperreal concepts

AI re-renders of the Enter the Silo stations, made to settle the photoreal look before building it. Not loaded by the site.

## How they were made

1. `reference/` holds a clean frame of each station from the 3D build (`index.html`, branch `hyperreal-render`), rendered at 1280×720 with the UI hidden.
2. Each frame went into an image-edit model with a prompt that keeps the camera, framing and layout and asks for a hyperrealistic photograph.
3. ElevenLabs: model `gpt-image-2.5-sunburst`, 4 variations per station, about 433 credits ($0.16) per image. All runs are on the ElevenLabs flow "ATOMIKA – Enter the Silo hyperreal": https://elevenlabs.io/app/flows/d3D3j12MO7auFwVICTEK
4. OpenArt: Kling 3 Omni image-to-image, used once (Roswell). The free plan adds a watermark.

## Folders

- `reference/`: the 3D frame for all 11 stations.
- `renders/<station>/`: every variation, at full resolution.
- `picks/`: the best variation per station.
- `contact-sheets/`: reference frame (top left) next to all variations, plus before/after sheets.

## Status

The live site uses the **people pass** (OpenArt, GPT Image 2.5 Sunburst at 2K high quality, 172 credits per image) for all 11 stations: `renders/<station>/openart-gpt-image-2.5-people.png`, web copies in `../stations/`. The earlier, empty ElevenLabs renders are kept alongside for reference.

The people in the live 3D (crew on Level −1, visitors on Level −2) are real-person cutouts: Nano Banana Pro lineups on green (`people/crew-sheet.png`, `people/visitors-sheet.png`) keyed into `../people/*.webp` with `.claude/skills/creative-technologist/scripts/key_cutouts.py`.

The people-pass prompts follow the template in `.claude/skills/creative-technologist/references/prompting.md` and name the people, their actions, wardrobe, props, light sources and camera for each station. The prompts below are the first (empty-scene) pass.

## Transitions

`transitions/` holds a filmed clip for every step of the journey (10 clips). Each was made on OpenArt with Veo 3.1 image-to-video, lite tier, 8 s at 720p, no audio (160 credits each; the Entry to Stair Shaft test was 4 s at 1080p, 120 credits). The first frame is pinned to the station photo you leave and the last frame to the one you arrive at, so there is no jump at either end. Each was then stretched 1.15× with motion interpolation (1.75× for the 4 s test) and encoded as H.264 MP4 and VP9 WebM with `.claude/skills/creative-technologist/scripts/prep_clip.sh`. Originals are in `transitions/` here.

## Prompts

Every prompt is sent with that station's `reference/` frame wired in as the image to edit.

**01 Roswell** (run on OpenArt Kling 3 Omni)
> Re-render this exact scene as a hyperrealistic aerial night photograph taken from an airplane window at 22,000 feet over the New Mexico high desert. Keep the same camera angle, framing and layout. The city of Roswell glows as a dense grid of warm sodium-orange and white street lights in the lower right, with a highway of headlights running diagonally toward the north. Far away near the top, a thin vertical bundle of colored lasers (cyan, blue, warm white, amber) rises straight up from a tiny point in the dark desert. The dark rolling desert terrain is faintly lit by moonlight, showing dry washes and ridges. Sky: deep clear night with a dense, realistic star field and the faint Milky Way, a thin layer of atmospheric haze at the horizon with an orange light dome over the city. Natural color, realistic long-exposure look, subtle grain, no CGI, no text.

**02 The Approach**
> Re-render this exact scene as a hyperrealistic aerial night photograph taken from a small aircraft at about 1,500 feet altitude. Keep the same camera position, angle, framing and the placement of every element. The vast dark New Mexico high desert stretches to the horizon, faintly lit by cool moonlight, showing dry washes, low rises, scattered creosote scrub and dirt tracks. In the center distance, a remote decommissioned Atlas-F missile silo site, with a tight bundle of colored concert lasers (cyan, deep blue, warm white, amber) rising straight up from it into the sky through faint haze. Around it, small clusters of warm festival lights, tents and a white geodesic dome. A thin line of road lights runs toward the horizon. Clear night sky with a dense, realistic star field, faint Milky Way and a soft orange light dome from a distant town on the horizon. Natural color, realistic exposure, subtle grain, no CGI look, no text.

**03 Festival Grounds**
> Re-render this exact scene as a hyperrealistic aerial night photograph from a drone at about 560 feet, like real festival coverage. Keep the same camera position, angle, framing and the placement of every element exactly. A desert music-and-ideas festival in the New Mexico high desert around a decommissioned missile silo. Keep every area where it is: the main Twistflower Stage with an illuminated arch truss and crescent-shaped light trusses; a 70-foot white geodesic Stardome glowing softly from inside; the Base Camp, a ring of white food and vendor tents around a lit gathering circle; and five round camps of camping tents, RVs and small white shift pods, each ringed by a thin blue-lit path. Gravel paths connect them across dark desert scrub. From the silo, a bundle of colored lasers (cyan, blue, warm white, amber) beams straight up. Warm string lights, people-scale detail, real camping gear, faint dust haze in the light. Cool moonlight on the desert, clear starry sky. Natural color, realistic exposure, subtle grain, no CGI look, no text or labels.

**04 The Site**
> Re-render this exact scene as a hyperrealistic night photograph from a drone at about 150 feet, looking down at an angle. Keep the same camera position, angle, framing and the placement of every element exactly. The surface of a decommissioned 1962 Atlas-F missile silo site in the New Mexico high desert: a round weathered concrete silo cap with two massive gray steel door leaves propped open, a tight bundle of colored lasers (cyan, deep blue, warm white, amber) rising straight up out of the shaft; a small concrete stairwell entry bulkhead painted off-white with a faded pink sloped wedge; a round escape-hatch cap and a small antenna-silo cap set in the gravel; a rectangular concrete pad; a cracked asphalt access road; a chain-link security fence perimeter. Pale caliche gravel, dry grass and dark creosote bushes all around, faint tents and blue-lit paths at the edge of frame. Cool moonlight with soft shadows, clear starry sky at the top. Natural color, realistic exposure, subtle grain, no CGI look, no text or labels.

**05 The Entry**
> Re-render this exact scene as a hyperrealistic night photograph, as if shot on a full-frame camera with a 24mm lens on a tripod. Keep the same camera position, angle, framing and layout of every object. The subject: the surface entry bulkhead of a decommissioned 1962 Atlas-F missile silo (the Twistflower site near Roswell, New Mexico). It is a weathered cast-concrete portal painted off-white with chipped paint and rust stains, a dark steel blast door recessed inside, and a small cyan indicator lamp above the door. A sloped concrete wedge painted faded pink runs back to grade behind it. In the foreground, a galvanized chain-link security fence on steel posts with a top rail, slightly out of focus. High-desert ground of pale caliche gravel, dry grama grass tufts and dark creosote bushes. Distant festival camp tents and a few warm work lights on the flat horizon. Sky: deep clear New Mexico night with a dense, realistic star field and the faint Milky Way, cool moonlight from upper left casting a long soft shadow of the bulkhead across the gravel. Natural color, subtle film grain, realistic exposure and noise, no CGI look, no text, no people.

**06 The Stair Shaft**
> Re-render this exact scene as a hyperrealistic photograph. Keep the same camera position, angle, framing and the placement of every element exactly. Inside the reinforced concrete stair shaft of a 1962 Atlas-F missile silo, just past the blast doors: board-formed gray concrete walls with water stains, efflorescence and scuffs; steel switchback stairs with diamond-plate treads, worn and rust-brown at the edges, and painted steel pipe handrails; a heavy steel blast-door frame with a painted orange safety stripe; bare caged incandescent bulbs and conduit on the walls casting warm pools of light and hard shadows. Dusty air with faint light falloff. Realistic color, photographic depth of field, film grain, no CGI look, no text.

**07 Launch Control, 1962**
> Re-render this exact scene as a hyperrealistic photograph, like a historical-reenactment film still. Keep the same camera position, angle, framing and the placement of every object. The subject: the upper level of a circular underground Launch Control Center in a 1962 Atlas-F missile silo. A ring of period control consoles in gray-green painted steel with chunky toggle switches, round analog dials, rows of red, amber, white and cyan indicator lamps, and small green-phosphor CRT oscilloscope screens with glowing traces. A thick white-painted concrete central column flares into a wide mushroom capital at the curved ceiling, with a thin orange accent light strip tracing the ceiling ring. Fluorescent tube fixtures in the ceiling cast cool even light. Worn polished concrete floor with scuffs and reflections. Curved off-white painted concrete walls with slight water staining. Atmosphere slightly hazy, realistic color, film grain, accurate period detail, no CGI look, no text overlays.

**08 Deep Space** (not yet rendered)
> Re-render this exact scene as a hyperrealistic photograph of an immersive art installation. Keep the same camera position, angle, framing and the placement of every element exactly. The lower level of a circular underground launch control center in an old missile silo, converted into a 360-degree projection room: the curved concrete walls are covered edge to edge by projected imagery of deep space, glowing blue and cyan nebulae, a large blue planet, a small moon and dense stars. A thick concrete central column flares into a wide mushroom capital at the ceiling, lit cool blue by the projection. A few visitors in dark street clothes stand silhouetted, looking up at the walls. Dark polished floor reflecting the projections, faint haze in the projector light. Realistic exposure for a dark room, photographic noise, no CGI look, no text.

**09 The Tunnel** (not yet rendered)
> Re-render this exact scene as a hyperrealistic photograph. Keep the same camera position, angle, framing and the placement of every element exactly. A 40-foot cylindrical tunnel of corrugated galvanized steel inside a 1962 Atlas-F missile silo, running from the stair shaft to the silo, with heavy steel ring frames, bolted seams, patches of rust and grime, and cable trays. A steel-plate walkway runs along the floor. Cold cyan-white fluorescent fixtures along the ceiling, small amber marker lights at each ring frame, and a heavy blast-door vestibule at the far end glowing bright from the silo beyond. Slight haze, realistic light falloff and reflections on the metal. Natural color, photographic depth, film grain, no CGI look, no text.

**10 The Silo** (not yet rendered)
> Re-render this exact scene as a hyperrealistic photograph. Keep the same camera position, angle, framing and the placement of every element exactly. Looking straight down through a steel bar-grating platform into the shaft of a 1962 Atlas-F missile silo, 174 feet deep and 52 feet across. Massive stained reinforced-concrete walls with horizontal concrete ring ledges at intervals, rust streaks and water stains. Small warm amber and cool cyan work lamps on the walls. At the very bottom, an intense cyan glow where concert lasers start, beams rising up through faint haze and dust. The grating in the foreground is worn galvanized steel. Dramatic depth and scale, realistic exposure, photographic noise, no CGI look, no text.

**11 Through the Doors**
> Re-render this exact scene as a hyperrealistic night photograph taken from a low drone at about 60 feet. Keep the same camera position, angle, framing and layout. The subject: the open silo doors of a decommissioned Atlas-F missile silo in the New Mexico high desert. A round weathered concrete silo cap with a rectangular opening; two massive steel door leaves, each about 75 tons, propped fully open on their hinges, painted gray with peeling paint, rust streaks and a thin orange safety stripe. From deep inside the shaft, a tight bundle of colored concert lasers (cyan, deep blue, warm white, amber) blasts straight up into the sky, glowing through faint dust and haze, lighting the inner edge of the concrete. Around the cap: pale caliche gravel, dry grass and dark creosote scrub fading into darkness, a chain-link fence line in the distance. A clear night sky with a dense, realistic star field and faint Milky Way. Natural color, realistic exposure, subtle film grain, no CGI look, no text.
