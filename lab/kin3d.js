/* ===================== CINEMÁTICA 3D DE LA SUSPENSIÓN =====================
   Doble trapecio con puntos duros en 3D (x adelante desde el eje delantero, y a la derecha, z arriba, en mm), mangueta
   como sólido rígido fijado por las dos rótulas y la bieleta de dirección, bieleta de suspensión (pushrod o pullrod) a un
   balancín de eje longitudinal y amortiguador. Para cada giro del trapecio inferior y cada posición de la cremallera:
     · rótula superior: intersección del arco del trapecio superior con la esfera de la mangueta (Newton);
     · giro de la mangueta alrededor del eje de pivote: longitud de la bieleta de dirección (Newton);
     · rueda: eje de giro, caída, convergencia, huella; eje de pivote: avance, inclinación, radio de pivotamiento y
       avance mecánico; centros instantáneos en vista frontal (centro de balanceo) y lateral (antihundimiento);
     · balancín y amortiguador: relación de movimiento.
   Cargas: equilibrio de la mangueta con seis barras biarticuladas (dos por trapecio, bieleta y dirección) frente a las
   fuerzas y el momento autoalineante en la huella → fuerza axial en cada barra (tracción/compresión). */
LAB.kin3d = (() => {
  const v = (x, y, z) => [x, y, z], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], len = a => Math.hypot(a[0], a[1], a[2]), nrm = a => mul(a, 1 / (len(a) || 1));
  /* rotación de Rodrigues de p alrededor del eje (punto c, dirección unitaria k) */
  const rotAx = (p, c, k, t) => { const d = sub(p, c), cs = Math.cos(t), sn = Math.sin(t), kd = dot(k, d), kx = cross(k, d); return add(c, add(add(mul(d, cs), mul(kx, sn)), mul(k, kd * (1 - cs)))) };
  /* cuaternión mínimo que lleva a en b (como función de rotación) */
  function rotBetween(a, b) {
    const c = cross(a, b), s = len(c), d = dot(a, b);
    if (s < 1e-12) return p => p.slice();
    const k = mul(c, 1 / s), t = Math.atan2(s, d);
    return p => rotAx(p, [0, 0, 0], k, t)
  }
  const PUSH = { type: "push", LF: [210, 235, 150], LR: [-200, 225, 140], LO: [-5, 705, 170], UF: [175, 310, 380], UR: [-215, 300, 370], UO: [-35, 660, 505], PO: [-15, 650, 222], TI: [95, 255, 198], TO: [92, 668, 252], RP: [-30, 115, 560], SD: [-30, -150, 600], r1: 75, r2: 55, rbeta: 50, ralpha: 40, track: 1620, R: 360, camber: -3.2, toe: 0 };
  const PULL = { ...PUSH, type: "pull", PO: [-25, 640, 468], RP: [-30, 150, 120], SD: [-30, -120, 65], r1: 75, r2: 80, rbeta: 4, ralpha: 124 };
  const PTS = ["LF", "LR", "LO", "UF", "UR", "UO", "PO", "TI", "TO", "RP", "SD"];
  const NAMES = { LF: "Trapecio inferior, anclaje delantero", LR: "Trapecio inferior, anclaje trasero", LO: "Rótula inferior", UF: "Trapecio superior, anclaje delantero", UR: "Trapecio superior, anclaje trasero", UO: "Rótula superior", PO: "Bieleta en la mangueta", TI: "Extremo de la cremallera", TO: "Brazo de dirección", RP: "Eje del balancín", SD: "Anclaje del amortiguador" };
  /* convierte parámetros planos (hp_LF_x…) en puntos en metros */
  function fromParams(P) {
    const H = { type: P.type || "push" };
    for (const k of PTS) H[k] = [P["hp_" + k + "_x"], P["hp_" + k + "_y"], P["hp_" + k + "_z"]].map(x => x / 1e3);
    for (const k of ["r1", "r2"]) H[k] = P["hp_" + k] / 1e3;
    H.beta0 = P.hp_rbeta * DEG, H.alpha = P.hp_ralpha * DEG, H.R = P.rtyre / 1e3, H.tw = P.track / 2e3, H.cam0 = P.camber * DEG, H.toe0 = (P.toe || 0) * DEG;
    return H
  }
  function toParams(H) { const o = { type: H.type }; for (const k of PTS) ["x", "y", "z"].forEach((a, i) => o["hp_" + k + "_" + a] = H[k][i]); o.hp_r1 = H.r1, o.hp_r2 = H.r2, o.hp_rbeta = H.rbeta, o.hp_ralpha = H.ralpha; return o }
  function prep(H) {
    const g = { ...H };
    g.aL = nrm(sub(H.LR, H.LF)), g.aU = nrm(sub(H.UR, H.UF)), g.dk = len(sub(H.UO, H.LO)), g.Ltr = len(sub(H.TO, H.TI));
    /* rueda en estático: huella en (0, vía/2, 0), eje de giro con caída y convergencia */
    const cg = H.cam0, tg = H.toe0;
    g.s0 = nrm([-Math.sin(tg) * Math.cos(cg), Math.cos(tg) * Math.cos(cg), -Math.sin(cg)]);
    const CP0 = [0, H.tw, 0], up = [0, 0, 1], dIn = nrm(sub(up, mul(g.s0, dot(up, g.s0))));
    g.CP0 = CP0, g.WC0 = add(CP0, mul(dIn, H.R)), g.k0 = nrm(sub(H.UO, H.LO));
    g.RA0 = add(H.RP, [0, H.r1 * Math.cos(H.beta0), H.r1 * Math.sin(H.beta0)]), g.Lp = len(sub(g.RA0, H.PO));
    return g
  }
  /* resuelve la posición para el giro th del trapecio inferior y el desplazamiento de cremallera rack (m) */
  function solve(g, th, rack, prev) {
    const LO = rotAx(g.LO, g.LF, g.aL, th);
    let ph = prev ? prev.ph : th * .9;
    for (let it = 0; it < 30; it++) {
      const f = len(sub(rotAx(g.UO, g.UF, g.aU, ph), LO)) - g.dk, h = 1e-6, df = (len(sub(rotAx(g.UO, g.UF, g.aU, ph + h), LO)) - g.dk - f) / h;
      if (Math.abs(df) < 1e-12) return null;
      const st = f / df;
      ph -= clamp(st, -.2, .2);
      if (Math.abs(st) < 1e-12) break
    }
    const UO = rotAx(g.UO, g.UF, g.aU, ph);
    if (Math.abs(len(sub(UO, LO)) - g.dk) > 1e-6) return null;
    const k = nrm(sub(UO, LO)), R1 = rotBetween(g.k0, k), TI = add(g.TI, [0, rack, 0]);
    const X = (p0, ps) => rotAx(add(LO, R1(sub(p0, g.LO))), LO, k, ps);
    let ps = prev ? prev.ps : 0;
    for (let it = 0; it < 30; it++) {
      const f = len(sub(X(g.TO, ps), TI)) - g.Ltr, h = 1e-6, df = (len(sub(X(g.TO, ps + h), TI)) - g.Ltr - f) / h;
      if (Math.abs(df) < 1e-12) return null;
      const st = f / df;
      ps -= clamp(st, -.2, .2);
      if (Math.abs(st) < 1e-12) break
    }
    if (Math.abs(len(sub(X(g.TO, ps), TI)) - g.Ltr) > 1e-6) return null;
    const Rv = p => rotAx(R1(p), [0, 0, 0], k, ps), TO = X(g.TO, ps), PO = X(g.PO, ps), WC = X(g.WC0, ps), s = nrm(Rv(g.s0));
    const dIn = nrm(sub([0, 0, -1], mul(s, dot([0, 0, -1], s)))), CP = add(WC, mul(dIn, g.R));
    /* balancín en el plano x = RP.x */
    const dx = PO[0] - g.RP[0], rho2 = g.Lp * g.Lp - dx * dx;
    if (rho2 <= 0) return null;
    const rho = Math.sqrt(rho2), c0 = [g.RP[1], g.RP[2]], c1 = [PO[1], PO[2]], dd = Math.hypot(c1[0] - c0[0], c1[1] - c0[1]);
    if (dd > g.r1 + rho || dd < Math.abs(g.r1 - rho)) return null;
    const a = (g.r1 * g.r1 - rho * rho + dd * dd) / (2 * dd), hh = Math.sqrt(Math.max(0, g.r1 * g.r1 - a * a)), u = [(c1[0] - c0[0]) / dd, (c1[1] - c0[1]) / dd], m = [c0[0] + u[0] * a, c0[1] + u[1] * a];
    const q1 = [m[0] - u[1] * hh, m[1] + u[0] * hh], q2 = [m[0] + u[1] * hh, m[1] - u[0] * hh], ref = prev ? [prev.RA[1], prev.RA[2]] : [g.RA0[1], g.RA0[2]];
    const q = Math.hypot(q1[0] - ref[0], q1[1] - ref[1]) < Math.hypot(q2[0] - ref[0], q2[1] - ref[1]) ? q1 : q2, RA = [g.RP[0], q[0], q[1]];
    const beta = Math.atan2(q[1] - g.RP[2], q[0] - g.RP[1]), RD = [g.RP[0], g.RP[1] + g.r2 * Math.cos(beta + g.alpha), g.RP[2] + g.r2 * Math.sin(beta + g.alpha)], Ld = len(sub(RD, g.SD));
    /* ángulos de la rueda y del pivote */
    const camber = -Math.asin(clamp(s[2], -1, 1)), toe = Math.atan2(-s[0], s[1]), caster = Math.atan2(-k[0], k[2]), kpi = Math.atan2(-k[1], k[2]);
    const tg = -LO[2] / k[2], Pg = add(LO, mul(k, tg)), scrub = CP[1] - Pg[1], trail = Pg[0] - CP[0];
    /* centros instantáneos: vista frontal (plano x = huella) y lateral */
    const pierce = (A, B, x) => { const t = (x - A[0]) / (B[0] - A[0] || 1e-9); return add(A, mul(sub(B, A), t)) };
    const lx = (p1, p2, p3, p4) => { const d = (p1[0] - p2[0]) * (p3[1] - p4[1]) - (p1[1] - p2[1]) * (p3[0] - p4[0]); if (Math.abs(d) < 1e-12) return null; const t = ((p1[0] - p3[0]) * (p3[1] - p4[1]) - (p1[1] - p3[1]) * (p3[0] - p4[0])) / d; return [p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1])] };
    const Lp = pierce(rotAx(g.LF, g.LF, g.aL, 0), g.LR, LO[0]), Up = pierce(g.UF, g.UR, UO[0]);
    const IC = lx([Lp[1], Lp[2]], [LO[1], LO[2]], [Up[1], Up[2]], [UO[1], UO[2]]), rc = IC ? lx([CP[1], CP[2]], IC, [0, 0], [0, 1]) : null;
    const SV = lx([g.LF[0], g.LF[2]], [g.LR[0], g.LR[2]], [g.UF[0], g.UF[2]], [g.UR[0], g.UR[2]]);
    const svAng = SV ? Math.atan2(SV[1] - CP[2], Math.abs(SV[0] - CP[0])) * Math.sign(SV[0] - CP[0] || 1) : 0;
    return { th, ph, ps, rack, LO, UO, k, TO, TI, PO, WC, s, CP, RA, RD, Ld, beta, camber, toe, caster, kpi, scrub, trail, Pg, IC, rcz: rc ? rc[1] : NaN, SV, svAng, sw: CP[2] - g.CP0[2], dy: CP[1] - g.CP0[1] }
  }
  /* tabla por recorrido (m, + compresión) con la cremallera centrada */
  function table(H) {
    const g = prep(H), raw = [];
    for (const dir of [1, -1]) { let prev = null; for (let i = 0; i <= 260; i++) { const r = solve(g, dir * i * .0009, 0, prev); if (!r) break; prev = r, (i || dir > 0) && raw.push(r) } }
    raw.sort((a, b) => a.sw - b.sw);
    return { g, raw }
  }
  /* fuerzas axiales en las 6 barras (N, + tracción) para fuerzas en la huella F (N, ejes coche) y momento autoalineante Mz */
  function loads(g, sol, F, Mz) {
    const links = [["Trapecio inf. delantero", g.LF, sol.LO], ["Trapecio inf. trasero", g.LR, sol.LO], ["Trapecio sup. delantero", g.UF, sol.UO], ["Trapecio sup. trasero", g.UR, sol.UO], [g.type === "pull" ? "Pullrod" : "Pushrod", sol.RA, sol.PO], ["Bieleta de dirección", sol.TI, sol.TO]];
    const O = sol.WC, A = [[], [], [], [], [], []];
    links.forEach(([, c, p], j) => { const u = nrm(sub(c, p)), m = cross(sub(p, O), u); for (let i = 0; i < 3; i++) A[i][j] = u[i], A[i + 3][j] = m[i] });
    const Mext = add(cross(sub(sol.CP, O), F), [0, 0, Mz || 0]), b = [-F[0], -F[1], -F[2], -Mext[0], -Mext[1], -Mext[2]];
    const M = A.map((r, i) => [...r, b[i]]);
    for (let i = 0; i < 6; i++) { let p = i; for (let r = i + 1; r < 6; r++) Math.abs(M[r][i]) > Math.abs(M[p][i]) && (p = r); [M[i], M[p]] = [M[p], M[i]]; if (Math.abs(M[i][i]) < 1e-12) return null; for (let r = i + 1; r < 6; r++) { const f = M[r][i] / M[i][i]; for (let c = i; c <= 6; c++) M[r][c] -= f * M[i][c] } }
    const f = new Array(6).fill(0);
    for (let i = 5; i >= 0; i--) { let s = M[i][6]; for (let j = i + 1; j < 6; j++) s -= M[i][j] * f[j]; f[i] = s / M[i][i] }
    return links.map(([n, c, p], j) => ({ name: n, f: f[j], c, p }))
  }
  return { PUSH, PULL, PTS, NAMES, fromParams, toParams, prep, solve, table, loads, util: { sub, add, mul, dot, cross, len, nrm, rotAx } }
})();
