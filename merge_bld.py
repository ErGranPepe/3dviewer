"""Mezcla edificios de datos abiertos (Overture Maps / 3D BAG) en t/w_<Track>.json.
Uso: python3 merge_bld.py <Track> <ovt.json> [bag.json]   -> escribe /tmp/w_<Track>.json y lo publica con pubworld.py
- Ajusta alturas de los edificios de OSM sin altura cuando la fuente abierta trae altura o plantas.
- Añade huellas reales (Microsoft/Google/Esri…) que faltan en OSM.
- Guarda tejado (forma, color, altura) y fachada (color, material) en WD.bx (alineado con WD.b).
"""
import json, math, sys, glob, re
import numpy as np
from shapely.geometry import Polygon, Point
from shapely.strtree import STRtree
from shapely.validation import make_valid

KEY, OVT = sys.argv[1], sys.argv[2]
BAG = sys.argv[3] if len(sys.argv) > 3 else None
XF = json.load(open('/home/claude/src/xf.json'))[KEY]
WF = f'/home/claude/src/w_orig/w_{KEY}.json'
W = json.load(open(WF))

A = 6378137.0; f = 1 / 298.257223563; e2 = f * (2 - f)
def ecef(la, lo, h=0.0):
    la, lo = np.radians(la), np.radians(lo); N = A / np.sqrt(1 - e2 * np.sin(la) ** 2)
    return np.stack([(N + h) * np.cos(la) * np.cos(lo), (N + h) * np.cos(la) * np.sin(lo), (N * (1 - e2) + h) * np.sin(la)], -1)
L0, G0 = math.radians(XF['la']), math.radians(XF['lo'])
O = ecef(XF['la'], XF['lo'])
MX = np.array([[-math.sin(G0), math.cos(G0), 0], [-math.sin(L0) * math.cos(G0), -math.sin(L0) * math.sin(G0), math.cos(L0)]])
R = np.array(XF['R']); S = XF['s']; T = np.array(XF['t'])
def to_local(lonlat):
    a = np.asarray(lonlat, float)
    en = (ecef(a[:, 1], a[:, 0]) - O) @ MX.T
    return ((en - T) @ R) / S          # Q = R^T (EN - t) / s

def poly_of_b(b):
    n = (len(b) - 3) // 2
    pts = [(b[3 + 2 * q] * .1, b[4 + 2 * q] * .1) for q in range(n)]
    if n < 3: return None
    p = Polygon(pts)
    if not p.is_valid: p = make_valid(p).buffer(0)
    return p if not p.is_empty and p.area > 0.5 else None

old = W['b']
oldP = [poly_of_b(b) for b in old]
idx = [i for i, p in enumerate(oldP) if p is not None]
tree = STRtree([oldP[i] for i in idx])

ROOF = {'flat': 1, 'gabled': 2, 'hipped': 3, 'pyramidal': 4, 'half-hipped': 3, 'skillion': 5, 'dome': 6, 'onion': 6, 'round': 7,
        'gambrel': 2, 'mansard': 3, 'saltbox': 2, 'spherical': 6}
def hexcol(c):
    if not c: return None
    c = str(c).strip().lower()
    NAMED = {'white': '#f2f0ea', 'grey': '#9a9a96', 'gray': '#9a9a96', 'red': '#a5452f', 'brown': '#7a5236', 'black': '#2b2b2b', 'beige': '#d9c9a5',
             'yellow': '#e3c766', 'orange': '#d98a46', 'pink': '#d9a3a0', 'green': '#6d8b5a', 'blue': '#5b7fa8', 'darkgrey': '#555', 'lightgrey': '#c9c9c5',
             'cream': '#efe5c9', 'ochre': '#c99a4b', 'terracotta': '#b5603d', 'silver': '#c0c0c0', 'maroon': '#6b2e2a', 'tan': '#c9a77c'}
    if c in NAMED: return NAMED[c]
    if re.fullmatch(r'#?[0-9a-f]{6}', c): return '#' + c.lstrip('#')
    if re.fullmatch(r'#?[0-9a-f]{3}', c): c = c.lstrip('#'); return '#' + ''.join(ch * 2 for ch in c)
    return None
MAT = {'brick': 1, 'glass': 2, 'concrete': 3, 'plaster': 4, 'stone': 5, 'metal': 6, 'wood': 7, 'cement_block': 3, 'timber_framing': 7, 'plastic': 3,
       'roof_tiles': 8, 'tile': 8, 'tiles': 8, 'slate': 9, 'copper': 10, 'tar_paper': 11, 'eternit': 11, 'asbestos': 11, 'grass': 12, 'thatch': 12, 'gravel': 11}

OV = json.load(open(OVT))
blds = OV.get('building', [])
stats = dict(n_ovt=len(blds), matched=0, h_set=0, ex_set=0, added=0)
bx = [None] * len(old)
newb = [list(b) for b in old]
explicit = [False] * len(old)
# alturas por defecto del conversor OSM (sin etiqueta height/levels): 7, 9, 16 m exactos
DEF = lambda b: b[2] < 3 and b[0] in (7, 9, 16) and float(b[0]).is_integer()

def ov_height(o):
    h = o.get('height'); fl = o.get('num_floors')
    if h is not None and 2 < h < 400: return float(h), 'h'
    if fl is not None and 0 < fl < 120: return fl * 3.1 + .6, 'f'
    return None, None

added = []
for o in blds:
    if o.get('is_underground'): continue
    g = o['g']
    if len(g) < 3: continue
    P = to_local(g)
    try:
        poly = Polygon(P)
        if not poly.is_valid: poly = make_valid(poly).buffer(0)
    except Exception: continue
    if poly.is_empty or poly.area < 6: continue
    if poly.geom_type == 'MultiPolygon': poly = max(poly.geoms, key=lambda p: p.area)
    cand = tree.query(poly)
    best, bo, iou = None, 0.0, 0.0
    for k in cand:
        i = idx[int(k)]; q = oldP[i]
        try: ov = poly.intersection(q).area
        except Exception: continue
        r = ov / min(poly.area, q.area)
        if r > bo: bo, best, iou = r, i, ov / (poly.area + q.area - ov)
    osm = any('OpenStreetMap' in s for s in o.get('src', []))
    h, how = ov_height(o)
    ex = {}
    rs = ROOF.get(str(o.get('roof_shape', '')).lower())
    if rs: ex['rs'] = rs
    if o.get('roof_height') and 0.3 < o['roof_height'] < 30: ex['rh'] = round(float(o['roof_height']), 1)
    rc = hexcol(o.get('roof_color'));  fc = hexcol(o.get('facade_color'))
    if rc: ex['rc'] = rc
    if fc: ex['fc'] = fc
    fm = MAT.get(str(o.get('facade_material', '')).lower()); rm = MAT.get(str(o.get('roof_material', '')).lower())
    if fm: ex['fm'] = fm
    if rm: ex['rm'] = rm
    if best is not None and bo > 0.35:
        stats['matched'] += 1
        b = newb[best]
        if b[2] >= 3: continue                   # gradas: no tocar
        measured = any(x in s for s in o.get('src', []) for x in ('Lidar', 'Instituto Geográfico', 'zenodo'))
        if h is not None and not explicit[best] and iou > 0.5 and (DEF(old[best]) or (measured and how == 'h')):
            b[0] = round(h, 1); explicit[best] = True; stats['h_set'] += 1
        mh = o.get('min_height')
        if mh and 0 < mh < b[0] - 2: b[1] = round(float(mh), 1)
        if ex and iou > 0.4:
            bx[best] = {**(bx[best] or {}), **ex}; stats['ex_set'] += 1
    elif bo < 0.08 and not osm:
        # huella que falta en OSM (detección por IA de Microsoft/Google o catastros vía Overture)
        a = poly.area
        if h is None:
            h = (6.6 if a < 160 else 9.5 if a < 600 else 12.5); ex['est'] = 1
        kd = 0 if (a < 260 and h < 11) else 2 if a < 5000 else 1
        ext = list(poly.exterior.coords)[:-1]
        if len(ext) > 40: ext = list(poly.simplify(0.4).exterior.coords)[:-1]
        bb = [round(h, 1), round(float(o.get('min_height') or 0), 1), kd]
        for x, y in ext: bb += [int(round(x * 10)), int(round(y * 10))]
        added.append((bb, ex or None))
        stats['added'] += 1

# 3D BAG (Países Bajos): alturas medidas por LiDAR, tipo de tejado
if BAG:
    from pyproj import Transformer
    TR = Transformer.from_crs('EPSG:28992', 'EPSG:4326', always_xy=True)
    J = json.load(open(BAG)); feats = J.get('features', []); meta = J.get('metadata') or {}
    nb = 0
    for fe in feats:
        cos = fe.get('CityObjects', {}); vs = fe.get('vertices', [])
        tf = fe.get('tf') or (meta or {}).get('transform') or {'scale': [1, 1, 1], 'translate': [0, 0, 0]}
        sc, tl = tf['scale'], tf['translate']
        bldg = [c for c in cos.values() if c.get('type') == 'Building']
        if not bldg: continue
        at = bldg[0].get('attributes', {})
        hg = at.get('b3_h_maaiveld'); h50 = at.get('b3_h_dak_50p'); hmx = at.get('b3_h_dak_max'); hmn = at.get('b3_h_dak_min')
        if hg is None or h50 is None: continue
        # huella: geometría LoD0 del edificio o de la parte
        ring = None
        for c in [bldg[0]] + [cos[k] for k in bldg[0].get('children', []) if k in cos]:
            for gm in c.get('geometry', []):
                if str(gm.get('lod')) == '0' and gm.get('boundaries'):
                    bd = gm['boundaries']
                    ring = bd[0][0] if gm['type'] == 'MultiSurface' else bd[0]
                    break
            if ring: break
        if not ring: continue
        xy = [(vs[i][0] * sc[0] + tl[0], vs[i][1] * sc[1] + tl[1]) for i in ring]
        ll = [TR.transform(x, y) for x, y in xy]
        P = to_local(ll)
        poly = Polygon(P)
        if not poly.is_valid: poly = make_valid(poly).buffer(0)
        if poly.is_empty or poly.area < 6: continue
        if poly.geom_type == 'MultiPolygon': poly = max(poly.geoms, key=lambda p: p.area)
        cand = tree.query(poly); best, bo = None, 0
        for k in cand:
            i = idx[int(k)]
            try: ov = poly.intersection(oldP[i]).area
            except Exception: continue
            r = ov / (poly.area + oldP[i].area - ov)
            if r > bo: bo, best = r, i
        dt = str(at.get('b3_dak_type', ''))
        slanted = dt == 'slanted'
        ex = {'rs': 2 if slanted else 1}
        eave = (hmn if (slanted and hmn is not None) else h50) - hg
        top = (hmx if hmx is not None else h50) - hg
        if slanted and top - eave > 0.8: ex['rh'] = round(min(top - eave, 14), 1)
        hh = round(max(2.5, eave if slanted else h50 - hg), 1)
        if best is not None and bo > 0.45 and newb[best][2] < 3:
            newb[best][0] = hh; bx[best] = {**(bx[best] or {}), **ex}; nb += 1
    stats['bag'] = nb

for bb, ex in added:
    newb.append(bb); bx.append(ex)
W['b'] = newb
if any(bx): W['bx'] = bx
src = 'Overture Maps Foundation (ODbL)' + (' · 3DBAG (CC BY 4.0)' if BAG else '')
if src not in W.get('attr', ''): W['attr'] = W.get('attr', '') + ' · edificios: ' + src
json.dump(W, open(f'/tmp/w_{KEY}.json', 'w'), separators=(',', ':'))
print(KEY, stats)
