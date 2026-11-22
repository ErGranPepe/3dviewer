/* ===================== SUSPENSIÓN EN 3D (CONJUNTO CAD) =====================
   Eje delantero completo con las piezas de LAB.suspcad colocadas sobre la cinemática 3D de puntos duros (LAB.kin3d):
   cada sólido (trapecios, mangueta, balancín) se mueve como un cuerpo rígido; las barras con rótulas (bieletas,
   amortiguador) se orientan entre sus dos puntos; cremallera con fuelles, barra estabilizadora de láminas con sus
   bieletas, tercer elemento con muelle y topes, monocasco, firme y flechas de fuerza en la huella.
   Herramientas: vista explosionada, rayos X, corte longitudinal, selección de piezas con su ficha (material, masa,
   función y valores en vivo) y comprobaciones de montaje (desalineaciones, holguras, tornillos, pandeo). */
LAB.susp3d = (() => {
  let T, R, scene, cam, host, st, parts = null, ex = 3, labelsEl, pickEl, opts = { steer: 0, discT: 450, explode: 0, xray: !1, cut: !1, duct: !0, show: { loads: !0 } };
  let C = null, axle = null, picked = null, clip = null, lastChecks = null, sweep = null, sweepRack = .045;
  const CAD = () => LAB.suspcad;
  const heat = t => { t = clamp(t, 0, 1); const s = [[61, 139, 255], [47, 209, 108], [255, 210, 63], [255, 107, 26], [255, 59, 59]], x = t * (s.length - 1), i = Math.min(s.length - 2, x | 0), f = x - i; return new T.Color(...[0, 1, 2].map(k => (s[i][k] + (s[i + 1][k] - s[i][k]) * f) / 255)) };
  const forceCol = f => f >= 0 ? new T.Color().setHSL(.6, .85, .35 + .3 * Math.min(1, f / 2e4)) : new T.Color().setHSL(0, .85, .35 + .3 * Math.min(1, -f / 2e4));
  let M;
  function init(h) {
    T = window.THREE, host = h;
    if (!T || !LAB.kin3d || !LAB.suspcad || !T.BufferGeometryUtils) return !1;
    M = CAD().init(T);
    R = new T.WebGLRenderer({ antialias: !0 }), R.setPixelRatio(Math.min(2, devicePixelRatio || 1)), R.outputColorSpace = T.SRGBColorSpace, R.toneMapping = T.ACESFilmicToneMapping, R.toneMappingExposure = 1.05, R.shadowMap.enabled = !0, R.shadowMap.type = T.PCFSoftShadowMap, R.localClippingEnabled = !0;
    host.appendChild(R.domElement), R.domElement.className = "s3cv";
    scene = new T.Scene(), scene.background = new T.Color("#0c0f13"), cam = new T.PerspectiveCamera(30, 1, .01, 30);
    /* entorno de estudio: techo de luz y paneles laterales para reflejos en metal y carbono */
    const pm = new T.PMREMGenerator(R), envS = new T.Scene();
    envS.add(new T.Mesh(new T.BoxGeometry(20, 10, 20), new T.MeshBasicMaterial({ color: "#2b3138", side: T.BackSide })));
    for (const [x, y, z, c, w, hh] of [[0, 4.8, 0, 7, 8, 3], [-9, 2, 3, 3.5, 5, 2], [9, 2, -3, 2.6, 5, 2], [0, 1.5, 9, 1.6, 9, 1.2], [0, .3, -9, 1.2, 9, .6]]) { const p = new T.Mesh(new T.PlaneGeometry(w, hh), new T.MeshBasicMaterial({ color: new T.Color(c, c, c) })); p.position.set(x, y, z), p.lookAt(0, 0, 0), envS.add(p) }
    scene.environment = pm.fromScene(envS, .03).texture;
    scene.add(new T.HemisphereLight("#dfe7ef", "#1a1f26", .45));
    const key = new T.DirectionalLight("#fff3e2", 2.4);
    key.position.set(1.4, 2.8, 1.6), key.castShadow = !0, key.shadow.mapSize.set(2048, 2048), key.shadow.bias = -2e-4, key.shadow.normalBias = .01, Object.assign(key.shadow.camera, { left: -1.3, right: 1.3, top: 1.3, bottom: -1.3 }), scene.add(key);
    const rim = new T.DirectionalLight("#9cc4ff", .8); rim.position.set(-2, 1, -1.5), scene.add(rim);
    const floor = new T.Mesh(new T.PlaneGeometry(8, 8), new T.MeshStandardMaterial({ color: "#14181d", roughness: .92 }));
    floor.rotation.x = -Math.PI / 2, floor.position.y = -.002, floor.receiveShadow = !0, scene.add(floor);
    const grid = new T.GridHelper(8, 160, "#1f2a35", "#171d24");
    grid.position.y = -.001, scene.add(grid);
    /* monocasco delantero (sección que se estrecha hacia el morro) */
    const mono = new T.Mesh(new T.CylinderGeometry(.21, .3, 1.5, 4, 1, !0).rotateY(Math.PI / 4).rotateZ(Math.PI / 2), M.mono);
    mono.scale.set(1, 1.15, .95), mono.position.set(-.35, .38, 0), scene.add(mono);
    const nose = new T.Mesh(new T.CylinderGeometry(.06, .19, 1.1, 4, 1, !0).rotateY(Math.PI / 4).rotateZ(Math.PI / 2), M.mono);
    nose.position.set(.9, .3, 0), scene.add(nose);
    parts = { mono, nose, pads: {}, arrows: {} };
    /* el coche del simulador en transparencia: la suspensión se ve dentro de su carrocería real */
    LAB.carmesh && LAB.carmesh.load().then(d => {
      if (!d) return;
      const ghost = LAB.carmesh.build(T, d, { ghost: .14, filter: m => m.g === "static" && !/ti|tyre|rim|disc|gold/.test(m.m || "") });
      ghost.position.x = -1.7 * LAB.car.mx, ghost.traverse(o => o.isMesh && (o.renderOrder = 2, o.userData.ghost = 1)), scene.add(ghost);
      parts.car = ghost, mono.visible = nose.visible = !1, parts.mono = parts.nose = ghost
    });
    for (const sd of ["L", "R"]) {
      parts.pads[sd] = new T.Mesh(new T.BoxGeometry(.55, .012, .42), new T.MeshStandardMaterial({ color: "#2c333b", roughness: .9 })), scene.add(parts.pads[sd]);
      parts.pads[sd + "k"] = new T.Mesh(new T.BoxGeometry(.55, 1, .42), new T.MeshStandardMaterial({ color: "#d63a2f", roughness: .7 })), scene.add(parts.pads[sd + "k"]);
      parts.arrows[sd] = ["#2fd16c", "#3d8bff", "#ff6b1a"].map(col => { const a = new T.ArrowHelper(new T.Vector3(0, 1, 0), new T.Vector3(), .2, col, .05, .03); scene.add(a); return a })
    }
    labelsEl = document.createElement("div"), labelsEl.className = "s3labels", host.appendChild(labelsEl);
    pickEl = document.createElement("div"), pickEl.className = "s3pick", pickEl.hidden = !0, host.appendChild(pickEl);
    st = { az: .55, el: .28, d: 2.9, t: new T.Vector3(.05, .32, 0) };
    const place = () => { const c = Math.cos(st.el); cam.position.set(st.t.x + st.d * c * Math.cos(st.az), st.t.y + st.d * Math.sin(st.el), st.t.z + st.d * c * Math.sin(st.az)), cam.lookAt(st.t) };
    let drag = null, moved = 0;
    const cv = R.domElement;
    cv.addEventListener("pointerdown", e => { drag = [e.clientX, e.clientY, e.button], moved = 0, cv.setPointerCapture(e.pointerId) });
    cv.addEventListener("pointermove", e => {
      if (!drag) return;
      const dx = e.clientX - drag[0], dy = e.clientY - drag[1];
      moved += Math.abs(dx) + Math.abs(dy);
      if (drag[2] === 2 || e.shiftKey) { const r = new T.Vector3().setFromMatrixColumn(cam.matrix, 0), u = new T.Vector3().setFromMatrixColumn(cam.matrix, 1); st.t.addScaledVector(r, -dx * st.d * .0012).addScaledVector(u, dy * st.d * .0012) }
      else st.az += dx * .007, st.el = clamp(st.el + dy * .005, -.25, 1.45);
      drag[0] = e.clientX, drag[1] = e.clientY, place()
    });
    cv.addEventListener("pointerup", e => { drag && moved < 5 && e.button === 0 && pick(e), drag = null });
    cv.addEventListener("contextmenu", e => e.preventDefault()), cv.addEventListener("wheel", e => { e.preventDefault(), st.d = clamp(st.d * Math.exp(e.deltaY * .001), .25, 8), place() }, { passive: !1 });
    const fit = () => { const r = host.getBoundingClientRect(); R.setSize(r.width, r.height, !1), cam.aspect = r.width / Math.max(1, r.height), cam.updateProjectionMatrix() };
    new ResizeObserver(fit).observe(host), fit(), place();
    host.view = (v) => { Object.assign(st, { all: { az: .55, el: .28, d: 2.9, t: new T.Vector3(.05, .32, 0) }, corner: { az: -.75, el: .22, d: 1.2, t: new T.Vector3(0, .3, .62) }, inside: { az: -2.45, el: .32, d: .62, t: new T.Vector3(-.02, .34, .62) }, brake: { az: -.98, el: .16, d: .56, t: new T.Vector3(0, .33, .7) }, rocker: { az: 2.3, el: .62, d: .62, t: new T.Vector3(-.06, .56, .12) }, top: { az: .01, el: 1.4, d: 2.6, t: new T.Vector3(0, .3, 0) }, steer: { az: Math.PI - .4, el: .5, d: 1.7, t: new T.Vector3(-.1, .36, 0) } }[v] || {}), st.t = st.t.clone(), place() };
    clip = new T.Plane(new T.Vector3(-1, 0, 0), 0);
    host.cam = (az, el, d, x, y, z) => { Object.assign(st, { az, el, d, t: new T.Vector3(x, y, z) }), place() };
    return !0
  }
  function setEx(v) { ex = v }
  function setOpts(o) {
    Object.assign(opts, o);
    if (!parts) return;
    parts.mono.visible = parts.nose.visible = !opts.xray;
    parts.car && (parts.car.visible = !opts.xray);
    M.duct.opacity = opts.xray ? .12 : .5, M.duct.visible = opts.duct;
    const tyOp = opts.xray ? .25 : 1;
    C && ["L", "R"].forEach(k => { const t = C[k].tyre.material; t.transparent = tyOp < 1, t.opacity = tyOp, t.depthWrite = tyOp >= 1; C[k].rim.material.transparent = opts.xray, C[k].rim.material.opacity = opts.xray ? .35 : 1 });
    /* corte longitudinal por el centro de la rueda */
    const planes = opts.cut ? [clip] : [];
    scene.traverse(ob => { if (ob.material && ob.material !== M.vent) { const ms = Array.isArray(ob.material) ? ob.material : [ob.material]; ms.forEach(m => { m.clippingPlanes = planes, m.clipShadows = !0, m.needsUpdate = !0 }) } })
  }
  /* θ del trapecio inferior para un recorrido s (interpolando la tabla) */
  function thetaFor(K, s) {
    const raw = K.raw, sx = clamp(s, raw[0].sw, raw[raw.length - 1].sw);
    let lo = 0, hi = raw.length - 1;
    for (; hi - lo > 1;) { const m = (lo + hi) >> 1; raw[m].sw < sx ? lo = m : hi = m }
    const a = raw[lo], b = raw[hi], t = (sx - a.sw) / (b.sw - a.sw || 1e-9);
    return a.th + (b.th - a.th) * t
  }
  /* ---------- piezas del eje: cremallera, estabilizadora, tercer elemento ---------- */
  function buildAxle(K) {
    if (axle) { scene.remove(axle.root); axle.root.traverse(o => o.geometry && o.geometry.dispose()) }
    const root = new T.Group(); scene.add(root);
    const A = { root }, S = CAD(), g = K.g3;
    const add = (geo, mat, info) => { const o = S.mesh(geo, mat, info); root.add(o); info && (o.userData.part = info); return o };
    /* cremallera: carcasa fija y barra que se desplaza, fuelles hasta las rótulas interiores */
    const tiR = S.W(g.TI, 1), tiL = S.W(g.TI, -1), hw = Math.abs(tiR.z) - .06;
    A.rack = add(S.put(S.cyl(.024, hw * 2, 28), new T.Vector3(tiR.x, tiR.y, 0), new T.Vector3(0, 0, 1)), M.alu, { name: "Carcasa de la cremallera", mat: "Aluminio mecanizado", kg: 1.4, info: "Piñón y cremallera con asistencia hidráulica. Relación ≈ 0,3 mm de cremallera por grado de volante." });
    for (const sz of [-1, 1]) add(S.put(S.lugGeo(.03, .035, .005, .008).rotateX(Math.PI), new T.Vector3(tiR.x, tiR.y - .02, sz * hw * .7), new T.Vector3(0, 1, 0)), M.bracket);
    A.bar = add(S.cyl(.011, 1, 20), M.steel, { name: "Barra de la cremallera", mat: "Acero", kg: .5, info: "Se desplaza lateralmente al girar el volante." });
    const bootProf = []; for (let i = 0; i <= 16; i++) bootProf.push([i % 2 ? .02 : .015, i / 16]);
    A.boots = [-1, 1].map(() => add(S.lathe(bootProf, 20), M.boot, { name: "Fuelle de la cremallera", mat: "Elastómero", kg: .03, info: "Protege la cremallera del polvo de frenos y de los restos de goma." }));
    A.innerJ = [-1, 1].map(() => add(new T.SphereGeometry(.014, 16, 12), M.steel));
    A.pinion = add(S.put(S.cyl(.02, .07, 20), new T.Vector3(tiR.x - .02, tiR.y + .04, .03), new T.Vector3(-.4, 1, 0).normalize()), M.alu);
    A.col = add(S.cyl(.012, 1, 16), M.steel, { name: "Columna de dirección", mat: "Acero con junta cardán", kg: .8, info: "" });
    A.sw = new T.Group(); root.add(A.sw);
    const swBody = new T.Mesh(new T.BoxGeometry(.03, .16, .27), new T.MeshPhysicalMaterial({ color: "#1b1e22", metalness: .3, roughness: .4, clearcoat: 1 }));
    const scr = new T.Mesh(new T.PlaneGeometry(.1, .055), new T.MeshBasicMaterial({ color: "#2fd16c" }));
    scr.rotation.y = -Math.PI / 2, scr.position.x = -.017, A.sw.add(swBody, scr), swBody.userData.part = { name: "Volante", mat: "Carbono con pantalla y mandos", kg: 1.3, info: "Giro de tope a tope ≈ 360°." };
    /* barra estabilizadora de lámina: tubo transversal con láminas giratorias y bieletas a cada balancín */
    const rpR = S.W(g.RP, 1), ax = rpR.x - .11, ay = rpR.y + .06, az = Math.abs(rpR.z) - .02;
    A.arbTube = add(S.put(S.cyl(.011, az * 2, 24), new T.Vector3(ax, ay, 0), new T.Vector3(0, 0, 1)), M.tiDark.clone(), { name: "Barra estabilizadora (tubo de torsión)", mat: "Titanio β", kg: .5, info: "Se retuerce solo cuando las dos ruedas suben distinto (balanceo); su rigidez reparte la transferencia de carga entre ejes." });
    A.arbC = new T.Vector3(ax, ay, 0), A.arbZ = az;
    A.blades = [-1, 1].map(sd => { const gr = new T.Group(); gr.position.set(ax, ay, sd * az), root.add(gr); const b = new T.Mesh(new T.BoxGeometry(.075, .007, .03).translate(.0375, 0, 0), M.aluBlk); b.castShadow = !0, b.userData.part = { name: "Lámina de la estabilizadora", mat: "Acero de muelle", kg: .08, info: "Girar la lámina de plano a canto cambia su rigidez a flexión: así se ajusta la barra sin desmontarla." }; gr.add(b, new T.Mesh(S.cyl(.016, .02, 20).rotateX(Math.PI / 2), M.ti)); return { gr, b } });
    A.drops = [-1, 1].map(() => add(S.cyl(.004, 1, 12), M.steel, { name: "Bieleta de la estabilizadora", mat: "Titanio con rótulas", kg: .05, info: "" }));
    A.dropEnds = [0, 1, 2, 3].map(() => add(new T.SphereGeometry(.007, 12, 10), M.steel));
    /* tercer elemento (heave): amortiguador con muelle helicoidal y topes, entre los dos balancines */
    A.heaveBody = add(S.cyl(.018, 1, 24), M.damper, { name: "Tercer elemento (heave)", mat: "Amortiguador con muelle helicoidal y topes de elastómero", kg: .9, info: "Solo trabaja cuando las dos ruedas suben a la vez: controla la altura bajo carga aerodinámica sin endurecer el balanceo." });
    A.heaveRod = add(S.cyl(.006, 1, 16), M.chrome);
    const coil = []; for (let i = 0; i <= 160; i++) { const a = i / 160 * Math.PI * 2 * 7; coil.push(new T.Vector3(Math.cos(a) * .024, i / 160 - .5, Math.sin(a) * .024)) }
    A.coil = add(new T.TubeGeometry(new T.CatmullRomCurve3(coil), 320, .0035, 6), M.spring, { name: "Muelle del tercer elemento", mat: "Acero al cromo-silicio", kg: .25, info: "" });
    A.stops = [0, 1].map(() => add(S.cyl(.02, .012, 18), M.stop, { name: "Tope (packer)", mat: "Elastómero", kg: .01, info: "Cuando el recorrido llega al hueco del tope, la rigidez sube de golpe y protege el fondo." }));
    return A
  }
  function placeCyl(o, a, b, r) { const d = b.clone().sub(a), L = d.length(); o.matrixAutoUpdate = !1; o.matrix.copy(CAD().basisM(new T.Vector3(1, 0, 0), d, a.clone().lerp(b, .5))).multiply(new T.Matrix4().makeScale(1, Math.max(1e-4, L), 1)) }
  /* lleva un punto fijo al balancín: posición actual a partir de la estática */
  function rockerPt(Ac, local0) { return local0.clone().applyMatrix4(Ac.groups.rk.matrix) }
  function updateAxle(K, a, b, rack) {
    const S = CAD(), A = axle, AL = C.L, AR = C.R;
    const tL = S.W(a.TI, -1), tR = S.W(b.TI, 1);
    placeCyl(A.bar, tL, tR);
    [[tL, -1], [tR, 1]].forEach(([p, sd], i) => {
      const e0 = new T.Vector3(p.x, p.y, sd * (Math.abs(S.W(K.g3.TI, 1).z) - .06));
      const d = p.clone().sub(e0), L = Math.abs(d.z);
      const o = A.boots[i]; o.matrixAutoUpdate = !1, o.matrix.copy(S.basisM(new T.Vector3(1, 0, 0), new T.Vector3(0, 0, sd), e0)).multiply(new T.Matrix4().makeScale(1, Math.max(.005, L - .012), 1));
      A.innerJ[i].position.copy(p)
    });
    const pin = tL.clone().lerp(tR, .5), swP = new T.Vector3(-.62, .62, 0);
    placeCyl(A.col, pin.clone().add(new T.Vector3(-.02, .06, 0)), swP), A.sw.position.copy(swP), A.sw.rotation.set(-opts.steer * DEG, 0, 0);
    /* puntos de estabilizadora y tercer elemento fijos a cada balancín */
    const pts = [AL, AR].map(Ac => ({ arb: rockerPt(Ac, Ac.arb0), hv: rockerPt(Ac, Ac.hv0) }));
    [-1, 1].forEach((sd, i) => {
      const Ac = i ? AR : AL, p = pts[i].arb, bl = A.blades[i];
      const tip0 = new T.Vector3(A.arbC.x + .075, A.arbC.y, sd * A.arbZ);
      /* la lámina gira lo que se mueve el extremo de la bieleta */
      const ang = Math.atan2(p.y - A.arbC.y + .03, .075 + (p.x - A.arbC.x - .075) * .0);
      bl.gr.rotation.set(0, 0, clamp((p.y - Ac.arb0.y) / .075 * (ex > 1 ? 1 : 1), -.6, .6)), bl.b.rotation.x = opts.blade != null ? opts.blade * Math.PI / 2 : Math.PI / 4;
      bl.gr.updateMatrixWorld(!0);
      const tip = new T.Vector3(.075, 0, 0).applyMatrix4(bl.gr.matrixWorld);
      placeCyl(A.drops[i], p, tip), A.dropEnds[i * 2].position.copy(p), A.dropEnds[i * 2 + 1].position.copy(tip)
    });
    const tw = Math.abs(pts[0].arb.y - pts[1].arb.y - (AL.arb0.y - AR.arb0.y));
    A.arbTube.material.emissive.copy(heat(tw * 60)).multiplyScalar(clamp(tw * 120, 0, .35));
    /* tercer elemento entre los balancines */
    const hL = pts[0].hv, hR = pts[1].hv, mid = hL.clone().lerp(hR, .5), d = hR.clone().sub(hL), L = d.length(), u = d.clone().divideScalar(L);
    placeCyl(A.heaveBody, hL, hL.clone().addScaledVector(u, L * .55)), placeCyl(A.heaveRod, hL.clone().addScaledVector(u, L * .5), hR);
    const c0 = hL.clone().addScaledVector(u, L * .58), c1 = hR.clone().addScaledVector(u, -.025);
    A.coil.matrixAutoUpdate = !1, A.coil.matrix.copy(S.basisM(new T.Vector3(1, 0, 0), u, c0.clone().lerp(c1, .5))).multiply(new T.Matrix4().makeScale(1, c0.distanceTo(c1), 1));
    A.stops[0].matrixAutoUpdate = A.stops[1].matrixAutoUpdate = !1;
    A.stops[0].matrix.copy(S.basisM(new T.Vector3(1, 0, 0), u, hL.clone().addScaledVector(u, L * .555))), A.stops[1].matrix.copy(S.basisM(new T.Vector3(1, 0, 0), u, hR.clone().addScaledVector(u, -.012)));
    A.heaveLen = L
  }
  /* añade al balancín de cada esquina las palancas de estabilizadora y tercer elemento */
  function rockerExtras(Ac) {
    const S = CAD(), p0 = Ac.pt0, RP = p0.RP, ra = p0.RA0.clone().sub(RP).normalize(), x = new T.Vector3(1, 0, 0), e2 = new T.Vector3().crossVectors(x, ra);
    const toIn = new T.Vector3(0, 0, -Math.sign(RP.z || 1));
    let dirArb = toIn.clone().multiplyScalar(.5).add(new T.Vector3(0, .8, 0)).normalize(); dirArb.addScaledVector(x, -dirArb.dot(x)).normalize();
    Ac.arb0 = RP.clone().addScaledVector(dirArb, .045).addScaledVector(x, -.02);
    Ac.hv0 = RP.clone().addScaledVector(toIn, .035).addScaledVector(new T.Vector3(0, -1, 0), .02).addScaledVector(x, .022);
    const g = Ac.groups.rk, mk = (a, b, w) => { const m = S.mesh(S.beam(a, b, w, .012, w * .8, .01, x, .45), M.ti, { name: "Balancín, palanca", mat: "Titanio", kg: .05, info: "Palanca para la bieleta de la estabilizadora o el tercer elemento." }); g.add(m), Ac.parts.push(m) };
    mk(RP.clone().addScaledVector(x, -.02), Ac.arb0, .016), mk(RP.clone().addScaledVector(x, .022), Ac.hv0, .016);
    g.add(S.mesh(S.put(S.cyl(.008, .014, 16), Ac.arb0, x), M.steel)), g.add(S.mesh(S.put(S.cyl(.009, .014, 16), Ac.hv0, x), M.steel))
  }
  function rebuild(m) {
    const K = m.K;
    if (C) for (const k of ["L", "R"]) { scene.remove(C[k].root); C[k].root.traverse(o => o.geometry && o.geometry.dispose()) }
    const P = m.P || {}, spec = { tyreR: K.g3.R, tyreW: LAB.car.reg === "2026" ? .28 : .305, axes: CAD().optimiseAxes(K, thetaFor), shims: clamp(Math.round(4 + ((P.camber ?? -3.2) + 3.2) * -5), 0, 12), compound: "M", disc: (P.discD || 328) / 1e3 };
    C = { L: CAD().buildCorner(scene, K, -1, spec), R: CAD().buildCorner(scene, K, 1, spec) };
    rockerExtras(C.L), rockerExtras(C.R);
    axle = buildAxle(K), picked = null, pickEl.hidden = !0;
    setOpts({}), sweep = sweepChecks(K)
  }
  /* barrido de todo el recorrido y el giro: peor desalineación por rótula y peor holgura */
  function sweepChecks(K) {
    const g = K.g3, A = C.R, worst = {}, cl = { tyre: 1e9, tyreWho: "", rim: 1e9, rimWho: "", at: "" };
    let prev = null;
    const ths = [-.03, -.015, 0, .015, .03, .045].map(s => thetaFor(K, s));
    /* cremallera para el giro máximo de rueda del simulador (25°) */
    const th0 = thetaFor(K, 0);
    let lo = 0, hi = .08;
    for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2, q = LAB.kin3d.solve(g, th0, mid, null); q && Math.abs(q.toe - g.toe0) < 25 * DEG ? lo = mid : hi = mid }
    const rmax = lo;
    sweepRack = rmax;
    for (const th of ths) for (const rk of [-rmax, -rmax / 2, 0, rmax / 2, rmax]) {
      const sol = LAB.kin3d.solve(g, th, rk, prev);
      if (!sol) continue;
      prev = rk === rmax ? null : sol;
      const mis = CAD().misOf(A, sol);
      for (const k in mis) (!worst[k] || mis[k] > worst[k].v) && (worst[k] = { v: mis[k], th, rk });
      const c = CAD().clearances(A, sol);
      c.tyreMin < cl.tyre && (cl.tyre = c.tyreMin, cl.tyreWho = c.tyreWho, cl.tyreAt = [sol.sw, rk]);
      c.rimMin < cl.rim && (cl.rim = c.rimMin, cl.rimWho = c.rimWho, cl.rimAt = [sol.sw, rk])
    }
    return { worst, cl }
  }
  function pick(e) {
    const r = R.domElement.getBoundingClientRect(), mp = new T.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1), rc = new T.Raycaster();
    rc.setFromCamera(mp, cam);
    const hits = rc.intersectObjects(scene.children, !0).filter(h => h.object.visible && !(h.object.material && h.object.material.opacity < .2));
    let hit = null;
    for (const h of hits) { let o = h.object; for (; o && !o.userData.part;) o = o.parent; if (o) { hit = o; break } }
    if (picked) { picked.material = picked.userData.mat0, picked = null }
    if (!hit) { pickEl.hidden = !0; return }
    picked = hit, hit.userData.mat0 = hit.material;
    const hm = hit.material.clone(); hm.emissive = new T.Color("#ff8a2a"), hm.emissiveIntensity = .55, hit.material = hm;
    showPick()
  }
  function showPick() {
    if (!picked) return;
    const p = picked.userData.part, live = liveFor(p.name);
    pickEl.hidden = !1, pickEl.innerHTML = `<b>${p.name}</b><span>${p.mat || ""}</span>${p.kg ? `<em>Masa ≈ ${p.kg >= 1 ? p.kg.toFixed(2) : (p.kg * 1e3).toFixed(0) + " g"}${p.kg >= 1 ? " kg" : ""}</em>` : ""}${p.info ? `<p>${p.info}</p>` : ""}${live ? `<i>${live}</i>` : ""}<button class="x" title="Cerrar">×</button>`;
    pickEl.querySelector(".x").onclick = () => { picked && (picked.material = picked.userData.mat0, picked = null), pickEl.hidden = !0 }
  }
  let liveData = {};
  function liveFor(name) {
    const L = liveData.loads, mis = C && C.R.mis || {}, f = i => L ? `${L[i].f >= 0 ? "Tracción" : "Compresión"} ${Math.abs(L[i].f / 1e3).toFixed(2)} kN` : "";
    if (/Pushrod|Pullrod/.test(name)) return f(4) + ` · desalineación de rótulas ${(mis.PO || 0).toFixed(1)}° / ${(mis.RA || 0).toFixed(1)}° (límite 14°)`;
    if (/Bieleta de dirección/.test(name)) return f(5) + ` · rótula ${(mis.TO || 0).toFixed(1)}°`;
    if (/Trapecio inferior, brazo delantero/.test(name)) return f(0);
    if (/Trapecio inferior, brazo trasero/.test(name)) return f(1);
    if (/Trapecio superior, brazo delantero/.test(name)) return f(2);
    if (/Trapecio superior, brazo trasero/.test(name)) return f(3);
    if (/Rodamiento esférico|Rótula/.test(name)) return "Desalineación actual: " + Object.entries(mis).map(([k, v]) => k + " " + v.toFixed(1) + "°").join(" · ");
    if (/Amortiguador|Vástago/.test(name) && C) return `Longitud ${(C.R.dp.len * 1e3).toFixed(1)} mm · recorrido desde estático ${(C.R.dp.stroke * 1e3).toFixed(1)} mm`;
    if (/Barra de torsión/.test(name) && C) return `Giro ${((C.R.twist || 0) / DEG).toFixed(2)}°`;
    if (/Disco|Pastilla|Pinza/.test(name)) return `Temperatura del disco ≈ ${Math.round(opts.discT)} °C`;
    if (/Neumático/.test(name)) return `Carga vertical ${(liveData.Fz / 1e3 || 0).toFixed(2)} kN · aplastamiento ${(liveData.Fz / 3e5 * 1e3 || 0).toFixed(1)} mm`;
    if (/Tercer elemento/.test(name) && axle) return `Longitud ${(axle.heaveLen * 1e3).toFixed(1)} mm`;
    return ""
  }
  function frame(m, aux, live) {
    if (!parts || !m || !m.K || !m.K.ok || !m.K.g3) return null;
    const K = m.K, rack = opts.steer * .3e-3;
    opts.blade = clamp((m.P && m.P.karb != null ? m.P.karb : 600) / 2000, 0, 1);
    if (K !== frame.k) { frame.k = K, rebuild(m), C.L.prev = C.R.prev = null }
    const solve = (A, s) => { const sol = LAB.kin3d.solve(K.g3, thetaFor(K, s * ex), rack * A.side, A.prev) || A.prev; sol && (A.prev = sol); return sol };
    const sL = solve(C.L, aux.sL || 0), sR = solve(C.R, aux.sR || 0);
    if (!sL || !sR) return null;
    const v = (m.P && m.P.speed || 200) / 3.6, spin = -v / K.g3.R / 60;
    const opt = side => ({ explode: opts.explode, spin: spin, load: side > 0 ? aux.FtR || 0 : aux.FtL || 0, discT: opts.discT, ex, kt: K.kt || 3e5 });
    CAD().update(C.L, sL, opt(-1)), CAD().update(C.R, sR, opt(1));
    updateAxle(K, sL, sR, rack);
    clip.constant = CAD().W(sR.WC, 1).x;
    /* firme, pianos y flechas de fuerza */
    const FR = live.FR || [0, 0, aux.FtR || 0], FL = live.FL || [0, 0, aux.FtL || 0];
    [[sL, -1, "L", aux.rL || 0, FL], [sR, 1, "R", aux.rR || 0, FR]].forEach(([s, side, k, rd, F]) => {
      const CP = CAD().W(s.CP, side), defl = clamp((side > 0 ? aux.FtR : aux.FtL) / (K.kt || 3e5) * ex, 0, .05);
      parts.pads[k].position.set(CP.x, CP.y - .006 + defl * 0, CP.z), parts.pads[k + "k"].visible = rd > .002, rd > .002 && (parts.pads[k + "k"].scale.y = rd * ex, parts.pads[k + "k"].position.set(CP.x, CP.y - rd * ex / 2 - .006, CP.z));
      const vecs = [[0, F[2], 0], [0, 0, F[1] * side], [F[0], 0, 0]];
      parts.arrows[k].forEach((a, i) => { const vv = new T.Vector3(...vecs[i]), L = vv.length() / 25e3; a.visible = L > .005 && !opts.explode && opts.show.loads, a.position.copy(CP), L > .005 && (a.setDirection(vv.normalize()), a.setLength(L, Math.min(.06, L * .3), Math.min(.035, L * .2))) })
    });
    /* fuerzas axiales de cada barra de la rueda derecha */
    const L = live.loads;
    liveData = { loads: L, Fz: aux.FtR || 0 };
    if (L) {
      const meshes = [...C.R.groups.lw.children.filter(o => o.userData.part && /brazo/.test(o.userData.part.name)), ...C.R.groups.uw.children.filter(o => o.userData.part && /brazo/.test(o.userData.part.name))].filter(o => o.material === M.carbon || o.userData.tint);
      const legMeshes = [C.R.groups.lw.children.find(o => o.userData.part && /Trapecio inferior, brazo delantero/.test(o.userData.part.name)), C.R.groups.lw.children.find(o => o.userData.part && /Trapecio inferior, brazo trasero/.test(o.userData.part.name)), C.R.groups.uw.children.find(o => o.userData.part && /Trapecio superior, brazo delantero/.test(o.userData.part.name)), C.R.groups.uw.children.find(o => o.userData.part && /Trapecio superior, brazo trasero/.test(o.userData.part.name)), C.R.pr.tube, C.R.tr.tube];
      const es = labelsEl.children.length === 6 ? labelsEl.children : (labelsEl.innerHTML = "<div></div>".repeat(6), labelsEl.children), rect = R.domElement.getBoundingClientRect(), vv = new T.Vector3();
      /* rótulos sin solaparse: se colocan en orden y se desplazan en vertical hasta encontrar hueco */
      const placed = [];
      L.forEach((q, i) => {
        vv.copy(CAD().W(q.c, 1)).lerp(CAD().W(q.p, 1), .5).project(cam);
        const e = es[i], vis = vv.z < 1 && Math.abs(vv.x) < .98 && Math.abs(vv.y) < .98 && !opts.explode;
        e.style.display = vis && opts.show.loads ? "" : "none", e.className = q.f >= 0 ? "t" : "c", e.textContent = (q.f >= 0 ? "+" : "−") + Math.abs(q.f / 1e3).toFixed(1) + " kN";
        if (!vis) return;
        const x = (vv.x + 1) / 2 * rect.width;
        let y = (1 - vv.y) / 2 * rect.height;
        for (let k = 0; k < 10 && placed.some(([px, py]) => Math.abs(px - x) < 64 && Math.abs(py - y) < 20); k++) y += k % 2 ? -20 * (k + 1) : 20 * (k + 1);
        placed.push([x, y]), e.style.transform = `translate(${x.toFixed(0)}px,${y.toFixed(0)}px) translate(-50%,-50%)`
      })
    }
    picked && (frame.n = (frame.n || 0) + 1) % 10 === 0 && showPick();
    R.render(scene, cam);
    return { L: sL, R: sR }
  }
  /* comprobaciones de montaje con las cargas de la maniobra elegida */
  function checks(loads, P) {
    if (!C || !sweep) return [];
    const A = C.R, rows = [], S = CAD(), mis = A.mis || {}, W = sweep.worst;
    const st = (v, warn, bad, low) => low ? (v < bad ? "bad" : v < warn ? "warn" : "ok") : (v > bad ? "bad" : v > warn ? "warn" : "ok");
    /* desalineaciones (peor caso en todo el recorrido y el giro) */
    let worstJ = null;
    for (const j of A.joints) { const w = W[j.key]; if (!w) continue; const r = w.v / j.lim; (!worstJ || r > worstJ.r) && (worstJ = { j, r, v: w.v }) }
    worstJ && rows.push([st(worstJ.r, .8, 1), "Desalineación de rótulas", `Peor: ${worstJ.j.name} ${worstJ.v.toFixed(1)}° de ${worstJ.j.lim}° admisibles (recorrido −30…+45 mm y rueda girada hasta 25°, el tope del simulador). Ahora: ${Object.entries(mis).map(([k, v]) => k + " " + v.toFixed(1) + "°").join(", ")}.`]);
    const cl = sweep.cl;
    rows.push([st(cl.tyre * 1e3, 12, 4, !0), "Holgura neumático–suspensión", isFinite(cl.tyre) && cl.tyre < 1 ? `${(cl.tyre * 1e3).toFixed(0)} mm con ${cl.tyreWho.toLowerCase()} (recorrido ${(cl.tyreAt[0] * 1e3).toFixed(0)} mm, cremallera ${(cl.tyreAt[1] * 1e3).toFixed(0)} mm). ${cl.tyre < 0 ? "¡El neumático toca la barra!" : ""}` : "Ninguna barra entra en el volumen del neumático en todo el barrido."]);
    rows.push([st(cl.rim * 1e3, 6, 2, !0), "Holgura llanta–suspensión", isFinite(cl.rim) && cl.rim < 1 ? `${(cl.rim * 1e3).toFixed(0)} mm con ${cl.rimWho.toLowerCase()} dentro del barril de la llanta. ${cl.rim < 0 ? "¡Interferencia!" : ""}` : "Las barras no entran en el barril de la llanta."]);
    if (loads) {
      /* fuerzas en cada unión */
      const u = q => S.W(q.p, 1).sub(S.W(q.c, 1)).normalize(), F = loads.map(q => q.f);
      const vec = (i, j) => u(loads[i]).multiplyScalar(F[i]).add(u(loads[j]).multiplyScalar(F[j])).length();
      const jF = { lwdelantero: Math.abs(F[0]), lwtrasero: Math.abs(F[1]), uwdelantero: Math.abs(F[2]), uwtrasero: Math.abs(F[3]), lwO: vec(0, 1), uwO: vec(2, 3), PO: Math.abs(F[4]), RA: Math.abs(F[4]), TO: Math.abs(F[5]) };
      /* amortiguador por equilibrio de momentos del balancín */
      const sol = A.prev;
      if (sol) {
        const RP = S.W(A.g.RP, 1), RA = S.W(sol.RA, 1), RD = S.W(sol.RD, 1), PO = S.W(sol.PO, 1), up = RA.clone().sub(PO).normalize().multiplyScalar(F[4]), ud = RD.clone().sub(A.pt0.SD).normalize();
        const Mp = new T.Vector3().crossVectors(RA.clone().sub(RP), up).x, arm = new T.Vector3().crossVectors(RD.clone().sub(RP), ud).x;
        jF.RD = jF.SD = Math.abs(Mp / (arm || 1e-6)), liveData.damperF = jF.RD
      }
      let wb = null, wr = null;
      for (const j of A.joints) {
        const f = jF[j.key]; if (f == null) continue;
        const db = j.d * .8, cap = 1070e6 * 2 * Math.PI * db * db / 4, sf = cap / Math.max(1, f), sr = j.rate / Math.max(1, f);
        (!wb || sf < wb.sf) && (wb = { j, sf, f, db }), (!wr || sr < wr.sf) && (wr = { j, sf: sr, f })
      }
      wb && rows.push([st(wb.sf, 2.5, 1.5, !0), "Tornillos (cortadura doble)", `El más cargado: ${wb.j.name}, M${Math.round(wb.db * 1e3)} con ${(wb.f / 1e3).toFixed(1)} kN → coeficiente de seguridad ${wb.sf.toFixed(1)} (MP35N, τ rotura 1 070 MPa).`]);
      wr && rows.push([st(wr.sf, 2, 1.2, !0), "Capacidad de las rótulas", `${wr.j.name}: ${(wr.f / 1e3).toFixed(1)} kN de ${(wr.j.rate / 1e3).toFixed(0)} kN de carga radial estática → ×${wr.sf.toFixed(1)}.`]);
      /* pandeo de Euler de las barras comprimidas */
      const pr = S.buckling(S.W(A.prev.PO, 1).distanceTo(S.W(A.prev.RA, 1)), A.spec.prOD, A.spec.prID, 114e9), tr = S.buckling(S.W(A.prev.TO, 1).distanceTo(S.W(A.prev.TI, 1)), A.spec.trOD, A.spec.trID, 120e9);
      const legs = [0, 1, 2, 3].map(i => { const q = loads[i], Lm = S.W(q.c, 1).distanceTo(S.W(q.p, 1)); return S.buckling(Lm, .018, .014, 130e9) });
      const cand = [[F[4] < 0 ? pr / -F[4] : 99, A.g.type === "pull" ? "Pullrod" : "Pushrod", pr], [F[5] < 0 ? tr / -F[5] : 99, "Bieleta de dirección", tr], ...legs.map((p, i) => [F[i] < 0 ? p / -F[i] : 99, ["Trapecio inf. delantero", "Trapecio inf. trasero", "Trapecio sup. delantero", "Trapecio sup. trasero"][i], p])];
      cand.sort((a, b) => a[0] - b[0]);
      const c = cand[0];
      rows.push([st(c[0], 2, 1.2, !0), "Pandeo de las barras", c[0] > 50 ? "Ninguna barra trabaja a compresión en esta maniobra." : `${c[1]}: carga crítica de Euler ${(c[2] / 1e3).toFixed(1)} kN → ×${c[0].toFixed(1)} sobre la compresión actual.`])
    }
    /* recorrido del amortiguador y masa no suspendida */
    const strokeMax = A.dp.bodyL * .55, used = Math.abs(A.dp.stroke || 0);
    rows.push([st(used / strokeMax, .7, .95), "Recorrido del amortiguador", `${(used * 1e3).toFixed(1)} mm de ${(strokeMax * 1e3).toFixed(0)} mm disponibles hasta el tope interno.`]);
    let mu = 0; A.root.traverse(o => { const p = o.userData.part; if (!p || !p.kg) return; let q = o, sprung = !1; for (; q && q !== A.root; q = q.parent) (q === A.groups.rk || q === A.groups.tb || q === A.groups.dpB || /Brk/.test(Object.keys(A.groups).find(k => A.groups[k] === q) || "")) && (sprung = !0); const half = q && (o.parent === A.groups.lw || o.parent === A.groups.uw || o.parent === A.pr.G || o.parent === A.tr.G); sprung || (mu += p.kg * (half ? .5 : 1)) });
    rows.push(["ok", "Masa no suspendida estimada", `${mu.toFixed(1)} kg por rueda (suma de piezas; trapecios y bieletas cuentan a medias).`]);
    lastChecks = rows;
    return rows
  }
  return { init, frame, setEx, setOpts, checks, sweep: () => sweep }
})();
