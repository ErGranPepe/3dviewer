// Vuelta lanzada de clasificación de tres pilotos (el primero, el sexto y el último de la parrilla) con el control de la IA,
// frente a la vuelta ideal del perfil de velocidad y a la pole real. Mide cuánto deja el pilotaje sobre la mesa.
(() => {
  const w = __app.w, tr = w.track, out = { circuito: tr.key, ideal: +tr.ideal.toFixed(2), poleReal: tr.pole ? tr.pole.t : null, reg: Sim.CAR.reg, vueltas: [] };
  __app.paused = true;
  for (const i of [0, 5, 19]) {
    const c = w.cars[i]; if (!c) continue;
    const e = { genome: c.genome, team: c.team, drv: c.drv, code: c.code };
    out.vueltas.push({ code: c.code, pace: c.drv.pace, limpia: +Sim.qualifyOne(tr, e, {}).toFixed(2), medioGastado: +Sim.qualifyOne(tr, e, { fuel: 12, mode: 1, wear: .3 }).toFixed(2) });
  }
  return out
})()
