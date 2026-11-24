#!/bin/bash
# Pruebas de regresión del bloque de carreras sobre una copia de la web. uso: regr.sh nombre
# Deja ../out/regr_<nombre>_*.txt; el último paso escribe «done» en ../out/regr_<nombre>_fin.txt
N=$1
R=/tmp/claude-0/-home-claude/663e7896-37da-5901-8457-45a5bf6b11ad/scratchpad/snap_$N
[ -d "$R" ] || { echo "falta $R"; exit 1; }
O=../out/regr_$N
P1="window.__T=1500;window.__runs=2;window.__natk=3;window.__sbox=6;window.__box=4"
# A) otros circuitos: Mónaco, Suzuka, Spa, Silverstone (2 carreras cada uno)
(ROOT=$R PORT=8881 TRK=4,2 JSFILE=js/story.js JSMAX=700000 PRE="$P1" python3 probe.py > ${O}_a.txt 2>&1; echo done >> ${O}_a.txt) &
ROOT=$R PORT=8882 TRK=10,8 JSFILE=js/story.js JSMAX=700000 PRE="$P1" python3 probe.py > ${O}_b.txt 2>&1; echo done >> ${O}_b.txt
wait
# B) lluvia (Sakhir) y carrera larga dirigiendo un equipo (Monza, 20 vueltas, equipo 3: la carrera de la propia página)
(ROOT=$R PORT=8883 TRK=0 W=lluvia JSFILE=js/story.js JSMAX=700000 PRE="window.__T=1700;window.__runs=2;window.__weather='lluvia';window.__natk=3;window.__sbox=6;window.__box=4" python3 probe.py > ${O}_c.txt 2>&1; echo done >> ${O}_c.txt) &
ROOT=$R PORT=8884 TRK=12 LAPS=20 TEAM=3 JSFILE=js/story.js JSMAX=700000 PRE="window.__T=2600;window.__natk=3;window.__sbox=6;window.__box=4" python3 probe.py > ${O}_d.txt 2>&1; echo done >> ${O}_d.txt
wait
echo done > ${O}_fin.txt
