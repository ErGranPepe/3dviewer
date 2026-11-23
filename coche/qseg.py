# Segmenta los miembros tubulares (brazos de suspensión, etc.) de una esquina siguiendo sus secciones, y los etiqueta.
import sys, numpy as np
sys.path.insert(0, '/home/claude/tools/car')
from qload import *
from qtrack import tracks
def gate_track(V, B, tr, cand, axis=2, pad=0.0025, ext=(0.0, 0.0)):
    """triángulos (índices en B, dentro de cand) cuyos 3 vértices caen en la caja de sección interpolada de la pista"""
    zs = np.array([v for v, _ in tr]); o = np.argsort(zs); zs = zs[o]
    C = np.array([tr[i][1]['c'] for i in o]); MN = np.array([tr[i][1]['mn'] for i in o]) - C; MX = np.array([tr[i][1]['mx'] for i in o]) - C
    oth = [k for k in range(3) if k != axis]
    z0, z1 = zs[0] - ext[0], zs[-1] + ext[1]
    P = V[B[cand]]                                   # (n,3,3)
    z = P[:, :, axis]
    ok = ((z >= z0 - 1e-9) & (z <= z1 + 1e-9)).all(1)
    def interp(arr, zq):
        # lineal dentro; extrapolación lineal con la pendiente de los 8 cortes del extremo
        out = np.interp(zq, zs, arr)
        k = min(8, len(zs) - 1)
        s0 = (arr[k] - arr[0]) / (zs[k] - zs[0]); s1 = (arr[-1] - arr[-1 - k]) / (zs[-1] - zs[-1 - k])
        out = np.where(zq < zs[0], arr[0] + s0 * (zq - zs[0]), out); out = np.where(zq > zs[-1], arr[-1] + s1 * (zq - zs[-1]), out)
        return out
    for k in oth:
        c = interp(C[:, k], z)
        lo = np.interp(z, zs, MN[:, k]) - pad; hi = np.interp(z, zs, MX[:, k]) + pad
        q = P[:, :, k] - c
        ok &= ((q >= lo) & (q <= hi)).all(1)
    return cand[ok]
def inside_track(tr, pts, axis=2, pad=0.003, ext=(0.0, 0.0)):
    """¿cae cada punto dentro de la caja de sección (interpolada/extrapolada) de la pista?"""
    zs = np.array([v for v, _ in tr]); o = np.argsort(zs); zs = zs[o]
    C = np.array([tr[i][1]['c'] for i in o]); MN = np.array([tr[i][1]['mn'] for i in o]) - C; MX = np.array([tr[i][1]['mx'] for i in o]) - C
    z = pts[:, axis]
    ok = (z >= zs[0] - ext[0] - 1e-9) & (z <= zs[-1] + ext[1] + 1e-9)
    k8 = min(8, len(zs) - 1)
    for k in [k for k in range(3) if k != axis]:
        arr = C[:, k]; c = np.interp(z, zs, arr)
        s0 = (arr[k8] - arr[0]) / (zs[k8] - zs[0]); s1 = (arr[-1] - arr[-1 - k8]) / (zs[-1] - zs[-1 - k8])
        c = np.where(z < zs[0], arr[0] + s0 * (z - zs[0]), c); c = np.where(z > zs[-1], arr[-1] + s1 * (z - zs[-1]), c)
        q = pts[:, k] - c
        ok &= (q >= np.interp(z, zs, MN[:, k]) - pad) & (q <= np.interp(z, zs, MX[:, k]) + pad)
    return ok
BARY = np.array([[1, 0, 0], [0, 1, 0], [0, 0, 1], [.5, .5, 0], [0, .5, .5], [.5, 0, .5], [1/3, 1/3, 1/3], [.7, .15, .15], [.15, .7, .15], [.15, .15, .7], [.45, .45, .1], [.1, .45, .45], [.45, .1, .45]])
def gate_member(V, B, trs_ext, cand, frac=0.77, pad=0.003):
    """triángulos de cand con al menos frac de sus puntos de muestra dentro de la unión de cajas de las pistas del miembro"""
    P = V[B[cand]]                                         # (n,3,3)
    S = np.einsum('sk,nkc->nsc', BARY, P).reshape(-1, 3)   # (n*13,3)
    ins = np.zeros(len(S), bool)
    for tr, ext in trs_ext: ins |= inside_track(tr, S, pad=pad, ext=ext)
    return cand[ins.reshape(len(cand), len(BARY)).mean(1) >= frac]
if __name__ == '__main__':
    from glbwrite import write_glb, submesh
    d = np.load('/home/claude/tools/out/qv_welded.npz', allow_pickle=True)
    V, F, lab = d['V'], d['F'], d['lab']; B = F[lab == 0]
    Cn = V[B].mean(1)
    corners = {'FL': ({0: (-2.15, -1.2), 1: (0.12, 0.75)}, 1), 'FR': ({0: (-2.15, -1.2), 1: (0.12, 0.75)}, -1), 'RL': ({0: (1.15, 2.1), 1: (0.12, 0.75)}, 1), 'RR': ({0: (1.15, 2.1), 1: (0.12, 0.75)}, -1)}
    L = np.full(len(B), -1); legend = []
    pal = [(.9, .1, .1), (.1, .7, .1), (.1, .3, .95), (.95, .75, .05), (.85, .1, .85), (.05, .8, .8), (1, .5, 0), (.5, .25, .05), (.6, .9, .2), (.4, .4, 1), (1, .4, .6), (.3, .6, .3), (.7, .7, .1)]
    for name in sys.argv[1:]:
        box, sg = corners[name]
        vals = [sg * z for z in np.arange(0.06, 0.66, 0.004)]
        T = tracks(V, B, 2, vals, box)
        cand = np.where((Cn[:, 0] > box[0][0]) & (Cn[:, 0] < box[0][1]) & (Cn[:, 1] > box[1][0]) & (Cn[:, 1] < box[1][1]) & (Cn[:, 2] * sg > 0.03))[0]
        for tr in T:
            g = gate_track(V, B, tr, cand, ext=(0.16, 0.10))
            k = len(legend); L[g] = k
            legend.append((name, tr[0][0], tr[-1][0], tr[len(tr) // 2][1]['c'].round(3).tolist(), len(g), pal[k % len(pal)]))
    for k, l in enumerate(legend): print(k, l)
    parts = []
    rr = np.hypot(V[B][:, :, 0] - np.where(Cn[:, 0] < 0, -1.7, 1.7)[:, None], V[B][:, :, 1] - 0.359).max(1)
    drum = (L < 0) & (rr < 0.23) & (np.abs(Cn[:, 2]) > 0.5)
    v, f = submesh(V, B[drum]); parts.append(dict(name='drum', V=v, F=f, color=(.35, .35, .38)))
    v, f = submesh(V, B[(L < 0) & ~drum]); parts.append(dict(name='body', V=v, F=f, color=(.75, .75, .75)))
    for k, l in enumerate(legend):
        v, f = submesh(V, B[L == k]); parts.append(dict(name=f'tr{k}', V=v, F=f, color=l[5]))
    write_glb('/home/claude/tools/out/qseg.glb', parts)
