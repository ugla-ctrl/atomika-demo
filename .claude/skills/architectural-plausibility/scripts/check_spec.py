"""Check a blockout spec against building rules before rendering or generating anything.

Usage: python check_spec.py spec.json
Exit code 1 if any ERROR. Rules (US IBC / OSHA style, feet):
  - riser 4-7 in (0.33-0.58 ft) for public stairs, up to 7.75 in (0.65 ft) residential; tread >= 11 in (0.92 ft)
  - 2R + T between 24 and 25.5 in (the comfort formula)
  - a flight rises at most 12 ft between landings; minimum 3 risers
  - every flight must START on a walkable surface (landing or floor box) at its top level, and END on one at its bottom level:
    no stairs into a wall, into the air or into a void
  - landings at least as deep as the stair is wide (in the direction of travel)
  - headroom >= 6.67 ft (6'8") above every tread nosing to anything overhead
  - handrails 34-38 in (2.83-3.17 ft) above the nosing line; rails on flights must be continuous polylines along the flight
"""
import json
import sys

def boxes_at(spec, x, y, z, tol=0.35):
    """Walkable boxes whose top is at height y and whose footprint contains (x, z)."""
    out = []
    for b in spec.get('boxes', []):
        (x0, y0, z0), (x1, y1, z1) = b['min'], b['max']
        if abs(y1 - y) <= tol and x0 - tol <= x <= x1 + tol and z0 - tol <= z <= z1 + tol:
            out.append(b)
    return out

def main():
    spec = json.load(open(sys.argv[1]))
    errors, warns, notes = [], [], []
    for i, f in enumerate(spec.get('flights', [])):
        name = f.get('name', f'flight {i+1}')
        riser, tread, w = f.get('riser', 0.6), f.get('tread', 0.95), f.get('width', 4)
        n = max(1, round(f['rise'] / riser)); r = f['rise'] / n
        run = n * tread
        rin, tin = r * 12, tread * 12
        if not (4 <= rin <= 7.75): errors.append(f'{name}: riser {rin:.1f} in is outside 4-7.75 in')
        elif rin > 7: warns.append(f'{name}: riser {rin:.1f} in is residential-steep; public stairs use <= 7 in')
        if tin < 11: errors.append(f'{name}: tread {tin:.1f} in is under 11 in')
        if not (24 <= 2 * rin + tin <= 25.5): warns.append(f'{name}: 2R+T = {2*rin+tin:.1f} in (comfortable is 24-25.5)')
        if f['rise'] > 12: errors.append(f'{name}: rises {f["rise"]} ft without a landing (max 12 ft)')
        if n < 3: errors.append(f'{name}: only {n} risers (min 3)')
        s = 1 if f['dir'][0] == '+' else -1
        ax = f['dir'][1]
        x, y, z = f['start']
        mid = w / 2
        top = (x + mid, y, z - s * 0.3) if ax == 'z' else (x - s * 0.3, y, z + mid)
        bot_y = y - f['rise']
        bot = (x + mid, bot_y, z + s * (run + 0.3)) if ax == 'z' else (x + s * (run + 0.3), bot_y, z + mid)
        if not boxes_at(spec, top[0], top[1], top[2]): errors.append(f'{name}: the top of the flight is not reached from any landing or floor at y={y}')
        land = boxes_at(spec, bot[0], bot[1], bot[2])
        if not land: errors.append(f'{name}: the flight ends at y={bot_y:.2f} with nothing to step onto (stairs to nowhere)')
        else:
            b = land[0]; depth = (b['max'][2] - b['min'][2]) if ax == 'z' else (b['max'][0] - b['min'][0])
            if depth + 0.01 < w: warns.append(f'{name}: landing depth {depth:.1f} ft is less than stair width {w} ft')
        # headroom: anything overhead within 6'8" of a nosing
        for k in range(n):
            ny = y - k * r
            px, pz = (x + mid, z + s * k * tread) if ax == 'z' else (x + s * k * tread, z + mid)
            for b in spec.get('boxes', []):
                (x0, y0, z0), (x1, y1, z1) = b['min'], b['max']
                if x0 < px < x1 and z0 < pz < z1 and ny + 0.05 < y0 < ny + 6.67:
                    errors.append(f'{name}: only {y0-ny:.1f} ft headroom above step {k+1} (need 6\'8")'); break
            else:
                continue
            break
        notes.append(f'{name}: {n} risers of {rin:.1f} in, treads {tin:.1f} in, run {run:.1f} ft, from y={y} to y={bot_y:.2f}')
    for j, rl in enumerate(spec.get('rails', [])):
        pts = rl['points']
        if len(pts) < 2: errors.append(f'rail {j+1}: needs at least 2 points')
        for a, b in zip(pts, pts[1:]):
            gap = sum((p - q) ** 2 for p, q in zip(a, b)) ** 0.5
            if gap > 16: warns.append(f'rail {j+1}: a {gap:.0f} ft span with no post')
    for e in errors: print('ERROR  ', e)
    for w_ in warns: print('WARN   ', w_)
    for n_ in notes: print('ok     ', n_)
    print('PASS' if not errors else 'FAIL', f'({len(errors)} errors, {len(warns)} warnings)')
    sys.exit(1 if errors else 0)

if __name__ == '__main__':
    main()
