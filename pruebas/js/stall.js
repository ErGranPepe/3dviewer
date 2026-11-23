// Detector de paradas: primeras veces que un coche baja de 3 m/s en carrera (no en la salida ni en boxes), con su estado.
(() => {
  const w = __app.w, tr = w.track, N = tr.N, T = +(window.__T || 200);
  __app.paused = true;
  let iH = 0;
  for (let i = 0; i < N; i++) Math.abs(tr.k[i]) > Math.abs(tr.k[iH]) && (iH = i);
  const fast = new Map, out = [], hist = new Map;
  const wr = a => Math.atan2(Math.sin(a), Math.cos(a));
  for (let s = 0; s < 60 * T && out.length < 14; s++) {
    Sim.raceStep(w);
    if (!w.started) continue;
    for (const c of w.cars) {
      if (c.retired || c.gone || c.inPit || c.player) continue;
      const h = hist.get(c.id) || []; hist.set(c.id, h);
      s % 6 === 0 && (h.push([+(c.u * 3.6).toFixed(0), +c.lat.toFixed(1), +(c.steerS || 0).toFixed(2), +c.thr.toFixed(1), +c.brk.toFixed(1), c.reflex | 0, c.avoid | 0, c.ahead ? Math.round(c.aheadD) : -1, Math.round(Math.min(999, c.vCap || 999) * 3.6), c.surf | 0, +wr(c.h - tr.hd[c.idx]).toFixed(2)]), h.length > 14 && h.shift());
      c.avoid = 0;
      if (c.u > 12) fast.set(c.id, 1);
      else if (c.u < 3 && fast.get(c.id)) {
        fast.set(c.id, 0);
        const d = ((c.idx - iH + N + N / 2) % N) - N / 2;
        out.push({ t: +w.t.toFixed(1), code: c.code, di: d, s: Math.round(c.s), lat: +c.lat.toFixed(1), mode: c.aiMode, ahead: c.ahead ? c.ahead.code + "@" + Math.round(c.aheadD) : null, dmg: +(c.dmg.fw + c.dmg.susp).toFixed(2), mist: c.mist ? c.mist.type : null, hold: !!c.hold, cols: "kmh lat vol gas fre refl avoid aheadD vCap sup dRumbo", hist: h.slice() });
      }
    }
  }
  return { key: tr.key, t: Math.round(w.t), iH, n: out.length, out }
})()
