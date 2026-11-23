import sys, json, struct
sys.path.insert(0, '/home/claude/tools/car')
from glbinfo import load
import numpy as np
CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}
def accessor(js, binoff, d, i):
    a = js['accessors'][i]; bv = js['bufferViews'][a['bufferView']]
    dt = np.dtype(CT[a['componentType']]); n = NC[a['type']]
    off = binoff + bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    st = bv.get('byteStride', 0)
    if st and st != dt.itemsize * n:
        raw = np.frombuffer(d, dtype=np.uint8, count=st * (a['count'] - 1) + dt.itemsize * n, offset=off)
        idx = (np.arange(a['count'])[:, None] * st + np.arange(dt.itemsize * n)[None, :]).ravel()
        arr = raw[idx].view(dt).reshape(a['count'], n)
    else:
        arr = np.frombuffer(d, dtype=dt, count=a['count'] * n, offset=off).reshape(a['count'], n)
    return arr, a
def mat4(n):
    if 'matrix' in n: return np.array(n['matrix'], dtype=float).reshape(4, 4).T
    M = np.eye(4)
    t = n.get('translation', [0, 0, 0]); r = n.get('rotation', [0, 0, 0, 1]); s = n.get('scale', [1, 1, 1])
    x, y, z, w = r
    R = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
    M[:3, :3] = R * np.array(s)[None, :]; M[:3, 3] = t
    return M
if __name__ == '__main__':
    p = sys.argv[1]
    js, b, d = load(p)
    print(json.dumps(js.get('asset'), indent=1)[:1500])
    nodes = js['nodes']
    world = {}
    def walk(i, M, depth):
        n = nodes[i]; W = M @ mat4(n); world[i] = W
        s = '  ' * depth + f"[{i}] {n.get('name')!r}"
        if 'mesh' in n:
            m = js['meshes'][n['mesh']]
            lo = np.full(3, 1e9); hi = -lo; tri = 0; mats = []
            for pr in m['primitives']:
                a = js['accessors'][pr['attributes']['POSITION']]
                mn = np.array(a['min']); mx = np.array(a['max'])
                corners = np.array([[x, y, z, 1] for x in (mn[0], mx[0]) for y in (mn[1], mx[1]) for z in (mn[2], mx[2])])
                wc = (W @ corners.T).T[:, :3]
                lo = np.minimum(lo, wc.min(0)); hi = np.maximum(hi, wc.max(0))
                tri += (js['accessors'][pr['indices']]['count'] if 'indices' in pr else a['count']) // 3
                mats.append(js['materials'][pr['material']].get('name') if 'material' in pr else None)
            s += f" mesh={m.get('name')!r} prims={len(m['primitives'])} tri={tri} bb=[{lo.round(3).tolist()} .. {hi.round(3).tolist()}] mats={mats[:12]}"
        print(s[:600])
        for c in n.get('children', []): walk(c, W, depth + 1)
    for r in js['scenes'][js.get('scene', 0)]['nodes']: walk(r, np.eye(4), 0)
    print('MATERIALS')
    for i, m in enumerate(js.get('materials', [])):
        pbr = m.get('pbrMetallicRoughness', {})
        print(i, repr(m.get('name')), 'col', [round(x, 3) for x in pbr.get('baseColorFactor', [1, 1, 1, 1])], 'tex', pbr.get('baseColorTexture', {}).get('index'), 'met', pbr.get('metallicFactor', 1), 'rou', pbr.get('roughnessFactor', 1), 'alpha', m.get('alphaMode'), 'ds', m.get('doubleSided'), 'nrm', m.get('normalTexture', {}).get('index'), 'ext', list(m.get('extensions', {}).keys()))
    print('IMAGES')
    for i, im in enumerate(js.get('images', [])):
        bv = js['bufferViews'][im['bufferView']] if 'bufferView' in im else {}
        print(i, im.get('name'), im.get('mimeType'), bv.get('byteLength'), im.get('uri'))
