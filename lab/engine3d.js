/* ===================== MOTOR EN 3D =====================
   V6 a 90° modelado pieza a pieza, como un motor de museo seccionado: bloque, cárter y culatas de aluminio cortados por
   el plano del cilindro 1 (la sección se ve en rojo) con las cámaras de agua, los alojamientos de levas y los conductos
   de admisión y escape; dentro, el cigüeñal con muñequillas desfasadas 30°, brazos y contrapesos, las bielas en H con
   tapa y tornillos, los pistones torneados con la falda recubierta, segmentos y bulón, 4 válvulas por cilindro con taqué
   y muelle neumático (o metálico), árboles de levas a media velocidad, precámara con chorros de llama, turbo partido
   (compresor delante, turbina detrás y MGU-H en el eje dentro de la V), MGU-K engranado al cigüeñal y embrague.
   Todo se mueve con la cinemática exacta y se colorea con los resultados del cálculo. Las averías no están programadas:
   salen de los números (fatiga de Basquin acumulada con la regla de Miner, flotación de válvulas por inercia contra el
   muelle, holgura válvula-pistón por geometría y calado, detonación, presión en el cojinete). */
LAB.engine3d = (() => {
  let THREE, R, scene, cam, ctrl, host, res, root, crank, cyl = [], turbo, ecad = null, clipT, exh = [], cams = [], picks = [], labels = [], caps = [], shellMats = [], sel = null, mode = "real", view = "cut";
  let hidden = new Set, Theta = 0, slow = 1 / 300, ageMul = 1, lastT = 0, rpmNow = 0, stopped = null, events = [], dmg = {}, composer = null, running = !0, cyclesTotal = 0, engTime = 0, nFrame = 0, built = "", lastMode = "", clip, TX = null, MAT3 = null;
  const FIRE = [0, 3, 1, 4, 2, 5], SCAT = [1.035, .975, 1.012, .992, 1.041, .962]; /* dispersión de fabricación de la resistencia a fatiga */
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z), UP = () => V3(0, 1, 0);
  const ramp = (stops, t) => { t = clamp(t, 0, 1); const x = t * (stops.length - 1), i = Math.min(stops.length - 2, x | 0), f = x - i; return [0, 1, 2].map(k => (stops[i][k] + (stops[i + 1][k] - stops[i][k]) * f) / 255) };
  const INF = [[0, 0, 4], [40, 11, 84], [101, 21, 110], [159, 42, 99], [212, 72, 66], [245, 125, 21], [250, 193, 39], [252, 255, 164]];
  const CW = [[59, 76, 192], [124, 159, 249], [192, 212, 245], [242, 203, 183], [238, 132, 104], [180, 4, 38]];
  const inferno = t => ramp(INF, t), coolwarm = t => ramp(CW, (t + 1) / 2);
  /* color de cuerpo negro aproximado (T en K), en unidades HDR para que brille */
  const glow = T => { const u = clamp((T - 750) / 2100, 0, 1); return [1, clamp(.1 + u * 1.1, 0, .92) * Math.min(1, u * 2.2), clamp((u - .55) * 1.4, 0, .75)].map(v => v * u * u * 3.2) };

  /* ---------- texturas procedurales (sin descargas) ---------- */
  function canvasTex(w, h, draw, srgb, rep) {
    const c = document.createElement("canvas");
    c.width = w, c.height = h, draw(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c);
    return t.wrapS = t.wrapT = THREE.RepeatWrapping, srgb && (t.colorSpace = THREE.SRGBColorSpace), rep && t.repeat.set(rep, rep), t.anisotropy = 4, t
  }
  function textures() {
    /* ruido fractal para la piel de fundición del aluminio */
    const noise = (g, w, h) => {
      const img = g.createImageData(w, h), N = 64, grid = new Float32Array(N * N).map(() => Math.random());
      const val = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, s = t => t * t * (3 - 2 * t), a = grid[(yi % N) * N + xi % N], b = grid[(yi % N) * N + (xi + 1) % N], c = grid[((yi + 1) % N) * N + xi % N], d = grid[((yi + 1) % N) * N + (xi + 1) % N]; return a + (b - a) * s(xf) + (c - a) * s(yf) + (a - b - c + d) * s(xf) * s(yf) };
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = 0, f = 4 / w * N / 4, amp = .5; for (let o = 0; o < 5; o++) v += amp * val(x * f * N / 16, y * f * N / 16), f *= 2, amp *= .5; const k = (y * w + x) * 4, q = clamp(v * 255, 0, 255); img.data[k] = img.data[k + 1] = img.data[k + 2] = q, img.data[k + 3] = 255 }
      g.putImageData(img, 0, 0)
    };
    /* sarga 2x2 de fibra de carbono */
    const carbon = (g, w) => {
      const n = 8, s = w / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const hz = ((i + j) >> 1) % 2, gr = hz ? g.createLinearGradient(0, j * s, 0, j * s + s) : g.createLinearGradient(i * s, 0, i * s + s, 0);
        gr.addColorStop(0, "#07090b"), gr.addColorStop(.5, hz ? "#3b4249" : "#2a3036"), gr.addColorStop(1, "#07090b"), g.fillStyle = gr, g.fillRect(i * s, j * s, s, s)
      }
    };
    /* colores de revenido del Inconel a lo largo del colector: gris oxidado junto al puerto, azul, morado, paja */
    const tint = (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, w, 0);
      [[0, "#3c3532"], [.08, "#4a3f3b"], [.16, "#3b3f6e"], [.24, "#5a3d72"], [.32, "#8a5a4a"], [.42, "#b48a4c"], [.55, "#9c8a64"], [.75, "#7d7366"], [1, "#6d655c"]].forEach(([o, c]) => gr.addColorStop(o, c));
      g.fillStyle = gr, g.fillRect(0, 0, w, h);
      for (let i = 0; i < 900; i++) g.fillStyle = `rgba(${Math.random() < .5 ? "0,0,0" : "255,240,220"},${Math.random() * .06})`, g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 8, 1)
    };
    const hot = (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, "#fff"), gr.addColorStop(.18, "#d0d0d0"), gr.addColorStop(.5, "#707070"), gr.addColorStop(.85, "#4a4a4a"), gr.addColorStop(1, "#808080"), g.fillStyle = gr, g.fillRect(0, 0, w, h) };
    return { noise: canvasTex(256, 256, noise, !1, 14), carbon: canvasTex(128, 128, carbon, !0, 40), tint: canvasTex(512, 8, tint, !0), hot: canvasTex(256, 4, hot, !1) }
  }
  function materials() {
    const T = TX, S = o => new THREE.MeshStandardMaterial(o), Ph = o => new THREE.MeshPhysicalMaterial(o);
    return {
      alu: S({ color: "#aab0b6", metalness: .8, roughness: .52, roughnessMap: T.noise, bumpMap: T.noise, bumpScale: .35 }),
      bore: S({ color: "#c3c8cd", metalness: .9, roughness: .3 }),
      cap: new THREE.MeshBasicMaterial({ color: "#a32b26", side: THREE.BackSide }),
      carbon: Ph({ map: T.carbon, color: "#ffffff", metalness: .25, roughness: .38, clearcoat: 1, clearcoatRoughness: .06 }),
      turned: Ph({ color: "#c7ccd2", metalness: 1, roughness: .3, anisotropy: .35 }),
      skirt: S({ color: "#3b3e43", metalness: .35, roughness: .55 }),
      polish: Ph({ color: "#c4c9cf", metalness: 1, roughness: .2, anisotropy: .3 }),
      forged: S({ color: "#6e757c", metalness: .95, roughness: .42, roughnessMap: T.noise }),
      ti: Ph({ color: "#8f8b86", metalness: 1, roughness: .3, anisotropy: .4 }),
      steel: S({ color: "#b3b9c0", metalness: 1, roughness: .22 }),
      ring: S({ color: "#2f3439", metalness: .9, roughness: .38 }),
      dlc: S({ color: "#2a2d31", metalness: .9, roughness: .22 }),
      pvrs: S({ color: "#8a929b", metalness: .95, roughness: .3 }),
      spring: S({ color: "#3a3f46", metalness: .85, roughness: .35 }),
      vin: S({ color: "#cdd2d8", metalness: 1, roughness: .18 }),
      vex: S({ color: "#8b7a69", metalness: .9, roughness: .38 }),
      cf: S({ color: "#202428", metalness: .3, roughness: .42 }),
      motor: S({ color: "#2a3036", metalness: .7, roughness: .32 }),
      wheelC: S({ color: "#d6dade", metalness: 1, roughness: .18, side: THREE.DoubleSide }),
      ceramic: S({ color: "#d9cfb5", metalness: .1, roughness: .5 })
    }
  }

  /* ---------- entorno de estudio para reflejos ---------- */
  function studioEnv(renderer) {
    const s = new THREE.Scene();
    const room = new THREE.Mesh(new THREE.BoxGeometry(20, 12, 20), new THREE.MeshStandardMaterial({ color: "#8a9097", side: THREE.BackSide, roughness: .95 }));
    room.position.y = 4, s.add(room);
    const L = (w, h, x, y, z, c) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(c, c, c * 1.04) })); m.position.set(x, y, z), m.lookAt(0, 2, 0), s.add(m) };
    L(8, 3, 0, 9.5, 0, 5), L(3, 5, -9.6, 4, 2, 3), L(3, 5, 9.6, 4, -2, 2.6), L(6, 2, 0, 3, 9.6, 2), L(6, 2, 2, 5, -9.6, 1.6), L(2, 2, 6, 1, 6, 2);
    s.add(new THREE.HemisphereLight("#ffffff", "#30343a", .8));
    const pm = new THREE.PMREMGenerator(renderer), t = pm.fromScene(s, .035).texture;
    return pm.dispose(), t
  }
  /* ---------- órbita con ratón y táctil ---------- */
  const HOME = () => ({ az: .78, el: .3, d: 1.5, t: V3(-.07, .08, -.03) });
  function orbit(el, camera) {
    const st = { ...HOME() }, pts = new Map;
    let moved = 0, pinch = null, goal = null;
    const apply = () => { const c = Math.cos(st.el); camera.position.set(st.t.x + st.d * c * Math.cos(st.az), st.t.y + st.d * Math.sin(st.el), st.t.z + st.d * c * Math.sin(st.az)), camera.lookAt(st.t) };
    el.addEventListener("pointerdown", e => { el.setPointerCapture(e.pointerId), pts.set(e.pointerId, [e.clientX, e.clientY, e.button]), moved = 0, goal = null });
    el.addEventListener("pointermove", e => {
      if (!pts.has(e.pointerId)) return;
      const p = pts.get(e.pointerId), dx = e.clientX - p[0], dy = e.clientY - p[1];
      pts.set(e.pointerId, [e.clientX, e.clientY, p[2]]), moved += Math.abs(dx) + Math.abs(dy);
      if (pts.size === 2) { const a = [...pts.values()], dd = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]); pinch && (st.d = clamp(st.d * pinch / dd, .1, 3)), pinch = dd; apply(); return }
      if (p[2] === 2 || e.shiftKey) { const r = V3(0, 0, 0).setFromMatrixColumn(camera.matrix, 0), u = V3(0, 0, 0).setFromMatrixColumn(camera.matrix, 1); st.t.addScaledVector(r, -dx * st.d * .0013).addScaledVector(u, dy * st.d * .0013) }
      else st.az += dx * .006, st.el = clamp(st.el + dy * .005, -1.3, 1.5);
      apply()
    });
    const up = e => { pts.delete(e.pointerId), pinch = null };
    el.addEventListener("pointerup", up), el.addEventListener("pointercancel", up), el.addEventListener("contextmenu", e => e.preventDefault());
    el.addEventListener("wheel", e => { e.preventDefault(), goal = null, st.d = clamp(st.d * Math.exp(e.deltaY * .001), .1, 3), apply() }, { passive: !1 });
    const fly = g => goal = { ...g, t: g.t.clone() };
    const tick = () => { if (!goal) return; const k = .12; st.az += (goal.az - st.az) * k, st.el += (goal.el - st.el) * k, st.d += (goal.d - st.d) * k, st.t.lerp(goal.t, k), apply(), Math.abs(goal.d - st.d) < 1e-3 && st.t.distanceTo(goal.t) < 1e-3 && (goal = null) };
    return apply(), { st, apply, fly, tick, moved: () => moved }
  }

  /* ---------- geometría ---------- */
  function merge(list) {
    const gs = list.map(g => g.index ? g.toNonIndexed() : g);
    gs.forEach(g => g.attributes.normal || g.computeVertexNormals());
    const uv = gs.every(g => g.attributes.uv), n = gs.reduce((a, g) => a + g.attributes.position.count, 0), P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = uv ? new Float32Array(n * 2) : null;
    let o = 0;
    for (const g of gs) P.set(g.attributes.position.array, o * 3), N.set(g.attributes.normal.array, o * 3), uv && U.set(g.attributes.uv.array, o * 2), o += g.attributes.position.count;
    const out = new THREE.BufferGeometry;
    return out.setAttribute("position", new THREE.BufferAttribute(P, 3)), out.setAttribute("normal", new THREE.BufferAttribute(N, 3)), uv && out.setAttribute("uv", new THREE.BufferAttribute(U, 2)), out
  }
  /* torneado por tramos: cada tramo recto lleva su propia normal (aristas vivas, contorno liso); "pick" separa tramos */
  function lathe(pts, seg = 64, pick) {
    const a = [], b = [];
    for (let i = 0; i < pts.length - 1; i++) { const p = pts[i], q = pts[i + 1]; if (p[0] === q[0] && p[1] === q[1]) continue; const g = new THREE.LatheGeometry([new THREE.Vector2(p[0], p[1]), new THREE.Vector2(q[0], q[1])], seg); (pick && pick(p, q) ? b : a).push(g) }
    return pick ? [merge(a), merge(b)] : merge(a)
  }
  const ringPts = (ri, ro, w) => [[ri, w / 2], [ri, -w / 2], [ro, -w / 2], [ro, w / 2], [ri, w / 2]];
  /* extrusión de un perfil 2D con una base cualquiera (e1, e2 en el plano del perfil; la extrusión va por e1×e2) */
  function extrude(shape, depth, e1, e2, origin) {
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: !1, curveSegments: 40 }), e3 = e1.clone().cross(e2);
    return g.applyMatrix4(new THREE.Matrix4().makeBasis(e1, e2, e3).setPosition(origin)), g
  }
  const circ = (x, y, r, n = 48) => { const p = new THREE.Path(); p.absarc(x, y, r, 0, TAU, !0); return p };
  function pistonGeo(B, ch, crown, land1) {
    const R0 = B / 2, land = .0028, g = .0016, pts = [[0, ch - crown], [R0 - .0032, ch - crown + .0004], [R0 - .0032, -ch * .62], [R0 - .0009, -ch * .9], [R0 - .0004, -ch * .9], [R0 - .0002, -ch * .3]];
    const gr = [];
    let yt = ch - land1;
    for (let k = 0; k < 3; k++) { const w = k === 2 ? .002 : .0012; gr.push([yt - w, w]), yt -= w + land }
    const grooves = [], skirtTop = gr[2][0] - .0006;
    pts.splice(5, 1, [R0 - .0002, skirtTop]);
    for (const [y, w] of gr.reverse()) pts.push([R0 - .0002, y], [R0 - g, y], [R0 - g, y + w], [R0 - .0002, y + w]), grooves.push([y + w / 2, w]);
    pts.push([R0 - .0002, ch - .0006], [R0 - .0014, ch], [R0 * .62, ch + .0004], [R0 * .3, ch + .0012], [0, ch + .0012]);
    /* la falda (tramo exterior entre el borde inferior y el segmento rascador) lleva recubrimiento antifricción */
    const [crownG, skirtG] = lathe(pts, 72, (p, q) => p[0] >= R0 - .0005 && q[0] >= R0 - .0005 && Math.max(p[1], q[1]) <= skirtTop + 1e-6 && p[1] !== q[1]);
    const parts = [crownG];
    for (const s of [-1, 1]) { const b = new THREE.CylinderGeometry(.0074, .0074, .011, 24).rotateZ(Math.PI / 2); b.translate(s * (R0 - .0032 - .0055), 0, 0), parts.push(b); const w = new THREE.BoxGeometry(.006, ch - crown, .015); w.translate(s * (R0 - .0062), (ch - crown) / 2, 0), parts.push(w) }
    return { crown: merge(parts), skirt: skirtG, grooves }
  }
  function rodGeo(l, bigR, smallR) {
    /* sección en H: alas en los bordes del plano de giro y alma fina; de lado se ven los rebajes de la biela */
    const fw = .021, d = .0155, fl = .0032, web = .004, sh = new THREE.Shape();
    sh.moveTo(-fw / 2, -d / 2), sh.lineTo(-fw / 2 + fl, -d / 2), sh.lineTo(-fw / 2 + fl, -web / 2), sh.lineTo(fw / 2 - fl, -web / 2), sh.lineTo(fw / 2 - fl, -d / 2), sh.lineTo(fw / 2, -d / 2), sh.lineTo(fw / 2, d / 2), sh.lineTo(fw / 2 - fl, d / 2), sh.lineTo(fw / 2 - fl, web / 2), sh.lineTo(-fw / 2 + fl, web / 2), sh.lineTo(-fw / 2 + fl, d / 2), sh.lineTo(-fw / 2, d / 2), sh.closePath();
    const y0 = bigR + .005, y1 = l - smallR - .003, beam = new THREE.ExtrudeGeometry(sh, { depth: y1 - y0, bevelEnabled: !1 });
    beam.rotateX(-Math.PI / 2), beam.rotateY(Math.PI / 2), beam.translate(0, y0, 0);
    const big = lathe(ringPts(bigR, bigR + .0068, .016), 56).rotateZ(Math.PI / 2), small = lathe(ringPts(smallR, smallR + .0042, .0145), 40).rotateZ(Math.PI / 2).translate(0, l, 0);
    const parts = [beam, big, small];
    for (const s of [-1, 1]) { const b = new THREE.CylinderGeometry(.0034, .0034, .021, 12); b.translate(0, -.003, s * (bigR + .0082)), parts.push(b); const nut = new THREE.CylinderGeometry(.0044, .0044, .004, 6); nut.translate(0, -.0135, s * (bigR + .0082)), parts.push(nut) }
    return merge(parts)
  }
  function webGeo(r, pr, cwR, t) {
    /* brazo del cigüeñal: rodea la muñequilla (arriba) y lleva el contrapeso (abajo) */
    const s = new THREE.Shape(), a = pr * 1.32;
    s.moveTo(a, r), s.absarc(0, r, a, 0, Math.PI, !1), s.lineTo(-cwR * .5, -cwR * .1), s.absarc(0, 0, cwR, Math.PI * 1.03, Math.PI * 1.97, !1), s.lineTo(a, r);
    const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: !0, bevelThickness: .001, bevelSize: .0012, bevelSegments: 2, curveSegments: 28 });
    return g.translate(0, 0, -t / 2), g.rotateY(Math.PI / 2), g
  }
  function springGeo(R0, wire, turns, L) {
    const pts = [], n = turns * 20;
    for (let i = 0; i <= n; i++) { const a = i / 20 * TAU; pts.push(V3(R0 * Math.cos(a), i / n * L, R0 * Math.sin(a))) }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n * 2, wire, 6, !1)
  }
  const valveGeo = (d, stemL) => lathe([[0, 0], [d / 2, 0], [d / 2, .0012], [d * .36, .004], [d * .16, .009], [.0027, .016], [.0027, stemL - .006], [.0062, stemL - .004], [.0062, stemL], [0, stemL]], 32);
  function camLobeGeo(base, lift, w) {
    const s = new THREE.Shape(), N = 72;
    for (let i = 0; i <= N; i++) { const a = i / N * TAU, r = base + lift * Math.pow(Math.max(0, Math.cos(a)), 2.2); i ? s.lineTo(r * Math.sin(a), r * Math.cos(a)) : s.moveTo(r * Math.sin(a), r * Math.cos(a)) }
    const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: !1 });
    return g.translate(0, 0, -w / 2), g.rotateY(Math.PI / 2), g
  }
  function wheelGeo(R0, nBl, len, rev) {
    /* rueda radial: cubo cónico y álabes; rev orienta la nariz hacia fuera del motor */
    const geos = [lathe([[0, -len / 2], [R0 * .95, -len / 2], [R0 * .28, len / 2], [0, len / 2]], 40).rotateZ(rev * Math.PI / 2)];
    for (let i = 0; i < nBl; i++) {
      const sh = new THREE.Shape();
      sh.moveTo(R0 * .22, len * .5), sh.lineTo(R0 * .32, len * .5), sh.lineTo(R0, -len * .42), sh.lineTo(R0 * .92, -len * .5), sh.closePath();
      const b = new THREE.ExtrudeGeometry(sh, { depth: .0007, bevelEnabled: !1 });
      b.rotateZ(rev * Math.PI / 2), b.rotateX(i / nBl * TAU), geos.push(b)
    }
    return merge(geos)
  }

  /* ---------- montaje ---------- */
  function build() {
    const P = res.P, C = res.C, B = C.B, r = C.r, l = C.l, sp = P.spacing / 1e3, off = P.offset / 1e3, bank = P.bank * DEG, VT = LAB.engine.VT(P), M = MAT3;
    root && (scene.remove(root), root.traverse(o => { o.geometry && o.geometry.dispose() }));
    root = new THREE.Group, scene.add(root), cyl = [], exh = [], cams = [], picks = [], caps = [], shellMats = [], labels.forEach(L => L.el.remove()), labels = [];
    const ch = .021, pr = P.pinD / 2e3, pw = P.pinW / 1e3, jr = P.journal / 2e3, tw = .0085;
    const add = (m, kind, k, parent = root) => (parent.add(m), kind && picks.push([m, kind, k]), m);
    /* pieza seccionable: cara exterior en aluminio (recortada por el plano) y caras traseras en rojo que hacen de sección */
    const shell = (geo, mat, kind, layer) => { const m = add(new THREE.Mesh(geo, mat), kind); m.userData.shell = 1; const c = new THREE.Mesh(geo, M.cap); c.userData.cap = 1, root.add(c), caps.push(c), layer && (m.userData.layer = c.userData.layer = layer); return m };
    const xs = [2, 1, 0, 2, 1, 0].map((q, k) => q * sp + (k < 3 ? 0 : off)), xmin = Math.min(...xs) - .045, xmax = Math.max(...xs) + .045, xc = (xmin + xmax) / 2;
    root.position.x = -xc, clip.constant = xs[0] - xc + .0015;
    for (let k = 0; k < 6; k++) {
      const left = k < 3, beta = (left ? -1 : 1) * bank / 2, F = FIRE.indexOf(k) * 120 * DEG, dir = V3(0, Math.cos(beta), Math.sin(beta));
      cyl.push({ k, left, beta, F, psi: beta - F, x: xs[k], dir, side: V3(0, -dir.z, dir.y) })
    }
    /* cigüeñal: por pareja de cilindros, muñequilla partida (desfase 30° en V a 90°) con dos brazos y contrapesos; apoyos entre parejas */
    crank = new THREE.Group, root.add(crank);
    const pinG = new THREE.CylinderGeometry(pr, pr, pw, 40).rotateZ(Math.PI / 2), web = webGeo(r, pr, r * 1.72, tw);
    for (const c of cyl) { const pin = new THREE.Mesh(pinG, M.polish); pin.position.set(c.x, r * Math.cos(c.psi), r * Math.sin(c.psi)), add(pin, "crank", c.k, crank), c.pinMesh = pin }
    const ends = [];
    for (let q = 0; q < 3; q++) {
      const a = cyl[q], b = cyl[q + 3], lo = a.x - pw / 2 - tw / 2, hi = b.x + pw / 2 + tw / 2;
      for (const [c, x] of [[a, lo], [b, hi]]) { const w = new THREE.Mesh(web, M.forged); w.position.x = x, w.rotation.x = c.psi, add(w, "crank", c.k, crank) }
      const fly = new THREE.Mesh(new THREE.CylinderGeometry(pr * 1.25, pr * 1.25, .004, 32).rotateZ(Math.PI / 2), M.forged), am = (a.psi + b.psi) / 2;
      fly.position.set((a.x + b.x) / 2, r * Math.cos(am) * .9, r * Math.sin(am) * .9), add(fly, "crank", a.k, crank);
      ends.push([lo - tw / 2, hi + tw / 2])
    }
    const jg = new THREE.CylinderGeometry(jr, jr, 1, 40).rotateZ(Math.PI / 2);
    ends.sort((a, b) => a[0] - b[0]);
    for (const [a, b] of [[xmin - .02, ends[0][0]], [ends[0][1], ends[1][0]], [ends[1][1], ends[2][0]], [ends[2][1], xmax + .005]]) { if (b - a < .002) continue; const j = new THREE.Mesh(jg, M.polish); j.scale.x = b - a, j.position.x = (a + b) / 2, add(j, "crank", 0, crank) }
    /* morro del cigüeñal (lleva los engranajes de la distribución y del MGU-K) y discos de carbono del embrague detrás */
    add(new THREE.Mesh(new THREE.CylinderGeometry(.014, .014, .05, 28).rotateZ(Math.PI / 2).translate(xmax + .03, 0, 0), M.polish), "crank", 0, crank);
    const clutch = new THREE.Group;
    for (let q = 0; q < 7; q++) { const d = new THREE.Mesh(new THREE.CylinderGeometry(.0485, .0485, .0024, 48).rotateZ(Math.PI / 2), q % 2 ? M.cf : M.steel); d.position.x = -q * .0032, clutch.add(d), picks.push([d, "clutch"]) }
    clutch.position.x = xmin - .03, crank.add(clutch);
    /* ---- cilindros ---- */
    const deckD = r + l + ch + C.Vc / C.Ap + .0012, pg = pistonGeo(B, ch, P.crown / 1e3, P.ringland / 1e3), rodG = rodGeo(l, pr, P.pin / 2e3);
    const vIn = valveGeo(.0285, .1), vEx = valveGeo(.0245, .1), sprG = springGeo(.0118, .0016, 6, .04), va = 11 * DEG, seatV = .0055, camA = .1238, base = .0155;
    const gasG = new THREE.CylinderGeometry(B / 2 - .0003, B / 2 - .0003, 1, 56), frontG = new THREE.CylinderGeometry(1, 1, 1, 56), neum = P.vsys === "neum";
    const bucketG = new THREE.CylinderGeometry(.0125, .0125, .014, 32), pvrsG = new THREE.CylinderGeometry(.0135, .0135, .038, 32);
    for (const c of cyl) {
      const q = new THREE.Quaternion().setFromUnitVectors(UP(), c.dir), at = d => c.dir.clone().multiplyScalar(d).setX(c.x);
      c.rod = add(new THREE.Mesh(rodG, M.ti.clone()), "rod", c.k);
      c.piston = new THREE.Group, root.add(c.piston);
      c.pistonMats = [M.turned.clone(), M.skirt.clone()];
      c.pistonMesh = add(new THREE.Mesh(pg.crown, c.pistonMats[0]), "piston", c.k, c.piston), add(new THREE.Mesh(pg.skirt, c.pistonMats[1]), "piston", c.k, c.piston);
      for (const [y, w] of pg.grooves) { const rg = new THREE.Mesh(lathe(ringPts(B / 2 - .0015, B / 2 - .00005, w * .92), 72), M.ring); rg.position.y = y, c.piston.add(rg) }
      c.piston.add(new THREE.Mesh(new THREE.CylinderGeometry(P.pin / 2e3, P.pin / 2e3, B * .8, 28).rotateZ(Math.PI / 2), M.polish));
      /* gas de la cámara (color de su temperatura), frente de llama y chorros de la precámara */
      c.gas = new THREE.Mesh(gasG, new THREE.MeshBasicMaterial({ color: "#000", transparent: !0, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: !1 })), c.gas.quaternion.copy(q), root.add(c.gas);
      c.front = new THREE.Mesh(frontG, new THREE.MeshBasicMaterial({ color: "#fff0c0", transparent: !0, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: !1 })), c.front.quaternion.copy(q), root.add(c.front);
      c.jets = new THREE.Group, c.jets.quaternion.copy(q), c.jets.position.copy(at(deckD + .004)), root.add(c.jets);
      for (let j = 0; j < 6; j++) { const a = j / 6 * TAU + .26, d = V3(Math.cos(a), -.18, Math.sin(a)).normalize(), cone = new THREE.Mesh(new THREE.ConeGeometry(.0042, 1, 10, 1, !0), new THREE.MeshBasicMaterial({ color: "#ffe9a8", transparent: !0, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: !1, side: THREE.DoubleSide })); cone.quaternion.setFromUnitVectors(UP(), d.clone().negate()), cone.userData.d = d, c.jets.add(cone) }
      /* válvulas: admisión dentro de la V, escape fuera; vástagos abiertos 11° en tejado; taqué de vaso con DLC */
      c.valves = [];
      for (const kind of ["in", "ex"]) {
        const sgn = (kind === "in") === c.left ? 1 : -1, axis = c.dir.clone().multiplyScalar(Math.cos(va)).addScaledVector(c.side, sgn * Math.sin(va)).normalize();
        for (const dx of [-1, 1]) {
          const g = new THREE.Group, v = new THREE.Mesh(kind === "in" ? vIn : vEx, (kind === "in" ? M.vin : M.vex).clone()), s = new THREE.Mesh(sprG, M.spring), ch2 = new THREE.Mesh(pvrsG, M.pvrs), bk = new THREE.Mesh(bucketG, M.dlc);
          bk.position.y = .101, s.visible = !neum, ch2.visible = neum, g.add(v, s, ch2, bk), g.quaternion.setFromUnitVectors(UP(), axis);
          const seat = c.dir.clone().multiplyScalar(deckD + seatV).addScaledVector(c.side, sgn * B * .2).setX(c.x + dx * B * .2);
          g.position.copy(seat), g.userData.layer = "vt", root.add(g), picks.push([v, "valve", c.k], [s, "valve", c.k], [ch2, "valve", c.k], [bk, "valve", c.k]), c.valves.push({ g, v, s, ch2, kind, axis, seat, sgn })
        }
      }
      const plug = new THREE.Mesh(new THREE.CylinderGeometry(.0052, .0052, .055, 16), M.ceramic);
      plug.quaternion.copy(q), plug.position.copy(at(deckD + .032)), add(plug, "plug", c.k)
    }
    /* ---- bloque por bancada (con camisas y cámaras de agua), culata y tapa de levas ---- */
    const H = deckD - .06, hwB = B * .71, uc = B * .2 + camA * Math.sin(va), vc = seatV + camA * Math.cos(va), rc = base + Math.max(P.vlin, P.vlex) / 1e3 + .0022, hw = uc + rc + .0065, vtop = vc + rc + .013;
    const heads = {};
    for (const left of [!0, !1]) {
      const cs = cyl.filter(c => c.left === left), c0 = cs[0], d0 = c0.dir, s0 = c0.side, x0 = Math.min(...cs.map(c => c.x)) - hwB, x1 = Math.max(...cs.map(c => c.x)) + hwB;
      /* bloque: planta del plano de culata con los tres cilindros y dos cámaras de agua, extruida hacia el cigüeñal */
      const sh = new THREE.Shape();
      sh.moveTo(x0, -hwB), sh.lineTo(x1, -hwB), sh.lineTo(x1, hwB), sh.lineTo(x0, hwB), sh.closePath();
      for (const c of cs) sh.holes.push(circ(c.x, 0, B / 2, 64));
      for (const sg of [-1, 1]) { const j = new THREE.Path(), y = sg * (B / 2 + .0095); j.moveTo(x0 + .012, y - .003), j.lineTo(x1 - .012, y - .003), j.lineTo(x1 - .012, y + .003), j.lineTo(x0 + .012, y + .003), j.closePath(), sh.holes.push(j) }
      shell(extrude(sh, H, V3(1, 0, 0), s0.clone(), d0.clone().multiplyScalar(deckD)), M.alu, "block");
      /* culata: perfil transversal con cámara en tejado, apoyos de levas y conductos de agua, extruido a lo largo de la bancada */
      const hs = new THREE.Shape();
      hs.moveTo(-hw, 0), hs.lineTo(-B * .49, 0), hs.lineTo(-B * .4, .0045), hs.lineTo(0, .0085), hs.lineTo(B * .4, .0045), hs.lineTo(B * .49, 0), hs.lineTo(hw, 0), hs.lineTo(hw, vc);
      hs.lineTo(uc + rc, vc), hs.absarc(uc, vc, rc, 0, Math.PI, !0), hs.lineTo(-uc + rc, vc), hs.absarc(-uc, vc, rc, 0, Math.PI, !0), hs.lineTo(-hw, vc), hs.closePath();
      hs.holes.push(circ(0, .072, .0072), circ(hw - .011, .028, .0055), circ(-hw + .011, .028, .0055), circ(0, .034, .0062));
      const eH = s0.clone(), eV = d0.clone(), hLen = x1 - x0, org = d0.clone().multiplyScalar(deckD).setX(x1);
      heads[left] = shell(extrude(hs, hLen, eH, eV, org), M.alu, "head");
      /* tapa de levas de carbono (mitad superior de los apoyos) */
      const cv = new THREE.Shape();
      cv.moveTo(-hw, vc), cv.lineTo(-uc - rc, vc), cv.absarc(-uc, vc, rc, Math.PI, 0, !0), cv.lineTo(uc - rc, vc), cv.absarc(uc, vc, rc, Math.PI, 0, !0), cv.lineTo(hw, vc), cv.lineTo(hw - .008, vtop - .004), cv.lineTo(hw - .02, vtop), cv.lineTo(-hw + .02, vtop), cv.lineTo(-hw + .008, vtop - .004), cv.closePath();
      shell(extrude(cv, hLen, eH, eV, org), M.carbon, "head");
      /* árboles de levas, cada leva calada con la distribución de su cilindro */
      for (const kind of ["in", "ex"]) {
        const v0 = c0.valves.find(v => v.kind === kind), Lc = (kind === "in" ? P.vlin : P.vlex) / 1e3, cg = new THREE.Group, xm = (x0 + x1) / 2;
        cg.add(new THREE.Mesh(new THREE.CylinderGeometry(.0105, .0105, hLen - .004, 24).rotateZ(Math.PI / 2), M.polish));
        const phiV = Math.atan2(-v0.axis.z, -v0.axis.y), [o, d] = VT[kind], thMax = o + d / 2, lobeG = camLobeGeo(base, Lc, .0135);
        for (const c of cs) for (const dx of [-1, 1]) { const lobe = new THREE.Mesh(lobeG, M.polish); lobe.position.x = c.x + dx * B * .2 - xm, lobe.rotation.x = phiV - (c.F + thMax * DEG) / 2, cg.add(lobe), picks.push([lobe, "cam", c.k]) }
        const ctr = v0.seat.clone().addScaledVector(v0.axis, camA);
        cg.position.set(xm, ctr.y, ctr.z), root.add(cg), cams.push(cg), cg.userData.layer = "vt"
      }
    }
    /* cárter: perfil transversal extruido a lo largo del motor. El hueco del cigüeñal se abre por la boca de cada
       cilindro, así que la sección son dos piezas: la U exterior y la cuña bajo la V */
    {
      const d0 = deckD - H, w = hwB, wb = B / 2, rc0 = .06, tc = Math.sqrt(rc0 * rc0 - wb * wb), S2 = p => [-p.z, p.y];
      const aL = S2(cyl[0].dir), aR = S2(cyl[3].dir), nL = [aL[1], -aL[0]], nR = [aR[1], -aR[0]];
      const pt = (a, n, t, s) => [a[0] * t + n[0] * s, a[1] * t + n[1] * s], ang = p => Math.atan2(p[1], p[0]);
      const arc = (p0, p1, out) => { let a0 = ang(p0), a1 = ang(p1); while (a1 > a0) a1 -= TAU; for (let i = 1; i < 48; i++) { const a = a0 + (a1 - a0) * i / 48; out.push([rc0 * Math.cos(a), rc0 * Math.sin(a)]) } };
      const P1 = pt(aL, nL, d0, w), P6 = pt(aR, nR, d0, -w);
      const A = [pt(aL, nL, d0, wb), pt(aL, nL, tc, wb)], A3 = pt(aR, nR, tc, -wb);
      arc(A[1], A3, A), A.push(A3, pt(aR, nR, d0, -wb), P6, [P6[0] - .012, -.045], [P6[0] - .004, -.088], [P6[0] + .012, -.098], [P1[0] - .012, -.098], [P1[0] + .004, -.088], [P1[0] + .012, -.045], P1);
      const B5 = pt(aR, nR, tc, wb), B6 = pt(aL, nL, tc, -wb), Bq = [pt(aL, nL, d0, -wb), pt(aL, nL, d0, -w), pt(aR, nR, d0, w), pt(aR, nR, d0, wb), B5];
      arc(B5, B6, Bq), Bq.push(B6);
      for (const poly of [A, Bq]) { const sh = new THREE.Shape(); sh.moveTo(...poly[0]); for (let i = 1; i < poly.length; i++) sh.lineTo(...poly[i]); sh.closePath(), shell(extrude(sh, xmax - xmin + .01, V3(0, 0, -1), V3(0, 1, 0), V3(xmin - .005, 0, 0)), MAT3.alu, "crankcase") }
    }
    /* las bancadas van desfasadas: se prolonga cada una hasta la caja delantera o la placa trasera para que no quede hueco */
    {
      const bankPoly = c0 => { const o = c0.side.clone().multiplyScalar(c0.left ? -1 : 1), q = (u, v) => { const p = c0.dir.clone().multiplyScalar(v).addScaledVector(o, u); return [-p.z, p.y] }, d0 = deckD - H; return [q(hwB, d0), q(hwB, deckD), q(hw, deckD), q(hw, deckD + vc), q(hw - .008, deckD + vtop - .004), q(hw - .02, deckD + vtop), q(-(hw - .02), deckD + vtop), q(-(hw - .008), deckD + vtop - .004), q(-hw, deckD + vc), q(-hw, deckD), q(-hwB, deckD), q(-hwB, d0)] };
      for (const left of [!0, !1]) {
        const cs = cyl.filter(c => c.left === left), x0 = Math.min(...cs.map(c => c.x)) - hwB, x1 = Math.max(...cs.map(c => c.x)) + hwB, toX = (g, x) => g.applyMatrix4(new THREE.Matrix4().makeBasis(V3(0, 0, -1), V3(0, 1, 0), V3(1, 0, 0)).setPosition(V3(x, 0, 0)));
        xmax + .005 - x1 > .0015 && shell(toX(LAB.kit.plate(bankPoly(cs[0]), xmax + .007 - x1), x1 - .001), M.alu, "head");
        x0 - (xmin - .005) > .0015 && shell(toX(LAB.kit.plate(bankPoly(cs[0]), x0 - xmin + .007), xmin - .006), M.alu, "head")
      }
    }
    /* todo lo que va por fuera: turbo con sus carcasas, escape completo, admisión completa, distribución, MGU-K, embrague, encendido e inyección */
    ecad = LAB.enginecad.build({ THREE, root, M, TX, cyl, xmin, xmax, xc, deckD, hw, hwB, vc, vtop, uc, B, r, l, picks, exh, shellMats, shell, crank, cams, H, ratioK: res.MK.ratio });
    turbo = ecad.turbo, clipT.constant = ecad.ty;
    for (const o of ecad.front) o.userData.cutHide = 1;
    root.traverse(o => { if (o.isMesh && !o.material.transparent && !o.userData.cap) o.castShadow = o.receiveShadow = !0 });
    /* etiquetas para quien no conoce las piezas */
    const lab = (txt, obj, off, inner) => { const e = document.createElement("div"); e.className = "e3lab", e.textContent = txt, $("e3View").appendChild(e), labels.push({ el: e, obj, off: off || V3(0, 0, 0), inner }) };
    const anchor = (p, layer, front) => { const o = new THREE.Object3D; o.position.copy(p), root.add(o), layer && (o.userData.layer = layer), front && (o.userData.cutHide = 1); return o };
    const c1 = cyl[0], xcut = clip.constant + xc, onCut = (v, u) => c1.dir.clone().multiplyScalar(deckD + v).addScaledVector(c1.side, u).setX(xcut), EL = ecad.lab;
    lab("Compresor", anchor(V3(ecad.Xc, ecad.ty + .115, 0), "tb", 1)), lab("Turbina", anchor(V3(ecad.Xt, ecad.ty + .105, 0), "tb")), lab("MGU-H", anchor(V3(xc, ecad.ty + .055, 0), "tb")), lab("MGU-K", anchor(EL.mguk)), lab("Pistón", c1.piston, V3(.03, 0, 0), 1), lab("Biela", c1.rod, V3(.03, .05, 0), 1);
    lab("Cigüeñal", anchor(V3(xs[0] + .03, -.05, .02)), 0, 1), lab("Primarios de escape", anchor(EL.exh, "exh")), lab("Colector 3 en 1", anchor(EL.col, "exh")), lab("Válvula de descarga", anchor(EL.wg, "exh")), lab("Tubo de escape", anchor(EL.tail, "exh"));
    lab("Intercooler", anchor(EL.ic, "in")), lab("Plenum", anchor(EL.plen, "in")), lab("Toma de aire", anchor(EL.inlet, "in", 1)), lab("Caja de la distribución", anchor(EL.timing, 0, 1)), lab("Bombas de aceite", anchor(EL.oil)), lab("Embrague", anchor(EL.clutch)), lab("Bomba de gasolina", anchor(EL.pump)), lab("Bobinas", anchor(EL.coil));
    lab("Culata", anchor(onCut(.06, -hw * .55))), lab("Cámara de agua", anchor(onCut(-.03, -(B / 2 + .0095))), 0, 1);
    lab("Árbol de levas", anchor(onCut(vc, -uc)), 0, 1), lab("Precámara", anchor(onCut(.032, 0)), 0, 1), lab(P.vsys === "neum" ? "Muelle neumático" : "Muelle", anchor(c1.valves[0].seat.clone().addScaledVector(c1.valves[0].axis, .075)), 0, 1);
    setView(view), applyLayers(), built = sig()
  }
  function setView(v) {
    view = v;
    const mats = new Set([MAT3.alu, MAT3.carbon, ...shellMats]);
    for (const m of mats) { const x = v === "xray"; m.clippingPlanes = v === "cut" ? [clip] : null, m.transparent = x, m.opacity = x ? .14 : 1, m.depthWrite = !x, m.needsUpdate = !0 }
    MAT3.cap.clippingPlanes = [clip];
    /* la turbina se secciona con su propio plano (se quita la mitad de arriba) y el eje del turbo, con el plano del motor */
    if (ecad) ecad.mTH.clippingPlanes = v === "cut" ? [clipT] : null, ecad.capT.material.clippingPlanes = [clipT], ecad.mShaft.clippingPlanes = v === "cut" ? [clip] : null, ecad.mTH.needsUpdate = ecad.mShaft.needsUpdate = !0;
    applyLayers()
  }
  function applyLayers() {
    if (!root) return;
    const cut = view === "cut";
    root.children.forEach(o => { const u = o.userData; (u.layer || u.cap || u.cutHide) && (o.visible = !(u.layer && hidden.has(u.layer)) && !(u.cap && !cut) && !(u.cutHide && cut)) });
    /* lo que queda por delante del plano de corte y no se recorta solo (ruedas dentadas, rueda del compresor) */
    if (ecad) for (const o of ecad.front) o.parent !== root && (o.visible = !cut)
  }
  const sig = () => { const P = res.P; return [P.bore, P.stroke, P.rod, P.bank, P.spacing, P.offset, P.pinD, P.pinW, P.pin, P.journal, P.cr, P.crown, P.ringland, P.vlin, P.vlex, P.ivo, P.ivc, P.evo, P.evc, P.vsys].join() };

  /* ---------- daño acumulado: Basquin + Miner ---------- */
  function life(se, M, endurance) {
    if (!(se > 0)) return Infinity;
    if (endurance && se < M.Se) return Infinity;
    const b = Math.log10(M.Se / (.9 * M.Su)) / 4; /* 1e3 ciclos a 0,9·Su y 1e7 en el límite de fatiga */
    return 1e7 * Math.pow(se / M.Se, 1 / b)
  }
  function accumulate(cyc) {
    if (!cyc || stopped != null) return;
    const P = res.P, Sx = res.Sx, Th = res.Th, MAT = LAB.engine._mat, mr = MAT[P.rmat], mp = MAT[P.pmat];
    /* la corona pierde resistencia cuando se acerca a su temperatura límite */
    const kT = Th.Tpis > mp.Tmax * .85 ? Math.max(.2, 1 - (Th.Tpis - mp.Tmax * .85) / (mp.Tmax * .5)) : 1, Mc = { Se: mp.Se * .7 * kT, Su: mp.Su * .7 * kT };
    const knockD = res.C.knockAt != null ? 6e-6 : 0, brgD = Sx.bearP > 220e6 ? 1e-7 * Math.pow(Sx.bearP / 250e6, 8) : 0;
    for (const c of cyl) {
      if (c.dead) continue;
      const s = SCAT[c.k];
      dmg["rod" + c.k] = (dmg["rod" + c.k] || 0) + cyc / life(mr.Se / Sx.sfRod / s, mr, !0);
      c.holed || (dmg["pis" + c.k] = (dmg["pis" + c.k] || 0) + cyc / life(mp.Se * .7 / Sx.sfCrown / s, Mc, P.pmat === "steel") + cyc * knockD * s);
      dmg["brg" + c.k] = (dmg["brg" + c.k] || 0) + cyc * brgD / s;
      if (dmg["rod" + c.k] >= 1) fail(c, "rod");
      else if (dmg["brg" + c.k] >= 1) fail(c, "brg");
      else if (dmg["pis" + c.k] >= 1 && !c.holed) fail(c, "piston");
      if (stopped != null) break
    }
  }
  function checkContact() {
    const VT = res.VT;
    if (VT.minC >= 0 || cyl.every(c => c.bent)) return;
    for (const c of cyl) c.bent = !0, c.misfire = !0;
    log("bad", `Las válvulas tocan los pistones: holgura ${(VT.minC * 1e3).toFixed(2)} mm a ${VT.atTh.toFixed(0)}° (válvula de ${VT.atKind === "in" ? "admisión" : "escape"}${VT.over > 0 ? " flotando" : ""}). Válvulas dobladas: el motor pierde compresión.`)
  }
  function fail(c, what) {
    const when = `tras ${fmtN(cyclesTotal)} ciclos (${hms(engTime)} de uso)`;
    if (what === "rod") c.dead = "rod", stopped = c.k, log("bad", `¡Biela del cilindro ${c.k + 1} rota por fatiga ${when}! Atraviesa el bloque y el motor se para.`);
    else if (what === "brg") c.dead = "brg", stopped = c.k, log("bad", `Cojinete de biela del cilindro ${c.k + 1} gripado ${when}: la película de aceite no aguanta la presión.`);
    else c.misfire = !0, c.holed = !0, log("bad", `Pistón del cilindro ${c.k + 1} perforado ${when} (fatiga${res.C.knockAt != null ? " y detonación" : res.Th.Tpis > LAB.engine._mat[res.P.pmat].Tmax ? " térmica" : ""}). El cilindro deja de trabajar.`)
  }
  const fmtN = n => n >= 1e9 ? (n / 1e9).toFixed(2) + " mil M" : n >= 1e6 ? (n / 1e6).toFixed(2) + " M" : n >= 1e3 ? (n / 1e3).toFixed(1) + " k" : n.toFixed(0);
  const hms = s => { const h = s / 3600 | 0, m = s / 60 % 60 | 0, ss = s % 60 | 0; return h ? `${h} h ${m} min` : m ? `${m} min ${ss} s` : `${s.toFixed(1)} s` };
  function log(st, txt) { events.unshift([st, txt]), events = events.slice(0, 6), $("e3Log").innerHTML = events.map(([s, t]) => `<div class="vd ${s}"><span>${t}</span></div>`).join("") }

  /* ---------- un fotograma ---------- */
  function local(c) { return ((Theta - c.F / DEG + 360) % 720 + 720) % 720 - 360 } /* grados del ciclo de ese cilindro, 0 = PMS de encendido */
  const idxOf = thd => clamp(Math.round((thd + 360) / 720 * res.C.N), 0, res.C.N - 1);
  function frame(t) {
    requestAnimationFrame(frame);
    if (!res || !host.offsetParent || document.hidden) { lastT = t; return }
    const dt = Math.min(.05, (t - lastT) / 1e3 || 0);
    lastT = t, nFrame++;
    const P = res.P, target = stopped != null ? 0 : P.rpm;
    rpmNow += (target - rpmNow) * Math.min(1, dt * (stopped != null ? .9 : 2.5));
    if (running) {
      Theta = (Theta + rpmNow / 60 * 360 * dt * slow) % 720;
      const real = dt * ageMul, cyc = rpmNow / 120 * real;
      stopped == null && (engTime += real, cyclesTotal += cyc), accumulate(cyc)
    }
    ctrl.tick(), pose(dt), colorize(), nFrame % 2 || placeLabels(), nFrame % 5 || hudUpdate();
    composer ? composer.render() : R.render(scene, cam)
  }
  function pose(dt) {
    const P = res.P, C = res.C, r = C.r, l = C.l, VT = res.VT, deckD = r + l + .021 + C.Vc / C.Ap + .0012;
    crank.rotation.x = Theta * DEG;
    for (const cg of cams) cg.rotation.x = Theta * DEG / 2;
    for (const c of cyl) {
      const thd = local(c), a0 = thd * DEG, s = Math.sin(a0), xp = r * Math.cos(a0) + Math.sqrt(l * l - r * r * s * s);
      const pin = c.dir.clone().multiplyScalar(xp).setX(c.x), a = c.beta + a0, cp = V3(c.x, r * Math.cos(a), r * Math.sin(a));
      if (c.dead === "rod") {
        /* biela rota: la cabeza sigue en la muñequilla y el cuerpo sale despedido */
        c.flail = (c.flail || 0) + dt;
        c.rod.position.copy(cp), c.rod.quaternion.setFromAxisAngle(V3(1, 0, 0), a + Math.PI * .55 + Math.sin(c.flail * 7) * .25);
        c.gas.material.opacity = 0, c.front.visible = !1;
        continue
      }
      c.piston.position.copy(pin), c.piston.quaternion.setFromUnitVectors(UP(), c.dir);
      c.rod.position.copy(cp), c.rod.quaternion.setFromUnitVectors(UP(), pin.clone().sub(cp).normalize());
      /* cámara: el gas ocupa el hueco entre corona y culata y se ve con el color de su temperatura */
      const i = idxOf(thd), Tg = C.T[i], xb = C.xb[i], crownTop = xp + .021 + .0012, gap = Math.max(.0004, deckD + .004 - crownTop);
      c.gas.scale.set(1, gap, 1), c.gas.position.copy(c.dir.clone().multiplyScalar(crownTop + gap / 2).setX(c.x));
      let col = [0, 0, 0], op = 0;
      if (!c.misfire && thd > P.soc - 1) { col = glow(Tg), op = clamp(Math.max(...col) * .5, 0, .85) }
      else if (thd < -200) col = [.05, .16, .45], op = .35 * clamp((thd + 360) / 40, 0, 1); /* carga fresca entrando */
      c.gas.material.color.setRGB(...col), c.gas.material.opacity = op;
      const burning = !c.misfire && thd > P.soc - .5 && thd < P.soc + P.dur * 1.6 && xb < .995, fr = burning ? clamp(Math.sqrt(xb) * 1.05, .08, 1) * (C.B / 2 - .0005) : 0;
      c.front.visible = fr > 0, fr > 0 && (c.front.scale.set(fr, gap * .98, fr), c.front.position.copy(c.gas.position), c.front.material.opacity = .55 * (1 - xb) + .15);
      const jt = thd - P.soc, jetOn = P.tji === "si" && !c.misfire && jt > -.5 && jt < 9, pen = clamp((jt + .5) / 3.5, 0, 1) * C.B * .42;
      for (const j of c.jets.children) j.visible = jetOn, jetOn && (j.scale.set(1, pen, 1), j.position.copy(j.userData.d).multiplyScalar(pen / 2), j.material.opacity = .9 * (1 - clamp((jt - 4) / 5, 0, 1)));
      /* válvulas con la alzada de la leva (y la flotación, si la hay); el muelle se comprime, el taqué sigue a la leva */
      for (const v of c.valves) {
        const L0 = LAB.engine.lift(P, v.kind, thd, VT.over), L = c.bent ? Math.min(.0012, L0) : L0;
        v.g.position.copy(v.seat).addScaledVector(v.axis, -L), v.s.scale.y = (.04 - L) / .04, v.s.position.y = .054 + L, v.ch2.position.y = .069 + L
      }
      if (c.bent && !c.bentDone) { c.bentDone = 1; for (const v of c.valves) v.g.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(V3(1, 0, 0), .07 * v.sgn)), v.v.material.color.set("#ff4b3b") }
    }
    const tu = turbo.userData;
    tu.ang += res.TB.Nt / 60 * TAU * dt * slow * (rpmNow / Math.max(1, P.rpm)), tu.comp.rotation.x = tu.turb.rotation.x = tu.ang;
    for (const g of ecad.train) g.m.rotation.x = g.ph + Theta * DEG * g.k
  }
  const logLife = d => clamp(Math.log10(Math.max(1e-9, d || 0)) / 4.5 + 1, 0, 1) * 2 - 1;
  function colorize() {
    const P = res.P, C = res.C, F = res.F, Th = res.Th, TB = res.TB, run = rpmNow / Math.max(1, P.rpm);
    for (const c of cyl) {
      const i = idxOf(local(c)), m = c.rod.material, [pm, sk] = c.pistonMats, set = (mt, t, e) => (mt.color.setRGB(...t), mt.emissive.setRGB(...t.map(v => v * e)));
      const both = (t, e) => (set(pm, t, e), set(sk, t, e));
      if (c.holed) pm.color.set("#2a1610"), pm.emissive.setRGB(0, 0, 0);
      else if (mode === "real") pm.color.set("#c7ccd2"), sk.color.set("#3b3e43"), pm.emissive.setRGB(0, 0, 0), sk.emissive.setRGB(0, 0, 0);
      else if (mode === "temp") both(inferno((Th.Tpis - 60) / 520), .22);
      else if (mode === "stress") both(coolwarm((C.p[i] - P.pcc * 1e5) / Math.max(1, C.pmax) * 2 - 1), .3);
      else both(coolwarm(logLife(dmg["pis" + c.k])), .3);
      if (mode === "real") m.color.set("#8f8b86"), m.emissive.setRGB(0, 0, 0);
      else if (mode === "temp") set(m, inferno((P.toil + 25 - 60) / 520), .3);
      else if (mode === "stress") set(m, coolwarm(F.Fr[i] / (P.rodA / 1e6) / 650e6), .35);
      else set(m, coolwarm(logLife(Math.max(dmg["rod" + c.k] || 0, dmg["brg" + c.k] || 0))), .3);
      if (c.dead === "brg" && !c.pinRed) c.pinRed = c.pinMesh.material = new THREE.MeshStandardMaterial({ color: "#5a1d12", emissive: "#ff3a10", emissiveIntensity: 1.5, metalness: .6, roughness: .5 });
      if (!c.bent) for (const v of c.valves) mode === "temp" ? v.v.material.color.setRGB(...inferno(((v.kind === "ex" ? 760 : 320) - 60) / 760)) : v.v.material.color.set(v.kind === "in" ? "#cdd2d8" : "#8b7a69")
    }
    /* escape al rojo: temperatura del gas a la turbina con un pulso en cada apertura de escape */
    for (const e of exh) {
      const u = local(e.c) - (180 - P.evo), pulse = u > 0 && u < 160 ? Math.exp(-u / 50) : 0, T = TB.T3 * (.93 + .2 * pulse) * run + 300 * (1 - run);
      const g = glow(T + 120), mt = e.m.material;
      mt.emissive.setRGB(g[0] * .45, g[1] * .45, g[2] * .45), mode === "temp" ? (mt.map = null, mt.color.setRGB(...inferno((T - 333) / 1000))) : (mt.map = TX.tint, mt.color.set("#ffffff")), mode !== lastMode && (mt.needsUpdate = !0)
    }
    const gt = glow(TB.T3 * run + 300 * (1 - run) + 40);
    for (const m of ecad.hot) m.emissive.setRGB(gt[0] * .22, gt[1] * .22, gt[2] * .22);
    turbo.userData.turb.material.emissive.setRGB(gt[0] * .2, gt[1] * .2, gt[2] * .2);
    if (mode === "stress") { const t = coolwarm(clamp(res.TR.tau / 220e6, 0, 1) * 2 - 1); MAT3.polish.color.setRGB(...t), MAT3.forged.color.setRGB(...t) }
    else if (lastMode === "stress") MAT3.polish.color.set("#c4c9cf"), MAT3.forged.color.set("#6e757c");
    mode !== lastMode && ($("e3Legend").innerHTML = LEG[mode]), lastMode = mode
  }
  const LEG = {
    real: "",
    temp: `<b>Temperatura</b><i style="background:linear-gradient(90deg,#000004,#650f6e,#d44842,#f57d15,#fcffa4)"></i><span>60 °C</span><span>580 °C (escape: 1060 °C)</span>`,
    stress: `<b>Tensión instantánea</b><i style="background:linear-gradient(90deg,#3b4cc0,#c0d4f5,#f2cbb7,#b40426)"></i><span>tracción</span><span>compresión</span>`,
    dmg: `<b>Vida consumida (escala log.)</b><i style="background:linear-gradient(90deg,#3b4cc0,#c0d4f5,#f2cbb7,#b40426)"></i><span>0,003 %</span><span>100 %</span>`
  };
  function placeLabels() {
    const r = R.domElement.getBoundingClientRect(), show = LAB.mode === "easy" && $("e3Labels").classList.contains("on"), w = V3(0, 0, 0), placed = [];
    const cand = [];
    for (const L of labels) {
      let vis0 = show && L.obj.visible !== !1 && !(L.inner && view === "closed");
      L.obj.traverseAncestors(a => a.visible === !1 && (vis0 = !1));
      if (vis0) { L.obj.getWorldPosition(w), w.add(L.off).project(cam); vis0 = w.z < 1 && Math.abs(w.x) < .94 && Math.abs(w.y) < .92 }
      if (!vis0) { L.el.style.display = "none"; continue }
      cand.push([L, (w.x + 1) / 2 * r.width, (1 - w.y) / 2 * r.height])
    }
    cand.sort((a, b) => a[2] - b[2]);
    for (const [L, x, y0] of cand) {
      L.w = L.w || L.el.offsetWidth || L.el.textContent.length * 7 + 16;
      let y = y0, ok = !1;
      for (let k = 0; k < 4 && !ok; k++) { ok = !placed.some(p => Math.abs(p[0] - x) < (p[2] + L.w) / 2 + 4 && Math.abs(p[1] - y) < 21), ok || (y += 22) }
      L.el.style.display = ok ? "" : "none";
      if (ok) placed.push([x, y, L.w]), L.el.style.transform = `translate(${x.toFixed(0)}px,${y.toFixed(0)}px) translate(-50%,-50%)`
    }
  }

  /* ---------- panel de datos ---------- */
  function hudUpdate() {
    const P = res.P, C = res.C, F = res.F, Th = res.Th, Sx = res.Sx, VT = res.VT, TB = res.TB, es = n => Math.round(n).toLocaleString("es");
    const row = (k, v) => `<tr><td>${k}</td><td>${v}</td></tr>`;
    let h = `<div class="e3live"><b>${stopped != null ? "MOTOR PARADO" : es(rpmNow) + " rpm"}</b><span>cámara lenta ×1/${es(1 / slow)} · ${fmtN(cyclesTotal)} ciclos · ${hms(engTime)} de uso ≈ ${(engTime / 3600 * 205).toFixed(engTime < 360 ? 2 : 0)} km</span></div>`;
    h += `<div class="e3cyl">` + cyl.map(c => { const t = local(c), ph = t < -180 ? ["Admisión", "#3d8bff"] : t < 0 ? ["Compresión", "#8b97a4"] : t < 180 ? ["Expansión", "#ff6b1a"] : ["Escape", "#b45cff"]; return `<div style="--c:${c.dead || c.misfire ? "#ff3b3b" : ph[1]}"><b>${c.k + 1}</b><span>${c.dead ? "ROTO" : c.misfire ? "sin compresión" : ph[0]}</span></div>` }).join("") + `</div>`;
    if (sel) {
      const [, kind, k0] = sel, k = k0 == null ? 0 : k0, c = cyl[k], thd = local(c), i = idxOf(thd);
      const N = { piston: "Pistón", rod: "Biela", valve: "Válvulas, taqués y muelles", cam: "Árbol de levas", crank: "Cigüeñal", turbo: "Compresor del turbo", turbine: "Turbina", mguh: "MGU-H", mguk: "MGU-K", exhaust: "Colector de escape", intake: "Admisión", ic: "Intercooler", wg: "Válvula de descarga (wastegate)", fuel: "Inyección directa", coil: "Bobinas de encendido", oil: "Bombas de aceite (cárter seco)", timing: "Distribución por engranajes", block: "Bloque y camisas", crankcase: "Cárter", head: "Culata", plug: "Precámara (TJI)", clutch: "Embrague" }[kind] || kind;
      const perCyl = ["piston", "rod", "valve", "cam", "exhaust", "plug"].includes(kind), pc = x => (x * 100 < .001 ? (x * 100).toExponential(1) : (x * 100).toFixed(3)) + " %";
      h += `<h4>${N}${perCyl ? " · cilindro " + (k + 1) : ""}</h4><table>`;
      if (kind === "piston") h += row("Ángulo del ciclo", thd.toFixed(0) + "°") + row("Distancia al PMS", (C.xPis(thd * DEG) * 1e3).toFixed(2) + " mm") + row("Velocidad", F.vel[i].toFixed(1) + " m/s") + row("Aceleración", es(F.acc[i] / 9.81) + " g") + row("Presión sobre la corona", (C.p[i] / 1e5).toFixed(1) + " bar") + row("Fuerza del gas", (F.Fg[i] / 1e3).toFixed(1) + " kN") + row("Fuerza de inercia", (F.Fi[i] / 1e3).toFixed(1) + " kN") + row("Empuje contra la camisa", (F.Fn[i] / 1e3).toFixed(2) + " kN") + row("Temperatura de la corona", Th.Tpis.toFixed(0) + " °C") + row("Seguridad a fatiga", Sx.sfCrown.toFixed(2)) + row("Vida consumida", pc(dmg["pis" + k] || 0));
      else if (kind === "rod") h += row("Fuerza axial", (F.Fr[i] / 1e3).toFixed(1) + " kN " + (F.Fr[i] >= 0 ? "(compresión)" : "(tracción)")) + row("Tensión en el cuerpo", (F.Fr[i] / (P.rodA / 1e6) / 1e6).toFixed(0) + " MPa") + row("Inclinación", (Math.asin(C.lam * Math.sin(thd * DEG)) / DEG).toFixed(1) + "°") + row("Carga en el cojinete", (Math.hypot(F.bx[i], F.by[i]) / 1e3).toFixed(1) + " kN") + row("Presión máx. en el cojinete", (Sx.bearP / 1e6).toFixed(0) + " MPa") + row("Seguridad a fatiga", Sx.sfRod.toFixed(2)) + row("Seguridad a pandeo", Sx.sfBuck.toFixed(1)) + row("Vida consumida (cuerpo)", pc(dmg["rod" + k] || 0)) + row("Vida consumida (cojinete)", pc(dmg["brg" + k] || 0));
      else if (kind === "valve" || kind === "cam") h += row("Alzada adm. / esc.", (LAB.engine.lift(P, "in", thd, VT.over) * 1e3).toFixed(2) + " / " + (LAB.engine.lift(P, "ex", thd, VT.over) * 1e3).toFixed(2) + " mm") + row("Aceleración máx. de la válvula", es(VT.aMax / 9.81) + " g") + row("Inercia / fuerza del muelle", es(VT.Fneed) + " / " + es(VT.Fspr) + " N") + row("Muelles", P.vsys === "neum" ? "neumáticos (nitrógeno a presión)" : "metálicos") + row("Flotan a partir de", es(VT.floatRpm) + " rpm") + row("Holgura mínima con el pistón", (VT.minC * 1e3).toFixed(2) + " mm a " + VT.atTh.toFixed(0) + "°") + row("Árbol de levas", es(rpmNow / 2) + " rpm");
      else if (kind === "block" || kind === "head" || kind === "crankcase") h += row("Pared de la camisa arriba", Math.max(...Th.Twl).toFixed(0) + " °C") + row("Primer segmento en el PMS", Th.Tring.toFixed(0) + " °C") + row("Flujo de calor medio", (Th.qLiner / 1e3).toFixed(0) + " kW/m²") + row("Refrigerante", P.tcool + " °C") + row("Gas ahora (cil. 1)", (C.T[i] - 273).toFixed(0) + " °C") + row("Presión ahora (cil. 1)", (C.p[i] / 1e5).toFixed(1) + " bar");
      else if (kind === "crank" || kind === "clutch") h += row("Par instantáneo del V6", res.V6.Tq[Math.round(Theta) % 720].toFixed(0) + " N·m") + row("Par medio", res.V6.Tm.toFixed(0) + " N·m") + row("1.er modo torsional", (res.TS.freqs[0] || 0).toFixed(0) + " Hz") + row("Tensión torsional en el apoyo", (res.TR.tau / 1e6).toFixed(0) + " MPa") + row("Fuerza libre máx.", Math.max(...res.V6.Fmag).toFixed(0) + " N");
      else if (kind === "turbo" || kind === "turbine" || kind === "mguh") h += row("Turbo", es(TB.Nt) + " rpm" + (TB.Nt > 125e3 ? " (¡más del límite de 125 000!)" : "")) + row("Relación de compresión", TB.PR.toFixed(2)) + row("Caudal de aire", (TB.mdot * 1e3).toFixed(0) + " g/s") + row("Aire tras el compresor", (TB.T2 - 273).toFixed(0) + " °C") + row("Potencia del compresor", (TB.Wc / 1e3).toFixed(0) + " kW") + row("Gas a la turbina", (TB.T3 - 273).toFixed(0) + " °C") + row("Potencia de la turbina", (TB.Wt / 1e3).toFixed(0) + " kW") + row("MGU-H", (TB.Wh >= 0 ? "recupera " : "empuja ") + Math.abs(TB.Wh / 1e3).toFixed(0) + " kW");
      else if (kind === "mguk") h += row("Régimen del MGU-K", es(rpmNow * res.MK.ratio) + " rpm") + row("Relación de engranajes", res.MK.ratio.toFixed(2) + " : 1") + row("Límite reglamentario", "120 kW · 50 000 rpm") + row("Par en el cigüeñal a 120 kW", (120e3 / Math.max(1, P.rpm / 60 * TAU)).toFixed(0) + " N·m");
      else if (kind === "exhaust") h += row("Gas a la turbina", (TB.T3 - 273).toFixed(0) + " °C") + row("Contrapresión", P.pexh.toFixed(2) + " bar") + row("Pulsos por segundo", es(P.rpm / 120 * 6) + " (uno por cilindro)") + row("Apertura de escape", 180 - P.evo + "° tras el PMS") + row("Material", "Inconel 625 (colores de revenido por el calor)");
      else if (kind === "intake") h += row("Presión en el plenum", P.boost.toFixed(2) + " bar abs") + row("Temperatura de admisión", P.tim + " °C") + row("Caudal de combustible", C.fuelKgh.toFixed(1) + " kg/h") + row("Lambda", C.lambda.toFixed(2));
      else if (kind === "ic") h += row("Aire que entra (del compresor)", (TB.T2 - 273).toFixed(0) + " °C") + row("Aire que sale (al plenum)", P.tim + " °C") + row("Calor que evacúa", (TB.mdot * 1005 * Math.max(0, TB.T2 - 273 - P.tim) / 1e3).toFixed(0) + " kW") + row("Caudal de aire", (TB.mdot * 1e3).toFixed(0) + " g/s") + row("Presión de carga", P.boost.toFixed(2) + " bar abs");
      else if (kind === "wg") h += row("Potencia de la turbina", (TB.Wt / 1e3).toFixed(0) + " kW") + row("Potencia que pide el compresor", (TB.Wc / 1e3).toFixed(0) + " kW") + row("MGU-H", (TB.Wh >= 0 ? "recupera " : "empuja ") + Math.abs(TB.Wh / 1e3).toFixed(0) + " kW") + row("Estado", "cerradas en este cálculo: lo que sobra en la turbina se lo lleva el MGU-H") + row("Contrapresión de escape", P.pexh.toFixed(2) + " bar abs") + row("Una por bancada", "cada una con su tubo propio");
      else if (kind === "fuel") h += row("Caudal de combustible", C.fuelKgh.toFixed(1) + " kg/h") + row("Por cilindro y ciclo", (C.fuelKgh / 3.6 / Math.max(1, P.rpm / 120) / 6 * 1e3).toFixed(1) + " mg") + row("Lambda", C.lambda.toFixed(2)) + row("Inyectores", "uno por cilindro, directo a la cámara") + row("Presión máx. (reglamento)", "500 bar");
      else if (kind === "coil") h += row("Chispas por segundo", es(P.rpm / 120 * 6)) + row("Inicio de combustión", P.soc + "°") + row("Sistema", P.tji === "si" ? "precámara con chorros de llama" : "bujía convencional");
      else if (kind === "oil") h += row("Aceite", P.toil + " °C") + row("Sistema", "cárter seco: bombas de vaciado en fila") + row("Presión máx. en el cojinete de biela", (Sx.bearP / 1e6).toFixed(0) + " MPa");
      else if (kind === "timing") h += row("Árboles de levas", es(rpmNow / 2) + " rpm") + row("Reducción", "24/32 × 16/24 = 1/2") + row("Cadena de engranajes", "cigüeñal → intermedio → rueda doble → intermedio → levas") + row("Dientes", "24 · 36 · 32/16 · 36 · 24") + row("MGU-K", "30 dientes del cigüeñal contra 9: " + res.MK.ratio.toFixed(2) + " : 1");
      else if (kind === "plug") h += row("Inicio de combustión", P.soc + "°") + row("Sistema", P.tji === "si" ? "precámara con chorros de llama" : "bujía convencional") + row("Quemado ahora", (C.xb[i] * 100).toFixed(0) + " %") + row("Detonación", C.knockAt != null ? "SÍ, a " + C.knockAt.toFixed(0) + "°" : "margen " + ((1 - C.ki) * 100).toFixed(0) + " %");
      h += "</table>"
    } else h += `<p class="e3hint">Toca cualquier pieza para ver sus datos en vivo. Arrastra para girar, rueda o pellizco para acercar, botón derecho o Mayús para desplazar.</p>`;
    $("e3Hud").innerHTML = h
  }

  /* ---------- selección (ignora lo que el plano de corte ha quitado) ---------- */
  function pick(e) {
    if (ctrl.moved() > 6) return;
    const rc = new THREE.Raycaster, rect = R.domElement.getBoundingClientRect(), m = new THREE.Vector2((e.clientX - rect.left) / rect.width * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    rc.setFromCamera(m, cam);
    const objs = picks.map(p => p[0]).filter(o => { let v = o.visible; o.traverseAncestors(a => a.visible === !1 && (v = !1)); return v });
    const hits = rc.intersectObjects(objs, !1).filter(h => !(view === "cut" && h.object.userData.shell && clip.distanceToPoint(h.point) < 0));
    const hit = view === "xray" ? hits.find(h => !h.object.userData.shell) || hits[0] : hits[0];
    sel = hit ? picks.find(p => p[0] === hit.object) : null, hudUpdate()
  }

  /* ---------- interfaz ---------- */
  function init(h, r0) {
    THREE = window.THREE, host = h, res = r0;
    if (!THREE) { host.innerHTML = `<p class="warnt">No se pudo cargar el motor 3D.</p>`; return }
    host.innerHTML = `<div class="e3wrap"><div class="e3view" id="e3View"><div class="e3legend" id="e3Legend"></div><div class="e3cams" id="e3Cams"><button data-v="all">Motor</button><button data-v="cyl">Cilindro</button><button data-v="valve">Válvulas</button><button data-v="crank">Cigüeñal</button><button data-v="turbo">Turbo</button></div></div>
      <div class="e3side"><div id="e3Hud" class="e3hud"></div>
      <div class="e3btns">
        <div class="seg" id="e3View3"><span>Vista</span><button data-w="cut" class="on">Seccionado</button><button data-w="xray">Rayos X</button><button data-w="closed">Cerrado</button></div>
        <div class="seg" id="e3Mode"><span>Color</span><button data-m="real" class="on">Real</button><button data-m="temp">Temperatura</button><button data-m="stress">Tensión</button><button data-m="dmg">Daño</button></div>
        <div class="seg" id="e3Slow"><span>Cámara lenta</span><button data-s="3000">×1/3000</button><button data-s="300" class="on">×1/300</button><button data-s="30">×1/30</button></div>
        <div class="seg" id="e3Age"><span>Envejecer</span><button data-a="1" class="on">tiempo real</button><button data-a="1000">×1000</button><button data-a="100000">×100 000</button></div>
        <div class="seg" id="e3Lay"><span>Mostrar</span><button data-l="exh" class="on">Escape</button><button data-l="in" class="on">Admisión</button><button data-l="vt" class="on">Válvulas</button><button data-l="tb" class="on">Turbo</button></div>
        <div class="seg"><button id="e3Labels" class="on easyonly">Nombres</button><button id="e3Pause">Pausa</button><button id="e3Fix">Reparar</button></div>
      </div><div id="e3Log" class="e3log"></div></div></div>`;
    const view0 = $("e3View"), small = matchMedia("(max-width:700px)").matches;
    R = new THREE.WebGLRenderer({ antialias: !1, powerPreference: "high-performance" }), R.setPixelRatio(Math.min(small ? 1.5 : 2, devicePixelRatio || 1)), R.outputColorSpace = THREE.SRGBColorSpace, R.toneMapping = THREE.ACESFilmicToneMapping, R.toneMappingExposure = 1.15, R.localClippingEnabled = !0;
    R.shadowMap.enabled = !0, R.shadowMap.type = THREE.PCFSoftShadowMap, view0.prepend(R.domElement);
    scene = new THREE.Scene, scene.background = new THREE.Color("#0b0e12"), scene.environment = studioEnv(R), scene.environmentIntensity = .85;
    clip = new THREE.Plane(V3(-1, 0, 0), 0), clipT = new THREE.Plane(V3(0, -1, 0), 0), TX = textures(), MAT3 = materials();
    cam = new THREE.PerspectiveCamera(34, 1, .01, 20);
    const key = new THREE.DirectionalLight("#fff4e6", 2.4);
    key.position.set(1.1, 1.3, .55), key.castShadow = !0, key.shadow.mapSize.set(2048, 2048), key.shadow.bias = -.0003, key.shadow.normalBias = .003, Object.assign(key.shadow.camera, { left: -.85, right: .85, top: .6, bottom: -.6, near: .3, far: 4 }), scene.add(key);
    const rim = new THREE.DirectionalLight("#9cc3ff", 1.2);
    rim.position.set(-.9, .6, -1), scene.add(rim);
    const fill = new THREE.DirectionalLight("#ffe2c4", .5);
    fill.position.set(.6, -.2, 1.2), scene.add(fill);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(1.6, 72), new THREE.MeshStandardMaterial({ color: "#15191e", roughness: .8, metalness: .1 }));
    floor.rotation.x = -Math.PI / 2, floor.position.y = -.13, floor.receiveShadow = !0, scene.add(floor);
    const grid = new THREE.GridHelper(2, 40, "#23303c", "#1a222b");
    grid.position.y = -.1295, scene.add(grid);
    ctrl = orbit(R.domElement, cam);
    const W0 = view0.clientWidth || 800, H0 = view0.clientHeight || 500;
    let ao = null, smaa = null;
    try {
      composer = new THREE.EffectComposer(R);
      if (THREE.N8AOPass) { ao = new THREE.N8AOPass(scene, cam, W0, H0); const c = ao.configuration; c.gammaCorrection = !1, c.aoRadius = .028, c.distanceFalloff = .6, c.intensity = 2.6, c.color = new THREE.Color(0, 0, 0), ao.setQualityMode(small ? "Low" : "Medium"), c.halfRes = small, composer.addPass(ao) }
      else composer.addPass(new THREE.RenderPass(scene, cam));
      composer.addPass(new THREE.UnrealBloomPass(new THREE.Vector2(512, 512), .16, .3, 4.2)), composer.addPass(new THREE.OutputPass()), THREE.SMAAPass && composer.addPass(smaa = new THREE.SMAAPass(W0, H0))
    } catch (e) { composer = null, console.warn(e) }
    const fit = () => { const r = view0.getBoundingClientRect(); R.setSize(r.width, r.height, !1), composer && composer.setSize(r.width, r.height), ao && ao.setSize && ao.setSize(r.width, r.height), cam.aspect = r.width / Math.max(1, r.height), cam.updateProjectionMatrix() };
    new ResizeObserver(fit).observe(view0), fit();
    R.domElement.addEventListener("click", pick);
    const seg = (id, f) => $(id).addEventListener("click", e => { const b = e.target.closest("button"); if (!b || b.id) return; for (const x of $(id).querySelectorAll("button:not([id])")) x.classList.toggle("on", x === b); f(b) });
    seg("e3Mode", b => mode = b.dataset.m), seg("e3Slow", b => slow = 1 / +b.dataset.s), seg("e3Age", b => ageMul = +b.dataset.a), seg("e3View3", b => setView(b.dataset.w));
    $("e3Labels").onclick = e => e.target.classList.toggle("on");
    $("e3Lay").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; b.classList.toggle("on"), hidden[b.classList.contains("on") ? "delete" : "add"](b.dataset.l), applyLayers() });
    $("e3Pause").onclick = e => { running = !running, e.target.textContent = running ? "Pausa" : "Seguir", e.target.classList.toggle("on", !running) };
    $("e3Fix").onclick = () => { dmg = {}, stopped = null, cyclesTotal = 0, engTime = 0, events = [], $("e3Log").innerHTML = "", build(), checkContact() };
    $("e3Cams").addEventListener("click", e => { const b = e.target.closest("button"); b && view3(b.dataset.v) });
    build(), checkContact(), requestAnimationFrame(frame)
  }
  function view3(v) {
    const c = cyl[0], ox = root.position.x, at = d => c.dir.clone().multiplyScalar(d).setX(c.x + ox);
    const xcw = clip.constant, atc = d => c.dir.clone().multiplyScalar(d).setX(xcw);
    const g = { all: HOME(), cyl: { az: -.62, el: .16, d: .5, t: atc(res.C.r + res.C.l * .72) }, valve: { az: -.35, el: .5, d: .46, t: atc(res.C.r + res.C.l + .1) }, crank: { az: .5, el: -.04, d: .52, t: V3(xcw - .04, .005, 0) }, turbo: { az: -Math.PI / 2 + .3, el: .95, d: .75, t: turbo.position.clone().setX(turbo.position.x + ox) } }[v];
    g && ctrl.fly(g)
  }
  function update(r0) {
    const prevMin = res && res.VT ? res.VT.minC : 1;
    res = r0;
    if (!R) return;
    sig() !== built && build();
    res.VT.minC < 0 && prevMin >= 0 && checkContact();
    if (res.VT.over > 0 && !update.warned) update.warned = 1, log("warn", `A ${res.P.rpm.toLocaleString("es")} rpm la inercia del tren de válvulas supera al muelle: las válvulas flotan (límite ≈ ${Math.round(res.VT.floatRpm).toLocaleString("es")} rpm).`);
    res.VT.over > 0 || (update.warned = 0)
  }
  const angle = k => cyl.length ? local(cyl[k || 0]) : 0;
  return { init, update, angle, _test: { life, info: () => R && ({ tris: R.info.render.triangles, calls: R.info.render.calls, geos: R.info.memory.geometries }) }, cam: a => { ctrl && (ctrl.st.az = a[0], ctrl.st.el = a[1], ctrl.st.d = a[2], ctrl.st.t.set(a[3], a[4], a[5]), ctrl.apply()) } }
})();
