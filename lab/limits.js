/* ===================== LÍMITES Y AVERÍAS =====================
   Un banco de pruebas por mecanismo de degradación o rotura. Cada uno es el mismo modelo que corre en tiempo real en
   las carreras (panel "Ingeniería en vivo"), aquí desplegado con sus curvas para entender dónde está el límite:
   tornillería (diagrama de unión, fluencia y autoaflojamiento), segmentos (holgura por dilatación), muelles de válvula
   (resonancia y flotación), aceite (Vogel, película, descebe), refrigeración (curva de ebullición de Nukiyama, CHF de
   Zuber, cavitación), dientes de la caja (Basquin y picado), frenos (temperatura en una vuelta, fricción, oxidación,
   líquido), neumático (gas ideal, huella, ventana), altura al suelo y tablón, rebote de rueda, flameo del alerón y
   latencia de la telemetría. */
LAB.limits = (() => {
  const A = (n, f) => { const x = new Float32Array(n), y = new Float32Array(n); for (let i = 0; i < n; i++) { const r = f(i, n); x[i] = r[0], y[i] = r[1] } return { x, y, n } };
  const S = (o, col, label, extra) => ({ ...o, col, label, ...extra });
  const vapW = T => Math.pow(10, 8.14019 - 1810.94 / (244.485 + T)) * 133.322 / 1e5, tsatW = p => 1810.94 / (8.14019 - Math.log10(p * 1e5 / 133.322)) - 244.485;
  /* ---------- vista 3D pequeña para los bancos (Three.js ya cargado por el laboratorio) ---------- */
  function mini3d(cv, camPos) {
    const T = window.THREE;
    if (!T) return null;
    const R = new T.WebGLRenderer({ canvas: cv, antialias: !0 });
    R.setPixelRatio(Math.min(2, devicePixelRatio || 1)), R.outputColorSpace = T.SRGBColorSpace, R.toneMapping = T.ACESFilmicToneMapping;
    const sc = new T.Scene(), cam = new T.PerspectiveCamera(35, 1, .01, 50);
    sc.background = new T.Color("#0d1014"), sc.add(new T.HemisphereLight("#dfe8f2", "#1a1f26", 1.4));
    const key = new T.DirectionalLight("#fff3e2", 2.2);
    key.position.set(1, 2, 1.5), sc.add(key);
    const st = { az: camPos[0], el: camPos[1], d: camPos[2], t: new T.Vector3(...camPos[3]) };
    const place = () => { const c = Math.cos(st.el); cam.position.set(st.t.x + st.d * c * Math.cos(st.az), st.t.y + st.d * Math.sin(st.el), st.t.z + st.d * c * Math.sin(st.az)), cam.lookAt(st.t) };
    let drag = null;
    cv.addEventListener("pointerdown", e => { drag = [e.clientX, e.clientY], cv.setPointerCapture(e.pointerId) });
    cv.addEventListener("pointermove", e => { if (!drag) return; st.az += (e.clientX - drag[0]) * .008, st.el = clamp(st.el + (e.clientY - drag[1]) * .006, -1.2, 1.4), drag = [e.clientX, e.clientY], place() });
    cv.addEventListener("pointerup", () => drag = null), cv.addEventListener("wheel", e => { e.preventDefault(), st.d = clamp(st.d * Math.exp(e.deltaY * .001), .2, 10), place() }, { passive: !1 });
    const fit = () => { const r = cv.getBoundingClientRect(); if (!r.width) return; R.setSize(r.width, r.height, !1), cam.aspect = r.width / r.height, cam.updateProjectionMatrix() };
    new ResizeObserver(fit).observe(cv), fit(), place();
    return { T, R, sc, cam, render: () => R.render(sc, cam), visible: () => cv.offsetParent && cv.getBoundingClientRect().bottom > 0 && cv.getBoundingClientRect().top < innerHeight }
  }
  const heat = t => { t = clamp(t, 0, 1); const s = [[61, 139, 255], [47, 209, 108], [255, 210, 63], [255, 107, 26], [255, 59, 59]], x = t * (s.length - 1), i = Math.min(s.length - 2, x | 0), f = x - i; return [0, 1, 2].map(k => (s[i][k] + (s[i + 1][k] - s[i][k]) * f) / 255) };
  /* alerón delantero en 3D: dos mitades en voladizo desde el morro, tres elementos; flexión por viga, torsión, tensión de
     flexión en color y, por encima de la velocidad de flameo, oscilación divergente flexión-torsión */
  function wing3d(cv) {
    const M = mini3d(cv, [-.9, .55, 2.6, [0, -.02, .1]]);
    if (!M) return () => {};
    const { T, sc } = M, L = .9, els = [[0, 0, .28, 0], [.2, .045, .16, .18], [.31, .095, .12, .38]], meshes = [];
    for (const side of [-1, 1]) for (const [z0, y0, ch, aoa] of els) {
      const g = new T.PlaneGeometry(L, ch, 48, 4);
      g.rotateX(-Math.PI / 2), g.translate(side * L / 2, 0, 0);
      const m = new T.Mesh(g, new T.MeshStandardMaterial({ vertexColors: !0, metalness: .2, roughness: .45, side: T.DoubleSide }));
      g.setAttribute("color", new T.BufferAttribute(new Float32Array(g.attributes.position.count * 3), 3)), m.userData = { base: g.attributes.position.array.slice(), side, z0, y0, ch, aoa }, sc.add(m), meshes.push(m)
    }
    const nose = new T.Mesh(new T.BoxGeometry(.16, .12, .9), new T.MeshStandardMaterial({ color: "#20252b", metalness: .3, roughness: .5 }));
    nose.position.set(0, .07, .5), sc.add(nose);
    const grid = new T.GridHelper(3, 30, "#23303c", "#182028");
    grid.position.y = -.08, sc.add(grid);
    let v = null, t0 = performance.now(), amp = 0;
    const loop = () => {
      requestAnimationFrame(loop);
      if (!v || !M.visible()) return;
      const t = (performance.now() - t0) / 1e3, k = 1 + 1.5 * v.dmg / 100, Vf = v.Vf * Math.sqrt(Math.max(.05, 1 - .8 * v.dmg / 100)), q = (v.v / 300) ** 2, amp0 = Math.max(.05, 1 - (v.v / Vf) ** 2 * .6);
      const tip = v.d300 * k * q / amp0 / 1e3 * v.ex, twist = .6 * DEG * k * q / amp0 * v.ex / 10;
      amp = v.v > Vf ? Math.min(.25, amp + .002 + amp * .02) : amp * .95;
      const osc = amp * Math.sin(t * TAU * 2.2) * v.ex / 10, osT = amp * Math.sin(t * TAU * 2.2 + 1.1) * .4 * v.ex / 10;
      for (const m of meshes) {
        const { base, side, z0, y0, ch, aoa } = m.userData, pos = m.geometry.attributes.position, col = m.geometry.attributes.color;
        for (let i = 0; i < pos.count; i++) {
          const x = base[i * 3], zc = base[i * 3 + 2], s = Math.abs(x) / L, w = s * s * (6 - 4 * s + s * s) / 3, th = aoa + (twist + osT) * s;
          const zz = zc + z0, yy = y0 - (tip + osc) * w;
          pos.setXYZ(i, x, yy + Math.sin(-th) * zc, z0 + Math.cos(th) * zc);
          const sig = (1 - s) ** 2 * (q / amp0) * k + Math.abs(osc) * 3 * (1 - s), c = heat(sig / 1.6);
          col.setXYZ(i, c[0], c[1], c[2])
        }
        pos.needsUpdate = !0, col.needsUpdate = !0, m.geometry.computeVertexNormals()
      }
      M.render()
    };
    requestAnimationFrame(loop);
    return nv => { v = nv }
  }
  /* neumático en 3D: se aplasta contra el suelo con la carga (huella), la carcasa se ladea con la fuerza lateral y la
     banda se colorea con la temperatura interior/centro/exterior según la caída y la presión */
  function tyre3d(cv) {
    const M = mini3d(cv, [-.42, .22, 1.95, [0, -.06, 0]]);
    if (!M) return () => {};
    /* 18": diámetro exterior 720 mm, llanta 457 mm, ancho 305 mm (toro escalado a lo ancho) */
    const { T, sc } = M, R0 = .36, Rc = .295, tb = .065, W = 2.35, g = new T.TorusGeometry(Rc, tb, 36, 160);
    g.setAttribute("color", new T.BufferAttribute(new Float32Array(g.attributes.position.count * 3), 3));
    const base = g.attributes.position.array.slice(), mesh = new T.Mesh(g, new T.MeshStandardMaterial({ vertexColors: !0, roughness: .78, metalness: 0 }));
    sc.add(mesh);
    const rim = new T.Mesh(new T.CylinderGeometry(.229, .229, .3, 64, 1, !0).rotateX(Math.PI / 2), new T.MeshStandardMaterial({ color: "#30363d", metalness: .85, roughness: .3, side: T.DoubleSide }));
    sc.add(rim);
    const ground = new T.Mesh(new T.PlaneGeometry(3, 3), new T.MeshStandardMaterial({ color: "#1d232a", roughness: .9 }));
    ground.rotation.x = -Math.PI / 2, sc.add(ground);
    const patch = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ color: "#ff6b1a", transparent: !0, opacity: .55 }));
    patch.rotation.x = -Math.PI / 2, sc.add(patch);
    let v = null, spin = 0;
    const loop = () => {
      requestAnimationFrame(loop);
      if (!v || !M.visible()) return;
      const p = (v.p0 + 1.013) * (v.Tc + 273) / (v.Tb + 273) - 1.013, defl = v.Fz * 1e3 / (260e3 * Math.max(.4, p / 1.8)), floor = -R0 + defl, lean = v.Fy / 12 * .03, top = { S: 88, M: 95, H: 102 }[v.c];
      ground.position.y = floor - .0005, spin += .01;
      const Lp = 2 * Math.sqrt(Math.max(0, 2 * R0 * defl - defl * defl));
      patch.scale.set(Lp, .3 * (1 - Math.abs(v.cam) * .03), 1), patch.position.set(0, floor + .0008, lean * .8);
      const pos = g.attributes.position, col = g.attributes.color;
      for (let i = 0; i < pos.count; i++) {
        const x = base[i * 3], y = base[i * 3 + 1], z0 = base[i * 3 + 2], a = Math.atan2(y, x), r = Math.hypot(x, y), tread = r > Rc + tb * .55;
        let z = z0 * W, ny = y, nx = x;
        const low = Math.max(0, -Math.sin(a)) ** 3;
        z += lean * low * (1 + Math.cos(Math.atan2(z0, r - Rc))) * .5;
        if (y < floor) { ny = floor, z *= 1 + (floor - y) * 2.5 }
        pos.setXYZ(i, nx, ny, z);
        const zl = z0 / tb, after = ((a + Math.PI / 2 - spin) % TAU + TAU) % TAU, Tz = v.Tc + (-v.cam) * 4 * zl + (p - 1.8) * 28 * (1 - zl * zl) - 10 + 14 * Math.exp(-after / 1.1);
        if (tread) { const c = heat((Tz - top + 35) / 70); col.setXYZ(i, c[0] * .92, c[1] * .92, c[2] * .92) } else col.setXYZ(i, .1, .1, .11)
      }
      pos.needsUpdate = !0, col.needsUpdate = !0, g.computeVertexNormals(), M.render()
    };
    requestAnimationFrame(loop);
    return nv => { v = nv }
  }
  const BENCH = [
    {
      id: "bolt", g: "Uniones", t: "Tornillos de culata", d: "Un tornillo apretado es un muelle estirado que sujeta la junta. La presión de combustión intenta separarla: el tornillo sólo nota una fracción Φ de esa carga mientras la junta no se abra. Con el tiempo pierde precarga por fluencia (más con calor) y por microdeslizamientos si vibra de lado (ensayo de Junker).",
      p: [{ id: "F0", label: "Precarga inicial", unit: "kN", min: 10, max: 60, step: .5, v: 38 }, { id: "Fe", label: "Carga de combustión por tornillo", unit: "kN", min: 5, max: 50, step: .5, v: 24 }, { id: "phi", label: "Fracción de carga que toma el tornillo (Φ)", unit: "", min: .05, max: .6, step: .01, v: .22 }, { id: "T", label: "Temperatura de la unión", unit: "°C", min: 60, max: 260, step: 1, v: 125 }, { id: "vib", label: "Vibración transversal", unit: "g", min: 0, max: 8, step: .1, v: 1.2 }, { id: "mat", label: "Material", v: "steel", opts: [["steel", "Acero aleado"], ["ti", "Titanio"], ["inco", "Inconel 718"]] }],
      run(v) {
        const cr = { steel: [2.5e-4, 14], ti: [6e-4, 11], inco: [1e-4, 22] }[v.mat], Fsep = v.F0 / (1 - v.phi);
        const a = A(120, (i, n) => { const fe = i / (n - 1) * 60; return [fe, fe < Fsep ? v.F0 + v.phi * fe : fe] });
        const b = A(120, (i, n) => { const fe = i / (n - 1) * 60; return [fe, fe < Fsep ? v.F0 - (1 - v.phi) * fe : 0] });
        let F = 1;
        const t = A(200, (i, n) => { const h = i / (n - 1) * 100; i && (F -= .5 * (cr[0] * Math.exp((v.T - 120) / cr[1]) + 2e-4 * Math.max(0, v.vib - 2.5) ** 2) * F); return [h, F * 100] });
        const sep = v.Fe >= Fsep * (t.y[t.n - 1] / 100), left = t.y[Math.round(t.n * .2)];
        return {
          plots: [[[S(a, "#ff6b1a", "Fuerza en el tornillo"), S(b, "#3d8bff", "Compresión en la junta")], { title: "Diagrama de unión atornillada", xlabel: "carga externa kN", ymin: 0, vlines: [{ x: v.Fe, col: "rgba(255,255,255,.5)", label: "combustión" }, { x: Fsep, col: "#ff3b3b", label: "se abre" }] }],
            [[S(t, "#ffd23f", "Precarga que queda (%)")], { title: "Pérdida de precarga", xlabel: "horas de motor", ymin: 0, ymax: 105, hlines: [{ y: 72, col: "#ff3b3b", label: "la junta fuga" }] }]],
          v: [v.Fe >= Fsep ? ["bad", "La junta se abre", "La combustión vence a la precarga: el tornillo recibe toda la carga y la junta deja pasar gas y agua."] : ["ok", "Junta cerrada", "El tornillo sólo nota " + (v.phi * 100).toFixed(0) + " % de la carga de combustión."], left < 72 ? ["bad", "Relajación", "A las 20 h queda un " + left.toFixed(0) + " %: fugará."] : ["ok", "Relajación", "A las 20 h queda un " + left.toFixed(0) + " % de la precarga."]]
        }
      }
    },
    {
      id: "ring", g: "Pistón", t: "Segmentos: holgura entre puntas", d: "El segmento es un aro abierto. Si el pistón se calienta mucho más que la camisa (detonación, mezcla pobre, poco aceite en la cabeza del pistón), el acero del segmento crece más que el hueco y las puntas se tocan: el aro se arquea, raya la camisa y se rompe.",
      p: [{ id: "g0", label: "Holgura en frío", unit: "µm", min: 80, max: 500, step: 5, v: 300 }, { id: "B", label: "Diámetro", unit: "mm", min: 60, max: 100, step: .5, v: 80 }, { id: "Tr", label: "Segmento", unit: "°C", min: 50, max: 400, step: 1, v: 240 }, { id: "Tl", label: "Camisa", unit: "°C", min: 50, max: 250, step: 1, v: 170 }, { id: "lm", label: "Camisa", v: "al", opts: [["al", "Aluminio con Nikasil (dilatación efectiva 17 µm/m·K)"], ["st", "Acero (12)"], ["ci", "Fundición (11)"]] }],
      run(v) {
        const al = { al: 17e-6, st: 12e-6, ci: 11e-6 }[v.lm], gap = (Tr, Tl) => v.g0 - Math.PI * v.B * 1e3 * (12e-6 * (Tr - 20) - al * (Tl - 20));
        const ser = [120, 160, 200].map((Tl, j) => S(A(100, (i, n) => { const Tr = 50 + i / (n - 1) * 350; return [Tr, gap(Tr, Tl)] }), ["#3d8bff", "#2fd16c", "#ffd23f"][j], "camisa " + Tl + " °C"));
        const now = gap(v.Tr, v.Tl), Tb = 20 + (v.g0 / (Math.PI * v.B * 1e3) + al * (v.Tl - 20)) / 12e-6;
        return { plots: [[ser, { title: "Holgura según la temperatura del segmento", xlabel: "°C segmento", hlines: [{ y: 0, col: "#ff3b3b", label: "se tocan" }], points: [{ x: v.Tr, y: now, col: "#fff", r: 5 }] }]], v: [now < 0 ? ["bad", "Las puntas se tocan", "Faltan " + (-now).toFixed(0) + " µm: el segmento se arquea."] : ["ok", "Holgura en caliente " + now.toFixed(0) + " µm", "Se tocarían con el segmento a " + Tb.toFixed(0) + " °C."]] }
      }
    },
    {
      id: "spring", g: "Distribución", t: "Muelles de válvula: resonancia y flotación", d: "Un muelle metálico tiene su propia frecuencia: si un armónico de la leva coincide, las espiras ondulan (coil surge) y la fuerza de cierre cae. Además, a muchas vueltas la inercia de la válvula supera la fuerza del muelle y deja de seguir a la leva. Los muelles neumáticos de la F1 no tienen espiras que resuenen.",
      p: [{ id: "type", label: "Muelle", v: "metal", opts: [["metal", "Metálico"], ["neum", "Neumático"]] }, { id: "d", label: "Diámetro del hilo", unit: "mm", min: 2.5, max: 6, step: .05, v: 4.2 }, { id: "D", label: "Diámetro medio", unit: "mm", min: 16, max: 34, step: .5, v: 24 }, { id: "n", label: "Espiras activas", unit: "", min: 3, max: 10, step: .5, v: 5 }, { id: "m", label: "Masa móvil", unit: "g", min: 25, max: 120, step: 1, v: 50 }, { id: "L", label: "Alzada", unit: "mm", min: 6, max: 18, step: .1, v: 12.5 }, { id: "dur", label: "Duración de la leva", unit: "°", min: 180, max: 320, step: 1, v: 245 }],
      run(v) {
        const G = 79.3e9, rho = 7850, d = v.d / 1e3, D = v.D / 1e3, k = G * d ** 4 / (8 * D ** 3 * v.n), ms = rho * Math.PI * d * d / 4 * Math.PI * D * v.n, fn = .5 * Math.sqrt(k / ms), pre = k * .006;
        /* armónicos de la alzada (sin² sobre la duración) por serie de Fourier numérica */
        const H = [], N = 720;
        for (let h = 1; h <= 30; h++) { let re = 0, im = 0; for (let i = 0; i < N; i++) { const th = i / N * 720, u = th / v.dur, l = u < 1 ? Math.sin(Math.PI * u) ** 2 : 0; re += l * Math.cos(TAU * h * i / N), im += l * Math.sin(TAU * h * i / N) } H.push(2 * Math.hypot(re, im) / N) }
        const surge = A(160, (i, n) => { const rpm = 3e3 + i / (n - 1) * 15e3, fc = rpm / 120; let a = 0; for (let h = 1; h <= 30; h++) { const r = h * fc / fn; a += H[h - 1] / Math.sqrt((1 - r * r) ** 2 + (.06 * r) ** 2) } return [rpm, v.type === "metal" ? a * v.L : 0] });
        const ratio = A(160, (i, n) => { const rpm = 3e3 + i / (n - 1) * 15e3, wx = 6 * rpm / v.dur, a = 2 * Math.PI ** 2 * v.L / 1e3 * wx * wx, F = v.type === "metal" ? pre + k * v.L / 1e3 : 900 * Math.pow(25 / (25 - v.L), 1.3); return [rpm, v.m / 1e3 * a / F] });
        const fl = ratio.x[ratio.y.findIndex(y => y > 1)] || null;
        return { plots: [[[S(surge, "#b45cff", "Ondulación de las espiras (mm)")], { title: "Resonancia del muelle · f propia " + fn.toFixed(0) + " Hz", xlabel: "rpm", ymin: 0 }], [[S(ratio, "#ff6b1a", "Inercia / fuerza del muelle")], { title: "Flotación", xlabel: "rpm", ymin: 0, hlines: [{ y: 1, col: "#ff3b3b", label: "flota" }], vlines: fl ? [{ x: fl, col: "#ff3b3b", label: Math.round(fl) + " rpm" }] : [] }]], v: [fl ? ["warn", "Flota a " + Math.round(fl) + " rpm", "Por encima la válvula no sigue a la leva."] : ["ok", "No flota hasta 18 000 rpm", ""], v.type === "metal" ? ["warn", "Resonancias", "Armónicos de la leva que coinciden con " + fn.toFixed(0) + " Hz: picos en " + [1, 2, 3].map(h => Math.round(fn / h * 120 / 12)).join(", ") + "… rpm (orden 12)"] : ["ok", "Sin espiras", "El muelle neumático no ondula."]] }
      }
    },
    {
      id: "oil", g: "Lubricación", t: "Aceite: viscosidad, película y descebe", d: "El aceite caliente se adelgaza (ecuación de Vogel) y la película que separa los metales del cojinete se estrecha. En curvas largas de mucha G el aceite se va a un lado del depósito: si la bomba aspira aire, la presión cae de golpe.",
      p: [{ id: "oil", label: "Aceite", v: "f1", opts: [["f1", "F1 (muy fluido)"], ["road", "Calle 5W-30"]] }, { id: "T", label: "Temperatura", unit: "°C", min: 40, max: 170, step: 1, v: 120 }, { id: "rpm", label: "Régimen", unit: "rpm", min: 3000, max: 15000, step: 50, v: 10500 }, { id: "load", label: "Carga", unit: "%", min: 10, max: 110, step: 1, v: 80 }, { id: "lvl", label: "Aceite en el depósito", unit: "L", min: .5, max: 6.5, step: .1, v: 6 }, { id: "G", label: "G sostenida", unit: "g", min: 1, max: 7, step: .1, v: 4.5 }],
      run(v) {
        const vo = v.oil === "f1" ? T => .242 * Math.exp(626 / (T + 95)) : T => .0635 * Math.exp(1050 / (T + 110)), film = (T, rpm) => 1.15 * Math.sqrt(vo(T) / 4.2 * (rpm / 10500) / Math.max(.2, .45 * v.load / 100 + .55 * (rpm / 10500) ** 2)) * (v.lvl < 1.5 ? v.lvl / 1.5 : 1);
        const vis = A(120, (i, n) => { const T = 40 + i / (n - 1) * 130; return [T, vo(T)] });
        const fs = [90, 120, 150].map((T, j) => S(A(100, (i, n) => { const r = 3e3 + i / (n - 1) * 12e3; return [r, film(T, r)] }), ["#3d8bff", "#2fd16c", "#ff3b3b"][j], T + " °C"));
        const gc = 4.2 + .45 * v.lvl, h = film(v.T, v.rpm);
        return { plots: [[[S(vis, "#ffd23f", "Viscosidad (cSt)")], { title: "Ley de Vogel", xlabel: "°C", ymin: 0, points: [{ x: v.T, y: vo(v.T), col: "#fff", r: 5 }] }], [fs, { title: "Película mínima del cojinete (µm)", xlabel: "rpm", ymin: 0, hlines: [{ y: .4, col: "#ff3b3b", label: "contacto metálico" }], points: [{ x: v.rpm, y: h, col: "#fff", r: 5 }] }]], v: [h < .4 ? ["bad", "Película " + h.toFixed(2) + " µm", "Los metales se tocan: el cojinete se gripa."] : h < .7 ? ["warn", "Película " + h.toFixed(2) + " µm", "Poco margen."] : ["ok", "Película " + h.toFixed(2) + " µm", "Bien separada."], v.G > gc ? ["bad", "Descebe", "Con " + v.lvl.toFixed(1) + " L el depósito aguanta " + gc.toFixed(1) + " g: a " + v.G + " g la bomba aspira aire."] : ["ok", "Sin descebe", "Aguanta hasta " + gc.toFixed(1) + " g sostenidos."]] }
      }
    },
    {
      id: "boil", g: "Refrigeración", t: "Ebullición en la culata y cavitación", d: "Cerca de la cámara de combustión el agua hierve en burbujas diminutas que se despegan (ebullición nucleada): así se saca muchísimo calor. Si el flujo de calor supera el crítico (CHF de Zuber), las burbujas se juntan en una película de vapor que aísla el metal y la temperatura se dispara. Presurizar el circuito sube el punto de ebullición.",
      p: [{ id: "p", label: "Presión del circuito", unit: "bar abs", min: 1, max: 4.5, step: .05, v: 3.5 }, { id: "Tc", label: "Refrigerante", unit: "°C", min: 60, max: 150, step: 1, v: 115 }, { id: "q", label: "Flujo de calor en la culata", unit: "MW/m²", min: .1, max: 3, step: .05, v: 1.1 }, { id: "gly", label: "Glicol", unit: "%", min: 0, max: 60, step: 1, v: 30 }, { id: "rpm", label: "Régimen de la bomba", unit: "rpm motor", min: 3000, max: 15000, step: 100, v: 11000 }],
      run(v) {
        const Ts = tsatW(v.p) + v.gly * .2, chf = 1.3 * Math.pow(v.p / 3.5, .35) * (1 - .005 * v.gly) * (1 + .002 * (Ts - v.Tc) * 10);
        /* curva de Nukiyama: convección, nucleada (Rohsenow ∝ ΔT³), máximo (CHF), transición y película */
        const curve = A(200, (i, n) => { const dT = Math.pow(10, -.3 + i / (n - 1) * 3.2), qn = .0009 * dT ** 3, qc = .012 * Math.max(0, dT + (Ts - v.Tc)), dTc = Math.cbrt(chf / .0009); let q = dT < dTc ? Math.max(qc, qn) : dT < dTc * 6 ? chf * Math.pow(dTc / dT, 1.4) : .2 * chf * Math.pow(dT / (dTc * 6), 1.1) * Math.pow(dTc * 6 / dT, .0); return [Math.log10(dT), q] });
        const dTop = Math.cbrt(Math.max(1e-6, v.q - .012 * Math.max(0, Ts - v.Tc)) / .0009), wall = Ts + dTop;
        const cav = A(100, (i, n) => { const r = 3e3 + i / (n - 1) * 12e3; return [r, v.p - vapW(v.Tc) - 1.2 * (r / 12e3) ** 2] });
        const cm = v.p - vapW(v.Tc) - 1.2 * (v.rpm / 12e3) ** 2;
        return { plots: [[[S(curve, "#ff6b1a", "Flujo de calor (MW/m²)")], { title: "Curva de ebullición · saturación " + Ts.toFixed(0) + " °C", xlabel: "log₁₀ (pared − saturación) °C", ymin: 0, hlines: [{ y: chf, col: "#ff3b3b", label: "CHF " + chf.toFixed(2) }, { y: v.q, col: "rgba(255,255,255,.5)", label: "ahora" }] }], [[S(cav, "#3d8bff", "Margen a la entrada de la bomba (bar)")], { title: "Cavitación", xlabel: "rpm", hlines: [{ y: 0, col: "#ff3b3b", label: "burbujas" }], points: [{ x: v.rpm, y: cm, col: "#fff", r: 5 }] }]], v: [v.q > chf ? ["bad", "Película de vapor", "El flujo supera el crítico: el metal se sobrecalienta y la culata se agrieta."] : ["ok", "Ebullición nucleada", "Pared a ~" + wall.toFixed(0) + " °C; margen al crítico " + ((1 - v.q / chf) * 100).toFixed(0) + " %."], cm < 0 ? ["bad", "Cavitación", "Las burbujas implosionan en la bomba y pican el metal."] : ["ok", "Sin cavitación", "Margen " + cm.toFixed(2) + " bar."]] }
      }
    },
    {
      id: "gear", g: "Transmisión", t: "Dientes de la caja: flexión y picado", d: "Cada vez que un diente engrana se dobla en la raíz y se aplasta en el flanco. La flexión tiene límite de fatiga: por debajo de cierta tensión dura para siempre. El contacto (presión de Hertz) no: va picando el flanco poco a poco hasta que salta material.",
      p: [{ id: "T", label: "Par a la entrada", unit: "N·m", min: 100, max: 1000, step: 5, v: 600 }, { id: "g", label: "Marcha", unit: "", min: 1, max: 8, step: 1, v: 3 }, { id: "b", label: "Ancho de diente", unit: "mm", min: 8, max: 25, step: .5, v: 14 }, { id: "rpm", label: "Régimen", unit: "rpm", min: 4000, max: 13000, step: 100, v: 11000 }, { id: "hrs", label: "Horas en esa marcha", unit: "h", min: .1, max: 20, step: .1, v: 2 }],
      run(v) {
        const SF = [1.45, 1.3, 1.18, 1.08, 1, .94, .88, .84][v.g - 1], sr = v.T / 650 * SF * 14 / v.b, cyc = v.rpm / 60 * v.hrs * 3600;
        const Nb = s => s > 1.15 ? 1e7 * Math.pow(s / 1.15, -9) : Infinity, Np = s => 4e9 / Math.pow(s, 6);
        const bend = A(100, (i, n) => { const lN = 3 + i / (n - 1) * 7, s = Math.max(1.15, 1.15 * Math.pow(10 ** lN / 1e7, -1 / 9)); return [lN, s] }), pit = A(100, (i, n) => { const lN = 3 + i / (n - 1) * 7; return [lN, Math.pow(4e9 / 10 ** lN, 1 / 6)] });
        return { plots: [[[S(bend, "#ff6b1a", "Flexión en la raíz"), S(pit, "#3d8bff", "Picado del flanco")], { title: "Curvas S-N (tensión relativa)", xlabel: "log₁₀ ciclos", ymin: 0, ymax: 3, hlines: [{ y: sr, col: "rgba(255,255,255,.6)", label: "ahora " + sr.toFixed(2) }], vlines: [{ x: Math.log10(cyc), col: "#ffd23f", label: "ciclos hechos" }] }]], v: [cyc / Nb(sr) >= 1 ? ["bad", "Rotura del diente", "Daño de flexión " + (cyc / Nb(sr) * 100).toFixed(0) + " %."] : ["ok", "Flexión", isFinite(Nb(sr)) ? "Consumido " + (cyc / Nb(sr) * 100).toFixed(1) + " %." : "Por debajo del límite de fatiga: no se rompe."], cyc / Np(sr) >= 1 ? ["bad", "Flanco picado", "Daño de contacto " + (cyc / Np(sr) * 100).toFixed(0) + " %."] : ["ok", "Picado", "Consumido " + (cyc / Np(sr) * 100).toFixed(1) + " %."]] }
      }
    },
    {
      id: "brake", g: "Frenos", t: "Frenos: temperatura en una vuelta, fricción y desgaste", d: "Cada frenada mete en los discos la energía cinética del coche; en las rectas el aire y la radiación (a 1 000 °C brilla) los enfrían. El carbono frena bien caliente, pero por encima de ~700 °C se oxida y se gasta exponencialmente; el líquido hierve hacia 315 °C.",
      p: [{ id: "trk", label: "Circuito", v: "monza", opts: [["monza", "Monza (frenadas desde 340 km/h)"], ["mtl", "Montreal (paradas fuertes seguidas)"], ["mon", "Mónaco (frenadas cortas, poca refrigeración)"]] }, { id: "C", label: "Capacidad térmica del eje delantero", unit: "J/K", min: 800, max: 3000, step: 50, v: 1500 }, { id: "duct", label: "Toma de refrigeración", unit: "%", min: 30, max: 160, step: 1, v: 100 }, { id: "bias", label: "Reparto delante", unit: "%", min: 50, max: 65, step: .5, v: 57 }],
      run(v) {
        const P = { monza: [[340, 80, 2.8], [330, 120, 1.9], [320, 165, 1.6], [300, 180, 1.4], [330, 210, 1.5], [280, 200, 1.2]], mtl: [[320, 70, 2.6], [300, 90, 2.3], [290, 110, 1.9], [310, 75, 2.6], [300, 140, 1.5]], mon: [[290, 70, 2], [200, 50, 1.6], [240, 60, 1.7], [260, 80, 1.6], [150, 60, 1.2], [180, 70, 1.3], [220, 80, 1.4]] }[v.trk];
        const dt = .1, out = [], fl = [];
        let T = 350, Tf = 120, t = 0, wear = 0;
        for (let lap = 0; lap < 3; lap++) for (const [v0, v1, d] of P) {
          const E = .5 * 800 * ((v0 / 3.6) ** 2 - (v1 / 3.6) ** 2) * .78 * v.bias / 100, Pw = E / d;
          for (let s = 0; s < d; s += dt) { const u = v0 / 3.6 - (v0 - v1) / 3.6 * s / d; T += dt * (Pw - (15 + 4.5 * u) * v.duct / 100 * (T - 30) - .85 * 5.67e-8 * .45 * ((T + 273) ** 4 - 303 ** 4)) / v.C, Tf += dt * ((T - Tf) * .0025 - (Tf - 30) * (.002 + 2e-5 * u)), wear += dt * 1e-3 * Math.exp((T - 750) / 85), t += dt, out.push([t, T]), fl.push([t, Tf]) }
          for (let s = 0; s < 9; s += dt) { const u = 70; T += dt * (-(15 + 4.5 * u) * v.duct / 100 * (T - 30) - .85 * 5.67e-8 * .45 * ((T + 273) ** 4 - 303 ** 4)) / v.C, Tf += dt * ((T - Tf) * .0025 - (Tf - 30) * (.002 + 2e-5 * u)), t += dt, out.push([t, T]), fl.push([t, Tf]) }
        }
        const s1 = A(out.length, i => out[i]), s2 = A(fl.length, i => fl[i]), mx = Math.max(...s1.y);
        const mu = A(100, (i, n) => { const T = i / (n - 1) * 1300; return [T, T < 200 ? .78 + .22 * T / 200 : T > 1050 ? Math.max(.55, 1 - (T - 1050) / 500) : 1] });
        return { plots: [[[S(s1, "#ff6b1a", "Disco delantero (°C)"), S(s2, "#3d8bff", "Líquido (°C)")], { title: "Tres vueltas", xlabel: "s", ymin: 0, hlines: [{ y: 315, col: "#3d8bff", label: "el líquido hierve" }, { y: 1050, col: "#ff3b3b", label: "pierde fricción" }] }], [[S(mu, "#2fd16c", "Fricción relativa")], { title: "Fricción del carbono", xlabel: "°C", ymin: .4, ymax: 1.05 }]], v: [mx > 1050 ? ["bad", "Pico " + mx.toFixed(0) + " °C", "Pierden fricción y se oxidan muy deprisa."] : ["ok", "Pico " + mx.toFixed(0) + " °C", "Dentro de la ventana."], [wear / 3 * 60 > 4.5 ? "bad" : "warn", "Desgaste", (wear / 3).toFixed(3) + " mm por vuelta por oxidación (" + (wear / 3 * 60).toFixed(1) + " mm en 60 vueltas; límite ~4,5 mm)."]] }
      }
    },
    {
      id: "tyre", g: "Neumáticos", t: "Neumático: presión, huella y ventana", d: "Es un globo de gas: sale de la manta a una presión y sube con la temperatura de la carcasa (gas ideal). La huella es la carga dividida por la presión, así que crece con la carga aerodinámica. Cada compuesto agarra en una ventana de temperatura.",
      p: [{ id: "p0", label: "Presión de salida", unit: "bar", min: 1.2, max: 2, step: .01, v: 1.59 }, { id: "Tb", label: "Manta", unit: "°C", min: 20, max: 100, step: 1, v: 70 }, { id: "Tc", label: "Carcasa", unit: "°C", min: 20, max: 160, step: 1, v: 105 }, { id: "Fz", label: "Carga en la rueda", unit: "kN", min: 1, max: 12, step: .1, v: 5.5 }, { id: "c", label: "Compuesto", v: "M", opts: [["S", "Blando (ventana ~88 °C)"], ["M", "Medio (~95 °C)"], ["H", "Duro (~102 °C)"]] }, { id: "Fy", label: "Fuerza lateral", unit: "kN", min: -12, max: 12, step: .1, v: 6 }, { id: "cam", label: "Caída", unit: "°", min: -4.5, max: 0, step: .1, v: -3 }],
      three: tyre3d,
      run(v) {
        const pp = Tc => (v.p0 + 1.013) * (Tc + 273) / (v.Tb + 273) - 1.013, top = { S: 88, M: 95, H: 102 }[v.c], p = pp(v.Tc), area = v.Fz * 1e3 / (p * 1e5) * 1e4 * .82;
        const defl = v.Fz * 1e3 / (260e3 * Math.max(.4, p / 1.8)), Lp = 2 * Math.sqrt(2 * .36 * defl - defl * defl);
        return { plots: [[[S(A(100, (i, n) => { const T = 20 + i / (n - 1) * 140; return [T, pp(T)] }), "#3d8bff", "Presión (bar)")], { title: "Gas ideal", xlabel: "°C carcasa", points: [{ x: v.Tc, y: p, col: "#fff", r: 5 }] }], [[S(A(100, (i, n) => { const T = 30 + i / (n - 1) * 120, d = (T - top) / (T < top ? 60 : 50); return [T, 1 - .3 * Math.min(1, d * d)] }), "#2fd16c", "Agarre relativo")], { title: "Ventana de temperatura", xlabel: "°C banda", ymin: .6, ymax: 1.02 }]], v: [["ok", "Presión en caliente " + p.toFixed(2) + " bar (" + (p * 14.5).toFixed(1) + " psi)", "Huella de " + area.toFixed(0) + " cm² con " + v.Fz + " kN: aplasta " + (defl * 1e3).toFixed(0) + " mm y mide " + (Lp * 1e3).toFixed(0) + " mm de largo. Con caída negativa el hombro interior va más caliente; con presión alta, el centro."], v.Tc > 140 ? ["bad", "Carcasa a " + v.Tc + " °C", "Se separan las capas: pinchazo."] : ["ok", "Carcasa en margen", ""]] }
      }
    },
    {
      id: "rh", g: "Chasis", t: "Altura al suelo, tablón y porpoising", d: "La carga aerodinámica aplasta el coche contra el suelo; al frenar se hunde el morro. Con el efecto suelo, cuanto más bajo más carga… hasta que el flujo entra en pérdida, el coche sube, recupera la carga y vuelve a bajar: el porpoising. Si el tablón de madera roza, se gasta; con menos de 9 mm al final, descalificación.",
      p: [{ id: "f0", label: "Altura estática delante", unit: "mm", min: 15, max: 50, step: .5, v: 32 }, { id: "r0", label: "Altura estática detrás", unit: "mm", min: 30, max: 90, step: .5, v: 52 }, { id: "kh", label: "Rigidez de heave (con neumático)", unit: "N/mm", min: 150, max: 900, step: 5, v: 400 }, { id: "cl", label: "Carga aerodinámica (CL·A)", unit: "m²", min: 3, max: 7, step: .1, v: 5.5 }, { id: "brk", label: "Frenada", unit: "g", min: 0, max: 6, step: .1, v: 4.5 }, { id: "bump", label: "Baches", unit: "mm", min: 0, max: 8, step: .1, v: 2 }],
      run(v) {
        const rh = (u, brake) => { const DF = .5 * 1.2 * u * u * v.cl, pitch = brake * 9.81 * 800 * .3 / 3.6, F = v.f0 - DF * .43 / (v.kh * 1.02) - pitch / (v.kh * 1.02), R = v.r0 - DF * .57 / (v.kh * .9) + pitch / (v.kh * .9); return [F, R, .55 * F + .45 * R] };
        const sf = A(100, (i, n) => { const u = i / (n - 1) * 95; return [u * 3.6, rh(u, 0)[2]] }), sb = A(100, (i, n) => { const u = i / (n - 1) * 95; return [u * 3.6, rh(u, v.brk)[2] - v.bump] });
        const porp = A(100, (i, n) => { const u = i / (n - 1) * 95, R = rh(u, 0)[1]; return [u * 3.6, R < 18 && u > 65 ? 6 * clamp((u - 65) / 20, 0, 1) * clamp((18 - R) / 8, 0, 1) : 0] });
        const cont = sb.x.find((x, i) => sb.y[i] < .5);
        return { plots: [[[S(sf, "#2fd16c", "En recta"), S(sb, "#ff6b1a", "Frenando con baches")], { title: "Tablón al suelo (mm)", xlabel: "km/h", hlines: [{ y: 0, col: "#ff3b3b", label: "roza" }] }], [[S(porp, "#b45cff", "Amplitud (mm)")], { title: "Porpoising", xlabel: "km/h", ymin: 0, ymax: 7 }]], v: [cont ? ["warn", "Roza desde " + Math.round(cont) + " km/h al frenar", "Chispas y desgaste del tablón."] : ["ok", "No roza", ""], Math.max(...porp.y) > 1 ? ["warn", "Porpoising", "Rebote de hasta " + Math.max(...porp.y).toFixed(1) + " mm a ~5 Hz."] : ["ok", "Sin porpoising", ""]] }
      }
    },
    {
      id: "hop", g: "Chasis", t: "Rebote de rueda y planos", d: "La rueda, el buje y los frenos (la masa no suspendida) rebotan entre el muelle del neumático y la suspensión a 15-20 Hz. Un plano por bloqueo golpea una vez por vuelta de rueda: a la velocidad en que ambas frecuencias coinciden, la vibración se dispara.",
      p: [{ id: "m", label: "Masa no suspendida por rueda", unit: "kg", min: 15, max: 45, step: .5, v: 30 }, { id: "kt", label: "Rigidez vertical del neumático", unit: "N/mm", min: 150, max: 450, step: 5, v: 260 }, { id: "ks", label: "Rigidez de suspensión en rueda", unit: "N/mm", min: 30, max: 300, step: 5, v: 110 }, { id: "z", label: "Amortiguamiento", unit: "ζ", min: .03, max: .5, step: .01, v: .12 }, { id: "flat", label: "Profundidad del plano", unit: "mm", min: 0, max: 3, step: .05, v: .8 }],
      run(v) {
        const fh = Math.sqrt((v.kt + v.ks) * 1e3 / v.m) / TAU, R = .36, vres = fh * TAU * R * 3.6;
        const tr = A(200, (i, n) => { const f = .5 + i / (n - 1) * 49.5, r = f / fh; return [f, 1 / Math.sqrt((1 - r * r) ** 2 + (2 * v.z * r) ** 2)] });
        const sp = A(200, (i, n) => { const kmh = 20 + i / (n - 1) * 320, f = kmh / 3.6 / (TAU * R), r = f / fh; return [kmh, v.flat / Math.sqrt((1 - r * r) ** 2 + (2 * v.z * r) ** 2)] });
        return { plots: [[[S(tr, "#ffd23f", "Amplificación")], { title: "Respuesta de la rueda · " + fh.toFixed(1) + " Hz", xlabel: "Hz", ymin: 0 }], [[S(sp, "#ff6b1a", "Golpeo del plano (mm)")], { title: "Según la velocidad", xlabel: "km/h", ymin: 0, vlines: [{ x: vres, col: "#ff3b3b", label: "resonancia " + vres.toFixed(0) + " km/h" }] }]], v: [["warn", "Resuena a " + vres.toFixed(0) + " km/h", "Con un plano, el piloto lo nota sobre todo a esa velocidad."]] }
      }
    },
    {
      id: "wing", g: "Aerodinámica", t: "Alerón: flexión y flameo", d: "La fuerza del alerón crece con la velocidad al cuadrado y lo dobla. Por encima de la velocidad de flameo la flexión y la fuerza se realimentan: el alerón vibra cada vez más hasta romperse. Un golpe le quita rigidez y baja esa velocidad.",
      p: [{ id: "d300", label: "Flexión de la punta a 300 km/h", unit: "mm", min: 2, max: 20, step: .5, v: 7.5 }, { id: "Vf", label: "Velocidad de flameo intacto", unit: "km/h", min: 250, max: 500, step: 5, v: 389 }, { id: "dmg", label: "Daño", unit: "%", min: 0, max: 90, step: 1, v: 0 }, { id: "v", label: "Velocidad", unit: "km/h", min: 100, max: 360, step: 1, v: 320 }, { id: "ex", label: "Exagerar la deformación", unit: "×", min: 1, max: 60, step: 1, v: 25 }],
      three: wing3d,
      run(v) {
        const k = 1 + 1.5 * v.dmg / 100, Vf = v.Vf * Math.sqrt(Math.max(.05, 1 - .8 * v.dmg / 100));
        const def = A(120, (i, n) => { const s = 50 + i / (n - 1) * 350, q = (s / 300) ** 2; return [s, v.d300 * k * q / Math.max(.05, 1 - (s / Vf) ** 2 * .6)] });
        return { plots: [[[S(def, "#3d8bff", "Flexión de la punta (mm)")], { title: "Aeroelasticidad", xlabel: "km/h", ymin: 0, ymax: Math.max(30, v.d300 * 4), vlines: [{ x: Vf, col: "#ff3b3b", label: "flameo " + Vf.toFixed(0) }, { x: v.v, col: "rgba(255,255,255,.5)", label: "ahora" }] }]], v: [v.v > Vf ? ["bad", "Flameo", "A " + v.v + " km/h el alerón entra en vibración divergente y se rompe."] : ["ok", "Margen al flameo " + (Vf - v.v).toFixed(0) + " km/h", ""]] }
      }
    },
    {
      id: "tele", g: "Datos", t: "Telemetría y radio: cuánto tardan los datos", d: "El coche envía cientos de canales por radio a antenas repartidas por el circuito; de ahí van al muro y por fibra a la fábrica. En un túnel no hay cobertura: el coche guarda los datos y los manda de golpe al salir. La voz del piloto pasa además por la codificación y el control de la FIA.",
      p: [{ id: "L", label: "Longitud del circuito", unit: "km", min: 3, max: 7.5, step: .1, v: 5.3 }, { id: "nA", label: "Antenas", unit: "", min: 1, max: 10, step: 1, v: 5 }, { id: "hop", label: "Retardo por salto entre antenas", unit: "ms", min: .5, max: 6, step: .1, v: 1.6 }, { id: "fac", label: "Distancia hasta la fábrica", unit: "km", min: 0, max: 18000, step: 100, v: 1500 }, { id: "tun", label: "Túnel", unit: "m", min: 0, max: 800, step: 10, v: 0 }],
      run(v) {
        const L = v.L * 1e3, ants = Array.from({ length: v.nA }, (_, j) => j / v.nA * L), fac = v.fac * 1.45 / 200 + 9;
        const lat = A(200, (i, n) => { const s = i / (n - 1) * L; let best = 1e9, hop = 0; ants.forEach((a, j) => { const d = Math.min(Math.abs(s - a), L - Math.abs(s - a)) * .45; d < best && (best = d, hop = Math.min(j, v.nA - j)) }); const inT = v.tun && s > L * .4 && s < L * .4 + v.tun; return [s / 1e3, inT ? NaN : 3.2 + v.hop * hop + best / 3e5 * 1e3 + 5] });
        const mx = Math.max(...Array.from(lat.y).filter(isFinite));
        return { plots: [[[S(lat, "#3d8bff", "Coche → muro (ms)")], { title: "Latencia según la posición", xlabel: "km de vuelta", ymin: 0, ymax: mx * 1.5 }]], v: [["ok", "Muro: " + mx.toFixed(1) + " ms en el peor punto", "Fábrica: +" + fac.toFixed(0) + " ms por fibra. Radio de voz: ~" + (140 + fac / 2).toFixed(0) + " ms."], v.tun ? ["warn", "Túnel de " + v.tun + " m", "Sin señal unos " + (v.tun / 70).toFixed(1) + " s a 250 km/h: los datos llegan en ráfaga al salir."] : ["ok", "Cobertura total", ""]] }
      }
    }
  ];
  function card(B) {
    const box = el("section", { class: "lim", id: "lim-" + B.id }), pl = el("div", { class: "limplots" }), vd = el("div", { class: "limv" }), side = el("aside", { class: "limp" });
    box.append(el("header", {}, [el("span", { class: "limg", text: B.g }), el("h3", { text: B.t })]), el("p", { class: "sub", text: B.d }), el("div", { class: "limb" }, [side, el("div", {}, [pl, vd])]));
    const plots = [];
    let prm, upd3 = null;
    if (B.three) { const c3 = el("canvas", { class: "lim3d", title: "Arrastra para girar, rueda para acercar" }); pl.before(c3), upd3 = B.three(c3) }
    const go = () => {
      const r = B.run(prm.v);
      upd3 && upd3({ ...prm.v });
      while (plots.length < r.plots.length) { const c = el("canvas", { class: "limc" }); pl.appendChild(c), plots.push(new Plot(c)) }
      r.plots.forEach(([ser, o], i) => plots[i].draw(ser, o)), vd.innerHTML = r.v.map(([s, t, d]) => `<div class="vd ${s}"><b>${t}</b><span>${d}</span></div>`).join("")
    };
    prm = new Params(side, [{ title: "Parámetros", open: !0, items: B.p }], () => { clearTimeout(go.t), go.t = setTimeout(go, 30) });
    return { box, go }
  }
  function init(host) {
    host.innerHTML = `<div class="labhead"><div><h2>Límites y averías</h2><p class="sub">Cada mecanismo que puede romper un F1, con su modelo físico y su límite. Son los mismos modelos que corren en tiempo real en cada coche durante las carreras (abre «Ingeniería en vivo» en la telemetría del simulador).</p></div><div class="presets" id="limNav"></div></div><div class="benchbox" id="limBench"></div><div class="limgrid" id="limGrid"></div>`;
    {
      /* los límites que sí fija el reglamento, al lado de lo que usa cada banco de pruebas */
      const Sx = LAB.SRC;
      LAB.bench($("limBench"), [
        { k: "Tablón", lab: "descalificación con menos de 9 mm", real: "10 ± 0,2 mm nuevo; se admite hasta 9 mm por desgaste; patines de titanio", s: 1, ok: !0 },
        { k: "Disco de freno", lab: "de carbono, refrigerado por aire", real: "delante de 325 a 330 mm y detrás de 275 a 280 mm; grosor máx. 32 mm; prohibido refrigerar con líquido", s: 1, ok: !0 },
        { k: "Dientes de la caja", lab: "acero, 14 mm de ancho de serie", real: "de acero; ancho mín. 12 mm; cada pareja, mín. 600 g", s: 1, ok: !0 },
        { k: "Neumático", lab: "gas ideal dentro de la carcasa", real: "solo aire o nitrógeno; diámetro máx. 725 mm en seco", s: 1, ok: !0 },
        { k: "Ventana de temperatura del neumático", lab: "blando 100 °C · medio 108 °C · duro 116 °C (óptimo)", real: "C5: 85–115 °C · C4: 90–120 °C · C3: 105–135 °C · C2: 110–135 °C · C1: 110–140 °C", s: 2, ok: !0 },
        { k: "Alerón trasero móvil", lab: "el banco calcula flexión y flameo, no la abertura", real: "abertura entre los dos planos de 10 a 85 mm", s: 1, ok: null }
      ], [Sx.fia22, Sx.pirelli19])
    }
    const cards = BENCH.map(card);
    for (const [i, c] of cards.entries()) $("limGrid").appendChild(c.box), $("limNav").appendChild(el("button", { class: "btn", text: BENCH[i].t.split(":")[0], onclick: () => c.box.scrollIntoView({ behavior: "smooth", block: "start" }) }));
    requestAnimationFrame(() => cards.forEach(c => c.go()))
  }
  return { init, _bench: BENCH }
})();
