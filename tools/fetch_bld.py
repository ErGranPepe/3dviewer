# Descarga única de edificios con datos abiertos (Overture Maps, ODbL/CDLA; 3D BAG, CC BY 4.0).
# Salida compacta en out/: <id>.ovt.json y nl-1948.bag.json, más log.txt
import json, math, os, subprocess, sys, time, urllib.request, urllib.parse, traceback
G = json.load(open('tools/f1-circuits.geojson'))
IDS = ['bh-2002','au-1953','jp-1962','cn-2004','ca-1978','es-1991','at-1969','gb-1948','hu-1986','be-1925','nl-1948','it-1922','us-2012','mx-1962','br-1940','ae-2009','mc-1929']
os.makedirs('out', exist_ok=True)
LOG = open('out/log.txt', 'a')
def log(*a):
    s = ' '.join(str(x) for x in a); print(s, flush=True); LOG.write(s + '\n'); LOG.flush()

def bbox(fid):
    f = [x for x in G['features'] if x['properties']['id'] == fid][0]
    xs = [c[0] for c in f['geometry']['coordinates']]; ys = [c[1] for c in f['geometry']['coordinates']]
    lat0 = sum(ys) / len(ys); mlat = 1100 / 111320; mlon = 1100 / (111320 * math.cos(math.radians(lat0)))
    return min(ys) - mlat, min(xs) - mlon, max(ys) + mlat, max(xs) + mlon

KEEP = ['height', 'num_floors', 'min_height', 'min_floor', 'roof_shape', 'roof_height', 'roof_direction', 'roof_orientation',
        'roof_color', 'roof_material', 'facade_color', 'facade_material', 'class', 'subtype', 'is_underground', 'level', 'has_parts']
def outer(geom):
    t = geom['type']; c = geom['coordinates']
    if t == 'Polygon': return c[0]
    if t == 'MultiPolygon':
        best = max(c, key=lambda p: len(p[0])); return best[0]
    return None

def overture(fid):
    s, w, n, e = bbox(fid)
    res = {}
    for typ in ('building', 'building_part'):
        tmp = f'/tmp/{fid}.{typ}.geojson'
        cmd = ['overturemaps', 'download', f'--bbox={w:.6f},{s:.6f},{e:.6f},{n:.6f}', '-f', 'geojson', f'--type={typ}', '-o', tmp]
        for t in range(3):
            r = subprocess.run(cmd, capture_output=True, text=True)
            if r.returncode == 0 and os.path.exists(tmp): break
            log(fid, typ, 'retry', r.stderr[-400:]); time.sleep(20)
        if not os.path.exists(tmp): log(fid, typ, 'FAILED'); continue
        d = json.load(open(tmp)); out = []
        for f in d.get('features', []):
            g = outer(f['geometry']) if f.get('geometry') else None
            if not g: continue
            p = f.get('properties', {})
            o = {k: p[k] for k in KEEP if p.get(k) not in (None, '', [])}
            src = p.get('sources') or []
            o['src'] = sorted({x.get('dataset', '') for x in src if isinstance(x, dict)})
            if typ == 'building_part' and p.get('building_id'): o['bid'] = p['building_id']
            o['id'] = f.get('id') or p.get('id')
            o['g'] = [[round(x, 7), round(y, 7)] for x, y in g[:-1] if True]
            out.append(o)
        res[typ] = out
        log(fid, typ, len(out), 'con altura', sum(1 for o in out if 'height' in o), 'con plantas', sum(1 for o in out if 'num_floors' in o),
            'fuentes', sorted({s for o in out for s in o['src']}))
    json.dump({'bbox': [s, w, n, e], 'lic': 'Overture Maps Foundation (ODbL/CDLA-Permissive-2.0)', **res}, open(f'out/{fid}.ovt.json', 'w'), separators=(',', ':'))

def get(url, tries=4):
    for t in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'circuit-bld-fetch/1.0', 'Accept': 'application/json'})
            return urllib.request.urlopen(req, timeout=180).read()
        except Exception as ex:
            log('retry', url[:120], ex); time.sleep(10 * (t + 1))
    return None

def bag(fid):
    from pyproj import Transformer
    s, w, n, e = bbox(fid)
    T = Transformer.from_crs('EPSG:4326', 'EPSG:28992', always_xy=True)
    x0, y0 = T.transform(w, s); x1, y1 = T.transform(e, n)
    feats = []; meta = None
    url = f'https://api.3dbag.nl/collections/pand/items?bbox={x0:.1f},{y0:.1f},{x1:.1f},{y1:.1f}&limit=100'
    pages = 0
    while url and pages < 800:
        d = get(url)
        if not d: log('bag page failed', url); break
        j = json.loads(d); pages += 1
        if pages == 1: log('bag keys', list(j.keys()), str(j)[:600])
        meta = j.get('metadata', meta)
        for f in j.get('features', []): feats.append(f)
        nxt = [l['href'] for l in j.get('links', []) if l.get('rel') == 'next']
        url = nxt[0] if nxt else None
    log('bag', fid, 'paginas', pages, 'edificios', len(feats))
    json.dump({'bbox': [s, w, n, e], 'rd': [x0, y0, x1, y1], 'lic': '3DBAG by tudelft3d and 3DGI (CC BY 4.0)', 'metadata': meta, 'features': feats},
              open(f'out/{fid}.bag.json', 'w'), separators=(',', ':'))

only = sys.argv[1:] or IDS
for fid in only:
    try: overture(fid)
    except Exception: log(fid, 'overture error', traceback.format_exc()[-800:])
try: bag('nl-1948')
except Exception: log('bag error', traceback.format_exc()[-800:])
