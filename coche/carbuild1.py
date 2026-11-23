# Etapas 1-3: carga del concepto 2026 (Qvist_designs, CC BY 4.0) con sus normales, soldadura, y segmentación en piezas.
import sys, numpy as np
sys.path.insert(0, '/home/claude/tools/car')
from glbinfo import load
from glbdump import accessor, mat4
from qload import components
from qtrack import tracks
from qseg import inside_track, BARY
WC = {'F': (-1.7, 0.3595), 'R': (1.7, 0.3595)}
FACE = {'F': 0.600, 'R': 0.527}
REF = {
 'F': {'tie': (0.38, -1.828, 0.343), 'lwF': (0.348, -1.725, 0.326), 'lwR': (0.368, -1.453, 0.305), 'uwF': (0.344, -1.776, 0.518), 'uwR': (0.368, -1.507, 0.472),
       'rod': (0.38, -1.678, 0.468), 'lwA': (0.564, -1.69, 0.319), 'uwA': (0.568, -1.742, 0.508), 'scoop': (0.568, -1.794, 0.418)},
 'R': {'uwR': (0.292, 1.786, 0.507), 'uwF': (0.356, 1.512, 0.487), 'uwA': (0.504, 1.716, 0.512), 'shr': (0.332, 1.716, 0.346), 'rod': (0.368, 1.487, 0.394), 'lwF': (0.388, 1.412, 0.304),
       'duct1': (0.48, 1.704, 0.192), 'duct2': (0.48, 1.868, 0.235), 'duct3': (0.46, 1.958, 0.303)},
}
MEMB = {'F': {'uw': ['uwF', 'uwR', 'uwA'], 'lw': ['lwF', 'lwR', 'lwA'], 'rod': ['rod'], 'tie': ['tie'], 'up': ['scoop']},
        'R': {'uw': ['uwF', 'uwR', 'uwA'], 'lw': ['lwF'], 'shr': ['shr'], 'rod': ['rod'], 'up': ['duct1', 'duct2', 'duct3']}}
def load_oriented(path):
    js, b, d = load(path)
    V = []; N = []; F = []; off = 0
    for n in js['nodes']:
        if 'mesh' not in n: continue
        W = mat4(n)
        for pr in js['meshes'][n['mesh']]['primitives']:
            p, _ = accessor(js, b[0], d, pr['attributes']['POSITION']); p = (W[:3, :3] @ p.astype(np.float64).T).T + W[:3, 3]
            nn, _ = accessor(js, b[0], d, pr['attributes']['NORMAL']); nn = (W[:3, :3] @ nn.astype(np.float64).T).T
            idx, _ = accessor(js, b[0], d, pr['indices']); f = idx.reshape(-1, 3).astype(np.int64)
            fn = np.cross(p[f[:, 1]] - p[f[:, 0]], p[f[:, 2]] - p[f[:, 0]]); flip = (fn * nn[f].sum(1)).sum(1) < 0
            f[flip] = f[flip][:, [0, 2, 1]]
            V.append(p); N.append(nn); F.append(f + off); off += len(p)
    V = np.vstack(V); N = np.vstack(N); F = np.vstack(F)
    key = np.round(V / 1e-5).astype(np.int64); uq, inv = np.unique(key, axis=0, return_inverse=True); inv = inv.ravel()
    V2 = np.zeros((len(uq), 3)); V2[inv] = V
    N2 = np.zeros((len(uq), 3)); np.add.at(N2, inv, N); L = np.linalg.norm(N2, axis=1); N2 /= np.maximum(L, 1e-12)[:, None]
    F2 = inv[F]; ok = (F2[:, 0] != F2[:, 1]) & (F2[:, 1] != F2[:, 2]) & (F2[:, 0] != F2[:, 2]); F2 = F2[ok]
    Fs = np.sort(F2, axis=1); _, keep = np.unique(Fs, axis=0, return_index=True); keep.sort(); F2 = F2[keep]
    return V2, N2, F2
def member_tris(V, B, lab, k, trs_ext, cand):
    """asigna al miembro k: 1) los triángulos cortados por sus secciones seguidas; 2) astillas con sus 3 vértices en el miembro; 3) vecinos (2 vértices) dentro de sus cajas"""
    ids = np.unique(np.concatenate([l['tri'] for tr, _ in trs_ext for _, l in tr]))
    ids = ids[lab[ids] == 0]; lab[ids] = k
    P = V[B[cand]]; S = np.einsum('sk,nkc->nsc', BARY, P).reshape(-1, 3); ins = np.zeros(len(S), bool)
    for tr, ext in trs_ext: ins |= inside_track(tr, S, pad=0.003, ext=ext)
    fr = ins.reshape(len(cand), len(BARY)).mean(1)
    for it in range(60):
        vf = np.zeros(len(V), bool); vf[B[lab == k].ravel()] = True
        free = lab[cand] == 0; nv = vf[B[cand]].sum(1)
        hit = cand[free & ((nv == 3) | ((nv >= 2) & (fr >= 0.6)) | ((nv >= 1) & (fr >= 0.92)))]
        if not len(hit): break
        lab[hit] = k
def pick(T, refs, sg):
    out = {}
    for nm, (rz, rx, ry) in refs.items():
        best = None
        for tr in T:
            zs = np.array([abs(v) for v, _ in tr])
            if rz < zs.min() - 0.02 or rz > zs.max() + 0.02: continue
            c = tr[int(np.argmin(abs(zs - rz)))][1]['c']; dd = np.hypot(c[0] - rx, c[1] - ry)
            if dd < 0.05 and (best is None or dd < best[0]): best = (dd, tr)
        if best is not None: out[nm] = best[1]
    return out
def segment(V, B):
    Cn = V[B].mean(1)
    lab = np.zeros(len(B), dtype=np.int16); names = ['body']; info = {}
    for ax in 'FR':
        for sg, side in ((1, 'L'), (-1, 'R')):
            cx, cy = WC[ax]; face = FACE[ax]; corner = ax + side
            box = {0: (cx - 0.45, cx + 0.45), 1: (0.12, 0.75)}
            T = tracks(V, B, 2, [sg * z for z in np.arange(0.06, 0.66, 0.004)], box)
            cand = np.where((Cn[:, 0] > box[0][0]) & (Cn[:, 0] < box[0][1]) & (Cn[:, 1] > 0.1) & (Cn[:, 1] < 0.78) & (Cn[:, 2] * sg > 0.03))[0]
            picked = pick(T, REF[ax], sg)
            Pv = V[B[cand]]; rr = np.hypot(Pv[:, :, 0] - cx, Pv[:, :, 1] - cy).max(1); zz = (Pv[:, :, 2] * sg).min(1)
            drum = cand[(rr < 0.236) & (zz > face - 0.0015)]
            for mem, parts in MEMB[ax].items():
                k = len(names); names.append(corner + '_' + mem); te = []
                for nm in parts:
                    if nm not in picked: continue
                    tr = picked[nm]; zs = np.array([abs(v) for v, _ in tr])
                    e_out = max(0.0, face - zs.max()) + 0.001 if mem != 'up' else 0.012
                    te.append((tr, (0.012, e_out) if sg > 0 else (e_out, 0.012)))
                    info.setdefault(names[k], {})[nm] = tr
                    if mem == 'up' or nm.endswith('A'): continue
                    o = np.argsort(zs); zo = zs[o]; C = np.array([tr[i][1]['c'] for i in o]); k8 = min(10, len(zo) - 1)
                    sl = (C[k8] - C[0]) / (zo[k8] - zo[0]); per1 = np.median([l['per'] for _, l in tr])
                    for t2 in T:
                        if t2 is tr or any(t2 is q for q in picked.values()): continue
                        z2 = np.array([abs(v) for v, _ in t2])
                        if z2.max() > zo[0] + 0.002: continue
                        c2 = np.array([l['c'] for _, l in t2]); pred = C[0][None, :] + sl[None, :] * (z2 - zo[0])[:, None]
                        per2 = np.median([l['per'] for _, l in t2])
                        if np.hypot(c2[:, 0] - pred[:, 0], c2[:, 1] - pred[:, 1]).max() < 0.014 and abs(per2 - per1) / per1 < 0.2:
                            te.append((t2, (0.012, 0.012))); info[names[k]][nm + '_in%d' % len(te)] = t2
                if te: member_tris(V, B, lab, k, te, cand)
            kd = len(names); names.append(corner + '_drum'); lab[drum[lab[drum] == 0]] = kd
            # zona libre entre carrocería y tambor: lo que toca a un brazo es de ese brazo
            Pc = V[B[cand]]; zc = Pc[:, :, 2] * sg
            zone = (zc.min(1) > (0.30 if ax == 'F' else 0.33)) & (zc.max(1) < face + 0.0005) & (Pc[:, :, 1].min(1) > (0.25 if ax == 'F' else 0.27)) & (Pc[:, :, 1].max(1) < 0.62)
            if ax == 'F': zone &= Pc[:, :, 0].min(1) > -1.9
            zi = cand[zone]
            for mem in ('uw', 'lw', 'tie', 'shr'):
                nm = corner + '_' + mem
                if nm not in names: continue
                k = names.index(nm)
                while True:
                    vf = np.zeros(len(V), bool); vf[B[lab == k].ravel()] = True
                    free = zi[lab[zi] == 0]; hit = free[vf[B[free]].any(1)]
                    if not len(hit): break
                    lab[hit] = k
            zone2 = (zc.min(1) > face - (0.075 if ax == 'F' else 0.115)) & (zc.max(1) < face + 0.02) & (np.hypot(Pc[:, :, 0] - cx, Pc[:, :, 1] - cy).max(1) < 0.36) & (Pc[:, :, 1].min(1) > 0.105)
            zi2 = cand[zone2]; ku = names.index(corner + '_up')
            while True:
                vf = np.zeros(len(V), bool); vf[B[(lab == ku) | (lab == kd)].ravel()] = True
                free = zi2[lab[zi2] == 0]; hit = free[vf[B[free]].any(1)]
                if not len(hit): break
                lab[hit] = ku
    # alerones: elementos seguidos a lo ancho
    Cn = V[B].mean(1)
    for wname, box, rng, refs in (
        ('fw', {0: (-3.0, -2.0), 1: (0.03, 0.62)}, 0.93, {'flapA': (0.0, -2.622, 0.104, 1.2), 'flapB': (0.0, -2.511, 0.139, 1.2), 'main0': (0.0, -2.816, 0.103, 0.1), 'main1': (0.28, -2.747, 0.147, 0.3), 'main2': (0.56, -2.623, 0.177, 0.15),
                                                             'tip': (0.79, -2.414, 0.298, 0.18), 'foot': (0.76, -2.371, 0.127, 0.18)}),
        ('rw', {0: (1.75, 2.5), 1: (0.55, 1.15)}, 0.60, {'flapA': (0.0, 2.169, 0.784, 1.0), 'flapB': (0.0, 2.279, 0.855, 1.0), 'main0': (0.0, 1.991, 0.771, 0.08), 'main1': (0.32, 1.991, 0.803, 0.4)})):
        T = tracks(V, B, 2, np.arange(-rng, rng + 1e-9, 0.004), box, maxsize=0.7, link=0.014)
        cand = np.where((Cn[:, 0] > box[0][0]) & (Cn[:, 0] < box[0][1]) & (Cn[:, 1] > box[1][0]) & (Cn[:, 1] < box[1][1]))[0]
        for nm, (rz, rx, ry, minlen) in refs.items():
            for sg in ((1,) if rz == 0 else (1, -1)):
                best = None
                for tr in T:
                    zs = np.array([v for v, _ in tr])
                    if sg * rz < zs.min() - 0.01 or sg * rz > zs.max() + 0.01 or np.ptp(zs) < minlen * 0.5: continue
                    c = tr[int(np.argmin(abs(zs - sg * rz)))][1]['c']; dd = np.hypot(c[0] - rx, c[1] - ry)
                    if dd < 0.04 and (best is None or dd < best[0]): best = (dd, tr)
                if best is None: print('!! falta', wname, nm, sg); continue
                full = wname + '_' + nm + ('' if rz == 0 else ('L' if sg > 0 else 'R'))
                k = len(names); names.append(full); info[full] = {nm: best[1]}
                member_tris(V, B, lab, k, [(best[1], (0.006, 0.006))], cand)
    return lab, names, info
if __name__ == '__main__':
    from glbwrite import write_glb, submesh
    V, N, F = load_oriented(sys.argv[1])
    n, cl = components(len(V), F); fl = cl[F[:, 0]]; cn = np.bincount(fl, minlength=n); big = int(np.argmax(cn))
    B = F[fl == big]; print('verts', len(V), 'faces', len(F), 'body', len(B))
    lab, names, info = segment(V, B)
    np.savez_compressed('/home/claude/tools/out/car1.npz', V=V, N=N, F=F, fl=fl, big=big, lab=lab, names=np.array(names))
    import pickle; pickle.dump(info, open('/home/claude/tools/out/car1_info.pkl', 'wb'))
    pal = {'uw': (.9, .15, .1), 'lw': (.1, .35, .95), 'rod': (1, .7, 0), 'tie': (.1, .75, .2), 'shr': (.8, .1, .8), 'up': (.1, .8, .8), 'drum': (.3, .3, .34), 'flapA': (1, .3, .3), 'flapAL': (1, .3, .3), 'flapB': (.2, .5, 1), 'main0': (.3, .8, .3), 'main1L': (.9, .8, .2), 'main1R': (.9, .8, .2), 'main2L': (.6, .3, .8), 'main2R': (.6, .3, .8), 'tipL': (.1, .7, .7), 'tipR': (.1, .7, .7), 'footL': (.5, .4, .2), 'footR': (.5, .4, .2)}
    parts = [dict(name='body', V=submesh(V, B[lab == 0])[0], F=submesh(V, B[lab == 0])[1], color=(.8, .8, .8))]
    for k, nm in enumerate(names):
        if k == 0: continue
        v, f = submesh(V, B[lab == k]); print(nm, len(f), end='; ')
        parts.append(dict(name=nm, V=v, F=f, color=pal.get(nm.split('_')[1], (.5, .5, .5))))
    write_glb('/home/claude/tools/out/carseg.glb', parts)
