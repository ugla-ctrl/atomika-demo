---
name: architectural-plausibility
description: Make built spaces in generated or modeled imagery physically correct, with stairs that connect floors, continuous handrails, roofs and canopies that are held up, columns and beams with real load paths, and doors and corridors that lead somewhere. Plan the layout as a measured spec, check it against building rules, render a clean geometry blockout, and give that blockout to the image or video model as the structural reference instead of describing the layout in words. Use this whenever an AI image, video, render or 3D scene contains stairs, ramps, landings, balconies, mezzanines, canopies, vehicles with roofs, structural frames or any multi-level interior, and whenever someone says a space looks wrong, "goes nowhere", "floats", "isn't engineered", "impossible geometry" or "broken", even if they don't mention architecture.
---

# Architectural plausibility

Image and video models draw surfaces, not buildings. They produce stairs that climb into walls, handrails that end in mid-air, canopies without posts and landings that connect to nothing. Viewers notice immediately, even if they can't say why. Words alone don't fix it, and a second "please make the stairs logical" edit usually moves the error somewhere else. What works is to **decide the geometry yourself, check it, render it, and make the model follow the picture**.

## 1. Find every structural claim in the frame
Before editing, list what the image asserts about how the place is built:
- **Vertical circulation:** each stair, ramp or ladder. Where does it start, where does it end, up or down?
- **Edges:** every drop over about 30 in needs a guard; every stair needs a handrail.
- **Support:** every roof, canopy, slab, balcony, beam or sign. What holds it, and does that reach the ground?
- **Openings:** every door, hatch or corridor leads to a space you could walk into.
- **Scale cues:** risers about 7 in, doors about 7 ft, rails about 36 in, ceilings about 8–10 ft. People stand on surfaces, not in them.

Use `references/rules.md` for the numbers and the failure catalog (stairs to nowhere, Escher stairs, floating canopies, orphan columns, half rails).

## 2. Write the layout as a measured spec
Describe the space as a JSON spec (feet, +y up): boxes for slabs, landings, walls, columns and beams; flights with start, direction, width, rise, riser and tread; rails as polylines; and the camera. `examples/silo-stair-shaft.json` is a worked switchback stair seen from above.

Pick the simplest arrangement that matches the place:
- **Half-story switchback** for shafts. Two flights of about 5 ft each, with a mid-landing at the far wall.
- **Straight run** for entries.
- **L-shaped** stair when a corner is in view.

If the real building is documented, follow the drawings or photos.

## 3. Check it
Run `python scripts/check_spec.py spec.json`. It fails on:
- risers or treads outside code;
- flights that don't start from, or land on, a walkable surface;
- headroom under 6 ft 8 in;
- flights over 12 ft without a landing.

Fix the spec until it passes. This is the cheap step; a failed generation costs credits.

## 4. Render a blockout from the image's camera
Run `node scripts/render_blockout.js spec.json blockout.png 1600x900`. It produces matte grey geometry with dark rails and edges, from the same viewpoint as the shot. Match the camera to the photo by eye: put the landing edge, the far wall and the main flight in roughly the same places in the frame. Look at it and make sure a stranger could walk the route.

## 5. Generate with the blockout as the structural reference
Send **two references**: first the blockout ("the architecture: follow this geometry exactly"), then the existing photo ("everything else: people, wardrobe, materials, light, grain, camera"). In the prompt:
- describe the route in plain words matching the spec ("the flight descends away from camera along the right wall to a landing at the far wall, then turns and continues down along the left");
- name what must be continuous (rails, stringers) and what must be supported (posts to the floor);
- say what must not appear (no step into a wall, no rail ending in the air).

Edit-style models (GPT Image 2.5, Nano Banana Pro) accept several references; say which is which.

## 6. Verify like an inspector
Zoom into the result and trace the route with your eyes:
- Every step is lower than the one before in the direction of travel.
- Each flight lands on something.
- Rails are continuous and mounted.
- Nothing overhead is unsupported.
- People's feet are on treads, and their hands are on the rails, attached to natural arms.

Then make sure the people still match the reference. If something is still wrong, change the **spec or blockout** and regenerate. Don't stack word-only edits.

## 7. Keep video consistent
For transitions, use the corrected still as the first or last frame and say in the prompt that the structure stays in place for the whole shot ("the central column stays in view and does not disappear"). A clip filmed from an uncorrected still carries the flaw, so fix stills before filming.
