// Ejecuta un guion de pruebas de tests/js (los mismos que usa probe.py en la página) directamente en Node: prepara la carrera
// igual que la web (clasificación → parrilla → mundo de carrera) y evalúa el guion con __app.w, Sim y window.
// uso: TRK=0,12 [LAPS=8] [WEAR=3] [W=seco] [REGS=2026] [SEED=12345] [PRE='window.__runs=3'] node run.js ../tests/js/story.js
// Sin página: no hay decorados ni dibujo, así que una tanda de 3 carreras tarda lo que tarda la simulación.
const fs = require('fs');
const { Sim, defs, FACTORY } = require('./load');
const src = fs.readFileSync(process.argv[2], 'utf8');
const SEED = +(process.env.SEED || 12345), LAPS = +(process.env.LAPS || 8), WEAR = +(process.env.WEAR || 3), W = process.env.W || 'seco';
const DRV_PIT = [.74, .7, .76, .68, .75, .72, .78, .7, .66, .73, .77, .69, .71, .74, .67, .75, .72, .7, .73, .68];
/* azar reproducible: la página usa Math.random para el ruido de la clasificación */
let rs = SEED >>> 0;
Math.random = () => { rs = rs + 0x6D2B79F5 | 0; let t = Math.imul(rs ^ rs >>> 15, 1 | rs); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 };
Sim.setRegs(process.env.REGS || '2026');
const factory = FACTORY.map(g => ({ w: Float32Array.from(g.w), pit: g.pit, id: g.id || 0, fit: g.fit || 0 }));
const cache = {};
/* TRK = índice del desplegable de la web (0 Sakhir, 1 Melbourne, 2 Suzuka, 3 Shanghái, 4 Mónaco, 5 Montreal, 6 Catalunya, 7 Spielberg,
   8 Silverstone, 9 Budapest, 10 Spa, 11 Zandvoort, 12 Monza, 13 Austin, 14 México, 15 São Paulo, 16 Yas Marina) o la clave del circuito */
const DD = [0, 1, 2, 3, 16, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
for (const T of (process.env.TRK || '0').split(',')) {
  /* TRK=rand:12345 → circuito ficticio con esa semilla */
  const rnd = /^rand:/.test(T) ? +T.slice(5) : null;
  const i = rnd != null ? 1e5 + rnd : /^\d+$/.test(T) ? DD[+T] : defs.findIndex(d => d.key === T), t0 = Date.now();
  rs = (SEED + 7919 * (i + 1)) >>> 0; /* el azar de cada circuito no depende de los que se hayan corrido antes */
  const tr = cache[i] || (cache[i] = rnd != null ? Sim.makeTrack(rnd, "Circuito ficticio " + rnd) : Sim.makeTrackReal(Object.assign({ seed: 7e3 + i }, defs[i])));
  Sim.useTrack(tr);
  const t1 = Date.now();
  const entries = Sim.DRIVERS.map((d, k) => { const g = Sim.cloneG(factory[k % factory.length]); g.pit = DRV_PIT[k % 20]; return { genome: g, name: d[0], code: d[1], team: k >> 1, num: Sim.NUMS[k], drv: Sim.drvObj(d[2]) } });
  const qwet = W === 'lluvia' ? .6 + Math.random() * .2 : W === 'variable' && Math.random() < .25 ? .35 : 0;
  const R = entries.map((e, k) => { let t = Sim.qualifyOne(tr, e, { wet: qwet, seed: SEED + k }); isFinite(t) && (t += Sim.gauss(Math.random) * .08 * (1.3 - e.drv.cons / 100)); return { e, q1: t } });
  R.sort((a, b) => a.q1 - b.q1);
  const n = R.length, cut1 = n >= 20 ? 15 : Math.ceil(n * .75), cut2 = n >= 20 ? 10 : Math.ceil(n * .5);
  R.forEach((r, k) => { r.q2 = k < cut1 && isFinite(r.q1) ? r.q1 - .12 + Sim.gauss(Math.random) * .1 * (1.3 - r.e.drv.cons / 100) : null });
  const q2s = R.slice(0, cut1).filter(r => r.q2 != null).sort((a, b) => a.q2 - b.q2);
  q2s.forEach((r, k) => { r.q3 = k < cut2 ? r.q2 - .1 + Sim.gauss(Math.random) * .09 * (1.3 - r.e.drv.cons / 100) : null });
  const grid = [];
  q2s.filter(r => r.q3 != null).sort((a, b) => a.q3 - b.q3).forEach(r => grid.push(r)), q2s.filter(r => r.q3 == null).forEach(r => grid.push(r)), R.filter(r => !grid.includes(r)).forEach(r => grid.push(r));
  const t2 = Date.now();
  const w = Sim.newWorld(tr, {});
  Sim.raceSetup(w, grid.map(r => r.e), { laps: LAPS, wearMul: WEAR, weather: W, collide: true, vsc: true, penalties: true, failures: true, failMul: 1, seed: SEED });
  w.cars.forEach((c, k) => { const r = grid[k]; c.qTime = r.q3 != null ? r.q3 : r.q2 != null ? r.q2 : r.q1 });
  const win = global.window, app = { w, track: tr, paused: false, phase: 'run', quali: grid.map(r => ({ code: r.e.code, q1: r.q1 })) };
  global.__app = app, win.__app = app, win.Sim = Sim, global.Sim = Sim;
  if (process.env.PRE) new Function('window', '__app', 'Sim', process.env.PRE)(win, app, Sim);
  let out, err = [];
  try { out = new Function('window', '__app', 'Sim', 'performance', 'return (\n' + src.replace(/^\s*(\/\/[^\n]*\n\s*)+/, '').replace(/;?\s*$/, '') + '\n)')(win, app, Sim, performance) } catch (e) { out = 'ERR ' + (e && e.stack || e) }
  const s = typeof out === 'string' ? out : JSON.stringify(out);
  console.log(T + ' ' + (s || '').slice(0, +(process.env.JSMAX || 900000)) + ' ' + JSON.stringify(err));
  process.stderr.write(`[${T} ${tr.name}] pista ${((t1 - t0) / 1e3).toFixed(1)} s · clasificación ${((t2 - t1) / 1e3).toFixed(1)} s · guion ${((Date.now() - t2) / 1e3).toFixed(1)} s\n`);
}
