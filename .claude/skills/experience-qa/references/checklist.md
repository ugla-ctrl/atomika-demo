# Experience QA checklist

Use it after the automated run. Every item is something a script can't fully judge; look at the screenshots.

## Mobile (emulated iPhone, Android, iPad, phone landscape)
- The main card or sheet fits; no text clipped by the screen edge, notch or home indicator (safe-area insets).
- Primary buttons reachable with a thumb, at least 44×44 px, not covered by other UI.
- No horizontal scroll. Nothing important hidden on small widths (if a rail or menu hides, there is another way to navigate).
- Landscape phone: the UI doesn't cover most of the view; text still readable.
- Background media framing still shows the subject after `object-fit: cover` crops it to portrait.
- Video: `muted` + `playsinline` set, so iOS plays it inline without a tap.
- Audio: starts only after a tap (iOS rule), and a visible control shows its state.

## Visual realism (for AI-generated plates, cutouts, clips)
- Anatomy: count hands, feet and fingers on anyone near the camera; look for duplicated people in crowds and melted faces.
- Text: no garbled lettering, fake logos or watermarks (free-plan tools watermark).
- Continuity: brand colors and key objects stay consistent from station to station; transitions start and end on the matching stills (no pop).
- Scale: people match their surroundings (doors, stairs, vehicles).
- Mixed media: no state where an untextured or low-poly fallback shows when it shouldn't (check mid-transition screenshots).

## Function
- Every deep link or route opens the right state.
- Next/Back or equivalent works from every state, including first and last.
- Labels and hotspots sit on the things they name.
- Reduced-motion users get a calm version (no drift, no long camera moves).
- Keyboard: Tab reaches controls in a sensible order; focus is visible.

## Performance and weight
- First load on mobile under about 15 MB before interaction; big media lazy-loaded.
- No single image over about 1 MB on a phone; video clips streamed, not preloaded all at once.
- Software-rendered headless WebGL is very slow (about 2 fps), so treat fps from it as meaningless; judge load weight and errors instead, and say plainly that real-device frame rate was not measured.

## Production
- Run against the real deployed URL after a deploy, not only localhost; confirm the new assets are actually served (no 404s, no stale cache).
- Social preview: the `og:image` URL loads, is 1200×630, and the title and description are right.
