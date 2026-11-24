(() => { const w = __app.w, tr = w.track, c = w.cars[0], e = { genome: c.genome, team: c.team, drv: c.drv, code: c.code }, trace = [];
  __app.paused = true;
  const t = Sim.qualifyOne(tr, e, { trace });
  const last = trace.slice(-14).map(p => [p[0], p[1], p[7]]);
  const i = Sim.idxAt ? Sim.idxAt(tr, last[last.length - 1][0]) : Math.round(last[last.length - 1][0] / tr.ds) % tr.N;
  return { key: tr.key, hw: tr.hw, t: isFinite(t) ? t : null, n: trace.length, fin: last, k: +(1 / Math.max(1e-6, Math.abs(tr.k[i]))).toFixed(0), bank: tr.bank ? +tr.bank[i].toFixed(3) : null, vref: Math.round(tr.vref[i] * 3.6), rl: +tr.rl[i].toFixed(2), reg: Sim.CAR.reg } })()
