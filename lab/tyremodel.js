/* ===================== NEUMÁTICO: MODELO DE CEPILLO 2D Y TÉRMICO POR CAPAS =====================
   Huella como rejilla de cerdas (40 a lo largo × 15 a lo ancho). Presión de contacto parabólica a lo largo y con
   gradiente lateral por la caída; el área sale de la carga, la presión de inflado y la rigidez de la carcasa.
   Cada cerda entra sin deformar por el borde de ataque y se deforma con el deslizamiento teórico (σx, σy) y con la
   curvatura lateral que impone la caída; mientras su tensión cabe en μ·p se adhiere, y si no, desliza en la dirección del
   deslizamiento y disipa μ·p·v_deslizamiento. μ depende de la temperatura de la banda (ventana del compuesto), de la
   presión local (sensibilidad a la carga) y de la velocidad de deslizamiento.
   Térmico: 3 bandas (interior, centro, exterior) × 3 capas (superficie, goma, carcasa) + aire interior: calor por
   fricción en la superficie, por histéresis en la goma, convección al aire, conducción al asfalto durante el contacto
   y entre capas; la presión del aire sigue a su temperatura (gas ideal).
   Desgaste: abrasión de Archard (energía de fricción / dureza que cae con la temperatura), graining (deslizamiento con
   la superficie fría respecto a la goma) y ampollas (goma por encima de su límite). */
LAB.tyremodel = (() => {
  const NX = 40, NY = 15;
  const COMP = {
    S: { name: "Blando", mu: 1.92, Topt: 100, dT: 22, hard: .8, Tblis: 128 },
    M: { name: "Medio", mu: 1.85, Topt: 108, dT: 24, hard: 1, Tblis: 134 },
    H: { name: "Duro", mu: 1.78, Topt: 116, dT: 26, hard: 1.25, Tblis: 140 },
    I: { name: "Intermedio", mu: 1.5, Topt: 70, dT: 22, hard: .7, Tblis: 110 },
    W: { name: "Lluvia", mu: 1.35, Topt: 60, dT: 20, hard: .6, Tblis: 100 }
  };
  /* ventana de temperatura: campana asimétrica (cae más deprisa en frío que en caliente) */
  function muT(C, T) { const d = (T - C.Topt) / C.dT; return .58 + .42 * (d < 0 ? Math.exp(-.75 * d * d) : Math.exp(-.45 * d * d)) }
  /* huella: semilongitud a, ancho w y presión media */
  function patch(P) {
    const Fz = P.Fz, pin = P.pin * 6895 * (P.Tgas + 273) / (P.T0 + 273), A = Fz / (.8 * pin + P.kc * 1e3), w = P.width * 1e-3 * clamp(.62 + .38 * Math.sqrt(Fz / P.Fz0), .5, 1.05), L = A / w;
    return { A, a: L / 2, w, pin }
  }
  /* fuerzas por el modelo de cepillo; T[3] = temperatura superficial de las bandas */
  function brush(P, T) {
    const C = COMP[P.comp], pa = patch(P), a = pa.a, w = pa.w, dx = 2 * a / NX, dy = w / NY, alpha = P.alpha * DEG, gam = P.gamma * DEG, kap = P.kappa;
    const Vx = P.v / 3.6, sx = -kap / (1 + kap), sy = -Math.tan(alpha) / (1 + kap);
    const cp = P.cbr * 1e7; /* rigidez de las cerdas por unidad de área (N/m³) */
    const grid = new Array(NX * NY);
    /* presión: parabólica en x, gradiente lateral con la caída (más carga en el hombro interior con caída negativa) */
    let psum = 0;
    const g0 = clamp(-gam * P.camberSens, -.9, .9);
    for (let i = 0; i < NX; i++) for (let j = 0; j < NY; j++) {
      const x = a - (i + .5) * dx, y = -w / 2 + (j + .5) * dy, px = Math.max(0, 1 - (x / a) ** 2), py = Math.max(.05, 1 + g0 * (y / (w / 2)) * 1.2) * (1 - .25 * Math.abs(2 * y / w) ** 6);
      grid[i * NY + j] = { x, y, p: px * py }, psum += px * py * dx * dy
    }
    let Fx = 0, Fy = 0, Sx = 0, Pf = 0, slideA = 0, rib = [0, 0, 0], ribP = [0, 0, 0], pmax = 0;
    const ribOf = j => j < NY / 3 ? 0 : j < 2 * NY / 3 ? 1 : 2;
    for (let i = 0; i < NX; i++) for (let j = 0; j < NY; j++) {
      const c = grid[i * NY + j], p = c.p * P.Fz / psum, rb = ribOf(j), Ts = T ? T[rb] : C.Topt;
      c.p = p, pmax = Math.max(pmax, p);
      /* μ local: ventana térmica, sensibilidad a la presión local y a la velocidad de deslizamiento */
      const mu0 = C.mu * muT(C, Ts) * Math.pow(Math.max(p, 1e3) / 2.2e5, -P.loadSens) * P.track;
      /* deformación de adhesión: deslizamiento teórico × distancia desde el borde de ataque, más la de la caída */
      const dl = a - c.x, ex = sx * dl, ey = sy * dl + Math.sin(gam) * (a * a - c.x * c.x) / (2 * P.R * 1e-3) * .5, tx = cp * ex, ty = cp * ey, tau = Math.hypot(tx, ty);
      const vs = Vx * Math.hypot(sx, sy), mu = mu0 * (1 - .12 * clamp(Math.log10(1 + vs) / 1.2, 0, 1));
      let fx, fy, sl = 0;
      if (tau <= mu * p || tau < 1) fx = tx, fy = ty;
      else { const s = Math.hypot(sx, sy) || 1; fx = mu * p * sx / s, fy = mu * p * sy / s, sl = 1 }
      c.fx = fx, c.fy = fy, c.sl = sl, c.ex = ex, c.ey = ey;
      const dA = dx * dy;
      Fx += fx * dA, Fy += fy * dA, Sx += fy * c.x * dA;
      /* potencia de fricción: solo donde desliza */
      const pw = sl ? Math.hypot(fx, fy) * vs : 0;
      c.pw = pw, Pf += pw * dA, slideA += sl * dA, rib[rb] += pw * dA, ribP[rb] += p * dA
    }
    /* brazo neumático: el centroide de la fuerza lateral queda detrás del centro de la huella */
    const Fyr = -Fy, trail = Math.abs(Fy) > 1 ? -Sx / Fy : 0;
    return { Fx: -Fx, Fy: Fyr, Mz: Fyr * trail, trail, Pf, slide: slideA / (2 * a * w), ribQ: rib, ribP, grid, a, w, A: pa.A, pin: pa.pin, pmax, nx: NX, ny: NY }
  }
  /* un paso térmico de dt segundos; S = estado {Ts[3], Tb[3], Tc[3], Tgas} */
  function thermal(P, S, B, dt) {
    const C = COMP[P.comp], v = P.v / 3.6, hA = 10 + 2 * Math.pow(Math.max(v, 1), .8), Aside = .25 /* m² de banda por tercio */;
    /* histéresis: energía de deformación por vuelta de rueda ∝ carga·deflexión; frecuencia = v / circunferencia */
    /* histéresis: es la resistencia a la rodadura convertida en calor dentro de la goma (≈ 1,2 % de la carga × velocidad) */
    const hyst = P.tanD / .2 * .012 * P.Fz * Math.pow(P.Fz / P.Fz0, .3) * v / 3;
    for (let r = 0; r < 3; r++) {
      const qf = B.ribQ[r] * P.part, share = B.ribP[r] / Math.max(1, P.Fz);
      const Ts = S.Ts[r], Tb = S.Tb[r], Tc = S.Tc[r];
      /* superficie: fricción + conducción desde la goma − convección − contacto con el asfalto (fracción de vuelta en huella) */
      const inC = 2 * B.a / (TAU * P.R * 1e-3), qTrack = 1000 * inC * (P.Ttrack - Ts) * Aside, qConv = hA * (P.Tair - Ts) * Aside * (1 - inC);
      const kSB = 260, kBC = 140, kCG = 55;
      const dTs = (qf + qConv + qTrack + kSB * (Tb - Ts)) / 500, dTb = (hyst * (.4 + share) + kSB * (Ts - Tb) + kBC * (Tc - Tb)) / 2000, dTc = (hyst * .25 + kBC * (Tb - Tc) + kCG * (S.Tgas - Tc)) / 1800;
      S.Ts[r] += dTs * dt, S.Tb[r] += dTb * dt, S.Tc[r] += dTc * dt
    }
    const Tc = (S.Tc[0] + S.Tc[1] + S.Tc[2]) / 3;
    S.Tgas += (55 * 3 * (Tc - S.Tgas) + 30 * (P.Trim - S.Tgas)) / 900 * dt;
    /* desgaste por mecanismo (mm/s de goma por banda) */
    for (let r = 0; r < 3; r++) {
      const hardT = C.hard * Math.exp(-(S.Tb[r] - 90) / 55), E = B.ribQ[r] / .1;
      S.wAbr[r] += 2e-11 * E / hardT * dt;
      S.wGr[r] += 1.5e-12 * E * Math.max(0, (S.Tb[r] - S.Ts[r]) - 4 + (C.Topt - 15 - S.Ts[r]) * .3) * dt;
      S.wBl[r] += 3e-6 * Math.exp((S.Tb[r] - C.Tblis) / 6) * dt
    }
    return S
  }
  function newState(P) { const t = P.Tstart; return { Ts: [t, t, t], Tb: [t, t, t], Tc: [t, t, t], Tgas: t, wAbr: [0, 0, 0], wGr: [0, 0, 0], wBl: [0, 0, 0] } }
  /* curvas de fuerza con la huella a temperatura óptima */
  function curves(P) {
    const C = COMP[P.comp], T = [C.Topt, C.Topt, C.Topt], out = { a: [], fy: {}, mz: [], k: [], fx: [] }, loads = [.5, 1, 1.5].map(f => f * P.Fz0);
    for (let al = 0; al <= 14; al += .5) out.a.push(al);
    for (const Fz of loads) out.fy[Fz] = out.a.map(al => brush({ ...P, Fz, alpha: al, kappa: 0 }, T).Fy);
    out.mz = out.a.map(al => brush({ ...P, alpha: al, kappa: 0 }, T).Mz);
    for (let k = 0; k <= .25; k += .01) out.k.push(k), out.fx.push(brush({ ...P, alpha: 0, kappa: k }, T).Fx);
    /* elipse de fricción: barrido combinado */
    out.ell = [];
    for (let k = -.2; k <= .2; k += .02) for (let al = 0; al <= 12; al += 1.5) { const b = brush({ ...P, alpha: al, kappa: k }, T); out.ell.push([b.Fy, b.Fx]) }
    return out
  }
  return { COMP, muT, patch, brush, thermal, newState, curves, NX, NY }
})();
