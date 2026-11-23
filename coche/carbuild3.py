# Etapa final: ruedas, escape, espejos, casco; cabecera con el montaje y escritura de car_hi/lo/far.bin + vista previa
import sys, json, struct, pickle, time, hashlib, numpy as np
sys.path.insert(0, '/home/claude/tools/car')
exec(open('/home/claude/tools/car/carbuild2.py').read().split('# ---------- librea y materiales')[0].replace("OUT = sys.argv[1]", "OUT = sys.argv[1]"))
st = pickle.load(open(OUT + '/car2_stage.pkl', 'rb')); meshes, groups, RIG = st['meshes'], st['groups'], st['RIG']
LODS = ('hi', 'lo', 'far')
def emit(lod, g, m, P, Nn, Fp, col=(.5, .5, .5), met=0, rou=.5, tags=None, uv=None, origin=(0, 0, 0)):
    if not len(Fp): return
    Nn = fix_normals(P, Nn, Fp)
    meshes[lod].append(dict(g=g, m=m, P=T(P) - np.asarray(origin), N=Nn * np.array([-1.0, 1.0, -1.0]), F=Fp, col=list(col), met=met, rou=rou, tags=tags, uv=uv))
Co = V[O].mean(1)
used = np.zeros(len(O), bool)
def dp(pts, eps):
    """Douglas-Peucker sobre una polilínea (n,2)"""
    if len(pts) < 3: return list(range(len(pts)))
    keep = np.zeros(len(pts), bool); keep[0] = keep[-1] = True; st = [(0, len(pts) - 1)]
    while st:
        a, b = st.pop()
        if b <= a + 1: continue
        d = pts[b] - pts[a]; L = np.hypot(*d); q = pts[a + 1:b] - pts[a]
        dist = np.abs(q[:, 0] * d[1] - q[:, 1] * d[0]) / L if L > 1e-9 else np.hypot(q[:, 0], q[:, 1])
        i = int(np.argmax(dist))
        if dist[i] > eps: keep[a + 1 + i] = True; st += [(a, a + 1 + i), (a + 1 + i, b)]
    return np.where(keep)[0].tolist()
def wheel_profile(Fw, W, sg):
    """perfil exterior de la rueda en el semiplano (za, r): za positivo hacia fuera del coche, desde el plano medio del neumático"""
    A = V[Fw[:, 0]]; Bv = V[Fw[:, 1]]; C = V[Fw[:, 2]]
    area = 0.5 * np.linalg.norm(np.cross(Bv - A, C - A), axis=1); cnt = np.ceil(area / 4e-7).astype(np.int64) + 1
    idx = np.repeat(np.arange(len(Fw)), cnt); rng = np.random.default_rng(3); r1 = np.sqrt(rng.random(len(idx))); r2 = rng.random(len(idx))
    S = (1 - r1)[:, None] * A[idx] + (r1 * (1 - r2))[:, None] * Bv[idx] + (r1 * r2)[:, None] * C[idx]; S = np.vstack([S, V[np.unique(Fw)]])
    r = np.hypot(S[:, 0] - W[0], S[:, 1] - W[1]); za = (S[:, 2] - W[2]) * sg
    # 1) neumático y pestañas de la llanta: envolvente polar desde el centro de la sección
    rc = 0.300; ang = np.degrees(np.arctan2(r - rc, za)); rho = np.hypot(r - rc, za); pts = []
    for a0 in np.arange(-180, 180, 1.0):
        m = (ang >= a0) & (ang < a0 + 1.0)
        if not m.any(): continue
        i = np.argmax(rho[m]); pts.append((a0, za[m][i], r[m][i]))
    pts = np.array(pts)
    # recorrido: del labio interior (za<0, r pequeño) subiendo por el flanco interior, banda, flanco exterior hasta el labio exterior
    a = pts[:, 0]; order = np.argsort(np.where(a < -90, a + 360, a))[::-1]      # de 270° (abajo-dentro… ) hacia −90°
    pts = pts[order]; pts = pts[pts[:, 2] >= 0.2265]
    prof = pts[:, 1:3]
    # 2) tapacubos y tuerca: para cada radio, lo más exterior
    rs = np.arange(0.2255, -0.0005, -0.0015); cov = []
    for rr in rs:
        m = (np.abs(r - max(rr, 0.0)) < 0.0012) & (za > 0.02)
        if m.any(): cov.append((za[m].max(), max(rr, 0.0)))
    cov = np.array(cov)
    # 3) lado interior: un tramo de garganta de la llanta hacia dentro de la rueda
    zin = prof[0, 0]; rin = prof[0, 1]
    inner = np.array([[zin + 0.085, rin - 0.012], [zin + 0.004, rin - 0.012]])
    return np.vstack([inner, prof, cov])
def lathe(prof, nseg, W, sg, eps):
    """superficie de revolución del perfil; devuelve piezas por material"""
    keep = dp(prof, eps); pr = prof[keep]
    # material de cada tramo según su radio medio y su lado
    out = {}
    seg_m = []
    for k in range(len(pr) - 1):
        zm = (pr[k, 0] + pr[k + 1, 0]) / 2; rm = (pr[k, 1] + pr[k + 1, 1]) / 2
        mat = 'tyre' if rm >= 0.2475 else ('nut' if rm < 0.045 and zm > 0.05 else ('cover' if rm <= 0.2215 and zm > 0.05 else 'rim'))
        seg_m.append(mat)
    th = np.linspace(0, 2 * np.pi, nseg, endpoint=False); cs = np.cos(th); sn = np.sin(th)
    for mat in set(seg_m):
        Ps = []; Ns = []; Fs = []; off = 0
        ks = [k for k, m in enumerate(seg_m) if m == mat]
        # tramos consecutivos del mismo material -> tiras; normales suaves dentro de la tira salvo esquinas > 40°
        runs = []; cur = [ks[0]]
        for k in ks[1:]:
            if k == cur[-1] + 1: cur.append(k)
            else: runs.append(cur); cur = [k]
        runs.append(cur)
        for run in runs:
            p = pr[run[0]:run[-1] + 2]; t = np.diff(p, axis=0); t /= np.maximum(np.hypot(t[:, 0], t[:, 1]), 1e-12)[:, None]
            sn2 = np.c_[t[:, 1], -t[:, 0]]                       # normal del tramo en (za, r): se orienta luego
            # orientación: hacia fuera de la sección (lejos del centro del neumático para r>0.2265; hacia +za en el tapacubos)
            mid = (p[:-1] + p[1:]) / 2; ref = np.where((mid[:, 1] >= 0.2265)[:, None], mid - np.array([0, 0.300]), np.array([[1.0, 0.0]]))
            if run[0] == 0: ref = np.array([[0.0, -1.0]] * len(mid))       # garganta interior: mira al eje
            flip = (sn2 * ref).sum(1) < 0; sn2[flip] *= -1
            for q in range(len(p) - 1):
                n0 = sn2[q].copy(); n1 = sn2[q].copy()
                if q > 0 and (sn2[q] * sn2[q - 1]).sum() > 0.766: n0 = sn2[q] + sn2[q - 1]
                if q < len(p) - 2 and (sn2[q] * sn2[q + 1]).sum() > 0.766: n1 = sn2[q] + sn2[q + 1]
                n0 /= np.hypot(*n0); n1 /= np.hypot(*n1)
                for (pp, nn2) in ((p[q], n0), (p[q + 1], n1)):
                    Ps.append(np.c_[W[0] + pp[1] * cs, W[1] + pp[1] * sn, np.full(nseg, W[2] + sg * pp[0])])
                    Ns.append(np.c_[nn2[1] * cs, nn2[1] * sn, np.full(nseg, sg * nn2[0])])
                i0 = off + np.arange(nseg); i1 = off + (np.arange(nseg) + 1) % nseg; j0 = i0 + nseg; j1 = i1 + nseg
                if p[q, 1] < 1e-6: Fs.append(np.c_[i0, j0, j1])
                elif p[q + 1, 1] < 1e-6: Fs.append(np.c_[i0, j0, i1])
                else: Fs.append(np.vstack([np.c_[i0, j0, j1], np.c_[i0, j1, i1]]))
                off += 2 * nseg
        P = np.vstack(Ps); Nn = np.vstack(Ns); Fp = np.vstack(Fs)
        # caras hacia fuera según la normal
        fn = np.cross(P[Fp[:, 1]] - P[Fp[:, 0]], P[Fp[:, 2]] - P[Fp[:, 0]]); fl2 = (fn * Nn[Fp].sum(1)).sum(1) < 0; Fp[fl2] = Fp[fl2][:, [0, 2, 1]]
        out[mat] = (P, Nn, Fp)
    return out, pr
MATS = {'tyre': ('f1-tyre', (.007, .007, .009), 0, .78), 'rim': ('f1-rim', (.024, .026, .031), .9, .32), 'cover': ('f1-satin', (.012, .012, .014), .3, .5), 'nut': ('f1-gold', (.584, .352, .06), 1, .22)}
for c, W in WHL.items():
    i = SIMI[c]; W = np.array(W); sg = np.sign(W[2])
    m = (np.hypot(Co[:, 0] - W[0], Co[:, 1] - W[1]) < 0.375) & (Co[:, 2] * sg > 0.5); used |= m
    prof = wheel_profile(O[m], W, sg)
    ty = prof[prof[:, 1] >= 0.2475]; rad = float(prof[:, 1].max()); hw = float((ty[:, 0].max() - ty[:, 0].min()) / 2)
    RIG['wheels'][i].update({'r': round(rad, 4), 'hw': round(hw, 4), 'zc': round(float((ty[:, 0].max() + ty[:, 0].min()) / 2), 4)})
    for l, (nseg, eps) in zip(LODS, ((64, 0.0009), (20, 0.004), (12, 0.012))):
        parts, pr = lathe(prof, nseg, W, sg, eps)
        for mat, (P, Nn, Fp) in parts.items():
            if l != 'hi' and mat == 'nut': continue
            mm = MATS[mat]; emit(l, 'spin_%d' % i, mm[0], P, Nn, Fp, col=mm[1], met=mm[2], rou=mm[3], origin=T(W))
        if l != 'far':
            # flanco exterior: banda fina sobre la goma (0,8 mm) con UV planas, donde va pintada la franja del compuesto y el rótulo
            sw = prof[(prof[:, 1] >= 0.2475) & (prof[:, 1] <= 0.318) & (prof[:, 0] > 0.03)]; sw = sw[np.argsort(sw[:, 1])]
            if len(sw) >= 2:
                kk = dp(sw[:, ::-1].copy(), 0.0006 if l == 'hi' else 0.003); bp = sw[kk].copy(); bp[:, 0] += 0.0008
                th = np.linspace(0, 2 * np.pi, nseg, endpoint=False); Ps = []; Ns = []; Fs = []; off = 0
                for q in range(len(bp) - 1):
                    for pp in (bp[q], bp[q + 1]):
                        Ps.append(np.c_[W[0] + pp[1] * np.cos(th), W[1] + pp[1] * np.sin(th), np.full(nseg, W[2] + sg * pp[0])]); Ns.append(np.tile([0, 0, sg], (nseg, 1)).astype(float))
                    i0 = off + np.arange(nseg); i1 = off + (np.arange(nseg) + 1) % nseg; Fs.append(np.vstack([np.c_[i0, i0 + nseg, i1 + nseg], np.c_[i0, i1 + nseg, i1]])); off += 2 * nseg
                P = np.vstack(Ps); Nn = np.vstack(Ns); Fp = np.vstack(Fs); fn = np.cross(P[Fp[:, 1]] - P[Fp[:, 0]], P[Fp[:, 2]] - P[Fp[:, 0]]); fl2 = (fn * Nn[Fp].sum(1)).sum(1) < 0; Fp[fl2] = Fp[fl2][:, [0, 2, 1]]
                Pl = T(P) - T(W); sds = np.sign(T(W)[2]); uv = np.c_[0.5 - sds * Pl[:, 0] / (2 * 0.99 * rad), 0.5 + Pl[:, 1] / (2 * 0.99 * rad)]
                emit(l, 'spin_%d' % i, 'f1-stripe', P, Nn, Fp, col=(1, .8, 0), met=0, rou=.7, origin=T(W), uv=uv)
    print(c, 'perfil', len(prof), '->', len(pr), 'R', round(rad, 4), 'hw', round(hw, 4), 'zc', RIG['wheels'][i]['zc'])
    if c in ('FL', 'RL'): RIG.setdefault('prof', {})[c[0]] = [[round(float(a), 4), round(float(b), 4)] for a, b in prof[dp(prof, 0.0006)]]
    np.save(OUT + '/wheel_prof_%s.npy' % c, prof)
# escape y cristales de los espejos; lo demás (tornillería suelta) va con la carrocería en negro
rest = O[~used]; Cr = V[rest].mean(1)
ex = (Cr[:, 0] > 1.5) & (Cr[:, 0] < 2.12) & (np.abs(Cr[:, 2]) < 0.06) & (Cr[:, 1] > 0.44) & (Cr[:, 1] < 0.6)
mi = (Cr[:, 0] > -0.67) & (Cr[:, 0] < -0.55) & (np.abs(Cr[:, 2]) > 0.47) & (Cr[:, 1] > 0.66)
P, Nn, Fp = sub(rest[ex]); res = simp(P, Nn, Fp, [(700, 0.001, [])])
for l, q in zip(('hi',), res): emit(l, 'static', 'f1-hot', *q, col=(.156, .122, .098), met=1, rou=.42)
P, Nn, Fp = sub(rest[mi]); print('mirror glass tris', len(Fp), 'bb', P.min(0).round(3), P.max(0).round(3))
for l in ('hi', 'lo'): emit(l, 'static', 'f1-mirror', P, Nn, Fp, col=(.738, .768, .807), met=1, rou=.02)
oth = rest[~(ex | mi)]
if len(oth):
    P, Nn, Fp = sub(oth); emit('hi', 'static', 'f1-satin', P, Nn, Fp, col=(.012, .012, .014), met=.3, rou=.5); print('otros sueltos', len(Fp))
# casco: el del modelo anterior (propio), colocado en el habitáculo nuevo
HEL = (0.20, 0.74, 0.0)
groups['helmet'] = {'t': list(HEL), 'r': [0, 0, 0, 1]}
OLD = {'hi': '/home/claude/tools/car/old/car_hi.dd6e141000.bin', 'lo': '/home/claude/tools/car/old/car_lo.0c80912124.bin', 'far': '/home/claude/tools/car/old/car_far.3c826a2613.bin'}
for l, pth in OLD.items():
    dd = open(pth, 'rb').read(); hl = struct.unpack('<I', dd[:4])[0]; hh = json.loads(dd[4:4 + hl]); base = 4 + hl
    for e in hh['meshes']:
        if e['g'] != 'helmet': continue
        n = e['n']; q = np.frombuffer(dd, dtype=np.uint16, count=n * 3, offset=base + e['p']).reshape(-1, 3).astype(np.float64)
        P = np.array(e['mn']) + q / 65535 * (np.array(e['mx']) - np.array(e['mn']))
        Nn = np.frombuffer(dd, dtype=np.int8, count=n * 3, offset=base + e['nn']).reshape(-1, 3).astype(np.float64) / 127
        I = np.frombuffer(dd, dtype=np.uint32 if e.get('i32') else np.uint16, count=e['ic'], offset=base + e['i']).reshape(-1, 3).astype(np.int64)
        meshes[l].append(dict(g='helmet', m=e['m'], P=P, N=Nn, F=I, col=e.get('col', [.5, .5, .5]), met=e.get('met', 0), rou=e.get('rou', .5), tags=None, uv=None))
# ---------- montaje para el simulador y el Laboratorio ----------
for ax, ids in (('F', (0, 1)), ('R', (2, 3))):
    h = HP[ax]; ui = (h['UF'] + h['UR']) / 2; li = (h['LF'] + h['LR']) / 2
    su = (h['UO'][1] - ui[1]) / (h['UO'][2] - ui[2]); sl2 = (h['LO'][1] - li[1]) / (h['LO'][2] - li[2])
    zic = (h['LO'][1] - h['UO'][1] + su * h['UO'][2] - sl2 * h['LO'][2]) / (su - sl2); yic = h['UO'][1] + su * (zic - h['UO'][2])
    cg = 1.0 / (h['W'][2] - zic); rc = yic * h['W'][2] / (h['W'][2] - zic)        # altura del centro de balanceo: recta del centro instantáneo al contacto, en el plano medio
    print(ax, 'centro instantáneo z=%.3f y=%.3f  brazo virtual %.2f m  ganancia de caída %.3f °/cm  centro de balanceo %.0f mm' % (zic, yic, h['W'][2] - zic, np.degrees(cg) / 100, rc * 1000))
    for i in ids: RIG['wheels'][i]['cg'] = round(float(cg), 4)
# ---------- puntos duros para el Laboratorio (mm; x hacia delante desde el eje, y lateral, z altura) ----------
def lab_pt(v, xa): return [round(float(-(v[0] - xa) * 1000), 1), round(float(abs(v[2]) * 1000), 1), round(float(v[1] * 1000), 1)]
LABHP = {}
for ax, xa, typ, r1, r2, alpha, up, sd_y, sd_z in (('F', -1.7, 'push', 55, 65, 100.0, 1, 58, 330), ('R', 1.7, 'pull', 55, 65, -100.0, -1, 110, 540)):
    h = HP[ax]; L = {k: lab_pt(h[k], xa) for k in ('LF', 'LR', 'LO', 'UF', 'UR', 'UO', 'PO', 'TI', 'TO')}
    ra = lab_pt(h['PI'], xa); po = L['PO']; d = np.array([ra[1] - po[1], ra[2] - po[2]]); d /= np.linalg.norm(d)
    perp = np.array([-d[1], d[0]]) * (1 if (-d[1] > 0) else -1)          # perpendicular a la bieleta, hacia fuera
    if up < 0: perp = np.array([abs(perp[0]), -abs(perp[1])])            # trasero: brazo hacia abajo y fuera
    else: perp = np.array([abs(perp[0]), abs(perp[1])])
    rp = [ra[0], round(ra[1] - r1 * perp[0], 1), round(ra[2] - r1 * perp[1], 1)]
    L.update({'type': typ, 'RP': rp, 'SD': [ra[0], sd_y, sd_z], 'r1': r1, 'r2': r2, 'rbeta': round(float(np.degrees(np.arctan2(perp[1], perp[0]))), 1), 'ralpha': alpha if alpha > 0 else 360 + alpha,
              'track': round(abs(h['W'][2]) * 2000, 1), 'R': round(RIG['wheels'][0 if ax == 'F' else 2]['r'] * 1000, 1), 'camber': -3.2 if ax == 'F' else -1.8, 'toe': 0})
    LABHP[ax] = L
RIG['lab'] = LABHP
print('LAB', json.dumps(LABHP))
RIG['nose'] = [2.06, 0.25]
RIG['helmet'] = list(HEL); RIG['sw'] = [0.52, 0.655, 0.0, 0.38]
RIG['cam'] = {'helmet': [0.27, 0.778], 'onboard': [-0.07, 1.13], 'nose': [1.30, 0.67]}
RIG['rain'] = [-2.165, 0.345, 0.0]
RIG['hp'] = {ax: {k: np.round(T(v), 5).tolist() for k, v in HP[ax].items()} for ax in 'FR'}          # lado z<0 del simulador (izquierda del modelo)
RIG['src'] = 'F1 2026 concept (polygon model), Qvist_designs, CC BY 4.0 — adaptado'
# ---------- escritura ----------
def write_bin(path, ms):
    hdr = {'groups': groups, 'rig': RIG, 'meshes': []}; blobs = []; off = 0
    def put(b):
        nonlocal off
        pad = (-off) % 4
        if pad: blobs.append(b'\0' * pad); off += pad
        o = off; blobs.append(b); off += len(b); return o
    for m in ms:
        P = m['P']; mn = P.min(0); mx = P.max(0); span = np.where(mx - mn < 1e-9, 1, mx - mn)
        q = np.round((P - mn) / span * 65535).astype(np.uint16)
        nn = np.clip(np.round(m['N'] * 127), -127, 127).astype(np.int8)
        n = len(P); i32 = n > 65535; I = m['F'].astype(np.uint32 if i32 else np.uint16).ravel()
        e = {'g': m['g'], 'm': m['m'], 'n': n, 'mn': np.round(mn, 6).tolist(), 'mx': np.round(mx, 6).tolist(), 'col': [round(float(x), 4) for x in m['col']], 'met': m['met'], 'rou': m['rou']}
        e['p'] = put(q.tobytes()); e['nn'] = put(nn.tobytes())
        if m.get('uv') is not None: e['uv'] = put(np.ascontiguousarray(m['uv'], dtype=np.float32).tobytes())
        if m.get('tags') is not None: e['c'] = put(m['tags'].astype(np.uint8).tobytes())
        e['i'] = put(I.tobytes()); e['ic'] = int(I.size)
        if i32: e['i32'] = 1
        hdr['meshes'].append(e)
    hb = json.dumps(hdr, separators=(',', ':')).encode(); hb += b' ' * ((-(4 + len(hb))) % 4)
    data = struct.pack('<I', len(hb)) + hb + b''.join(blobs)
    open(path, 'wb').write(data); return len(data)
def merge(ms):
    """une mallas del mismo grupo y material (menos llamadas de dibujo)"""
    out = {}
    for m in ms:
        k = (m['g'], m['m'], tuple(np.round(m['col'], 3)), m['tags'] is not None, m['uv'] is not None)
        if k not in out: out[k] = dict(m, P=[m['P']], N=[m['N']], F=[m['F']], tags=[m['tags']], uv=[m['uv']], off=len(m['P'])); continue
        o = out[k]; o['F'].append(m['F'] + o['off']); o['P'].append(m['P']); o['N'].append(m['N']); o['tags'].append(m['tags']); o['uv'].append(m['uv']); o['off'] += len(m['P'])
    res = []
    for k, o in out.items():
        res.append(dict(g=o['g'], m=o['m'], P=np.vstack(o['P']), N=np.vstack(o['N']), F=np.vstack(o['F']), col=o['col'], met=o['met'], rou=o['rou'],
                        tags=np.concatenate(o['tags']) if k[3] else None, uv=np.vstack(o['uv']) if k[4] else None))
    return res
PAL = {'f1-stripe': (1, .8, 0), 'f1-carbon': (.045, .047, .052), 'f1-tyre': (.03, .03, .033), 'f1-rim': (.06, .065, .075), 'f1-satin': (.03, .03, .034), 'f1-gold': (.58, .35, .06), 'f1-hot': (.3, .25, .2), 'f1-mirror': (.7, .75, .8), 'f1-blue': (.02, .2, .9), 'f1-white': (.8, .8, .8), 'f1-visor': (.02, .02, .03)}
TAGC = [(.85, .22, .05), (.03, .032, .036), (.02, .2, .9), (.9, .9, .9)]
for l in LODS:
    ms = merge(meshes[l]); tri = sum(len(m['F']) for m in ms)
    sz = write_bin(OUT + '/car_%s.bin' % l, ms)
    print(l, 'meshes', len(ms), 'tris', tri, 'verts', sum(len(m['P']) for m in ms), 'bytes', sz)
    # vista previa: cada malla con su transformación de grupo; pintura partida por etiqueta
    parts = []
    def gpos(g):
        return np.array(groups[g]['t'], dtype=np.float64)
    for k, m in enumerate(ms):
        Pw = m['P'] + gpos(m['g'])
        if m['tags'] is not None:
            for tg in np.unique(m['tags']):
                f = m['F'][(m['tags'][m['F']] == tg).all(1)]
                if len(f): vs, inv = np.unique(f, return_inverse=True); parts.append(dict(name='%s_%s_t%d' % (m['g'], m['m'], tg), V=Pw[vs], N=m['N'][vs], F=inv.reshape(-1, 3), color=TAGC[tg], met=.3, rou=.3))
        else:
            parts.append(dict(name='%s_%s_%d' % (m['g'], m['m'], k), V=Pw, N=m['N'], F=m['F'], color=PAL.get(m['m'], tuple(m['col'])), met=float(m['met']) * .6, rou=float(m['rou'])))
    write_glb(OUT + '/car_%s.glb' % l, parts)
json.dump(dict(groups=groups, rig=RIG), open(OUT + '/car_rig.json', 'w'), indent=1)
