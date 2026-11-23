// Prueba del carenado de codos: iguala la curvatura (como K1999) en una ventana alrededor de los nodos más cerrados que Rmin y
// reparte los nodos a distancia uniforme. uso: node fair.js Monaco [Rmin] [guardar]
const fs = require("fs"), T = JSON.parse(fs.readFileSync("/home/claude/tools/out/tr/" + (process.argv[2] || "Monaco") + ".json", "utf8"));
const N = T.N, X = Float64Array.from(T.x), Y = Float64Array.from(T.y), X0 = X.slice(), Y0 = Y.slice(), Rmin = +(process.argv[3] || (T.HW + 1.6 + 1.5));
const k3 = (ax, ay, bx, by, cx, cy) => { const x1 = bx - ax, y1 = by - ay, x2 = cx - bx, y2 = cy - by, d = Math.hypot(x1, y1) * Math.hypot(x2, y2) * Math.hypot(cx - ax, cy - ay); return d > 1e-12 ? 2 * (x1 * y2 - y1 * x2) / d : 0 };
const W = i => (i % N + N) % N, R3 = i => { const k = Math.abs(k3(X[W(i - 1)], Y[W(i - 1)], X[i], Y[i], X[W(i + 1)], Y[W(i + 1)])); return k > 1e-9 ? 1 / k : 1e9 };
function fairTight(X, Y, Rmin) {
  const N = X.length, W = i => (i % N + N) % N, done = new Uint8Array(N), D = (i, j) => Math.hypot(X[W(i)] - X[W(j)], Y[W(i)] - Y[W(j)]);
  let n = 0;
  for (let c = 0; c < N; c++) {
    if (done[c] || R3(c) >= Rmin) continue;
    let sep = 0; for (let k = 3; k <= 9; k++) sep = Math.max(sep, D(c - k, c + k));
    const Rt = Math.min(Rmin, .47 * sep), a = c - 9, b = c + 9, M = b - a + 1;
    for (let q = a; q <= b; q++) done[W(q)] = 1;
    if (Rt <= R3(c) + .2) continue;
    for (let it = 0; it < 6000; it++) {
      let worst = Rt, wi = -1;
      for (let q = a + 1; q <= b - 1; q++) { const r = R3(W(q)); r < worst && (worst = r, wi = q) }
      if (wi < 0) break;
      for (let q = -2; q <= 2; q++) { const jq = wi + q; if (jq <= a || jq >= b) continue; const j = W(jq), p = W(jq - 1), nn = W(jq + 1), w = .5 * (1 - Math.abs(q) / 3); X[j] += w * ((X[p] + X[nn]) / 2 - X[j]), Y[j] += w * ((Y[p] + Y[nn]) / 2 - Y[j]) }
    }
    const px = [], py = [], cum = [0];
    for (let q = a; q <= b; q++) px.push(X[W(q)]), py.push(Y[W(q)]);
    for (let m = 1; m < M; m++) cum.push(cum[m - 1] + Math.hypot(px[m] - px[m - 1], py[m] - py[m - 1]));
    for (let m = 1; m < M - 1; m++) { const s = cum[M - 1] * m / (M - 1); let j = 1; for (; j < M - 1 && cum[j] < s;) j++; const t = (s - cum[j - 1]) / (cum[j] - cum[j - 1]); X[W(a + m)] = px[j - 1] + (px[j] - px[j - 1]) * t, Y[W(a + m)] = py[j - 1] + (py[j] - py[j - 1]) * t }
    n++
  }
  return n
}
let r0 = 1e9; for (let i = 0; i < N; i++) r0 = Math.min(r0, R3(i));
const n = fairTight(X, Y, Rmin);
let r1 = 1e9, i1 = 0, dmax = 0, nm = 0, L0 = 0, L1 = 0; for (let i = 0; i < N; i++) { const r = R3(i); r < r1 && (r1 = r, i1 = i); const d = Math.hypot(X[i] - X0[i], Y[i] - Y0[i]); d > dmax && (dmax = d); d > .02 && nm++; const b = (i + 1) % N; L0 += Math.hypot(X0[b] - X0[i], Y0[b] - Y0[i]); L1 += Math.hypot(X[b] - X[i], Y[b] - Y[i]) }
console.log(T.key, "Rmin", Rmin.toFixed(1), "| radio mínimo antes", r0.toFixed(2), "→ después", r1.toFixed(2), "en", i1, "| ventanas", n, "| nodos movidos", nm, "máx", dmax.toFixed(2), "m | longitud", L0.toFixed(1), "→", L1.toFixed(1));
const o = []; for (let q = -8; q <= 8; q++) { const i = W(i1 + q), b = W(i + 1); o.push([q, +R3(i).toFixed(1), +Math.hypot(X[b] - X[i], Y[b] - Y[i]).toFixed(2), +Math.hypot(X[i] - X0[i], Y[i] - Y0[i]).toFixed(2)]) } console.log("  [k, radio, paso, movido]:", JSON.stringify(o));
if (process.argv[4]) { T.x = Array.from(X); T.y = Array.from(Y); for (let i = 0; i < N; i++) { const a = W(i - 1), b = W(i + 1); T.hd[i] = Math.atan2(Y[b] - Y[a], X[b] - X[a]) } fs.writeFileSync("/home/claude/tools/out/tr/" + T.key + "_mr.json", JSON.stringify(T)) }
