/* ===================== VALIDACIÓN =====================
   Banco de pruebas del Laboratorio: cada modelo se enfrenta a algo que no es él mismo —Cantera (referencia de la química de la
   combustión), soluciones analíticas de libro, principios de conservación o medidas publicadas— y se enseña el número de cada lado.
   Se ejecuta en el navegador de quien lo mira (y en las pruebas automáticas antes de publicar): nada de lo que sale aquí está escrito a
   mano salvo las referencias, que dicen de dónde vienen. Si algo se sale de su tolerancia, sale en rojo. */
LAB.validate = (() => {
  const nf = (v, d) => v.toFixed(d).replace(".", ",");
  const sig = (v, n = 5) => { if (!isFinite(v)) return "—"; const a = Math.abs(v); if (a === 0) return "0"; if (a >= 1e6 || a < 1e-3) { const [m, e] = v.toExponential(Math.min(n, 4) - 1).split("e"); return m.replace(".", ",") + "·10" + (+e).toString().replace(/[-\d]/g, c => "⁻⁰¹²³⁴⁵⁶⁷⁸⁹"["-0123456789".indexOf(c)]) } return nf(v, Math.max(0, Math.min(8, n - 1 - Math.floor(Math.log10(a))))) };
  /* fila con error relativo (%), con error absoluto, y fila cuyo valor debe quedar por debajo de un tope */
  const rel = (k, v, r, tol, u = "", n = 5, o) => ({ k, lab: sig(v, n) + u, ref: sig(r, n) + u, err: (v / r - 1) * 100, eu: " %", tol, ...o });
  const abs = (k, v, r, tol, u = "", n = 5, o) => ({ k, lab: sig(v, n) + u, ref: sig(r, n) + u, err: v - r, eu: u, tol, ...o });
  const top = (k, v, tol, u, ref, n = 3) => ({ k, lab: sig(v, n) + u, ref, err: v, eu: u, tol, cap: !0 });
  const rnd = seed => () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const SRC = {
    cantera: ["Cantera 3.2 (cantera.org), con los mismos datos termodinámicos de NASA Glenn", "https://cantera.org"],
    guibet: ["J.-C. Guibet, «Carburants et moteurs» (IFP): tabla de poderes caloríficos", "https://www.chemeurope.com/en/encyclopedia/Heat_of_combustion.html"],
    gri: ["GRI-Mech 3.0 (Smith et al.): 53 especies y 325 reacciones", "http://combustion.berkeley.edu/gri-mech/version30/text30.html"],
    he: ["He et al., Combustion and Flame 142 (2005) 266-275: retrasos medidos en máquina de compresión rápida", "https://public.websites.umich.edu/~mswool/publications/official_iso-octane_reprint_reprint.pdf"],
    yoo: ["Yoo, Luo, Lu, Kim y Chen, Proc. Combust. Inst. 34 (2013): mecanismo de 143 especies del isooctano", "https://doi.org/10.1016/j.proci.2012.05.019"],
    fia: LAB.SRC && LAB.SRC.fia22
  };
  const G = [];
  const E = () => LAB.engine._test, CH = () => LAB.chem;

  /* ---------- 1. equilibrio químico ---------- */
  G.push({ id: "eq", title: "Equilibrio químico de la combustión", vs: "Cantera", src: [SRC.cantera],
    how: "Temperatura de llama y composición de los gases quemados (12 especies) por minimización de la energía de Gibbs. Referencia: los mismos casos resueltos con Cantera, el programa de código abierto que usan los laboratorios de combustión.",
    run() {
      const C = CH(), R = LAB.chemRef, out = [];
      for (const c of R.cases) {
        const re = C.reactants(C.fuelOf(c.fuel), c.lam, c.n2 == null ? void 0 : c.n2), e = c.mode === "TP" ? C.eq(c.T0, c.P0, C.elements(re)) : C.flame(re, c.T0, c.P0, c.mode === "UV");
        let w = 0, n = 0;
        for (const k in c.X) c.X[k] > 1e-7 && (n++, w = Math.max(w, Math.abs(e.X[k] / c.X[k] - 1) * 100));
        w = Math.max(w, Math.abs(C.uMix(e.n, e.T) - c.u) / 1e6 * 100, Math.abs(C.sMix(e.n, e.T, e.P) / c.s - 1) * 100, Math.abs(e.M / c.M - 1) * 100);
        c.mode === "TP" || out.push(abs(c.name + ": temperatura", e.T, c.T, .5, " K", 6));
        c.mode === "UV" && out.push(rel(c.name + ": presión", e.P / 1e5, c.P / 1e5, .01, " bar", 6));
        out.push(top(c.name + ": composición, energía, entropía y masa molar", w, .01, " %", "las " + n + " especies por encima de 0,1 ppm, u, s y M de Cantera"))
      }
      return out
    } });

  /* ---------- 2. combustible ---------- */
  G.push({ id: "fuel", title: "Combustible y aire", vs: "Cantera y tablas publicadas", src: [SRC.cantera, SRC.guibet],
    how: "El poder calorífico no es un número puesto a mano: sale de las entalpías de formación de cada componente. Se comprueba contra Cantera (fase gas) y contra la tabla de Guibet (líquidos a 25 °C). Las propiedades de la mezcla sustituta se recalculan aparte, en Python.",
    run() {
      const C = CH(), R = LAB.chemRef, D = LAB.chemData, T0 = 298.15, out = [], nm = { CH4: "metano", H2: "hidrógeno", IC8H18: "isooctano", NC7H16: "n-heptano", C7H8: "tolueno", C2H5OH: "etanol" };
      for (const f in R.lhv) { const F = C.fuelOf({ [f]: 1 }), lhv = C.hMix(F.n, T0) + F.o2 * C.hRT(D.O2, T0) * C.Ru * T0 - (F.C * C.hRT(D.CO2, T0) + F.H / 2 * C.hRT(D.H2O, T0)) * C.Ru * T0; out.push(rel("Poder calorífico inferior del " + nm[f] + " (gas)", lhv / 1e6, R.lhv[f] / 1e6, .001, " MJ/kg", 6)) }
      for (const [k, r] of [["IC8H18", 44.310], ["NC7H16", 44.566], ["C7H8", 40.589]]) out.push(rel("Poder calorífico inferior del " + nm[k] + " líquido", C.fuel({ [k]: 1 }).lhv / 1e6, r, .5, " MJ/kg", 5, { s: 2 }));
      const F = C.fuel(), r = R.fuel;
      out.push(rel("Gasolina E10 sustituta: poder calorífico inferior", F.lhv / 1e6, r.lhv / 1e6, 1e-6, " MJ/kg", 6), rel("Gasolina E10 sustituta: aire estequiométrico", F.afr, r.afr, 1e-6, " kg/kg", 6), rel("Gasolina E10 sustituta: relación hidrógeno/carbono", F.hc, r.hc, 1e-6, "", 6), rel("Gasolina E10 sustituta: oxígeno en masa", F.oxy * 100, r.oxy * 100, 1e-6, " %", 5), rel("Gasolina E10 sustituta: CO₂ por kg quemado", F.co2, r.co2, 1e-6, " kg", 6));
      out.push(rel("Masa molar del aire seco", C.air().M * 1e3, 28.9647, .02, " g/mol", 6, { note: "valor normalizado; la diferencia es el CO₂ de hoy (420 ppm)" }));
      return out
    } });

  /* ---------- 3. procesos con gases reales ---------- */
  G.push({ id: "proc", title: "Compresión, combustión y expansión con gases reales", vs: "Cantera", src: [SRC.cantera],
    how: "Ciclo Otto ideal con la gasolina E10: compresión isentrópica de la mezcla (cp variable), combustión a volumen constante con disociación y expansión con el equilibrio desplazándose. Y los saltos isentrópicos del compresor (aire) y de la turbina (gas de escape). Es la misma maquinaria que usa el ciclo del motor.",
    run() {
      const C = CH(), R = LAB.chemRef, F = C.fuel(), out = [];
      for (const o of R.otto) { const r = C.otto(F, o.lam, o.T1, o.p1, o.r), n = "Otto " + o.name.replace("E10, ", "") + ": "; out.push(abs(n + "fin de compresión", r.T2, o.T2, .05, " K", 6), abs(n + "fin de combustión", r.T3, o.T3, .05, " K", 6), rel(n + "presión máxima", r.p3 / 1e5, o.p3 / 1e5, .001, " bar", 6), abs(n + "fin de expansión", r.T4, o.T4, .05, " K", 6), abs(n + "rendimiento", r.eta * 100, o.eta * 100, .001, " %", 5)) }
      { const t = R.turb, g = C.gas(C.eq(t.T3, t.p3, C.elements(C.reactants(F, t.lam))).n), T4 = g.Tisen(t.T3, t.p3, t.p4); out.push(abs("Turbina, de 1200 K y 3 bar a 1,05 bar: temperatura de salida", T4, t.T4, .01, " K", 6), rel("Turbina: salto de entalpía", (g.h(t.T3) - g.h(T4)) / 1e3, t.dh / 1e3, .001, " kJ/kg", 6)) }
      { const c = R.comp, g = C.air(), T2 = g.Tisen(c.T1, c.p1, c.p2); out.push(abs("Compresor, de 25 °C y 1 bar a 3,8 bar: temperatura de salida", T2, c.T2, .01, " K", 6), rel("Compresor: salto de entalpía", (g.h(T2) - g.h(c.T1)) / 1e3, c.dh / 1e3, .001, " kJ/kg", 6)) }
      return out
    } });

  /* ---------- 4. NO ---------- */
  G.push({ id: "no", title: "Formación de NO fuera del equilibrio", vs: "mecanismo detallado GRI-Mech 3.0", src: [SRC.gri, SRC.cantera],
    how: "El Laboratorio usa el mecanismo de Zeldovich ampliado (3 reacciones) con las constantes de GRI-Mech 3.0. La referencia es el mecanismo completo integrado con Cantera en gas quemado a temperatura y presión fijas. El completo incluye además la vía del N₂O, que el de Zeldovich no tiene: por eso este da en torno a un 20-30 % menos al principio, y se admite hasta un 35 %.",
    run() {
      const C = CH(), R = LAB.chemRef, out = [];
      for (const n of R.no) {
        const e = C.eq(n.T, n.P, C.elements(C.reactants(C.fuelOf({ CH4: 1 }), n.lam, 3.76))), tag = sig(n.T, 4) + " K, " + sig(n.P / 1e5, 3) + " bar, λ " + sig(n.lam, 2);
        let y = 0, t = 0;
        n.t.forEach((tt, i) => { for (let q = 0, dt = (tt - t) / 400; q < 400; q++) y = C.noStep(e, y, dt); t = tt; (i === 1 || i === 3) && out.push(rel("NO a los " + sig(tt * 1e3, 2) + " ms (" + tag + ")", y * 1e6, n.X[i] * 1e6, 35, " ppm", 4)) });
        for (let q = 0; q < 4000; q++) y = C.noStep(e, y, 5e-3);
        out.push(rel("NO de equilibrio (" + tag + ")", e.X.NO * 1e6, n.Xeq * 1e6, 1, " ppm", 5), top("Cinética a tiempo largo frente a su propio equilibrio (" + tag + ")", Math.abs(y / e.X.NO - 1) * 100, .01, " %", "debe acabar en el equilibrio"))
      }
      return out
    } });

  /* ---------- 5. autoencendido ---------- */
  G.push({ id: "ign", title: "Retraso de autoencendido (detonación)", vs: "medidas de laboratorio", src: [SRC.he, SRC.yoo, SRC.cantera],
    how: "La detonación se predice con el tiempo que tarda en autoinflamarse el gas sin quemar. Ese tiempo sale de una tabla calculada con Cantera y un mecanismo de 143 especies para el isooctano (octano 100). Primero, el mecanismo frente a retrasos medidos en una máquina de compresión rápida (calculado fuera, con las mezclas exactas del ensayo; los autores dan ±12 % de incertidumbre en la medida). Después, la interpolación de la tabla frente al cálculo directo.",
    run() {
      const C = CH(), K = LAB.knockData, out = [];
      for (const h of K.he) out.push(rel("Medido: φ " + sig(h.phi, 2) + ", " + sig(h.P, 3) + " atm, " + h.T + " K", h.calc, h.meas, 30, " ms", 3, { s: 1, labNote: "calculado con el mecanismo" }));
      for (const o of K.off) out.push(rel("Tabla interpolada: " + sig(o.T, 4) + " K, " + sig(o.p / 1e5, 3) + " bar, φ " + sig(o.phi, 2), C.tauIgn(o.T, o.p, o.phi) * 1e3, o.tau * 1e3, 8, " ms", 4, { s: 2 }));
      return out
    } });

  /* ---------- 6. tabla del gas quemado ---------- */
  G.push({ id: "tab", title: "Tabla de propiedades del gas quemado", vs: "cálculo directo del equilibrio",
    how: "Para ir deprisa, el ciclo del motor no resuelve el equilibrio en cada paso: interpola en una tabla que se rellena sobre la marcha. Aquí se compara la tabla con el equilibrio resuelto directamente en 120 puntos al azar entre 1000 y 3200 K y entre 5 y 600 bar.",
    run() {
      const C = CH(), F = C.fuel(), out = [];
      for (const lam of [1, 1.4]) {
        const tb = C.burned(C.elements(C.reactants(F, lam))), r = rnd(4321 + lam * 100);
        let eu = 0, en = 0, es = 0, ex = 0, ei = 0;
        for (let i = 0; i < 120; i++) { const T = 1000 + r() * 2200, P = Math.exp(Math.log(5e5) + r() * Math.log(120)), lp = Math.log(P), e = C.eq(T, P, tb.b); eu = Math.max(eu, Math.abs(tb.u(T, lp) - C.uMix(e.n, T)) / 1e3), en = Math.max(en, Math.abs(tb.nt(T, lp) / e.nt - 1) * 100), es = Math.max(es, Math.abs(tb.s(T, lp) - C.sMix(e.n, T, P))), ex = Math.max(ex, Math.abs(tb.xNO(T, lp) / e.X.NO - 1) * 100), ei = Math.max(ei, Math.abs(tb.Tu(tb.u(T, lp), lp) - T), Math.abs(tb.Ts(tb.s(T, lp), lp) - T), Math.abs(tb.Th(tb.h(T, lp), lp) - T)) }
        const n = "λ " + sig(lam, 2) + ": ";
        out.push(top(n + "energía interna, peor punto", eu, 2, " kJ/kg", "equivale a 1 K"), top(n + "moles por kg (volumen), peor punto", en, .01, " %", "equilibrio directo"), top(n + "entropía, peor punto", es, 2, " J/kg·K", "equilibrio directo"), top(n + "NO de equilibrio, peor punto", ex, 1, " %", "equilibrio directo"), top(n + "ida y vuelta (T → u, h, s → T)", ei, 1e-6, " K", "debe devolver la misma temperatura"))
      }
      return out
    } });

  /* ---------- 7. ciclo del motor ---------- */
  G.push({ id: "cyc", title: "Ciclo del motor de dos zonas", vs: "principios de conservación y soluciones exactas",
    how: "El ciclo no tiene un dato real con el que compararse punto a punto (los equipos no publican la presión en el cilindro), así que se le exige lo que no admite discusión: que conserve la energía, que las dos zonas llenen exactamente el cilindro, que sin pérdidas la compresión sea isentrópica, que el primer gas quemado salga a la temperatura de llama y que el resultado no dependa del paso de cálculo.",
    run() {
      const T = E(), C0 = CH(), P = T.defaults(), C = T.cycle(P), out = [], gu = C.gu, tb = C.tb, m = C.m, Ru = C0.Ru;
      /* primer principio en la fase cerrada */
      let W = 0, vw = 0;
      for (let i = C.iIvc; i < C.iEvo; i++) W += .5 * (C.p[i] + C.p[i + 1]) * (C.vol[i + 1] - C.vol[i]);
      const eI = gu.u(C.Tivc), eE = (1 - C.xEvo) * gu.u(C.TuEvo) + C.xEvo * tb.u(C.TbEvo, Math.log(C.pEvo));
      out.push(top("Primer principio entre el cierre de admisión y la apertura del escape", Math.abs(m * (eI - eE) - W - C.qw) / C.Ef * 100, .002, " %", "ΔU = −trabajo − calor; error respecto a la energía del combustible", 2));
      for (let i = C.iStart + 2; i < C.iEvo; i += 7) { const lp = Math.log(C.p[i]), x = C.xb[i], v = ((1 - x) * gu.R * C.Tu[i] + x * tb.nt(C.Tb[i], lp) * Ru * C.Tb[i]) * m / C.p[i]; vw = Math.max(vw, Math.abs(v / C.vol[i] - 1) * 100) }
      out.push(top("Volumen de la zona quemada más la sin quemar frente al del cilindro", vw, .002, " %", "deben sumar el volumen del cilindro"));
      { const Pn = { ...P, woschni: 0 }, Cn = T.cycle(Pn), g = Cn.gu; out.push(abs("Compresión sin pérdidas de calor: temperatura al encender", Cn.TuSoc, g.TisenV(Cn.Tivc, Cn.V0 / Cn.m, Cn.vol[Cn.iStart] / Cn.m), .05, " K", 6, { refNote: "isentrópica exacta" })) }
      out.push(abs("Primera tanda de gas quemado", C.Tb[C.iStart + 1], C0.flame(gu.n, C.TuSoc, C.pSoc).T, 15, " K", 5, { refNote: "llama adiabática a presión constante" }));
      { const Cf = T.cycle(P, 0, { N: 11520 }); out.push(rel("Presión máxima con el paso de 0,25° frente a un paso cuatro veces más fino", C.pmax / 1e5, Cf.pmax / 1e5, .1, " bar", 5), rel("Trabajo indicado con el paso de 0,25° frente a un paso cuatro veces más fino", C.imep / 1e5, Cf.imep / 1e5, .1, " bar", 5)) }
      { const e = tb.comp(C.TbMax, C.pmax), b = C0.elements(e.n); let w = 0; for (const k in b) tb.b[k] > 0 && (w = Math.max(w, Math.abs(b[k] / tb.b[k] - 1) * 100)); out.push(top("Átomos de C, H, O, N y Ar en el gas quemado frente a los de la mezcla fresca", w, 1e-5, " %", "ni se crean ni se destruyen", 2)) }
      out.push(rel("Volumen en el punto muerto inferior entre el del superior", C.V(Math.PI) / C.V(0), P.cr, 1e-9, "", 6, { refNote: "relación de compresión" }));
      /* velocidad y aceleración del pistón: fórmulas analíticas frente a la derivada numérica de la posición */
      { const F = T.forces(P, C), h = 1e-5; let ev = 0, ea = 0; for (let i = 40; i < C.N; i += 97) { const a = C.th[i] * DEG, v = (C.xPis(a + h) - C.xPis(a - h)) / (2 * h) * C.w, ac = (C.xPis(a + h) - 2 * C.xPis(a) + C.xPis(a - h)) / (h * h) * C.w * C.w; ev = Math.max(ev, Math.abs(F.vel[i] - v)), ea = Math.max(ea, Math.abs(F.acc[i] - ac)) } out.push(top("Velocidad del pistón: fórmula frente a derivada numérica", ev / C.Sp * 100, .01, " %", "de la velocidad media", 2), top("Aceleración del pistón: fórmula frente a derivada numérica", ea / Math.max(...F.acc) * 100, .05, " %", "de la aceleración máxima", 2)) }
      /* vibración torsional: las frecuencias propias (Jacobi) deben anular el par residual del método de Holzer */
      { const F = T.forces(P, C), TS = T.torsion(P, C, F); let w = 0; for (const f of TS.freqs) { const om = TAU * f; let th = 1, tq = 0, sc = 0; for (let i = 0; i < TS.n; i++) { tq += TS.J[i] * om * om * th, sc = Math.max(sc, Math.abs(TS.J[i] * om * om * th)); i < TS.n - 1 && (th -= tq / TS.K[i]) } w = Math.max(w, Math.abs(tq) / sc) } out.push(top("Frecuencias torsionales del cigüeñal: par residual por el método de Holzer", w * 100, .01, " %", "debe anularse en cada frecuencia propia", 2)) }
      return out
    } });

  /* ---------- 8. estructura ---------- */
  G.push({ id: "fe", title: "Chasis: elementos finitos de vigas", vs: "resistencia de materiales",
    how: "El mismo ensamblador y los mismos resolvedores que calculan el chasis, aplicados a una viga en voladizo de acero cuya solución exacta está en cualquier libro: flecha F·L³/3EI, giro T·L/GJ y primera frecuencia propia 1,875²·√(EI/ρAL⁴)/2π.",
    run() {
      const M = LAB.chassismodel, out = [], L = 4, n = 40, Em = 210e9, Gm = 80e9, rho = 7850, b = .2, h = .3, A = b * h, Iy = b * h ** 3 / 12, Iz = h * b ** 3 / 12, J = 2.2e-4, nodes = [], els = [];
      for (let i = 0; i <= n; i++) nodes.push({ name: "n" + i, x: i * L / n, y: 0, z: 0, dof: 6, m: rho * A * L / n * (i === 0 || i === n ? .5 : 1), I: [0, 0, 0], d0: i * 6 });
      for (let i = 0; i < n; i++) els.push({ a: i, b: i + 1, E: Em, G: Gm, A, Iy, Iz, J });
      const S = { nodes, els, springs: [], ground: [], ndof: (n + 1) * 6 }, { K, M: Mv } = M.assemble(S, { noGround: !0 }), fixed = new Set([0, 1, 2, 3, 4, 5]), tip = n * 6, Fv = new Float64Array(S.ndof);
      Fv[tip + 2] = -1e4; let u = M.solve(K.map(r => Float64Array.from(r)), Fv, fixed);
      out.push(rel("Flecha en la punta con 10 kN (flexión vertical)", -u[tip + 2] * 1e3, 1e4 * L ** 3 / (3 * Em * Iy) * 1e3, 1e-6, " mm", 6));
      Fv.fill(0), Fv[tip + 1] = 1e4, u = M.solve(K.map(r => Float64Array.from(r)), Fv, fixed);
      out.push(rel("Flecha en la punta con 10 kN (flexión lateral)", u[tip + 1] * 1e3, 1e4 * L ** 3 / (3 * Em * Iz) * 1e3, 1e-6, " mm", 6));
      Fv.fill(0), Fv[tip + 3] = 5e3, u = M.solve(K.map(r => Float64Array.from(r)), Fv, fixed);
      out.push(rel("Giro en la punta con 5 kN·m de torsión", u[tip + 3] / DEG, 5e3 * L / (Gm * J) / DEG, 1e-6, "°", 6));
      Fv.fill(0), Fv[tip] = 1e5, u = M.solve(K.map(r => Float64Array.from(r)), Fv, fixed);
      out.push(rel("Alargamiento con 100 kN de tracción", u[tip] * 1e3, 1e5 * L / (Em * A) * 1e3, 1e-6, " mm", 6));
      /* primera frecuencia de flexión: se quitan los grados de libertad empotrados y se resuelve K·φ = ω²·M·φ con el mismo Jacobi */
      const id = []; for (let i = 6; i < S.ndof; i++) id.push(i);
      const mi = id.map(i => 1 / Math.sqrt(Mv[i])), Ar = id.map((i, a) => Float64Array.from(id.map((j, c) => K[i][j] * mi[a] * mi[c]))), ev = M.jacobi(Ar, 60).vals.filter(v => v > 0).sort((a, c) => a - c).map(v => Math.sqrt(v) / TAU), f1 = (I => 1.875104 ** 2 * Math.sqrt(Em * I / (rho * A * L ** 4)) / TAU);
      out.push(rel("Primera frecuencia de flexión (40 elementos, masas concentradas)", ev[0], f1(Iz), .5, " Hz", 5), rel("Segunda frecuencia: el otro plano de flexión", ev[1], f1(Iy), .5, " Hz", 5));
      /* autovalores: matriz tridiagonal (2, −1) de orden 24, cuyos autovalores son 2 − 2·cos(kπ/25) */
      { const N = 24, T = Array.from({ length: N }, (_, i) => { const r = new Float64Array(N); r[i] = 2; i && (r[i - 1] = -1); i < N - 1 && (r[i + 1] = -1); return r }), v = M.jacobi(T, 60).vals.sort((a, c) => a - c); let w = 0; for (let k = 1; k <= N; k++) w = Math.max(w, Math.abs(v[k - 1] - (2 - 2 * Math.cos(k * Math.PI / (N + 1))))); out.push(top("Autovalores por Jacobi de una matriz con solución exacta", w, 1e-10, "", "2 − 2·cos(kπ/25), k = 1…24", 2)) }
      return out
    } });

  /* ---------- 9. suspensión ---------- */
  G.push({ id: "kin", title: "Cinemática y fuerzas de la suspensión", vs: "geometría y trabajos virtuales",
    how: "La mangueta es un sólido rígido: al mover la suspensión, ninguna barra puede cambiar de longitud. Las fuerzas en las seis barras deben equilibrar exactamente la fuerza en la huella. Y la prueba que cruza las dos cosas: el trabajo de la fuerza en la huella en un pequeño recorrido debe ser el que absorbe la bieleta (principio de los trabajos virtuales), calculado con la cinemática por un lado y con la estática por otro.",
    run() {
      const K = LAB.kin3d, U = K.util, out = [];
      for (const [H0, name] of [[K.PUSH, "Delantera"], [K.PULL, "Trasera"]]) {
        const H = K.fromParams({ ...K.toParams(H0), rtyre: 360, track: H0.track, camber: -3, toe: 0 }), g = K.prep(H), d = (a, b) => U.len(U.sub(a, b));
        const ref = K.solve(g, 0, 0, null), L0 = { tr: d(ref.TO, ref.TI), k: d(ref.UO, ref.LO), a: d(ref.TO, ref.LO), b: d(ref.TO, ref.UO), c: d(ref.PO, ref.LO), e: d(ref.PO, ref.UO), w: d(ref.WC, ref.LO), pr: d(ref.RA, ref.PO), lf: d(ref.LO, g.LF), lr: d(ref.LO, g.LR), uf: d(ref.UO, g.UF), ur: d(ref.UO, g.UR), ro: d(ref.RA, g.RP) };
        let w = 0, wq = 0, prev = ref, cnt = 0;
        for (const [th, rack] of [[.02, 0], [.05, 0], [.05, .008], [-.03, -.006], [-.06, 0]]) {
          const s = K.solve(g, th, rack, prev); if (!s) continue; prev = s, cnt++;
          const TI = s.TI, L = { tr: d(s.TO, TI), k: d(s.UO, s.LO), a: d(s.TO, s.LO), b: d(s.TO, s.UO), c: d(s.PO, s.LO), e: d(s.PO, s.UO), w: d(s.WC, s.LO), pr: d(s.RA, s.PO), lf: d(s.LO, g.LF), lr: d(s.LO, g.LR), uf: d(s.UO, g.UF), ur: d(s.UO, g.UR), ro: d(s.RA, g.RP) };
          for (const q in L) w = Math.max(w, Math.abs(L[q] - L0[q]) * 1e3);
          /* equilibrio de la mangueta: suma de fuerzas y de momentos */
          const F = [1500, -6000, 7000], ld = K.loads(g, s, F, 80); if (!ld) continue;
          let R = F.slice(), Mo = U.add(U.cross(U.sub(s.CP, s.WC), F), [0, 0, 80]);
          for (const l of ld) { const u = U.nrm(U.sub(l.c, l.p)), f = U.mul(u, l.f); R = U.add(R, f), Mo = U.add(Mo, U.cross(U.sub(l.p, s.WC), f)) }
          wq = Math.max(wq, U.len(R) / U.len(F), U.len(Mo) / (U.len(F) * .3))
        }
        out.push(top(name + ": cambio de longitud de las 13 barras y distancias rígidas en " + cnt + " posiciones", w, 1e-3, " mm", "deben conservarse", 2), top(name + ": resto de fuerzas y momentos en la mangueta", wq * 100, 1e-8, " %", "equilibrio exacto", 2));
        /* trabajos virtuales con fuerza vertical en la huella: Fz·δz (cinemática) = −f·u·δPO (estática de la bieleta) */
        const e = 1e-5, sA = K.solve(g, .03 - e, 0, K.solve(g, .03, 0, ref)), sB = K.solve(g, .03 + e, 0, sA), sM = K.solve(g, .03, 0, sA), F = [0, 0, 5000], ld = K.loads(g, sM, F, 0);
        /* velocidad del punto material de la mangueta que está en la huella: sólido rígido definido por LO, UO y TO */
        const fr = s => { const e1 = U.nrm(U.sub(s.UO, s.LO)), t = U.sub(s.TO, s.LO), e2 = U.nrm(U.sub(t, U.mul(e1, U.dot(t, e1)))), e3 = U.cross(e1, e2); return [e1, e2, e3] }, fm = fr(sM), loc = U.sub(sM.CP, sM.LO), cc = fm.map(v => U.dot(loc, v));
        const at = s => { const f = fr(s); return U.add(s.LO, U.add(U.add(U.mul(f[0], cc[0]), U.mul(f[1], cc[1])), U.mul(f[2], cc[2]))) }, dCP = U.sub(at(sB), at(sA)), rod = ld[4], u = U.nrm(U.sub(rod.c, rod.p)), dPO = U.sub(sB.PO, sA.PO);
        out.push(rel(name + ": fuerza en la bieleta con 5 kN verticales en la huella", rod.f, -U.dot(F, dCP) / U.dot(u, dPO), .01, " N", 6, { refNote: "trabajos virtuales" }))
      }
      return out
    } });

  /* ---------- 10. neumático ---------- */
  G.push({ id: "tyre", title: "Neumático: modelo de cepillo", vs: "solución analítica",
    how: "Con la caída a cero y el agarre uniforme, la teoría del cepillo con presión parabólica tiene solución cerrada: F = μ·Fz·(3θσ − 3θ²σ² + θ³σ³). La rejilla de 40 × 15 cerdas del Laboratorio debe reproducirla, y al deslizar del todo debe dar exactamente μ·Fz. Los valores de agarre de cada compuesto son un supuesto del modelo (no son públicos): aquí se valida la mecánica, no esos valores.",
    run() {
      const TM = LAB.tyremodel, out = [], P = { comp: "M", Fz: 4500, Fz0: 4000, alpha: 0, kappa: 0, gamma: 0, v: 200, pin: 22, T0: 25, Tgas: 25, width: 330, R: 360, cbr: 15, kc: 20, loadSens: 0, camberSens: 4, track: 1 }, C = TM.COMP.M, pa = TM.patch(P), a = pa.a, w = pa.w, cp = P.cbr * 1e7, NY = TM.NY, dy = w / NY;
      /* reparto lateral de la carga, igual que en el modelo: cada tira lleva su parte y tiene su propia θ */
      const py = [], Fzs = []; let ps = 0;
      for (let j = 0; j < NY; j++) { const y = -w / 2 + (j + .5) * dy; py.push(1 - .25 * Math.abs(2 * y / w) ** 6), ps += py[j] }
      for (let j = 0; j < NY; j++) Fzs.push(P.Fz * py[j] / ps);
      for (const al of [1, 3, 6, 12]) {
        const sy = Math.tan(al * DEG), vs = P.v / 3.6 * sy, mu = C.mu * TM.muT(C, C.Topt) * (1 - .12 * clamp(Math.log10(1 + vs) / 1.2, 0, 1));
        let Fy = 0;
        for (let j = 0; j < NY; j++) { const th = 2 * cp * a * a * dy / (3 * mu * Fzs[j]), q = th * sy; Fy += q >= 1 ? mu * Fzs[j] : mu * Fzs[j] * (3 * q - 3 * q * q + q * q * q) }
        out.push(rel("Fuerza lateral con " + al + "° de deriva", TM.brush({ ...P, alpha: al }, null).Fy, Fy, al < 2 ? 1.5 : 1, " N", 5))
      }
      { const b = TM.brush({ ...P, alpha: 0, kappa: -.6 }, null), vs = P.v / 3.6 * .6 / .4, mu = C.mu * (1 - .12 * clamp(Math.log10(1 + vs) / 1.2, 0, 1)); out.push(rel("Frenada con la rueda casi bloqueada: todo desliza", Math.abs(b.Fx), mu * P.Fz, .01, " N", 5, { refNote: "μ·Fz" })) }
      { const b = TM.brush({ ...P, alpha: 0, kappa: 0 }, null); out.push(top("Rueda libre y recta: fuerza residual", Math.hypot(b.Fx, b.Fy), 1e-6, " N", "cero")) }
      return out
    } });

  /* ---------- 11. vuelta completa ---------- */
  G.push({ id: "lap", title: "Vuelta completa", vs: "poles reales", browser: !0,
    how: "El modelo de vuelta (adherencia con carga aerodinámica, potencia del motor y del sistema híbrido, frenada) con un único reglaje para todos los circuitos, frente a la mejor vuelta real de clasificación o carrera en seco de cada uno. No se retoca nada circuito a circuito, y el modelo no sabe cuánto agarra el asfalto de cada sitio ni cómo estaba la pista ese día: por eso se admite hasta un 8 % en un circuito suelto, pero se exige que el error medio no pase del 2 % y que el error cuadrático medio no pase del 4 %.",
    run() {
      const RT = typeof window !== "undefined" && window.REAL_TRACKS, DM = LAB.drivemodel, D = LAB.drive && LAB.drive._test, out = [];
      if (!RT || !D) return out;
      const base = Object.fromEntries(D.DEF.flatMap(g => g.items.map(i => [i.id, i.v]))), fl = t => Math.floor(t / 60) + ":" + (t - Math.floor(t / 60) * 60).toFixed(3).padStart(6, "0");
      for (const k of Object.keys(RT)) { const t = RT[k]; if (!t.pole) continue; const era = t.pole.year >= 2026 ? "2026" : "2025", P = { ...base, ...D.ERA[era], era, track: k }, L = DM.lap(P); out.push({ k: t.name + " (" + t.pole.drv + ", " + t.pole.year + ")", lab: fl(L.lapT), ref: fl(t.pole.t), err: (L.lapT / t.pole.t - 1) * 100, eu: " %", tol: 8 }) }
      if (out.length) { const n = out.length, mean = out.reduce((a, r) => a + r.err, 0) / n, rms = Math.sqrt(out.reduce((a, r) => a + r.err * r.err, 0) / n); out.unshift({ k: "Error medio en los " + n + " circuitos", lab: sig(mean, 2) + " %", ref: "0 %", err: mean, eu: " %", tol: 2 }, top("Error cuadrático medio en los " + n + " circuitos", rms, 4, " %", "vueltas reales")) }
      return out
    } });

  /* lo que NO está validado: supuestos y parámetros de ajuste, dichos claramente */
  const ASSUME = [
    ["Combustible", "La composición real de la gasolina de cada equipo es secreta. Se usa una mezcla sustituta habitual en investigación (isooctano, n-heptano, tolueno y etanol) que cumple el 10 % de etanol y el tope de aromáticos del reglamento. Sus propiedades sí están calculadas, pero no son las de ningún combustible de F1 concreto."],
    ["Combustión", "La forma en que se quema la mezcla (ley de Wiebe: inicio, duración y forma) la fija quien usa el Laboratorio; no se predice. El calor a las paredes usa la correlación de Woschni y la fricción una correlación del tipo Chen-Flynn, las dos ajustadas en su día con motores de serie, no de F1."],
    ["Gas ideal", "Todos los gases se tratan como ideales. A 300 bar y 2500 K el factor de compresibilidad real ronda 1,04: la presión máxima puede tener ese error."],
    ["Detonación", "La tabla de autoencendido es de isooctano puro (octano 100) y se escala con el octanaje del combustible; el mecanismo está validado por sus autores hasta unas 60 atm y aquí se usa hasta 400 bar."],
    ["NO", "Se dan dos valores que acotan la realidad (gas quemado mezclado y sin mezclar). No hay medidas públicas de emisiones de un motor de F1 con las que compararlos."],
    ["Renovación de la carga", "No se resuelve el flujo por las válvulas ni las ondas en los colectores: la masa de aire sale del rendimiento volumétrico, y las presiones de admisión y de escape se imponen."],
    ["Turbo", "Rendimientos isentrópicos fijos: 78 % el compresor y 80 % la turbina."],
    ["Neumáticos", "El agarre de cada compuesto y su ventana de temperatura no son públicos: están ajustados para dar las aceleraciones laterales que se ven en un F1 y las ventanas de trabajo que publica Pirelli."],
    ["Aerodinámica y vuelta", "Los coeficientes de carga y resistencia son los que hacen que el modelo clave las poles; no salen de un túnel de viento."],
    ["Piezas en 3D", "La geometría interior del motor, la caja y la suspensión es un diseño propio, coherente con lo que se sabe, no los planos de ningún equipo."],
    ["Caja de cambios", "La disposición 3D todavía no sigue el artículo 9.6.1 del reglamento: ahí el secundario va por encima del primario, el tambor por encima del secundario y, tras el grupo cónico, una pareja de dientes rectos sube el giro hasta el diferencial, 160-170 mm por encima del cigüeñal. En el modelo actual el secundario va debajo y la corona cónica ataca directamente al diferencial. Las relaciones, los esfuerzos y la simulación de vuelta no dependen de eso; el dibujo sí. Está señalado en rojo en la tabla de la pestaña Transmisión."]
  ];
  function run(only) {
    const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
    return G.filter(g => !only || only.includes(g.id)).map(g => {
      const t0 = now(); let rows;
      try { rows = g.run() } catch (e) { rows = [{ k: "No se ha podido ejecutar", lab: String(e && e.message || e), ref: "", err: 1, eu: "", tol: 0 }] }
      for (const r of rows) r.ok = Math.abs(r.err) <= r.tol;
      return { ...g, rows, ms: now() - t0, n: rows.length, bad: rows.filter(r => !r.ok).length }
    })
  }
  function render(host) {
    const res = run(), n = res.reduce((a, g) => a + g.n, 0), bad = res.reduce((a, g) => a + g.bad, 0), ms = res.reduce((a, g) => a + g.ms, 0), fe = r => r.cap ? "≤ " + sig(r.tol, 2) + r.eu : (r.err >= 0 ? "+" : "−") + sig(Math.abs(r.err), 2) + r.eu;
    const link = s => `<a href="${s[1]}" target="_blank" rel="noopener">${s[0]}</a>`;
    host.querySelector("#valSum").innerHTML = `<div class="valbig ${bad ? "bad" : "ok"}"><b>${n - bad}</b><span>de ${n} comprobaciones dentro de su tolerancia</span></div><div class="valmeta">Calculado ahora mismo en este navegador en ${sig(ms / 1e3, 2)} s. ${bad ? "Lo que está en rojo se sale de lo admitido: es un fallo y así se enseña." : "Las mismas pruebas se pasan automáticamente antes de publicar cada versión."}</div>`;
    host.querySelector("#valBody").innerHTML = res.filter(g => g.n).map((g, i) => `<details class="valg" ${i < 2 || g.bad ? "open" : ""}><summary><b>${g.title}</b><span>frente a ${g.vs}</span><em class="${g.bad ? "bad" : "ok"}">${g.n - g.bad} / ${g.n}</em></summary><p>${g.how}</p><div class="valt"><div class="vh"><span>Comprobación</span><span>Laboratorio</span><span>Referencia</span><span>Diferencia</span></div>${g.rows.map(r => `<div class="vr ${r.ok ? "ok" : "bad"}"><span>${r.k}</span><span>${r.lab}${r.labNote ? `<small>${r.labNote}</small>` : ""}</span><span>${r.ref}${r.refNote ? `<small>${r.refNote}</small>` : ""}${r.note ? `<small>${r.note}</small>` : ""}</span><span>${r.cap ? "" : fe(r)}<small>${r.cap ? "tope " + sig(r.tol, 2) + r.eu : "admitido ±" + sig(r.tol, 2) + r.eu}</small></span></div>`).join("")}</div>${g.src ? `<small class="vsrc">Referencias: ${g.src.filter(Boolean).map(link).join(" · ")}</small>` : ""}</details>`).join("") +
      `<details class="valg" open><summary><b>Lo que no está validado</b><span>supuestos y parámetros de ajuste</span></summary><p>Un modelo vale lo que valen sus hipótesis. Esto es lo que se supone o se ajusta, sin dato real detrás con el que compararlo:</p><div class="vas">${ASSUME.map(([a, b]) => `<div><b>${a}</b><span>${b}</span></div>`).join("")}</div></details>`
  }
  function init(host) {
    host.innerHTML = `<div class="labhead"><div><h2>Validación</h2><p class="sub">Cada modelo del Laboratorio, enfrentado a una referencia que no es él mismo: Cantera, soluciones exactas de libro, principios de conservación y medidas publicadas. Con el número de cada lado y la tolerancia admitida.</p></div><div class="presets"><button class="btn" id="valRun">Repetir las pruebas</button></div></div><div class="valsum" id="valSum"></div><div id="valBody"><p class="sub">Calculando…</p></div>`;
    host.querySelector("#valRun").onclick = () => { host.querySelector("#valBody").innerHTML = `<p class="sub">Calculando…</p>`, setTimeout(() => render(host), 30) };
    setTimeout(() => render(host), 30)
  }
  return { init, run, groups: G, ASSUME }
})();
