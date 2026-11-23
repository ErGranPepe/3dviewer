// Banco de la trazada fuera del navegador: carga la geometría volcada de un circuito (tools/out/tr/<clave>.json), extrae del
// código del simulador las funciones de la trazada y las ejecuta. uso: node harness.js Monaco [variante]
const fs = require("fs"), key = process.argv[2] || "Monaco";
const T = JSON.parse(fs.readFileSync("/home/claude/tools/out/tr/" + key + ".json", "utf8"));
const src = fs.readFileSync(process.env.APP || "/home/claude/src/app.js", "utf8");
const a = src.indexOf(" function racingLine(tr) {"), b = src.indexOf(" function speedProfile(");
const code = process.env.BLOCK ? fs.readFileSync(process.env.BLOCK, "utf8") : src.slice(a, b);
const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v, wrap = x => Math.atan2(Math.sin(x), Math.cos(x));
const HW = T.HW, STREET = T.street ? { [T.key]: 1 } : {};
const mk = new Function("clamp", "wrap", "HW", "STREET", "window", "process", code + "; return { racingLine, hairpinMask, k1999Line, racingLineFinish, k3pt };");
const F = mk(clamp, wrap, HW, STREET, { __hwt: process.env.HWT != null ? +process.env.HWT : undefined }, process);
const tr = { N: T.N, ds: T.ds, L: T.L, key: T.key, real: T.real, x: Float32Array.from(T.x), y: Float32Array.from(T.y), hd: Float32Array.from(T.hd), k: Float32Array.from(T.k), rlReal: T.rlReal ? Float32Array.from(T.rlReal) : null };
F.racingLine(tr);
const N = tr.N;
let iH = 0; for (let i = 0; i < N; i++) Math.abs(tr.k[i]) > Math.abs(tr.k[iH]) && (iH = i);
// radio mínimo de la trazada por curva lenta (|k eje| > 1/30): lista
const rep = [];
for (let i = 0; i < N; i++) {
  const ka = Math.abs(tr.k[i]);
  if (ka > 1 / 30 && ka >= Math.abs(tr.k[(i - 1 + N) % N]) && ka >= Math.abs(tr.k[(i + 1) % N])) {
    let rk = 0; for (let q = -8; q <= 8; q++) rk = Math.max(rk, Math.abs(tr.rk[(i + q + N) % N]));
    rep.push({ i, eje: +(1 / ka).toFixed(1), trazada: +(1 / rk).toFixed(1), rl: +tr.rl[i].toFixed(2) });
  }
}
let dmax = 0, d2 = 0; if (T.rl) for (let i = 0; i < N; i++) { const d = Math.abs(tr.rl[i] - T.rl[i]); d > dmax && (dmax = d); d2 += d * d }
console.log(key, "N", N, "HW", HW, "difConNavegador max", dmax.toFixed(3), "rms", Math.sqrt(d2 / N).toFixed(3));
console.log("curvas lentas (radio del eje / de la trazada / rl en el vértice):"); for (const r of rep) console.log(" ", JSON.stringify(r));
if (process.env.DUMP) { const o = []; for (let d = -10; d <= 10; d++) { const i = (iH + d + N) % N; o.push([d, +tr.rl[i].toFixed(2), +(1 / tr.rk[i]).toFixed(1)]) } console.log(JSON.stringify(o)) }
module.exports = { tr, F, T };
