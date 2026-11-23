/* ===================== QUÍMICA DE LA COMBUSTIÓN =====================
   Termoquímica con datos de verdad (coeficientes NASA de chemdata.js) y equilibrio químico por minimización de la energía de
   Gibbs, con el método de los potenciales de elemento de Gordon y McBride (el del programa CEA de la NASA):
   · cp, entalpía y entropía de cada especie en función de la temperatura;
   · aire seco de verdad (N2, O2, Ar y CO2) y combustible definido por su composición: mezcla sustituta de la gasolina E10
     (isooctano, n-heptano, tolueno y etanol), con su relación aire/combustible estequiométrica y su poder calorífico
     calculados con las entalpías de formación, no puestos a mano;
   · gases quemados con 12 especies (CO2, H2O, N2, O2, CO, H2, OH, O, H, NO, N, Ar): equilibrio a T y P dadas, a presión constante
     (temperatura adiabática de llama) y a volumen constante, y tabla perezosa de propiedades para el ciclo del motor;
   · formación de NO fuera del equilibrio: mecanismo de Zeldovich ampliado con las constantes de GRI-Mech 3.0;
   · retraso de autoencendido del gas sin quemar: tabla calculada con cinética detallada (knockdata.js).
   Todo se valida contra Cantera con los mismos datos (chemref.js) y contra medidas publicadas: ver validate.js. */
LAB.chem = (() => {
  const Ru = 8.31446261815324, P0 = 101325, D = () => LAB.chemData;
  const PROD = ["CO2", "H2O", "N2", "O2", "CO", "H2", "OH", "O", "H", "NO", "N", "AR"], EL = ["C", "H", "O", "N", "Ar"];
  /* aire seco, % en volumen: N2, O2 y Ar de la atmósfera estándar; CO2 actual (420 ppm) */
  const AIR = { N2: 78.084, O2: 20.946, AR: .934, CO2: .042 };
  /* líquidos a 20-25 °C: densidad (kg/m³) y entalpía de vaporización a 298 K (J/mol), valores de manual (NIST) */
  const LIQ = { IC8H18: { rho: 692, hfg: 35100, name: "isooctano", kind: "parafina" }, NC7H16: { rho: 684, hfg: 36600, name: "n-heptano", kind: "parafina" }, C7H8: { rho: 867, hfg: 38000, name: "tolueno", kind: "aromático" }, C2H5OH: { rho: 789, hfg: 42300, name: "etanol", kind: "oxigenado" } };
  /* combustibles: fracción en volumen de líquido de cada componente */
  const FUELS = {
    e10: { name: "Gasolina E10 (F1 2022-2025), mezcla sustituta", vol: { IC8H18: .70, NC7H16: .05, C7H8: .15, C2H5OH: .10 } },
    e0: { name: "Gasolina sin etanol, mezcla sustituta", vol: { IC8H18: .78, NC7H16: .05, C7H8: .17 } },
    e85: { name: "E85 (85 % de etanol)", vol: { IC8H18: .12, NC7H16: .01, C7H8: .02, C2H5OH: .85 } },
    iso: { name: "Isooctano puro (octano 100)", vol: { IC8H18: 1 } },
    eth: { name: "Etanol puro", vol: { C2H5OH: 1 } }
  };
  const co = (s, T) => T >= s.Tm ? s.hi : s.lo;
  const cpR = (s, T) => { const a = co(s, T); return a[0] + T * (a[1] + T * (a[2] + T * (a[3] + T * a[4]))) };
  const hRT = (s, T) => { const a = co(s, T); return a[0] + T * (a[1] / 2 + T * (a[2] / 3 + T * (a[3] / 4 + T * a[4] / 5))) + a[5] / T };
  const sR = (s, T) => { const a = co(s, T); return a[0] * Math.log(T) + T * (a[1] + T * (a[2] / 2 + T * (a[3] / 3 + T * a[4] / 4))) + a[6] };
  const gRT = (s, T) => hRT(s, T) - sR(s, T);
  /* mezcla = { especie: mol por kg de mezcla }: entalpía y energía interna (J/kg), cp (J/kg·K), entropía (J/kg·K), moles totales */
  const moles = n => { let t = 0; for (const k in n) t += n[k]; return t };
  const hMix = (n, T) => { let h = 0; for (const k in n) h += n[k] * hRT(D()[k], T); return h * Ru * T };
  const uMix = (n, T) => hMix(n, T) - moles(n) * Ru * T;
  const cpMix = (n, T) => { let c = 0; for (const k in n) c += n[k] * cpR(D()[k], T); return c * Ru };
  const gammaMix = (n, T) => { const cp = cpMix(n, T); return cp / (cp - moles(n) * Ru) };
  const sMix = (n, T, p) => { const nt = moles(n); let s = 0; for (const k in n) n[k] > 0 && (s += n[k] * (sR(D()[k], T) - Math.log(n[k] / nt * p / P0))); return s * Ru };
  /* gas de composición fija (mezcla sin quemar, aire, gas de escape congelado): los coeficientes NASA de la mezcla son la suma
     ponderada de los de sus especies, así que cp, h, u y s salen de un solo polinomio. Unidades por kg de mezcla */
  function gas(n) {
    const lo = new Float64Array(7), hi = new Float64Array(7);
    let nt = 0, sm = 0, Tm = 1000;
    for (const k in n) { const s = D()[k], x = n[k]; if (!(x > 0)) continue; nt += x, Tm = s.Tm; for (let i = 0; i < 7; i++) lo[i] += x * s.lo[i], hi[i] += x * s.hi[i] }
    for (const k in n) n[k] > 0 && (sm -= n[k] * Math.log(n[k] / nt));
    const R = nt * Ru, g = { n, nt, R, M: 1 / nt };
    g.cp = T => { const a = T >= Tm ? hi : lo; return Ru * (a[0] + T * (a[1] + T * (a[2] + T * (a[3] + T * a[4])))) };
    g.h = T => { const a = T >= Tm ? hi : lo; return Ru * (T * (a[0] + T * (a[1] / 2 + T * (a[2] / 3 + T * (a[3] / 4 + T * a[4] / 5)))) + a[5]) };
    g.s0 = T => { const a = T >= Tm ? hi : lo; return Ru * (a[0] * Math.log(T) + T * (a[1] + T * (a[2] / 2 + T * (a[3] / 3 + T * a[4] / 4))) + a[6]) };
    g.u = T => g.h(T) - R * T, g.cv = T => g.cp(T) - R, g.gamma = T => { const c = g.cp(T); return c / (c - R) };
    g.s = (T, p) => g.s0(T) + Ru * sm - R * Math.log(p / P0);
    /* inversas por Newton: temperatura que da una entalpía, una energía interna o una entropía estándar */
    g.Th = (h, T = 1000) => { for (let i = 0; i < 40; i++) { const d = (g.h(T) - h) / g.cp(T); T = Math.min(6000, Math.max(150, T - d)); if (Math.abs(d) < 1e-8 * T) break } return T };
    g.Tu = (u, T = 1000) => { for (let i = 0; i < 40; i++) { const d = (g.u(T) - u) / (g.cp(T) - R); T = Math.min(6000, Math.max(150, T - d)); if (Math.abs(d) < 1e-8 * T) break } return T };
    g.Ts0 = (s, T = 1000) => { for (let i = 0; i < 40; i++) { const d = (g.s0(T) - s) * T / g.cp(T); T = Math.min(6000, Math.max(150, T - d)); if (Math.abs(d) < 1e-8 * T) break } return T };
    /* proceso isentrópico de composición congelada entre dos presiones, o hasta un volumen específico dado */
    g.Tisen = (T1, p1, p2) => g.Ts0(g.s0(T1) + R * Math.log(p2 / p1), T1 * Math.pow(p2 / p1, .25));
    g.TisenV = (T1, v1, v2) => { let T = T1 * Math.pow(v1 / v2, .3); const s1 = g.s0(T1) - R * Math.log(T1 / v1); for (let i = 0; i < 40; i++) { const d = (g.s0(T) - R * Math.log(T / v2) - s1) * T / (g.cp(T) - R); T -= d; if (Math.abs(d) < 1e-8 * T) break } return T };
    return g
  }
  /* kg de aire seco por mol de O2, y aire como mezcla (mol/kg) */
  const airPerO2 = () => { let m = 0; for (const k in AIR) m += AIR[k] / AIR.O2 * D()[k].M; return m };
  let _air = null;
  const air = () => { if (!_air) { const n = {}, m = airPerO2(); for (const k in AIR) n[k] = AIR[k] / AIR.O2 / m; _air = gas(n) } return _air };
  /* combustible: fracciones en volumen de líquido → propiedades por kg de combustible */
  function fuel(vol, id) {
    const v = vol || FUELS.e10.vol;
    let mt = 0; const m = {}, n = {};
    for (const k in v) v[k] > 0 && (m[k] = v[k] * LIQ[k].rho, mt += m[k]);
    let C = 0, H = 0, O = 0, hfg = 0, vt = 0, aro = 0, eth = 0;
    for (const k in m) { m[k] /= mt, n[k] = m[k] / D()[k].M; const e = D()[k].el; C += n[k] * (e.C || 0), H += n[k] * (e.H || 0), O += n[k] * (e.O || 0), hfg += n[k] * LIQ[k].hfg, vt += m[k] / LIQ[k].rho, LIQ[k].kind === "aromático" && (aro += m[k]), k === "C2H5OH" && (eth += m[k]) }
    const o2 = C + H / 4 - O / 2, afr = o2 * airPerO2(), T0 = 298.15;
    /* poder calorífico inferior: entalpía de los reactivos menos la de los productos (CO2 y H2O vapor) a 298,15 K */
    const hg = hMix(n, T0), hp = (C * hRT(D().CO2, T0) + H / 2 * hRT(D().H2O, T0)) * Ru * T0, lhvGas = hg + o2 * hRT(D().O2, T0) * Ru * T0 - hp, lhv = lhvGas - hfg, M = 1 / moles(n);
    return { id: id || JSON.stringify(v), vol: v, n, m, C, H, O, o2, afr, lhv, lhvGas, hfg, hliq: hg - hfg, rho: 1 / vt, M, hc: H / C, oxy: O * D().O.M, co2: C * D().CO2.M, aro, eth, form: { C: C * M, H: H * M, O: O * M } }
  }
  /* un solo compuesto (o mezcla dada en moles) como combustible gaseoso, para los casos de validación: {especie: fracción molar} */
  function fuelOf(x) {
    let mt = 0; const n = {};
    for (const k in x) mt += x[k] * D()[k].M;
    let C = 0, H = 0, O = 0;
    for (const k in x) { n[k] = x[k] / mt; const e = D()[k].el; C += n[k] * (e.C || 0), H += n[k] * (e.H || 0), O += n[k] * (e.O || 0) }
    return { n, C, H, O, o2: C + H / 4 - O / 2 }
  }
  /* reactivos por kg de mezcla: combustible (fase gas) con aire a la lambda dada. "n2" = número: aire simplificado O2 + n2·N2
     (el de los libros de texto); sin él, aire seco de verdad */
  function reactants(F, lam, n2) {
    const f = F.n ? F : fuelOf(F), o2 = f.o2 * lam, n = {};
    let mAir = 0;
    const add = (k, x) => { n[k] = (n[k] || 0) + x, mAir += x * D()[k].M };
    if (typeof n2 === "number") add("O2", o2), add("N2", o2 * n2); else for (const k in AIR) add(k, o2 * AIR[k] / AIR.O2);
    const mt = 1 + mAir;
    for (const k in n) n[k] /= mt;
    for (const k in f.n) n[k] = (n[k] || 0) + f.n[k] / mt;
    return n
  }
  const elements = n => { const b = { C: 0, H: 0, O: 0, N: 0, Ar: 0 }; for (const k in n) { const e = D()[k].el; for (const q in e) b[q] += n[k] * e[q] } return b };
  /* sistema lineal m×m con el término independiente en la última columna (eliminación de Gauss con pivote); la solución queda ahí */
  function gauss(A, m) {
    const w = m + 1;
    for (let i = 0; i < m; i++) {
      let p = i, big = Math.abs(A[i * w + i]);
      for (let k = i + 1; k < m; k++) { const v = Math.abs(A[k * w + i]); v > big && (big = v, p = k) }
      if (big < 1e-300) return !1;
      if (p !== i) for (let j = i; j < w; j++) { const t = A[i * w + j]; A[i * w + j] = A[p * w + j], A[p * w + j] = t }
      const d = A[i * w + i];
      for (let k = i + 1; k < m; k++) { const f = A[k * w + i] / d; if (f) for (let j = i; j < w; j++) A[k * w + j] -= f * A[i * w + j] }
    }
    for (let i = m - 1; i >= 0; i--) { let s = A[i * w + m]; for (let j = i + 1; j < m; j++) s -= A[i * w + j] * A[j * w + m]; A[i * w + m] = s / A[i * w + i] }
    return !0
  }
  /* especies y elementos presentes para una composición elemental dada, con sus matrices de trabajo */
  const SYS = {};
  function sysOf(b) {
    let key = "";
    for (const e of EL) key += b[e] > 1e-12 ? 1 : 0;
    if (SYS[key]) return SYS[key];
    const els = EL.filter(e => b[e] > 1e-12), sps = PROD.filter(k => Object.keys(D()[k].el).every(e => b[e] > 1e-12)), E = els.length, S = sps.length, a = new Float64Array(S * E), m = E + 1;
    for (let i = 0; i < S; i++) for (let j = 0; j < E; j++) a[i * E + j] = D()[sps[i]].el[els[j]] || 0;
    return SYS[key] = { els, sps, sp: sps.map(k => D()[k]), E, S, a, A: new Float64Array(m * (m + 1)), n: new Float64Array(S), mu: new Float64Array(S), dl: new Float64Array(S), g0: new Float64Array(S), bv: new Float64Array(E), nt: 0, ok: !1, it: 0 }
  }
  /* equilibrio a temperatura dada y presión (vol falso) o volumen específico (vol cierto). Iteración de Newton sobre los potenciales
     de elemento π y, a presión dada, sobre el logaritmo de los moles totales. Parte de sy.n si "warm"; deja el resultado en sy.n */
  function eqRaw(sy, T, PV, vol, warm) {
    const { E, S, a, A, n, mu, dl, g0, bv, sp } = sy, m = vol ? E : E + 1, w = m + 1;
    for (let i = 0; i < S; i++) g0[i] = gRT(sp[i], T);
    if (!warm) for (let i = 0; i < S; i++) n[i] = 100 / S;
    let nt = 0, bmax = 0, it = 0, ok = !1, fine = !1, extra = 0;
    for (let i = 0; i < S; i++) nt += n[i];
    for (let k = 0; k < E; k++) bv[k] > bmax && (bmax = bv[k]);
    const lnP = vol ? 0 : Math.log(PV / P0), cv = vol ? Math.log(Ru * T / (P0 * PV)) : 0;
    for (; it < 200 && !(ok && (fine || extra > 12)); it++) {
      ok && extra++;
      A.fill(0, 0, m * w);
      let ns = 0, smu = 0;
      for (let i = 0; i < S; i++) mu[i] = g0[i] + (vol ? Math.log(n[i]) + cv : Math.log(n[i] / nt) + lnP), ns += n[i], smu += n[i] * mu[i];
      for (let k = 0; k < E; k++) {
        let bk = 0, bm = 0;
        for (let i = 0; i < S; i++) { const q = a[i * E + k] * n[i]; if (!q) continue; bk += q, bm += q * mu[i]; for (let j = 0; j < E; j++) A[k * w + j] += q * a[i * E + j] }
        A[k * w + m] = bv[k] - bk + bm;
        vol || (A[k * w + E] = bk, A[E * w + k] = bk)
      }
      vol || (A[E * w + E] = ns - nt, A[E * w + m] = nt - ns + smu);
      if (!gauss(A, m)) break;
      const dn = vol ? 0 : A[E * w + m];
      let big = 5 * Math.abs(dn), l2 = 1;
      for (let i = 0; i < S; i++) {
        let s = -mu[i] + dn;
        for (let j = 0; j < E; j++) s += a[i * E + j] * A[j * w + m];
        dl[i] = s;
        const fr = n[i] / (vol ? ns : nt);
        if (fr > 1e-8) { const q = Math.abs(s); q > big && (big = q) }
        else if (s >= 0) { const q = Math.abs((-Math.log(fr) - 9.2103404) / (s - dn)); q < l2 && (l2 = q) }
      }
      const lam = Math.min(1, big > 2 ? 2 / big : 1, l2);
      ok = !0;
      /* criterio de CEA: las especies dejan de cambiar en cantidad apreciable ("ok"). Después se pulen unas iteraciones más hasta que
         tampoco cambien en proporción las trazas ("fine"): el N o el NO de equilibrio, que mandan en la cinética del NO, son trazas */
      fine = !0;
      for (let i = 0; i < S; i++) n[i] = Math.max(1e-200, n[i] * Math.exp(lam * dl[i])), n[i] * Math.abs(dl[i]) / ns > 5e-7 && (ok = !1), Math.abs(dl[i]) > 1e-8 && n[i] > 1e-14 * ns && (fine = !1);
      vol || (nt *= Math.exp(lam * dn), nt * Math.abs(dn) / ns > 5e-7 && (ok = !1));
      if (ok) for (let k = 0; k < E; k++) { let bk = 0; for (let i = 0; i < S; i++) bk += a[i * E + k] * n[i]; if (Math.abs(bk - bv[k]) > 1e-7 * bmax) { ok = !1; break } }
    }
    let ns = 0;
    for (let i = 0; i < S; i++) ns += n[i];
    return sy.nt = ns, sy.it = it, sy.ok = ok
  }
  const setB = (sy, b) => { for (let k = 0; k < sy.E; k++) sy.bv[k] = b[sy.els[k]] };
  /* equilibrio con entrada y salida cómodas: b = moles de cada elemento por kg; devuelve moles por kg, fracciones molares, etc. */
  function eq(T, PV, b, o = {}) {
    const vol = !!o.vol, sy = sysOf(b), warm = !!(o.n0 && sy.sps.every(k => o.n0[k] > 0));
    setB(sy, b);
    if (warm) for (let i = 0; i < sy.S; i++) sy.n[i] = o.n0[sy.sps[i]];
    eqRaw(sy, T, PV, vol, warm);
    const n = {}, X = {}, ns = sy.nt;
    for (let i = 0; i < sy.S; i++) n[sy.sps[i]] = sy.n[i], X[sy.sps[i]] = sy.n[i] / ns;
    for (const k of PROD) k in X || (X[k] = 0);
    return { n, X, nt: ns, T, P: vol ? ns * Ru * T / PV : PV, v: vol ? PV : ns * Ru * T / PV, M: 1 / ns, ok: sy.ok, it: sy.it }
  }
  /* raíz de f en [a, b] por regula falsi (variante Illinois) */
  function root(f, a, b, tol) {
    let fa = f(a), fb = f(b), c = a, fc = fa;
    if (fa * fb > 0) return Math.abs(fa) < Math.abs(fb) ? a : b;
    for (let i = 0; i < 80; i++) {
      c = b - fb * (b - a) / (fb - fa), fc = f(c);
      if (Math.abs(fc) < tol || Math.abs(b - a) < 1e-6) break;
      fc * fb < 0 ? (a = b, fa = fb) : fa *= .5;
      b = c, fb = fc
    }
    return c
  }
  /* combustión adiabática de los reactivos "re" (mol/kg) desde Tu: a presión constante P (temperatura de llama) o a volumen constante */
  function flame(re, Tu, P, vol) {
    const b = elements(re), nr = moles(re), v = nr * Ru * Tu / P, e0 = vol ? uMix(re, Tu) : hMix(re, Tu);
    let last = null;
    const f = T => { last = eq(T, vol ? v : P, b, { vol, n0: last && last.n }); return (vol ? uMix(last.n, T) : hMix(last.n, T)) - e0 };
    const T = root(f, Math.max(300, Tu), 4500, .01);
    f(T);
    return Object.assign(last, { Tu, gamma: gammaMix(last.n, T), cp: cpMix(last.n, T), b })
  }
  /* estado de equilibrio con la entropía s (J/kg·K) y el volumen específico v dados: expansión isentrópica con el equilibrio desplazándose */
  function eqSV(s, v, b, T0 = 1500) {
    let last = null;
    const f = T => { last = eq(T, v, b, { vol: !0, n0: last && last.n }); return sMix(last.n, T, last.P) - s };
    const T = root(f, 300, 4500, 1e-6);
    f(T);
    return last
  }
  /* ciclo Otto ideal con gases reales: compresión isentrópica de la mezcla sin quemar (composición congelada), combustión adiabática a
     volumen constante y expansión isentrópica con el equilibrio desplazándose. Sirve para validar toda la cadena contra Cantera */
  function otto(F, lam, T1, p1, r) {
    const re = reactants(F, lam), g = gas(re), v1 = g.R * T1 / p1, T2 = g.TisenV(T1, v1, v1 / r), p2 = g.R * T2 / (v1 / r);
    const e3 = flame(re, T2, p2, !0), s3 = sMix(e3.n, e3.T, e3.P), e4 = eqSV(s3, v1, e3.b), u3 = uMix(e3.n, e3.T), u4 = uMix(e4.n, e4.T);
    let yf = 0;
    for (const k in F.n) yf += re[k] * D()[k].M;
    const w = (u3 - u4) - (g.u(T2) - g.u(T1));
    return { T2, p2, T3: e3.T, p3: e3.P, T4: e4.T, p4: e4.P, w, yf, eta: w / (yf * F.lhvGas) }
  }
  /* ---------- NO: Zeldovich ampliado ----------
     N + NO ⇌ N2 + O (1), N + O2 ⇌ NO + O (2), N + OH ⇌ NO + H (3), con las constantes de GRI-Mech 3.0 (cm³/mol·s). El átomo de N se
     supone en estado estacionario y O, O2, OH, H y N2 en equilibrio (el NO se forma mucho más despacio que el resto de la llama).
     KH = las constantes clásicas de la tabla 11.1 de Heywood (1988), solo para comparar: dan la mitad de velocidad */
  const K = { k1: T => 2.7e13 * Math.exp(-178.64 / T), k2: T => 9e9 * T * Math.exp(-3270.9 / T), k3: T => 3.36e13 * Math.exp(-193.74 / T) };
  const KH = { k1f: T => 7.6e13 * Math.exp(-38000 / T), k2r: T => 1.5e9 * T * Math.exp(-19500 / T), k3r: T => 2e14 * Math.exp(-23650 / T) };
  /* velocidad de formación de NO en fracción molar por segundo. X = fracciones molares de equilibrio {N, NO, O2, OH}; y = fracción
     molar actual de NO. R1, R2 y R3 son las velocidades de las tres reacciones en el equilibrio */
  function noDot(T, P, xN, xNOe, xO2, xOH, y) {
    const c = P / (Ru * T) * 1e-6, q = xN * c * c, R1 = K.k1(T) * q * xNOe, R2 = K.k2(T) * q * xO2, R3 = K.k3(T) * q * xOH, al = xNOe > 0 ? y / xNOe : 0;
    return 2 * R1 * (1 - al * al) / (1 + al * R1 / Math.max(1e-300, R2 + R3)) / c
  }
  /* lo mismo con las constantes de Heywood, que usan las reacciones en el otro sentido: X de equilibrio {O, H, N2, NO} */
  function noDotH(T, P, xO, xH, xN2, xNOe, y) {
    const c = P / (Ru * T) * 1e-6, R1 = KH.k1f(T) * xO * xN2 * c * c, R2 = KH.k2r(T) * xNOe * xO * c * c, R3 = KH.k3r(T) * xNOe * xH * c * c, al = xNOe > 0 ? y / xNOe : 0;
    return 2 * R1 * (1 - al * al) / (1 + al * R1 / Math.max(1e-300, R2 + R3)) / c
  }
  /* un paso de tiempo de la cinética del NO: relajación exponencial hacia el equilibrio con la constante de tiempo local (estable
     aunque el paso sea mayor que el tiempo químico). f = velocidad actual, ye = NO de equilibrio */
  const noRelax = (f, ye, y, dt) => { const d = ye - y; return Math.abs(d) < 1e-14 || f * d <= 0 ? y + f * dt : ye - d * Math.exp(-dt * f / d) };
  /* NO en un gas quemado en equilibrio "e" (resultado de eq) que se mantiene a T y P durante dt segundos, partiendo de y */
  const noStep = (e, y, dt, heywood) => noRelax(heywood ? noDotH(e.T, e.P, e.X.O, e.X.H, e.X.N2, e.X.NO, y) : noDot(e.T, e.P, e.X.N, e.X.NO, e.X.O2, e.X.OH, y), e.X.NO, y, dt);
  /* ---------- gas quemado en equilibrio: tabla perezosa en (T, ln p) para una composición elemental ----------
     Cada nudo se calcula la primera vez que hace falta (el ciclo solo pisa una franja estrecha). Interpolación bilineal en T y ln p.
     u, h (J/kg), s (J/kg·K), moles totales (mol/kg) y fracciones molares de equilibrio de N, NO, O2 y OH para la cinética del NO */
  function burned(b, o = {}) {
    const sy = sysOf(b), T0 = 600, dT = o.dT || 25, nT = Math.round(3200 / dT) + 1, L0 = Math.log(.3e5), L1 = Math.log(900e5), nP = o.nP || 11, dL = (L1 - L0) / (nP - 1), N = nT * nP, LP0 = Math.log(P0);
    /* SX = entropía sin el término de presión, Σ n_i (s°_i − R ln x_i): así lo que se interpola solo cambia con la composición */
    const mk = () => new Float64Array(N).fill(NaN), U = mk(), H = mk(), SX = mk(), NT = mk(), LN = mk(), LNO = mk(), LO2 = mk(), LOH = mk(), comp = new Float64Array(sy.S), ix = k => sy.sps.indexOf(k);
    const iN = ix("N"), iNO = ix("NO"), iO2 = ix("O2"), iOH = ix("OH"), lx = i => i < 0 ? -700 : Math.log(sy.n[i] / sy.nt), ZK = new Float64Array(nP);
    for (let k = 0; k < nP; k++) ZK[k] = Math.exp(-(L0 + k * dL) / 3);
    let warm = !1, count = 0, jh = 60, fails = 0;
    function node(j, k) {
      const q = j * nP + k;
      if (U[q] === U[q]) return;
      const T = T0 + j * dT, P = Math.exp(L0 + k * dL);
      setB(sy, b);
      if (warm) sy.n.set(comp);
      eqRaw(sy, T, P, !1, warm) || (eqRaw(sy, T, P, !1, !1) || fails++);
      comp.set(sy.n), warm = !0, count++;
      const nt = sy.nt;
      let h = 0, s = 0;
      for (let i = 0; i < sy.S; i++) { const x = sy.n[i]; h += x * hRT(sy.sp[i], T), s += x * (sR(sy.sp[i], T) - Math.log(x / nt)) }
      H[q] = h * Ru * T, U[q] = H[q] - nt * Ru * T, SX[q] = s * Ru, NT[q] = nt, LN[q] = lx(iN), LNO[q] = lx(iNO), LO2[q] = lx(iO2), LOH[q] = lx(iOH)
    }
    /* celda de presión y peso entre sus dos nudos: lineal en p^(-1/3) para u, h, moles y entropía (la disociación va con una potencia
       negativa de la presión: así el error baja diez veces frente a interpolar en ln p) y lineal en ln p para los logaritmos de las fracciones */
    let cj = 0, ck = 0, ft = 0, fz = 0, fl = 0;
    function locP(lnp) { const y = (lnp - L0) / dL; ck = y < 0 ? 0 : y > nP - 2 ? nP - 2 : Math.floor(y), fl = y - ck, fz = (Math.exp(-lnp / 3) - ZK[ck]) / (ZK[ck + 1] - ZK[ck]) }
    function loc(T, lnp) {
      const x = (T - T0) / dT;
      cj = x < 0 ? 0 : x > nT - 2 ? nT - 2 : Math.floor(x), ft = x - cj, locP(lnp);
      node(cj, ck), node(cj, ck + 1), node(cj + 1, ck), node(cj + 1, ck + 1)
    }
    const val = (A, f) => { const q = cj * nP + ck; return (A[q] * (1 - f) + A[q + 1] * f) * (1 - ft) + (A[q + nP] * (1 - f) + A[q + nP + 1] * f) * ft };
    /* valor en el nudo de temperatura j a la presión ya situada con locP: u, h, o s (kind 2: entropía completa, con su término de presión) */
    const col = (A, j, kind, lnp) => { node(j, ck), node(j, ck + 1); const q = j * nP + ck, v = A[q] * (1 - fz) + A[q + 1] * fz; return kind === 2 ? v - (NT[q] * (1 - fz) + NT[q + 1] * fz) * Ru * (lnp - LP0) : v };
    const sAt = (T, lnp) => { const x = (T - T0) / dT, j = x < 0 ? 0 : x > nT - 2 ? nT - 2 : Math.floor(x); locP(lnp); const c0 = col(SX, j, 2, lnp); return c0 + (x - j) * (col(SX, j + 1, 2, lnp) - c0) };
    /* inversa: temperatura a la que la magnitud (u, h o s, crecientes con T) vale "v" a la presión dada. Empieza donde acabó la vez anterior */
    function inv(A, v, lnp, kind) {
      locP(lnp);
      let j = Math.min(jh, nT - 2), c0 = col(A, j, kind, lnp), c1 = col(A, j + 1, kind, lnp);
      while (v < c0 && j > 0) j--, c1 = c0, c0 = col(A, j, kind, lnp);
      while (v > c1 && j < nT - 2) j++, c0 = c1, c1 = col(A, j + 1, kind, lnp);
      return jh = j, T0 + dT * (j + (v - c0) / (c1 - c0))
    }
    return {
      b, sy, Tmin: T0, Tmax: T0 + dT * (nT - 1),
      u: (T, lnp) => (loc(T, lnp), val(U, fz)), h: (T, lnp) => (loc(T, lnp), val(H, fz)), nt: (T, lnp) => (loc(T, lnp), val(NT, fz)), s: sAt,
      Tu: (u, lnp) => inv(U, u, lnp, 0), Th: (h, lnp) => inv(H, h, lnp, 0), Ts: (s, lnp) => inv(SX, s, lnp, 2),
      /* fracción molar de NO de equilibrio y un paso de la cinética del NO a (T, p) durante dt segundos */
      xNO: (T, lnp) => (loc(T, lnp), Math.exp(val(LNO, fl))),
      noStep: (T, lnp, y, dt) => { loc(T, lnp); const ye = Math.exp(val(LNO, fl)); return noRelax(noDot(T, Math.exp(lnp), Math.exp(val(LN, fl)), ye, Math.exp(val(LO2, fl)), Math.exp(val(LOH, fl)), y), ye, y, dt) },
      /* composición de equilibrio completa en un punto (cálculo directo, no interpolado) */
      comp: (T, P) => eq(T, P, b),
      stats: () => ({ nodes: count, fails })
    }
  }
  /* tabla del gas quemado para un combustible y una lambda, con memoria de las últimas usadas */
  const TB = new Map();
  function burnedFor(F, lam) {
    const key = F.id + "|" + lam.toFixed(5);
    let t = TB.get(key);
    if (t) return TB.delete(key), TB.set(key, t), t;
    t = burned(elements(reactants(F, lam)));
    TB.set(key, t);
    TB.size > 60 && TB.delete(TB.keys().next().value);
    return t
  }
  /* ---------- retraso de autoencendido (s) del gas sin quemar: tabla de knockdata.js, interpolada en 1000/T, ln p y riqueza ---------- */
  function tauIgn(T, p, phi) {
    const K = LAB.knockData, x = K.invT, y = K.lnp, z = K.phi, nx = x.length, ny = y.length, nz = z.length, L = K.lnTau;
    const fr = (a, v, n) => { let i = 0; while (i < n - 2 && v > a[i + 1]) i++; return [i, (v - a[i]) / (a[i + 1] - a[i])] };
    const [i, fx0] = fr(x, 1000 / T, nx), [j, fy0] = fr(y, Math.log(p), ny), [k, fz0] = fr(z, phi, nz);
    /* fuera de la malla: en 1/T se extrapola (ley de Arrhenius); en presión y riqueza se extrapola como mucho media celda */
    const fx = Math.max(-1, Math.min(2, fx0)), fy = Math.max(-.5, Math.min(1.5, fy0)), fz = Math.max(-.5, Math.min(1.5, fz0)), q = (c, b, a) => L[(c * ny + b) * nx + a];
    const pl = (c, b) => q(c, b, i) * (1 - fx) + q(c, b, i + 1) * fx, ln = c => pl(c, j) * (1 - fy) + pl(c, j + 1) * fy;
    return Math.exp(ln(k) * (1 - fz) + ln(k + 1) * fz)
  }
  return { Ru, P0, PROD, EL, AIR, LIQ, FUELS, cpR, hRT, sR, gRT, moles, hMix, uMix, cpMix, gammaMix, sMix, gas, air, airPerO2, fuel, fuelOf, reactants, elements, eq, eqSV, flame, otto, noDot, noDotH, noStep, noRelax, K, KH, burned, burnedFor, tauIgn, root }
})();
