 function racingLine(tr) {
  const N = tr.N,
   lim0 = HW - (tr.real ? STREET[tr.key] ? 1.3 : .95 : 1.6),
   NX = new Float32Array(N),
   NY = new Float32Array(N);
  let lim = lim0;
  for (let i = 0; i < N; i++) NX[i] = -Math.sin(tr.hd[i]), NY[i] = Math.cos(tr.hd[i]);
  /* circuitos reales: la trazada del TUM se optimizó para una pista más estrecha (≈4,5 m de semiancho); aquí se
     reoptimiza a curvatura mínima con todo el ancho real menos el del coche, partiendo de ella. Así desaparecen los
     codos que obligaban a frenar donde el coche real va a fondo (Ascari, Parabólica, tramos reconstruidos) */
  const realStart = tr.rlReal ? i => clamp(tr.rlReal[i], -lim, lim) : null;
  tr.rlReal && STREET[tr.key] && (lim = HW - +(process.env.LIMS || 2.1));

  function solve(step, n0, iters) {
   const M = Math.floor(N / step),
    cx = new Float64Array(M),
    cy = new Float64Array(M),
    nx = new Float64Array(M),
    ny = new Float64Array(M);
   for (let j = 0; j < M; j++) {
    const i = j * step;
    cx[j] = tr.x[i], cy[j] = tr.y[i], nx[j] = NX[i], ny[j] = NY[i]
   }
   const n = new Float64Array(M);
   for (let j = 0; j < M; j++) n[j] = n0 ? n0(j * step) : 0;
   const px = new Float64Array(M),
    py = new Float64Array(M),
    dx = new Float64Array(M),
    dy = new Float64Array(M),
    lr = .045 / (1 / (step * tr.ds * (step * tr.ds))) / (step * tr.ds * (step * tr.ds));
   for (let it = 0; it < iters; it++) {
    for (let j = 0; j < M; j++) px[j] = cx[j] + nx[j] * n[j], py[j] = cy[j] + ny[j] * n[j];
    for (let j = 0; j < M; j++) {
     const a2 = (j - 1 + M) % M,
      b = (j + 1) % M;
     dx[j] = px[a2] - 2 * px[j] + px[b], dy[j] = py[a2] - 2 * py[j] + py[b]
    }
    for (let j = 0; j < M; j++) {
     const a2 = (j - 1 + M) % M,
      b = (j + 1) % M,
      gx = dx[a2] - 2 * dx[j] + dx[b],
      gy = dy[a2] - 2 * dy[j] + dy[b];
     n[j] = clamp(n[j] - .05 * (gx * nx[j] + gy * ny[j]), -lim, lim)
    }
   }
   return n
  }
  const s1 = 8,
   n1 = realStart ? null : solve(s1, null, 9e3),
   M1 = n1 ? n1.length : 0,
   up = realStart || (i => {
    const f = i / s1,
     j = Math.floor(f) % M1,
     t = f - Math.floor(f);
    return n1[j] * (1 - t) + n1[(j + 1) % M1] * t
   }),
   s2 = 2,
   n2 = solve(s2, up, realStart ? 7e3 : 6e3),
   M2 = n2.length,
   rl0 = new Float32Array(N);
  for (let i = 0; i < N; i++) {
   const f = i / s2,
    j = Math.floor(f) % M2,
    t = f - Math.floor(f);
   rl0[i] = n2[j] * (1 - t) + n2[(j + 1) % M2] * t
  }
  const IT1 = +(process.env.IT1 || 0), rl = IT1 ? Float32Array.from(solve(1, i => rl0[i], IT1)) : rl0;
  let a = rl;
  for (let p = 0; p < +(process.env.SM || 6); p++) {
   const b = new Float32Array(N);
   for (let i = 0; i < N; i++) b[i] = (a[(i - 1 + N) % N] + 2 * a[i] + a[(i + 1) % N]) / 4;
   a = b
  }
  /* horquillas de circuitos reales: el descenso por curvatura mínima se pega al vértice interior (radio de trazada
     menor que el del eje; el coche real usa todo el ancho y gira con un radio ≈ eje + semiancho). Solo ahí se mezcla
     la trazada de K1999 (Coulom, curvatura geométrica de tres puntos), que abre la entrada y la salida */
  if (realStart) {
   const w = hairpinMask(tr), HWT = typeof window < "u" && window.__hwt != null ? window.__hwt : .7;
   if (w.some(x => x > 0)) { const k = k1999Line(tr, NX, NY, lim, realStart); for (let i = 0; i < N; i++) a[i] = (1 - HWT * w[i]) * a[i] + HWT * w[i] * k[i] }
  }
  for (let i = 0; i < N; i++) a[i] = clamp(a[i], -lim, lim);
  return racingLineFinish(tr, a, NX, NY)
 }
 /* máscara de horquillas: giro neto de más de ~100° en ±35 m con radio del eje menor de 25 m, ensanchada ±40 m */
 function hairpinMask(tr) {
  const N = tr.N, ds = tr.ds, W = Math.round(35 / ds), R = Math.round(40 / ds), raw = new Float32Array(N), w = new Float32Array(N), K = j => tr.k[(j % N + N) % N];
  let net = 0;
  for (let j = -W; j <= W; j++) net += K(j) * ds;
  for (let i = 0; i < N; i++) {
   i > 0 && (net += (K(i + W) - K(i - W - 1)) * ds);
   let kc = 0;
   for (let q = -3; q <= 3; q++) kc = Math.max(kc, Math.abs(K(i + q)));
   raw[i] = clamp((Math.abs(net) - 1.4) / .5, 0, 1) * clamp((kc - 1 / 30) / (1 / 22 - 1 / 30), 0, 1)
  }
  for (let i = 0; i < N; i++) { let m = 0; for (let q = -R; q <= R; q++) m = Math.max(m, raw[((i + q) % N + N) % N] * (1 - Math.abs(q) / (R + 1))); w[i] = m }
  return w
 }
 /* curvatura (con signo) de la circunferencia que pasa por tres puntos */
 function k3pt(ax, ay, bx, by, cx, cy) {
  const x1 = bx - ax, y1 = by - ay, x2 = cx - bx, y2 = cy - by, d = Math.hypot(x1, y1) * Math.hypot(x2, y2) * Math.hypot(cx - ax, cy - ay);
  return d > 1e-12 ? 2 * (x1 * y2 - y1 * x2) / d : 0
 }
 /* K1999: cada punto se mueve por su normal hasta que su curvatura sea la media ponderada de la de sus vecinos, de paso
    grueso (256 m) a fino (4 m) */
 function k1999Line(tr, NX, NY, lim, n0) {
  const N = tr.N, X = tr.x, Y = tr.y, n = new Float64Array(N);
  for (let i = 0; i < N; i++) n[i] = n0 ? n0(i) : 0;
  for (const st of [64, 32, 16, 8, 4, 2, 1]) {
   if (N / st < 12) continue;
   const M = Math.floor(N / st), sweeps = st === 1 ? 90 : 60;
   const px = q => { const i = q * st % N; return X[i] + NX[i] * n[i] }, py = q => { const i = q * st % N; return Y[i] + NY[i] * n[i] };
   for (let sw = 0; sw < sweeps; sw++) for (let q = 0; q < M; q++) {
    const i = q * st, a2 = (q - 2 + M) % M, a1 = (q - 1 + M) % M, b1 = (q + 1) % M, b2 = (q + 2) % M,
     ax = px(a2), ay = py(a2), bx = px(a1), by = py(a1), cx = px(q), cy = py(q), dx = px(b1), dy = py(b1), ex = px(b2), ey = py(b2),
     r0 = k3pt(ax, ay, bx, by, cx, cy), r1 = k3pt(cx, cy, dx, dy, ex, ey), lp = Math.hypot(cx - bx, cy - by), ln = Math.hypot(dx - cx, dy - cy),
     tgt = (ln * r0 + lp * r1) / (ln + lp), k0 = k3pt(bx, by, cx, cy, dx, dy), e = 1e-3,
     dk = (k3pt(bx, by, cx + NX[i] * e, cy + NY[i] * e, dx, dy) - k0) / e;
    Math.abs(dk) > 1e-9 && (n[i] = clamp(n[i] + .7 * (tgt - k0) / dk, -lim, lim))
   }
   if (st > 1) for (let q = 0; q < M; q++) {
    const a = q * st, b = q + 1 < M ? (q + 1) * st : N, na = n[a], nb = n[b % N];
    for (let i = a + 1; i < b; i++) { const t = (i - a) / (b - a); n[i] = na * (1 - t) + nb * t }
   }
  }
  const o = new Float32Array(N);
  for (let i = 0; i < N; i++) o[i] = clamp((n[(i - 1 + N) % N] + 2 * n[i] + n[(i + 1) % N]) / 4, -lim, lim);
  return o
 }
 function racingLineFinish(tr, a, NX, NY) {
  const N = tr.N;
  tr.rl = a;
  const RX = new Float32Array(N),
   RY = new Float32Array(N),
   RH = new Float32Array(N),
   RK = new Float32Array(N),
   RS = new Float32Array(N);
  for (let i = 0; i < N; i++) RX[i] = tr.x[i] + NX[i] * a[i], RY[i] = tr.y[i] + NY[i] * a[i];
  for (let i = 0; i < N; i++) {
   const p = (i - 1 + N) % N,
    q = (i + 1) % N;
   RH[i] = Math.atan2(RY[q] - RY[p], RX[q] - RX[p]), RS[i] = Math.hypot(RX[q] - RX[i], RY[q] - RY[i])
  }
  for (let i = 0; i < N; i++) {
   const p = (i - 1 + N) % N,
    q = (i + 1) % N;
   RK[i] = wrap(RH[q] - RH[p]) / (RS[p] + RS[i])
  }
  let K2 = new Float32Array(N);
  for (let i = 0; i < N; i++) {
   let s = 0;
   for (let q = -2; q <= 2; q++) s += RK[(i + q + N) % N];
   K2[i] = s / 5
  }
  tr.rx = RX, tr.ry = RY, tr.rh = RH, tr.rk = K2, tr.rs = RS, tr.nx = NX, tr.ny = NY
 }

