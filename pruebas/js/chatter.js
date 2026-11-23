// De dónde sale la vibración del mando de dirección: red neuronal (stN), mando antes de los reflejos (stP) y mando final (steer),
// separado por modo (0 = vuelta limpia, 1 = red neuronal). Se ejecuta con probe.py.
(() => {
  const w = __app.w, tr = w.track, T = +(window.__T || 120);
  __app.paused = true;
  const M = () => ({ n: 0, dN: 0, dP: 0, dF: 0, dS: 0, refl: 0, reflN: 0, hp: 0, rev: 0 }), acc = [M(), M()], prev = new Map;
  let sw = 0, swN = 0;
  for (let s = 0; s < 60 * T; s++) {
    Sim.raceStep(w);
    if (!w.started) continue;
    for (const c of w.cars) {
      if (c.retired || c.gone || c.inPit || c.player) continue;
      const m = c.aiMode | 0, a = acc[m], p = prev.get(c.id);
      if (p && p.m === m && c.u > 8) {
        a.n++;
        a.dN += Math.abs((c.stN || 0) - p.N), a.dP += Math.abs((c.stP || 0) - p.P), a.dF += Math.abs(c.steer - p.F), a.dS += Math.abs(c.steerS - p.S);
        const r = Math.abs(c.steer - (c.stP || 0)); r > .02 && (a.refl += r, a.reflN++);
        c.hairpin && a.hp++;
        (c.steer - p.F) * p.dF < 0 && Math.abs(c.steer - p.F) > .02 && a.rev++;
      }
      p && p.m !== m && sw++; swN++;
      prev.set(c.id, { m, N: c.stN || 0, P: c.stP || 0, F: c.steer, S: c.steerS, dF: p ? c.steer - p.F : 0 });
    }
  }
  const f = a => ({ pasos: a.n, redPorPaso: +(a.dN / Math.max(1, a.n)).toFixed(4), antesReflejosPorPaso: +(a.dP / Math.max(1, a.n)).toFixed(4), finalPorPaso: +(a.dF / Math.max(1, a.n)).toFixed(4), filtradoPorPaso: +(a.dS / Math.max(1, a.n)).toFixed(4), reflejosPct: +(100 * a.reflN / Math.max(1, a.n)).toFixed(1), reflejosMedio: +(a.refl / Math.max(1, a.reflN)).toFixed(3), horquillaPct: +(100 * a.hp / Math.max(1, a.n)).toFixed(1), inversionesPorS: +(a.rev / Math.max(1, a.n) * 60).toFixed(2) });
  return { key: tr.key, t: Math.round(w.t), limpia: f(acc[0]), red: f(acc[1]), cambiosModoPorCocheMin: +(sw / Math.max(1, swN) * 3600).toFixed(1) }
})()
