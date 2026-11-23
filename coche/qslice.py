import sys, numpy as np
sys.path.insert(0, '/home/claude/tools/car')
from qload import *
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
def slice_loops(V, F, axis, val, box=None, q=2e-4):
    """corta la malla con el plano coord[axis]=val; devuelve lista de lazos: dict(c=centro 3D, mn, mx, n=nº segmentos, per=perímetro)"""
    d = V[:, axis] - val
    dF = d[F]
    s = (dF > 0).sum(1)
    cut = (s > 0) & (s < 3)
    Fc = F[cut]; dc = dF[cut]
    ids = np.where(cut)[0]
    if box is not None:
        P = V[Fc].mean(1); ok = np.ones(len(Fc), bool)
        for k, (a, b) in box.items(): ok &= (P[:, k] >= a) & (P[:, k] <= b)
        Fc = Fc[ok]; dc = dc[ok]; ids = ids[ok]
    segs = []
    for e0, e1 in ((0, 1), (1, 2), (2, 0)):
        a = dc[:, e0]; b = dc[:, e1]
        m = (a > 0) != (b > 0)
        t = np.where(m, a / np.where(m, a - b, 1), 0)
        p = V[Fc[:, e0]] + t[:, None] * (V[Fc[:, e1]] - V[Fc[:, e0]])
        segs.append((m, p))
    # cada triángulo cortado tiene exactamente 2 aristas cruzadas
    M = np.stack([s[0] for s in segs], 1); Pp = np.stack([s[1] for s in segs], 1)
    idx = np.argsort(~M, axis=1, kind='stable')[:, :2]
    A = Pp[np.arange(len(Fc)), idx[:, 0]]; B = Pp[np.arange(len(Fc)), idx[:, 1]]
    if not len(A): return []
    pts = np.vstack([A, B]); key = np.round(pts / q).astype(np.int64)
    uq, inv = np.unique(key, axis=0, return_inverse=True); inv = inv.ravel()
    n = len(A); ia = inv[:n]; ib = inv[n:]
    G = coo_matrix((np.ones(n), (ia, ib)), shape=(len(uq), len(uq)))
    nc, lab = connected_components(G, directed=False)
    out = []
    sl = lab[ia]
    for c in range(nc):
        m = sl == c
        if m.sum() < 3: continue
        a = A[m]; b = B[m]; L = np.linalg.norm(a - b, axis=1)
        mid = (a + b) / 2; cen = (mid * L[:, None]).sum(0) / max(L.sum(), 1e-9)
        allp = np.vstack([a, b])
        out.append(dict(c=cen, mn=allp.min(0), mx=allp.max(0), n=int(m.sum()), per=float(L.sum()), tri=ids[m]))
    return out
if __name__ == '__main__':
    d = np.load('/home/claude/tools/out/qv_welded.npz', allow_pickle=True)
    V, F, lab = d['V'], d['F'], d['lab']
    body = F[lab == 0]
    axis = int(sys.argv[1]); vals = [float(x) for x in sys.argv[2].split(',')]
    box = {}
    for a in sys.argv[3:]:
        k, lo, hi = a.split(':'); box[int(k)] = (float(lo), float(hi))
    for v in vals:
        L = slice_loops(V, body, axis, v, box or None)
        L = [l for l in L if l['per'] > 0.02]
        print(f'-- {"xyz"[axis]}={v}: {len(L)} loops')
        for l in sorted(L, key=lambda l: (l['c'][0], l['c'][1])):
            sz = l['mx'] - l['mn']
            print(f"   c=({l['c'][0]:.3f},{l['c'][1]:.3f},{l['c'][2]:.3f}) size=({sz[0]:.3f},{sz[1]:.3f},{sz[2]:.3f}) per={l['per']:.3f} n={l['n']}")
