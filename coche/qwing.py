import sys, numpy as np
sys.path.insert(0, '/home/claude/tools/car')
from qload import *
from qtrack import tracks, fit
d = np.load('/home/claude/tools/out/qv_welded.npz', allow_pickle=True)
V, F, lab = d['V'], d['F'], d['lab']; B = F[lab == 0]
for name, box, rng in (('FW', {0: (-3.0, -2.0), 1: (0.03, 0.62)}, 0.93), ('RW', {0: (1.75, 2.5), 1: (0.55, 1.15)}, 0.60)):
    vals = np.arange(-rng, rng + 1e-9, 0.004)
    T = tracks(V, B, 2, vals, box, maxsize=0.7, link=0.014)
    print('==', name, len(T))
    for tr in sorted(T, key=lambda t: t[0][0]):
        c0 = tr[0][1]['c']; cm = tr[len(tr) // 2][1]['c']; c1 = tr[-1][1]['c']
        sz = np.median([np.sort(l['mx'] - l['mn'])[1:] for _, l in tr], axis=0)
        print(f"  z {tr[0][0]:+.3f}..{tr[-1][0]:+.3f} n={len(tr):3d} start=({c0[0]:.3f},{c0[1]:.3f}) mid=({cm[0]:.3f},{cm[1]:.3f}) end=({c1[0]:.3f},{c1[1]:.3f}) sec={sz[1]*1000:.0f}x{sz[0]*1000:.0f}")
