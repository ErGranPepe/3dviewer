# Envoltura exterior limpia de una pieza (para los niveles lejanos): voxelizado, vaciado de lo que se ve desde fuera y marching cubes.
import numpy as np
from scipy import ndimage
from skimage import measure
def sample_tris(P, F, h):
    """puntos sobre los triángulos con separación <= h"""
    A = P[F[:, 0]]; Bv = P[F[:, 1]]; C = P[F[:, 2]]
    L = np.maximum(np.maximum(np.linalg.norm(Bv - A, axis=1), np.linalg.norm(C - Bv, axis=1)), np.linalg.norm(A - C, axis=1))
    n = np.clip(np.ceil(L / h).astype(int), 1, 400); out = []
    for k in np.unique(n):
        m = n == k; a, b, c = A[m], Bv[m], C[m]
        ij = np.array([(i, j) for i in range(k + 1) for j in range(k + 1 - i)], dtype=np.float64) / k
        w0 = 1 - ij[:, 0] - ij[:, 1]
        out.append((w0[None, :, None] * a[:, None, :] + ij[None, :, 0, None] * b[:, None, :] + ij[None, :, 1, None] * c[:, None, :]).reshape(-1, 3))
    return np.vstack(out)
DIRS = [(a, b, c) for a in (-1, 0, 1) for b in (-1, 0, 1) for c in (-1, 0, 1) if (a, b, c) != (0, 0, 0)]
def visible(surf, d):
    """voxeles vacíos alcanzables en línea recta desde fuera viajando en la dirección d"""
    ax = [i for i in range(3) if d[i] != 0][0]
    s = np.moveaxis(surf, ax, 0); n = s.shape[0]; out = np.empty_like(s)
    oth = [i for i in range(3) if i != ax]; sh = [d[i] for i in oth]
    order = range(n) if d[ax] > 0 else range(n - 1, -1, -1)
    prev = np.ones(s.shape[1:], bool)
    for i in order:
        if sh[0] or sh[1]:
            q = np.ones_like(prev)
            src = [slice(None), slice(None)]; dst = [slice(None), slice(None)]
            for k in (0, 1):
                if sh[k] > 0: dst[k] = slice(1, None); src[k] = slice(0, -1)
                elif sh[k] < 0: dst[k] = slice(0, -1); src[k] = slice(1, None)
            q[tuple(dst)] = prev[tuple(src)]; prev = q
        prev = prev & ~s[i]; out[i] = prev
    return np.moveaxis(out, 0, ax)
def shrinkwrap(P, F, h, caps=(), sigma=0.7, dirs=DIRS, pad=3, want_vis=False):
    mn = P.min(0) - pad * h; mx = P.max(0) + pad * h
    dims = np.ceil((mx - mn) / h).astype(int) + 1
    surf = np.zeros(dims, bool)
    A = P[F[:, 0]]; Bv = P[F[:, 1]]; C = P[F[:, 2]]
    L = np.maximum(np.maximum(np.linalg.norm(Bv - A, axis=1), np.linalg.norm(C - Bv, axis=1)), np.linalg.norm(A - C, axis=1))
    nn = np.clip(np.ceil(L / (h * 0.45)).astype(int), 1, 2000)
    for k in np.unique(nn):
        ids = np.where(nn == k)[0]
        ij = np.array([(i, j) for i in range(k + 1) for j in range(k + 1 - i)], dtype=np.float64) / k; w0 = 1 - ij[:, 0] - ij[:, 1]
        step = max(1, int(3e6 // len(ij)))
        for q in range(0, len(ids), step):
            m = ids[q:q + step]
            S = (w0[None, :, None] * A[m][:, None, :] + ij[None, :, 0, None] * Bv[m][:, None, :] + ij[None, :, 1, None] * C[m][:, None, :]).reshape(-1, 3)
            idx = np.floor((S - mn) / h).astype(int); surf[idx[:, 0], idx[:, 1], idx[:, 2]] = True
    for (lo, hi) in caps:
        a = np.clip(np.floor((np.array(lo) - mn) / h).astype(int), 0, dims - 1); b = np.clip(np.ceil((np.array(hi) - mn) / h).astype(int), 0, dims - 1)
        surf[a[0]:b[0] + 1, a[1]:b[1] + 1, a[2]:b[2] + 1] = True
    vis = np.zeros(dims, bool)
    for d in dirs: vis |= visible(surf, d)
    solid = ~vis
    if want_vis:
        vd = ndimage.binary_dilation(vis, iterations=1)
        tri_n = None
        return vd, mn, h
    vol = ndimage.gaussian_filter(solid.astype(np.float32), sigma) if sigma else solid.astype(np.float32)
    v, f, _, _ = measure.marching_cubes(vol, level=0.5)
    return v * h + mn + h * 0.5, f.astype(np.int64)[:, [0, 2, 1]]
def vnormals_crease(v, f, crease=50.0):
    fn = np.cross(v[f[:, 1]] - v[f[:, 0]], v[f[:, 2]] - v[f[:, 0]]); N = np.zeros_like(v)
    for k in range(3): np.add.at(N, f[:, k], fn)
    return N / np.maximum(np.linalg.norm(N, axis=1), 1e-12)[:, None]

def visible_tris(P, F, vd, mn, h):
    """triángulos con algún punto de muestra en un voxel contiguo al exterior"""
    A = P[F[:, 0]]; Bv = P[F[:, 1]]; C = P[F[:, 2]]
    vis = np.zeros(len(F), bool)
    for w in ((1/3, 1/3, 1/3), (.8, .1, .1), (.1, .8, .1), (.1, .1, .8), (.45, .45, .1), (.1, .45, .45), (.45, .1, .45), (1, 0, 0), (0, 1, 0), (0, 0, 1)):
        S = w[0] * A + w[1] * Bv + w[2] * C; idx = np.clip(np.floor((S - mn) / h).astype(int), 0, np.array(vd.shape) - 1)
        vis |= vd[idx[:, 0], idx[:, 1], idx[:, 2]]
    return vis
def sample_with_normals(P, Nn, F, sp, seed=1):
    """puntos (y normales) repartidos por área sobre la malla + sus propios vértices"""
    A = P[F[:, 0]]; Bv = P[F[:, 1]]; C = P[F[:, 2]]
    area = 0.5 * np.linalg.norm(np.cross(Bv - A, C - A), axis=1)
    cnt = np.ceil(area / (sp * sp)).astype(np.int64) + 1
    idx = np.repeat(np.arange(len(F)), cnt); rng = np.random.default_rng(seed)
    r1 = np.sqrt(rng.random(len(idx))); r2 = rng.random(len(idx)); w0 = 1 - r1; w1 = r1 * (1 - r2); w2 = r1 * r2
    S = (w0[:, None] * A[idx] + w1[:, None] * Bv[idx] + w2[:, None] * C[idx]).astype(np.float32)
    SN = (w0[:, None] * Nn[F[idx, 0]] + w1[:, None] * Nn[F[idx, 1]] + w2[:, None] * Nn[F[idx, 2]]).astype(np.float32)
    vs = np.unique(F)
    return np.vstack([S, P[vs].astype(np.float32)]), np.vstack([SN, Nn[vs].astype(np.float32)])
def shrink_snap(P, Nn, F, h, caps=(), sigma=0.7):
    """envoltura exterior con los vértices llevados a la superficie original (posición y normal reales)"""
    from scipy.spatial import cKDTree
    v, f = shrinkwrap(P, F, h, caps=caps, sigma=sigma)
    S, SN = sample_with_normals(P, Nn, F, h * 0.5)
    tree = cKDTree(S); dist, i = tree.query(v, workers=2)
    fn = np.cross(v[f[:, 1]] - v[f[:, 0]], v[f[:, 2]] - v[f[:, 0]]); gn = np.zeros_like(v)
    for k in range(3): np.add.at(gn, f[:, k], fn)
    gn /= np.maximum(np.linalg.norm(gn, axis=1), 1e-12)[:, None]
    v2 = S[i].astype(np.float64); n2 = SN[i].astype(np.float64); n2 /= np.maximum(np.linalg.norm(n2, axis=1), 1e-9)[:, None]
    # la normal original debe mirar hacia fuera como la envoltura; si no (chapa fina vista por detrás), se da la vuelta
    flip = (n2 * gn).sum(1) < 0; n2[flip] *= -1
    far = dist > 2.5 * h; v2[far] = v[far]; n2[far] = gn[far]
    # soldar posiciones idénticas y quitar degenerados
    key = np.round(v2 / 2e-5).astype(np.int64); uq, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True); inv = inv.ravel()
    f2 = inv[f]; ok = (f2[:, 0] != f2[:, 1]) & (f2[:, 1] != f2[:, 2]) & (f2[:, 0] != f2[:, 2])
    return v2[first], n2[first], f2[ok]
