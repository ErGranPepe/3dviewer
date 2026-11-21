/* ===================== LABORATORIO DE MOTOR =====================
   V6 1,6 L turbo a 90° (tipo F1 2014+): ciclo termodinámico de una zona con combustión de Wiebe y pérdidas de Woschni,
   detonación (integral de Livengood-Wu, correlación de Douaud-Eyzat), biela-manivela exacta, fuerzas y tensiones en pistón,
   bulón y biela con seguridad a fatiga (Goodman) y pandeo, temperaturas de camisa / anillos / pistón, fuerzas y momentos
   libres del V6, y vibración torsional del cigüeñal (frecuencias propias, diagrama de Campbell y respuesta forzada). */
LAB.engine = (() => {
  const R = 287, LHV = 43e6, AFR = 14.6, NC = 6;
  const MAT = {
    steel: { name: "Acero 4340 / 300M", E: 205e9, Su: 1900e6, Se: 700e6, rho: 7850, k: 40, Tmax: 480 },
    al2618: { name: "Aluminio 2618 forjado", E: 72e9, Su: 380e6, Se: 110e6, rho: 2760, k: 150, Tmax: 300 },
    ti64: { name: "Titanio Ti-6Al-4V", E: 114e9, Su: 1000e6, Se: 520e6, rho: 4430, k: 7, Tmax: 400 },
    mmc: { name: "Compuesto Al-SiC (MMC)", E: 115e9, Su: 450e6, Se: 160e6, rho: 2900, k: 160, Tmax: 330 }
  };
  const FIRE = [0, 3, 1, 4, 2, 5]; /* orden de encendido 1-4-2-5-3-6 (índices de cilindro) */

  /* ---------- ciclo de un cilindro ---------- */
  function cycle(P, rpmOverride) {
    const rpm = rpmOverride || P.rpm, w = rpm / 60 * TAU, B = P.bore / 1e3, S = P.stroke / 1e3, r = S / 2, l = P.rod / 1e3, lam = r / l;
    const Ap = Math.PI / 4 * B * B, Vd = Ap * S, Vc = Vd / (P.cr - 1), Sp = 2 * S * rpm / 60;
    const xPis = th => r * (1 - Math.cos(th)) + l * (1 - Math.sqrt(1 - lam * lam * Math.sin(th) ** 2));
    const V = th => Vc + Ap * xPis(th);
    const N = 2880, dth = 720 / N * DEG;
    const th = new Float32Array(N), p = new Float32Array(N), T = new Float32Array(N), xb = new Float32Array(N), hg = new Float32Array(N), vol = new Float32Array(N), pm = new Float32Array(N), qrel = new Float32Array(N);
    const pim = P.boost * 1e5, Tim = P.tim + 273.15, pex = P.pexh * 1e5;
    /* masa atrapada: aire + residuales */
    const ivc = (-180 + P.ivc) * DEG, evo = (180 - P.evo) * DEG, soc = P.soc * DEG, dur = P.dur * DEG;
    const Vivc = V(ivc), mAir = P.ve / 100 * pim * Vd / (R * Tim), mRes = .03 * mAir;
    const fuelKgh = P.fflim === "si" ? Math.min(P.fuel, .009 * rpm + 5.5) : P.fuel, mfFlow = fuelKgh / 3600 / (rpm / 120 * NC), mfAir = mAir / (AFR * Math.max(.6, P.lambdaMin));
    const mf = Math.min(mfFlow, mfAir), lambda = mAir / (mf * AFR), Q = mf * LHV * P.etac / 100, m = mAir + mRes + mf;
    const Tivc = (pim * Vivc) / ((mAir + mRes) * R);
    let pp = pim, TT = Tim, qsum = 0, qw = 0, ki = 0, knockAt = null, Wnet = 0, Wpump = 0, Qwl = 0, prevV = V(-Math.PI * 2 / 2 * 2);
    const Bm = B, Tw = P.twall + 273.15;
    const ign = 1;
    for (let i = 0; i < N; i++) {
      const a = -Math.PI * 2 + i * dth, Vi = V(a), dV = V(a + dth) - Vi;
      th[i] = a / DEG, vol[i] = Vi;
      if (a < ivc) { pp = pim * (1 - .03 * Math.sin(Math.max(0, a + Math.PI * 2) / (Math.PI) * Math.PI)), TT = Tim; pm[i] = pp }
      else if (a < evo) {
        /* fase cerrada: primer principio con Wiebe y Woschni */
        const u = (a - soc) / dur, x = u <= 0 ? 0 : 1 - Math.exp(-P.wa * Math.pow(Math.min(u, 3), P.wm + 1));
        const un = (a + dth - soc) / dur, x2 = un <= 0 ? 0 : 1 - Math.exp(-P.wa * Math.pow(Math.min(un, 3), P.wm + 1));
        const dQ = Q * (x2 - x);
        const g = clamp(1.395 - 8.5e-5 * (TT - 300), 1.25, 1.4);
        const pmot = pim * Math.pow(Vivc / Vi, 1.36);
        const wgas = 2.28 * Sp + (a > soc ? 3.24e-3 * (Vd * Tivc / (pim * Vivc)) * Math.max(0, pp - pmot) : 0);
        const h = P.woschni / 100 * 3.26 * Math.pow(Bm, -.2) * Math.pow(pp / 1e3, .8) * Math.pow(TT, -.55) * Math.pow(wgas, .8);
        const Aw = 2 * Ap * 1.1 + Math.PI * Bm * (Vi - Vc) / Ap;
        const dQw = h * Aw * (TT - Tw) * (dth / w);
        const dp = (g - 1) / Vi * (dQ - dQw) - g * pp / Vi * dV;
        pp = Math.max(1e4, pp + dp), TT = pp * (Vi + dV) / (m * R), qsum += dQ, qw += dQw, Qwl += dQw;
        hg[i] = h, xb[i] = x, pm[i] = pmot, qrel[i] = dQ / dth * DEG;
        /* detonación: gas sin quemar comprimido politrópicamente; Douaud-Eyzat con el octanaje */
        if (a > ivc && x < .98 && knockAt === null) {
          const Tu = Tivc * Math.pow(pp / pim, (1.32 - 1) / 1.32), patm = pp / 101325, tau = 17.68e-3 * Math.pow(P.ron / 100, 3.402) * Math.pow(patm, -1.7) * Math.exp(3800 / Tu) * Math.pow(Math.max(.7, lambda), 1.6) * (P.tji === "si" ? 5 : 1);
          ki += dth / w / tau;
          ki >= 1 && x < .9 && a > soc && (knockAt = a / DEG)
        }
      } else {
        /* escape: descarga libre y luego empuje a contrapresión */
        const k = Math.min(1, (a - evo) / (60 * DEG));
        pp = pp + (pex - pp) * Math.min(1, .035 * 4), TT = TT * Math.pow(pp / Math.max(pp, 1), 0), xb[i] = 1, pm[i] = pex;
        if (a > Math.PI * 2 - 15 * DEG) pp = lerp(pp, pim, .05)
      }
      p[i] = pp, T[i] = a < ivc ? Tim : TT, xb[i] ||= a >= evo ? 1 : 0;
      Wnet += pp * dV, a > Math.PI || a < -Math.PI ? Wpump += pp * dV : 0
    }
    /* rendimiento */
    const imepN = Wnet / Vd, pmax = Math.max(...p), Spm = Sp;
    let dpmax = 0, imax = 0;
    for (let i = 1; i < N; i++) { const d = (p[i] - p[i - 1]) / 1e5 / (720 / N); d > dpmax && (dpmax = d); p[i] > p[imax] && (imax = i) }
    const fmep = (P.fric / 100) * (.25 + .004 * pmax / 1e5 + .09 * Spm + .0009 * Spm * Spm) * 1e5;
    const bmep = imepN - fmep, Pb = bmep * Vd * NC * rpm / 120, Pi = imepN * Vd * NC * rpm / 120, Tq = Pb / w;
    const etaB = Pb / (mf * NC * rpm / 120 * LHV), etaI = Pi / (mf * NC * rpm / 120 * LHV);
    return { fuelKgh, rpm, w, B, S, r, l, lam, Ap, Vd, Vc, Sp, N, dth, th, p, T, xb, hg, vol, pm, qrel, xPis, V, mAir, mf, lambda, Q, imep: imepN, fmep, bmep, Pb, Pi, Tq, etaB, etaI, pmax, thPmax: th[imax], dpmax, Tmax: Math.max(...T), knockAt, ki, qw: Qwl, Tivc, Tw }
  }

  /* ---------- fuerzas en un cilindro ---------- */
  function forces(P, C) {
    const N = C.N, w = C.w, r = C.r, l = C.l, lam = C.lam, mPis = P.mpis / 1e3, mRod = P.mrod / 1e3, fr = P.rodcg, mRec = mPis + mRod * fr, mRotRod = mRod * (1 - fr), pcc = P.pcc * 1e5;
    const Fg = new Float32Array(N), Fi = new Float32Array(N), Fr = new Float32Array(N), Fn = new Float32Array(N), Tc = new Float32Array(N), acc = new Float32Array(N), vel = new Float32Array(N), bx = new Float32Array(N), by = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const a = C.th[i] * DEG, s = Math.sin(a), c = Math.cos(a), q = Math.sqrt(1 - lam * lam * s * s);
      const v = r * w * (s + lam * s * c / q), ac = r * w * w * (c + lam * (Math.cos(2 * a) + Math.pow(lam * s, 4)) / Math.pow(q, 3));
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
        const acc = C.r * C.w ** 2 * (co + C.lam * (Math.cos(2 * th) + Math.pow(C.lam * s, 4)) / q ** 3);
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
  /* turbo: compresor (rendimiento 78 %), velocidad por coeficiente de trabajo, turbina con la entalpía del escape */
  function turbo(P, C) {
    const mdot = C.mAir * NC * C.rpm / 120, T1 = 298, PR = P.boost * 1.06 / .98, k = .2857;
    const T2 = T1 * (1 + (Math.pow(PR, k) - 1) / .78), Wc = mdot * 1005 * (T2 - T1), U = Math.sqrt(1005 * T1 * (Math.pow(PR, k) - 1) / .55), Nt = U / .046 * 60 / TAU;
    const iE = Math.round((180 - P.evo + 360) / 720 * C.N), T3 = C.T[iE] * Math.pow(Math.min(1, P.pexh * 1e5 / C.p[iE]), .3 / 1.3) * 1.08;
    const mex = mdot * (1 + 1 / (C.lambda * AFR)), ER = Math.max(1.01, P.pexh / 1.05), Wt = mex * 1150 * T3 * .8 * (1 - Math.pow(1 / ER, .3 / 1.3));
    return { mdot, PR, T2, Wc, Nt, T3, Wt, Wh: Wt - Wc }
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
      { id: "dur", label: "Duración de la combustión", unit: "°", min: 10, max: 80, step: 1, v: 40 },
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
  let host, prm, plots = {}, ro, res = null, e3 = 0, frame = 0;
  function compute() {
    const P = prm.v, C = cycle(P), F = forces(P, C), Sx = stresses(P, C, F), Th = thermal(P, C), V6 = v6(P, C, F), TS = torsion(P, C, F), TR = torsResponse(P, TS, C, F, P.rpm);
    res = { P, C, F, Sx, Th, V6, TS, TR, VT: valvetrain(P, C, P.rpm), TB: turbo(P, C), MK: { ratio: 50000 / 15000 } };
    drawStatic(), readouts(), sweep();
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
  function sweep() {
    clearTimeout(sweep.t), sweep.t = setTimeout(() => {
      const P = res.P, xs = [], tau = [], pw = [];
      for (let rpm = 4000; rpm <= 15000; rpm += 250) {
        const C = cycle(P, rpm), F = forces(P, C), TR = torsResponse(P, res.TS, C, F, rpm);
        xs.push(rpm), tau.push(TR.tau / 1e6), pw.push(C.Pb / 1e3)
      }
      const x = Float32Array.from(xs);
      plots.sw.draw([{ x, y: Float32Array.from(tau), n: xs.length, col: "#ff3b3b", label: "Tensión torsional en el apoyo (MPa)" }], { title: "Barrido de revoluciones: torsional", xlabel: "rpm", ymin: 0, vlines: [{ x: P.rpm, col: "rgba(255,255,255,.4)" }] });
      plots.pw.draw([{ x, y: Float32Array.from(pw), n: xs.length, col: "#2fd16c", label: "Potencia al freno (kW)" }], { title: "Curva de potencia del motor térmico", xlabel: "rpm", ymin: 0, vlines: [{ x: P.rpm, col: "rgba(255,255,255,.4)" }] })
    }, 160)
  }
  function readouts() {
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
        <div class="pgrid"><canvas id="engP"></canvas><canvas id="engF"></canvas><canvas id="engTq"></canvas><canvas id="engTh"></canvas></div>
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
    const mk = (k, id) => plots[k] = new Plot($(id));
    mk("p", "engP"), mk("f", "engF"), mk("tq", "engTq"), mk("th", "engTh"), mk("pv", "engPV"), mk("brg", "engBrg"), mk("vib", "engVib"), mk("camp", "engCamp"), mk("sw", "engSw"), mk("pw", "engPw");
    $("engCsv").onclick = () => { const { C, F } = res, rows = []; for (let i = 0; i < C.N; i += 2) rows.push([C.th[i], C.p[i] / 1e5, C.T[i] - 273.15, C.xb[i], C.vol[i] * 1e6, F.Fg[i], F.Fi[i], F.Fr[i], F.Fn[i], F.Tc[i]]); downloadCSV("ciclo_motor.csv", ["angulo_deg", "presion_bar", "T_gas_C", "fraccion_quemada", "volumen_cm3", "F_gas_N", "F_inercia_N", "F_biela_N", "F_lateral_N", "par_cilindro_Nm"], rows) };
    window.addEventListener("labmode", () => setTimeout(() => { for (const p of Object.values(plots)) p.fit(); res && (drawStatic(), sweep()) }, 50));
    compute(), requestAnimationFrame(cursor)
  }
  return { init, VT, lift, _mat: MAT, _test: { cycle, forces, stresses, thermal, v6, torsion, torsResponse, valvetrain, turbo } }
})();
