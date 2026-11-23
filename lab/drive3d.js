/* ===================== TRANSMISIÓN Y ERS EN 3D =====================
   Caja longitudinal de 8 marchas seccionada: eje primario con los piñones tallados, eje secundario con las ruedas locas y
   cuatro anillos de garras deslizantes, horquillas movidas por el tambor de selección con sus ranuras helicoidales y el
   actuador hidráulico; embrague multidisco de carbono; piñón cónico y corona, diferencial hidráulico con su paquete de
   discos y pistón; palieres con juntas trípode y homocinéticas que se retuercen con el par (exagerado); ruedas.
   Delante, la unidad de potencia simplificada con el MGU-K, la batería (ES), la electrónica de control (CE) y, hasta
   2025, el MGU-H en el turbo, con la energía circulando por los cables de alta tensión. */
LAB.drive3d = (() => {
  let T, R, scene, cam, host, comp = null, st, P = {}, parts = null, labelsEl, clock = 0;
  const C = { x0: -.06, yIn: .045, yOut: -.045, xc: -.43, yc: -.045 };
  /* ---------- geometría ---------- */
  function mergeG(list) {
    const pos = [], nor = [];
    for (const g0 of list) {
      const g = g0.index ? g0.toNonIndexed() : g0;
      g.attributes.normal || g.computeVertexNormals();
      pos.push(...g.attributes.position.array), nor.push(...g.attributes.normal.array)
    }
    const g = new T.BufferGeometry();
    return g.setAttribute("position", new T.Float32BufferAttribute(pos, 3)), g.setAttribute("normal", new T.Float32BufferAttribute(nor, 3)), g
  }
  /* rueda dentada recta con perfil de evolvente aproximado; eje de giro = X */
  function gearGeo(z, m, face, bore) {
    const r = m * z / 2, ra = r + m, rf = r - 1.25 * m, h = Math.PI / (2 * z), sh = new T.Shape();
    for (let k = 0; k < z; k++) {
      const c = k / z * TAU, pts = [[rf, c - 1.45 * h], [r * .985, c - 1.04 * h], [r, c - h], [(r + ra) / 2, c - .8 * h], [ra, c - .52 * h], [ra, c + .52 * h], [(r + ra) / 2, c + .8 * h], [r, c + h], [r * .985, c + 1.04 * h], [rf, c + 1.45 * h]];
      pts.forEach(([rr, a], i) => k === 0 && i === 0 ? sh.moveTo(rr * Math.cos(a), rr * Math.sin(a)) : sh.lineTo(rr * Math.cos(a), rr * Math.sin(a)));
      const a1 = c + 1.45 * h, a2 = c + TAU / z - 1.45 * h;
      for (let q = 1; q <= 2; q++) { const a = a1 + (a2 - a1) * q / 3; sh.lineTo(rf * Math.cos(a), rf * Math.sin(a)) }
    }
    const hole = new T.Path();
    hole.absarc(0, 0, bore, 0, TAU, !0), sh.holes.push(hole);
    const g = new T.ExtrudeGeometry(sh, { depth: face, bevelEnabled: !0, bevelThickness: .0008, bevelSize: .0006, bevelSegments: 1, curveSegments: 6 });
    return g.translate(0, 0, -face / 2), g.rotateY(Math.PI / 2), g
  }
  /* corona cónica: disco con dientes radiales en la cara +Z; eje Z */
  function crownGeo(rIn, rOut, z, hgt) {
    const list = [new T.CylinderGeometry(rOut, rOut, .022, 72).rotateX(Math.PI / 2).translate(0, 0, -.011), new T.CylinderGeometry(rIn * .95, rIn * .95, .05, 48).rotateX(Math.PI / 2).translate(0, 0, -.03)];
    for (let k = 0; k < z; k++) { const b = new T.BoxGeometry(rOut - rIn, .0075, hgt); b.translate((rIn + rOut) / 2, 0, hgt / 2), b.rotateZ(k / z * TAU), list.push(b) }
    return mergeG(list)
  }
  function pinionGeo(r0, r1, len, z) {
    const list = [new T.CylinderGeometry(r1 * .82, r0 * .82, len, 32).rotateZ(-Math.PI / 2)];
    for (let k = 0; k < z; k++) { const b = new T.BoxGeometry(len, .007, (r0 + r1) / 2 * .32); b.translate(0, (r0 + r1) / 2 * .9, 0), b.rotateX(k / z * TAU), list.push(b) }
    return mergeG(list)
  }
  function dogRingGeo(rI, rO, w, n) {
    const list = [new T.CylinderGeometry(rO, rO, w, 48, 1, !0).rotateZ(Math.PI / 2), new T.CylinderGeometry(rI, rI, w, 48, 1, !0).rotateZ(Math.PI / 2), new T.RingGeometry(rI, rO, 48).rotateY(Math.PI / 2).translate(w / 2, 0, 0), new T.RingGeometry(rI, rO, 48).rotateY(-Math.PI / 2).translate(-w / 2, 0, 0)];
    /* ranura de la horquilla */
    list.push(new T.TorusGeometry(rO - .002, .0025, 6, 48).rotateY(Math.PI / 2));
    for (let k = 0; k < n; k++) for (const s of [1, -1]) { const b = new T.BoxGeometry(.007, .009, .009); b.translate(s * (w / 2 + .0035), (rI + rO) / 2, 0), b.rotateX(k / n * TAU + (s > 0 ? 0 : Math.PI / n)), list.push(b) }
    return mergeG(list)
  }
  function tube(a, b, r, mat, seg = 16) {
    const d = b.clone().sub(a), L = d.length(), m = new T.Mesh(new T.CylinderGeometry(r, r, L, seg), mat);
    m.position.copy(a).addScaledVector(d, .5), m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()), m.castShadow = !0;
    return m
  }
  /* ---------- materiales ---------- */
  function mats() {
    const S = o => new T.MeshStandardMaterial(o), Ph = o => new T.MeshPhysicalMaterial(o);
    return {
      gear: Ph({ color: "#c9cdd2", metalness: 1, roughness: .26, clearcoat: .3 }), gearHot: Ph({ color: "#d5d0c8", metalness: 1, roughness: .24, emissive: "#ff6a1a", emissiveIntensity: 0 }),
      shaft: S({ color: "#aeb4bb", metalness: 1, roughness: .2 }), dark: S({ color: "#30353b", metalness: .8, roughness: .35 }), ti: Ph({ color: "#8f8b86", metalness: 1, roughness: .32 }),
      fork: S({ color: "#b8a77a", metalness: .9, roughness: .3 }), barrel: S({ color: "#5c636b", metalness: .9, roughness: .3 }), track: S({ color: "#14171a", metalness: .2, roughness: .7 }),
      case: Ph({ color: "#3b4552", metalness: .3, roughness: .35, transparent: !0, opacity: .14, depthWrite: !1, side: T.DoubleSide, clearcoat: 1 }),
      carbon: Ph({ color: "#1f2328", metalness: .25, roughness: .35, clearcoat: 1, clearcoatRoughness: .1 }), plate: S({ color: "#2a2724", metalness: .3, roughness: .6 }), plateS: S({ color: "#9aa0a6", metalness: 1, roughness: .3 }),
      boot: S({ color: "#111214", roughness: .8 }), rubber: S({ color: "#141517", roughness: .88 }), rim: S({ color: "#2e3237", metalness: .85, roughness: .32 }),
      eng: Ph({ color: "#5d6670", metalness: .6, roughness: .35, transparent: !0, opacity: .22, depthWrite: !1 }), motor: S({ color: "#2a3036", metalness: .7, roughness: .32 }),
      es: Ph({ color: "#2a3a48", metalness: .3, roughness: .35, transparent: !0, opacity: .35, depthWrite: !1 }), hv: S({ color: "#ff7a1a", roughness: .45, metalness: .1 }),
      cell: S({ color: "#2fd16c", emissive: "#2fd16c", emissiveIntensity: .6, roughness: .5 }), ground: S({ color: "#14191f", roughness: .95 })
    }
  }
  let M, camSet = null;
  /* ---------- montaje ---------- */
  function build() {
    const g = { gears: [], dogs: [], forks: [], flows: [] }, q = P.geo;
    /* posiciones axiales: grupos (1,2) (3,4) (5,6) (7,8) con anillo de garras entre cada par */
    const face = q.face, dogW = .014, gap = .003;
    let x = C.x0;
    g.xs = [], g.xd = [];
    for (let k = 0; k < 4; k++) { g.xs.push(x - face / 2), x -= face + gap, g.xd.push(x - dogW / 2), x -= dogW + gap, g.xs.push(x - face / 2), x -= face + .008 }
    g.xEnd = x;
    /* ejes */
    g.inShaft = new T.Group(), g.outShaft = new T.Group(), scene.add(g.inShaft, g.outShaft);
    g.inShaft.position.set(0, C.yIn, 0), g.outShaft.position.set(0, C.yOut, 0);
    g.inShaft.add(tube(new T.Vector3(.09, 0, 0), new T.Vector3(g.xEnd - .01, 0, 0), .013, M.shaft, 24));
    g.outShaft.add(tube(new T.Vector3(C.x0 + .02, 0, 0), new T.Vector3(C.xc + .1, 0, 0), .016, M.shaft, 24));
    /* estrías del secundario */
    for (let k = 0; k < 16; k++) { const b = new T.Mesh(new T.BoxGeometry(g.xEnd - C.x0, .003, .003), M.dark); b.position.set((g.xEnd + C.x0) / 2, .0165 * Math.cos(k / 16 * TAU), .0165 * Math.sin(k / 16 * TAU)), g.outShaft.add(b) }
    for (let i = 0; i < 8; i++) {
      const z1 = q.z1[i], z2 = q.z2[i], mod = q.module, mIn = new T.Mesh(gearGeo(z1, mod, face, .013), M.gear.clone()), mOut = new T.Mesh(gearGeo(z2, mod, face, .0175), M.gear.clone());
      mIn.position.set(g.xs[i], C.yIn, 0), mOut.position.set(g.xs[i], C.yOut, 0), mIn.castShadow = mOut.castShadow = !0, scene.add(mIn, mOut);
      /* fase para que los dientes engranen visualmente */
      mOut.rotation.x = Math.PI / z2;
      /* cubos de garras en las ruedas locas */
      const hub = new T.Mesh(dogRingGeo(.02, .028, .004, 6), M.dark);
      hub.position.x = (i % 2 === 0 ? -1 : 1) * (face / 2 + .002), mOut.add(hub);
      g.gears.push({ i, mIn, mOut, z1, z2 })
    }
    for (let k = 0; k < 4; k++) {
      const d = new T.Mesh(dogRingGeo(.0175, .031, dogW, 6), M.ti.clone());
      d.position.set(g.xd[k], C.yOut, 0), d.castShadow = !0, scene.add(d), g.dogs.push(d);
      /* horquilla: arco que abraza la ranura y brazo hasta el tambor */
      const f = new T.Group(), arc = new T.Mesh(new T.TorusGeometry(.034, .0035, 8, 32, Math.PI * 1.1).rotateY(Math.PI / 2).rotateX(-Math.PI * .05), M.fork), arm = new T.Mesh(new T.BoxGeometry(.006, .012, .07), M.fork);
      arm.position.set(0, 0, .065), f.add(arc, arm), f.position.set(g.xd[k], C.yOut, 0), scene.add(f), g.forks.push(f)
    }
    /* tambor de selección al lado del secundario, con ranuras helicoidales */
    g.barrel = new T.Group(), g.barrel.position.set(0, C.yOut, .1), scene.add(g.barrel);
    const bl = C.x0 - g.xEnd + .04, bx = (C.x0 + g.xEnd) / 2;
    const bc = new T.Mesh(new T.CylinderGeometry(.022, .022, bl, 40).rotateZ(Math.PI / 2), M.barrel);
    bc.position.x = bx, g.barrel.add(bc);
    for (let k = 0; k < 4; k++) {
      const pts = [];
      for (let s = 0; s <= 72; s++) { const th = s / 72 * TAU * .9, gIdx = th / (TAU * .9) * 8, pos = forkPos(k, gIdx); pts.push(new T.Vector3(g.xd[k] + pos * .012, .0222 * Math.cos(th), .0222 * Math.sin(th))) }
      const tr = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 120, .0028, 6), M.track);
      g.barrel.add(tr)
    }
    const act = new T.Mesh(new T.CylinderGeometry(.03, .03, .05, 24).rotateZ(Math.PI / 2), M.dark);
    act.position.set(C.x0 + .055, C.yOut, .1), scene.add(act);
    scene.add(tube(new T.Vector3(C.x0 + .08, C.yOut, .1), new T.Vector3(C.x0 + .14, .09, .14), .004, M.plateS));
    /* embrague multidisco de carbono a la entrada */
    g.clutch = new T.Group(), g.clutch.position.set(.11, C.yIn, 0), scene.add(g.clutch);
    for (let k = 0; k < 9; k++) { const pl = new T.Mesh(new T.CylinderGeometry(.049, .049, .0028, 48).rotateZ(Math.PI / 2), k % 2 ? M.plate : M.plateS); pl.position.x = -.014 + k * .0036, g.clutch.add(pl) }
    g.clutch.add(new T.Mesh(new T.CylinderGeometry(.053, .053, .04, 48, 1, !0).rotateZ(Math.PI / 2), M.ti));
    /* piñón cónico y corona */
    g.pinion = new T.Mesh(pinionGeo(.026, .02, .04, 11), M.gear.clone()), g.pinion.position.set(C.xc + .085 + .02, C.yOut, 0), scene.add(g.pinion);
    g.crown = new T.Mesh(crownGeo(.06, .098, 37, .012), M.gear.clone()), g.crown.position.set(C.xc, C.yc, -.03), scene.add(g.crown);
    /* diferencial: carcasa, paquete de discos y pistón */
    g.diff = new T.Group(), g.diff.position.set(C.xc, C.yc, 0), scene.add(g.diff);
    g.diff.add(new T.Mesh(new T.CylinderGeometry(.055, .055, .1, 40).rotateX(Math.PI / 2), M.ti));
    g.plates = [];
    for (let k = 0; k < 12; k++) { const pl = new T.Mesh(new T.CylinderGeometry(.05, .05, .0022, 40).rotateX(Math.PI / 2), (k % 2 ? M.plate : M.plateS).clone()); pl.position.z = .055 + k * .0034, g.diff.add(pl), g.plates.push(pl) }
    g.piston = new T.Mesh(new T.TorusGeometry(.045, .006, 10, 40), M.plateS), g.piston.position.z = .1, g.diff.add(g.piston);
    /* palieres con juntas y ruedas */
    g.shafts = [];
    for (const s of [-1, 1]) {
      const a = new T.Vector3(C.xc, C.yc, s * .12), b = new T.Vector3(C.xc + .02, .03, s * .64), grp = new T.Group(), segs = [], N = 10, d = b.clone().sub(a), L = d.length();
      grp.position.copy(a), grp.quaternion.setFromUnitVectors(new T.Vector3(1, 0, 0), d.clone().normalize()), scene.add(grp);
      for (let k = 0; k < N; k++) {
        const sg = new T.Group(), cyl = new T.Mesh(new T.CylinderGeometry(.016, .016, L / N * .98, 18).rotateZ(Math.PI / 2), M.shaft.clone()), stripe = new T.Mesh(new T.BoxGeometry(L / N * .98, .004, .004), new T.MeshStandardMaterial({ color: "#ff7a1a", emissive: "#ff7a1a", emissiveIntensity: .4 }));
        stripe.position.y = .0165, sg.add(cyl, stripe), sg.position.x = (k + .5) * L / N, grp.add(sg), segs.push(sg)
      }
      /* trípode interior y homocinética exterior con fuelles */
      const j1 = new T.Mesh(new T.SphereGeometry(.034, 20, 14), M.boot), j2 = new T.Mesh(new T.SphereGeometry(.036, 20, 14), M.boot);
      j1.scale.x = 1.4, j2.scale.x = 1.3, j1.position.x = .02, j2.position.x = L - .02, grp.add(j1, j2);
      /* rueda trasera */
      const wg = new T.Group(); wg.position.set(C.xc + .02, .03, s * .78), scene.add(wg);
      const ty = new T.Mesh(new T.TorusGeometry(.29, .07, 24, 72).scale(1, 1, 2.6), M.rubber); wg.add(ty);
      const rm = new T.Mesh(new T.CylinderGeometry(.229, .229, .34, 48, 1, !0).rotateX(Math.PI / 2), M.rim); wg.add(rm);
      for (let k = 0; k < 10; k++) { const sp = new T.Mesh(new T.BoxGeometry(.026, .17, .014), M.rim); sp.position.set(0, .13, s * .07), sp.position.applyAxisAngle(new T.Vector3(0, 0, 1), k / 10 * TAU), sp.rotation.z = k / 10 * TAU, wg.add(sp) }
      g.shafts.push({ s, grp, segs, L, wheel: wg })
    }
    /* carcasa translúcida */
    const cs = new T.Mesh(new T.BoxGeometry(C.x0 - g.xEnd + .14, .2, .2), M.case);
    cs.position.set((C.x0 + g.xEnd) / 2 - .02, 0, .02), scene.add(cs);
    const cd = new T.Mesh(new T.SphereGeometry(.13, 32, 20), M.case); cd.scale.set(.9, .85, 1.1), cd.position.set(C.xc, C.yc, 0), scene.add(cd);
    /* unidad de potencia simplificada delante */
    const eb = new T.Mesh(new T.BoxGeometry(.56, .36, .5), M.eng); eb.position.set(.46, .12, 0), scene.add(eb);
    g.mguk = new T.Mesh(new T.CylinderGeometry(.06, .06, .16, 32).rotateX(Math.PI / 2), M.motor.clone()), g.mguk.position.set(.62, -.06, -.29), scene.add(g.mguk);
    g.kRotor = new T.Mesh(new T.BoxGeometry(.01, .1, .02), new T.MeshStandardMaterial({ color: "#ff7a1a", emissive: "#ff7a1a", emissiveIntensity: .3 })), g.kRotor.position.set(.62, -.06, -.375), scene.add(g.kRotor);
    g.es = new T.Mesh(new T.BoxGeometry(.42, .14, .5), M.es), g.es.position.set(1.05, -.2, 0), scene.add(g.es);
    g.cells = new T.Mesh(new T.BoxGeometry(.4, .12, .48), M.cell), g.cells.position.copy(g.es.position), scene.add(g.cells);
    g.ce = new T.Mesh(new T.BoxGeometry(.18, .09, .16), M.motor), g.ce.position.set(.82, -.2, -.33), scene.add(g.ce);
    g.mguh = new T.Mesh(new T.CylinderGeometry(.05, .05, .12, 28).rotateZ(Math.PI / 2), M.motor), g.mguh.position.set(.3, .36, 0), scene.add(g.mguh);
    /* cables de alta tensión y flujos de energía */
    const cable = (pts, name) => { const cv = new T.CatmullRomCurve3(pts.map(p => new T.Vector3(...p))), m = new T.Mesh(new T.TubeGeometry(cv, 60, .007, 8), M.hv); scene.add(m); const N = 26, inst = new T.InstancedMesh(new T.SphereGeometry(.011, 8, 6), new T.MeshBasicMaterial({ color: "#7fe3ff", toneMapped: !1 }), N); scene.add(inst); const f = { name, cv, m, inst, N, u: 0, p: 0 }; g.flows.push(f); return f };
    g.fK = cable([[.62, -.06, -.37], [.66, -.15, -.4], [.75, -.2, -.38], [.82, -.2, -.33]], "K");
    g.fES = cable([[.82, -.2, -.25], [.86, -.2, -.1], [.9, -.2, 0], [.84, -.2, .05]], "ES");
    g.fH = cable([[.3, .36, -.06], [.42, .3, -.3], [.65, .1, -.36], [.8, -.12, -.36], [.82, -.18, -.33]], "H");
    g.floor = new T.Mesh(new T.PlaneGeometry(8, 8), M.ground), g.floor.rotation.x = -Math.PI / 2, g.floor.position.y = -.33, g.floor.receiveShadow = !0, scene.add(g.floor);
    return g
  }
  /* posición de la horquilla k (−1 marcha impar, +1 par, 0 punto muerto) para un índice de tambor gIdx */
  function forkPos(k, gIdx) {
    const a = 2 * k, b = 2 * k + 1, d = x => clamp(1 - Math.abs(gIdx - x) * 1.6, 0, 1);
    return d(a) - d(b)
  }
  /* ---------- inicio ---------- */
  function init(h, geo) {
    T = window.THREE, host = h;
    if (!T) return !1;
    M = mats(), P.geo = geo;
    R = new T.WebGLRenderer({ antialias: !1, powerPreference: "high-performance" }), R.setPixelRatio(Math.min(2, devicePixelRatio || 1)), R.outputColorSpace = T.SRGBColorSpace, R.toneMapping = T.ACESFilmicToneMapping, R.toneMappingExposure = 1.1, R.shadowMap.enabled = !0, R.shadowMap.type = T.PCFSoftShadowMap;
    host.appendChild(R.domElement), R.domElement.className = "s3cv";
    scene = new T.Scene(), scene.background = new T.Color("#0d1014"), cam = new T.PerspectiveCamera(32, 1, .02, 40);
    const pm = new T.PMREMGenerator(R), envS = new T.Scene();
    envS.add(new T.Mesh(new T.BoxGeometry(20, 10, 20), new T.MeshBasicMaterial({ color: "#3a4048", side: T.BackSide })));
    for (const [x, y, z, c] of [[0, 4.8, 0, 6], [-9, 2, 3, 3], [9, 2, -3, 2.4], [0, 1, 9, 2]]) { const p = new T.Mesh(new T.PlaneGeometry(5, 2), new T.MeshBasicMaterial({ color: new T.Color(c, c, c) })); p.position.set(x, y, z), p.lookAt(0, 0, 0), envS.add(p) }
    scene.environment = pm.fromScene(envS, .04).texture, pm.dispose();
    scene.add(new T.HemisphereLight("#dfe7ef", "#1a1f26", .55));
    const key = new T.DirectionalLight("#fff3e2", 2.4);
    key.position.set(1.2, 2.4, 1.5), key.castShadow = !0, key.shadow.mapSize.set(2048, 2048), key.shadow.bias = -2e-4, Object.assign(key.shadow.camera, { left: -1.4, right: 1.4, top: 1.4, bottom: -1.4 }), scene.add(key);
    parts = build();
    labelsEl = document.createElement("div"), labelsEl.className = "s3labels", host.appendChild(labelsEl);
    st = { az: .9, el: .32, d: 1.25, t: new T.Vector3(-.2, 0, 0) };
    const place = () => { const c = Math.cos(st.el); cam.position.set(st.t.x + st.d * c * Math.cos(st.az), st.t.y + st.d * Math.sin(st.el), st.t.z + st.d * c * Math.sin(st.az)), cam.lookAt(st.t) };
    camSet = a => { st.az = a[0], st.el = a[1], st.d = a[2], st.t.set(a[3], a[4], a[5]), place() };
    let drag = null, pinch = null;
    const cv = R.domElement, ptr = new Map;
    cv.addEventListener("pointerdown", e => { ptr.set(e.pointerId, [e.clientX, e.clientY]), drag = [e.clientX, e.clientY, e.button], cv.setPointerCapture(e.pointerId) });
    cv.addEventListener("pointermove", e => {
      if (!drag || !ptr.has(e.pointerId)) return;
      ptr.set(e.pointerId, [e.clientX, e.clientY]);
      if (ptr.size === 2) { const a = [...ptr.values()], dd = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]); pinch && (st.d = clamp(st.d * pinch / dd, .25, 6)), pinch = dd, place(); return }
      const dx = e.clientX - drag[0], dy = e.clientY - drag[1];
      if (drag[2] === 2 || e.shiftKey) { const r = new T.Vector3().setFromMatrixColumn(cam.matrix, 0), u = new T.Vector3().setFromMatrixColumn(cam.matrix, 1); st.t.addScaledVector(r, -dx * st.d * .0012).addScaledVector(u, dy * st.d * .0012) }
      else st.az += dx * .007, st.el = clamp(st.el + dy * .005, -.6, 1.45);
      drag[0] = e.clientX, drag[1] = e.clientY, place()
    });
    const up = e => { ptr.delete(e.pointerId), pinch = null, ptr.size || (drag = null) };
    cv.addEventListener("pointerup", up), cv.addEventListener("pointercancel", up), cv.addEventListener("contextmenu", e => e.preventDefault()), cv.addEventListener("wheel", e => { e.preventDefault(), st.d = clamp(st.d * Math.exp(e.deltaY * .001), .25, 6), place() }, { passive: !1 });
    try {
      if (T.EffectComposer && !/nopost/.test(location.search)) {
        comp = new T.EffectComposer(R);
        if (T.N8AOPass && !/noao/.test(location.search)) { const ao = new T.N8AOPass(scene, cam, 400, 300), c = ao.configuration; c.gammaCorrection = !1, c.aoRadius = .05, c.distanceFalloff = .5, c.intensity = 2.4, c.color = new T.Color(0, 0, 0), ao.setQualityMode("Medium"), c.halfRes = !0, comp.addPass(ao) }
        else comp.addPass(new T.RenderPass(scene, cam));
        /nobloom/.test(location.search) || comp.addPass(new T.UnrealBloomPass(new T.Vector2(512, 512), .35, .4, 4)), comp.addPass(new T.OutputPass()), T.SMAAPass && comp.addPass(new T.SMAAPass(400, 300))
      }
    } catch (e) { comp = null }
    const fit = () => { const r = host.getBoundingClientRect(), w = Math.max(1, r.width), hh = Math.max(1, r.height); R.setSize(w, hh, !1), comp && comp.setSize(w, hh), cam.aspect = w / hh, cam.updateProjectionMatrix() };
    new ResizeObserver(fit).observe(host), fit(), place();
    host.view = v => { Object.assign(st, { box: { az: .9, el: .32, d: 1.0, t: new T.Vector3(-.2, 0, 0) }, diff: { az: 2.2, el: .35, d: .9, t: new T.Vector3(C.xc, C.yc, .05) }, ers: { az: -.9, el: .45, d: 1.6, t: new T.Vector3(.65, 0, -.1) }, all: { az: .75, el: .42, d: 2.4, t: new T.Vector3(.2, 0, 0) } }[v] || {}), st.t = st.t.clone(), place() };
    return !0
  }
  function rebuild(geo) { if (!scene) return; P.geo = geo; for (const o of [...scene.children]) o.isLight || scene.remove(o); parts = build() }
  /* ---------- fotograma: s = estado instantáneo de la vuelta ---------- */
  function frame(s, dtReal) {
    if (!parts) return;
    const g = parts, k = s.rotK, tsc = s.tscale;
    clock += dtReal * tsc;
    /* giros: primario a régimen de motor; ruedas locas según su relación; secundario con la marcha engranada */
    const we = s.rpm * TAU / 60, wOut = we / s.box[s.gear], dA = dtReal * tsc * k;
    g.inShaft.rotation.x += we * dA, g.clutch.rotation.x += we * dA;
    g.outShaft.rotation.x -= wOut * dA;
    for (const q of g.gears) {
      q.mIn.rotation.x += we * dA, q.mOut.rotation.x -= we / s.box[q.i] * dA;
      const on = q.i === s.gear || q.i === s.gearNext, I = on ? clamp(Math.abs(s.Tin) / 600, .15, 1.6) : 0;
      for (const m of [q.mIn, q.mOut]) m.material.emissive.set(on ? "#ff6a1a" : "#000"), m.material.emissiveIntensity = I
    }
    /* anillos de garras y horquillas siguen al tambor */
    const gIdx = s.barrel;
    g.barrel.rotation.x = -gIdx / 8 * TAU * .9;
    g.dogs.forEach((d, j) => { const p = forkPos(j, gIdx); d.position.x = g.xd[j] + p * .006, d.rotation.x -= wOut * dA, g.forks[j].position.x = d.position.x, d.material.emissive.set(Math.abs(p) > .5 ? "#ff6a1a" : "#000"), d.material.emissiveIntensity = Math.abs(p) > .5 ? clamp(Math.abs(s.Tin) / 900, .1, 1.2) : 0 });
    /* cónica, diferencial y palieres */
    const wc = wOut / s.fd;
    g.pinion.rotation.x -= wOut * dA, g.crown.rotation.z += wc * dA, g.diff.rotation.z += wc * dA;
    const lockI = clamp(s.lock / 900, 0, 1);
    g.plates.forEach((p, j) => p.material.emissive && (p.material.emissive.setRGB(lockI * .9, lockI * .35, 0), p.material.emissiveIntensity = lockI));
    g.piston.position.z = .1 - lockI * .004;
    const twist = s.Tds / s.kds / 2 * s.twistEx, tq = clamp(Math.abs(s.Tds) / 4000, 0, 1);
    for (const sh of g.shafts) {
      const wS = (sh.s < 0 ? s.wL : s.wR);
      sh.base = (sh.base || 0) + wS * dA;
      sh.segs.forEach((sg, j) => { sg.rotation.x = sh.base + twist * (1 - j / (sh.segs.length - 1)); sg.children[0].material.emissive.setRGB(tq * .8, tq * .28, 0), sg.children[0].material.emissiveIntensity = tq });
      sh.wheel.rotation.z = -sh.base
    }
    /* ERS: flujo de energía, rotor del MGU-K y carga de la batería */
    g.kRotor.rotation.z += we * 4.5 * dA * .2;
    const flows = { K: s.Pk, ES: s.Pes, H: s.Ph };
    g.fH.m.visible = g.fH.inst.visible = g.mguh.visible = s.era !== "2026";
    for (const f of g.flows) {
      const p = flows[f.name] || 0, sp = clamp(Math.abs(p) / 350e3, 0, 1.2);
      f.u = (f.u + Math.sign(p) * (f.name === "K" ? -1 : f.name === "ES" ? 1 : 1) * sp * dtReal * .6 + 1) % 1;
      f.inst.material.color.set(p >= 0 ? "#7fe3ff" : "#5dff8a");
      const mtx = new T.Matrix4(), vv = new T.Vector3();
      for (let j = 0; j < f.N; j++) { const u = (f.u + j / f.N) % 1; f.cv.getPointAt(u, vv); const sc = Math.abs(p) > 2e3 ? .6 + .7 * sp : 0; mtx.makeScale(sc, sc, sc).setPosition(vv), f.inst.setMatrixAt(j, mtx) }
      f.inst.instanceMatrix.needsUpdate = !0
    }
    const soc = clamp(s.soc / s.socwin, 0, 1);
    g.cells.scale.x = Math.max(.02, soc), g.cells.position.x = g.es.position.x - .2 * (1 - soc), g.cells.material.emissive.setHSL(.33 * soc, .9, .45), g.cells.material.color.setHSL(.33 * soc, .8, .45);
    g.mguk.material.emissive = g.mguk.material.emissive || new T.Color(), g.mguk.material.emissive.setRGB(Math.max(0, s.Pk) / 350e3 * .3, Math.max(0, -s.Pk) / 350e3 * .5, Math.max(0, s.Pk) / 350e3 * .8);
    /* etiquetas */
    const L = [[g.mguk.position, `MGU-K ${s.Pk >= 0 ? "+" : "−"}${Math.abs(s.Pk / 1e3).toFixed(0)} kW`], [g.es.position.clone().add(new T.Vector3(0, .1, 0)), `Batería ${(s.soc / 1e6).toFixed(2)} MJ`], [new T.Vector3(g.xs[s.gear], C.yIn + .07, 0), `${s.gear + 1}ª · ${Math.round(s.rpm)} rpm`], [new T.Vector3(C.xc, C.yc + .1, 0), `Bloqueo ${Math.round(s.lock)} N·m`], [g.shafts[1].grp.position.clone().add(new T.Vector3(.02, .07, .3)), `Palier ${(s.Tds / 2e3).toFixed(2)} kN·m`]];
    s.era !== "2026" && L.push([g.mguh.position, `MGU-H +${(s.Ph / 1e3).toFixed(0)} kW`]);
    const es = labelsEl.children.length === L.length ? labelsEl.children : (labelsEl.innerHTML = "<div class=t></div>".repeat(L.length), labelsEl.children), rect = R.domElement.getBoundingClientRect(), v = new T.Vector3();
    const placed = [];
    L.forEach(([p, txt], i) => {
      v.copy(p).project(cam);
      const e = es[i], vis = v.z < 1 && Math.abs(v.x) < .95 && Math.abs(v.y) < .95;
      if (e.style.display = vis ? "" : "none", !vis) return;
      const x = (v.x + 1) / 2 * rect.width, w2 = txt.length * 3.6 + 8;
      let y = (1 - v.y) / 2 * rect.height - 12;
      for (let k = 0; k < 6 && placed.some(q => Math.abs(q[0] - x) < q[2] + w2 && Math.abs(q[1] - y) < 20); k++) y -= 20;
      placed.push([x, y, w2]), e.textContent = txt, e.style.transform = `translate(${x.toFixed(0)}px,${y.toFixed(0)}px) translate(-50%,-100%)`
    });
    comp ? comp.render() : R.render(scene, cam)
  }
  return { init, frame, rebuild, cam: a => camSet && camSet(a) }
})();
