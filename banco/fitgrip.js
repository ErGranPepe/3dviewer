// Ajuste del reparto agarre mecánico / carga aerodinámica contra la telemetría real (velocidad mínima de cada curva de las vueltas
// de pole). Para cada curva: v_sim (vuelta lanzada del simulador), v_real y la carga del circuito. Con el modelo del simulador,
// a(v) = μ·n^(1−κ)·g y n = 1 + c·v²/g, se calcula a qué velocidad pasaría por esa misma curva con otro agarre (×A), otra carga (×B)
// y otra sensibilidad a la carga (κ'), y se busca la combinación que mejor reproduce las velocidades reales.
const { Sim, defs, FACTORY } = require('./load');
Sim.setRegs(process.env.REGS || '2025');
const C = Sim.CAR, e = { genome: Sim.cloneG({ w: Float32Array.from(FACTORY[0].w), pit: .7 }), team: 0, drv: Sim.drvObj(Sim.DRIVERS[0][2]), code: Sim.DRIVERS[0][1] };
const cs = [];
defs.forEach((def, i) => {
  const ref = def.ref; if (!ref || !ref.f || def.key === 'Monaco') return;
  const tr = Sim.makeTrackReal(Object.assign({ seed: 7000 + i }, def)), trace = [], t = Sim.qualifyOne(tr, e, { trace });
  if (!isFinite(t)) return;
  let k0 = 0; for (let q = 1; q < trace.length; q++) if (trace[q][0] < trace[q - 1][0] - tr.L / 2) { k0 = q; break }
  const lap = trace.slice(k0), n = ref.f.length, V = ref.v, cdaR = 1.3 + .55 * tr.wingRec, c = .5 * tr.rho * cdaR * C.LD / (C.mass + 8);
  for (let j = 0; j < n; j++) {
    const s = ref.f[j] * tr.L; let isMin = true, hi = 0, lift = false;
    for (let q = 1; q < n; q++) { const a = (j + q) % n, b = (j - q + n) % n, da = ((ref.f[a] - ref.f[j] + 1) % 1) * tr.L, db = ((ref.f[j] - ref.f[b] + 1) % 1) * tr.L; if (da > 160 && db > 160) break; if (da <= 120 && V[a] < V[j] || db <= 120 && V[b] <= V[j] && b !== j) { isMin = false; break } da <= 160 && (hi = Math.max(hi, V[a])), db <= 160 && (hi = Math.max(hi, V[b])); db <= 120 && ref.thr && ref.thr[b] < 60 && (lift = true) }
    if (!isMin || hi - V[j] < 12 || !lift) continue;
    let sm = 1e9; for (const p of lap) { let d = Math.abs(p[0] - s); d = Math.min(d, tr.L - d); d <= 45 && (sm = Math.min(sm, p[1])) }
    const i0 = Sim.idxAt(tr, s);
    cs.push({ key: def.key, s: Math.round(s), vr: V[j] / 3.6, vs: sm / 3.6, c, bank: tr.bank && tr.bank[i0] ? 1 : 0 });
  }
});
const K0 = C.kLoad, g = 9.81, use = cs.filter(r => !r.bank && r.vr < 69.5 && Math.abs(r.vs / r.vr - 1) < .3);
const pred = (r, A, B, K) => { const a0 = Math.pow(1 + r.c * r.vs * r.vs / g, 1 - K0) / (r.vs * r.vs); let v = r.vs; for (let it = 0; it < 30; it++) { const v2 = A * Math.pow(1 + B * r.c * v * v / g, 1 - K) / a0; v = .5 * v + .5 * Math.sqrt(Math.min(1e4, v2)) } return v };
const cost = (A, B, K) => { let q = 0; for (const r of use) { const d = Math.log(pred(r, A, B, K) / r.vr); q += d * d } return Math.sqrt(q / use.length) };
const bins = [[0, 90], [90, 130], [130, 170], [170, 210], [210, 250]], show = (A, B, K) => bins.map(([a, b]) => { const G = use.filter(r => r.vr * 3.6 >= a && r.vr * 3.6 < b); return a + '-' + b + ': ' + (G.length ? ((G.reduce((q, r) => q + pred(r, A, B, K) / r.vr - 1, 0) / G.length) * 100).toFixed(1) : '-') + '%' }).join('  ');
console.log('curvas', cs.length, 'usadas', use.length, '| ahora (A=1, B=1): rms', (cost(1, 1, K0) * 100).toFixed(1) + ' %', show(1, 1, K0));
for (const K of [K0, .2, .25, .3]) {
  let best = [1e9];
  for (let A = .5; A <= 1.201; A += .01) for (let B = .6; B <= 3.001; B += .02) { const q = cost(A, B, K); q < best[0] && (best = [q, A, B]) }
  console.log('κ', K, '→ agarre ×' + best[1].toFixed(2), 'carga ×' + best[2].toFixed(2), 'rms', (best[0] * 100).toFixed(1) + ' %', show(best[1], best[2], K));
}
for (const [A, B, K] of [[.8, 1.3, K0], [.8, 1.4, .2], [.75, 1.5, .2], [.85, 1.25, K0], [.7, 1.6, K0]]) console.log('prueba agarre ×' + A, 'carga ×' + B, 'κ', K, 'rms', (cost(A, B, K) * 100).toFixed(1) + ' %', show(A, B, K));
