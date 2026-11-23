# Banco de la trazada (fuera del navegador)

- `harness.js <Circuito>`: extrae de `app.js` las funciones de la trazada y las ejecuta sobre la geometría volcada de un circuito
  (se vuelca con `pruebas/probe.py` y `pruebas/js/dumptr.js`); lista el radio del eje y de la trazada en cada curva lenta.
- `ribchk.js <Circuito> <lateral> <subdivisiones> <herm|lin|arc>`: comprueba si una cinta a ese desplazamiento lateral se pliega
  sobre sí misma en la curva más cerrada (así se encontró el piano montado de la horquilla de Mónaco: radio local de 5,9 m).
- `fair.js`, `minrad.js`: intentos de redondear la punta de la horquilla moviendo el eje; descartados (colapsan la curva).
