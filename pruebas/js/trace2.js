// ¿Dónde pierde el segundo respecto al líder? (probe.py) Compara, tramo a tramo de 20 m, la vuelta `window.__lap` (por
// defecto la 2) de los coches en las posiciones `window.__pos` (por defecto [1,2,3]) y lista los tramos donde el segundo
// va más de 8 km/h más lento, con lo que hacía (gas, freno, alerones, modo, tope por tráfico, reflejos).
(() => {
  const w = __app.w, tr = w.track, L = tr.L, nb = Math.ceil(L / 20), LAP = +(window.__lap || 2), POS = window.__pos || [1, 2, 3];
  __app.paused = true;
  const rec = new Map;
  let steps = 0;
  while (steps < 60 * 400 && !w.over) {
    Sim.raceStep(w), steps++;
    if (!w.started) continue;
    let done = true;
    for (const c of w.cars) {
      const lap = Math.floor(c.prog / L) + 1;
      lap <= LAP && !c.retired && (done = false);
      if (lap !== LAP || c.prog < 0) continue;
      let r = rec.get(c.id);
      r || (r = { code: c.code, t0: w.t, t1: 0, seg: Array.from({ length: nb }, () => null) }, rec.set(c.id, r));
      r.t1 = w.t;
      const k = Math.floor(c.s / 20), q = r.seg[k] || (r.seg[k] = { n: 0, u: 0, thr: 0, brk: 0, drs: 0, m: 0, cap: 0, sv: 0, rf: 0, mom: 0, ers: 0, pk: 0, cal: 0, lat: 0, av: 0, hz: 0, def: 0, al: 0 });
      q.n++, q.u += c.u, q.thr += c.thr, q.brk += c.brk, q.drs += c.drs ? 1 : 0, q.m += c.aiMode ? 1 : 0, q.cap += c.vCap < 150 ? 1 : 0, q.sv += c.save ? 1 : 0, q.rf += c.reflex ? 1 : 0, q.mom += c.mom ? 1 : 0, q.ers += c.ersOn ? 1 : 0, q.pk = Math.max(q.pk, c.u), q.cal += c.calm ? 1 : 0, q.lat += c.lat - tr.rl[c.idx], q.av += c.avoid ? 1 : 0, q.hz += c.hz ? 1 : 0, q.def += c.defLat != null ? 1 : 0, q.al += Math.abs(c.hErr || 0) > .4 ? 1 : 0;
      c.save = 0, c.avoid = 0;
    }
    if (done) break;
  }
  const ord = (w.order || w.cars).slice(), pick = POS.map(p => ord[p - 1]).filter(Boolean).map(c => rec.get(c.id)).filter(Boolean);
  if (pick.length < 2) return { err: "sin datos", n: rec.size };
  const A = pick[0], out = { circuito: tr.key, vuelta: LAP, coches: pick.map(r => r.code + " " + (r.t1 - r.t0).toFixed(2) + " s"), tramos: {} };
  const f = (q, k) => q && q.n ? q[k] / q.n : 0;
  for (let p = 1; p < pick.length; p++) {
    const B = pick[p], rows = [];
    let loss = 0, lossStr = 0, lossCor = 0;
    for (let k = 0; k < nb; k++) {
      const a = A.seg[k], b = B.seg[k];
      if (!a || !b || !a.n || !b.n) continue;
      const ua = a.u / a.n, ub = b.u / b.n, dt = 20 / Math.max(5, ub) - 20 / Math.max(5, ua), str = Math.abs(tr.k[Math.min(tr.N - 1, Math.round((k * 20 + 10) / tr.ds))]) < 1 / 400;
      loss += dt, str ? lossStr += dt : lossCor += dt;
      (ua - ub) * 3.6 > 8 && rows.push([k * 20, Math.round(ua * 3.6), Math.round(ub * 3.6), +f(b, "thr").toFixed(2), +f(b, "brk").toFixed(2), "ala" + f(b, "drs").toFixed(1) + "/" + f(a, "drs").toFixed(1), "trafico" + f(b, "m").toFixed(1), "tope" + f(b, "cap").toFixed(1), "salva" + f(b, "sv").toFixed(1), "refl" + f(b, "rf").toFixed(1), "ers" + f(b, "ers").toFixed(1) + "/" + f(a, "ers").toFixed(1), "calma" + f(b, "cal").toFixed(1), "dlat" + f(b, "lat").toFixed(1), "esq" + f(b, "av").toFixed(1), "pel" + f(b, "hz").toFixed(1), "def" + f(b, "def").toFixed(1), "cruz" + f(b, "al").toFixed(1), str ? "RECTA" : "curva"]);
    }
    out.tramos[B.code] = { pierde: +loss.toFixed(2), enRecta: +lossStr.toFixed(2), enCurva: +lossCor.toFixed(2), n: rows.length, filas: rows.slice(0, +(window.__rows || 45)) };
  }
  return out
})()
