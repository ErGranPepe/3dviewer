// Prueba de la relajación de radio mínimo sobre la geometría volcada. uso: node minrad.js Monaco [Rmin]
const fs = require("fs"), T = JSON.parse(fs.readFileSync("/home/claude/tools/out/tr/" + (process.argv[2] || "Monaco") + ".json", "utf8"));
const N = T.N, X = Float64Array.from(T.x), Y = Float64Array.from(T.y), X0 = X.slice(), Y0 = Y.slice(), Rmin = +(process.argv[3] || (T.HW + 1.6 + 1.5));
const R3 = i => { const a = (i - 1 + N) % N, b = (i + 1) % N, x1 = X[i] - X[a], y1 = Y[i] - Y[a], x2 = X[b] - X[i], y2 = Y[b] - Y[i], d = Math.hypot(x1, y1) * Math.hypot(x2, y2) * Math.hypot(X[b] - X[a], Y[b] - Y[a]), c = Math.abs(2 * (x1 * y2 - y1 * x2)); return c > 1e-12 ? d / c : 1e9 };
function minRadius(X, Y, Rmin) {
  let moved = 0;
  for (let it = 0; it < 3000; it++) {
    let worst = 1e9, wi = -1;
    for (let i = 0; i < N; i++) { const r = R3(i); r < worst && (worst = r, wi = i) }
    if (worst >= Rmin) break;
    for (let q = -3; q <= 3; q++) { const j = (wi + q + N) % N, a = (j - 1 + N) % N, b = (j + 1) % N, w = .5 * (1 - Math.abs(q) / 4); X[j] += w * ((X[a] + X[b]) / 2 - X[j]), Y[j] += w * ((Y[a] + Y[b]) / 2 - Y[j]) }
    moved++
  }
  return moved
}
let r0 = 1e9, i0 = 0; for (let i = 0; i < N; i++) { const r = R3(i); r < r0 && (r0 = r, i0 = i) }
const below = []; for (let i = 0; i < N; i++) R3(i) < Rmin && below.push([i, +R3(i).toFixed(1)]);
const it = minRadius(X, Y, Rmin);
let r1 = 1e9, dmax = 0, nm = 0, L0 = 0, L1 = 0; for (let i = 0; i < N; i++) { const r = R3(i); r < r1 && (r1 = r); const d = Math.hypot(X[i] - X0[i], Y[i] - Y0[i]); d > dmax && (dmax = d); d > .02 && nm++; const b = (i + 1) % N; L0 += Math.hypot(X0[b] - X0[i], Y0[b] - Y0[i]); L1 += Math.hypot(X[b] - X[i], Y[b] - Y[i]) }
console.log(T.key, "HW", T.HW, "Rmin", Rmin.toFixed(1), "| radio mínimo antes", r0.toFixed(2), "en", i0, "→ después", r1.toFixed(2), "| iteraciones", it, "| nodos movidos", nm, "máx", dmax.toFixed(2), "m | longitud", L0.toFixed(1), "→", L1.toFixed(1));
console.log("  nodos por debajo antes:", JSON.stringify(below.slice(0, 30)));
if (process.argv[4]) { T.x = Array.from(X); T.y = Array.from(Y); for (let i = 0; i < N; i++) { const a = (i - 1 + N) % N, b = (i + 1) % N; T.hd[i] = Math.atan2(Y[b] - Y[a], X[b] - X[a]) } fs.writeFileSync("/home/claude/tools/out/tr/" + T.key + "_mr.json", JSON.stringify(T)) }
