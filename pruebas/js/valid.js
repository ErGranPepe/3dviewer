// Tabla de validación: vuelta lanzada del mejor piloto con el control de la IA frente a la pole real, en los 17 circuitos, con
// el ancho que use el simulador. Una sola página (no carga decorados). Devuelve tiempo, error, velocidad punta y el error
// cuadrático medio de la traza de velocidad frente a la telemetría real (km/h).
(() => {
  const out = [], w = __app.w, c = w.cars[0], e = { genome: c.genome, team: c.team, drv: c.drv, code: c.code }, V = {};
  for (const v of window.VALID || []) V[v.key] = v;
  __app.paused = true;
  window.REAL_TRACKS.forEach((def, i) => {
    const tr = Sim.makeTrackReal(Object.assign({ seed: 7000 + i }, def)), trace = [], t = Sim.qualifyOne(tr, e, { trace });
    let k0 = 0; for (let q = 1; q < trace.length; q++) if (trace[q][0] < trace[q - 1][0] - tr.L / 2) { k0 = q; break }
    const lap = trace.slice(k0); let vmax = 0, se = 0, n = 0;
    const ref = def.ref;
    for (const p of lap) {
      vmax = Math.max(vmax, p[1]);
      if (ref && ref.f && ref.v) { const f = p[0] / tr.L; let j = 0; while (j < ref.f.length - 2 && ref.f[j + 1] < f) j++; const a = (f - ref.f[j]) / Math.max(1e-6, ref.f[j + 1] - ref.f[j]), rv = ref.v[j] + (ref.v[j + 1] - ref.v[j]) * Math.max(0, Math.min(1, a)); se += (p[1] - rv) ** 2; n++ }
    }
    const real = V[def.key] ? V[def.key].real : null;
    out.push({ key: def.key, hw: tr.hw, hwAntes: tr.hwOld, ideal: +tr.ideal.toFixed(2), sim: isFinite(t) ? +t.toFixed(3) : null, real, err: real && isFinite(t) ? +((t / real - 1) * 100).toFixed(2) : null, vmax: +vmax.toFixed(1), rvmax: V[def.key] ? V[def.key].rvmax : null, rms: n ? +Math.sqrt(se / n).toFixed(1) : null, rmsAntes: V[def.key] ? +V[def.key].rms.toFixed(1) : null });
  });
  Sim.useTrack(w.track);
  return { reg: Sim.CAR.reg, piloto: c.code, filas: out }
})()
