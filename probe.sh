#!/bin/bash
K=$(curl -s https://ergranpepe.github.io/3dviewer/config.js | grep -o 'googleMapsKey:"[^"]*"' | cut -d'"' -f2)
echo "key len ${#K}"
for R in "https://ergranpepe.github.io/" "" ; do
 echo "== referer: '$R'"
 curl -s -w "\nHTTP %{http_code}\n" ${R:+-H "Referer: $R"} "https://tile.googleapis.com/v1/3dtiles/root.json?key=$K" | head -c 1200; echo
done
echo "== 2D tiles createSession (otro producto de la misma API)"
curl -s -w "\nHTTP %{http_code}\n" -H "Referer: https://ergranpepe.github.io/" -H "Content-Type: application/json" -d '{"mapType":"roadmap","language":"es-ES","region":"ES"}' "https://tile.googleapis.com/v1/createSession?key=$K" | head -c 800; echo
