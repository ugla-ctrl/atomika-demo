# Rules and failure catalog

## Stairs (US IBC commercial, feet and inches)
| Item | Rule |
|---|---|
| Riser | 4–7 in (residential up to 7.75 in); uniform within a flight (±3/8 in) |
| Tread | ≥ 11 in nosing to nosing |
| Comfort formula | 2R + T = 24–25.5 in (7 in riser + 11 in tread = 25) |
| Flight | ≥ 3 risers; ≤ 12 ft of rise between landings |
| Width | ≥ 44 in public (36 in small occupancy); a service stair in a shaft is often 36–48 in |
| Landing | at top and bottom of every flight; depth in the direction of travel ≥ stair width |
| Headroom | ≥ 6 ft 8 in measured vertically from the nosing line |
| Handrail | 34–38 in above the nosings, both sides; continuous along the flight; returns to wall or post at ends; extends 12 in past the top riser |
| Guard | 42 in where the drop is over 30 in, e.g. open sides of landings and the stair well |
| Industrial or military | steeper ship-ladder stairs exist (riser up to 9 in), but they still land on platforms and have rails both sides |

**Switchback (U-shaped) stair:** two flights side by side, running in opposite directions, linked by a full-width mid-landing at the turn. Seen from the top landing, one flight goes down away from you; the other comes back toward you below it, and you see it through the well. The inner rails of both flights meet at the well edge of the mid-landing.

## Structure
- Every roof, canopy or slab is held up by posts, walls or hangers that visibly reach a foundation, floor or wall. Golf carts and gazebos have 4 posts. Cantilevers are short and look heavy.
- Columns sit on something and carry something (a beam, slab or capital). They don't stop in mid-air or under nothing.
- Beams span between supports. Long spans are deep.
- Doors are about 7 ft tall, swing into a space, and have a frame. Blast doors are thick, hinge on heavy pins and sit in a deep frame.

## Failure catalog (what models get wrong)
| Failure | Looks like | Fix in the spec |
|---|---|---|
| Stairs to nowhere | a flight climbs or descends into a wall, ceiling or void | add the landing it ends on, and the doorway or next flight |
| Escher stair | steps go up in both directions, or the top and bottom levels don't match | give each flight a start level and a rise; the end level is start − rise |
| Half rail | a handrail ends in mid-air or dives into a step | rails as continuous polylines with posts to the floor |
| Floating canopy | a roof with no posts (carts, kiosks, bus shelters) | posts at the corners, down to the frame or ground |
| Orphan column | a column that supports nothing, or stands on nothing | connect it to the slab above and the floor below |
| Phantom level | a landing with no way on or off | every walkable surface connects to a stair, door or floor |
| Broken limb on a rail | a hand on the rail, attached to a bent or doubled arm | place the rail at hand height (34–38 in) in the spec, and ask for "natural arm, hand on the rail in front of the body" |
| Scale drift | 2 ft risers, 4 ft doors, people taller than doorways | check risers, doors and rail heights against people |
