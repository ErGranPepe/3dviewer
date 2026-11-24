#!/bin/bash
# Extrae el núcleo de simulación (primer bloque de app.js, sin dibujo ni interfaz) para usarlo desde Node: pruebas en segundos
# en vez de cargar la página. uso: ./core.sh [ruta app.js] [salida] → escribe sim_core.js (con funciones internas en Sim._ para depurar)
SRC=${1:-/home/claude/src/app.js}
OUT=${2:-/home/claude/tools/node/sim_core.js}
END=$(grep -n '^})(this);' "$SRC" | head -1 | cut -d: -f1)
head -n "$END" "$SRC" | sed 's/typeof module < "u" ? module.exports = api : root.Sim = api/api._ = { cleanLap, aiControl, catchSlide, activeAero, quaDRS, aiMargin, lerpN, walls, surfaceAt, pitTick, hazard, alignCap, lift, wallLimits, bankProfile, timing, STREET, PITR, BANKS, k1999Line, racingLineFinish, trackVref, speedProfile, hairpinMask, racingLine }, typeof module < "u" ? module.exports = api : root.Sim = api/' > "$OUT"
node --check "$OUT" && echo "$(basename $OUT): $END líneas"
