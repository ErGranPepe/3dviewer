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
      { id: "muf", label: "Masa no suspendida delantera (por rueda)", unit: "kg", min: 12, max: 50, step: .5, v: 22, adv: !0, help: "La misma que en la pestaña Suspensión." },
      { id: "mur", label: "Masa no suspendida trasera (por rueda)", unit: "kg", min: 12, max: 55, step: .5, v: 26, adv: !0 },
      { id: "trf", label: "Vía delantera", unit: "m", min: 1.4, max: 1.8, step: .01, v: LAB.car.tf, adv: !0 },
      { id: "trr", label: "Vía trasera", unit: "m", min: 1.4, max: 1.8, step: .01, v: LAB.car.trr, adv: !0 }
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
  let T, R, scene, cam, st, labelsEl, comp = null;
  const X3 = (x, y, z) => new T.Vector3(x - LAB.car.wb / 2, z, y);
  /* el coche del simulador: se carga una vez y sustituye al forro aproximado */
  let carData = null;
  LAB.carmesh && LAB.carmesh.load().then(d => { carData = d, d && res && parts3d && buildSkin() });
  /* estaciones del forro: nudo de la columna, semiancho, alto, desplazamiento vertical del centro */
  /* ---------- carrocería deformable ----------
     Cada pieza se modela en coordenadas del coche (x adelante, y a la derecha, z arriba) y cada vértice queda atado a la
     estructura: a la columna (Hermite entre los dos nudos que lo rodean más el giro de torsión) o a un alerón (voladizo
     cúbico entre el centro y la punta). Así el modo se ve en la carrocería entera, no en un esqueleto. */
  /* monocasco, morro y tapa motor: x, semiancho, z inferior, z superior */
  const BODY = [[4.78, .04, .13, .19], [4.55, .08, .14, .3], [4.2, .13, .16, .4], [3.9, .18, .12, .48], [3.55, .23, .08, .54], [3.15, .27, .06, .58], [2.75, .31, .05, .62], [2.4, .37, .05, .64], [2.1, .41, .05, .67], [1.86, .41, .05, .82], [1.7, .38, .06, 1.0], [1.5, .33, .07, .93], [1.2, .27, .09, .8], [.9, .21, .11, .67], [.6, .16, .13, .56], [.3, .12, .15, .46], [0, .1, .17, .4], [-.28, .08, .19, .36], [-.42, .06, .22, .32]];
  /* pontones (cada lado): x, y interior, y exterior, z inferior, z superior */
  const POD = [[2.42, .3, .4, .22, .5], [2.25, .3, .58, .12, .56], [1.95, .32, .62, .08, .58], [1.55, .3, .58, .08, .53], [1.15, .24, .47, .09, .46], [.8, .17, .34, .11, .37], [.5, .12, .22, .13, .29]];
  let parts3d = null;
  function ringGeo(secs, sub, n, pw) {
    const S2 = [];
    for (let k = 0; k < secs.length - 1; k++) for (let q = 0; q < sub; q++) { const f = q / sub; S2.push(secs[k].map((v, i) => v + (secs[k + 1][i] - v) * f)) }
    S2.push(secs[secs.length - 1]);
    const base = [], idx = [], nr = S2.length;
    for (const [x, y0, hw, z0, hh] of S2) for (let j = 0; j < n; j++) { const th = j / n * TAU, cy = Math.cos(th), sy = Math.sin(th); base.push(x, y0 + Math.sign(cy) * Math.abs(cy) ** pw * hw, z0 + Math.sign(sy) * Math.abs(sy) ** pw * hh) }
    for (let r = 0; r < nr - 1; r++) for (let j = 0; j < n; j++) { const a = r * n + j, b = r * n + (j + 1) % n, c = a + n, d = b + n; idx.push(a, b, c, b, d, c) }
    /* tapas en los extremos */
    const cap = (r, flip) => { const c0 = base.length / 3; let cx = 0, cyy = 0, cz = 0; for (let j = 0; j < n; j++) cx += base[(r * n + j) * 3], cyy += base[(r * n + j) * 3 + 1], cz += base[(r * n + j) * 3 + 2]; base.push(cx / n, cyy / n, cz / n); for (let j = 0; j < n; j++) flip ? idx.push(c0, r * n + (j + 1) % n, r * n + j) : idx.push(c0, r * n + j, r * n + (j + 1) % n) };
    cap(0, !1), cap(nr - 1, !0);
    return { base: Float32Array.from(base), idx }
  }
  function plateGeo(x0, x1, y0, y1, z, nx, ny, wFn) {
    const base = [], idx = [];
    for (let i = 0; i <= nx; i++) for (let j = 0; j <= ny; j++) { const x = x0 + (x1 - x0) * i / nx, w = wFn ? wFn(x) : 1; base.push(x, (y0 + (y1 - y0) * j / ny) * w, z) }
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const a = i * (ny + 1) + j, b = a + ny + 1; idx.push(a, b, a + 1, a + 1, b, b + 1) }
    return { base: Float32Array.from(base), idx }
  }
  function boxGeo(cx, cy, cz, lx, ly, lz) {
    const g = new T.BoxGeometry(lx, ly, lz, 2, 2, 2).toNonIndexed(), p = g.attributes.position.array, base = [];
    for (let i = 0; i < p.length; i += 3) base.push(cx + p[i], cy + p[i + 1], cz + p[i + 2]);
    const idx = []; for (let i = 0; i < base.length / 3; i++) idx.push(i);
    return { base: Float32Array.from(base), idx }
  }
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
    try { if (T.EffectComposer) { comp = new T.EffectComposer(R); if (T.N8AOPass) { const ao = new T.N8AOPass(scene, cam, 400, 300), c = ao.configuration; c.gammaCorrection = !1, c.aoRadius = .06, c.distanceFalloff = .3, c.intensity = 1.1, c.color = new T.Color(0, 0, 0), ao.setQualityMode("Medium"), c.halfRes = !0, comp.addPass(ao) } else comp.addPass(new T.RenderPass(scene, cam)); comp.addPass(new T.OutputPass()), T.SMAAPass && comp.addPass(new T.SMAAPass(400, 300)) } } catch (e) { comp = null }
    const fit = () => { const r = h.getBoundingClientRect(), w = Math.max(1, r.width), hh = Math.max(1, r.height); R.setSize(w, hh, !1), comp && comp.setSize(w, hh), cam.aspect = w / hh, cam.updateProjectionMatrix() };
    new ResizeObserver(fit).observe(h), fit(), place();
    h.view = v => { Object.assign(st, { iso: { az: .8, el: .32, d: 7.2 }, side: { az: Math.PI / 2, el: .05, d: 7 }, top: { az: .001, el: 1.45, d: 7.5 }, front: { az: 0, el: .12, d: 6 } }[v] || {}), place() };
    return !0
  }
  /* mallas: forro deformable, alerones, ruedas, brazos y la forma sin deformar */
  function buildSkin() {
    if (parts3d) for (const o of parts3d.objs) scene.remove(o);
    if (carData) return buildCarSkin();
    const S = res.S, sp = S.sp.slice(0, 14).map(n => S.nodes[n]), objs = [], parts = [];
    const mk = (G, bind, mat, ghost) => {
      const n = G.base.length / 3, g = new T.BufferGeometry();
      g.setAttribute("position", new T.BufferAttribute(new Float32Array(n * 3), 3)), g.setAttribute("color", new T.BufferAttribute(new Float32Array(n * 3), 3)), g.setIndex(G.idx);
      const m = new T.Mesh(g, mat);
      /* atadura de cada vértice */
      const B = new Float32Array(n * 4);
      for (let v = 0; v < n; v++) {
        const x = G.base[v * 3], z = G.base[v * 3 + 2];
        let j = 0; for (; j < sp.length - 2 && x < sp[j + 1].x;) j++;
        const f = clamp((sp[j].x - x) / (sp[j].x - sp[j + 1].x), 0, 1), zs = sp[j].z + (sp[j + 1].z - sp[j].z) * f;
        B[v * 4] = j, B[v * 4 + 1] = f, B[v * 4 + 2] = zs, B[v * 4 + 3] = 0
      }
      parts.push({ m, g, G, bind, B }), objs.push(m);
      if (ghost) { const tmp = new T.BufferGeometry(); tmp.setAttribute("position", new T.BufferAttribute(Float32Array.from(G.base, (v, i) => i % 3 === 0 ? v - 1.8 : v), 3)), tmp.setIndex(G.idx); const e = new T.EdgesGeometry(tmp, 28), pa = e.attributes.position.array; for (let i = 0; i < pa.length; i += 3) { const y = pa[i + 1], z = pa[i + 2]; pa[i + 1] = z, pa[i + 2] = y } const l = new T.LineSegments(e, new T.LineBasicMaterial({ color: "#56616d", transparent: !0, opacity: .45 })); objs.push(l) }
      return m
    };
    const paint = () => new T.MeshPhysicalMaterial({ vertexColors: !0, metalness: .25, roughness: .32, clearcoat: 1, clearcoatRoughness: .08, side: T.DoubleSide });
    mk(ringGeo(BODY.map(([x, hw, zb, zt]) => [x, 0, hw, (zb + zt) / 2, (zt - zb) / 2]), 3, 28, .42), "spine", paint(), !0);
    for (const sd of [-1, 1]) mk(ringGeo(POD.map(([x, yi, yo, zb, zt]) => [x, sd * (yi + yo) / 2, (yo - yi) / 2, (zb + zt) / 2, (zt - zb) / 2]), 3, 20, .38), "spine", paint(), !0);
    /* fondo plano con su estrechamiento delante de las ruedas traseras */
    mk(plateGeo(3.3, -.05, -.82, .82, .035, 30, 12, x => x < .55 ? .62 : x > 2.9 ? .6 : 1), "spine", paint(), !1);
    /* halo y piloto */
    const halo = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3([[2.72, 0, .64], [2.5, 0, .78], [2.25, -.27, .79], [2.02, -.3, .74], [1.92, -.3, .68]].map(p => new T.Vector3(...p)).concat([[1.92, .3, .68], [2.02, .3, .74], [2.25, .27, .79], [2.5, 0, .78]].map(p => new T.Vector3(...p)))), 60, .022, 8, !0), new T.MeshStandardMaterial({ color: "#2a2e33", metalness: .8, roughness: .35 }));
    mk({ base: Float32Array.from(halo.geometry.attributes.position.array), idx: halo.geometry.index ? Array.from(halo.geometry.index.array) : [...Array(halo.geometry.attributes.position.count).keys()] }, "spine", paint(), !1);
    const helmet = new T.SphereGeometry(.12, 20, 14), hb = helmet.attributes.position.array, hbase = [];
    for (let i = 0; i < hb.length; i += 3) hbase.push(2.1 + hb[i], hb[i + 2], .76 + hb[i + 1]);
    mk({ base: Float32Array.from(hbase), idx: Array.from(helmet.index.array) }, "spine", new T.MeshStandardMaterial({ color: "#f2c21b", metalness: .1, roughness: .3 }), !1).userData.solid = 1;
    /* alerones con sus planos, flap y placas */
    mk(plateGeo(5.0, 4.62, -.86, .86, .1, 4, 24), "fw", paint(), !0), mk(plateGeo(4.66, 4.44, -.86, .86, .18, 3, 24), "fw", paint(), !1);
    for (const sd of [-1, 1]) mk(boxGeo(4.78, sd * .87, .16, .46, .01, .17), "fw", paint(), !1);
    mk(plateGeo(-.48, -.8, -.5, .5, .9, 4, 20), "rw", paint(), !0), mk(plateGeo(-.62, -.84, -.5, .5, 1.03, 3, 20), "rw", paint(), !1), mk(plateGeo(-.3, -.5, -.42, .42, .46, 3, 14), "spine", paint(), !1);
    for (const sd of [-1, 1]) mk(boxGeo(-.66, sd * .51, .82, .5, .012, .56), "rw", paint(), !1);
    const wheels = S.wheels.map(w => { const g = new T.Group(), ty = new T.Mesh(new T.TorusGeometry(.26, .1, 16, 40).scale(1, 1, 2.2), new T.MeshStandardMaterial({ color: "#151618", roughness: .85 })), rim = new T.Mesh(new T.CylinderGeometry(.2, .2, .36, 28, 1, !0).rotateX(Math.PI / 2), new T.MeshStandardMaterial({ color: "#3a3f45", metalness: .85, roughness: .3, side: T.DoubleSide })); g.add(ty, rim), objs.push(g); return { w, m: g } });
    const armMat = new T.MeshStandardMaterial({ color: "#8e959c", metalness: .9, roughness: .3 }), arms = S.wheels.flatMap(() => [new T.Mesh(new T.CylinderGeometry(.014, .014, 1, 8), armMat), new T.Mesh(new T.CylinderGeometry(.014, .014, 1, 8), armMat), new T.Mesh(new T.CylinderGeometry(.011, .011, 1, 8), armMat)]);
    const pylon = new T.Mesh(new T.CylinderGeometry(.03, .03, 1, 10), new T.MeshStandardMaterial({ color: "#2b3036", metalness: .3, roughness: .35 }));
    objs.push(...arms, pylon);
    for (const o of objs) scene.add(o);
    parts3d = { parts, wheels, arms, pylon, objs };
    deform(null, 0)
  }

  /* el modelo 3D del simulador atado a la estructura: cada vértice de carrocería a la columna (con el giro de su
     sección: las secciones giran como sólidos, no se estiran), los alerones a sus voladizos, las ruedas a su nudo y los
     brazos de suspensión repartidos entre la carrocería y la rueda según lo lejos que estén del eje del coche */
  function buildCarSkin() {
    const S = res.S, car = LAB.car, sp = S.sp.slice(0, 14).map(n => S.nodes[n]), objs = [], parts = [];
    const xF = S.nodes[S.sp[3]].x, xR = S.nodes[S.sp[12]].x, wheelOf = (front, side) => S.wheels.findIndex(w => w.front === front && w.side === side);
    const SOLID = /tyre|rim|disc|gold|visor|mirror|hot|white|stripe|satin/;
    for (const m of carData.meshes) {
      const grp = carData.groups[m.g] || { t: [0, 0, 0] }, src = m.geo.attributes.position.array, n = src.length / 3, base = new Float32Array(n * 3);
      for (let v = 0; v < n; v++) {
        const X = (src[v * 3] + grp.t[0]) * car.mx, Y = src[v * 3 + 1] + grp.t[1], Z = (src[v * 3 + 2] + grp.t[2]) * car.mz;
        base[v * 3] = X + car.wb / 2, base[v * 3 + 1] = Z, base[v * 3 + 2] = Y
      }
      const cls = new Uint8Array(n), wi = new Int8Array(n).fill(-1), ww = new Float32Array(n), isW = /^(spin|steer)_/.test(m.g);
      for (let v = 0; v < n; v++) {
        const x = base[v * 3], y = base[v * 3 + 1], z = base[v * 3 + 2];
        if (isW) { cls[v] = 3, wi[v] = wheelOf(grp.t[0] > 0, grp.t[2] > 0 ? 1 : -1), ww[v] = 1; continue }
        /* alerón delantero: planos y placas laterales (el morro y sus pilares siguen a la columna) */
        if (/^fwflap_/.test(m.g) || ((m.g === "static" || m.g === "nose") && x > xF + .5 && z < .24 && Math.abs(y) > .16)) { cls[v] = 1; continue }
        if (m.g === "rwflap" || (m.g === "static" && x < xR - .45 && z > .5)) { cls[v] = 2; continue }
        cls[v] = 0;
        /* brazos de suspensión y carenados de las manguetas: hacia la rueda */
        const ay = Math.abs(y), front = Math.abs(x - xF) < Math.abs(x - xR), ax = front ? xF : xR, half = (front ? res.p.trf : res.p.trr) / 2;
        if (ay > .44 && Math.abs(x - ax) < .62) { wi[v] = wheelOf(front, y > 0 ? 1 : -1), ww[v] = clamp((ay - .44) / Math.max(.05, half - .2 - .44), 0, 1) }
      }
      const solid = SOLID.test(m.m || "") || m.g === "helmet";
      const mat = solid ? new T.MeshStandardMaterial({ color: new T.Color(...m.col).multiplyScalar(/tyre/.test(m.m) ? .45 : 1), metalness: m.met, roughness: Math.max(.25, m.rou), side: T.DoubleSide, vertexColors: !0 }) : new T.MeshPhysicalMaterial({ vertexColors: !0, metalness: .2, roughness: .35, clearcoat: .8, clearcoatRoughness: .1, side: T.DoubleSide });
      const pt = mkCar({ base, idx: m.geo.index.array }, sp, mat, cls, wi, ww, solid);
      /* normales del modelo original: los giros dibujados son de pocos grados y recalcularlas estropea las caras degeneradas */
      pt.g.setAttribute("normal", m.geo.attributes.normal), pt.keepN = 1;
      parts.push(pt), objs.push(pt.m);
      /* forma sin deformar: aristas de la carrocería */
      if (/paint/.test(m.m || "")) { const tmp = new T.BufferGeometry(); tmp.setAttribute("position", new T.BufferAttribute(Float32Array.from(base, (val, i) => i % 3 === 0 ? val - car.wb / 2 : val), 3)), tmp.setIndex(new T.BufferAttribute(m.geo.index.array, 1)); const e = new T.EdgesGeometry(tmp, 35), pa = e.attributes.position.array; for (let i = 0; i < pa.length; i += 3) { const y = pa[i + 1], z = pa[i + 2]; pa[i + 1] = z, pa[i + 2] = y } objs.push(new T.LineSegments(e, new T.LineBasicMaterial({ color: "#56616d", transparent: !0, opacity: .35 }))) }
    }
    for (const o of objs) scene.add(o);
    parts3d = { parts, wheels: [], arms: [], pylon: null, objs, car: !0 };
    deform(null, 0)
  }
  function mkCar(G, sp, mat, cls, wi, ww, solid) {
    const n = G.base.length / 3, g = new T.BufferGeometry();
    g.setAttribute("position", new T.BufferAttribute(new Float32Array(n * 3), 3)), g.setAttribute("color", new T.BufferAttribute(new Float32Array(n * 3).fill(1), 3)), g.setIndex(new T.BufferAttribute(G.idx, 1));
    const m = new T.Mesh(g, mat), B = new Float32Array(n * 4);
    for (let v = 0; v < n; v++) {
      const x = G.base[v * 3];
      let j = 0; for (; j < sp.length - 2 && x < sp[j + 1].x;) j++;
      const f = clamp((sp[j].x - x) / (sp[j].x - sp[j + 1].x), 0, 1);
      B[v * 4] = j, B[v * 4 + 1] = f, B[v * 4 + 2] = sp[j].z + (sp[j + 1].z - sp[j].z) * f
    }
    solid && (m.userData.solid = 1);
    return { m, g, G, bind: "car", B, cls, wi, ww }
  }
  /* desplazamiento y giro de un nudo (en metros y radianes) escalados */
  function nodeU(u, n, sc) {
    const nd = res.S.nodes[n], g = k => k < nd.dof && u ? u[nd.d0 + k] * sc : 0;
    return [g(0), g(1), g(2), g(3), g(4), g(5)]
  }
  function deform(u, sc) {
    const S = res.S, P3 = parts3d, nsp = 14, U = [], E = [];
    for (let j = 0; j < nsp; j++) U.push(nodeU(u, S.sp[j], sc));
    let Umax = 1e-30;
    for (const e of S.els) e.U > Umax && (Umax = e.U);
    /* energía por tramo de la columna (con la de las uniones) para colorear la carrocería */
    for (let j = 0; j < nsp - 1; j++) { const el = S.els.find(e => e.a === S.sp[j] && e.b === S.sp[j + 1]); E.push(el && u ? Math.sqrt(el.U / Umax) : 0) }
    const wingU = (center, tips) => ({ uc: nodeU(u, center, sc), ut: tips.map(t => nodeU(u, t, sc)), C: S.nodes[center], Tn: tips.map(t => S.nodes[t]), heat: u ? Math.sqrt(Math.max(...S.els.filter(e => e.grp === (center === S.sp[0] ? "fw" : "rw")).map(e => e.U)) / Umax) : 0 });
    const FW = wingU(S.sp[0], S.fwT), RW = wingU(S.sp[14], S.rwT);
    const WU = S.wheels.map(w => nodeU(u, w.n, sc)), x0 = LAB.car.wb / 2;
    for (const pt of P3.parts) {
      const { G, B, g } = pt, pos = g.attributes.position.array, col = g.attributes.color.array, n = G.base.length / 3, solid = pt.m.userData.solid;
      for (let v = 0; v < n; v++) {
        const x = G.base[v * 3], y = G.base[v * 3 + 1], z = G.base[v * 3 + 2];
        let dx, dy, dz, heat;
        const c = pt.cls ? pt.cls[v] : -1;
        if (c === 3) { const q = WU[pt.wi[v]]; dx = q[0], dy = q[1], dz = q[2], heat = 0 }
        else if (pt.bind === "spine" || c === 0 || c === 1 || c === 2) {
          const j = B[v * 4], f = B[v * 4 + 1], zs = B[v * 4 + 2], A = S.nodes[S.sp[j]], Bn = S.nodes[S.sp[j + 1]], L = Math.hypot(Bn.x - A.x, Bn.z - A.z), ua = U[j], ub = U[j + 1];
          const h1 = 1 - 3 * f * f + 2 * f ** 3, h2 = f - 2 * f * f + f ** 3, h3 = 3 * f * f - 2 * f ** 3, h4 = -f * f + f ** 3, rx = ua[3] + (ub[3] - ua[3]) * f, oz = z - zs;
          dx = ua[0] + (ub[0] - ua[0]) * f, dy = h1 * ua[1] + h2 * L * ua[5] + h3 * ub[1] + h4 * L * ub[5] + (y * Math.cos(rx) - oz * Math.sin(rx) - y), dz = h1 * ua[2] - h2 * L * ua[4] + h3 * ub[2] - h4 * L * ub[4] + (y * Math.sin(rx) + oz * Math.cos(rx) - oz);
          heat = E[j] + (E[Math.min(E.length - 1, j + 1)] - E[j]) * f * .5;
          if (c === 0 && pt.wi[v] >= 0) { const q = WU[pt.wi[v]], a = pt.ww[v]; dx += (q[0] - dx) * a, dy += (q[1] - dy) * a, dz += (q[2] - dz) * a }
          /* alerones: se mueven con su sección (sin desgarros con el morro) y además flexan hacia las puntas lo que dé el
             modelo más allá del giro rígido */
          if (c === 1 || c === 2) { const W = c === 1 ? FW : RW, sd = y < 0 ? 0 : 1, Tn = W.Tn[sd], a = clamp(Math.abs(y - W.C.y) / Math.abs(Tn.y - W.C.y), 0, 1.05), sh = 3 * a * a - 2 * a ** 3, uu = W.ut[sd], flex = uu[2] - (W.uc[2] + W.uc[3] * (Tn.y - W.C.y) - W.uc[4] * (Tn.x - W.C.x)); dz += flex * sh, heat = (heat || 0) * (1 - a) + (W.heat || 0) * a }
        } else {
          const W = (pt.bind === "fw" || c === 1) ? FW : RW, side = y < 0 ? 0 : 1, a = clamp(Math.abs(y - W.C.y) / Math.abs(W.Tn[side].y - W.C.y), 0, 1.05), sh = 3 * a * a - 2 * a ** 3, uu = W.ut[side];
          dx = W.uc[0] + (uu[0] - W.uc[0]) * a, dy = W.uc[1], dz = W.uc[2] + (uu[2] - W.uc[2]) * sh + W.uc[3] * (y - W.C.y) - (x - W.C.x) * (W.uc[4] + (uu[4] - W.uc[4]) * a), heat = W.heat
        }
        const i3 = v * 3;
        heat >= 0 || (heat = 0);
        pos[i3] = x + dx - x0, pos[i3 + 1] = z + dz, pos[i3 + 2] = y + dy;
        if (solid) col[i3] = col[i3 + 1] = col[i3 + 2] = 1;
        else { const c = heatCol(heat); col[i3] = c.r, col[i3 + 1] = c.g, col[i3 + 2] = c.b }
      }
      g.attributes.position.needsUpdate = !0, g.attributes.color.needsUpdate = !0, pt.keepN ? g.computeBoundingSphere() : g.computeVertexNormals()
    }
    if (P3.car) return;
    const Pn = n => { const nd = S.nodes[n], q = nodeU(u, n, sc); return X3(nd.x + q[0], nd.y + q[1], nd.z + q[2]) };
    const place = (m, a, b) => { const d = b.clone().sub(a), L = d.length(); m.position.copy(a).addScaledVector(d, .5), m.scale.set(1, L, 1), m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()) };
    place(P3.pylon, Pn(S.sp[13]), Pn(S.sp[14]).add(new T.Vector3(0, -.05, 0)));
    S.wheels.forEach((w, i) => {
      const c = Pn(w.front ? S.sp[3] : S.sp[12]), wp = Pn(w.n), up = new T.Vector3(0, .12, 0), dn = new T.Vector3(0, -.06, 0);
      P3.wheels[i].m.position.copy(wp), place(P3.arms[i * 3], c.clone().add(up).add(new T.Vector3(.12, 0, 0)), wp.clone().add(up)), place(P3.arms[i * 3 + 1], c.clone().add(dn).add(new T.Vector3(-.15, 0, 0)), wp.clone().add(dn)), place(P3.arms[i * 3 + 2], wp.clone().add(new T.Vector3(0, -.08, 0)), c.clone().add(new T.Vector3(0, .26, 0)))
    })
  }
  const heatCol = t => { t = clamp(t, 0, 1); const s = [[.46, .53, .62], [.24, .55, 1], [.18, .82, .42], [1, .82, .25], [1, .42, .1], [1, .23, .23]], x = t * (s.length - 1), i = Math.min(s.length - 2, x | 0), f = x - i; return { r: s[i][0] + (s[i + 1][0] - s[i][0]) * f, g: s[i][1] + (s[i + 1][1] - s[i][1]) * f, b: s[i][2] + (s[i + 1][2] - s[i][2]) * f } };
  /* ---------- cálculo ---------- */
  function compute() {
    const p = { ...prm.v, nModes: 30, wb: LAB.car.wb };
    res = CM().run(p), res.p = p;
    const M = res.modes, find = re => M.find(m => re.test(m.name)), tors = find(/^Torsión/), bv = find(/^Flexión vertical/), bl = find(/^Flexión lateral/), fw = find(/^Alerón delantero/), rw = find(/^Alerón trasero/), hopF = find(/delantero (en fase|en oposición)/), hopR = find(/trasero (en fase|en oposición)/), heave = find(/^Bote/), pitch = find(/^Cabeceo/), roll = find(/^Balanceo/);
    const kRoll = (p.kwf * 1e3 * p.trf ** 2 / 2 + p.kwr * 1e3 * p.trr ** 2 / 2) * DEG, ratio = res.tor.k / kRoll;
    res.kRoll = kRoll, res.ratio = ratio;
    ro.set("ktor", res.tor.k / 1e3, 1, res.tor.k < 2e4 ? "bad" : res.tor.k < 3e4 ? "warn" : "ok"), ro.set("kben", res.ben.k / 1e6, 1), ro.set("mass", res.mass, 0), ro.set("wf", res.xcg / LAB.car.wb * 100, 1);
    ro.set("ratio", ratio, 1, ratio < 2.5 ? "bad" : ratio < 3.2 ? "warn" : "ok"), ro.set("fh", heave ? heave.f : NaN, 1), ro.set("fp", pitch ? pitch.f : NaN, 1), ro.set("fr", roll ? roll.f : NaN, 1);
    ro.set("fhf", hopF ? hopF.f : NaN, 1), ro.set("fhr", hopR ? hopR.f : NaN, 1), ro.set("ft", tors ? tors.f : NaN, 0), ro.set("fbv", bv ? bv.f : NaN, 0), ro.set("fbl", bl ? bl.f : NaN, 0), ro.set("ffw", fw ? fw.f : NaN, 1), ro.set("frw", rw ? rw.f : NaN, 1);
    const fk = p.speed / 3.6 / p.kerb;
    let pk = 0, pf = 0; for (let i = 0; i < res.frf.f.length; i++) res.frf.H[i] > pk && (pk = res.frf.H[i], pf = res.frf.f[i]);
    ro.set("fk", fk, 1), ro.set("frfpk", pk, 2), ro.set("frff", pf, 1);
    res.fk = fk;
    modeList(), drawPlots(), twistTable(), verdict();
    parts3d && buildSkin()
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
    if (!res || !parts3d || host.hidden) return;
    const t = (now - t0) / 1e3;
    let u, sc, info;
    /* amplificación: la necesaria para que el giro entre ejes se vea (~2,5°) sin romper la forma; se indica el factor real */
    if (view === "tors") { const k = clamp(2.5 * DEG / Math.max(1e-6, res.tor.ang), 1, 500); u = res.tor.u, sc = k * amp * (.55 + .45 * Math.sin(t * 2.4)), info = `<b>Banco de torsión</b>: ruedas traseras fijas, ${(res.tor.T / 1e3).toFixed(1)} kN·m en las delanteras → ${(res.tor.ang / DEG).toFixed(3)}° entre ejes · ${(res.tor.k / 1e3).toFixed(1)} kN·m/° · deformación dibujada ×${Math.round(k * amp)}` }
    else if (view === "bend") { let mz = 1e-9; for (const n of res.S.sp) { const nd = res.S.nodes[n]; mz = Math.max(mz, Math.abs(res.ben.u[nd.d0 + 2])) } const k = clamp(.025 / mz, 1, 2000); u = res.ben.u, sc = k * amp * (.55 + .45 * Math.sin(t * 2.4)), info = `<b>Flexión</b>: apoyado en los ejes, 10 kN en el habitáculo · ${(res.ben.k / 1e6).toFixed(1)} kN/mm · flecha máxima ${(mz * 1e3).toFixed(2)} mm · dibujada ×${Math.round(k * amp)}` }
    else {
      const m = res.modes[sel];
      /* normaliza para que el mayor desplazamiento sea ~12 cm en pantalla */
      let mx = 1e-9; for (const nd of res.S.nodes) for (let k = 0; k < 3; k++) mx = Math.max(mx, Math.abs(m.phi[nd.d0 + k]));
      u = m.phi, sc = .05 / mx * amp * Math.sin(t * TAU * .9);
      info = `<b>Modo ${sel + 1}: ${m.name}</b> · ${m.f.toFixed(1)} Hz · animación ralentizada · color = energía de deformación · gris: forma sin deformar`
    }
    if (u !== loop.u) { for (const e of res.S.els) e.U = 0; if (view === "mode") CM().modes && classifyU(res.modes[sel]); else energyOf(u); loop.u = u }
    deform(u, sc);
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
      e.U = s / 2 / Math.max(.05, e.L), isFinite(e.U) || (e.U = 0)
    }
  }
  function classifyU(m) { energyOf(m.phi) }
  function init(el0) {
    host = el0;
    host.innerHTML = `
    <div class="labhead"><div><h2>Chasis y vibraciones</h2><p class="sub">El coche del simulador (${LAB.car.name.toLowerCase()}, batalla ${LAB.car.wb.toFixed(2)} m) como estructura de vigas: monocasco de carbono, motor y caja portantes, alerones, suspensión y neumáticos. Modos propios, banco de torsión y respuesta a los bordillos.</p></div>
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
  return { init, _dbg: () => ({ parts3d, res, cam, scene, R }) }
})();
