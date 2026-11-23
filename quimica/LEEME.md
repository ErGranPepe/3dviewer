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
