/* ===================== CHASIS: ELEMENTOS FINITOS DE VIGAS =====================
   Coche entero como pórtico 3D de vigas de Euler-Bernoulli (6 grados de libertad por nudo): morro, monocasco de carbono
   (cajón de pared delgada en sándwich, con la abertura del habitáculo que le quita rigidez a torsión), motor como
   elemento estructural atornillado al mamparo con sus espárragos, caja de cambios portante, estructura trasera, pilón del
   alerón trasero y planos de los alerones. Ruedas como masas no suspendidas unidas por la rigidez en rueda de la
   suspensión y por el neumático al suelo. Masas concentradas (piloto, combustible, batería, motor, radiadores…).
   Modos propios por K·φ = ω²·M·φ (masa diagonal → problema estándar simétrico, Jacobi cíclico), banco de torsión
   (traseras empotradas, par en las delanteras), rigidez a flexión y respuesta en frecuencia del asiento a un bordillo. */
LAB.chassismodel = (() => {
  /* sección de cajón de pared delgada: ancho b, alto h, espesor equivalente t */
  function box(b, h, t, open = 0) {
    const A = 2 * t * (b + h), Ih = t * h ** 3 / 6 + b * t * h * h / 2, Iv = t * b ** 3 / 6 + h * t * b * b / 2, J = 4 * (b * h) ** 2 * t / (2 * (b + h));
    return { A, Iy: Ih, Iz: Iv, J: J * (1 - open) }
  }
  function build(P) {
    const nodes = [], els = [], springs = [], ground = [], mass = [];
    /* cotas del coche del simulador: las estaciones longitudinales se escalan a la batalla del reglamento */
    const kx = (P.wb || 3.6) / 3.6, N = (name, x, y, z, dof = 6, grp = "spine") => (nodes.push({ name, x: x * kx, y, z, dof, grp, m: 0, I: [0, 0, 0] }), nodes.length - 1);
    const E_c = P.Ec * 1e9, G_c = E_c * .36, E_ti = 110e9, G_ti = 42e9, E_al = 70e9, G_al = 26e9;
    /* columna: x adelante (eje trasero en 0), z arriba */
    const sp = [["Alerón del.", 4.92, .14], ["Morro", 4.45, .3], ["Mamparo del.", 3.95, .4], ["Eje delantero", 3.6, .4], ["Pies", 3.12, .38], ["Volante", 2.62, .36], ["Cadera", 2.12, .32], ["Depósito", 1.72, .34], ["Mamparo tras.", 1.42, .36], ["Motor", 1.0, .36], ["Motor tras.", .58, .34], ["Caja", .22, .3], ["Eje trasero", 0, .3], ["Estructura tras.", -.36, .32], ["Alerón tras.", -.62, .92]].map(([n, x, z]) => N(n, x, 0, z));
    const id = n => sp[n];
    /* secciones por tramo */
    const t = P.tw * 1e-3, sec = [
      ["nose", 0, 1, box(.22, .16, t * .9), E_c, G_c], ["nose", 1, 2, box(.32, .3, t * .9), E_c, G_c],
      ["mono", 2, 3, box(.36, .48, t), E_c, G_c], ["mono", 3, 4, box(.42, .52, t), E_c, G_c], ["mono", 4, 5, box(.52, .56, t, P.cockpit * .5), E_c, G_c],
      ["mono", 5, 6, box(.7, .6, t, P.cockpit), E_c, G_c], ["mono", 6, 7, box(.78, .62, t, P.cockpit * .6), E_c, G_c], ["mono", 7, 8, box(.8, .64, t), E_c, G_c],
      ["mount", 8, 9, null, E_al, G_al], ["engine", 9, 10, box(.5, .45, .012), E_al, G_al], ["gbmount", 10, 11, null, E_ti, G_ti],
      ["gb", 11, 12, box(.26, .28, P.gbt * 1e-3), E_ti, G_ti], ["gb", 12, 13, box(.22, .24, P.gbt * 1e-3), E_ti, G_ti], ["pylon", 13, 14, null, E_c, G_c]
    ];
    for (const [grp, a, b, s, E, G] of sec) {
      let S = s;
      /* uniones atornilladas: espárragos motor-chasis y motor-caja como vigas cortas equivalentes */
      if (grp === "mount") S = { A: .006, Iy: 1.6e-4 * P.kmount, Iz: 2.2e-4 * P.kmount, J: 2e-4 * P.kmount };
      if (grp === "gbmount") S = { A: .004, Iy: 1e-4 * P.kmount, Iz: 1.2e-4 * P.kmount, J: 1.2e-4 * P.kmount };
      if (grp === "pylon") S = { A: 6e-4, Iy: 2.4e-7 * P.kpylon, Iz: 6e-7 * P.kpylon, J: 2e-7 * P.kpylon };
      if (grp === "nose") S = { ...S, Iy: S.Iy * P.knose, Iz: S.Iz * P.knose, J: S.J * P.knose };
      els.push({ a: id(a), b: id(b), grp, E, G, ...S })
    }
    /* alerones: medio plano a cada lado (flexión vertical del plano principal) */
    const fwT = [N("Punta alerón del. izq.", 4.95, -.82, .1, 6, "fw"), N("Punta alerón del. dcha.", 4.95, .82, .1, 6, "fw")], rwT = [N("Punta alerón tras. izq.", -.66, -.48, .95, 6, "rw"), N("Punta alerón tras. dcha.", -.66, .48, .95, 6, "rw")];
    for (const n of fwT) els.push({ a: id(0), b: n, grp: "fw", E: E_c, G: G_c, A: 3e-4, Iy: 7e-8 * P.kfw, Iz: 2e-6, J: 1.2e-7 * P.kfw });
    for (const n of rwT) els.push({ a: id(14), b: n, grp: "rw", E: E_c, G: G_c, A: 4e-4, Iy: 1.2e-7 * P.krw, Iz: 3e-6, J: 2.5e-7 * P.krw });
    /* brazos de suspensión: puntos de anclaje rígidos a los lados del chasis y ruedas */
    const wheels = [];
    for (const [ax, xA, tr, kw, mu] of [[3, 3.6, P.trf, P.kwf, P.muf], [12, 0, P.trr, P.kwr, P.mur]]) for (const s of [-1, 1]) {
      /* trapecios y mangueta como palanca rígida hasta el centro de la rueda; la suspensión es el muelle vertical */
      const pk = N("Mangueta " + (ax === 3 ? "del." : "tras.") + (s < 0 ? " izq." : " dcha."), xA, s * tr / 2, .36, 6, "pick"), w = N("Rueda " + (ax === 3 ? "del." : "tras.") + (s < 0 ? " izq." : " dcha."), xA, s * tr / 2, .36, 3, "wheel");
      els.push({ a: id(ax), b: pk, grp: "arm", E: E_ti, G: G_ti, ...box(.3, .2, .006) });
      /* rueda: vertical con la rigidez en rueda, longitudinal y lateral casi rígidas (trapecios) */
      springs.push({ a: pk, b: w, k: [4e7, 4e7, kw * 1e3] }), ground.push({ n: w, k: [6e5, 3e5, P.kt * 1e3] }), nodes[w].m += mu, wheels.push({ n: w, pk, side: s, front: ax === 3 });
    }
    /* masas (kg) en los nudos; inercias de giro por rebanada */
    const add = (n, m, I = [0, 0, 0]) => { nodes[n].m += m; for (let k = 0; k < 3; k++) nodes[n].I[k] += I[k] };
    const slice = (n, m, b, h, L) => add(n, m, [m * (b * b + h * h) / 12, m * (L * L + h * h) / 12, m * (L * L + b * b) / 12]);
    slice(id(0), 5, .5, .1, .3), slice(id(1), 4, .3, .25, .5), slice(id(2), 7, .36, .45, .4), slice(id(3), 22, .5, .5, .45), slice(id(4), 10, .5, .5, .5), slice(id(5), 14 + P.driver * .3, .7, .6, .5);
    slice(id(6), 24 + P.driver * .7 + P.ballast * .5, 1.2, .6, .45), slice(id(7), 22 + P.fuel + 22 + P.ballast * .5, 1.3, .6, .4), slice(id(8), 45, 1.2, .5, .3), slice(id(9), 70 + 32, 1.0, .55, .45);
    slice(id(10), 45 + 20, .7, .5, .45), slice(id(11), 27, .3, .3, .4), slice(id(12), 24, .3, .3, .3), slice(id(13), 8, .25, .25, .3), slice(id(14), 6.5, .9, .3, .3);
    for (const n of fwT) slice(n, 1.4, .1, .05, .25);
    for (const n of rwT) slice(n, 1.2, .1, .05, .25);
    for (const w of wheels) slice(w.pk, 3, .1, .1, .1);
    /* lo que no está detallado arriba (carrocería, suelo, refrigeración, hidráulica, cableado) se reparte por el cuerpo del coche hasta
       llegar a la masa mínima del reglamento sin combustible: los F1 se construyen por debajo del mínimo y se lastran hasta él */
    if (P.mmin) { const sp = nodes.filter(n => n.grp === "spine" && n.m > 0), ms = sp.reduce((a, n) => a + n.m, 0), ex = P.mmin - (nodes.reduce((a, n) => a + n.m, 0) - P.fuel); if (ex > 0 && ms > 0) for (const n of sp) { const k = 1 + ex / ms; n.m *= k; for (let j = 0; j < 3; j++) n.I[j] *= k } }
    /* numeración de grados de libertad */
    let ndof = 0;
    for (const n of nodes) n.d0 = ndof, ndof += n.dof;
    return { nodes, els, springs, ground, wheels, ndof, sp, fwT, rwT }
  }
  /* ---------- ensamblaje ---------- */
  function localK(e, L) {
    const k = Array.from({ length: 12 }, () => new Float64Array(12)), a = e.E * e.A / L, tq = e.G * e.J / L, z = e.E * e.Iz, y = e.E * e.Iy, L2 = L * L, L3 = L2 * L;
    const S = (i, j, v) => { k[i][j] += v, i !== j && (k[j][i] += v) };
    S(0, 0, a), S(6, 6, a), S(0, 6, -a); S(3, 3, tq), S(9, 9, tq), S(3, 9, -tq);
    S(1, 1, 12 * z / L3), S(7, 7, 12 * z / L3), S(1, 7, -12 * z / L3), S(1, 5, 6 * z / L2), S(1, 11, 6 * z / L2), S(5, 7, -6 * z / L2), S(7, 11, -6 * z / L2), S(5, 5, 4 * z / L), S(11, 11, 4 * z / L), S(5, 11, 2 * z / L);
    S(2, 2, 12 * y / L3), S(8, 8, 12 * y / L3), S(2, 8, -12 * y / L3), S(2, 4, -6 * y / L2), S(2, 10, -6 * y / L2), S(4, 8, 6 * y / L2), S(8, 10, 6 * y / L2), S(4, 4, 4 * y / L), S(10, 10, 4 * y / L), S(4, 10, 2 * y / L);
    return k
  }
  function frameOf(A, B) {
    const ex = [B.x - A.x, B.y - A.y, B.z - A.z], L = Math.hypot(...ex);
    ex[0] /= L, ex[1] /= L, ex[2] /= L;
    const ref = Math.abs(ex[2]) > .9 ? [1, 0, 0] : [0, 0, 1];
    let ey = [ref[1] * ex[2] - ref[2] * ex[1], ref[2] * ex[0] - ref[0] * ex[2], ref[0] * ex[1] - ref[1] * ex[0]];
    const ly = Math.hypot(...ey); ey = ey.map(v => v / ly);
    const ez = [ex[1] * ey[2] - ex[2] * ey[1], ex[2] * ey[0] - ex[0] * ey[2], ex[0] * ey[1] - ex[1] * ey[0]];
    return { L, R: [ex, ey, ez] }
  }
  function assemble(S, opt = {}) {
    const n = S.ndof, K = Array.from({ length: n }, () => new Float64Array(n)), M = new Float64Array(n);
    const map = nd => { const o = []; for (let k = 0; k < 6; k++) o.push(k < nd.dof ? nd.d0 + k : -1); return o };
    for (const e of S.els) {
      const A = S.nodes[e.a], B = S.nodes[e.b], { L, R } = frameOf(A, B), kl = localK(e, L);
      e.L = L, e.R = R, e.kl = kl;
      /* T = diag(R,R,R,R); Kg = Tᵀ k T */
      const T = (i, j) => Math.floor(i / 3) === Math.floor(j / 3) ? R[i % 3][j % 3] : 0, kg = Array.from({ length: 12 }, () => new Float64Array(12)), tmp = Array.from({ length: 12 }, () => new Float64Array(12));
      for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) { let s = 0; const b0 = Math.floor(j / 3) * 3; for (let q = b0; q < b0 + 3; q++) s += kl[i][q] * T(q, j); tmp[i][j] = s }
      for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) { let s = 0; const b0 = Math.floor(i / 3) * 3; for (let q = b0; q < b0 + 3; q++) s += T(q, i) * tmp[q][j]; kg[i][j] = s }
      const dm = [...map(A), ...map(B)];
      for (let i = 0; i < 12; i++) if (dm[i] >= 0) for (let j = 0; j < 12; j++) dm[j] >= 0 && (K[dm[i]][dm[j]] += kg[i][j])
    }
    for (const s of S.springs) { const A = S.nodes[s.a], B = S.nodes[s.b]; for (let k = 0; k < 3; k++) { const kk = opt.rigidSusp ? 5e8 : s.k[k], i = A.d0 + k, j = B.d0 + k; K[i][i] += kk, K[j][j] += kk, K[i][j] -= kk, K[j][i] -= kk } }
    if (!opt.noGround) for (const g of S.ground) { const A = S.nodes[g.n]; for (let k = 0; k < 3; k++) K[A.d0 + k][A.d0 + k] += g.k[k] }
    for (const nd of S.nodes) { for (let k = 0; k < 3; k++) M[nd.d0 + k] = Math.max(nd.m, .05); if (nd.dof === 6) for (let k = 0; k < 3; k++) M[nd.d0 + 3 + k] = Math.max(nd.I[k], 2e-3) }
    return { K, M }
  }
  /* ---------- Jacobi cíclico para matrices simétricas ---------- */
  function jacobi(A0, maxSweep = 40) {
    const n = A0.length, A = A0.map(r => Float64Array.from(r)), V = Array.from({ length: n }, (_, i) => { const r = new Float64Array(n); r[i] = 1; return r });
    for (let sw = 0; sw < maxSweep; sw++) {
      let off = 0;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += A[p][q] * A[p][q];
      if (off < 1e-18 * n) break;
      for (let p = 0; p < n - 1; p++) for (let q = p + 1; q < n; q++) {
        const apq = A[p][q];
        if (Math.abs(apq) < 1e-14 * (Math.abs(A[p][p]) + Math.abs(A[q][q]) + 1e-30)) continue;
        const th = (A[q][q] - A[p][p]) / (2 * apq), tt = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(tt * tt + 1), s = tt * c;
        for (let k = 0; k < n; k++) { const akp = A[k][p], akq = A[k][q]; A[k][p] = c * akp - s * akq, A[k][q] = s * akp + c * akq }
        for (let k = 0; k < n; k++) { const apk = A[p][k], aqk = A[q][k]; A[p][k] = c * apk - s * aqk, A[q][k] = s * apk + c * aqk }
        for (let k = 0; k < n; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - s * vkq, V[k][q] = s * vkp + c * vkq }
      }
    }
    return { vals: A.map((r, i) => r[i]), V }
  }
  /* ---------- análisis modal ---------- */
  function modes(S, nModes = 14) {
    const { K, M } = assemble(S), n = S.ndof, mi = Float64Array.from(M, m => 1 / Math.sqrt(m)), A = K.map((r, i) => Float64Array.from(r, (v, j) => v * mi[i] * mi[j]));
    const { vals, V } = jacobi(A), order = vals.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]), out = [];
    for (const [lam, i] of order.slice(0, nModes)) {
      const phi = new Float64Array(n);
      for (let k = 0; k < n; k++) phi[k] = V[k][i] * mi[k]; /* normalizado a masa: φᵀMφ = 1 */
      const f = Math.sqrt(Math.max(0, lam)) / TAU, md = { f, w: TAU * f, phi };
      classify(S, md), out.push(md)
    }
    return { modes: out, K, M }
  }
  /* reparto de energía de deformación por tipo y zona para dar nombre a cada modo */
  function classify(S, md) {
    const phi = md.phi, gv = (nd, k) => k < nd.dof ? phi[nd.d0 + k] : 0, part = { tors: 0, bendV: 0, bendL: 0, axial: 0, fw: 0, rw: 0, pylon: 0, nose: 0, susp: 0, tyre: 0, mount: 0 };
    let tot = 0;
    for (const e of S.els) {
      const A = S.nodes[e.a], B = S.nodes[e.b], R = e.R, ul = new Float64Array(12);
      for (let blk = 0; blk < 4; blk++) { const nd = blk < 2 ? A : B, off = blk % 2 * 3; for (let i = 0; i < 3; i++) { let s = 0; for (let j = 0; j < 3; j++) s += R[i][j] * gv(nd, off + j); ul[blk * 3 + i] = s } }
      const k = e.kl, en = (ids) => { let s = 0; for (const i of ids) for (const j of ids) s += ul[i] * k[i][j] * ul[j]; return s / 2 };
      const eT = en([3, 9]), eV = en([2, 4, 8, 10]), eL = en([1, 5, 7, 11]), eA = en([0, 6]), sum = eT + eV + eL + eA;
      e.U = sum, tot += sum;
      if (e.grp === "fw") part.fw += sum; else if (e.grp === "rw") part.rw += sum; else if (e.grp === "pylon") part.pylon += sum; else if (e.grp === "nose") part.nose += sum;
      else { part.tors += eT, part.bendV += eV, part.bendL += eL, part.axial += eA; (e.grp === "mount" || e.grp === "gbmount") && (part.mount += sum) }
    }
    for (const s of S.springs) { const A = S.nodes[s.a], B = S.nodes[s.b]; for (let k = 0; k < 3; k++) { const d = gv(A, k) - gv(B, k); part.susp += .5 * s.k[k] * d * d } }
    for (const g of S.ground) { const A = S.nodes[g.n]; for (let k = 0; k < 3; k++) part.tyre += .5 * g.k[k] * gv(A, k) ** 2 }
    tot += part.susp + part.tyre;
    md.part = part, md.Utot = tot;
    /* energía cinética (φ normalizado a masa: total = 1) de las ruedas y de los movimientos de sólido rígido */
    let keW = 0;
    for (const w of S.wheels) { const nd = S.nodes[w.n]; keW += nd.m * (gv(nd, 0) ** 2 + gv(nd, 1) ** 2 + gv(nd, 2) ** 2) }
    const body = S.nodes.filter(nd => nd.grp !== "wheel"), Mt = body.reduce((q, nd) => q + nd.m, 0), xc = body.reduce((q, nd) => q + nd.m * nd.x, 0) / Mt;
    let H = 0, Y = 0, X = 0, a1 = 0, b1 = 0, a2 = 0, a3 = 0, b3 = 0;
    for (const nd of body) { const dx = nd.x - xc; H += nd.m * gv(nd, 2), Y += nd.m * gv(nd, 1), X += nd.m * gv(nd, 0), a1 += nd.m * gv(nd, 2) * dx, b1 += nd.m * dx * dx, a2 += nd.m * gv(nd, 1) * dx; if (nd.dof === 6) a3 += nd.I[0] * gv(nd, 3), b3 += nd.I[0]; a3 += nd.m * gv(nd, 2) * nd.y, b3 += nd.m * nd.y * nd.y }
    H /= Mt, Y /= Mt, X /= Mt;
    const Th = a1 / b1, Ps = a2 / b1, Ph = a3 / Math.max(1e-9, b3), rig = [["Bote (heave)", Mt * H * H], ["Cabeceo (pitch)", b1 * Th * Th], ["Balanceo (roll)", b3 * Ph * Ph], ["Deriva lateral sobre los neumáticos", Mt * Y * Y], ["Guiñada sobre los neumáticos", b1 * Ps * Ps], ["Avance sobre los neumáticos", Mt * X * X]].sort((p1, p2) => p2[1] - p1[1]);
    const struct = (part.tors + part.bendV + part.bendL + part.fw + part.rw + part.pylon + part.nose) / Math.max(1e-30, tot);
    let name, kind;
    if (keW > .5) {
      const fw = S.wheels.filter(w => w.front).reduce((q, w) => q + S.nodes[w.n].m * gv(S.nodes[w.n], 2) ** 2, 0), rw = keW - fw, same = S.wheels.filter(w => w.front === (fw > rw)), inPh = Math.sign(gv(S.nodes[same[0].n], 2)) === Math.sign(gv(S.nodes[same[1].n], 2));
      const zs = S.wheels.reduce((q, w) => q + S.nodes[w.n].m * gv(S.nodes[w.n], 2) ** 2, 0) / keW;
      name = zs > .5 ? `Salto de rueda ${fw > rw ? "delantero" : "trasero"} ${inPh ? "en fase" : "en oposición"}` : `Ruedas ${fw > rw ? "delanteras" : "traseras"}: vaivén lateral de los brazos`, kind = "wheel"
    } else if (struct < .35) name = rig[0][0], kind = "rigid";
    else {
      const c = [["Torsión del chasis", part.tors], ["Flexión vertical", part.bendV], ["Flexión lateral", part.bendL], ["Alerón delantero", part.fw], ["Alerón trasero y pilón", part.rw + part.pylon], ["Morro", part.nose]].sort((p1, p2) => p2[1] - p1[1]);
      name = c[0][0], kind = "struct";
      part.mount / Math.max(1e-30, tot) > .25 && (name += " (uniones del motor)")
    }
    md.keW = keW, md.struct = struct;
    md.name = name, md.kind = kind
  }
  /* ---------- sistema lineal (Gauss con pivote parcial) ---------- */
  function solve(K, F, fixed) {
    const n = K.length, idx = [];
    for (let i = 0; i < n; i++) fixed.has(i) || idx.push(i);
    const m = idx.length, A = idx.map(i => Float64Array.from(idx.map(j => K[i][j]))), b = Float64Array.from(idx.map(i => F[i]));
    for (let c = 0; c < m; c++) {
      let p = c; for (let r = c + 1; r < m; r++) Math.abs(A[r][c]) > Math.abs(A[p][c]) && (p = r);
      [A[c], A[p]] = [A[p], A[c]], [b[c], b[p]] = [b[p], b[c]];
      const d = A[c][c] || 1e-30;
      for (let r = c + 1; r < m; r++) { const f = A[r][c] / d; if (!f) continue; for (let k = c; k < m; k++) A[r][k] -= f * A[c][k]; b[r] -= f * b[c] }
    }
    const x = new Float64Array(m);
    for (let r = m - 1; r >= 0; r--) { let s = b[r]; for (let k = r + 1; k < m; k++) s -= A[r][k] * x[k]; x[r] = s / (A[r][r] || 1e-30) }
    const u = new Float64Array(n); idx.forEach((i, k) => u[i] = x[k]);
    return u
  }
  /* banco de torsión: amortiguadores sustituidos por bieletas rígidas, ruedas traseras empotradas, par en las delanteras */
  function torsion(S, F = 5000) {
    const { K } = assemble(S, { rigidSusp: !0, noGround: !0 }), n = S.ndof, Fv = new Float64Array(n), fixed = new Set;
    const fr = S.wheels.filter(w => w.front), rr = S.wheels.filter(w => !w.front);
    for (const w of rr) for (let k = 0; k < 3; k++) fixed.add(S.nodes[w.n].d0 + k);
    /* evita el giro libre: fija el desplazamiento lateral y longitudinal de las delanteras en su media */
    for (const w of fr) Fv[S.nodes[w.n].d0 + 2] = w.side * F, fixed.add(S.nodes[w.n].d0 + 0);
    fixed.add(S.nodes[fr[0].n].d0 + 1);
    /* el eje delantero del banco pivota en el centro: zL + zR = 0 (penalización) */
    const a = S.nodes[fr[0].n].d0 + 2, b = S.nodes[fr[1].n].d0 + 2, kp = 1e10;
    K[a][a] += kp, K[b][b] += kp, K[a][b] += kp, K[b][a] += kp;
    const u = solve(K, Fv, fixed), dz = fr.map(w => u[S.nodes[w.n].d0 + 2] * w.side), trk = Math.abs(S.nodes[fr[0].n].y - S.nodes[fr[1].n].y), ang = (dz[0] + dz[1]) / trk, T = F * trk;
    /* giro de cada sección de la columna (dónde se retuerce el coche) */
    const twist = S.sp.map(nn => ({ x: S.nodes[nn].x, a: u[S.nodes[nn].d0 + 3] }));
    return { u, k: T / (ang / DEG), T, ang, twist }
  }
  /* flexión: apoyos en los ejes y carga vertical repartida en el habitáculo */
  function bending(S, F = 10000) {
    const { K } = assemble(S, { rigidSusp: !0, noGround: !0 }), n = S.ndof, Fv = new Float64Array(n), fixed = new Set;
    for (const w of S.wheels) fixed.add(S.nodes[w.n].d0 + 2);
    const w0 = S.wheels[0], w2 = S.wheels.find(w => !w.front);
    fixed.add(S.nodes[w0.n].d0), fixed.add(S.nodes[w0.n].d0 + 1), fixed.add(S.nodes[w2.n].d0 + 1);
    const load = [5, 6, 7];
    for (const i of load) Fv[S.nodes[S.sp[i]].d0 + 2] = -F / load.length;
    const u = solve(K, Fv, fixed), dz = -load.reduce((s, i) => s + u[S.nodes[S.sp[i]].d0 + 2], 0) / load.length;
    return { u, k: F / dz }
  }
  /* respuesta en frecuencia: aceleración vertical del asiento por mm de bordillo bajo la rueda delantera izquierda */
  function frf(S, md, zeta, fmax = 150) {
    const seat = S.nodes[S.sp[6]].d0 + 2, wFL = S.wheels.find(w => w.front && w.side < 0), wd = S.nodes[wFL.n].d0 + 2, kt = S.ground.find(g => g.n === wFL.n).k[2], n = 300, f = new Float32Array(n), H = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const fr = (i + 1) / n * fmax, w = TAU * fr;
      let re = 0, im = 0;
      for (const m of md) { const a = m.phi[seat] * m.phi[wd] * kt, d1 = m.w * m.w - w * w, d2 = 2 * zeta * m.w * w, den = d1 * d1 + d2 * d2; re += a * d1 / den, im -= a * d2 / den }
      f[i] = fr, H[i] = w * w * Math.hypot(re, im) / 9.81 / 1e3
    }
    return { f, H }
  }
  function run(P) {
    const S = build(P), M = modes(S, P.nModes || 14), tor = torsion(S), ben = bending(S), mass = S.nodes.reduce((s, n) => s + n.m, 0);
    let mx = 0; for (const n of S.nodes) mx += n.m * n.x;
    return { S, modes: M.modes, tor, ben, mass, xcg: mx / mass, frf: frf(S, M.modes, P.zeta) }
  }
  return { build, assemble, modes, torsion, bending, frf, run, jacobi, box }
})();
