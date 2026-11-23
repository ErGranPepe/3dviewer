import sys, numpy as np
sys.path.insert(0, '/home/claude/tools/car')
from qload import *
d = np.load('/home/claude/tools/out/qv_welded.npz', allow_pickle=True)
V, F, lab = d['V'], d['F'], d['lab']
B = F[lab == 0]
def zone(box):
    P = V[B]; m = np.ones(len(B), bool)
    for k, (a, b) in box.items(): m &= (P[:, :, k] >= a).all(1) & (P[:, :, k] <= b).all(1)
    idx = np.where(m)[0]; f = B[idx]
    vs, inv = np.unique(f, return_inverse=True); f2 = inv.reshape(-1, 3)
    n, l = components(len(vs), f2); fl = l[f2[:, 0]]
    out = []
    for c in range(n):
        t = idx[fl == c]
        if len(t) < 40: continue
        Pc = V[np.unique(B[t])]
        out.append((t, Pc))
    return out
if __name__ == '__main__':
    box = {}
    for a in sys.argv[1:]:
        k, lo, hi = a.split(':'); box[int(k)] = (float(lo), float(hi))
    for t, P in sorted(zone(box), key=lambda r: -len(r[0])):
        C = P.mean(0); u, s, vt = np.linalg.svd(P - C, full_matrices=False)
        print(f'tri={len(t)} bb=[{P.min(0).round(3).tolist()} .. {P.max(0).round(3).tolist()}] sv={(s/np.sqrt(len(P))).round(3).tolist()} ax={vt[0].round(2).tolist()}')
