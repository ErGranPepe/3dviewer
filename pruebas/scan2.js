window.__scan = function (o) {
  o = o || {};
  const I = R3D.__therm(), T3 = THREE, tr = I.tr, S = Sim, N = tr.N, ds = tr.ds, L = tr.L, HW = S.HW;
  const renderer = I.renderer, scene = I.scene, TG = I.trackGroup;
  const TILE = o.tile || 36, RES = o.res || 256, RANGE = 64, UP = o.up || .12, DN = o.dn || .15, CH = o.h || 2.2;
  const rt = new T3.WebGLRenderTarget(RES, RES, { depthBuffer: true });
  const mat = new T3.ShaderMaterial({
    side: T3.DoubleSide, uniforms: { uY0: { value: 0 } },
    vertexShader: "#include <common>\nvarying float vY;\nvoid main(){\n#include <begin_vertex>\nvec4 wp=vec4(transformed,1.0);\n#ifdef USE_INSTANCING\nwp=instanceMatrix*wp;\n#endif\nwp=modelMatrix*wp;vY=wp.y;gl_Position=projectionMatrix*viewMatrix*wp;}",
    fragmentShader: "uniform float uY0;varying float vY;void main(){float h=clamp((vY-uY0)/64.0,0.0,0.999999)*16777215.0;float r=floor(h/65536.0);float g=floor((h-r*65536.0)/256.0);float b=floor(h-r*65536.0-g*256.0);gl_FragColor=vec4(r/255.0,g/255.0,b/255.0,1.0);}"
  });
  const cam = new T3.OrthographicCamera(-TILE / 2, TILE / 2, TILE / 2, -TILE / 2, .02, 90);
  const buf = new Uint8Array(RES * RES * 4);
  const hid = []; for (const c of scene.children) if (c !== TG && c.visible) { c.visible = false; hid.push(c) }
  const bg = scene.background; scene.background = null; const om = scene.overrideMaterial; scene.overrideMaterial = mat;
  const au = renderer.shadowMap.autoUpdate; renderer.shadowMap.autoUpdate = false;
  const cc = new T3.Color(); renderer.getClearColor(cc); const ca = renderer.getClearAlpha(); renderer.setClearColor(0, 0);
  const P = tr.pit, ss = x => (x = Math.max(0, Math.min(1, x)), x * x * (3 - 2 * x)), rin = P && (P.rin || 70), rout = P && (P.rout || 70);
  const plat = d => { const l = d < rin ? P.entryLat + (P.lane - P.entryLat) * ss(d / rin) : d > P.len - rout ? P.lane + (P.entryLat - P.lane) * ss((d - (P.len - rout)) / rout) : P.lane, c = Sim.pitCap ? Sim.pitCap(P, ds, d) : 1e9; return Math.abs(l) > c ? Math.sign(l) * c : l };
  const slope = new Float32Array(N); for (let i = 0; i < N; i++) slope[i] = (tr.z[(i + 1) % N] - tr.z[(i - 1 + N) % N]) / (2 * ds);
  const upM = new Float32Array(N), upN = new Int32Array(N), upK = new Uint8Array(N), upP = new Array(N), dnM = new Float32Array(N), dnN = new Int32Array(N), dnP = new Array(N), tot = new Int32Array(N);
  const hn = Math.ceil(TILE * .5 / ds), stepI = Math.max(1, Math.floor(TILE * .6 / ds));
  const t0 = performance.now(); let tiles = 0;
  const i0 = o.i0 || 0, i1 = o.i1 == null ? N : o.i1;
  for (let ic = i0; ic < i1; ic += stepI) {
    const C = I.pt(ic, 0, 0), js = [];
    for (let q = -hn - 1; q <= hn + 1; q++) js.push(((ic + q) % N + N) % N);
    let ymax = -1e9; for (const j of js) ymax = Math.max(ymax, I.pt(j, HW, 0)[1], I.pt(j, -HW, 0)[1]);
    const camY = ymax + CH, uY0 = camY - RANGE + 4;
    cam.position.set(C[0], camY, C[2]); cam.up.set(0, 0, -1); cam.lookAt(C[0], camY - 10, C[2]); cam.updateMatrixWorld();
    mat.uniforms.uY0.value = uY0;
    renderer.setRenderTarget(rt); renderer.clear(); renderer.render(scene, cam); renderer.readRenderTargetPixels(rt, 0, 0, RES, RES, buf); tiles++;
    for (let py = 0; py < RES; py++) {
      const wz = C[2] - (((py + .5) / RES) * 2 - 1) * TILE / 2;
      for (let px = 0; px < RES; px++) {
        const wx = C[0] + (((px + .5) / RES) * 2 - 1) * TILE / 2;
        let bj = -1, bd = 1e9;
        for (let q = 0; q < js.length; q++) { const j = js[q], dx = wx - tr.x[j], dy = wz - tr.y[j], d = dx * dx + dy * dy; if (d < bd) { bd = d; bj = j } }
        if (bd > 1200) continue;
        let qi = ((bj - ic) % N + N) % N; if (qi > N / 2) qi -= N;
        if (qi < -stepI / 2 - .5 || qi >= stepI / 2 + .5) continue;
        const h = tr.hd[bj], dx = wx - tr.x[bj], dy = wz - tr.y[bj], al = dx * Math.cos(h) + dy * Math.sin(h), lat = -dx * Math.sin(h) + dy * Math.cos(h);
        if (Math.abs(al) > ds * .8) continue;
        let kind = 0;
        if (Math.abs(lat) <= HW - .25) kind = 1;
        else if (P) {
          const sj = bj * ds + al, d = ((sj - P.inS) % L + L) % L;
          if (d <= P.len) { const pl = plat(d); if (Math.abs(lat - pl) <= 1.3) kind = 2; else if (d >= (P.gA || 0) + 20 && d <= (P.gB || P.len) - 20 && Math.abs(lat - (pl + 3.5 * (P.side || -1))) <= 1.2) kind = 3 }
        }
        if (!kind) continue;
        tot[bj]++;
        const k4 = (py * RES + px) * 4, a = buf[k4 + 3];
        const fr = al / ds, zexp = tr.z[bj] + al * slope[bj] + I.bankOff(fr >= 0 ? I.bankAt(bj, fr) : I.bankAt(bj - 1, 1 + fr), lat);
        const dh = a === 0 ? -99 : uY0 + ((buf[k4] * 65536 + buf[k4 + 1] * 256 + buf[k4 + 2]) / 16777215) * RANGE - zexp;
        if (dh > UP) { upN[bj]++; if (dh > upM[bj]) { upM[bj] = dh; upK[bj] = kind; upP[bj] = [wx, zexp, wz, lat] } }
        else if (dh < -DN) { dnN[bj]++; if (dh < dnM[bj]) { dnM[bj] = dh; dnP[bj] = [wx, zexp, wz, lat, kind] } }
      }
    }
  }
  renderer.setRenderTarget(null); renderer.setClearColor(cc, ca); renderer.shadowMap.autoUpdate = au; scene.overrideMaterial = om; scene.background = bg; for (const c of hid) c.visible = true; rt.dispose(); mat.dispose();
  const scanMs = performance.now() - t0;
  // agrupar
  const clusters = (M, Nn, PP, sign) => {
    const out = []; let cur = null;
    for (let i = 0; i < N; i++) {
      if (Nn[i] >= (o.minPx || 3)) {
        if (!cur || i - cur.i1 > 2) { cur && out.push(cur); cur = { i0: i, i1: i, m: 0, n: 0, p: null, k: 0 } }
        cur.i1 = i; cur.n += Nn[i]; if (Math.abs(M[i]) > Math.abs(cur.m)) { cur.m = M[i]; cur.p = PP[i]; cur.k = sign > 0 ? upK[i] : PP[i][4] }
      }
    }
    cur && out.push(cur); return out
  };
  const mat2 = new T3.ShaderMaterial({ side: T3.DoubleSide, vertexShader: "#include <common>\nvoid main(){\n#include <begin_vertex>\nvec4 wp=vec4(transformed,1.0);\n#ifdef USE_INSTANCING\nwp=instanceMatrix*wp;\n#endif\nwp=modelMatrix*wp;gl_Position=projectionMatrix*viewMatrix*wp;}", fragmentShader: "void main(){gl_FragColor=vec4(1.0);}" });
  const rc = new T3.Raycaster(); rc.firstHitOnly = true;
  const ident = (c) => {
    if (!c.p) return null;
    const hh = c.m > 0 ? Math.min(c.m, 40) : 0;
    rc.set(new T3.Vector3(c.p[0], c.p[1] + hh + .4, c.p[2]), new T3.Vector3(0, -1, 0)); rc.near = 0; rc.far = hh + 3;
    let hits = []; try { hits = rc.intersectObject(TG, true) } catch (e) { return { err: String(e).slice(0, 80) } }
    const vis = o2 => { for (let q = o2; q; q = q.parent) if (!q.visible) return false; return true };
    hits = hits.filter(h => vis(h.object));
    if (!hits.length) return { none: 1 };
    hits = [hits[0]];
    const ob = hits[0].object; let q = ob, src = ""; while (q && !src) { src = q.userData && q.userData.src || ""; q = q.parent }
    const m = Array.isArray(ob.material) ? ob.material[hits[0].face ? hits[0].face.materialIndex || 0 : 0] : ob.material;
    const g = ob.geometry; g.boundingBox || g.computeBoundingBox(); const bb = g.boundingBox, sz = bb ? [bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z].map(v => +v.toFixed(1)) : null;
    return { src, th: m && m.userData && m.userData.th || "", mt: m && m.type, col: m && m.color ? m.color.getHexString() : "", map: !!(m && m.map), inst: !!ob.isInstancedMesh, n: ob.count || 0, geo: g.type, sz, y: +(hits[0].point.y - c.p[1]).toFixed(2), name: ob.name || "" }
  };

  const identB = (c) => {
    if (!c.p || c.m <= 0) return null;
    const hh = Math.min(c.m, 40), W = 1.2, R2 = 16;
    const rt2 = new T3.WebGLRenderTarget(R2, R2, { depthBuffer: true }), b2 = new Uint8Array(R2 * R2 * 4);
    const cam2 = new T3.OrthographicCamera(-W / 2, W / 2, W / 2, -W / 2, .01, Math.max(.05, hh + .3 - Math.max(.1, hh * .5)));
    cam2.position.set(c.p[0], c.p[1] + hh + .3, c.p[2]); cam2.up.set(0, 0, -1); cam2.lookAt(c.p[0], c.p[1] - 10, c.p[2]); cam2.updateMatrixWorld();
    const hid2 = []; for (const ch of scene.children) if (ch !== TG && ch.visible) { ch.visible = false; hid2.push(ch) }
    const bg2 = scene.background; scene.background = null; const om2 = scene.overrideMaterial; scene.overrideMaterial = mat2;
    const cc2 = new T3.Color(); renderer.getClearColor(cc2); const ca2 = renderer.getClearAlpha(); renderer.setClearColor(0, 0);
    const au2 = renderer.shadowMap.autoUpdate; renderer.shadowMap.autoUpdate = false;
    const leaves = []; TG.traverse(q => { if ((q.isMesh || q.isLine || q.isPoints || q.isSprite) && q.visible) { let v = true; for (let a = q.parent; a; a = a.parent) if (!a.visible) { v = false; break } v && leaves.push(q) } });
    const test = () => { renderer.setRenderTarget(rt2); renderer.clear(); renderer.render(scene, cam2); renderer.readRenderTargetPixels(rt2, 0, 0, R2, R2, b2); let n = 0; for (let k = 3; k < b2.length; k += 4) b2[k] && n++; return n };
    const setV = (arr, v) => { for (const q of arr) q.visible = v };
    let res = null;
    const n0 = test();
    if (!n0) res = { none: 2 };
    else {
      let cand = leaves.slice();
      setV(leaves, false);
      while (cand.length > 1) {
        const h = cand.slice(0, cand.length >> 1), r = cand.slice(cand.length >> 1);
        setV(h, true); const n = test(); setV(h, false);
        cand = n ? h : r
      }
      const ob = cand[0]; ob.visible = true; const n1 = test(); ob.visible = false;
      setV(leaves, true);
      if (!n1) res = { none: 3, n0 };
      else {
        let q = ob, src = "", path = []; while (q) { if (!src && q.userData && q.userData.src) src = q.userData.src; q.name && path.push(q.name); q = q.parent }
        const m = Array.isArray(ob.material) ? ob.material[0] : ob.material;
        const g = ob.geometry; g.boundingBox || g.computeBoundingBox(); const bb = g.boundingBox, sz = bb ? [bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z].map(v => +v.toFixed(1)) : null;
        res = { src, th: m && m.userData && m.userData.th || "", mt: m && m.type, col: m && m.color ? m.color.getHexString() : "", map: !!(m && m.map), inst: !!ob.isInstancedMesh, n: ob.count || 0, geo: g.type, sz, px: n1, of: n0, name: ob.name || "", path: path.join("<").slice(0, 60), tp: ob.type }
      }
    }
    setV(leaves, true);
    renderer.setRenderTarget(null); renderer.setClearColor(cc2, ca2); renderer.shadowMap.autoUpdate = au2; scene.overrideMaterial = om2; scene.background = bg2; for (const ch of hid2) ch.visible = true; rt2.dispose();
    return res
  };
  const fmt = (c) => ({ i0: c.i0, i1: c.i1, s0: Math.round(c.i0 * ds), len: Math.round((c.i1 - c.i0 + 1) * ds), dh: +c.m.toFixed(2), px: c.n, lat: c.p ? +c.p[3].toFixed(1) : null, kind: ["", "pista", "pit", "garaje"][c.k] || "", pos: c.p ? [Math.round(c.p[0]), Math.round(c.p[2])] : null });
  let up = clusters(upM, upN, upP, 1).sort((a, b) => b.n * Math.min(3, b.m) - a.n * Math.min(3, a.m)), dn = clusters(dnM, dnN, dnP, -1).sort((a, b) => b.n - a.n);
  const res = { key: tr.key, N, ds: +ds.toFixed(2), HW, tiles, scanMs: Math.round(scanMs), up: [], dn: [], upTot: up.length, dnTot: dn.length };
  const t1 = performance.now();
  for (const c of up.slice(0, o.maxId || 40)) { const f = fmt(c); f.obj = (performance.now() - t1 < (o.idMs || 60000)) ? ident(c) : null; f.ob2 = (performance.now() - t1 < (o.idMs || 60000)) ? identB(c) : null; res.up.push(f) }
  for (const c of dn.slice(0, o.maxId || 40)) { const f = fmt(c); f.obj = (performance.now() - t1 < (o.idMs || 90000)) ? ident(c) : null; res.dn.push(f) }
  res.idMs = Math.round(performance.now() - t1);
  return res
};
