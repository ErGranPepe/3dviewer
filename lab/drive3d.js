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
  const C = { x0: -.24, yIn: -.045, yOut: .045, xc: -.66, yc: .12, xm: -.35 };
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
  let M, camSet = null, clipZ = null, eng = null, caseMode = "cut", engMode = "bare", showNames = !1, pickEl = null, picked = null, lastS = null, nF = 0;
  /* fase para que dos ruedas engranen: en la línea de centros, diente frente a hueco. A: {y, z, n (dientes), ph}; ángulos de +Y hacia +Z */
  const frac = x => x - Math.floor(x);
  const meshPh = (A, B) => { const f = frac((Math.atan2(B.z - A.z, B.y - A.y) + Math.PI / 2 - A.ph) / (TAU / A.n)); return Math.atan2(A.z - B.z, A.y - B.y) + Math.PI / 2 - (.5 - f) * (TAU / B.n) };
  /* ---------- montaje ---------- */
  function build() {
    const g = { gears: [], dogs: [], forks: [], flows: [], pos: {}, caseParts: [], caps: [] }, q = P.geo, K = LAB.kit, V = DC.V, X = DC.latheX, Z = DC.latheZ;
    const add = (geo, mat, parent, pk) => { const m = new T.Mesh(geo, mat); m.castShadow = m.receiveShadow = !0, (parent || scene).add(m), pk && (m.userData.pk = pk); return m };
    const n0 = (v, d = 0) => (+v).toFixed(d).replace(".", ","), es = v => Math.round(v).toLocaleString("es-ES"), wOutOf = s2 => { const gq = g.gears[s2.gear]; return s2.rpm * gq.z1 / gq.z2 };
    /* pieza de la carcasa: se recorta con el plano de los ejes y lleva su cara de corte en rojo */
    const cased = (geo, mat, pk) => { const m = add(geo, mat, null, pk), c = new T.Mesh(geo, M.cap); scene.add(c), g.caseParts.push(m), g.caps.push(c); return m };
    /* posiciones axiales: grupos (1,2) (3,4) (5,6) (7,8) con anillo de garras entre cada par */
    const face = q.face, mod = q.module, dogW = .014, gap = .003, zs = q.z1[0] + q.z2[0], a = mod * zs / 2, yIn = -a / 2, yOut = a / 2;
    /* disposición del artículo 9.6.1: primario concéntrico con el cigüeñal, abajo; secundario encima, en el plano medio del coche */
    C.yIn = yIn, C.yOut = yOut;
    let x = C.x0;
    g.xs = [], g.xd = [];
    for (let k = 0; k < 4; k++) { g.xs.push(x - face / 2), x -= face + gap, g.xd.push(x - dogW / 2), x -= dogW + gap, g.xs.push(x - face / 2), x -= face + .008 }
    g.xEnd = x;
    const xEnd = x, rOut = Math.max(...q.z2) * mod / 2 + mod, xF = .195, xFB = C.x0 + .034, xRB = xEnd - .014, wall = .007;
    /* reducción final en dos etapas: grupo cónico en la punta del secundario → eje transversal → pareja de dientes rectos → diferencial.
       El diferencial queda 160-170 mm por encima del cigüeñal y entre 415 y 450 mm por detrás del primer par (DC.final) */
    const FD = DC.final(q), { zb1, zb2, zF1, zF2, mF, dyF, dxF } = FD, xc = C.xc = Math.min(xEnd - .082 - dxF, C.x0 - .415), xb = xc + dxF, yc = C.yc = yOut + dyF, yW = yIn + .205, yE = yIn - .005;
    g.zb1 = zb1, g.zb2 = zb2, g.zF1 = zF1, g.zF2 = zF2, C.xm = (C.x0 + xEnd) / 2, host.crownTip = FD.tip, host.layout = FD;
    /* el tambor, con su eje por encima del del secundario, a un lado; la barra de las horquillas, encima del tambor */
    const zB = Math.max(.1, rOut + .03), yB = yOut + .02, yR = yB + .042, zR = zB;
    /* ---- carcasa: campana del embrague, cuello (encima va la turbina), cuerpo con los engranajes, bulto del diferencial y cola ---- */
    const rInM = Math.max(...q.z1) * mod / 2 + mod, yTop = Math.max(yOut + rOut + .012 + wall, yR + .03), yBot = yIn - rInM - .012 - wall, ra = (yTop - yBot) / 2, cym = (yTop + yBot) / 2, zmax = zB + .05, zmin = -(rOut + .014), zcm = (zmax + zmin) / 2, rbm = (zmax - zmin) / 2 + wall, rbd = .137;
    const yHiD = yc + FD.tip / 2e3 + .014 + wall, yLoD = yOut - .085, rad = (yHiD - yLoD) / 2, cyD = (yHiD + yLoD) / 2, xsD = Math.min(xb + .04, xEnd - .02);
    /* secciones a lo largo de la caja: campana, cuello bajo y estrecho (encima va la turbina y por ahí sube el escape), cuerpo del tren, bulto del diferencial y cola */
    const keys = [[xF, .088, .088, yIn, 0], [.105, .088, .088, yIn, 0], [.088, .04, .06, yIn - .01, 0], [C.x0 + .075, .04, .06, yIn - .01, 0], [C.x0 + .05, ra, rbm, cym, zcm], [xEnd, ra, rbm, cym, zcm], [xsD, rad, rbd, cyD, 0], [xc - .1, rad, rbd, cyD, 0], [xc - .18, .07, .06, yc - .04, 0], [xc - .22, .05, .045, yc - .04, 0]];
    const sec = xx => { for (let i = 0; i < keys.length - 1; i++) { const k0 = keys[i], k1 = keys[i + 1]; if (xx <= k0[0] && xx >= k1[0]) { const u = (k0[0] - xx) / Math.max(1e-6, k0[0] - k1[0]), w = u * u * (3 - 2 * u); return [1, 2, 3, 4].map(j => k0[j] + (k1[j] - k0[j]) * w) } } return keys[keys.length - 1].slice(1) };
    {
      const n = 150, Pp = [], Ss = [];
      for (let i = 0; i <= n; i++) { const xx = xF + (xc - .22 - xF) * i / n, s = sec(xx); Pp.push(V(xx, s[2], s[3])), Ss.push([s[0], s[1]]) }
      cased(K.sweep(Pp, t => Ss[Math.min(n, Math.round(t * n))], { sides: 60, n0: V(0, 1, 0), pow: .74, wall, cap1: !0, rim0: !0 }), M.caseS, { name: "Carcasa de la caja", mat: "Fibra de carbono (hay equipos que la hacen de titanio)", info: "Es parte de la estructura del coche: une el motor con el eje trasero, lleva los anclajes de la suspensión trasera y, en la cola, la estructura de impacto. Delante, la campana que cubre el embrague se atornilla al motor." });
      /* tabiques con los alojamientos de los rodamientos, el tambor y la barra de las horquillas */
      const bh = (xx, holes) => { const s = sec(xx), pts = [], N = 64, f = v => Math.sign(v) * Math.pow(Math.abs(v), .74); for (let j = 0; j < N; j++) { const an = j / N * TAU; pts.push([s[3] + (s[1] - wall * .5) * f(Math.sin(an)), s[2] + (s[0] - wall * .5) * f(Math.cos(an))]) } return K.plate(pts, .014, holes).applyMatrix4(new T.Matrix4().makeBasis(V(0, 0, 1), V(0, 1, 0), V(-1, 0, 0)).setPosition(V(xx + .007, 0, 0))) };
      const pkB = { name: "Tabique con los alojamientos de los rodamientos", mat: "Titanio o aluminio mecanizado", info: "Los dos tabiques sujetan los ejes, el tambor y la barra de las horquillas. Con ellos el tren de engranajes sale entero, como un cartucho, para cambiar relaciones." };
      cased(bh(xFB, [[0, yIn, .029], [0, yOut, .028], [zB, yB, .0125], [zR, yR, .0062]]), M.bulk, pkB);
      cased(bh(xRB, [[0, yIn, .025], [0, yOut, .033], [zB, yB, .0125], [zR, yR, .0062]]), M.bulk, pkB);
      /* tapas laterales del diferencial (por ahí salen los palieres), brida de la campana contra el motor y tacos de la cola */
      const fl = [];
      for (const sg of [-1, 1]) fl.push(K.flange(.04, .066, .014, 8, .0045).rotateX(sg * Math.PI / 2).translate(xc, yc, sg * (rbd - .004)));
      cased(K.merge(fl), M.bulk);
      const tail = [];
      for (const [dy, dz] of [[-.022, -.02], [-.022, .02], [.022, -.02], [.022, .02]]) tail.push(K.hex(.006, .012).rotateZ(Math.PI / 2).translate(xc - .224, yc - .04 + dy, dz));
      cased(K.merge([X([[.03, -.004], [.05, -.004], [.05, 0], [.03, 0], [.03, -.004]], 4).translate(xc - .22, yc - .04, 0), ...tail]), M.bulk)
    }
    /* ---- rodamientos (fijos en los tabiques) ---- */
    add(K.merge([DC.bearing(.015, .029, .012).translate(xFB, yIn, 0), DC.bearing(.014, .028, .012).translate(xFB, yOut, 0), DC.bearing(.012, .025, .012).translate(xRB, yIn, 0), DC.bearing(.017, .033, .014).translate(xRB, yOut, 0), DC.bearing(.008, .0125, .009).translate(xFB, yB, zB), DC.bearing(.008, .0125, .009).translate(xRB, yB, zB), DC.bearing(.014, .028, .012).rotateY(Math.PI / 2).translate(xb, yOut, -.084), DC.bearing(.014, .028, .012).rotateY(Math.PI / 2).translate(xb, yOut, .062)]), M.brg, null, { name: "Rodamientos de bolas", mat: "Acero de rodamientos; en F1, a menudo con bolas cerámicas", info: "Cada eje se apoya en dos, uno en cada tabique. El trasero del secundario es el mayor: aguanta también el empuje del piñón cónico." });
    /* ---- ejes: escalonados, con sus asientos de rodamiento, estriados y tuercas ---- */
    g.inShaft = new T.Group(), g.outShaft = new T.Group(), scene.add(g.inShaft, g.outShaft);
    g.inShaft.position.set(0, yIn, 0), g.outShaft.position.set(0, yOut, 0);
    add(K.merge([X([[0, xRB - .016], [.012, xRB - .016], [.012, xRB + .012], [.0128, xRB + .014], [.0128, xFB - .012], [.015, xFB - .01], [.015, xFB + .012], [.0105, xFB + .016], [.0105, .146], [.009, .15], [0, .15]], 32), K.hex(.016, .008).rotateZ(Math.PI / 2).translate(xRB - .012, 0, 0), K.gearZ(20, .0011, .05, 0).rotateY(Math.PI / 2).translate(.116, 0, 0)]), M.shaft, g.inShaft, { name: "Eje primario", mat: "Acero de cementación", info: "Viene del embrague por su estriado y gira siempre a régimen de motor. Lleva los ocho piñones.", live: s2 => `${es(s2.rpm)} rpm · par de entrada ${es(Math.abs(s2.Tin))} N·m` });
    add(K.merge([X([[0, xRB - .012], [.017, xRB - .012], [.017, xEnd - .004], [.021, xEnd - .003], [.021, xEnd + .001], [.0152, xEnd + .002], [.0152, C.x0 + .006], [.021, C.x0 + .007], [.021, C.x0 + .011], [.014, C.x0 + .012], [.014, xFB + .012], [0, xFB + .012]], 32), K.gearZ(18, .0017, C.x0 - xEnd, 0).rotateY(Math.PI / 2).translate((C.x0 + xEnd) / 2 + .004, 0, 0), K.hex(.018, .007).rotateZ(Math.PI / 2).translate(xFB + .014, 0, 0)]), M.shaft, g.outShaft, { name: "Eje secundario", mat: "Acero de cementación", info: "Estriado de punta a punta: sobre el estriado se deslizan los anillos de garras, y las ruedas giran locas entre ellos. En su extremo trasero lleva el piñón cónico.", live: s2 => `${es(wOutOf(s2))} rpm en ${s2.gear + 1}ª` });
    /* ---- las ocho parejas: piñón solidario al primario, rueda loca en el secundario con sus garras ---- */
    for (let i = 0; i < 8; i++) {
      const z1 = q.z1[i], z2 = q.z2[i], mIn = new T.Mesh(gearGeo(z1, mod, face, .0128), M.gear.clone()), mOut = new T.Mesh(gearGeo(z2, mod, face, .0175), M.gear.clone());
      mIn.position.set(g.xs[i], yIn, 0), mOut.position.set(g.xs[i], yOut, 0), mIn.castShadow = mOut.castShadow = !0, scene.add(mIn, mOut);
      mOut.rotation.x = meshPh({ y: yIn, z: 0, n: z1, ph: 0 }, { y: yOut, z: 0, n: z2 });
      const gi = () => host.gearInfo ? host.gearInfo(i) : null, st = () => { const G = gi(); return G && G.sb ? ` · flexión en el pie ${es(G.sb)} MPa · presión de contacto ${es(G.sh)} MPa` + (G.lifeKm < 1e6 ? ` · vida ≈ ${es(G.lifeKm)} km` : "") : "" };
      mIn.userData.pk = { name: `Piñón de ${i + 1}ª`, mat: "Acero de cementación, dientes rectos", info: "Tallado en el eje primario: gira siempre con el motor, engrane o no su marcha.", live: s2 => `${z1} dientes · módulo ${n0(mod * 1e3, 2)} mm · ancho ${n0(face * 1e3, 1)} mm · ${es(s2.rpm)} rpm` + (s2.gear === i ? st() : "") };
      mOut.userData.pk = { name: `Rueda de ${i + 1}ª`, mat: "Acero de cementación, dientes rectos", info: "Gira loca sobre el secundario. Solo transmite par cuando el anillo de garras de al lado se mete en las suyas.", live: s2 => `${z2} dientes · relación ${n0(z2 / z1, 3)} : 1 · ${es(s2.rpm * z1 / z2)} rpm · ` + (s2.gear === i ? "ENGRANADA" + st() : "loca") };
      const hub = new T.Mesh(dogRingGeo(.02, .028, .004, 6), M.dark);
      hub.position.x = (i % 2 === 0 ? -1 : 1) * (face / 2 + .002), mOut.add(hub);
      g.gears.push({ i, mIn, mOut, z1, z2 })
    }
    /* ---- selección: tambor con sus pistas, barra guía y cuatro horquillas, cada una con su seguidor metido en la pista ---- */
    const phiR = Math.atan2(zR, yR - yOut), dR = Math.hypot(zR, yR - yOut), ur = V(0, Math.cos(phiR), Math.sin(phiR));
    for (let k = 0; k < 4; k++) {
      const d = new T.Mesh(dogRingGeo(.0175, .031, dogW, 6), M.ti.clone());
      d.position.set(g.xd[k], yOut, 0), d.castShadow = !0, scene.add(d), g.dogs.push(d), d.userData.pk = { name: `Anillo de garras ${2 * k + 1}ª-${2 * k + 2}ª`, mat: "Acero", info: "Gira con el secundario y se desliza sobre su estriado. No hay sincronizadores: las garras entran directamente en las de la rueda, y por eso el cambio dura milisegundos.", live: s2 => { const p2 = forkPos(k, s2.barrel); return Math.abs(p2) < .5 ? "en punto muerto" : `metido en ${2 * k + (p2 > 0 ? 1 : 2)}ª` } };
      const f = new T.Group(), R2 = (p, s) => new T.Vector2(p, s);
      const yoke = new T.LatheGeometry([R2(.0325, -.003), R2(.0405, -.003), R2(.0405, .003), R2(.0325, .003), R2(.0325, -.003)], 22, phiR - Math.PI / 2 - 1.35, 2.7).rotateZ(-Math.PI / 2).translate(0, yOut, 0);
      const arm = new T.BoxGeometry(.006, dR - .0405 - .009, .016).applyMatrix4(new T.Matrix4().makeRotationX(phiR)).translate(0, yOut + ur.y * (dR + .0405 - .009) / 2, ur.z * (dR + .0405 - .009) / 2);
      const boss = X([[.0062, -.013], [.012, -.013], [.012, .013], [.0062, .013], [.0062, -.013]], 24).translate(0, yR, zR), pin = new T.CylinderGeometry(.0034, .0034, yR - yB - .022 - .008, 12).translate(0, (yR - .01 + yB + .0195) / 2, zR);
      add(K.merge([yoke, arm, boss, pin]), M.fork, f, { name: "Horquilla de selección", mat: "Acero o titanio, con patines de bronce", info: "Abraza el anillo de garras y corre por la barra guía. Su seguidor va metido en la pista del tambor: cuando el tambor gira, la pista la empuja a un lado o a otro." }), scene.add(f), f.position.x = g.xd[k], g.forks.push(f)
    }
    add(K.merge([X([[0, xRB - .012], [.006, xRB - .012], [.006, xFB + .012], [0, xFB + .012]], 16).translate(0, yR, zR)]), M.shaft);
    g.barrel = new T.Group(), g.barrel.position.set(0, yB, zB), scene.add(g.barrel);
    add(X([[0, xRB - .008], [.008, xRB - .008], [.008, xEnd + .004], [.022, xEnd + .006], [.022, C.x0 - .004], [.008, C.x0 - .002], [.008, xFB + .016], [0, xFB + .016]], 40), M.barrel, g.barrel, { name: "Tambor de selección", mat: "Acero", info: "Cada pista mueve una horquilla. Al girar, pasa por las ocho marchas en orden: por eso el cambio es secuencial. Lo gira un actuador hidráulico.", live: s2 => `posición ${n0(s2.barrel + 1, 2)} de 8` });
    for (let k = 0; k < 4; k++) {
      const pts = [];
      for (let s = 0; s <= 96; s++) { const th = s / 96 * TAU * .9, pos = forkPos(k, th / (TAU * .9) * 8); pts.push(new T.Vector3(g.xd[k] + pos * .006, .0222 * Math.cos(th), .0222 * Math.sin(th))) }
      g.barrel.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 140, .0028, 6), M.track))
    }
    /* actuador hidráulico giratorio con su servoválvula y su sensor de posición, detrás del tabique trasero (delante la carcasa se estrecha para dejar sitio a la turbina) */
    add(K.merge([X([[.008, 0], [.026, 0], [.026, .034], [.018, .04], [0, .04]], 28).rotateY(Math.PI).translate(xRB - .002, yB, zB), new T.BoxGeometry(.03, .022, .03).translate(xRB - .022, yB + .034, zB), new T.CylinderGeometry(.008, .008, .02, 12).translate(xRB - .022, yB + .054, zB), X([[0, 0], [.012, 0], [.012, .008], [0, .008]], 20).rotateY(Math.PI).translate(xRB - .042, yB, zB)]), M.dark);
    /* ---- embrague multidisco de carbono dentro de la campana ---- */
    const xCl = .12, pkC = { name: "Embrague multidisco de carbono", mat: "Discos de carbono-carbono; campana de titanio", info: "Los discos conductores van enganchados a los dedos de la campana (que gira con el cigüeñal) y los conducidos, al cubo estriado del primario. El muelle de diafragma los aprieta; el cojinete de empuje lo afloja. Solo trabaja al arrancar y al parar: en marcha se cambia sin tocarlo.", live: s2 => `${es(s2.rpm)} rpm · pasa ${es(Math.abs(s2.Tin))} N·m` };
    g.clutch = new T.Group(), g.clutch.position.set(xCl, yIn, 0), scene.add(g.clutch);
    for (let k = 0; k < 9; k++) { const pl = new T.Mesh(new T.CylinderGeometry(k % 2 ? .049 : .0505, k % 2 ? .049 : .0505, .0028, 48).rotateZ(Math.PI / 2), k % 2 ? M.plate : M.plateS); pl.position.x = -.014 + k * .0036, pl.castShadow = !0, pl.userData.pk = pkC, g.clutch.add(pl) }
    {
      const R2 = (p, s) => new T.Vector2(p, s), bk = [], sp = [];
      /* campana con 12 dedos (entre ellos se ven los discos), fondo atornillado a la brida del cigüeñal y aro de cierre */
      for (let k = 0; k < 12; k++) bk.push(new T.LatheGeometry([R2(.052, -.026), R2(.0565, -.026), R2(.0565, .022), R2(.052, .022), R2(.052, -.026)], 5, k / 12 * TAU, TAU / 12 * .6).rotateZ(-Math.PI / 2));
      bk.push(X([[.02, .022], [.0565, .022], [.0565, .027], [.02, .027], [.02, .022]], 48), X([[.044, -.031], [.0565, -.031], [.0565, -.026], [.044, -.026], [.044, -.031]], 48), X([[.027, -.0215], [.05, -.0215], [.05, -.0172], [.027, -.0172], [.027, -.0215]], 48));
      for (let k = 0; k < 8; k++) bk.push(K.hex(.0042, .004).rotateZ(Math.PI / 2).translate(.029, .032 * Math.cos(k / 8 * TAU), .032 * Math.sin(k / 8 * TAU)));
      /* brida y muñón del cigüeñal hasta la placa trasera del motor */
      bk.push(X([[0, .027], [.04, .027], [.04, .033], [.024, .035], [.024, xF - xCl], [0, xF - xCl]], 32));
      add(K.merge(bk), M.ti, g.clutch, pkC);
      /* muelle de diafragma: 18 dedos que el cojinete de empuje aprieta por el centro */
      for (let k = 0; k < 18; k++) sp.push(new T.BoxGeometry(.0016, .034, .006).rotateZ(-.3).translate(-.0325, .031, 0).rotateX(k / 18 * TAU));
      add(K.merge(sp), M.spring, g.clutch, pkC);
      /* cubo estriado del primario (arrastra los discos conducidos) */
      add(X([[.012, -.012], [.021, -.012], [.021, .018], [.012, .018], [.012, -.012]], 28), M.dark, g.clutch)
    }
    /* cojinete de empuje y cilindro hidráulico concéntrico, fijos al tabique delantero por un tubo guía */
    add(K.merge([X([[.0125, -.046], [.019, -.046], [.019, -.036], [.0125, -.036], [.0125, -.046]], 28).translate(xCl, yIn, 0), X([[.0125, xFB + .007], [.034, xFB + .007], [.034, xFB + .013], [.018, xFB + .018], [.018, xCl - .09], [.026, xCl - .088], [.026, xCl - .052], [.0125, xCl - .05]], 32).translate(0, yIn, 0), K.hex(.005, .012).translate(xCl - .07, yIn + .03, 0)]), M.alu, null, { name: "Cojinete de empuje y cilindro hidráulico", mat: "Aluminio y acero", info: "El cilindro va alrededor del primario, fijo al tabique. Al recibir presión empuja el cojinete contra los dedos del muelle de diafragma y el embrague se suelta. Lo manda el piloto con una leva del volante." });
    /* ---- grupo cónico: piñón en la punta del secundario y corona atornillada al diferencial; los dientes van al vértice común ---- */
    /* ---- grupo cónico: piñón en la punta del secundario y rueda en el eje transversal, con los dientes apuntando al cruce de los dos ejes ---- */
    const mbv = .0042, d1 = Math.atan(zb1 / zb2), d2 = Math.PI / 2 - d1, Re = mbv * zb2 / 2 / Math.sin(d2), bw = Math.min(.018, Re * .33);
    const pin = DC.bevel(zb1, d1, Re, bw, mbv, -Math.PI / 2, (ri, ro) => [[.017, ri[1] - .004], [ri[0], ri[1]], [ro[0], ro[1]], [ro[0] * .8, ro[1] + .007], [.017, ro[1] + .011]]);
    const crn = DC.bevel(zb2, d2, Re, bw, mbv, Math.PI / 2 + Math.PI / zb2, (ri, ro) => [[.014, ri[1] + .002], [ri[0], ri[1]], [ro[0], ro[1]], [ro[0] + .003, ro[1] + .004], [ro[0] + .003, ro[1] + .016], [.014, ro[1] + .016], [.014, ri[1] + .002]]);
    const wFin = s2 => wOutOf(s2) * zb1 / zb2 * zF1 / zF2;
    const pkF = { name: "Grupo cónico", mat: "Acero de cementación", info: "El piñón, en la punta del secundario, gira 90° el movimiento hacia un eje transversal. Los dientes apuntan todos al punto donde se cruzan los dos ejes.", live: s2 => `${zb1} y ${zb2} dientes = ${n0(zb2 / zb1, 3)} : 1 · eje transversal a ${es(wOutOf(s2) * zb1 / zb2)} rpm` };
    const pkR = { name: "Reducción final", mat: "Acero de cementación, dientes rectos", info: "El reglamento pone el eje del diferencial entre 160 y 170 mm por encima del cigüeñal, bastante más alto que el secundario: esta pareja sube el giro hasta ahí y hace la última reducción. La rueda no puede medir menos de 205 mm entre puntas.", live: s2 => `${zF1} y ${zF2} dientes = ${n0(zF2 / zF1, 3)} : 1 · total con el cónico ${n0(FD.ratio, 3)} : 1 · diferencial a ${es(wFin(s2))} rpm` };
    /* piñón cónico con la prolongación del secundario y su tuerca. Los dos cónicos se giran media vuelta en torno al eje del secundario para que la rueda quede del lado +z */
    g.pinion = add(K.merge([pin.geo.rotateX(Math.PI), X([[0, .012], [.017, .012], [.017, xRB - .012 - xb], [0, xRB - .012 - xb]], 28), K.hex(.021, .008).rotateZ(Math.PI / 2).translate(.012, 0, 0)]), M.bev.clone(), null, pkF), g.pinion.position.set(xb, yOut, 0);
    /* eje transversal: rueda cónica a un lado y piñón de la reducción final al otro */
    const thF = Math.atan2(dyF, -dxF), zg = -.057;
    g.cross = new T.Group(), g.cross.position.set(xb, yOut, 0), scene.add(g.cross);
    add(K.merge([crn.geo.rotateY(Math.PI / 2).rotateX(Math.PI), Z([[0, -.092], [.014, -.092], [.014, .07], [0, .07]], 24)]), M.bev.clone(), g.cross, pkF);
    add(K.gearZ(zF1, mF, .024, .0138).rotateZ(thF - Math.PI / zF1).translate(0, 0, zg), M.gear.clone(), g.cross, pkR);
    /* ---- diferencial: caja con su brida para la corona, tambor del paquete de discos, pistón hidráulico y rodamientos ---- */
    const zf = -.037;
    const pkD = { name: "Diferencial de bloqueo hidráulico", mat: "Caja de titanio; discos de acero y fricción", info: "Deja que las dos ruedas giren a distinta velocidad en curva. Un pistón aprieta el paquete de discos y las frena una contra otra: ese par de bloqueo lo decide la electrónica según se entre, se pase o se salga de la curva.", live: s2 => `bloqueo ${es(s2.lock)} N·m · rueda izq. ${es(s2.wL * 9.549)} rpm · dcha. ${es(s2.wR * 9.549)} rpm` };
    g.diff = new T.Group(), g.diff.position.set(xc, yc, 0), scene.add(g.diff);
    {
      const R2 = (p, s) => new T.Vector2(p, s), gs = [Z([[.022, zf - .056], [.022, zf - .024], [.05, zf - .009], [.086, zf - .009], [.086, zf], [.05, zf], [.05, .046], [.06, .05], [.06, .054]], 48), Z([[.06, .1], [.06, .106], [.022, .108], [.022, .13], [.014, .13]], 48), Z([[.014, zf - .056], [.022, zf - .056]], 32)];
      for (let k = 0; k < 10; k++) gs.push(new T.LatheGeometry([R2(.0555, .054), R2(.06, .054), R2(.06, .1), R2(.0555, .1), R2(.0555, .054)], 4, k / 10 * TAU, TAU / 10 * .58).rotateX(Math.PI / 2));
      for (let k = 0; k < 10; k++) gs.push(K.hex(.0048, .005).rotateX(Math.PI / 2).translate(.078 * Math.cos(k / 10 * TAU), .078 * Math.sin(k / 10 * TAU), zf + .003));
      add(K.merge(gs), M.ti, g.diff, pkD);
      /* rueda de la reducción final, atornillada a la brida de la caja del diferencial: un hueco suyo mira al piñón */
      add(K.gearZ(zF2, mF, .022, .07).rotateZ(thF + Math.PI).translate(0, 0, zg), M.gear.clone(), g.diff, pkR)
    }
    g.plates = [];
    for (let k = 0; k < 12; k++) { const pl = new T.Mesh(new T.CylinderGeometry(k % 2 ? .051 : .054, k % 2 ? .051 : .054, .0022, 40).rotateX(Math.PI / 2), (k % 2 ? M.plate : M.plateS).clone()); pl.position.z = .057 + k * .0034, pl.userData.pk = pkD, g.diff.add(pl), g.plates.push(pl) }
    g.piston = new T.Mesh(Z([[.03, -.004], [.054, -.004], [.054, .003], [.03, .003], [.03, -.004]], 40), M.plateS), g.piston.position.z = .098, g.diff.add(g.piston);
    add(K.merge([DC.bearing(.022, .04, .016).rotateY(Math.PI / 2).translate(xc, yc, zf - .046), DC.bearing(.022, .04, .016).rotateY(Math.PI / 2).translate(xc, yc, .119)]), M.brg);
    /* ---- palieres: junta trípode en la caja y homocinética en la rueda, las dos con fuelle; ruedas ---- */
    g.shafts = [];
    for (const s of [-1, 1]) {
      const zi = s < 0 ? zf - .056 : .13, A0 = new T.Vector3(xc, yc, zi + s * .03), B0 = new T.Vector3(xc + .02, yW, s * .615), grp = new T.Group(), segs = [], N = 10, d = B0.clone().sub(A0), L = d.length();
      grp.position.copy(A0), grp.quaternion.setFromUnitVectors(new T.Vector3(1, 0, 0), d.clone().normalize()), scene.add(grp);
      grp.userData.pk = { name: "Palier " + (s < 0 ? "izquierdo" : "derecho"), mat: "Acero de alta resistencia, hueco; juntas trípode con fuelle", info: "Lleva el par a la rueda y, a la vez, hace de muelle de torsión: se retuerce con cada golpe de par. Aquí el giro va exagerado 12 veces para que se vea.", live: s2 => `par ${n0(s2.Tds / 2e3, 2)} kN·m · torsión ${n0(s2.Tds / s2.kds / 2 * 57.3, 2)}°` };
      for (let k = 0; k < N; k++) {
        const sg = new T.Group(), cyl = new T.Mesh(new T.CylinderGeometry(.016, .016, L / N * .98, 18).rotateZ(Math.PI / 2), M.shaft.clone()), stripe = new T.Mesh(new T.BoxGeometry(L / N * .98, .004, .004), new T.MeshStandardMaterial({ color: "#ff7a1a", emissive: "#ff7a1a", emissiveIntensity: .4 }));
        stripe.position.y = .0165, sg.add(cyl, stripe), sg.position.x = (k + .5) * L / N, grp.add(sg), segs.push(sg)
      }
      const j = DC.tripod(.036, .075);
      add(j.cup.clone().translate(-.03, 0, 0), M.dark, grp), add(j.boot.clone().translate(-.03, 0, 0), M.boot, grp), add(j.clamps.clone().translate(-.03, 0, 0), M.plateS, grp);
      const flip = new T.Matrix4().makeRotationZ(Math.PI).setPosition(new T.Vector3(L + .03, 0, 0));
      add(j.cup.clone().applyMatrix4(flip), M.dark, grp), add(j.boot.clone().applyMatrix4(flip), M.boot, grp), add(j.clamps.clone().applyMatrix4(flip), M.plateS, grp);
      /* rueda trasera con su mangueta: del vaso de la junta sale el eje que la lleva */
      const wg = new T.Group(); wg.position.set(xc + .02, yW, s * .8), scene.add(wg), wg.userData.pk = { name: "Rueda trasera", mat: "Llanta de magnesio de 18 pulgadas con tapacubos", info: "Neumático trasero de 720 mm de diámetro.", live: s2 => `${es((s < 0 ? s2.wL : s2.wR) * 9.549)} rpm · ${es(s2.v * 3.6)} km/h` };
      const w = DC.wheel(s);
      add(w.tyre, M.rubber, wg), add(w.rim, M.rim, wg), add(w.cover, M.cover, wg), add(w.nut, M.plateS, wg);
      add(Z([[0, -.2], [.022, -.2], [.022, -.06], [.05, -.05], [.05, .1], [.03, .12], [0, .12]], 28).rotateY(s < 0 ? Math.PI : 0), M.dark, wg);
      g.shafts.push({ s, grp, segs, L, wheel: wg })
    }
    /* ---- unidad de potencia: el motor completo de la pestaña Motor, atornillado a la campana, con su MGU-K y su MGU-H ---- */
    eng = eng || DC.engine();
    scene.add(eng.grp), eng.grp.position.set(xF, yIn, 0), eng.grp.updateMatrixWorld(!0);
    eng.grp.userData.pk = { name: "Unidad de potencia", mat: "V6 de 1,6 litros turbo", info: "Es el motor de la pestaña Motor, con sus medidas de serie, atornillado a la campana. Su cigüeñal y su distribución giran con el primario.", live: s2 => `${es(s2.rpm)} rpm` };
    eng.out.mguk.userData.pk = { name: "MGU-K", mat: "Motor-generador eléctrico", info: "Va engranado al cigüeñal con relación fija. Empuja al acelerar y frena para recargar la batería.", live: s2 => `${s2.Pk >= 0 ? "empuja" : "recupera"} ${es(Math.abs(s2.Pk) / 1e3)} kW` };
    eng.out.mguh.userData.pk = { name: "MGU-H", mat: "Motor-generador en el eje del turbo (hasta 2025)", info: "Saca electricidad de los gases de escape y mantiene el turbo girando al levantar el pie.", live: s2 => `recupera ${es(s2.Ph / 1e3)} kW` };
    const W = p => eng.root.localToWorld(p.clone()), pK = W(eng.out.lab.mguk).add(new T.Vector3(0, .065, 0)), pH = W(new T.Vector3(eng.xc, eng.out.ty, 0));
    g.mguk = eng.out.mguk, g.mguh = eng.out.mguh, g.pos.mguk = pK, g.pos.mguh = pH.clone().add(new T.Vector3(0, .06, 0));
    /* batería (bajo el depósito, delante del motor) con su mirilla de carga, y electrónica de control con aletas */
    const xES = eng.grp.position.x + eng.len + .5;
    g.es = add(K.merge([new T.BoxGeometry(.44, .15, .52), new T.BoxGeometry(.4, .012, .48).translate(0, -.081, 0), new T.BoxGeometry(.05, .05, .09).translate(-.245, 0, -.17)]), M.es, null, { name: "Batería (ES)", mat: "Celdas de iones de litio en caja de carbono", info: "Va bajo el depósito, detrás del piloto. La regleta verde es su carga.", live: s2 => `${n0(s2.soc / 1e6, 2)} MJ de ${n0(s2.socwin / 1e6, 1)} MJ útiles` }), g.es.position.set(xES, yE, 0);
    g.cells = new T.Mesh(new T.BoxGeometry(.4, .014, .05), M.cell), g.cells.position.set(xES, yE + .078, .19), scene.add(g.cells);
    add(new T.BoxGeometry(.41, .005, .06), M.glass).position.set(xES, yE + .0865, .19);
    { const d = []; for (let k = 0; k < 6; k++) d.push(new T.BoxGeometry(.36, .006, .012).translate(0, .078, -.2 + k * .055)); for (const z0 of [-.2, -.14]) d.push(new T.CylinderGeometry(.012, .012, .03, 14).rotateZ(Math.PI / 2).translate(.235, 0, z0), K.hex(.016, .008).rotateZ(Math.PI / 2).translate(.224, 0, z0)); add(K.merge(d), M.alu).position.set(xES, yE, 0) }
    { const fins = []; for (let k = 0; k < 9; k++) fins.push(new T.BoxGeometry(.17, .014, .004).translate(0, .052, -.07 + k * .0175)); g.ce = add(K.merge([new T.BoxGeometry(.18, .09, .16), ...fins, new T.BoxGeometry(.03, .04, .05).translate(.105, 0, .03), new T.BoxGeometry(.03, .04, .05).translate(-.105, 0, 0)]), M.motor), g.ce.position.set(xES - .32, yE, -.36) }
    g.pos.es = new T.Vector3(xES, yE + .11, 0);
    /* cables de alta tensión y flujos de energía */
    const cable = (pts, name) => { const cv = new T.CatmullRomCurve3(pts.map(p => p.isVector3 ? p : new T.Vector3(...p))), m = new T.Mesh(new T.TubeGeometry(cv, 70, .007, 8), M.hv); scene.add(m); const N = 26, inst = new T.InstancedMesh(new T.SphereGeometry(.011, 8, 6), new T.MeshBasicMaterial({ color: "#7fe3ff", toneMapped: !1 }), N); scene.add(inst); const f = { name, cv, m, inst, N, u: 0, p: 0 }; g.flows.push(f); return f };
    const ceP = g.ce.position, kBox = W(eng.out.lab.mguk).add(new T.Vector3(0, .065 + .052, 0));
    g.fK = cable([kBox, kBox.clone().add(new T.Vector3(.05, .05, -.06)), [ceP.x - .2, yE + .08, ceP.z - .02], [ceP.x - .12, yE, ceP.z]], "K");
    g.fES = cable([[ceP.x + .12, yE, ceP.z + .03], [ceP.x + .2, yE, ceP.z + .1], [xES - .3, yE, -.2], [xES - .27, yE, -.17]], "ES");
    g.fH = cable([pH.clone().add(new T.Vector3(0, .05, 0)), pH.clone().add(new T.Vector3(.03, .1, -.1)), [pH.x + .1, yIn + .2925, -.36], [ceP.x - .16, yIn + .0525, ceP.z - .14], [ceP.x - .04, yE + .08, ceP.z - .06], [ceP.x, yE + .045, ceP.z - .03]], "H");
    g.floor = new T.Mesh(new T.PlaneGeometry(8, 8), M.ground), g.floor.rotation.x = -Math.PI / 2, g.floor.position.y = yW - .36, g.floor.receiveShadow = !0, scene.add(g.floor);
    const v3 = (x2, y2, z2) => new T.Vector3(x2, y2, z2);
    g.names = [[v3(xCl, yIn + .075, 0), "Embrague multidisco de carbono"], [v3(xCl - .045, yIn - .04, 0), "Cojinete de empuje y cilindro hidráulico"], [v3(g.xs[1], yIn - rInM - .03, 0), "Primario (piñones tallados en el eje)"], [v3(g.xs[4], yOut + rOut + .02, 0), "Secundario (ruedas locas)"], [v3(g.xd[1], yOut, .05), "Anillo de garras"], [v3(g.xd[2], yR + .03, zR), "Horquilla y barra guía"], [v3(g.xs[5], yB - .04, zB), "Tambor de selección"], [v3(xRB - .03, yB + .085, zB), "Actuador hidráulico"], [v3(xFB, yIn - .05, 0), "Tabique con rodamientos", "case"], [v3(xb + .05, yOut - .055, 0), "Piñón cónico"], [v3(xb, yOut - .065, .05), "Rueda cónica y eje transversal"], [v3(xc + .03, yc + .125, -.06), "Reducción final"], [v3(xc, yc - .08, .08), "Diferencial: discos y pistón"], [v3(xc, yc - .03, .2), "Junta trípode"], [v3(xc - .13, yc + .1, 0), "Carcasa de carbono (estructural)", "case"], [g.pos.es.clone().add(v3(.2, .04, .2)), "Batería (ES)"], [g.ce.position.clone().add(v3(0, .09, 0)), "Electrónica de control (CE)"], [W(v3(eng.out.Xt, eng.out.ty + .11, 0)), "Turbina", "eng"], [W(v3(eng.out.Xc, eng.out.ty + .12, 0)), "Compresor", "eng"]];
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
    pickEl = document.createElement("div"), pickEl.className = "s3pick", pickEl.hidden = !0, host.appendChild(pickEl);
    st = { az: 1.05, el: .3, d: 1.2, t: new T.Vector3(-.37, .03, 0) };
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
    let down = null;
    cv.addEventListener("pointerdown", e => { down = [e.clientX, e.clientY] });
    const up = e => { ptr.delete(e.pointerId), pinch = null, ptr.size || (drag = null), down && e.type === "pointerup" && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 6 && pick(e), down = null };
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
    host.view = v => { Object.assign(st, { box: { az: 1.05, el: .3, d: 1.05, t: new T.Vector3(C.xm - .03, .03, 0) }, clutch: { az: 1.15, el: .25, d: .55, t: new T.Vector3(.1, C.yIn, 0) }, diff: { az: 2.2, el: .35, d: .9, t: new T.Vector3(C.xc + .05, C.yc - .03, 0) }, ers: { az: -.9, el: .45, d: 1.9, t: new T.Vector3(.75, 0, -.1) }, all: { az: .85, el: .4, d: 3.4, t: new T.Vector3(.12, .05, 0) } }[v] || {}), st.t = st.t.clone(), place() };
    host.casing = m => setCase(m), host.engine = m => setEngine(m), host.names = on => showNames = !!on;
    return !0
  }
  /* tocar una pieza: su ficha y sus datos en vivo */
  function pick(e) {
    const rc = new T.Raycaster, r = R.domElement.getBoundingClientRect();
    rc.setFromCamera(new T.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), cam);
    let pk = null;
    for (const h of rc.intersectObjects(scene.children, !0)) {
      let o = h.object, vis = !0, q = null;
      for (let a = o; a; a = a.parent) a.visible || (vis = !1), !q && a.userData && a.userData.pk && (q = a.userData.pk);
      if (!vis || !q || o.isInstancedMesh) continue;
      if (caseMode === "cut" && parts.caseParts.includes(o) && h.point.z > 0) continue;
      pk = q; break
    }
    picked = pk;
    if (!pk) { pickEl.hidden = !0; return }
    pickEl.hidden = !1, pickEl.innerHTML = `<b>${pk.name}</b><span>${pk.mat || ""}</span>${pk.info ? `<p>${pk.info}</p>` : ""}<i></i><button class="x" title="Cerrar">×</button>`;
    pickEl.querySelector(".x").onclick = () => { picked = null, pickEl.hidden = !0 }, livePick()
  }
  function livePick() { if (!picked || !lastS) return; const el = pickEl.querySelector("i"); el && (el.textContent = picked.live ? picked.live(lastS) : "") }
  function rebuild(geo) { if (!scene) return; P.geo = geo; picked = null, pickEl && (pickEl.hidden = !0); for (const o of [...scene.children]) o.isLight || eng && o === eng.grp || (scene.remove(o), o.traverse(m => m.geometry && m.geometry.dispose())); parts = build() }
  /* ---------- fotograma: s = estado instantáneo de la vuelta ---------- */
  function frame(s, dtReal) {
    if (!parts) return;
    const g = parts, k = s.rotK, tsc = s.tscale;
    lastS = s, ++nF % 8 === 0 && livePick();
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
    const wb = wOut * g.zb1 / g.zb2, wc = wb * g.zF1 / g.zF2;
    g.pinion.rotation.x -= wOut * dA, g.cross.rotation.z += wb * dA, g.diff.rotation.z -= wc * dA;
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
    const L = [[g.pos.mguk, `MGU-K ${s.Pk >= 0 ? "+" : "−"}${Math.abs(s.Pk / 1e3).toFixed(0)} kW`], [g.pos.es, `Batería ${(s.soc / 1e6).toFixed(2)} MJ`], [new T.Vector3(g.xs[s.gear], C.yOut + .115, 0), `${s.gear + 1}ª · ${Math.round(s.rpm)} rpm`], [new T.Vector3(C.xc, C.yc + .12, 0), `Bloqueo ${Math.round(s.lock)} N·m`], [g.shafts[1].grp.position.clone().add(new T.Vector3(.02, .07, .3)), `Palier ${(s.Tds / 2e3).toFixed(2)} kN·m`]];
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
