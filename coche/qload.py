# Carga el GLB del concepto 2026 (CC BY 4.0, Qvist_designs) y lo deja como una sola malla soldada en el sistema del simulador:
# x hacia delante, y arriba, z lateral (+z = izquierda del coche vista desde atrás => en el simulador +z es... se comprueba aparte)
import sys, numpy as np
sys.path.insert(0, '/home/claude/tools/car')
from glbinfo import load
from glbdump import accessor, mat4
def load_soup(path):
    js, b, d = load(path)
    V = []; F = []; src = []; off = 0
    names = []
    def walk(i, M):
        nonlocal off
        n = js['nodes'][i]; W = M @ mat4(n)
        if 'mesh' in n:
            for pr in js['meshes'][n['mesh']]['primitives']:
                p, _ = accessor(js, b[0], d, pr['attributes']['POSITION'])
                p = p.astype(np.float64)
                p = (W[:3, :3] @ p.T).T + W[:3, 3]
                if 'indices' in pr:
                    idx, _ = accessor(js, b[0], d, pr['indices']); idx = idx.reshape(-1, 3).astype(np.int64)
                else:
                    idx = np.arange(len(p)).reshape(-1, 3)
                V.append(p); F.append(idx + off); src.append(np.full(len(idx), len(names))); off += len(p)
            names.append(n.get('name'))
        for c in n.get('children', []): walk(c, W)
    for r in js['scenes'][js.get('scene', 0)]['nodes']: walk(r, np.eye(4))
    V = np.vstack(V); F = np.vstack(F); src = np.concatenate(src)
    return V, F, src, names
def weld(V, F, tol=1e-5):
    key = np.round(V / tol).astype(np.int64)
    uq, inv = np.unique(key, axis=0, return_inverse=True)
    inv = inv.ravel()
    V2 = np.zeros((len(uq), 3)); V2[inv] = V
    F2 = inv[F]
    ok = (F2[:, 0] != F2[:, 1]) & (F2[:, 1] != F2[:, 2]) & (F2[:, 0] != F2[:, 2])
    return V2, F2, ok
def components(nv, F):
    from scipy.sparse import coo_matrix
    from scipy.sparse.csgraph import connected_components
    i = np.concatenate([F[:, 0], F[:, 1], F[:, 2]]); j = np.concatenate([F[:, 1], F[:, 2], F[:, 0]])
    A = coo_matrix((np.ones(len(i), dtype=np.int8), (i, j)), shape=(nv, nv))
    n, lab = connected_components(A, directed=False)
    return n, lab
