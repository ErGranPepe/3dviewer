// Términos del límite de velocidad en curva nodo a nodo (curvatura de la trazada, compresión, peralte) en un tramo.
// uso: TRK=11 [REGS=2026] S0=700 S1=900 node dbgk.js
const { Sim, defs } = require('./load');
const DD = [0, 1, 2, 3, 16, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], T = process.env.TRK || '11', i = /^\d+$/.test(T) ? DD[+T] : defs.findIndex(d => d.key === T);
Sim.setRegs(process.env.REGS || '2026');
const tr = Sim.makeTrackReal(Object.assign({ seed: 7e3 + i }, defs[i])), C = Sim.CAR, f = (x, n = 1) => (+x).toFixed(n);
const mass = C.mass + 8, cl = C.cla, c = .5 * 1.2 * cl / mass, mu = 1.6 * C.muScale;
console.log(tr.key, C.reg, 'cla', cl, 'masa', mass, 'c', c.toFixed(5), 'muScale', C.muScale, 'kLoad', C.kLoad);
console.log('    s   R_eje  R_traz    rl    hw   kv(1/m)  z     pend  peralte  den      v_lim  vref');
for (let s = +(process.env.S0 || 700); s <= +(process.env.S1 || 900); s += tr.ds) {
  const j = Sim.idxAt(tr, s), k = Sim.kEff(tr, j), kv = tr.kv[j], bk = tr.bank[j] || 0, sb = bk ? -(Math.sign(tr.k[j]) || 0) * Math.sin(bk) : 0, cb = Math.cos(bk);
  let vc = 200, den = 0;
  for (let it = 0; it < 3; it++) { const me = mu * Math.pow(1 + c * Math.min(vc, 110) ** 2 / 9.81, -C.kLoad); den = k - me * (c + kv + k * sb); vc = den <= 1e-5 ? 200 : Math.sqrt(Math.max(.1, me * 9.81 * cb + 9.81 * sb) / den) }
  console.log(f(s, 0).padStart(5), f(1 / Math.max(1e-5, Math.abs(tr.k[j])), 0).padStart(7), f(1 / Math.max(1e-5, k), 0).padStart(7), f(tr.rl[j], 2).padStart(6), f(Sim.hwAt(tr, j)).padStart(5), kv.toFixed(5).padStart(9), f(tr.z[j]).padStart(6), f(tr.slope[j] * 100).padStart(6), f(bk * 57.3).padStart(7), den.toFixed(5).padStart(9), f(vc * 3.6, 0).padStart(6), f(tr.vref[j] * 3.6, 0).padStart(5));
}
