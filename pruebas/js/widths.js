// Efecto del ancho real en la vuelta ideal (probe.py): para cada circuito, vuelta del perfil ideal con el semiancho actual y
// con el real (mediana de los anchos punto a punto, `wv`). No carga decorados: una sola página para los 17.
(() => {
  const med = a => { const q = a.slice().sort((x, y) => x - y); return q[q.length >> 1] }, out = [];
  __app.paused = true;
  for (const def of window.REAL_TRACKS) {
    const r = { key: def.key };
    for (const [tag, hw] of [["sim", def.hw], ["real", def.wv ? +(med(def.wv) / 2).toFixed(2) : def.hw]]) {
      const tr = Sim.makeTrackReal(Object.assign({ seed: 7000 }, def, { hw }));
      let mx = 0; for (let i = 0; i < tr.N; i++) mx = Math.max(mx, Math.abs(tr.rl[i]));
      r[tag] = { hw, t: +tr.ideal.toFixed(2), rlMax: +mx.toFixed(2) };
    }
    r.dif = +((r.real.t / r.sim.t - 1) * 100).toFixed(2);
    out.push(r);
  }
  Sim.useTrack(__app.w.track);
  return out
})()
