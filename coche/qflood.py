import sys, numpy as np
sys.path.insert(0, '/home/claude/tools/car')
from qload import *
d = np.load('/home/claude/tools/out/qv_welded.npz', allow_pickle=True)
V, F, lab = d['V'], d['F'], d['lab']
B = F[lab == 0]; C = V[B].mean(1)
# semilla: tirante de dirección delantero izquierdo a z=0.40 (x=-1.828,y=0.342)
def seed(x, y, z, r=0.03):
    return np.where(np.linalg.norm(C - np.array([x, y, z]), axis=1) < r)[0]
def flood(seeds, mask):
    # componentes por vértice dentro de la máscara de triángulos
    idx = np.where(mask)[0]; f = B[idx]
    vs, inv = np.unique(f, return_inverse=True); f2 = inv.reshape(-1, 3)
    n, l = components(len(vs), f2); fl = l[f2[:, 0]]
    sl = set(fl[np.isin(idx, seeds)].tolist())
    return idx[np.isin(fl, list(sl))]
for name, (x, y, z) in {'tie': (-1.828, .342, .40), 'upF': (-1.773, .516, .42), 'loF': (-1.722, .324, .42), 'push': (-1.69, .45, .42), 'upR': (-1.56, .48, .42), 'loR': (-1.51, .306, .42)}.items():
    s = seed(x, y, z)
    for zmax in (0.585, 0.56, 0.52):
        m = (C[:, 2] < zmax) & (C[:, 2] > 0.0)
        r = flood(s, m)
        P = V[np.unique(B[r])]
        print(name, 'seeds', len(s), 'zmax', zmax, 'tris', len(r), 'bb', P.min(0).round(3), P.max(0).round(3))
