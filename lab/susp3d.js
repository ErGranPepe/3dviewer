/* ===================== SUSPENSIÓN EN 3D =====================
   Eje delantero completo en 3D a partir de la misma cinemática de doble trapecio que el cálculo: trapecios con sus dos
   anclajes al monocasco, mangueta, rueda con caída y neumático que se aplasta con la carga, bieleta (pushrod o pullrod),
   balancín, amortiguador con muelle helicoidal, barra estabilizadora entre los balancines y firme bajo cada rueda.
   Los elementos cambian de color con la fuerza que transmiten. */
LAB.susp3d = (() => {
  let T, R, scene, cam, host, st, parts = null, spin = 0, ex = 3;
  const V = (x, y, z) => new T.Vector3(x, y, z);
  /* plano frontal (y lateral, z vertical) → 3D (X adelante, Y arriba, Z a la derecha) */
  const P3 = (p, side, x = 0) => V(x, p[1], p[0] * side);
  function rodMesh(r, mat) { const m = new T.Mesh(new T.CylinderGeometry(r, r, 1, 14), mat); m.castShadow = !0; scene.add(m); return m }
  function placeRod(m, a, b) { const d = b.clone().sub(a), L = d.length(); m.position.copy(a).addScaledVector(d, .5), m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()), m.scale.set(1, Math.max(1e-4, L), 1) }
  function helix(R0, wire, turns) { const pts = []; for (let i = 0; i <= turns * 18; i++) { const a = i / 18 * Math.PI * 2; pts.push(V(R0 * Math.cos(a), i / (turns * 18), R0 * Math.sin(a))) } return new T.TubeGeometry(new T.CatmullRomCurve3(pts), turns * 36, wire, 6, !1) }
  const heat = t => { t = clamp(t, 0, 1); const s = [[61, 139, 255], [47, 209, 108], [255, 210, 63], [255, 107, 26], [255, 59, 59]], x = t * (s.length - 1), i = Math.min(s.length - 2, x | 0), f = x - i; return new T.Color(...[0, 1, 2].map(k => (s[i][k] + (s[i + 1][k] - s[i][k]) * f) / 255)) };
  function corner(side) {
    const carbon = new T.MeshStandardMaterial({ color: "#2a2e33", metalness: .35, roughness: .38 }), metal = new T.MeshStandardMaterial({ color: "#b9c0c7", metalness: 1, roughness: .25 });
    const c = { side };
    c.lf = rodMesh(.011, carbon), c.lr = rodMesh(.011, carbon), c.uf = rodMesh(.01, carbon), c.ur = rodMesh(.01, carbon);
    c.up = rodMesh(.022, new T.MeshStandardMaterial({ color: "#8a8f96", metalness: .9, roughness: .35 }));
    c.push = rodMesh(.009, new T.MeshStandardMaterial({ color: "#c9ced4", metalness: .6, roughness: .35, emissive: "#000" }));
    c.rkA = rodMesh(.012, metal), c.rkB = rodMesh(.012, metal);
    c.dBody = rodMesh(.018, new T.MeshStandardMaterial({ color: "#d9a514", metalness: .7, roughness: .3 })), c.dRod = rodMesh(.007, metal);
    c.spring = new T.Mesh(helix(.026, .0035, 7), new T.MeshStandardMaterial({ color: "#2fd16c", metalness: .5, roughness: .4, emissive: "#000" })), scene.add(c.spring);
    /* rueda: neumático 18" (toro escalado a lo ancho) y llanta */
    c.wheel = new T.Group(), scene.add(c.wheel);
    const tg = new T.TorusGeometry(.295, .065, 24, 96);
    tg.scale(1, 1, 2.35), c.tyreBase = tg.attributes.position.array.slice();
    c.tyre = new T.Mesh(tg, new T.MeshStandardMaterial({ color: "#16181b", roughness: .85, emissive: "#000" })), c.tyre.castShadow = !0;
    const rim = new T.Mesh(new T.CylinderGeometry(.229, .229, .3, 48, 1, !0).rotateX(Math.PI / 2), new T.MeshStandardMaterial({ color: "#3a4048", metalness: .9, roughness: .3, side: T.DoubleSide }));
    const spokes = new T.Mesh(new T.CylinderGeometry(.2, .2, .02, 10).rotateX(Math.PI / 2), new T.MeshStandardMaterial({ color: "#5a6169", metalness: .9, roughness: .3, wireframe: !0 }));
    const disc = new T.Mesh(new T.CylinderGeometry(.14, .14, .032, 40).rotateX(Math.PI / 2), new T.MeshStandardMaterial({ color: "#2b2b2b", metalness: .3, roughness: .7, emissive: "#000" }));
    spokes.position.z = side * .05, disc.position.z = -side * .06, c.spin = new T.Group(), c.spin.add(c.tyre, rim, spokes), c.wheel.add(c.spin, disc), c.disc = disc;
    c.pad = new T.Mesh(new T.BoxGeometry(.5, .02, .36), new T.MeshStandardMaterial({ color: "#2c333b", roughness: .9 })), scene.add(c.pad);
    c.kerb = new T.Mesh(new T.BoxGeometry(.5, 1, .36), new T.MeshStandardMaterial({ color: "#d63a2f", roughness: .7 })), scene.add(c.kerb);
    c.joints = [];
    for (let i = 0; i < 9; i++) { const j = new T.Mesh(new T.SphereGeometry(.014, 12, 8), metal); scene.add(j), c.joints.push(j) }
    return c
  }
  function init(h) {
    T = window.THREE, host = h;
    if (!T) return !1;
    R = new T.WebGLRenderer({ antialias: !0 }), R.setPixelRatio(Math.min(2, devicePixelRatio || 1)), R.outputColorSpace = T.SRGBColorSpace, R.toneMapping = T.ACESFilmicToneMapping, R.shadowMap.enabled = !0, R.shadowMap.type = T.PCFSoftShadowMap;
    host.appendChild(R.domElement), R.domElement.className = "s3cv";
    scene = new T.Scene(), scene.background = new T.Color("#0d1014"), cam = new T.PerspectiveCamera(32, 1, .02, 30);
    scene.add(new T.HemisphereLight("#dfe7ef", "#1a1f26", 1.25));
    const key = new T.DirectionalLight("#fff3e2", 2.4);
    key.position.set(1.5, 2.5, 1.2), key.castShadow = !0, key.shadow.mapSize.set(1024, 1024), Object.assign(key.shadow.camera, { left: -1.4, right: 1.4, top: 1.4, bottom: -1.4 }), scene.add(key);
    const floor = new T.Mesh(new T.PlaneGeometry(8, 8), new T.MeshStandardMaterial({ color: "#151a20", roughness: .95 }));
    floor.rotation.x = -Math.PI / 2, floor.position.y = -.02, floor.receiveShadow = !0, scene.add(floor);
    const grid = new T.GridHelper(8, 80, "#22303c", "#19212a");
    grid.position.y = -.019, scene.add(grid);
    /* monocasco y morro */
    const mono = new T.Mesh(new T.BoxGeometry(1.3, .42, .46), new T.MeshPhysicalMaterial({ color: "#3a4350", metalness: .3, roughness: .35, clearcoat: 1, transparent: !0, opacity: .3, depthWrite: !1 }));
    mono.position.set(-.25, .36, 0), scene.add(mono);
    const nose = new T.Mesh(new T.CylinderGeometry(.08, .2, .9, 24).rotateZ(Math.PI / 2), new T.MeshPhysicalMaterial({ color: "#3a4350", metalness: .3, roughness: .35, clearcoat: 1, transparent: !0, opacity: .3, depthWrite: !1 }));
    nose.position.set(.75, .3, 0), scene.add(nose);
    parts = { L: corner(-1), R: corner(1), arb: rodMesh(.009, new T.MeshStandardMaterial({ color: "#ff6b1a", metalness: .7, roughness: .3, emissive: "#000" })) };
    st = { az: .75, el: .32, d: 2.7, t: V(0, .3, 0) };
    const place = () => { const c = Math.cos(st.el); cam.position.set(st.t.x + st.d * c * Math.cos(st.az), st.t.y + st.d * Math.sin(st.el), st.t.z + st.d * c * Math.sin(st.az)), cam.lookAt(st.t) };
    let drag = null;
    const cv = R.domElement;
    cv.addEventListener("pointerdown", e => { drag = [e.clientX, e.clientY], cv.setPointerCapture(e.pointerId) });
    cv.addEventListener("pointermove", e => { if (!drag) return; st.az += (e.clientX - drag[0]) * .007, st.el = clamp(st.el + (e.clientY - drag[1]) * .005, -.3, 1.45), drag = [e.clientX, e.clientY], place() });
    cv.addEventListener("pointerup", () => drag = null), cv.addEventListener("wheel", e => { e.preventDefault(), st.d = clamp(st.d * Math.exp(e.deltaY * .001), .5, 8), place() }, { passive: !1 });
    const fit = () => { const r = host.getBoundingClientRect(); R.setSize(r.width, r.height, !1), cam.aspect = r.width / Math.max(1, r.height), cam.updateProjectionMatrix() };
    new ResizeObserver(fit).observe(host), fit(), place();
    host.st = st, host.place = place;
    return !0
  }
  function setEx(v) { ex = v }
  /* actualiza una esquina con la solución cinemática para el recorrido s (m) y la carga en la huella */
  function drawCorner(c, K, s, load, rd, damperF, mr) {
    const g = K.g, side = c.side, sx = clamp(s * ex, K.S[0], K.S[K.S.length - 1]);
    let sol = K.raw[0], best = 1e9;
    for (const q of K.raw) { const d = Math.abs(q.s - sx); d < best && (best = d, sol = q) }
    const LIf = P3(g.LI, side, .2), LIr = P3(g.LI, side, -.22), UIf = P3(g.UI, side, .17), UIr = P3(g.UI, side, -.2);
    const LO = P3(sol.LO, side), UO = P3(sol.UO, side), WC = P3(sol.WC, side), CP = P3(sol.CP, side), PP = P3(sol.PP, side, -.01), RA = P3(sol.RA, side, -.01), RP = P3(g.RP, side, -.01), RD = P3(sol.RD, side, -.01), SD = P3(g.SD, side, -.01);
    placeRod(c.lf, LIf, LO), placeRod(c.lr, LIr, LO), placeRod(c.uf, UIf, UO), placeRod(c.ur, UIr, UO), placeRod(c.up, LO, UO), placeRod(c.push, PP, RA), placeRod(c.rkA, RP, RA), placeRod(c.rkB, RP, RD);
    const dd = RD.clone().sub(SD), dl = dd.length(), mid = SD.clone().addScaledVector(dd, .55);
    placeRod(c.dBody, SD, mid), placeRod(c.dRod, mid.clone().addScaledVector(dd, -.1), RD);
    c.spring.position.copy(SD.clone().addScaledVector(dd, .12)), c.spring.quaternion.setFromUnitVectors(V(0, 1, 0), dd.clone().normalize()), c.spring.scale.set(1, dl * .8, 1);
    [LIf, LIr, UIf, UIr, LO, UO, PP, RA, RD].forEach((p, i) => c.joints[i].position.copy(p));
    /* rueda con caída y giro; el neumático se aplasta con la carga */
    c.wheel.position.copy(WC), c.wheel.rotation.set(sol.camber * side, 0, 0), spin += 0, c.spin.rotation.z = -side * performance.now() / 300;
    const defl = clamp(load / 260e3, 0, .04);
    c.pad.position.set(0, CP.y - .01 - defl * ex * .3, CP.z), c.kerb.visible = rd > .002, rd > .002 && (c.kerb.scale.y = rd * ex, c.kerb.position.set(0, CP.y - .02 - rd * ex / 2, CP.z));
    /* colores por fuerza: bieleta y muelle con la fuerza del amortiguador, neumático con la carga */
    const fr = clamp(Math.abs(damperF * mr) / 9e3, 0, 1);
    c.push.material.color.copy(heat(fr)), c.push.material.emissive.copy(heat(fr)).multiplyScalar(.25), c.spring.material.color.copy(heat(fr)), c.pad.material.color.copy(heat(load / 9e3)).multiplyScalar(.75);
    return { RA, RP, sol }
  }
  function frame(m, aux) {
    if (!parts || !m || !m.K || !m.K.ok) return;
    const K = m.K, dL = aux.FsL || 0, dR = aux.FsR || 0;
    const a = drawCorner(parts.L, K, aux.sL || 0, aux.FtL || 0, aux.rL || 0, dL, 1), b = drawCorner(parts.R, K, aux.sR || 0, aux.FtR || 0, aux.rR || 0, dR, 1);
    /* barra estabilizadora entre los dos balancines: se retuerce con la diferencia de recorridos */
    const pa = a.RP.clone().add(V(-.07, -.04, 0)), pb = b.RP.clone().add(V(-.07, -.04, 0));
    placeRod(parts.arb, pa, pb);
    const tw = clamp(Math.abs((aux.sL || 0) - (aux.sR || 0)) * 40, 0, 1);
    parts.arb.material.color.copy(heat(tw)), parts.arb.material.emissive.copy(heat(tw)).multiplyScalar(.2);
    R.render(scene, cam);
    return b.sol
  }
  return { init, frame, setEx }
})();
