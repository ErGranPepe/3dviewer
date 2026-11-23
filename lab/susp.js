/* ===================== LABORATORIO DE SUSPENSIÓN =====================
   Eje delantero (medio coche): cinemática de doble trapecio en vista frontal con balancín pushrod/pullrod,
   relación de movimiento no lineal, amortiguador de 4 vías, topes (packers), tercer muelle (heave), inerter,
   barra estabilizadora, neumático con despegue, aerodinámica con efecto suelo y bombeo (porpoising). */
LAB.susp = (() => {
  const G = 9.81;
  /* ---------- cinemática ---------- */
  const rot = (p, c, a) => { const s = Math.sin(a), k = Math.cos(a), x = p[0] - c[0], y = p[1] - c[1]; return [c[0] + x * k - y * s, c[1] + x * s + y * k] };
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]], add = (a, b) => [a[0] + b[0], a[1] + b[1]], mul = (a, k) => [a[0] * k, a[1] * k], len = a => Math.hypot(a[0], a[1]);
  function circ(c0, r0, c1, r1, near) {
    const d = len(sub(c1, c0));
    if (d > r0 + r1 || d < Math.abs(r0 - r1) || d === 0) return null;
    const a = (r0 * r0 - r1 * r1 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, r0 * r0 - a * a)), u = mul(sub(c1, c0), 1 / d), m = add(c0, mul(u, a)),
      p1 = [m[0] - u[1] * h, m[1] + u[0] * h], p2 = [m[0] + u[1] * h, m[1] - u[0] * h];
    return len(sub(p1, near)) < len(sub(p2, near)) ? p1 : p2
  }
  function lineX(p1, p2, p3, p4) {
    const d = (p1[0] - p2[0]) * (p3[1] - p4[1]) - (p1[1] - p2[1]) * (p3[0] - p4[0]);
    if (Math.abs(d) < 1e-12) return null;
    const t = ((p1[0] - p3[0]) * (p3[1] - p4[1]) - (p1[1] - p3[1]) * (p3[0] - p4[0])) / d;
    return [p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1])]
  }
  /* geometría en metros a partir de los parámetros (mm) */
  function geom(P) {
    const mm = v => v / 1e3, pull = P.type === "pull";
    return {
      pull, LI: [mm(P.liy), mm(P.liz)], LO: [mm(P.loy), mm(P.loz)], UI: [mm(P.uiy), mm(P.uiz)], UO: [mm(P.uoy), mm(P.uoz)],
      R: mm(P.rtyre), tw: mm(P.track) / 2, cam0: P.camber * DEG, prf: P.prf, prh: mm(P.prh),
      RP: pull ? [mm(P.rpyL), mm(P.rpzL)] : [mm(P.rpy), mm(P.rpz)], r1: mm(P.r1), r2: mm(pull ? P.r2L : P.r2), alpha: (pull ? P.ralphaL : P.ralpha) * DEG, beta0: (pull ? P.rbetaL : P.rbeta) * DEG,
      SD: pull ? [mm(P.sdyL), mm(P.sdzL)] : [mm(P.sdy), mm(P.sdz)]
    }
  }
  /* resuelve la posición de todo el mecanismo para un giro phi del trapecio inferior */
  function solve(g, phi, prev) {
    const LO = rot(g.LO, g.LI, phi), Lk = len(sub(g.UO, g.LO)), Lu = len(sub(g.UO, g.UI));
    const UO = circ(g.UI, Lu, LO, Lk, prev ? prev.UO : g.UO);
    if (!UO) return null;
    /* mangueta: sistema de referencia en LO con eje hacia UO */
    const e0 = mul(sub(g.UO, g.LO), 1 / Lk), e1 = mul(sub(UO, LO), 1 / Lk);
    const toLoc = p => { const d = sub(p, g.LO); return [d[0] * e0[0] + d[1] * e0[1], -d[0] * e0[1] + d[1] * e0[0]] };
    const toW = q => add(LO, [q[0] * e1[0] - q[1] * e1[1], q[0] * e1[1] + q[1] * e1[0]]);
    const lean0 = Math.atan2(e0[0], e0[1]), lean = Math.atan2(e1[0], e1[1]);
    /* rueda: centro y huella fijos a la mangueta (con caída estática) */
    const CP0 = [g.tw, 0], WC0 = [g.tw - g.R * Math.sin(g.cam0), g.R * Math.cos(g.cam0)];
    const CP = toW(toLoc(CP0)), WC = toW(toLoc(WC0));
    /* punto de la bieleta en el trapecio (inferior si pushrod, superior si pullrod) */
    const A0 = g.pull ? g.UI : g.LI, B0 = g.pull ? g.UO : g.LO, A = A0, B = g.pull ? UO : LO;
    const base0 = add(A0, mul(sub(B0, A0), g.prf)), n0 = mul([-(B0[1] - A0[1]), B0[0] - A0[0]], g.prh / len(sub(B0, A0)));
    const ang0 = Math.atan2(B0[1] - A0[1], B0[0] - A0[0]), ang = Math.atan2(B[1] - A[1], B[0] - A[0]);
    const PP = rot(add(base0, n0), A0, ang - ang0);
    const PP0 = add(base0, n0), RA0 = add(g.RP, [g.r1 * Math.cos(g.beta0), g.r1 * Math.sin(g.beta0)]), Lrod = len(sub(RA0, PP0));
    const RA = circ(g.RP, g.r1, PP, Lrod, prev ? prev.RA : RA0);
    if (!RA) return null;
    const beta = Math.atan2(RA[1] - g.RP[1], RA[0] - g.RP[0]), RD = add(g.RP, [g.r2 * Math.cos(beta + g.alpha), g.r2 * Math.sin(beta + g.alpha)]);
    const Ld = len(sub(RD, g.SD));
    /* centro instantáneo y centro de balanceo (vista frontal) */
    const IC = lineX(g.LI, LO, g.UI, UO), rc = IC ? lineX(CP, IC, [0, 0], [0, 1]) : null;
    return { LO, UO, CP, WC, PP, RA, RD, Ld, beta, camber: g.cam0 + (lean - lean0), IC, rcz: rc ? rc[1] : NaN, s: CP[1] - CP0[1], dy: CP[0] - CP0[0] }
  }
  /* tabla cinemática en función del recorrido de rueda (m, + = compresión), calculada con la cinemática 3D */
  function kinTable(P) {
    const H = LAB.kin3d.fromParams(P), T3 = LAB.kin3d.table(H), raw = T3.raw, N = 121;
    if (raw.length < 30) return { ok: !1, g: H };
    const A = () => new Float32Array(N), S = A(), L = A(), CAM = A(), RC = A(), DY = A(), MR = A(), BETA = A(), TOE = A(), CAS = A(), KPI = A(), SCR = A(), TRL = A(), SVA = A();
    let j = 0, ok = !0;
    for (let i = 0; i < N; i++) {
      const sw = -.06 + i * .001;
      S[i] = sw;
      for (; j < raw.length - 2 && raw[j + 1].sw < sw;) j++;
      const a = raw[j], b = raw[j + 1];
      if (!a || !b || sw < raw[0].sw || sw > raw[raw.length - 1].sw) { ok = !1, L[i] = NaN; continue }
      const t = (sw - a.sw) / (b.sw - a.sw || 1e-9), li = k => lerp(a[k], b[k], t);
      L[i] = li("Ld"), CAM[i] = li("camber"), RC[i] = li("rcz"), DY[i] = li("dy"), BETA[i] = li("beta"), TOE[i] = li("toe"), CAS[i] = li("caster"), KPI[i] = li("kpi"), SCR[i] = li("scrub"), TRL[i] = li("trail"), SVA[i] = li("svAng")
    }
    for (let i = 0; i < N; i++) MR[i] = -((L[Math.min(N - 1, i + 1)] - L[Math.max(0, i - 1)]) / ((Math.min(N - 1, i + 1) - Math.max(0, i - 1)) * .001));
    const mid = raw.reduce((q, r) => Math.abs(r.sw) < Math.abs(q.sw) ? r : q, raw[0]);
    H.tw = H.tw || P.track / 2e3;
    return { ok, g: H, g3: T3.g, S, L, CAM, RC, DY, MR, BETA, TOE, CAS, KPI, SCR, TRL, SVA, mid, raw }
  }
  const at = (T, arr, s) => { const x = clamp((s + .06) / .001, 0, 119.999), i = x | 0, f = x - i, a = arr[i], b = arr[i + 1]; return isFinite(a) && isFinite(b) ? a + (b - a) * f : isFinite(a) ? a : b };

  /* ---------- firme ---------- */
  function makeRoad(kind, seed) {
    let r = seed || 1;
    const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
    const LOOP = 1200, comps = [];
    const iso = cls => { /* ISO 8608: Gd(n) = Gd(n0)(n/n0)^-2, n0 = 0.1 ciclos/m */
      const Gd0 = { A: 16e-6, B: 64e-6, C: 256e-6 }[cls] / 64, out = [];
      for (let k = 1; k <= 160; k++) { const n = .02 * Math.pow(10, k / 160 * 2.85), dn = n * Math.log(10) * 2.85 / 160, amp = Math.sqrt(2 * Gd0 * Math.pow(n / .1, -2) * dn); out.push([TAU * n, amp, rnd() * TAU, rnd() * TAU]) }
      return out
    };
    const sumSin = (cs, x, side) => { let z = 0; for (const [w, a, p, q] of cs) z += a * Math.sin(w * x + (side > 0 ? p : lerp(p, q, clamp(w / 6, 0, 1)))); return z };
    const kerb = (x, x0, h, wlen) => { const u = (x - x0) / wlen; return u > 0 && u < 1 ? h * Math.pow(Math.sin(Math.PI * u), 2) : 0 };
    const saw = (x, x0, x1, h, p) => x > x0 && x < x1 ? h * (((x - x0) % p) / p) : 0;
    let f;
    switch (kind) {
      case "liso": f = () => 0; break;
      case "salchicha": f = (x, s) => s > 0 ? kerb(x % LOOP, 300, .05, .45) + kerb(x % LOOP, 800, .05, .45) : 0; break;
      case "pianos": f = (x, s) => { const xx = x % LOOP; return s > 0 ? saw(xx, 200, 260, .022, .9) + saw(xx, 650, 700, .022, .9) : saw(xx, 420, 470, .022, .9) }; break;
      case "bache": f = (x, s) => { const xx = x % LOOP; return (xx > 400 && xx < 400.6 ? -.025 : 0) + (s > 0 && xx > 900 && xx < 900.8 ? .02 : 0) }; break;
      case "isoB": { const c = iso("B"); f = (x, s) => sumSin(c, x % LOOP, s); break }
      case "isoC": { const c = iso("C"); f = (x, s) => sumSin(c, x % LOOP, s); break }
      case "monaco": { const c = iso("C"); f = (x, s) => { const xx = x % LOOP; return 1.3 * sumSin(c, xx, s) + (s > 0 ? kerb(xx, 560, .035, .5) : 0) + (xx % 97 < .7 && s < 0 ? -.012 : 0) }; break }
      case "barrido": f = null; break
    }
    return { f, LOOP, kind }
  }

  /* ---------- amortiguador de 4 vías + válvula de soplado ---------- */
  function damperF(P, v) { /* v>0 compresión (m/s) -> fuerza N en el eje del amortiguador */
    const b = v >= 0, c1 = b ? P.cbl : P.crl, c2 = b ? P.cbh : P.crh, vk = (b ? P.vkb : P.vkr) / 1e3, a = Math.abs(v);
    let F = a < vk ? c1 * a : c1 * vk + c2 * (a - vk);
    return b ? F : -F
  }

  /* ---------- modelo dinámico ---------- */
  function build(P) {
    const K = kinTable(P), m = {};
    m.K = K, m.P = P;
    if (!K.ok) return m;
    const W = P.mass * P.wdist / 100 * G, Wc = W / 2;      /* peso suspendido por rueda */
    m.mb = P.mass * P.wdist / 100, m.mu = P.munspr, m.Ixx = m.mb * Math.pow(P.rgyr / 1e3, 2), m.h = K.g.tw;
    m.L0 = at(K, K.L, 0), m.MR0 = at(K, K.MR, 0);
    m.Lfree = m.L0 + Wc / Math.max(.05, m.MR0) / (P.kspr * 1e3);
    m.kt = P.ktyre * 1e3, m.ct = P.ctyre;
    m.tyre0 = (Wc + m.mu * G) / m.kt;
    m.karbW = P.karb * 1e3 * m.MR0 * m.MR0, m.kh = P.kheave * 1e3, m.ch = P.cheave, m.hgap = P.hgap / 1e3;
    m.bin = P.inerter;
    m.v = P.speed / 3.6, m.rho = 1.2;
    m.st = new Float64Array(8); /* zb, phi, zuL, zuR, vb, wphi, vuL, vuR */
    m.t = 0, m.x = 0, m.aeroF = .5 * m.rho * m.v * m.v * P.scl * P.aerof / 100 * .5, m.aeroLag = m.aeroF;
    m.road = makeRoad(P.road, 7), m.chirpPh = 0;
    /* equilibrio estático con la carga aerodinámica media: se asienta antes de empezar */
    m.settle = 1.2;
    m.plank = 0, m.air = [0, 0];
    return m
  }
  function rideH(m, zb) { return m.P.rh / 1e3 + zb }
  function aeroTarget(m, h) {
    const P = m.P, q = .5 * m.rho * m.v * m.v, hs = P.rh / 1e3, hst = P.hstall / 1e3, SCl0 = P.scl * P.aerof / 100 * .5;
    let k = 1 + P.gef * (hs - h) / Math.max(.005, hs);
    if (h < hst) k = (1 + P.gef * (hs - hst) / Math.max(.005, hs)) * (1 - P.stall / 100 * (1 - Math.exp(-(hst - h) / .004)));
    return q * SCl0 * clamp(k, 0, 3)
  }
  function roadZ(m, side, x, t) {
    if (m.road.kind === "barrido") { /* barrido de frecuencia en el tiempo: 0,5 a 30 Hz en 30 s, 4 mm, en fase en ambos lados salvo el 20 % antisimétrico */
      const T = 30, tt = t % T, f0 = .5, f1 = 30, k = Math.log(f1 / f0) / T, ph = TAU * f0 * (Math.exp(k * tt) - 1) / k;
      return .004 * Math.sin(ph) * (side > 0 ? 1 : .6)
    }
    return m.road.f(x, side)
  }
  function deriv(m, st, t, x, out, aux) {
    const P = m.P, K = m.K, [zb, phi, zuL, zuR, vb, wphi, vuL, vuR] = st, h = m.h;
    const zcL = zb + h * phi, zcR = zb - h * phi, vcL = vb + h * wphi, vcR = vb - h * wphi;
    const sL = zuL - zcL, sR = zuR - zcR, dsL = vuL - vcL, dsR = vuR - vcR;
    const corner = (s, ds) => {
      const L = at(K, K.L, s), MR = at(K, K.MR, s);
      let Fd = P.kspr * 1e3 * (m.Lfree - L);
      const comp = m.L0 - L, pk = comp - P.pgap / 1e3;
      pk > 0 && (Fd += P.kpack * 1e3 * pk + P.kpack2 * 1e6 * pk * pk);
      const vd = MR * ds;
      Fd += damperF(P, vd);
      return { F: Fd * MR, MR, vd, L }
    };
    const cL = corner(sL, dsL), cR = corner(sR, dsR);
    /* barra estabilizadora y tercer muelle (heave), en ruedas */
    const Farb = m.karbW * (sR - sL), sh = (sL + sR) / 2, dsh = (dsL + dsR) / 2;
    const Fh = (sh > m.hgap ? m.kh * (sh - m.hgap) : 0) * m.MR0 * m.MR0 + m.ch * m.MR0 * m.MR0 * dsh;
    const FsL = cL.F - Farb + Fh / 2, FsR = cR.F + Farb + Fh / 2;
    /* neumáticos */
    const xL = x, rL = roadZ(m, -1, xL, t), rR = roadZ(m, 1, xL, t), rLd = (roadZ(m, -1, xL + m.v * 1e-3, t + 1e-3) - rL) / 1e-3, rRd = (roadZ(m, 1, xL + m.v * 1e-3, t + 1e-3) - rR) / 1e-3;
    const tyre = (r, rd, zu, vu) => { const d = m.tyre0 + r - zu; return d <= 0 ? 0 : Math.max(0, m.kt * d + m.ct * (rd - vu)) };
    const FtL = tyre(rL, rLd, zuL, vuL), FtR = tyre(rR, rRd, zuR, vuR);
    /* aerodinámica (con retardo de flujo -> bombeo) y tabla del fondo contra el suelo */
    const hr = rideH(m, zb), Fa = m.aeroLag;
    let Fpl = 0;
    hr < 0 && (Fpl = 4e6 * -hr - 2e4 * Math.min(0, vb));
    /* ecuaciones: masa suspendida (vertical y balanceo) y no suspendidas; el inerter acopla aceleraciones */
    const Wb = m.mb * G, Wc = Wb / 2;
    const Fb = FsL + FsR - Wb - Fa + Fpl, Mphi = h * (FsL - FsR);
    const FuL = FtL - FsL - m.mu * G, FuR = FtR - FsR - m.mu * G;
    const b = m.bin;
    if (b > 0) {
      /* matriz de masas 4x4 con inerters entre carrocería y cada rueda */
      const M = [[m.mb + 2 * b, 0, -b, -b], [0, m.Ixx + 2 * b * h * h, -b * h, b * h], [-b, -b * h, m.mu + b, 0], [-b, b * h, 0, m.mu + b]];
      const rhs = [Fb, Mphi, FuL, FuR], a = gauss(M, rhs);
      out[4] = a[0], out[5] = a[1], out[6] = a[2], out[7] = a[3]
    } else out[4] = Fb / m.mb, out[5] = Mphi / m.Ixx, out[6] = FuL / m.mu, out[7] = FuR / m.mu;
    out[0] = vb, out[1] = wphi, out[2] = vuL, out[3] = vuR;
    if (aux) aux.FtL = FtL, aux.FtR = FtR, aux.sL = sL, aux.sR = sR, aux.vdL = cL.vd, aux.vdR = cR.vd, aux.hr = hr, aux.Fa = Fa, aux.rL = rL, aux.rR = rR, aux.phi = phi, aux.zb = zb, aux.ab = out[4], aux.Fpl = Fpl, aux.FsR = FsR, aux.FsL = FsL
  }
  function gauss(A, b) {
    const n = b.length, M = A.map((r, i) => [...r, b[i]]);
    for (let i = 0; i < n; i++) { let p = i; for (let k = i + 1; k < n; k++) Math.abs(M[k][i]) > Math.abs(M[p][i]) && (p = k); [M[i], M[p]] = [M[p], M[i]]; for (let k = i + 1; k < n; k++) { const f = M[k][i] / M[i][i]; for (let j = i; j <= n; j++) M[k][j] -= f * M[i][j] } }
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) { let s = M[i][n]; for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j]; x[i] = s / M[i][i] }
    return x
  }
  const k1 = new Float64Array(8), k2 = new Float64Array(8), k3 = new Float64Array(8), k4 = new Float64Array(8), tmp = new Float64Array(8);
  function step(m, dt, aux) {
    const st = m.st, t = m.t, x = m.x;
    /* flujo bajo el fondo: primer orden con retardo (convectivo) */
    const hr = rideH(m, st[0]), tau = Math.max(.002, m.P.alag / 1e3);
    m.aeroLag += (aeroTarget(m, hr) - m.aeroLag) * Math.min(1, dt / tau);
    deriv(m, st, t, x, k1);
    for (let i = 0; i < 8; i++) tmp[i] = st[i] + k1[i] * dt / 2;
    deriv(m, tmp, t + dt / 2, x + m.v * dt / 2, k2);
    for (let i = 0; i < 8; i++) tmp[i] = st[i] + k2[i] * dt / 2;
    deriv(m, tmp, t + dt / 2, x + m.v * dt / 2, k3);
    for (let i = 0; i < 8; i++) tmp[i] = st[i] + k3[i] * dt;
    deriv(m, tmp, t + dt, x + m.v * dt, k4);
    for (let i = 0; i < 8; i++) st[i] += dt / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
    m.t += dt, m.x += m.v * dt;
    aux && deriv(m, st, m.t, m.x, tmp, aux)
  }

  /* ---------- interfaz ---------- */
  const PRESETS = {
    base: { name: "F1 delantera (pushrod)", v: {} },
    pull: { name: "F1 delantera (pullrod)", v: { type: "pull" } },
    monaco: { name: "Mónaco: blanda y alta", v: { kspr: 640, karb: 180, kheave: 1300, rh: 38, cbl: 16000, crl: 26000, road: "monaco", speed: 140, aerof: 115 } },
    monza: { name: "Monza: baja carga", v: { scl: 2.6, kspr: 1200, kheave: 5200, rh: 26, road: "pianos", speed: 320, aerof: 85 } },
    porp: { name: "Rebote (porpoising)", v: { rh: 36, kspr: 600, kheave: 1300, gef: 1.5, hstall: 14, stall: 70, alag: 20, speed: 300, road: "liso", cbl: 7000, crl: 11000, cheave: 0, pgap: 25 } },
    kerb: { name: "Salchicha a 200 km/h", v: { road: "salchicha", speed: 200 } }
  };
  /* los puntos exteriores (rótulas, bieleta, dirección) siguen a la vía del reglamento elegido en el simulador */
  const DEF = [
    { title: "Lo esencial", open: !0, help: "Empieza por aquí. Cambia un valor y mira cómo responde la rueda en tiempo real.", items: [
      { id: "type", label: "Eje del coche", v: "push", opts: [["push", "Delantero (pushrod)"], ["pull", "Trasero (pullrod)"]], help: "Los dos ejes del coche del simulador, con los brazos de su modelo 3D. Delante la bieleta sube desde la mangueta y empuja el balancín (pushrod); detrás baja desde arriba de la mangueta y tira de un balancín que va bajo, junto a la caja de cambios (pullrod)." },
      { id: "speed", label: "Velocidad", unit: "km/h", min: 40, max: 340, step: 1, v: 230 },
      { id: "road", label: "Firme", v: "isoB", opts: [["liso", "Liso"], ["isoB", "Asfalto bueno (ISO B)"], ["isoC", "Asfalto bacheado (ISO C)"], ["salchicha", "Salchicha amarilla (derecha)"], ["pianos", "Pianos dentados"], ["bache", "Bache y escalón"], ["monaco", "Calles de Mónaco"], ["barrido", "Barrido de frecuencia 0,5–30 Hz"]] },
      { id: "kspr", label: "Muelle (en el amortiguador)", unit: "N/mm", min: 100, max: 3000, step: 10, v: 1000, help: "Más duro: menos balanceo y menos cambio de altura (mejor para el suelo aerodinámico), pero la rueda rebota más en baches y pianos." },
      { id: "cbl", label: "Amortiguación compresión lenta", unit: "N·s/m", min: 500, max: 80000, step: 100, v: 28000 },
      { id: "crl", label: "Amortiguación extensión lenta", unit: "N·s/m", min: 500, max: 100000, step: 100, v: 42000 },
      { id: "karb", label: "Barra estabilizadora (en el balancín)", unit: "N/mm", min: 0, max: 2000, step: 10, v: 350 },
      { id: "rh", label: "Altura al suelo delantera (estática)", unit: "mm", min: 8, max: 70, step: .5, v: 32, help: "La misma referencia que usa el simulador para el coche: 32 mm delante en parado." }
    ]},
    { title: "Frenos", help: "Disco, pastilla, conducto y reparto: se ven en el conjunto 3D y viajan al simulador.", items: [
      { id: "discD", label: "Diámetro del disco", unit: "mm", min: 278, max: 345, step: 1, v: 328, help: "Más grande: más masa térmica (se calienta menos por frenada) y más radio de frenada, pero más peso no suspendido e inercia." },
      { id: "pad", label: "Pastilla", v: "std", opts: [["std", "Carbono estándar (200–1 050 °C)"], ["cold", "Baja temperatura (circuitos fríos)"], ["hot", "Alta temperatura (Montreal, Mónaco)"]] },
      { id: "duct", label: "Apertura del conducto de freno", unit: "%", min: 15, max: 100, step: 1, v: .6, scale: 100, help: "Más apertura enfría más pero añade arrastre aerodinámico." },
      { id: "bbias", label: "Reparto de frenada (delante)", unit: "%", min: 50, max: 68, step: .5, v: 59 }
    ]},
    { title: "Amortiguador de 4 vías", adv: !0, items: [
      { id: "vkb", label: "Codo compresión", unit: "mm/s", min: 5, max: 300, step: 1, v: 50, help: "Velocidad de pistón donde pasa de baja a alta velocidad (válvula de soplado)." },
      { id: "cbh", label: "Compresión rápida", unit: "N·s/m", min: 200, max: 40000, step: 100, v: 5000 },
      { id: "vkr", label: "Codo extensión", unit: "mm/s", min: 5, max: 300, step: 1, v: 60 },
      { id: "crh", label: "Extensión rápida", unit: "N·s/m", min: 200, max: 60000, step: 100, v: 9000 }
    ]},
    { title: "Topes, tercer muelle e inerter", adv: !0, items: [
      { id: "pgap", label: "Hueco hasta el packer", unit: "mm", min: 0, max: 30, step: .5, v: 9, help: "Compresión del amortiguador a la que entra el tope (packer)." },
      { id: "kpack", label: "Rigidez del packer", unit: "N/mm", min: 0, max: 5000, step: 10, v: 900 },
      { id: "kpack2", label: "Progresividad del packer", unit: "N/mm²", min: 0, max: 500, step: 1, v: 60 },
      { id: "kheave", label: "Tercer muelle (heave)", unit: "N/mm", min: 0, max: 9000, step: 10, v: 4300, help: "Solo trabaja cuando las dos ruedas suben a la vez (carga aerodinámica); no afecta al balanceo." },
      { id: "hgap", label: "Hueco del tercer muelle", unit: "mm", min: -10, max: 25, step: .5, v: 0 },
      { id: "cheave", label: "Amortiguador del tercer elemento", unit: "N·s/m", min: 0, max: 60000, step: 100, v: 8000 },
      { id: "inerter", label: "Inerter (J-damper)", unit: "kg", min: 0, max: 60, step: .5, v: 0, help: "Masa aparente entre carrocería y rueda; se usaba para calmar el rebote del neumático (wheel hop)." }
    ]},
    { title: "Rueda: vía, caída y convergencia", adv: !0, items: [
      { id: "track", label: "Vía", unit: "mm", min: 1400, max: 2000, step: 1, v: LAB.kin3d.PUSH.track }, { id: "rtyre", label: "Radio del neumático", unit: "mm", min: 300, max: 400, step: 1, v: Math.round(LAB.car.R * 1e3) },
      { id: "camber", label: "Caída estática", unit: "°", min: -5, max: 1, step: .05, v: -3.2 }, { id: "toe", label: "Convergencia estática (+ abierta)", unit: "°", min: -1.5, max: 1.5, step: .01, v: .1 }
    ]},
    { title: "Puntos duros 3D (mm)", adv: !0, help: "x adelante desde el eje delantero, y hacia fuera desde el eje del coche, z altura sobre el suelo, rueda derecha en estático. La izquierda es simétrica.", items: [
      { id: "hp_LF_x", label: "Trapecio inferior · anclaje delantero · x", unit: "mm", min: -450, max: 450, step: 1, v: 210 },
      { id: "hp_LF_y", label: "Trapecio inferior · anclaje delantero · y", unit: "mm", min: -350, max: 900, step: 1, v: 235 },
      { id: "hp_LF_z", label: "Trapecio inferior · anclaje delantero · z", unit: "mm", min: 0, max: 800, step: 1, v: 150 },
      { id: "hp_LR_x", label: "Trapecio inferior · anclaje trasero · x", unit: "mm", min: -450, max: 450, step: 1, v: -200 },
      { id: "hp_LR_y", label: "Trapecio inferior · anclaje trasero · y", unit: "mm", min: -350, max: 900, step: 1, v: 225 },
      { id: "hp_LR_z", label: "Trapecio inferior · anclaje trasero · z", unit: "mm", min: 0, max: 800, step: 1, v: 140 },
      { id: "hp_LO_x", label: "Rótula inferior · x", unit: "mm", min: -450, max: 450, step: 1, v: -5 },
      { id: "hp_LO_y", label: "Rótula inferior · y", unit: "mm", min: -350, max: 900, step: 1, v: 705 },
      { id: "hp_LO_z", label: "Rótula inferior · z", unit: "mm", min: 0, max: 800, step: 1, v: 170 },
      { id: "hp_UF_x", label: "Trapecio superior · anclaje delantero · x", unit: "mm", min: -450, max: 450, step: 1, v: 175 },
      { id: "hp_UF_y", label: "Trapecio superior · anclaje delantero · y", unit: "mm", min: -350, max: 900, step: 1, v: 310 },
      { id: "hp_UF_z", label: "Trapecio superior · anclaje delantero · z", unit: "mm", min: 0, max: 800, step: 1, v: 380 },
      { id: "hp_UR_x", label: "Trapecio superior · anclaje trasero · x", unit: "mm", min: -450, max: 450, step: 1, v: -215 },
      { id: "hp_UR_y", label: "Trapecio superior · anclaje trasero · y", unit: "mm", min: -350, max: 900, step: 1, v: 300 },
      { id: "hp_UR_z", label: "Trapecio superior · anclaje trasero · z", unit: "mm", min: 0, max: 800, step: 1, v: 370 },
      { id: "hp_UO_x", label: "Rótula superior · x", unit: "mm", min: -450, max: 450, step: 1, v: -35 },
      { id: "hp_UO_y", label: "Rótula superior · y", unit: "mm", min: -350, max: 900, step: 1, v: 660 },
      { id: "hp_UO_z", label: "Rótula superior · z", unit: "mm", min: 0, max: 800, step: 1, v: 505 },
      { id: "hp_PO_x", label: "Bieleta · punto en la mangueta · x", unit: "mm", min: -450, max: 450, step: 1, v: -15 },
      { id: "hp_PO_y", label: "Bieleta · punto en la mangueta · y", unit: "mm", min: -350, max: 900, step: 1, v: 650 },
      { id: "hp_PO_z", label: "Bieleta · punto en la mangueta · z", unit: "mm", min: 0, max: 800, step: 1, v: 222 },
      { id: "hp_TI_x", label: "Dirección · extremo de cremallera · x", unit: "mm", min: -450, max: 450, step: 1, v: 95 },
      { id: "hp_TI_y", label: "Dirección · extremo de cremallera · y", unit: "mm", min: -350, max: 900, step: 1, v: 255 },
      { id: "hp_TI_z", label: "Dirección · extremo de cremallera · z", unit: "mm", min: 0, max: 800, step: 1, v: 198 },
      { id: "hp_TO_x", label: "Dirección · brazo en la mangueta · x", unit: "mm", min: -450, max: 450, step: 1, v: 92 },
      { id: "hp_TO_y", label: "Dirección · brazo en la mangueta · y", unit: "mm", min: -350, max: 900, step: 1, v: 668 },
      { id: "hp_TO_z", label: "Dirección · brazo en la mangueta · z", unit: "mm", min: 0, max: 800, step: 1, v: 252 },
      { id: "hp_RP_x", label: "Eje del balancín · x", unit: "mm", min: -450, max: 450, step: 1, v: -30 },
      { id: "hp_RP_y", label: "Eje del balancín · y", unit: "mm", min: -350, max: 900, step: 1, v: 115 },
      { id: "hp_RP_z", label: "Eje del balancín · z", unit: "mm", min: 0, max: 800, step: 1, v: 560 },
      { id: "hp_SD_x", label: "Amortiguador · anclaje al chasis · x", unit: "mm", min: -450, max: 450, step: 1, v: -30 },
      { id: "hp_SD_y", label: "Amortiguador · anclaje al chasis · y", unit: "mm", min: -350, max: 900, step: 1, v: -150 },
      { id: "hp_SD_z", label: "Amortiguador · anclaje al chasis · z", unit: "mm", min: 0, max: 800, step: 1, v: 600 },
      { id: "hp_r1", label: "Balancín · brazo de la bieleta", unit: "mm", min: 30, max: 150, step: 1, v: 75 }, { id: "hp_r2", label: "Balancín · brazo del amortiguador", unit: "mm", min: 30, max: 150, step: 1, v: 55 },
      { id: "hp_rbeta", label: "Balancín · ángulo estático", unit: "°", min: -180, max: 180, step: 1, v: 50 }, { id: "hp_ralpha", label: "Balancín · ángulo entre brazos", unit: "°", min: -180, max: 180, step: 1, v: 40 }
    ]},
    { title: "Masas, neumático y aerodinámica", adv: !0, items: [
      { id: "mass", label: "Masa suspendida del coche", unit: "kg", min: 500, max: 900, step: 1, v: LAB.car.mass - 96, help: "Masa mínima del reglamento menos las cuatro esquinas no suspendidas." },
      { id: "wdist", label: "Reparto delante", unit: "%", min: 35, max: 55, step: .5, v: Math.round(LAB.car.wdist * 1000) / 10 },
      { id: "munspr", label: "Masa no suspendida por rueda", unit: "kg", min: 8, max: 40, step: .5, v: 22, help: "Rueda y neumático ≈13 kg, freno ≈3,5, mangueta y buje ≈4,5 y media suspensión ≈1,5." },
      { id: "rgyr", label: "Radio de giro en balanceo", unit: "mm", min: 200, max: 600, step: 5, v: 380 },
      { id: "ktyre", label: "Rigidez vertical del neumático", unit: "N/mm", min: 150, max: 600, step: 5, v: 300 },
      { id: "ctyre", label: "Amortiguación del neumático", unit: "N·s/m", min: 0, max: 3000, step: 10, v: 400 },
      { id: "scl", label: "Área × coef. de sustentación (SCl total)", unit: "m²", min: 0, max: 6, step: .05, v: 4.2 },
      { id: "aerof", label: "Carga aerodinámica en el eje delantero", unit: "% de la mitad", min: 50, max: 140, step: 1, v: 100, help: "100 % = la mitad de la carga total va al eje delantero." },
      { id: "gef", label: "Efecto suelo (sensibilidad a la altura)", unit: "", min: 0, max: 3, step: .05, v: .6 },
      { id: "hstall", label: "Altura de desprendimiento (stall)", unit: "mm", min: 0, max: 40, step: .5, v: 8 },
      { id: "stall", label: "Pérdida de carga al desprenderse", unit: "%", min: 0, max: 80, step: 1, v: 35 },
      { id: "alag", label: "Retardo del flujo bajo el fondo", unit: "ms", min: 2, max: 120, step: 1, v: 10 }
    ]}
  ];

  let use3d = !1, host, prm, model, plots = {}, ro, raf, buf, running = !0, dtSim = 1 / 3000, histo = new Float32Array(41), simSpeed = 1, statsAcc;
  const NB = 3000 * 6;
  function mkBuf() { buf = { n: 0, i: 0, t: new Float32Array(NB), FL: new Float32Array(NB), FR: new Float32Array(NB), sL: new Float32Array(NB), sR: new Float32Array(NB), hr: new Float32Array(NB), vd: new Float32Array(NB), ab: new Float32Array(NB), rR: new Float32Array(NB), fa: new Float32Array(NB) } }
  function reset() {
    model = build(prm.v), mkBuf(), histo.fill(0), statsAcc = { n: 0, minF: 1e9, maxF: 0, sum: 0, sum2: 0, air: 0, plank: 0, camMin: 1e9, camMax: -1e9 };
    if (!model.K.ok) { $("susWarn").textContent = "La geometría no cierra: algún punto deja el mecanismo sin solución en el recorrido. Revisa trapecios, bieleta o balancín."; return }
    $("susWarn").textContent = model.MR0 <= 0 ? "Atención: con esta geometría el muelle se ESTIRA al comprimir la rueda (relación de movimiento negativa). Gira el balancín o cambia el anclaje." : "";
    /* asentamiento estático: integra con amortiguamiento fuerte sin firme hasta equilibrio */
    const road = model.road;
    model.road = { f: () => 0, kind: "liso" };
    const P = model.P, saveC = [P.cbl, P.crl];
    for (let i = 0; i < 6000; i++) step(model, 1 / 3000);
    model.road = road, model.t = 0, model.x = 0;
    kinPlots()
  }
  function kinPlots() {
    const K = model.K;
    if (!K.ok) return;
    const n = 121, s = new Float32Array(n), cam = new Float32Array(n), mr = new Float32Array(n), wr = new Float32Array(n), rc = new Float32Array(n), dy = new Float32Array(n), toe = new Float32Array(n), cas = new Float32Array(n), kpi = new Float32Array(n), scr = new Float32Array(n), trl = new Float32Array(n);
    for (let i = 0; i < n; i++) s[i] = K.S[i] * 1e3, cam[i] = K.CAM[i] / DEG, mr[i] = K.MR[i], wr[i] = prm.v.kspr * K.MR[i] * K.MR[i], rc[i] = K.RC[i] * 1e3, dy[i] = K.DY[i] * 1e3, toe[i] = K.TOE[i] / DEG * 60, cas[i] = K.CAS[i] / DEG, kpi[i] = K.KPI[i] / DEG, scr[i] = K.SCR[i] * 1e3, trl[i] = K.TRL[i] * 1e3;
    const v0 = { vlines: [{ x: 0, col: "rgba(255,255,255,.3)" }] };
    plots.kin1.draw([{ x: s, y: cam, n, col: "#ffd23f", label: "Caída (°)" }], { title: "Caída frente a recorrido", xlabel: "recorrido mm (+ compresión)", ...v0 });
    plots.kin2.draw([{ x: s, y: toe, n, col: "#ff6b1a", label: "Convergencia (′)" }], { title: "Bump steer", xlabel: "recorrido mm", zero: !0, ...v0 });
    plots.kin3.draw([{ x: s, y: mr, n, col: "#3d8bff", label: "Relación de movimiento" }, { x: s, y: wr.map(x => x / 100), n, col: "#2fd16c", label: "Rigidez rueda ×100 N/mm" }], { title: "MR y rigidez", xlabel: "recorrido mm", ...v0 });
    plots.kin4.draw([{ x: s, y: rc, n, col: "#ff6b1a", label: "Centro de balanceo (mm)" }, { x: s, y: dy, n, col: "#b45cff", label: "Cambio de vía (mm)" }], { title: "Centro de balanceo y vía", xlabel: "recorrido mm", ...v0 });
    plots.kin5.draw([{ x: s, y: cas, n, col: "#ffd23f", label: "Avance (°)" }, { x: s, y: kpi, n, col: "#3d8bff", label: "Incl. pivote (°)" }], { title: "Eje de pivote", xlabel: "recorrido mm", ...v0 });
    plots.kin6.draw([{ x: s, y: scr, n, col: "#2fd16c", label: "Pivotamiento (mm)" }, { x: s, y: trl, n, col: "#ff6b1a", label: "Avance mec. (mm)" }], { title: "En el suelo", xlabel: "recorrido mm", ...v0 });
    /* Ackermann: ángulo de cada rueda frente al volante (giro a izquierdas) */
    const g = K.g3, th0 = (K.raw.find(r => Math.abs(r.sw) < 1e-3) || K.mid).th, sw = [], dl = [], dr = [], ideal = [], tb = prm.v.track / 1e3, wb = 3.6;
    let pl = null, pr = null;
    for (let a = 0; a <= 180; a += 5) {
      const rk = a * .3e-3, R = LAB.kin3d.solve(g, th0, rk, pr), L = LAB.kin3d.solve(g, th0, -rk, pl);
      if (!R || !L) break;
      pr = R, pl = L;
      const dR = (R.toe - g.toe0) / DEG, dL = -(L.toe - g.toe0) / DEG;
      sw.push(a), dl.push(dL), dr.push(dR), ideal.push(dR > .05 ? Math.atan(1 / (1 / Math.tan(dR * DEG) - tb / wb)) / DEG : dR)
    }
    const F = a => Float32Array.from(a);
    plots.ack.draw([{ x: F(sw), y: F(dl), n: sw.length, col: "#ffd23f", label: "Interior" }, { x: F(sw), y: F(dr), n: sw.length, col: "#3d8bff", label: "Exterior" }, { x: F(sw), y: F(ideal), n: sw.length, col: "rgba(255,255,255,.4)", label: "Ackermann 100 %" }], { title: "Giro de rueda", xlabel: "volante °", ymin: 0 });
    const vv = new Float32Array(81), FF = new Float32Array(81);
    for (let i = 0; i < 81; i++) vv[i] = (i - 40) * 7.5, FF[i] = damperF(prm.v, vv[i] / 1e3);
    plots.damp.draw([{ x: vv, y: FF, n: 81, col: "#ff3b3b", label: "Fuerza (N)" }], { title: "Curva del amortiguador", xlabel: "velocidad de pistón mm/s (+ compresión)", zero: !0, vlines: [{ x: 0, col: "rgba(255,255,255,.25)" }] });
    const k = sw.length - 1;
    model.ack = k > 2 && dr[k] > .1 ? (dl[k] - dr[k]) / Math.max(1e-6, ideal[k] - dr[k]) * 100 : NaN, model.lockDeg = k > 0 ? dr[k] : NaN;
    /* frecuencias naturales (lineal alrededor del estático) */
    const m = model, kw = prm.v.kspr * 1e3 * m.MR0 * m.MR0 + (prm.v.kheave * 1e3 * m.MR0 * m.MR0) / 2, kt = m.kt, mc = m.mb / 2, kr = kw * kt / (kw + kt);
    const fb = Math.sqrt(kr / mc) / TAU, fw = Math.sqrt((kw + kt) / m.mu) / TAU, cw = prm.v.cbl * m.MR0 * m.MR0, zb = cw / (2 * Math.sqrt(kr * mc)), zw = cw / (2 * Math.sqrt((kw + kt) * m.mu));
    const kroll = (prm.v.kspr * 1e3 * m.MR0 * m.MR0 + m.karbW * 2) * kt / (prm.v.kspr * 1e3 * m.MR0 * m.MR0 + m.karbW * 2 + kt) * 2 * m.h * m.h * DEG;
    ro.set("fb", fb, 2, fb > 6 ? "warn" : ""), ro.set("fw", fw, 1), ro.set("zb", zb, 2, zb < .3 ? "bad" : zb > .9 ? "warn" : "ok"), ro.set("zw", zw, 2, zw < .2 ? "warn" : "");
    ro.set("mr0", m.MR0, 3), ro.set("wr0", kw / 1e3, 0), ro.set("kroll", kroll / 1e3, 2), ro.set("rc0", at(m.K, m.K.RC, 0) * 1e3, 0), ro.set("cg", (m.K.CAM[61] - m.K.CAM[59]) / 2 / DEG * 10, 3);
    const bs = (m.K.TOE[70] - m.K.TOE[50]) / 2 / DEG * 60, ad = Math.tan(at(m.K, m.K.SVA, 0)) * 3.6 / .3 * .57 * 100;
    ro.set("cas", at(m.K, m.K.CAS, 0) / DEG, 2), ro.set("kpi", at(m.K, m.K.KPI, 0) / DEG, 2), ro.set("scr", at(m.K, m.K.SCR, 0) * 1e3, 1), ro.set("trl", at(m.K, m.K.TRL, 0) * 1e3, 1);
    ro.set("bs", bs, 2, Math.abs(bs) > 3 ? "bad" : Math.abs(bs) > 1.2 ? "warn" : "ok"), ro.set("ad", ad, 0), ro.set("ack", m.ack, 0), ro.set("lock", m.lockDeg, 1)
  }
  function draw2D() {
    const c = $("susCv"), g = c.getContext("2d"), r = c.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    (c.width !== (r.width * dpr | 0)) && (c.width = r.width * dpr, c.height = r.height * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = r.width, H = r.height;
    g.clearRect(0, 0, W, H);
    const K = model.K;
    if (!K.ok || !K.g.LI) return;
    const aux = model.aux || {}, s = aux.sR || 0, ex = 3.2;
    const sol = K.raw.reduce((b, q) => Math.abs(q.s - s) < Math.abs(b.s - s) ? q : b, K.raw[0]);
    const sc = Math.min(W / 1.05, H / .9), ox = 18, oy = H - 22;
    /* la carrocería se mueve: dibujamos con el suelo fijo; desplazamos el chasis -(s) exagerado */
    const body = -(aux.zb || 0) * ex * 0 - s * (ex - 1);
    const P = p => [ox + p[0] * sc, oy - (p[1] + (aux.rR || 0) * ex) * sc];
    const Pc = p => [ox + p[0] * sc, oy - (p[1] + (aux.rR || 0) * ex - s * (ex - 1) * 0 + (s * ex - s) * -1 + s * ex - s) * sc];
    const ground = oy - (aux.rR || 0) * ex * sc;
    g.fillStyle = "#1b2027", g.fillRect(0, oy + 1, W, H - oy), g.strokeStyle = "#5b6672", g.beginPath(), g.moveTo(0, oy), g.lineTo(W, oy), g.stroke();
    /* firme bajo la rueda */
    g.fillStyle = "#ffd23f", (aux.rR || 0) > .001 && g.fillRect(ox + K.g.tw * sc - 30, oy - aux.rR * ex * sc, 60, aux.rR * ex * sc);
    const chassis = p => { const q = P(p); return [q[0], q[1] + s * (ex - 1) * sc * 0] };
    const L = (a, b, col, w) => { g.strokeStyle = col, g.lineWidth = w, g.beginPath(), g.moveTo(...a), g.lineTo(...b), g.stroke() };
    const Dt = (a, col, rr = 3.2) => { g.fillStyle = col, g.beginPath(), g.arc(a[0], a[1], rr, 0, TAU), g.fill() };
    /* chasis (monocasco) */
    g.fillStyle = "rgba(61,139,255,.08)", g.strokeStyle = "rgba(61,139,255,.35)", g.lineWidth = 1;
    const mono = [[-.05, .08], [.32, .1], [.36, .62], [-.05, .66]].map(chassis);
    g.beginPath(), mono.forEach((p, i) => i ? g.lineTo(...p) : g.moveTo(...p)), g.closePath(), g.fill(), g.stroke();
    const LI = chassis(K.g.LI), UI = chassis(K.g.UI), LO = P(sol.LO), UO = P(sol.UO), WC = P(sol.WC), CP = P(sol.CP), PP = P(sol.PP), RA = chassis(sol.RA), RP = chassis(K.g.RP), RD = chassis(sol.RD), SD = chassis(K.g.SD);
    /* rueda */
    g.save(), g.translate(WC[0], WC[1]), g.rotate(sol.camber), g.fillStyle = "#16191d", g.strokeStyle = "#3a414b", g.lineWidth = 2;
    const tw = .305 * sc, th = K.g.R * 2 * sc;
    g.fillRect(-tw / 2 + .0, -th / 2, tw, th), g.strokeRect(-tw / 2, -th / 2, tw, th), g.fillStyle = "#2a3038", g.fillRect(-tw / 2 + 4, -th * .3, tw - 8, th * .6), g.restore();
    L(LI, LO, "#c9d2db", 3), L(UI, UO, "#c9d2db", 3), L(LO, UO, "#8b97a4", 4), L(LO, WC, "#8b97a4", 2), L(UO, WC, "#8b97a4", 2);
    L(PP, RA, "#ff6b1a", 3.2), L(RP, RA, "#ffd23f", 4), L(RP, RD, "#ffd23f", 4);
    /* amortiguador (muelle en zigzag) */
    { const a = RD, b = SD, n = 10, dx = (b[0] - a[0]) / n, dy = (b[1] - a[1]) / n, nl = Math.hypot(dx, dy), px = -dy / nl * 5, py = dx / nl * 5; g.strokeStyle = "#2fd16c", g.lineWidth = 1.6, g.beginPath(), g.moveTo(...a); for (let i = 1; i < n; i++) g.lineTo(a[0] + dx * i + (i % 2 ? px : -px), a[1] + dy * i + (i % 2 ? py : -py)); g.lineTo(...b), g.stroke() }
    [LI, UI, RP, SD].forEach(p => Dt(p, "#5b6672", 4)), [LO, UO, PP, RA, RD].forEach(p => Dt(p, "#e9eef3"));
    sol.IC && isFinite(sol.IC[0]) && Math.abs(sol.IC[0]) < 6 && (g.setLineDash([3, 4]), L(LO, P(sol.IC), "rgba(255,255,255,.18)", 1), L(UO, P(sol.IC), "rgba(255,255,255,.18)", 1), g.setLineDash([]));
    isFinite(sol.rcz) && Dt(P([0, sol.rcz]), "#ff6b1a", 4.5);
    /* flechas de carga en la huella */
    const F = (aux.FtR || 0) / 1e3, Fl = Math.min(90, F * 6);
    L([CP[0], CP[1] + 4], [CP[0], CP[1] + 4 + Fl], F < .2 ? "#ff3b3b" : "#2fd16c", 4);
    g.fillStyle = "#e9eef3", g.font = "600 12px " + css("--body"), g.textAlign = "left";
    g.fillText(`Rueda derecha · recorrido ${(s * 1e3).toFixed(1)} mm · caída ${(sol.camber / DEG).toFixed(2)}° · carga ${F.toFixed(2)} kN`, 10, 16);
    g.fillStyle = "#8b97a4", g.font = "11px " + css("--body"), g.fillText(`Movimiento de la rueda exagerado ×${ex} · punto naranja = centro de balanceo`, 10, 31)
  }
  function loop() {
    raf = requestAnimationFrame(loop);
    if (!running || !model || !model.K.ok || document.hidden || !host.offsetParent) return;
    const aux = model.aux || (model.aux = {});
    const nsteps = Math.round(simSpeed / 60 / dtSim);
    for (let i = 0; i < nsteps; i++) {
      step(model, dtSim, aux);
      const b = buf, k = b.i;
      b.t[k] = model.t, b.FL[k] = aux.FtL / 1e3, b.FR[k] = aux.FtR / 1e3, b.sL[k] = aux.sL * 1e3, b.sR[k] = aux.sR * 1e3, b.hr[k] = aux.hr * 1e3, b.vd[k] = aux.vdR * 1e3, b.ab[k] = aux.ab / G, b.rR[k] = aux.rR * 1e3, b.fa[k] = aux.Fa / 1e3;
      b.i = (k + 1) % NB, b.n = Math.min(NB, b.n + 1);
      const hb = clamp(Math.round(aux.vdR * 1e3 / 25) + 20, 0, 40);
      histo[hb]++;
      const A = statsAcc;
      A.n++, A.sum += aux.FtR, A.sum2 += aux.FtR * aux.FtR, A.minF = Math.min(A.minF, aux.FtR), A.maxF = Math.max(A.maxF, aux.FtR), aux.FtR <= 0 && A.air++, aux.Fpl > 0 && A.plank++
    }
    render()
  }
  function lin(buf, key, secs) {
    const n = Math.min(buf.n, Math.round(secs / dtSim)), x = new Float32Array(n), y = new Float32Array(n);
    for (let j = 0; j < n; j++) { const k = (buf.i - n + j + NB) % NB; x[j] = buf.t[k], y[j] = buf[key][k] }
    return { x, y, n }
  }
  let frame = 0;
  function render() {
    frame++;
    const secs = 3, a = lin(buf, "FL", secs), b = lin(buf, "FR", secs), t0 = a.n ? a.x[0] : 0, t1 = a.n ? a.x[a.n - 1] : 1;
    const Wst = model.mb * G / 2 / 1e3 + model.mu * G / 1e3;
    plots.load.draw([{ ...a, col: "#3d8bff", label: "Izquierda" }, { ...b, col: "#ff6b1a", label: "Derecha" }], { title: "Carga vertical en la rueda (kN)", xmin: t0, xmax: t1, ymin: 0, hlines: [{ y: Wst, col: "rgba(255,255,255,.3)", label: "estática" }] });
    const hr = lin(buf, "hr", secs), sR = lin(buf, "sR", secs), sL = lin(buf, "sL", secs);
    plots.trav.draw([{ ...sL, col: "#3d8bff", label: "Recorrido izq. (mm)" }, { ...sR, col: "#ff6b1a", label: "Recorrido dcho. (mm)" }, { ...hr, col: "#2fd16c", label: "Altura al suelo (mm)" }], { title: "Recorridos y altura", xmin: t0, xmax: t1, hlines: [{ y: 0, col: "rgba(255,59,59,.6)", label: "suelo" }] });
    if (frame % 6 === 0) {
      const tot = histo.reduce((p, q) => p + q, 0) || 1, hx = new Float32Array(41), hy = new Float32Array(41);
      for (let i = 0; i < 41; i++) hx[i] = (i - 20) * 25, hy[i] = histo[i] / tot * 100;
      plots.hist.draw([{ x: hx, y: hy, n: 41, col: "#b45cff", fill: "rgba(180,92,255,.25)", label: "% del tiempo" }], { title: "Histograma de velocidad del amortiguador", xlabel: "mm/s (+ compresión)", ymin: 0, vlines: [{ x: 0, col: "rgba(255,255,255,.3)" }] });
      const ab = lin(buf, "ab", 4);
      if (ab.n > 2048) {
        const F = fftMag(ab.y, dtSim);
        let n = 0;
        for (; n < F.n && F.f[n] < 40;) n++;
        plots.fft.draw([{ x: F.f, y: F.A, n, col: "#ffd23f", label: "Aceleración vertical de la carrocería (g)" }], { title: "Espectro (FFT)", xlabel: "Hz", ymin: 0, xmin: 0, xmax: 40 })
      }
      const A = statsAcc, mean = A.sum / A.n, sd = Math.sqrt(Math.max(0, A.sum2 / A.n - mean * mean));
      ro.set("fmin", A.minF / 1e3, 2, A.minF <= 0 ? "bad" : A.minF / mean < .4 ? "warn" : "ok"), ro.set("fvar", sd / mean * 100, 1, sd / mean > .25 ? "bad" : sd / mean > .12 ? "warn" : "ok");
      ro.set("air", A.air / A.n * 100, 2, A.air ? "bad" : "ok"), ro.set("plank", A.plank / A.n * 100, 2, A.plank ? "bad" : "ok");
      const h2 = lin(buf, "hr", 2);
      let mn = 1e9, mx = -1e9;
      for (let i = 0; i < h2.n; i++) mn = Math.min(mn, h2.y[i]), mx = Math.max(mx, h2.y[i]);
      ro.set("hrmin", mn, 1, mn < 0 ? "bad" : mn < 5 ? "warn" : "ok"), ro.set("porp", mx - mn, 1, mx - mn > 12 ? "bad" : mx - mn > 5 ? "warn" : "ok");
      ro.set("aero", model.aeroLag / 1e3, 2);
      verdict(A, mean, sd, mn, mx)
    }
    if (use3d) {
      const aux = model.aux || {}, man = $("susMan").value, Fz = Math.max(0, aux.FtR || 0), Fze = man === "live" ? Fz : Math.max(Fz, 6500), tp = .03;
      const FR = man === "brake" ? [-1.9 * Fze, 0, Fze] : man === "corner" ? [0, -1.75 * Fze, Fze] : man === "comb" ? [-1.15 * Fze, -1.3 * Fze, Fze] : [0, 0, Fz], FL = [man === "brake" || man === "comb" ? -1.9 * (aux.FtL || 0) : 0, 0, aux.FtL || 0];
      const live = { FR, FL }, last = render.sol;
      last && (live.loads = LAB.kin3d.loads(model.K.g3, last.R, FR, -tp * FR[1]));
      const sol = LAB.susp3d.frame(model, aux, live);
      sol && (render.sol = sol);
      if (frame % 6 === 0 && sol) {
        const R = sol.R;
        const sr = aux.sR || 0, K = model.K;
        $("sus3dInfo").innerHTML = `<b>Rueda derecha</b> recorrido ${(sr * 1e3).toFixed(1)} mm · caída ${(at(K, K.CAM, sr) / DEG).toFixed(2)}° · convergencia ${(at(K, K.TOE, sr) / DEG * 60).toFixed(1)}′ · avance ${(at(K, K.CAS, sr) / DEG).toFixed(2)}° · centro de balanceo ${(at(K, K.RC, sr) * 1e3).toFixed(0)} mm · carga ${(Fz / 1e3).toFixed(2)} kN<br><span>Barras: azul tracción, rojo compresión · flechas en la huella: verde vertical, azul lateral, naranja longitudinal · movimiento dibujado ×${$("susEx").value}, valores reales · arrastra para girar, botón derecho para desplazar</span>`;
        if (frame % 30 === 0) { const rows = LAB.susp3d.checks(live.loads, prm.v); $("susChecks").innerHTML = "<h4>Comprobación de montaje</h4>" + rows.map(([s, t, d]) => `<div class="ck ${s}"><b>${t}</b><span>${d}</span></div>`).join("") }
        if (live.loads) {
          const tie = live.loads[5].f, rackF = Math.abs(tie) * Math.abs(LAB.kin3d.util.nrm(LAB.kin3d.util.sub(R.TI, R.TO))[1]), tq = rackF * .0075 * .3;
          ro.set("frack", rackF / 1e3, 2), ro.set("tqsw", tq, 1);
          $("susLoads").innerHTML = `<b>Fuerza axial en cada barra (${{ live: "en vivo", brake: "frenada a 5 g", corner: "curva a 4,5 g", comb: "frenada en curva" }[man]}, huella ${(FR[0] / 1e3).toFixed(1)} / ${(FR[1] / 1e3).toFixed(1)} / ${(FR[2] / 1e3).toFixed(1)} kN)</b>` + live.loads.map(q => `<div class="${q.f >= 0 ? "t" : "c"}"><span>${q.name}</span><i style="width:${Math.min(100, Math.abs(q.f) / 400).toFixed(0)}%"></i><em>${q.f >= 0 ? "tracción" : "compresión"} ${Math.abs(q.f / 1e3).toFixed(2)} kN</em></div>`).join("")
        }
      }
    } else draw2D()
  }
  for (const g of DEF) for (const it of g.items) { const m = /^hp_(\w\w)_([xyz])$/.exec(it.id); m && LAB.kin3d.PUSH[m[1]] && (it.v = LAB.kin3d.PUSH[m[1]]["xyz".indexOf(m[2])]) }
  /* reglaje físico para el simulador: reparto de balanceo a partir de la rigidez al balanceo del eje (muelles por la
     relación de movimiento al cuadrado + estabilizadora, en serie con el neumático) frente a la de referencia */
  function rollK(P, MR) { const kt = P.ktyre * 1e3, kw = P.kspr * 1e3 * MR * MR + P.karb * 1e3 * MR * MR * 2; return kw * kt / (kw + kt) }
  function sendToSim() {
    const m = model, P = prm.v;
    if (!m || !m.K || !m.K.ok) return;
    const ref = Object.fromEntries(DEF.flatMap(g => g.items.map(i => [i.id, i.v])));
    const Kref = kinTable(ref), MRref = at(Kref, Kref.MR, 0), MR = m.MR0;
    const kF = rollK(P, MR), kF0 = rollK(ref, MRref), kR0 = kF0 * .48 / .52;
    /* rigidez de plataforma del eje (dos muelles + tercer muelle en la rueda, en serie con los dos neumáticos): la misma
       magnitud que usa el simulador para la altura bajo carga (410 N/mm con el reglaje de referencia) */
    const ser = (k, kt) => k * 2 * kt / (k + 2 * kt), kH = ser(2 * P.kspr * MR * MR + P.kheave * MR * MR, P.ktyre), kH0 = ser(2 * ref.kspr * MRref * MRref + ref.kheave * MRref * MRref, ref.ktyre);
    const damp = (Q, mr) => { const kw = Q.kspr * 1e3 * mr * mr + Q.kheave * 1e3 * mr * mr / 2, kt = Q.ktyre * 1e3, mc = Q.mass * Q.wdist / 100 / 2, kr = kw * kt / (kw + kt), cw = Q.cbl * mr * mr; return [cw / (2 * Math.sqrt(kr * mc)), cw / (2 * Math.sqrt((kw + kt) * Q.munspr))] };
    const [zb, zw] = damp(P, MR), [zb0, zw0] = damp(ref, MRref), pen = (b, w) => ((b - .45) / .3) ** 2 + Math.max(0, .2 - w) / .2 * .6;
    const o = { v: 2, t: Date.now(), kspr: P.kspr, karb: P.karb, kheave: P.kheave, cbl: P.cbl, crl: P.crl, rh: P.rh, camber: P.camber, toe: P.toe, discD: P.discD, pad: P.pad, duct: P.duct, bias: P.bbias / 100,
      hp: Object.fromEntries(Object.keys(P).filter(k => k.startsWith("hp_") || ["type", "rtyre", "track", "camber", "toe"].includes(k)).map(k => [k, P[k]])),
      lltd: kF / (kF + kR0), kHrel: kH / kH0, rhF: P.rh, bumpPen: clamp(pen(zb, zw) - pen(zb0, zw0), -.3, 1.5), hopK: clamp(zw0 / Math.max(.03, zw), .5, 2.5), zH: clamp(P.cheave / ref.cheave, .25, 2.5), zb, zw, MR, reg: LAB.car.reg };
    try { localStorage.setItem("pn3-setup", JSON.stringify(o)) } catch {}
    $("susWarn").textContent = `Reglaje enviado: reparto de balanceo ${Math.round(o.lltd * 100)} % del., plataforma ×${o.kHrel.toFixed(2)}, ζ carrocería ${zb.toFixed(2)}. Actívalo en el simulador (Configurar carrera → Tú conduces).`
  }
  function verdict(A, mean, sd, mn, mx) {
    const out = [], v = sd / mean;
    v < .1 ? out.push(["ok", "Agarre", "La carga en la rueda es estable: el neumático trabaja bien."]) : v < .22 ? out.push(["warn", "Agarre", "La carga oscila bastante: pierdes algo de agarre en baches."]) : out.push(["bad", "Agarre", "La rueda rebota: la carga varía muchísimo. Baja muelle o sube amortiguación de extensión."]);
    A.air ? out.push(["bad", "Despegue", "La rueda llega a separarse del suelo en algún momento."]) : out.push(["ok", "Despegue", "La rueda no se levanta."]);
    mx - mn > 12 ? out.push(["bad", "Plataforma aero", "El coche bota (porpoising): la altura cambia " + (mx - mn).toFixed(0) + " mm. Sube altura, endurece el tercer muelle o amortigua más."]) : mx - mn > 5 ? out.push(["warn", "Plataforma aero", "La altura varía " + (mx - mn).toFixed(1) + " mm: el suelo aerodinámico pierde eficacia."]) : out.push(["ok", "Plataforma aero", "Altura muy estable: el fondo genera carga de forma constante."]);
    A.plank && out.push(["bad", "Fondo", "La tabla roza el suelo: desgaste del patín y pérdida de carga."]);
    $("susVerdict").innerHTML = out.map(([s, t, d]) => `<div class="vd ${s}"><b>${t}</b><span>${d}</span></div>`).join("")
  }
  function init(el0) {
    host = el0;
    host.innerHTML = `
    <div class="labhead"><div><h2>Suspensión</h2><p class="sub">Los dos ejes del coche del simulador, con los brazos de su propio modelo 3D: delantero con pushrod y trasero con pullrod. Medio coche en tiempo real: geometría, amortiguador de 4 vías, tercer muelle, inerter, neumático y suelo aerodinámico. Los carenados translúcidos son los brazos del modelo; dentro van los tubos que aquí se calculan.</p></div>
      <div class="presets" id="susPre"></div></div>
    <div class="labgrid">
      <aside class="params" id="susParams"></aside>
      <section class="views">
        <div class="vrow"><div class="s3host" id="sus3d"><div class="s3info" id="sus3dInfo"></div><canvas id="susCv" class="big" hidden></canvas></div><div class="verdict" id="susVerdict"></div></div>
        <div class="ctrl"><button id="susRun" class="btn on">Pausa</button><label>Velocidad de simulación <select id="susSpd"><option value=".1">×0,1 (cámara lenta)</option><option value=".25">×0,25</option><option value="1" selected>×1 (tiempo real)</option></select></label><label>Volante <input type="range" id="susSteer" min="-180" max="180" step="1" value="0" style="width:120px;vertical-align:middle"> <b id="susSteerV">0°</b></label><label>Cargas <select id="susMan"><option value="live">En vivo (firme)</option><option value="brake">Frenada a 5 g</option><option value="corner" selected>Curva a 4,5 g (rueda exterior)</option><option value="comb">Frenada en curva</option></select></label><label>Movimiento <select id="susEx"><option value="1">real</option><option value="3" selected>exagerado ×3</option><option value="6">exagerado ×6</option></select></label><button id="susReset" class="btn">Reiniciar</button><button id="susSend" class="btn send" title="Guarda este reglaje para el coche del simulador">Enviar al simulador</button><button id="susCsv" class="btn adv">Exportar CSV</button><span id="susWarn" class="warnt"></span></div>
        <div class="ctrl s3views"><span>Vista</span><button class="btn" data-sv="all">Eje completo</button><button class="btn" data-sv="corner">Rueda</button><button class="btn" data-sv="inside">Por dentro</button><button class="btn" data-sv="brake">Freno</button><button class="btn" data-sv="rocker">Balancín</button><button class="btn" data-sv="steer">Dirección</button><button class="btn" data-sv="top">Planta</button></div>
        <div class="ctrl s3tools"><label>Vista explosionada <input type="range" id="susExpl" min="0" max="1" step="0.01" value="0" style="width:140px;vertical-align:middle"></label><label class="ck"><input type="checkbox" id="susXray"> Rayos X</label><label class="ck"><input type="checkbox" id="susCut"> Corte por la rueda</label><label class="ck"><input type="checkbox" id="susDuct" checked> Conducto de freno</label><label class="ck"><input type="checkbox" id="susLoadsCk" checked> Fuerzas</label><span class="hint">Pulsa una pieza para ver su ficha</span></div>
        <div class="checks" id="susChecks"></div>
        <div class="readouts" id="susRo"></div>
        <div class="loadtbl" id="susLoads"></div>
        <div class="pgrid"><canvas id="susLoad"></canvas><canvas id="susTrav"></canvas><canvas id="susHist"></canvas><canvas id="susFft"></canvas></div>
        <h3 class="adv">Cinemática 3D, dirección y amortiguador</h3>
        <div class="pgrid adv"><canvas id="susK1"></canvas><canvas id="susK2"></canvas><canvas id="susK3"></canvas><canvas id="susK4"></canvas><canvas id="susK5"></canvas><canvas id="susK6"></canvas><canvas id="susAck"></canvas><canvas id="susDamp"></canvas></div>
      </section></div>`;
    let lastType = "push";
    prm = new Params($("susParams"), DEF, id => {
      if (prm.v.type !== lastType) { lastType = prm.v.type; const H = lastType === "pull" ? LAB.kin3d.PULL : LAB.kin3d.PUSH, o = {}; for (const k of LAB.kin3d.PTS) ["x", "y", "z"].forEach((a, i) => o["hp_" + k + "_" + a] = H[k][i]); o.hp_r1 = H.r1, o.hp_r2 = H.r2, o.hp_rbeta = H.rbeta, o.hp_ralpha = H.ralpha, o.track = H.track, o.camber = H.camber, prm.set(o, !0) }
      clearTimeout(init.t), init.t = setTimeout(reset, id === "speed" || id === "road" ? 10 : 120)
    });
    const pre = $("susPre");
    for (const k in PRESETS) pre.appendChild(el("button", { class: "btn", text: PRESETS[k].name, onclick: () => { prm.set(Object.fromEntries(DEF.flatMap(g => g.items.map(i => [i.id, i.v]))), !0), prm.set(PRESETS[k].v) } }));
    ro = new Readouts($("susRo"), [
      { id: "fmin", label: "Carga mínima rueda", unit: "kN" }, { id: "fvar", label: "Variación de carga", unit: "% (σ)" }, { id: "air", label: "Rueda en el aire", unit: "% tiempo" },
      { id: "hrmin", label: "Altura mínima", unit: "mm" }, { id: "porp", label: "Oscilación de altura", unit: "mm p-p" }, { id: "plank", label: "Tabla tocando", unit: "% tiempo", adv: !0 },
      { id: "fb", label: "Frecuencia carrocería", unit: "Hz" }, { id: "fw", label: "Rebote de rueda", unit: "Hz", adv: !0 }, { id: "zb", label: "Amortiguamiento crítico carrocería", unit: "ζ" },
      { id: "zw", label: "Amortiguamiento crítico rueda", unit: "ζ", adv: !0 }, { id: "mr0", label: "Relación de movimiento", unit: "amort./rueda", adv: !0 }, { id: "wr0", label: "Rigidez en rueda", unit: "N/mm" },
      { id: "kroll", label: "Rigidez al balanceo eje", unit: "kNm/°", adv: !0 }, { id: "rc0", label: "Centro de balanceo", unit: "mm", adv: !0 }, { id: "cg", label: "Ganancia de caída", unit: "°/10 mm", adv: !0 }, { id: "aero", label: "Carga aero eje", unit: "kN" },
      { id: "cas", label: "Avance (caster)", unit: "°" }, { id: "kpi", label: "Inclinación del pivote", unit: "°", adv: !0 }, { id: "scr", label: "Radio de pivotamiento", unit: "mm", adv: !0 }, { id: "trl", label: "Avance mecánico", unit: "mm", adv: !0 },
      { id: "bs", label: "Bump steer", unit: "min/10 mm" }, { id: "ad", label: "Antihundimiento", unit: "%", adv: !0 }, { id: "ack", label: "Ackermann", unit: "%" }, { id: "lock", label: "Giro de rueda a 180° de volante", unit: "°", adv: !0 },
      { id: "frack", label: "Fuerza en la cremallera", unit: "kN" }, { id: "tqsw", label: "Par en el volante (con asistencia)", unit: "N·m" }
    ]);
    plots.load = new Plot($("susLoad")), plots.trav = new Plot($("susTrav")), plots.hist = new Plot($("susHist")), plots.fft = new Plot($("susFft"));
    plots.kin1 = new Plot($("susK1")), plots.kin2 = new Plot($("susK2")), plots.kin3 = new Plot($("susK3")), plots.kin4 = new Plot($("susK4")), plots.kin5 = new Plot($("susK5")), plots.kin6 = new Plot($("susK6")), plots.ack = new Plot($("susAck")), plots.damp = new Plot($("susDamp"));
    $("susRun").onclick = () => { running = !running, $("susRun").textContent = running ? "Pausa" : "Seguir", $("susRun").classList.toggle("on", running) };
    $("susReset").onclick = reset, $("susSpd").onchange = e => simSpeed = +e.target.value;
    use3d = !!(LAB.susp3d && LAB.susp3d.init($("sus3d"))), use3d || ($("susCv").hidden = !1), $("susEx").onchange = e => LAB.susp3d && LAB.susp3d.setEx(+e.target.value);
    $("susSteer").oninput = e => { $("susSteerV").textContent = e.target.value + "°", LAB.susp3d && LAB.susp3d.setOpts({ steer: +e.target.value }) };
    $("susMan").onchange = e => LAB.susp3d && LAB.susp3d.setOpts({ discT: e.target.value === "brake" || e.target.value === "comb" ? 950 : 450 });
    document.querySelectorAll("[data-sv]").forEach(b => b.onclick = () => $("sus3d").view && $("sus3d").view(b.dataset.sv));
    const o3 = o => LAB.susp3d && LAB.susp3d.setOpts(o);
    $("susExpl").oninput = e => o3({ explode: +e.target.value }), $("susXray").onchange = e => o3({ xray: e.target.checked }), $("susCut").onchange = e => o3({ cut: e.target.checked }), $("susDuct").onchange = e => o3({ duct: e.target.checked }), $("susLoadsCk").onchange = e => o3({ show: { loads: e.target.checked } });
    $("susSend").onclick = sendToSim;
    $("susCsv").onclick = () => { const n = buf.n, rows = []; for (let j = 0; j < n; j += 3) { const k = (buf.i - n + j + NB) % NB; rows.push([buf.t[k], buf.FL[k], buf.FR[k], buf.sL[k], buf.sR[k], buf.hr[k], buf.vd[k], buf.ab[k], buf.rR[k], buf.fa[k]]) } downloadCSV("suspension.csv", ["t_s", "carga_izq_kN", "carga_dcha_kN", "recorrido_izq_mm", "recorrido_dcho_mm", "altura_mm", "vel_amort_dcho_mm_s", "acel_carroceria_g", "firme_dcho_mm", "carga_aero_kN"], rows) };
    window.addEventListener("labmode", () => setTimeout(() => { for (const p of Object.values(plots)) p.fit(); kinPlots() }, 50));
    reset(), loop()
  }
  return { init, _test: { kinTable, build, step, DEF, at, model: () => model, set: o => prm.set(o) } }
})();
