import sys, time, numpy as np
sys.path.insert(0, '/home/claude/tools/car')
import pyfqmr
from scipy.spatial import cKDTree
from glbwrite import write_glb, submesh
def decimate(V, F, target, border=True, agg=5.0):
    s = pyfqmr.Simplify(); s.setMesh(np.ascontiguousarray(V, dtype=np.float64), np.ascontiguousarray(F, dtype=np.int32))
    s.simplify_mesh(target_count=int(target), aggressiveness=agg, preserve_border=border, verbose=False)
    v, f, n = s.getMesh()
    return np.asarray(v, dtype=np.float64), np.asarray(f, dtype=np.int64)
def orient(v, f, refV, refN, tree=None):
    """orienta las caras como la superficie original (normal del vértice original más cercano al centro de la cara)"""
    tree = tree or cKDTree(refV)
    c = v[f].mean(1); _, i = tree.query(c)
    fn = np.cross(v[f[:, 1]] - v[f[:, 0]], v[f[:, 2]] - v[f[:, 0]])
    flip = (fn * refN[i]).sum(1) < 0
    f = f.copy(); f[flip] = f[flip][:, [0, 2, 1]]
    return f
def smooth_normals(v, f, crease=40.0):
    """normales por esquina promediando las caras vecinas con ángulo < crease; devuelve vértices duplicados donde hay arista viva"""
    fn = np.cross(v[f[:, 1]] - v[f[:, 0]], v[f[:, 2]] - v[f[:, 0]]); area = np.linalg.norm(fn, axis=1); fu = fn / np.maximum(area, 1e-18)[:, None]
    nf = len(f); corner_v = f.ravel(); corner_f = np.repeat(np.arange(nf), 3)
    order = np.argsort(corner_v, kind='stable'); cv = corner_v[order]; cf = corner_f[order]
    st = np.r_[0, np.where(cv[1:] != cv[:-1])[0] + 1]; en = np.r_[st[1:], len(cv)]
    cn = np.zeros((nf * 3, 3)); cosc = np.cos(np.radians(crease))
    # vértices con pocas caras: bucle vectorizado por tamaños de abanico
    sizes = en - st
    for sz in np.unique(sizes):
        g = np.where(sizes == sz)[0]
        idx = st[g][:, None] + np.arange(sz)[None, :]          # (m, sz) posiciones en 'order'
        faces = cf[idx]                                        # (m, sz)
        Nn = fu[faces]; Aw = fn[faces]                         # (m, sz, 3)
        dots = np.einsum('mik,mjk->mij', Nn, Nn)               # (m, sz, sz)
        w = (dots >= cosc)[..., None] * Aw[:, None, :, :]      # para la esquina i, suma de caras j compatibles
        acc = w.sum(2)                                         # (m, sz, 3)
        cn[order[idx].ravel()] = acc.reshape(-1, 3)
    L = np.linalg.norm(cn, axis=1); cn /= np.maximum(L, 1e-18)[:, None]
    # vértices únicos por (vértice, normal cuantizada)
    q = np.round(cn * 24).astype(np.int64)
    key = np.c_[corner_v, q]
    uq, inv = np.unique(key, axis=0, return_inverse=True); inv = inv.ravel()
    V2 = v[uq[:, 0]]; N2 = np.zeros((len(uq), 3)); np.add.at(N2, inv, cn); N2 /= np.maximum(np.linalg.norm(N2, axis=1), 1e-18)[:, None]
    return V2, N2, inv.reshape(-1, 3)
if __name__ == '__main__':
    d = np.load('/home/claude/tools/out/car1.npz', allow_pickle=True)
    V, N, F, fl, big, lab = d['V'], d['N'], d['F'], d['fl'], int(d['big']), d['lab']
    B = F[fl == big]; body = B[lab == 0]
    v0, f0 = submesh(V, body); print('body', len(v0), len(f0))
    tree = cKDTree(V)
    parts = []
    for tgt, border, off in ((90000, True, 0.0), (16000, False, 2.2), (4500, False, 4.4)):
        t = time.time(); v, f = decimate(v0, f0, tgt, border); f = orient(v, f, V, N, tree)
        v2, n2, f2 = smooth_normals(v, f, 42)
        print('target', tgt, '->', len(f), 'verts', len(v), '->', len(v2), round(time.time() - t, 1), 's')
        parts.append(dict(name='b%d' % tgt, V=v2 + np.array([0, 0, off]), F=f2, N=n2, color=(.75, .1, .08), met=.3, rou=.3))
    write_glb('/home/claude/tools/out/qdec.glb', parts)
