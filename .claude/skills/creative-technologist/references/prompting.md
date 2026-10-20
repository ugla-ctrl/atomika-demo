# Prompting for human realism

## Template

Fill each slot; don't skip the people.

```
Re-render this exact scene as a [GENRE] photograph. Keep the same camera position, angle,
framing and the placement of every element exactly.
PLACE: [what it is, era, location, materials and their wear].
PEOPLE: [count and scale], [who they are], [what each group is doing], [wardrobe and era],
[expressions/body language: candid, mid-action, not posing].
LIFE: [props and traces of use: cables, tape, cups, bags, tools, footprints, signage that is
blurred or turned away].
LIGHT: [every source named: moon, work lamps, string lights, phone screens, flashlights,
fluorescents], mixed color temperatures, haze or dust where light passes.
CAMERA: [body and lens, height, aperture], [motion blur on moving people], [grain/noise level].
No readable text, no logos, no watermark, no CGI or 3D-render look, no plastic skin.
```

## Keep the real place real
Only describe what's in the reference frame. For a real site, add "keep the architecture, background and skyline exactly as in the render; do not add or move buildings or landmarks". Don't write in famous landmarks for atmosphere: if the bridge isn't in the render, it isn't in the prompt.

## Genres that read as real
- **Documentary / photojournalism**: candid, slightly imperfect framing, available light.
- **Behind-the-scenes production still**: crew, gear, cables, work lights.
- **Festival / event coverage, drone**: crowds at real scale, light trails, dust.
- **Editorial architecture with people**: clean but inhabited; people slightly blurred by long exposure.
- **Archival / historical recreation**: period film stock (Kodachrome, Tri-X), era-correct wardrobe and hairstyles.

## People checklist
- **Scale:** state it ("dozens of small figures", "three people in the mid-ground").
- **Roles:** staff, crew, guests, performers, security, vendors, photographers.
- **Actions:** queuing, pointing, filming on phones, carrying gear, mid-conversation, laughing, reading a map, adjusting a lamp. Give each group a different action so the crowd doesn't look cloned.
- **Wardrobe:** season, climate and era (desert night means jackets, beanies and headlamps; 1962 USAF means light-blue short-sleeve shirts, dark trousers, garrison caps).
- **Diversity** in age, build, skin tone and clothing; it is also a realism cue.
- **Faces:** keep them small, turned or partially lit; avoid close portraits unless that's the shot (AI faces at large size are where uncanny artifacts show).

## Anti-CGI vocabulary
Works: "shot on a full-frame camera with a 35mm lens", "high ISO grain", "slight motion blur", "available light", "handheld", "uneven exposure", "lens flare from the work light", "dust in the beam", "scuffed", "worn", "water-stained", "patina".
Avoid: "8k", "ultra detailed", "octane", "unreal engine", "masterpiece", "cinematic lighting" with no source; these push toward the render look.

## Keep the brand
Name brand colors as *physical light sources* (orange accent LED strip, cyan indicator lamps, laser colors) so they survive the photographic treatment.

## Worked example (ATOMIKA, The Entry)
> Re-render this exact scene as a documentary night photograph at a desert festival. Keep the same camera position, angle, framing and the placement of every element exactly. PLACE: the surface entry bulkhead of a decommissioned 1962 Atlas-F missile silo near Roswell, New Mexico, weathered off-white concrete with chipped paint and rust stains, a faded pink sloped wedge, a chain-link fence in the foreground. PEOPLE: a small group of festival guests in desert-night layers (puffer jackets, beanies, headlamps) queue at the doorway while a staff member in a reflective vest checks wristbands with a flashlight; two friends in the mid-ground take a phone photo of the bulkhead; distant figures walk between glowing tents. LIFE: a folding sign turned away from camera, a cable run taped to the gravel, a cooler, footprints in the caliche. LIGHT: moonlight from upper left, the cyan lamp over the door, warm string lights and headlamps on the horizon, faint dust in the flashlight beam. CAMERA: full-frame, 24mm at f/2.8, ISO 3200 grain, slight motion blur on walking people. No readable text, no logos, no watermark, no CGI look.
