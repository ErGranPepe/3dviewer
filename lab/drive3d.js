/* ===================== TRANSMISIÓN Y ERS EN 3D =====================
   Caja longitudinal de 8 marchas dentro de su carcasa de carbono, seccionada por el plano de los ejes (las caras de corte, en
   rojo): campana con el embrague multidisco (campana ranurada, discos, muelle de diafragma, cojinete de empuje y cilindro
   hidráulico), eje primario con los piñones y secundario con las ruedas locas y cuatro anillos de garras, los dos apoyados en
   rodamientos de bolas alojados en tabiques; horquillas sobre su barra guía con el seguidor metido en la pista del tambor de
   selección (el recorrido de la pista es el de la horquilla), actuador hidráulico; piñón cónico y corona con dientes que van al
   vértice común, diferencial con paquete de discos y pistón, palieres con junta trípode y fuelle que se retuercen con el par
   (exagerado), y ruedas. Las vueltas se reparten por número de dientes: cada pareja engrana exactamente.
   Delante, atornillado a la campana, el motor completo de la pestaña Motor con su MGU-K y, hasta 2025, el MGU-H; la batería (ES)
   y la electrónica de control (CE), con la energía circulando por los cables de alta tensión. */
LAB.drive3d = (() => {
  let T, R, scene, cam, host, comp = null, st, P = {}, parts = null, labelsEl, clock = 0, DC = null;
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
  /* rueda dentada recta con perfil de evolvente aproximado; eje de giro = X. El diente k tiene su centro en el ángulo k·2π/z.
     Las ruedas grandes van aligeradas: llanta dentada, velo fino y cubo */
  function gearGeo(z, m, face, bore) {
    const r = m * z / 2, ra = r + m, rf = r - 1.25 * m, h = Math.PI / (2 * z), sh = new T.Shape(), web = rf - bore > .02, rw = web ? rf - Math.max(.0045, 1.5 * m) : bore, rh = bore + .0075;
    for (let k = 0; k < z; k++) {
      const c = k / z * TAU, pts = [[rf, c - 1.45 * h], [r * .985, c - 1.04 * h], [r, c - h], [(r + ra) / 2, c - .8 * h], [ra, c - .52 * h], [ra, c + .52 * h], [(r + ra) / 2, c + .8 * h], [r, c + h], [r * .985, c + 1.04 * h], [rf, c + 1.45 * h]];
      pts.forEach(([rr, a], i) => k === 0 && i === 0 ? sh.moveTo(rr * Math.cos(a), rr * Math.sin(a)) : sh.lineTo(rr * Math.cos(a), rr * Math.sin(a)));
      const a1 = c + 1.45 * h, a2 = c + TAU / z - 1.45 * h;
      for (let q = 1; q <= 2; q++) { const a = a1 + (a2 - a1) * q / 3; sh.lineTo(rf * Math.cos(a), rf * Math.sin(a)) }
    }
    const hole = new T.Path();
    hole.absarc(0, 0, rw, 0, TAU, !0), sh.holes.push(hole);
    const g = new T.ExtrudeGeometry(sh, { depth: face, bevelEnabled: !0, bevelThickness: .0008, bevelSize: .0006, bevelSegments: 1, curveSegments: 6 });
    g.translate(0, 0, -face / 2), g.rotateY(Math.PI / 2);
    if (!web) return g;
    const f2 = face / 2 + .0008, wt = face * .22, X = DC.latheX;
    return mergeG([g, X([[bore, -f2], [rh, -f2], [rh, f2], [bore, f2], [bore, -f2]], 40), X([[rh, -wt], [rw + .0005, -wt], [rw + .0005, wt], [rh, wt]], 40)])
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
      gear: Ph({ color: "#c9cdd2", metalness: 1, roughness: .26, clearcoat: .3 }), bev: Ph({ color: "#c9cdd2", metalness: 1, roughness: .28, side: T.DoubleSide }),
      shaft: S({ color: "#aeb4bb", metalness: 1, roughness: .2 }), dark: S({ color: "#454b53", metalness: .75, roughness: .4 }), ti: Ph({ color: "#9a958f", metalness: .8, roughness: .4, side: T.DoubleSide }),
      fork: S({ color: "#b8a77a", metalness: .9, roughness: .3, side: T.DoubleSide }), barrel: S({ color: "#a3a9b0", metalness: .9, roughness: .34 }), track: S({ color: "#14171a", metalness: .2, roughness: .7 }),
      brg: S({ color: "#d3d7dc", metalness: 1, roughness: .16 }),
      /* carcasa de carbono y tabiques de titanio: se seccionan con el plano de los ejes; las caras de corte, en rojo */
      caseS: Ph({ color: "#2f353c", metalness: .3, roughness: .5, clearcoat: .5, clearcoatRoughness: .3 }), bulk: S({ color: "#8a8d92", metalness: .95, roughness: .42 }), cap: new T.MeshBasicMaterial({ color: "#a32b26", side: T.BackSide }),
      carbon: Ph({ color: "#1f2328", metalness: .25, roughness: .35, clearcoat: 1, clearcoatRoughness: .1, side: T.DoubleSide }), plate: S({ color: "#2a2724", metalness: .3, roughness: .6 }), plateS: S({ color: "#9aa0a6", metalness: 1, roughness: .3 }),
      spring: S({ color: "#3a3f46", metalness: .85, roughness: .35 }), alu: S({ color: "#a9afb6", metalness: .9, roughness: .4 }),
      boot: S({ color: "#111214", roughness: .8, side: T.DoubleSide }), rubber: S({ color: "#141517", roughness: .88 }), rim: S({ color: "#2e3237", metalness: .85, roughness: .32, side: T.DoubleSide }), cover: Ph({ color: "#1b1e22", metalness: .3, roughness: .4, clearcoat: .8, side: T.DoubleSide }),
      motor: S({ color: "#2a3036", metalness: .7, roughness: .32 }),
      es: Ph({ color: "#1d2126", metalness: .3, roughness: .4, clearcoat: .8 }), hv: S({ color: "#ff7a1a", roughness: .45, metalness: .1 }), glass: Ph({ color: "#0c1014", metalness: 0, roughness: .1, transparent: !0, opacity: .35, depthWrite: !1 }),
      cell: S({ color: "#2fd16c", emissive: "#2fd16c", emissiveIntensity: .6, roughness: .5 }), ground: S({ color: "#14191f", roughness: .95 })
    }
  }
  let M, camSet = null, clipZ = null, eng = null, caseMode = "cut", engMode = "bare", showNames = !1;
  /* fase para que dos ruedas engranen: en la línea de centros, diente frente a hueco. A: {y, z, n (dientes), ph}; ángulos de +Y hacia +Z */
  const frac = x => x - Math.floor(x);
  const meshPh = (A, B) => { const f = frac((Math.atan2(B.z - A.z, B.y - A.y) + Math.PI / 2 - A.ph) / (TAU / A.n)); return Math.atan2(A.z - B.z, A.y - B.y) + Math.PI / 2 - (.5 - f) * (TAU / B.n) };
  /* ---------- montaje ---------- */
  function build() {
    const g = { gears: [], dogs: [], forks: [], flows: [], pos: {}, caseParts: [], caps: [] }, q = P.geo, K = LAB.kit, V = DC.V, X = DC.latheX, Z = DC.latheZ;
    const add = (geo, mat, parent) => { const m = new T.Mesh(geo, mat); m.castShadow = m.receiveShadow = !0, (parent || scene).add(m); return m };
    /* pieza de la carcasa: se recorta con el plano de los ejes y lleva su cara de corte en rojo */
    const cased = (geo, mat) => { const m = add(geo, mat), c = new T.Mesh(geo, M.cap); scene.add(c), g.caseParts.push(m), g.caps.push(c); return m };
    /* posiciones axiales: grupos (1,2) (3,4) (5,6) (7,8) con anillo de garras entre cada par */
    const face = q.face, mod = q.module, dogW = .014, gap = .003, zs = q.z1[0] + q.z2[0], a = mod * zs / 2, yIn = a / 2, yOut = -a / 2;
    C.yIn = yIn, C.yOut = yOut, C.yc = yOut;
    let x = C.x0;
    g.xs = [], g.xd = [];
    for (let k = 0; k < 4; k++) { g.xs.push(x - face / 2), x -= face + gap, g.xd.push(x - dogW / 2), x -= dogW + gap, g.xs.push(x - face / 2), x -= face + .008 }
    g.xEnd = x;
    const xEnd = x, xc = C.xc = xEnd - .135, yc = yOut, rOut = Math.max(...q.z2) * mod / 2 + mod, xF = .195, xFB = C.x0 + .034, xRB = xEnd - .014, wall = .007;
    const zB = Math.max(.1, rOut + .03), yB = yOut, yR = yB + .042, zR = zB;
    /* ---- carcasa: campana del embrague, cuello (encima va la turbina), cuerpo con los engranajes, bulto del diferencial y cola ---- */
    const rInM = Math.max(...q.z1) * mod / 2 + mod, yTop = yIn + rInM + .012 + wall, yBot = yOut - rOut - .012 - wall, ra = (yTop - yBot) / 2, cym = (yTop + yBot) / 2, zmax = zB + .04, zmin = -(rOut + .014), zcm = (zmax + zmin) / 2, rbm = (zmax - zmin) / 2 + wall, rbd = .137, rad = .11 + .014 + wall + .012;
    const keys = [[xF, .088, .088, yIn, 0], [.105, .088, .088, yIn, 0], [.088, .064, .068, .014, 0], [0, .064, .068, .014, 0], [-.022, ra, rbm, cym, zcm], [xEnd - .03, ra, rbm, cym, zcm], [xc + .075, rad, rbd, yc + .01, 0], [xc - .08, rad, rbd, yc + .01, 0], [xc - .16, .07, .06, yc + .02, 0], [xc - .2, .05, .045, yc + .02, 0]];
    const sec = xx => { for (let i = 0; i < keys.length - 1; i++) { const k0 = keys[i], k1 = keys[i + 1]; if (xx <= k0[0] && xx >= k1[0]) { const u = (k0[0] - xx) / Math.max(1e-6, k0[0] - k1[0]), w = u * u * (3 - 2 * u); return [1, 2, 3, 4].map(j => k0[j] + (k1[j] - k0[j]) * w) } } return keys[keys.length - 1].slice(1) };
    {
      const n = 150, Pp = [], Ss = [];
      for (let i = 0; i <= n; i++) { const xx = xF + (xc - .2 - xF) * i / n, s = sec(xx); Pp.push(V(xx, s[2], s[3])), Ss.push([s[0], s[1]]) }
      cased(K.sweep(Pp, t => Ss[Math.min(n, Math.round(t * n))], { sides: 60, n0: V(0, 1, 0), pow: .74, wall, cap1: !0, rim0: !0 }), M.caseS);
      /* tabiques con los alojamientos de los rodamientos, el tambor y la barra de las horquillas */
      const bh = (xx, holes) => { const s = sec(xx), pts = [], N = 64, f = v => Math.sign(v) * Math.pow(Math.abs(v), .74); for (let j = 0; j < N; j++) { const an = j / N * TAU; pts.push([s[3] + (s[1] - wall * .5) * f(Math.sin(an)), s[2] + (s[0] - wall * .5) * f(Math.cos(an))]) } return K.plate(pts, .014, holes).applyMatrix4(new T.Matrix4().makeBasis(V(0, 0, 1), V(0, 1, 0), V(-1, 0, 0)).setPosition(V(xx + .007, 0, 0))) };
      cased(bh(xFB, [[0, yIn, .029], [0, yOut, .028], [zB, yB, .0125], [zR, yR, .0062]]), M.bulk);
      cased(bh(xRB, [[0, yIn, .025], [0, yOut, .033], [zB, yB, .0125], [zR, yR, .0062]]), M.bulk);
      /* tapas laterales del diferencial (por ahí salen los palieres), brida de la campana contra el motor y tacos de la cola */
      const fl = [];
      for (const sg of [-1, 1]) fl.push(K.flange(.04, .066, .014, 8, .0045).rotateX(sg * Math.PI / 2).translate(xc, yc, sg * (rbd - .004)));
      cased(K.merge(fl), M.bulk);
      const tail = [];
      for (const [dy, dz] of [[-.022, -.02], [-.022, .02], [.022, -.02], [.022, .02]]) tail.push(K.hex(.006, .012).rotateZ(Math.PI / 2).translate(xc - .204, yc + .02 + dy, dz));
      cased(K.merge([X([[.03, -.004], [.05, -.004], [.05, 0], [.03, 0], [.03, -.004]], 4).translate(xc - .2, yc + .02, 0), ...tail]), M.bulk)
    }
    /* ---- rodamientos (fijos en los tabiques) ---- */
    add(K.merge([DC.bearing(.015, .029, .012).translate(xFB, yIn, 0), DC.bearing(.014, .028, .012).translate(xFB, yOut, 0), DC.bearing(.012, .025, .012).translate(xRB, yIn, 0), DC.bearing(.017, .033, .014).translate(xRB, yOut, 0), DC.bearing(.008, .0125, .009).translate(xFB, yB, zB), DC.bearing(.008, .0125, .009).translate(xRB, yB, zB)]), M.brg);
    /* ---- ejes: escalonados, con sus asientos de rodamiento, estriados y tuercas ---- */
    g.inShaft = new T.Group(), g.outShaft = new T.Group(), scene.add(g.inShaft, g.outShaft);
    g.inShaft.position.set(0, yIn, 0), g.outShaft.position.set(0, yOut, 0);
    add(K.merge([X([[0, xRB - .016], [.012, xRB - .016], [.012, xRB + .012], [.0128, xRB + .014], [.0128, xFB - .012], [.015, xFB - .01], [.015, xFB + .012], [.0105, xFB + .016], [.0105, .146], [.009, .15], [0, .15]], 32), K.hex(.016, .008).rotateZ(Math.PI / 2).translate(xRB - .012, 0, 0), K.gearZ(20, .0011, .05, 0).rotateY(Math.PI / 2).translate(.116, 0, 0)]), M.shaft, g.inShaft);
    add(K.merge([X([[0, xRB - .012], [.017, xRB - .012], [.017, xEnd - .004], [.021, xEnd - .003], [.021, xEnd + .001], [.0152, xEnd + .002], [.0152, C.x0 + .006], [.021, C.x0 + .007], [.021, C.x0 + .011], [.014, C.x0 + .012], [.014, xFB + .012], [0, xFB + .012]], 32), K.gearZ(18, .0017, C.x0 - xEnd, 0).rotateY(Math.PI / 2).translate((C.x0 + xEnd) / 2 + .004, 0, 0), K.hex(.018, .007).rotateZ(Math.PI / 2).translate(xFB + .014, 0, 0)]), M.shaft, g.outShaft);
    /* ---- las ocho parejas: piñón solidario al primario, rueda loca en el secundario con sus garras ---- */
    for (let i = 0; i < 8; i++) {
      const z1 = q.z1[i], z2 = q.z2[i], mIn = new T.Mesh(gearGeo(z1, mod, face, .0128), M.gear.clone()), mOut = new T.Mesh(gearGeo(z2, mod, face, .0175), M.gear.clone());
      mIn.position.set(g.xs[i], yIn, 0), mOut.position.set(g.xs[i], yOut, 0), mIn.castShadow = mOut.castShadow = !0, scene.add(mIn, mOut);
      mOut.rotation.x = meshPh({ y: yIn, z: 0, n: z1, ph: 0 }, { y: yOut, z: 0, n: z2 });
      const hub = new T.Mesh(dogRingGeo(.02, .028, .004, 6), M.dark);
      hub.position.x = (i % 2 === 0 ? -1 : 1) * (face / 2 + .002), mOut.add(hub);
      g.gears.push({ i, mIn, mOut, z1, z2 })
    }
    /* ---- selección: tambor con sus pistas, barra guía y cuatro horquillas, cada una con su seguidor metido en la pista ---- */
    const phiR = Math.atan2(zR, yR - yOut), dR = Math.hypot(zR, yR - yOut), ur = V(0, Math.cos(phiR), Math.sin(phiR));
    for (let k = 0; k < 4; k++) {
      const d = new T.Mesh(dogRingGeo(.0175, .031, dogW, 6), M.ti.clone());
      d.position.set(g.xd[k], yOut, 0), d.castShadow = !0, scene.add(d), g.dogs.push(d);
      const f = new T.Group(), R2 = (p, s) => new T.Vector2(p, s);
      const yoke = new T.LatheGeometry([R2(.0325, -.003), R2(.0405, -.003), R2(.0405, .003), R2(.0325, .003), R2(.0325, -.003)], 22, phiR - Math.PI / 2 - 1.35, 2.7).rotateZ(-Math.PI / 2).translate(0, yOut, 0);
      const arm = new T.BoxGeometry(.006, dR - .0405 - .009, .016).applyMatrix4(new T.Matrix4().makeRotationX(phiR)).translate(0, yOut + ur.y * (dR + .0405 - .009) / 2, ur.z * (dR + .0405 - .009) / 2);
      const boss = X([[.0062, -.013], [.012, -.013], [.012, .013], [.0062, .013], [.0062, -.013]], 24).translate(0, yR, zR), pin = new T.CylinderGeometry(.0034, .0034, yR - yB - .022 - .008, 12).translate(0, (yR - .01 + yB + .0195) / 2, zR);
      add(K.merge([yoke, arm, boss, pin]), M.fork, f), scene.add(f), f.position.x = g.xd[k], g.forks.push(f)
    }
    add(K.merge([X([[0, xRB - .012], [.006, xRB - .012], [.006, xFB + .012], [0, xFB + .012]], 16).translate(0, yR, zR)]), M.shaft);
    g.barrel = new T.Group(), g.barrel.position.set(0, yB, zB), scene.add(g.barrel);
    add(X([[0, xRB - .008], [.008, xRB - .008], [.008, xEnd + .004], [.022, xEnd + .006], [.022, C.x0 - .004], [.008, C.x0 - .002], [.008, xFB + .03], [0, xFB + .03]], 40), M.barrel, g.barrel);
    for (let k = 0; k < 4; k++) {
      const pts = [];
      for (let s = 0; s <= 96; s++) { const th = s / 96 * TAU * .9, pos = forkPos(k, th / (TAU * .9) * 8); pts.push(new T.Vector3(g.xd[k] + pos * .006, .0222 * Math.cos(th), .0222 * Math.sin(th))) }
      g.barrel.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 140, .0028, 6), M.track))
    }
    /* actuador hidráulico giratorio con su servoválvula (delante del tabique) y sensor de posición (detrás) */
    add(K.merge([X([[.008, 0], [.026, 0], [.026, .04], [.018, .046], [0, .046]], 28).translate(xFB + .03, yB, zB), new T.BoxGeometry(.03, .022, .03).translate(xFB + .05, yB + .034, zB), new T.CylinderGeometry(.008, .008, .02, 12).translate(xFB + .05, yB + .054, zB), X([[0, -.02], [.013, -.02], [.013, 0], [0, 0]], 20).translate(xRB - .01, yB, zB), new T.BoxGeometry(.012, .01, .014).translate(xRB - .02, yB + .016, zB)]), M.dark);
    /* ---- embrague multidisco de carbono dentro de la campana ---- */
    const xCl = .12;
    g.clutch = new T.Group(), g.clutch.position.set(xCl, yIn, 0), scene.add(g.clutch);
    for (let k = 0; k < 9; k++) { const pl = new T.Mesh(new T.CylinderGeometry(k % 2 ? .049 : .0505, k % 2 ? .049 : .0505, .0028, 48).rotateZ(Math.PI / 2), k % 2 ? M.plate : M.plateS); pl.position.x = -.014 + k * .0036, pl.castShadow = !0, g.clutch.add(pl) }
    {
      const R2 = (p, s) => new T.Vector2(p, s), bk = [], sp = [];
      /* campana con 12 dedos (entre ellos se ven los discos), fondo atornillado a la brida del cigüeñal y aro de cierre */
      for (let k = 0; k < 12; k++) bk.push(new T.LatheGeometry([R2(.052, -.026), R2(.0565, -.026), R2(.0565, .022), R2(.052, .022), R2(.052, -.026)], 5, k / 12 * TAU, TAU / 12 * .6).rotateZ(-Math.PI / 2));
      bk.push(X([[.02, .022], [.0565, .022], [.0565, .027], [.02, .027], [.02, .022]], 48), X([[.044, -.031], [.0565, -.031], [.0565, -.026], [.044, -.026], [.044, -.031]], 48), X([[.027, -.0215], [.05, -.0215], [.05, -.0172], [.027, -.0172], [.027, -.0215]], 48));
      for (let k = 0; k < 8; k++) bk.push(K.hex(.0042, .004).rotateZ(Math.PI / 2).translate(.029, .032 * Math.cos(k / 8 * TAU), .032 * Math.sin(k / 8 * TAU)));
      /* brida y muñón del cigüeñal hasta la placa trasera del motor */
      bk.push(X([[0, .027], [.04, .027], [.04, .033], [.024, .035], [.024, xF - xCl], [0, xF - xCl]], 32));
      add(K.merge(bk), M.ti, g.clutch);
      /* muelle de diafragma: 18 dedos que el cojinete de empuje aprieta por el centro */
      for (let k = 0; k < 18; k++) sp.push(new T.BoxGeometry(.0016, .034, .006).rotateZ(-.3).translate(-.0325, .031, 0).rotateX(k / 18 * TAU));
      add(K.merge(sp), M.spring, g.clutch);
      /* cubo estriado del primario (arrastra los discos conducidos) */
      add(X([[.012, -.012], [.021, -.012], [.021, .018], [.012, .018], [.012, -.012]], 28), M.dark, g.clutch)
    }
    /* cojinete de empuje y cilindro hidráulico concéntrico, fijos al tabique delantero por un tubo guía */
    add(K.merge([X([[.0125, -.046], [.019, -.046], [.019, -.036], [.0125, -.036], [.0125, -.046]], 28).translate(xCl, yIn, 0), X([[.0125, xFB + .007], [.034, xFB + .007], [.034, xFB + .013], [.018, xFB + .018], [.018, xCl - .09], [.026, xCl - .088], [.026, xCl - .052], [.0125, xCl - .05]], 32).translate(0, yIn, 0), K.hex(.005, .012).translate(xCl - .07, yIn + .03, 0)]), M.alu);
    /* ---- grupo cónico: piñón en la punta del secundario y corona atornillada al diferencial; los dientes van al vértice común ---- */
    let zp = 11, zcw = Math.round(q.fd * 11), best = 9;
    for (let n1 = 9; n1 <= 15; n1++) { const n2 = Math.round(q.fd * n1), e = Math.abs(n2 / n1 - q.fd); e < best - 1e-9 && (best = e, zp = n1, zcw = n2) }
    g.zp = zp, g.zc = zcw;
    const d1 = Math.atan(zp / zcw), d2 = Math.PI / 2 - d1, Re = .104 / Math.sin(d2), bw = .028, mb = .208 / zcw;
    host.crownTip = 2e3 * (.104 + mb * Math.cos(d2));
    const pin = DC.bevel(zp, d1, Re, bw, mb, -Math.PI / 2, (ri, ro) => [[.017, ri[1] - .004], [ri[0], ri[1]], [ro[0], ro[1]], [ro[0] * .8, ro[1] + .007], [.017, ro[1] + .011]]);
    const crn = DC.bevel(zcw, d2, Re, bw, mb, Math.PI / 2 + Math.PI / zcw, (ri, ro) => [[ri[0] - .004, ri[1] + .002], [ri[0], ri[1]], [ro[0], ro[1]], [ro[0] + .003, ro[1] + .004], [ro[0] + .003, ro[1] + .022], [ri[0] - .004, ro[1] + .022], [ri[0] - .004, ri[1] + .002]]);
    g.pinion = add(pin.geo, M.bev.clone()), g.pinion.position.set(xc, yc, 0);
    g.crown = add(crn.geo.rotateY(Math.PI / 2), M.bev.clone()), g.crown.position.set(xc, yc, 0);
    /* ---- diferencial: caja con su brida para la corona, tambor del paquete de discos, pistón hidráulico y rodamientos ---- */
    const zf = -(crn.ro[1] + .022);
    g.diff = new T.Group(), g.diff.position.set(xc, yc, 0), scene.add(g.diff);
    {
      const R2 = (p, s) => new T.Vector2(p, s), gs = [Z([[.022, zf - .05], [.022, zf - .024], [.05, zf - .009], [.098, zf - .009], [.098, zf], [.05, zf], [.05, .046], [.06, .05], [.06, .054]], 48), Z([[.06, .1], [.06, .106], [.022, .108], [.022, .13], [.014, .13]], 48), Z([[.014, zf - .05], [.022, zf - .05]], 32)];
      for (let k = 0; k < 10; k++) gs.push(new T.LatheGeometry([R2(.0555, .054), R2(.06, .054), R2(.06, .1), R2(.0555, .1), R2(.0555, .054)], 4, k / 10 * TAU, TAU / 10 * .58).rotateX(Math.PI / 2));
      for (let k = 0; k < 10; k++) gs.push(K.hex(.0048, .005).rotateX(Math.PI / 2).translate(.088 * Math.cos(k / 10 * TAU), .088 * Math.sin(k / 10 * TAU), zf - .011));
      add(K.merge(gs), M.ti, g.diff)
    }
    g.plates = [];
    for (let k = 0; k < 12; k++) { const pl = new T.Mesh(new T.CylinderGeometry(k % 2 ? .051 : .054, k % 2 ? .051 : .054, .0022, 40).rotateX(Math.PI / 2), (k % 2 ? M.plate : M.plateS).clone()); pl.position.z = .057 + k * .0034, g.diff.add(pl), g.plates.push(pl) }
    g.piston = new T.Mesh(Z([[.03, -.004], [.054, -.004], [.054, .003], [.03, .003], [.03, -.004]], 40), M.plateS), g.piston.position.z = .098, g.diff.add(g.piston);
    add(K.merge([DC.bearing(.022, .04, .016).rotateY(Math.PI / 2).translate(xc, yc, zf - .037), DC.bearing(.022, .04, .016).rotateY(Math.PI / 2).translate(xc, yc, .119)]), M.brg);
    /* ---- palieres: junta trípode en la caja y homocinética en la rueda, las dos con fuelle; ruedas ---- */
    g.shafts = [];
    for (const s of [-1, 1]) {
      const zi = s < 0 ? zf - .05 : .13, A0 = new T.Vector3(xc, yc, zi + s * .03), B0 = new T.Vector3(xc + .02, .03, s * .615), grp = new T.Group(), segs = [], N = 10, d = B0.clone().sub(A0), L = d.length();
      grp.position.copy(A0), grp.quaternion.setFromUnitVectors(new T.Vector3(1, 0, 0), d.clone().normalize()), scene.add(grp);
      for (let k = 0; k < N; k++) {
        const sg = new T.Group(), cyl = new T.Mesh(new T.CylinderGeometry(.016, .016, L / N * .98, 18).rotateZ(Math.PI / 2), M.shaft.clone()), stripe = new T.Mesh(new T.BoxGeometry(L / N * .98, .004, .004), new T.MeshStandardMaterial({ color: "#ff7a1a", emissive: "#ff7a1a", emissiveIntensity: .4 }));
        stripe.position.y = .0165, sg.add(cyl, stripe), sg.position.x = (k + .5) * L / N, grp.add(sg), segs.push(sg)
      }
      const j = DC.tripod(.036, .075);
      add(j.cup.clone().translate(-.03, 0, 0), M.dark, grp), add(j.boot.clone().translate(-.03, 0, 0), M.boot, grp), add(j.clamps.clone().translate(-.03, 0, 0), M.plateS, grp);
      const flip = new T.Matrix4().makeRotationZ(Math.PI).setPosition(new T.Vector3(L + .03, 0, 0));
      add(j.cup.clone().applyMatrix4(flip), M.dark, grp), add(j.boot.clone().applyMatrix4(flip), M.boot, grp), add(j.clamps.clone().applyMatrix4(flip), M.plateS, grp);
      /* rueda trasera con su mangueta: del vaso de la junta sale el eje que la lleva */
      const wg = new T.Group(); wg.position.set(xc + .02, .03, s * .8), scene.add(wg);
      const w = DC.wheel(s);
      add(w.tyre, M.rubber, wg), add(w.rim, M.rim, wg), add(w.cover, M.cover, wg), add(w.nut, M.plateS, wg);
      add(Z([[0, -.2], [.022, -.2], [.022, -.06], [.05, -.05], [.05, .1], [.03, .12], [0, .12]], 28).rotateY(s < 0 ? Math.PI : 0), M.dark, wg);
      g.shafts.push({ s, grp, segs, L, wheel: wg })
    }
    /* ---- unidad de potencia: el motor completo de la pestaña Motor, atornillado a la campana, con su MGU-K y su MGU-H ---- */
    eng = eng || DC.engine();
    scene.add(eng.grp), eng.grp.position.set(xF, yIn, 0), eng.grp.updateMatrixWorld(!0);
    const W = p => eng.root.localToWorld(p.clone()), pK = W(eng.out.lab.mguk).add(new T.Vector3(0, .065, 0)), pH = W(new T.Vector3(eng.xc, eng.out.ty, 0));
    g.mguk = eng.out.mguk, g.mguh = eng.out.mguh, g.pos.mguk = pK, g.pos.mguh = pH.clone().add(new T.Vector3(0, .06, 0));
    /* batería (bajo el depósito, delante del motor) con su mirilla de carga, y electrónica de control con aletas */
    const xES = eng.grp.position.x + eng.len + .5;
    g.es = add(K.merge([new T.BoxGeometry(.44, .15, .52), new T.BoxGeometry(.4, .012, .48).translate(0, -.081, 0), new T.BoxGeometry(.05, .05, .09).translate(-.245, 0, -.17)]), M.es), g.es.position.set(xES, -.2, 0);
    g.cells = new T.Mesh(new T.BoxGeometry(.4, .014, .05), M.cell), g.cells.position.set(xES, -.122, .19), scene.add(g.cells);
    add(new T.BoxGeometry(.41, .005, .06), M.glass).position.set(xES, -.1135, .19);
    { const d = []; for (let k = 0; k < 6; k++) d.push(new T.BoxGeometry(.36, .006, .012).translate(0, .078, -.2 + k * .055)); for (const z0 of [-.2, -.14]) d.push(new T.CylinderGeometry(.012, .012, .03, 14).rotateZ(Math.PI / 2).translate(.235, 0, z0), K.hex(.016, .008).rotateZ(Math.PI / 2).translate(.224, 0, z0)); add(K.merge(d), M.alu).position.set(xES, -.2, 0) }
    { const fins = []; for (let k = 0; k < 9; k++) fins.push(new T.BoxGeometry(.17, .014, .004).translate(0, .052, -.07 + k * .0175)); g.ce = add(K.merge([new T.BoxGeometry(.18, .09, .16), ...fins, new T.BoxGeometry(.03, .04, .05).translate(.105, 0, .03), new T.BoxGeometry(.03, .04, .05).translate(-.105, 0, 0)]), M.motor), g.ce.position.set(xES - .32, -.2, -.36) }
    g.pos.es = new T.Vector3(xES, -.09, 0);
    /* cables de alta tensión y flujos de energía */
    const cable = (pts, name) => { const cv = new T.CatmullRomCurve3(pts.map(p => p.isVector3 ? p : new T.Vector3(...p))), m = new T.Mesh(new T.TubeGeometry(cv, 70, .007, 8), M.hv); scene.add(m); const N = 26, inst = new T.InstancedMesh(new T.SphereGeometry(.011, 8, 6), new T.MeshBasicMaterial({ color: "#7fe3ff", toneMapped: !1 }), N); scene.add(inst); const f = { name, cv, m, inst, N, u: 0, p: 0 }; g.flows.push(f); return f };
    const ceP = g.ce.position, kBox = W(eng.out.lab.mguk).add(new T.Vector3(0, .065 + .052, 0));
    g.fK = cable([kBox, kBox.clone().add(new T.Vector3(.05, .05, -.06)), [ceP.x - .2, -.12, ceP.z - .02], [ceP.x - .12, -.2, ceP.z]], "K");
    g.fES = cable([[ceP.x + .12, -.2, ceP.z + .03], [ceP.x + .2, -.2, ceP.z + .1], [xES - .3, -.2, -.2], [xES - .27, -.2, -.17]], "ES");
    g.fH = cable([pH.clone().add(new T.Vector3(0, .05, 0)), pH.clone().add(new T.Vector3(.03, .1, -.1)), [pH.x + .1, .34, -.36], [ceP.x - .16, .1, ceP.z - .14], [ceP.x - .04, -.12, ceP.z - .06], [ceP.x, -.155, ceP.z - .03]], "H");
    g.floor = new T.Mesh(new T.PlaneGeometry(8, 8), M.ground), g.floor.rotation.x = -Math.PI / 2, g.floor.position.y = -.33, g.floor.receiveShadow = !0, scene.add(g.floor);
    const v3 = (x2, y2, z2) => new T.Vector3(x2, y2, z2);
    g.names = [[v3(xCl, yIn + .075, 0), "Embrague multidisco de carbono"], [v3(xCl - .045, yIn - .04, 0), "Cojinete de empuje y cilindro hidráulico"], [v3(g.xs[1], yIn + rInM + .03, 0), "Primario (piñones tallados en el eje)"], [v3(g.xs[4], yOut - rOut - .02, 0), "Secundario (ruedas locas)"], [v3(g.xd[1], yOut, .05), "Anillo de garras"], [v3(g.xd[2], yR + .03, zR), "Horquilla y barra guía"], [v3(g.xs[5], yB - .04, zB), "Tambor de selección"], [v3(xFB + .05, yB + .07, zB), "Actuador hidráulico"], [v3(xFB, yIn + .05, 0), "Tabique con rodamientos", "case"], [v3(xc + .09, yc + .05, 0), "Piñón cónico"], [v3(xc, yc + .11, -.04), "Corona"], [v3(xc, yc - .08, .08), "Diferencial: discos y pistón"], [v3(xc, yc - .03, .2), "Junta trípode"], [v3(xc - .12, yc + .09, 0), "Carcasa de carbono (estructural)", "case"], [g.pos.es.clone().add(v3(.2, .04, .2)), "Batería (ES)"], [g.ce.position.clone().add(v3(0, .09, 0)), "Electrónica de control (CE)"], [W(v3(eng.out.Xt, eng.out.ty + .11, 0)), "Turbina", "eng"], [W(v3(eng.out.Xc, eng.out.ty + .12, 0)), "Compresor", "eng"]];
    parts = g, setCase(caseMode), setEngine(engMode);
    return g
  }
  /* motor: completo o sin conductos (escape, admisión y turbo), para que no tapen la caja */
  function setEngine(mode) {
    engMode = mode;
    eng && eng.root.traverse(o => { o.userData && o.userData.layer && (o.visible = mode === "full") })
  }
  /* carcasa: seccionada por el plano de los ejes, entera u oculta */
  function setCase(mode) {
    caseMode = mode;
    if (!parts) return;
    for (const m of [M.caseS, M.bulk]) m.clippingPlanes = mode === "cut" ? [clipZ] : null, m.needsUpdate = !0;
    M.cap.clippingPlanes = [clipZ];
    for (const m of parts.caseParts) m.visible = mode !== "off";
    for (const c of parts.caps) c.visible = mode === "cut"
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
    DC = LAB.drivecad, M = mats(), P.geo = geo, clipZ = new T.Plane(new T.Vector3(0, 0, -1), 0);
    R = new T.WebGLRenderer({ antialias: !1, powerPreference: "high-performance" }), R.setPixelRatio(Math.min(2, devicePixelRatio || 1)), R.outputColorSpace = T.SRGBColorSpace, R.toneMapping = T.ACESFilmicToneMapping, R.toneMappingExposure = 1.1, R.shadowMap.enabled = !0, R.shadowMap.type = T.PCFSoftShadowMap, R.localClippingEnabled = !0;
    host.appendChild(R.domElement), R.domElement.className = "s3cv";
    scene = new T.Scene(), scene.background = new T.Color("#0d1014"), cam = new T.PerspectiveCamera(32, 1, .02, 40);
    const pm = new T.PMREMGenerator(R), envS = new T.Scene();
    envS.add(new T.Mesh(new T.BoxGeometry(20, 10, 20), new T.MeshBasicMaterial({ color: "#6b737d", side: T.BackSide })));
    for (const [x, y, z, c] of [[0, 4.8, 0, 6], [-9, 2, 3, 3], [9, 2, -3, 2.4], [0, 1, 9, 2]]) { const p = new T.Mesh(new T.PlaneGeometry(5, 2), new T.MeshBasicMaterial({ color: new T.Color(c, c, c) })); p.position.set(x, y, z), p.lookAt(0, 0, 0), envS.add(p) }
    scene.environment = pm.fromScene(envS, .04).texture, pm.dispose();
    scene.add(new T.HemisphereLight("#dfe7ef", "#1a1f26", .55));
    const key = new T.DirectionalLight("#fff3e2", 2.4);
    key.position.set(1.2, 2.4, 1.5), key.castShadow = !0, key.shadow.mapSize.set(2048, 2048), key.shadow.bias = -2e-4, Object.assign(key.shadow.camera, { left: -1.4, right: 1.4, top: 1.4, bottom: -1.4 }), scene.add(key);
    parts = build();
    labelsEl = document.createElement("div"), labelsEl.className = "s3labels", host.appendChild(labelsEl);
    st = { az: 1.05, el: .3, d: 1.15, t: new T.Vector3(-.17, 0, 0) };
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
        /nobloom/.test(location.search) || comp.addPass(new T.UnrealBloomPass(new T.Vector2(512, 512), .14, .3, 4.5)), comp.addPass(new T.OutputPass()), T.SMAAPass && comp.addPass(new T.SMAAPass(400, 300))
      }
    } catch (e) { comp = null }
    const fit = () => { const r = host.getBoundingClientRect(), w = Math.max(1, r.width), hh = Math.max(1, r.height); R.setSize(w, hh, !1), comp && comp.setSize(w, hh), cam.aspect = w / hh, cam.updateProjectionMatrix() };
    new ResizeObserver(fit).observe(host), fit(), place();
    host.view = v => { Object.assign(st, { box: { az: 1.05, el: .3, d: 1.0, t: new T.Vector3(-.17, 0, 0) }, clutch: { az: 1.15, el: .25, d: .55, t: new T.Vector3(.1, C.yIn, 0) }, diff: { az: 2.2, el: .35, d: .85, t: new T.Vector3(C.xc, C.yc, .03) }, ers: { az: -.9, el: .45, d: 1.9, t: new T.Vector3(.75, 0, -.1) }, all: { az: .85, el: .4, d: 3.1, t: new T.Vector3(.25, .02, 0) } }[v] || {}), st.t = st.t.clone(), place() };
    host.casing = m => setCase(m), host.engine = m => setEngine(m), host.names = on => showNames = !!on;
    return !0
  }
  function rebuild(geo) { if (!scene) return; P.geo = geo; for (const o of [...scene.children]) o.isLight || eng && o === eng.grp || (scene.remove(o), o.traverse(m => m.geometry && m.geometry.dispose())); parts = build() }
  /* ---------- fotograma: s = estado instantáneo de la vuelta ---------- */
  function frame(s, dtReal) {
    if (!parts) return;
    const g = parts, k = s.rotK, tsc = s.tscale;
    clock += dtReal * tsc;
    /* giros: primario a régimen de motor; ruedas locas según su relación; secundario con la marcha engranada */
    /* las vueltas se reparten por número de dientes, para que cada pareja engrane exactamente */
    const we = s.rpm * TAU / 60, gq = g.gears[s.gear], wOut = we * gq.z1 / gq.z2, dA = dtReal * tsc * k;
    g.inShaft.rotation.x += we * dA, g.clutch.rotation.x += we * dA;
    g.outShaft.rotation.x -= wOut * dA;
    /* el motor gira con el primario: cigüeñal, tren de la distribución y toma del MGU-K */
    if (eng) { eng.crank.rotation.x = g.inShaft.rotation.x; for (const t of eng.out.train) t.m.rotation.x = t.ph + g.inShaft.rotation.x * t.k; const tu = eng.out.turbo.userData; tu.ang = (tu.ang || 0) + we * 9 * dA, tu.comp.rotation.x = tu.turb.rotation.x = tu.ang }
    for (const q of g.gears) {
      q.mIn.rotation.x += we * dA, q.mOut.rotation.x -= we * q.z1 / q.z2 * dA;
      const on = q.i === s.gear || q.i === s.gearNext, I = on ? clamp(Math.abs(s.Tin) / 600, .15, 1.6) : 0;
      for (const m of [q.mIn, q.mOut]) m.material.emissive.set(on ? "#ff6a1a" : "#000"), m.material.emissiveIntensity = I
    }
    /* anillos de garras y horquillas siguen al tambor */
    const gIdx = s.barrel;
    g.barrel.rotation.x = -gIdx / 8 * TAU * .9;
    g.dogs.forEach((d, j) => { const p = forkPos(j, gIdx); d.position.x = g.xd[j] + p * .006, d.rotation.x -= wOut * dA, g.forks[j].position.x = d.position.x, d.material.emissive.set(Math.abs(p) > .5 ? "#ff6a1a" : "#000"), d.material.emissiveIntensity = Math.abs(p) > .5 ? clamp(Math.abs(s.Tin) / 900, .1, 1.2) : 0 });
    /* cónica, diferencial y palieres */
    const wc = wOut * g.zp / g.zc;
    g.pinion.rotation.x -= wOut * dA, g.crown.rotation.z -= wc * dA, g.diff.rotation.z -= wc * dA;
    const lockI = clamp(s.lock / 900, 0, 1);
    g.plates.forEach((p, j) => p.material.emissive && (p.material.emissive.setRGB(lockI * .9, lockI * .35, 0), p.material.emissiveIntensity = lockI));
    g.piston.position.z = .098 - lockI * .003;
    const twist = s.Tds / s.kds / 2 * s.twistEx, tq = clamp(Math.abs(s.Tds) / 4000, 0, 1);
    for (const sh of g.shafts) {
      const wS = (sh.s < 0 ? s.wL : s.wR);
      sh.base = (sh.base || 0) + wS * dA;
      sh.segs.forEach((sg, j) => { sg.rotation.x = -sh.s * (sh.base + twist * (1 - j / (sh.segs.length - 1))); sg.children[0].material.emissive.setRGB(tq * .8, tq * .28, 0), sg.children[0].material.emissiveIntensity = tq });
      sh.wheel.rotation.z = -sh.base
    }
    /* ERS: flujo de energía, rotor del MGU-K y carga de la batería */
    const flows = { K: s.Pk, ES: s.Pes, H: s.Ph };
    const hasH = s.era !== "2026" && engMode === "full";
    g.fH.m.visible = g.fH.inst.visible = g.mguh.visible = hasH;
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
    const L = [[g.pos.mguk, `MGU-K ${s.Pk >= 0 ? "+" : "−"}${Math.abs(s.Pk / 1e3).toFixed(0)} kW`], [g.pos.es, `Batería ${(s.soc / 1e6).toFixed(2)} MJ`], [new T.Vector3(g.xs[s.gear], C.yIn + .075, 0), `${s.gear + 1}ª · ${Math.round(s.rpm)} rpm`], [new T.Vector3(C.xc, C.yc + .12, 0), `Bloqueo ${Math.round(s.lock)} N·m`], [g.shafts[1].grp.position.clone().add(new T.Vector3(.02, .07, .3)), `Palier ${(s.Tds / 2e3).toFixed(2)} kN·m`]];
    hasH && L.push([g.pos.mguh, `MGU-H +${(s.Ph / 1e3).toFixed(0)} kW`]);
    if (showNames) for (const nm of g.names) (nm[2] !== "eng" || engMode === "full") && (nm[2] !== "case" || caseMode !== "off") && L.push(nm);
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
  const tris = () => { let t = 0; scene && scene.traverse(o => { if (o.isMesh && o.visible) { let v = !0; o.traverseAncestors(a => a.visible || (v = !1)); if (!v) return; const g = o.geometry; t += (g.index ? g.index.count : g.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1) } }); return Math.round(t) };
  return { init, frame, rebuild, cam: a => camSet && camSet(a), _tris: tris }
})();
