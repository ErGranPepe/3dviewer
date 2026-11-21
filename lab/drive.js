/* ===================== PESTAÑA TRANSMISIÓN Y ERS ===================== */
LAB.drive = (() => {
  const DM = () => LAB.drivemodel;
  const DEF = [
    { title: "Reglamento y circuito", open: !0, help: "2026: sin MGU-H, MGU-K de 350 kW que se recorta de 290 a 355 km/h, 8,5 MJ de recuperación por vuelta y aerodinámica activa en recta. 2014-2025: MGU-K de 120 kW, 2 MJ de recuperación y 4 MJ de despliegue por vuelta desde la batería, y MGU-H sin límite en el turbo.", items: [
      { id: "era", label: "Reglamento", v: "2026", opts: [["2026", "2026 (350 kW eléctricos, sin MGU-H)"], ["2025", "2014-2025 (120 kW + MGU-H)"]] },
      { id: "track", label: "Circuito", v: "11", opts: (window.REAL_TRACKS ? Object.keys(window.REAL_TRACKS).map(k => [k, window.REAL_TRACKS[k].name]) : []).concat([["monza", "Monza (simplificado)"], ["monaco", "Mónaco (simplificado)"], ["silverstone", "Silverstone (simplificado)"]]) },
      { id: "strat", label: "Estrategia de energía", v: "att", opts: [["att", "Ataque (todo el despliegue)"], ["bal", "Equilibrada (recorta en recta)"], ["save", "Ahorro"]] },
      { id: "override", label: "Modo adelantamiento (2026)", v: "0", opts: [["0", "No"], ["1", "Sí: 350 kW hasta 337 km/h"]] },
      { id: "activeAero", label: "Aerodinámica activa en recta (2026)", v: "1", opts: [["1", "Sí (−28 % de resistencia)"], ["0", "No"]] }
    ] },
    { title: "Unidad de potencia y batería", items: [
      { id: "pice", label: "Potencia del motor térmico", unit: "kW", min: 300, max: 650, step: 5, v: 400, help: "Limitada por el flujo de energía del combustible: casi constante en la zona alta de régimen." },
      { id: "tmax", label: "Par máximo del térmico", unit: "N·m", min: 250, max: 700, step: 5, v: 440, adv: !0 },
      { id: "kmax", label: "Potencia máxima del MGU-K", unit: "kW", min: 0, max: 400, step: 5, v: 350 },
      { id: "rec", label: "Recuperación máxima por vuelta", unit: "MJ", min: 0, max: 12, step: .1, v: 8.5 },
      { id: "dep", label: "Despliegue máximo desde batería (hasta 2025)", unit: "MJ", min: 0, max: 8, step: .1, v: 4, adv: !0 },
      { id: "hmax", label: "Potencia del MGU-H (hasta 2025)", unit: "kW", min: 0, max: 150, step: 5, v: 90, adv: !0 },
      { id: "socwin", label: "Ventana de carga de la batería", unit: "MJ", min: 1, max: 8, step: .1, v: 4 },
      { id: "soc0", label: "Carga al salir", unit: "MJ", min: 0, max: 8, step: .1, v: 2, adv: !0 },
      { id: "clipKmh", label: "Recorte para cargar a partir de", unit: "km/h", min: 200, max: 360, step: 5, v: 300, help: "En 2026, al final de las rectas parte de la potencia del térmico se desvía a cargar la batería (superclipping)." },
      { id: "clipKw", label: "Potencia desviada al recortar", unit: "kW", min: 0, max: 350, step: 5, v: 120 },
      { id: "rearB", label: "Parte de la frenada en el eje trasero", unit: "", min: .3, max: .6, step: .01, v: .45, adv: !0 }
    ] },
    { title: "Coche", items: [
      { id: "mass", label: "Masa con piloto", unit: "kg", min: 700, max: 900, step: 1, v: 768 },
      { id: "cla", label: "Carga aerodinámica (ClA)", unit: "m²", min: 1.5, max: 6, step: .05, v: 3.8 },
      { id: "cda", label: "Resistencia (CdA)", unit: "m²", min: .6, max: 1.6, step: .01, v: 1.13, help: "Con el alerón de cada circuito: en Monza menos, en Mónaco más." },
      { id: "mu", label: "Adherencia lateral", unit: "μ", min: 1, max: 2.4, step: .01, v: 1.75 },
      { id: "mub", label: "Adherencia en frenada", unit: "μ", min: 1, max: 2.4, step: .01, v: 1.85, adv: !0 },
      { id: "mut", label: "Adherencia en tracción", unit: "μ", min: 1, max: 2.4, step: .01, v: 1.7, adv: !0 },
      { id: "rearW", label: "Peso en el eje trasero", unit: "", min: .4, max: .65, step: .01, v: .55, adv: !0 },
      { id: "hcg", label: "Altura del centro de gravedad", unit: "m", min: .2, max: .4, step: .005, v: .28, adv: !0 },
      { id: "crr", label: "Rodadura", unit: "", min: .005, max: .03, step: .001, v: .012, adv: !0 },
      { id: "etaD", label: "Rendimiento de la transmisión", unit: "", min: .85, max: .99, step: .005, v: .94, adv: !0 },
      { id: "rt", label: "Radio del neumático trasero", unit: "m", min: .33, max: .38, step: .001, v: .36, adv: !0 }
    ] },
    { title: "Caja de cambios", help: "Relaciones de la caja (eje primario a secundario); la cónica multiplica después. El cambio es sin interrupción: dos marchas engranadas unos milisegundos y el motor obligado a bajar de vueltas, con corte de encendido para suavizarlo.", items: [
      ...[3.82, 3.12, 2.65, 2.29, 2.0, 1.76, 1.56, 1.38].map((v, i) => ({ id: "g" + (i + 1), label: `${i + 1}ª`, unit: ":1", min: .8, max: 4.5, step: .01, v, adv: i > 0 && i < 7 })),
      { id: "fd", label: "Grupo cónico", unit: ":1", min: 2.5, max: 4.5, step: .01, v: 3.4 },
      { id: "rpmShift", label: "Cambio a", unit: "rpm", min: 9000, max: 15000, step: 50, v: 11800 },
      { id: "tshift", label: "Duración del cambio", unit: "ms", min: 2, max: 60, step: 1, v: 10 },
      { id: "cut", label: "Corte de encendido al subir", unit: "", min: 0, max: 1, step: .05, v: .9, help: "Reduce el par del motor durante el cambio para que baje de vueltas sin golpear la transmisión." },
      { id: "blip", label: "Golpe de gas al bajar", unit: "", min: 0, max: 1, step: .05, v: .9, adv: !0, help: "El motor sube de vueltas solo antes de engranar la marcha inferior; sin él, la transmisión arrastra el motor y la rueda trasera se bloquea un instante." },
      { id: "module", label: "Módulo de los dientes", unit: "mm", min: 2, max: 4, step: .05, v: 3, adv: !0 },
      { id: "face", label: "Ancho de dentado", unit: "mm", min: 8, max: 30, step: .5, v: 18 },
      { id: "center", label: "Distancia entre ejes", unit: "mm", min: 70, max: 120, step: 1, v: 90, adv: !0 },
      { id: "sbLim", label: "Resistencia a flexión (10⁷ ciclos)", unit: "MPa", min: 600, max: 1800, step: 10, v: 1100, adv: !0 },
      { id: "shLim", label: "Resistencia a picado (10⁸ ciclos)", unit: "MPa", min: 1200, max: 2600, step: 10, v: 1750, adv: !0 }
    ] },
    { title: "Palieres y diferencial", help: "Los palieres son muelles de torsión: con la inercia del motor forman el modo de «shunt» (entre 5 y 30 Hz según la marcha). El diferencial hidráulico bloquea con una precarga más una parte del par de entrada, distinta en tracción y en retención.", items: [
      { id: "kds", label: "Rigidez torsional de cada palier", unit: "N·m/rad", min: 2000, max: 30000, step: 100, v: 9000 },
      { id: "ie", label: "Inercia del motor y la caja", unit: "kg·m²", min: .02, max: .15, step: .001, v: .055, adv: !0 },
      { id: "iw", label: "Inercia de cada rueda", unit: "kg·m²", min: .6, max: 2, step: .05, v: 1.25, adv: !0 },
      { id: "cslip", label: "Rigidez de deslizamiento (eje)", unit: "N", min: 1e5, max: 8e5, step: 1e4, v: 3.2e5, adv: !0 },
      { id: "zds", label: "Amortiguamiento de la línea", unit: "ζ", min: 0, max: .4, step: .01, v: .06, adv: !0 },
      { id: "tw", label: "Vía trasera", unit: "m", min: 1.4, max: 1.7, step: .01, v: 1.55, adv: !0 },
      { id: "pre", label: "Precarga del diferencial", unit: "N·m", min: 0, max: 600, step: 10, v: 150 },
      { id: "kpow", label: "Bloqueo en tracción", unit: "× par", min: 0, max: 1, step: .01, v: .35 },
      { id: "kcoast", label: "Bloqueo en retención", unit: "× par", min: 0, max: 1, step: .01, v: .25 }
    ] }
  ];
  const ERA = { "2026": { pice: 400, tmax: 440, kmax: 350, rec: 8.5, mass: 768, cla: 3.8, cda: 1.13 }, "2025": { pice: 560, tmax: 520, kmax: 120, rec: 2, mass: 800, cla: 4.2, cda: 1.25 } };
  const PRESETS = {
    m26: { name: "2026 en Monza", v: { era: "2026", track: "11", ...ERA["2026"] } },
    m25: { name: "2025 en Monza", v: { era: "2025", track: "11", ...ERA["2025"] } },
    mc: { name: "2026 en Mónaco", v: { era: "2026", track: "16", ...ERA["2026"], cla: 4.4, cda: 1.25 } },
    open: { name: "Diferencial abierto", v: { pre: 0, kpow: 0, kcoast: 0 } },
    locked: { name: "Diferencial muy bloqueado", v: { pre: 500, kpow: .8, kcoast: .7 } },
    rough: { name: "Cambio brusco (sin corte ni golpe de gas)", v: { cut: 0, blip: 0, tshift: 4 } }
  };
  let prm, ro, host, res = null, plots = {}, use3d = !1, play = { t: 0, on: !0, speed: 1 }, lastEra = "2026";
  const P = () => ({ ...prm.v, override: +prm.v.override, activeAero: +prm.v.activeAero, nb: 1e7, kb: 8, nh: 1e8, kh: 12 });
  function compute() {
    const p = P();
    res = DM().run(p), res.p = p;
    const L = res.Lp, E = L.E, D = res.D, G = res.Gs, Df = res.Df;
    play.t = Math.min(play.t, L.lapT);
    const worst = D.shifts.reduce((a, s) => s.shock > (a ? a.shock : -1) ? s : a, null), life = G.filter(g => g.time > .2).reduce((a, g) => g.lifeKm < a.lifeKm ? g : a, { lifeKm: 1e9, g: 0 });
    res.worst = worst;
    const lt = L.lapT, mm = Math.floor(lt / 60);
    const TG = DM().trackGrid(p.track), fl = t => `${Math.floor(t / 60)}:${(t - Math.floor(t / 60) * 60).toFixed(2).padStart(5, "0")}`;
    ro.set("real", TG.real ? `${fl(TG.real.pole.t)} ${TG.real.pole.drv} ${TG.real.pole.year}` : "—");
    const SL = simLap();
    ro.set("simlap", SL && TG.real && SL.key === TG.real.key ? `${fl(SL.lap)} ${SL.code} (${SL.reg})` : "corre aquí en el simulador");
    ro.set("lap", `${mm}:${(lt - mm * 60).toFixed(2).padStart(5, "0")}`), ro.set("gain", res.ersGain, 2), ro.set("vmax", L.vmax * 3.6, 0);
    ro.set("recK", (E.recK - E.clip) / 1e6, 2), ro.set("clip", E.clip / 1e6, 2), ro.set("recH", E.recH / 1e6, 2), ro.set("dep", E.dep / 1e6, 2), ro.set("brk", E.brakeE / 1e6, 1);
    ro.set("shifts", E.shifts, 0), ro.set("fuel", E.fuel, 2), ro.set("tpk", D.peak / 1e3, 2, D.peak > 9e3 ? "bad" : D.peak > 6e3 ? "warn" : "ok"), ro.set("shock", worst ? worst.shock / 1e3 : NaN, 2, worst && worst.shock > 4e3 ? "bad" : worst && worst.shock > 2.5e3 ? "warn" : "ok");
    ro.set("fn", `${D.fn[0].toFixed(0)}–${D.fn[7].toFixed(0)}`), ro.set("life", life.lifeKm >= 1e6 ? "∞" : Math.round(life.lifeKm).toLocaleString("es-ES"), 0, life.lifeKm < 3000 ? "bad" : life.lifeKm < 6000 ? "warn" : "ok"), ro.set("lifeG", life.lifeKm < 1e9 ? `${life.g + 1}ª` : "—");
    ro.set("mzE", Df.mzEntry, 0), ro.set("mzX", Df.mzExit, 0), ro.set("spin", Df.spinPct, 1, Df.spinPct > 3 ? "bad" : Df.spinPct > 1 ? "warn" : "ok");
    drawPlots(), gearTable(), verdict()
  }
  function drawPlots() {
    const L = res.Lp, n = L.n, x = new Float32Array(n), sp = new Float32Array(n), gr = new Float32Array(n), rpm = new Float32Array(n), soc = new Float32Array(n), pk = new Float32Array(n), pi = new Float32Array(n), ph = new Float32Array(n);
    for (let i = 0; i < n; i++) x[i] = i / 1e3, sp[i] = L.v[i] * 3.6, gr[i] = (L.gear[i] + 1) * 40, rpm[i] = L.rpm[i], soc[i] = L.soc[i] / 1e6, pk[i] = L.Pk[i] / 1e3, pi[i] = L.Pice[i] / 1e3, ph[i] = L.Ph[i] / 1e3;
    const cur = play.d != null ? [{ x: play.d / 1e3, col: "rgba(255,255,255,.55)" }] : [];
    const G = DM().trackGrid(res.p.track), ref = G.real && G.real.ref, ser = [{ x, y: sp, n, col: "#ff6b1a", label: "Modelo km/h" }, { x, y: gr, n, col: "#3d8bff", label: "Marcha ×40" }];
    if (ref) { const m = ref.f.length, rx = new Float32Array(m), rv = new Float32Array(m); for (let i = 0; i < m; i++) rx[i] = ref.f[i] * n / 1e3, rv[i] = ref.v[i]; ser.splice(1, 0, { x: rx, y: rv, n: m, col: "rgba(255,255,255,.55)", label: `Real ${G.real.pole.year} (${G.real.pole.drv})` }) }
    /* la mejor vuelta hecha en el simulador en este mismo circuito (se guarda al terminar cada vuelta rápida) */
    const SL = simLap();
    if (SL && G.real && SL.key === G.real.key) { const m = SL.v.length, sx = Float32Array.from(SL.v, (_, i) => i * SL.d / 1e3), sv = Float32Array.from(SL.v); ser.push({ x: sx, y: sv, n: m, col: "#b45cff", label: `Simulador ${SL.code} ${SL.reg}` }) }
    plots.sp.draw(ser, { title: `Vuelta en ${L.name}`, xlabel: "km", vlines: cur });
    plots.rpm.draw([{ x, y: rpm, n, col: "#ffd23f", label: "Régimen rpm" }], { title: "Motor", xlabel: "km", vlines: cur });
    plots.ers.draw([{ x, y: pi, n, col: "#8b97a4", label: "Térmico kW" }, { x, y: pk, n, col: "#7fe3ff", label: "MGU-K kW (− carga)" }, ...(res.p.era !== "2026" ? [{ x, y: ph, n, col: "#b45cff", label: "MGU-H kW" }] : [])], { title: "Potencias", xlabel: "km", vlines: cur });
    const SL2 = simLap(), simOk = SL2 && G.real && SL2.key === G.real.key, socS = simOk ? [{ x: Float32Array.from(SL2.e, (_, i) => i * SL2.d / 1e3), y: Float32Array.from(SL2.e, e => e * 4), n: SL2.e.length, col: "#b45cff", label: "Simulador MJ" }] : [];
    plots.soc.draw([{ x, y: soc, n, col: "#2fd16c", label: "Batería MJ", fill: "rgba(47,209,108,.12)" }, ...socS], { title: "Estado de carga", xlabel: "km", vlines: cur, hlines: [{ y: res.p.socwin, col: "rgba(255,255,255,.3)", label: "ventana" }] });
    const D = res.D, m = D.n, tt = new Float32Array(m), tq = new Float32Array(m);
    for (let q = 0; q < m; q++) tt[q] = q * D.dt, tq[q] = D.Tds[q] / 1e3;
    plots.tds.draw([{ x: tt, y: tq, n: m, col: "#ff3b3b", label: "Par en palieres kN·m" }], { title: "Línea motriz en la vuelta", xlabel: "s", vlines: play.t != null ? [{ x: play.t, col: "rgba(255,255,255,.55)" }] : [] });
    /* zoom en el peor cambio */
    const w = res.worst;
    if (w) {
      const q0 = Math.max(0, Math.floor((w.t - .05) / D.dt)), q1 = Math.min(m - 1, Math.floor((w.t + .35) / D.dt)), k = q1 - q0, zt = new Float32Array(k), zq = new Float32Array(k), zr = new Float32Array(k);
      for (let j = 0; j < k; j++) zt[j] = (q0 + j) * D.dt * 1e3 - w.t * 1e3, zq[j] = D.Tds[q0 + j] / 1e3, zr[j] = D.we[q0 + j] / 2e3;
      plots.zoom.draw([{ x: zt, y: zq, n: k, col: "#ff3b3b", label: "Palieres kN·m" }, { x: zt, y: zr, n: k, col: "#ffd23f", label: "Motor ×2000 rpm" }], { title: `Peor cambio: ${w.from + 1}ª→${w.to + 1}ª`, xlabel: "ms desde el cambio", vlines: [{ x: 0, col: "rgba(255,255,255,.35)" }] })
    }
    const Df = res.Df, tl = new Float32Array(n), tr = new Float32Array(n), mz = new Float32Array(n);
    for (let i = 0; i < n; i++) tl[i] = Df.TL[i] / 1e3, tr[i] = Df.TR[i] / 1e3, mz[i] = Df.Mz[i] / 1e3;
    plots.diff.draw([{ x, y: tl, n, col: "#ffd23f", label: "Rueda izq. kN·m" }, { x, y: tr, n, col: "#3d8bff", label: "Rueda dcha. kN·m" }], { title: "Reparto del diferencial", xlabel: "km", vlines: cur });
    plots.mz.draw([{ x, y: mz, n, col: "#b45cff", label: "Momento de guiñada kN·m (+ izq.)" }], { title: "Guiñada del diferencial", xlabel: "km", vlines: cur })
  }
  function simLap() { try { return JSON.parse(localStorage.getItem("pn3-simlap") || "null") } catch (e) { return null } }
  function gearTable() {
    const G = res.Gs, mxB = Math.max(res.p.sbLim * 1.6, ...G.map(g => g.sb)), mxH = Math.max(res.p.shLim * 1.6, ...G.map(g => g.sh));
    $("drvGears").innerHTML = `<b>Engranajes: tensión máxima en la vuelta y vida estimada</b><div class="gh"><span>Marcha</span><span>Dientes</span><span>Tiempo</span><span>Flexión en la raíz (Lewis)</span><span>Contacto (Hertz)</span><span>Vida</span></div>` + G.map(g => {
      const b = g.sb / mxB * 100, h = g.sh / mxH * 100, lb = res.p.sbLim / mxB * 100, lh = res.p.shLim / mxH * 100, lk = g.lifeKm >= 1e6 ? "∞" : Math.round(g.lifeKm).toLocaleString("es-ES") + " km";
      return `<div class="gr ${g.lifeKm < 3000 ? "bad" : g.lifeKm < 6000 ? "warn" : ""}"><span>${g.g + 1}ª</span><span>${g.z1}/${g.z2}</span><span>${g.time.toFixed(1)} s</span><span class="bar"><i style="width:${b.toFixed(0)}%"></i><u style="left:${lb.toFixed(0)}%"></u><em>${g.sb.toFixed(0)} MPa</em></span><span class="bar"><i style="width:${h.toFixed(0)}%"></i><u style="left:${lh.toFixed(0)}%"></u><em>${g.sh.toFixed(0)} MPa</em></span><span>${g.time > .05 ? lk : "sin uso"}</span></div>`
    }).join("") + `<small>La raya blanca es la resistencia a fatiga de referencia. Los picos los marcan los golpes de los cambios; la vida suma el daño de cada vuelta de diente con Miner.</small>`
  }
  function verdict() {
    const L = res.Lp, E = L.E, D = res.D, Df = res.Df, out = [], w = res.worst;
    E.socMin <= 1e3 && L.soc.filter(s => s <= 1e3).length > L.n * .25 ? out.push(["warn", "Batería", "Pasa más de un cuarto de la vuelta vacía: el MGU-K no puede ayudar. Recupera más (recorte en recta) o despliega menos."]) : out.push(["ok", "Batería", `Recuperas ${((E.recK + E.recH) / 1e6).toFixed(1)} MJ y despliegas ${(E.dep / 1e6).toFixed(1)} MJ por vuelta.`]);
    w && w.shock > 4e3 ? out.push(["bad", "Cambios", `El cambio ${w.from + 1}ª→${w.to + 1}ª golpea los palieres con ${(w.shock / 1e3).toFixed(1)} kN·m. Más corte de encendido o un cambio algo más largo.`]) : out.push(["ok", "Cambios", "Los golpes de cambio están contenidos."]);
    Df.spinPct > 1 ? out.push(["warn", "Tracción", `La rueda interior patina el ${Df.spinPct.toFixed(1)} % de la vuelta. Sube el bloqueo en tracción.`]) : out.push(["ok", "Tracción", "Ninguna rueda interior patina al salir de curva."]);
    Df.mzExit < -2500 ? out.push(["warn", "Diferencial", "Tanto bloqueo en tracción da subviraje a la salida de las curvas lentas."]) : Df.mzEntry < -900 ? out.push(["warn", "Diferencial", "El bloqueo en retención estabiliza mucho la entrada: el coche no quiere girar."]) : out.push(["ok", "Diferencial", "Equilibrio razonable entre estabilidad en la entrada y tracción en la salida."]);
    $("drvVerdict").innerHTML = out.map(([s, t, d]) => `<div class="vd ${s}"><b>${t}</b><span>${d}</span></div>`).join("")
  }
  /* estado instantáneo para la animación */
  function stateAt(t) {
    const L = res.Lp, D = res.D, p = res.p, i = DM().lowerIdx(L.t, t), q = Math.min(D.n - 1, Math.floor(t / D.dt)), box = DM().ratios(p);
    play.d = i;
    /* tambor: interpola entre marchas durante el cambio (cámara lenta) */
    const g = L.gear[i], sh = D.shifts.find(s => t >= s.t && t < s.t + p.tshift * 1e-3 * 4);
    const f = sh ? clamp((t - sh.t) / (p.tshift * 1e-3 * 4), 0, 1) : 1, barrel = sh ? sh.from + (sh.to - sh.from) * f : g;
    const R = L.R[i], v = L.v[i], dw = R ? v * p.tw / R / p.rt : 0, w0 = v / p.rt;
    const Pk = L.Pk[i], old = p.era !== "2026", Pes = old ? (Pk > 0 ? Pk - Math.min(Pk, L.Ph[i]) : Pk) - (L.Ph[i] - Math.min(Math.max(0, Pk), L.Ph[i])) : Pk;
    return { rpm: D.we[q], gear: g, gearNext: sh ? sh.to : -1, box, fd: p.fd, barrel, Tds: D.Tds[q], Tin: D.Tds[q] / Math.max(1, D.G[q]), kds: p.kds, twistEx: 12, lock: res.Df.lock[i], wL: w0 - dw / 2, wR: w0 + dw / 2, Pk, Pes, Ph: L.Ph[i], soc: L.soc[i], socwin: p.socwin * 1e6, era: p.era, rotK: .03, tscale: play.speed, v, i }
  }
  let lastT = 0, frameN = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    if (!res || host.hidden || host.closest("section").hidden) return;
    const dt = Math.min(.05, (now - (lastT || now)) / 1e3);
    lastT = now;
    play.on && (play.t = (play.t + dt * play.speed) % res.Lp.lapT);
    const s = stateAt(play.t);
    use3d && LAB.drive3d.frame(s, dt);
    if (++frameN % 6 === 0) {
      const L = res.Lp;
      $("drvInfo").innerHTML = `<b>${L.name}</b> · ${play.t.toFixed(1)} s · ${(s.v * 3.6).toFixed(0)} km/h · ${s.gear + 1}ª · ${Math.round(s.rpm).toLocaleString("es-ES")} rpm · MGU-K ${s.Pk >= 0 ? "+" : "−"}${Math.abs(s.Pk / 1e3).toFixed(0)} kW · batería ${(s.soc / 1e6).toFixed(2)} MJ · palieres ${(s.Tds / 1e3).toFixed(2)} kN·m<br><span>Giro de los engranajes ×0,03 para ver los dientes · torsión de los palieres ×12 · naranja: camino del par · cian: energía a la rueda · verde: energía recuperada</span>`;
      frameN % 18 === 0 && drawPlots()
    }
  }
  function geo() {
    const p = P(), m = p.module * 1e-3, a = p.center * 1e-3, rs = DM().ratios(p), z1 = [], z2 = [];
    for (const u of rs) { const zs = Math.round(2 * a / m), a1 = Math.max(12, Math.round(zs / (1 + u))); z1.push(a1), z2.push(zs - a1) }
    return { z1, z2, module: Math.min(m, .0034), face: p.face * 1e-3 }
  }
  function init(el0) {
    host = el0;
    host.innerHTML = `
    <div class="labhead"><div><h2>Transmisión y ERS</h2><p class="sub">Caja de 8 marchas sin interrupción de par, diferencial hidráulico, palieres en torsión y la energía eléctrica de la vuelta, con el reglamento de 2026 o el de 2014-2025.</p></div>
      <div class="presets" id="drvPre"></div></div>
    <div class="labgrid">
      <aside class="params" id="drvParams"></aside>
      <section class="views">
        <div class="vrow"><div class="s3host" id="drv3d"><div class="s3info" id="drvInfo"></div></div><div class="verdict" id="drvVerdict"></div></div>
        <div class="ctrl"><button id="drvRun" class="btn on">Pausa</button><label>Reproducción <select id="drvSpd"><option value=".02">×0,02 (ver el cambio)</option><option value=".1">×0,1</option><option value=".25">×0,25</option><option value="1" selected>×1 (tiempo real)</option><option value="4">×4</option></select></label><label>Ir a <select id="drvJump"><option value="">—</option><option value="worst">peor cambio</option><option value="brake">frenada más fuerte</option><option value="vmax">velocidad máxima</option></select></label></div>
        <div class="ctrl s3views"><span>Vista</span><button class="btn" data-dv="box">Caja</button><button class="btn" data-dv="diff">Diferencial</button><button class="btn" data-dv="ers">ERS</button><button class="btn" data-dv="all">Todo</button></div>
        <div class="readouts" id="drvRo"></div>
        <div class="pgrid"><canvas id="drvSp"></canvas><canvas id="drvErs"></canvas><canvas id="drvSoc"></canvas><canvas id="drvZoom"></canvas></div>
        <div class="geartbl" id="drvGears"></div>
        <h3 class="adv">Régimen, línea motriz y diferencial</h3>
        <div class="pgrid adv"><canvas id="drvRpm"></canvas><canvas id="drvTds"></canvas><canvas id="drvDiff"></canvas><canvas id="drvMz"></canvas></div>
      </section></div>`;
    prm = new Params($("drvParams"), DEF, id => {
      if (prm.v.era !== lastEra) { lastEra = prm.v.era, prm.set(ERA[lastEra], !0) }
      clearTimeout(init.t), init.t = setTimeout(() => { compute(), use3d && /^(g\d|module|face|center)$/.test(id) && LAB.drive3d.rebuild(geo()) }, 150)
    });
    const pre = $("drvPre");
    for (const k in PRESETS) pre.appendChild(el("button", { class: "btn", text: PRESETS[k].name, onclick: () => { prm.set(Object.fromEntries(DEF.flatMap(g => g.items.map(i => [i.id, i.v]))), !0), lastEra = PRESETS[k].v.era || "2026", prm.set(PRESETS[k].v) } }));
    ro = new Readouts($("drvRo"), [
      { id: "lap", label: "Tiempo de vuelta", unit: "min:s" }, { id: "real", label: "Pole real de referencia", unit: "min:s" }, { id: "simlap", label: "Tu vuelta en el simulador", unit: "" }, { id: "gain", label: "Lo que aporta el ERS", unit: "s/vuelta" }, { id: "vmax", label: "Velocidad punta", unit: "km/h" },
      { id: "recK", label: "Recuperado en frenada", unit: "MJ" }, { id: "clip", label: "Recuperado recortando en recta", unit: "MJ" }, { id: "recH", label: "Recuperado por el MGU-H", unit: "MJ", adv: !0 },
      { id: "dep", label: "Desplegado por el MGU-K", unit: "MJ" }, { id: "brk", label: "Energía total de frenada", unit: "MJ", adv: !0 }, { id: "fuel", label: "Combustible", unit: "kg/vuelta", adv: !0 },
      { id: "shifts", label: "Cambios por vuelta", unit: "" }, { id: "tpk", label: "Par máximo en palieres", unit: "kN·m" }, { id: "shock", label: "Golpe del peor cambio", unit: "kN·m" },
      { id: "fn", label: "Modo de shunt (8ª–1ª)", unit: "Hz", adv: !0 }, { id: "life", label: "Vida del engranaje más castigado", unit: "km" }, { id: "lifeG", label: "Marcha más castigada", unit: "" },
      { id: "mzE", label: "Guiñada del diferencial al entrar", unit: "N·m", adv: !0 }, { id: "mzX", label: "Guiñada del diferencial al salir", unit: "N·m", adv: !0 }, { id: "spin", label: "Rueda interior patinando", unit: "% vuelta" }
    ]);
    plots.sp = new Plot($("drvSp")), plots.ers = new Plot($("drvErs")), plots.soc = new Plot($("drvSoc")), plots.zoom = new Plot($("drvZoom")), plots.rpm = new Plot($("drvRpm")), plots.tds = new Plot($("drvTds")), plots.diff = new Plot($("drvDiff")), plots.mz = new Plot($("drvMz"));
    $("drvRun").onclick = () => { play.on = !play.on, $("drvRun").textContent = play.on ? "Pausa" : "Seguir", $("drvRun").classList.toggle("on", play.on) };
    $("drvSpd").onchange = e => play.speed = +e.target.value;
    $("drvJump").onchange = e => {
      const L = res.Lp, k = e.target.value;
      if (k === "worst" && res.worst) play.t = Math.max(0, res.worst.t - .03), play.speed = .02, $("drvSpd").value = ".02";
      else if (k === "brake") { let b = 0, mn = 0; for (let i = 0; i < L.n; i++) L.ax[i] < mn && (mn = L.ax[i], b = i); play.t = L.t[b] }
      else if (k === "vmax") { let b = 0; for (let i = 0; i < L.n; i++) L.v[i] > L.v[b] && (b = i); play.t = L.t[b] }
      e.target.value = ""
    };
    document.querySelectorAll("[data-dv]").forEach(b => b.onclick = () => $("drv3d").view && $("drv3d").view(b.dataset.dv));
    window.addEventListener("labmode", () => setTimeout(() => { for (const p of Object.values(plots)) p.fit(); res && drawPlots() }, 50));
    /* si en otra pestaña terminas una vuelta rápida en el simulador, aparece aquí al momento */
    window.addEventListener("storage", e => { e.key === "pn3-simlap" && res && compute() });
    compute();
    use3d = !!(LAB.drive3d && LAB.drive3d.init($("drv3d"), geo()));
    requestAnimationFrame(loop)
  }
  return { init }
})();
