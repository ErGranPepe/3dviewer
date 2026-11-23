/* ===================== LABORATORIO DE MOTOR =====================
   V6 1,6 L turbo a 90° (tipo F1 2014+): ciclo termodinámico de dos zonas con gases reales y equilibrio químico (chem.js),
   combustión de Wiebe y pérdidas de Woschni, detonación (integral de Livengood-Wu con el retraso de autoencendido de cinética
   detallada), formación de NO (Zeldovich ampliado), biela-manivela exacta, fuerzas y tensiones en pistón,
   bulón y biela con seguridad a fatiga (Goodman) y pandeo, temperaturas de camisa / anillos / pistón, fuerzas y momentos
   libres del V6, y vibración torsional del cigüeñal (frecuencias propias, diagrama de Campbell y respuesta forzada). */
LAB.engine = (() => {
  const NC = 6;
  const MAT = {
    steel: { name: "Acero 4340 / 300M", E: 205e9, Su: 1900e6, Se: 700e6, rho: 7850, k: 40, Tmax: 480 },
    al2618: { name: "Aluminio 2618 forjado", E: 72e9, Su: 380e6, Se: 110e6, rho: 2760, k: 150, Tmax: 300 },
    ti64: { name: "Titanio Ti-6Al-4V", E: 114e9, Su: 1000e6, Se: 520e6, rho: 4430, k: 7, Tmax: 400 },
    mmc: { name: "Compuesto Al-SiC (MMC)", E: 115e9, Su: 450e6, Se: 160e6, rho: 2900, k: 160, Tmax: 330 }
  };
  const FIRE = [0, 3, 1, 4, 2, 5]; /* orden de encendido 1-4-2-5-3-6 (índices de cilindro) */

  /* ---------- combustible: propiedades calculadas a partir de su composición ---------- */
  const fuels = {};
  const fuelFor = P => { const id = LAB.chem.FUELS[P.fuelmix] ? P.fuelmix : "e10"; return fuels[id] || (fuels[id] = LAB.chem.fuel(LAB.chem.FUELS[id].vol, id)) };

  /* ---------- ciclo de un cilindro ----------
     Fase cerrada con dos zonas y gases reales: mezcla sin quemar (aire seco, combustible evaporado y residuales, con cp variable) y gas
     quemado en equilibrio químico (12 especies, con disociación). No hay "calor liberado" puesto a mano: la energía química está en las
     entalpías de formación y el primer principio hace el resto. La fracción quemada sigue una ley de Wiebe y el calor a las paredes,
     la correlación de Woschni. La renovación de la carga es simplificada: masa de aire por rendimiento volumétrico y presiones de
     admisión y escape impuestas. */
  function cycle(P, rpmOverride, opt) {
    const CH = LAB.chem, Ru = CH.Ru, FU = fuelFor(P), AIRG = CH.air();
    const rpm = rpmOverride || P.rpm, w = rpm / 60 * TAU, B = P.bore / 1e3, S = P.stroke / 1e3, r = S / 2, l = P.rod / 1e3, lam = r / l;
    const Ap = Math.PI / 4 * B * B, Vd = Ap * S, Vc = Vd / (P.cr - 1), Sp = 2 * S * rpm / 60;
    const xPis = th => r * (1 - Math.cos(th)) + l * (1 - Math.sqrt(1 - lam * lam * Math.sin(th) ** 2));
    const V = th => Vc + Ap * xPis(th);
    const N = opt && opt.N || 2880, dth = 720 / N * DEG, dt = dth / w;
    const th = new Float32Array(N), p = new Float32Array(N), T = new Float32Array(N), Tu = new Float32Array(N), Tb = new Float32Array(N), xb = new Float32Array(N), hg = new Float32Array(N), vol = new Float32Array(N), pm = new Float32Array(N), qrel = new Float32Array(N), tauK = new Float32Array(N), tcA = new Float32Array(N), vbf = new Float32Array(N);
    const pim = P.boost * 1e5, Tim = P.tim + 273.15, pex = P.pexh * 1e5, lpx = Math.log(pex), Tw = P.twall + 273.15;
    const ivc = (-180 + P.ivc) * DEG, evo = (180 - P.evo) * DEG, soc = P.soc * DEG, dur = P.dur * DEG;
    const iIvc = Math.ceil((ivc + TAU) / dth - 1e-6), iEvo = Math.ceil((evo + TAU) / dth - 1e-6), ang = i => -TAU + i * dth, V0 = V(ang(iIvc));
    for (let i = 0; i < N; i++) th[i] = ang(i) / DEG, vol[i] = V(ang(i));
    /* masa atrapada: aire por rendimiento volumétrico; combustible por caudal (con el tope del reglamento) o por riqueza máxima */
    const mAir = P.ve / 100 * pim * Vd / (AIRG.R * Tim);
    const fuelKgh = P.fflim === "si" ? Math.min(P.fuel, .009 * rpm + 5.5) : P.fuel, mfFlow = fuelKgh / 3600 / (rpm / 120 * NC), mfAir = mAir / (FU.afr * Math.max(.6, P.lambdaMin));
    const mf = Math.min(mfFlow, mfAir), lambda = mAir / (mf * FU.afr), xmax = P.etac / 100, Q = mf * FU.lhv * xmax, mFresh = mAir + mf;
    const fresh = CH.reactants(FU, lambda), tb = CH.burnedFor(FU, lambda), resid = tb.res || (tb.res = CH.eq(1600, 3e5, tb.b).n), gRes = tb.gres || (tb.gres = CH.gas(resid));
    const phi = 1 / lambda, onf = Math.pow(P.ron / 100, 3.402), wa = P.wa, wm1 = P.wm + 1;
    const wiebe = a => { const u = (a - soc) / dur; return u <= 0 ? 0 : xmax * (1 - Math.exp(-wa * Math.pow(Math.min(u, 3), wm1))) };
    let R = null;
    /* fase cerrada para una fracción y una temperatura de residuales dadas. st = paso en muestras (4 = pasada rápida de tanteo, que
       no guarda las curvas); la definitiva va con st = 1 */
    function closed(xr, Tres0, st) {
      const dts = dt * st, dths = dth * st, keep = st === 1;
      const m = mFresh / (1 - xr), mRes = m - mFresh, mAR = mAir + mRes, nAR = {}, nU = {};
      for (const k in AIRG.n) nAR[k] = AIRG.n[k] * mAir / mAR;
      for (const k in resid) nAR[k] = (nAR[k] || 0) + resid[k] * mRes / mAR, nU[k] = resid[k] * mRes / m;
      for (const k in fresh) nU[k] = (nU[k] || 0) + fresh[k] * mFresh / m;
      const gAR = CH.gas(nAR), gu = CH.gas(nU), Ruu = gu.R;
      /* al cerrar la admisión: el aire entra a la temperatura del colector y se mezcla con los residuales calientes (balance de
         entalpía); después el combustible, líquido a 25 °C, se inyecta con las válvulas cerradas y se evapora dentro, así que enfría
         la carga (balance de energía a volumen constante). La presión sale de la masa atrapada, no se impone */
      const Tdry = gAR.Th((mAir * AIRG.h(Tim) + mRes * gRes.h(Tres0)) / mAR, Tim), Tivc = gu.Tu((mAR * gAR.u(Tdry) + mf * FU.hliq) / m, Tdry), pivc = m * Ruu * Tivc / V0, sIvc = gu.s0(Tivc);
      let pp = pivc, TU = Tivc, TB = 0, x = 0, e = gu.u(Tivc), ntb = 0, Tcore = Tivc, pmot = pivc, Tmot = Tivc, ki = 0, knockAt = null, Qw = 0, TbMax = 0, iTb = 0, TuSoc = 0, pSoc = 0, TcMax = 0, iStart = -1, rat = 1;
      const wref = 3.24e-3 * Vd * Tivc / (pivc * V0);
      for (let i = iIvc; i < iEvo; i += st) {
        const a = ang(i), V1 = vol[i], V2 = i + st < N ? vol[i + st] : V(a + dths), v1 = V1 / m, v2 = V2 / m, dv = v2 - v1, x2 = wiebe(a + dths);
        /* temperatura media, transferencia de calor (Woschni) y su reparto: la zona sin quemar pierde lo que le toca por su área y lo demás sale de la quemada */
        const Rm = (1 - x) * Ruu + x * ntb * Ru, Tm = pp * v1 / Rm, wgas = 2.28 * Sp + (a > soc ? wref * Math.max(0, pp - pmot) : 0);
        const h = P.woschni / 100 * 3.26 * Math.pow(B, -.2) * Math.pow(pp / 1e3, .8) * Math.pow(Tm, -.55) * Math.pow(wgas, .8), Aw = 2 * Ap * 1.1 + Math.PI * B * (V1 - Vc) / Ap;
        const kq = h * Aw * dts / m, dqw = kq * (Tm - Tw), dqu = x >= 1 ? 0 : kq * (1 - Math.sqrt(x)) * (TU - Tw);
        keep && (p[i] = pp, T[i] = Tm, Tu[i] = TU, Tb[i] = TB, xb[i] = x, vbf[i] = x * ntb * Ru * TB / (pp * v1), hg[i] = h, pm[i] = pmot, qrel[i] = Q * (x2 - x) / xmax / dth * DEG);
        /* detonación: integral de Livengood-Wu con el retraso de autoencendido del núcleo adiabático del gas sin quemar */
        if (x < .98 * xmax && knockAt === null) {
          const tau = CH.tauIgn(Tcore, pp, phi) * onf;
          keep && (tauK[i] = tau, tcA[i] = Tcore), ki += dts / tau;
          ki >= 1 && x < .9 * xmax && a > soc && (knockAt = a / DEG)
        }
        Tcore > TcMax && (TcMax = Tcore);
        Qw += dqw * m;
        /* compresión sin combustión (referencia para Woschni y para la gráfica) */
        Tmot = gu.TisenV(Tmot, v1, v2), pmot = Ruu * Tmot / v2;
        if (x2 < 1e-4) {
          /* una sola zona sin quemar: primer principio con el trabajo evaluado a presión media */
          let p2 = pp * Math.pow(v1 / v2, 1.33), T2 = TU;
          for (let k = 0; k < 3; k++) T2 = gu.Tu(e - .5 * (pp + p2) * dv - dqw, T2), p2 = Ruu * T2 / v2;
          rat = p2 / pp, e -= .5 * (pp + p2) * dv + dqw, pp = p2, TU = T2
        } else {
          iStart < 0 && (iStart = i, TuSoc = TU, pSoc = pp);
          /* dos zonas: se busca la presión con la que el volumen de las dos suma el del cilindro */
          const su = gu.s0(TU), xm = 1 - .5 * (x + x2), has = 1 - x2 > 1e-9;
          let Tu2 = TU, Tb2 = TB || 2200, e2 = e, nb = ntb;
          const f = p2 => {
            e2 = e - .5 * (pp + p2) * dv - dqw;
            const lp = Math.log(p2);
            let uu = 0;
            has && (Tu2 = gu.Ts0(su + Ruu * Math.log(p2 / pp) - dqu / (xm * TU), Tu2), uu = gu.u(Tu2));
            Tb2 = tb.Tu((e2 - (1 - x2) * uu) / x2, lp), nb = tb.nt(Tb2, lp);
            return ((1 - x2) * Ruu * Tu2 + x2 * nb * Ru * Tb2) / p2 - v2
          };
          let pa = pp * rat, fa = f(pa), pb = pa * 1.004, fb = f(pb);
          for (let k = 0; k < 20 && Math.abs(fb) > 1e-10 * v2 && fb !== fa; k++) { const pc = Math.min(4 * pb, Math.max(.25 * pb, pb - fb * (pb - pa) / (fb - fa))); pa = pb, fa = fb, pb = pc, fb = f(pb) }
          rat = pb / pp, e = e2, pp = pb, TU = Tu2, TB = Tb2, ntb = nb;
          TB > TbMax && (TbMax = TB, iTb = i + st)
        }
        x = x2;
        Tcore = gu.Ts0(sIvc + Ruu * Math.log(pp / pivc), Tcore)
      }
      /* al abrir el escape: lo que queda en el cilindro se expande sin intercambiar calor hasta la contrapresión; de ahí, los residuales */
      const lpE = Math.log(pp), has = x > 1e-4, sB = has ? tb.s(TB, lpE) : 0, Tres = has ? (pp > pex ? tb.Ts(sB, lpx) : TB) : gu.Tisen(TU, pp, pex), Rres = has ? tb.nt(Tres, lpx) * Ru : Ruu;
      const mResN = pex * Vc / (Rres * Tres);
      return { xr: mResN / (mFresh + mResN), xr0: xr, m, mRes, mResN, gu, Tivc, pivc, Tdry, pEvo: pp, TbEvo: TB, TuEvo: TU, xEvo: x, eEvo: e, ntEvo: ntb, sB, Tres, Qw, ki, knockAt, TbMax, iTb, TuSoc, pSoc, TcMax, iStart, has }
    }
    /* residuales: dos pasadas rápidas de tanteo (paso de 1°) fijan su fracción y su temperatura; la tercera, fina, es la buena */
    R = closed(.02, 900, 4), R = closed(R.xr, R.Tres, 4), R = closed(R.xr, R.Tres, 1);
    const gu = R.gu;
    /* admisión: presión del colector con una pequeña depresión a media carrera */
    for (let i = 0; i < iIvc; i++) { const a = ang(i); p[i] = pim * (1 - .03 * Math.sin(Math.max(0, a + TAU))), T[i] = Tim, Tu[i] = Tim, pm[i] = p[i] }
    /* escape: descarga rápida hasta la contrapresión y empuje; cerca del PMS la presión vuelve hacia la de admisión (cruce de válvulas) */
    { const q = dth / (.25 * DEG), kx = 1 - Math.pow(.86, q), kl = 1 - Math.pow(.95, q); let pp = R.pEvo; for (let i = iEvo; i < N; i++) { const a = ang(i); p[i] = pp, pm[i] = pex, xb[i] = R.xEvo, vbf[i] = R.has ? 1 : 0, T[i] = Tb[i] = R.has ? tb.Ts(R.sB, Math.log(Math.max(pp, .5 * pex))) : R.TuEvo, Tu[i] = R.TuEvo; pp += (pex - pp) * kx; a > TAU - 15 * DEG && (pp = lerp(pp, pim, kl)) } }
    /* trabajo indicado del ciclo completo y de la carrera de escape (regla del trapecio) */
    let Wnet = 0, Wex = 0;
    for (let i = 0; i < N; i++) { const j = (i + 1) % N, dW = .5 * (p[i] + p[j]) * (vol[j] - vol[i]); Wnet += dW, i >= iEvo && (Wex += dW) }
    /* gas de escape hacia la turbina: primer principio entre la apertura del escape y el final de la carrera. Lo que sale se lleva la
       energía interna que había, más el trabajo que le hace el pistón, menos lo que se queda como residual */
    const hOut = (R.m * R.eEvo - Wex - R.mResN * (R.has ? tb.u(R.Tres, lpx) : gu.u(R.Tres))) / (R.m - R.mResN), xE = R.xEvo;
    const hEx = Tq => xE * (R.has ? tb.h(Tq, lpx) : 0) + (1 - xE) * gu.h(Tq);
    let Tex = 1100;
    { let Ta = 900, fa = hEx(Ta) - hOut, Tb_ = 1500, fb = hEx(Tb_) - hOut; for (let k = 0; k < 30 && Math.abs(fb) > 1 && fb !== fa; k++) { const Tc = Math.min(3500, Math.max(400, Tb_ - fb * (Tb_ - Ta) / (fb - fa))); Ta = Tb_, fa = fb, Tb_ = Tc, fb = hEx(Tc) - hOut } Tex = Tb_ }
    /* rendimiento */
    const imepN = Wnet / Vd, Spm = Sp;
    let dpmax = 0, imax = 0, pmax = 0, Tmax = 0;
    for (let i = 1; i < N; i++) { const d = (p[i] - p[i - 1]) / 1e5 / (720 / N); d > dpmax && (dpmax = d); p[i] > p[imax] && (imax = i); T[i] > Tmax && (Tmax = T[i]) }
    pmax = p[imax];
    const fmep = (P.fric / 100) * (.25 + .004 * pmax / 1e5 + .09 * Spm + .0009 * Spm * Spm) * 1e5;
    const bmep = imepN - fmep, Pb = bmep * Vd * NC * rpm / 120, Pi = imepN * Vd * NC * rpm / 120, Tq = Pb / w, Ef = mf * FU.lhv;
    const etaB = bmep * Vd / Ef, etaI = Wnet / Ef;
    return { fuelKgh, rpm, w, B, S, r, l, lam, Ap, Vd, Vc, Sp, N, dth, dt, th, p, T, Tu, Tb, xb, vbf, hg, vol, pm, qrel, tauK, tcA, onf, xPis, V, mAir, mf, lambda, phi, Q, imep: imepN, fmep, bmep, Pb, Pi, Tq, etaB, etaI, pmax, thPmax: th[imax], dpmax, Tmax, knockAt: R.knockAt, ki: R.ki, qw: R.Qw, Tivc: R.Tivc, pivc: R.pivc, Tdry: R.Tdry, Tw,
      FU, tb, gu, iIvc, iEvo, V0, mFresh, xr: R.xr0, xrOut: R.xr, ntEvo: R.ntEvo, eEvo: R.eEvo, m: R.m, xEvo: R.xEvo, pEvo: R.pEvo, TbEvo: R.TbEvo, TuEvo: R.TuEvo, Tres: R.Tres, Tex, TbMax: R.TbMax, iTb: R.iTb, TuSoc: R.TuSoc, pSoc: R.pSoc, TcMax: R.TcMax, iStart: R.iStart, Wnet, Wex, Ef, xmax }
  }

  /* ---------- fuerzas en un cilindro ---------- */
  function forces(P, C) {
    const N = C.N, w = C.w, r = C.r, l = C.l, lam = C.lam, mPis = P.mpis / 1e3, mRod = P.mrod / 1e3, fr = P.rodcg, mRec = mPis + mRod * fr, mRotRod = mRod * (1 - fr), pcc = P.pcc * 1e5;
    const Fg = new Float32Array(N), Fi = new Float32Array(N), Fr = new Float32Array(N), Fn = new Float32Array(N), Tc = new Float32Array(N), acc = new Float32Array(N), vel = new Float32Array(N), bx = new Float32Array(N), by = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const a = C.th[i] * DEG, s = Math.sin(a), c = Math.cos(a), q = Math.sqrt(1 - lam * lam * s * s);
      const v = r * w * (s + lam * s * c / q), ac = r * w * w * (c + lam * (Math.cos(2 * a) + lam * lam * Math.pow(s, 4)) / Math.pow(q, 3));
      vel[i] = v, acc[i] = ac;
      Fg[i] = (C.p[i] - pcc) * C.Ap, Fi[i] = -mRec * ac;
      const Fnet = Fg[i] + Fi[i], phi = Math.asin(lam * s), cp = Math.cos(phi);
      Fr[i] = Fnet / cp, Fn[i] = Fnet * Math.tan(phi), Tc[i] = Fnet * r * Math.sin(a + phi) / cp;
      /* carga en la muñequilla (cojinete de cabeza de biela) en ejes del cigüeñal: biela + masa rotante de la biela */
      const fx = Fr[i] * Math.sin(phi), fy = -Fr[i] * cp, cf = mRotRod * r * w * w;
      bx[i] = fx * Math.cos(a) + fy * Math.sin(a), by[i] = -fx * Math.sin(a) + fy * Math.cos(a) - cf
    }
    return { Fg, Fi, Fr, Fn, Tc, acc, vel, bx, by, mRec, mRotRod }
  }

  /* ---------- tensiones y seguridad ---------- */
  function stresses(P, C, F) {
    const mp = MAT[P.pmat], mr = MAT[P.rmat];
    const R0 = C.B / 2, t = P.crown / 1e3, pmax = C.pmax - P.pcc * 1e5;
    const sCrown = .95 * pmax * Math.pow(R0 * P.crownspan / t, 2);
    const tCrownHot = mp.Tmax;
    /* resistencia del pistón a temperatura (pérdida lineal hasta el 50 % en Tmax) */
    let maxF = -1e9, minF = 1e9, maxT = 0;
    for (let i = 0; i < C.N; i++) { const f = F.Fg[i] + F.Fi[i]; f > maxF && (maxF = f), f < minF && (minF = f) }
    const d = P.pin / 1e3, di = P.pinid / 1e3, Lp = P.pinlen / 1e3, Z = Math.PI * (d ** 4 - di ** 4) / (32 * d), Apin = Math.PI / 4 * (d * d - di * di);
    const sPin = maxF * Lp / 8 / Z, tauPin = 2 * maxF / (2 * Apin) * (4 / 3);
    const As = P.rodA / 1e6, sRodC = Math.max(...F.Fr) / As, sRodT = -Math.min(...F.Fr) / As;
    const goodman = (smax, smin, M) => { const sa = (smax - smin) / 2, sm = (smax + smin) / 2; return 1 / (sa / M.Se + Math.max(0, sm) / M.Su) };
    const sfRod = goodman(sRodT, -sRodC, mr), sfPin = goodman(sPin, Math.min(0, minF) * Lp / 8 / Z, MAT.steel), sfCrown = goodman(sCrown, 0, { Se: mp.Se * .7, Su: mp.Su * .7 });
    const I = P.rodI * 1e-12, Le = C.l, Pcr = Math.PI * Math.PI * mr.E * I / (Le * Le), sfBuck = Pcr / Math.max(1, Math.max(...F.Fr));
    let bmax = 0;
    for (let i = 0; i < C.N; i++) bmax = Math.max(bmax, Math.hypot(F.bx[i], F.by[i]));
    const bearP = bmax / (P.pinD / 1e3 * P.pinW / 1e3);
    return { sCrown, sPin, tauPin, sRodC, sRodT, sfRod, sfPin, sfCrown, sfBuck, Pcr, maxF, minF, bmax, bearP, accMax: Math.max(...F.acc), vMax: Math.max(...F.vel) }
  }

  /* ---------- térmico: camisa, anillos y pistón ---------- */
  function thermal(P, C) {
    const NZ = 48, S = C.S, z = new Float32Array(NZ), Twl = new Float32Array(NZ), hz = new Float32Array(NZ), Tg = new Float32Array(NZ);
    const lin = MAT[P.lmat] || MAT.al2618, U = 1 / (P.lthk / 1e3 / lin.k + 1 / P.hcool), Tc = P.tcool + 273.15;
    let hm = 0, hT = 0;
    for (let i = 0; i < C.N; i++) hm += C.hg[i], hT += C.hg[i] * C.T[i];
    const hAvg = hm / C.N, TgAvg = hT / Math.max(1e-9, hm);
    for (let k = 0; k < NZ; k++) {
      const zz = k / (NZ - 1) * S * 1.05;
      let hs = 0, hts = 0;
      for (let i = 0; i < C.N; i++) { const exposed = C.xPis(C.th[i] * DEG) > zz - P.ringland / 1e3; if (exposed) hs += C.hg[i], hts += C.hg[i] * C.T[i] }
      const h = hs / C.N, tg = hs > 0 ? hts / hs : Tc;
      /* calor de fricción de los segmentos, mayor cerca del PMS donde la película de aceite es mínima */
      const qf = P.ringfric * 1e3 * Math.exp(-zz / (S * .25));
      z[k] = zz * 1e3, hz[k] = h, Tg[k] = tg, Twl[k] = (h * tg + U * Tc + qf) / (h + U) - 273.15
    }
    /* pistón: corona con chorro de aceite debajo */
    const pm = MAT[P.pmat], Up = 1 / (P.crown / 1e3 / pm.k + 1 / P.hoil), Toil = P.toil + 273.15;
    const Tpis = (hAvg * TgAvg + Up * Toil) / (hAvg + Up) - 273.15;
    const Tring = Twl[Math.min(NZ - 1, Math.round(P.ringland / 1e3 / (S * 1.05) * (NZ - 1)))];
    const qLiner = hAvg * (TgAvg - (Twl[0] + 273.15));
    return { z, Twl, hz, Tg, hAvg, TgAvg, Tpis, Tring, U, qLiner, NZ }
  }

  /* ---------- V6: par total, fuerzas y momentos libres ---------- */
  function v6(P, C, F) {
    const N2 = 720, Tq = new Float32Array(N2), Fy = new Float32Array(360), Fz = new Float32Array(360), My = new Float32Array(360), Mz = new Float32Array(360), ang = new Float32Array(N2);
    const bank = P.bank * DEG, sp = P.spacing / 1e3;
    const cyl = [];
    for (let k = 0; k < NC; k++) {
      const left = k < 3, beta = (left ? -1 : 1) * bank / 2, x = (k % 3) * sp + (left ? 0 : P.offset / 1e3);
      const fireAt = FIRE.indexOf(k) * 120;
      cyl.push({ beta, x, fireAt })
    }
    const xm = cyl.reduce((a, c) => a + c.x, 0) / NC;
    const look = (arr, deg) => { const d = ((deg + 360) % 720 + 720) % 720, f = d / 720 * C.N, i = Math.floor(f) % C.N, j = (i + 1) % C.N, u = f - Math.floor(f); return arr[i] * (1 - u) + arr[j] * u };
    for (let a = 0; a < N2; a++) {
      ang[a] = a;
      let t = 0;
      for (const c of cyl) t += look(F.Tc, a - c.fireAt - 360);
      Tq[a] = t
    }
    /* inercia: periodo de una vuelta; contrapesos equilibran un % de la masa rotante */
    const cw = P.cwt / 100, mRot = F.mRotRod + P.mpinT / 1e3;
    for (let a = 0; a < 360; a++) {
      let fy = 0, fz = 0, my = 0, mz = 0;
      for (const c of cyl) {
        const th = (a - c.fireAt) * DEG, s = Math.sin(th), co = Math.cos(th), q = Math.sqrt(1 - C.lam ** 2 * s * s);
        const acc = C.r * C.w ** 2 * (co + C.lam * (Math.cos(2 * th) + C.lam * C.lam * Math.pow(s, 4)) / q ** 3);
        const Fax = F.mRec * acc;
        let ey = Math.sin(c.beta), ez = Math.cos(c.beta);
        let ffy = Fax * ey, ffz = Fax * ez;
        const pin = c.beta + th, Fc = mRot * C.r * C.w ** 2 * (1 - cw);
        ffy += Fc * Math.sin(pin), ffz += Fc * Math.cos(pin);
        fy += ffy, fz += ffz, my += ffz * (c.x - xm), mz += -ffy * (c.x - xm)
      }
      Fy[a] = fy, Fz[a] = fz, My[a] = my, Mz[a] = mz
    }
    const harm = (arr, n) => { const out = []; for (let q = 1; q <= n; q++) { let re = 0, im = 0; for (let a = 0; a < arr.length; a++) { const ph = TAU * q * a / arr.length; re += arr[a] * Math.cos(ph), im += arr[a] * Math.sin(ph) } out.push(2 * Math.hypot(re, im) / arr.length) } return out };
    let Tm = 0, Tmax = -1e9, Tmin = 1e9;
    for (let a = 0; a < N2; a++) Tm += Tq[a], Tmax = Math.max(Tmax, Tq[a]), Tmin = Math.min(Tmin, Tq[a]);
    Tm /= N2;
    const Fmag = new Float32Array(360), Mmag = new Float32Array(360);
    for (let a = 0; a < 360; a++) Fmag[a] = Math.hypot(Fy[a], Fz[a]), Mmag[a] = Math.hypot(My[a], Mz[a]);
    return { Tq, ang, Tm, Tmax, Tmin, Fy, Fz, My, Mz, Fmag, Mmag, hF: harm(Fz, 6), hFy: harm(Fy, 6), hM: harm(My, 6), hMz: harm(Mz, 6), cyl }
  }

  /* ---------- torsional del cigüeñal ---------- */
  function torsion(P, C, F) {
    /* masas: amortiguador/polea, 3 muñequillas (2 bielas cada una), volante + embrague, piñón del MGU-K */
    const Jt = P.jthrow * 1e-4 + 2 * (F.mRec / 2 + F.mRotRod) * C.r * C.r, J = [P.jdamp * 1e-4, Jt, Jt, Jt, P.jfly * 1e-4, P.jmgu * 1e-4], kk = P.kshaft * 1e3;
    const K = [kk * 1.6, kk, kk, kk * .8, P.kmgu * 1e3]; /* rigidez de cada tramo, N·m/rad */
    const n = J.length, Km = Array.from({ length: n }, () => new Float64Array(n));
    for (let i = 0; i < n - 1; i++) Km[i][i] += K[i], Km[i + 1][i + 1] += K[i], Km[i][i + 1] -= K[i], Km[i + 1][i] -= K[i];
    /* A = J^-1/2 K J^-1/2, autovalores por Jacobi */
    const A = Km.map((row, i) => Array.from(row, (v, j) => v / Math.sqrt(J[i] * J[j])));
    const ev = jacobi(A).filter(x => x > 1).map(x => Math.sqrt(x) / TAU).sort((a, b) => a - b);
    return { J, K, Km, freqs: ev, n }
  }
  function jacobi(A0) {
    const n = A0.length, A = A0.map(r => r.slice());
    for (let sweep = 0; sweep < 60; sweep++) {
      let off = 0;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] * A[i][j];
      if (off < 1e-9) break;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-12) continue;
        const th = (A[q][q] - A[p][p]) / (2 * A[p][q]), t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) { const akp = A[k][p], akq = A[k][q]; A[k][p] = c * akp - s * akq, A[k][q] = s * akp + c * akq }
        for (let k = 0; k < n; k++) { const apk = A[p][k], aqk = A[q][k]; A[p][k] = c * apk - s * aqk, A[q][k] = s * apk + c * aqk }
      }
    }
    return A.map((r, i) => r[i])
  }
  /* respuesta forzada torsional: armónicos del par de cada cilindro, sumados por muñequilla con su fase */
  function torsResponse(P, TS, C, F, rpm) {
    const nh = 24, Tc = F.Tc, N = C.N, comps = [];
    for (let q = 1; q <= nh; q++) { /* orden q/2 (ciclo de 720°) */
      let re = 0, im = 0;
      for (let i = 0; i < N; i++) { const ph = TAU * q * i / N; re += Tc[i] * Math.cos(ph), im += Tc[i] * Math.sin(ph) }
      comps.push([2 * re / N, 2 * im / N])
    }
    const throwOf = k => k % 3, J = TS.J, n = TS.n, w0 = rpm / 60 * TAU;
    let tauMax = 0, worst = 0;
    const amp = [];
    for (let q = 1; q <= nh; q++) {
      const om = q / 2 * w0;
      const fr = new Float64Array(n), fi = new Float64Array(n);
      for (let k = 0; k < NC; k++) {
        const ph = -q / 2 * FIRE.indexOf(k) * 120 * DEG, [a, b] = comps[q - 1], c = Math.cos(ph), s = Math.sin(ph), j = 1 + throwOf(k);
        fr[j] += a * c - b * s, fi[j] += a * s + b * c
      }
      /* (K - w²J + i w C) x = f; amortiguador viscoso en la polea + amortiguamiento interno */
      const Mr = [], Mi = [];
      for (let i = 0; i < n; i++) { Mr.push(Array.from(TS.Km[i])), Mi.push(new Array(n).fill(0)), Mr[i][i] -= om * om * J[i], Mi[i][i] += om * (i === 0 ? P.cdamp : P.zint * 2 * Math.sqrt(TS.Km[i][i] * J[i])) }
      const x = csolve(Mr, Mi, fr, fi);
      let tw = 0;
      for (let i = 0; i < n - 1; i++) { const dr = x[0][i + 1] - x[0][i], di = x[1][i + 1] - x[1][i], twist = Math.hypot(dr, di); tw = Math.max(tw, twist * TS.K[i]) }
      amp.push(tw), tw > worst && (worst = tw)
    }
    /* combinación de órdenes: raíz de la suma de cuadrados (fases distintas) más el orden dominante */
    let tot = 0;
    for (const a of amp) tot += a * a;
    tot = Math.sqrt(tot) * .6 + worst * .4;
    const d = P.journal / 1e3, tau = 16 * tot / (Math.PI * d * d * d);
    return { amp, torque: tot, tau, worst }
  }
  function csolve(Ar, Ai, br, bi) {
    const n = br.length;
    /* sistema real 2n: [Ar -Ai; Ai Ar][xr; xi] = [br; bi] (intercalado) */
    const m = 2 * n, A = new Array(m);
    for (let i = 0; i < n; i++) {
      const r1 = new Float64Array(m + 1), r2 = new Float64Array(m + 1);
      for (let j = 0; j < n; j++) r1[j] = Ar[i][j], r1[n + j] = -Ai[i][j], r2[j] = Ai[i][j], r2[n + j] = Ar[i][j];
      r1[m] = br[i], r2[m] = bi[i], A[i] = r1, A[n + i] = r2
    }
    for (let i = 0; i < m; i++) { let p = i; for (let k = i + 1; k < m; k++) Math.abs(A[k][i]) > Math.abs(A[p][i]) && (p = k); [A[i], A[p]] = [A[p], A[i]]; for (let k = i + 1; k < m; k++) { const f = A[k][i] / A[i][i]; if (f) for (let j = i; j <= m; j++) A[k][j] -= f * A[i][j] } }
    const x = new Float64Array(m);
    for (let i = m - 1; i >= 0; i--) { let s = A[i][m]; for (let j = i + 1; j < m; j++) s -= A[i][j] * x[j]; x[i] = s / A[i][i] }
    return [x.slice(0, n), x.slice(n)]
  }

  /* ---------- distribución: alzada, dinámica del tren de válvulas y holgura con el pistón ---------- */
  /* ángulos del ciclo de cada cilindro (0 = PMS de encendido): apertura y duración de cada leva */
  const VT = P => ({ in: [-360 - P.ivo, P.ivo + 180 + P.ivc], ex: [180 - P.evo, P.evo + 180 + P.evc] });
  function lift(P, kind, thd, over = 0) {
    const [o, d0] = VT(P)[kind], d = d0 * (1 + .6 * over), u = ((thd - o) % 720 + 720) % 720;
    if (u >= d) return 0;
    const s = Math.sin(Math.PI * u / d);
    return (kind === "in" ? P.vlin : P.vlex) / 1e3 * (1 + .8 * over) * s * s
  }
  /* muelle neumático: gas comprimido (politrópica 1,3); metálico: lineal */
  const springF = (P, L) => P.vsys === "neum" ? P.vpre * Math.pow(P.vgas / Math.max(.5, P.vgas - L * 1e3), 1.3) : P.vpre + P.vspring * L * 1e3;
  function valvetrain(P, C, rpm) {
    const m = P.vtmass / 1e3, T = VT(P);
    let ratio = 0, aMax = 0, Fneed = 0, Fspr = 0;
    for (const kind of ["in", "ex"]) {
      const dur = T[kind][1], L = (kind === "in" ? P.vlin : P.vlex) / 1e3, wx = 6 * rpm / dur; /* dx/dt con x = fracción de la duración */
      aMax = Math.max(aMax, 2 * Math.PI * Math.PI * L * wx * wx);
      for (let x = .25; x <= .75; x += .005) {
        const dec = -2 * Math.PI * Math.PI * L * Math.cos(2 * Math.PI * x) * wx * wx; /* deceleración que debe dar el muelle */
        if (dec <= 0) continue;
        const Ls = L * Math.sin(Math.PI * x) ** 2, F = springF(P, Ls), q = m * dec / F;
        q > ratio && (ratio = q, Fneed = m * dec, Fspr = F)
      }
    }
    const over = Math.max(0, ratio - 1), floatRpm = rpm / Math.sqrt(Math.max(1e-6, ratio));
    /* holgura: el pistón sube al PMS de solape mientras escape cierra y admisión abre */
    let minC = 1e9, atTh = 0, atKind = "in";
    const deck = C.Vc / C.Ap + P.vpocket / 1e3, cv = Math.cos(11 * DEG);
    for (let t = 290; t <= 430; t += .5) for (const kind of ["in", "ex"]) { const cl = deck + C.xPis(t * DEG) - lift(P, kind, t, over) * cv; cl < minC && (minC = cl, atTh = t - 360, atKind = kind) }
    return { ratio, over, floatRpm, aMax, Fneed, Fspr, minC, atTh, atKind }
  }
  /* turbo con gases reales (cp variable): compresor de aire seco desde 25 °C y 1 bar con un 6 % de pérdida de carga hasta el colector
     (rendimiento isentrópico 78 %), velocidad por coeficiente de trabajo (0,55) y radio de 46 mm; turbina (rendimiento 80 %) con el gas de
     escape real, que entra a la temperatura que da el primer principio en el ciclo y sale a 1,05 bar */
  function turbo(P, C) {
    const CH = LAB.chem, ga = CH.air(), mdot = C.mAir * NC * C.rpm / 120, T1 = 298.15, p1 = .98e5, PR = P.boost * 1.06 / .98;
    const T2s = ga.Tisen(T1, p1, p1 * PR), dhc = ga.h(T2s) - ga.h(T1), T2 = ga.Th(ga.h(T1) + dhc / .78, T2s), Wc = mdot * dhc / .78, U = Math.sqrt(dhc / .55), Nt = U / .046 * 60 / TAU;
    const T3 = C.Tex, p3 = P.pexh * 1e5, p4 = 1.05e5, mex = (C.mAir + C.mf) * NC * C.rpm / 120;
    let Wt = 0, T4 = T3;
    if (p3 > p4 * 1.01) { const ge = CH.gas(CH.eq(Math.min(Math.max(T3, 900), 2500), p3, C.tb.b).n), T4s = ge.Tisen(T3, p3, p4), dht = ge.h(T3) - ge.h(T4s); Wt = mex * .8 * dht, T4 = ge.Th(ge.h(T3) - .8 * dht, T4s) }
    return { mdot, mex, PR, T2, Wc, Nt, T3, T4, Wt, Wh: Wt - Wc }
  }
  /* ---------- química: óxidos de nitrógeno, composición y emisiones ----------
     NO fuera del equilibrio con dos hipótesis que acotan la realidad (Heywood, cap. 11): gas quemado bien mezclado (una sola
     temperatura, la de la zona quemada del ciclo) y gas quemado sin mezclar (cada tanda sale a su temperatura de llama y luego se
     comprime y expande sin intercambiar calor: las primeras en quemarse acaban mucho más calientes). */
  function chem(P, C) {
    /* las curvas de NO se refieren a todo el gas que acabará quemado: así se ve cuánto se ha formado ya, sin saltos al entrar gas nuevo */
    const { tb, gu, N, dt, iEvo, xb, p } = C, NP = 12, noM = new Float32Array(N), noU = new Float32Array(N), noE = new Float32Array(N), T1 = new Float32Array(N), TL = new Float32Array(N);
    const i0 = C.iStart < 0 ? iEvo : C.iStart + 1, xf = C.xEvo, born = new Int32Array(NP).fill(-1), sP = new Float64Array(NP), yP = new Float64Array(NP);
    let yM = 0, nb = 0;
    for (let i = i0; i < iEvo; i++) {
      const lp = Math.log(p[i]), x = xb[i];
      /* zona mezclada: el gas que se acaba de quemar entra sin NO y diluye el que había */
      yM *= i > i0 && x > 0 ? xb[i - 1] / x : 0, yM = tb.noStep(C.Tb[i], lp, yM, dt), noM[i] = yM * x / xf, noE[i] = tb.xNO(C.Tb[i], lp) * x / xf;
      /* tandas sin mezclar, de igual masa: cada una nace cuando la fracción quemada pasa por su centro */
      while (nb < NP && x >= (nb + .5) / NP * xf) born[nb] = i, sP[nb] = tb.s(tb.Th(gu.h(C.Tu[i]), lp), lp), nb++;
      let sum = 0;
      for (let k = 0; k < nb; k++) { const Tk = tb.Ts(sP[k], lp); yP[k] = tb.noStep(Tk, lp, yP[k], dt), sum += yP[k]; k === 0 && (T1[i] = Tk), k === nb - 1 && (TL[i] = Tk) }
      noU[i] = sum / NP
    }
    const iE = Math.max(i0, iEvo - 1), has = C.iStart >= 0 && xf > 1e-4;
    /* llama adiabática a presión constante desde el estado del gas sin quemar al empezar la combustión, y composiciones de equilibrio */
    const Tad = has ? tb.Th(gu.h(C.TuSoc), Math.log(C.pSoc)) : 0, iPk = Math.max(i0, Math.min(iEvo - 1, C.iTb)), cPk = has ? tb.comp(C.Tb[iPk], p[iPk]) : null, cEx = has ? tb.comp(Math.max(C.TbEvo, 900), C.pEvo) : null;
    /* emisiones por hora y por kWh: CO2 por balance de carbono del combustible quemado; NOx expresado como NO2 (convención de las normas) */
    const fuelBurnt = C.fuelKgh * xf, co2 = fuelBurnt * C.FU.co2 * (cEx ? cEx.X.CO2 / (cEx.X.CO2 + cEx.X.CO) : 1), mexh = (C.mAir + C.mf) * NC * C.rpm / 120 * 3600, Mex = cEx ? cEx.M : .0288;
    const nox = y => y * xf * .0460055 / Mex * mexh, kW = Math.max(1, C.Pb / 1e3);
    return { noM, noU, noE, T1, TL, i0, iE, has, Tad, cPk, cEx, iPk, noMix: noM[iE], noUn: noU[iE], noEqPk: has ? cPk.X.NO : 0, co2, co2kWh: co2 * 1e3 / kW, noxMix: nox(noM[iE]) * 1e3 / kW, noxUn: nox(noU[iE]) * 1e3 / kW, o2: cEx ? cEx.X.O2 : 0, co: cEx ? cEx.X.CO : 0 }
  }

  /* ---------- interfaz ---------- */
  const DEF = [
    { title: "Lo esencial", open: !0, help: "Mueve las revoluciones y el turbo y mira la presión dentro del cilindro, las fuerzas y las temperaturas.", items: [
      { id: "rpm", label: "Revoluciones", unit: "rpm", min: 3000, max: 15000, step: 50, v: 10500 },
      { id: "boost", label: "Presión de admisión (turbo)", unit: "bar abs", min: 1, max: 4.5, step: .05, v: 3.5 },
      { id: "fuel", label: "Caudal de combustible", unit: "kg/h", min: 20, max: 140, step: 1, v: 100, help: "El reglamento limita el caudal a 100 kg/h por encima de 10 500 rpm." },
      { id: "fflim", label: "Límite de caudal del reglamento", v: "si", opts: [["si", "Aplicar (0,009·rpm + 5,5 kg/h)"], ["no", "Sin límite"]] },
      { id: "soc", label: "Inicio de combustión", unit: "° (− = antes del PMS)", min: -40, max: 15, step: .5, v: -7, help: "Encender antes da más presión y potencia, pero sube el riesgo de detonación y la carga en el pistón." },
      { id: "cr", label: "Relación de compresión", unit: ":1", min: 8, max: 20, step: .1, v: 17.5 },
      { id: "pmat", label: "Material del pistón", v: "steel", opts: [["steel", "Acero (F1 actual)"], ["al2618", "Aluminio 2618"], ["mmc", "Aluminio-SiC (MMC)"]] },
      { id: "tcool", label: "Temperatura del refrigerante", unit: "°C", min: 60, max: 140, step: 1, v: 115 }
    ]},
    { title: "Geometría", adv: !0, items: [
      { id: "bore", label: "Diámetro (calibre)", unit: "mm", min: 60, max: 100, step: .1, v: 80 },
      { id: "stroke", label: "Carrera", unit: "mm", min: 40, max: 90, step: .1, v: 53 },
      { id: "rod", label: "Longitud de biela", unit: "mm", min: 80, max: 160, step: .5, v: 108 },
      { id: "bank", label: "Ángulo de la V", unit: "°", min: 60, max: 120, step: 1, v: 90 },
      { id: "spacing", label: "Distancia entre cilindros", unit: "mm", min: 85, max: 130, step: .5, v: 106 },
      { id: "offset", label: "Desfase entre bancadas", unit: "mm", min: 0, max: 40, step: .5, v: 18 }
    ]},
    { title: "Combustión y renovación de carga", adv: !0, items: [
      { id: "fuelmix", label: "Combustible", v: "e10", opts: Object.entries(LAB.chem.FUELS).map(([k, f]) => [k, f.name]), help: "El poder calorífico, el aire que necesita y los gases que deja se calculan a partir de su composición." },
      { id: "dur", label: "Duración de la combustión", unit: "°", min: 10, max: 80, step: 1, v: 40, help: "Del 0 al 99,9 % quemado. Con precámara la llama recorre la cámara mucho antes: baja este valor para simularla." },
      { id: "wa", label: "Wiebe a", unit: "", min: 3, max: 8, step: .1, v: 6.9 },
      { id: "wm", label: "Wiebe m (forma)", unit: "", min: .5, max: 4, step: .1, v: 1.6 },
      { id: "ron", label: "Octanaje (RON)", unit: "", min: 85, max: 110, step: .5, v: 102 },
      { id: "tji", label: "Encendido por precámara (TJI)", v: "si", opts: [["si", "Sí: chorros de llama, combustión pobre y rápida"], ["no", "No: bujía convencional"]], help: "La precámara quema la mezcla tan deprisa que al gas sin quemar no le da tiempo a autoinflamarse." },
      { id: "etac", label: "Rendimiento de combustión", unit: "%", min: 85, max: 100, step: .5, v: 98 },
      { id: "lambdaMin", label: "Lambda mínima (riqueza tope)", unit: "", min: .7, max: 1.6, step: .01, v: 1 },
      { id: "ve", label: "Rendimiento volumétrico", unit: "%", min: 70, max: 115, step: 1, v: 98 },
      { id: "tim", label: "Temperatura de admisión", unit: "°C", min: 20, max: 120, step: 1, v: 55 },
      { id: "pexh", label: "Contrapresión de escape", unit: "bar abs", min: 1, max: 5, step: .05, v: 2.9 },
      { id: "ivc", label: "Cierre de admisión (tras PMI)", unit: "°", min: 0, max: 80, step: 1, v: 45 },
      { id: "evo", label: "Apertura de escape (antes de PMI)", unit: "°", min: 0, max: 90, step: 1, v: 55 },
      { id: "woschni", label: "Factor de transferencia de calor", unit: "% Woschni", min: 30, max: 200, step: 1, v: 100 },
      { id: "fric", label: "Factor de fricción", unit: "%", min: 40, max: 160, step: 1, v: 100 },
      { id: "pcc", label: "Presión del cárter", unit: "bar abs", min: .2, max: 1.2, step: .05, v: .6 }
    ]},
    { title: "Masas y piezas", adv: !0, items: [
      { id: "mpis", label: "Pistón + segmentos + bulón", unit: "g", min: 150, max: 500, step: 1, v: 255 },
      { id: "mrod", label: "Biela", unit: "g", min: 150, max: 600, step: 1, v: 290 },
      { id: "rodcg", label: "Fracción alternativa de la biela", unit: "", min: .15, max: .5, step: .01, v: .3 },
      { id: "rmat", label: "Material de la biela", v: "ti64", opts: [["ti64", "Titanio Ti-6Al-4V"], ["steel", "Acero 300M"]] },
      { id: "rodA", label: "Sección mínima del cuerpo de la biela", unit: "mm²", min: 60, max: 400, step: 1, v: 300 },
      { id: "rodI", label: "Inercia mínima del cuerpo (pandeo)", unit: "mm⁴", min: 1000, max: 30000, step: 50, v: 9500 },
      { id: "crown", label: "Espesor de la corona del pistón", unit: "mm", min: 3, max: 12, step: .1, v: 5.2 },
      { id: "crownspan", label: "Vano libre de la corona (fracción del radio)", unit: "", min: .2, max: 1, step: .01, v: .45, help: "La corona apoya en nervios y en los alojamientos del bulón; el vano efectivo es menor que el radio." },
      { id: "pin", label: "Diámetro del bulón", unit: "mm", min: 14, max: 26, step: .1, v: 20 },
      { id: "pinid", label: "Diámetro interior del bulón", unit: "mm", min: 0, max: 18, step: .1, v: 9 },
      { id: "pinlen", label: "Luz del bulón entre apoyos", unit: "mm", min: 14, max: 60, step: .5, v: 24 },
      { id: "pinD", label: "Diámetro de la muñequilla", unit: "mm", min: 30, max: 55, step: .5, v: 38 },
      { id: "pinW", label: "Ancho del cojinete de biela", unit: "mm", min: 10, max: 25, step: .5, v: 18 },
      { id: "mpinT", label: "Masa rotante de la muñequilla", unit: "g", min: 0, max: 600, step: 5, v: 180 },
      { id: "cwt", label: "Equilibrado con contrapesos", unit: "% rotante", min: 0, max: 120, step: 1, v: 100 }
    ]},
    { title: "Térmico", adv: !0, items: [
      { id: "lmat", label: "Camisa", v: "al2618", opts: [["al2618", "Aluminio con recubrimiento Nikasil"], ["steel", "Acero"], ["mmc", "Aluminio-SiC"]] },
      { id: "lthk", label: "Espesor de la camisa", unit: "mm", min: 1, max: 8, step: .1, v: 3 },
      { id: "hcool", label: "Convección del refrigerante", unit: "W/m²K", min: 2000, max: 40000, step: 100, v: 20000 },
      { id: "twall", label: "Pared media para el ciclo", unit: "°C", min: 100, max: 350, step: 1, v: 190 },
      { id: "ringland", label: "Altura del primer segmento", unit: "mm", min: 2, max: 10, step: .1, v: 3.6 },
      { id: "ringfric", label: "Calor de fricción de segmentos", unit: "kW/m²", min: 0, max: 400, step: 5, v: 60 },
      { id: "hoil", label: "Refrigeración del pistón (chorro de aceite)", unit: "W/m²K", min: 500, max: 20000, step: 100, v: 8000 },
      { id: "toil", label: "Temperatura del aceite", unit: "°C", min: 60, max: 160, step: 1, v: 125 }
    ]},
    { title: "Distribución y válvulas", adv: !0, help: "Si la inercia de la válvula supera la fuerza del muelle, la válvula flota; con mucho solape o poca holgura, toca el pistón.", items: [
      { id: "vsys", label: "Muelles de válvula", v: "neum", opts: [["neum", "Neumáticos (nitrógeno a presión)"], ["metal", "Metálicos"]] },
      { id: "ivo", label: "Apertura de admisión (antes del PMS)", unit: "°", min: 0, max: 80, step: 1, v: 20 },
      { id: "evc", label: "Cierre de escape (tras el PMS)", unit: "°", min: 0, max: 80, step: 1, v: 20 },
      { id: "vlin", label: "Alzada de admisión", unit: "mm", min: 6, max: 20, step: .1, v: 13.5 },
      { id: "vlex", label: "Alzada de escape", unit: "mm", min: 6, max: 18, step: .1, v: 12 },
      { id: "vtmass", label: "Masa móvil por válvula", unit: "g", min: 20, max: 140, step: 1, v: 50, help: "Válvula, platillo, chavetas, taqué y la parte del muelle que se mueve." },
      { id: "vpre", label: "Precarga del muelle", unit: "N", min: 100, max: 2000, step: 10, v: 900 },
      { id: "vgas", label: "Columna de gas (muelle neumático)", unit: "mm", min: 16, max: 60, step: .5, v: 25 },
      { id: "vspring", label: "Rigidez (muelle metálico)", unit: "N/mm", min: 10, max: 150, step: 1, v: 60 },
      { id: "vpocket", label: "Rebaje de válvulas en el pistón", unit: "mm", min: 0, max: 4, step: .1, v: 1.2 }
    ]},
    { title: "Cigüeñal (torsional)", adv: !0, items: [
      { id: "jdamp", label: "Inercia de la polea / amortiguador", unit: "kg·cm²", min: 10, max: 800, step: 5, v: 120 },
      { id: "jthrow", label: "Inercia de cada muñequilla", unit: "kg·cm²", min: 20, max: 800, step: 5, v: 160 },
      { id: "jfly", label: "Inercia de embrague + volante", unit: "kg·cm²", min: 50, max: 3000, step: 10, v: 420 },
      { id: "jmgu", label: "Inercia reflejada del MGU-K", unit: "kg·cm²", min: 0, max: 2000, step: 10, v: 350 },
      { id: "kshaft", label: "Rigidez torsional entre muñequillas", unit: "kN·m/rad", min: 50, max: 2000, step: 5, v: 520 },
      { id: "kmgu", label: "Rigidez del acoplamiento del MGU-K", unit: "kN·m/rad", min: 5, max: 1000, step: 5, v: 60 },
      { id: "cdamp", label: "Amortiguador torsional (viscoso)", unit: "N·m·s/rad", min: 0, max: 60, step: .5, v: 14 },
      { id: "zint", label: "Amortiguamiento interno", unit: "ζ", min: 0, max: .1, step: .001, v: .03 },
      { id: "journal", label: "Diámetro de apoyo (tensión)", unit: "mm", min: 30, max: 60, step: .5, v: 42 }
    ]}
  ];
  const PRESETS = {
    qual: { name: "Clasificación", v: { rpm: 11500, boost: 3.9, soc: -14, fuel: 100 } },
    race: { name: "Carrera", v: { rpm: 10800, boost: 3.4, soc: -11, fuel: 100 } },
    lift: { name: "Ahorro (lift & coast)", v: { rpm: 9000, boost: 2.2, fuel: 45, soc: -9 } },
    knock: { name: "Al límite de detonación", v: { rpm: 8000, boost: 4.3, soc: -16, ron: 95 } },
    alu: { name: "Pistón de aluminio (2013)", v: { pmat: "al2618", mpis: 230, crown: 7, hoil: 6000 } },
    metal: { name: "Muelles metálicos", v: { vsys: "metal", vpre: 380, vspring: 55, rpm: 13500 } },
    overlap: { name: "Mucho solape", v: { ivo: 62, evc: 55 } },
    road: { name: "Motor de calle 1.6 turbo", v: { tji: "no", fflim: "no", rpm: 5500, boost: 2.0, fuel: 34, cr: 10.5, rod: 140, stroke: 81.4, bore: 79, ron: 95, mpis: 360, mrod: 470, rmat: "steel", pmat: "al2618", soc: -6, dur: 48, pexh: 1.6, ivc: 50, lthk: 4.5, crown: 8, tcool: 95, vsys: "metal", vpre: 260, vspring: 32, vlin: 9.5, vlex: 9, vtmass: 75, ivo: 8, evc: 10, vpocket: .8 } }
  };
  let host, prm, plots = {}, ro, roX, res = null, e3 = 0, frame = 0;
  function compute() {
    const P = prm.v, C = cycle(P), F = forces(P, C), Sx = stresses(P, C, F), Th = thermal(P, C), V6 = v6(P, C, F), TS = torsion(P, C, F), TR = torsResponse(P, TS, C, F, P.rpm);
    res = { P, C, F, Sx, Th, V6, TS, TR, VT: valvetrain(P, C, P.rpm), TB: turbo(P, C), X: chem(P, C), MK: { ratio: 50000 / 15000 } };
    drawStatic(), drawChem(), readouts(), sweep();
    LAB.engine3d && (e3 ? LAB.engine3d.update(res) : (e3 = 1, LAB.engine3d.init($("eng3d"), res)))
  }
  function drawStatic() {
    const { C, F, Th, V6, TS, Sx, P } = res, n = C.N;
    const th = C.th, pb = Array.from(C.p, v => v / 1e5), pmb = Array.from(C.pm, v => v / 1e5);
    plots.p.draw([{ x: th, y: Float32Array.from(pb), n, col: "#ff6b1a", label: "Presión (bar)" }, { x: th, y: Float32Array.from(pmb), n, col: "#5b6672", dash: [4, 3], label: "Sin combustión" }], { title: "Presión en el cilindro", xlabel: "° de cigüeñal (0 = PMS de encendido)", ymin: 0, vlines: C.knockAt != null ? [{ x: C.knockAt, col: "#ff3b3b", label: "detonación" }] : [] });
    const lv = Float32Array.from(C.vol, v => Math.log10(v * 1e6)), lp = Float32Array.from(C.p, v => Math.log10(v / 1e5));
    plots.pv.draw([{ x: lv, y: lp, n, col: "#ffd23f", label: "log p – log V" }], { title: "Diagrama indicado", xlabel: "log₁₀ V (cm³)" });
    const k = x => Float32Array.from(x, v => v / 1e3);
    plots.f.draw([{ x: th, y: k(F.Fg), n, col: "#ff6b1a", label: "Gas" }, { x: th, y: k(F.Fi), n, col: "#3d8bff", label: "Inercia" }, { x: th, y: k(F.Fr), n, col: "#e9eef3", label: "Biela" }, { x: th, y: k(F.Fn), n, col: "#b45cff", label: "Lateral (falda)" }], { title: "Fuerzas en el pistón y la biela (kN)", xlabel: "°", zero: !0 });
    plots.tq.draw([{ x: V6.ang, y: V6.Tq, n: 720, col: "#2fd16c", label: "Par instantáneo del V6 (N·m)" }], { title: "Par en el cigüeñal", xlabel: "°", hlines: [{ y: V6.Tm, col: "rgba(255,255,255,.5)", label: "medio " + V6.Tm.toFixed(0) + " N·m" }], zero: !0 });
    plots.th.draw([{ x: Th.z, y: Th.Twl, n: Th.NZ, col: "#ff3b3b", label: "Pared de la camisa (°C)" }], { title: "Temperatura de la camisa desde arriba", xlabel: "profundidad mm desde la culata", hlines: [{ y: 220, col: "rgba(255,210,63,.6)", label: "límite del aceite ~220 °C" }] });
    plots.brg.draw([{ x: k(F.bx), y: k(F.by), n, col: "#3d8bff", label: "Carga en cojinete de biela (kN)" }], { title: "Diagrama polar del cojinete", zero: !0 });
    const a3 = new Float32Array(360);
    for (let i = 0; i < 360; i++) a3[i] = i;
    plots.vib.draw([{ x: a3, y: V6.Fmag, n: 360, col: "#ffd23f", label: "Fuerza libre (N)" }, { x: a3, y: Float32Array.from(V6.Mmag, v => v * 10), n: 360, col: "#b45cff", label: "Momento libre ×10 (N·m)" }], { title: "Vibración: fuerzas y momentos libres", xlabel: "° de cigüeñal", ymin: 0 });
    /* Campbell */
    const ser = [], rp = new Float32Array(2);
    rp[0] = 3000, rp[1] = 15000;
    for (const o of [1.5, 3, 4.5, 6, 7.5, 9]) ser.push({ x: rp, y: Float32Array.from([o * 3000 / 60, o * 15000 / 60]), n: 2, col: o % 3 === 0 ? "#ff6b1a" : "#5b6672", w: o % 3 === 0 ? 1.8 : 1, label: o % 3 === 0 && o <= 6 ? "orden " + o : "" });
    const pts = [];
    for (const f of TS.freqs) { for (const o of [1.5, 3, 4.5, 6, 7.5, 9]) { const r = f * 60 / o; r > 3000 && r < 15000 && pts.push({ x: r, y: f, col: o % 3 === 0 ? "#ff3b3b" : "#ffd23f", r: o % 3 === 0 ? 5 : 3 }) } }
    plots.camp.draw(ser, { title: "Diagrama de Campbell (torsional)", xlabel: "rpm", ymin: 0, ymax: Math.max(400, (TS.freqs[2] || 300) * 1.2), xmin: 3000, xmax: 15000, hlines: TS.freqs.slice(0, 4).map((f, i) => ({ y: f, col: "rgba(45,209,108,.7)", label: "modo " + (i + 1) + " · " + f.toFixed(0) + " Hz" })), vlines: [{ x: P.rpm, col: "rgba(255,255,255,.4)", label: "ahora" }], points: pts })
  }
  /* barridos (revoluciones y lambda): se calculan a trozos para no bloquear la página y se abandonan si cambia algo mientras tanto */
  function sweep() {
    clearTimeout(sweep.t);
    const tok = sweep.tok = (sweep.tok || 0) + 1;
    sweep.t = setTimeout(() => {
      const P = res.P, xs = [], tau = [], pw = [];
      let rpm = 4000;
      const part = () => {
        if (tok !== sweep.tok) return;
        for (const t0 = performance.now(); rpm <= 15000 && performance.now() - t0 < 12; rpm += 250) { const C = cycle(P, rpm), F = forces(P, C), TR = torsResponse(P, res.TS, C, F, rpm); xs.push(rpm), tau.push(TR.tau / 1e6), pw.push(C.Pb / 1e3) }
        if (rpm <= 15000) return void setTimeout(part, 0);
        const x = Float32Array.from(xs);
        plots.sw.draw([{ x, y: Float32Array.from(tau), n: xs.length, col: "#ff3b3b", label: "Tensión torsional en el apoyo (MPa)" }], { title: "Barrido de revoluciones: torsional", xlabel: "rpm", ymin: 0, vlines: [{ x: P.rpm, col: "rgba(255,255,255,.4)" }] });
        plots.pw.draw([{ x, y: Float32Array.from(pw), n: xs.length, col: "#2fd16c", label: "Potencia al freno (kW)" }], { title: "Curva de potencia del motor térmico", xlabel: "rpm", ymin: 0, vlines: [{ x: P.rpm, col: "rgba(255,255,255,.4)" }] });
        lamSweep()
      };
      part()
    }, 160)
  }
  /* temperatura de llama y NO de equilibrio según la mezcla, desde el estado real del gas sin quemar al encender */
  function lamSweep() {
    const { C } = res, CH = LAB.chem;
    if (C.iStart < 0) return;
    const n = 31, lx = new Float32Array(n), ty = new Float32Array(n), ny = new Float32Array(n);
    for (let i = 0; i < n; i++) { const lam = .7 + i * .05, e = CH.flame(CH.reactants(C.FU, lam), C.TuSoc, C.pSoc); lx[i] = lam, ty[i] = e.T - 273.15, ny[i] = e.X.NO * 1e5 }
    plots.lam.draw([{ x: lx, y: ty, n, col: "#ff6b1a", label: "Llama adiabática (°C)" }, { x: lx, y: ny, n, col: "#3d8bff", dash: [4, 3], label: "NO de equilibrio (ppm ÷ 10)" }], { title: "Según la mezcla", xlabel: "lambda (1 = estequiométrica; más = pobre)", ymin: 0, vlines: [{ x: C.lambda, col: "rgba(255,255,255,.5)", label: "ahora" }] })
  }
  /* gráficas y fichas de la química */
  function drawChem() {
    const { C, X, P } = res, CH = LAB.chem, f = LAB.nf, n = C.iEvo - C.iIvc, sl = a => a.subarray(C.iIvc, C.iEvo), th = sl(C.th), cel = a => Float32Array.from(sl(a), v => v > 0 ? v - 273.15 : NaN), ppm = a => Float32Array.from(sl(a), v => v * 1e6);
    plots.tz.draw([{ x: th, y: cel(X.T1), n, col: "#ffd23f", w: 1.2, label: "Primer gas quemado" }, { x: th, y: cel(C.Tb), n, col: "#ff6b1a", label: "Gas quemado (media)" }, { x: th, y: cel(C.T), n, col: "#e9eef3", w: 1.1, dash: [4, 3], label: "Media del cilindro" }, { x: th, y: cel(C.Tu), n, col: "#3d8bff", label: "Sin quemar" }], { title: "Temperaturas de las dos zonas (°C)", xlabel: "° de cigüeñal", ymin: 0 });
    const nu = ppm(X.noU), top = Math.max(50, ...nu, ...ppm(X.noM)) * 1.25;
    plots.no.draw([{ x: th, y: Float32Array.from(sl(X.noE), v => Math.min(v * 1e6, top * 1.5)), n, col: "#5b6672", dash: [4, 3], label: "Equilibrio" }, { x: th, y: nu, n, col: "#ffd23f", label: "Sin mezclar" }, { x: th, y: ppm(X.noM), n, col: "#2fd16c", label: "Mezclado" }], { title: "Monóxido de nitrógeno formado (ppm)", xlabel: "° de cigüeñal", ymin: 0, ymax: top });
    /* mapa de autoencendido: retraso frente a 1000/T a tres presiones y recorrido del gas sin quemar */
    const m = 50, ser = [], lg = v => Math.log10(v * 1e3);
    for (const [pb, col] of [[50, "#3d8bff"], [150, "#b45cff"], [300, "#ff3b3b"]]) { const x = new Float32Array(m), y = new Float32Array(m); for (let i = 0; i < m; i++) x[i] = .72 + i * .8 / (m - 1), y[i] = lg(CH.tauIgn(1000 / x[i], pb * 1e5, C.phi) * C.onf); ser.push({ x, y, n: m, col, w: 1.2, label: pb + " bar" }) }
    const tx = [], ty = [];
    for (let i = C.iIvc; i < C.iEvo; i++) C.tauK[i] > 0 && C.tcA[i] > 640 && (tx.push(1000 / C.tcA[i]), ty.push(lg(C.tauK[i])));
    ser.push({ x: Float32Array.from(tx), y: Float32Array.from(ty), n: tx.length, col: "#ffffff", w: 2.2, label: "Gas sin quemar en este ciclo" });
    plots.ign.draw(ser, { title: "Retraso de autoencendido (log₁₀ ms)", xlabel: "1000 / T (K): a la izquierda, más caliente", xmin: .72, xmax: 1.52, ymin: -3, ymax: 2.5, hlines: [{ y: lg(C.dt * 40), col: "rgba(255,255,255,.35)", label: "lo que tarda el motor en girar 10°" }] });
    /* ficha del combustible */
    const F = C.FU, row = (k, v) => `<div><span>${k}</span><b>${v}</b></div>`, pct = v => f(v * 100, 1) + " %";
    $("engFuel").innerHTML = `<b>${CH.FUELS[F.id].name}</b>` +
      row("Composición (en volumen)", Object.entries(F.vol).filter(e => e[1] > 0).map(([k, v]) => f(v * 100, 0) + " % " + CH.LIQ[k].name).join(" · ")) +
      row("Fórmula media", `C<sub>${f(F.form.C, 2)}</sub>H<sub>${f(F.form.H, 2)}</sub>${F.form.O > .001 ? `O<sub>${f(F.form.O, 2)}</sub>` : ""} · ${f(F.M * 1e3, 1)} g/mol`) +
      row("Poder calorífico inferior", f(F.lhv / 1e6, 2) + " MJ/kg · " + f(F.lhv * F.rho / 1e9, 2) + " MJ/L") +
      row("Aire necesario (estequiométrico)", f(F.afr, 2) + " kg por kg") +
      row("Densidad · calor de vaporización", f(F.rho, 0) + " kg/m³ · " + f(F.hfg / 1e3, 0) + " kJ/kg") +
      row("Hidrógeno/carbono · oxígeno", f(F.hc, 2) + " · " + pct(F.oxy) + " en masa") +
      row("Etanol · aromáticos (en masa)", pct(F.eth) + " · " + pct(F.aro)) +
      row("CO₂ al quemarse del todo", f(F.co2, 2) + " kg por kg") +
      row("Potencia química a este caudal", f(C.fuelKgh / 3600 * F.lhv / 1e3, 0) + " kW");
    /* composición del gas quemado en equilibrio: barras en escala logarítmica, de 1 ppm a 100 % */
    const SP = [["N2", "N₂"], ["H2O", "H₂O"], ["CO2", "CO₂"], ["O2", "O₂"], ["AR", "Ar"], ["CO", "CO"], ["NO", "NO"], ["OH", "OH"], ["H2", "H₂"], ["O", "O"], ["H", "H"]];
    const fx = v => v >= .001 ? f(v * 100, v >= .1 ? 1 : 2) + " %" : v >= 1e-7 ? f(v * 1e6, v >= 1e-5 ? 0 : 1) + " ppm" : "< 0,1 ppm", wd = v => Math.max(0, Math.min(100, (Math.log10(Math.max(v, 1e-6)) + 6) / 6 * 100));
    $("engComp").innerHTML = X.has ? `<b>Gas quemado en equilibrio</b><div class="ch"><span></span><span>A máxima temperatura (${f(C.Tb[X.iPk] - 273.15, 0)} °C, ${f(C.p[X.iPk] / 1e5, 0)} bar)</span><span>Al abrir el escape (${f(C.TbEvo - 273.15, 0)} °C, ${f(C.pEvo / 1e5, 0)} bar)</span></div>` + SP.map(([k, n]) => `<div class="cr"><span>${n}</span><i><u style="width:${wd(X.cPk.X[k])}%"></u><em>${fx(X.cPk.X[k])}</em></i><i><u style="width:${wd(X.cEx.X[k])}%"></u><em>${fx(X.cEx.X[k])}</em></i></div>`).join("") + `<small>Fracción molar de cada gas (barras en escala logarítmica). Con calor, parte del CO₂ y del agua se rompe en CO, OH, H₂, O y H; al enfriarse en la expansión se recomponen y devuelven esa energía.</small>` : "";
    const c = v => v - 273.15, rng = (a, b, d) => f(Math.min(a, b), d) + "–" + f(Math.max(a, b), d);
    roX.set("tad", c(X.Tad), 0), roX.set("tbm", c(C.TbMax), 0), roX.set("tus", c(C.TuSoc), 0), roX.set("tcm", c(C.TcMax), 0), roX.set("tivc", c(C.Tivc), 0), roX.set("xr", C.xr * 100, 1);
    roX.set("no", rng(X.noMix * 1e6, X.noUn * 1e6, 0), 0), roX.set("nox", rng(X.noxMix, X.noxUn, 1), 0), roX.set("co2", X.co2, 0), roX.set("co2k", X.co2kWh, 0), roX.set("o2", X.o2 * 100, 1), roX.set("kint", C.ki * 100, 0, C.knockAt != null ? "bad" : C.ki > .7 ? "warn" : "ok")
  }
  /* lo que se puede contrastar con datos públicos: reglamento de la FIA y cifras de Mercedes */
  function bench() {
    const { C, P, TB } = res, es = n => Math.round(n).toLocaleString("es-ES"), cc = C.Vd * NC * 1e6, qlim = Math.min(100, .009 * P.rpm + 5.5), nk = P.rpm * res.MK.ratio, etaPU = (C.Pb + Math.max(0, TB.Wh)) / (C.Pb / C.etaB) * 100, S = LAB.SRC, f = LAB.nf, pt = C.Pb + 120e3;
    LAB.bench($("engBench"), [
      { k: "Cilindrada", lab: f(cc) + " cm³", real: "1600 cm³ (+0/−10)", s: 1, ok: cc <= 1600.5 && cc >= 1589.5 },
      { k: "Cilindros y ángulo de la V", lab: "6 en V a " + P.bank + "°", real: "6 en V a 90°", s: 1, ok: P.bank === 90 },
      { k: "Diámetro del cilindro", lab: f(P.bore, 1) + " mm", real: "80 ± 0,1 mm", s: 1, ok: Math.abs(P.bore - 80) <= .1001 },
      { k: "Relación de compresión", lab: f(P.cr, 1) + " : 1", real: "máx. 18,0 : 1 (16 : 1 en 2026)", s: "1, 5", ok: P.cr <= 18 },
      { k: "Régimen", lab: es(P.rpm) + " rpm", real: "máx. 15 000 rpm", s: 2, ok: P.rpm <= 15000 },
      { k: "Caudal de combustible a este régimen", lab: f(C.fuelKgh, 1) + " kg/h", real: "máx. " + f(qlim, 1) + " kg/h (100 kg/h; por debajo de 10 500 rpm, 0,009·rpm + 5,5)", s: 1, ok: C.fuelKgh <= qlim + .05 },
      { k: "Inyección", lab: "directa, un inyector por cilindro", real: "un inyector por cilindro, máx. 500 bar", s: 1, ok: !0 },
      { k: "Etanol en el combustible", lab: f(C.FU.eth * 100, 1) + " % en masa", real: "mín. 10 % en masa de etanol sostenible avanzado (art. 16.4.4)", s: 1, ok: C.FU.eth >= .1 },
      { k: "Aromáticos en el combustible", lab: f(C.FU.aro * 100, 1) + " % en masa", real: "máx. 40 % en masa (art. 16.4.1)", s: 1, ok: C.FU.aro <= .4 },
      { k: "Comburente", lab: "aire seco (N₂, O₂, Ar, CO₂)", real: "solo aire ambiente (art. 16.1.3)", s: 1, ok: !0 },
      { k: "Turbo", lab: es(TB.Nt) + " rpm", real: "máx. 125 000 rpm", s: 2, ok: TB.Nt <= 125e3 },
      { k: "MGU-K a este régimen", lab: es(nk) + " rpm", real: "máx. 50 000 rpm · 120 kW · 200 N·m, relación fija con el cigüeñal", s: 1, ok: nk <= 50000 },
      { k: "Rendimiento térmico, solo el motor", lab: f(C.etaB * 100, 1) + " %", real: "no se publica por separado", ok: null },
      { k: "Rendimiento contando lo que recupera el MGU-H", lab: f(etaPU, 1) + " %", real: "44 % en 2014; más del 50 % en banco en 2017 (Mercedes)", s: 3, ok: etaPU >= 42 && etaPU <= 56 },
      { k: "Potencia total (térmico + 120 kW del MGU-K)", lab: es((C.Pb + 120e3) / 1e3) + " kW", real: "más de 700 kW (Mercedes, 2025)", s: 4, ok: pt >= 700e3 && pt <= 800e3 ? !0 : pt >= 630e3 && pt <= 880e3 ? "near" : !1 },
      { k: "Fondo del cárter bajo el eje del cigüeñal", lab: "88 mm", real: "el eje del cigüeñal va a 90 mm del plano de referencia", s: 1, ok: !0 }
    ], [S.fia22, S.mbw16, S.mb50, S.mbpu26, S.honda26])
  }
  function readouts() {
    bench();
    const { C, Sx, Th, V6, TS, TR, P } = res, mp = MAT[P.pmat];
    const st = (sf, lo = 1.2, hi = 1.6) => sf < lo ? "bad" : sf < hi ? "warn" : "ok";
    ro.set("pw", C.Pb / 1e3, 0), ro.set("cv", C.Pb / 735.5, 0), ro.set("tq", C.Tq, 0), ro.set("eta", C.etaB * 100, 1, C.etaB > .45 ? "ok" : ""), ro.set("lam", C.lambda, 2);
    ro.set("imep", C.imep / 1e5, 1), ro.set("bmep", C.bmep / 1e5, 1), ro.set("fmep", C.fmep / 1e5, 2);
    ro.set("pmax", C.pmax / 1e5, 0, C.pmax > 340e5 ? "bad" : C.pmax > 300e5 ? "warn" : ""), ro.set("thp", C.thPmax, 1), ro.set("dp", C.dpmax, 1, C.dpmax > 20 ? "bad" : C.dpmax > 15 ? "warn" : "ok"), ro.set("tg", C.Tmax - 273, 0);
    ro.set("knock", C.knockAt != null ? "SÍ a " + C.knockAt.toFixed(0) + "°" : "No (" + (C.ki * 100).toFixed(0) + " %)", 0, C.knockAt != null ? "bad" : C.ki > .7 ? "warn" : "ok");
    ro.set("vp", C.Sp, 1), ro.set("ap", Sx.accMax / 9.81 / 1e3, 1), ro.set("crown", Sx.sCrown / 1e6, 0, st(Sx.sfCrown)), ro.set("sfc", Sx.sfCrown, 2, st(Sx.sfCrown));
    ro.set("pin", Sx.sPin / 1e6, 0, st(Sx.sfPin)), ro.set("rodc", Sx.sRodC / 1e6, 0), ro.set("rodt", Sx.sRodT / 1e6, 0), ro.set("sfr", Sx.sfRod, 2, st(Sx.sfRod)), ro.set("buck", Sx.sfBuck, 2, st(Sx.sfBuck, 2, 3));
    ro.set("brg", Sx.bearP / 1e6, 0, Sx.bearP > 260e6 ? "bad" : Sx.bearP > 200e6 ? "warn" : "ok");
    ro.set("tl", Math.max(...Th.Twl), 0, Math.max(...Th.Twl) > 250 ? "bad" : Math.max(...Th.Twl) > 210 ? "warn" : "ok"), ro.set("tr", Th.Tring, 0, Th.Tring > 230 ? "bad" : Th.Tring > 200 ? "warn" : "ok"), ro.set("tp", Th.Tpis, 0, Th.Tpis > mp.Tmax ? "bad" : Th.Tpis > mp.Tmax * .88 ? "warn" : "ok");
    ro.set("ff", Math.max(...V6.Fmag), 0), ro.set("fm", Math.max(...V6.Mmag), 0), ro.set("f1", TS.freqs[0] || 0, 0), ro.set("tau", TR.tau / 1e6, 0, TR.tau > 220e6 ? "bad" : TR.tau > 150e6 ? "warn" : "ok"), ro.set("tqr", V6.Tmax - V6.Tmin, 0);
    const { VT: vt, TB } = res;
    ro.set("vfl", Math.round(vt.floatRpm), 0, vt.over > 0 ? "bad" : vt.floatRpm < P.rpm * 1.1 ? "warn" : "ok"), ro.set("vcl", vt.minC * 1e3, 2, vt.minC < 0 ? "bad" : vt.minC < .0008 ? "warn" : "ok"), ro.set("vac", vt.aMax / 9.81, 0);
    ro.set("nt", Math.round(TB.Nt), 0, TB.Nt > 125e3 ? "bad" : TB.Nt > 118e3 ? "warn" : ""), ro.set("mguh", TB.Wh / 1e3, 0), ro.set("t2", TB.T2 - 273, 0), ro.set("egt", TB.T3 - 273, 0, TB.T3 - 273 > 1050 ? "bad" : TB.T3 - 273 > 980 ? "warn" : ""), ro.set("wc", TB.Wc / 1e3, 0);
    const out = [];
    /* límite pobre: por debajo de unos 1500 K de temperatura de llama (1230 °C) una llama de hidrocarburo no se sostiene */
    res.X.has && res.X.Tad < 1500 ? out.push(["bad", "Mezcla", "Demasiado pobre (lambda " + C.lambda.toFixed(2) + "): la llama saldría a " + (res.X.Tad - 273).toFixed(0) + " °C y no se sostendría. Un motor real fallaría el encendido."]) : res.X.has && res.X.Tad < 1800 && out.push(["warn", "Mezcla", "Muy pobre (lambda " + C.lambda.toFixed(2) + "): llama a " + (res.X.Tad - 273).toFixed(0) + " °C, cerca del límite en que deja de propagarse."]);
    C.knockAt != null ? out.push(["bad", "Detonación", "La mezcla sin quemar explota sola antes de que llegue la llama. Retrasa el encendido, baja el turbo o usa más octanaje."]) : C.ki > .7 ? out.push(["warn", "Detonación", "Estás cerca del límite: poco margen."]) : out.push(["ok", "Combustión", "Limpia, sin detonación."]);
    Sx.sfCrown < 1.2 ? out.push(["bad", "Pistón", "La corona trabaja por encima de su resistencia a fatiga: riesgo de rotura."]) : Th.Tpis > mp.Tmax ? out.push(["bad", "Pistón", "La corona se calienta a " + Th.Tpis.toFixed(0) + " °C, más de lo que aguanta el " + mp.name + "."]) : out.push(["ok", "Pistón", "Temperatura y tensión dentro de margen."]);
    Sx.sfRod < 1.2 || Sx.sfBuck < 2 ? out.push(["bad", "Biela", "Poco margen en la biela (tracción por inercia o pandeo). Menos revoluciones o biela más robusta."]) : out.push(["ok", "Biela", "Seguridad a fatiga " + Sx.sfRod.toFixed(2) + " y a pandeo " + Sx.sfBuck.toFixed(1) + "."]);
    Th.Tring > 230 ? out.push(["bad", "Aceite", "El primer segmento pasa de 230 °C: el aceite se carboniza y los segmentos se pegan."]) : out.push(["ok", "Aceite", "Zona de segmentos a " + Th.Tring.toFixed(0) + " °C."]);
    vt.minC < 0 ? out.push(["bad", "Válvulas", "Tocan el pistón en el solape (" + (vt.minC * 1e3).toFixed(2) + " mm" + (vt.over > 0 ? ", y además flotan" : "") + "). Reduce el solape, la alzada o las revoluciones."]) : vt.over > 0 ? out.push(["bad", "Válvulas", "Flotan: la inercia supera al muelle por encima de " + Math.round(vt.floatRpm).toLocaleString("es") + " rpm."]) : out.push(["ok", "Válvulas", "Controladas hasta " + Math.round(vt.floatRpm).toLocaleString("es") + " rpm; holgura " + (vt.minC * 1e3).toFixed(1) + " mm."]);
    TR.tau > 220e6 ? out.push(["bad", "Cigüeñal", "A estas rpm hay resonancia torsional fuerte (" + (TR.tau / 1e6).toFixed(0) + " MPa)."]) : out.push(["ok", "Cigüeñal", "Torsional controlada."]);
    $("engVerdict").innerHTML = out.map(([s, t, d]) => `<div class="vd ${s}"><b>${t}</b><span>${d}</span></div>`).join("")
  }
  /* cursor del cilindro 1 sobre la gráfica de presión, sincronizado con el motor 3D */
  function cursor() {
    requestAnimationFrame(cursor);
    if (!res || document.hidden || !host.offsetParent || !LAB.engine3d || (frame = frame + 1) % 4 || !plots.p.last) return;
    const th = LAB.engine3d.angle(0), i = clamp(Math.round((th + 360) / 720 * res.C.N), 0, res.C.N - 1), [ser, o] = plots.p.last;
    plots.p.draw(ser, { ...o, points: [{ x: th, y: res.C.p[i] / 1e5, col: "#ffffff", r: 4 }] })
  }
  function init(el0) {
    host = el0;
    host.innerHTML = `
    <div class="labhead"><div><h2>Motor V6 1,6 turbo</h2><p class="sub">Ciclo termodinámico, fuerzas, tensiones, temperaturas y vibraciones de un motor híbrido de F1, calculados al momento.</p></div><div class="presets" id="engPre"></div></div>
    <div class="labgrid">
      <aside class="params" id="engParams"></aside>
      <section class="views">
        <div id="eng3d" class="e3host"></div>
        <div class="verdict vgrid" id="engVerdict"></div>
        <div class="ctrl adv"><button id="engCsv" class="btn">Exportar CSV del ciclo</button></div>
        <div class="readouts" id="engRo"></div>
        <div class="benchbox" id="engBench"></div>
        <div class="pgrid"><canvas id="engP"></canvas><canvas id="engF"></canvas><canvas id="engTq"></canvas><canvas id="engTh"></canvas></div>
        <h3>Química de la combustión</h3>
        <p class="sub chemsub">El combustible se define por su composición y todo lo demás se calcula: cuánto aire necesita, cuánta energía da, a qué temperatura arde y qué gases deja. Los gases quemados están en equilibrio químico (12 especies, con datos termodinámicos de la NASA) y el NO se forma con su propia cinética. Cada pieza está comprobada contra Cantera y contra medidas publicadas: mira la pestaña <b>Validación</b>.</p>
        <div class="chemgrid"><div class="kvcard" id="engFuel"></div><div class="compcard" id="engComp"></div></div>
        <div class="readouts" id="engRoX"></div>
        <div class="pgrid"><canvas id="engTz"></canvas><canvas id="engNO"></canvas><canvas id="engIgn"></canvas><canvas id="engLam"></canvas></div>
        <h3 class="adv">Ingeniería a fondo</h3>
        <div class="pgrid adv"><canvas id="engPV"></canvas><canvas id="engBrg"></canvas><canvas id="engVib"></canvas><canvas id="engCamp"></canvas><canvas id="engSw"></canvas><canvas id="engPw"></canvas></div>
      </section></div>`;
    prm = new Params($("engParams"), DEF, () => { clearTimeout(init.t), init.t = setTimeout(compute, 60) });
    for (const k in PRESETS) $("engPre").appendChild(el("button", { class: "btn", text: PRESETS[k].name, onclick: () => { prm.set(Object.fromEntries(DEF.flatMap(g => g.items.map(i => [i.id, i.v]))), !0), prm.set(PRESETS[k].v) } }));
    ro = new Readouts($("engRo"), [
      { id: "pw", label: "Potencia térmica", unit: "kW" }, { id: "cv", label: "Potencia", unit: "CV" }, { id: "tq", label: "Par medio", unit: "N·m" }, { id: "eta", label: "Rendimiento térmico", unit: "%" },
      { id: "pmax", label: "Presión máxima", unit: "bar" }, { id: "knock", label: "Detonación", unit: "" }, { id: "tp", label: "Corona del pistón", unit: "°C" }, { id: "tr", label: "Primer segmento", unit: "°C" },
      { id: "lam", label: "Lambda", unit: "", adv: !0 }, { id: "imep", label: "PMI", unit: "bar", adv: !0 }, { id: "bmep", label: "PME al freno", unit: "bar", adv: !0 }, { id: "fmep", label: "PME de fricción", unit: "bar", adv: !0 },
      { id: "thp", label: "Ángulo de presión máx.", unit: "° tras PMS", adv: !0 }, { id: "dp", label: "Gradiente de presión", unit: "bar/°", adv: !0 }, { id: "tg", label: "Temperatura máx. del gas", unit: "°C", adv: !0 },
      { id: "vp", label: "Velocidad media del pistón", unit: "m/s", adv: !0 }, { id: "ap", label: "Aceleración máx. del pistón", unit: "mil g", adv: !0 },
      { id: "crown", label: "Tensión en la corona", unit: "MPa", adv: !0 }, { id: "sfc", label: "Seguridad corona (Goodman)", unit: "", adv: !0 }, { id: "pin", label: "Flexión del bulón", unit: "MPa", adv: !0 },
      { id: "rodc", label: "Biela: compresión", unit: "MPa", adv: !0 }, { id: "rodt", label: "Biela: tracción", unit: "MPa", adv: !0 }, { id: "sfr", label: "Seguridad biela (fatiga)", unit: "" }, { id: "buck", label: "Seguridad al pandeo", unit: "", adv: !0 },
      { id: "brg", label: "Presión en cojinete de biela", unit: "MPa", adv: !0 }, { id: "tl", label: "Camisa (máx.)", unit: "°C" },
      { id: "ff", label: "Fuerza libre máx.", unit: "N", adv: !0 }, { id: "fm", label: "Momento libre máx.", unit: "N·m", adv: !0 }, { id: "tqr", label: "Rizado de par", unit: "N·m p-p", adv: !0 },
      { id: "f1", label: "1.er modo torsional", unit: "Hz", adv: !0 }, { id: "tau", label: "Tensión torsional", unit: "MPa" },
      { id: "vfl", label: "Las válvulas flotan a", unit: "rpm" }, { id: "vcl", label: "Holgura válvula-pistón", unit: "mm" }, { id: "vac", label: "Aceleración de válvula", unit: "g", adv: !0 },
      { id: "nt", label: "Turbo", unit: "rpm" }, { id: "mguh", label: "MGU-H (+ recupera)", unit: "kW" }, { id: "t2", label: "Aire tras el compresor", unit: "°C", adv: !0 }, { id: "egt", label: "Gas a la turbina", unit: "°C", adv: !0 }, { id: "wc", label: "Potencia del compresor", unit: "kW", adv: !0 }
    ]);
    roX = new Readouts($("engRoX"), [
      { id: "tad", label: "Llama adiabática al encender", unit: "°C", help: "Temperatura a la que quedaría la mezcla al arder a presión constante sin perder calor, con disociación." }, { id: "tbm", label: "Gas quemado, máximo", unit: "°C" }, { id: "no", label: "NO al abrir el escape", unit: "ppm", help: "Entre el gas quemado bien mezclado y sin mezclar: la realidad queda dentro." }, { id: "co2", label: "CO₂", unit: "kg/h" },
      { id: "tus", label: "Gas sin quemar al encender", unit: "°C", adv: !0 }, { id: "tcm", label: "Gas sin quemar, máximo", unit: "°C", adv: !0 }, { id: "tivc", label: "Carga al cerrar la admisión", unit: "°C", adv: !0, help: "El combustible, al evaporarse dentro, la enfría." }, { id: "xr", label: "Gases residuales", unit: "%", adv: !0 },
      { id: "nox", label: "NOx (como NO₂)", unit: "g/kWh", adv: !0 }, { id: "co2k", label: "CO₂ específico", unit: "g/kWh", adv: !0 }, { id: "o2", label: "O₂ en el escape", unit: "%", adv: !0 }, { id: "kint", label: "Integral de autoencendido", unit: "% del límite", help: "Livengood-Wu: al llegar al 100 % el gas sin quemar se inflama solo (detonación)." }
    ]);
    const mk = (k, id) => plots[k] = new Plot($(id));
    mk("tz", "engTz"), mk("no", "engNO"), mk("ign", "engIgn"), mk("lam", "engLam");
    mk("p", "engP"), mk("f", "engF"), mk("tq", "engTq"), mk("th", "engTh"), mk("pv", "engPV"), mk("brg", "engBrg"), mk("vib", "engVib"), mk("camp", "engCamp"), mk("sw", "engSw"), mk("pw", "engPw");
    $("engCsv").onclick = () => { const { C, F } = res, rows = []; for (let i = 0; i < C.N; i += 2) rows.push([C.th[i], C.p[i] / 1e5, C.T[i] - 273.15, C.Tu[i] - 273.15, C.Tb[i] > 0 ? C.Tb[i] - 273.15 : "", C.xb[i], res.X.noM[i] * 1e6, res.X.noU[i] * 1e6, C.vol[i] * 1e6, F.Fg[i], F.Fi[i], F.Fr[i], F.Fn[i], F.Tc[i]]); downloadCSV("ciclo_motor.csv", ["angulo_deg", "presion_bar", "T_media_C", "T_sin_quemar_C", "T_quemado_C", "fraccion_quemada", "NO_mezclado_ppm", "NO_sin_mezclar_ppm", "volumen_cm3", "F_gas_N", "F_inercia_N", "F_biela_N", "F_lateral_N", "par_cilindro_Nm"], rows) };
    window.addEventListener("labmode", () => setTimeout(() => { for (const p of Object.values(plots)) p.fit(); res && (drawStatic(), sweep()) }, 50));
    compute(), requestAnimationFrame(cursor)
  }
  return { init, VT, lift, _mat: MAT, _test: { cycle, forces, stresses, thermal, v6, torsion, torsResponse, valvetrain, turbo, chem, DEF: () => DEF, PRESETS: () => PRESETS, defaults: () => Object.fromEntries(DEF.flatMap(g => g.items.map(i => [i.id, i.v]))) } }
})();
