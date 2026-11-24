// Lo que decide el muro antes de la salida (probe.py): modelo de carrera del circuito, opciones de compuesto de salida de
// cada coche con su tiempo previsto y el plan elegido. Comprueba además casos límite del planificador.
(() => {
  const w = __app.w, S = w.strat, tr = w.track;
  __app.paused = true;
  const out = { circuito: tr.key, vueltas: w.laps, desgaste: w.wearMul, modelo: { T0: +S.T0.toFixed(2), sens: +S.sens.toFixed(3), desgVuelta: +S.rate.toFixed(4), calle: +S.tLane.toFixed(1), pista: +S.tTrack.toFixed(1), perdida: +(S.tLane + 2.5 - S.tTrack).toFixed(1), pit: { len: Math.round(tr.pit.len), zA: tr.pit.zA != null ? Math.round(tr.pit.zA) : null, zB: tr.pit.zB != null ? Math.round(tr.pit.zB) : null, vlim: tr.pit.vlim || 22.2, box0: Math.round(tr.pit.box[0]), box9: Math.round(tr.pit.box[9]) } }, coches: [], casos: [] };
  for (const c of w.cars) {
    const P = Sim.stratUpdate(w, c, 0);
    out.coches.push(c.code + " p" + c.grid + " " + c.tire.c + " [" + (c.planStart ? c.planStart.opt.map(o => o[1] + ":" + o[0].toFixed(1)).join(" ") : "") + "] → " + (P ? Sim.planLabel(c) + " (parar ya " + (P.dNow > 0 ? "+" : "") + P.dNow.toFixed(1) + " s)" : "sin plan"));
  }
  /* casos límite: con coche de seguridad, con el juego al 75 %, a 2 vueltas del final sin haber cambiado de compuesto */
  const c = w.cars[0], save = { wf: c.tire.wf, wr: c.tire.wr };
  const P1 = Sim.stratUpdate(w, c, 2); out.casos.push("con coche de seguridad en la vuelta 1: parar ya " + P1.dNow.toFixed(1) + " s → " + (P1.dNow <= 0 ? "para (" + P1.nowC + ")" : "sigue"));
  c.tire.wf = c.tire.wr = .75; const P2 = Sim.stratUpdate(w, c, 0); out.casos.push("juego al 75 %: parar ya " + P2.dNow.toFixed(1) + " s → " + (P2.dNow <= 0 ? "para (" + P2.nowC + ")" : "sigue") + " · " + JSON.stringify(P2.stopsNow));
  c.tire.wf = save.wf, c.tire.wr = save.wr;
  return out
})()
