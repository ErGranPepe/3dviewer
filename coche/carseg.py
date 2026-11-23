# Segmentación del coche concepto 2026 (Qvist, CC BY 4.0) en piezas: brazos de suspensión, tambores, ruedas, alerones.
import sys, numpy as np
sys.path.insert(0, '/home/claude/tools/car')
from qload import *
from qtrack import tracks
from qseg import gate_track, gate_member
WC = {'F': (-1.7, 0.3595), 'R': (1.7, 0.3595)}          # eje de rueda (x, y)
FACE = {'F': 0.600, 'R': 0.527}                          # cara interior del tambor (|z|)
# referencias (lado izquierdo): nombre -> (z, x, y) de la sección de la pista a esa z
REF = {
 'F': {'tie': (0.38, -1.828, 0.343), 'lwF': (0.348, -1.725, 0.326), 'lwR': (0.368, -1.453, 0.305), 'uwF': (0.344, -1.776, 0.518), 'uwR': (0.368, -1.507, 0.472),
       'rod': (0.38, -1.678, 0.468), 'lwA': (0.564, -1.69, 0.319), 'uwA': (0.568, -1.742, 0.508), 'scoop': (0.568, -1.794, 0.418)},
 'R': {'uwR': (0.292, 1.786, 0.507), 'uwF': (0.356, 1.512, 0.487), 'uwA': (0.504, 1.716, 0.512), 'shr': (0.332, 1.716, 0.346), 'rod': (0.368, 1.487, 0.394), 'lwF': (0.388, 1.412, 0.304),
       'duct1': (0.48, 1.704, 0.192), 'duct2': (0.48, 1.868, 0.235), 'duct3': (0.46, 1.958, 0.303)},
}
MEMB = {'F': {'uw': ['uwF', 'uwR', 'uwA'], 'lw': ['lwF', 'lwR', 'lwA'], 'rod': ['rod'], 'tie': ['tie'], 'up': ['scoop']},
        'R': {'uw': ['uwF', 'uwR', 'uwA'], 'lw': ['lwF'], 'shr': ['shr'], 'rod': ['rod'], 'up': ['duct1', 'duct2', 'duct3']}}
def segment(V, B):
    Cn = V[B].mean(1)
    lab = np.zeros(len(B), dtype=np.int16); names = ['body']; info = {}
    for ax in 'FR':
        for sg, side in ((1, 'L'), (-1, 'R')):
            cx, cy = WC[ax]
            box = {0: (cx - 0.45, cx + 0.45), 1: (0.12, 0.75)}
            vals = [sg * z for z in np.arange(0.06, 0.66, 0.004)]
            T = tracks(V, B, 2, vals, box)
            cand = np.where((Cn[:, 0] > box[0][0]) & (Cn[:, 0] < box[0][1]) & (Cn[:, 1] > 0.1) & (Cn[:, 1] < 0.78) & (Cn[:, 2] * sg > 0.03))[0]
            face = FACE[ax]
            picked = {}
            for nm, (rz, rx, ry) in REF[ax].items():
                best = None
                for tr in T:
                    zs = np.array([abs(v) for v, _ in tr])
                    if rz < zs.min() - 0.02 or rz > zs.max() + 0.02: continue
                    i = int(np.argmin(abs(zs - rz))); c = tr[i][1]['c']
                    dd = np.hypot(c[0] - rx, c[1] - ry)
                    if dd < 0.05 and (best is None or dd < best[0]): best = (dd, tr)
                if best is None: print('!! falta pista', ax + side, nm); continue
                picked[nm] = best[1]
            corner = ax + side
            # tambor: dentro del cilindro del eje y por fuera de la cara
            Pv = V[B[cand]]; rr = np.hypot(Pv[:, :, 0] - cx, Pv[:, :, 1] - cy).max(1); zz = (Pv[:, :, 2] * sg).min(1)
            drum = cand[(rr < 0.236) & (zz > face - 0.0015)]
            for mem, parts in MEMB[ax].items():
                k = len(names); names.append(corner + '_' + mem)
                te = []
                for nm in parts:
                    if nm not in picked: continue
                    tr = picked[nm]; zs = np.array([abs(v) for v, _ in tr])
                    # hacia fuera, hasta la cara del tambor; hacia dentro, sólo hasta donde el tubo existe (se siguen sus tramos ocultos bajo la carrocería)
                    e_out = max(0.0, face - zs.max()) + 0.001 if mem != 'up' else 0.012
                    te.append((tr, (0.012, e_out) if sg > 0 else (e_out, 0.012)))
                    info.setdefault(names[k], {})[nm] = tr
                    if mem == 'up' or nm.endswith('A'): continue
                    # tramos interiores del mismo tubo: pistas que caen sobre la prolongación recta de ésta
                    o = np.argsort(zs); zz = zs[o]; C = np.array([tr[i][1]['c'] for i in o]); k8 = min(10, len(zz) - 1)
                    sl = (C[k8] - C[0]) / (zz[k8] - zz[0])
                    for t2 in T:
                        if t2 is tr or any(t2 is q for q in picked.values()): continue
                        z2 = np.array([abs(v) for v, _ in t2])
                        if z2.max() > zz[0] + 0.002: continue
                        c2 = np.array([l['c'] for _, l in t2]); pred = C[0][None, :] + sl[None, :] * (z2 - zz[0])[:, None]
                        per2 = np.median([l['per'] for _, l in t2]); per1 = np.median([l['per'] for _, l in tr])
                        if np.hypot(c2[:, 0] - pred[:, 0], c2[:, 1] - pred[:, 1]).max() < 0.014 and abs(per2 - per1) / per1 < 0.2:
                            te.append((t2, (0.012, 0.012))); info[names[k]][nm + '_in' + str(len(te))] = t2
                if te:
                    g = gate_member(V, B, te, cand)
                    g = g[lab[g] == 0]; lab[g] = k
                    # astillas: triángulos sin etiquetar cuyos tres vértices ya son del miembro
                    while True:
                        vf = np.zeros(len(V), bool); vf[B[lab == k].ravel()] = True
                        free = cand[lab[cand] == 0]; hit = free[vf[B[free]].all(1)]
                        if not len(hit): break
                        lab[hit] = k
            kd = len(names); names.append(corner + '_drum'); lab[drum[lab[drum] == 0]] = kd
            # completar: en la zona libre (fuera de la carrocería y antes del tambor) lo que toca a un brazo es de ese brazo
            Pc = V[B[cand]]; zc = Pc[:, :, 2] * sg
            zfree = 0.30 if ax == 'F' else 0.33
            zone = (zc.min(1) > zfree) & (zc.max(1) < face + 0.0005) & (Pc[:, :, 1].min(1) > (0.25 if ax == 'F' else 0.27)) & (Pc[:, :, 1].max(1) < 0.62) & (np.abs(Pc[:, :, 0] - cx).max(1) < (0.22 if ax == 'F' else 0.5) + 0.25)
            if ax == 'F': zone &= Pc[:, :, 0].min(1) > -1.9
            zi = cand[zone]
            def grow(k, zi):
                vf = np.zeros(len(V), bool)
                while True:
                    vf[:] = False; vf[B[lab == k].ravel()] = True
                    free = zi[lab[zi] == 0]
                    hit = free[vf[B[free]].any(1)]
                    if not len(hit): break
                    lab[hit] = k
            for mem in ('uw', 'lw', 'tie', 'shr'):
                nm = corner + '_' + mem
                if nm in names: grow(names.index(nm), zi)
            # accesorios de la mangueta (toma de freno, aletas): lo que queda pegado al tambor justo delante de su cara
            zone2 = (zc.min(1) > face - (0.075 if ax == 'F' else 0.115)) & (zc.max(1) < face + 0.02) & (np.hypot(Pc[:, :, 0] - cx, Pc[:, :, 1] - cy).max(1) < 0.36) & (Pc[:, :, 1].min(1) > 0.105)
            zi2 = cand[zone2]; ku = names.index(corner + '_up')
            vf = np.zeros(len(V), bool)
            while True:
                vf[:] = False; vf[B[(lab == ku) | (lab == kd)].ravel()] = True
                free = zi2[lab[zi2] == 0]; hit = free[vf[B[free]].any(1)]
                if not len(hit): break
                lab[hit] = ku
    return lab, names, info
if __name__ == '__main__':
    from glbwrite import write_glb, submesh
    d = np.load('/home/claude/tools/out/qv_welded.npz', allow_pickle=True)
    V, F, lab0 = d['V'], d['F'], d['lab']; B = F[lab0 == 0]
    lab, names, info = segment(V, B)
    pal = {'uw': (.9, .15, .1), 'lw': (.1, .35, .95), 'rod': (1, .7, 0), 'tie': (.1, .75, .2), 'shr': (.8, .1, .8), 'up': (.1, .8, .8), 'drum': (.3, .3, .34)}
    parts = [dict(name='body', V=submesh(V, B[lab == 0])[0], F=submesh(V, B[lab == 0])[1], color=(.8, .8, .8))]
    for nm, trs in info.items(): print(nm, {k: (round(abs(t[0][0]), 3), round(abs(t[-1][0]), 3)) for k, t in trs.items()})
    for k, nm in enumerate(names):
        if k == 0: continue
        v, f = submesh(V, B[lab == k]); print(nm, len(f))
        parts.append(dict(name=nm, V=v, F=f, color=pal[nm.split('_')[1]]))
    write_glb('/home/claude/tools/out/carseg.glb', parts)
    np.savez_compressed('/home/claude/tools/out/carseg.npz', lab=lab, names=np.array(names))
