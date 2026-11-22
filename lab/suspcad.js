/* ===================== CONJUNTO DE SUSPENSIÓN Y FRENO, NIVEL CAD =====================
   Cada pieza se construye a su tamaño real (metros) sobre los puntos duros resueltos por LAB.kin3d y se mueve como un
   sólido rígido: trapecios (tubo de carbono de perfil aerodinámico con insertos de titanio pegados), rodamientos
   esféricos en horquillas atornilladas al monocasco, rótulas con su bola, mangueta mecanizada con alojamiento del
   rodamiento de rueda, horquillas para rótulas, bieleta, dirección y pinza, suplementos de caída, bieleta con rótulas,
   contratuerca y rosca de reglaje, balancín mecanizado con sus rodamientos, barra de torsión estriada, amortiguador
   con depósito y cuatro reguladores, disco de carbono ventilado con su campana, pinza monobloque de seis pistones con
   pastillas, conducto de refrigeración, buje, llanta y neumático.
   Cada sólido se construye una vez en la postura estática (coordenadas del mundo) y en cada fotograma recibe la
   transformación rígida que lleva tres de sus puntos estáticos a los resueltos: así todo encaja en sus ejes.
   Comprobaciones de ingeniería: ángulo de desalineación de cada rótula frente a su límite, holgura de la llanta y del
   neumático con trapecios, bieletas, mangueta y pinza en todo el recorrido y con el volante a tope, cortante doble en
   cada tornillo, carga radial de cada rótula frente a su capacidad y pandeo de Euler de las barras comprimidas. */
LAB.suspcad = (() => {
  let T, M = null, TEX = null;
  const DEGc = Math.PI / 180;
  /* coche (x adelante, y derecha, z arriba) → Three (X adelante, Y arriba, Z derecha), lado izquierdo espejado */
  const W = (p, side) => new T.Vector3(p[0], p[2], p[1] * side);
  const X3 = () => new T.Vector3(1, 0, 0), Y3 = () => new T.Vector3(0, 1, 0);

  /* ---------- materiales ---------- */
  function carbonTex() {
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const g = c.getContext("2d");
    g.fillStyle = "#1a1c1f", g.fillRect(0, 0, 64, 64);
    /* sarga 2×2 */
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const on = ((x + y) >> 1) % 2 === 0, gr = g.createLinearGradient(x * 8, y * 8, x * 8 + (on ? 8 : 0), y * 8 + (on ? 0 : 8));
      gr.addColorStop(0, on ? "#2b2f34" : "#202327"), gr.addColorStop(.5, on ? "#3a3f45" : "#2a2d31"), gr.addColorStop(1, on ? "#24272b" : "#1c1e21");
      g.fillStyle = gr, g.fillRect(x * 8 + .4, y * 8 + .4, 7.2, 7.2)
    }
    const t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping, t.colorSpace = T.SRGBColorSpace, t.anisotropy = 4;
    return t
  }
  function mats() {
    TEX = carbonTex();
    const S = o => new T.MeshStandardMaterial(o), Ph = o => new T.MeshPhysicalMaterial(o);
    const cf = TEX.clone(); cf.needsUpdate = !0, cf.repeat.set(2, 18);
    return {
      carbon: Ph({ color: "#ffffff", map: cf, metalness: .25, roughness: .38, clearcoat: 1, clearcoatRoughness: .08 }),
      ti: S({ color: "#8e8a85", metalness: 1, roughness: .34 }), tiDark: S({ color: "#5d5a57", metalness: 1, roughness: .42 }),
      steel: S({ color: "#c4cad0", metalness: 1, roughness: .22 }), bolt: S({ color: "#9aa0a6", metalness: 1, roughness: .3 }),
      chrome: S({ color: "#eef1f4", metalness: 1, roughness: .05 }), alu: S({ color: "#b1b7bd", metalness: .95, roughness: .3 }),
      aluBlk: S({ color: "#2d3136", metalness: .8, roughness: .35 }), aluBlue: S({ color: "#2a62c9", metalness: .85, roughness: .32 }),
      bronze: S({ color: "#b0813c", metalness: 1, roughness: .35 }), ball: S({ color: "#d9dde1", metalness: 1, roughness: .08 }),
      rubber: S({ color: "#17181a", roughness: .9, metalness: 0 }), tread: S({ color: "#26272a", roughness: .93, metalness: 0 }),
      boot: S({ color: "#121314", roughness: .7, metalness: 0 }), hose: S({ color: "#3b3f44", roughness: .6, metalness: .4 }),
      rim: S({ color: "#24272b", metalness: .85, roughness: .3, side: T.DoubleSide }), mag: S({ color: "#2b2f34", metalness: .8, roughness: .32 }),
      disc: S({ color: "#33302d", metalness: .15, roughness: .78, emissive: "#000000" }), vent: S({ color: "#080808", roughness: 1 }),
      caliper: S({ color: "#7b1d18", metalness: .55, roughness: .32 }), piston: S({ color: "#c9ced3", metalness: 1, roughness: .2 }),
      pad: S({ color: "#4a4440", metalness: .2, roughness: .85 }), padBack: S({ color: "#8a8f94", metalness: .9, roughness: .4 }),
      damper: S({ color: "#c79a1e", metalness: .85, roughness: .3 }), knobR: S({ color: "#c0392b", metalness: .6, roughness: .35 }),
      knobB: S({ color: "#2e6fd8", metalness: .6, roughness: .35 }), stop: S({ color: "#e0b400", roughness: .6, metalness: 0 }),
      spring: S({ color: "#d4482a", metalness: .7, roughness: .35 }), shim: S({ color: "#b9bec4", metalness: 1, roughness: .25 }),
      duct: Ph({ color: "#ffffff", map: TEX, metalness: .2, roughness: .4, transparent: !0, opacity: .5, depthWrite: !1, side: T.DoubleSide, clearcoat: .6 }),
      mono: Ph({ color: "#3a4350", metalness: .25, roughness: .3, clearcoat: 1, transparent: !0, opacity: .16, depthWrite: !1, side: T.DoubleSide }),
      bracket: S({ color: "#6e737a", metalness: 1, roughness: .38 }), stripe: new T.MeshBasicMaterial({ color: "#ffd23f" }),
      compound: S({ color: "#d63a2f", roughness: .6, metalness: 0 })
    }
  }

  /* ---------- utilidades geométricas ---------- */
  const v3 = a => a.clone();
  function basisM(x, y, pos) {
    y = y.clone().normalize();
    let xx = x.clone().addScaledVector(y, -x.dot(y));
    if (xx.lengthSq() < 1e-10) xx = Math.abs(y.x) < .9 ? X3().addScaledVector(y, -y.x) : new T.Vector3(0, 0, 1).addScaledVector(y, -y.z);
    xx.normalize();
    const z = new T.Vector3().crossVectors(xx, y);
    const m = new T.Matrix4().makeBasis(xx, y, z);
    pos && m.setPosition(pos);
    return m
  }
  /* geometría local (eje Y) llevada a: origen pos, eje Y → dir, eje X → xh */
  const put = (geo, pos, dir, xh) => geo.applyMatrix4(basisM(xh || X3(), dir, pos));
  /* transformación rígida que lleva (a0,b0,c0) a (a1,b1,c1) */
  function frame3(a, b, c) {
    const e1 = b.clone().sub(a).normalize(), w = c.clone().sub(a), e2 = w.addScaledVector(e1, -w.dot(e1)).normalize(), e3 = new T.Vector3().crossVectors(e1, e2);
    return new T.Matrix4().makeBasis(e1, e2, e3).setPosition(a)
  }
  const rigid = (a0, b0, c0, a1, b1, c1) => frame3(a1, b1, c1).multiply(frame3(a0, b0, c0).invert());
  function lathe(prof, seg) { return new T.LatheGeometry(prof.map(([r, y]) => new T.Vector2(Math.max(0, r), y)), seg || 32) }
  /* anillo (alojamiento) de radio exterior ro, interior ri y ancho w, eje Y */
  const ringGeo = (ro, ri, w, seg) => lathe([[ri, -w / 2], [ro - .0012, -w / 2], [ro, -w / 2 + .0012], [ro, w / 2 - .0012], [ro - .0012, w / 2], [ri, w / 2], [ri, -w / 2]], seg || 28);
  const cyl = (r, h, seg) => new T.CylinderGeometry(r, r, h, seg || 20);
  const hex = (r, h) => new T.CylinderGeometry(r, r, h, 6);
  /* perfil NACA 00tt de cuerda c y espesor relativo t: puntos (x a lo largo de la cuerda centrada, z) */
  function naca(c, t, n) {
    const up = [];
    for (let i = 0; i <= n; i++) {
      const b = i / n * Math.PI, x = (1 - Math.cos(b)) / 2, y = 5 * t * (.2969 * Math.sqrt(x) - .126 * x - .3516 * x * x + .2843 * x ** 3 - .1036 * x ** 4);
      up.push([(x - .42) * c, y * c])
    }
    const pts = up.concat(up.slice(1, -1).reverse().map(([x, y]) => [x, -y]));
    return pts
  }
  /* tubo barrido a lo largo de Y (0..L) con sección NACA que se estrecha de (c0,t0) a (c1,t1) */
  function aeroTube(L, c0, c1, t, n) {
    const sec0 = naca(1, t, n || 10), m = sec0.length, rings = 12, pos = [], uv = [], idx = [];
    for (let k = 0; k <= rings; k++) {
      const f = k / rings, c = c0 + (c1 - c0) * f, y = L * f;
      for (let i = 0; i <= m; i++) { const [x, z] = sec0[i % m]; pos.push(x * c, y, z * c), uv.push(i / m, f * L * 6) }
    }
    for (let k = 0; k < rings; k++) for (let i = 0; i < m; i++) { const a = k * (m + 1) + i, b = a + m + 1; idx.push(a, b, a + 1, b, b + 1, a + 1) }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(pos, 3)), g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2)), g.setIndex(idx), g.computeVertexNormals();
    return g
  }
  /* viga de sección rectangular redondeada que se estrecha entre A y B (mundo); up orienta el canto */
  function beam(A, B, w0, h0, w1, h1, up, r) {
    const d = B.clone().sub(A), L = d.length(), m = basisM(up, d, A), pos = [], idx = [], seg = 5, sec = [];
    r = r || .35;
    for (let q = 0; q < 4; q++) for (let s = 0; s <= seg; s++) { const a = (q + s / seg) * Math.PI / 2; sec.push([Math.cos(a), Math.sin(a), q]) }
    const n = sec.length, rings = 6;
    for (let k = 0; k <= rings; k++) {
      const f = k / rings, w = (w0 + (w1 - w0) * f) / 2, h = (h0 + (h1 - h0) * f) / 2, rr = Math.min(w, h) * r;
      for (const [cx, cz, q] of sec) { const sx = q === 0 || q === 3 ? 1 : -1, sz = q < 2 ? 1 : -1; pos.push(sx * (w - rr) + cx * rr, f * L, sz * (h - rr) + cz * rr) }
    }
    for (let k = 0; k < rings; k++) for (let i = 0; i < n; i++) { const a = k * n + i, b = a + n, a1 = k * n + (i + 1) % n, b1 = a1 + n; idx.push(a, b, a1, b, b1, a1) }
    const c0 = pos.length / 3; pos.push(0, 0, 0); const c1 = pos.length / 3; pos.push(0, L, 0);
    for (let i = 0; i < n; i++) idx.push(c0, (i + 1) % n, i), idx.push(c1, rings * n + i, rings * n + (i + 1) % n);
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(pos, 3)), g.setIndex(idx), g.computeVertexNormals();
    return g.applyMatrix4(m)
  }
  /* oreja de horquilla: placa con extremo semicircular y taladro, en el plano XY, grosor t en Z */
  function lugGeo(w, h, hole, t) {
    const s = new T.Shape();
    s.moveTo(-w / 2, -h), s.lineTo(w / 2, -h), s.lineTo(w / 2, 0), s.absarc(0, 0, w / 2, 0, Math.PI, !1), s.lineTo(-w / 2, -h);
    const ho = new T.Path(); ho.absarc(0, 0, hole, 0, Math.PI * 2, !0), s.holes.push(ho);
    const g = new T.ExtrudeGeometry(s, { depth: t, bevelEnabled: !0, bevelSize: Math.min(.0012, t * .2), bevelThickness: Math.min(.0012, t * .2), bevelSegments: 1, curveSegments: 14 });
    return g.translate(0, 0, -t / 2)
  }
  const mesh = (g, m, info) => { const o = new T.Mesh(g, m); o.castShadow = o.receiveShadow = !0; info && (o.userData.part = info); return o };
  /* tornillo pasante de diámetro d y longitud L a lo largo de Y (cabeza hexagonal, arandelas, tuerca) */
  function boltGeos(d, L) {
    const gs = [cyl(d / 2, L, 14), hex(d * .85, d * .62).translate(0, L / 2 + d * .31, 0), hex(d * .85, d * .75).translate(0, -L / 2 - d * .37, 0),
      ringGeo(d * 1.05, d * .52, d * .14, 18).translate(0, L / 2 + d * .07 - d * .14, 0), ringGeo(d * 1.05, d * .52, d * .14, 18).translate(0, -L / 2 - d * .07 + d * .14, 0)];
    return gs
  }
  const merge = gs => T.BufferGeometryUtils.mergeGeometries(gs.map(g => g.index ? g.toNonIndexed() : g), !1);
  /* rodamiento esférico: alojamiento (anillo) + bola truncada; eje Y */
  function sphBearing(d) {
    const ball = new T.SphereGeometry(d * .95, 18, 12, 0, Math.PI * 2, Math.PI * .28, Math.PI * .44);
    return { house: ringGeo(d * 1.55, d * .92, d * 1.15, 26), ball, bore: ringGeo(d * .52, d * .5, d * 1.5, 14) }
  }
  /* rótula de bieleta (rod end): ojo con anillo, cuello y vástago roscado hacia -Y; eje del ojo Z */
  function rodEndGeo(d, shank) {
    const eye = ringGeo(d * 1.45, d * .9, d * 1.0, 24).rotateX(Math.PI / 2);
    const neck = new T.CylinderGeometry(d * .62, d * .8, d * 1.2, 16).translate(0, -d * 1.6, 0);
    const thr = new T.CylinderGeometry(d * .5, d * .5, shank, 16).translate(0, -d * 2.2 - shank / 2, 0);
    const rings = [];
    for (let i = 0; i < 7; i++) rings.push(new T.TorusGeometry(d * .5, d * .06, 5, 16).rotateX(Math.PI / 2).translate(0, -d * 2.3 - i * shank / 7, 0));
    const nut = hex(d * .9, d * .55).translate(0, -d * 2.2 - shank * .35, 0);
    return { body: merge([eye, neck]), thread: merge([thr, ...rings]), nut }
  }

  /* ---------- especificación por defecto (tamaños reales) ---------- */
  function specOf(o) {
    const s = Object.assign({
      dWb: .010, dBj: .012, dPr: .010, dTr: .008, dDp: .008,
      disc: .328, discT: .032, discIn: .218, caliperAng: 215, rimR: .2286, rimW: .31, tyreW: .305, tyreR: .36,
      prOD: .022, prID: .019, trOD: .016, trID: .012, shims: 4, shimT: .0005, compound: "M"
    }, o || {});
    return s
  }

  /* ---------- conjunto de una esquina ---------- */
  function buildCorner(scene, K, side, sp) {
    const g = K.g3, s0 = K.mid, P = p => W(p, side), S = sp;
    const A = {
      side, g, sol0: s0, root: new T.Group(), parts: [], joints: [], groups: {}, prevAng: 0, spin: 0
    };
    scene.add(A.root);
    const grp = (name, ex) => { const o = new T.Group(); o.matrixAutoUpdate = !1, o.userData.ex = ex || new T.Vector3(), A.root.add(o), A.groups[name] = o; return o };
    const add = (gr, geo, mat, info) => { const o = mesh(geo, mat, info); gr.add(o); info && A.parts.push(o); return o };
    const out = new T.Vector3(0, 0, side);
    const LF = P(g.LF), LR = P(g.LR), UF = P(g.UF), UR = P(g.UR), LO0 = P(s0.LO), UO0 = P(s0.UO), TO0 = P(s0.TO), TI0 = P(s0.TI), PO0 = P(s0.PO), RA0 = P(s0.RA), RP = P(g.RP), RD0 = P(s0.RD), SD = P(g.SD), WC0 = P(s0.WC), sAx0 = W(s0.s, side).normalize(), k0 = UO0.clone().sub(LO0).normalize();
    const spinOut = side > 0 ? sAx0.clone() : sAx0.clone().negate(); /* eje de giro hacia fuera */
    A.pt0 = { LF, LR, UF, UR, LO0, UO0, TO0, TI0, PO0, RA0, RP, RD0, SD, WC0, sAx0: spinOut, k0 };
    /* ===== trapecios ===== */
    const wish = (name, F, R, O, aAx, c0, c1, lbl, ex) => {
      const G = grp(name, ex), axis = R.clone().sub(F).normalize();
      for (const [I, nm] of [[F, "delantero"], [R, "trasero"]]) {
        const d = O.clone().sub(I), L = d.length(), u = d.clone().normalize(), Ls = L - .045 - .05;
        /* tubo de carbono: cuerda en la dirección de la marcha */
        const tube = aeroTube(Ls, c0, c1, .33);
        put(tube, I.clone().addScaledVector(u, .045), u, X3());
        add(G, tube, M.carbon, { name: lbl + ", brazo " + nm, mat: "Fibra de carbono (prepreg alto módulo), perfil NACA 0033", kg: .32 * L, info: "Tubo de perfil aerodinámico: la cuerda va alineada con el aire para no ensuciar el flujo hacia los pontones. Trabaja a tracción/compresión." });
        /* insertos de titanio pegados en los extremos */
        const ins = cyl(c0 * .2, .03, 16); put(ins, I.clone().addScaledVector(u, .03), u, X3());
        add(G, ins, M.ti);
        /* ojo con rodamiento esférico (eje = componente del eje de giro perpendicular al brazo) */
        let b0 = axis.clone().addScaledVector(u, -axis.dot(u)); b0.lengthSq() < 1e-6 && b0.set(0, 1, 0); b0.normalize();
        const sb = sphBearing(S.dWb);
        add(G, put(sb.house.clone(), I, b0, u), M.ti, { name: lbl + ", rodamiento esférico " + nm, mat: "Titanio Ti-6Al-4V con pista de bronce-PTFE", kg: .06, info: "Rodamiento esférico prensado en el ojo del brazo; permite el pequeño giro fuera del eje del tornillo." });
        const neck = beam(I.clone().addScaledVector(u, S.dWb * 1.2), I.clone().addScaledVector(u, .05), S.dWb * 1.6, S.dWb * 1.2, c0 * .45, c0 * .2, b0, .45);
        add(G, neck, M.ti);
        A.joints.push({ key: name + nm, name: lbl + " " + nm + " (chasis)", kind: "esf", lim: 10, bodyA: "chassis", bodyB: name, b0: b0.clone(), P0: I.clone(), d: S.dWb, rate: 52e3 });
        /* horquilla del chasis con tornillo pasante (no se mueve) */
        const C = grp(name + "Brk" + nm, out.clone().multiplyScalar(-.06));
        const gap = S.dWb * 1.25, lug = lugGeo(S.dWb * 2.6, .034, S.dWb * .5, .005);
        let yb = out.clone().addScaledVector(b0, -out.dot(b0)).normalize();
        const bm = basisM(new T.Vector3().crossVectors(yb, b0), yb, I);
        for (const sgn of [1, -1]) { const lg = lug.clone().applyMatrix4(new T.Matrix4().makeTranslation(0, 0, sgn * (gap / 2 + .0025))); lg.applyMatrix4(bm); add(C, lg, M.bracket, { name: "Horquilla de anclaje al monocasco (" + lbl.toLowerCase() + ", " + nm + ")", mat: "Acero 17-4PH mecanizado", kg: .09, info: "Dos orejas con el tornillo en doble cortadura; la base va atornillada con insertos al monocasco." }) }
        const base = new T.BoxGeometry(S.dWb * 4.4, .006, gap + .022).translate(0, -.034, 0).applyMatrix4(bm);
        add(C, base, M.bracket);
        for (const [bx, bz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(C, hex(.0045, .004).translate(bx * S.dWb * 1.6, -.03, bz * (gap / 2 + .007)).applyMatrix4(bm), M.bolt);
        const bt = merge(boltGeos(S.dWb * .8, gap + .016)); put(bt, I, b0, u); add(C, bt, M.bolt, { name: "Tornillo pasante M" + Math.round(S.dWb * 800) + " (" + lbl.toLowerCase() + ", " + nm + ")", mat: "MP35N (níquel-cobalto), 1 790 MPa", kg: .02, info: "Trabaja en doble cortadura: la carga del brazo se reparte entre dos secciones." });
        add(C, put(sb.ball.clone(), I, b0, u), M.ball);
      }
      /* nudo exterior de titanio con la rótula (eje = pivote de la mangueta) */
      const node = new T.SphereGeometry(.026, 20, 14); node.scale(1.15, .8, 1.15); node.translate(O.x, O.y, O.z);
      add(G, node, M.ti, { name: lbl + ", nudo exterior", mat: "Titanio impreso (fusión láser) y mecanizado", kg: .18, info: "Une los dos brazos y aloja la rótula que va a la mangueta." });
      const bj = sphBearing(S.dBj);
      add(G, put(bj.house.clone(), O, k0, X3()), M.tiDark);
      A.joints.push({ key: name + "O", name: "Rótula " + (name === "lw" ? "inferior" : "superior") + " (mangueta)", kind: "bj", lim: 22, bodyA: "up", bodyB: name, b0: k0.clone(), P0: O.clone(), d: S.dBj, rate: 95e3 });
      return G
    };
    wish("lw", LF, LR, LO0, null, .062, .046, "Trapecio inferior", new T.Vector3(0, -.09, 0));
    wish("uw", UF, UR, UO0, null, .054, .04, "Trapecio superior", new T.Vector3(0, .1, 0));

    /* ===== mangueta, buje, freno y rueda ===== */
    const U = grp("up", new T.Vector3());
    const hubC = WC0.clone().addScaledVector(spinOut, -.075);
    const upHint = Y3();
    add(U, put(ringGeo(.078, .05, .072, 40), hubC, spinOut, X3()), M.ti, { name: "Mangueta (alojamiento del rodamiento)", mat: "Titanio Ti-6Al-4V impreso y mecanizado", kg: 2.6, info: "Sólido rígido que une las dos rótulas, el brazo de dirección y la bieleta; aloja el rodamiento de la rueda y sujeta la pinza." });
    add(U, put(ringGeo(.05, .036, .05, 32), hubC, spinOut, X3()), M.steel, { name: "Rodamiento de rueda (doble hilera de bolas cerámicas)", mat: "Acero M50 / nitruro de silicio", kg: .55, info: "Soporta la carga vertical, lateral y el par de frenada transmitido por el buje." });
    const edge = (Pt, w) => { const d = Pt.clone().sub(hubC); d.addScaledVector(spinOut, -d.dot(spinOut)); return hubC.clone().addScaledVector(d.normalize(), w) };
    for (const [Pt, w0, h0, w1, h1, nm] of [[UO0, .07, .046, .04, .028, "brazo superior"], [LO0, .078, .05, .044, .03, "brazo inferior"], [TO0, .042, .03, .026, .02, "brazo de dirección"], [PO0, .044, .032, .03, .022, "soporte de la bieleta"]]) {
      const a = edge(Pt, .064), b = Pt.clone().addScaledVector(Pt.clone().sub(a).normalize(), -.016);
      add(U, beam(a, b, w0, h0, w1, h1, spinOut, .45), M.ti, { name: "Mangueta, " + nm, mat: "Titanio Ti-6Al-4V", kg: .3, info: "Brazo mecanizado con vaciados; termina en una horquilla para la rótula." });
    }
    /* alma de la mangueta: une los brazos superior e inferior por detrás del alojamiento, como en una pieza fundida */
    {
      const inb = spinOut.clone().multiplyScalar(-.012), up0 = edge(UO0, .05).add(inb), lo0 = edge(LO0, .05).add(inb);
      add(U, beam(lo0, up0, .05, .022, .05, .022, X3().addScaledVector(spinOut, -X3().dot(spinOut)), .4), M.ti, { name: "Mangueta, alma central", mat: "Titanio Ti-6Al-4V", kg: .4, info: "Une los dos brazos por el lado interior; con los nervios da la rigidez a flexión que pide la carga de frenada." });
    }
    /* horquillas de la mangueta con su tornillo */
    const uClev = (Pt, ax, d, nm, kind) => {
      const lug = lugGeo(d * 2.6, .026, d * .5, .0045), gap = d * (kind === "bj" ? 1.3 : 1.2), toC = hubC.clone().sub(Pt);
      let yb = toC.clone().addScaledVector(ax, -toC.dot(ax)).normalize().negate();
      const bm = basisM(new T.Vector3().crossVectors(yb, ax), yb, Pt);
      for (const sgn of [1, -1]) add(U, lug.clone().applyMatrix4(new T.Matrix4().makeTranslation(0, 0, sgn * (gap / 2 + .00225))).applyMatrix4(bm), M.ti);
      add(U, put(merge(boltGeos(d * .8, gap + .014)), Pt, ax, X3()), M.bolt, { name: "Tornillo de " + nm, mat: "MP35N", kg: .015, info: "Une la rótula con la horquilla de la mangueta en doble cortadura." });
      kind === "bj" && add(U, put(sphBearing(d).ball.clone(), Pt, ax, X3()), M.ball);
    };
    uClev(LO0, k0, S.dBj, "rótula inferior", "bj"), uClev(UO0, k0, S.dBj, "rótula superior", "bj");
    /* suplementos de caída bajo la horquilla superior */
    const shDir = UO0.clone().sub(hubC).normalize();
    for (let i = 0; i < S.shims; i++) add(U, put(ringGeo(.017, .006, S.shimT * .9, 20), UO0.clone().addScaledVector(shDir, -.03 - i * S.shimT * 1.25), shDir, X3()), M.shim, { name: "Suplemento de caída (" + S.shims + " × " + (S.shimT * 1e3).toFixed(2) + " mm)", mat: "Acero inoxidable rectificado", kg: .002, info: "Cada suplemento desplaza la rótula superior hacia fuera y cambia la caída unos 0,1°; se quitan o añaden sin tocar la geometría." });
    /* ejes de las rótulas de bieleta y dirección: perpendiculares a la barra, fijos en la mangueta */
    const perp = (dir, hint) => { const h = hint.clone().addScaledVector(dir, -hint.dot(dir)); return h.lengthSq() < 1e-8 ? new T.Vector3(0, 0, 1) : h.normalize() };
    const prDir0 = RA0.clone().sub(PO0).normalize(), trDir0 = TI0.clone().sub(TO0).normalize();
    const bPO = S.axes && S.axes.PO ? W(S.axes.PO, side).normalize() : perp(prDir0, X3()), bTO = S.axes && S.axes.TO ? W(S.axes.TO, side).normalize() : perp(trDir0, Y3());
    uClev(PO0, bPO, S.dPr, "la bieleta", "re"), uClev(TO0, bTO, S.dTr, "la bieleta de dirección", "re");
    A.joints.push({ key: "PO", name: "Rótula de la bieleta (mangueta)", kind: "re", lim: 20, bodyA: "up", link: "pr", end: 0, b0: bPO.clone(), P0: PO0.clone(), d: S.dPr, rate: 48e3 });
    A.joints.push({ key: "TO", name: "Rótula de dirección (mangueta)", kind: "re", lim: 20, bodyA: "up", link: "tr", end: 0, b0: bTO.clone(), P0: TO0.clone(), d: S.dTr, rate: 30e3 });
    /* pinza radial de seis pistones, pastillas y conducto (fijos a la mangueta) */
    const discC = WC0.clone().addScaledVector(spinOut, -.105), Rd = S.disc / 2, ang = S.caliperAng * DEGc;
    const fw = X3().addScaledVector(spinOut, -X3().dot(spinOut)).normalize(), upv = new T.Vector3().crossVectors(spinOut, fw).normalize().multiplyScalar(side > 0 ? 1 : -1);
    const radial = fw.clone().multiplyScalar(Math.cos(ang)).addScaledVector(upv, Math.sin(ang)).normalize(), tang = new T.Vector3().crossVectors(radial, spinOut).normalize();
    const calG = grp("cal", spinOut.clone().multiplyScalar(.12).addScaledVector(radial, .05));
    U.add(calG), A.root.remove(calG), calG.matrixAutoUpdate = !0;
    const cb = new T.Matrix4().makeBasis(tang, radial, spinOut).setPosition(discC);
    const sector = (r0, r1, a0, a1, th, z0) => { const sh = new T.Shape(); sh.absarc(0, 0, r1, a0, a1, !1), sh.absarc(0, 0, r0, a1, a0, !0); return new T.ExtrudeGeometry(sh, { depth: th, bevelEnabled: !0, bevelSize: .002, bevelThickness: .002, bevelSegments: 2, curveSegments: 18 }).translate(0, 0, z0) };
    const halfA = .3, cs = (S.discT / 2 + .004);
    for (const sg of [1, -1]) {
      add(calG, sector(Rd - .062, Rd + .018, Math.PI / 2 - halfA, Math.PI / 2 + halfA, .028, sg > 0 ? cs : -cs - .028).applyMatrix4(cb), M.caliper, { name: "Pinza monobloque de 6 pistones (mitad " + (sg > 0 ? "exterior" : "interior") + ")", mat: "Aleación aluminio-litio mecanizada de un bloque", kg: 1.1, info: "Montaje radial con dos tornillos a la mangueta. Tres pistones de distinto diámetro por lado para repartir la presión a lo largo de la pastilla." });
      for (let i = -1; i <= 1; i++) { const a = Math.PI / 2 + i * halfA * .62, rr = Rd - .03, pc = new T.Vector3(Math.cos(a) * rr, Math.sin(a) * rr, sg * (S.discT / 2 + .01)); add(calG, cyl(.0135 + .002 * (i + 1) / 2, .014, 18).rotateX(Math.PI / 2).translate(pc.x, pc.y, pc.z).applyMatrix4(cb), M.piston, { name: "Pistón de la pinza (Ø " + Math.round((.027 + .004 * (i + 1) / 2) * 1e3) + " mm)", mat: "Titanio con aislante cerámico", kg: .03, info: "La presión hidráulica empuja la pastilla contra el disco. F = p·A por pistón." }) }
      add(calG, sector(Rd - .055, Rd - .004, Math.PI / 2 - halfA * .9, Math.PI / 2 + halfA * .9, .012, sg > 0 ? S.discT / 2 + .0005 : -S.discT / 2 - .0125).applyMatrix4(cb), M.pad, { name: "Pastilla de carbono-carbono", mat: "Carbono-carbono (C/C)", kg: .12, info: "Coeficiente de fricción ≈ 0,5–0,7 entre 350 y 1 000 °C; por debajo de 300 °C apenas frena." });
    }
    add(calG, new T.BoxGeometry(.03, .022, S.discT + .07).translate(0, Rd + .012, 0).applyMatrix4(new T.Matrix4().makeRotationZ(halfA * .95)).applyMatrix4(cb), M.caliper);
    add(calG, new T.BoxGeometry(.03, .022, S.discT + .07).translate(0, Rd + .012, 0).applyMatrix4(new T.Matrix4().makeRotationZ(-halfA * .95)).applyMatrix4(cb), M.caliper);
    /* latiguillo de freno hasta el chasis */
    const hoseA = discC.clone().addScaledVector(radial, Rd + .02).addScaledVector(spinOut, -cs - .02), hoseB = hoseA.clone().addScaledVector(spinOut, -.12).add(new T.Vector3(0, .05, 0));
    add(calG, new T.TubeGeometry(new T.CatmullRomCurve3([hoseA, hoseA.clone().lerp(hoseB, .5).add(new T.Vector3(0, .03, 0)), hoseB]), 16, .0035, 8), M.hose, { name: "Latiguillo de freno", mat: "PTFE con malla de acero", kg: .05, info: "Lleva el líquido (DOT 5.1 de alto punto de ebullición) desde la bomba hasta la pinza." });
    /* conducto de freno (tambor) con toma */
    const duct = grp("duct", spinOut.clone().multiplyScalar(.04)); U.add(duct), A.root.remove(duct), duct.matrixAutoUpdate = !0;
    add(duct, put(new T.CylinderGeometry(Rd + .03, Rd + .03, .1, 48, 1, !0), discC.clone().addScaledVector(spinOut, -.005), spinOut, X3()), M.duct, { name: "Conducto de freno (tambor)", mat: "Fibra de carbono", kg: .6, info: "Guía el aire de la toma hacia el disco y la pinza; su tamaño se elige por circuito (más frío = menos arrastre)." });
    const scoop = new T.CylinderGeometry(.035, .05, .16, 20, 1, !0); scoop.scale(1, 1, .6);
    add(duct, put(scoop, discC.clone().addScaledVector(fw, Rd + .08).addScaledVector(upv, -.06).addScaledVector(spinOut, -.03), fw.clone().negate(), spinOut), M.duct);
    /* ---- grupo que gira: buje, campana, disco, llanta y neumático ---- */
    const SP = new T.Group(); SP.matrixAutoUpdate = !1, U.add(SP), A.groups.spin = SP, SP.userData.ex = spinOut.clone().multiplyScalar(.28);
    const addS = (geo, mat, info) => { const o = mesh(geo, mat, info); SP.add(o); info && A.parts.push(o); return o };
    addS(put(cyl(.034, .2, 24), WC0.clone().addScaledVector(spinOut, -.01), spinOut, X3()), M.steel, { name: "Buje (mangueta de rueda)", mat: "Acero maraging", kg: 1.2, info: "Gira dentro del rodamiento y transmite par de frenada al disco por las garras de la campana." });
    /* brida del buje con los pasadores de arrastre de la llanta */
    const flC = WC0.clone().addScaledVector(spinOut, S.rimW / 2 - .085);
    addS(put(cyl(.062, .012, 36), flC, spinOut, X3()), M.steel, { name: "Brida del buje y pasadores de arrastre", mat: "Acero maraging", kg: .3, info: "Seis pasadores transmiten el par a la llanta; la tuerca central solo la aprieta contra la brida." });
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, dirR = fw.clone().multiplyScalar(Math.cos(a)).addScaledVector(upv, Math.sin(a)); addS(put(cyl(.0055, .03, 12), flC.clone().addScaledVector(dirR, .047).addScaledVector(spinOut, .015), spinOut, X3()), M.ti) }
    /* disco ventilado */
    const DG = new T.Group(); SP.add(DG), DG.userData.ex = spinOut.clone().multiplyScalar(-.1), DG.matrixAutoUpdate = !0;
    const discGeo = put(ringGeo(Rd, S.discIn / 2, S.discT, 96), discC, spinOut, X3());
    A.disc = mesh(discGeo, M.disc.clone(), { name: "Disco de carbono-carbono Ø" + Math.round(S.disc * 1e3) + " × " + Math.round(S.discT * 1e3) + " mm", mat: "Carbono-carbono", kg: 1.2, info: "Más de mil taladros radiales de ventilación. Trabaja entre 350 y 1 000 °C; por encima se oxida y pierde espesor." });
    DG.add(A.disc), A.parts.push(A.disc);
    const nH = 168, rows = 4, inst = new T.InstancedMesh(new T.CircleGeometry(.0017, 8), M.vent, nH * rows), mm = new T.Matrix4(), q = new T.Quaternion();
    let ii = 0;
    for (let r = 0; r < rows; r++) for (let i = 0; i < nH; i++) {
      const a = (i + (r % 2) * .5) / nH * Math.PI * 2, dirR = fw.clone().multiplyScalar(Math.cos(a)).addScaledVector(upv, Math.sin(a)), p = discC.clone().addScaledVector(dirR, Rd + 2e-4).addScaledVector(spinOut, (r - (rows - 1) / 2) * S.discT / (rows + .6));
      q.setFromUnitVectors(new T.Vector3(0, 0, 1), dirR), mm.compose(p, q, new T.Vector3(1, 1, 1)), inst.setMatrixAt(ii++, mm)
    }
    DG.add(inst);
    /* campana con garras */
    const bellC = discC.clone().addScaledVector(spinOut, .03);
    /* campana: sombrero mecanizado que une el buje con el disco por sus garras */
    const ri = S.discIn / 2 - .004, bellProf = [[.04, .022], [.06, .022], [.06, .016], [ri - .006, .006], [ri, -.012], [ri, -.03], [ri - .006, -.03], [ri - .006, -.014], [.056, .012], [.04, .012]];
    DG.add(mesh(put(lathe(bellProf, 48), bellC, spinOut, X3()), M.alu, { name: "Campana del disco", mat: "Aluminio-litio o titanio", kg: .35, info: "Lleva el par de frenada del disco al buje por doce garras radiales que dejan dilatar el disco sin tensiones." }));
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, dirR = fw.clone().multiplyScalar(Math.cos(a)).addScaledVector(upv, Math.sin(a)); DG.add(mesh(put(new T.BoxGeometry(.012, .016, .012), discC.clone().addScaledVector(dirR, S.discIn / 2 - .002), dirR, spinOut), M.ti)) }
    /* llanta de 18" */
    const RG = new T.Group(); SP.add(RG), RG.userData.ex = spinOut.clone().multiplyScalar(.12), RG.matrixAutoUpdate = !0;
    const rw = S.rimW, rb = S.rimR, rimProf = [[rb - .006, -rw / 2], [rb + .012, -rw / 2 - .004], [rb + .016, -rw / 2 + .006], [rb + .002, -rw / 2 + .014], [rb, -rw / 2 + .03], [rb - .022, -rw / 2 + .07], [rb - .022, rw / 2 - .11], [rb, rw / 2 - .05], [rb + .002, rw / 2 - .014], [rb + .016, rw / 2 - .006], [rb + .012, rw / 2 + .004], [rb - .006, rw / 2]];
    const rimG = lathe(rimProf, 96);
    RG.add(A.rim = mesh(put(rimG, WC0, spinOut, X3()), M.rim, { name: "Llanta de 18\" forjada", mat: "Magnesio forjado", kg: 3.6, info: "Un solo bloque forjado y mecanizado; diámetro de asiento 457 mm." })), A.parts.push(A.rim);
    const spokeOut = WC0.clone().addScaledVector(spinOut, rw / 2 - .07);
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2, dirR = fw.clone().multiplyScalar(Math.cos(a)).addScaledVector(upv, Math.sin(a));
      const sA = spokeOut.clone().addScaledVector(dirR, .052).addScaledVector(spinOut, .03), sB = spokeOut.clone().addScaledVector(dirR, rb - .02);
      RG.add(mesh(beam(sA, sB, .03, .02, .022, .012, spinOut, .45), M.mag, null))
    }
    RG.add(mesh(put(cyl(.058, .05, 36), spokeOut.clone().addScaledVector(spinOut, .025), spinOut, X3()), M.mag));
    /* tuerca central con pasador de seguridad */
    const nut = put(new T.CylinderGeometry(.037, .04, .05, 12), spokeOut.clone().addScaledVector(spinOut, .07), spinOut, X3());
    RG.add(mesh(nut, M.alu, { name: "Tuerca central de rueda", mat: "Aluminio 7075 anodizado con retenedor de seguridad", kg: .3, info: "Una sola tuerca por rueda; el retenedor evita que se suelte si no está apretada." }));
    RG.add(mesh(put(new T.TorusGeometry(.03, .004, 8, 24).rotateX(Math.PI / 2), spokeOut.clone().addScaledVector(spinOut, .098), spinOut, X3()), M.knobR));
    /* neumático por revolución de su perfil real */
    const tw = S.tyreW, tR = S.tyreR, prof = [];
    const seat = rb + .006;
    for (let i = 0; i <= 26; i++) {
      const t = i / 26, a = -Math.PI / 2 + t * Math.PI;
      /* flanco abombado hasta el hombro y banda plana */
      const yy = Math.sin(a) * tw / 2, rr = seat + (tR - seat) * Math.pow(Math.cos(a), .38);
      prof.push([rr, yy * (1 - .08 * Math.cos(a) ** 6)])
    }
    prof.unshift([seat, -rw / 2 + .004]), prof.push([seat, rw / 2 - .004]);
    const tyG = put(lathe(prof, 112), WC0, spinOut, X3());
    A.tyreBase = tyG.attributes.position.array.slice();
    const TG = new T.Group(); SP.add(TG), TG.userData.ex = spinOut.clone().multiplyScalar(.2), TG.matrixAutoUpdate = !0;
    A.tyre = mesh(tyG, M.tread.clone(), { name: "Neumático " + (tw * 1e3).toFixed(0) + "/" + (tR * 2e3).toFixed(0) + " R18", mat: "Goma de competición sobre carcasa de nailon/aramida", kg: 9.5, info: "Rigidez vertical ≈ 300 N/mm: es el primer muelle del coche. La huella se aplasta con la carga." });
    TG.add(A.tyre), A.parts.push(A.tyre);
    const stripe = put(ringGeo(tR * .86, tR * .83, .002, 96), WC0.clone().addScaledVector(spinOut, tw / 2 - .006), spinOut, X3());
    TG.add(A.stripe = mesh(stripe, M.compound.clone()));
    /* ===== bieleta (pushrod/pullrod) ===== */
    const link = (key, d, OD, ID, mat, lbl, kg, info) => {
      const G = new T.Group(); G.matrixAutoUpdate = !1, A.root.add(G), A.groups[key] = G, G.userData.ex = new T.Vector3();
      const tube = mesh(cyl(OD / 2, 1, 18), mat, { name: lbl, mat: info[0], kg, info: info[1] });
      G.add(tube), A.parts.push(tube);
      const re = rodEndGeo(d, .03), ends = [];
      for (let e = 0; e < 2; e++) {
        const E = new T.Group(); E.matrixAutoUpdate = !1, A.root.add(E);
        E.add(mesh(re.body, M.steel, { name: "Rótula de " + lbl.toLowerCase(), mat: "Acero 300M con bola de acero y pista de PTFE", kg: .05, info: "Rótula roscada: girarla una vuelta cambia la longitud de la barra un paso de rosca (1 mm)." }), mesh(re.thread, M.steel), mesh(re.nut, M.alu, { name: "Contratuerca de " + lbl.toLowerCase(), mat: "Aluminio 7075", kg: .01, info: "Bloquea la rótula una vez ajustada la longitud." }));
        const ball = mesh(new T.SphereGeometry(d * .8, 14, 10), M.ball); A.root.add(ball), ball.matrixAutoUpdate = !1;
        ends.push({ E, ball }), A.parts.push(E.children[0], E.children[2])
      }
      A[key] = { G, tube, ends, d, OD, ID };
    };
    link("pr", S.dPr, S.prOD, S.prID, M.ti, g.type === "pull" ? "Pullrod" : "Pushrod", .35, ["Tubo de titanio Ø" + Math.round(S.prOD * 1e3) + "×" + ((S.prOD - S.prID) / 2 * 1e3).toFixed(1) + " mm", "Lleva la carga vertical de la rueda al balancín. Su longitud fija la altura al suelo: se ajusta girando las rótulas."]);
    link("tr", S.dTr, S.trOD, S.trID, M.carbon, "Bieleta de dirección", .2, ["Carbono con extremos de titanio", "Une la cremallera con el brazo de dirección. Su longitud fija la convergencia."]);
    /* ===== balancín, barra de torsión y amortiguador ===== */
    const RK = grp("rk", new T.Vector3(0, .12, 0)), xAx = X3();
    const rkPts = [RA0, RD0], plateN = xAx;
    const ra = RA0.clone().sub(RP), rd = RD0.clone().sub(RP);
    const e1 = ra.clone().normalize(), e2 = new T.Vector3().crossVectors(plateN, e1);
    const to2 = v => [v.dot(e1), v.dot(e2)];
    const [ax_, ay_] = to2(ra), [dx_, dy_] = to2(rd);
    const sh = new T.Shape(), rr0 = .022;
    /* contorno convexo redondeado que envuelve pivote, brazo de bieleta y brazo de amortiguador */
    const hullPts = [[0, 0, rr0 * 1.3], [ax_, ay_, rr0], [dx_, dy_, rr0]];
    const hull = []; for (const [cx, cy, r] of hullPts) for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; hull.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]) }
    hull.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], hi = [];
    for (const p of hull) { for (; lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0;) lo.pop(); lo.push(p) }
    for (const p of hull.slice().reverse()) { for (; hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], p) <= 0;) hi.pop(); hi.push(p) }
    const ch = lo.slice(0, -1).concat(hi.slice(0, -1));
    ch.forEach(([x, y], i) => i ? sh.lineTo(x, y) : sh.moveTo(x, y));
    for (const [cx, cy, r] of [[0, 0, .009], [ax_, ay_, S.dPr * .5], [dx_, dy_, S.dDp * .5]]) { const h = new T.Path(); h.absarc(cx, cy, r, 0, Math.PI * 2, !0), sh.holes.push(h) }
    /* vaciado de aligeramiento */
    const cxp = (ax_ + dx_) / 3, cyp = (ay_ + dy_) / 3, lr = Math.min(Math.hypot(ax_, ay_), Math.hypot(dx_, dy_)) * .16;
    lr > .006 && (() => { const h = new T.Path(); h.absarc(cxp, cyp, lr, 0, Math.PI * 2, !0), sh.holes.push(h) })();
    const rkm = new T.Matrix4().makeBasis(e1, e2, plateN).setPosition(RP);
    for (const z of [-.013, .006]) add(RK, new T.ExtrudeGeometry(sh, { depth: .007, bevelEnabled: !0, bevelSize: .0015, bevelThickness: .0015, bevelSegments: 2, curveSegments: 10 }).translate(0, 0, z).applyMatrix4(rkm), M.ti, { name: "Balancín (bellcrank)", mat: "Titanio Ti-6Al-4V mecanizado", kg: .45, info: "Convierte el movimiento de la bieleta en giro: la relación entre brazos fija la relación de movimiento muelle/rueda." });
    add(RK, put(ringGeo(.02, .009, .036, 28), RP, xAx, Y3()), M.ti);
    for (const z of [-.016, .016]) add(RK, put(ringGeo(.014, .009, .007, 22), RP.clone().addScaledVector(xAx, z), xAx, Y3()), M.steel, { name: "Rodamientos de agujas del balancín", mat: "Acero", kg: .02, info: "Dos rodamientos separados para que el balancín no cabecee bajo carga." });
    add(RK, put(merge(boltGeos(S.dPr * .8, .03)), RA0, xAx, Y3()), M.bolt), add(RK, put(merge(boltGeos(S.dDp * .8, .03)), RD0, xAx, Y3()), M.bolt);
    A.joints.push({ key: "RA", name: "Rótula de la bieleta (balancín)", kind: "re", lim: 14, bodyA: "rk", link: "pr", end: 1, b0: xAx.clone(), P0: RA0.clone(), d: S.dPr, rate: 48e3 });
    A.joints.push({ key: "RD", name: "Rótula del amortiguador (balancín)", kind: "re", lim: 14, bodyA: "rk", link: "dp", end: 1, b0: xAx.clone(), P0: RD0.clone(), d: S.dDp, rate: 30e3 });
    /* soporte del balancín en el monocasco */
    const RB = grp("rkBrk", new T.Vector3(0, .03, 0));
    for (const z of [-.03, .03]) add(RB, put(lugGeo(.03, .04, .006, .006).rotateX(-Math.PI / 2), RP.clone().addScaledVector(xAx, z), xAx, Y3()), M.bracket, { name: "Soporte del balancín", mat: "Acero 17-4PH", kg: .12, info: "Atornillado al monocasco; recibe el eje del balancín." });
    add(RB, put(cyl(.009, .07, 18), RP, xAx, Y3()), M.steel);
    /* barra de torsión coaxial con el eje del balancín, estriada en los extremos */
    const TB = grp("tb", new T.Vector3(-.18, 0, 0)), tbL = .38, tbA = RP.clone().addScaledVector(xAx, -.02), tbB = RP.clone().addScaledVector(xAx, -.02 - tbL);
    A.tbar = add(TB, put(cyl(.0085, tbL, 20), tbA.clone().lerp(tbB, .5), xAx, Y3()), M.tiDark.clone(), { name: "Barra de torsión", mat: "Titanio β (Ti-3Al-8V-6Cr-4Mo-4Zr) o acero de muelle", kg: .4, info: "Es el muelle principal: se retuerce con el giro del balancín. Rigidez ∝ d⁴/L." });
    for (const pt of [tbA, tbB]) add(TB, put(new T.CylinderGeometry(.012, .012, .03, 24), pt, xAx, Y3()), M.steel, { name: "Estriado de la barra de torsión", mat: "Acero", kg: .05, info: "Estrías finas: permiten precargar la barra un diente para corregir la altura sin cambiar la rigidez." });
    const anchor = put(new T.BoxGeometry(.05, .03, .05), tbB.clone().addScaledVector(xAx, -.01), xAx, Y3());
    add(TB, anchor, M.bracket, { name: "Anclaje fijo de la barra de torsión", mat: "Acero", kg: .15, info: "El extremo trasero no gira: todo el giro del balancín se convierte en torsión." });
    /* raya pintada: se enrosca con el giro real de la barra */
    const stG = new T.BoxGeometry(.0024, 1, .0024, 1, 24, 1); A.stripeBase = stG.attributes.position.array.slice();
    A.tbStripe = mesh(stG, M.stripe); TB.add(A.tbStripe), A.tbFrame = { A: tbA, B: tbB, ax: xAx, r: .0087 };
    /* amortiguador: cuerpo fijo al chasis (SD), vástago unido al balancín (RD) */
    const DP = new T.Group(); DP.matrixAutoUpdate = !1, A.root.add(DP), A.groups.dpB = DP, DP.userData.ex = new T.Vector3(0, .22, 0);
    const Ld0 = RD0.distanceTo(SD), bodyL = Ld0 * .55;
    A.dp = { G: DP, Ld0, bodyL };
    const body = new T.Group(); DP.add(body);
    body.add(mesh(cyl(.02, bodyL, 28).translate(0, bodyL / 2, 0), M.damper, { name: "Amortiguador de 4 vías (cuerpo)", mat: "Aluminio anodizado, vástago de acero cromado", kg: .9, info: "Compresión y extensión, cada una en baja y alta velocidad, con válvulas de láminas y una válvula de soplado." }));
    body.add(mesh(ringGeo(.022, .016, .012, 24).translate(0, bodyL - .006, 0), M.aluBlk));
    body.add(mesh(cyl(.014, bodyL * .7, 20).translate(.035, bodyL * .45, 0), M.damper, { name: "Depósito de gas del amortiguador", mat: "Aluminio, nitrógeno a 10–20 bar", kg: .25, info: "El pistón flotante separa aceite y gas para que el aceite no cavite a alta velocidad." }));
    body.add(mesh(new T.TorusGeometry(.017, .003, 6, 16).rotateZ(Math.PI / 2).translate(.0175, bodyL * .2, 0), M.hose));
    const knobs = [[M.knobB, .25, "Compresión lenta"], [M.knobB, .42, "Compresión rápida"], [M.knobR, .6, "Extensión lenta"], [M.knobR, .78, "Extensión rápida"]];
    for (const [mt, f, nm] of knobs) body.add(mesh(cyl(.0065, .012, 14).rotateZ(Math.PI / 2).translate(.055, bodyL * .45 - bodyL * .35 + f * bodyL * .7, 0), mt, { name: "Regulador: " + nm.toLowerCase(), mat: "Aluminio anodizado", kg: .01, info: "Cada clic abre o cierra un paso de aceite en esa vía." }));
    const eyeD = rodEndGeo(S.dDp, .01);
    body.add(mesh(eyeD.body.clone().rotateZ(Math.PI), M.steel));
    const shaft = new T.Group(); DP.add(shaft); A.dp.shaft = shaft;
    shaft.add(mesh(cyl(.007, bodyL, 18).translate(0, -bodyL / 2, 0), M.chrome, { name: "Vástago del amortiguador", mat: "Acero cromado duro", kg: .15, info: "La longitud visible cambia con el recorrido real." }));
    shaft.add(mesh(eyeD.body.clone(), M.steel));
    A.joints.push({ key: "SD", name: "Rótula del amortiguador (chasis)", kind: "re", lim: 14, bodyA: "chassis", link: "dp", end: 0, b0: perp(RD0.clone().sub(SD).normalize(), X3()), P0: SD.clone(), d: S.dDp, rate: 30e3 });
    const SB = grp("sdBrk", new T.Vector3(0, .05, 0));
    add(SB, put(merge(boltGeos(S.dDp * .8, .03)), SD, X3(), Y3()), M.bolt);
    for (const z of [-.013, .013]) add(SB, put(lugGeo(.022, .03, .004, .005).rotateX(-Math.PI / 2), SD.clone().addScaledVector(xAx, z), xAx, Y3()), M.bracket, { name: "Anclaje del amortiguador al monocasco", mat: "Acero 17-4PH", kg: .06, info: "" });
    A.kgOf = grpName => { let m = 0; (A.groups[grpName] || { traverse() { } }).traverse(o => o.userData.part && (m += o.userData.part.kg || 0)); return m };
    return A
  }

  /* ---------- colocación por fotograma ---------- */
  const tmpM = () => new T.Matrix4();
  function placeLink(L, a, b, bA, bB, ex) {
    const d = b.clone().sub(a), Ln = d.length(), u = d.clone().divideScalar(Ln);
    const m = basisM(X3(), u, a.clone().lerp(b, .5)), sc = new T.Matrix4().makeScale(1, Math.max(.01, Ln - L.d * 4.6), 1);
    L.G.matrix.copy(m.multiply(sc)).premultiply(tmpM().makeTranslation(ex.x, ex.y, ex.z));
    /* ojos de las rótulas: eje = componente del eje del tornillo perpendicular a la barra; la bola sigue al tornillo */
    const mis = [];
    [[a, u, bA], [b, u.clone().negate(), bB]].forEach(([p, dir, bolt], e) => {
      const bz = bolt.clone().addScaledVector(dir, -bolt.dot(dir));
      bz.lengthSq() < 1e-9 && bz.set(0, 1, 0), bz.normalize();
      const yv = dir.clone().negate(), xv = new T.Vector3().crossVectors(yv, bz);
      const mE = new T.Matrix4().makeBasis(xv, yv, bz).setPosition(p).premultiply(tmpM().makeTranslation(ex.x, ex.y, ex.z));
      L.ends[e].E.matrix.copy(mE);
      const mb = basisM(dir, bolt, p).premultiply(tmpM().makeTranslation(ex.x, ex.y, ex.z));
      L.ends[e].ball.matrix.copy(mb);
      mis.push(Math.asin(Math.min(1, Math.abs(bolt.dot(dir)))) / DEGc)
    });
    return mis
  }
  function setGroup(G, m, e) { const x = G.userData.ex; G.matrix.copy(m).premultiply(tmpM().makeTranslation(x.x * e, x.y * e, x.z * e)) }
  /* st: {sol, side, explode, spin, load, discT, steer} */
  function update(A, sol, st) {
    const P = p => W(p, A.side), p0 = A.pt0, e = st.explode || 0;
    const LO = P(sol.LO), UO = P(sol.UO), TO = P(sol.TO), TI = P(sol.TI), PO = P(sol.PO), RA = P(sol.RA), RD = P(sol.RD), WC = P(sol.WC);
    const Mlw = rigid(p0.LF, p0.LR, p0.LO0, p0.LF, p0.LR, LO), Muw = rigid(p0.UF, p0.UR, p0.UO0, p0.UF, p0.UR, UO), Mup = rigid(p0.LO0, p0.UO0, p0.TO0, LO, UO, TO);
    const Mrk = rigid(p0.RP, p0.RP.clone().add(X3()), p0.RA0, p0.RP, p0.RP.clone().add(X3()), RA);
    setGroup(A.groups.lw, Mlw, e), setGroup(A.groups.uw, Muw, e), setGroup(A.groups.up, Mup, e), setGroup(A.groups.rk, Mrk, e);
    for (const k of Object.keys(A.groups)) /Brk/.test(k) && setGroup(A.groups[k], new T.Matrix4(), e);
    setGroup(A.groups.tb, new T.Matrix4(), e);
    /* rueda girando alrededor de su eje (en la postura estática de la mangueta) */
    A.spin += (st.spin || 0);
    const sp = A.groups.spin, ex = sp.userData.ex;
    sp.matrix.makeTranslation(p0.WC0.x, p0.WC0.y, p0.WC0.z).multiply(tmpM().makeRotationAxis(p0.sAx0, A.spin)).multiply(tmpM().makeTranslation(-p0.WC0.x, -p0.WC0.y, -p0.WC0.z)).premultiply(tmpM().makeTranslation(ex.x * e, ex.y * e, ex.z * e));
    for (const c of sp.children) c.userData.ex && c.position.copy(c.userData.ex).multiplyScalar(e);
    for (const c of A.groups.up.children) c.userData.ex && c !== sp && c.position.copy(c.userData.ex).multiplyScalar(e);
    /* ejes actuales de los tornillos de cada cuerpo */
    const R = { chassis: new T.Matrix4(), lw: Mlw, uw: Muw, up: Mup, rk: Mrk };
    const axisNow = (j) => j.b0.clone().transformDirection(R[j.bodyA]);
    /* bieleta: del soporte de la mangueta al balancín; la explosión la lleva con la mangueta */
    const jPO = A.joints.find(j => j.key === "PO"), jRA = A.joints.find(j => j.key === "RA"), jTO = A.joints.find(j => j.key === "TO");
    const exPr = new T.Vector3(0, .05 * e, 0);
    const misPr = placeLink(A.pr, PO, RA, axisNow(jPO), axisNow(jRA), exPr);
    const misTr = placeLink(A.tr, TI, TO, Y3(), axisNow(jTO), new T.Vector3());
    /* amortiguador: cuerpo orientado de SD a RD, vástago desde RD */
    const dpd = RD.clone().sub(p0.SD), Ld = dpd.length(), u = dpd.clone().divideScalar(Ld), eD = A.groups.dpB.userData.ex;
    const mBody = basisM(X3(), u, p0.SD).premultiply(tmpM().makeTranslation(eD.x * e, eD.y * e, eD.z * e));
    A.dp.G.matrix.copy(mBody), A.dp.shaft.position.set(0, Ld, 0);
    A.dp.len = Ld, A.dp.stroke = A.dp.Ld0 - Ld;
    const jSD = A.joints.find(j => j.key === "SD"), jRD = A.joints.find(j => j.key === "RD");
    const misDp = [Math.asin(Math.min(1, Math.abs(axisNow(jSD).dot(u)))) / DEGc, Math.asin(Math.min(1, Math.abs(axisNow(jRD).dot(u)))) / DEGc];
    /* barra de torsión: raya que se enrosca con el giro del balancín */
    const tw = -(sol.beta - A.g.beta0) * A.side;
    A.twist = (sol.beta - A.g.beta0);
    const tf = A.tbFrame, pos = A.tbStripe.geometry.attributes.position, b = A.stripeBase, yv = new T.Vector3(0, 1, 0), zv = new T.Vector3(0, 0, 1);
    for (let i = 0; i < pos.count; i++) {
      const fy = b[i * 3 + 1] + .5, a = tw * (1 - fy) + 0, x = tf.A.x - fy * (tf.A.x - tf.B.x), r = tf.r + b[i * 3] * .2 + b[i * 3 + 2] * .2;
      pos.setXYZ(i, x, tf.A.y + Math.cos(a) * r, tf.A.z + Math.sin(a) * r)
    }
    pos.needsUpdate = !0, A.tbStripe.geometry.computeBoundingSphere();
    /* neumático: se aplasta contra el firme según la carga (en coordenadas de la postura estática) */
    const defl = clamp((st.load || 0) / (st.kt || 3e5) * (st.ex || 1), 0, .05);
    const invUp = Mup.clone().invert(), CPw = P(sol.CP), CPl = CPw.clone().applyMatrix4(invUp), WCl = p0.WC0, dn = CPl.clone().sub(WCl).normalize();
    const tp = A.tyre.geometry.attributes.position, tb = A.tyreBase, lim = WCl.distanceTo(CPl) - defl;
    for (let i = 0; i < tp.count; i++) {
      let x = tb[i * 3] - WCl.x, y = tb[i * 3 + 1] - WCl.y, z = tb[i * 3 + 2] - WCl.z;
      const xx = x, yy = y, zz = z;
      /* llevar al marco girado */
      const h = xx * dn.x + yy * dn.y + zz * dn.z;
      if (h > lim) { const ee = h - lim; x -= dn.x * ee, y -= dn.y * ee, z -= dn.z * ee; const sAx = p0.sAx0, ax = x * sAx.x + y * sAx.y + z * sAx.z; x += sAx.x * ax * ee * 1.6, y += sAx.y * ax * ee * 1.6, z += sAx.z * ax * ee * 1.6 }
      tp.setXYZ(i, x + WCl.x, y + WCl.y, z + WCl.z)
    }
    /* la deformación se calcula con el neumático sin girar: deshacer el giro del grupo para él */
    A.tyre.matrixAutoUpdate = !1, A.tyre.matrix.makeTranslation(p0.WC0.x, p0.WC0.y, p0.WC0.z).multiply(tmpM().makeRotationAxis(p0.sAx0, -A.spin)).multiply(tmpM().makeTranslation(-p0.WC0.x, -p0.WC0.y, -p0.WC0.z));
    tp.needsUpdate = !0, A.tyre.geometry.computeVertexNormals();
    /* disco al rojo */
    const hot = clamp(((st.discT || 400) - 550) / 550, 0, 1);
    A.disc.material.emissive.setRGB(hot * 2.4, hot * hot * .8, hot * hot * hot * .2);
    A.mis = misOf(A, sol);
    return A.mis
  }

  /* matrices de los sólidos para una solución cinemática */
  function poseOf(A, sol) {
    const P = p => W(p, A.side), p0 = A.pt0;
    const LO = P(sol.LO), UO = P(sol.UO), TO = P(sol.TO);
    return { chassis: new T.Matrix4(), lw: rigid(p0.LF, p0.LR, p0.LO0, p0.LF, p0.LR, LO), uw: rigid(p0.UF, p0.UR, p0.UO0, p0.UF, p0.UR, UO), up: rigid(p0.LO0, p0.UO0, p0.TO0, LO, UO, TO), rk: rigid(p0.RP, p0.RP.clone().add(X3()), p0.RA0, p0.RP, p0.RP.clone().add(X3()), P(sol.RA)) }
  }
  /* ángulo de desalineación de cada rótula (°): en las barras con rótula en cada extremo es el ángulo entre el tornillo
     y el plano perpendicular a la barra; en las uniones entre sólidos, el giro relativo del eje del tornillo */
  function misOf(A, sol) {
    const P = p => W(p, A.side), R = poseOf(A, sol), out = {};
    const dirs = { pr: P(sol.RA).sub(P(sol.PO)).normalize(), tr: P(sol.TO).sub(P(sol.TI)).normalize(), dp: P(sol.RD).sub(A.pt0.SD).normalize() };
    for (const j of A.joints) {
      const bA = j.b0.clone().transformDirection(R[j.bodyA]);
      if (j.link) out[j.key] = Math.asin(Math.min(1, Math.abs(bA.dot(dirs[j.link])))) / DEGc;
      else { const bB = j.b0.clone().transformDirection(R[j.bodyB]); out[j.key] = Math.acos(clamp(bA.dot(bB), -1, 1)) / DEGc }
    }
    return out
  }

  /* orientación óptima del tornillo de las rótulas de la mangueta (bieleta y dirección): de todas las direcciones
     perpendiculares a la barra en estático, la que minimiza la peor desalineación al girar y en todo el recorrido */
  function optimiseAxes(K, thetaFor) {
    const g = K.g3, s0 = K.mid, P = p => W(p, 1), out = {}, sols = [];
    let prev = null;
    for (const s of [-.03, 0, .03, .045]) for (const rk of [-.045, -.02, 0, .02, .045]) { const q = LAB.kin3d.solve(g, thetaFor(K, s), rk, prev); q && sols.push(q), prev = null }
    const LO0 = P(s0.LO), UO0 = P(s0.UO), TO0 = P(s0.TO), mats = sols.map(q => rigid(LO0, UO0, TO0, P(q.LO), P(q.UO), P(q.TO)));
    for (const [key, a, b] of [["PO", "PO", "RA"], ["TO", "TO", "TI"]]) {
      const u0 = P(s0[b]).sub(P(s0[a])).normalize(), e1 = new T.Vector3(1, 0, 0).addScaledVector(u0, -u0.x).normalize(), e2 = new T.Vector3().crossVectors(u0, e1);
      let best = null;
      for (let i = 0; i < 72; i++) {
        const ph = i / 72 * Math.PI, b0 = e1.clone().multiplyScalar(Math.cos(ph)).addScaledVector(e2, Math.sin(ph));
        let worst = 0;
        sols.forEach((q, k) => { const bb = b0.clone().transformDirection(mats[k]), u = P(q[b]).sub(P(q[a])).normalize(); worst = Math.max(worst, Math.abs(bb.dot(u))) });
        (!best || worst < best.w) && (best = { w: worst, b0 })
      }
      out[key] = [best.b0.x, best.b0.z, best.b0.y], out[key + "w"] = Math.asin(Math.min(1, best.w)) / DEGc
    }
    return out
  }

  /* ---------- comprobaciones de ingeniería ---------- */
  function clearances(A, sol) {
    const P = p => W(p, A.side), S = A.spec, WC = P(sol.WC), sAx = W(sol.s, A.side).normalize().multiplyScalar(A.side > 0 ? 1 : -1);
    const rimIn = S.rimR - .024, res = [];
    const segs = [["Trapecio inferior (brazo delantero)", P(A.g.LF), P(sol.LO), .016], ["Trapecio inferior (brazo trasero)", P(A.g.LR), P(sol.LO), .016], ["Trapecio superior (brazo delantero)", P(A.g.UF), P(sol.UO), .014], ["Trapecio superior (brazo trasero)", P(A.g.UR), P(sol.UO), .014], ["Bieleta", P(sol.PO), P(sol.RA), S.prOD / 2], ["Bieleta de dirección", P(sol.TI), P(sol.TO), S.trOD / 2]];
    let tyreMin = 1e9, tyreWho = "", rimMin = 1e9, rimWho = "";
    for (const [nm, a, b, r] of segs) {
      for (let i = 0; i <= 40; i++) {
        const p = a.clone().lerp(b, i / 40), d = p.clone().sub(WC), ax = d.dot(sAx), rad = d.addScaledVector(sAx, -ax).length();
        /* neumático: banda de ±ancho/2; por dentro del flanco interior no hay contacto */
        if (Math.abs(ax) < S.tyreW / 2 + .01 && rad > rimIn) { const c = Math.max(rad - S.tyreR, Math.abs(ax) - S.tyreW / 2) - r; c < tyreMin && (tyreMin = c, tyreWho = nm) }
        /* llanta: dentro del barril, contra el perfil interior real (asiento, pozo) menos 4 mm de pared */
        if (ax > -S.rimW / 2 && ax < S.rimW / 2 - .07) { const c = rimSurf(S, ax) - .004 - rad - r; i > 25 && c < rimMin && (rimMin = c, rimWho = nm) }
      }
    }
    return { tyreMin, tyreWho, rimMin, rimWho }
  }
  /* radio de la superficie interior de la llanta a una distancia axial ax del plano medio (perfil de revolución) */
  function rimSurf(S, ax) {
    const rb = S.rimR, w = S.rimW, pr = [[-w / 2, rb - .006], [-w / 2 + .014, rb + .002], [-w / 2 + .03, rb], [-w / 2 + .07, rb - .022], [w / 2 - .11, rb - .022], [w / 2 - .05, rb], [w / 2, rb]];
    for (let i = 0; i < pr.length - 1; i++) if (ax <= pr[i + 1][0]) { const t = (ax - pr[i][0]) / (pr[i + 1][0] - pr[i][0]); return pr[i][1] + (pr[i + 1][1] - pr[i][1]) * clamp(t, 0, 1) }
    return rb
  }
  function buckling(Lm, OD, ID, E) { const I = Math.PI / 64 * (OD ** 4 - ID ** 4); return Math.PI * Math.PI * E * I / (Lm * Lm) }

  return { optimiseAxes, poseOf, misOf, mats: () => M || (M = mats()), init(TT) { T = TT; M || (M = mats()); return M }, buildCorner: (scene, K, side, spec) => { const s = specOf(spec), A = buildCorner(scene, K, side, s); A.spec = s; return A }, update, clearances, buckling, specOf, W: (p, side) => W(p, side), rigid, put, basisM, beam, lathe, ringGeo, lugGeo, boltGeos, merge, rodEndGeo, cyl, hex, mesh }
})();
