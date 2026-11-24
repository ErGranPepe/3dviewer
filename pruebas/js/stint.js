// Tandas largas en solitario con cada compuesto (probe.py): tiempo por vuelta, desgaste y temperaturas vuelta a vuelta.
// Sirve para calibrar y validar el modelo de degradación que usa el muro (stratSolve) contra la propia simulación.
// window.__comps = ["I","W"] y window.__weather = "lluvia" para probar en mojado
// window.__n = vueltas por tanda (por defecto 10) · window.__wear = multiplicador de desgaste (por defecto el de la carrera)
(() => {
  const w0 = __app.w, tr = w0.track, n = +(window.__n || 10), src = w0.cars[0], out = { circuito: tr.key, ideal: +tr.ideal.toFixed(2), sens: tr._sens != null ? +tr._sens.toFixed(3) : null, desgasteMul: +(window.__wear || w0.wearMul), tandas: [] };
  __app.paused = true;
  for (const comp of (window.__comps || ["S", "M", "H"])) {
    const w = Sim.newWorld(tr, {});
    Sim.raceSetup(w, [{ genome: src.genome, name: "Prueba", code: "TST", team: src.team, num: 1, drv: Object.assign({}, src.drv), tire: comp }], { laps: n, wearMul: +(window.__wear || w0.wearMul), weather: window.__weather || "seco", collide: false, vsc: false, penalties: false, failures: false, seed: 7 });
    const c = w.cars[0];
    c.mgr = { pace: "eq", eng: null, ers: null, fuel: null, box: null, manual: true, hold: false, yieldTo: null, advice: null };
    w.ruleTwo = false;
    const laps = [];
    let pl = 0, sT = [0, 0, 0], steps = 0;
    while (steps < 60 * 130 * (n + 1) && !w.over && pl < n) {
      Sim.raceStep(w), steps++;
      if (!w.started) continue;
      sT[0] += c.tire.tf, sT[1] += c.tire.tr, sT[2]++;
      if (c.laps > pl) {
        pl = c.laps;
        laps.push({ v: pl, mojado: +w.wetLine.toFixed(2), t: +c.lastLap.toFixed(2), wf: +(c.tire.wf * 100).toFixed(1), wr: +(c.tire.wr * 100).toFixed(1), Tf: Math.round(sT[0] / sT[2]), Tr: Math.round(sT[1] / sT[2]), grano: +c.tire.grain.toFixed(2), amp: +c.tire.blister.toFixed(2), fuel: +c.fuel.toFixed(1), push: +c.push.toFixed(2), paro: c.stops | 0 });
        sT = [0, 0, 0]
      }
    }
    out.tandas.push({ comp, laps });
  }
  return out
})()
