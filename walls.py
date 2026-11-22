"""Muros reales: distancia del eje de la pista a la primera barrera real (vallas, muros y guardarraíles de OSM, edificios, agua)
a cada lado, punto a punto. Salida: /tmp/walls.json  {key: {"n": N, "w": [[i, dm, i, dm, ...] izquierda, [...] derecha], "cov": [izq, der]}}
Los valores son la distancia al eje en decímetros; -1 = sin dato (se usa el muro por defecto).
Uso: python3 walls.py [Track ...]"""
import json, glob, sys, math
import numpy as np
from shapely.geometry import LineString, Point, Polygon
from shapely.strtree import STRtree

s = open(glob.glob('/home/claude/pages/a/data.*.js')[0]).read()
i = s.find('window.REAL_TRACKS='); j = s.find(';window.', i + 5)
TT = json.loads(s[i + 19:j])
KEYS = sys.argv[1:] or [t['key'] for t in TT]
STREET = {'Monaco'}
RMAX = 150.0
out = {}
for T in TT:
    KEY = T['key']
    if KEY not in KEYS or KEY in STREET: continue
    W = json.load(open(glob.glob('/home/claude/pages/t/w_%s.*.json' % KEY)[0]))
    x = np.array(T['x'], float); y = np.array(T['y'], float); n = len(x); hw = float(T['hw'])
    seg = np.hypot(np.roll(x, -1) - x, np.roll(y, -1) - y); ds = float(np.mean(seg))
    dx = np.roll(x, -1) - np.roll(x, 1); dy = np.roll(y, -1) - np.roll(y, 1); L = np.hypot(dx, dy); tx, ty = dx / L, dy / L
    nx, ny = -ty, tx
    # curvatura con signo (positiva: gira a la izquierda), suavizada
    hd = np.unwrap(np.arctan2(ty, tx)); curv = (np.roll(hd, -1) - np.roll(hd, 1)); curv = (curv + np.pi) % (2 * np.pi) - np.pi; curv = curv / (2 * ds)
    curv = np.convolve(np.r_[curv[-3:], curv, curv[:3]], np.ones(7) / 7, 'valid')
    cmax = np.array([max(abs(curv[(k + q) % n]) for q in range(-4, 5)) * np.sign(curv[k]) if abs(curv[k]) > 1e-5 else 0 for k in range(n)]); curv = cmax
    G = []
    for f in W.get('fence', []):
        pts = [(f[2 + 2 * q] * .1, f[3 + 2 * q] * .1) for q in range((len(f) - 2) // 2)]
        if len(pts) >= 2: G.append(LineString(pts))
    NF = len(G)
    for b in W.get('b', []):
        pts = [(b[3 + 2 * q] * .1, b[4 + 2 * q] * .1) for q in range((len(b) - 3) // 2)]
        if len(pts) >= 3: G.append(LineString(pts + [pts[0]]))
    for w in W.get('w', []):
        pts = [(w[2 * q] * .1, w[2 * q + 1] * .1) for q in range(len(w) // 2)]
        if len(pts) >= 3: G.append(LineString(pts + [pts[0]]))
    tree = STRtree(G)
    cl = [(float(a), float(b)) for a, b in zip(x, y)]
    EDGE = hw + 1.6; DMIN = EDGE + 2.6; DEF = hw + 17.0
    res = []
    for sd in (1, -1):
        d = np.full(n, np.nan); fz = np.full(n, np.nan)
        for k in range(n):
            a = (x[k] + nx[k] * sd * hw * .9, y[k] + ny[k] * sd * hw * .9); b = (x[k] + nx[k] * sd * RMAX, y[k] + ny[k] * sd * RMAX)
            ray = LineString([a, b]); best = None; bnd = None; P0 = Point(x[k], y[k])
            for idx in tree.query(ray):
                g = G[idx]
                if g.intersects(ray):
                    dd = P0.distance(g.intersection(ray))
                    if idx < NF:
                        if best is None or dd < best: best = dd
                    elif bnd is None or dd < bnd: bnd = dd
            fz[k] = np.nan if best is None else best
            # edificios y agua: el muro nunca queda más allá (pero no lo alejan del valor por defecto)
            if bnd is not None and (best is None or bnd - 1.5 < best) and (best is not None or bnd - 1.5 < DEF): best = bnd - 1.5
            # otro tramo del propio circuito al mismo lado: el muro queda antes de él
            other = None
            for q in range(0, n, 2):
                dq = min((q - k) % n, (k - q) % n)
                if dq * ds < 120: continue
                vx, vy = x[q] - x[k], y[q] - y[k]
                lat = (vx * nx[k] + vy * ny[k]) * sd; lon = vx * tx[k] + vy * ty[k]
                if lat > 0 and abs(lon) < 6 and lat < RMAX:
                    if other is None or lat < other: other = lat
            if other is not None:
                lim = max(DMIN, other - hw - 6) if other - hw - 6 < other / 2 else other / 2
                lim = max(DMIN, min(lim, other / 2))
                best = lim if best is None else min(best, lim)
            # por dentro de una curva el muro no puede pasar del centro de giro (la línea desplazada se plegaría sobre sí misma)
            kk = curv[k] * sd
            if kk > 1e-4:
                rin = max(hw + 3.0, 0.72 / kk)
                best = rin if best is None else min(best, rin)
            if best is not None: d[k] = min(max(best, min(DMIN, max(hw + 3.0, 0.72 / kk) if kk > 1e-4 else DMIN)), 125.0)
        # lado poco cartografiado (menos del 60 % con valla): las vallas lejanas no son de fiar, solo valen las que acercan el muro
        fcov = float((~np.isnan(fz)).mean())
        if fcov < .6:
            d[d > DEF] = np.nan
        known = ~np.isnan(d); cov = float(known.mean())
        # rellenar huecos cortos (< 200 m) interpolando entre vecinos conocidos; los largos quedan sin dato
        if known.any():
            idx = np.where(known)[0]
            for a, b in zip(idx, np.roll(idx, -1)):
                gap = (b - a) % n
                if gap > 1 and gap * ds <= 200:
                    for q in range(1, gap): d[(a + q) % n] = d[a] + (d[b] - d[a]) * q / gap
        # mediana de 5 puntos (quita rayos que se cuelan por un hueco) y pendiente máxima de 45° (los muros no hacen picos)
        m = d.copy()
        for k in range(n):
            w5 = [d[(k + q) % n] for q in range(-2, 3)]; w5 = [v for v in w5 if not np.isnan(v)]
            if len(w5) >= 3 and not np.isnan(d[k]): m[k] = float(np.median(w5))
        d = m
        for _ in range(2):
            for k in list(range(n)) + list(range(n - 1, -1, -1)):
                for q in (-1, 1):
                    v = d[(k + q) % n]
                    if not np.isnan(v) and not np.isnan(d[k]) and d[k] > v + ds: d[k] = v + ds
            for k in range(n - 1, -1, -1):
                v = d[(k + 1) % n]
                if not np.isnan(v) and not np.isnan(d[k]) and d[k] > v + ds: d[k] = v + ds
        res.append((d, fcov))
    # simplificación: puntos de quiebro (tolerancia 0,4 m)
    enc = []
    for d, cov in res:
        v = [(-1 if np.isnan(q) else int(round(q * 10))) for q in d]
        keep = [0]
        for k in range(1, n - 1):
            a = keep[-1]
            if v[k] < 0 or v[a] < 0 or v[k + 1] < 0:
                if v[k] != v[a] or v[k + 1] != v[k]: keep.append(k)
                continue
            # ¿se puede saltar k interpolando entre a y k+1?
            ok = True
            for q in range(a + 1, k + 1):
                it = v[a] + (v[k + 1] - v[a]) * (q - a) / (k + 1 - a)
                if abs(it - v[q]) > 4: ok = False; break
            if not ok: keep.append(k)
        keep.append(n - 1)
        e = []
        for k in keep: e += [k, v[k]]
        enc.append(e)
    out[KEY] = {'n': n, 'w': enc, 'cov': [round(res[0][1], 2), round(res[1][1], 2)]}
    dl = res[0][0]; dr = res[1][0]
    print(KEY.ljust(12), 'n', n, 'ds %.1f' % ds, 'hw', hw, 'cobertura izq/der %.0f%% / %.0f%%' % (res[0][1] * 100, res[1][1] * 100),
          'mediana %.0f / %.0f m' % (np.nanmedian(dl), np.nanmedian(dr)), 'máx %.0f / %.0f' % (np.nanmax(dl), np.nanmax(dr)),
          'por defecto', DEF, 'puntos', len(enc[0]) // 2, len(enc[1]) // 2, flush=True)
json.dump(out, open('/tmp/walls.json', 'w'), separators=(',', ':'))
print('bytes', len(json.dumps(out, separators=(',', ':'))))
