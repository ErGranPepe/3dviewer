#!/bin/bash
# copia el código fuente legible y las herramientas a la rama "fuente" del repositorio
set -e
F=/home/claude/fuente
cp /home/claude/src/app.js /home/claude/src/deploy.sh /home/claude/src/backup.sh /home/claude/src/*.py /home/claude/src/*.sh $F/ 2>/dev/null || true
cp /home/claude/src/package.json $F/; mkdir -p $F/lab && cp /home/claude/src/lab/*.js /home/claude/src/lab/*.html /home/claude/src/lab/*.sh $F/lab/; cp /home/claude/src/xf.json $F/ 2>/dev/null || true
# herramientas con las que se construye el coche a partir del modelo 3D original (CC BY 4.0) y su ficha de procedencia
mkdir -p $F/coche && cp /home/claude/tools/car/*.py /home/claude/tools/viewer/simp.mjs /home/claude/tools/viewer/view.html /home/claude/tools/viewer/shot.py $F/coche/ 2>/dev/null || true
# pruebas automáticas: barrido de la pista (objetos sobre el asfalto), regresión completa, movimiento, averías, parada en boxes
mkdir -p $F/pruebas && cp /home/claude/tools/tests/* $F/pruebas/ 2>/dev/null || true
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
