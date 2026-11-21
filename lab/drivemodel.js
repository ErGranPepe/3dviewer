/* ===================== TRANSMISIÓN Y ERS: MODELO =====================
   Vuelta cuasiestacionaria por distancia (1 m) con límite de adherencia con carga aerodinámica, potencia del motor
   térmico y del MGU-K según reglamento (2014-2025: 120 kW, 2 MJ de recuperación y 4 MJ de despliegue por vuelta, MGU-H
   sin límite; 2026: 350 kW con corte progresivo de 290 a 355 km/h, 8,5 MJ de recuperación por vuelta, sin MGU-H) y
   ventana de carga de la batería de 4 MJ. Encima, la línea motriz en torsión a 4 kHz: inercia del motor y la caja, palieres
   como muelle torsional, ruedas con la rigidez de deslizamiento del neumático y cambio sin interrupción de par (los dos
   piñones engranados unos milisegundos, el motor obligado a bajar de vueltas por la caja: el «golpe» del cambio).
   Engranajes: flexión en la raíz por Lewis y presión de contacto de Hertz, daño de Miner con curvas S-N (Basquin).
   Diferencial hidráulico: precarga más rampas de tracción y retención, reparto de par, momento de guiñada y patinaje
   de la rueda interior por transferencia lateral de carga. */
LAB.drivemodel = (() => {
  const G0 = 9.81, RHO = 1.2;
  /* trazados simplificados [longitud m, radio m (0 = recta)], escalados a su longitud real */
  const TRACKS = {
    monza: { name: "Monza", L: 5793, seg: [[860, 0], [30, 20], [40, 25], [560, 0], [360, 330], [550, 0], [30, 35], [40, 40], [250, 0], [130, 90], [150, 0], [110, 75], [900, 0], [35, 40], [45, 45], [150, 250], [1000, 0], [340, 130], [250, 0]] },
    monaco: { name: "Mónaco", L: 3337, seg: [[180, 0], [60, 40], [400, 0], [120, 180], [100, 60], [150, 0], [60, 18], [80, 0], [40, 9], [100, 0], [40, 22], [60, 30], [650, 0], [40, 25], [40, 30], [300, 0], [60, 45], [150, 0], [40, 40], [40, 40], [60, 0], [30, 30], [30, 30], [150, 0], [40, 18], [60, 0], [40, 20], [220, 0]] },
    silverstone: { name: "Silverstone", L: 5891, seg: [[350, 0], [150, 120], [130, 90], [300, 0], [60, 25], [60, 20], [100, 40], [700, 0], [100, 60], [100, 45], [150, 80], [700, 0], [150, 150], [200, 0], [110, 250], [90, 180], [110, 130], [80, 90], [800, 0], [90, 110], [350, 0], [50, 45], [80, 40], [300, 0]] }
  };
  /* radio con signo (+ izquierda) alternando sentidos para el diferencial */
  function trackGrid(key) {
    const T = TRACKS[key] || TRACKS.monza, sum = T.seg.reduce((a, s) => a + s[0], 0), k = T.L / sum, n = Math.round(T.L), R = new Float32Array(n);
    let s = 0, dir = 1;
    for (const [l, r] of T.seg) { const m = Math.round(l * k); for (let i = 0; i < m && s < n; i++) R[s++] = r ? r * dir : 0; r && (dir = -dir) }
    for (; s < n; s++) R[s] = 0;
    return { n, R, name: T.name }
  }
  /* límites de potencia del MGU-K según velocidad */
  function kLimit(P, v) {
    const kmh = v * 3.6;
    if (P.era === "2026") {
      const vEnd = 355, vStart = P.override ? 337 : 290;
      return P.kmax * 1e3 * clamp((vEnd - kmh) / (vEnd - vStart), 0, 1)
    }
    return P.kmax * 1e3
  }
  function ratios(P) { return [P.g1, P.g2, P.g3, P.g4, P.g5, P.g6, P.g7, P.g8] }
  function gearFor(P, v, gPrev) {
    const rs = ratios(P), w = v / P.rt, up = P.rpmShift * TAU / 60;
    for (let g = 0; g < 8; g++) if (w * rs[g] * P.fd <= up || g === 7) return g;
    return 7
  }
  /* ---------- vuelta ---------- */
  function lap(P, opt = {}) {
    const tg = trackGrid(P.track), n = tg.n, m = P.mass, ClA = P.cla, CdA0 = P.cda, mu = P.mu;
    const noERS = opt.noERS, laps = 3;
    const vlim = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const R = Math.abs(tg.R[i]);
      if (!R) { vlim[i] = 120; continue }
      const den = 1 - mu * RHO * ClA * R / (2 * m);
      vlim[i] = den > .02 ? Math.min(120, Math.sqrt(mu * G0 * R / den)) : 120
    }
    /* suavizado de los límites (una curva no es un punto) y envolvente de frenada hacia atrás */
    const vb = vlim.slice();
    for (let pass = 0; pass < 2; pass++) for (let j = n * 2 - 1; j >= 0; j--) {
      const i = j % n, i1 = (i + 1) % n, v1 = vb[i1], DF = .5 * RHO * ClA * v1 * v1, D = .5 * RHO * CdA0 * v1 * v1, a = (P.mub * (m * G0 + DF) + D) / m;
      vb[i] = Math.min(vb[i], Math.sqrt(v1 * v1 + 2 * a))
    }
    const out = { n, R: tg.R, name: tg.name, v: new Float32Array(n), t: new Float32Array(n), gear: new Uint8Array(n), rpm: new Float32Array(n), Pice: new Float32Array(n), Pk: new Float32Array(n), Ph: new Float32Array(n), soc: new Float32Array(n), Teng: new Float32Array(n), ax: new Float32Array(n), ay: new Float32Array(n), brake: new Uint8Array(n), Fx: new Float32Array(n) };
    let v = 40, soc = P.soc0 * 1e6, t = 0, gear = gearFor(P, 40), clipArm = 0, clipOn = 0;
    const SOCMAX = P.socwin * 1e6, old = P.era !== "2026", eta = .95 * .97;
    let E = null;
    for (let L = 0; L < laps; L++) {
      E = { recK: 0, recH: 0, dep: 0, depES: 0, clip: 0, brakeE: 0, shifts: 0, fuel: 0, socMin: SOCMAX, socMax: 0 };
      t = 0;
      for (let i = 0; i < n; i++) {
        const DF = .5 * RHO * ClA * v * v, straight = !tg.R[i], aero = !old && P.activeAero && straight && v > 50, CdA = aero ? CdA0 * .72 : CdA0, D = .5 * RHO * CdA * v * v;
        /* cambio con histéresis: sube al régimen de cambio y baja cuando la marcha inferior queda 900 rpm por debajo */
        const rsx = ratios(P), wsh = P.rpmShift * TAU / 60, w0 = v / P.rt;
        let g = gear;
        for (; g < 7 && w0 * rsx[g] * P.fd > wsh;) g++;
        for (; g > 0 && w0 * rsx[g - 1] * P.fd < wsh - 900 * TAU / 60;) g--;
        const G = rsx[g] * P.fd, we = w0 * G;
        g !== gear && (E.shifts++, gear = g);
        /* motor térmico: par limitado abajo, potencia constante arriba (límite de flujo de combustible) */
        const Pice = Math.min(P.pice * 1e3, P.tmax * we);
        /* MGU-K disponible: de la batería y, hasta 2025, directamente del MGU-H */
        let pkA = 0, phA = 0, clip = 0;
        if (!noERS) {
          const lim = kLimit(P, v), want = P.strat === "save" ? .55 : P.strat === "bal" ? (v < 75 ? 1 : .7) : 1;
          /* 2026: en recta y por encima de la velocidad de recorte, parte de la potencia del térmico carga la batería */
          /* histéresis: en ataque solo carga cuando la batería baja del 25 % y deja de hacerlo al pasar del 50 % */
          P.strat === "att" && (soc < SOCMAX * .25 ? clipArm = 1 : soc > SOCMAX * .5 && (clipArm = 0));
          /* una vez empieza a recortar en una recta sigue hasta el final de esa recta (sin conmutar con la velocidad) */
          straight ? !old && v * 3.6 > P.clipKmh && (P.strat !== "att" || clipArm) && (clipOn = 1) : clipOn = 0;
          clip = clipOn && soc < SOCMAX * .95 && E.recK < P.rec * 1e6 ? P.clipKw * 1e3 : 0;
          if (!old) pkA = clip ? -clip : soc > 0 ? lim * want : 0;
          else phA = P.hmax * 1e3 * clamp((we - 7e3 * TAU / 60) / (4e3 * TAU / 60), 0, 1), pkA = Math.min(lim, (soc > 0 && E.depES < P.dep * 1e6 ? lim * want : 0) + phA)
        }
        /* tracción: eje trasero con su parte de la carga aerodinámica y la transferencia longitudinal al acelerar */
        const Ptot = (Pice + pkA) * P.etaD, aEst = Math.max(0, Ptot / Math.max(v, 5) / m), Ftr = P.mut * (m * G0 * P.rearW + .5 * DF * 1.08 + m * aEst * P.hcg / 3.6), Fp = Math.min(Ftr, Ptot / Math.max(v, 5)), aAcc = (Fp - D - P.crr * (m * G0 + DF)) / m;
        let v1 = Math.sqrt(Math.max(1, v * v + 2 * aAcc));
        const i1 = (i + 1) % n, cap = Math.min(vb[i1], vlim[i1]);
        let braking = 0;
        v1 > cap && (braking = 1, v1 = cap);
        const dt = 2 / (v + v1), a = (v1 * v1 - v * v) / 2;
        let pk = 0, ph = 0;
        if (!noERS && !braking) {
          const frac = clip ? 1 : clamp((a * m + D + P.crr * (m * G0 + DF)) * v / P.etaD / Math.max(1, Pice + pkA), 0, 1);
          pk = pkA * frac;
          if (old) {
            const fromH = Math.min(pk, phA), fromES = pk - fromH, spare = phA - fromH;
            ph = phA, E.recH += phA * dt, soc += spare * eta * dt - fromES / eta * dt, E.depES += fromES * dt
          } else if (clip) pk = -clip, E.clip += clip * dt, E.recK += clip * dt, soc += clip * eta * dt;
          else soc -= pk / eta * dt, E.depES += pk * dt;
          pk > 0 && (E.dep += pk * dt)
        } else if (!noERS && braking) {
          const Pbr = Math.max(0, -(a * m) - D) * v, pr = E.recK < P.rec * 1e6 && soc < SOCMAX ? Math.min(P.kmax * 1e3, Pbr * P.rearB) : 0;
          pk = -pr, E.recK += pr * dt, soc += pr * eta * dt, E.brakeE += Pbr * dt
        }
        soc = clamp(soc, 0, SOCMAX), E.socMin = Math.min(E.socMin, soc), E.socMax = Math.max(E.socMax, soc);
        E.fuel += (braking ? .04 : 1) * Pice / (.5 * 43e6) * dt;
        if (L === laps - 1) {
          out.v[i] = v, out.t[i] = t, out.gear[i] = g, out.rpm[i] = we * 60 / TAU, out.Pice[i] = braking ? 0 : Pice, out.Pk[i] = pk, out.Ph[i] = ph, out.soc[i] = soc;
          const wq = Math.max(we, 100);
          out.Teng[i] = braking ? -25 + pk / wq : (Pice * (clip ? 1 : clamp((a * m + D + P.crr * (m * G0 + DF)) * v / P.etaD / Math.max(1, Pice + pkA), 0, 1)) + pk) / wq;
          out.ax[i] = a / G0, out.ay[i] = tg.R[i] ? v * v / tg.R[i] / G0 : 0, out.brake[i] = braking, out.Fx[i] = braking ? 0 : m * a + D
        }
        t += dt, v = v1
      }
    }
    out.lapT = t, out.E = E, out.vmax = Math.max(...out.v);
    return out
  }
  /* ---------- línea motriz en torsión (4 kHz) ---------- */
  function driveline(P, Lp) {
    const dt = 1 / 4000, n = Lp.n, T = Lp.t[n - 1] + (Lp.t[n - 1] - Lp.t[n - 2]), N = Math.floor(T / dt), rs = ratios(P);
    const k = P.kds * 2, Ie = P.ie, Iw = P.iw * 2, Cs = P.cslip, R = P.rt;
    const keep = Math.ceil(N / 4), out = { dt: dt * 4, n: keep, dyn: new Float32Array(keep), Tds: new Float32Array(keep), we: new Float32Array(keep), slip: new Float32Array(keep), G: new Float32Array(keep), shifts: [] };
    /* interpolación de la vuelta en tiempo */
    let j = 0;
    const at = (arr, tt) => { for (; j < n - 2 && Lp.t[j + 1] < tt;) j++; const a = Lp.t[j], b = Lp.t[j + 1] || a + 1e-3, f = clamp((tt - a) / (b - a), 0, 1); return arr[j] + (arr[j + 1 < n ? j + 1 : j] - arr[j]) * f };
    let v = Lp.v[0], g = Lp.gear[0], G = rs[g] * P.fd, ww = v / R, we = ww * G, phi = 0, gPrev = g, ts = -1, Gfrom = G, Gto = G, peak = 0, peakShift = 0, TeF = Lp.Teng[0], cDS = 2 * P.zds * Math.sqrt(k * Ie * G * G);
    for (let s = 0; s < N; s++) {
      const tt = s * dt;
      j = Math.min(j, n - 2);
      v = Math.max(3, at(Lp.v, tt));
      const gi = Lp.gear[Math.min(n - 1, j + 1)];
      if (gi !== gPrev && ts < 0) { ts = 0, Gfrom = G, Gto = rs[gi] * P.fd, gPrev = gi, out.shifts.push({ t: tt, from: g, to: gi }), g = gi }
      /* durante el cambio la centralita sincroniza el motor: al subir corta encendido y el MGU-K frena el cigüeñal;
         al bajar da un golpe de gas (y en 2026 el MGU-K empuja). Lo que no consigue lo absorbe la transmisión. */
      /* el par pedido por el piloto y la centralita no da saltos: rampa de 25 kN·m/s en el cigüeñal */
      TeF += clamp(at(Lp.Teng, tt) - TeF, -25e3 * dt, 25e3 * dt);
      let Te = TeF;
      if (ts >= 0) {
        const up = Gto < Gfrom, Ts = (up ? 1 : 2.5) * P.tshift * 1e-3, f = clamp(ts / Ts, 0, 1), wq = Math.max(we, 100);
        G = Gfrom + (Gto - Gfrom) * f;
        const need = Ie * (ww * Gto - we) / Math.max(2e-3, Ts * (1 - f) + 2e-3), kT = P.kmax * 1e3 / wq;
        Te = up ? Te * (1 - P.cut) + clamp(need, -P.cut * (150 + kT + Te), 0) : Te + clamp(need, 0, P.blip * (P.tmax + kT));
        ts += dt, f >= 1 && (ts = -1, G = Gto)
      }
      cDS = 2 * P.zds * Math.sqrt(k * Ie * G * G);
      /* palieres: giro relativo φ (lado rueda) */
      const dphi = we / G - ww, Tds = k * phi + cDS * dphi;
      we += (Te - Tds / G) / Ie * dt;
      phi += (we / G - ww) * dt;
      /* rueda con el deslizamiento del neumático tratado implícito */
      const vr = Math.max(v, 3);
      ww = (Iw * ww + dt * (Tds + R * Cs * v / vr)) / (Iw + dt * R * R * Cs / vr);
      if (s % 4 === 0) { const q = s / 4; out.dyn[q] = Tds - TeF * G, out.Tds[q] = Tds, out.we[q] = we * 60 / TAU, out.slip[q] = (ww * R - v) / vr, out.G[q] = G }
      const a = Math.abs(Tds);
      a > peak && (peak = a), ts >= 0 && a > peakShift && (peakShift = a)
    }
    /* golpe de cada cambio: máximo respecto al par medio antes del cambio */
    for (const sh of out.shifts) {
      const q0 = Math.max(0, Math.floor((sh.t - .02) / out.dt)), q1 = Math.min(keep - 1, Math.floor((sh.t + .25) / out.dt));
      /* golpe = parte dinámica del par (lo que se aparta del par cuasiestático motor × relación) */
      let mx = 0;
      for (let q = q0; q <= q1; q++) mx = Math.max(mx, Math.abs(out.dyn[q]));
      sh.shock = mx, sh.base = out.Tds[q0]
    }
    out.peak = peak, out.peakShift = peakShift, out.fn = rs.map(r => Math.sqrt(k / (Ie * (r * P.fd) ** 2)) / TAU);
    return out
  }
  /* ---------- engranajes: Lewis, Hertz y Miner ---------- */
  function gears(P, Lp, D) {
    const rs = ratios(P), m = P.module * 1e-3, b = P.face * 1e-3, a = P.center * 1e-3, res = [];
    const Y = z => .484 - 2.87 / z;
    for (let g = 0; g < 8; g++) {
      const u = rs[g]; /* relación de la etapa de caja (la cónica aporta el resto) */
      const z1 = Math.max(12, Math.round(2 * a / m / (1 + u))), z2 = Math.round(2 * a / m) - z1, d1 = m * z1;
      res.push({ g, z1, z2, d1, u: z2 / z1, b: faceOf(P, g), sb: 0, sh: 0, Db: 0, Dh: 0, time: 0, maxT: 0 })
    }
    /* cargas a lo largo de la vuelta con el par real de los palieres */
    const dt = D.dt;
    for (let q = 0; q < D.n; q++) {
      const t = q * dt, i = Math.min(Lp.n - 1, Math.max(0, lowerIdx(Lp.t, t))), g = Lp.gear[i], r = res[g], G = D.G[q], Tin = Math.max(0, D.Tds[q] / G), rpm = D.we[q];
      const Ft = 2 * Tin / r.d1, Kv = 1.12, sb = Ft * Kv / (r.b * m * Y(r.z1)) / 1e6, sh = 189.8 * 2.49 * Math.sqrt(Ft * Kv / (r.b * r.d1) * (r.u + 1) / r.u) / 1e3;
      const cyc = rpm / 60 * dt;
      r.time += dt, r.maxT = Math.max(r.maxT, Tin), r.sb = Math.max(r.sb, sb), r.sh = Math.max(r.sh, sh);
      sb > 1 && (r.Db += cyc / (P.nb * Math.pow(P.sbLim / sb, P.kb))), sh > 1 && (r.Dh += cyc / (P.nh * Math.pow(P.shLim / sh, P.kh)))
    }
    const lapKm = Lp.n / 1e3;
    for (const r of res) r.lifeKm = Math.min(1e6, lapKm / Math.max(1e-12, Math.max(r.Db, r.Dh)));
    return res
  }
  /* las marchas cortas llevan más ancho de dentado (más par en la entrada) */
  function faceOf(P, g) { const rs = ratios(P), u1 = rs[0], u8 = rs[7]; return P.face * 1e-3 * (1 + .6 * clamp((rs[g] - u8) / Math.max(.01, u1 - u8), 0, 1)) }
  function lowerIdx(arr, t) { let lo = 0, hi = arr.length - 1; for (; hi - lo > 1;) { const m = (lo + hi) >> 1; arr[m] <= t ? lo = m : hi = m } return lo }
  /* ---------- diferencial ---------- */
  function diff(P, Lp, D) {
    const n = Lp.n, out = { TL: new Float32Array(n), TR: new Float32Array(n), Mz: new Float32Array(n), lock: new Float32Array(n), spin: new Uint8Array(n), dw: new Float32Array(n) };
    let spinN = 0, mzSumEntry = 0, nE = 0, mzSumExit = 0, nX = 0;
    for (let i = 0; i < n; i++) {
      const t = Lp.t[i], q = Math.min(D.n - 1, Math.floor(t / D.dt)), Tin = D.Tds[q], v = Lp.v[i], R = Lp.R[i];
      const dw = R ? v * P.tw / R / P.rt : 0; /* + si la derecha (exterior en curva a izq.) gira más */
      const cap = P.pre + (Tin >= 0 ? P.kpow : P.kcoast) * Math.abs(Tin);
      /* el embrague bloqueado transfiere hasta «cap» del lado rápido al lento; con dw≈0 queda abierto */
      const slipping = Math.abs(dw) > .05, dT = slipping ? cap * Math.sign(dw) * (Tin >= 0 ? 1 : 1) : 0;
      /* derecha (exterior, rápida) recibe menos: TR = Tin/2 - dT/2 */
      let TR = Tin / 2 - dT / 2, TL = Tin / 2 + dT / 2;
      /* rueda interior: carga con transferencia lateral */
      const ay = R ? v * v / R : 0, FzR = P.mass * G0 * P.rearW + .5 * RHO * P.cla * v * v * .5, dFz = P.mass * P.rearW * Math.abs(ay) * P.hcg / P.tw;
      const inner = R > 0 ? "L" : "R", FzIn = Math.max(0, FzR / 2 - dFz), capIn = P.mut * FzIn * P.rt, Tinner = inner === "L" ? TL : TR;
      const spin = R && Tin > 0 && Tinner > capIn;
      spin && spinN++;
      out.TL[i] = TL, out.TR[i] = TR, out.lock[i] = Math.abs(dT), out.spin[i] = spin ? 1 : 0, out.dw[i] = dw;
      /* momento de guiñada (+ a izquierdas) del reparto desigual */
      const Mz = (TR - TL) / P.rt * P.tw / 2;
      out.Mz[i] = Mz;
      if (R && Lp.brake[i]) mzSumEntry += Mz * Math.sign(R), nE++;
      else if (R && Tin > 0) mzSumExit += Mz * Math.sign(R), nX++
    }
    out.spinPct = spinN / n * 100, out.mzEntry = nE ? mzSumEntry / nE : 0, out.mzExit = nX ? mzSumExit / nX : 0;
    return out
  }
  function run(P) {
    const Lp = lap(P), L0 = lap(P, { noERS: !0 }), D = driveline(P, Lp), Gs = gears(P, Lp, D), Df = diff(P, Lp, D);
    return { Lp, D, Gs, Df, ersGain: L0.lapT - Lp.lapT, lap0: L0.lapT }
  }
  return { TRACKS, trackGrid, lap, driveline, gears, diff, run, kLimit, ratios, gearFor, lowerIdx, faceOf }
})();
