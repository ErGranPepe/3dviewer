// Comprobaciones de geometría de los 17 circuitos en segundos: anchos (nominal, mínimo, mediana, máximo), trazada dentro de sus
// límites, ida y vuelta de latWarp/latUnwarp, muros (distancia mínima al borde real) y calle de boxes.
const { Sim, defs } = require('./load');
const only = process.env.TRK ? process.env.TRK.split(',').map(Number) : null;
defs.forEach((def, i) => {
  if (only && !only.includes(i)) return;
  const t0 = Date.now(), tr = Sim.makeTrackReal(Object.assign({ seed: 7e3 + i }, def)), N = tr.N;
  Sim.useTrack(tr);
  const HW = Sim.HW, h = tr.hwv, q = h ? Array.from(h).sort((a, b) => a - b) : [HW];
  let over = 0, maxOver = 0, rlMax = 0;
  for (let k = 0; k < N; k++) { const lim = (h ? h[k] : HW) - .95, o = Math.abs(tr.rl[k]) - lim; o > 1e-3 && (over++, maxOver = Math.max(maxOver, o)); rlMax = Math.max(rlMax, Math.abs(tr.rl[k])) }
  /* ida y vuelta del warp y monotonía */
  let rt = 0, mono = 0;
  for (let k = 0; k < N; k += 7) { let prev = -1e9; for (let l = -Sim.WALL - 30; l <= Sim.WALL + 30; l += .25) { const r = Sim.latWarp(tr, k, l), b = Sim.latUnwarp(tr, k, r); rt = Math.max(rt, Math.abs(b - l)); r < prev - 1e-6 && mono++; prev = r } }
  /* muro: distancia mínima al borde real del asfalto */
  let wmin = 1e9, wAt = 0;
  if (tr.wallX && !tr.street) for (let s = 0; s < 2; s++) for (let k = 0; k < N; k++) { const d = Sim.WALL + tr.wallX[s][k] - (h ? h[k] : HW); d < wmin && (wmin = d, wAt = k) }
  const P = tr.pit, iP = Math.floor(((P.inS + P.len / 2) % tr.L) / tr.ds) % N, laneR = Sim.latWarp(tr, iP, P.lane);
  let vmin = 1e9, vmax = 0; for (let k = 0; k < N; k++) vmin = Math.min(vmin, tr.vref[k]), vmax = Math.max(vmax, tr.vref[k]);
  console.log(def.key.padEnd(11), 'nominal', (2 * HW).toFixed(1), 'ancho mín/med/máx', (2 * q[0]).toFixed(1), (2 * q[q.length >> 1]).toFixed(1), (2 * q[q.length - 1]).toFixed(1), '| antes', (2 * tr.hwOld).toFixed(1),
    '| rl fuera', over, maxOver.toFixed(2), '| warp ida-vuelta', rt.toExponential(1), 'no monótono', mono, '| muro-borde mín', wmin.toFixed(1), '@' + Math.round(wAt * tr.ds),
    '| boxes: calle a', Math.abs(laneR).toFixed(1), 'del eje, ancho ahí', (2 * (h ? h[iP] : HW)).toFixed(1), '| ideal', tr.ideal.toFixed(2), 'vref', (vmin * 3.6).toFixed(0), (vmax * 3.6).toFixed(0), '|', ((Date.now() - t0) / 1e3).toFixed(1) + ' s');
});
