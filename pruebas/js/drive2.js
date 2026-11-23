// Banco de conducción de la IA (se ejecuta con probe.py): finura del volante y de los pedales, precisión sobre la trazada,
// paso por la curva más cerrada, ritmo e incidentes. window.__T = segundos de carrera (por defecto 240).
(() => {
  const w = __app.w, tr = w.track, N = tr.N, dt = 1 / 60, T = +(window.__T || 240);
  __app.paused = true;
  let iH = 0;
  for (let i = 0; i < N; i++) Math.abs(tr.k[i]) > Math.abs(tr.k[iH]) && (iH = i);
  const near = i => { const d = Math.abs(i - iH); return Math.min(d, N - d) <= 14 };
  const mxs = u => Math.min(.44, .5 / (1 + u / 30) + .15 * Math.max(0, 1 - u / 26)), dl = c => (c.steerS || 0) * mxs(Math.max(c.u, 0));
  const st = new Map;
  for (const c of w.cars) st.set(c.id, { ps: dl(c), pd: 0, n: 0, sumRate: 0, maxRate: 0, flips: 0, lastFlipT: -9, dist: 0, uminH: 1e9, ped: 0, lastPed: 0, e2: 0, en: 0, emax: 0, jerk: 0, pa: 0 });
  let crashes = 0, spins = 0;
  const fast = new Map, stalls = [], hist = new Map, wr = a => Math.atan2(Math.sin(a), Math.cos(a)), crashAt = [];
  let evId = w.events.length ? w.events[0].id : 0;
  for (let steps = 0; steps < 60 * T; steps++) {
    Sim.raceStep(w);
    if (!w.started) continue;
    for (const e of w.events) { if (e.id <= evId) break; e.kind === "crash" && /choca/.test(e.txt) && (crashes++, crashAt.push([+w.t.toFixed(0), e.car ? e.car.code : "", e.car ? Math.round(e.car.s) : 0, e.car && hist.get(e.car.id) ? hist.get(e.car.id).slice(-4) : null])); e.kind === "spin" && spins++ }
    w.events.length && (evId = Math.max(evId, w.events[0].id));
    for (const c of w.cars) {
      if (c.retired || c.gone || c.inPit || c.player) continue;
      const q = st.get(c.id), ang = dl(c), d = (ang - q.ps) / dt;
      { const h = hist.get(c.id) || []; hist.set(c.id, h);
        steps % 15 === 0 && (h.push([+(c.u * 3.6).toFixed(0), +c.lat.toFixed(1), +(c.steerS || 0).toFixed(2), +c.thr.toFixed(1), +c.brk.toFixed(1), c.reflex | 0, c.ahead ? Math.round(c.aheadD) : -1, Math.round(Math.min(999, c.vCap || 999) * 3.6), c.surf | 0, +wr(c.h - tr.hd[c.idx]).toFixed(2), c.mist ? c.mist.type : c.err ? "err" : "", w.t - (c.hitT || -99) < 1.2 ? "hit" : ""]), h.length > 16 && h.shift());
        if (c.u > 12) fast.set(c.id, 1);
        else if (c.u < 3 && fast.get(c.id)) { fast.set(c.id, 0); stalls.length < 40 && stalls.push({ t: +w.t.toFixed(1), code: c.code, s: Math.round(c.s), lat: +c.lat.toFixed(1), ahead: c.ahead ? c.ahead.code + "@" + Math.round(c.aheadD) : null, dmg: +(c.dmg.fw + c.dmg.susp).toFixed(2), hist: h.slice() }) } }
      q.n++, q.sumRate += Math.abs(d), Math.abs(d) > q.maxRate && (q.maxRate = Math.abs(d)), q.dist += Math.abs(c.u) * dt;
      /* volantazo: el volante cambia de sentido a más de 100°/s por cada lado (0,215 rad/s en las ruedas, relación 8,1) en menos de 0,35 s */
      if (d * q.pd < 0 && Math.abs(d) > .215 && Math.abs(q.pd) > .215) { w.t - q.lastFlipT < .35 && q.flips++; q.lastFlipT = w.t }
      Math.abs(d) > .215 && (q.pd = d);
      q.ps = ang;
      near(c.idx) && c.u < q.uminH && (q.uminH = c.u);
      /* pedales: cambios gas↔freno */
      const ped = c.brk > .05 ? -1 : c.thr > .05 ? 1 : 0;
      ped && q.lastPed && ped !== q.lastPed && q.ped++; ped && (q.lastPed = ped);
      /* tirones longitudinales: variación de la aceleración */
      const a = c.axF || 0; q.jerk += Math.abs(a - q.pa) / dt; q.pa = a;
      /* precisión sobre la trazada en vuelta limpia */
      if (c.aiMode === 0 && c.u > 10) { const e = c.lat - tr.rl[c.idx]; q.e2 += e * e, q.en++, Math.abs(e) > q.emax && (q.emax = Math.abs(e)) }
    }
  }
  const live = w.cars.filter(c => !c.gone && !c.player), rows = live.map(c => { const q = st.get(c.id), km = Math.max(.1, q.dist / 1e3); return { code: c.code, km: +km.toFixed(2), vol: q.sumRate / Math.max(1, q.n) * 8.1 * 57.3, volMax: q.maxRate * 8.1 * 57.3, flips: q.flips / km, umin: q.uminH * 3.6, ped: q.ped / km, jerk: q.jerk / Math.max(1, q.n), erms: q.en > 200 ? Math.sqrt(q.e2 / q.en) : null, emax: q.emax, best: isFinite(c.bestLap) ? c.bestLap : null, resets: c.resets || 0, ret: c.retired ? 1 : 0, dmg: (c.dmg.fw + c.dmg.susp) } });
  const med = a => { const s = a.filter(x => x != null).sort((x, y) => x - y); return s.length ? +s[s.length >> 1].toFixed(2) : null }, sum = k => rows.reduce((s, r) => s + r[k], 0);
  const bests = rows.map(r => r.best).filter(x => x).sort((a, b) => a - b);
  return { circuito: tr.key, t: Math.round(w.t), ideal: tr.ideal ? +tr.ideal.toFixed(2) : null, mejorVuelta: bests[0] ? +bests[0].toFixed(2) : null, vueltaMediana: med(rows.map(r => r.best)), kmTotal: +sum("km").toFixed(1),
    volantazosKm: med(rows.map(r => r.flips)), volanteGradS: med(rows.map(r => r.vol)), volanteMaxGradS: med(rows.map(r => r.volMax)), cambiosPedalKm: med(rows.map(r => r.ped)), tironMs3: med(rows.map(r => r.jerk)),
    errorTrazadaRms: med(rows.map(r => r.erms)), errorTrazadaMax: med(rows.map(r => r.emax)), vMinCurvaLenta: med(rows.map(r => r.umin)), vMinPeor: +Math.min(...rows.map(r => r.umin)).toFixed(0), vrefCurvaLenta: +(tr.vref[iH] * 3.6).toFixed(0),
    paradas: stalls.length, primerasParadas: window.__diag ? stalls.slice(0, 3) : stalls.slice(0, 6).map(e => [e.t, e.code, e.s, e.ahead, e.dmg]), dondeChoques: window.__diag ? crashAt.slice(0, 5) : crashAt.slice(0, 10).map(e => e.slice(0, 3)), choques: crashes, trompos: spins, retirados: sum("ret"), recolocados: sum("resets"), danoMedio: +(sum("dmg") / rows.length).toFixed(3) }
})()
