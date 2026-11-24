#!/bin/bash
# Copia de la web construida (pages) a una carpeta aparte para lanzar pruebas largas sin que una reconstrucción las pise.
# uso: snap.sh nombre  → imprime la ruta (se usa como ROOT=… en probe.py / scan2.py). Los recursos pesados (t/) van enlazados.
SP=/tmp/claude-0/-home-claude/663e7896-37da-5901-8457-45a5bf6b11ad/scratchpad
D=$SP/snap_$1
rm -rf "$D"; mkdir -p "$D"
cd /home/claude/pages
for f in *; do
  if [ "$f" = "t" ]; then ln -s /home/claude/pages/t "$D/t"; else cp -r "$f" "$D/"; fi
done
echo "$D"
