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
  /* tabla cinemática en función del recorrido de rueda (m, + = compresión) */
  function kinTable(P) {
    const g = geom(P), raw = [];
    let prev = null;
    for (let k = -240; k <= 240; k++) { const r = solve(g, k * .0012, prev && raw.length ? raw[raw.length - 1] : null); if (r) raw.push(r) }
    const mid = solve(g, 0, null);
    if (!mid || raw.length < 30) return { ok: !1, g };
    raw.sort((a, b) => a.s - b.s);
    const S = new Float32Array(121), L = new Float32Array(121), CAM = new Float32Array(121), RC = new Float32Array(121), DY = new Float32Array(121), MR = new Float32Array(121), BETA = new Float32Array(121);
    let j = 0, ok = !0;
    for (let i = 0; i < 121; i++) {
      const s = -.06 + i * .001;
      S[i] = s;
      for (; j < raw.length - 2 && raw[j + 1].s < s;) j++;
      const a = raw[j], b = raw[j + 1];
      if (!a || !b || s < raw[0].s || s > raw[raw.length - 1].s) { ok = !1; L[i] = NaN; continue }
      const t = (s - a.s) / (b.s - a.s || 1e-9);
      L[i] = lerp(a.Ld, b.Ld, t), CAM[i] = lerp(a.camber, b.camber, t), RC[i] = lerp(a.rcz, b.rcz, t), DY[i] = lerp(a.dy, b.dy, t), BETA[i] = lerp(a.beta, b.beta, t)
    }
    for (let i = 0; i < 121; i++) MR[i] = -((L[Math.min(120, i + 1)] - L[Math.max(0, i - 1)]) / ((Math.min(120, i + 1) - Math.max(0, i - 1)) * .001));
    return { ok, g, S, L, CAM, RC, DY, MR, BETA, mid, raw }
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
    monaco: { name: "Mónaco: blanda y alta", v: { kspr: 320, karb: 300, kheave: 600, rh: 42, cbl: 11000, crl: 18000, road: "monaco", speed: 140, aerof: 115 } },
    monza: { name: "Monza: baja carga", v: { scl: 2.6, kspr: 600, rh: 26, road: "pianos", speed: 320, aerof: 85 } },
    porp: { name: "Rebote (porpoising)", v: { rh: 40, kspr: 300, kheave: 600, gef: 1.5, hstall: 14, stall: 70, alag: 20, speed: 300, road: "liso", cbl: 5000, crl: 8000, cheave: 0, pgap: 25 } },
    kerb: { name: "Salchicha a 200 km/h", v: { road: "salchicha", speed: 200 } }
  };
  const DEF = [
    { title: "Lo esencial", open: !0, help: "Empieza por aquí. Cambia un valor y mira cómo responde la rueda en tiempo real.", items: [
      { id: "type", label: "Tipo de bieleta", v: "push", opts: [["push", "Pushrod (empuja)"], ["pull", "Pullrod (tira)"]], help: "Pushrod: la bieleta sube desde abajo de la mangueta y empuja el balancín. Pullrod: baja desde arriba y tira; deja el muelle más bajo (centro de gravedad) pero empaqueta peor." },
      { id: "speed", label: "Velocidad", unit: "km/h", min: 40, max: 340, step: 1, v: 230 },
      { id: "road", label: "Firme", v: "isoB", opts: [["liso", "Liso"], ["isoB", "Asfalto bueno (ISO B)"], ["isoC", "Asfalto bacheado (ISO C)"], ["salchicha", "Salchicha amarilla (derecha)"], ["pianos", "Pianos dentados"], ["bache", "Bache y escalón"], ["monaco", "Calles de Mónaco"], ["barrido", "Barrido de frecuencia 0,5–30 Hz"]] },
      { id: "kspr", label: "Muelle (en el amortiguador)", unit: "N/mm", min: 50, max: 2000, step: 10, v: 500, help: "Más duro: menos balanceo y menos cambio de altura (mejor para el suelo aerodinámico), pero la rueda rebota más en baches y pianos." },
      { id: "cbl", label: "Amortiguación compresión lenta", unit: "N·s/m", min: 500, max: 60000, step: 100, v: 20000 },
      { id: "crl", label: "Amortiguación extensión lenta", unit: "N·s/m", min: 500, max: 80000, step: 100, v: 30000 },
      { id: "karb", label: "Barra estabilizadora (en el balancín)", unit: "N/mm", min: 0, max: 2000, step: 10, v: 600 },
      { id: "rh", label: "Altura al suelo (estática)", unit: "mm", min: 8, max: 70, step: .5, v: 38 }
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
      { id: "kheave", label: "Tercer muelle (heave)", unit: "N/mm", min: 0, max: 6000, step: 10, v: 2000, help: "Solo trabaja cuando las dos ruedas suben a la vez (carga aerodinámica); no afecta al balanceo." },
      { id: "hgap", label: "Hueco del tercer muelle", unit: "mm", min: -10, max: 25, step: .5, v: 0 },
      { id: "cheave", label: "Amortiguador del tercer elemento", unit: "N·s/m", min: 0, max: 60000, step: 100, v: 8000 },
      { id: "inerter", label: "Inerter (J-damper)", unit: "kg", min: 0, max: 60, step: .5, v: 0, help: "Masa aparente entre carrocería y rueda; se usaba para calmar el rebote del neumático (wheel hop)." }
    ]},
    { title: "Geometría: trapecios (vista frontal, mm)", adv: !0, help: "y = distancia lateral desde el eje del coche; z = altura sobre el suelo en posición estática.", items: [
      { id: "liy", label: "Inferior interior y", unit: "mm", min: 50, max: 400, step: 1, v: 210 }, { id: "liz", label: "Inferior interior z", unit: "mm", min: 40, max: 300, step: 1, v: 135 },
      { id: "loy", label: "Inferior exterior y", unit: "mm", min: 400, max: 800, step: 1, v: 690 }, { id: "loz", label: "Inferior exterior z", unit: "mm", min: 40, max: 300, step: 1, v: 160 },
      { id: "uiy", label: "Superior interior y", unit: "mm", min: 80, max: 450, step: 1, v: 290 }, { id: "uiz", label: "Superior interior z", unit: "mm", min: 200, max: 600, step: 1, v: 365 },
      { id: "uoy", label: "Superior exterior y", unit: "mm", min: 400, max: 780, step: 1, v: 655 }, { id: "uoz", label: "Superior exterior z", unit: "mm", min: 250, max: 650, step: 1, v: 505 },
      { id: "track", label: "Vía", unit: "mm", min: 1400, max: 2000, step: 1, v: 1620 }, { id: "rtyre", label: "Radio del neumático", unit: "mm", min: 300, max: 400, step: 1, v: 360 },
      { id: "camber", label: "Caída estática", unit: "°", min: -5, max: 1, step: .05, v: -3.2 }
    ]},
    { title: "Geometría: bieleta y balancín (mm)", adv: !0, items: [
      { id: "prf", label: "Anclaje de la bieleta (fracción del trapecio)", unit: "", min: .5, max: 1, step: .01, v: .9 },
      { id: "prh", label: "Altura del soporte de la bieleta", unit: "mm", min: -40, max: 80, step: 1, v: 25 },
      { id: "r1", label: "Brazo del balancín (bieleta)", unit: "mm", min: 30, max: 150, step: 1, v: 75 },
      { id: "r2", label: "Brazo del balancín (amortiguador)", unit: "mm", min: 30, max: 150, step: 1, v: 55 },
      { id: "rpy", label: "Pushrod · eje del balancín y", unit: "mm", min: 0, max: 400, step: 1, v: 120 },
      { id: "rpz", label: "Pushrod · eje del balancín z", unit: "mm", min: 300, max: 700, step: 1, v: 560 },
      { id: "rbeta", label: "Pushrod · ángulo estático del balancín", unit: "°", min: -180, max: 180, step: 1, v: 50, help: "Lo ideal es que el brazo quede perpendicular a la bieleta en estático: relación de movimiento máxima y lineal." },
      { id: "ralpha", label: "Pushrod · ángulo entre brazos", unit: "°", min: -180, max: 180, step: 1, v: 40 },
      { id: "sdy", label: "Pushrod · anclaje del amortiguador y", unit: "mm", min: -300, max: 300, step: 1, v: -150 },
      { id: "sdz", label: "Pushrod · anclaje del amortiguador z", unit: "mm", min: 300, max: 750, step: 1, v: 600 },
      { id: "rpyL", label: "Pullrod · eje del balancín y", unit: "mm", min: 0, max: 400, step: 1, v: 150 },
      { id: "rpzL", label: "Pullrod · eje del balancín z", unit: "mm", min: 30, max: 300, step: 1, v: 120 },
      { id: "rbetaL", label: "Pullrod · ángulo estático del balancín", unit: "°", min: -180, max: 180, step: 1, v: 4 },
      { id: "ralphaL", label: "Pullrod · ángulo entre brazos", unit: "°", min: -180, max: 180, step: 1, v: 124 },
      { id: "r2L", label: "Pullrod · brazo del amortiguador", unit: "mm", min: 30, max: 150, step: 1, v: 80 },
      { id: "sdyL", label: "Pullrod · anclaje del amortiguador y", unit: "mm", min: -300, max: 300, step: 1, v: -120 },
      { id: "sdzL", label: "Pullrod · anclaje del amortiguador z", unit: "mm", min: 20, max: 300, step: 1, v: 65 }
    ]},
    { title: "Masas, neumático y aerodinámica", adv: !0, items: [
      { id: "mass", label: "Masa suspendida del coche", unit: "kg", min: 500, max: 900, step: 1, v: 740 },
      { id: "wdist", label: "Reparto delante", unit: "%", min: 35, max: 55, step: .5, v: 45 },
      { id: "munspr", label: "Masa no suspendida por rueda", unit: "kg", min: 8, max: 40, step: .5, v: 17 },
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
    const n = 121, s = new Float32Array(n), cam = new Float32Array(n), mr = new Float32Array(n), wr = new Float32Array(n), rc = new Float32Array(n), dy = new Float32Array(n);
    for (let i = 0; i < n; i++) s[i] = K.S[i] * 1e3, cam[i] = K.CAM[i] / DEG, mr[i] = K.MR[i], wr[i] = prm.v.kspr * K.MR[i] * K.MR[i], rc[i] = K.RC[i] * 1e3, dy[i] = K.DY[i] * 1e3;
    plots.kin1.draw([{ x: s, y: cam, n, col: "#ffd23f", label: "Caída (°)" }], { title: "Caída frente a recorrido", xlabel: "recorrido mm (+ compresión)", vlines: [{ x: 0, col: "rgba(255,255,255,.3)" }] });
    plots.kin2.draw([{ x: s, y: mr, n, col: "#3d8bff", label: "Relación de movimiento" }], { title: "Amortiguador / rueda", xlabel: "recorrido mm", vlines: [{ x: 0, col: "rgba(255,255,255,.3)" }] });
    plots.kin3.draw([{ x: s, y: wr, n, col: "#2fd16c", label: "Rigidez en rueda (N/mm)" }], { title: "Wheel rate", xlabel: "recorrido mm", zero: !0 });
    plots.kin4.draw([{ x: s, y: rc, n, col: "#ff6b1a", label: "Centro de balanceo (mm)" }, { x: s, y: dy, n, col: "#b45cff", label: "Cambio de vía (mm)" }], { title: "Centro de balanceo y vía", xlabel: "recorrido mm" });
    const v = new Float32Array(81), F = new Float32Array(81);
    for (let i = 0; i < 81; i++) v[i] = (i - 40) * 7.5, F[i] = damperF(prm.v, v[i] / 1e3);
    plots.damp.draw([{ x: v, y: F, n: 81, col: "#ff3b3b", label: "Fuerza (N)" }], { title: "Curva del amortiguador", xlabel: "velocidad de pistón mm/s (+ compresión)", zero: !0, vlines: [{ x: 0, col: "rgba(255,255,255,.25)" }] });
    /* frecuencias naturales (lineal alrededor del estático) */
    const m = model, kw = prm.v.kspr * 1e3 * m.MR0 * m.MR0 + (prm.v.kheave * 1e3 * m.MR0 * m.MR0) / 2, kt = m.kt, mc = m.mb / 2, kr = kw * kt / (kw + kt);
    const fb = Math.sqrt(kr / mc) / TAU, fw = Math.sqrt((kw + kt) / m.mu) / TAU, cw = prm.v.cbl * m.MR0 * m.MR0, zb = cw / (2 * Math.sqrt(kr * mc)), zw = cw / (2 * Math.sqrt((kw + kt) * m.mu));
    const kroll = (prm.v.kspr * 1e3 * m.MR0 * m.MR0 + m.karbW * 2) * kt / (prm.v.kspr * 1e3 * m.MR0 * m.MR0 + m.karbW * 2 + kt) * 2 * m.h * m.h * DEG;
    ro.set("fb", fb, 2, fb > 6 ? "warn" : ""), ro.set("fw", fw, 1), ro.set("zb", zb, 2, zb < .3 ? "bad" : zb > .9 ? "warn" : "ok"), ro.set("zw", zw, 2, zw < .2 ? "warn" : "");
    ro.set("mr0", m.MR0, 3), ro.set("wr0", kw / 1e3, 0), ro.set("kroll", kroll / 1e3, 2), ro.set("rc0", at(m.K, m.K.RC, 0) * 1e3, 0), ro.set("cg", (m.K.CAM[61] - m.K.CAM[59]) / 2 / DEG * 10, 3)
  }
  function draw2D() {
    const c = $("susCv"), g = c.getContext("2d"), r = c.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    (c.width !== (r.width * dpr | 0)) && (c.width = r.width * dpr, c.height = r.height * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = r.width, H = r.height;
    g.clearRect(0, 0, W, H);
    const K = model.K;
    if (!K.ok) return;
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
      const aux = model.aux || {}, sol = LAB.susp3d.frame(model, aux);
      frame % 4 === 0 && sol && ($("sus3dInfo").innerHTML = `<b>Rueda derecha</b> recorrido ${((aux.sR || 0) * 1e3).toFixed(1)} mm · caída ${(sol.camber / DEG).toFixed(2)}° · carga ${((aux.FtR || 0) / 1e3).toFixed(2)} kN · amortiguador ${((aux.vdR || 0) * 1e3).toFixed(0)} mm/s<br><span>Color = fuerza que transmite cada pieza · arrastra para girar, rueda para acercar</span>`)
    } else draw2D()
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
    <div class="labhead"><div><h2>Suspensión delantera</h2><p class="sub">Medio coche en tiempo real: geometría pushrod / pullrod, amortiguador de 4 vías, tercer muelle, inerter, neumático y suelo aerodinámico.</p></div>
      <div class="presets" id="susPre"></div></div>
    <div class="labgrid">
      <aside class="params" id="susParams"></aside>
      <section class="views">
        <div class="vrow"><div class="s3host" id="sus3d"><div class="s3info" id="sus3dInfo"></div><canvas id="susCv" class="big" hidden></canvas></div><div class="verdict" id="susVerdict"></div></div>
        <div class="ctrl"><button id="susRun" class="btn on">Pausa</button><label>Velocidad de simulación <select id="susSpd"><option value=".1">×0,1 (cámara lenta)</option><option value=".25">×0,25</option><option value="1" selected>×1 (tiempo real)</option></select></label><label>Movimiento <select id="susEx"><option value="1">real</option><option value="3" selected>exagerado ×3</option><option value="6">exagerado ×6</option></select></label><button id="susReset" class="btn">Reiniciar</button><button id="susCsv" class="btn adv">Exportar CSV</button><span id="susWarn" class="warnt"></span></div>
        <div class="readouts" id="susRo"></div>
        <div class="pgrid"><canvas id="susLoad"></canvas><canvas id="susTrav"></canvas><canvas id="susHist"></canvas><canvas id="susFft"></canvas></div>
        <h3 class="adv">Cinemática y amortiguador</h3>
        <div class="pgrid adv"><canvas id="susK1"></canvas><canvas id="susK2"></canvas><canvas id="susK3"></canvas><canvas id="susK4"></canvas><canvas id="susDamp"></canvas></div>
      </section></div>`;
    prm = new Params($("susParams"), DEF, id => { clearTimeout(init.t), init.t = setTimeout(reset, id === "speed" || id === "road" ? 10 : 120) });
    const pre = $("susPre");
    for (const k in PRESETS) pre.appendChild(el("button", { class: "btn", text: PRESETS[k].name, onclick: () => { prm.set(Object.fromEntries(DEF.flatMap(g => g.items.map(i => [i.id, i.v]))), !0), prm.set(PRESETS[k].v) } }));
    ro = new Readouts($("susRo"), [
      { id: "fmin", label: "Carga mínima rueda", unit: "kN" }, { id: "fvar", label: "Variación de carga", unit: "% (σ)" }, { id: "air", label: "Rueda en el aire", unit: "% tiempo" },
      { id: "hrmin", label: "Altura mínima", unit: "mm" }, { id: "porp", label: "Oscilación de altura", unit: "mm p-p" }, { id: "plank", label: "Tabla tocando", unit: "% tiempo", adv: !0 },
      { id: "fb", label: "Frecuencia carrocería", unit: "Hz" }, { id: "fw", label: "Rebote de rueda", unit: "Hz", adv: !0 }, { id: "zb", label: "Amortiguamiento crítico carrocería", unit: "ζ" },
      { id: "zw", label: "Amortiguamiento crítico rueda", unit: "ζ", adv: !0 }, { id: "mr0", label: "Relación de movimiento", unit: "amort./rueda", adv: !0 }, { id: "wr0", label: "Rigidez en rueda", unit: "N/mm" },
      { id: "kroll", label: "Rigidez al balanceo eje", unit: "kNm/°", adv: !0 }, { id: "rc0", label: "Centro de balanceo", unit: "mm", adv: !0 }, { id: "cg", label: "Ganancia de caída", unit: "°/10 mm", adv: !0 }, { id: "aero", label: "Carga aero eje", unit: "kN" }
    ]);
    plots.load = new Plot($("susLoad")), plots.trav = new Plot($("susTrav")), plots.hist = new Plot($("susHist")), plots.fft = new Plot($("susFft"));
    plots.kin1 = new Plot($("susK1")), plots.kin2 = new Plot($("susK2")), plots.kin3 = new Plot($("susK3")), plots.kin4 = new Plot($("susK4")), plots.damp = new Plot($("susDamp"));
    $("susRun").onclick = () => { running = !running, $("susRun").textContent = running ? "Pausa" : "Seguir", $("susRun").classList.toggle("on", running) };
    $("susReset").onclick = reset, $("susSpd").onchange = e => simSpeed = +e.target.value;
    use3d = !!(LAB.susp3d && LAB.susp3d.init($("sus3d"))), use3d || ($("susCv").hidden = !1), $("susEx").onchange = e => LAB.susp3d && LAB.susp3d.setEx(+e.target.value);
    $("susCsv").onclick = () => { const n = buf.n, rows = []; for (let j = 0; j < n; j += 3) { const k = (buf.i - n + j + NB) % NB; rows.push([buf.t[k], buf.FL[k], buf.FR[k], buf.sL[k], buf.sR[k], buf.hr[k], buf.vd[k], buf.ab[k], buf.rR[k], buf.fa[k]]) } downloadCSV("suspension.csv", ["t_s", "carga_izq_kN", "carga_dcha_kN", "recorrido_izq_mm", "recorrido_dcho_mm", "altura_mm", "vel_amort_dcho_mm_s", "acel_carroceria_g", "firme_dcho_mm", "carga_aero_kN"], rows) };
    window.addEventListener("labmode", () => setTimeout(() => { for (const p of Object.values(plots)) p.fit(); kinPlots() }, 50));
    reset(), loop()
  }
  return { init, _test: { kinTable, build, step } }
})();
