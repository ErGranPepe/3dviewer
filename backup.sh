#!/bin/bash
# copia el código fuente legible y las herramientas a la rama "fuente" del repositorio
set -e
F=/home/claude/fuente
cp /home/claude/src/app.js /home/claude/src/deploy.sh /home/claude/src/backup.sh /home/claude/src/*.py /home/claude/src/*.sh $F/ 2>/dev/null || true
cp /home/claude/src/package.json $F/
cat > $F/README.md <<'R'
# Parrilla Neuronal: código fuente

`app.js` es el código del simulador (física, IA, renderizado 3D y app) en formato legible.
`deploy.sh` lo minimiza con esbuild, lo copia a la rama `gh-pages` y publica.
Los scripts `*.py` son las pruebas con Playwright (capturas, IA, pit lane).
R
cd $F && git add -A && (git diff --cached --quiet || git commit -q -m "${1:-Copia del código fuente}

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01STvS6dZYAdk1XxZT5wKixQ") && git push -q origin fuente 2>&1 | tail -1; git log --format=%h -1
