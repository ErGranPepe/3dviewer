# Deshace la soldadura por agrupamiento: separa las cáscaras originales partiendo los vértices y aristas no-variedad.
import sys, numpy as np
sys.path.insert(0, '/home/claude/tools/car')
from qload import *
d = np.load('/home/claude/tools/out/qv_welded.npz', allow_pickle=True)
V, F, lab0 = d['V'], d['F'], d['lab']
# 1) fuera triángulos duplicados (mismo trío de vértices)
Fs = np.sort(F, axis=1); _, keep = np.unique(Fs, axis=0, return_index=True); keep.sort()
F = F[keep]; lab0 = lab0[keep]
nt = len(F)
N = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]]); A = np.linalg.norm(N, axis=1); N /= np.maximum(A, 1e-18)[:, None]
# 2) aristas
T = np.repeat(np.arange(nt), 3); K = np.tile(np.arange(3), nt)
a = F[T, K]; b = F[T, (K + 1) % 3]
lo = np.minimum(a, b); hi = np.maximum(a, b); dirn = (a < b)
key = lo.astype(np.int64) * len(V) + hi
order = np.argsort(key, kind='stable'); ks = key[order]
st = np.r_[0, np.where(ks[1:] != ks[:-1])[0] + 1]; en = np.r_[st[1:], len(ks)]
cnt = en - st
# unión de esquinas
parent = np.arange(nt * 3)
def find(x):
    r = x
    while parent[r] != r: r = parent[r]
    while parent[x] != r: parent[x], x = r, parent[x]
    return r
def union(x, y):
    rx, ry = find(x), find(y)
    if rx != ry: parent[rx] = ry
def corner(t, v):
    f = F[t]
    return t * 3 + (0 if f[0] == v else 1 if f[1] == v else 2)
def link(i, j):
    t1, t2 = T[i], T[j]
    for v in (lo[i], hi[i]): union(corner(t1, v), corner(t2, v))
two = np.where(cnt == 2)[0]
for s in st[two]: link(order[s], order[s + 1])
multi = np.where(cnt > 2)[0]
npair = 0; nleft = 0
for q in multi:
    ids = order[st[q]:en[q]].tolist()
    # puntuación de continuidad para cada par
    cand = []
    for x in range(len(ids)):
        for y in range(x + 1, len(ids)):
            i, j = ids[x], ids[y]
            sgn = 1.0 if dirn[i] != dirn[j] else -1.0
            cand.append((sgn * float(N[T[i]] @ N[T[j]]), i, j))
    cand.sort(reverse=True); used = set()
    for sc, i, j in cand:
        if i in used or j in used: continue
        if sc < -0.95 and len(ids) - len(used) > 2: continue
        link(i, j); used.add(i); used.add(j); npair += 1
    nleft += len(ids) - len(used)
print('edges 2:', len(two), 'multi:', len(multi), 'pairs', npair, 'left', nleft)
root = np.array([find(i) for i in range(nt * 3)])
uq, inv = np.unique(root, return_inverse=True)
F2 = inv.reshape(-1, 3); V2 = np.zeros((len(uq), 3)); V2[F2.ravel()] = V[F.ravel()]
print('verts', len(V), '->', len(V2))
n, l = components(len(V2), F2); fl = l[F2[:, 0]]; cn = np.bincount(fl, minlength=n)
print('components', n, '>=200 tris:', int((cn >= 200).sum()), '>=2000:', int((cn >= 2000).sum()))
for c in np.argsort(-cn)[:70]:
    P = V2[np.unique(F2[fl == c])]
    print(f'  c{c} tri={cn[c]} bb=[{P.min(0).round(3).tolist()} .. {P.max(0).round(3).tolist()}]')
np.savez_compressed('/home/claude/tools/out/qv_split.npz', V=V2, F=F2, lab=fl)
