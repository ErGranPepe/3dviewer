# Notas de trabajo (para retomar si se pierde el contexto)

ÚLTIMO ESTADO PUBLICADO (23-11-2026 16:37): gh-pages d675a2a, fuente 54ba5bd. Caja de cambios 3D según art. 9.6.1 PUBLICADA
(labqa completo de drive, engine y validate: todo ok; despliegue success). Quedan: detalle propio de cada circuito (hitos: 0-6 por
circuito en w_*.json; ya hay 81 325 edificios y 26 046 árboles reales en 17 circuitos), potencia total (~650 kW frente a 700+),
salto gráfico, rendimiento en móvil sin medir. NO usar mods de Assetto Corsa / F1 (derechos); solo datos abiertos.

Estado publicado (23-11-2026 16:08): gh-pages ee5c96f, fuente 2b3a33e. Botón «Apoya» → ko-fi.com/mariodiazgomez (aprobado por el usuario).
Hecho hoy: química (chem.js, chemdata/chemref/knockdata), ciclo de dos zonas, pestaña Validación (validate.js, 146 comprobaciones;
`node tools/tests/valtest.js` en deploy.sh), filas del art. 9.6.1 en la tabla de Transmisión (4 en rojo), dirección 8,1.

## Avance 16:30
Caja 3D rehecha según 9.6.1 (sin publicar aún hasta pasar labqa): drivecad.final(q) reparte la reducción (cónico zb1/zb2 × rectos
zF1/57), drive3d: yIn=-a/2, yOut=+a/2, x0=-0,24 (cuello largo), eje transversal g.cross, rueda final en g.diff, actuador detrás del
tabique trasero; enginecad: cola del escape en S (tpEnd0 = ty+0,15) y descargas más altas. Tabla de Transmisión con filas calculadas.
Circuitos: el simulador YA construye tribunas, paddock y edificios reales (buildRealStand, buildPaddock, buildUrban…): no se tocó.

## Pendiente pedido por el usuario («haz todo eso, rápido», 16:16)
1. Caja de cambios 3D según art. 9.6.1 (FIA 2022): primario concéntrico con el cigüeñal (Z=90) ABAJO; secundario ENCIMA a 90-100 mm;
   tambor por encima del secundario; eje de la reducción final a Z=250-260 (160-170 mm sobre el cigüeñal) y 415-450 mm por detrás de
   la cara delantera del primer par; rueda de la reducción final ≥205 mm entre puntas. Hace falta: grupo cónico ~1:1 en la punta del
   secundario → eje transversal → pareja de dientes rectos (p. ej. 57 dientes m 3,5 = 206,5 mm) → diferencial.
   Problema: al subir la caja, su techo queda a cigüeñal+0,186 m y el escape pasa por dentro. Medido en la escena de la transmisión
   (motor en x=0,195): turbina en x=0,042, eje del turbo a 0,136 m sobre el cigüeñal (enginecad `ty`), cola hasta x≈-0,318 a +0,216.
   Solución prevista: subir el turbo (ty≈0,25) en enginecad y comprobar plenum/MGU-H/colectores, o acercar la turbina al bloque y
   subir el tubo. Copias de seguridad de antes de tocar: scratchpad/bak/ (drive3d.js, enginecad.js, drive.js, drivecad.js).
   En drive3d.js: yIn=+a/2 (primario arriba) y yOut=-a/2 hoy están al revés; `keys` define la carcasa; el actuador va delante del tabique.
2. Circuitos: NO descargar mods (derechos). El simulador YA tiene mundo real por circuito en pages/t/w_<Circuito>.<hash>.json
   (b = edificios OSM, t = árboles, dem, lu, poi, fence, lm…); se publica con src/pubworld.py. Mejorar lo específico de circuito
   (tribunas, boxes, pórticos) con datos abiertos.
3. Potencia total ~650 kW frente a 700+ publicados; salto gráfico; rendimiento en móvil sin medir.
