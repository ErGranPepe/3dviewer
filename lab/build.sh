#!/bin/bash
# Construye el laboratorio: concatena, minifica y publica en pages/lab.html + a/lab.<hash>.js
set -e
cd /home/claude/src/lab
cat core.js susp.js engine.js > /tmp/lab.all.js
npx --yes esbuild@0.24.0 /tmp/lab.all.js --minify --target=es2020 --outfile=/tmp/lab.min.js --log-level=warning
H=$(sha256sum /tmp/lab.min.js | cut -c1-10)
P=/home/claude/pages
rm -f $P/a/lab.*.js
cp /tmp/lab.min.js $P/a/lab.$H.js
sed "s#__LABJS__#a/lab.$H.js#" lab.html > $P/lab.html
echo "lab a/lab.$H.js"
