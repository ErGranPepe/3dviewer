#!/bin/bash
# copia el código fuente legible y las herramientas a la rama "fuente" del repositorio
set -e
F=/home/claude/fuente
cp /home/claude/src/app.js /home/claude/src/deploy.sh /home/claude/src/backup.sh /home/claude/src/*.py /home/claude/src/*.sh $F/ 2>/dev/null || true
cp /home/claude/src/package.json $F/; mkdir -p $F/lab && cp /home/claude/src/lab/*.js /home/claude/src/lab/*.html /home/claude/src/lab/*.sh $F/lab/; cp /home/claude/src/xf.json $F/ 2>/dev/null || true
# herramientas con las que se construye el coche a partir del modelo 3D original (CC BY 4.0) y su ficha de procedencia
mkdir -p $F/coche && cp /home/claude/tools/car/*.py /home/claude/tools/viewer/simp.mjs /home/claude/tools/viewer/view.html /home/claude/tools/viewer/shot.py $F/coche/ 2>/dev/null || true
# química: generadores de los datos termoquímicos, de los casos de referencia de Cantera y de la tabla de autoencendido
mkdir -p $F/quimica && cp /home/claude/tools/chem/*.py /home/claude/tools/chem/*.json $F/quimica/ 2>/dev/null || true
cat > $F/quimica/LEEME.md <<'R'
# Química de la combustión: de dónde sale cada dato

Requiere Python con Cantera 3.2 (`pip install cantera`).

- `gen.py <carpeta>`: escribe `chemdata.js` (coeficientes NASA de 7 términos de cada especie, de la base de NASA Glenn que distribuye
  Cantera en `nasa_gas.yaml`) y `chemref.js` (casos de referencia resueltos con Cantera: equilibrios a presión y volumen constantes,
  poderes caloríficos, ciclo Otto con gases reales, saltos de turbina y compresor, y NO con el mecanismo completo GRI-Mech 3.0).
- `igndelay.py <mecanismo.yaml> <salida.json> [procesos]`: tabla de retrasos de autoencendido del isooctano (756 casos) con el
  mecanismo reducido de 143 especies de Yoo, Luo, Lu, Kim y Chen (Proc. Combust. Inst. 34, 2013), derivado del detallado de LLNL.
  El mecanismo se toma de https://github.com/jiweiqi/CollectionOfMechanisms (i-Octane_C8H18/llnl_version3/ReducedByTianfengLu/sk143)
  y se convierte con `python3 -m cantera.ck2yaml --input=chem.inp --thermo=therm.dat --permissive`.
- `ignval.py`: el mismo mecanismo frente a los retrasos medidos por He et al., Combustion and Flame 142 (2005) 266-275 (tabla 1), y
  puntos fuera de la malla para medir el error de interpolar.
- `knockgen.py`: junta los dos JSON en `knockdata.js`.
- `tau_sk143.json`, `ignval.json`: los resultados con los que se generó lo publicado.

El Laboratorio (`lab/chem.js`) repite esos cálculos en JavaScript y `lab/validate.js` compara cada uno con su referencia.
R
# pruebas automáticas: barrido de la pista (objetos sobre el asfalto), regresión completa, movimiento, averías, parada en boxes
mkdir -p $F/pruebas && cp /home/claude/tools/tests/* $F/pruebas/ 2>/dev/null || true
# guiones que se ejecutan dentro de la página (banco de conducción de la IA) y banco de la trazada fuera del navegador
mkdir -p $F/pruebas/js && cp /home/claude/tools/tests/js/*.js $F/pruebas/js/ 2>/dev/null || true
mkdir -p $F/trazada && cp /home/claude/tools/rl/*.js $F/trazada/ 2>/dev/null || true
# banco de simulación en Node (sin navegador): núcleo extraído de app.js, carreras completas, calibración y tabla de validación
mkdir -p $F/banco && cp /home/claude/tools/node/*.sh /home/claude/tools/node/*.py $F/banco/ 2>/dev/null || true
for f in load run geo dbgq dbgk rlcmp fitgrip mkvalid; do cp /home/claude/tools/node/$f.js $F/banco/ 2>/dev/null || true; done
cat > $F/banco/LEEME.md <<'R'
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
R
cat > $F/trazada/LEEME.md <<'R'
# Banco de la trazada (fuera del navegador)

- `harness.js <Circuito>`: extrae de `app.js` las funciones de la trazada y las ejecuta sobre la geometría volcada de un circuito
  (se vuelca con `pruebas/probe.py` y `pruebas/js/dumptr.js`); lista el radio del eje y de la trazada en cada curva lenta.
- `ribchk.js <Circuito> <lateral> <subdivisiones> <herm|lin|arc>`: comprueba si una cinta a ese desplazamiento lateral se pliega
  sobre sí misma en la curva más cerrada (así se encontró el piano montado de la horquilla de Mónaco: radio local de 5,9 m).
- `fair.js`, `minrad.js`: intentos de redondear la punta de la horquilla moviendo el eje; descartados (colapsan la curva).
R
cat > $F/pruebas/LEEME.md <<'R'
# Pruebas

Todas usan Playwright con Chromium y sirven el sitio desde una carpeta local.

- `qa.py`: regresión completa (los 18 circuitos alternando reglamento, cámaras, modos, temporada, móvil y las seis pestañas del
  Laboratorio en escritorio y móvil); cualquier error de la página hace fallar la prueba.
- `scan2.py` + `scan2.js` + `scanfmt2.py`: barrido de la vuelta entera desde arriba buscando cualquier cosa a más de 12 cm sobre el
  asfalto o la calle de boxes; identifica el objeto ocultando mallas por mitades. En curvas muy peraltadas o cerradas y en cuesta da
  falsos positivos de 15 a 25 cm: se confirman con `dbgq.py` (rayos verticales contra la superficie calculada).
- `motion.py`: simula varios minutos sin dibujar y cuenta saltos de posición, giros bruscos y cambios de velocidad imposibles.
- `valve.py` / `stuck.py`: abandonos con el estado del coche justo antes, y coches que se quedan parados en pista.
- `pitstop.py`, `pitview.py`, `carview.py`, `ovshot.py`, `labshot.py`: capturas de la parada en boxes, la calle de boxes, el coche de
  cerca, la cámara térmica y la suspensión en vivo, y el Laboratorio.
- `labqa.py`: las seis pestañas del Laboratorio en escritorio y móvil y, a fondo, el motor 3D: las tres vistas, las capas, la geometría
  llevada a sus extremos (V de 60° a 120°, carrera, biela, diámetro, separación y desfase) y la comprobación de que ningún tubo
  atraviesa a otro (`LAB.enginecad.check`).
- `labcam.py`: capturas de cualquier visor 3D del Laboratorio desde las cámaras que se le pidan (para revisar las piezas de cerca).
- `valtest.js` (Node, sin navegador): ejecuta el banco de validación del Laboratorio (`LAB.validate.run()`): química frente a Cantera,
  NO frente a GRI-Mech 3.0, autoencendido frente a medidas, ciclo del motor frente a principios de conservación, elementos finitos
  frente a resistencia de materiales, suspensión por trabajos virtuales y neumático frente a la solución analítica. `deploy.sh` lo pasa
  antes de construir: si una sola comprobación se sale de su tolerancia, no se publica. `labqa.py` lo repite dentro del navegador
  (ahí entra además la vuelta completa frente a las vueltas reales) y somete la química del motor a todos los preajustes,
  combustibles y parámetros extremos.
- `shot.py`: captura de los elementos que se le pidan de cualquier pestaña del Laboratorio, en escritorio o móvil.
R
cat > $F/coche/LEEME.md <<'R'
# El coche

Modelo de partida: «F1 2026 concept (polygon model)» de Qvist_designs,
https://sketchfab.com/3d-models/f1-2026-concept-polygon-model-ea3bde709b1e4dc9b0ec8557d106ed42
Licencia CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Copia usada: `assets/cars/cadillac.glb` del repositorio público
Rayman0106/f1-economics-3d-deck (ya reducida allí a 808 000 triángulos y normalizada a metros).

Cambios hechos aquí (`carbuild1.py`, `carbuild2.py`, `carbuild3.py`, en ese orden; `pubcar.py` copia el resultado al sitio):
- separación en piezas siguiendo las secciones de cada tubo: trapecios, tirantes, bieletas de dirección, carenado del palier,
  tambores, elementos de los alerones (los dos flaps delanteros y los dos traseros, móviles);
- trapecios delanteros recolocados (cizalla) para que su vértice caiga en un eje de dirección con 6° de avance, 9,5° de salida,
  18 mm de avance en el suelo y 45 mm de radio de pivotamiento (en el original el avance era negativo);
- ruedas rehechas como superficie de revolución de su propio perfil; tres niveles de detalle; librea por zonas con los colores
  de cada equipo; sin marcas de equipos reales;
- puntos duros de la suspensión medidos sobre los brazos (van en la cabecera de `car_hi.bin`, campo `rig`, y en `lab/kin3d.js`).
El casco, el volante y el interior del habitáculo son propios.
R
cat > $F/README.md <<'R'
# Parrilla Neuronal: código fuente

`app.js` es el código del simulador (física, IA, renderizado 3D y app) en formato legible.
`deploy.sh` lo minimiza con esbuild, lo copia a la rama `gh-pages` y publica.
Los scripts `*.py` son las pruebas con Playwright (capturas, IA, pit lane).
R
cd $F && git add -A && (git diff --cached --quiet || git commit -q -m "${1:-Copia del código fuente}

Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01STvS6dZYAdk1XxZT5wKixQ") && git push -q origin fuente 2>&1 | tail -1; git log --format=%h -1
