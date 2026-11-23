# Convierte la tabla de retrasos de autoencendido (igndelay.py) y su validación (ignval.py) en knockdata.js para el Laboratorio.
# uso: python3 knockgen.py <tau.json> <ignval.json> <carpeta de salida>
import json, math, sys
t = json.load(open(sys.argv[1])); v = json.load(open(sys.argv[2]))
d = {'mech': 'Mecanismo de 143 especies y 1178 reacciones para el isooctano (Yoo, Luo, Lu, Kim y Chen, Proc. Combust. Inst. 34, 2013), reducido del mecanismo detallado de LLNL (Mehl et al.)',
     'invT': t['invT'], 'lnp': [round(math.log(p), 6) for p in t['p']], 'phi': t['phi'], 'lnTau': [round(math.log(x), 4) for x in t['tau']],
     'he': v['he'], 'off': v['off']}
open(sys.argv[3] + '/knockdata.js', 'w').write(
    "/* ===================== RETRASO DE AUTOENCENDIDO =====================\n"
    "   Tiempo que tarda en autoinflamarse una mezcla de isooctano (octano 100) y aire a volumen constante, calculado con Cantera y el\n"
    "   mecanismo reducido de 143 especies de Yoo et al. (2013), derivado del detallado de LLNL. Malla: 18 temperaturas (645-1429 K),\n"
    "   7 presiones (10-400 bar) y 6 riquezas (0,4-1,2). lnTau = ln del retraso en segundos, en el orden riqueza, presión, 1000/T.\n"
    "   he = comparación con las medidas en máquina de compresión rápida de He et al., Combust. Flame 142 (2005) 266-275 (tabla 1);\n"
    "   off = puntos fuera de la malla calculados directamente, para medir el error de interpolación.\n"
    "   Archivo generado por tools/chem/igndelay.py, ignval.py y knockgen.py: no se edita a mano. */\n"
    "LAB.knockData = %s;\n" % json.dumps(d, separators=(',', ':')))
print(len(d['lnTau']), 'valores; retraso de', min(t['tau']), 'a', max(t['tau']), 's')
