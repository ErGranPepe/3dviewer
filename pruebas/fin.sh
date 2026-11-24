#!/bin/bash
# Confirmación final: tanda de referencia + Suzuka + lluvia + Monza larga. uso: fin.sh nombre
N=$1
R=/tmp/claude-0/-home-claude/663e7896-37da-5901-8457-45a5bf6b11ad/scratchpad/snap_$N
./runb.sh $N
O=../out/fin_$N
(ROOT=$R PORT=8885 TRK=2,4 JSFILE=js/story.js JSMAX=700000 PRE="window.__T=1500;window.__runs=2;window.__natk=3;window.__sbox=6;window.__box=4" python3 probe.py > ${O}_a.txt 2>&1; echo done >> ${O}_a.txt) &
ROOT=$R PORT=8886 TRK=12 LAPS=20 TEAM=3 JSFILE=js/story.js JSMAX=700000 PRE="window.__T=2600;window.__natk=3;window.__sbox=6;window.__box=4" python3 probe.py > ${O}_d.txt 2>&1; echo done >> ${O}_d.txt
wait
ROOT=$R PORT=8887 TRK=0 W=lluvia JSFILE=js/story.js JSMAX=700000 PRE="window.__T=1700;window.__runs=2;window.__weather='lluvia';window.__natk=3;window.__sbox=6;window.__box=4" python3 probe.py > ${O}_c.txt 2>&1; echo done >> ${O}_c.txt
echo done > ${O}_fin.txt
