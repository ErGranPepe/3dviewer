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
