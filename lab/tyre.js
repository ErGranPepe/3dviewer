/* ===================== PESTAÑA NEUMÁTICOS ===================== */
LAB.tyre = (() => {
  const TM = () => LAB.tyremodel;
  const DEF = [
    { title: "Uso", open: !0, items: [
      { id: "comp", label: "Compuesto", v: "M", opts: [["S", "Blando"], ["M", "Medio"], ["H", "Duro"], ["I", "Intermedio"], ["W", "Lluvia"]] },
      { id: "Fz", label: "Carga vertical", unit: "N", min: 1000, max: 12000, step: 50, v: 4500, help: "Estática ~2 kN por rueda; con 4–5 g de carga aerodinámica, más de 8 kN." },
      { id: "alpha", label: "Ángulo de deriva", unit: "°", min: 0, max: 12, step: .1, v: 3 },
      { id: "kappa", label: "Deslizamiento longitudinal (+ tracción, − frenada)", unit: "", min: -.25, max: .25, step: .005, v: 0 },
      { id: "gamma", label: "Caída", unit: "°", min: -5, max: 1, step: .1, v: -3 },
      { id: "v", label: "Velocidad", unit: "km/h", min: 40, max: 330, step: 5, v: 200 }
    ] },
    { title: "Presión y temperaturas", items: [
      { id: "pin", label: "Presión en frío", unit: "psi", min: 16, max: 30, step: .5, v: 22, help: "La presión sube con la temperatura del aire interior (gas ideal): de 22 psi en frío a ~26 en caliente." },
      { id: "T0", label: "Temperatura de inflado", unit: "°C", min: 10, max: 80, step: 1, v: 25, adv: !0 },
      { id: "Tstart", label: "Temperatura al salir (mantas)", unit: "°C", min: 15, max: 90, step: 1, v: 70, help: "Las mantas calientan a ~70 °C; desde 2025 la FIA las limita." },
      { id: "Ttrack", label: "Asfalto", unit: "°C", min: 10, max: 60, step: 1, v: 40 },
      { id: "Tair", label: "Aire", unit: "°C", min: 5, max: 40, step: 1, v: 25 },
      { id: "Trim", label: "Llanta (calor de frenos)", unit: "°C", min: 30, max: 200, step: 5, v: 90, adv: !0 }
    ] },
    { title: "Construcción", items: [
      { id: "width", label: "Ancho de banda", unit: "mm", min: 250, max: 420, step: 5, v: 330 },
      { id: "R", label: "Radio", unit: "mm", min: 300, max: 380, step: 1, v: 360, adv: !0 },
      { id: "cbr", label: "Rigidez de la banda (cerdas)", unit: "×10⁷ N/m³", min: 3, max: 40, step: .5, v: 15 },
      { id: "kc", label: "Rigidez de la carcasa", unit: "kPa eq.", min: 0, max: 100, step: 1, v: 20, adv: !0 },
      { id: "loadSens", label: "Sensibilidad a la carga", unit: "", min: 0, max: .35, step: .01, v: .12, help: "Por qué cuatro ruedas cargando igual agarran más que dos cargando el doble: μ baja con la presión local." },
      { id: "camberSens", label: "Efecto de la caída en la presión", unit: "", min: 0, max: 10, step: .1, v: 4, adv: !0 },
      { id: "tanD", label: "Histéresis de la goma (tan δ)", unit: "", min: .05, max: .5, step: .01, v: .2, adv: !0 },
      { id: "part", label: "Calor de fricción que entra en la goma", unit: "", min: .2, max: .8, step: .01, v: .5, adv: !0 },
      { id: "track", label: "Agarre del asfalto", unit: "×", min: .5, max: 1.2, step: .01, v: 1, adv: !0 }
    ] }
  ];
  const PRESETS = {
    fast: { name: "Curva rápida", v: { Fz: 7500, alpha: 2.5, kappa: 0, v: 250 } },
    brake: { name: "Frenada fuerte", v: { Fz: 6500, alpha: .5, kappa: -.08, v: 280 } },
    exit: { name: "Salida de curva lenta", v: { Fz: 3200, alpha: 4, kappa: .07, v: 90 } },
    cold: { name: "Sin mantas", v: { Tstart: 25, Ttrack: 22, Tair: 15 } },
    hot: { name: "Sobrecalentado", v: { alpha: 6, Fz: 6000, Ttrack: 52 } },
    camber: { name: "Mucha caída", v: { gamma: -4.8 } }
  };
  let prm, ro, host, plots = {}, S = null, B = null, simT = 0, play = !0, mapMode = "slide", hist = null, T, R3, scene, cam, st, comp3 = null, g3 = null;
  const P = () => ({ ...prm.v, Fz0: 4000, Tgas: S ? S.Tgas : prm.v.T0 });
  function reset() { S = TM().newState(P()), simT = 0, hist = { t: [], ts: [], tb: [], tc: [], tg: [], wa: [], wg: [], wb: [] }, curves() }
  function curves() {
    const p = P(), c = TM().curves(p), a = Float32Array.from(c.a), n = a.length, cols = ["#3d8bff", "#ff6b1a", "#ff3b3b"];
    plots.fy.draw(Object.keys(c.fy).map((k, i) => ({ x: a, y: Float32Array.from(c.fy[k], v => v / 1e3), n, col: cols[i], label: `${(+k / 1e3).toFixed(1)} kN` })), { title: "Fuerza lateral: sensibilidad a la carga", xlabel: "deriva °" });
    plots.mz.draw([{ x: a, y: Float32Array.from(c.mz), n, col: "#b45cff", label: "Momento autoalineante N·m" }], { title: "Autoalineante (lo que siente el volante)", xlabel: "deriva °" });
    plots.fx.draw([{ x: Float32Array.from(c.k, k => k * 100), y: Float32Array.from(c.fx, f => f / 1e3), n: c.k.length, col: "#2fd16c", label: "Fx kN" }], { title: "Tracción y frenada", xlabel: "deslizamiento %" });
    /* envolvente: la mayor fuerza en cada dirección */
    const bins = new Array(37).fill(null);
    for (const [fy, fx] of c.ell) { const b = Math.round((Math.atan2(fx, fy) + Math.PI / 2) / Math.PI * 36), r = Math.hypot(fx, fy); b >= 0 && b <= 36 && (!bins[b] || r > bins[b][2]) && (bins[b] = [fy, fx, r]) }
    const env = bins.filter(Boolean);
    plots.ell.draw([{ x: Float32Array.from(env, e => e[0] / 1e3), y: Float32Array.from(env, e => e[1] / 1e3), n: env.length, col: "#ffd23f", label: "Envolvente Fy–Fx (kN)" }], { title: "Elipse de fricción (frenando abajo, traccionando arriba)", xlabel: "Fy kN", points: c.ell.map(e => ({ x: e[0] / 1e3, y: e[1] / 1e3, col: "rgba(255,210,63,.35)" })) })
  }
  function stepModel(dt) {
    const p = P();
    B = TM().brush(p, S.Ts);
    if (play) { const n = Math.max(1, Math.round(dt / .05)); for (let k = 0; k < n; k++) TM().thermal(p, S, B, dt / n), simT += dt / n }
  }
  function readouts() {
    const p = P(), avg = a => (a[0] + a[1] + a[2]) / 3, pHot = p.pin * (S.Tgas + 273) / (p.T0 + 273), C = TM().COMP[p.comp];
    ro.set("fy", B.Fy / 1e3, 2), ro.set("fx", B.Fx / 1e3, 2), ro.set("mu", Math.hypot(B.Fx, B.Fy) / p.Fz, 2), ro.set("mz", B.Mz, 0), ro.set("trail", B.trail * 1e3, 1);
    ro.set("slide", B.slide * 100, 0), ro.set("area", B.A * 1e4, 0), ro.set("plen", 2 * B.a * 1e3, 0), ro.set("pmax", B.pmax / 1e5, 2), ro.set("pf", B.Pf / 1e3, 2);
    const ts = avg(S.Ts), tb = avg(S.Tb), inWin = Math.abs(tb - C.Topt) < C.dT * .6;
    ro.set("ts", ts, 0), ro.set("tb", tb, 0, inWin ? "ok" : Math.abs(tb - C.Topt) < C.dT ? "warn" : "bad"), ro.set("tc", avg(S.Tc), 0), ro.set("tg", S.Tgas, 0), ro.set("phot", pHot, 1), ro.set("time", simT, 0);
    ro.set("io", S.Tb[0] - S.Tb[2], 1);
    const per = a => avg(a) * 1e6 / Math.max(1, simT) * 60;
    ro.set("wa", per(S.wAbr), 1), ro.set("wg", per(S.wGr), 1, per(S.wGr) > 8 ? "warn" : "ok"), ro.set("wb", per(S.wBl), 1, per(S.wBl) > 5 ? "bad" : "ok")
  }
  function histPush() {
    const avg = a => (a[0] + a[1] + a[2]) / 3;
    hist.t.push(simT), hist.ts.push(avg(S.Ts)), hist.tb.push(avg(S.Tb)), hist.tc.push(avg(S.Tc)), hist.tg.push(S.Tgas), hist.wa.push(avg(S.wAbr) * 1e6), hist.wg.push(avg(S.wGr) * 1e6), hist.wb.push(avg(S.wBl) * 1e6);
    if (hist.t.length > 600) for (const k in hist) hist[k].shift()
  }
  function histPlots() {
    const t = Float32Array.from(hist.t), n = t.length, C = TM().COMP[prm.v.comp];
    plots.temp.draw([{ x: t, y: Float32Array.from(hist.ts), n, col: "#ff3b3b", label: "Superficie" }, { x: t, y: Float32Array.from(hist.tb), n, col: "#ff6b1a", label: "Goma" }, { x: t, y: Float32Array.from(hist.tc), n, col: "#ffd23f", label: "Carcasa" }, { x: t, y: Float32Array.from(hist.tg), n, col: "#3d8bff", label: "Aire interior" }], { title: "Temperaturas (°C)", xlabel: "s", hlines: [{ y: C.Topt - C.dT * .6, col: "rgba(47,209,108,.4)" }, { y: C.Topt + C.dT * .6, col: "rgba(47,209,108,.4)" }] });
    plots.wear.draw([{ x: t, y: Float32Array.from(hist.wa), n, col: "#8b97a4", label: "Abrasión µm" }, { x: t, y: Float32Array.from(hist.wg), n, col: "#3d8bff", label: "Graining µm" }, { x: t, y: Float32Array.from(hist.wb), n, col: "#ff3b3b", label: "Ampollas µm" }], { title: "Desgaste acumulado por mecanismo", xlabel: "s" })
  }
  function verdict() {
    const C = TM().COMP[prm.v.comp], out = [], tb = S.Tb, avg = (tb[0] + tb[1] + tb[2]) / 3, io = tb[0] - tb[2];
    avg < C.Topt - C.dT * .6 ? out.push(["warn", "Ventana térmica", `La goma está a ${avg.toFixed(0)} °C, por debajo de su ventana (${C.Topt - Math.round(C.dT * .6)}–${C.Topt + Math.round(C.dT * .6)} °C): agarre bajo y riesgo de graining.`]) : avg > C.Topt + C.dT * .6 ? out.push(["bad", "Ventana térmica", `La goma pasa de ${C.Topt + Math.round(C.dT * .6)} °C: el agarre cae y aparecen ampollas.`]) : out.push(["ok", "Ventana térmica", `Goma a ${avg.toFixed(0)} °C, dentro de la ventana del ${C.name.toLowerCase()}.`]);
    Math.abs(io) > 12 ? out.push(["warn", "Reparto en la banda", `El hombro ${io > 0 ? "interior" : "exterior"} va ${Math.abs(io).toFixed(0)} °C más caliente: ${io > 0 ? "sobra caída negativa" : "falta caída"} o sobra presión.`]) : out.push(["ok", "Reparto en la banda", "Interior, centro y exterior trabajan parejos."]);
    B.slide > .7 ? out.push(["bad", "Huella", `El ${Math.round(B.slide * 100)} % de la huella está deslizando: pasado el pico de agarre, solo se gasta goma.`]) : out.push(["ok", "Huella", `${Math.round(B.slide * 100)} % deslizando: ${B.slide < .3 ? "lejos del límite" : "cerca del pico de agarre, donde se va rápido"}.`]);
    $("tyVerdict").innerHTML = out.map(([s, t, d]) => `<div class="vd ${s}"><b>${t}</b><span>${d}</span></div>`).join("")
  }
  /* ---------- 3D: rueda sobre un asfalto de cristal, huella coloreada y vectores de tensión ---------- */
  function init3d(h) {
    T = window.THREE;
    if (!T) return !1;
    R3 = new T.WebGLRenderer({ antialias: !1 }), R3.setPixelRatio(Math.min(2, devicePixelRatio || 1)), R3.outputColorSpace = T.SRGBColorSpace, R3.toneMapping = T.ACESFilmicToneMapping, R3.toneMappingExposure = 1.1;
    h.appendChild(R3.domElement), R3.domElement.className = "s3cv";
    scene = new T.Scene(), scene.background = new T.Color("#0d1014"), cam = new T.PerspectiveCamera(32, 1, .01, 30);
    const pm = new T.PMREMGenerator(R3), envS = new T.Scene();
    envS.add(new T.Mesh(new T.BoxGeometry(20, 10, 20), new T.MeshBasicMaterial({ color: "#3a4048", side: T.BackSide })));
    for (const [x, y, z, c] of [[0, 4.8, 0, 6], [-9, 2, 3, 3], [9, 2, -3, 2.4]]) { const p = new T.Mesh(new T.PlaneGeometry(5, 2), new T.MeshBasicMaterial({ color: new T.Color(c, c, c) })); p.position.set(x, y, z), p.lookAt(0, 0, 0), envS.add(p) }
    scene.environment = pm.fromScene(envS, .04).texture, pm.dispose();
    scene.add(new T.HemisphereLight("#dfe7ef", "#1a1f26", .6));
    const key = new T.DirectionalLight("#fff3e2", 1.8); key.position.set(1.5, 3, 2), scene.add(key);
    g3 = {};
    /* neumático: toro aplanado con surcos laterales y llanta; gira con la velocidad */
    g3.wheel = new T.Group(), scene.add(g3.wheel);
    g3.spin = new T.Group(), g3.wheel.add(g3.spin);
    const tyreMat = new T.MeshPhysicalMaterial({ vertexColors: !0, roughness: .82, metalness: 0, sheen: .4, sheenColor: new T.Color("#555") }), tg = new T.TorusGeometry(.27, .09, 24, 96).scale(1, 1, 1.85), tn = tg.attributes.position.count;
    tg.setAttribute("color", new T.BufferAttribute(new Float32Array(tn * 3).fill(.1), 3));
    g3.fb = new T.Group(), g3.spin.add(g3.fb), g3.tyre = new T.Mesh(tg, tyreMat), g3.fb.add(g3.tyre);
    /* qué vértices son banda de rodadura y de qué tercio */
    g3.tread = [];
    { const pa = tg.attributes.position.array; for (let i = 0; i < tn; i++) { const r = Math.hypot(pa[i * 3], pa[i * 3 + 1]), z = pa[i * 3 + 2]; r > .315 && g3.tread.push([i, z < -.055 ? 0 : z > .055 ? 2 : 1, clamp((r - .315) / .045, 0, 1)]) } }
    const rim = new T.Mesh(new T.CylinderGeometry(.23, .23, .3, 48, 1, !0).rotateX(Math.PI / 2), new T.MeshStandardMaterial({ color: "#3a3f45", metalness: .9, roughness: .28, side: T.DoubleSide })); g3.fb.add(rim);
    for (let k = 0; k < 10; k++) { const sp = new T.Mesh(new T.BoxGeometry(.03, .19, .02), new T.MeshStandardMaterial({ color: "#2b2f34", metalness: .85, roughness: .3 })); sp.position.set(0, .11, .13), sp.position.applyAxisAngle(new T.Vector3(0, 0, 1), k / 10 * TAU), sp.rotation.z = k / 10 * TAU, g3.fb.add(sp) }
    /* banda con sus tres zonas de temperatura (anillos de color) */

    /* asfalto de cristal */
    const road = new T.Mesh(new T.PlaneGeometry(3, 3), new T.MeshPhysicalMaterial({ color: "#3a4450", transparent: !0, opacity: .18, roughness: .2, side: T.DoubleSide, depthWrite: !1 }));
    road.rotation.x = -Math.PI / 2, scene.add(road), scene.add(new T.GridHelper(3, 30, "#2a3642", "#1c242c"));
    /* huella: rejilla de celdas coloreadas y flechas de tensión */
    const NX = TM().NX, NY = TM().NY, pos = new Float32Array((NX + 1) * (NY + 1) * 3), col = new Float32Array(NX * NY * 4 * 3), ix = [];
    const pg = new T.BufferGeometry(), cellPos = new Float32Array(NX * NY * 4 * 3);
    for (let c = 0; c < NX * NY; c++) { const b = c * 4; ix.push(b, b + 1, b + 2, b, b + 2, b + 3) }
    pg.setAttribute("position", new T.BufferAttribute(cellPos, 3)), pg.setAttribute("color", new T.BufferAttribute(col, 3)), pg.setIndex(ix);
    g3.patch = new T.Mesh(pg, new T.MeshBasicMaterial({ vertexColors: !0, side: T.DoubleSide, toneMapped: !1, depthTest: !1, transparent: !0, opacity: .95 })), g3.patch.position.y = .001, g3.patch.renderOrder = 5, scene.add(g3.patch);
    const ag = new T.BufferGeometry(); ag.setAttribute("position", new T.BufferAttribute(new Float32Array(NX * NY * 6), 3));
    g3.arrows = new T.LineSegments(ag, new T.LineBasicMaterial({ color: "#ffffff", transparent: !0, opacity: .85, depthTest: !1 })), g3.arrows.position.y = .002, g3.arrows.renderOrder = 6, scene.add(g3.arrows);
    /* corte de la banda: 3 capas × 3 bandas */
    g3.cut = [];
    for (let l = 0; l < 3; l++) for (let r = 0; r < 3; r++) { const m = new T.Mesh(new T.BoxGeometry(.012, .03, .105), new T.MeshBasicMaterial({ color: "#333", toneMapped: !1 })); m.position.set(-.45, .62 - l * .034, (r - 1) * .11), scene.add(m), g3.cut.push(m) }
    LAB.carmesh && LAB.carmesh.load().then(d => { try { d && d.rig && d.rig.prof && realTyre(d.rig.prof.F, tyreMat) } catch (e) { console.warn("neumático real", e) } });
    st = { az: .42, el: .26, d: 1.55, t: new T.Vector3(0, .3, 0) };
    const place = () => { const c = Math.cos(st.el); cam.position.set(st.t.x + st.d * c * Math.cos(st.az), st.t.y + st.d * Math.sin(st.el), st.t.z + st.d * c * Math.sin(st.az)), cam.lookAt(st.t) };
    let drag = null;
    const cv = R3.domElement;
    cv.addEventListener("pointerdown", e => { drag = [e.clientX, e.clientY], cv.setPointerCapture(e.pointerId) });
    cv.addEventListener("pointermove", e => { if (!drag) return; st.az += (e.clientX - drag[0]) * .007, st.el = clamp(st.el + (e.clientY - drag[1]) * .005, -1.4, 1.5), drag = [e.clientX, e.clientY], place() });
    cv.addEventListener("pointerup", () => drag = null), cv.addEventListener("wheel", e => { e.preventDefault(), st.d = clamp(st.d * Math.exp(e.deltaY * .001), .4, 6), place() }, { passive: !1 });
    try { if (T.EffectComposer) { comp3 = new T.EffectComposer(R3); comp3.addPass(new T.RenderPass(scene, cam)), comp3.addPass(new T.OutputPass()), T.SMAAPass && comp3.addPass(new T.SMAAPass(400, 300)) } } catch (e) { comp3 = null }
    const fit = () => { const r = h.getBoundingClientRect(), w = Math.max(1, r.width), hh = Math.max(1, r.height); R3.setSize(w, hh, !1), comp3 && comp3.setSize(w, hh), cam.aspect = w / hh, cam.filmOffset = w > 620 ? -4.6 : 0, st.t.y = w > 620 ? .3 : .37, cam.updateProjectionMatrix(), place() };
    new ResizeObserver(fit).observe(h), fit(), place();
    h.view = v => { Object.assign(st, { iso: { az: .42, el: .26, d: 1.55 }, below: { az: .001, el: -1.35, d: .9 }, side: { az: Math.PI / 2, el: .05, d: 1.4 }, front: { az: 0, el: .15, d: 1.3 } }[v] || {}), place() };
    return !0
  }
  /* La rueda del propio coche: su perfil (el del modelo 3D) girado alrededor del eje, con un gajo abierto que enseña el corte.
     Capas de fuera adentro: banda de rodadura (el compuesto que se gasta), subcapa, cinturones, carcasa radial y revestimiento
     interior; en los flancos, goma de flanco sobre la carcasa; en cada talón, el aro de alambre de acero. Los espesores son valores
     típicos de un neumático de competición de 18" (el fabricante no publica los suyos). Banda, subcapa y carcasa se colorean con las
     tres capas del modelo térmico, tercio a tercio. */
  function realTyre(prof, tyreMat) {
    const raw = prof.filter(p => p[1] >= .2475), cv = new T.CatmullRomCurve3(raw.map(p => new T.Vector3(p[0], p[1], 0)), !1, "centripetal"), ty = cv.getPoints(72).map(v => [v.x, v.y]), n = ty.length, R0 = Math.max(...ty.map(p => p[1]));
    const nrm = ty.map((p, k) => { const a = ty[Math.max(0, k - 1)], b = ty[Math.min(n - 1, k + 1)], tx = b[0] - a[0], tr = b[1] - a[1], L = Math.hypot(tx, tr) || 1; let nx = -tr / L, nr = tx / L; nx * -p[0] + nr * (.3 - p[1]) < 0 && (nx = -nx, nr = -nr); return [nx, nr] });
    const trw = ty.map(p => { const t = clamp((p[1] - (R0 - .024)) / .013, 0, 1); return t * t * (3 - 2 * t) });
    const bnd = k => { const t = trw[k], b1 = .0035 + .0005 * t, b2 = b1 + .0015 * t, b3 = b2 + .003 * t, b4 = b3 + .0023 + .0005 * t; return [0, b1, b2, b3, b4, b4 + .0012] };
    const off = (k, d) => [ty[k][0] + nrm[k][0] * d, ty[k][1] + nrm[k][1] * d], TH0 = -12 * DEG, TH1 = 50 * DEG, at = (p, th) => [p[1] * Math.cos(th), p[1] * Math.sin(th), p[0]];
    const NS = 96, ths = []; for (let i = 0; i <= NS; i++) ths.push(TH1 + (TAU - (TH1 - TH0)) * i / NS);
    const lathe = (curve, angs) => { const pos = [], idx = [], m = angs.length; curve.forEach(p => angs.forEach(th => pos.push(...at(p, th)))); for (let k = 0; k < curve.length - 1; k++) for (let i = 0; i < m - 1; i++) { const a = k * m + i, c = a + m; idx.push(a, a + 1, c, a + 1, c + 1, c) } const g = new T.BufferGeometry(); g.setAttribute("position", new T.BufferAttribute(new Float32Array(pos), 3)), g.setIndex(idx), g.computeVertexNormals(); return g };
    g3.spin.remove(g3.fb);
    const W = new T.Group(); g3.wheel.add(W), g3.real = W;
    /* cubierta por fuera (con el color de temperatura de la banda) y por dentro */
    const og = lathe(ty, ths), on = og.attributes.position.count; og.setAttribute("color", new T.BufferAttribute(new Float32Array(on * 3).fill(.1), 3));
    g3.tyre = new T.Mesh(og, tyreMat), tyreMat.side = T.DoubleSide, W.add(g3.tyre), g3.tread = [];
    { const pa = og.attributes.position.array; for (let i = 0; i < on; i++) { const r = Math.hypot(pa[i * 3], pa[i * 3 + 1]), z = pa[i * 3 + 2]; r > R0 - .045 && g3.tread.push([i, z < -.055 ? 0 : z > .055 ? 2 : 1, clamp((r - (R0 - .045)) / .045, 0, 1)]) } }
    W.add(new T.Mesh(lathe(ty.map((p, k) => off(k, bnd(k)[5])), ths), new T.MeshStandardMaterial({ color: "#3a2a57", roughness: .85, side: T.DoubleSide })));
    /* caras del corte: una tira por capa entre dos fronteras, en los dos extremos del gajo */
    const strip = (j, sel) => { const pos = [], idx = []; for (const th of [TH0, TH1]) for (let k = 0; k < n - 1; k++) { if (!sel(k)) continue; const b0 = bnd(k), b1 = bnd(k + 1), q = pos.length / 3; pos.push(...at(off(k, b0[j]), th), ...at(off(k + 1, b1[j]), th), ...at(off(k + 1, b1[j + 1]), th), ...at(off(k, b0[j + 1]), th)), idx.push(q, q + 1, q + 2, q, q + 2, q + 3) } const g = new T.BufferGeometry(); g.setAttribute("position", new T.BufferAttribute(new Float32Array(pos), 3)), g.setIndex(idx); return g };
    const rib = k => { const z = (ty[k][0] + ty[k + 1][0]) / 2; return z < -.055 ? 0 : z > .055 ? 2 : 1 }, tread = k => (trw[k] + trw[k + 1]) / 2 > .5;
    const flat = (g, col) => { const m = new T.Mesh(g, new T.MeshBasicMaterial({ color: col, side: T.DoubleSide, toneMapped: !1 })); W.add(m); return m };
    for (const m of g3.cut) scene.remove(m);
    g3.cut = [];
    for (let l = 0; l < 3; l++) for (let r = 0; r < 3; r++) g3.cut.push(flat(strip([0, 1, 3][l], k => rib(k) === r && (l === 2 || tread(k))), "#333"));
    flat(strip(0, k => !tread(k)), "#1b1c1f"), flat(strip(2, () => !0), "#8fa3bd"), flat(strip(4, () => !0), "#6a4a9a");
    /* aro del talón (alambre de acero) en cada lado y cada cara */
    for (const th of [TH0, TH1]) for (const k of [2, n - 3]) { const c = new T.Mesh(new T.CircleGeometry(.0042, 18), new T.MeshBasicMaterial({ color: "#d7dbe0", side: T.DoubleSide, toneMapped: !1 })), p = at(off(k, .0062), th), tn = new T.Vector3(-Math.sin(th), Math.cos(th), 0); c.position.set(p[0], p[1], p[2]).addScaledVector(tn, th === TH0 ? .0004 : -.0004), c.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), tn), W.add(c) }
    /* llanta: pestañas y tapacubos del modelo, y la garganta entre los dos asientos del talón (no se ve desde fuera, se ve por el gajo) */
    const full = []; for (let i = 0; i <= 64; i++) full.push(TAU * i / 64);
    const metal = new T.MeshStandardMaterial({ color: "#2f3338", metalness: .9, roughness: .3, side: T.DoubleSide }), i0 = prof.findIndex(p => p[1] >= .2475), i1 = prof.length - 1 - [...prof].reverse().findIndex(p => p[1] >= .2475);
    g3.spin.add(new T.Mesh(lathe(prof.slice(0, i0 + 1), full), metal)), g3.spin.add(new T.Mesh(lathe(prof.slice(i1).filter(p => p[1] >= .045), full), new T.MeshStandardMaterial({ color: "#101114", metalness: .3, roughness: .5, side: T.DoubleSide })));
    g3.spin.add(new T.Mesh(lathe(prof.slice(i1).filter(p => p[1] <= .05), full), new T.MeshStandardMaterial({ color: "#b98a2c", metalness: 1, roughness: .25, side: T.DoubleSide })));
    const zi = ty[0][0], zo = ty[n - 1][0];
    g3.spin.add(new T.Mesh(lathe([[zi, .2475], [zi + .012, .2296], [zi + .07, .2296], [zi + .09, .218], [zo - .09, .218], [zo - .07, .2296], [zo - .012, .2296], [zo, .2475]], full), new T.MeshStandardMaterial({ color: "#a9afb6", metalness: .9, roughness: .36, side: T.DoubleSide })))
  }
  const heat = t => { t = clamp(t, 0, 1); const s = [[.1, .15, .35], [.2, .45, 1], [.15, .8, .5], [1, .85, .2], [1, .4, .1], [1, .15, .15]], x = t * (s.length - 1), i = Math.min(s.length - 2, x | 0), f = x - i; return [s[i][0] + (s[i + 1][0] - s[i][0]) * f, s[i][1] + (s[i + 1][1] - s[i][1]) * f, s[i][2] + (s[i + 1][2] - s[i][2]) * f] };
  function draw3d(dt) {
    const p = P(), a = B.a, w = B.w, NX = B.nx, NY = B.ny, dx = 2 * a / NX, dy = w / NY, al = p.alpha * DEG, ca = Math.cos(al), sa = Math.sin(al), Rm = p.R * 1e-3;
    /* la rueda gira con la deriva y la caída; escala real del neumático */
    g3.wheel.rotation.set(0, 0, 0), g3.wheel.rotateY(al), g3.wheel.rotateX(-p.gamma * DEG * .7), g3.wheel.position.y = Rm + .002, g3.wheel.scale.setScalar(Rm / .36);
    g3.spin.rotation.z -= p.v / 3.6 / Rm * dt * .05;
    const pos = g3.patch.geometry.attributes.position.array, col = g3.patch.geometry.attributes.color.array, ar = g3.arrows.geometry.attributes.position.array;
    let vmax = 1e-9;
    for (const c of B.grid) vmax = Math.max(vmax, mapMode === "p" ? c.p : mapMode === "pw" ? c.pw : Math.hypot(c.fx, c.fy));
    B.grid.forEach((c, k) => {
      const corners = [[c.x + dx / 2, c.y - dy / 2], [c.x + dx / 2, c.y + dy / 2], [c.x - dx / 2, c.y + dy / 2], [c.x - dx / 2, c.y - dy / 2]];
      const v = mapMode === "slide" ? null : (mapMode === "p" ? c.p : mapMode === "pw" ? c.pw : Math.hypot(c.fx, c.fy)) / vmax, cc = mapMode === "slide" ? (c.p < 500 ? [.12, .14, .16] : c.sl ? [1, .3, .2] : [.2, .85, .45]) : heat(v);
      corners.forEach(([x, y], q) => { const i = (k * 4 + q) * 3, X = x * ca + y * sa, Z = -x * sa + y * ca; pos[i] = X, pos[i + 1] = 0, pos[i + 2] = Z, col[i] = cc[0], col[i + 1] = cc[1], col[i + 2] = cc[2] });
      /* tensión tangencial: flecha en la dirección de la fuerza que la huella hace sobre el coche */
      const sc = .5 * dx / (B.pmax * 2), fx = -c.fx * sc, fy = -c.fy * sc, X0 = c.x * ca + c.y * sa, Z0 = -c.x * sa + c.y * ca, j = k * 6;
      ar[j] = X0, ar[j + 1] = 0, ar[j + 2] = Z0, ar[j + 3] = X0 + fx * ca + fy * sa, ar[j + 4] = 0, ar[j + 5] = Z0 - fx * sa + fy * ca
    });
    g3.patch.geometry.attributes.position.needsUpdate = !0, g3.patch.geometry.attributes.color.needsUpdate = !0, g3.arrows.geometry.attributes.position.needsUpdate = !0;
    const C = TM().COMP[p.comp], tc = T => heat((T - (C.Topt - 60)) / 100);
    const tcol = g3.tyre.geometry.attributes.color.array, rc = [0, 1, 2].map(r => tc(S.Ts[r]));
    for (const [i, r, f] of g3.tread) { const c = rc[2 - r], k = .35 + .6 * f; tcol[i * 3] = .1 + (c[0] - .1) * k, tcol[i * 3 + 1] = .1 + (c[1] - .1) * k, tcol[i * 3 + 2] = .1 + (c[2] - .1) * k }
    g3.tyre.geometry.attributes.color.needsUpdate = !0;
    for (let r = 0; r < 3; r++) for (let l = 0; l < 3; l++) { const Tv = [S.Ts, S.Tb, S.Tc][l][2 - r], c2 = tc(Tv); g3.cut[l * 3 + r].material.color.setRGB(...c2) }
    comp3 ? comp3.render() : R3.render(scene, cam)
  }
  /* corte ampliado: las capas de fuera adentro, con el espesor que se ha dibujado y, en las tres que calcula el modelo térmico, la
     temperatura de cada tercio de la banda (mismos colores que el gajo de la rueda) */
  function cutLegend() {
    const h = $("tyCut"); if (!h || !S) return;
    const C = TM().COMP[P().comp], col = Tv => { const c = heat((Tv - (C.Topt - 60)) / 100); return `rgb(${c.map(v => Math.round(v * 255)).join(",")})` };
    const hot = (name, mm, A) => `<div class="tcr"><span>${name}<i>${mm}</i></span>${[0, 1, 2].map(r => `<b style="background:${col(A[r])}">${A[r].toFixed(0)}°</b>`).join("")}</div>`;
    const cold = (name, mm, c, txt) => `<div class="tcr"><span>${name}<i>${mm}</i></span><em style="background:${c}">${txt || ""}</em></div>`;
    const pHot = P().pin * (S.Tgas + 273) / (P().T0 + 273);
    h.innerHTML = `<div class="tch"><span>Corte de la cubierta, de fuera adentro</span><b>int.</b><b>centro</b><b>ext.</b></div>` +
      hot("Banda: superficie", "4 mm", S.Ts) + hot("Subcapa: goma por dentro", "1,5 mm", S.Tb) + cold("Cinturones", "3 mm", "#8fa3bd") +
      hot("Carcasa radial", "2,8 mm", S.Tc) + cold("Butilo interior", "1,2 mm", "#6a4a9a") + cold("Aire", "", "#1b2733", `${S.Tgas.toFixed(0)} °C · ${pHot.toFixed(1)} psi`)
  }
  let last = 0, fn = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    if (host.hidden || !S) return;
    const dt = Math.min(.05, (now - (last || now)) / 1e3) * (play ? +$("tySpd").value : 0);
    last = now, stepModel(dt || 1e-4);
    g3 && draw3d(Math.min(.05, (now - (last || now)) / 1e3) + .016);
    if (++fn % 8 === 0) {
      play && histPush(), readouts();
      fn % 24 === 0 && (histPlots(), verdict());
      $("tyInfo").innerHTML = `<b>Huella ${(2 * B.a * 1e3).toFixed(0)} × ${(B.w * 1e3).toFixed(0)} mm</b> · Fy ${(B.Fy / 1e3).toFixed(2)} kN · Fx ${(B.Fx / 1e3).toFixed(2)} kN · ${Math.round(B.slide * 100)} % deslizando · ${simT.toFixed(0)} s<br><span>${{ slide: "verde: la goma se agarra · rojo: desliza", p: "presión de contacto", pw: "potencia de fricción (calor)", tau: "tensión tangencial" }[mapMode]} · flechas: fuerza de cada cerda · el gajo abierto enseña las capas</span>`;
      cutLegend()
    }
  }
  function init(el0) {
    host = el0;
    host.innerHTML = `
    <div class="labhead"><div><h2>Neumáticos</h2><p class="sub">La huella como un cepillo de 600 cerdas que se agarran o deslizan, el calor que entra por fricción y por histéresis en tres capas y tres bandas, la presión del aire caliente y tres formas de gastar la goma.</p></div>
      <div class="presets" id="tyPre"></div></div>
    <div class="labgrid">
      <aside class="params" id="tyParams"></aside>
      <section class="views">
        <div class="vrow"><div class="s3host" id="ty3d"><div class="s3info" id="tyInfo"></div><div class="tycut" id="tyCut"></div></div><div class="verdict" id="tyVerdict"></div></div>
        <div class="ctrl"><button class="btn on" id="tyRun">Pausa</button><button class="btn" id="tyReset">Volver a empezar</button><label>Tiempo <select id="tySpd"><option value="1">×1</option><option value="5">×5</option><option value="20" selected>×20</option><option value="60">×60</option></select></label></div>
        <div class="ctrl s3views"><span>Mapa</span><button class="btn on" data-tm="slide">Agarre y deslizamiento</button><button class="btn" data-tm="p">Presión</button><button class="btn" data-tm="tau">Tensión</button><button class="btn" data-tm="pw">Calor</button><span>Vista</span><button class="btn" data-tv="iso">3/4</button><button class="btn" data-tv="below">Desde abajo</button><button class="btn" data-tv="front">De frente</button></div>
        <p class="sub" style="margin:6px 0 0">La rueda es la del coche. El gajo abierto enseña el corte, de fuera adentro: banda de rodadura, subcapa, cinturones (azul grisáceo), carcasa radial y revestimiento interior de butilo (morado); en los flancos, goma de flanco, y en cada talón el aro de alambre de acero. Por el gajo se ve la llanta (garganta y asientos del talón). Banda, subcapa y carcasa llevan el color de su temperatura en cada tercio, y la tabla del visor da las cifras; los espesores son valores típicos de un neumático de competición (el fabricante no publica los suyos).</p>
        <div class="readouts" id="tyRo"></div>
        <div class="pgrid"><canvas id="tyFy"></canvas><canvas id="tyTemp"></canvas><canvas id="tyWear"></canvas><canvas id="tyEll"></canvas></div>
        <h3 class="adv">Autoalineante y tracción</h3>
        <div class="pgrid adv"><canvas id="tyMz"></canvas><canvas id="tyFx"></canvas></div>
      </section></div>`;
    prm = new Params($("tyParams"), DEF, id => { /^(comp|Tstart|T0|pin)$/.test(id) ? reset() : (clearTimeout(init.t), init.t = setTimeout(curves, 150)) });
    const pre = $("tyPre");
    for (const k in PRESETS) pre.appendChild(el("button", { class: "btn", text: PRESETS[k].name, onclick: () => { prm.set(Object.fromEntries(DEF.flatMap(g => g.items.map(i => [i.id, i.v]))), !0), prm.set(PRESETS[k].v), reset() } }));
    ro = new Readouts($("tyRo"), [
      { id: "fy", label: "Fuerza lateral", unit: "kN" }, { id: "fx", label: "Fuerza longitudinal", unit: "kN" }, { id: "mu", label: "Agarre usado (F/Fz)", unit: "" }, { id: "slide", label: "Huella deslizando", unit: "%" },
      { id: "mz", label: "Autoalineante", unit: "N·m", adv: !0 }, { id: "trail", label: "Brazo neumático", unit: "mm", adv: !0 }, { id: "area", label: "Área de la huella", unit: "cm²" }, { id: "plen", label: "Largo de la huella", unit: "mm", adv: !0 }, { id: "pmax", label: "Presión de contacto máxima", unit: "bar", adv: !0 }, { id: "pf", label: "Calor por fricción", unit: "kW" },
      { id: "ts", label: "Superficie", unit: "°C" }, { id: "tb", label: "Goma (en la ventana)", unit: "°C" }, { id: "tc", label: "Carcasa", unit: "°C", adv: !0 }, { id: "tg", label: "Aire interior", unit: "°C", adv: !0 }, { id: "phot", label: "Presión en caliente", unit: "psi" }, { id: "io", label: "Interior − exterior", unit: "°C" },
      { id: "wa", label: "Abrasión", unit: "µm/min" }, { id: "wg", label: "Graining", unit: "µm/min" }, { id: "wb", label: "Ampollas", unit: "µm/min" }, { id: "time", label: "Tiempo simulado", unit: "s", adv: !0 }
    ]);
    plots.fy = new Plot($("tyFy")), plots.temp = new Plot($("tyTemp")), plots.wear = new Plot($("tyWear")), plots.ell = new Plot($("tyEll")), plots.mz = new Plot($("tyMz")), plots.fx = new Plot($("tyFx"));
    $("tyRun").onclick = () => { play = !play, $("tyRun").textContent = play ? "Pausa" : "Seguir", $("tyRun").classList.toggle("on", play) };
    $("tyReset").onclick = reset;
    host.querySelectorAll("[data-tm]").forEach(b => b.onclick = () => { mapMode = b.dataset.tm, host.querySelectorAll("[data-tm]").forEach(x => x.classList.toggle("on", x === b)) });
    host.querySelectorAll("[data-tv]").forEach(b => b.onclick = () => $("ty3d").view && $("ty3d").view(b.dataset.tv));
    window.addEventListener("labmode", () => setTimeout(() => { for (const p of Object.values(plots)) p.fit(); curves(), histPlots() }, 50));
    reset(), B = TM().brush(P(), S.Ts);
    init3d($("ty3d"));
    requestAnimationFrame(loop)
  }
  return { init }
})();
