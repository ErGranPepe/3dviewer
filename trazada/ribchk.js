// Comprueba si una cinta a desplazamiento lateral `lat` se pliega (el borde retrocede) alrededor del nodo de mayor curvatura.
const fs = require("fs"), T = JSON.parse(fs.readFileSync("/home/claude/tools/out/tr/" + (process.argv[2] || "Monaco") + ".json", "utf8"));
const N = T.N, lat = +(process.argv[3] || 6.42), sub = +(process.argv[4] || 12), mode = process.argv[5] || "herm";
let iH = 0; for (let i = 0; i < N; i++) Math.abs(T.k[i]) > Math.abs(T.k[iH]) && (iH = i);
const sg = Math.sign(T.k[iH]), wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const pts = [];
for (let k = iH - 6; k <= iH + 6; k++) {
  const i = (k % N + N) % N, j = (i + 1) % N, dx = T.x[j] - T.x[i], dy = T.y[j] - T.y[i], Lc = Math.hypot(dx, dy), t0x = Math.cos(T.hd[i]) * Lc, t0y = Math.sin(T.hd[i]) * Lc, t1x = Math.cos(T.hd[j]) * Lc, t1y = Math.sin(T.hd[j]) * Lc;
  for (let q = 0; q < sub; q++) {
    const f = q / sub, f2 = f * f, f3 = f2 * f, b1 = f3 - 2 * f2 + f, b2 = 3 * f2 - 2 * f3, b3 = f3 - f2;
    let x, y, h;
    if (mode === "herm") { x = T.x[i] + b1 * t0x + b2 * dx + b3 * t1x; y = T.y[i] + b1 * t0y + b2 * dy + b3 * t1y; h = q ? Math.atan2((6 * f - 6 * f2) * dy + (3 * f2 - 4 * f + 1) * t0y + (3 * f2 - 2 * f) * t1y, (6 * f - 6 * f2) * dx + (3 * f2 - 4 * f + 1) * t0x + (3 * f2 - 2 * f) * t1x) : T.hd[i] }
    else if (mode === "arc") { const h0 = T.hd[i], D = wrap(T.hd[j] - h0); h = h0 + D * f;
      if (Math.abs(D) < 1e-4) { x = T.x[i] + Math.cos(h0) * Lc * f; y = T.y[i] + Math.sin(h0) * Lc * f }
      else { const R = Lc / (2 * Math.sin(D / 2)), ex = T.x[i] + R * (Math.sin(h0 + D) - Math.sin(h0)), ey = T.y[i] - R * (Math.cos(h0 + D) - Math.cos(h0));
        x = T.x[i] + R * (Math.sin(h) - Math.sin(h0)) + (T.x[j] - ex) * f; y = T.y[i] - R * (Math.cos(h) - Math.cos(h0)) + (T.y[j] - ey) * f } }
    else { x = T.x[i] + dx * f; y = T.y[i] + dy * f; h = T.hd[i] + wrap(T.hd[j] - T.hd[i]) * f }
    pts.push({ k: k - iH, q, h, x: x - Math.sin(h) * lat * sg, y: y + Math.cos(h) * lat * sg, cx: x, cy: y });
  }
}
let back = 0, minStep = 1e9, out = [];
for (let n = 1; n < pts.length; n++) {
  const a = pts[n - 1], b = pts[n], th = (a.h + wrap(b.h - a.h) / 2), st = (b.x - a.x) * Math.cos(th) + (b.y - a.y) * Math.sin(th), dh = wrap(b.h - a.h) * sg;
  st < 0 && back++; st < minStep && (minStep = st);
  (b.q === 0 || st < 0 || dh < 0) && out.push([b.k, b.q, +st.toFixed(3), +dh.toFixed(4)]);
}
// radio local de la curva central (tres puntos) mínimo
let rmin = 1e9; for (let n = 1; n < pts.length - 1; n++) { const a = pts[n - 1], b = pts[n], c = pts[n + 1], x1 = b.cx - a.cx, y1 = b.cy - a.cy, x2 = c.cx - b.cx, y2 = c.cy - b.cy, d = Math.hypot(x1, y1) * Math.hypot(x2, y2) * Math.hypot(c.cx - a.cx, c.cy - a.cy), kk = d > 1e-12 ? Math.abs(2 * (x1 * y2 - y1 * x2) / d) : 0; kk > 0 && 1 / kk < rmin && (rmin = 1 / kk) }
console.log(T.key, "iH", iH, "modo", mode, "lat", lat, "sub", sub, "| pasos hacia atrás:", back, "| paso mínimo del borde (m):", minStep.toFixed(3), "| radio mínimo del eje:", rmin.toFixed(2));
console.log("  nodos (k, q, paso del borde, giro) con paso<0 o giro<0 o q=0:", JSON.stringify(out.slice(0, 40)));
