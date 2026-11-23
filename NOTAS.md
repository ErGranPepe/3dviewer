# Notas de trabajo (para retomar si se pierde el contexto)

## PETICIÓN DEL USUARIO 23-11 17:08 (con 6 fotos de referencia: Yas Marina, puente de Barcelona, recta de Bakú, piano de Montreal, horquilla y puerto de Mónaco)
1. Revisar TODOS los circuitos paso a paso: zonas que se ven mal o sin cubrir. Mónaco: en la horquilla (Fairmont) el muro de la izquierda
   es invisible y los coches se frenan.
2. IA de conducción: pega volantazos, no es fina ni inteligente → mejorarla (más conciencia del entorno).
3. UX/UI de la webapp: la ve floja; mejorarla.
4. Quiere tráfico y ganar dinero: que entre mucha gente; URL pública, gratis, que aguante mucha carga (hoy: GitHub Pages).
5. Realismo del entorno: edificios cortados a mitad de piso; gente dentro del circuito; fuera solo césped y montículos sin sentido (quiere
   rocas, terraplenes y escapatorias reales); nada flotando, nada desolado; apoyarse en fotogrametría / reconstrucción avanzada.
6. La «zona sucia» de la pista NO es polvo: son virutas de goma fuera de la trazada, muy sutil, en degradado; se puede circular.
7. Mirar las fotos: edificios, luz, colores, texturas, brillos, sombras, reflejos. «No simplifiques».


## Avance 23-11 noche (petición de las 17:08)
PUBLICADO 23-11 20:14: gh-pages 11e55e0 (despliegue success), fuente 7d29794. El usuario vio una captura del vértice de la horquilla
con el piano montado («¿qué mierda es esa?») → arreglado: radio local del eje 5,9 m < piano/muro; tope interior en ribbon() y wallLimits.
Cabecera móvil arreglada en simulador y Laboratorio (Apoya se montaba sobre el título). Barrera entre ramales: solo urbanos y tramos
paralelos (no anillos en el interior de curvas de circuitos permanentes).
HECHO Y PROBADO:
- IA de conducción rehecha (app.js): geometría continua (lerpN/lerpH, vrefMinF, rayos por bisección); «delante/detrás/en paralelo» medidos
  por la pista (antes, en una horquilla, el del otro ramal contaba como «delante» y el líder clavaba frenos; el de detrás contaba como
  «al lado» y el de delante se salía); steerTo = anticipación por curvatura + deriva por eje (capF/capR) + lazo de error lateral/rumbo
  (Kapania-Gerdes) + ventana de deriva delantera; speedTo = freno por la deceleración del perfil (car._ap de targetSpeed) + 6 s⁻¹ de error;
  think() = plan + estilo de la red (±0,35 m, ±1,2 %), red directa solo en modo Entrenar o genoma.raw (pilotos del usuario);
  limbs() (volante ≤ 2,2 rad/s en rueda, pedales en rampa); hazard() (coche parado hasta 300 m); alignCap (cruzado → no acelera);
  lift() (subviraje → levanta); táctica: no atacar en curva en pista estrecha ni iniciar ataque en plena curva; distancias de seguimiento
  5+0,06u / 6,8+0,05u; margen de bloqueo de dirección en horquillas (kEff); trazada: K1999 entera en horquillas y lim urbano HW-1,3.
- Banco: tools/tests/probe.py (SEED, W=seco, ROOT, PRE) + js/drive2.js (volantazos/km, cambios de pedal/km, paradas, choques, recolocados,
  históricos con __diag). Antes/después (240-200 s, seco): Mónaco volantazos 34,6→3/km, horquilla 2→48 km/h, recolocados 9→0;
  Suzuka 16,4→0,7/km, recolocados 4→0; Sakhir recolocados 16→0 tras poner escapatorias de asfalto.
- Escapatorias por circuito (RUNOFF_PAINT 1/2): asfalto ancho en Sakhir, Yas Marina, Austin, Shanghái; México ya coincide con lo pintado.
- ribbon(): arcos entre nodos, subdivisión por giro, `cols`, `uvV`, `uvRef`, tope interior (tr.rloc − 0,35 m); wallLimits con el mismo tope.
  Muro dibujado donde el límite físico va entre dos ramales (antes invisible). Isleta de la horquilla de Mónaco = jardineras en la mediana.
- Pista: goma sin dientes (rlF + cols), virutas (TEX.crumb franja de 3,2 m desde el borde, TEX.crumb0 microvirutas en todo el ancho,
  canicas dinámicas mT finas), asfalto seco #dcdcdc, fachadas con pisos enteros.
- Web: botón Compartir (support.js), etiquetas sociales + JSON-LD en lab.html, sitemap con lab.html, _headers para Cloudflare Pages,
  textos de la IA al día. tools/tests/hdrchk.py comprueba cabeceras.
- Alojamiento (datos comprobados 23-11): GitHub Pages = 100 GB/mes blando, sitio ≤ 1 GB; Cloudflare Pages gratis = ancho de banda y
  peticiones estáticas ilimitados, 500 compilaciones/mes, 20 000 archivos, 25 MiB/archivo (el sitio: ~150 archivos, 66 MB) → requiere
  cuenta del usuario; Vercel Hobby = 100 GB y 1 M de peticiones/mes. Primera carga 0,93 MB gzip; un mundo de circuito 0,23-1,15 MB.
PENDIENTE: UX/UI (portada, HUD, móvil) — sin tocar; entorno (rocas, taludes, hitos por circuito); revisar los 17 circuitos con capturas
(solo se han mirado Mónaco, Barcelona, Sakhir); potencia 650 kW; rendimiento en móvil sin medir; incidencias sueltas de la IA
(Shanghái: trompo frenando en el borde; errores aleatorios «snap/lock» son intencionados).

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
