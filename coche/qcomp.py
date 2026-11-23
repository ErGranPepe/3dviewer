import sys, numpy as np, json
sys.path.insert(0, '/home/claude/tools/car')
from qload import *
V, F, src, names = load_soup(sys.argv[1])
print('soup', V.shape, F.shape, 'bb', V.min(0).round(3), V.max(0).round(3))
V2, F2, ok = weld(V, F)
print('welded', V2.shape, 'degenerate', int((~ok).sum()))
F2 = F2[ok]; src = src[ok]
n, lab = components(len(V2), F2)
fl = lab[F2[:, 0]]
cnt = np.bincount(fl, minlength=n)
order = np.argsort(-cnt)
print('components', n, 'with>=50 tris', int((cnt >= 50).sum()), 'with>=500', int((cnt >= 500).sum()))
rows = []
for c in order[:400]:
    if cnt[c] < 12: break
    fs = F2[fl == c]; vs = np.unique(fs); P = V2[vs]
    mn = P.min(0); mx = P.max(0)
    s = np.bincount(src[fl == c], minlength=len(names))
    rows.append((int(c), int(cnt[c]), mn.round(3).tolist(), mx.round(3).tolist(), [names[k] for k in np.argsort(-s)[:3] if s[k] > 0]))
for r in rows[:140]: print(r)
np.savez_compressed('/home/claude/tools/out/qv_welded.npz', V=V2, F=F2, lab=fl, src=src, names=np.array(names))
