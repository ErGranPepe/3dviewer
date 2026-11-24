#!/bin/bash
# Bisección: carreras con un interruptor del banco (window.__opt). uso: ./bis.sh etiqueta "opt js" "12,16" [runs]
L=$1; O=$2; T=$3; R=${4:-1}
F=../out/nb_${L}.txt
TRK=$T PRE="window.__T=1500;window.__runs=$R;window.__natk=2;window.__sbox=2;window.__box=2;window.__opt=$O" node run.js ../tests/js/story.js > $F 2>/dev/null; echo done >> $F
