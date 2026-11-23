// Crónica de una carrera completa (se ejecuta con probe.py): qué pasa, a quién y por qué. Sirve para medir si los pilotos se
// distinguen entre sí (ritmo, regularidad, forma de frenar, adelantamientos, errores) y si la estrategia se nota.
// window.__T = tope de segundos simulados (por defecto 2400). window.__ev = 1 añade la lista completa de eventos.
(() => {
  const w = __app.w, tr = w.track, N = tr.N, T = +(window.__T || 2400), L = tr.L;
  __app.paused = true;
  const ev = [], rows = new Map, wall0 = performance.now();
  let evId = w.events.length ? w.events[0].id : 0, steps = 0;
  /* la frenada más fuerte del circuito: el punto donde vref cae más en 150 m */
  let iB = 0, drop = 0;
  for (let i = 0; i < N; i++) { const j = (i + Math.round(150 / tr.ds)) % N, d = tr.vref[i] - tr.vref[j]; d > drop && (drop = d, iB = i) }
  let iA = iB; for (let q = 0; q < Math.round(260 / tr.ds); q++) { const j = (iB + q) % N; tr.vref[j] < tr.vref[iA] && (iA = j) }
  const sB = iB * tr.ds, sA = iA * tr.ds, rel = s => ((s - sB) % L + L) % L;
  for (const c of w.cars) rows.set(c.id, { code: c.code, drv: c.drv, team: c.team, grid: c.grid, laps: [], mist: { lock: 0, wide: 0, snap: 0 }, mistPress: 0, pm: null, pl: 0, brk: [], apex: [], apexLat: [], on: 0, lastS: 0, atkT: 0, defT: 0, pas: 0, sufr: 0, crash: 0, spin: 0, stops: [], pushSum: 0, pushN: 0, atkSum: 0, cleanT: 0, busyT: 0, lineOff: 0, lineN: 0, thrFull: 0, thrN: 0 });
  while (steps < 60 * T && !w.over) {
    Sim.raceStep(w), steps++;
    const fresh = [];
    for (const e of w.events) { if (e.id <= evId) break; fresh.push(e) }
    if (fresh.length) {
      evId = fresh[0].id;
      for (let k = fresh.length - 1; k >= 0; k--) {
        const e = fresh[k], r = e.car && rows.get(e.car.id);
        ev.push([+e.t.toFixed(1), e.lap, e.kind, e.txt]);
        if (!r) continue;
        e.kind === "pass" && (r.pas++, e.data && e.data.other && rows.get(e.data.other.id) && rows.get(e.data.other.id).sufr++);
        e.kind === "crash" && r.crash++, e.kind === "spin" && r.spin++;
        e.kind === "pit" && r.stops.push([e.lap, e.data ? e.data.tire : "?", e.data ? e.data.why : "?"]);
      }
    }
    if (!w.started) continue;
    for (const c of w.cars) {
      const r = rows.get(c.id);
      if (c.retired || c.gone) continue;
      if (c.laps > r.pl) { r.pl = c.laps; r.laps.push([c.laps, +c.lastLap.toFixed(3), w.order.indexOf(c) + 1, c.tire.c, +Math.max(c.tire.wf, c.tire.wr).toFixed(2), c.aiMode | 0]) }
      if (c.mist && c.mist !== r.pm) { r.mist[c.mist.type]++; (c.aheadD < 25 || c.behindD < 20) && r.mistPress++ }
      r.pm = c.mist || null;
      if (c.inPit || c.finished) continue;
      r.pushSum += c.push, r.atkSum += c.attack, r.pushN++;
      c.aiMode === 0 ? r.cleanT++ : r.busyT++;
      c.atkSide && r.atkT++, c.defLat != null && r.defT++;
      c.aiMode === 0 && (r.lineOff += Math.abs(c.lat - tr.rl[c.idx]), r.lineN++);
      c.u > 20 && (r.thrN++, c.thr > .98 && r.thrFull++);
      /* punto de frenada en la frenada más fuerte, solo en vuelta limpia: distancia al vértice al pisar el freno a más de la mitad */
      const d = rel(c.s), zone = d < rel(sA) + 20;
      if (zone && c.aiMode === 0) {
        !r.on && c.brk > .5 && d > 5 && (r.on = 1, r.brk.push(+(rel(sA) - d).toFixed(1)));
        if (r.lastS < rel(sA) && d >= rel(sA) && d - r.lastS < 20) r.apex.push(+(c.u * 3.6).toFixed(1)), r.apexLat.push(+c.lat.toFixed(2));
      }
      zone || (r.on = 0), r.lastS = d;
    }
  }
  const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : null }, mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null,
    sd = a => { if (a.length < 2) return null; const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1)) }, f = (x, n) => x == null ? null : +x.toFixed(n == null ? 2 : n);
  const ord = w.final || w.order, out = [];
  for (const c of ord) {
    const r = rows.get(c.id), lt = r.laps.slice(1).map(l => l[1]).filter(x => x > 0), m0 = med(lt), clean = lt.filter(x => m0 && x < m0 * 1.04);
    out.push({ pos: ord.indexOf(c) + 1, code: r.code, eq: r.team, parr: r.grid, drv: [r.drv.pace, r.drv.cons, r.drv.craft, r.drv.tyre, r.drv.wet, r.drv.start].join("/"), ret: c.retired ? c.dnfReason || "ret" : "",
      mejor: f(Math.min(...lt, 1e9) > 1e8 ? null : Math.min(...lt), 2), media: f(mean(clean), 2), desv: f(sd(clean), 2), vueltas: r.pl,
      adel: r.pas, sufr: r.sufr, ataqueS: f(r.atkT / 60, 0), defS: f(r.defT / 60, 0), errores: r.mist.lock + "/" + r.mist.wide + "/" + r.mist.snap, errPres: r.mistPress, choques: r.crash, trompos: r.spin,
      paradas: r.stops.map(s => "v" + s[0] + s[1] + (s[2] ? "(" + s[2] + ")" : "")).join(" "), push: f(r.pushSum / Math.max(1, r.pushN), 2), atk: f(r.atkSum / Math.max(1, r.pushN), 2),
      frenada: f(mean(r.brk), 1), frenN: r.brk.length, vApex: f(mean(r.apex), 1), latApex: f(mean(r.apexLat), 2), limpio: f(r.cleanT / Math.max(1, r.cleanT + r.busyT), 2), fuera: f(r.lineOff / Math.max(1, r.lineN), 2), gasFondo: f(r.thrFull / Math.max(1, r.thrN), 3) });
  }
  const kinds = {}; for (const e of ev) kinds[e[2]] = (kinds[e[2]] || 0) + 1;
  return { circuito: tr.key, vueltas: w.laps, t: Math.round(w.t), over: !!w.over, muroS: Math.round((performance.now() - wall0) / 1e3), frenadaEn: Math.round(sB), verticeEn: Math.round(sA), vrefApex: f(tr.vref[iA] * 3.6, 0),
    eventos: kinds, atk: w.atkStats, pilotos: out, ev: window.__ev ? ev : ev.filter(e => /crash|spin|dnf|sc|vsc|pen|fail/.test(e[2])).slice(0, 60) }
})()
