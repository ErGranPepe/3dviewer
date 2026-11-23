/* ===================== SUSPENSIÓN EN VIVO (dentro del simulador) =====================
   El mismo conjunto CAD del Laboratorio, con la geometría que se diseñó allí (si se envió al simulador), movido por el
   estado del coche que sigue la cámara: recorrido de cada rueda a partir de su carga (estática + aerodinámica +
   transferencias longitudinal y lateral repartidas por la rigidez de muelle, tercer elemento y estabilizadora),
   giro real de la dirección, rueda girando a su velocidad, disco a su temperatura y neumático aplastado por su carga. */
window.SUSP_LIVE = (() => {
  let T, R, scene, cam, C = null, K = null, host, info, on = !1, raf = 0, setup = null, az = .62, el = .26, dist = 2.6, lastT = 0, spinAcc = 0;
  const S = () => LAB.suspcad;
  function params() {
    let L = null;
    try { L = JSON.parse(localStorage.getItem("pn3-setup") || "null") } catch { }
    setup = L && L.v === 2 ? L : null;
    /* el coche del reglamento elegido en el simulador: vía y radio de rueda; los puntos exteriores siguen a la vía */
    const base = LAB.kin3d.toParams(LAB.kin3d.PUSH);
    Object.assign(base, { rtyre: LAB.kin3d.PUSH.R, track: LAB.kin3d.PUSH.track, camber: -3.2, toe: .1 }, setup && setup.hp || {});
    return base
  }
  function table(P) {
    const H = LAB.kin3d.fromParams(P), T3 = LAB.kin3d.table(H), raw = T3.raw;
    if (raw.length < 30) return null;
    const mid = raw.reduce((q, r) => Math.abs(r.sw) < Math.abs(q.sw) ? r : q, raw[0]);
    const i = raw.indexOf(mid), a = raw[Math.max(0, i - 3)], b = raw[Math.min(raw.length - 1, i + 3)];
    return { ok: !0, g3: T3.g, raw, mid, MR: -(b.Ld - a.Ld) / (b.sw - a.sw || 1e-9), P }
  }
  function thetaFor(s) {
    const raw = K.raw, sx = clamp(s, raw[0].sw, raw[raw.length - 1].sw);
    let lo = 0, hi = raw.length - 1;
    for (; hi - lo > 1;) { const m = (lo + hi) >> 1; raw[m].sw < sx ? lo = m : hi = m }
    const a = raw[lo], b = raw[hi], t = (sx - a.sw) / (b.sw - a.sw || 1e-9);
    return a.th + (b.th - a.th) * t
  }
  function build() {
    T = window.THREE;
    host = document.createElement("div"), host.id = "suspLive", host.innerHTML = '<div class="slh"><b>Suspensión delantera en vivo</b><span id="slCar"></span><button id="slX" title="Cerrar">×</button></div><div class="slv"></div><div class="sli" id="slInfo"></div>';
    document.body.appendChild(host);
    const view = host.querySelector(".slv");
    info = host.querySelector("#slInfo");
    host.querySelector("#slX").onclick = () => show(!1);
    S().init(T);
    R = new T.WebGLRenderer({ antialias: !0, alpha: !1 }), R.setPixelRatio(Math.min(1.5, devicePixelRatio || 1)), R.outputColorSpace = T.SRGBColorSpace, R.toneMapping = T.ACESFilmicToneMapping, R.toneMappingExposure = 1.05, R.shadowMap.enabled = !0;
    view.appendChild(R.domElement);
    scene = new T.Scene(), scene.background = new T.Color("#0c0f13"), cam = new T.PerspectiveCamera(30, 1.5, .01, 20);
    const pm = new T.PMREMGenerator(R), envS = new T.Scene();
    envS.add(new T.Mesh(new T.BoxGeometry(20, 10, 20), new T.MeshBasicMaterial({ color: "#2b3138", side: T.BackSide })));
    for (const [x, y, z, c] of [[0, 4.8, 0, 7], [-9, 2, 3, 3.5], [9, 2, -3, 2.6]]) { const p = new T.Mesh(new T.PlaneGeometry(6, 2.5), new T.MeshBasicMaterial({ color: new T.Color(c, c, c) })); p.position.set(x, y, z), p.lookAt(0, 0, 0), envS.add(p) }
    scene.environment = pm.fromScene(envS, .03).texture;
    scene.add(new T.HemisphereLight("#dfe7ef", "#1a1f26", .45));
    const key = new T.DirectionalLight("#fff3e2", 2.3); key.position.set(1.4, 2.8, 1.6), key.castShadow = !0, key.shadow.mapSize.set(1024, 1024), Object.assign(key.shadow.camera, { left: -1.3, right: 1.3, top: 1.3, bottom: -1.3 }), scene.add(key);
    const floor = new T.Mesh(new T.PlaneGeometry(6, 6), new T.MeshStandardMaterial({ color: "#14181d", roughness: .92 })); floor.rotation.x = -Math.PI / 2, floor.receiveShadow = !0, scene.add(floor);
    const grid = new T.GridHelper(6, 60, "#1f2a35", "#171d24"); grid.position.y = .001, scene.add(grid);
    const M = S().mats(), mono = new T.Mesh(new T.CylinderGeometry(.21, .3, 1.5, 4, 1, !0).rotateY(Math.PI / 4).rotateZ(Math.PI / 2), M.mono);
    mono.scale.set(1, 1.15, .95), mono.position.set(-.35, .38, 0), scene.add(mono);
    /* carrocería real del coche en transparencia, escalada como en el simulador */
    LAB.carmesh && LAB.carmesh.load().then(d => {
      if (!d) return;
      const r26 = window.Sim && Sim.CAR && Sim.CAR.reg === "2026", mx = r26 ? 1 : 3.6 / 3.4;
      const g = LAB.carmesh.build(T, d, { ghost: .14, filter: m => (m.g === "static" || m.g === "nose") && !/tyre|rim|disc|gold|mirror/.test(m.m || "") });
      g.children[0].scale.set(mx, 1, r26 ? 1.01 : 1.0627), g.position.x = -1.7 * mx, scene.add(g), mono.visible = !1
    });
    rebuild();
    /* arrastrar para girar la vista */
    let drag = null;
    const cv = R.domElement;
    cv.addEventListener("pointerdown", e => { drag = [e.clientX, e.clientY], cv.setPointerCapture(e.pointerId) });
    cv.addEventListener("pointermove", e => { if (!drag) return; az += (e.clientX - drag[0]) * .008, el = clamp(el + (e.clientY - drag[1]) * .006, -.1, 1.4), drag = [e.clientX, e.clientY] });
    cv.addEventListener("pointerup", () => drag = null), cv.addEventListener("wheel", e => { e.preventDefault(), dist = clamp(dist * Math.exp(e.deltaY * .001), .8, 5) }, { passive: !1 });
    window.addEventListener("storage", e => e.key === "pn3-setup" && C && rebuild())
  }
  function rebuild() {
    if (C) for (const k of ["L", "R"]) { scene.remove(C[k].root); C[k].root.traverse(o => o.geometry && o.geometry.dispose()) }
    const P = params();
    K = table(P);
    if (!K) return;
    const spec = { tyreR: K.g3.R, tyreW: window.Sim && Sim.CAR && Sim.CAR.reg === "2026" ? .28 : .305, axes: S().optimiseAxes(K, (KK, s) => thetaFor(s)), disc: (setup && setup.discD || 328) / 1e3, shims: clamp(Math.round(4 + ((P.camber ?? -3.2) + 3.2) * -5), 0, 12) };
    C = { L: S().buildCorner(scene, K, -1, spec), R: S().buildCorner(scene, K, 1, spec) };
    /* tabla giro de rueda → cremallera con la misma geometría de dirección (rueda derecha; la izquierda es simétrica) */
    const th0 = thetaFor(0), tb = [];
    for (let i = -40; i <= 40; i++) { const rk = i * .002, q = LAB.kin3d.solve(K.g3, th0, rk, null); q && tb.push([q.toe - K.g3.toe0, rk]) }
    tb.sort((a, b) => a[0] - b[0]), K.steerTb = tb
  }
  function rackFor(delta) {
    const tb = K.steerTb;
    if (!tb || tb.length < 2) return delta / DEG * .0033;
    if (delta <= tb[0][0]) return tb[0][1];
    for (let i = 1; i < tb.length; i++) if (delta <= tb[i][0]) { const [a0, r0] = tb[i - 1], [a1, r1] = tb[i]; return r0 + (r1 - r0) * (delta - a0) / (a1 - a0 || 1e-9) }
    return tb[tb.length - 1][1]
  }
  function fit() { const r = host.querySelector(".slv").getBoundingClientRect(); R.setSize(r.width, r.height, !1), cam.aspect = r.width / Math.max(1, r.height), cam.updateProjectionMatrix() }
  function loop(t) {
    raf = requestAnimationFrame(loop);
    if (!on || !K || document.hidden) return;
    if (t - lastT < 30) return;
    const dt = Math.min(.1, (t - lastT) / 1e3); lastT = t;
    const app = window.__app, w = app && app.w, c = app && app.focusCar ? app.focusCar() : null;
    let sL = 0, sR = 0, rack = 0, FzL = 3500, FzR = 3500, discT = 300, u = 0;
    if (c && w) {
      const Sim = window.Sim, CAR = Sim && Sim.CAR, mass = (CAR ? CAR.mass : 800) + (c.fuel || 0), wb = CAR ? CAR.wb : 3.6, b = CAR ? CAR.b : 1.6;
      const fz = c.fzAx || [mass * 9.81 * b / wb, 0, 0, 0], Fs = mass * 9.81 * b / wb / 2, sgn = Math.sign(c.r || 0) || 1;
      const L = setup || {}, MR = K.MR || 1, kw = (L.kspr || 500) * 1e3 * MR * MR, kh = (L.kheave || 2000) * 1e3 * MR * MR, ka = (L.karb || 600) * 1e3 * MR * MR * 2;
      const heave = (fz[0] / 2 - Fs) / (kw + kh / 2), roll = (fz[2] || 0) / (kw + ka);
      FzR = fz[0] / 2 + sgn * (fz[2] || 0), FzL = fz[0] / 2 - sgn * (fz[2] || 0);
      sR = clamp(heave + sgn * roll, -.03, .045), sL = clamp(heave - sgn * roll, -.03, .045);
      /* dirección: ángulo de rueda → desplazamiento de cremallera con la relación del Laboratorio (≈0,3 mm/° de volante, ≈11:1) */
      rack = rackFor(-(c.delta || 0));
      discT = c.sys ? c.sys.TbF : c.brakeT || 300, u = Math.max(0, c.u || 0);
      $sl("slCar", (c.code || "") + " · " + Math.round(u * 3.6) + " km/h");
      info.innerHTML = `<span>Izq. <b>${(sL * 1e3).toFixed(1)} mm</b> · ${(FzL / 1e3).toFixed(2)} kN</span><span>Dcha. <b>${(sR * 1e3).toFixed(1)} mm</b> · ${(FzR / 1e3).toFixed(2)} kN</span><span>Cremallera <b>${(rack * 1e3).toFixed(1)} mm</b></span><span>Disco <b>${Math.round(discT)} °C</b></span>${setup ? "<span class=lab>Geometría y muelles del Laboratorio</span>" : ""}`
    }
    const spin = -u / K.g3.R * dt;
    for (const [A, s, Fz] of [[C.L, sL, FzL], [C.R, sR, FzR]]) {
      const sol = LAB.kin3d.solve(K.g3, thetaFor(s), rack * A.side, A.prev) || A.prev;
      if (!sol) continue;
      A.prev = sol, S().update(A, sol, { explode: 0, spin, load: Fz, discT, ex: 1, kt: 3e5 })
    }
    const tg = new T.Vector3(.0, .32, .1), cc = Math.cos(el);
    cam.position.set(tg.x + dist * cc * Math.cos(az), tg.y + dist * Math.sin(el), tg.z + dist * cc * Math.sin(az)), cam.lookAt(tg);
    R.render(scene, cam)
  }
  const $sl = (id, t) => { const e = document.getElementById(id); e && (e.textContent = t) };
  function show(v) {
    on = v;
    if (v && !host) build();
    host && (host.hidden = !v), v && (fit(), raf || (raf = requestAnimationFrame(loop)));
    const b = document.getElementById("suspBtn"); b && b.setAttribute("aria-pressed", String(v));
    return on
  }
  return { show, toggle: () => show(!on), get on() { return on } }
})();
