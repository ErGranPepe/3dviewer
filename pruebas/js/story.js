// Crónica de una carrera completa (se ejecuta con probe.py): qué pasa, a quién y por qué. Sirve para medir si los pilotos se
// distinguen entre sí (ritmo, regularidad, forma de frenar, adelantamientos, errores) y si la estrategia se nota.
// window.__T = tope de segundos simulados (por defecto 2400) · window.__ev = 1 añade todos los eventos ·
// window.__boost = {code:"ERI", q:1.03, p:1.03} da más agarre/potencia a un coche (prueba de remontada) ·
// window.__laps = n cambia las vueltas · window.__box = n vuelca la caja negra de los n primeros contactos
// window.__runs = n: n carreras seguidas en el mismo circuito (mundos nuevos con semillas distintas) y resumen agregado
(() => {
  __app.paused = true;
  const run = w => {
  const tr = w.track, N = tr.N, T = +(window.__T || 2400), L = tr.L;
  window.__laps && (w.laps = +window.__laps);
  const B = window.__boost;
  if (B) { const c = w.cars.find(c => c.code === B.code); c && (B.q && (c.setup.q = (c.setup.q || 1) * B.q), B.p && (c.perf.p *= B.p)) }
  const pitDur = [], WT = window.__watch || null, watch = [], runIx = (window.__runIx = (window.__runIx == null ? -1 : window.__runIx) + 1);
  const ev = [], rows = new Map, wall0 = performance.now(), hits = [], atkLog = [], passes = [], spins = [], NB = +(window.__box || 0), NS = +(window.__sbox || 0);
  let evId = w.events.length ? w.events[0].id : 0, steps = 0;
  /* la frenada más fuerte del circuito: el punto donde vref cae más en 150 m */
  let iB = 0, drop = 0;
  for (let i = 0; i < N; i++) { const j = (i + Math.round(150 / tr.ds)) % N, d = tr.vref[i] - tr.vref[j]; d > drop && (drop = d, iB = i) }
  let iA = iB; for (let q = 0; q < Math.round(260 / tr.ds); q++) { const j = (iB + q) % N; tr.vref[j] < tr.vref[iA] && (iA = j) }
  const sB = iB * tr.ds, sA = iA * tr.ds, rel = s => ((s - sB) % L + L) % L, f1 = x => +x.toFixed(1), f2 = x => +x.toFixed(2);
  for (const c of w.cars) rows.set(c.id, { code: c.code, drv: c.drv, team: c.team, grid: c.grid, laps: [], mist: { lock: 0, wide: 0, snap: 0 }, mistPress: 0, pm: null, pl: 0, brk: [], apex: [], apexLat: [], on: 0, lastS: 0, atkT: 0, defT: 0, pas: 0, pasG: 0, sufr: 0, crash: 0, spin: 0, hit: 0, stops: [], pushSum: 0, pushN: 0, atkSum: 0, cleanT: 0, busyT: 0, lineOff: 0, lineN: 0, thrFull: 0, thrN: 0, as: 0, cur: null, buf: [], T: {}, e: [0, 0, 0, 0], top: [0, 0], bat: 0, pin: null });
  const oh = w.onHit;
  w.onHit = (a, b, imp, x, y) => {
    const ra = rows.get(a.id), rb = rows.get(b.id);
    ra && ra.hit++, rb && rb.hit++;
    hits.push({ t: f1(w.t), a: a.code, b: b.code, imp: f1(imp), s: Math.round(a.s), k: f1(1 / Math.max(1e-4, Math.abs(tr.k[a.idx]))), ua: Math.round(a.u * 3.6), ub: Math.round(b.u * 3.6), la: f1(a.lat), lb: f1(b.lat),
      atkA: a.atkSide | 0, atkB: b.atkSide | 0, calm: (a.calm ? 1 : 0) + (b.calm ? 1 : 0), box: hits.length < NB ? (() => { const ld = a.prog > b.prog ? a : b, x = ld.ahead, rx = x && rows.get(x.id); return { a: ra && ra.buf.slice(-18), b: rb && rb.buf.slice(-18), x: rx ? rx.buf.slice(-18) : void 0, xc: x ? x.code + " a " + Math.round(ld.aheadD) + " m de " + ld.code : "" } })() : void 0 });
    oh && oh(a, b, imp, x, y)
  };
  const slowOrHurt = o => o.u < .55 * tr.vref[o.idx] || o.dmg.fw + o.dmg.susp > .35 || o.tire.punct >= 0 || o.mist || o.spinning || o.fail || (o.surf | 0) === 2;
  while (steps < 60 * T && !w.over) {
    Sim.raceStep(w), steps++;
    /* window.__watch = {code, t0, t1, n}: traza fina de un coche entre dos instantes (cada n pasos de 1/60 s) */
    if (WT && w.t >= WT.t0 && w.t <= WT.t1 && steps % (WT.n || 3) === 0 && (WT.run == null || WT.run === runIx)) { const c = w.cars.find(c => c.code === WT.code); c && watch.push([f2(w.t), Math.round(c.s), f2(c.lat), f2(tr.rl[c.idx]), f1(c.u * 3.6), c.tsD != null ? f1(c.tsD * 3.6) : null, c.vCap != null && c.vCap < 199 ? f1(c.vCap * 3.6) : null, f2(c.thr), f2(c.brk), f2(c.steer), f2(c.beta), f2(c.r), f1((c.axF || 0) / 9.81), f1(c.u * c.r / 9.81), c.surf | 0, c.aiMode | 0, f2(c.absW || 0), c.offS != null ? f2(c.offS) : null, f2(c.muEst), f2(c.mu || 0), f1(tr.vref[c.idx] * 3.6), c.ahead ? c.ahead.code + Math.round(c.aheadD) : "", (c.lockF ? "bF" : "") + (c.lockR ? "bR" : "") + (c.mist ? "E:" + c.mist.type : "") + (c.reflex ? "s" : "") + (c.calm ? "c" : "") + (c.atkSide ? "A" : "") + (c.laneM ? "L" : "") + (c.laneW ? "w" : "")]) }
    const fresh = [];
    for (const e of w.events) { if (e.id <= evId) break; fresh.push(e) }
    if (fresh.length) {
      evId = fresh[0].id;
      for (let k = fresh.length - 1; k >= 0; k--) {
        const e = fresh[k], r = e.car && rows.get(e.car.id);
        ev.push([f1(e.t), e.lap, e.kind, e.txt]);
        if (!r) continue;
        if (e.kind === "pass") {
          const o = e.data && e.data.other, c = e.car, g = o && !slowOrHurt(o) && !o.inPit && !o.justPit && !c.justPit;
          r.pas++, g && r.pasG++, o && rows.get(o.id) && rows.get(o.id).sufr++;
          passes.push({ t: f1(e.t), v: e.lap, c: c.code, o: o ? o.code : "?", real: g ? 1 : 0, s: Math.round(c.s), r: Math.round(1 / Math.max(1e-4, Math.abs(tr.k[c.idx]))), u: Math.round(c.u * 3.6), du: o ? Math.round((c.u - o.u) * 3.6) : 0, brk: f1(c.brk), thr: f1(c.thr), ins: e.data && e.data.inside ? 1 : 0, ayuda: e.data && e.data.drs ? 1 : 0, gomas: o ? c.tire.c + Math.round(Math.max(c.tire.wf, c.tire.wr) * 100) + "/" + o.tire.c + Math.round(Math.max(o.tire.wf, o.tire.wr) * 100) : "" })
        }
        e.kind === "crash" && r.crash++, e.kind === "spin" && r.spin++;
        if (e.kind === "spin") {
          const c = e.car, tt = c.tire, lastHit = hits.filter(h => h.a === c.code || h.b === c.code).pop();
          spins.push({ t: f1(e.t), v: e.lap, c: c.code, s: Math.round(c.s), radio: Math.round(1 / Math.max(1e-4, Math.abs(tr.k[c.idx]))), kmh: Math.round(Math.hypot(c.vx || 0, c.vy || 0) * 3.6) || Math.round(c.u * 3.6), vref: Math.round(tr.vref[c.idx] * 3.6),
            gas: f1(c.thr), freno: f1(c.brk), lat: f1(c.lat), rl: f1(tr.rl[c.idx]), HW: f1(Sim.HW), sup: c.surf | 0, sucio: f2(c.dirty || 0), goma: tt.c + Math.round(Math.max(tt.wf, tt.wr) * 100), T: Math.round(tt.tf) + "/" + Math.round(tt.tr), grano: f2(tt.grain || 0), pinch: tt.punct >= 0 ? 1 : 0,
            dmg: f2(c.dmg.fw + c.dmg.susp + c.dmg.floor), err: c.mist ? c.mist.type : r.pm ? r.pm.type : "", errHace: c.mistT != null ? f1(e.t - c.mistT) : null, golpeHace: lastHit ? f1(e.t - lastHit.t) : null, modo: c.aiMode | 0, atk: c.atkSide | 0, delante: c.ahead ? Math.round(c.aheadD) : -1, detras: c.behind ? Math.round(c.behindD) : -1,
            salidaBox: c.justPit ? 1 : 0, vueltasGoma: tt.laps != null ? tt.laps : null, push: f2(c.push), amarilla: c.underYellow ? 1 : 0, sc: w.sc && w.sc.on ? 1 : 0, caja: spins.length < NS ? r.buf.slice(-12) : void 0 })
        }
        e.kind === "pit" && r.stops.push([e.lap, e.data ? e.data.tire : "?", e.data ? e.data.why : "?"]);
      }
    }
    if (!w.started) continue;
    for (const c of w.cars) {
      const r = rows.get(c.id);
      if (c.retired || c.gone) continue;
      c.inPit && r.pin == null ? r.pin = w.t : !c.inPit && r.pin != null && (pitDur.push(+(w.t - r.pin).toFixed(1)), r.pin = null);
      steps % 10 === 0 && (r.buf.push([f1(w.t), Math.round(c.s), f1(c.lat), Math.round(c.u * 3.6), f2(c.steerS || 0), f1(c.thr), f1(c.brk), c.atkSide | 0, c.aiMode | 0, c.ahead ? Math.round(c.aheadD) : -1, c.reflex | 0, f1(c.intent != null ? c.intent : 0), f2(c.beta || 0), f2(c.r || 0), c.surf | 0, Math.round(tr.vref[c.idx] * 3.6), c.vCap < 150 ? Math.round(c.vCap * 3.6) : -1,
        (c.nbN ? "-" + c.nbN.code : "") + (c.nbP ? "+" + c.nbP.code : ""), c.tsD != null ? Math.round(c.tsD * 3.6) : -1, f1(c.offS || 0),
        (c.underYellow ? "A" : "") + (c.hitT != null && w.t - c.hitT < 1.1 ? "g" : "") + (c.save ? "s" : "") + (c.err ? "e" : "") + (c.mist ? "m" : "") + (c.yieldT != null && w.t - c.yieldT < .2 ? "c" : "") + (c.lateBrk ? "t" : "") + (c.blue ? "b" : "") + (c.defLat != null ? "d" : "") + ((c.usat || 0) > .5 ? "u" : "") + (c.hz ? "p" : "") + (c.hurtA ? "h" : "") + (c.tire.punct >= 0 ? "P" : "") + (c.laneM ? "L" : "")]), c.save = 0, r.buf.length > 24 && r.buf.shift());
      if (c.laps > r.pl) { r.pl = c.laps; r.laps.push([c.laps, +c.lastLap.toFixed(2), w.order.indexOf(c) + 1, c.tire.c, f2(Math.max(c.tire.wf, c.tire.wr))]) }
      if (c.mist && c.mist !== r.pm) { r.mist[c.mist.type]++; (c.aheadD < 25 || c.behindD < 20) && r.mistPress++ }
      r.pm = c.mist || null;
      if (c.inPit || c.finished) continue;
      /* ataques: inicio y final, con el motivo que deja el simulador en car.atkEnd */
      const as = c.atkSide | 0;
      if (as && !r.as) { const o = c.atkTgt; r.cur = { t: f1(w.t), v: Math.max(0, Sim.lapOf(w, c)) + 1, c: c.code, o: o ? o.code : "?", s: Math.round(c.s), d0: f1(c.aheadD), adv: f1((c.advS || 0) * 3.6), gB: f1(c.gB || 0), zona: tr.bzD ? Math.round(tr.bzD[c.idx]) : -1, dv: o ? f1((c.u - o.u) * 3.6) : 0, u: Math.round(c.u * 3.6), dentro: as === (Math.sign(tr.k[(c.idx + Math.round(110 / tr.ds)) % N]) || 1) ? 1 : 0, ayuda: c.drs || c.mom ? 1 : 0, tgt: o, p0: o ? c.prog - o.prog : 0 }; c.atkEnd = "" }
      else if (!as && r.as && r.cur) { const q = r.cur, o = q.tgt; q.dur = f1(w.t - q.t), q.d1 = o && o.s != null ? f1((((o.s - c.s) % L + L + L / 2) % L) - L / 2) : 0, q.adv1 = f1((c.advS || 0) * 3.6), q.fin = c.atkEnd || (o && c.prog > o.prog ? "pasado" : "otro"), q.gana = o && c.prog > o.prog ? 1 : 0, q.s1 = Math.round(c.s), delete q.tgt, delete q.p0, atkLog.push(q), r.cur = null }
      r.as = as;
      r.pushSum += c.push, r.atkSum += c.attack, r.pushN++;
      if (c.u > 20 && !(w.sc && w.sc.on) && !(w.vsc > 0)) { const q = r.T[c.tire.c] || (r.T[c.tire.c] = [0, 0, 0, 1e3, 0]); q[0] += c.tire.tf, q[1] += c.tire.tr, q[2]++, q[3] = Math.min(q[3], c.tire.tf), q[4] = Math.max(q[4], c.tire.tr) }
      c.aiMode === 0 ? r.cleanT++ : r.busyT++;
      { const m = c.aiMode ? 1 : 0; c.thr > .9 && c.u > 30 && (r.e[m * 2 + 1]++, (c.ersOn || c.ers) && r.e[m * 2]++), c.u > r.top[m] && (r.top[m] = c.u), r.bat += c.batt }
      as && r.atkT++, c.defLat != null && r.defT++;
      c.aiMode === 0 && (r.lineOff += Math.abs(c.lat - tr.rl[c.idx]), r.lineN++);
      c.u > 20 && (r.thrN++, c.thr > .98 && r.thrFull++);
      /* punto de frenada en la frenada más fuerte, solo en vuelta limpia: distancia al vértice al pisar el freno a más de la mitad */
      const d = rel(c.s), zone = d < rel(sA) + 20;
      if (zone && c.aiMode === 0) {
        !r.on && c.brk > .5 && d > 5 && (r.on = 1, r.brk.push(f1(rel(sA) - d)));
        if (r.lastS < rel(sA) && d >= rel(sA) && d - r.lastS < 20) r.apex.push(f1(c.u * 3.6)), r.apexLat.push(f2(c.lat));
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
      adel: r.pas, adelReal: r.pasG, sufr: r.sufr, ataqueS: f(r.atkT / 60, 0), defS: f(r.defT / 60, 0), errores: r.mist.lock + "/" + r.mist.wide + "/" + r.mist.snap, errPres: r.mistPress, choques: r.crash, trompos: r.spin, toques: r.hit,
      paradas: r.stops.map(s => "v" + s[0] + s[1] + (s[2] ? "(" + s[2] + ")" : "")).join(" "), push: f(r.pushSum / Math.max(1, r.pushN), 2), atk: f(r.atkSum / Math.max(1, r.pushN), 2),
      frenada: f(mean(r.brk), 1), frenN: r.brk.length, vApex: f(mean(r.apex), 1), latApex: f(mean(r.apexLat), 2), limpio: f(r.cleanT / Math.max(1, r.cleanT + r.busyT), 2), fuera: f(r.lineOff / Math.max(1, r.lineN), 2), gasFondo: f(r.thrFull / Math.max(1, r.thrN), 3),
      ers: [f(r.e[0] / Math.max(1, r.e[1]), 2), f(r.e[2] / Math.max(1, r.e[3]), 2)], vmax: [Math.round(r.top[0] * 3.6), Math.round(r.top[1] * 3.6)], bat: f(r.bat / Math.max(1, r.pushN), 2),
      temp: Object.keys(r.T).map(k => k + ":" + Math.round(r.T[k][0] / r.T[k][2]) + "/" + Math.round(r.T[k][1] / r.T[k][2])).join(" "),
      dmg: [f(c.dmg.fw, 2), f(c.dmg.susp, 2), f(c.dmg.floor, 2)],
      vt: r.laps.map(l => l[1]), vp: r.laps.map(l => l[2]), vg: r.laps.map(l => l[3] + Math.round(l[4] * 100)) });
  }
  const kinds = {}; for (const e of ev) kinds[e[2]] = (kinds[e[2]] || 0) + 1;
  const fin = {}; for (const a of atkLog) fin[a.fin] = (fin[a.fin] || 0) + 1;
  /* choques en cadena: tres o más coches distintos con contacto en 10 s */
  let cadena = 0; for (let i = 0; i < hits.length; i++) { const set = new Set; for (let j = i; j < hits.length && hits[j].t - hits[i].t < 10; j++) set.add(hits[j].a), set.add(hits[j].b); set.size >= 4 && cadena++ }
  const incs = []; for (const h of hits) { const q = incs.find(q => h.t - q.t1 < 4 && (q.cars.has(h.a) || q.cars.has(h.b))); q ? (q.t1 = h.t, q.cars.add(h.a), q.cars.add(h.b), q.imp = Math.max(q.imp, h.imp), q.n++) : incs.push({ t0: h.t, t1: h.t, s: h.s, cars: new Set([h.a, h.b]), imp: h.imp, n: 1 }) }
  const incOut = incs.map(q => ({ t: q.t0, s: q.s, coches: [...q.cars].join("+"), imp: q.imp, golpes: q.n }));
  /* causa de cada trompo */
  const cause = q => q.pinch ? "pinchazo" : q.golpeHace != null && q.golpeHace < 4 ? "golpe" : q.dmg > .35 ? "daños" : q.sup === 2 || q.sucio > .3 ? "sucio" : q.err ? "error:" + q.err : q.amarilla || q.sc ? "neutralizada" : q.salidaBox ? "salidaBox" : "solo";
  const spinC = {}; for (const q of spins) { q.causa = cause(q); spinC[q.causa] = (spinC[q.causa] || 0) + 1 }
  const lap1 = passes.filter(p => p.v <= 1).length, real = passes.filter(p => p.real && p.v > 1);
  return { circuito: tr.key, HW: Sim.HW, vueltas: w.laps, t: Math.round(w.t), over: !!w.over, muroS: Math.round((performance.now() - wall0) / 1e3), frenadaEn: Math.round(sB), verticeEn: Math.round(sA), vrefApex: f(tr.vref[iA] * 3.6, 0),
    resumen: { adelantamientos: passes.length, enVuelta1: lap1, realesTrasV1: real.length, realesPorVuelta: f(real.length / Math.max(1, w.laps - 1), 2), contactos: hits.length, incidentes: incs.length, incidentesFuertes: incs.filter(q => q.imp > 6).length, trompos: spins.length, tromposCausa: spinC, contactosFuertes: hits.filter(h => h.imp > 6).length, cadena, ataques: atkLog.length, ataquesGanados: atkLog.filter(a => a.gana).length, finAtaque: fin,
      abandonos: ord.filter(c => c.retired).length, calleMedida: pitDur.length ? f(pitDur.slice().sort((a, b) => a - b)[pitDur.length >> 1], 1) : null, calleModelo: w.strat ? f(w.strat.tLane + 2.5, 1) : null, pistaModelo: w.strat ? f(w.strat.tTrack, 1) : null, vueltasDeParada: out.map(p => p.paradas.replace(/\([^)]*\)/g, "")).join(",") },
    eventos: kinds, atk: w.atkStats, watch: watch.length ? watch : void 0, pilotos: out, pases: passes.slice(0, 60), ataques: atkLog.slice(0, +(window.__natk || 30)), golpes: hits.slice(0, 40), incidentes: incOut.slice(0, 40), trompos: spins.slice(0, 40),
    ev: window.__ev ? ev : ev.filter(e => /crash|spin|dnf|sc|vsc|pen|fail/.test(e[2])).slice(0, 60) }
  };
  const w0 = __app.w, n = +(window.__runs || 0);
  if (!n) return run(w0);
  /* varias carreras: misma parrilla, semillas distintas */
  const entries = w0.cars.map(c => ({ genome: c.genome, name: c.name, code: c.code, team: c.team, num: c.num, drv: c.drv })), outs = [];
  for (let k = 0; k < n; k++) {
    const w = Sim.newWorld(w0.track, {});
    Sim.raceSetup(w, entries, { laps: +(window.__laps || w0.laps), wearMul: w0.wearMul, weather: window.__weather || "seco", collide: true, vsc: true, penalties: true, failures: true, failMul: 1, seed: 1000 + 37 * k + (+(window.__seed0 || 0)) });
    const r = run(w);
    outs.push(r)
  }
  const R = outs.map(o => o.resumen), avg = k => +(R.reduce((s, r) => s + (r[k] || 0), 0) / R.length).toFixed(2), fin = {};
  for (const r of R) for (const k in r.finAtaque) fin[k] = (fin[k] || 0) + r.finAtaque[k];
  const P1 = outs.map(o => o.pilotos[0].media).filter(Boolean), P5 = outs.map(o => o.pilotos[4].media).filter(Boolean), P10 = outs.map(o => o.pilotos[9].media).filter(Boolean), m = a => a.length ? +(a.reduce((s, x) => s + x, 0) / a.length).toFixed(2) : null;
  const first = outs[0];
  first.multi = { carreras: n, adelantamientos: avg("adelantamientos"), realesTrasV1: avg("realesTrasV1"), realesPorVuelta: avg("realesPorVuelta"), contactos: avg("contactos"), incidentes: avg("incidentes"), incidentesFuertes: avg("incidentesFuertes"), trompos: avg("trompos"), tromposCausa: (() => { const o = {}; for (const r of R) for (const k in r.tromposCausa) o[k] = (o[k] || 0) + r.tromposCausa[k]; return o })(), contactosFuertes: avg("contactosFuertes"), cadena: avg("cadena"), ataques: avg("ataques"), ataquesGanados: avg("ataquesGanados"), abandonos: avg("abandonos"), finAtaque: fin, ritmoP1: m(P1), ritmoP5: m(P5), ritmoP10: m(P10),
    ganadores: outs.map(o => o.pilotos[0].code + "(p" + o.pilotos[0].parr + ")").join(" "), eventos: outs.map(o => Object.entries(o.eventos).filter(([k]) => /sc|vsc|dnf|spin|mist|under|strat|off|pen/.test(k)).map(([k, v]) => k + v).join(",")).join(" | "),
    paradas: outs.map(o => o.resumen.vueltasDeParada).join(" || ") };
  return first
})()
