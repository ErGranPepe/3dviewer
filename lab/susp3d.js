/* ===================== SUSPENSIÓN EN 3D =====================
   Eje delantero completo a partir de la cinemática 3D de puntos duros (LAB.kin3d): trapecios de perfil aerodinámico con
   rótulas, mangueta mecanizada con buje, brazo de dirección y soporte de la bieleta, disco ventilado que se pone al rojo
   con la temperatura, pinza de seis pistones, llanta de 18" con radios y tuerca central, neumático que se aplasta en la
   huella con la carga, bieleta y balancín de eje longitudinal con barra de torsión, amortiguador con depósito, tercer
   elemento y barra estabilizadora entre balancines, cremallera con volante y columna, flechas de fuerza en la huella y
   la fuerza axial de cada barra (azul tracción, rojo compresión). */
LAB.susp3d = (() => {
  let T, R, scene, cam, host, st, parts = null, ex = 3, labelsEl, lastLoads = null, opts = { steer: 0, discT: 450, show: { loads: !0 } };
  const K3 = () => LAB.kin3d;
  /* coche (x adelante, y derecha, z arriba) → Three (X adelante, Y arriba, Z derecha); lado izquierdo con y espejada */
  const W = (p, side) => new T.Vector3(p[0], p[2], p[1] * side);
  const heat = t => { t = clamp(t, 0, 1); const s = [[61, 139, 255], [47, 209, 108], [255, 210, 63], [255, 107, 26], [255, 59, 59]], x = t * (s.length - 1), i = Math.min(s.length - 2, x | 0), f = x - i; return new T.Color(...[0, 1, 2].map(k => (s[i][k] + (s[i + 1][k] - s[i][k]) * f) / 255)) };
  const forceCol = f => f >= 0 ? new T.Color().setHSL(.6, .85, .35 + .3 * Math.min(1, f / 2e4)) : new T.Color().setHSL(0, .85, .35 + .3 * Math.min(1, -f / 2e4));
  let M;
  function mats() {
    const S = o => new T.MeshStandardMaterial(o), Ph = o => new T.MeshPhysicalMaterial(o);
    return {
      carbon: Ph({ color: "#22262b", metalness: .2, roughness: .32, clearcoat: 1, clearcoatRoughness: .1 }), ti: S({ color: "#9a9590", metalness: 1, roughness: .32 }), steel: S({ color: "#c2c8ce", metalness: 1, roughness: .2 }),
      chrome: S({ color: "#e4e8ec", metalness: 1, roughness: .06 }), alu: S({ color: "#a7adb3", metalness: .9, roughness: .38 }), mag: S({ color: "#2e3237", metalness: .8, roughness: .35 }),
      rubber: S({ color: "#141517", roughness: .88, metalness: 0 }), caliper: S({ color: "#b3261e", metalness: .5, roughness: .35 }), damper: S({ color: "#d9a514", metalness: .8, roughness: .28 }),
      mono: Ph({ color: "#3a4350", metalness: .25, roughness: .3, clearcoat: 1, transparent: !0, opacity: .22, depthWrite: !1, side: T.DoubleSide }), ground: S({ color: "#171c22", roughness: .95 })
    }
  }
  /* barra de perfil elíptico orientada con la cuerda en la dirección de la marcha */
  function strut(rx, rz, mat) { const g = new T.CylinderGeometry(1, 1, 1, 18); g.scale(rx, 1, rz); const m = new T.Mesh(g, mat); m.castShadow = !0, scene.add(m); return m }
  function placeStrut(m, a, b) {
    const d = b.clone().sub(a), L = d.length();
    if (L < 1e-6) return;
    d.divideScalar(L);
    let x = new T.Vector3(1, 0, 0).addScaledVector(d, -d.x);
    x.lengthSq() < 1e-6 && x.set(0, 0, 1), x.normalize();
    const z = new T.Vector3().crossVectors(x, d), mm = new T.Matrix4().makeBasis(x, d, z);
    m.quaternion.setFromRotationMatrix(mm), m.position.copy(a).addScaledVector(d, L / 2), m.scale.set(1, L, 1)
  }
  function tube(r, mat) { return strut(r, r, mat) }
  function rimGeo() {
    const parts = [new T.CylinderGeometry(.229, .229, .3, 64, 1, !0), new T.CylinderGeometry(.06, .06, .12, 24), new T.CylinderGeometry(.03, .03, .16, 6)];
    for (let i = 0; i < 10; i++) { const s = new T.BoxGeometry(.03, .17, .018); s.translate(0, .12, .05), s.rotateY(0), s.applyMatrix4(new T.Matrix4().makeRotationZ(i / 10 * Math.PI * 2)), parts.push(s.rotateX(Math.PI / 2).rotateX(-Math.PI / 2)) }
    return parts
  }
  function corner(side) {
    const c = { side, prev: null };
    c.legs = [strut(.028, .011, M.carbon), strut(.028, .011, M.carbon), strut(.025, .01, M.carbon), strut(.025, .01, M.carbon)];
    c.push = tube(.0095, new T.MeshStandardMaterial({ color: "#c9ced4", metalness: .7, roughness: .3, emissive: "#000" }));
    c.tie = strut(.02, .009, new T.MeshStandardMaterial({ color: "#2a2e33", metalness: .3, roughness: .35, emissive: "#000" }));
    c.joints = [];
    for (let i = 0; i < 12; i++) { const j = new T.Mesh(new T.SphereGeometry(.013, 14, 10), M.steel); scene.add(j), c.joints.push(j) }
    /* mangueta: cuerpo, buje, brazo de dirección y soporte de bieleta */
    c.upBody = strut(.032, .022, M.ti), c.upArm = strut(.012, .012, M.ti), c.upPush = strut(.011, .011, M.ti), c.upLow = strut(.016, .016, M.ti), c.upHigh = strut(.016, .016, M.ti);
    /* rueda: grupo con el eje de giro como Z local */
    c.wheel = new T.Group(), scene.add(c.wheel);
    const tg = new T.TorusGeometry(.295, .065, 28, 128);
    tg.scale(1, 1, 2.35), c.tyreBase = tg.attributes.position.array.slice();
    c.tyre = new T.Mesh(tg, M.rubber), c.tyre.castShadow = !0, c.wheel.add(c.tyre);
    c.rim = new T.Group();
    const rimBarrel = new T.Mesh(new T.CylinderGeometry(.229, .229, .3, 64, 1, !0).rotateX(Math.PI / 2), new T.MeshStandardMaterial({ color: "#2b2f34", metalness: .85, roughness: .32, side: T.DoubleSide }));
    c.rim.add(rimBarrel);
    for (let i = 0; i < 10; i++) { const sp = new T.Mesh(new T.BoxGeometry(.028, .175, .016), M.mag); sp.position.set(0, .135, side * .07), sp.position.applyAxisAngle(new T.Vector3(0, 0, 1), i / 10 * Math.PI * 2), sp.rotation.z = i / 10 * Math.PI * 2, c.rim.add(sp) }
    const hub = new T.Mesh(new T.CylinderGeometry(.055, .055, .1, 24).rotateX(Math.PI / 2), M.alu), nut = new T.Mesh(new T.CylinderGeometry(.032, .032, .04, 6).rotateX(Math.PI / 2), new T.MeshStandardMaterial({ color: "#c79a2c", metalness: .9, roughness: .3 }));
    hub.position.z = side * .03, nut.position.z = side * .1, c.rim.add(hub, nut), c.wheel.add(c.rim);
    /* disco ventilado y pinza (no giran con la llanta la pinza; el disco sí) */
    const discG = new T.CylinderGeometry(.164, .164, .032, 72, 1, !1).rotateX(Math.PI / 2), discM = new T.MeshStandardMaterial({ color: "#2a2a2a", metalness: .2, roughness: .75, emissive: "#000" });
    c.disc = new T.Mesh(discG, discM), c.disc.position.z = -side * .085;
    const bell = new T.Mesh(new T.CylinderGeometry(.08, .08, .04, 24).rotateX(Math.PI / 2), M.alu);
    bell.position.z = -side * .07, c.rim.add(c.disc, bell);
    c.caliper = new T.Mesh(new T.BoxGeometry(.13, .07, .07), M.caliper), c.wheel.add(c.caliper);
    c.duct = new T.Mesh(new T.CylinderGeometry(.19, .19, .09, 48, 1, !0).rotateX(Math.PI / 2), new T.MeshPhysicalMaterial({ color: "#22262b", metalness: .2, roughness: .4, transparent: !0, opacity: .35, depthWrite: !1, side: T.DoubleSide }));
    c.duct.position.z = -side * .09, c.wheel.add(c.duct);
    /* balancín rígido (se construye en estático y gira alrededor de su eje x) */
    c.rocker = new T.Group(), scene.add(c.rocker);
    c.tbar = tube(.008, new T.MeshStandardMaterial({ color: "#596069", metalness: .9, roughness: .3, emissive: "#000" }));
    c.dBody = tube(.019, M.damper), c.dRes = tube(.014, M.damper), c.dRod = tube(.0065, M.chrome);
    c.pad = new T.Mesh(new T.BoxGeometry(.55, .012, .4), new T.MeshStandardMaterial({ color: "#2c333b", roughness: .9 })), scene.add(c.pad);
    c.kerb = new T.Mesh(new T.BoxGeometry(.55, 1, .4), new T.MeshStandardMaterial({ color: "#d63a2f", roughness: .7 })), scene.add(c.kerb);
    c.arrows = ["#2fd16c", "#3d8bff", "#ff6b1a"].map(col => { const a = new T.ArrowHelper(new T.Vector3(0, 1, 0), new T.Vector3(), .2, col, .05, .03); scene.add(a); return a });
    return c
  }
  function buildRocker(c, g) {
    c.rocker.clear();
    const rp = [0, 0], ra = [g.r1 * Math.cos(g.beta0), g.r1 * Math.sin(g.beta0)], rd = [g.r2 * Math.cos(g.beta0 + g.alpha), g.r2 * Math.sin(g.beta0 + g.alpha)];
    const sh = new T.Shape(), pts = [ra, rp, rd], cen = [(ra[0] + rd[0]) / 3, (ra[1] + rd[1]) / 3];
    sh.moveTo(ra[0], ra[1]), sh.quadraticCurveTo(cen[0] * .3, cen[1] * .3, rd[0], rd[1]), sh.absarc(0, 0, .018, 0, Math.PI * 2, !1);
    const plate = new T.Shape();
    plate.moveTo(ra[0] * 1.08, ra[1] * 1.08), plate.lineTo(-ra[1] * .25, ra[0] * .25), plate.lineTo(rd[0] * 1.1, rd[1] * 1.1), plate.lineTo(rd[1] * .2 + rd[0] * .2, -rd[0] * .2 + rd[1] * .2), plate.closePath();
    const geo = new T.ExtrudeGeometry(plate, { depth: .014, bevelEnabled: !0, bevelSize: .003, bevelThickness: .003, bevelSegments: 2 });
    /* el perfil está en (y, z) del coche: X3 = x, Y3 = z, Z3 = y·lado */
    geo.translate(0, 0, -.007);
    const m = new T.Mesh(geo, M.ti);
    m.rotation.y = c.side > 0 ? -Math.PI / 2 : Math.PI / 2, m.castShadow = !0;
    const holder = new T.Group();
    holder.add(m), c.rocker.add(holder), c.rockerMesh = m;
    const axle = new T.Mesh(new T.CylinderGeometry(.012, .012, .08, 16).rotateZ(Math.PI / 2), M.steel);
    c.rocker.add(axle)
  }
  function init(h) {
    T = window.THREE, host = h;
    if (!T || !LAB.kin3d) return !1;
    M = mats();
    R = new T.WebGLRenderer({ antialias: !0 }), R.setPixelRatio(Math.min(2, devicePixelRatio || 1)), R.outputColorSpace = T.SRGBColorSpace, R.toneMapping = T.ACESFilmicToneMapping, R.toneMappingExposure = 1.1, R.shadowMap.enabled = !0, R.shadowMap.type = T.PCFSoftShadowMap;
    host.appendChild(R.domElement), R.domElement.className = "s3cv";
    scene = new T.Scene(), scene.background = new T.Color("#0d1014"), cam = new T.PerspectiveCamera(30, 1, .02, 30);
    const pm = new T.PMREMGenerator(R), envS = new T.Scene();
    envS.add(new T.Mesh(new T.BoxGeometry(20, 10, 20), new T.MeshBasicMaterial({ color: "#3a4048", side: T.BackSide })));
    for (const [x, y, z, c] of [[0, 4.8, 0, 6], [-9, 2, 3, 3], [9, 2, -3, 2.4]]) { const p = new T.Mesh(new T.PlaneGeometry(5, 2), new T.MeshBasicMaterial({ color: new T.Color(c, c, c) })); p.position.set(x, y, z), p.lookAt(0, 0, 0), envS.add(p) }
    scene.environment = pm.fromScene(envS, .04).texture;
    scene.add(new T.HemisphereLight("#dfe7ef", "#1a1f26", .6));
    const key = new T.DirectionalLight("#fff3e2", 2.2);
    key.position.set(1.6, 2.6, 1.3), key.castShadow = !0, key.shadow.mapSize.set(2048, 2048), key.shadow.bias = -3e-4, Object.assign(key.shadow.camera, { left: -1.3, right: 1.3, top: 1.3, bottom: -1.3 }), scene.add(key);
    const floor = new T.Mesh(new T.PlaneGeometry(8, 8), M.ground);
    floor.rotation.x = -Math.PI / 2, floor.position.y = -.03, floor.receiveShadow = !0, scene.add(floor);
    const grid = new T.GridHelper(8, 80, "#22303c", "#19212a");
    grid.position.y = -.029, scene.add(grid);
    /* monocasco delantero (sección que se estrecha hacia el morro) */
    const mono = new T.Mesh(new T.CylinderGeometry(.21, .3, 1.5, 4, 1, !0).rotateY(Math.PI / 4).rotateZ(Math.PI / 2), M.mono);
    mono.scale.set(1, 1.15, .95), mono.position.set(-.35, .38, 0), scene.add(mono);
    const nose = new T.Mesh(new T.CylinderGeometry(.06, .19, 1.1, 4, 1, !0).rotateY(Math.PI / 4).rotateZ(Math.PI / 2), M.mono);
    nose.position.set(.9, .3, 0), scene.add(nose);
    /* dirección: cremallera, piñón, columna y volante */
    parts = { L: corner(-1), R: corner(1) };
    parts.rack = tube(.016, M.alu), parts.rackBar = tube(.009, M.steel), parts.col = tube(.013, M.steel);
    parts.sw = new T.Group();
    const swBody = new T.Mesh(new T.BoxGeometry(.03, .16, .27), new T.MeshPhysicalMaterial({ color: "#1b1e22", metalness: .3, roughness: .4, clearcoat: 1 }));
    const scr = new T.Mesh(new T.PlaneGeometry(.1, .055), new T.MeshBasicMaterial({ color: "#2fd16c" }));
    scr.rotation.y = -Math.PI / 2, scr.position.x = -.017, parts.sw.add(swBody, scr), scene.add(parts.sw);
    parts.arb = tube(.01, new T.MeshStandardMaterial({ color: "#ff6b1a", metalness: .7, roughness: .3, emissive: "#000" })), parts.heave = tube(.016, M.damper);
    parts.dropL = tube(.005, M.steel), parts.dropR = tube(.005, M.steel);
    labelsEl = document.createElement("div"), labelsEl.className = "s3labels", host.appendChild(labelsEl);
    st = { az: .55, el: .28, d: 2.9, t: new T.Vector3(.05, .32, 0) };
    const place = () => { const c = Math.cos(st.el); cam.position.set(st.t.x + st.d * c * Math.cos(st.az), st.t.y + st.d * Math.sin(st.el), st.t.z + st.d * c * Math.sin(st.az)), cam.lookAt(st.t) };
    let drag = null;
    const cv = R.domElement;
    cv.addEventListener("pointerdown", e => { drag = [e.clientX, e.clientY, e.button], cv.setPointerCapture(e.pointerId) });
    cv.addEventListener("pointermove", e => {
      if (!drag) return;
      const dx = e.clientX - drag[0], dy = e.clientY - drag[1];
      if (drag[2] === 2 || e.shiftKey) { const r = new T.Vector3().setFromMatrixColumn(cam.matrix, 0), u = new T.Vector3().setFromMatrixColumn(cam.matrix, 1); st.t.addScaledVector(r, -dx * st.d * .0012).addScaledVector(u, dy * st.d * .0012) }
      else st.az += dx * .007, st.el = clamp(st.el + dy * .005, -.25, 1.45);
      drag[0] = e.clientX, drag[1] = e.clientY, place()
    });
    cv.addEventListener("pointerup", () => drag = null), cv.addEventListener("contextmenu", e => e.preventDefault()), cv.addEventListener("wheel", e => { e.preventDefault(), st.d = clamp(st.d * Math.exp(e.deltaY * .001), .4, 8), place() }, { passive: !1 });
    const fit = () => { const r = host.getBoundingClientRect(); R.setSize(r.width, r.height, !1), cam.aspect = r.width / Math.max(1, r.height), cam.updateProjectionMatrix() };
    new ResizeObserver(fit).observe(host), fit(), place();
    host.view = (v) => { Object.assign(st, { all: { az: .55, el: .28, d: 2.9, t: new T.Vector3(.05, .32, 0) }, corner: { az: -.75, el: .22, d: 1.35, t: new T.Vector3(0, .3, .55) }, top: { az: .01, el: 1.4, d: 2.6, t: new T.Vector3(0, .3, 0) }, steer: { az: Math.PI - .4, el: .5, d: 1.7, t: new T.Vector3(-.1, .36, 0) } }[v] || {}), st.t = st.t.clone(), place() };
    return !0
  }
  function setEx(v) { ex = v }
  function setOpts(o) { Object.assign(opts, o) }
  /* θ del trapecio inferior para un recorrido s (interpolando la tabla) */
  function thetaFor(K, s) {
    const raw = K.raw, sx = clamp(s, raw[0].sw, raw[raw.length - 1].sw);
    let lo = 0, hi = raw.length - 1;
    for (; hi - lo > 1;) { const m = (lo + hi) >> 1; raw[m].sw < sx ? lo = m : hi = m }
    const a = raw[lo], b = raw[hi], t = (sx - a.sw) / (b.sw - a.sw || 1e-9);
    return a.th + (b.th - a.th) * t
  }
  function drawCorner(c, K, s, load, rd, Fwheel, rack, F, side) {
    const g = K.g3, th = thetaFor(K, s * ex), sol = LAB.kin3d.solve(g, th, rack * side, c.prev) || c.prev;
    if (!sol) return null;
    c.prev = sol;
    const P = p => W(p, side);
    const LF = P(g.LF), LR = P(g.LR), UF = P(g.UF), UR = P(g.UR), LO = P(sol.LO), UO = P(sol.UO), TO = P(sol.TO), TI = P(sol.TI), PO = P(sol.PO), RA = P(sol.RA), RP = P(g.RP), RD = P(sol.RD), SD = P(g.SD), WC = P(sol.WC), CP = P(sol.CP);
    placeStrut(c.legs[0], LF, LO), placeStrut(c.legs[1], LR, LO), placeStrut(c.legs[2], UF, UO), placeStrut(c.legs[3], UR, UO), placeStrut(c.push, PO, RA), placeStrut(c.tie, TI, TO);
    [LF, LR, UF, UR, LO, UO, TO, TI, PO, RA, RD, SD].forEach((p, i) => c.joints[i].position.copy(p));
    /* mangueta: cuerpo entre rótulas hacia el buje, brazos a dirección y bieleta */
    const hubIn = WC.clone().addScaledVector(W(sol.s, side).normalize(), -.07);
    placeStrut(c.upBody, LO.clone().lerp(UO, .5).lerp(hubIn, .55), hubIn), placeStrut(c.upLow, LO, hubIn), placeStrut(c.upHigh, UO, hubIn), placeStrut(c.upArm, hubIn.clone().lerp(LO, .3), TO), placeStrut(c.upPush, hubIn.clone().lerp(LO, .5), PO);
    /* rueda: eje Z local = eje de giro hacia fuera */
    const sAx = W(sol.s, side).normalize(), zAx = side > 0 ? sAx : sAx.clone().negate(), up = new T.Vector3(0, 1, 0), xAx = new T.Vector3().crossVectors(up, zAx).normalize().negate(), yAx = new T.Vector3().crossVectors(zAx, xAx);
    const basis = new T.Matrix4().makeBasis(xAx, yAx, zAx);
    c.wheel.position.copy(WC), c.wheel.quaternion.setFromRotationMatrix(basis), c.rim.rotation.z = -performance.now() / 350 * side;
    c.caliper.position.set(-.13, -.06, -side * .085), c.caliper.rotation.z = .5;
    /* neumático: se aplasta contra el firme según la carga (rigidez vertical del neumático) */
    const kt = K.kt || 3e5, defl = clamp(load / kt, 0, .045), dl = new T.Vector3(0, -1, 0).applyQuaternion(c.wheel.quaternion.clone().invert()), pos = c.tyre.geometry.attributes.position, b = c.tyreBase, Rt = .36, lim = Rt - defl * Math.max(1, ex * .6);
    for (let i = 0; i < pos.count; i++) {
      let x = b[i * 3], y = b[i * 3 + 1], z = b[i * 3 + 2];
      const hgt = x * dl.x + y * dl.y + z * dl.z;
      if (hgt > lim) { const e = hgt - lim; x -= dl.x * e, y -= dl.y * e, z -= dl.z * e, z *= 1 + e * 2.2 }
      pos.setXYZ(i, x, y, z)
    }
    pos.needsUpdate = !0, c.tyre.geometry.computeVertexNormals();
    /* disco al rojo */
    const hot = clamp((opts.discT - 600) / 500, 0, 1);
    c.disc.material.emissive.setRGB(hot * 2.2, hot * hot * .7, hot * hot * hot * .15);
    /* balancín, barra de torsión y amortiguador */
    c.rocker.position.copy(RP), c.rockerMesh.parent.rotation.x = side > 0 ? sol.beta - g.beta0 : -(sol.beta - g.beta0);
    placeStrut(c.tbar, RP, RP.clone().add(new T.Vector3(-.38, 0, 0)));
    const dd = RD.clone().sub(SD), mid = SD.clone().addScaledVector(dd, .58);
    placeStrut(c.dBody, SD, mid), placeStrut(c.dRod, mid.clone().addScaledVector(dd, -.12), RD), placeStrut(c.dRes, SD.clone().add(new T.Vector3(-.05, .03, 0)), SD.clone().add(new T.Vector3(-.05, .03, 0)).addScaledVector(dd, .3));
    c.pad.position.set(CP.x, CP.y - .006 - defl * .3, CP.z), c.kerb.visible = rd > .002, rd > .002 && (c.kerb.scale.y = rd * ex, c.kerb.position.set(CP.x, CP.y - rd * ex / 2 - .006, CP.z));
    /* flechas de fuerza en la huella (1 kN ≈ 4 cm) */
    const vecs = [[0, F[2], 0], [0, 0, F[1] * side], [F[0], 0, 0]];
    c.arrows.forEach((a, i) => { const vv = new T.Vector3(...vecs[i]), L = vv.length() / 25e3; a.visible = L > .005, a.position.copy(CP), L > .005 && (a.setDirection(vv.normalize()), a.setLength(L, Math.min(.06, L * .3), Math.min(.035, L * .2))) });
    const fr = clamp(Math.abs(Fwheel) / 9e3, 0, 1);
    c.tbar.material.color.copy(heat(fr)), c.tbar.material.emissive.copy(heat(fr)).multiplyScalar(.2);
    return { sol, RA, RP, RD, TI, P }
  }
  function frame(m, aux, live) {
    if (!parts || !m || !m.K || !m.K.ok || !m.K.g3) return null;
    const K = m.K, rack = opts.steer * .3e-3;
    (K !== frame.k) && (frame.k = K, buildRocker(parts.L, K.g3), buildRocker(parts.R, K.g3), parts.L.prev = parts.R.prev = null);
    const FR = live.FR || [0, 0, aux.FtR || 0], FL = live.FL || [0, 0, aux.FtL || 0];
    const a = drawCorner(parts.L, K, aux.sL || 0, aux.FtL || 0, aux.rL || 0, aux.FsL || 0, rack, FL, -1), b = drawCorner(parts.R, K, aux.sR || 0, aux.FtR || 0, aux.rR || 0, aux.FsR || 0, rack, FR, 1);
    if (!a || !b) return null;
    /* cremallera y volante */
    placeStrut(parts.rack, a.TI.clone().lerp(b.TI, .2), a.TI.clone().lerp(b.TI, .8)), placeStrut(parts.rackBar, a.TI, b.TI);
    const pin = a.TI.clone().lerp(b.TI, .5), swP = new T.Vector3(-.62, .62, 0);
    placeStrut(parts.col, pin, swP), parts.sw.position.copy(swP), parts.sw.rotation.set(-opts.steer * DEG, 0, 0);
    /* tercer elemento y barra estabilizadora entre los balancines */
    const hA = a.RP.clone().add(new T.Vector3(-.03, -.07, 0)), hB = b.RP.clone().add(new T.Vector3(-.03, -.07, 0));
    placeStrut(parts.heave, hA.clone().lerp(hB, .25), hA.clone().lerp(hB, .75)), placeStrut(parts.arb, a.RP.clone().add(new T.Vector3(-.1, .05, 0)), b.RP.clone().add(new T.Vector3(-.1, .05, 0)));
    placeStrut(parts.dropL, a.RA, a.RP.clone().add(new T.Vector3(-.1, .05, 0))), placeStrut(parts.dropR, b.RA, b.RP.clone().add(new T.Vector3(-.1, .05, 0)));
    const tw = clamp(Math.abs((aux.sL || 0) - (aux.sR || 0)) * 40, 0, 1);
    parts.arb.material.color.copy(heat(tw)), parts.arb.material.emissive.copy(heat(tw)).multiplyScalar(.2);
    /* fuerzas axiales de cada barra de la rueda derecha (o la cargada) */
    const L = live.loads, P = b.P;
    if (L) {
      const [l0, l1, l2, l3] = parts.R.legs, meshes = [l0, l1, l2, l3, parts.R.push, parts.R.tie];
      L.forEach((q, i) => { const mt = meshes[i].material === M.carbon ? (meshes[i].material = M.carbon.clone()) : meshes[i].material; mt.emissive = forceCol(q.f).multiplyScalar(.55) });
      const es = labelsEl.children.length === 6 ? labelsEl.children : (labelsEl.innerHTML = "<div></div>".repeat(6), labelsEl.children), rect = R.domElement.getBoundingClientRect(), vv = new T.Vector3();
      L.forEach((q, i) => {
        vv.copy(P(q.c)).lerp(P(q.p), .5).project(cam);
        const e = es[i], vis = vv.z < 1 && Math.abs(vv.x) < .98 && Math.abs(vv.y) < .98;
        e.style.display = vis && opts.show.loads ? "" : "none", e.className = q.f >= 0 ? "t" : "c", e.textContent = (q.f >= 0 ? "+" : "−") + Math.abs(q.f / 1e3).toFixed(1) + " kN";
        vis && (e.style.transform = `translate(${((vv.x + 1) / 2 * rect.width).toFixed(0)}px,${((1 - vv.y) / 2 * rect.height).toFixed(0)}px) translate(-50%,-50%)`)
      })
    }
    R.render(scene, cam);
    return { L: a.sol, R: b.sol }
  }
  return { init, frame, setEx, setOpts }
})();
