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
