import sys, numpy as np
sys.path.insert(0, '/home/claude/tools/car')
from qload import *
d = np.load('/home/claude/tools/out/qv_welded.npz', allow_pickle=True)
V, F = d['V'], d['F']
# triángulos duplicados
Fs = np.sort(F, axis=1); uq, idx, cntf = np.unique(Fs, axis=0, return_index=True, return_counts=True)
print('tris', len(F), 'unique', len(uq), 'dup groups', int((cntf > 1).sum()))
E = np.vstack([F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]]); Es = np.sort(E, axis=1)
key = Es[:, 0] * (len(V) + 1) + Es[:, 1]
uk, inv, cnt = np.unique(key, return_inverse=True, return_counts=True)
print('edges', len(uk), 'boundary(1)', int((cnt == 1).sum()), 'manifold(2)', int((cnt == 2).sum()), 'nm(3)', int((cnt == 3).sum()), 'nm(4)', int((cnt == 4).sum()), 'nm(>4)', int((cnt > 4).sum()))
# longitudes de arista
L = np.linalg.norm(V[Es[:, 0]] - V[Es[:, 1]], axis=1)
print('edge len pct', np.percentile(L, [1, 10, 50, 90, 99]).round(4))
# ¿rejilla de 7 mm? fracción de coordenadas
for k in range(3):
    fr = np.mod(V[:, k], 0.007) / 0.007
    h, _ = np.histogram(fr, bins=10, range=(0, 1)); print('axis', k, 'grid hist', h)
