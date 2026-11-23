# Genera los datos termoquímicos del Laboratorio y los casos de referencia con los que se valida.
#  - Coeficientes NASA de 7 términos (dos tramos, 200-6000 K) de la base de datos de NASA Glenn, tal como la distribuye Cantera
#    en nasa_gas.yaml (McBride, Zehe y Gordon, NASA/TP-2002-211556). Son datos públicos del gobierno de EE. UU.
#  - Casos de referencia calculados con Cantera (https://cantera.org): equilibrio a presión y a volumen constantes y a T y P dadas.
# uso: python3 gen.py <carpeta de salida>
import cantera as ct, json, sys
out = sys.argv[1]
names = {'CO2': 'CO2', 'H2O': 'H2O', 'N2': 'N2', 'O2': 'O2', 'CO': 'CO', 'H2': 'H2', 'OH': 'OH', 'O': 'O', 'H': 'H', 'NO': 'NO', 'N': 'N',
         'AR': 'Ar', 'CH4': 'CH4', 'IC8H18': 'C8H18,isooctane', 'NC7H16': 'C7H16,n-heptane', 'C7H8': 'C7H8', 'C2H5OH': 'C2H5OH'}
# aire seco, % en volumen (N2, O2 y Ar de la atmósfera estándar; CO2 actual, 420 ppm)
AIR = {'N2': 78.084, 'O2': 20.946, 'AR': 0.934, 'CO2': 0.042}
allsp = {s.name: s for s in ct.Species.list_from_file('nasa_gas.yaml')}
sp = {}
for k, n in names.items():
    s = allsp[n]; c = list(s.thermo.coeffs)
    sp[k] = ct.Species(k, s.composition); sp[k].thermo = s.thermo
gas = ct.Solution(thermo='ideal-gas', species=list(sp.values()))
data = {}
for k in names:
    s = sp[k]; c = list(s.thermo.coeffs)
    # las especies con un solo tramo (el argón) repiten los coeficientes: se les pone el mismo corte de 1000 K que a las demás
    data[k] = {'M': gas.molecular_weights[gas.species_index(k)] / 1e3, 'el': {e: int(v) for e, v in s.composition.items()}, 'Tm': 1000.0 if c[1:8] == c[8:15] else c[0], 'hi': c[1:8], 'lo': c[8:15]}
js = ("/* ===================== DATOS TERMOQUÍMICOS =====================\n"
      "   Coeficientes NASA de 7 términos (dos tramos, de 200 a 6000 K) para cp, h y s de cada especie, de la base de datos\n"
      "   termodinámica de NASA Glenn (McBride, Zehe y Gordon, NASA/TP-2002-211556), tal como la distribuye Cantera %s en\n"
      "   nasa_gas.yaml. M en kg/mol; el = átomos de cada elemento; Tm = temperatura que separa los dos tramos (K).\n"
      "   Archivo generado por tools/chem/gen.py: no se edita a mano. */\n"
      "LAB.chemData = %s;\n") % (ct.__version__, json.dumps(data, separators=(',', ':')))
open(out + '/chemdata.js', 'w').write(js)

# ---------- casos de referencia ----------
prod = ['CO2', 'H2O', 'N2', 'O2', 'CO', 'H2', 'OH', 'O', 'H', 'NO', 'N', 'AR']
def mix(fuel, lam, n2=3.76):
    """fuel: {especie: fracción molar}; devuelve moles por mol de combustible con aire a lambda.
    n2 = número: aire simplificado O2 + n2·N2 (el de los libros); n2 = None: aire seco de verdad (AIR)"""
    C = sum(x * sp[f].composition.get('C', 0) for f, x in fuel.items()); H = sum(x * sp[f].composition.get('H', 0) for f, x in fuel.items()); O = sum(x * sp[f].composition.get('O', 0) for f, x in fuel.items())
    o2 = (C + H / 4 - O / 2) * lam
    X = dict(fuel)
    if n2 is None:
        for k, v in AIR.items(): X[k] = X.get(k, 0) + o2 * v / AIR['O2']
    else:
        X['O2'] = X.get('O2', 0) + o2; X['N2'] = o2 * n2
    return X
cases = []
def newgas():
    return ct.Solution(thermo='ideal-gas', species=list(sp.values()))
def case(name, fuel, lam, T, P, mode, n2=3.76, note=''):
    g = newgas()
    g.TPX = T, P, mix(fuel, lam, n2)
    if mode == 'TP':
        g.equilibrate('TP')
    else:
        g.equilibrate(mode)
    cases.append({'name': name, 'fuel': fuel, 'lam': lam, 'n2': n2, 'T0': T, 'P0': P, 'mode': mode, 'T': g.T, 'P': g.P, 'X': {k: float(g.X[g.species_index(k)]) for k in prod},
                  'u': g.int_energy_mass, 'h': g.enthalpy_mass, 's': g.entropy_mass, 'M': g.mean_molecular_weight / 1e3, 'note': note})
atm = 101325.0
case('Metano y aire, estequiométrico, 1 atm', {'CH4': 1}, 1.0, 298.15, atm, 'HP')
case('Hidrógeno y aire, estequiométrico, 1 atm', {'H2': 1}, 1.0, 298.15, atm, 'HP')
case('Isooctano y aire, estequiométrico, 1 atm', {'IC8H18': 1}, 1.0, 298.15, atm, 'HP')
case('Isooctano y aire, mezcla pobre (λ = 1,4), 1 atm', {'IC8H18': 1}, 1.4, 298.15, atm, 'HP')
case('Isooctano y aire, mezcla rica (λ = 0,8), 1 atm', {'IC8H18': 1}, 0.8, 298.15, atm, 'HP')
case('Etanol y aire, estequiométrico, 1 atm', {'C2H5OH': 1}, 1.0, 298.15, atm, 'HP')
case('Tolueno y aire, estequiométrico, 1 atm', {'C7H8': 1}, 1.0, 298.15, atm, 'HP')
case('Isooctano, λ = 1,3, como en el cilindro: 950 K y 150 bar, a presión constante', {'IC8H18': 1}, 1.3, 950.0, 150e5, 'HP', 3.773)
case('Isooctano, λ = 1, 800 K y 40 bar, a volumen constante', {'IC8H18': 1}, 1.0, 800.0, 40e5, 'UV', 3.773)
case('Productos de isooctano, λ = 1, a 2600 K y 60 bar', {'IC8H18': 1}, 1.0, 2600.0, 60e5, 'TP', 3.773)
case('Productos de isooctano, λ = 1,3, a 2300 K y 120 bar', {'IC8H18': 1}, 1.3, 2300.0, 120e5, 'TP', 3.773)
case('Productos de isooctano, λ = 0,85, a 2200 K y 20 bar', {'IC8H18': 1}, 0.85, 2200.0, 20e5, 'TP', 3.773)
# ---------- gasolina E10 sustituta con aire seco de verdad ----------
LIQ = {'IC8H18': (692.0, 35100.0), 'NC7H16': (684.0, 36600.0), 'C7H8': (867.0, 38000.0), 'C2H5OH': (789.0, 42300.0)}   # kg/m³, J/mol
VOL = {'IC8H18': .70, 'NC7H16': .05, 'C7H8': .15, 'C2H5OH': .10}
gm = ct.Solution(thermo='ideal-gas', species=list(sp.values()))
MW = {k: gm.molecular_weights[gm.species_index(k)] / 1e3 for k in names}
mass = {k: v * LIQ[k][0] for k, v in VOL.items()}; mt = sum(mass.values())
mol = {k: mass[k] / mt / MW[k] for k in VOL}           # mol por kg de combustible
E10 = {k: v / sum(mol.values()) for k, v in mol.items()}  # fracciones molares
case('Gasolina E10 sustituta y aire seco, estequiométrica, 1 atm', E10, 1.0, 298.15, atm, 'HP', None)
case('Gasolina E10 sustituta, λ = 1,4, 1000 K y 180 bar, a presión constante', E10, 1.4, 1000.0, 180e5, 'HP', None)
case('Gasolina E10 sustituta, λ = 1,1, 900 K y 60 bar, a volumen constante', E10, 1.1, 900.0, 60e5, 'UV', None)
case('Productos de E10, λ = 1,4, a 2500 K y 200 bar', E10, 1.4, 2500.0, 200e5, 'TP', None)
case('Productos de E10, λ = 0,9, a 1800 K y 8 bar', E10, 0.9, 1800.0, 8e5, 'TP', None)
# poder calorífico inferior del combustible gaseoso a 298,15 K (productos CO2 y H2O vapor)
g = ct.Solution(thermo='ideal-gas', species=list(sp.values()))
lhv = {}
for f in ['CH4', 'H2', 'IC8H18', 'NC7H16', 'C7H8', 'C2H5OH']:
    c = sp[f].composition; C = c.get('C', 0); H = c.get('H', 0); O = c.get('O', 0)
    def hm(name):
        g.TPX = 298.15, atm, {name: 1}; return g.enthalpy_mole / 1e3   # J/mol
    dh = hm(f) + (C + H / 4 - O / 2) * hm('O2') - C * hm('CO2') - H / 2 * hm('H2O')
    lhv[f] = dh / (g.molecular_weights[g.species_index(f)] / 1e3)
# ---------- combustible: relación estequiométrica y poder calorífico calculados aparte ----------
Cf = sum(mol[k] * sp[k].composition.get('C', 0) for k in mol); Hf = sum(mol[k] * sp[k].composition.get('H', 0) for k in mol); Of = sum(mol[k] * sp[k].composition.get('O', 0) for k in mol)
o2f = Cf + Hf / 4 - Of / 2
mair = o2f * sum(v / AIR['O2'] * MW[k] for k, v in AIR.items())
def hmol(name):
    g.TPX = 298.15, atm, {name: 1}; return g.enthalpy_mole / 1e3
lg = sum(mol[k] * hmol(k) for k in mol) + o2f * hmol('O2') - Cf * hmol('CO2') - Hf / 2 * hmol('H2O')
hfg = sum(mol[k] * LIQ[k][1] for k in mol)
fuel = {'vol': VOL, 'X': E10, 'afr': mair, 'lhvGas': lg, 'lhv': lg - hfg, 'hfg': hfg, 'rho': mt / 1.0, 'hc': Hf / Cf, 'oxy': Of * gm.atomic_weight('O') / 1e3, 'co2': Cf * MW['CO2'], 'M': 1 / sum(mol.values()),
        'eth': mass['C2H5OH'] / mt, 'aro': mass['C7H8'] / mt, 'Mair': sum(v * MW[k] for k, v in AIR.items()) / sum(AIR.values())}

# ---------- compresión isentrópica de la mezcla sin quemar y ciclo Otto con gases reales ----------
def otto(name, lam, T1, p1, r):
    g = newgas(); g.TPX = T1, p1, mix(E10, lam, None)
    s1, v1, u1 = g.entropy_mass, 1 / g.density, g.int_energy_mass
    yf = sum(g.Y[g.species_index(k)] for k in E10)
    g.SV = s1, v1 / r                      # compresión isentrópica con la composición congelada
    T2, p2, u2 = g.T, g.P, g.int_energy_mass
    g.equilibrate('UV')                    # combustión adiabática a volumen constante
    T3, p3, u3, s3 = g.T, g.P, g.int_energy_mass, g.entropy_mass
    g.SV = s3, v1; g.equilibrate('SV')     # expansión isentrópica con el equilibrio desplazándose
    T4, p4, u4 = g.T, g.P, g.int_energy_mass
    w = (u3 - u4) - (u2 - u1)
    return {'name': name, 'lam': lam, 'T1': T1, 'p1': p1, 'r': r, 'T2': T2, 'p2': p2, 'T3': T3, 'p3': p3, 'T4': T4, 'p4': p4, 'w': w, 'yf': yf, 'eta': w / (yf * lg)}
ottos = [otto('E10, λ = 1,4, relación 17, desde 330 K y 3,5 bar', 1.4, 330.0, 3.5e5, 17.0), otto('E10, λ = 1, relación 10, desde 300 K y 1 bar', 1.0, 300.0, 1e5, 10.0)]

# ---------- turbina y compresor: saltos isentrópicos con cp variable ----------
g = newgas(); g.TPX = 1200.0, 3.0e5, mix(E10, 1.4, None); g.equilibrate('TP')
h3, s3 = g.enthalpy_mass, g.entropy_mass; g.SP = s3, 1.05e5
turb = {'lam': 1.4, 'T3': 1200.0, 'p3': 3.0e5, 'p4': 1.05e5, 'T4': g.T, 'dh': h3 - g.enthalpy_mass}
g = newgas(); g.TPX = 298.15, 1.0e5, {k: v for k, v in AIR.items()}
h1, s1 = g.enthalpy_mass, g.entropy_mass; g.SP = s1, 3.8e5
comp = {'T1': 298.15, 'p1': 1.0e5, 'p2': 3.8e5, 'T2': g.T, 'dh': g.enthalpy_mass - h1}

# ---------- NO fuera del equilibrio: mecanismo detallado GRI-Mech 3.0 (53 especies, 325 reacciones) ----------
def nokin(T, P, lam, times):
    full = ct.Solution('gri30.yaml')
    noN = ct.Solution(thermo='ideal-gas', species=[s for s in full.species() if 'N' not in s.composition or s.name == 'N2'])
    noN.TPX = T, P, {'CH4': 1, 'O2': 2 * lam, 'N2': 2 * lam * 3.76}
    noN.equilibrate('TP')                  # gas quemado en equilibrio, todavía sin óxidos de nitrógeno
    full.TPY = T, P, {s: noN.Y[noN.species_index(s)] for s in noN.species_names}
    r = ct.IdealGasConstPressureReactor(full, energy='off'); net = ct.ReactorNet([r]); net.rtol = 1e-9; net.atol = 1e-18
    out = []
    for t in times:
        net.advance(t); out.append(float(r.thermo['NO'].X[0]))
    full.equilibrate('TP')
    return {'T': T, 'P': P, 'lam': lam, 't': times, 'X': out, 'Xeq': float(full['NO'].X[0])}
zel = {}
for r in ct.Solution('gri30.yaml').reactions():
    if r.equation in ('N + NO <=> N2 + O', 'N + O2 <=> NO + O', 'N + OH <=> H + NO'):
        d = r.rate.input_data['rate-constant']   # A en m³/kmol·s → cm³/mol·s; Ea en J/kmol → K
        zel[r.equation] = {'A': d['A'] * 1e3, 'b': d['b'], 'TA': d['Ea'] / 8314.46261815324}
tms = [1e-4, 2e-4, 5e-4, 1e-3, 2e-3, 5e-3]
nok = [nokin(2400.0, 60e5, 1.2, tms), nokin(2600.0, 100e5, 1.0, tms), nokin(2200.0, 30e5, 1.4, tms), nokin(2700.0, 200e5, 1.3, tms)]

ref = {'cantera': ct.__version__, 'air': AIR, 'cases': cases, 'lhv': lhv, 'fuel': fuel, 'otto': ottos, 'turb': turb, 'comp': comp, 'no': nok, 'zel': zel}
open(out + '/chemref.js', 'w').write("/* Casos de referencia calculados con Cantera %s (mismos datos NASA): temperatura y composición de equilibrio, y poder calorífico\n   inferior del combustible en fase gas a 298,15 K. Archivo generado por tools/chem/gen.py: no se edita a mano. */\nLAB.chemRef = %s;\n" % (ct.__version__, json.dumps(ref, separators=(',', ':'))))
json.dump(ref, open(out + '/chemref.json', 'w'), indent=1)
for c in cases: print('%-80s %s T=%.1f K  P=%.2f bar  CO=%.4g NO=%.4g OH=%.4g' % (c['name'][:80], c['mode'], c['T'], c['P'] / 1e5, c['X']['CO'], c['X']['NO'], c['X']['OH']))
print({k: round(v / 1e6, 3) for k, v in lhv.items()})
print('combustible', {k: (round(v, 5) if isinstance(v, float) else v) for k, v in fuel.items()})
for o in ottos: print('otto', {k: (round(v, 4) if isinstance(v, float) else v) for k, v in o.items()})
print('turbina', turb); print('compresor', comp)
for n in nok: print('NO GRI', n['T'], n['P'] / 1e5, n['lam'], ['%.0f' % (x * 1e6) for x in n['X']], 'eq %.0f ppm' % (n['Xeq'] * 1e6))
