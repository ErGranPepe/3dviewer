# Banco de simulación en Node (sin navegador)

El primer bloque de `app.js` es el núcleo de simulación (física, IA, estrategia) y no necesita la página.

- `core.sh [app.js] [salida]`: lo extrae a `sim_core.js` (con funciones internas en `Sim._` para depurar).
- `load.js`: carga el núcleo, los circuitos reales (`data.*.js`) y los genomas de serie.
- `geo.js`: geometría de los 17 circuitos en segundos (anchos, trazada dentro de límites, muros, calle de boxes).
- `run.js <guion>`: ejecuta los guiones de `pruebas/js` (los mismos que usa `probe.py` en la página) preparando la carrera como la
  web: clasificación, parrilla y mundo de carrera. `TRK` = índice del desplegable o clave del circuito; `REGS`, `LAPS`, `WEAR`, `W`.
  Las carreras son reproducibles: misma semilla, misma carrera.
- `runb.sh nombre "0,12" 3`: tres carreras por circuito con la crónica de `story.js` (se resume con `pruebas/storyfmt.py`).
- `watch.sh TRK COD t0 t1`: traza fina de un coche entre dos instantes de una carrera.
- `dbgq.js`, `dbgk.js`: vuelta lanzada paso a paso y términos del límite de velocidad en curva.
- `rlcmp.js`: trazada actual frente a K1999 puro. `fitgrip.js`, `scan.sh`: calibración de agarre y carga contra la telemetría real.
- `mkvalid.js` + `../pubvalid.py`: regeneran la tabla de validación que publica la web (vuelta y curva a curva).
