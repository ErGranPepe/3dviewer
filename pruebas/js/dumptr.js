(() => { const tr = __app.w.track, r = a => a ? Array.from(a, v => +v.toFixed(4)) : null;
  __app.paused = true;
  return { key: tr.key, N: tr.N, ds: tr.ds, L: tr.L, HW: Sim.HW, WALL: Sim.WALL, street: !!tr.street, real: !!tr.real, x: r(tr.x), y: r(tr.y), hd: r(tr.hd), k: r(tr.k), rl: r(tr.rl), rlReal: r(tr.rlReal), rk: r(tr.rk), vref: r(tr.vref), kv: r(tr.kv), wl: tr._wl ? [r(tr._wl[0]), r(tr._wl[1])] : null } })()
