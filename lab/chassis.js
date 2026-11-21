/* ===================== PESTAÑA CHASIS Y VIBRACIONES ===================== */
LAB.chassis = (() => {
  const CM = () => LAB.chassismodel;
  const DEF = [
    { title: "Monocasco", open: !0, help: "Cajón de carbono en sándwich con nido de abeja. La abertura del habitáculo es lo que más rigidez a torsión le quita: una sección abierta apenas resiste el giro.", items: [
      { id: "Ec", label: "Módulo del laminado", unit: "GPa", min: 40, max: 140, step: 1, v: 70, help: "Cuasi isótropo con fibra de módulo intermedio ~70 GPa; con fibra de alto módulo en las pieles, más." },
      { id: "tw", label: "Espesor equivalente de pared", unit: "mm", min: 1, max: 8, step: .1, v: 4.2 },
      { id: "cockpit", label: "Pérdida por la abertura del habitáculo", unit: "", min: 0, max: .95, step: .01, v: .7 },
      { id: "knose", label: "Rigidez del morro", unit: "×", min: .2, max: 4, step: .05, v: 1, adv: !0 }
    ] },
    { title: "Motor y caja como estructura", help: "Desde los años 60 el motor y la caja son parte del chasis: el motor va atornillado al mamparo trasero con cuatro espárragos y la suspensión trasera cuelga de la caja.", items: [
      { id: "kmount", label: "Rigidez de las uniones atornilladas", unit: "×", min: .1, max: 5, step: .05, v: 1.3 },
      { id: "gbt", label: "Pared de la carcasa de la caja", unit: "mm", min: 2, max: 12, step: .1, v: 5 }
    ] },
    { title: "Alerones", items: [
      { id: "kfw", label: "Rigidez del alerón delantero", unit: "×", min: .1, max: 4, step: .05, v: 1, help: "Flexión vertical del plano principal hacia las puntas: el «alerón que flexa» que vigila la FIA con cargas en las puntas." },
      { id: "krw", label: "Rigidez del alerón trasero", unit: "×", min: .1, max: 4, step: .05, v: 1 },
      { id: "kpylon", label: "Rigidez del pilón trasero", unit: "×", min: .1, max: 4, step: .05, v: 1 }
    ] },
    { title: "Suspensión y neumáticos", items: [
      { id: "kwf", label: "Rigidez en rueda delantera", unit: "N/mm", min: 80, max: 800, step: 5, v: 350 },
      { id: "kwr", label: "Rigidez en rueda trasera", unit: "N/mm", min: 60, max: 600, step: 5, v: 220 },
      { id: "kt", label: "Rigidez vertical del neumático", unit: "N/mm", min: 150, max: 500, step: 5, v: 300 },
      { id: "muf", label: "Masa no suspendida delantera", unit: "kg", min: 20, max: 50, step: .5, v: 32, adv: !0 },
      { id: "mur", label: "Masa no suspendida trasera", unit: "kg", min: 20, max: 55, step: .5, v: 36, adv: !0 },
      { id: "trf", label: "Vía delantera", unit: "m", min: 1.4, max: 1.8, step: .01, v: 1.6, adv: !0 },
      { id: "trr", label: "Vía trasera", unit: "m", min: 1.4, max: 1.8, step: .01, v: 1.55, adv: !0 }
    ] },
    { title: "Masas y excitación", items: [
      { id: "driver", label: "Piloto con equipo", unit: "kg", min: 60, max: 100, step: 1, v: 80 },
      { id: "fuel", label: "Combustible", unit: "kg", min: 0, max: 110, step: 1, v: 50 },
      { id: "ballast", label: "Lastre en el suelo", unit: "kg", min: 0, max: 200, step: 1, v: 110, adv: !0 },
      { id: "zeta", label: "Amortiguamiento estructural", unit: "ζ", min: .005, max: .15, step: .005, v: .03, adv: !0 },
      { id: "speed", label: "Velocidad sobre el bordillo", unit: "km/h", min: 50, max: 300, step: 5, v: 160 },
      { id: "kerb", label: "Paso de los resaltes del bordillo", unit: "m", min: .1, max: 2, step: .01, v: .5 }
    ] }
  ];
  const PRESETS = {
    base: { name: "F1 actual", v: {} },
    soft: { name: "Monocasco blando", v: { tw: 2, cockpit: .85 } },
    loose: { name: "Espárragos del motor flojos", v: { kmount: .2 } },
    wing: { name: "Alerón delantero flexible", v: { kfw: .3 } },
    stiff: { name: "Suspensión muy rígida", v: { kwf: 700, kwr: 500 } },
    empty: { name: "Sin combustible", v: { fuel: 0 } }
  };
  let prm, ro, host, res = null, plots = {}, sel = 0, view = "mode", amp = 1;
  /* ---------- 3D ---------- */
  let T, R, scene, cam, st, skin = null, labelsEl, comp = null;
  const X3 = (x, y, z) => new T.Vector3(x - 1.8, z, y);
  /* estaciones del forro: nudo de la columna, semiancho, alto, desplazamiento vertical del centro */
  const STA = [[0, .05, .06, 0], [1, .12, .14, -.05], [2, .2, .32, .02], [3, .22, .4, .03], [4, .26, .44, .04], [5, .34, .5, .06], [6, .52, .5, .02], [7, .7, .56, .04], [8, .68, .62, .1], [9, .5, .6, .12], [10, .34, .5, .1], [11, .16, .36, .06], [12, .14, .32, .04], [13, .1, .26, .04]];
  function init3d(h) {
    T = window.THREE;
    if (!T) return !1;
    R = new T.WebGLRenderer({ antialias: !1 }), R.setPixelRatio(Math.min(2, devicePixelRatio || 1)), R.outputColorSpace = T.SRGBColorSpace, R.toneMapping = T.ACESFilmicToneMapping, R.toneMappingExposure = 1.1;
    h.appendChild(R.domElement), R.domElement.className = "s3cv";
    scene = new T.Scene(), scene.background = new T.Color("#0d1014"), cam = new T.PerspectiveCamera(30, 1, .05, 60);
    const pm = new T.PMREMGenerator(R), envS = new T.Scene();
    envS.add(new T.Mesh(new T.BoxGeometry(20, 10, 20), new T.MeshBasicMaterial({ color: "#3a4048", side: T.BackSide })));
    for (const [x, y, z, c] of [[0, 4.8, 0, 6], [-9, 2, 3, 3], [9, 2, -3, 2.4]]) { const p = new T.Mesh(new T.PlaneGeometry(5, 2), new T.MeshBasicMaterial({ color: new T.Color(c, c, c) })); p.position.set(x, y, z), p.lookAt(0, 0, 0), envS.add(p) }
    scene.environment = pm.fromScene(envS, .04).texture, pm.dispose();
    scene.add(new T.HemisphereLight("#dfe7ef", "#1a1f26", .7));
    const key = new T.DirectionalLight("#fff3e2", 1.8); key.position.set(2, 4, 3), scene.add(key);
    const grid = new T.GridHelper(12, 60, "#22303c", "#19212a"); grid.position.y = 0, scene.add(grid);
    labelsEl = document.createElement("div"), labelsEl.className = "s3labels", h.appendChild(labelsEl);
    st = { az: .8, el: .32, d: 7.2, t: new T.Vector3(0, .35, 0) };
    const place = () => { const c = Math.cos(st.el); cam.position.set(st.t.x + st.d * c * Math.cos(st.az), st.t.y + st.d * Math.sin(st.el), st.t.z + st.d * c * Math.sin(st.az)), cam.lookAt(st.t) };
    let drag = null;
    const cv = R.domElement;
    cv.addEventListener("pointerdown", e => { drag = [e.clientX, e.clientY, e.button], cv.setPointerCapture(e.pointerId) });
    cv.addEventListener("pointermove", e => { if (!drag) return; const dx = e.clientX - drag[0], dy = e.clientY - drag[1]; if (drag[2] === 2 || e.shiftKey) { const r = new T.Vector3().setFromMatrixColumn(cam.matrix, 0), u = new T.Vector3().setFromMatrixColumn(cam.matrix, 1); st.t.addScaledVector(r, -dx * st.d * .0012).addScaledVector(u, dy * st.d * .0012) } else st.az += dx * .007, st.el = clamp(st.el + dy * .005, -.2, 1.5); drag[0] = e.clientX, drag[1] = e.clientY, place() });
    cv.addEventListener("pointerup", () => drag = null), cv.addEventListener("contextmenu", e => e.preventDefault()), cv.addEventListener("wheel", e => { e.preventDefault(), st.d = clamp(st.d * Math.exp(e.deltaY * .001), 1.5, 20), place() }, { passive: !1 });
    try { if (T.EffectComposer) { comp = new T.EffectComposer(R); if (T.N8AOPass) { const ao = new T.N8AOPass(scene, cam, 400, 300), c = ao.configuration; c.gammaCorrection = !1, c.aoRadius = .25, c.distanceFalloff = 1, c.intensity = 2, c.color = new T.Color(0, 0, 0), ao.setQualityMode("Medium"), c.halfRes = !0, comp.addPass(ao) } else comp.addPass(new T.RenderPass(scene, cam)); comp.addPass(new T.OutputPass()), T.SMAAPass && comp.addPass(new T.SMAAPass(400, 300)) } } catch (e) { comp = null }
    const fit = () => { const r = h.getBoundingClientRect(), w = Math.max(1, r.width), hh = Math.max(1, r.height); R.setSize(w, hh, !1), comp && comp.setSize(w, hh), cam.aspect = w / hh, cam.updateProjectionMatrix() };
    new ResizeObserver(fit).observe(h), fit(), place();
    h.view = v => { Object.assign(st, { iso: { az: .8, el: .32, d: 7.2 }, side: { az: Math.PI / 2, el: .05, d: 7 }, top: { az: .001, el: 1.45, d: 7.5 }, front: { az: 0, el: .12, d: 6 } }[v] || {}), place() };
    return !0
  }
  /* mallas: forro deformable, alerones, ruedas, brazos y la forma sin deformar */
  function buildSkin() {
    if (skin) for (const o of skin.objs) scene.remove(o);
    const S = res.S, nd = S.nodes, sub = 5, ringN = 16, rings = [];
    for (let k = 0; k < STA.length - 1; k++) for (let q = 0; q < sub; q++) rings.push([k, q / sub]);
    rings.push([STA.length - 2, 1]);
    const nr = rings.length, pos = new Float32Array(nr * ringN * 3), col = new Float32Array(nr * ringN * 3), idx = [];
    for (let r = 0; r < nr - 1; r++) for (let j = 0; j < ringN; j++) { const a = r * ringN + j, b = r * ringN + (j + 1) % ringN, c = a + ringN, d = b + ringN; idx.push(a, c, b, b, c, d) }
    const g = new T.BufferGeometry(); g.setAttribute("position", new T.BufferAttribute(pos, 3)), g.setAttribute("color", new T.BufferAttribute(col, 3)), g.setIndex(idx);
    const mat = new T.MeshPhysicalMaterial({ vertexColors: !0, metalness: .2, roughness: .38, clearcoat: .8, side: T.DoubleSide }), mesh = new T.Mesh(g, mat);
    const ghost = new T.LineSegments(new T.BufferGeometry().setAttribute("position", new T.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3)), new T.LineBasicMaterial({ color: "#56616d", transparent: !0, opacity: .5 }));
    /* alerones: cintas con cuerda, de punta a punta pasando por el nudo central */
    const wing = (chord, col0) => { const n = 24, p = new Float32Array(n * 2 * 3), ix = []; for (let i = 0; i < n - 1; i++) { const a = i * 2; ix.push(a, a + 2, a + 1, a + 1, a + 2, a + 3) } const gg = new T.BufferGeometry(); gg.setAttribute("position", new T.BufferAttribute(p, 3)), gg.setIndex(ix); const m = new T.Mesh(gg, new T.MeshPhysicalMaterial({ color: col0, metalness: .3, roughness: .35, clearcoat: 1, side: T.DoubleSide, emissive: "#000" })); return { m, n, chord } };
    const fw = wing(.42, "#2b3036"), rw = wing(.36, "#2b3036");
    const wheels = S.wheels.map(w => { const m = new T.Mesh(new T.TorusGeometry(.26, .1, 16, 40).scale(1, 1, 2.2), new T.MeshStandardMaterial({ color: "#151618", roughness: .85 })); return { w, m } });
    const arms = S.wheels.map(() => new T.Mesh(new T.CylinderGeometry(.018, .018, 1, 10), new T.MeshStandardMaterial({ color: "#8e959c", metalness: .9, roughness: .3 })));
    const pylon = new T.Mesh(new T.CylinderGeometry(.03, .03, 1, 10), new T.MeshStandardMaterial({ color: "#2b3036", metalness: .3, roughness: .35 }));
    const objs = [mesh, ghost, fw.m, rw.m, pylon, ...wheels.map(q => q.m), ...arms];
    for (const o of objs) scene.add(o);
    skin = { mesh, g, rings, ringN, fw, rw, wheels, arms, pylon, objs, ghost };
    /* forma sin deformar en líneas */
    deform(null, 0, !0)
  }
  /* desplazamiento y giro de un nudo (en metros y radianes) escalados */
  function nodeU(u, n, sc) {
    const nd = res.S.nodes[n], g = k => k < nd.dof && u ? u[nd.d0 + k] * sc : 0;
    return [g(0), g(1), g(2), g(3), g(4), g(5)]
  }
  /* interpolación de Hermite entre dos nudos de la columna */
  function spineAt(u, k, f, sc) {
    const S = res.S, A = S.nodes[S.sp[STA[k][0]]], B = S.nodes[S.sp[STA[k + 1][0]]], L = Math.hypot(B.x - A.x, B.z - A.z), ua = nodeU(u, S.sp[STA[k][0]], sc), ub = nodeU(u, S.sp[STA[k + 1][0]], sc);
    const h1 = 1 - 3 * f * f + 2 * f ** 3, h2 = f - 2 * f * f + f ** 3, h3 = 3 * f * f - 2 * f ** 3, h4 = -f * f + f ** 3;
    const ux = ua[0] + (ub[0] - ua[0]) * f, uy = h1 * ua[1] + h2 * L * ua[5] + h3 * ub[1] + h4 * L * ub[5], uz = h1 * ua[2] - h2 * L * ua[4] + h3 * ub[2] - h4 * L * ub[4], rx = ua[3] + (ub[3] - ua[3]) * f;
    return { x: A.x + (B.x - A.x) * f, z: A.z + (B.z - A.z) * f, ux, uy, uz, rx }
  }
  function deform(u, sc, ghostOnly) {
    const S = res.S, sk = skin, pos = sk.g.attributes.position.array, col = sk.g.attributes.color.array, ringN = sk.ringN;
    let Umax = 1e-30;
    for (const e of S.els) e.U > Umax && (Umax = e.U);
    const ghostPts = [];
    sk.rings.forEach(([k, f], r) => {
      const a = STA[k], b = STA[k + 1], hw = a[1] + (b[1] - a[1]) * f, hh = a[2] + (b[2] - a[2]) * f, dz = a[3] + (b[3] - a[3]) * f, s = spineAt(ghostOnly ? null : u, k, f, sc);
      /* energía de deformación del elemento de esta estación */
      const el = S.els.find(e => e.a === S.sp[a[0]] && e.b === S.sp[b[0]]), heat = el && !ghostOnly ? Math.sqrt(el.U / Umax) : 0, c = heatCol(heat);
      for (let j = 0; j < ringN; j++) {
        const th = j / ringN * TAU, cy = Math.cos(th), sy = Math.sin(th), ox = Math.sign(cy) * Math.pow(Math.abs(cy), .55) * hw, oz = Math.sign(sy) * Math.pow(Math.abs(sy), .55) * hh / 2 + dz;
        /* giro pequeño alrededor de x (torsión) */
        const y = ox * Math.cos(s.rx) - oz * Math.sin(s.rx), z = ox * Math.sin(s.rx) + oz * Math.cos(s.rx), v = X3(s.x + s.ux, y + s.uy, s.z + z + s.uz), i = (r * ringN + j) * 3;
        pos[i] = v.x, pos[i + 1] = v.y, pos[i + 2] = v.z, col[i] = c.r, col[i + 1] = c.g, col[i + 2] = c.b;
        ghostOnly && j % 4 === 0 && r > 0 && ghostPts.push(...[pos[i - ringN * 3], pos[i - ringN * 3 + 1], pos[i - ringN * 3 + 2], v.x, v.y, v.z])
      }
    });
    sk.g.attributes.position.needsUpdate = !0, sk.g.attributes.color.needsUpdate = !0, sk.g.computeVertexNormals();
    if (ghostOnly) { const gg = new T.BufferGeometry(); gg.setAttribute("position", new T.Float32BufferAttribute(ghostPts, 3)), sk.ghost.geometry.dispose(), sk.ghost.geometry = gg }
    /* alerones */
    const wingSet = (W, center, tips, x0, z0) => {
      const p = W.m.geometry.attributes.position.array, uc = nodeU(u, center, sc), ut = tips.map(t => nodeU(u, t, sc)), C = S.nodes[center], Tn = tips.map(t => S.nodes[t]);
      for (let i = 0; i < W.n; i++) {
        const f = i / (W.n - 1) * 2 - 1, side = f < 0 ? 0 : 1, a = Math.abs(f), tp = Tn[side], uu = ut[side];
        /* flexión de voladizo: forma cúbica entre el centro y la punta */
        const sh = 3 * a * a - 2 * a ** 3, y = C.y + (tp.y - C.y) * a, z = C.z + (tp.z - C.z) * a, wz = uc[2] + (uu[2] - uc[2]) * sh + uc[3] * (y - C.y), wx = uc[0] + (uu[0] - uc[0]) * a, rot = uc[4] + (uu[4] - uc[4]) * a;
        for (const q of [0, 1]) { const cx = (q ? -W.chord : 0) + x0, v = X3(C.x + cx + wx, y + uc[1], z + wz - cx * Math.sin(rot) * 0), j = (i * 2 + q) * 3; p[j] = v.x, p[j + 1] = v.y, p[j + 2] = v.z }
      }
      W.m.geometry.attributes.position.needsUpdate = !0, W.m.geometry.computeVertexNormals()
    };
    wingSet(sk.fw, S.sp[0], S.fwT, .1, 0), wingSet(sk.rw, S.sp[14], S.rwT, .15, 0);
    /* los alerones y el pilón también se colorean con su energía de deformación */
    for (const [W, grp] of [[sk.fw, "fw"], [sk.rw, "rw"], [sk.pylon, "pylon"]]) { const Ue = ghostOnly ? 0 : Math.max(...S.els.filter(e => e.grp === grp).map(e => e.U)), c = heatCol(Math.sqrt(Ue / Umax)); W.m ? W.m.material.color.setRGB(c.r, c.g, c.b) : W.material.color.setRGB(c.r, c.g, c.b) }
    /* pilón, brazos y ruedas */
    const P = n => { const nd = S.nodes[n], q = nodeU(u, n, sc); return X3(nd.x + q[0], nd.y + q[1], nd.z + q[2]) };
    const place = (m, a, b) => { const d = b.clone().sub(a), L = d.length(); m.position.copy(a).addScaledVector(d, .5), m.scale.set(1, L, 1), m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()) };
    place(sk.pylon, P(S.sp[13]), P(S.sp[14]));
    S.wheels.forEach((w, i) => { place(sk.arms[i], P(w.front ? S.sp[3] : S.sp[12]), P(w.pk)), sk.wheels[i].m.position.copy(P(w.n)) })
  }
  const heatCol = t => { t = clamp(t, 0, 1); const s = [[.18, .22, .27], [.24, .55, 1], [.18, .82, .42], [1, .82, .25], [1, .42, .1], [1, .23, .23]], x = t * (s.length - 1), i = Math.min(s.length - 2, x | 0), f = x - i; return { r: s[i][0] + (s[i + 1][0] - s[i][0]) * f, g: s[i][1] + (s[i + 1][1] - s[i][1]) * f, b: s[i][2] + (s[i + 1][2] - s[i][2]) * f } };
  /* ---------- cálculo ---------- */
  function compute() {
    const p = { ...prm.v, nModes: 30 };
    res = CM().run(p), res.p = p;
    const M = res.modes, find = re => M.find(m => re.test(m.name)), tors = find(/^Torsión/), bv = find(/^Flexión vertical/), bl = find(/^Flexión lateral/), fw = find(/^Alerón delantero/), rw = find(/^Alerón trasero/), hopF = find(/delantero (en fase|en oposición)/), hopR = find(/trasero (en fase|en oposición)/), heave = find(/^Bote/), pitch = find(/^Cabeceo/), roll = find(/^Balanceo/);
    const kRoll = (p.kwf * 1e3 * p.trf ** 2 / 2 + p.kwr * 1e3 * p.trr ** 2 / 2) * DEG, ratio = res.tor.k / kRoll;
    res.kRoll = kRoll, res.ratio = ratio;
    ro.set("ktor", res.tor.k / 1e3, 1, res.tor.k < 2e4 ? "bad" : res.tor.k < 3e4 ? "warn" : "ok"), ro.set("kben", res.ben.k / 1e6, 1), ro.set("mass", res.mass, 0), ro.set("wf", res.xcg / 3.6 * 100, 1);
    ro.set("ratio", ratio, 1, ratio < 2.5 ? "bad" : ratio < 3.2 ? "warn" : "ok"), ro.set("fh", heave ? heave.f : NaN, 1), ro.set("fp", pitch ? pitch.f : NaN, 1), ro.set("fr", roll ? roll.f : NaN, 1);
    ro.set("fhf", hopF ? hopF.f : NaN, 1), ro.set("fhr", hopR ? hopR.f : NaN, 1), ro.set("ft", tors ? tors.f : NaN, 0), ro.set("fbv", bv ? bv.f : NaN, 0), ro.set("fbl", bl ? bl.f : NaN, 0), ro.set("ffw", fw ? fw.f : NaN, 1), ro.set("frw", rw ? rw.f : NaN, 1);
    const fk = p.speed / 3.6 / p.kerb;
    let pk = 0, pf = 0; for (let i = 0; i < res.frf.f.length; i++) res.frf.H[i] > pk && (pk = res.frf.H[i], pf = res.frf.f[i]);
    ro.set("fk", fk, 1), ro.set("frfpk", pk, 2), ro.set("frff", pf, 1);
    res.fk = fk;
    modeList(), drawPlots(), twistTable(), verdict();
    skin && buildSkin()
  }
  function modeList() {
    $("chModes").innerHTML = `<button class="btn ${view === "tors" ? "on" : ""}" data-cv="tors">Banco de torsión</button><button class="btn ${view === "bend" ? "on" : ""}" data-cv="bend">Flexión</button>` + res.modes.map((m, i) => `<button class="btn mode ${view === "mode" && sel === i ? "on" : ""} k-${m.kind}" data-mi="${i}"><b>${m.f.toFixed(1)} Hz</b> ${m.name}</button>`).join("");
    $("chModes").querySelectorAll("[data-mi]").forEach(b => b.onclick = () => { sel = +b.dataset.mi, view = "mode", modeList() });
    $("chModes").querySelectorAll("[data-cv]").forEach(b => b.onclick = () => { view = b.dataset.cv, modeList() })
  }
  function drawPlots() {
    const F = res.frf, n = F.f.length, vl = res.modes.filter(m => m.f < 150 && m.kind !== "rigid").map(m => ({ x: m.f, col: m.kind === "wheel" ? "rgba(61,139,255,.35)" : "rgba(255,107,26,.35)" }));
    vl.push({ x: res.fk, col: "#ffd23f", label: "bordillo" });
    plots.frf.draw([{ x: F.f, y: F.H, n, col: "#ff3b3b", label: "Aceleración en el asiento por mm de bordillo (g/mm)" }], { title: "Respuesta en frecuencia", xlabel: "Hz", vlines: vl });
    const tw = res.tor.twist, m = tw.length, x = Float32Array.from(tw.map(t => t.x)), a = Float32Array.from(tw.map(t => Math.abs(t.a) / DEG * 1e3 * 1e4 / res.tor.T));
    plots.tw.draw([{ x, y: a, n: m, col: "#3d8bff", label: "Giro de cada sección (milésimas de grado por 10 kN·m)" }], { title: "Dónde se retuerce el coche", xlabel: "x (m, 0 = eje trasero)", points: tw.map((t, i) => ({ x: t.x, y: a[i], col: "#3d8bff" })) })
  }
  function twistTable() {
    const S = res.S, tw = res.tor.twist, seg = [["Morro y mamparo delantero", 3, 2], ["Monocasco (pies)", 3, 5], ["Habitáculo abierto", 5, 7], ["Depósito hasta mamparo", 7, 8], ["Espárragos motor-chasis", 8, 9], ["Bloque motor", 9, 10], ["Unión motor-caja", 10, 11], ["Carcasa de la caja", 11, 12]];
    const tot = Math.abs(tw[3].a - tw[12].a), rows = seg.slice(1).map(([nm, a, b]) => [nm, Math.abs(tw[a].a - tw[b].a) / tot * 100]);
    $("chTwist").innerHTML = `<b>Reparto de la flexibilidad a torsión entre los ejes</b>` + rows.map(([nm, p]) => `<div><span>${nm}</span><i style="width:${p.toFixed(0)}%"></i><em>${p.toFixed(0)} %</em></div>`).join("")
  }
  function verdict() {
    const out = [], M = res.modes, p = res.p, near = (f, g, tol) => Math.abs(f - g) / g < tol;
    res.ratio < 3.2 ? out.push([res.ratio < 2.5 ? "bad" : "warn", "Torsión", `El chasis solo es ${res.ratio.toFixed(1)} veces más rígido que la suspensión al balanceo: el reparto de carga entre ejes deja de depender de los muelles y el coche se vuelve impredecible.`]) : out.push(["ok", "Torsión", `${(res.tor.k / 1e3).toFixed(0)} kN·m/°: ${res.ratio.toFixed(0)} veces la rigidez al balanceo de la suspensión. La puesta a punto manda.`]);
    const fwm = M.find(m => /^Alerón delantero/.test(m.name)), hop = M.find(m => /^Salto de rueda delantero/.test(m.name));
    fwm && hop && near(fwm.f, hop.f, .12) ? out.push(["warn", "Alerón delantero", `Su modo (${fwm.f.toFixed(0)} Hz) coincide con el salto de rueda delantero (${hop.f.toFixed(0)} Hz): los baches lo hacen aletear y cambia la carga.`]) : fwm && out.push(["ok", "Alerón delantero", `Primer modo a ${fwm.f.toFixed(0)} Hz, separado del salto de rueda.`]);
    const hit = M.find(m => m.kind !== "rigid" && near(m.f, res.fk, .08));
    hit ? out.push(["warn", "Bordillos", `A ${p.speed} km/h el bordillo golpea a ${res.fk.toFixed(0)} Hz, justo en «${hit.name}» (${hit.f.toFixed(0)} Hz). Cambia de velocidad o de trazada.`]) : out.push(["ok", "Bordillos", `El bordillo excita a ${res.fk.toFixed(0)} Hz, lejos de los modos del coche.`]);
    const tm = M.find(m => /^Torsión/.test(m.name));
    tm && tm.name.includes("uniones") ? out.push(["warn", "Uniones del motor", "Más de un cuarto de la energía del modo de torsión está en los espárragos motor-chasis y motor-caja: es el eslabón débil."]) : out.push(["ok", "Uniones del motor", "Las uniones atornilladas no dominan la torsión."]);
    $("chVerdict").innerHTML = out.map(([s, t, d]) => `<div class="vd ${s}"><b>${t}</b><span>${d}</span></div>`).join("")
  }
  /* ---------- animación ---------- */
  let t0 = performance.now(), fn = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    if (!res || !skin || host.hidden) return;
    const t = (now - t0) / 1e3;
    let u, sc, info;
    if (view === "tors") u = res.tor.u, sc = 120 * amp * (.55 + .45 * Math.sin(t * 2.4)), info = `<b>Banco de torsión</b>: ruedas traseras empotradas, ${(res.tor.T / 1e3).toFixed(1)} kN·m en las delanteras → ${(res.tor.ang / DEG).toFixed(3)}° · ${(res.tor.k / 1e3).toFixed(1)} kN·m/° · deformación ×120`;
    else if (view === "bend") u = res.ben.u, sc = 60 * amp * (.55 + .45 * Math.sin(t * 2.4)), info = `<b>Flexión</b>: apoyado en los ejes, 10 kN en el habitáculo · ${(res.ben.k / 1e6).toFixed(1)} kN/mm · deformación ×60`;
    else {
      const m = res.modes[sel];
      /* normaliza para que el mayor desplazamiento sea ~12 cm en pantalla */
      let mx = 1e-9; for (const nd of res.S.nodes) for (let k = 0; k < 3; k++) mx = Math.max(mx, Math.abs(m.phi[nd.d0 + k]));
      u = m.phi, sc = .12 / mx * amp * Math.sin(t * TAU * .9);
      info = `<b>Modo ${sel + 1}: ${m.name}</b> · ${m.f.toFixed(1)} Hz · animación ralentizada · color = energía de deformación · gris: forma sin deformar`
    }
    if (u !== loop.u) { for (const e of res.S.els) e.U = 0; if (view === "mode") CM().modes && classifyU(res.modes[sel]); else energyOf(u); loop.u = u }
    deform(u, sc, !1);
    ++fn % 10 === 0 && ($("chInfo").innerHTML = info + `<br><span>Arrastra para girar · rueda para acercar · botón derecho para desplazar</span>`);
    comp ? comp.render() : R.render(scene, cam)
  }
  /* energía por elemento para colorear (modo o caso estático) */
  function energyOf(u) {
    const S = res.S;
    for (const e of S.els) {
      const A = S.nodes[e.a], B = S.nodes[e.b], R0 = e.R, ul = new Float64Array(12), gv = (nd, k) => k < nd.dof ? u[nd.d0 + k] : 0;
      for (let blk = 0; blk < 4; blk++) { const nd = blk < 2 ? A : B, off = blk % 2 * 3; for (let i = 0; i < 3; i++) { let s = 0; for (let j = 0; j < 3; j++) s += R0[i][j] * gv(nd, off + j); ul[blk * 3 + i] = s } }
      let s = 0; for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) s += ul[i] * e.kl[i][j] * ul[j];
      e.U = s / 2 / Math.max(.05, e.L)
    }
  }
  function classifyU(m) { energyOf(m.phi) }
  function init(el0) {
    host = el0;
    host.innerHTML = `
    <div class="labhead"><div><h2>Chasis y vibraciones</h2><p class="sub">El coche entero como estructura de vigas: monocasco de carbono, motor y caja portantes, alerones, suspensión y neumáticos. Modos propios, banco de torsión y respuesta a los bordillos.</p></div>
      <div class="presets" id="chPre"></div></div>
    <div class="labgrid">
      <aside class="params" id="chParams"></aside>
      <section class="views">
        <div class="vrow"><div class="s3host" id="ch3d"><div class="s3info" id="chInfo"></div></div><div class="verdict" id="chVerdict"></div></div>
        <div class="ctrl"><label>Amplitud <input type="range" id="chAmp" min=".2" max="3" step=".1" value="1" style="width:120px;vertical-align:middle"></label><span class="s3views"><span>Vista</span><button class="btn" data-chv="iso">3/4</button><button class="btn" data-chv="side">Lateral</button><button class="btn" data-chv="top">Planta</button><button class="btn" data-chv="front">Frontal</button></span></div>
        <div class="modelist" id="chModes"></div>
        <div class="readouts" id="chRo"></div>
        <div class="pgrid"><canvas id="chFrf"></canvas><canvas id="chTw"></canvas></div>
        <div class="loadtbl twtbl" id="chTwist"></div>
      </section></div>`;
    prm = new Params($("chParams"), DEF, () => { clearTimeout(init.t), init.t = setTimeout(compute, 200) });
    const pre = $("chPre");
    for (const k in PRESETS) pre.appendChild(el("button", { class: "btn", text: PRESETS[k].name, onclick: () => { prm.set(Object.fromEntries(DEF.flatMap(g => g.items.map(i => [i.id, i.v]))), !0), prm.set(PRESETS[k].v), compute() } }));
    ro = new Readouts($("chRo"), [
      { id: "ktor", label: "Rigidez a torsión", unit: "kN·m/°" }, { id: "kben", label: "Rigidez a flexión", unit: "kN/mm" }, { id: "ratio", label: "Torsión / balanceo de la suspensión", unit: "×" },
      { id: "mass", label: "Masa", unit: "kg" }, { id: "wf", label: "Peso delante", unit: "%" }, { id: "fh", label: "Bote", unit: "Hz" }, { id: "fp", label: "Cabeceo", unit: "Hz" }, { id: "fr", label: "Balanceo", unit: "Hz", adv: !0 },
      { id: "fhf", label: "Salto de rueda delantero", unit: "Hz" }, { id: "fhr", label: "Salto de rueda trasero", unit: "Hz", adv: !0 }, { id: "ffw", label: "Alerón delantero", unit: "Hz" }, { id: "frw", label: "Alerón trasero", unit: "Hz", adv: !0 },
      { id: "fbv", label: "Flexión vertical", unit: "Hz", adv: !0 }, { id: "fbl", label: "Flexión lateral", unit: "Hz", adv: !0 }, { id: "ft", label: "Torsión del chasis", unit: "Hz" },
      { id: "fk", label: "Frecuencia del bordillo", unit: "Hz" }, { id: "frfpk", label: "Pico de respuesta en el asiento", unit: "g/mm", adv: !0 }, { id: "frff", label: "a la frecuencia de", unit: "Hz", adv: !0 }
    ]);
    plots.frf = new Plot($("chFrf")), plots.tw = new Plot($("chTw"));
    $("chAmp").oninput = e => amp = +e.target.value;
    document.querySelectorAll("[data-chv]").forEach(b => b.onclick = () => $("ch3d").view && $("ch3d").view(b.dataset.chv));
    window.addEventListener("labmode", () => setTimeout(() => { for (const p of Object.values(plots)) p.fit(); res && drawPlots() }, 50));
    compute();
    init3d($("ch3d")) && buildSkin();
    requestAnimationFrame(loop)
  }
  return { init }
})();
