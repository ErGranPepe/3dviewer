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
