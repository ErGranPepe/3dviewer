# Validación del mecanismo de autoencendido: (1) frente a medidas en máquina de compresión rápida de He et al., Combustion and Flame
# 142 (2005) 266-275 (tabla 1 y su correlación); (2) puntos fuera de la malla de la tabla, para medir el error de interpolar.
# uso: python3 -I ignval.py <mecanismo.yaml> <salida.json>
import cantera as ct, json, sys, math
MECH = sys.argv[1]
_base = ct.Solution(MECH)
_ar = {s.name: s for s in ct.Species.list_from_file('nasa_gas.yaml')}['Ar']
AR = ct.Species('AR', _ar.composition); AR.thermo = _ar.thermo
def gas():
    # el mecanismo reducido no trae argón (es inerte): se añade con sus datos termodinámicos de NASA para reproducir la mezcla de los ensayos
    return ct.Solution(thermo='ideal-gas', kinetics='gas', species=_base.species() + [AR], reactions=_base.reactions())
def delay(T, p, X):
    g = gas(); g.TPX = T, p, X
    r = ct.IdealGasReactor(g); net = ct.ReactorNet([r]); net.rtol = 1e-8; net.atol = 1e-16
    t = 0.0
    while t < 2.0:
        t = net.step()
        if r.T > T + 400: return t
    return None
# filas de la tabla 1 de He et al. (2005): Ar %, O2 %, phi, P (atm), T (K), retraso medido (ms); el resto es N2
rows = [(4.0, 16.6, 0.25, 13.8, 961, 20.6), (10.0, 16.6, 0.4, 5.35, 1016, 16.2), (14.0, 16.6, 0.5, 10.3, 953, 21.6), (17.9, 16.6, 0.6, 23.1, 986, 4.1), (33.5, 16.6, 1.0, 8.81, 986, 7.1)]
he = []
for ar, o2, phi, P, T, tm in rows:
    f = phi * o2 / 12.5
    X = {'IC8H18': f, 'O2': o2, 'AR': ar, 'N2': 100 - o2 - ar - f}
    tc = delay(float(T), P * 101325.0, X)
    corr = 1.3e-4 * P ** -1.05 * phi ** -0.77 * o2 ** -1.41 * math.exp(33700 / (1.98720 * T))
    he.append({'ar': ar, 'o2': o2, 'phi': phi, 'P': P, 'T': T, 'meas': tm, 'calc': tc * 1e3, 'corr': corr})
    print('He 2005: phi %.2f  %5.2f atm  %4d K  medido %5.1f ms  calculado %5.1f ms  correlación %5.1f ms' % (phi, P, T, tm, tc * 1e3, corr))
# puntos fuera de la malla (aire: O2 + 3,7732 N2)
off = []
for T, p, phi in [(980.0, 30e5, 0.75), (870.0, 110e5, 0.62), (1130.0, 200e5, 0.9), (760.0, 60e5, 1.1), (1040.0, 320e5, 0.5), (930.0, 15e5, 0.45)]:
    g = ct.Solution(MECH); g.set_equivalence_ratio(phi, 'IC8H18', {'O2': 1.0, 'N2': 3.7732})
    off.append({'T': T, 'p': p, 'phi': phi, 'tau': delay(T, p, g.mole_fraction_dict())})
    print('fuera de malla', off[-1])
json.dump({'he': he, 'off': off}, open(sys.argv[2], 'w'))
