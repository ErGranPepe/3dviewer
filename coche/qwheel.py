import sys, numpy as np
sys.path.insert(0, '/home/claude/tools/car')
from qload import *
d = np.load('/home/claude/tools/out/qv_split.npz', allow_pickle=True)
V, F, lab = d['V'], d['F'], d['lab']
cn = np.bincount(lab)
def prof(c, cx, name):
    f = F[lab == c]; P = V[np.unique(f)]
    r = np.hypot(P[:, 0] - cx, P[:, 1] - 0.3595); z = P[:, 2]
    print(name, 'comp', c, 'tris', len(f), 'r', r.min().round(4), r.max().round(4), 'z', z.min().round(4), z.max().round(4))
    # perfil: para bandas de z, r mínimo y máximo
    zs = np.linspace(z.min(), z.max(), 18)
    for a, b in zip(zs[:-1], zs[1:]):
        m = (z >= a) & (z <= b)
        if m.any(): print(f'   z {a:.3f}-{b:.3f}: r {r[m].min():.3f}..{r[m].max():.3f} n={m.sum()}', np.percentile(r[m], [10, 30, 50, 70, 90]).round(3))
prof(202, -1.7, 'FL tyre+rim'); prof(203, -1.7, 'FL cover'); prof(673, 1.7, 'RL tyre+rim'); prof(699, 1.7, 'RL cover')
# tambores (en el cuerpo): triángulos dentro del cilindro
B = F[lab == 0]; P = V[B]
for name, cx in (('F', -1.7), ('R', 1.7)):
    r = np.hypot(P[:, :, 0] - cx, P[:, :, 1] - 0.3595).max(1); m = (r < 0.235) & (P[:, :, 2].min(1) > 0.45)
    Q = P[m].reshape(-1, 3); rr = np.hypot(Q[:, 0] - cx, Q[:, 1] - 0.3595)
    print('drum', name, 'tris', m.sum(), 'z', Q[:, 2].min().round(4), Q[:, 2].max().round(4), 'rmax', rr.max().round(4))
    h, e = np.histogram(Q[:, 2], bins=12); print('   zhist', h.tolist(), e.round(3).tolist())
