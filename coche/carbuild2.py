# Etapas 4-6: piezas -> simplificación por niveles -> librea/materiales -> ficheros car_hi/lo/far.bin del simulador (+ vista previa GLB)
import sys, json, struct, pickle, time, numpy as np
sys.path.insert(0, '/home/claude/tools/car')
from simp import simplify
from glbwrite import write_glb
from shrink import shrinkwrap
from qdec import smooth_normals
from scipy.sparse import coo_matrix
OUT = sys.argv[1]
d = np.load('/home/claude/tools/out/car1.npz', allow_pickle=True)
V, N, F, fl, big, lab = d['V'], d['N'], d['F'], d['fl'], int(d['big']), d['lab']; names = list(d['names'])
info = pickle.load(open('/home/claude/tools/out/car1_info.pkl', 'rb'))
B = F[fl == big]; O = F[fl != big]
WHL = {'FL': (-1.7, 0.3595, 0.7635), 'FR': (-1.7, 0.3595, -0.7635), 'RL': (1.7, 0.3595, 0.7278), 'RR': (1.7, 0.3595, -0.7278)}
SIMI = {'FR': 0, 'FL': 1, 'RR': 2, 'RL': 3}                 # índice de rueda del simulador (z del simulador = −z del modelo)
def T(p): p = np.asarray(p, dtype=np.float64); return p * np.array([-1.0, 1.0, -1.0])     # modelo -> simulador (giro de 180° sobre la vertical)
# ---------- puntos duros (lado izquierdo del modelo, z>0) a partir de los propios brazos ----------
def line(tr):
    zs = np.array([abs(v) for v, _ in tr]); C = np.array([l['c'] for _, l in tr]); C[:, 2] = np.abs(C[:, 2]); o = np.argsort(zs); zs = zs[o]; C = C[o]
    A = np.c_[zs, np.ones(len(zs))]; cx = np.linalg.lstsq(A, C[:, 0], rcond=None)[0]; cy = np.linalg.lstsq(A, C[:, 1], rcond=None)[0]
    return (lambda z: np.array([cx[0] * z + cx[1], cy[0] * z + cy[1], z])), zs[0], zs[-1]
def inner_z(memb, key):
    zs = [min(abs(v) for v, _ in tr) for k, tr in info[memb].items() if k == key or k.startswith(key + '_in')]
    return min(zs)
HP = {}
for ax, c in (('F', 'FL'), ('R', 'RL')):
    h = {}
    uF, _, _ = line(info[c + '_uw']['uwF']); uR, _, _ = line(info[c + '_uw']['uwR']); lF, _, _ = line(info[c + '_lw']['lwF']); rod, _, _ = line(info[c + '_rod']['rod'])
    h['UF'] = uF(inner_z(c + '_uw', 'uwF')); h['UR'] = uR(inner_z(c + '_uw', 'uwR')); h['LF'] = lF(inner_z(c + '_lw', 'lwF'))
    # vértice del trapecio superior: donde convergen los ejes de sus dos brazos
    def apex(f, g):
        zz = np.linspace(0.45, 0.80, 701); dd = [np.hypot(*(f(z) - g(z))[:2]) for z in zz]; z = zz[int(np.argmin(dd))]; return (f(z) + g(z)) / 2
    h['UOm'] = apex(uF, uR)
    if ax == 'F':
        lR, _, _ = line(info[c + '_lw']['lwR']); tie, _, _ = line(info[c + '_tie']['tie'])
        h['LR'] = lR(inner_z(c + '_lw', 'lwR')); h['LOm'] = apex(lF, lR)
        h['TI'] = tie(inner_z(c + '_tie', 'tie')); h['TO'] = tie(0.645)
        h['PI'] = rod(0.130); h['PO'] = rod(0.64)          # la bieleta sigue 5 cm dentro del chasis hasta el brazo del balancín
        # eje de dirección con cotas de ingeniería (avance 6°, salida 9,5°, avance en el suelo 18 mm, radio de pivotamiento 45 mm)
        W = np.array(WHL['FL']); G = np.array([W[0] - 0.018, 0.0, W[2] - 0.045]); kx = np.tan(np.radians(6.0)); kz = -np.tan(np.radians(9.5))
        h['LO'] = G + np.array([kx, 1, kz]) * h['LOm'][1]; h['UO'] = G + np.array([kx, 1, kz]) * h['UOm'][1]
    else:
        shr, _, _ = line(info[c + '_shr']['shr'])
        h['LR'] = shr(inner_z(c + '_shr', 'shr')); h['UO'] = h['UOm']; h['LO'] = np.array([1.710, 0.335, 0.660]); h['LOm'] = h['LO']
        h['PI'] = rod(inner_z(c + '_rod', 'rod')); h['PO'] = rod(0.56)
        h['TI'] = np.array([1.790, 0.314, 0.150]); h['TO'] = np.array([1.805, 0.320, 0.640])       # bieleta de convergencia: va por dentro del carenado del palier
        h['DI'] = np.array([1.705, 0.335, 0.135]); h['DO'] = np.array([1.700, 0.3595, 0.600])      # palier
    h['W'] = np.array(WHL[c]); HP[ax] = h
for ax in 'FR':
    print(ax, {k: np.round(v, 4).tolist() for k, v in HP[ax].items()})
# cizalla de los trapecios delanteros para que su vértice caiga en la rótula del eje de dirección
SHEAR = {}
for mem, key_o, key_m, zin in (('uw', 'UO', 'UOm', None), ('lw', 'LO', 'LOm', None)):
    h = HP['F']; z0 = (h['UF'][2] + h['UR'][2]) / 2 if mem == 'uw' else (h['LF'][2] + h['LR'][2]) / 2
    zo = h[key_m][2]; SHEAR[mem] = (z0, (h[key_o][0] - h[key_m][0]) / (zo - z0), (h[key_o][1] - h[key_m][1]) / (zo - z0))
print('shear', {k: np.round(v, 4).tolist() for k, v in SHEAR.items()})
def shear(P, mem):
    z0, kx, ky = SHEAR[mem]; P = P.copy(); a = np.maximum(0, np.abs(P[:, 2]) - z0); P[:, 0] += kx * a; P[:, 1] += ky * a; return P
# ---------- utilidades de malla ----------
def fix_normals(P, Nn, Fp):
    """sin normales nulas (dos caras opuestas soldadas se anulan): se toma la geométrica de sus caras, o la de una de ellas"""
    L = np.linalg.norm(Nn, axis=1); bad = L < 0.5
    if not bad.any(): return Nn / np.maximum(L, 1e-9)[:, None]
    Nn = Nn.copy(); fn = np.cross(P[Fp[:, 1]] - P[Fp[:, 0]], P[Fp[:, 2]] - P[Fp[:, 0]]); acc = np.zeros_like(P); one = np.zeros_like(P)
    for k in range(3): np.add.at(acc, Fp[:, k], fn); one[Fp[:, k]] = fn
    la = np.linalg.norm(acc, axis=1); lo = np.linalg.norm(one, axis=1)
    g = np.where((la > 1e-12)[:, None] & (la > 0.2 * lo)[:, None], acc / np.maximum(la, 1e-18)[:, None], one / np.maximum(lo, 1e-18)[:, None])
    g[np.linalg.norm(g, axis=1) < 0.5] = [0.0, 1.0, 0.0]
    Nn[bad] = g[bad]; L = np.linalg.norm(Nn, axis=1)
    return Nn / np.maximum(L, 1e-9)[:, None]
def sub(Fp):
    vs, inv = np.unique(Fp, return_inverse=True); return V[vs].copy(), N[vs].copy(), inv.reshape(-1, 3)
def compact(P, Nn, Fp):
    vs, inv = np.unique(Fp, return_inverse=True); return P[vs], Nn[vs], inv.reshape(-1, 3)
def simp(P, Nn, Fp, jobs):
    out = []
    for (f, e) in simplify(P, Fp, [dict(target=max(4, t), error=er, flags=['ErrorAbsolute'] + fl2) for t, er, fl2 in jobs]):
        out.append(compact(P, Nn, f) if len(f) else (P[:0], Nn[:0], f))
    return out
def cluster(P, Nn, Fp, cell):
    """nivel lejano: agrupamiento de vértices por celda y por cara dominante de la normal (las dos caras de una chapa no se funden)"""
    dom = np.argmax(np.abs(Nn), axis=1); sgn = (Nn[np.arange(len(Nn)), dom] > 0).astype(np.int64)
    key = np.c_[np.floor(P / cell).astype(np.int64), dom * 2 + sgn]
    uq, inv = np.unique(key, axis=0, return_inverse=True); inv = inv.ravel()
    P2 = np.zeros((len(uq), 3)); cnt = np.zeros(len(uq)); np.add.at(P2, inv, P); np.add.at(cnt, inv, 1); P2 /= cnt[:, None]
    N2 = np.zeros((len(uq), 3)); np.add.at(N2, inv, Nn); N2 /= np.maximum(np.linalg.norm(N2, axis=1), 1e-9)[:, None]
    F2 = inv[Fp]; ok = (F2[:, 0] != F2[:, 1]) & (F2[:, 1] != F2[:, 2]) & (F2[:, 0] != F2[:, 2]); F2 = F2[ok]
    Fs = np.sort(F2, axis=1); _, keep = np.unique(Fs, axis=0, return_index=True); keep.sort(); F2 = F2[keep]
    return compact(P2, N2, F2)
def split_field(P, Nn, Fp, f):
    """parte los triángulos que cruzan f=0 (f por vértice) para que la frontera quede nítida"""
    s = f >= 0; sf = s[Fp]; cnt = sf.sum(1); cross = (cnt == 1) | (cnt == 2)
    if not cross.any(): return P, Nn, Fp
    Fc = Fp[cross]; sc = sf[cross]; lone_true = sc.sum(1) == 1
    k = np.where(lone_true, np.argmax(sc, axis=1), np.argmin(sc, axis=1))
    r = np.arange(len(Fc)); a = Fc[r, k]; b = Fc[r, (k + 1) % 3]; c = Fc[r, (k + 2) % 3]
    def mid(u, v):
        lo = np.minimum(u, v); hi = np.maximum(u, v); key = lo.astype(np.int64) * len(P) + hi
        uq, first, inv = np.unique(key, return_index=True, return_inverse=True)
        l2 = lo[first]; h2 = hi[first]; t = f[l2] / (f[l2] - f[h2]); t = np.clip(t, 0, 1)[:, None]
        return uq, P[l2] + t * (P[h2] - P[l2]), Nn[l2] + t * (Nn[h2] - Nn[l2]), inv.ravel()
    keys = np.r_[np.minimum(a, b).astype(np.int64) * len(P) + np.maximum(a, b), np.minimum(a, c).astype(np.int64) * len(P) + np.maximum(a, c)]
    uq, first, inv = np.unique(keys, return_index=True, return_inverse=True); inv = inv.ravel()
    lo = np.r_[np.minimum(a, b), np.minimum(a, c)][first]; hi = np.r_[np.maximum(a, b), np.maximum(a, c)][first]
    t = np.clip(f[lo] / (f[lo] - f[hi]), 0, 1)[:, None]
    Pn = P[lo] + t * (P[hi] - P[lo]); Nq = Nn[lo] + t * (Nn[hi] - Nn[lo]); Nq /= np.maximum(np.linalg.norm(Nq, axis=1), 1e-9)[:, None]
    mab = len(P) + inv[:len(a)]; mac = len(P) + inv[len(a):]
    newF = np.vstack([np.c_[a, mab, mac], np.c_[mab, b, c], np.c_[mab, c, mac]])
    return np.vstack([P, Pn]), np.vstack([Nn, Nq]), np.vstack([Fp[~cross], newF])
def taubin(v, f, it=8, lam=0.5, mu=-0.53):
    n = len(v); i = np.r_[f[:, 0], f[:, 1], f[:, 2], f[:, 1], f[:, 2], f[:, 0]]; j = np.r_[f[:, 1], f[:, 2], f[:, 0], f[:, 0], f[:, 1], f[:, 2]]
    A = coo_matrix((np.ones(len(i)), (i, j)), shape=(n, n)).tocsr(); A.data[:] = 1; deg = np.maximum(np.asarray(A.sum(1)).ravel(), 1)
    for k in range(it):
        for sc in (lam, mu): v = v + sc * ((A @ v) / deg[:, None] - v)
    return v
def shell(P, Fp, h, jobs, caps=(), smooth=8, crease=48):
    """niveles lejanos: envoltura exterior limpia, alisada y simplificada; normales con aristas vivas"""
    v, f = shrinkwrap(P, Fp, h, caps=caps); v = taubin(v, f, smooth)
    out = []
    for (ff, e) in simplify(v, f, [dict(target=t, error=er, flags=['ErrorAbsolute']) for t, er in jobs]):
        u, i2 = np.unique(ff, return_inverse=True); out.append(smooth_normals(v[u], i2.reshape(-1, 3), crease))
    return out
np.savez('/home/claude/tools/out/car_hp.npz', **{ax + '_' + k: v for ax in 'FR' for k, v in HP[ax].items()})
pickle.dump(dict(HP=HP, SHEAR=SHEAR), open('/home/claude/tools/out/car_hp.pkl', 'wb'))
# ---------- librea y materiales de la carrocería (coordenadas del modelo: morro en −x, +y arriba) ----------
def belt(x):                      # línea de cintura: por debajo va en negro satinado, por encima el color del equipo
    return np.interp(x, [-2.95, -2.3, -1.2, -0.6, 0.4, 1.3, 2.2], [0.05, 0.20, 0.27, 0.30, 0.325, 0.36, 0.40])
def classify(C, Nf):
    """0 pintura equipo, 1 negro, 2 acento, 3 blanco, 9 carbono visto"""
    x, y, z = C[:, 0], C[:, 1], np.abs(C[:, 2]); t = np.zeros(len(C), dtype=np.int8)
    b = belt(x)
    t[y < b] = 1
    t[(y >= b) & (y < b + 0.022) & (x > -2.3)] = 2
    t[y < 0.128] = 9                                                     # suelo, tablón, pies de la deriva
    t[(x > -1.3) & (x < -0.55) & (z > 0.46) & (y < 0.52)] = 9            # deflectores del borde del suelo
    t[(x > 1.25) & (y < 0.215)] = 9                                      # difusor
    t[(x > 2.0) & (y < 0.52) & (z < 0.16)] = 9                           # estructura de impacto trasera
    fw = x < -2.03
    t[fw & (z >= 0.19)] = 9                                              # lo que queda del alerón delantero
    t[fw & (z > 0.845)] = 2                                              # derivas
    t[fw & (z < 0.19) & (y >= 0.128)] = 0                                # morro
    t[(x < -2.72) & (z < 0.19) & (y >= 0.128)] = 2                       # punta del morro
    rw = (x > 1.72) & (y > 0.53)
    t[rw & (z > 0.5)] = 0; t[rw & (z > 0.5) & (y > 0.86)] = 2            # derivas traseras con franja
    t[rw & (z < 0.09) & (y < 0.80) & (x > 1.78)] = 9                     # pilón central
    t[(x > -0.96) & (x < 0.12) & (y > 0.76) & (z < 0.37)] = 1            # halo
    t[(x > -0.76) & (x < -0.5) & (z > 0.47) & (y > 0.625)] = 1           # retrovisores
    t[(x > 0.12) & (x < 0.5) & (y > 1.035)] = 1                          # cámara sobre la toma

    return t
def uv_carbon(P, Nn):
    dom = np.argmax(np.abs(Nn), axis=1); a = np.where(dom == 0, P[:, 2], P[:, 0]); b = np.where(dom == 1, P[:, 2], P[:, 1])
    return np.c_[a, b] * 2.2
# ---------- ensamblado ----------
LODS = ('hi', 'lo', 'far')
meshes = {l: [] for l in LODS}
NOSEX = -2.06                                     # corte del conjunto morro + alerón (modelo)
NOSE_T = [-NOSEX, 0.25, 0.0]
groups = {'static': {'t': [0, 0, 0], 'r': [0, 0, 0, 1]}, 'nose': {'t': NOSE_T, 'r': [0, 0, 0, 1]}}
def emit(lod, g, m, P, Nn, Fp, col=(.5, .5, .5), met=0, rou=.5, tags=None, uv=None, origin=(0, 0, 0)):
    """P en coordenadas del modelo -> simulador, relativo al origen del grupo (origin, ya en coordenadas del simulador)"""
    if not len(Fp): return
    Nn = fix_normals(P, Nn, Fp)
    Ps = T(P) - np.asarray(origin); Ns = Nn * np.array([-1.0, 1.0, -1.0])
    meshes[lod].append(dict(g=g, m=m, P=Ps, N=Ns, F=Fp, col=list(col), met=met, rou=rou, tags=tags, uv=uv))
def emit_body(lod, P, Nn, Fp, g_static='static'):
    # cortes nítidos: junta del morro, línea de cintura y filete
    P, Nn, Fp = split_field(P, Nn, Fp, P[:, 0] - NOSEX)
    P, Nn, Fp = split_field(P, Nn, Fp, P[:, 1] - belt(P[:, 0]))
    P, Nn, Fp = split_field(P, Nn, Fp, P[:, 1] - belt(P[:, 0]) - 0.022)
    P, Nn, Fp = split_field(P, Nn, Fp, P[:, 1] - 0.128)
    for fld in (lambda Q: Q[:, 1] - 0.76, lambda Q: Q[:, 0] + 0.96, lambda Q: Q[:, 0] - 0.12, lambda Q: Q[:, 0] + 2.72, lambda Q: Q[:, 1] - 1.035,
                lambda Q: Q[:, 2] - 0.47, lambda Q: Q[:, 2] + 0.47, lambda Q: Q[:, 1] - 0.625, lambda Q: Q[:, 1] - 0.86, lambda Q: Q[:, 2] - 0.845, lambda Q: Q[:, 2] + 0.845):
        P, Nn, Fp = split_field(P, Nn, Fp, fld(P))
    C = P[Fp].mean(1); fn = np.cross(P[Fp[:, 1]] - P[Fp[:, 0]], P[Fp[:, 2]] - P[Fp[:, 0]]); fn /= np.maximum(np.linalg.norm(fn, axis=1), 1e-12)[:, None]
    fn *= np.sign((fn * Nn[Fp].sum(1)).sum(1))[:, None]
    tg = classify(C, fn); isn = C[:, 0] < NOSEX
    for grp, msk in (('nose', isn), (g_static, ~isn)):
        # carbono visto
        m = msk & (tg == 9)
        if m.any():
            p, n, f = compact(P, Nn, Fp[m]); emit(lod, grp, 'f1-carbon', p, n, f, col=(1, 1, 1), met=.25, rou=.3, uv=uv_carbon(p, n), origin=groups[grp]['t'])
        # pintura: un trozo por etiqueta (vértices duplicados en las fronteras)
        ps = []; ns = []; fs = []; ts = []; off = 0
        for k in (0, 1, 2, 3):
            m = msk & (tg == k)
            if not m.any(): continue
            p, n, f = compact(P, Nn, Fp[m]); ps.append(p); ns.append(n); fs.append(f + off); ts.append(np.full(len(p), k, dtype=np.uint8)); off += len(p)
        if ps: emit(lod, grp, 'f1-paint', np.vstack(ps), np.vstack(ns), np.vstack(fs), col=(1, 1, 1), met=.35, rou=.16, tags=np.concatenate(ts), origin=groups[grp]['t'])
t0 = time.time()
# carrocería (con las partes fijas de los alerones en los niveles lejanos)
def nm(prefix): return [k for k, n in enumerate(names) if n.startswith(prefix)]
P, Nn, Fp = sub(B[lab == 0])
res = simp(P, Nn, Fp, [(70000, 0.0012, [])])
emit_body('hi', *res[0])
fixed = [0] + nm('fw_main') + nm('fw_tip') + nm('fw_foot') + nm('rw_main')
Pf, Nf, Ff = sub(B[np.isin(lab, fixed)])
sh = shell(Pf, Ff, 0.006, [(12500, 0.009), (3200, 0.035)], caps=[((-0.50, 0.47, -0.19), (0.0, 0.49, 0.19))])
emit_body('lo', *sh[0]); emit_body('far', *sh[1])
print('body', len(Fp), '->', len(res[0][2]), [len(q[2]) for q in sh], round(time.time() - t0, 1), 's')
for pre, grp, mat in (('fw_main', 'nose', 'f1-carbon'), ('fw_tip', 'nose', 'f1-carbon'), ('fw_foot', 'nose', 'f1-carbon'), ('rw_main', 'static', 'f1-carbon')):
    P, Nn, Fp = sub(B[np.isin(lab, nm(pre))])
    q = simp(P, Nn, Fp, [(max(300, len(Fp) // 8), 0.0006, [])])[0]
    emit('hi', grp, mat, *q, col=(1, 1, 1), met=.25, rou=.3, uv=uv_carbon(q[0], q[1]), origin=groups[grp]['t'])
FLAPS = []
def flap_axis(P):
    """eje de giro: borde de ataque del elemento (línea por sus puntos más adelantados a lo ancho)"""
    zs = np.linspace(np.percentile(np.abs(P[:, 2]), 3), np.percentile(np.abs(P[:, 2]), 97), 14); pts = []
    for a, b in zip(zs[:-1], zs[1:]):
        m = (np.abs(P[:, 2]) >= a) & (np.abs(P[:, 2]) < b)
        if m.sum() < 5: continue
        q = P[m]; i = np.argmin(q[:, 0]); pts.append([q[i, 0], q[i, 1], (a + b) / 2])
    pts = np.array(pts); A = np.c_[pts[:, 2], np.ones(len(pts))]
    cx = np.linalg.lstsq(A, pts[:, 0], rcond=None)[0]; cy = np.linalg.lstsq(A, pts[:, 1], rcond=None)[0]
    return cx, cy
def emit_flap(g, p, n, f, piv):
    q = simp(p, n, f, [(max(260, len(f) // 24), 0.0008, [])])[0]
    emit('hi', g, 'f1-blue', *q, col=(.014, .114, 1), met=.4, rou=.18, origin=T(piv))
    for l, q in zip(('lo', 'far'), shell(p, f, 0.004, [(240, 0.009), (50, 0.03)], smooth=4)): emit(l, g, 'f1-blue', *q, col=(.014, .114, 1), met=.4, rou=.18, origin=T(piv))
k = 0
for el in ('flapA', 'flapB'):
    P, Nn, Fp = sub(B[lab == names.index('fw_' + el)])
    P, Nn, Fp = split_field(P, Nn, Fp, P[:, 2])
    side = np.sign(P[Fp].mean(1)[:, 2])
    for sg in (1, -1):
        p, n, f = compact(P, Nn, Fp[side == sg])
        cx, cy = flap_axis(p)
        zm = 0.36; piv = np.array([cx[0] * zm + cx[1] + 0.012, cy[0] * zm + cy[1], sg * zm]); ax = np.array([cx[0], cy[0], 1.0]) * np.array([1, 1, sg]); ax /= np.linalg.norm(ax)
        axs = T(ax) * (1 if T(ax)[2] > 0 else -1); g = 'fwflap_%d' % k; k += 1
        groups[g] = {'t': np.round(T(piv), 5).tolist(), 'r': [0, 0, 0, 1], 'axis': np.round(axs, 5).tolist(), 'parent': 'nose'}
        emit_flap(g, p, n, f, piv)
P, Nn, Fp = sub(B[np.isin(lab, [names.index('rw_flapA'), names.index('rw_flapB')])])
pa = V[np.unique(B[lab == names.index('rw_flapA')])]; piv = np.array([pa[:, 0].min() + 0.01, pa[np.abs(pa[:, 2]) < 0.05][:, 1].min() + 0.012, 0.0])
groups['rwflap'] = {'t': np.round(T(piv), 5).tolist(), 'r': [0, 0, 0, 1], 'axis': [0, 0, 1]}
emit_flap('rwflap', P, Nn, Fp, piv)
print('wings', round(time.time() - t0, 1), 's')
# suspensión: cada brazo es una pieza con su pivote; tambores y accesorios van con la mangueta
RIG = {'wheels': [None] * 4, 'arms': []}
def mirror(p, sg): p = np.array(p, dtype=np.float64).copy(); p[2] *= sg; return p
for c in ('FL', 'FR', 'RL', 'RR'):
    ax = c[0]; sg = 1 if c[1] == 'L' else -1; i = SIMI[c]; h = {k: mirror(v, sg) for k, v in HP[ax].items()}; W = np.array(WHL[c])
    groups['spin_%d' % i] = {'t': np.round(T(W), 5).tolist(), 'r': [0, 0, 0, 1]}; groups['steer_%d' % i] = {'t': np.round(T(W), 5).tolist(), 'r': [0, 0, 0, 1]}
    RIG['wheels'][i] = {'c': np.round(T(W), 5).tolist(), 'kp': [np.round(T(h['LO']), 5).tolist(), np.round(T(h['UO']), 5).tolist()], 'front': ax == 'F'}
    # tambor + toma/aletas
    P, Nn, Fp = sub(B[np.isin(lab, [names.index(c + '_drum'), names.index(c + '_up')])])
    r = simp(P, Nn, Fp, [(700, 0.0016, [])]) + shell(P, Fp, 0.006, [(140, 0.012), (40, 0.05)], smooth=4)
    for l, q in zip(LODS, r): emit(l, 'steer_%d' % i, 'f1-satin', *q, col=(.012, .012, .014), met=.3, rou=.5, origin=T(W))
    def arm(mem, kind, piv, axis_pts, outer, extra=None):
        P, Nn, Fp = sub(B[lab == names.index(c + '_' + mem)])
        if ax == 'F' and mem in SHEAR: P = shear(P, mem)
        g = 'arm_%d_%s' % (i, mem); groups[g] = {'t': np.round(T(piv), 5).tolist(), 'r': [0, 0, 0, 1]}
        e = {'g': g, 'w': i, 'k': kind, 'p': np.round(T(piv), 5).tolist(), 'o': np.round(T(outer), 5).tolist()}
        if axis_pts is not None:
            a = T(axis_pts[1]) - T(axis_pts[0]); e['a'] = np.round(a / np.linalg.norm(a), 5).tolist()
        if extra: e.update(extra)
        RIG['arms'].append(e)
        r = simp(P, Nn, Fp, [(max(120, len(Fp) // 14), 0.0005, []), (max(30, len(Fp) // 70), 0.005, []), (16, 0.03, [])])
        emit('hi', g, 'f1-carbon', *r[0], col=(1, 1, 1), met=.25, rou=.3, uv=uv_carbon(r[0][0], r[0][1]), origin=T(piv))
        # en los niveles lejanos los brazos no se articulan: van con la carrocería
        emit('lo', 'static', 'f1-carbon', *r[1], col=(1, 1, 1), met=.25, rou=.3, uv=uv_carbon(r[1][0], r[1][1]))
        q = r[2]; emit('far', 'static', 'f1-carbon', *q, col=(1, 1, 1), met=.25, rou=.3, uv=uv_carbon(q[0], q[1]))
    arm('uw', 'hinge', h['UF'], (h['UF'], h['UR']), h['UO'])
    if ax == 'F':
        arm('lw', 'hinge', h['LF'], (h['LF'], h['LR']), h['LO'])
        arm('rod', 'aim', h['PI'], None, h['PO'])
        arm('tie', 'tie', h['TI'], None, h['TO'])
        RIG['wheels'][i].update({'ti': np.round(T(h['TI']), 5).tolist(), 'to': np.round(T(h['TO']), 5).tolist()})
    else:
        arm('lw', 'hinge', h['LF'], (h['LF'], h['LR']), h['LO'])
        arm('shr', 'hinge', h['LR'], (h['LF'], h['LR']), h['LO'])
        arm('rod', 'aim', h['PI'], None, h['PO'])
print('susp', round(time.time() - t0, 1), 's')
pickle.dump(dict(meshes=meshes, groups=groups, RIG=RIG), open(OUT + '/car2_stage.pkl', 'wb'))
