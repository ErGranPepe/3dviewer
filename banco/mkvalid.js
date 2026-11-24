// Genera la tabla de validación que publica la web (window.VALID y window.VALIDC de data.*.js): vuelta lanzada del simulador
// frente a la pole real en los 17 circuitos, con el reglamento de los coches de esa telemetría (2014-2025), y la velocidad
// mínima de cada curva frente a la telemetría real, por tramos de velocidad. Escribe ../out/valid.json (lo aplica src/pubvalid.py).
const fs = require('fs'), { Sim, defs, FACTORY } = require('./load');
Sim.setRegs('2025');
const e = { genome: Sim.cloneG({ w: Float32Array.from(FACTORY[0].w), pit: .7 }), team: 0, drv: Sim.drvObj(Sim.DRIVERS[0][2]), code: Sim.DRIVERS[0][1] };
const V = [], cs = [];
defs.forEach((def, i) => {
  const ref = def.ref, tr = Sim.makeTrackReal(Object.assign({ seed: 7000 + i }, def)), trace = [], t = Sim.qualifyOne(tr, e, { trace });
  let k0 = 0; for (let q = 1; q < trace.length; q++) if (trace[q][0] < trace[q - 1][0] - tr.L / 2) { k0 = q; break }
  const lap = trace.slice(k0), n = ref.f.length, RV = ref.v;
  let vmax = 0, se = 0, m = 0, lat = 0, dec = 0, rvmax = 0;
  for (let q = 0; q < lap.length; q++) {
    const p = lap[q], f = p[0] / tr.L, v = p[1] / 3.6; let j = 0; while (j < n - 2 && ref.f[j + 1] < f) j++;
    const a = Math.max(0, Math.min(1, (f - ref.f[j]) / Math.max(1e-6, ref.f[j + 1] - ref.f[j]))), rv = RV[j] + (RV[j + 1] - RV[j]) * a;
    se += (p[1] - rv) ** 2, m++, vmax = Math.max(vmax, p[1]), lat = Math.max(lat, v * v * Math.abs(tr.rk[Sim.idxAt(tr, p[0])]) / 9.81);
    q > 0 && (dec = Math.max(dec, (lap[q - 1][1] - p[1]) / 3.6 / .1 / 9.81));
  }
  for (const x of RV) rvmax = Math.max(rvmax, x);
  const real = def.pole && def.pole.t;
  V.push({ key: def.key, sim: isFinite(t) ? +t.toFixed(3) : null, real, err: isFinite(t) && real ? +((t / real - 1) * 100).toFixed(3) : null, rms: +Math.sqrt(se / Math.max(1, m)).toFixed(2), vmax: +vmax.toFixed(1), rvmax: +rvmax.toFixed(1), lat: +lat.toFixed(2), dec: +dec.toFixed(2) });
  if (!isFinite(t)) return;
  for (let j = 0; j < n; j++) {
    const s = ref.f[j] * tr.L; let isMin = true, hi = 0;
    for (let q = 1; q < n; q++) { const a = (j + q) % n, b = (j - q + n) % n, da = ((ref.f[a] - ref.f[j] + 1) % 1) * tr.L, db = ((ref.f[j] - ref.f[b] + 1) % 1) * tr.L; if (da > 160 && db > 160) break; if (da <= 120 && RV[a] < RV[j] || db <= 120 && RV[b] <= RV[j] && b !== j) { isMin = false; break } da <= 160 && (hi = Math.max(hi, RV[a])), db <= 160 && (hi = Math.max(hi, RV[b])) }
    if (!isMin || hi - RV[j] < 12) continue;
    let sm = 1e9; for (const p of lap) { let d = Math.abs(p[0] - s); d = Math.min(d, tr.L - d); d <= 45 && (sm = Math.min(sm, p[1])) }
    cs.push({ key: def.key, real: RV[j], sim: sm });
  }
});
const bins = [[0, 90], [90, 130], [130, 170], [170, 210], [210, 250], [250, 400]], use = cs.filter(c => c.key !== 'Monaco');
const C = { regs: '2025', fecha: new Date().toISOString().slice(0, 10), curvas: use.length, circuitos: new Set(use.map(c => c.key)).size,
  tramos: bins.map(([a, b]) => { const g = use.filter(c => c.real >= a && c.real < b); return { de: a, a: b, n: g.length, err: g.length ? +(g.reduce((q, c) => q + (c.sim / c.real - 1), 0) / g.length * 100).toFixed(1) : null, abs: g.length ? +(g.reduce((q, c) => q + Math.abs(c.sim / c.real - 1), 0) / g.length * 100).toFixed(1) : null } }) };
fs.writeFileSync('../out/valid.json', JSON.stringify({ VALID: V, VALIDC: C }));
const ok = V.filter(v => v.err != null && v.key !== 'Monaco');
console.log(V.map(v => v.key.padEnd(11) + ' sim ' + v.sim + ' real ' + v.real + ' err ' + (v.err == null ? '-' : (v.err > 0 ? '+' : '') + v.err.toFixed(2)) + ' %  punta ' + v.vmax + '/' + v.rvmax + '  rms ' + v.rms + '  lat ' + v.lat + ' g  frenada ' + v.dec + ' g').join('\n'));
console.log('media |err| (16 sin Mónaco)', (ok.reduce((q, v) => q + Math.abs(v.err), 0) / ok.length).toFixed(2), '% · sesgo', (ok.reduce((q, v) => q + v.err, 0) / ok.length).toFixed(2), '%');
console.log(JSON.stringify(C));
