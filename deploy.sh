#!/bin/bash
# uso: deploy.sh [mensaje]  (sin mensaje: solo construye en pages, no publica)
set -e
cd /home/claude/src
E=./node_modules/.bin/esbuild
P=/home/claude/pages
# conjunto CAD de suspensión para la vista en vivo (cinemática 3D + piezas + bucle), cargado bajo demanda
{ echo '(()=>{"use strict";const LAB=window.LAB||(window.LAB={});const clamp=(v,a,b)=>v<a?a:v>b?b:v,lerp=(a,b,t)=>a+(b-a)*t,TAU=Math.PI*2,DEG=Math.PI/180;'; cat lab/cadkit.js lab/carmesh.js lab/kin3d.js lab/suspcad.js lab/live.js; echo '})();'; } > /tmp/cad.all.js
$E /tmp/cad.all.js --minify --target=es2020 --log-level=error > /tmp/cad.min.js
HC=$(sha256sum /tmp/cad.min.js | cut -c1-10)
OLDC=$(grep -o 'a/cad\.[0-9a-f]*\.js' $P/index.html | head -1)
if [ "$OLDC" != "a/cad.$HC.js" ]; then cp /tmp/cad.min.js $P/a/cad.$HC.js; sed -i "s#$OLDC#a/cad.$HC.js#g" $P/index.html; git -C $P rm -q --cached $OLDC 2>/dev/null || true; rm -f $P/$OLDC; fi
# apoyo al proyecto (donaciones): mismo archivo en el simulador y el laboratorio
$E support.js --minify --target=es2020 --log-level=error > /tmp/support.min.js
HS=$(sha256sum /tmp/support.min.js | cut -c1-10)
OLDS=$(grep -o 'a/support\.[0-9a-f]*\.js' $P/index.html | head -1)
if [ "$OLDS" != "a/support.$HS.js" ]; then cp /tmp/support.min.js $P/a/support.$HS.js; if [ -n "$OLDS" ]; then sed -i "s#$OLDS#a/support.$HS.js#g" $P/index.html $P/lab.html; git -C $P rm -q --cached $OLDS 2>/dev/null || true; rm -f $P/$OLDS; else sed -i "s#<script src=\"a/site\.\([0-9a-f]*\)\.js\"></script>#<script src=\"a/site.\1.js\"></script><script src=\"a/support.$HS.js\"></script>#" $P/index.html; fi; fi
$E app.js --minify-whitespace --minify-syntax --target=es2020 --log-level=error > /tmp/app.min.js
for f in data; do :; done
H=$(sha256sum /tmp/app.min.js | cut -c1-10)
OLD=$(grep -o 'a/app\.[0-9a-f]*\.js' $P/index.html | head -1)
if [ "$OLD" != "a/app.$H.js" ]; then
  cp /tmp/app.min.js $P/a/app.$H.js
  sed -i "s#$OLD#a/app.$H.js#g" $P/index.html
  git -C $P rm -q --cached $OLD 2>/dev/null || true; rm -f $P/$OLD
  D=$(grep -o 'a/data\.[0-9a-f]*\.js' $P/index.html | head -1 | sed 's#a/data\.##;s#\.js##')
  echo "{\"b\": \"$H${D:0:4}\"}" > $P/version.json; sed -i "s/var B=\"[0-9a-f]*\"/var B=\"$H${D:0:4}\"/" $P/index.html
fi
echo "built a/app.$H.js"
if [ -n "$1" ]; then
  cd $P && git add -A && git commit -q -m "$1

Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01STvS6dZYAdk1XxZT5wKixQ" && git push -q origin gh-pages && git log --format=%h -1
fi
