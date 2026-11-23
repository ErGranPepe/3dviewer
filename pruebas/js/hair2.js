// Traza detallada de un coche (window.__car = posición de parrilla, por defecto 0) en la curva más cerrada: pasadas 1 y 2.
(() => {
  const w = __app.w, tr = w.track, N = tr.N, T = 230, G = +(window.__car || 0);
  __app.paused = true;
  let iH = 0;
  for (let i = 0; i < N; i++) Math.abs(tr.k[i]) > Math.abs(tr.k[iH]) && (iH = i);
  const out = { 1: [], 2: [] };
  let pass = 0, inZone = false, c0 = null, n = 0;
  for (let s = 0; s < 60 * T && pass < 3; s++) {
    const sv0 = c0 ? c0.save : 0; c0 && (c0.save = 0);
    Sim.raceStep(w);
    if (!w.started) continue;
    c0 = c0 || w.cars.slice().sort((a, b) => a.grid - b.grid)[G];
    const d = ((c0.idx - iH + N + N / 2) % N) - N / 2, z = d > -12 && d < 14;
    z && !inZone && pass++; inZone = z;
    if (z && pass <= 2 && n++ % 6 === 0) out[pass].push([d, +c0.lat.toFixed(1), +(c0.u * 3.6).toFixed(0), +(c0.steerS || 0).toFixed(2), +c0.thr.toFixed(1), +c0.brk.toFixed(1), c0.hairpin | 0, c0.aiMode | 0, c0.reflex | 0, c0.save | 0, c0.surf | 0, Math.round(Math.min(999, c0.vCap || 999) * 3.6), Math.round(c0.aheadD || 0), c0.avoid | 0, c0.err | 0, +(c0.beta || 0).toFixed(2)]);
    c0.avoid = 0;
  }
  return { key: tr.key, coche: c0 && c0.code, cols: "di lat km/h volante gas freno horq modo reflejo save sup vCap aheadD avoid err beta", p1: out[1], p2: out[2] }
})()
