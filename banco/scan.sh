#!/bin/bash
# Barrido de agarre (muScale) y carga aerodinámica (escala de L/D) contra las curvas reales. uso: ./scan.sh "1.40 1.33" "1.0 1.16"
for M in $1; do for B in $2; do
  TRK=0 REGS=${REGS:-2025} PRE="Sim.CAR.muScale=$M;Sim.CAR.LD*=$B;Sim.CAR.cla*=$B;${EXTRA}" node run.js ../tests/js/corners.js > ../out/n_scan_${M}_${B}.txt 2>/dev/null
  python3 - "$M" "$B" <<'PY'
import json,sys
M,B=sys.argv[1:3]
t=open('/home/claude/tools/out/n_scan_%s_%s.txt'%(M,B)).read()
j=json.loads(t[t.index('{'):t.rindex('}')+1])
tr=' '.join('%+5.1f'%(r['errPct'] or 0) for r in j['tramos'])
v=[r for r in j['vueltas'] if r['key']!='Monaco']
e=[r['err'] for r in v]
pt=[r['punta'] for r in v]
z=j.get('traza') or {}
print('mu %s carga x%s | curvas %% [<90 90-130 130-170 170-210 210-250 >250]: %s | vuelta: sesgo %+.2f %%, |err| %.2f %%, máx %+.1f/%+.1f | punta %+.1f | traza rms %s (frenando %s, sesgo %s; acelerando %s, sesgo %s) | fallos %d'%(M,B,tr,sum(e)/len(e),sum(abs(x) for x in e)/len(e),min(e),max(e),sum(pt)/len(pt),z.get('rms'),z.get('frenando'),z.get('sesgoFrenando'),z.get('acelerando'),z.get('sesgoAcelerando'),len(j['fallos'])))
PY
done; done
