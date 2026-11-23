// Banco de validación del Laboratorio en Node: carga los modelos (sin interfaz) y ejecuta LAB.validate.run().
// uso: node valtest.js [-v]   · sale con código 1 si alguna comprobación se sale de su tolerancia
const fs = require("fs"), L = "/home/claude/src/lab/";
global.LAB = {}; global.TAU = Math.PI * 2; global.DEG = Math.PI / 180; global.clamp = (v, a, b) => v < a ? a : v > b ? b : v; global.lerp = (a, b, t) => a + (b - a) * t;
global.window = { addEventListener() {} }; global.performance = { now: () => Number(process.hrtime.bigint()) / 1e6 };
LAB.SRC = { fia22: ["FIA", "https://fia.com"] };
for (const f of ["kin3d.js", "chemdata.js", "chemref.js", "knockdata.js", "chem.js", "engine.js", "drivemodel.js", "chassismodel.js", "tyremodel.js", "validate.js"]) eval(fs.readFileSync(L + f, "utf8"));
const res = LAB.validate.run(), v = process.argv.includes("-v");
let n = 0, bad = 0;
for (const g of res) {
  n += g.n, bad += g.bad;
  console.log(`${g.bad ? "FALLA" : "ok   "} ${g.title.padEnd(58)} ${String(g.n - g.bad).padStart(3)}/${String(g.n).padEnd(3)} ${g.ms.toFixed(0).padStart(5)} ms`);
  for (const r of g.rows) (v || !r.ok) && console.log(`     ${r.ok ? "·" : "✗"} ${r.k.slice(0, 96).padEnd(96)} ${r.lab.padStart(16)} | ${String(r.ref).slice(0, 44).padEnd(44)} | ${r.err.toExponential(2)}${r.eu} (tol ${r.tol})`)
}
console.log(`${n - bad} de ${n} dentro de tolerancia`);
process.exit(bad ? 1 : 0);
