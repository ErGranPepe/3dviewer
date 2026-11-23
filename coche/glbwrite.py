import json, struct, numpy as np
def vnormals(V, F, crease=None):
    n = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
    N = np.zeros_like(V)
    for k in range(3): np.add.at(N, F[:, k], n)
    L = np.linalg.norm(N, axis=1); L[L == 0] = 1
    return N / L[:, None]
def write_glb(path, parts):
    """parts: lista de dict(name, V (n,3), F (m,3), color (3) [, N])"""
    bins = []; views = []; accs = []; meshes = []; nodes = []; mats = []
    off = 0
    def add(arr, target):
        nonlocal off
        b = arr.tobytes(); pad = (-len(b)) % 4
        views.append({'buffer': 0, 'byteOffset': off, 'byteLength': len(b), 'target': target}); bins.append(b + b'\0' * pad); off += len(b) + pad
        return len(views) - 1
    for p in parts:
        V = np.asarray(p['V'], dtype=np.float32); F = np.asarray(p['F'], dtype=np.uint32)
        if not len(F): continue
        N = np.asarray(p.get('N') if p.get('N') is not None else vnormals(V.astype(np.float64), F), dtype=np.float32)
        vp = add(V, 34962); accs.append({'bufferView': vp, 'componentType': 5126, 'count': len(V), 'type': 'VEC3', 'min': V.min(0).tolist(), 'max': V.max(0).tolist()}); ap = len(accs) - 1
        vn = add(N, 34962); accs.append({'bufferView': vn, 'componentType': 5126, 'count': len(N), 'type': 'VEC3'}); an = len(accs) - 1
        vi = add(F.ravel(), 34963); accs.append({'bufferView': vi, 'componentType': 5125, 'count': int(F.size), 'type': 'SCALAR'}); ai = len(accs) - 1
        c = list(p.get('color', (.7, .7, .7)))
        mats.append({'name': p['name'], 'pbrMetallicRoughness': {'baseColorFactor': c + [1], 'metallicFactor': p.get('met', .1), 'roughnessFactor': p.get('rou', .5)}, 'doubleSided': True})
        meshes.append({'name': p['name'], 'primitives': [{'attributes': {'POSITION': ap, 'NORMAL': an}, 'indices': ai, 'material': len(mats) - 1}]})
        nodes.append({'name': p['name'], 'mesh': len(meshes) - 1})
    js = {'asset': {'version': '2.0'}, 'scene': 0, 'scenes': [{'nodes': list(range(len(nodes)))}], 'nodes': nodes, 'meshes': meshes, 'materials': mats, 'accessors': accs, 'bufferViews': views, 'buffers': [{'byteLength': off}]}
    jb = json.dumps(js).encode(); jb += b' ' * ((-len(jb)) % 4)
    bb = b''.join(bins)
    with open(path, 'wb') as f:
        f.write(struct.pack('<4sII', b'glTF', 2, 12 + 8 + len(jb) + 8 + len(bb)))
        f.write(struct.pack('<II', len(jb), 0x4E4F534A)); f.write(jb)
        f.write(struct.pack('<II', len(bb), 0x004E4942)); f.write(bb)
def submesh(V, F):
    vs, inv = np.unique(F, return_inverse=True)
    return V[vs], inv.reshape(-1, 3)
