/* ===================== EL MISMO COCHE QUE EN EL SIMULADOR =====================
   Carga el modelo 3D del coche del simulador (t/car_hi.*.bin) y el reglamento elegido allí (2025 o 2026) para que el
   Laboratorio trabaje sobre el mismo coche: mismas cotas (batalla, vías, radio de rueda), misma masa y el mismo modelo
   escalado como lo dibuja el simulador (la batalla del modelo se lleva a la del reglamento). */
LAB.car = (() => {
  let reg = "2025";
  try { reg = JSON.parse(localStorage.getItem("pn3-regs") || '"2025"') === "2026" ? "2026" : "2025" } catch { }
  /* mismas cifras que la tabla de reglamentos del simulador */
  const R = {
    "2025": { reg: "2025", wb: 3.6, a: 1.98, b: 1.62, tf: 1.6, trr: 1.55, mass: 798, R: .36, rhF: 32, rhR: 52, name: "Reglamento 2025 (efecto suelo, MGU-H)" },
    "2026": { reg: "2026", wb: 3.4, a: 1.87, b: 1.53, tf: 1.55, trr: 1.5, mass: 768, R: .36, rhF: 32, rhR: 52, name: "Reglamento 2026 (aero activa, 350 kW eléctricos)" }
  }[reg];
  /* el modelo es un coche de 2026 (3,4 m de batalla, 1,88 m de ancho): el simulador lo lleva a 1,90 m, o a 3,6 m y 2,00 m con el reglamento de 2025 */
  R.mx = R.wb / 3.4, R.mz = reg === "2026" ? 1.01 : 1.0627, R.wdist = R.b / R.wb;
  return R
})();
LAB.carmesh = (() => {
  let P = null;
  function parse(buf) {
    const dv = new DataView(buf), hl = dv.getUint32(0, !0), hdr = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl))), base = 4 + hl, T = window.THREE, out = [];
    for (const e of hdr.meshes) {
      const n = e.n, qp = new Uint16Array(buf, base + e.p, n * 3), pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) pos[i * 3 + k] = e.mn[k] + qp[i * 3 + k] / 65535 * (e.mx[k] - e.mn[k]);
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.BufferAttribute(pos, 3)), g.setAttribute("normal", new T.BufferAttribute(new Int8Array(buf.slice(base + e.nn, base + e.nn + n * 3)), 3, !0));
      g.setIndex(new T.BufferAttribute(e.i32 ? new Uint32Array(buf.slice(base + e.i, base + e.i + e.ic * 4)) : new Uint16Array(buf.slice(base + e.i, base + e.i + e.ic * 2)), 1));
      /* como el simulador: fuera los triángulos marcados como ocultos (etiqueta 4) */
      if (e.c != null) { const tg = new Uint8Array(buf, base + e.c, n), I = g.index.array, keep = []; for (let q = 0; q < I.length; q += 3) tg[I[q]] === 4 && tg[I[q + 1]] === 4 && tg[I[q + 2]] === 4 || keep.push(I[q], I[q + 1], I[q + 2]); keep.length < I.length && g.setIndex(new T.BufferAttribute(I.BYTES_PER_ELEMENT === 4 ? new Uint32Array(keep) : new Uint16Array(keep), 1)) }
      out.push({ g: e.g, m: e.m, geo: g, tags: e.c != null ? new Uint8Array(buf.slice(base + e.c, base + e.c + n)) : null, col: e.col || [.5, .5, .5], met: e.met ?? 0, rou: e.rou ?? .5 })
    }
    return { meshes: out, groups: hdr.groups, rig: hdr.rig }
  }
  function load() {
    if (P) return P;
    const src = window.TEXIMG && window.TEXIMG.car_hi;
    return P = !src || !window.fetch ? Promise.resolve(null) : fetch(src).then(r => r.ok ? r.arrayBuffer() : null).then(b => b ? parse(b) : null).catch(() => null)
  }
  /* librea neutra del Laboratorio (sin marcas): gris grafito, carbono y acentos naranja */
  const PAL = ["#5d646d", "#121316", "#ff6b1a", "#e9ecef", "#050506"];
  function material(T, m, ghost) {
    const name = m.m || "", c = new T.Color(m.col[0], m.col[1], m.col[2]);
    const o = { color: c, metalness: m.met, roughness: m.rou, side: T.DoubleSide };
    if (/paint/.test(name)) Object.assign(o, { vertexColors: !0, color: new T.Color(1, 1, 1), roughness: .32, metalness: .15 });
    if (/carbon/.test(name)) Object.assign(o, { color: new T.Color("#202326"), roughness: .38, metalness: .25 });
    if (/tyre/.test(name)) Object.assign(o, { color: new T.Color("#1d1e20"), roughness: .9 });
    ghost && Object.assign(o, { transparent: !0, opacity: ghost, depthWrite: !1 });
    return new T.MeshStandardMaterial(o)
  }
  function colorize(T, m) {
    if (!m.tags) return m.geo;
    const n = m.tags.length, c = new Float32Array(n * 3), P2 = PAL.map(h => new T.Color(h));
    for (let i = 0; i < n; i++) { const q = P2[m.tags[i]] || P2[0]; c[i * 3] = q.r, c[i * 3 + 1] = q.g, c[i * 3 + 2] = q.b }
    m.geo.setAttribute("color", new T.BufferAttribute(c, 3));
    return m.geo
  }
  /* coche completo como en el simulador; filter(m) decide qué piezas se incluyen; xoff desplaza el eje delantero */
  function build(T, data, o = {}) {
    const root = new T.Group(), car = LAB.car, S = new T.Group();
    S.scale.set(car.mx, 1, car.mz), root.add(S);
    for (const m of data.meshes) {
      if (o.filter && !o.filter(m)) continue;
      const g = data.groups[m.g] || { t: [0, 0, 0] }, geo = colorize(T, m), mesh = new T.Mesh(geo, material(T, m, o.ghost));
      mesh.position.set(g.t[0], g.t[1], g.t[2]), mesh.userData.src = m, S.add(mesh)
    }
    return root
  }
  return { load, build, parse, PAL, material, colorize }
})();
