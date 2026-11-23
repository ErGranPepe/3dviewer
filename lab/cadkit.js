/* ===================== UTILIDADES DE MODELADO (piezas como en un CAD) =====================
   Tubos barridos con sección variable y tapas, bridas con sus tornillos, abrazaderas, volutas de turbo que se van
   cerrando alrededor de la rueda, engranajes con dientes, fuelles… Lo usan el motor y la transmisión para que cada
   conducto empiece y acabe en algo: una brida, otra pieza o una boca hecha a propósito. */
LAB.kit = (() => {
  const TH = () => window.THREE;
  const V = (x, y, z) => new (TH().Vector3)(x, y, z);
  /* unión de geometrías: posición + normal (+ uv si todas lo llevan) */
  function merge(list) {
    const T = TH(), gs = list.filter(Boolean).map(g => g.index ? g.toNonIndexed() : g);
    gs.forEach(g => g.attributes.normal || g.computeVertexNormals());
    const uv = gs.every(g => g.attributes.uv), n = gs.reduce((a, g) => a + g.attributes.position.count, 0), P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = uv ? new Float32Array(n * 2) : null;
    let o = 0;
    for (const g of gs) P.set(g.attributes.position.array, o * 3), N.set(g.attributes.normal.array, o * 3), uv && U.set(g.attributes.uv.array, o * 2), o += g.attributes.position.count;
    const out = new T.BufferGeometry;
    return out.setAttribute("position", new T.BufferAttribute(P, 3)), out.setAttribute("normal", new T.BufferAttribute(N, 3)), uv && out.setAttribute("uv", new T.BufferAttribute(U, 2)), out
  }
  /* polilínea suave por unos puntos de paso */
  const smooth = (pts, n = 40) => new (TH().CatmullRomCurve3)(pts, !1, "centripetal").getSpacedPoints(n);
  /* tubo barrido por una polilínea densa. rad: número, o función(t 0..1) que da el radio o [ra, rb] (ra en la dirección n0 y rb en la
     perpendicular); o.cap0 / o.cap1 cierran los extremos con una tapa plana */
  function sweep(P, rad, o = {}) {
    const T = TH(), n = P.length, M = o.sides || 20, pos = [], nor = [], uv = [], idx = [];
    const tan = P.map((p, i) => P[Math.min(n - 1, i + 1)].clone().sub(P[Math.max(0, i - 1)]).normalize());
    const anyN = t => { const a = Math.abs(t.y) < .9 ? V(0, 1, 0) : V(1, 0, 0); return a.addScaledVector(t, -a.dot(t)).normalize() };
    let N = o.n0 ? o.n0.clone().addScaledVector(tan[0], -o.n0.dot(tan[0])) : anyN(tan[0]);
    N.lengthSq() < 1e-10 ? N = anyN(tan[0]) : N.normalize();
    const rf = typeof rad === "function" ? rad : () => rad, ring = [], pw = o.pow || 1, sq = v => pw === 1 ? v : Math.sign(v) * Math.pow(Math.abs(v), pw);
    for (let i = 0; i < n; i++) {
      const t = tan[i];
      N.addScaledVector(t, -N.dot(t)), N.lengthSq() < 1e-10 ? N = anyN(t) : N.normalize();
      const B = new T.Vector3().crossVectors(t, N), r = rf(i / (n - 1)), ra = Array.isArray(r) ? r[0] : r, rb = Array.isArray(r) ? r[1] : r;
      ring.push([N.clone(), B, ra, rb]);
      for (let j = 0; j <= M; j++) {
        const a = j / M * Math.PI * 2, c0 = Math.cos(a), s0 = Math.sin(a), c = sq(c0), s = sq(s0), q1 = pw === 1 ? c0 : Math.sign(c0) * Math.pow(Math.abs(c0), 2 - pw), q2 = pw === 1 ? s0 : Math.sign(s0) * Math.pow(Math.abs(s0), 2 - pw), nx = N.x * q1 * rb + B.x * q2 * ra, ny = N.y * q1 * rb + B.y * q2 * ra, nz = N.z * q1 * rb + B.z * q2 * ra, nl = Math.hypot(nx, ny, nz) || 1;
        pos.push(P[i].x + N.x * ra * c + B.x * rb * s, P[i].y + N.y * ra * c + B.y * rb * s, P[i].z + N.z * ra * c + B.z * rb * s), nor.push(nx / nl, ny / nl, nz / nl), uv.push(i / (n - 1), j / M)
      }
    }
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < M; j++) { const a = i * (M + 1) + j, b = a + M + 1; idx.push(a, a + 1, b, b, a + 1, b + 1) }
    const cap = (i, sgn) => {
      const c0 = pos.length / 3, [Nn, B, ra, rb] = ring[i], t = tan[i];
      pos.push(P[i].x, P[i].y, P[i].z), nor.push(t.x * sgn, t.y * sgn, t.z * sgn), uv.push(.5, .5);
      for (let j = 0; j <= M; j++) { const a = j / M * Math.PI * 2, c = sq(Math.cos(a)), s = sq(Math.sin(a)); pos.push(P[i].x + Nn.x * ra * c + B.x * rb * s, P[i].y + Nn.y * ra * c + B.y * rb * s, P[i].z + Nn.z * ra * c + B.z * rb * s), nor.push(t.x * sgn, t.y * sgn, t.z * sgn), uv.push(.5 + c * .5, .5 + s * .5) }
      for (let j = 0; j < M; j++) sgn < 0 ? idx.push(c0, c0 + 2 + j, c0 + 1 + j) : idx.push(c0, c0 + 1 + j, c0 + 2 + j)
    };
    o.cap0 && cap(0, -1), o.cap1 && cap(n - 1, 1);
    /* pared: una segunda piel por dentro, mirando al interior, para que la pieza se pueda seccionar y se vea hueca */
    if (o.wall) {
      const b0 = pos.length / 3;
      for (let i = 0; i < n; i++) {
        const [Nn, B, ra, rb] = ring[i], ia = Math.max(1e-4, ra - o.wall), ib = Math.max(1e-4, rb - o.wall);
        for (let j = 0; j <= M; j++) { const a = j / M * Math.PI * 2, c0 = Math.cos(a), s0 = Math.sin(a), c = sq(c0), s = sq(s0), q1 = pw === 1 ? c0 : Math.sign(c0) * Math.pow(Math.abs(c0), 2 - pw), q2 = pw === 1 ? s0 : Math.sign(s0) * Math.pow(Math.abs(s0), 2 - pw), nx = Nn.x * q1 * ib + B.x * q2 * ia, ny = Nn.y * q1 * ib + B.y * q2 * ia, nz = Nn.z * q1 * ib + B.z * q2 * ia, nl = Math.hypot(nx, ny, nz) || 1; pos.push(P[i].x + Nn.x * ia * c + B.x * ib * s, P[i].y + Nn.y * ia * c + B.y * ib * s, P[i].z + Nn.z * ia * c + B.z * ib * s), nor.push(-nx / nl, -ny / nl, -nz / nl), uv.push(i / (n - 1), j / M) }
      }
      for (let i = 0; i < n - 1; i++) for (let j = 0; j < M; j++) { const a = b0 + i * (M + 1) + j, b = a + M + 1; idx.push(a, b, a + 1, b, b + 1, a + 1) }
      /* canto de la boca: une las dos pieles en el extremo abierto (o.rim0: el inicial; o.rim1: el final) */
      for (const [on, i, sgn] of [[o.rim0, 0, -1], [o.rim1, n - 1, 1]]) {
        if (!on) continue;
        const c0 = pos.length / 3, t = tan[i];
        for (const base of [i * (M + 1), b0 + i * (M + 1)]) for (let j = 0; j <= M; j++) pos.push(pos[(base + j) * 3], pos[(base + j) * 3 + 1], pos[(base + j) * 3 + 2]), nor.push(t.x * sgn, t.y * sgn, t.z * sgn), uv.push(0, j / M);
        for (let j = 0; j < M; j++) { const a = c0 + j, b = c0 + M + 1 + j; sgn < 0 ? idx.push(a, b, a + 1, b, b + 1, a + 1) : idx.push(a, a + 1, b, b, a + 1, b + 1) }
      }
    }
    const g = new T.BufferGeometry;
    return g.setAttribute("position", new T.Float32BufferAttribute(pos, 3)), g.setAttribute("normal", new T.Float32BufferAttribute(nor, 3)), g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2)), g.setIndex(idx), g
  }
  /* tubo por puntos de paso (se suaviza); o.seg muestras */
  const tube = (pts, rad, o = {}) => sweep(smooth(pts, o.seg || 44), rad, o);
  /* base que lleva el eje Y local a "dir" */
  function basis(dir, pos, xh) {
    const T = TH(), y = dir.clone().normalize();
    let x = (xh || (Math.abs(y.x) < .9 ? V(1, 0, 0) : V(0, 0, 1))).clone(); x.addScaledVector(y, -x.dot(y)).normalize();
    const m = new T.Matrix4().makeBasis(x, y, new T.Vector3().crossVectors(x, y));
    return pos && m.setPosition(pos), m
  }
  const put = (g, pos, dir, xh) => g.applyMatrix4(basis(dir, pos, xh));
  const lathe = (pts, seg = 40) => new (TH().LatheGeometry)(pts.map(p => new (TH().Vector2)(Math.max(0, p[0]), p[1])), seg);
  /* torneado por tramos con aristas vivas */
  function latheHard(pts, seg = 40) { const a = []; for (let i = 0; i < pts.length - 1; i++) { const p = pts[i], q = pts[i + 1]; (p[0] !== q[0] || p[1] !== q[1]) && a.push(new (TH().LatheGeometry)([new (TH().Vector2)(Math.max(0, p[0]), p[1]), new (TH().Vector2)(Math.max(0, q[0]), q[1])], seg)) } return merge(a) }
  const hex = (r, h) => new (TH().CylinderGeometry)(r, r, h, 6);
  /* brida: anillo de espesor t con nb tornillos (cabeza por un lado, tuerca por el otro); eje Y, centrada */
  function flange(ri, ro, t, nb = 6, bd = .0045) {
    const gs = [latheHard([[ri, -t / 2], [ro, -t / 2], [ro, t / 2], [ri, t / 2], [ri, -t / 2]], 36)], rb = (ri + ro) / 2 + (ro - ri) * .08;
    for (let k = 0; k < nb; k++) { const a = (k + .5) / nb * Math.PI * 2, x = Math.cos(a) * rb, z = Math.sin(a) * rb; gs.push(hex(bd, bd * .8).translate(x, t / 2 + bd * .4, z), hex(bd, bd * .9).translate(x, -t / 2 - bd * .45, z)) }
    return merge(gs)
  }
  /* abrazadera en V (la de las carcasas de turbo y los escapes): aro de sección trapecial con su tornillo en T */
  function vband(r, w = .012) {
    const T = TH();
    return merge([latheHard([[r, -w / 2], [r + .005, -w * .28], [r + .005, w * .28], [r, w / 2]], 40), new T.BoxGeometry(.014, w * .9, .012).translate(r + .009, 0, 0), new T.CylinderGeometry(.003, .003, .034, 10).rotateX(Math.PI / 2).translate(r + .011, 0, 0), hex(.0052, .005).rotateX(Math.PI / 2).translate(r + .011, 0, .018)])
  }
  /* abrazadera de manguera: banda fina con su tornillo sinfín */
  function hoseClamp(r, w = .009) {
    const T = TH();
    return merge([latheHard([[r, -w / 2], [r + .0012, -w / 2], [r + .0012, w / 2], [r, w / 2]], 32), new T.BoxGeometry(.008, w * 1.1, .012).translate(r + .004, 0, 0), hex(.003, .006).rotateX(Math.PI / 2).translate(r + .005, 0, .009)])
  }
  /* voluta: tubo que se enrolla alrededor de una rueda de eje X (centro en x0 sobre el eje) y se va cerrando; del extremo grande sale
     un tramo recto tangente de longitud "tail". a0/a1 = radio de la sección en la boca y al final (número o [axial, radial]) */
  function volute(o) {
    const P = [], R = [], K = 10, S = o.steps || 80, dir = o.dir || 1, ph0 = o.phi0 || 0, two = Array.isArray(o.a0), A0 = two ? o.a0 : [o.a0, o.a0], k1 = (o.a1 || .2 * A0[1]) / A0[1], kx = o.ax1 == null ? k1 : o.ax1;
    const rad = s => { const q = Math.sqrt(Math.max(0, 1 - s)); return [A0[0] * (kx + (1 - kx) * q), A0[1] * (k1 + (1 - k1) * q)] };
    const at = s => { const ph = ph0 + dir * o.sweep * s, rr = o.Rw + o.gap + rad(s)[1]; return V(o.x0 || 0, rr * Math.cos(ph), rr * Math.sin(ph)) };
    const p0 = at(0), t0 = V(0, Math.sin(ph0), -Math.cos(ph0)).multiplyScalar(dir);
    for (let k = K; k >= 1; k--) P.push(p0.clone().addScaledVector(t0, o.tail * k / K)), R.push(A0);
    for (let i = 0; i <= S; i++) P.push(at(i / S)), R.push(rad(i / S));
    const n = P.length, geo = sweep(P, t => R[Math.min(n - 1, Math.round(t * (n - 1)))], { sides: o.sides || 24, n0: V(1, 0, 0), cap1: !0, wall: o.wall });
    return { geo, mouth: P[0].clone(), out: t0.clone(), a0: A0, p0 }
  }
  /* engranaje recto: z dientes de módulo m, ancho "face" (eje Z, centrado), agujero "bore" */
  function gear(r, face, bore, m = .0024) {
    const T = TH(), z = Math.max(9, Math.round(2 * r / m)), rr = r - 1.15 * m, rt = r + .95 * m, sh = new T.Shape(), tau = Math.PI * 2 / z;
    for (let k = 0; k < z; k++) for (const [f, rad] of [[0, rr], [.2, rr], [.36, rt], [.64, rt], [.8, rr]]) { const a = (k + f) * tau, x = Math.cos(a) * rad, y = Math.sin(a) * rad; k || f ? sh.lineTo(x, y) : sh.moveTo(x, y) }
    sh.closePath();
    if (bore) { const h = new T.Path(); h.absarc(0, 0, bore, 0, Math.PI * 2, !0), sh.holes.push(h) }
    return new T.ExtrudeGeometry(sh, { depth: face, bevelEnabled: !1, curveSegments: 4 }).translate(0, 0, -face / 2)
  }
  /* engranaje recto de z dientes y módulo m (radio primitivo z·m/2); eje Z, centrado. El diente k tiene su centro en el ángulo (k + ½)·2π/z */
  function gearZ(z, m, face, bore) {
    const T = TH(), r = z * m / 2, rr = r - 1.15 * m, rt = r + .95 * m, sh = new T.Shape(), tau = Math.PI * 2 / z;
    for (let k = 0; k < z; k++) for (const [f, rad] of [[0, rr], [.2, rr], [.36, rt], [.64, rt], [.8, rr]]) { const a = (k + f) * tau, x = Math.cos(a) * rad, y = Math.sin(a) * rad; k || f ? sh.lineTo(x, y) : sh.moveTo(x, y) }
    sh.closePath();
    if (bore) { const h = new T.Path(); h.absarc(0, 0, bore, 0, Math.PI * 2, !0), sh.holes.push(h) }
    return new T.ExtrudeGeometry(sh, { depth: face, bevelEnabled: !1, curveSegments: 4 }).translate(0, 0, -face / 2)
  }
  /* rueda radial de turbo: eje X, dorso en x = 0 y nariz hacia +x (o.sx = -1: hacia -x). Cubo curvo, disco trasero y álabes con espesor,
     inclinados en la boca y casi radiales en la salida; o.split intercala álabes cortos. o.tip = radio de la punta en la boca / radio de la rueda */
  function impeller(R, len, nb, o = {}) {
    const T = TH(), sx = o.sx || 1, rn = R * (o.nose || .22), rs = R * (o.tip || .68), b2 = len * (o.b2 || .14), wrap = o.wrap == null ? .9 : o.wrap, th = o.th || .0012, NM = 16, gs = [];
    const Hb = a => [len * (1 - Math.sin(a)), R - (R - rn) * Math.cos(a)], Sh = a => [b2 + (len * .97 - b2) * (1 - Math.sin(a)), R - (R - rs) * Math.cos(a)];
    const prof = [[0, -len * .12], [R * .45, -len * .12], [R, -len * .05]];
    for (let i = NM; i >= 0; i--) { const [x, rr] = Hb(i / NM * Math.PI / 2); prof.push([rr, x]) }
    prof.push([rn * .9, len * 1.03], [0, len * 1.05]);
    gs.push(new T.LatheGeometry(prof.map(p => new T.Vector2(p[0], p[1])), 48).rotateZ(-sx * Math.PI / 2));
    const blade = (th0, m0) => {
      const pos = [], idx = [];
      for (let i = 0; i <= NM; i++) {
        const m = m0 + (1 - m0) * i / NM, a = m * Math.PI / 2, t = th0 + wrap * Math.pow(1 - m, 1.5) + wrap * .18 * (1 - m), [xh, rh] = Hb(a), [xs, rt] = Sh(a);
        for (const [x, rr, sg] of [[xh, rh * .97, 1], [xs, rt, 1], [xs, rt, -1], [xh, rh * .97, -1]]) { const tt = t + sg * th / 2 / Math.max(rr, .004); pos.push(x * sx, rr * Math.cos(tt), rr * Math.sin(tt)) }
      }
      const q = (a, b, c, d) => sx > 0 ? idx.push(a, b, c, a, c, d) : idx.push(a, c, b, a, d, c);
      for (let i = 0; i < NM; i++) { const a = i * 4, b = a + 4; q(a, b, b + 1, a + 1), q(a + 1, b + 1, b + 2, a + 2), q(a + 2, b + 2, b + 3, a + 3) }
      q(0, 1, 2, 3), q(NM * 4 + 3, NM * 4 + 2, NM * 4 + 1, NM * 4);
      const g = new T.BufferGeometry;
      return g.setAttribute("position", new T.Float32BufferAttribute(pos, 3)), g.setIndex(idx), g.computeVertexNormals(), g
    };
    for (let k = 0; k < nb; k++) gs.push(blade(k / nb * Math.PI * 2, 0)), o.split && gs.push(blade((k + .5) / nb * Math.PI * 2 + wrap * .12, .38));
    return merge(gs.map(g => { const h = g.index ? g.toNonIndexed() : g; return h.deleteAttribute("uv"), h }))
  }
  /* placa con contorno poligonal (puntos 2D) extruida "depth"; holes: lista de [x, y, r] */
  function plate(pts, depth, holes) {
    const T = TH(), sh = new T.Shape();
    pts.forEach((p, i) => i ? sh.lineTo(p[0], p[1]) : sh.moveTo(p[0], p[1])), sh.closePath();
    for (const [x, y, r] of holes || []) { const h = new T.Path(); h.absarc(x, y, r, 0, Math.PI * 2, !0), sh.holes.push(h) }
    return new T.ExtrudeGeometry(sh, { depth, bevelEnabled: !1, curveSegments: 24 })
  }
  return { V, merge, smooth, sweep, tube, basis, put, lathe, latheHard, hex, flange, vband, hoseClamp, volute, gear, gearZ, impeller, plate }
})();
