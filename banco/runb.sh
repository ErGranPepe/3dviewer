#!/bin/bash
# Tanda de carreras en Node (sin página): uso: ./runb.sh nombre "0,12" [runs] [extra env]  → ../out/ns_<nombre>_<trk>.txt (acaba con «done»)
N=$1; T=$2; RUNS=${3:-3}
F=../out/ns_${N}_$(echo $T | tr ',' '_').txt
TRK=$T PRE="window.__T=1500;window.__runs=$RUNS;window.__natk=5;window.__sbox=10;window.__box=6;${PREX}" node run.js ../tests/js/story.js > $F 2> ${F%.txt}.log; echo done >> $F
