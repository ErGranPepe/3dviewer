#!/bin/bash
# uso: deploy.sh [mensaje]  (sin mensaje: solo construye en pages, no publica)
set -e
cd /home/claude/src
E=./node_modules/.bin/esbuild
P=/home/claude/pages
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

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01STvS6dZYAdk1XxZT5wKixQ" && git push -q origin gh-pages && git log --format=%h -1
fi
