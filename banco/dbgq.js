// Vuelta de clasificación paso a paso (réplica de qualifyOne) con la caja negra del coche: para ver dónde y por qué se pierde.
// uso: TRK=11 [REGS=2026] [DRV=0] [S0=600] [S1=950] node dbgq.js   (S0..S1 = tramo que se imprime, en metros)
const { Sim, defs, FACTORY } = require('./load'), I = Sim._;
const DD = [0, 1, 2, 3, 16, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], T = process.env.TRK || '11', i = /^\d+$/.test(T) ? DD[+T] : defs.findIndex(d => d.key === T);
Sim.setRegs(process.env.REGS || '2026');
const tr = Sim.makeTrackReal(Object.assign({ seed: 7e3 + i }, defs[i])), k = +(process.env.DRV || 0), d = Sim.DRIVERS[k];
const g = Sim.cloneG({ w: Float32Array.from(FACTORY[k % FACTORY.length].w), pit: .7 }), e = { genome: g, team: k >> 1, drv: Sim.drvObj(d[2]), code: d[1] };
const w = Sim.newWorld(tr, { mode: 'race', wearMul: 1, traffic: false });
Sim.setWeather(w, 'seco', Sim.rng(7)), w.wetLine = w.wetOff = 0, w.rubber = .5;
const t = Sim.TEAMS[e.team], c = Sim.newCar({ genome: e.genome, perf: { p: t.p, cl: t.cl, cd: t.cd, rel: t.rel }, drv: e.drv });
Sim.applySetup(c, Sim.clamp(tr.wingRec, 0, 1), e.bias);
c.tire = Sim.newTire('S', Sim.COMP.S.topt), c.fuel = 8, c.batt = 1, c.muEst = 1.6, c.brakeT = 500, c.engT = 100, c.mode = 2, c.push = Sim.clamp(.62 + (c.drv.pace - 85) / 30, .2, .95), c.attack = .5;
let s0 = -450;
for (let q = 0; q < 60; q++) { const j = Sim.idxAt(tr, ((s0 - q * 10) % tr.L + tr.L) % tr.L); let mk = 0; for (let dd = -4; dd <= 8; dd++) mk = Math.max(mk, Math.abs(tr.k[(j + dd + tr.N) % tr.N])); if (mk < 1 / 350) { s0 -= q * 10; break } }
const i0 = Sim.idxAt(tr, (s0 % tr.L + tr.L) % tr.L);
Sim.place(w, c, s0, tr.rl[i0], Math.min(70, tr.vref[i0] * .85)), w.cars = [c], w.all = w.cars;
const S0 = +(process.env.S0 || 0), S1 = +(process.env.S1 || 1e9), f = (x, n = 1) => (+x).toFixed(n);
let t0 = null, steps = 0, res = 'sin acabar';
console.log(`${tr.key} ${Sim.CAR.reg} ${e.code} equipo ${e.team}  HW nominal ${Sim.HW}`);
console.log('   s    lat    rl   hw  km/h  vObj vref  gas fre  vol  beta    r   sup  peralte radio');
for (; steps < 60 * 260;) {
  steps++, w.t += Sim.DT, I.cleanLap(w, c), I.catchSlide(c);
  let vt = null;
  if (c.u > 25) { vt = Sim.targetSpeed(w, c, .86 + .12 * c.push + .07); c.u > vt && (c.thr = 0, c.brk = Math.max(c.brk, Sim.clamp((c.u - vt) / 8, .3, 1))) }
  Sim.CAR.reg === '2026' ? (w.order || (w.order = [c]), I.activeAero(w, c)) : I.quaDRS(tr, c);
  Sim.physics(w, c, Sim.DT), Sim.locate(tr, c);
  if (c.s >= S0 && c.s <= S1 && c.prog > 0 && steps % 3 === 0) console.log(f(c.s, 0).padStart(5), f(c.lat, 2).padStart(6), f(tr.rl[c.idx], 2).padStart(6), f(Sim.hwAt(tr, c.idx)).padStart(4), f(c.u * 3.6, 0).padStart(5), (vt == null ? '-' : f(vt * 3.6, 0)).padStart(5), f(tr.vref[c.idx] * 3.6, 0).padStart(4), f(c.thr, 2).padStart(5), f(c.brk, 1).padStart(3), f(c.steer, 2).padStart(5), f(c.beta, 2).padStart(5), f(c.r, 2).padStart(5), String(c.surf | 0).padStart(4), f((tr.bank[c.idx] || 0) * 57.3).padStart(7), f(1 / Math.max(1e-5, Math.abs(tr.k[c.idx])), 0).padStart(6));
  if (Math.abs(c.lat) > Sim.WALL || Math.abs(c.beta) > 1) { res = `PERDIDO en s=${f(c.s, 0)} lat=${f(c.lat, 2)} beta=${f(c.beta, 2)} u=${f(c.u * 3.6, 0)}`; break }
  if (t0 == null && c.prog >= 0 && (t0 = w.t), c.prog >= tr.L) { res = 'vuelta ' + f(w.t - t0, 3); break }
}
console.log(res);
