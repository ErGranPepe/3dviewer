import sys, numpy as np
sys.path.insert(0, '/home/claude/tools/car')
from qload import *
d = np.load('/home/claude/tools/out/qv_welded.npz', allow_pickle=True)
V, F, lab, src, names = d['V'], d['F'], d['lab'], d['src'], list(d['names'])
for nm in sys.argv[1:]:
    k = names.index(nm); fs = F[src == k]
    vs, inv = np.unique(fs, return_inverse=True); f2 = inv.reshape(-1, 3)
    n, l = components(len(vs), f2); fl = l[f2[:, 0]]; cnt = np.bincount(fl, minlength=n)
    print('==', nm, 'tris', len(fs), 'components', n)
    for c in np.argsort(-cnt)[:60]:
        if cnt[c] < 30: break
        P = V[vs[np.unique(f2[fl == c])]]
        # eje principal
        C = P.mean(0); u, s, vt = np.linalg.svd(P - C, full_matrices=False)
        ax = vt[0]; t = (P - C) @ ax
        print(f'  c{c} tri={cnt[c]} bb=[{P.min(0).round(3).tolist()} .. {P.max(0).round(3).tolist()}] len={np.ptp(t):.3f} sv={(s/np.sqrt(len(P))).round(3).tolist()} axis={ax.round(2).tolist()}')
