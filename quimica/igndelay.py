# Retraso de autoencendido a volumen constante (reactor homogéneo adiabático) con un mecanismo detallado, para la tabla de detonación.
# uso: python3 -I igndelay.py <mecanismo.yaml> <salida.json> [n_procesos]  ·  o  python3 -I igndelay.py <mecanismo.yaml> --uno T p_bar phi
# Criterio: instante de máxima velocidad de subida de la temperatura (el mismo que se usa al comparar con tubos de choque).
import cantera as ct, json, sys, time, math
from multiprocessing import Pool
MECH = sys.argv[1]
FUEL = 'IC8H18'
def delay(args):
    T, p, phi, xr = args
    g = ct.Solution(MECH)
    g.set_equivalence_ratio(phi, FUEL, {'O2': 1.0, 'N2': 3.7732})
    g.TP = T, p
    r = ct.IdealGasReactor(g); net = ct.ReactorNet([r]); net.rtol = 1e-8; net.atol = 1e-16
    tmax = 2.0 if T < 700 else 0.5
    t, Tl, best, tb, t0 = 0.0, T, 0.0, None, time.time()
    while t < tmax:
        t = net.step(); Tn = r.T
        if Tn > Tl:
            rate = (Tn - Tl)
        Tl = Tn
        if Tn > T + 400:      # ya ha encendido: el instante de 400 K de subida es el retraso (la subida final dura microsegundos)
            tb = t; break
        if time.time() - t0 > 600: break
    return [T, p, phi, tb]
if __name__ == '__main__':
    if sys.argv[2] == '--uno':
        t0 = time.time(); print(delay((float(sys.argv[3]), float(sys.argv[4]) * 1e5, float(sys.argv[5]), 0)), 's;', round(time.time() - t0, 2), 's de cálculo'); sys.exit()
    Ts = [1000.0 / x for x in [0.70, 0.75, 0.80, 0.85, 0.90, 0.95, 1.00, 1.05, 1.10, 1.15, 1.20, 1.25, 1.30, 1.35, 1.40, 1.45, 1.50, 1.55]]   # 1429 K … 645 K
    ps = [10e5, 20e5, 40e5, 80e5, 150e5, 250e5, 400e5]
    phis = [0.4, 0.55, 0.7, 0.85, 1.0, 1.2]
    jobs = [(T, p, phi, 0) for phi in phis for p in ps for T in Ts]
    t0 = time.time()
    with Pool(int(sys.argv[3]) if len(sys.argv) > 3 else 4) as pool:
        res = pool.map(delay, jobs, chunksize=4)
    json.dump({'mech': MECH.split('/')[-1], 'fuel': FUEL, 'invT': [1000.0 / T for T in Ts], 'p': ps, 'phi': phis, 'tau': [r[3] for r in res]}, open(sys.argv[2], 'w'))
    print('hecho en', round(time.time() - t0), 's;', sum(1 for r in res if r[3] is None), 'sin encender de', len(res))
