/* ===================== TRANSMISIÓN: PIEZAS =====================
   Lo que hace falta para que la caja se parezca a una de verdad y nada flote: rodamientos de bolas con sus pistas, engranajes
   cónicos con dientes que se estrechan hacia el vértice del cono, carcasa hueca con pared (para poder seccionarla), tabiques que
   llevan los rodamientos, juntas trípode con su fuelle, ruedas torneadas… y el motor completo por fuera (el mismo de la pestaña
   Motor) atornillado a la campana del embrague. */
LAB.drivecad = (() => {
  const TH = () => window.THREE, HP = Math.PI / 2, TAU = Math.PI * 2;
  const V = (x, y, z) => new (TH().Vector3)(x, y, z);
  const latheX = (pts, seg = 40) => LAB.kit.latheHard(pts, seg).rotateZ(-HP);   /* perfil [radio, x] */
  const latheZ = (pts, seg = 40) => LAB.kit.latheHard(pts, seg).rotateX(HP);    /* perfil [radio, z] */
  /* rodamiento de bolas (eje X, centrado): pista exterior, pista interior, bolas y jaula */
  function bearing(ri, ro, w, nb) {
    const T = TH(), t = (ro - ri) * .27, rb = (ro - ri) / 2 - t * .6, rp = (ri + ro) / 2, n = nb || Math.max(7, Math.floor(TAU * rp / (rb * 2.6)));
    const gs = [latheX([[ro - t, -w / 2], [ro, -w / 2], [ro, w / 2], [ro - t, w / 2], [ro - t, -w / 2]], 36), latheX([[ri, -w / 2], [ri + t, -w / 2], [ri + t, w / 2], [ri, w / 2], [ri, -w / 2]], 36), latheX([[rp - .001, -w * .3], [rp + .001, -w * .3], [rp + .001, w * .3], [rp - .001, w * .3], [rp - .001, -w * .3]], 36)];
    for (let k = 0; k < n; k++) { const a = k / n * TAU; gs.push(new T.SphereGeometry(rb, 12, 8).translate(0, rp * Math.cos(a), rp * Math.sin(a))) }
    return LAB.kit.merge(gs)
  }
  /* engranaje cónico recto: vértice del cono en el origen, eje +X. delta = semiángulo del cono primitivo, Re = generatriz exterior,
     b = ancho de diente. El diente k tiene su centro en el ángulo ph + k·2π/z (medido de +Y hacia +Z). body = perfil [radio, x] del cuerpo */
  /* reducción final que pide el artículo 9.6.1 del reglamento: el eje del diferencial va entre 250 y 260 mm sobre el plano de referencia
     (160-170 mm por encima del cigüeñal) y el secundario solo 90-100 mm por encima del primario, así que tras el grupo cónico hace falta
     una pareja de dientes rectos. La rueda es de 57 dientes de módulo 3,5 (206 mm entre puntas; el mínimo es 205) y el resto de la
     relación se reparte entre su piñón y el grupo cónico. q = { z1, z2, module, face, fd } en metros */
  function final(q) {
    const mF = .0035, zF2 = 57, a = q.module * (q.z1[0] + q.z2[0]) / 2;
    let zb1 = 17, zb2 = 17, zF1 = 19, best = 9;
    for (let f1 = 17; f1 <= 27; f1++) for (let b1 = 15; b1 <= 23; b1++) { const b2 = Math.round(q.fd * f1 / zF2 * b1); if (b2 < 13 || b2 > 31 || b2 / b1 < .7 || b2 / b1 > 1.7) continue; const e = Math.abs(b2 / b1 * zF2 / f1 - q.fd); e < best - 1e-9 && (best = e, zb1 = b1, zb2 = b2, zF1 = f1) }
    const cF = mF * (zF1 + zF2) / 2, dyF = Math.min(cF - .02, Math.max(.03, .165 - a)), dxF = Math.sqrt(cF * cF - dyF * dyF);
    /* largo del tren tal como lo monta drive3d (cuatro grupos de dos ruedas con su anillo de garras) y distancia del primer par al diferencial */
    const len = 4 * (2 * q.face + .028), back = Math.max(.415, len + .082 + dxF);
    return { zb1, zb2, zF1, zF2, mF, cF, dyF, dxF, a, len, ratio: zb2 / zb1 * zF2 / zF1, tip: mF * (zF2 + 1.9) * 1e3, zAxis: (.09 + a + dyF) * 1e3, back: back * 1e3 }
  }
  function bevel(z, delta, Re, b, mod, ph, body) {
    const T = TH(), pos = [], cd = Math.cos(delta), sd = Math.sin(delta), tau = TAU / z, ha = mod, hf = 1.2 * mod;
    const P = (s, e, th) => { const a = s * cd - e * sd * s / Re, rho = s * sd + e * cd * s / Re; return [a, rho * Math.cos(th), rho * Math.sin(th)] };
    const quad = (a, b2, c, d) => pos.push(...a, ...b2, ...c, ...a, ...c, ...d);
    for (let k = 0; k < z; k++) {
      const th = ph + k * tau, wr = tau * .3, wt = tau * .15, E = s => [P(s, -hf, th - wr), P(s, ha, th - wt), P(s, ha, th + wt), P(s, -hf, th + wr)], o = E(Re), i = E(Re - b);
      quad(o[0], o[1], i[1], i[0]), quad(o[1], o[2], i[2], i[1]), quad(o[2], o[3], i[3], i[2]), quad(o[0], o[3], o[2], o[1]), quad(i[0], i[1], i[2], i[3])
    }
    const g = new T.BufferGeometry;
    g.setAttribute("position", new T.Float32BufferAttribute(pos, 3)), g.computeVertexNormals();
    const ro = [(Re) * sd - hf * cd, Re * cd + hf * sd], ri = [(Re - b) * sd - hf * cd * (Re - b) / Re, (Re - b) * cd + hf * sd * (Re - b) / Re];
    return { geo: LAB.kit.merge([g, latheX(body(ri, ro), 48)]), ro, ri }
  }
  /* junta trípode con su fuelle (eje +X desde el origen): vaso, fuelle de acordeón y abrazaderas */
  function tripod(rc, L) {
    const cup = latheX([[.014, -.012], [rc * .7, -.012], [rc, .004], [rc, L * .5], [rc - .004, L * .5], [rc - .004, .004], [.014, -.004]], 32), bp = [], n = 5, x0 = L * .46, x1 = L;
    for (let k = 0; k <= n * 2; k++) { const u = k / (n * 2), r0 = rc + .001 + (.021 - rc) * u; bp.push([r0 + (k % 2 ? .006 : 0), x0 + (x1 - x0) * u]) }
    bp.push([.0185, x1 + .008]);
    return { cup, boot: LAB.kit.lathe(bp, 28).rotateZ(-HP), clamps: LAB.kit.merge([LAB.kit.hoseClamp(rc + .0015, .007).rotateZ(-HP).translate(x0 + .003, 0, 0), LAB.kit.hoseClamp(.0195, .006).rotateZ(-HP).translate(x1 + .004, 0, 0)]) }
  }
  /* rueda trasera de 18 pulgadas (eje Z, centrada): neumático 405/720 torneado con su hombro, llanta y tapacubos */
  function wheel(s) {
    const R = .36, w = .39, rr = .2286, ty = [], rim = [], cover = [];
    const prof = [[rr, -w / 2 + .03], [rr + .03, -w / 2 + .004], [R - .06, -w / 2], [R - .016, -w / 2 + .022], [R - .003, -w / 2 + .06], [R, -w / 4], [R, w / 4], [R - .003, w / 2 - .06], [R - .016, w / 2 - .022], [R - .06, w / 2], [rr + .03, w / 2 - .004], [rr, w / 2 - .03]];
    ty.push(LAB.kit.lathe(prof.map(p => [p[0], -p[1]]).reverse(), 64).rotateX(HP));
    rim.push(latheZ([[rr - .008, -w / 2 + .03], [rr + .012, -w / 2 + .024], [rr, -w / 2 + .05], [rr - .02, -w / 2 + .09], [rr - .02, w / 2 - .09], [rr, w / 2 - .05], [rr + .012, w / 2 - .024], [rr - .008, w / 2 - .03]], 64));
    /* disco de la llanta en la cara exterior, tapacubos liso (obligatorio desde 2022) y tuerca central */
    const zo = s * (w / 2 - .06);
    const flip = g => s < 0 ? g.rotateY(Math.PI) : g;
    rim.push(flip(latheZ([[.035, 0], [rr - .02, -.012], [rr - .02, 0], [.035, .014], [.035, 0]], 48)).translate(0, 0, zo));
    cover.push(flip(latheZ([[.03, .02], [rr - .015, .008], [rr - .003, -.004]], 48)).translate(0, 0, zo + s * .012));
    const nut = LAB.kit.merge([new (TH().CylinderGeometry)(.03, .03, .03, 6).rotateX(HP), new (TH().CylinderGeometry)(.016, .016, .05, 16).rotateX(HP)]).translate(0, 0, zo + s * .03);
    return { tyre: LAB.kit.merge(ty), rim: LAB.kit.merge(rim), cover: LAB.kit.merge(cover), nut }
  }
  /* carcasa: tubo de sección casi rectangular, con pared, de la brida del motor a la cola. sec(x) → [medio alto, medio ancho, centro y] */
  function casing(sec, xA, xZ, zc, wall, n = 110) {
    const P = [], S = [];
    for (let i = 0; i <= n; i++) { const x = xA + (xZ - xA) * i / n, q = sec(x); P.push(V(x, q[2], zc)), S.push([q[0], q[1]]) }
    return LAB.kit.sweep(P, t => S[Math.min(n, Math.round(t * n))], { sides: 60, n0: V(0, 1, 0), pow: .74, wall, cap1: !0, rim0: !0 })
  }
  /* tabique interior (lleva los rodamientos): contorno de la sección interior de la carcasa en x, con los alojamientos. holes: [z, y, r] */
  function bulkhead(q, zc, wall, thick, holes) {
    const T = TH(), pts = [], N = 64, pw = .74, f = v => Math.sign(v) * Math.pow(Math.abs(v), pw);
    for (let j = 0; j < N; j++) { const a = j / N * TAU; pts.push([zc + (q[1] - wall * .5) * f(Math.sin(a)), q[2] + (q[0] - wall * .5) * f(Math.cos(a))]) }
    return LAB.kit.plate(pts, thick, holes).applyMatrix4(new T.Matrix4().makeBasis(V(0, 0, 1), V(0, 1, 0), V(-1, 0, 0)))
  }
  /* el motor completo por fuera (el de la pestaña Motor, con sus medidas de serie), para atornillarlo a la campana */
  function engine(o) {
    const T = TH(), K = LAB.kit, S = c => new T.MeshStandardMaterial(c), grp = new T.Group, root = new T.Group, crank = new T.Group;
    grp.add(root), root.add(crank);
    const tex = (w, h, draw, srgb, rep) => { const c = document.createElement("canvas"); c.width = w, c.height = h, draw(c.getContext("2d"), w, h); const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping, srgb && (t.colorSpace = T.SRGBColorSpace), rep && t.repeat.set(rep, rep); return t };
    const TX = {
      noise: tex(64, 64, (g, w, h) => { g.fillStyle = "#999", g.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { const v = 110 + Math.random() * 120 | 0; g.fillStyle = `rgb(${v},${v},${v})`, g.fillRect(Math.random() * w, Math.random() * h, 2, 2) } }, !1, 10),
      tint: tex(512, 8, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, 0);[[0, "#3c3532"], [.08, "#4a3f3b"], [.16, "#3b3f6e"], [.24, "#5a3d72"], [.32, "#8a5a4a"], [.42, "#b48a4c"], [.55, "#9c8a64"], [.75, "#7d7366"], [1, "#6d655c"]].forEach(([p, c]) => gr.addColorStop(p, c)), g.fillStyle = gr, g.fillRect(0, 0, w, h) }, !0),
      hot: tex(64, 4, (g, w, h) => { g.fillStyle = "#555", g.fillRect(0, 0, w, h) })
    };
    const M = { alu: S({ color: "#8f959c", metalness: .8, roughness: .5 }), carbon: new T.MeshPhysicalMaterial({ color: "#1c1f23", metalness: .25, roughness: .38, clearcoat: 1, clearcoatRoughness: .08 }), steel: S({ color: "#b3b9c0", metalness: 1, roughness: .22 }), motor: S({ color: "#2a3036", metalness: .7, roughness: .32 }), wheelC: S({ color: "#d6dade", metalness: 1, roughness: .18, side: T.DoubleSide }), spring: S({ color: "#3a3f46", metalness: .85, roughness: .35 }), polish: S({ color: "#c4c9cf", metalness: 1, roughness: .2 }) };
    const B = .08, r = .0265, l = .108, sp = .106, off = .018, bank = HP, ch = .021, deckD = r + l + ch + .053 / 16.5 + .0012, Hh = deckD - .06, hwB = B * .71, va = 11 * Math.PI / 180, camA = .1238, uc = B * .2 + camA * Math.sin(va), vc = .0055 + camA * Math.cos(va), rcl = .0155 + .0095 + .0022, hw = uc + rcl + .0065, vtop = vc + rcl + .013;
    const xs = [2, 1, 0, 2, 1, 0].map((q, k) => q * sp + (k < 3 ? 0 : off)), xmin = Math.min(...xs) - .045, xmax = Math.max(...xs) + .045, xc = (xmin + xmax) / 2, cyl = [], cams = [];
    for (let k = 0; k < 6; k++) { const left = k < 3, beta = (left ? -1 : 1) * bank / 2, dir = V(0, Math.cos(beta), Math.sin(beta)); cyl.push({ k, left, beta, x: xs[k], dir, side: V(0, -dir.z, dir.y) }) }
    const shell = (geo, mat) => { const m = new T.Mesh(geo, mat); root.add(m); return m };
    for (const left of [!0, !1]) for (const sg of left ? [1, -1] : [-1, 1]) { const c0 = cyl[left ? 0 : 3], o3 = new T.Object3D, p = c0.dir.clone().multiplyScalar(deckD + vc).addScaledVector(c0.side, sg * uc); o3.position.set(left ? sp : sp + off, p.y, p.z), root.add(o3), cams.push(o3) }
    crank.add(new T.Mesh(new T.CylinderGeometry(.014, .014, .05, 24).rotateZ(HP).translate(xmax + .03, 0, 0), M.polish), new T.Mesh(new T.CylinderGeometry(.024, .024, .03, 28).rotateZ(HP).translate(xmin - .012, 0, 0), M.polish));
    const out = LAB.enginecad.build({ THREE: T, root, M, TX, cyl, xmin, xmax, xc, deckD, hw, hwB, vc, vtop, uc, B, r, l, picks: [], exh: [], shellMats: [], shell, crank, cams, H: Hh, ratioK: 50 / 15, noClutch: !0, solid: !0 });
    out.mguk.material = M.motor.clone(), out.mguh.material = M.motor.clone();
    root.position.x = -(xmin - .017);
    grp.traverse(m => { m.isMesh && (m.castShadow = !0) });
    return { grp, root, crank, cams, out, xmin, xmax, xc, len: xmax - xmin + .2 }
  }
  return { V, latheX, latheZ, bearing, bevel, final, tripod, wheel, casing, bulkhead, engine }
})();
