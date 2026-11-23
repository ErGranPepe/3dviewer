import sys, numpy as np
sys.path.insert(0, '/home/claude/tools/car')
from qload import *
from qslice import slice_loops
def tracks(V, B, axis, vals, box, maxsize=0.30, link=0.012):
    T = []   # cada pista: lista de (val, loop)
    open_ = []
    for v in vals:
        L = [l for l in slice_loops(V, B, axis, v, box) if l['per'] > 0.04 and max(l['mx'] - l['mn']) < maxsize and l['n'] >= 12]
        nxt = []
        used = set()
        for tr in open_:
            last = tr[-1][1]; best = None
            for i, l in enumerate(L):
                if i in used: continue
                dc = np.linalg.norm(l['c'] - last['c']); ds = abs(l['per'] - last['per']) / max(last['per'], 1e-6)
                if dc < link + abs(v - tr[-1][0]) * 1.6 and ds < 0.25 and (best is None or dc < best[0]): best = (dc, i)
            if best: used.add(best[1]); tr.append((v, L[best[1]])); nxt.append(tr)
            else: T.append(tr)
        for i, l in enumerate(L):
            if i not in used: nxt.append([(v, l)])
        open_ = nxt
    T += open_
    return [t for t in T if len(t) >= 8]
def fit(tr):
    C = np.array([l['c'] for _, l in tr]); m = C.mean(0); u, s, vt = np.linalg.svd(C - m, full_matrices=False); d = vt[0]
    t = (C - m) @ d
    if t[-1] < t[0]: d = -d; t = -t
    res = np.linalg.norm((C - m) - np.outer(t, d), axis=1).max()
    return m, d, t.min(), t.max(), res
if __name__ == '__main__':
    d = np.load('/home/claude/tools/out/qv_welded.npz', allow_pickle=True)
    V, F, lab = d['V'], d['F'], d['lab']; B = F[lab == 0]
    corners = {'FL': ({0: (-2.15, -1.2), 1: (0.12, 0.75)}, 1), 'FR': ({0: (-2.15, -1.2), 1: (0.12, 0.75)}, -1), 'RL': ({0: (1.15, 2.1), 1: (0.12, 0.75)}, 1), 'RR': ({0: (1.15, 2.1), 1: (0.12, 0.75)}, -1)}
    for name in sys.argv[1:]:
        box, sg = corners[name]
        vals = [sg * z for z in np.arange(0.06, 0.66, 0.004)]
        T = tracks(V, B, 2, vals, box)
        print('==', name, len(T), 'tracks')
        for tr in sorted(T, key=lambda t: (round(t[0][1]['c'][1], 1), t[0][1]['c'][0])):
            m, dd, t0, t1, res = fit(tr); a = m + dd * t0; b = m + dd * t1
            sz = np.median([np.sort(l['mx'] - l['mn'])[1:] for _, l in tr], axis=0); per = np.median([l['per'] for _, l in tr])
            print(f"  z {tr[0][0]:+.3f}..{tr[-1][0]:+.3f} n={len(tr):3d} A=({a[0]:.3f},{a[1]:.3f},{a[2]:.3f}) B=({b[0]:.3f},{b[1]:.3f},{b[2]:.3f}) L={np.linalg.norm(b-a):.3f} sec={sz[1]*1000:.0f}x{sz[0]*1000:.0f}mm per={per*1000:.0f} res={res*1000:.1f}mm")
