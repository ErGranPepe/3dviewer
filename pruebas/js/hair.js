// Traza del líder al pasar por la curva más cerrada del circuito (segunda pasada): posición lateral, velocidad, volante y golpes.
(() => {
  const w = __app.w, tr = w.track, N = tr.N, T = 260;
  __app.paused = true;
  let iH = 0;
  for (let i = 0; i < N; i++) Math.abs(tr.k[i]) > Math.abs(tr.k[iH]) && (iH = i);
  const out = [], hits = [], rkmax = Math.max(...Array.from({ length: 29 }, (_, q) => Math.abs(tr.rk[(iH - 14 + q + N) % N])));
  let pass = 0, inZone = false, c0 = null, n = 0;
  for (let s = 0; s < 60 * T && pass < 3; s++) {
    Sim.raceStep(w);
    if (!w.started) continue;
    c0 = c0 || w.cars.slice().sort((a, b) => a.grid - b.grid)[0];
    const d = ((c0.idx - iH + N + N / 2) % N) - N / 2, z = d > -16 && d < 16;
    z && !inZone && pass++; inZone = z;
    if (z && pass === 2 && n++ % 9 === 0) out.push([c0.idx - iH, +c0.lat.toFixed(1), +(c0.u * 3.6).toFixed(0), +(c0.steerS || 0).toFixed(2), +c0.thr.toFixed(1), +c0.brk.toFixed(1), c0.hairpin | 0, c0.aiMode, +(c0.lastImp || 0).toFixed(0), c0.surf | 0]);
  }
  return { key: tr.key, coche: c0 && c0.code, radioEje: +(1 / Math.abs(tr.k[iH])).toFixed(1), radioTrazada: +(1 / rkmax).toFixed(1), radioMinCoche: +(3.6 / Math.tan(.44)).toFixed(1), hw: tr.hw, rlEnVertice: +tr.rl[iH].toFixed(1), cols: "di lat km/h volante gas freno horq modo golpe sup", traza: out }
})()
