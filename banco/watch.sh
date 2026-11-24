#!/bin/bash
# Traza fina de un coche en una carrera reproducible. uso: ./watch.sh TRK CODIGO t0 t1 [n] [run]
TRK=$1 PRE="window.__T=$(python3 -c "print(int($4)+3)");window.__runs=$((${6:-0}+1));window.__watch={code:'$2',t0:$3,t1:$4,n:${5:-4},run:${6:-0}}" node run.js ../tests/js/story.js 2>/dev/null > ../out/n_watch_$2.txt
python3 - "$2" <<'PY'
import json,sys
t=open('/home/claude/tools/out/n_watch_%s.txt'%sys.argv[1]).read()
j=json.loads(t[t.index('{'):t.rindex('}')+1])
print('     t     s    lat    rl   kmh  vObj  tope   gas   fre   vol  beta     r    ax    ay sup modo  absW  offS muEst    mu  vref delante marcas')
for r in j.get('watch',[]): print(' '.join(str('' if x is None else x).rjust(5) for x in r))
PY
