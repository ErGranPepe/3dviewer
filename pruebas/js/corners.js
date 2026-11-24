// Velocidad mínima en cada curva: vuelta lanzada del simulador frente a la telemetría real (vuelta de pole) en todos los circuitos.
// Sirve para ver si el reparto entre agarre mecánico y carga aerodinámica es el real: si el simulador pasa demasiado deprisa por
// las curvas lentas y demasiado despacio por las rápidas (o al revés), los tiempos por vuelta pueden cuadrar por compensación.
// Devuelve el error medio por tramos de velocidad y las curvas con más diferencia. window.__det = 1 añade todas las curvas.
(() => {
  const w = __app.w, c = w.cars[0], e = { genome: c.genome, team: c.team, drv: c.drv, code: c.code }, rows = [];
  __app.paused = true;
  window.REAL_TRACKS.forEach((def, i) => {
    const ref = def.ref; if (!ref || !ref.f || !ref.v) return;
    const tr = Sim.makeTrackReal(Object.assign({ seed: 7000 + i }, def)), trace = [], t = Sim.qualifyOne(tr, e, { trace });
    if (!isFinite(t)) { rows.push({ key: def.key, fallo: 1 }); return }
    let k0 = 0; for (let q = 1; q < trace.length; q++) if (trace[q][0] < trace[q - 1][0] - tr.L / 2) { k0 = q; break }
    const lap = trace.slice(k0), simAt = (s, win) => { let m = 1e9, mx = 0; for (const p of lap) { let d = Math.abs(p[0] - s); d = Math.min(d, tr.L - d); d <= win && (m = Math.min(m, p[1]), mx = Math.max(mx, p[1])) } return [m, mx] };
    const n = ref.f.length, V = ref.v;
    for (let j = 0; j < n; j++) {
      /* mínimo local de la telemetría real: el menor en ±120 m y al menos 12 km/h por debajo de lo que hay 150 m antes o después */
      const s = ref.f[j] * tr.L; let isMin = true, hi = 0;
      for (let q = 1; q < n; q++) { const a = (j + q) % n, b = (j - q + n) % n, da = ((ref.f[a] - ref.f[j] + 1) % 1) * tr.L, db = ((ref.f[j] - ref.f[b] + 1) % 1) * tr.L; if (da > 160 && db > 160) break; if (da <= 120 && V[a] < V[j] || db <= 120 && V[b] <= V[j] && b !== j) { isMin = false; break } da <= 160 && (hi = Math.max(hi, V[a])), db <= 160 && (hi = Math.max(hi, V[b])) }
      if (!isMin || hi - V[j] < 12) continue;
      const sm = simAt(s, 45)[0];
      rows.push({ key: def.key, s: Math.round(s), real: V[j], sim: +sm.toFixed(1), d: +(sm - V[j]).toFixed(1), R: Math.round(1 / Math.max(1e-4, Math.abs(tr.rk[Sim.idxAt(tr, s)]))), bank: tr.bank ? +(tr.bank[Sim.idxAt(tr, s)] * 57.3).toFixed(0) : 0 });
    }
    /* error cuadrático medio de la traza de velocidad completa (km/h) y por fases: frenando (el coche real frena) y acelerando */
    { let se = 0, m = 0, sb = 0, mb = 0, sa = 0, ma = 0, db = 0, da = 0;
      for (const p of lap) { const f = p[0] / tr.L; let j = 0; while (j < n - 2 && ref.f[j + 1] < f) j++; const a = Math.max(0, Math.min(1, (f - ref.f[j]) / Math.max(1e-6, ref.f[j + 1] - ref.f[j]))), rv = V[j] + (V[j + 1] - V[j]) * a, d = p[1] - rv; se += d * d; m++;
        if (ref.brk && ref.brk[j]) sb += d * d, db += d, mb++; else if (ref.thr && ref.thr[j] >= 99 && rv < 280) sa += d * d, da += d, ma++ }
      rows.push({ key: def.key, traza: 1, rms: Math.sqrt(se / Math.max(1, m)), rmsB: Math.sqrt(sb / Math.max(1, mb)), dB: db / Math.max(1, mb), rmsA: Math.sqrt(sa / Math.max(1, ma)), dA: da / Math.max(1, ma) }) }
    /* y las puntas: máximo real y del simulador */
    let vm = 0, jm = 0; for (let j = 0; j < n; j++) V[j] > vm && (vm = V[j], jm = j);
    rows.push({ key: def.key, punta: 1, real: vm, sim: +Math.max(...lap.map(p => p[1])).toFixed(1), t: +t.toFixed(2), tReal: def.pole && def.pole.t });
  });
  Sim.useTrack(w.track);
  const cs = rows.filter(r => r.real && !r.punta && !r.traza), bins = [[0, 90], [90, 130], [130, 170], [170, 210], [210, 250], [250, 400]], res = bins.map(([a, b]) => { const g = cs.filter(r => r.real >= a && r.real < b); return { tramo: a + "-" + b, n: g.length, errMedio: g.length ? +(g.reduce((q, r) => q + r.d, 0) / g.length).toFixed(1) : null, errPct: g.length ? +(g.reduce((q, r) => q + r.d / r.real, 0) / g.length * 100).toFixed(1) : null, abs: g.length ? +(g.reduce((q, r) => q + Math.abs(r.d), 0) / g.length).toFixed(1) : null } });
  const lapE = rows.filter(r => r.punta && r.tReal).map(r => ({ key: r.key, err: +((r.t / r.tReal - 1) * 100).toFixed(2), punta: r.sim - r.real }));
  const tz = rows.filter(r => r.traza && r.key !== "Monaco"), av = k => +(tz.reduce((q, r) => q + r[k], 0) / Math.max(1, tz.length)).toFixed(1);
  return { reg: Sim.CAR.reg, piloto: c.code, curvas: cs.length, traza: { rms: av("rms"), frenando: av("rmsB"), sesgoFrenando: av("dB"), acelerando: av("rmsA"), sesgoAcelerando: av("dA") }, tramos: res, vueltas: lapE, peores: cs.slice().sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 24), todas: window.__det ? cs : void 0, fallos: rows.filter(r => r.fallo) }
})()
