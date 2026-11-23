#!/bin/bash
# Construye el laboratorio: concatena, minifica y publica en pages/lab.html + a/lab.<hash>.js
set -e
cd /home/claude/src/lab
cat core.js cadkit.js carmesh.js kin3d.js suspcad.js susp.js susp3d.js engine.js enginecad.js engine3d.js limits.js drivemodel.js drivecad.js drive3d.js drive.js chassismodel.js chassis.js tyremodel.js tyre.js > /tmp/lab.all.js
npx --yes esbuild@0.24.0 /tmp/lab.all.js --minify --target=es2020 --outfile=/tmp/lab.min.js --log-level=warning
H=$(sha256sum /tmp/lab.min.js | cut -c1-10)
P=/home/claude/pages
rm -f $P/a/lab.*.js
cp /tmp/lab.min.js $P/a/lab.$H.js
T=$(cd $P && ls a/three.*.js | head -1)
D=$(cd $P && ls a/data.*.js | head -1)
SJ=$(grep -o 'a/support\.[0-9a-f]*\.js' $P/index.html | head -1); CJ=$(grep -o 'config\.js?v=[0-9a-z]*' $P/index.html | head -1)
sed "s#__LABJS__#a/lab.$H.js#;s#__THREEJS__#$T#;s#__DATAJS__#$D#;s#__SUPJS__#$SJ#;s#__CFGJS__#$CJ#" lab.html > $P/lab.html
echo "lab a/lab.$H.js"
