#!/bin/bash
# Tanda de referencia: 3 carreras en Sakhir, Catalunya y Monza sobre una copia de la web (snap.sh). uso: runb.sh nombre [runs]
# Deja ../out/story_<nombre>.txt (Sakhir y Monza) y ../out/story_<nombre>_cat.txt (Catalunya); cada uno acaba con «done».
N=$1; RUNS=${2:-3}
R=/tmp/claude-0/-home-claude/663e7896-37da-5901-8457-45a5bf6b11ad/scratchpad/snap_$N
[ -d "$R" ] || { echo "falta $R"; exit 1; }
PRE="window.__T=1500;window.__runs=$RUNS;window.__natk=5;window.__sbox=10;window.__box=6"
(ROOT=$R PORT=8871 TRK=6 JSFILE=js/story.js JSMAX=900000 PRE="$PRE" python3 probe.py > ../out/story_${N}_cat.txt 2>&1; echo done >> ../out/story_${N}_cat.txt) &
ROOT=$R PORT=8872 TRK=0,12 JSFILE=js/story.js JSMAX=900000 PRE="$PRE" python3 probe.py > ../out/story_$N.txt 2>&1; echo done >> ../out/story_$N.txt
wait
