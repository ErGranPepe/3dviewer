// Análisis de la conducción de la IA: finura del volante y paso por la curva más cerrada. Se ejecuta con probe.py.
(() => {
  const w = __app.w, tr = w.track, N = tr.N, dt = 1 / 60, T = +(window.__T || 200);
  __app.paused = true;
  let iH = 0;
  for (let i = 0; i < N; i++) Math.abs(tr.k[i]) > Math.abs(tr.k[iH]) && (iH = i);
  const near = i => { const d = Math.abs(i - iH); return Math.min(d, N - d) <= 14 };
  const st = new Map;
  /* ángulo real de las ruedas (rad): el mando filtrado por la física (steerS) por el giro máximo a esa velocidad */
  const mxs = u => Math.min(.44, .5 / (1 + u / 30) + .15 * Math.max(0, 1 - u / 26)), dl = c => (c.steerS || 0) * mxs(Math.max(c.u, 0));
  for (const c of w.cars) st.set(c.id, { ps: dl(c), pd: 0, n: 0, sumRate: 0, maxRate: 0, flips: 0, lastFlipT: -9, dist: 0, uminH: 1e9, satN: 0, big: [] });
  let steps = 0;
  for (; steps < 60 * T; steps++) {
    Sim.raceStep(w);
    if (!w.started) continue;
    for (const c of w.cars) {
      if (c.retired || c.gone || c.inPit) continue;
      const q = st.get(c.id), ang = dl(c), d = (ang - q.ps) / dt;
      q.n++, q.sumRate += Math.abs(d), Math.abs(d) > q.maxRate && (q.maxRate = Math.abs(d)), q.dist += Math.abs(c.u) * dt;
      // volantazo: el volante cambia de sentido con brío (más de 0,6 rad/s a cada lado) en menos de 0,35 s
      /* volantazo: el volante cambia de sentido a más de 100°/s por cada lado (0,215 rad/s en las ruedas, con relación 8,1) en menos de 0,35 s */
      if (d * q.pd < 0 && Math.abs(d) > .215 && Math.abs(q.pd) > .215) { w.t - q.lastFlipT < .35 && (q.flips++, q.big.length < 4 && q.big.push([Math.round(c.s), +c.u.toFixed(0), +d.toFixed(1)])); q.lastFlipT = w.t }
      Math.abs(d) > .215 && (q.pd = d);
      q.ps = ang;
      near(c.idx) && c.u < q.uminH && (q.uminH = c.u);
    }
  }
  const rows = w.cars.filter(c => !c.retired && !c.gone).map(c => { const q = st.get(c.id); return { code: c.code, km: +(q.dist / 1e3).toFixed(2), volanteMedioGradS: +(q.sumRate / Math.max(1, q.n) * 8.1 * 57.3).toFixed(0), volanteMaxGradS: +(q.maxRate * 8.1 * 57.3).toFixed(0), volantazosKm: +(q.flips / Math.max(.1, q.dist / 1e3)).toFixed(1), uminHorquilla: +(q.uminH * 3.6).toFixed(0), ej: q.big[0] } });
  rows.sort((a, b) => b.volantazosKm - a.volantazosKm);
  const med = a => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1] };
  return { circuito: tr.key, t: Math.round(w.t), horquilla: { i: iH, s: Math.round(iH * tr.ds), radio: +(1 / Math.abs(tr.k[iH])).toFixed(1), vref: +(tr.vref[iH] * 3.6).toFixed(0), muroIzq: +(tr.wallX[0][iH]).toFixed(2), muroDer: +(tr.wallX[1][iH]).toFixed(2), rl: +tr.rl[iH].toFixed(2), hw: tr.hw },
    mediana: { volantazosKm: med(rows.map(r => r.volantazosKm)), volanteMedioGradS: med(rows.map(r => r.volanteMedioGradS)), uminHorquilla: med(rows.map(r => r.uminHorquilla)) }, peores: rows.slice(0, 4), mejores: rows.slice(-2) }
})()
