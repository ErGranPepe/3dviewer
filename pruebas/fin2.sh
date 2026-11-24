#!/bin/bash
# Confirmación de la salida (b12): tanda de referencia + una carrera en otros seis circuitos. uso: fin2.sh nombre
N=$1
R=/tmp/claude-0/-home-claude/663e7896-37da-5901-8457-45a5bf6b11ad/scratchpad/snap_$N
./runb.sh $N
P="window.__T=1500;window.__runs=1;window.__natk=2;window.__sbox=4;window.__box=4"
(ROOT=$R PORT=8896 TRK=8,15,4 JSFILE=js/story.js JSMAX=500000 PRE="$P" python3 probe.py > ../out/fin_${N}_s1.txt 2>&1; echo done >> ../out/fin_${N}_s1.txt) &
ROOT=$R PORT=8897 TRK=1,13,16 JSFILE=js/story.js JSMAX=500000 PRE="$P" python3 probe.py > ../out/fin_${N}_s2.txt 2>&1; echo done >> ../out/fin_${N}_s2.txt
wait
echo done > ../out/fin_${N}_fin.txt
