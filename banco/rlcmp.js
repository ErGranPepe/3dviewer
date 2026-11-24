// Trazada actual frente a K1999 puro (curvatura geométrica de tres puntos, multirrejilla) dentro de los mismos límites:
// vuelta ideal del perfil de velocidades y radio de la trazada en cada curva. uso: [TRK=Sakhir,...] node rlcmp.js
const { Sim, defs } = require('./load'), I = Sim._;
Sim.setRegs(process.env.REGS || '2025');
const only = process.env.TRK ? process.env.TRK.split(',') : null;
for (const [i, def] of defs.entries()) {
  if (only && !only.includes(def.key)) continue;
  const tr = Sim.makeTrackReal(Object.assign({ seed: 7e3 + i }, def)), N = tr.N, ds = tr.ds;
  Sim.useTrack(tr);
  const id0 = tr.ideal, rl0 = Float32Array.from(tr.rl), rk0 = Float32Array.from(tr.rk);
  const LM = tr.hwv ? Float32Array.from(tr.hwv, v => v - .95) : Sim.HW - (I.STREET[tr.key] ? 1.3 : .95);
  const t0 = Date.now(), k = I.k1999Line(tr, tr.nx, tr.ny, LM, j => rl0[j]);
  I.racingLineFinish(tr, k, tr.nx, tr.ny), I.trackVref(tr);
  const id1 = tr.ideal, dt = Date.now() - t0;
  /* curvas: radio mínimo de la trazada antes y después */
  let out = [], a = -1;
  for (let q = 0; q <= N; q++) { const on = q < N && Math.abs(tr.k[q]) > 1 / 250; if (on && a < 0) a = q; if (!on && a >= 0) { let ang = 0, k0 = 0, k1 = 0, im = a, km = 0; for (let j = a; j < q; j++) { ang += tr.k[j] * ds; k0 = Math.max(k0, Math.abs(rk0[j])); k1 = Math.max(k1, Math.abs(tr.rk[j])); Math.abs(tr.k[j]) > km && (km = Math.abs(tr.k[j]), im = j) } Math.abs(ang) > .35 && out.push(Math.round(im * ds) + ':' + Math.round(1 / km) + '→' + Math.round(1 / k0) + '/' + Math.round(1 / k1)); a = -1 } }
  let use0 = 0, use1 = 0; for (let j = 0; j < N; j++) { const l = typeof LM === 'number' ? LM : LM[j]; use0 += Math.abs(rl0[j]) / l; use1 += Math.abs(k[j]) / l }
  console.log(def.key.padEnd(11), 'ideal', id0.toFixed(2), '→', id1.toFixed(2), '(' + ((id1 / id0 - 1) * 100).toFixed(1) + ' %)', 'uso del ancho', (use0 / N).toFixed(2), '→', (use1 / N).toFixed(2), dt + ' ms', only ? '\n   s:R_eje→R_antes/R_k1999  ' + out.join('  ') : '');
}
