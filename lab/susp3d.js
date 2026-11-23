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
  let camSet = null;
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
      const ghost = LAB.carmesh.build(T, d, { ghost: .2, filter: m => (m.g === "static" || m.g === "nose") && !/tyre|rim|disc|gold|mirror/.test(m.m || "") });
      ghost.position.x = -1.7 * LAB.car.mx, ghost.traverse(o => o.isMesh && (o.renderOrder = 2, o.userData.ghost = 1)), scene.add(ghost);
      parts.car = ghost, mono.visible = nose.visible = !1, parts.mono = parts.nose = ghost;
      /* los brazos del propio modelo del coche (sus carenados): la cinemática los mueve como piezas rígidas, cada uno sobre su anclaje.
         Dentro van los tubos estructurales calculados aquí; si la geometría es coherente, tubo y carenado coinciden en todo el recorrido */
      parts.fair = [];
      if (d.rig) for (const a of d.rig.arms) {
        const hold = new T.Group(), sc = new T.Group();
        sc.scale.set(LAB.car.mx, 1, LAB.car.mz), hold.add(sc);
        for (const m of d.meshes) if (m.g === a.g) { const me = new T.Mesh(LAB.carmesh.colorize(T, m), LAB.carmesh.material(T, m, .38)); me.renderOrder = 2, me.userData.ghost = 1, sc.add(me) }
        hold.visible = !1, scene.add(hold), parts.fair.push({ hold, front: a.w < 2, side: Math.sign(d.rig.wheels[a.w].c[2]), mem: a.g.split("_")[2] })
      }
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
    camSet = a => { st.az = a[0], st.el = a[1], st.d = a[2], st.t.set(a[3], a[4], a[5]), place() };
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
    const fit = () => { const r = host.getBoundingClientRect(); R.setSize(r.width, r.height, !1), cam.aspect = r.width / Math.max(1, r.height), cam.fov = cam.aspect < 1.5 ? clamp(30 * 1.5 / cam.aspect, 30, 52) : 30, cam.updateProjectionMatrix() };
    new ResizeObserver(fit).observe(host), fit(), place();
    host.view = (v) => { Object.assign(st, { all: { az: .55, el: .28, d: 2.9, t: new T.Vector3(.05, .32, 0) }, corner: { az: -.75, el: .22, d: 1.2, t: new T.Vector3(0, .3, .62) }, inside: { az: -2.45, el: .32, d: .62, t: new T.Vector3(-.02, .34, .62) }, brake: { az: -.98, el: .16, d: .56, t: new T.Vector3(0, .33, .7) }, rocker: { az: 2.2, el: .55, d: .7, t: new T.Vector3(-.03, .42, .04) }, top: { az: .01, el: 1.4, d: 2.6, t: new T.Vector3(0, .3, 0) }, steer: { az: Math.PI - .5, el: .42, d: 3, t: new T.Vector3(-.6, .42, 0) } }[v] || {}), st.t = st.t.clone(), place() };
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
    /* ===== dirección =====
       Delante: cremallera con su carcasa, torre del piñón alineada con la columna, columna con dos juntas cardán y horquillas en los
       extremos de la barra para las rótulas de las bieletas. Detrás no hay dirección: las bieletas de convergencia van a horquillas
       fijas en la carcasa de la caja de cambios */
    const rear = g.type === "pull", tiR = S.W(g.TI, 1), hw = Math.abs(tiR.z) - .06, dT = .008, X1 = new T.Vector3(1, 0, 0), Z1 = new T.Vector3(0, 0, 1);
    A.rear = rear, A.hw = hw;
    const setB = (o, x, y, p) => { o.matrixAutoUpdate = !1, o.matrix.makeBasis(x, y, new T.Vector3().crossVectors(x, y)).setPosition(p) };
    A.setB = setB;
    /* horquilla: dos orejas horizontales con el taladro vertical en el origen (por él pasa el tornillo de la rótula); sale hacia +z·sd */
    const clevis = sd => {
      const gap = dT * 1.2, th = .0045, lug = S.lugGeo(dT * 2.6, .02, dT * .5, th), m = new T.Matrix4().makeBasis(new T.Vector3(-sd, 0, 0), new T.Vector3(0, 0, sd), new T.Vector3(0, 1, 0)), gs = [];
      for (const s of [1, -1]) gs.push(lug.clone().applyMatrix4(m).translate(0, s * (gap / 2 + th / 2), 0));
      gs.push(new T.BoxGeometry(dT * 2.6, gap + 2 * th, .012).translate(0, 0, -sd * .026));
      return S.merge(gs)
    };
    const clevisBolt = () => S.merge(S.boltGeos(dT * .8, dT * 1.2 + .014));
    if (!rear) {
      const R0 = new T.Vector3(tiR.x, tiR.y, 0);
      /* carcasa: tubo con casquillos guía en los extremos */
      A.rack = add(S.put(S.lathe([[.0125, -hw - .004], [.027, -hw - .004], [.027, -hw + .014], [.024, -hw + .018], [.024, hw - .018], [.027, hw - .014], [.027, hw + .004], [.0125, hw + .004]], 40), R0, Z1), M.alu, { name: "Carcasa de la cremallera", mat: "Aluminio mecanizado", kg: 1.4, info: "Guía la barra dentada en dos casquillos y aloja el piñón. Relación: 0,3 mm de cremallera por grado de volante (piñón de 17,2 mm de radio primitivo)." });
      /* cilindro de la asistencia hidráulica: el pistón va sobre la propia barra */
      add(S.put(S.lathe([[.0238, -hw * .2], [.0295, -hw * .2 + .004], [.0295, hw * .2 - .004], [.0238, hw * .2]], 40), new T.Vector3(R0.x, R0.y, -hw * .42), Z1), M.aluBlk, { name: "Cilindro de la asistencia hidráulica", mat: "Aluminio anodizado", kg: .5, info: "Un pistón sobre la barra empuja a un lado o al otro según la presión que manda la válvula del piñón (≈ 200 bar). Sin asistencia, a 5 g el volante pediría más de 30 N·m." });
      for (const z of [-hw * .56, -hw * .28]) add(S.put(S.hex(.006, .009), new T.Vector3(R0.x - .01, R0.y + .029, z), new T.Vector3(-.33, 1, 0).normalize()), M.steel, { name: "Racor del cilindro de asistencia", mat: "Acero", kg: .01, info: "Entrada de aceite a cada cámara del cilindro." });
      /* abrazaderas que sujetan la carcasa al monocasco */
      for (const sz of [-1, 1]) {
        const zc = sz * hw * .78;
        add(S.put(S.ringGeo(.0305, .0243, .02, 36), new T.Vector3(R0.x, R0.y, zc), Z1), M.bracket, { name: "Abrazadera de la cremallera", mat: "Aluminio 7075", kg: .12, info: "Dos abrazaderas atornilladas al monocasco: la carcasa no puede moverse ni girar, o la dirección perdería precisión." });
        add(new T.BoxGeometry(.078, .012, .024).translate(R0.x, R0.y - .0345, zc), M.bracket);
        for (const sx of [-1, 1]) add(S.hex(.0052, .005).translate(R0.x + sx * .03, R0.y - .026, zc), M.bolt)
      }
      /* barra dentada (se desplaza) y sus horquillas de extremo */
      A.bar = add(S.cyl(.011, 1, 24), M.steel, { name: "Barra de la cremallera", mat: "Acero cementado", kg: .5, info: "Se desplaza lateralmente al girar el volante y arrastra las dos bieletas de dirección." });
      A.clev = [-1, 1].map(sd => { const G = new T.Group(); root.add(G); const c = S.mesh(clevis(sd), M.steel, { name: "Horquilla del extremo de la cremallera", mat: "Acero 300M", kg: .06, info: "La rótula de la bieleta de dirección va entre las dos orejas, con el tornillo en doble cortadura." }); G.add(c, S.mesh(clevisBolt(), M.bolt)); return G });
      /* fuelles: perfil ondulado entre el casquillo de la carcasa y la horquilla, con sus dos abrazaderas */
      const bootProf = []; for (let i = 0; i <= 96; i++) { const t = i / 96, k = t * t * (3 - 2 * t), w = t > .07 && t < .93 ? Math.sin((t - .07) / .86 * Math.PI * 2 * 9) : 0; bootProf.push([.0262 + (.0146 - .0262) * k + .0034 * w * (1 - .35 * k), t]) }
      A.boots = [-1, 1].map(() => add(S.lathe(bootProf, 32), M.boot, { name: "Fuelle de la cremallera", mat: "Elastómero", kg: .03, info: "Protege la barra del polvo de frenos y de los restos de goma; se estira y se encoge con el recorrido." }));
      A.bootClampIn = [-1, 1].map(sd => add(S.put(S.ringGeo(.0282, .026, .006, 32), new T.Vector3(R0.x, R0.y, sd * (hw + .012)), Z1), M.steel));
      A.bootClampOut = [-1, 1].map(() => add(S.ringGeo(.0164, .0144, .005, 28).rotateX(Math.PI / 2), M.steel));
      /* columna: volante → tramo superior → cardán → tramo intermedio telescópico → cardán → eje del piñón */
      const swP = new T.Vector3((.52 - 1.7) * (LAB.car ? LAB.car.mx : 1), .655, 0), swA = new T.Vector3(Math.cos(.38), -Math.sin(.38), 0), uj1 = swP.clone().addScaledVector(swA, .36);
      const toU = uj1.clone().sub(R0).normalize(), tau = Math.atan2(toU.y, -toU.x) + 4 * DEG, qh = new T.Vector3(-Math.cos(tau), Math.sin(tau), 0), nUp = new T.Vector3(Math.sin(tau), Math.cos(tau), 0);
      /* el piñón engrana por encima de la barra: su eje pasa a (radio de la barra − altura del diente + radio primitivo) del eje de la cremallera */
      const PC = R0.clone().addScaledVector(nUp, .0262), uj2 = PC.clone().addScaledVector(qh, .115), d12 = uj2.clone().sub(uj1).normalize(), L12 = uj2.distanceTo(uj1);
      Object.assign(A, { swP, swA, uj1, uj2, d12, qh });
      A.pinion = add(S.put(S.lathe([[0, -.036], [.022, -.036], [.0255, -.032], [.0255, .02], [.0225, .024], [.0225, .031], [.016, .035], [.016, .047], [.0125, .05], [.0125, .054], [.0088, .054]], 40), PC, qh), M.alu, { name: "Torre del piñón", mat: "Aluminio mecanizado (una pieza con la carcasa)", kg: .35, info: "Aloja el piñón, sus dos rodamientos y la válvula rotativa de la asistencia. Su eje apunta a la columna: por eso va inclinada hacia el piloto." });
      for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + k * Math.PI / 2; add(S.put(S.hex(.0042, .004), PC.clone().addScaledVector(qh, -.038).addScaledVector(Z1, Math.cos(a) * .017).addScaledVector(nUp, Math.sin(a) * .017), qh.clone().negate()), M.bolt) }
      const yokeGeo = () => { const lug = S.lugGeo(.02, .017, .0048, .005), gs = []; for (const s of [1, -1]) gs.push(lug.clone().rotateY(Math.PI / 2).translate(s * .0145, 0, 0)); gs.push(new T.BoxGeometry(.034, .006, .02).translate(0, -.017, 0), S.cyl(.0128, .02, 24).translate(0, -.03, 0), S.cyl(.0026, .03, 10).rotateZ(Math.PI / 2).translate(0, -.031, .0105)); return S.merge(gs) };
      const crossGeo = () => S.merge([new T.BoxGeometry(.013, .013, .013), S.cyl(.0046, .036, 14).rotateZ(Math.PI / 2), S.cyl(.0046, .036, 14).rotateX(Math.PI / 2), ...[[1, 0], [-1, 0], [0, 1], [0, -1]].map(([cx, cz]) => (cx ? S.cyl(.0068, .0035, 16).rotateZ(Math.PI / 2) : S.cyl(.0068, .0035, 16).rotateX(Math.PI / 2)).translate(cx * .0188, 0, cz * .0188))]);
      const splined = (r, L, n) => { const gq = new T.CylinderGeometry(r, r, L, n * 2, 1), p = gq.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), rr = Math.hypot(x, z); if (rr < r * .5) continue; const k = Math.round(Math.atan2(z, x) / (Math.PI / n)); k % 2 && p.setXYZ(i, x * .9, p.getY(i), z * .9) } gq.computeVertexNormals(); return gq };
      const yInfo = { name: "Junta cardán", mat: "Acero 300M con cruceta sobre agujas", kg: .12, info: "Deja que la columna cambie de dirección. Con dos juntas en fase (horquillas del tramo intermedio alineadas) y ángulos parecidos, el giro que sale es igual al que entra: sin ellas el volante iría a tirones." };
      const mk = (geo, mat, info) => add(geo, mat, info);
      const Lu = .36 - .062;
      A.uj = {
        y1a: mk(yokeGeo(), M.steel, yInfo), x1: mk(crossGeo(), M.tiDark, { name: "Cruceta de la junta cardán", mat: "Acero cementado", kg: .03, info: "Cuatro muñones a 90° sobre rodamientos de agujas." }), y1b: mk(yokeGeo(), M.steel, yInfo),
        y2a: mk(yokeGeo(), M.steel, yInfo), x2: mk(crossGeo(), M.tiDark), y2b: mk(yokeGeo(), M.steel, yInfo),
        colU: mk(S.cyl(.012, Lu - .021, 20).translate(0, -(.021 + (Lu - .021) / 2), 0), M.steel, { name: "Columna de dirección (tramo del volante)", mat: "Tubo de acero", kg: .45, info: "Sale del volante con su inclinación, pasa por el rodamiento del mamparo y termina en la primera junta cardán." }),
        colM: mk(S.merge([S.cyl(.0105, L12 - .042, 20).translate(0, -L12 / 2, 0), S.cyl(.0135, .07, 24).translate(0, -L12 * .55, 0), S.cyl(.0145, .008, 24).translate(0, -L12 * .55 + .035, 0)]), M.steel, { name: "Columna de dirección (tramo intermedio telescópico)", mat: "Acero, con manguito estriado deslizante", kg: .6, info: "Pasa por encima de las piernas del piloto. El manguito estriado deja que se acorte en un choque frontal: es obligatorio que la columna sea colapsable." }),
        colP: mk(splined(.0088, .115 - .054 - .021 + .006, 18).translate(0, -(.021 + (.115 - .054 - .021) / 2) - .003, 0), M.steel, { name: "Eje de entrada del piñón (estriado)", mat: "Acero cementado", kg: .08, info: "Dentro lleva la barra de torsión de la válvula rotativa: lo que se retuerce con el esfuerzo del piloto abre el paso de aceite hacia un lado u otro del cilindro de asistencia." })
      };
      /* mamparo del salpicadero con el rodamiento que guía el tramo superior */
      {
        const B = swP.clone().addScaledVector(swA, .19), up = new T.Vector3(Math.sin(.38), Math.cos(.38), 0), sh = new T.Shape(), w = .11, h = .062, rr = .02;
        sh.moveTo(-w + rr, -h), sh.lineTo(w - rr, -h), sh.absarc(w - rr, -h + rr, rr, -Math.PI / 2, 0, !1), sh.lineTo(w, h - rr), sh.absarc(w - rr, h - rr, rr, 0, Math.PI / 2, !1), sh.lineTo(-w + rr, h), sh.absarc(-w + rr, h - rr, rr, Math.PI / 2, Math.PI, !1), sh.lineTo(-w, -h + rr), sh.absarc(-w + rr, -h + rr, rr, Math.PI, Math.PI * 1.5, !1);
        const ho = new T.Path(); ho.absarc(0, 0, .0205, 0, Math.PI * 2, !0), sh.holes.push(ho);
        for (const sx of [-1, 1]) { const lh = new T.Path(); lh.absarc(sx * .066, 0, .026, 0, Math.PI * 2, !0), sh.holes.push(lh) }
        const plate = new T.ExtrudeGeometry(sh, { depth: .006, bevelEnabled: !1, curveSegments: 16 }).translate(0, 0, -.003).applyMatrix4(new T.Matrix4().makeBasis(Z1, up, new T.Vector3().crossVectors(Z1, up)).setPosition(B));
        add(plate, M.carbon, { name: "Mamparo del salpicadero (monocasco)", mat: "Laminado de carbono con inserto de aluminio", kg: .3, info: "Parte de la estructura del monocasco: aquí se apoya la columna. Los aligeramientos dejan pasar las piernas y el cableado." });
        add(S.put(S.ringGeo(.0215, .0124, .018, 30), B, swA), M.steel, { name: "Rodamiento de la columna", mat: "Rodamiento de bolas en soporte de aluminio", kg: .08, info: "Guía el tramo superior: sin él, las dos juntas cardán dejarían la columna suelta." });
        for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + k * Math.PI / 2; add(S.put(S.hex(.0038, .004), B.clone().addScaledVector(Z1, Math.cos(a) * .03).addScaledVector(up, Math.sin(a) * .03).addScaledVector(swA, -.005), swA.clone().negate()), M.bolt) }
      }
    } else {
      /* eje trasero: horquilla fija para cada bieleta de convergencia, sobre un saliente de la carcasa de la caja */
      for (const sd of [-1, 1]) {
        const p = S.W(g.TI, sd);
        add(clevis(sd).translate(p.x, p.y, p.z), M.bracket, { name: "Horquilla de la bieleta de convergencia", mat: "Titanio mecanizado", kg: .08, info: "Fija en la carcasa de la caja de cambios. Detrás no hay cremallera: la convergencia se regula con la longitud de la bieleta." });
        add(clevisBolt().translate(p.x, p.y, p.z), M.bolt);
        add(new T.CylinderGeometry(.024, .037, .034, 4, 1).rotateY(Math.PI / 4).rotateX(sd * Math.PI / 2).translate(p.x, p.y, p.z - sd * .047), M.bracket, { name: "Saliente de la carcasa de la caja de cambios", mat: "Titanio o carbono con inserto", kg: .2, info: "Los anclajes de la suspensión trasera van directamente en la carcasa de la caja, que es parte de la estructura del coche." })
      }
    }
    A.sw = new T.Group(); root.add(A.sw);
    A.sw.userData.part = { name: "Volante", mat: "Carbono con pantalla y mandos", kg: 1.3, info: "Giro de tope a tope ≈ 360°. Pantalla con marcha, revoluciones y batería; botones de radio, limitador de boxes y neutro; ruedas de reparto de frenada, diferencial y mapa de motor; levas de cambio y de embrague por detrás." };
    {
      /* volante de F1: cuerpo de carbono en mariposa, empuñaduras, pantalla, botones, ruedas selectoras, levas y cierre rápido.
         Ejes locales: x a lo largo de la columna (el piloto está en −x), y hacia arriba, z lateral */
      const sw = A.sw, addSw = (geo, mat) => { const o = new T.Mesh(geo, mat); o.castShadow = !0, sw.add(o); return o };
      const sh = new T.Shape(), W2 = .132, H2 = .074;
      sh.moveTo(-W2 + .03, -H2), sh.lineTo(W2 - .03, -H2), sh.quadraticCurveTo(W2, -H2, W2, -H2 + .03), sh.lineTo(W2, H2 - .05), sh.quadraticCurveTo(W2, H2 - .02, W2 - .035, H2 - .012),
        sh.lineTo(.06, H2), sh.lineTo(-.06, H2), sh.lineTo(-W2 + .035, H2 - .012), sh.quadraticCurveTo(-W2, H2 - .02, -W2, H2 - .05), sh.lineTo(-W2, -H2 + .03), sh.quadraticCurveTo(-W2, -H2, -W2 + .03, -H2);
      /* la forma se dibuja en (z, y) y se extruye a lo largo de x */
      const body = new T.ExtrudeGeometry(sh, { depth: .02, bevelEnabled: !0, bevelThickness: .004, bevelSize: .004, bevelSegments: 2, curveSegments: 10 });
      body.rotateY(-Math.PI / 2), body.translate(.01, 0, 0);
      const cfm = M.carbon.clone(); cfm.map = M.carbon.map.clone(), cfm.map.repeat.set(14, 14), cfm.map.needsUpdate = !0;
      addSw(body, cfm);
      /* empuñaduras de goma moldeada */
      const grip = new T.MeshStandardMaterial({ color: "#16171a", roughness: .92, metalness: 0 });
      for (const sd of [-1, 1]) {
        const pts = [[.004, .066, .118], [-.008, .05, .142], [-.014, 0, .15], [-.008, -.05, .142], [.004, -.066, .118]].map(q => new T.Vector3(q[0], q[1], sd * q[2]));
        addSw(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 24, .017, 12), grip);
        for (const q of [pts[0], pts[4]]) addSw(new T.SphereGeometry(.017, 12, 10).translate(q.x, q.y, q.z), grip)
      }
      /* pantalla */
      const cv = document.createElement("canvas"); cv.width = 384, cv.height = 224;
      const g = cv.getContext("2d");
      g.fillStyle = "#05070a", g.fillRect(0, 0, 384, 224);
      for (let i = 0; i < 15; i++) g.fillStyle = i < 5 ? "#2fd16c" : i < 10 ? "#e8402f" : "#3d7bff", g.globalAlpha = i < 11 ? 1 : .22, g.beginPath(), g.arc(24 + i * 24, 20, 8, 0, 7), g.fill();
      g.globalAlpha = 1, g.fillStyle = "#f2f4f6", g.font = "900 120px Arial, sans-serif", g.textAlign = "center", g.textBaseline = "middle", g.fillText("6", 192, 126);
      g.font = "700 26px Arial, sans-serif", g.fillStyle = "#9fe870", g.textAlign = "left", g.fillText("+0.124", 14, 70), g.fillStyle = "#ffd23f", g.textAlign = "right", g.fillText("SOC 78", 370, 70);
      g.fillStyle = "#cfd6dd", g.font = "700 22px Arial, sans-serif", g.textAlign = "left", g.fillText("BB 59.0", 14, 190), g.textAlign = "right", g.fillText("DIF 4", 370, 190), g.textAlign = "left", g.fillStyle = "#6b7682", g.fillText("242", 14, 130), g.textAlign = "right", g.fillText("ERS 3", 370, 130);
      g.strokeStyle = "#232a33", g.lineWidth = 3, g.strokeRect(1.5, 1.5, 381, 221);
      const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace, tex.anisotropy = 4;
      const scr = addSw(new T.PlaneGeometry(.096, .056), new T.MeshBasicMaterial({ map: tex }));
      scr.rotation.y = -Math.PI / 2, scr.position.set(-.0166, .012, 0), scr.castShadow = !1;
      addSw(new T.BoxGeometry(.004, .064, .104).translate(-.0142, .012, 0), M.aluBlk);
      /* botones y ruedas selectoras */
      const btn = (col, y, z) => { addSw(new T.CylinderGeometry(.0072, .0072, .007, 16).rotateZ(Math.PI / 2).translate(-.0175, y, z), new T.MeshStandardMaterial({ color: col, roughness: .45, metalness: .1, emissive: col, emissiveIntensity: .12 })); addSw(new T.CylinderGeometry(.0092, .0092, .003, 16).rotateZ(Math.PI / 2).translate(-.0152, y, z), M.aluBlk) };
      [["#d8342c", .05, .076], ["#f2c230", .024, .08], ["#2fb45e", -.002, .08], ["#2f6fe0", .05, -.076], ["#e9ecef", .024, -.08], ["#8a4fd8", -.002, -.08], ["#ff7a1a", .058, .038], ["#19b8c8", .058, -.038]].forEach(q => btn(q[0], q[1], q[2]));
      const dial = (col, y, z) => { addSw(new T.CylinderGeometry(.012, .0135, .011, 20).rotateZ(Math.PI / 2).translate(-.0195, y, z), M.aluBlk); addSw(new T.CylinderGeometry(.0075, .0075, .004, 16).rotateZ(Math.PI / 2).translate(-.026, y, z), new T.MeshStandardMaterial({ color: col, roughness: .4, metalness: .5 })); addSw(new T.BoxGeometry(.003, .007, .0022).translate(-.027, y + .006, z), new T.MeshBasicMaterial({ color: "#ffffff" })) };
      dial("#d8342c", -.046, -.062), dial("#2f6fe0", -.05, 0), dial("#f2c230", -.046, .062);
      /* levas de cambio (arriba) y de embrague (abajo), y cierre rápido de la columna */
      for (const sd of [-1, 1]) {
        addSw(new T.BoxGeometry(.004, .05, .062).translate(.042, .012, sd * .092), cfm), addSw(new T.BoxGeometry(.02, .012, .012).translate(.032, .012, sd * .064), M.aluBlk);
        addSw(new T.BoxGeometry(.004, .034, .05).translate(.046, -.04, sd * .074), cfm), addSw(new T.BoxGeometry(.022, .01, .01).translate(.034, -.04, sd * .052), M.aluBlk)
      }
      addSw(new T.CylinderGeometry(.027, .024, .04, 24).rotateZ(Math.PI / 2).translate(.046, 0, 0), M.alu), addSw(new T.CylinderGeometry(.031, .031, .01, 24).rotateZ(Math.PI / 2).translate(.062, 0, 0), M.knobR)
    }
    /* ===== barra estabilizadora de láminas =====
       Tubo de torsión transversal sobre dos apoyos; en cada extremo un cubo estriado con una lámina que se puede girar sobre su eje largo
       (de plano es blanda, de canto es dura) y, en la punta, una bola en la que encaja la cazoleta de la bieleta que sube del balancín */
    const rpR = S.W(g.RP, 1), ax = rpR.x - .11, ay = rpR.y + .03, az = Math.abs(rpR.z) - .02;
    A.arbTube = add(S.put(S.cyl(.011, az * 2 - .02, 24), new T.Vector3(ax, ay, 0), new T.Vector3(0, 0, 1)), M.tiDark.clone(), { name: "Barra estabilizadora (tubo de torsión)", mat: "Titanio β", kg: .5, info: "Se retuerce solo cuando las dos ruedas suben distinto (balanceo); su rigidez reparte la transferencia de carga entre ejes." });
    A.arbC = new T.Vector3(ax, ay, 0), A.arbZ = az;
    for (const sz of [-1, 1]) {
      /* soporte colgado del monocasco: anillo con casquillo, alma y pletina con dos tornillos */
      const zc = sz * az * .5, sup = S.merge([S.ringGeo(.0175, .0112, .014, 28).rotateX(Math.PI / 2), new T.BoxGeometry(.022, .026, .012).translate(0, .029, 0), new T.BoxGeometry(.06, .006, .024).translate(0, .045, 0), S.hex(.0046, .004).translate(-.021, .04, 0), S.hex(.0046, .004).translate(.021, .04, 0)]);
      add(sup.translate(ax, ay, zc), M.alu, { name: "Apoyo de la barra estabilizadora", mat: "Aluminio con casquillo de PTFE", kg: .06, info: "La barra gira libre en dos apoyos atornillados al monocasco: solo trabaja a torsión." })
    }
    const bladeM = new T.MeshStandardMaterial({ color: "#3d4a5a", metalness: 1, roughness: .32 });
    A.blades = [-1, 1].map(sd => {
      const gr = new T.Group(); gr.position.set(ax, ay, sd * az), root.add(gr);
      const hub = S.mesh(S.merge([S.cyl(.0165, .024, 28).rotateX(Math.PI / 2), S.cyl(.0028, .036, 10).translate(-.012, 0, 0), S.hex(.0048, .004).translate(-.012, .019, 0)]), M.ti, { name: "Cubo estriado de la lámina", mat: "Titanio", kg: .05, info: "Une la lámina con la barra por un estriado fino y un tornillo de apriete." });
      const b = new T.Group(), sh = new T.Shape();
      sh.moveTo(.014, -.013), sh.lineTo(.068, -.0085), sh.lineTo(.074, -.006), sh.lineTo(.074, .006), sh.lineTo(.068, .0085), sh.lineTo(.014, .013), sh.closePath();
      const plate = S.mesh(new T.ExtrudeGeometry(sh, { depth: .0064, bevelEnabled: !0, bevelSize: .0008, bevelThickness: .0008, bevelSegments: 1 }).translate(0, 0, -.0032).rotateX(Math.PI / 2), bladeM, { name: "Lámina de la estabilizadora", mat: "Acero de muelle", kg: .08, info: "Girar la lámina de plano a canto cambia su rigidez a flexión: así se ajusta la barra desde el habitáculo sin desmontarla." });
      b.add(plate, S.mesh(S.cyl(.0085, .02, 20).rotateZ(Math.PI / 2).translate(.008, 0, 0), M.steel), S.mesh(S.cyl(.0036, .012, 12).rotateZ(Math.PI / 2).translate(.079, 0, 0), M.steel), S.mesh(new T.SphereGeometry(.0062, 18, 14).translate(.088, 0, 0), M.ball, { name: "Bola de la lámina", mat: "Acero cromado", kg: .01, info: "La cazoleta de la bieleta abraza esta bola: la unión admite cualquier ángulo, también cuando se gira la lámina." }));
      gr.add(hub, b);
      return { gr, b }
    });
    A.tipX = .088;
    A.drops = [-1, 1].map(() => add(S.cyl(.004, 1, 14), M.steel, { name: "Bieleta de la estabilizadora", mat: "Titanio con rótula y cazoleta", kg: .05, info: "Lleva el movimiento del balancín a la punta de la lámina. Trabaja a tracción o compresión." }));
    const dre = S.rodEndGeo(.006, .012);
    A.dropEyes = [-1, 1].map(() => add(S.merge([dre.body.clone(), dre.thread.clone(), dre.nut.clone()]), M.steel, { name: "Rótula de la bieleta (balancín)", mat: "Acero con pista de PTFE", kg: .02, info: "Gira sobre el bulón del balancín." }));
    A.dropCups = [-1, 1].map(() => add(S.lathe([[0, -.0045], [.0086, -.0045], [.0096, -.001], [.0096, .0055], [.0078, .009], [.0052, .012], [.0042, .017], [0, .017]], 22), M.steel, { name: "Cazoleta de la bieleta", mat: "Acero con asiento de PTFE", kg: .02, info: "Abraza la bola de la punta de la lámina." }));
    /* ===== tercer elemento (heave) =====
       Amortiguador con muelle helicoidal y topes entre los dos balancines, con una rótula en cada extremo sobre el bulón de su balancín */
    A.heaveBody = add(S.lathe([[0, 0], [.0135, 0], [.018, .03], [.018, .9], [.0205, .91], [.0205, .97], [.016, 1], [.0072, 1]], 28), M.damper, { name: "Tercer elemento (heave)", mat: "Amortiguador con muelle helicoidal y topes de elastómero", kg: .9, info: "Solo trabaja cuando las dos ruedas suben a la vez: controla la altura bajo carga aerodinámica sin endurecer el balanceo." });
    A.heaveRod = add(S.cyl(.006, 1, 16), M.chrome, { name: "Vástago del tercer elemento", mat: "Acero cromado duro", kg: .1, info: "" });
    const hre = S.rodEndGeo(.009, .004);
    A.heaveEyes = [0, 1].map(() => add(S.merge([hre.body.clone(), hre.thread.clone()]), M.steel, { name: "Rótula del tercer elemento", mat: "Acero con pista de PTFE", kg: .03, info: "Una en cada extremo, sobre el bulón de su balancín." }));
    A.seats = [0, 1].map(() => add(S.lathe([[.0072, 0], [.03, 0], [.03, .003], [.0215, .005], [.0215, .009], [.0072, .009]], 24), M.aluBlk, { name: "Platillo del muelle", mat: "Aluminio anodizado", kg: .02, info: "Apoya el muelle; el del lado del cuerpo es roscado para dar precarga." }));
    const coil = []; for (let i = 0; i <= 160; i++) { const a = i / 160 * Math.PI * 2 * 7; coil.push(new T.Vector3(Math.cos(a) * .024, i / 160 - .5, Math.sin(a) * .024)) }
    A.coil = add(new T.TubeGeometry(new T.CatmullRomCurve3(coil), 320, .0035, 8), M.spring, { name: "Muelle del tercer elemento", mat: "Acero al cromo-silicio", kg: .25, info: "" });
    A.stops = [0, 1].map(() => add(S.cyl(.02, .012, 18), M.stop, { name: "Tope (packer)", mat: "Elastómero", kg: .01, info: "Cuando el recorrido llega al hueco del tope, la rigidez sube de golpe y protege el fondo." }));
    return A
  }
  function placeCyl(o, a, b, r) { const d = b.clone().sub(a), L = d.length(); o.matrixAutoUpdate = !1; o.matrix.copy(CAD().basisM(new T.Vector3(1, 0, 0), d, a.clone().lerp(b, .5))).multiply(new T.Matrix4().makeScale(1, Math.max(1e-4, L), 1)) }
  /* lleva un punto fijo al balancín: posición actual a partir de la estática */
  function rockerPt(Ac, local0) { return local0.clone().applyMatrix4(Ac.groups.rk.matrix) }
  function updateAxle(K, a, b, rack) {
    const S = CAD(), A = axle, AL = C.L, AR = C.R, X1 = new T.Vector3(1, 0, 0);
    const tL = S.W(a.TI, -1), tR = S.W(b.TI, 1);
    if (!A.rear) {
      /* la barra va de horquilla a horquilla; cada fuelle, del casquillo de la carcasa a la base de su horquilla */
      placeCyl(A.bar, tL.clone().setZ(tL.z + .03), tR.clone().setZ(tR.z - .03));
      [[tL, -1], [tR, 1]].forEach(([p, sd], i) => {
        const e0 = new T.Vector3(p.x, p.y, sd * (A.hw + .004)), e1z = p.z - sd * .033, L = Math.max(.012, Math.abs(e1z - e0.z));
        const o = A.boots[i]; o.matrixAutoUpdate = !1, o.matrix.copy(S.basisM(X1, new T.Vector3(0, 0, sd), e0)).multiply(new T.Matrix4().makeScale(1, L, 1));
        A.bootClampOut[i].position.set(p.x, p.y, e1z + sd * .004), A.clev[i].position.copy(p)
      });
      /* columna: el volante gira θ; cada cruceta tiene un brazo en la horquilla de entrada y el otro, perpendicular a él y al eje de
         salida, en la de salida. Las dos horquillas del tramo intermedio van en fase */
      const th = opts.steer * DEG, a1 = new T.Vector3(0, 0, 1).applyAxisAngle(A.swA, th), a2 = new T.Vector3().crossVectors(A.d12, a1).normalize(), qIn = A.qh.clone().negate(), a3 = new T.Vector3().crossVectors(qIn, a2).normalize(), U = A.uj, nd = A.d12.clone().negate();
      A.setB(U.y1a, a1, A.swA, A.uj1), A.setB(U.colU, a1, A.swA, A.uj1), A.setB(U.x1, a1, new T.Vector3().crossVectors(a2, a1), A.uj1), A.setB(U.y1b, a2, nd, A.uj1);
      A.setB(U.y2a, a2, A.d12, A.uj2), A.setB(U.colM, a2, A.d12, A.uj2), A.setB(U.x2, a2, new T.Vector3().crossVectors(a3, a2), A.uj2), A.setB(U.y2b, a3, A.qh, A.uj2), A.setB(U.colP, a3, A.qh, A.uj2);
      /* el volante gira sobre su eje en el mismo sentido que las ruedas (positivo = a derechas visto por el piloto) */
      A.sw.position.copy(A.swP), A.sw.quaternion.setFromUnitVectors(X1, A.swA).multiply(new T.Quaternion().setFromAxisAngle(X1, th))
    }
    /* puntos de estabilizadora y tercer elemento fijos a cada balancín */
    const pts = [AL, AR].map(Ac => ({ arb: rockerPt(Ac, Ac.arb0), hv: rockerPt(Ac, Ac.hv0) }));
    [-1, 1].forEach((sd, i) => {
      const Ac = i ? AR : AL, p = pts[i].arb, bl = A.blades[i];
      /* la lámina gira lo que se mueve el extremo de la bieleta */
      bl.gr.rotation.set(0, 0, clamp((p.y - Ac.arb0.y) / A.tipX, -.6, .6)), bl.b.rotation.x = opts.blade != null ? opts.blade * Math.PI / 2 : Math.PI / 4;
      bl.gr.updateMatrixWorld(!0);
      const tip = new T.Vector3(A.tipX, 0, 0).applyMatrix4(bl.gr.matrixWorld), u = tip.clone().sub(p).normalize();
      /* rótula en el bulón del balancín (eje x), barra, y cazoleta sobre la bola de la lámina */
      const ez = X1.clone().addScaledVector(u, -u.x).normalize(), yv = u.clone().negate();
      A.setB(A.dropEyes[i], new T.Vector3().crossVectors(yv, ez), yv, p);
      placeCyl(A.drops[i], p.clone().addScaledVector(u, .022), tip.clone().addScaledVector(u, -.015));
      A.dropCups[i].matrixAutoUpdate = !1, A.dropCups[i].matrix.copy(S.basisM(X1, yv, tip))
    });
    const tw = Math.abs(pts[0].arb.y - pts[1].arb.y - (AL.arb0.y - AR.arb0.y));
    A.arbTube.material.emissive.copy(heat(tw * 60)).multiplyScalar(clamp(tw * 120, 0, .35));
    /* tercer elemento entre los balancines: rótula, cuerpo, vástago, platillos, muelle y topes */
    const hL = pts[0].hv, hR = pts[1].hv, d = hR.clone().sub(hL), L = d.length(), u = d.clone().divideScalar(L), nu = u.clone().negate();
    const ezH = X1.clone().addScaledVector(u, -u.x).normalize();
    A.setB(A.heaveEyes[0], new T.Vector3().crossVectors(nu, ezH), nu, hL), A.setB(A.heaveEyes[1], new T.Vector3().crossVectors(u, ezH), u, hR);
    const b0 = hL.clone().addScaledVector(u, .022), bL = L * .55 - .022;
    A.heaveBody.matrixAutoUpdate = !1, A.heaveBody.matrix.copy(S.basisM(X1, u, b0)).multiply(new T.Matrix4().makeScale(1, bL, 1));
    placeCyl(A.heaveRod, hL.clone().addScaledVector(u, L * .5), hR.clone().addScaledVector(u, -.022));
    const s0 = hL.clone().addScaledVector(u, L * .55 + .001), s1 = hR.clone().addScaledVector(u, -.03);
    A.seats[0].matrixAutoUpdate = A.seats[1].matrixAutoUpdate = !1, A.seats[0].matrix.copy(S.basisM(X1, u, s0)), A.seats[1].matrix.copy(S.basisM(X1, nu, s1));
    const c0 = s0.clone().addScaledVector(u, .0065), c1 = s1.clone().addScaledVector(u, -.0065);
    A.coil.matrixAutoUpdate = !1, A.coil.matrix.copy(S.basisM(X1, u, c0.clone().lerp(c1, .5))).multiply(new T.Matrix4().makeScale(1, c0.distanceTo(c1), 1));
    A.stops[0].matrixAutoUpdate = A.stops[1].matrixAutoUpdate = !1;
    A.stops[0].matrix.copy(S.basisM(X1, u, s0.clone().addScaledVector(u, .016))), A.stops[1].matrix.copy(S.basisM(X1, u, s1.clone().addScaledVector(u, -.016)));
    A.heaveLen = L
  }
  /* añade al balancín de cada esquina las palancas de estabilizadora y tercer elemento */
  function rockerExtras(Ac) {
    const S = CAD(), p0 = Ac.pt0, RP = p0.RP, ra = p0.RA0.clone().sub(RP).normalize(), x = new T.Vector3(1, 0, 0), e2 = new T.Vector3().crossVectors(x, ra);
    const toIn = new T.Vector3(0, 0, -Math.sign(RP.z || 1));
    let dirArb = toIn.clone().multiplyScalar(.5).add(new T.Vector3(0, .8, 0)).normalize(); dirArb.addScaledVector(x, -dirArb.dot(x)).normalize();
    Ac.arb0 = RP.clone().addScaledVector(dirArb, .045).addScaledVector(x, -.02);
    /* el tercer elemento va 7 cm por delante del plano de los amortiguadores, para no cruzarse con ellos */
    Ac.hv0 = RP.clone().addScaledVector(toIn, .035).addScaledVector(new T.Vector3(0, -1, 0), .02).addScaledVector(x, .07);
    const g = Ac.groups.rk, mk = (a, b, w) => { const m = S.mesh(S.beam(a, b, w, .012, w * .8, .01, x, .45), M.ti, { name: "Balancín, palanca", mat: "Titanio", kg: .05, info: "Palanca para la bieleta de la estabilizadora o el tercer elemento." }); g.add(m), Ac.parts.push(m) };
    mk(RP.clone().addScaledVector(x, -.02), Ac.arb0, .016), mk(RP.clone().addScaledVector(x, .07), Ac.hv0, .016);
    g.add(S.mesh(S.put(S.cyl(.008, .014, 16), Ac.arb0, x), M.steel)), g.add(S.mesh(S.put(S.cyl(.009, .014, 16), Ac.hv0, x), M.steel))
  }
  /* carenados del modelo: trapecios girados sobre su eje interior hasta su rótula; tirante y bieleta, de su anclaje a su rótula */
  function poseFair(K, sL, sR) {
    const g = K.g3, rear = g.type === "pull", W = CAD().W;
    parts.car && (parts.car.position.x = (rear ? 1.7 : -1.7) * LAB.car.mx);
    if (axle) for (const k of ["col", "col2", "ujoint", "sw", "pinion"]) axle[k] && (axle[k].visible = !rear);
    if (!parts.fair) return;
    const v0 = new T.Vector3(), v1 = new T.Vector3(), ax = new T.Vector3();
    for (const f of parts.fair) {
      const on = f.front !== rear;
      f.hold.visible = on && parts.car.visible !== !1;
      if (!on) continue;
      const sd = f.side, sol = sd > 0 ? sR : sL, h = f.hold;
      const hinge = (A, B, O0, O1) => {
        const a = W(A, sd); ax.copy(W(B, sd)).sub(a).normalize();
        v0.copy(W(O0, sd)).sub(a), v0.addScaledVector(ax, -v0.dot(ax)).normalize(), v1.copy(W(O1, sd)).sub(a), v1.addScaledVector(ax, -v1.dot(ax)).normalize();
        h.quaternion.setFromUnitVectors(v0, v1)
      };
      const aim = (I0, O0, I1, O1) => { h.position.copy(W(I1, sd)), v0.copy(W(O0, sd)).sub(W(I0, sd)).normalize(), v1.copy(W(O1, sd)).sub(h.position).normalize(), h.quaternion.setFromUnitVectors(v0, v1) };
      f.mem === "uw" ? (h.position.copy(W(g.UF, sd)), hinge(g.UF, g.UR, g.UO, sol.UO)) : f.mem === "lw" ? (h.position.copy(W(g.LF, sd)), hinge(g.LF, g.LR, g.LO, sol.LO)) : f.mem === "shr" ? (h.position.copy(W(g.LR, sd)), hinge(g.LF, g.LR, g.LO, sol.LO)) : f.mem === "rod" ? aim(g.RA0, g.PO, sol.RA, sol.PO) : f.mem === "tie" && aim(g.TI, g.TO, sol.TI, sol.TO)
    }
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
    /* detrás no hay dirección: el volante solo mueve la cremallera del eje delantero */
    const K = m.K, rack = K.g3.type === "pull" ? 0 : opts.steer * .3e-3;
    opts.blade = clamp((m.P && m.P.karb != null ? m.P.karb : 600) / 2000, 0, 1);
    if (K !== frame.k) { frame.k = K, rebuild(m), C.L.prev = C.R.prev = null }
    const solve = (A, s) => { const sol = LAB.kin3d.solve(K.g3, thetaFor(K, s * ex), rack * A.side, A.prev) || A.prev; sol && (A.prev = sol); return sol };
    const sL = solve(C.L, aux.sL || 0), sR = solve(C.R, aux.sR || 0);
    if (!sL || !sR) return null;
    const v = (m.P && m.P.speed || 200) / 3.6, spin = -v / K.g3.R / 60;
    const opt = side => ({ explode: opts.explode, spin: spin, load: side > 0 ? aux.FtR || 0 : aux.FtL || 0, discT: opts.discT, ex, kt: K.kt || 3e5 });
    CAD().update(C.L, sL, opt(-1)), CAD().update(C.R, sR, opt(1));
    updateAxle(K, sL, sR, rack);
    poseFair(K, sL, sR);
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
      const placed = [], inf = host.querySelector(".s3info"), ib = inf && inf.offsetParent ? inf.getBoundingClientRect() : null, b0 = ib ? ib.top - rect.top - 12 : -1, b1 = ib ? ib.bottom - rect.top + 12 : -1;
      L.forEach((q, i) => {
        vv.copy(CAD().W(q.c, 1)).lerp(CAD().W(q.p, 1), .5).project(cam);
        const e = es[i], vis = vv.z < 1 && Math.abs(vv.x) < .98 && Math.abs(vv.y) < .98 && !opts.explode;
        e.style.display = vis && opts.show.loads ? "" : "none", e.className = q.f >= 0 ? "t" : "c", e.textContent = (q.f >= 0 ? "+" : "−") + Math.abs(q.f / 1e3).toFixed(1) + " kN";
        if (!vis) return;
        const x = (vv.x + 1) / 2 * rect.width;
        let y = (1 - vv.y) / 2 * rect.height;
        /* nunca encima del texto de la cabecera de la vista */
        ib && y > b0 && y < b1 && (y = b0 < rect.height / 2 ? b1 : b0);
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
  return { init, frame, setEx, setOpts, checks, sweep: () => sweep, cam: a => camSet && camSet(a) }
})();
