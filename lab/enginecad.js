/* ===================== MOTOR: TODO LO QUE VA POR FUERA DEL BLOQUE =====================
   Cada conducto empieza y acaba en una pieza:
   · aire: toma con rejilla → compresor (carcasa en caracol) → tubo de carga → intercooler aire-aire → tubo → plenum → trompetas
     → conductos de la culata;
   · escape: lumbrera con su brida → primarios → colector 3 en 1 por bancada → su boca de la turbina (carcasa de doble caracol, una
     voluta por bancada) → tubo de escape; antes de la turbina, cada bancada tiene su válvula de descarga con su propio tubo, que
     sale junto al escape principal;
   · eje del turbo dentro de su carcasa central, con el MGU-H en medio, dentro de la V;
   · delante, la caja de la distribución con el tren de engranajes de las levas (dientes que engranan de verdad: las levas giran
     exactamente a la mitad que el cigüeñal) y la toma del MGU-K; detrás, la placa trasera y el embrague;
   · bobinas sobre las bujías, inyectores directos con su rampa y la bomba de alta presión movida por una leva; bombas de aceite.
   Las medidas salen de las del motor que se calcula (diámetro, carrera, biela, ángulo de la V, separación de cilindros). */
LAB.enginecad = (() => {
  let tubes = [];
  function build(c) {
    const { THREE, root, M, TX, cyl, xmin, xmax, xc, deckD, hw, hwB, vc, vtop, uc, B, r, l, picks, exh, shellMats, shell, crank, cams, H, ratioK } = c;
    const K = LAB.kit, V = K.V, S = o => new THREE.MeshStandardMaterial(o), DEG = Math.PI / 180, HP = Math.PI / 2, TAU = Math.PI * 2;
    const out = { front: [], train: [], hot: [], lab: {} };
    tubes = [];
    /* el eje del turbo pasa por dentro de la V: su altura la marca el hueco que deja el MGU-H entre las dos bancadas */
    const beta = Math.abs(cyl[0].beta), sb = Math.sin(beta), ty = Math.max((r + l) * .9, (hwB + .0395) / sb), Xc = xmax + .1, Xt = xmin - .17;
    const latheX = (pts, seg) => K.latheHard(pts, seg || 44).rotateZ(-HP);
    const mk = (geo, mat, kind, layer, k) => { const m = new THREE.Mesh(geo, mat); root.add(m), kind && picks.push([m, kind, k]), layer && (m.userData.layer = layer), shellMats.includes(mat) && (m.userData.shell = 1); return m };
    const reg = m => (shellMats.push(m), m);
    const pipe = (name, pts, rad, o = {}) => { const P = o.raw ? pts : K.smooth(pts, o.seg || 44); tubes.push({ n: name, P, r: o.rr || (typeof rad === "number" ? rad : .02) }); return K.sweep(P, rad, o) };
    /* ---------- materiales ---------- */
    const mHot = reg(S({ color: "#6d655c", metalness: .75, roughness: .5, emissive: "#000", side: THREE.DoubleSide }));
    const mTH = reg(S({ color: "#5c4d43", metalness: .7, roughness: .55, emissive: "#000" }));
    const mCast = reg(S({ color: "#bcc2c8", metalness: .85, roughness: .46, roughnessMap: TX.noise, side: THREE.DoubleSide }));
    const mCarb = reg(M.carbon.clone()); mCarb.side = THREE.DoubleSide;
    const mFl = reg(S({ color: "#8d949b", metalness: 1, roughness: .35 }));
    const mBlk = reg(S({ color: "#23272c", metalness: .6, roughness: .45, side: THREE.DoubleSide }));
    const mGear = S({ color: "#aeb4bb", metalness: 1, roughness: .28 }), mShaft = M.steel.clone();
    out.hot.push(mHot, mTH), out.mTH = mTH, out.mShaft = mShaft;
    const hoseX = (x, y, z, rad) => K.hoseClamp(rad).rotateZ(-HP).translate(x, y, z);

    /* ================= TURBO ================= */
    const turbo = new THREE.Group;
    turbo.add(new THREE.Mesh(new THREE.CylinderGeometry(.0055, .0055, Xc - Xt, 16).rotateZ(HP).translate((Xc + Xt) / 2 - xc, 0, 0), mShaft));
    const mTW = S({ color: "#72665c", metalness: .9, roughness: .35, emissive: "#000", side: THREE.DoubleSide });
    const comp = new THREE.Mesh(K.impeller(.046, .034, 7, { split: 1, tip: .68, nose: .22, wrap: .95, th: .0011 }), M.wheelC), turb = new THREE.Mesh(K.impeller(.04, .03, 11, { tip: .8, nose: .26, wrap: -.6, th: .0018, b2: .3, sx: -1 }), mTW);
    comp.position.x = Xc - xc - .017, turb.position.x = Xt - xc + .012, turbo.add(comp, turb);
    comp.add(new THREE.Mesh(K.hex(.006, .008).rotateZ(HP).translate(.04, 0, 0), M.steel)), turb.add(new THREE.Mesh(K.hex(.0055, .007).rotateZ(HP).translate(-.035, 0, 0), M.steel));
    turbo.position.set(xc, ty, 0), turbo.userData = { comp, turb, ang: 0, layer: "tb" }, root.add(turbo), picks.push([comp, "turbo"], [turb, "turbine"]);
    out.front.push(comp);
    /* MGU-H: carcasa con aletas de refrigeración y caja de bornes */
    {
      const fins = []; for (let i = -3; i <= 3; i++) fins.push(latheX([[.034, -.002], [.0375, -.002], [.0375, .002], [.034, .002]], 40).translate(i * .013, 0, 0));
      out.mguh = mk(K.merge([latheX([[0, -.056], [.029, -.056], [.034, -.051], [.034, .051], [.029, .056], [0, .056]]), ...fins, new THREE.BoxGeometry(.05, .014, .03).translate(0, .041, 0)]).translate(xc, ty, 0), M.motor, "mguh", "tb")
    }
    /* carcasa central: el eje va dentro, sobre sus cojinetes, del compresor al MGU-H y del MGU-H a la turbina */
    for (const [a, b] of [[Xc - .034, xc + .056], [xc - .056, Xt + .036]]) {
      const L = Math.abs(b - a), mid = (a + b) / 2, e = a > xc ? L / 2 - .02 : -L / 2 + .02;
      mk(K.merge([latheX([[.0145, -L / 2], [.0145, L / 2]], 28), latheX([[.0145, -.012], [.02, -.012], [.02, .012], [.0145, .012]], 28).translate(e, 0, 0), K.hex(.005, .012).translate(e, .022, 0), latheX([[.0145, -.004], [.0175, -.004], [.0175, .004], [.0145, .004]], 28).translate(-e, 0, 0)]).translate(mid, ty, 0), mCast, "turbo", "tb")
    }
    /* --- compresor: el aire entra por delante, la rueda lo lanza hacia fuera y la voluta lo recoge hasta la salida --- */
    let compOut, compDir;
    {
      const cv = K.volute({ Rw: .046, gap: .012, a0: .024, a1: .008, sweep: 330 * DEG, phi0: Math.PI, dir: -1, tail: .07, x0: -.006 });
      out.compHousing = mk(K.merge([cv.geo, latheX([[.0075, -.034], [.024, -.034], [.024, -.024], [.062, -.02], [.062, .008], [.0385, .02], [.0385, .052], [.034, .052]]), latheX([[.0485, .004], [.034, .021], [.034, .052]])]).translate(Xc, ty, 0), mCast, "turbo", "tb");
      compOut = cv.mouth.clone().add(V(Xc, ty, 0)), compDir = cv.out.clone();
      mk(K.put(K.flange(.024, .034, .006, 6, .0035), compOut.clone(), compDir), mFl, "turbo", "tb");
      /* toma de aire: manguito, codo y campana con rejilla (en el coche, este conducto sube hasta la toma que hay sobre el casco) */
      const ip = K.smooth([V(Xc + .05, ty, 0), V(Xc + .09, ty, 0), V(Xc + .128, ty + .032, 0), V(Xc + .14, ty + .09, 0), V(Xc + .14, ty + .17, 0)], 48);
      mk(pipe("toma", ip, t => .038 + (t > .82 ? ((t - .82) / .18) ** 2 * .026 : 0), { raw: !0, sides: 28, rr: .038 }), mCarb, "intake", "in");
      const grid = new THREE.Mesh(new THREE.CircleGeometry(.056, 40).rotateX(-HP).translate(Xc + .14, ty + .163, 0), new THREE.MeshBasicMaterial({ map: meshTex(THREE), transparent: !0, alphaTest: .4, side: THREE.DoubleSide }));
      root.add(grid), grid.userData.layer = "in", out.front.push(grid);
      mk(K.merge([hoseX(Xc + .058, ty, 0, .0392), hoseX(Xc + .074, ty, 0, .0392)]), mFl, "intake", "in");
      out.lab.inlet = V(Xc + .14, ty + .19, 0)
    }
    /* --- turbina: carcasa de doble caracol. La voluta delantera recibe a la bancada izquierda (entra por abajo, a la izquierda) y la
           trasera a la derecha (entra por debajo, desde la derecha); las dos soplan la rueda en el mismo sentido --- */
    const tsc = { Rw: .04, gap: .004, a0: [.022, .025], a1: .008, ax1: .92, sweep: 340 * DEG, dir: 1, steps: 96, wall: .0035 };
    const sF = K.volute({ ...tsc, phi0: -HP, tail: .046, x0: .022 }), sR = K.volute({ ...tsc, phi0: Math.PI, tail: .06, x0: -.022 });
    {
      const body = K.merge([sF.geo, sR.geo, latheX([[.036, -.056], [.047, -.056], [.047, -.05], [.0405, -.05], [.0405, -.03], [.047, -.02], [.047, .026], [.028, .03], [.028, .036], [.0075, .036], [.0075, .016], [.0425, .016], [.0425, -.016], [.036, -.022], [.036, -.056]])]).translate(Xt, ty, 0);
      const th = mk(body, mTH, "turbine", "tb");
      turbo.userData.tv = th, out.turbHousing = th;
      /* en la vista seccionada se quita la mitad de arriba: las caras de corte, en rojo */
      const cap = new THREE.Mesh(body, new THREE.MeshBasicMaterial({ color: "#a32b26", side: THREE.BackSide }));
      cap.userData.layer = "tb", cap.userData.cap = 1, root.add(cap), out.capT = cap
    }
    const mouth = { L: sF.mouth.clone().add(V(Xt, ty, 0)), R: sR.mouth.clone().add(V(Xt, ty, 0)) };
    mk(K.merge([K.put(K.flange(.0225, .036, .007, 6, .0038), mouth.L.clone(), sF.out), K.put(K.flange(.0225, .036, .007, 6, .0038), mouth.R.clone(), sR.out), K.put(K.vband(.0475), V(Xt - .054, ty, 0), V(-1, 0, 0))]), mFl, "turbine", "tb");

    /* ================= ESCAPE ================= */
    const rp = .0155, rs = .0215, exMat = new THREE.MeshStandardMaterial({ map: TX.tint, color: "#ffffff", metalness: .7, roughness: .45, emissive: "#000", emissiveMap: TX.hot, side: THREE.DoubleSide });
    const tpEnd0 = V(Xt - .36, ty + .08, 0);
    for (const left of [!0, !1]) {
      const cs = cyl.filter(q => q.left === left).sort((a, b) => b.x - a.x), sz = left ? -1 : 1, od = cs[0].side.clone().multiplyScalar(left ? -1 : 1), tag = left ? "L" : "R";
      const P0 = (q, v, u) => q.dir.clone().multiplyScalar(deckD + v).addScaledVector(od, u).setX(q.x);
      const kOf = q => P0(q, .045, hw + .004).addScaledVector(od, .04).add(V(0, -.01, 0)), k2 = kOf(cs[2]);
      /* colector 3 en 1 detrás del último cilindro, apuntando hacia atrás y hacia dentro: las tres bocas, en triángulo */
      const ax = V(-.8, .15, -sz * .58).normalize(), E = V(xmin - .075, k2.y - .065, sz * (Math.abs(k2.z) + .019));
      const e1 = V(0, 1, 0).addScaledVector(ax, -ax.y).normalize(), uo = new THREE.Vector3().crossVectors(ax, e1).multiplyScalar(left ? 1 : -1), rho = .0185;
      const offs = [uo.clone().multiplyScalar(rho), uo.clone().multiplyScalar(-rho / 2).addScaledVector(e1, -.866 * rho), uo.clone().multiplyScalar(-rho / 2).addScaledVector(e1, .866 * rho)];
      cs.forEach((q, i) => {
        const face = P0(q, .045, hw + .004), k1 = kOf(q), end = E.clone().add(offs[i]), pre = end.clone().addScaledVector(ax, -.06);
        /* el del cilindro delantero corre por fuera, el del medio por debajo y el trasero baja directo: llegan al colector sin cruzarse */
        const mid = i === 0 ? [k1.clone().add(V(-.05, -.041, sz * .084)), V(pre.x + .07, E.y + .009, sz * (Math.abs(E.z) + .085))] : i === 1 ? [k1.clone().add(V(-.04, -.073, sz * .054)), V(pre.x + .06, E.y - .028, sz * (Math.abs(E.z) + .04))] : [k1.clone().add(V(-.02, -.041, sz * .031))];
        const pts = [P0(q, .013, .012), P0(q, .028, .045), face, k1, ...mid, pre, end.clone().addScaledVector(ax, -.02), end.clone().addScaledVector(ax, .004)];
        const tube = mk(pipe("prim" + q.k, pts, rp, { seg: 84, sides: 18 }), exMat.clone(), "exhaust", "exh", q.k);
        tube.userData.shell = 1, shellMats.push(tube.material), exh.push({ m: tube, c: q });
        /* brida de la lumbrera, atornillada a la culata */
        mk(K.put(K.flange(rp + .0005, rp + .012, .006, 4, .0035), face.clone().addScaledVector(od, .004), od), mFl, "exhaust", "exh", q.k);
        q.k === 3 && (out.lab.exh = pts[5].clone())
      });
      /* colector y secundario en una pieza: se estrecha al juntar los tres y sigue hasta su boca de la turbina */
      const S0 = E.clone().addScaledVector(ax, .07), m = left ? mouth.L : mouth.R;
      const tail = left ? [m.clone().add(V(-.005, -.0705, -.056)), m.clone().add(V(-.001, -.0385, -.011)), m.clone().add(V(0, -.0155, 0)), m.clone().add(V(0, .005, 0))] : [m.clone().add(V(.009, -.0325, .08)), m.clone().add(V(0, -.0055, .04)), m.clone().add(V(0, 0, -.005))];
      const cp = K.smooth([E.clone().addScaledVector(ax, -.014), E.clone().addScaledVector(ax, .03), S0, S0.clone().addScaledVector(ax, .03), ...tail], 96);
      let Lt = 0; for (let i = 1; i < cp.length; i++) Lt += cp[i].distanceTo(cp[i - 1]);
      mk(pipe("sec" + tag, cp, t => { const u = Math.min(1, Math.max(0, (t * Lt - .028) / .056)); return .0355 + (rs - .0355) * u * u * (3 - 2 * u) }, { raw: !0, sides: 26, cap0: !0, rr: rs }), mHot, "exhaust", "exh");
      mk(K.put(K.vband(rs + .001), S0.clone().addScaledVector(ax, .01), ax), mFl, "exhaust", "exh");
      left || (out.lab.col = E.clone().addScaledVector(ax, .03).add(V(0, .05, 0)));
      /* válvula de descarga: derivación antes de la turbina, válvula de seta con su actuador neumático y tubo propio hasta la salida */
      const Pw = S0.clone().addScaledVector(ax, .03), dw = V(-.85, -.1, sz * .5).normalize(), du = V(0, 1, 0).addScaledVector(dw, -dw.y).normalize(), Pb = Pw.clone().addScaledVector(dw, .06);
      mk(K.merge([K.put(K.latheHard([[.016, 0], [.016, .036], [.026, .04], [.026, .082], [.02, .086], [.02, .092]], 32), Pw.clone(), dw), K.put(K.latheHard([[.0165, .016], [.0165, .03], [.0215, .03], [.0215, .036], [.0165, .036]], 24), Pb.clone(), du)]), mHot, "wg", "exh");
      mk(K.merge([K.put(K.latheHard([[.02, .092], [.031, .096], [.031, .132], [.024, .138], [.007, .138], [.007, .146], [0, .146]], 32), Pw.clone(), dw), K.put(K.hex(.005, .014), Pw.clone().addScaledVector(dw, .114).addScaledVector(du, .034), du)]), mFl, "wg", "exh");
      const wp = K.smooth([Pb.clone().addScaledVector(du, .026), Pb.clone().addScaledVector(du, .07).add(V(-.02, 0, 0)), V(Xt - .14, ty - .03, sz * .105), V(Xt - .25, ty + .02, sz * .08), V(tpEnd0.x + .02, tpEnd0.y - .025, sz * .072)], 48);
      mk(pipe("wg" + tag, wp, .015, { raw: !0, sides: 18 }), mHot, "wg", "exh");
      left && (out.lab.wg = Pw.clone().addScaledVector(dw, .11).add(V(0, .04, 0)))
    }
    /* tubo de escape: de la salida de la turbina hacia atrás y arriba, hasta su boca */
    {
      const tp = K.smooth([V(Xt - .05, ty, 0), V(Xt - .13, ty, 0), V(Xt - .26, ty + .035, 0), tpEnd0], 56), n = tp.length, dir = tp[n - 1].clone().sub(tp[n - 2]).normalize();
      mk(pipe("escape", tp, t => .0385 + .0085 * Math.min(1, t / .25), { raw: !0, sides: 30, rr: .047 }), mHot, "exhaust", "exh");
      mk(K.put(K.latheHard([[.047, -.012], [.0505, -.012], [.0505, .003], [.047, .003]], 36), tp[n - 1].clone(), dir), mFl, "exhaust", "exh");
      out.lab.tail = tp[n - 12].clone().add(V(0, .07, 0))
    }

    /* ================= ADMISIÓN ================= */
    /* intercooler aire-aire en el costado izquierdo, como en un pontón: panal de aletas entre dos depósitos */
    const icL = .34, icH = .2, icW = .06, icM = new THREE.Matrix4().makeRotationX(-.32).setPosition(xc + .09, .1, -.47);
    const icPt = (x, y, z) => V(x, y, z).applyMatrix4(icM), icN = V(0, 0, 1).transformDirection(icM);
    {
      const core = shell(new THREE.BoxGeometry(icL, icH, icW).applyMatrix4(icM), reg(S({ map: finTex(THREE), color: "#c9ced3", metalness: .8, roughness: .5 })), "ic", "in");
      const tank = sx => K.merge([new THREE.BoxGeometry(.034, icH + .012, icW + .008).translate(sx * (icL / 2 + .017), 0, 0), new THREE.CylinderGeometry(icW / 2 + .004, icW / 2 + .004, icH + .012, 20, 1, !1, sx > 0 ? 0 : Math.PI, Math.PI).translate(sx * (icL / 2 + .034), 0, 0), new THREE.CylinderGeometry(.024, .024, .036, 22).rotateX(HP).translate(sx * (icL / 2 + .022), .045, icW / 2 + .018)]);
      mk(K.merge([tank(1), tank(-1), new THREE.BoxGeometry(icL, .008, icW + .006).translate(0, icH / 2 + .004, 0), new THREE.BoxGeometry(icL, .008, icW + .006).translate(0, -icH / 2 - .004, 0)]).applyMatrix4(icM), mCast, "ic", "in");
      out.lab.ic = icPt(0, icH / 2 + .03, 0), out.icCore = core
    }
    const icIn = icPt(icL / 2 + .022, .045, icW / 2 + .036), icOut = icPt(-icL / 2 - .022, .045, icW / 2 + .036);
    /* tubo de carga caliente: del compresor al intercooler */
    mk(pipe("carga1", [compOut, compOut.clone().addScaledVector(compDir, .06), V((compOut.x + icIn.x) / 2, (compOut.y + icIn.y) / 2 - .01, (compOut.z + icIn.z) / 2 + .03), icIn.clone().addScaledVector(icN, .07), icIn.clone().addScaledVector(icN, -.004)], .024, { seg: 56, sides: 22 }), mCast, "intake", "in");
    mk(K.merge([K.put(K.hoseClamp(.0252), icIn.clone().addScaledVector(icN, .006), icN), K.put(K.hoseClamp(.0252), icIn.clone().addScaledVector(icN, .022), icN), K.put(K.hoseClamp(.0252), icOut.clone().addScaledVector(icN, .006), icN), K.put(K.hoseClamp(.0252), icOut.clone().addScaledVector(icN, .022), icN)]), mFl, "intake", "in");
    /* plenum de carbono sobre la V */
    const plY = deckD * .72 + .17, plA = xmin + .02, plB = xmax - .02;
    {
      const pp = [], n = 64; for (let i = 0; i <= n; i++) pp.push(V(plA + (plB - plA) * (.5 - .5 * Math.cos(Math.PI * i / n)), plY, 0));
      out.plenum = mk(K.sweep(pp, t => { const u = .5 - .5 * Math.cos(Math.PI * t), e = Math.sqrt(Math.max(0, 1 - Math.abs(2 * u - 1) ** 6)); return [.034 * e + 1e-4, .06 * e + 1e-4] }, { sides: 36, n0: V(0, 1, 0) }), mCarb, "intake", "in")
    }
    /* tubo de carga frío: del intercooler al costado del plenum, por encima de la tapa de levas izquierda y entre dos trompetas */
    {
      const lx = cyl.filter(q => q.left).map(q => q.x).sort((a, b) => a - b), px = (lx[0] + lx[1]) / 2, pin = V(px, plY, -.05), dL = cyl[0].dir, topL = dL.clone().multiplyScalar(deckD + vtop + .045);
      mk(pipe("carga2", [icOut.clone().addScaledVector(icN, -.004), icOut.clone().addScaledVector(icN, .06), V((icOut.x + px) / 2, topL.y - .02, topL.z - .08), V(px, topL.y + .012, topL.z + .012), V(px, plY + .012, -.115), pin], .024, { seg: 60, sides: 22 }), mCast, "intake", "in");
      mk(K.put(K.flange(.024, .035, .006, 6, .0035), V(px, plY, -.0635), V(0, 0, 1)), mFl, "intake", "in")
    }
    /* trompetas: del fondo del plenum a cada conducto de la culata */
    for (const q of cyl) {
      const ib = q.side.clone().multiplyScalar(q.left ? 1 : -1), P0 = (v, u) => q.dir.clone().multiplyScalar(deckD + v).addScaledVector(ib, u).setX(q.x), top = V(q.x, plY - .018, (q.left ? -1 : 1) * .03), ex0 = P0(.06, hw + .004);
      mk(pipe("tromp" + q.k, [P0(.014, .012), P0(.034, .045), ex0, ex0.clone().lerp(top, .55).add(V(0, .012, 0)), top], .0165, { seg: 40, sides: 18 }), mCarb, "intake", "in");
      mk(K.put(K.flange(.017, .028, .005, 4, .003), ex0.clone().addScaledVector(ib, .003), ib), mFl, "intake", "in")
    }
    out.lab.plen = V(xc, plY + .05, 0);

    /* ================= CAJA DE LA DISTRIBUCIÓN, MGU-K, PLACA TRASERA ================= */
    const dL = cyl[0].dir, oL = cyl[0].side.clone().negate(), dR = cyl[3].dir, oR = cyl[3].side.clone(), d0 = deckD - H;
    const f = (d, o, u, v) => { const p = d.clone().multiplyScalar(v).addScaledVector(o, u); return [-p.z, p.y] };
    const half = (d, o) => [f(d, o, hwB, d0), f(d, o, hwB, deckD), f(d, o, hw, deckD), f(d, o, hw, deckD + vc), f(d, o, hw - .008, deckD + vtop - .004), f(d, o, hw - .02, deckD + vtop), f(d, o, -(hw - .02), deckD + vtop), f(d, o, -(hw - .008), deckD + vtop - .004), f(d, o, -hw, deckD + vc), f(d, o, -hw, deckD), f(d, o, -hwB, deckD)];
    const hl = half(dL, oL), hr = half(dR, oR).reverse(), P1 = hl[0], P6 = hr[hr.length - 1];
    const outline = [...hl, [0, hwB / sb], ...hr, [P6[0] - .012, -.045], [P6[0] - .004, -.088], [P6[0] + .012, -.098], [P1[0] - .012, -.098], [P1[0] + .004, -.088], [P1[0] + .012, -.045]];
    const toX = (g, x) => g.applyMatrix4(new THREE.Matrix4().makeBasis(V(0, 0, -1), V(0, 1, 0), V(1, 0, 0)).setPosition(V(x, 0, 0)));
    const xF = xmax + .005, depF = .046, xB = xF + .008, xA = [xF + .022, xF + .036], camPts = [];
    for (const [d, o] of [[dL, oL], [dR, oR]]) for (const u of [-uc, uc]) camPts.push(f(d, o, u, deckD + vc));
    /* engranajes: z dientes, módulo m; "ph" es el giro en reposo para que diente y hueco coincidan en cada engrane */
    const G = (z, m, face) => K.gearZ(z, m, face, .0075).rotateY(HP), frac = x => x - Math.floor(x), ang = (a, b) => Math.atan2(b.z - a.z, b.y - a.y);
    const mesh = (A, Bg) => { const fA = frac((ang(A.c, Bg.c) + HP - A.ph) / (TAU / A.z)); Bg.ph = ang(Bg.c, A.c) + HP - (.5 - fA) * (TAU / Bg.z); return Bg };
    const spin = (m, g, k, kind) => (m.rotation.x = g.ph, out.train.push({ m, k, ph: g.ph }), kind && picks.push([m, kind]), m);
    /* MGU-K: en el costado izquierdo del cárter, atornillado por detrás a la caja de engranajes; lo mueve el cigüeñal con una rueda
       intermedia (30 y 9 dientes: 3,33 vueltas del motor eléctrico por cada vuelta del cigüeñal) */
    const mG = .0024, zg = 30, zi2 = 44, zp2 = Math.max(9, Math.round(zg / (ratioK || 3.333))), rg = zg * mG / 2, ri2 = zi2 * mG / 2, rp2 = zp2 * mG / 2;
    const ud = V(0, -.3, -1).normalize(), pI = ud.clone().multiplyScalar(rg + ri2), pK = ud.clone().multiplyScalar(rg + 2 * ri2 + rp2);
    {
      const g0 = { c: V(0, 0, 0), z: zg, ph: 0 }, gi = mesh(g0, { c: pI, z: zi2 }), gp = mesh(gi, { c: pK, z: zp2 });
      const gm = new THREE.Mesh(G(zg, mG, .011).translate(xB, 0, 0), mGear); crank.add(gm), picks.push([gm, "mguk", 0]);
      const im = mk(G(zi2, mG, .011), mGear); im.position.set(xB, pI.y, pI.z), spin(im, gi, -zg / zi2, "mguk");
      const pm = mk(K.merge([G(zp2, mG, .011), new THREE.CylinderGeometry(.006, .006, .03, 14).rotateZ(HP).translate(-.018, 0, 0)]), mGear); pm.position.set(xB, pK.y, pK.z), spin(pm, gp, zg / zp2, "mguk");
      const ribs = [-.1, -.08, -.06, -.04].map(x => latheX([[.046, x - .003], [.0485, x - .003], [.0485, x + .003], [.046, x + .003]], 40));
      out.mguk = mk(K.merge([latheX([[0, -.135], [.03, -.135], [.04, -.128], [.046, -.118], [.046, -.012], [.05, -.012], [.05, 0], [0, 0]]), ...ribs, new THREE.BoxGeometry(.05, .024, .03).translate(-.07, .052, 0), new THREE.CylinderGeometry(.008, .008, .03, 14).rotateZ(HP).translate(-.11, .056, 0)]).translate(xF - .001, pK.y, pK.z), M.motor, "mguk");
      out.lab.mguk = V(xF - .07, pK.y - .065, pK.z)
    }
    /* caja de la distribución: aloja los engranajes de las levas y la toma del MGU-K; por fuera, los salientes de cada eje y los tornillos */
    {
      shell(toX(K.plate(outline, depF), xF), M.alu, "timing");
      const hull2 = (c1, r1, c2, r2, n = 22) => { const dx = c2[0] - c1[0], dy = c2[1] - c1[1], L = Math.hypot(dx, dy), th = Math.atan2(dy, dx), dl = Math.acos(Math.max(-1, Math.min(1, (r1 - r2) / L))), o = []; for (let i = 0; i <= n; i++) { const a = th + dl + (TAU - 2 * dl) * i / n; o.push([c1[0] + r1 * Math.cos(a), c1[1] + r1 * Math.sin(a)]) } for (let i = 1; i < n; i++) { const a = th - dl + 2 * dl * i / n; o.push([c2[0] + r2 * Math.cos(a), c2[1] + r2 * Math.sin(a)]) } return o };
      shell(toX(K.plate(hull2([-pI.z, pI.y], ri2 + .009, [-pK.z, pK.y], rp2 + .016), .022), xF - .002), M.alu, "timing");
      const det = [new THREE.CylinderGeometry(.05, .05, .006, 40).rotateZ(HP).translate(xF + depF + .003, 0, 0), new THREE.CylinderGeometry(.018, .018, .01, 24).rotateZ(HP).translate(xF + depF + .008, 0, 0)];
      for (const [X, Y] of camPts) det.push(new THREE.CylinderGeometry(.022, .022, .005, 28).rotateZ(HP).translate(xF + depF + .0025, Y, -X));
      for (let i = 0; i < outline.length; i++) { const a = outline[i], b = outline[(i + 1) % outline.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / .045)); for (let k = 0; k < n; k++) { const t = (k + .5) / n, X = a[0] + (b[0] - a[0]) * t, Y = a[1] + (b[1] - a[1]) * t; det.push(K.hex(.004, .004).rotateZ(HP).translate(xF + depF + .002, (Y - .11) * .93 + .11, -X * .93)) } }
      mk(K.merge(det), mFl, "timing");
      out.lab.timing = V(xF + depF, deckD * .75, 0)
    }
    /* placa trasera con el paso del cigüeñal y las tapas de los árboles de levas */
    {
      shell(toX(K.plate(outline, .012, [[0, 0, .058]]), xmin - .017), M.alu, "block");
      const det = []; camPts.forEach(([X, Y], i) => i && det.push(new THREE.CylinderGeometry(.02, .02, .005, 24).rotateZ(HP).translate(xmin - .0195, Y, -X), K.hex(.0035, .003).rotateZ(HP).translate(xmin - .023, Y + .014, -X), K.hex(.0035, .003).rotateZ(HP).translate(xmin - .023, Y - .014, -X)));
      mk(K.merge(det), mFl, "block")
    }
    /* tren de engranajes de las levas, uno por bancada (en planos distintos para que quepan con cualquier ángulo de V):
       cigüeñal (24 dientes) → intermedio (36) → rueda doble (32 y 16) → intermedio de culata (36) → las dos levas (24).
       24/32 × 16/24 = 1/2: las levas dan exactamente una vuelta por cada dos del cigüeñal */
    {
      const mB = .0024, zc = 24, zi = 36, zp = 16, z0 = 24, zJ = 36, zb = 32, rcg = zc * mB / 2, ri = zi * mB / 2, rpn = zp * mB / 2;
      const vI = deckD + vc - Math.sqrt(Math.max(1e-6, (ri + rcg) ** 2 - uc * uc)), v2 = vI - rpn - ri, mA = 2 * v2 / (z0 + 2 * zJ + zb), r0 = z0 * mA / 2, rJ = zJ * mA / 2;
      const g0 = { c: V(0, 0, 0), z: z0, ph: 0 }, cg0 = new THREE.Mesh(G(z0, mA, .026).translate((xA[0] + xA[1]) / 2, 0, 0), mGear);
      crank.add(cg0), picks.push([cg0, "timing"]), out.front.push(cg0);
      [[dL, 0], [dR, 1]].forEach(([d, b]) => {
        const at = v => d.clone().multiplyScalar(v), x1 = xA[b];
        const gJ = mesh(g0, { c: at(r0 + rJ), z: zJ }), gC = mesh(gJ, { c: at(v2), z: zb }), gI = mesh({ c: gC.c, z: zp, ph: gC.ph }, { c: at(vI), z: zi });
        const j = mk(G(zJ, mA, .011), mGear); j.position.copy(gJ.c).setX(x1), spin(j, gJ, -z0 / zJ, "timing");
        const c2 = mk(K.merge([G(zb, mA, .011), G(zp, mB, .011).translate(xB - x1, 0, 0), new THREE.CylinderGeometry(.009, .009, x1 - xB, 14).rotateZ(HP).translate((xB - x1) / 2, 0, 0)]), mGear); c2.position.copy(gC.c).setX(x1), spin(c2, gC, z0 / zb, "timing");
        const ii = mk(G(zi, mB, .011), mGear); ii.position.copy(gI.c).setX(xB), spin(ii, gI, -(z0 / zb) * (zp / zi), "timing");
        out.front.push(j, c2, ii);
        for (const cgp of cams.slice(b * 2, b * 2 + 2)) { const gc = mesh(gI, { c: V(0, cgp.position.y, cgp.position.z), z: zc }), gm = new THREE.Mesh(K.merge([G(zc, mB, .011), new THREE.CylinderGeometry(.0105, .0105, .06, 20).rotateZ(HP).translate(-.03, 0, 0)]).translate(xB - cgp.position.x, 0, 0), mGear); gm.rotation.x = gc.ph, cgp.add(gm), picks.push([gm, "timing"]), out.front.push(gm) }
      })
    }
    /* bombas de aceite de cárter seco: una fila de etapas a lo largo del costado derecho del cárter, movidas desde la caja delantera */
    {
      const n = 6, L = xmax - xmin - .05, st = L / n, gs = [latheX([[0, -L], [.012, -L], [.02, -L + .006], [.02, 0], [0, 0]], 28)];
      for (let i = 0; i < n; i++) gs.push(latheX([[.02, -.004], [.0235, -.004], [.0235, .004], [.02, .004]], 28).translate(-(i + .5) * st, 0, 0), new THREE.CylinderGeometry(.007, .007, .014, 12).translate(-(i + .5) * st, -.024, 0), K.hex(.0085, .005).translate(-(i + .5) * st, -.033, 0));
      const wy = -.07, wz = -(P6[0] - .012 + .008 * ((-.045 - wy) / .043)) + .017;
      shell(K.merge(gs).translate(xF, wy, wz), mFl, "oil"), out.lab.oil = V(xc, wy - .03, wz + .03)
    }

    /* tornillería a la vista: tapas de levas, tornillos pasantes de los apoyos del cigüeñal en los costados del cárter y bandeja inferior */
    {
      const det = [], xs = cyl.map(q => q.x), sp = Math.abs(cyl[0].x - cyl[1].x), x0 = Math.min(...xs), offB = Math.abs(cyl[3].x - cyl[0].x);
      for (const q of cyl) for (const su of [-1, 1]) for (const sx of [-1, 1]) det.push(K.put(K.hex(.0042, .004), q.dir.clone().multiplyScalar(deckD + vtop + .001).addScaledVector(q.side, su * (hw - .03)).setX(q.x + sx * B * .52), q.dir));
      for (let m = -1; m <= 2; m++) { const x = x0 + (m + .5) * sp + offB / 2; if (x < xmin + .004 || x > xmax - .004) continue; for (const sg of [-1, 1]) for (const [y, dX] of [[-.012, .0036], [-.036, .0098]]) det.push(K.put(K.hex(.0058, .005), V(x, y, sg * (Math.abs(P1[0]) + dX + .001)), V(0, 0, sg))) }
      for (let x = xmin + .02; x < xmax - .01; x += .042) for (const sg of [-1, 1]) det.push(K.put(K.hex(.004, .004), V(x, -.0995, sg * (Math.abs(P1[0]) - .024)), V(0, -1, 0)));
      mk(K.merge(det), mFl, "block")
    }

    /* ================= EMBRAGUE (gira con el cigüeñal) ================= */
    {
      const xcl = xmin - .03, R2 = (a, b) => new THREE.Vector2(a, b), gs = [], sp = [];
      for (let k = 0; k < 12; k++) gs.push(new THREE.LatheGeometry([R2(.0505, -.03), R2(.0545, -.03), R2(.0545, .004), R2(.0505, .004), R2(.0505, -.03)], 5, k / 12 * TAU, TAU / 12 * .6).rotateZ(-HP));
      gs.push(latheX([[.018, .004], [.0545, .004], [.0545, .008], [.018, .008], [.018, .004]], 48), latheX([[.026, -.0245], [.05, -.0245], [.05, -.0208], [.026, -.0208], [.026, -.0245]], 48), latheX([[.043, -.034], [.0545, -.034], [.0545, -.03], [.043, -.03], [.043, -.034]], 48));
      const bk = new THREE.Mesh(K.merge(gs).translate(xcl, 0, 0), mBlk); bk.userData.shell = 1, crank.add(bk), picks.push([bk, "clutch"]);
      /* muelle de diafragma: 18 dedos que el cojinete de empuje aprieta por el centro */
      for (let k = 0; k < 18; k++) sp.push(new THREE.BoxGeometry(.0016, .032, .0058).rotateZ(-.3).translate(-.0345, .029, 0).rotateX(k / 18 * TAU));
      sp.push(latheX([[.008, -.05], [.015, -.05], [.015, -.039], [.008, -.039], [.008, -.05]], 28));
      const sm = new THREE.Mesh(K.merge(sp).translate(xcl, 0, 0), M.spring); crank.add(sm), picks.push([sm, "clutch"]);
      /* eje de salida estriado, hacia la caja de cambios */
      const shf = new THREE.CylinderGeometry(.011, .011, .08, 36, 1), pa = shf.attributes.position;
      for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), z = pa.getZ(i); Math.hypot(x, z) > .005 && Math.round(Math.atan2(z, x) / (Math.PI / 18)) % 2 && pa.setXYZ(i, x * .9, pa.getY(i), z * .9) }
      shf.computeVertexNormals();
      const om = new THREE.Mesh(shf.rotateZ(HP).translate(xcl - .078, 0, 0), M.steel); crank.add(om), picks.push([om, "clutch"]);
      out.lab.clutch = V(xcl - .02, -.075, 0)
    }

    /* ================= ENCENDIDO E INYECCIÓN ================= */
    {
      const coil = [], inj = [], hC = vtop - .06, top = {};
      for (const q of cyl) {
        const m4 = K.basis(q.dir, q.dir.clone().multiplyScalar(deckD + .06).setX(q.x)), zc = (q.left ? 1 : -1) * .015;
        coil.push(K.latheHard([[.0078, 0], [.0078, hC - .002], [.0125, hC + .002], [.0125, hC + .016], [.009, hC + .02], [0, hC + .02]], 20).applyMatrix4(m4), new THREE.BoxGeometry(.014, .011, .02).translate(0, hC + .009, zc).applyMatrix4(m4));
        /* inyector directo en el lado de admisión, bajo el conducto */
        const ib = q.side.clone().multiplyScalar(q.left ? 1 : -1), a = q.dir.clone().multiplyScalar(deckD + .003).addScaledVector(ib, B * .44).setX(q.x), b = q.dir.clone().multiplyScalar(deckD + .026).addScaledVector(ib, hw + .012).setX(q.x), dd = b.clone().sub(a).normalize();
        inj.push(K.put(K.latheHard([[.0035, 0], [.0035, .018], [.0062, .022], [.0062, .052], [.009, .054], [.009, .072], [.005, .075], [0, .075]], 18), a.clone(), dd));
        (top[q.left] = top[q.left] || []).push(a.clone().addScaledVector(dd, .068))
      }
      mk(K.merge(coil), mBlk, "coil"), mk(K.merge(inj), mFl, "fuel");
      /* rampa de cada bancada; bomba de alta presión en la cola de la leva de admisión izquierda y sus dos tubos hasta las rampas */
      const fuel = [], rail = {};
      for (const left of [!0, !1]) { const t = top[left].sort((p, q2) => p.x - q2.x), a = t[0].clone().setX(t[0].x - .03), b = t[2].clone().setX(t[2].x + .03); fuel.push(K.sweep([a, b], .0068, { sides: 14, cap0: !0, cap1: !0 })), rail[left] = a }
      const ci = cams[0].position, pmp = V(xmin - .017, ci.y, ci.z), po = pmp.clone().add(V(-.03, .024, 0)), rL = rail[!0], rR = rail[!1];
      fuel.push(K.put(K.latheHard([[0, 0], [.02, 0], [.02, .008], [.024, .012], [.024, .05], [.017, .056], [0, .056]], 28), pmp.clone(), V(-1, 0, 0)), K.put(K.hex(.006, .012), po.clone().add(V(0, -.004, 0)), V(0, 1, 0)));
      fuel.push(pipe("comb1", [po, po.clone().add(V(0, .012, .04)), V(xmin - .03, rL.y + .03, rL.z - .02), rL.clone().add(V(-.02, .002, 0)), rL.clone().add(V(.004, 0, 0))], .0042, { seg: 40, sides: 10 }));
      fuel.push(pipe("comb2", [po.clone().add(V(-.008, 0, 0)), V(po.x - .008, po.y + .02, po.z + .07), V(xmin - .04, po.y + .01, rR.z - .04), V(xmin - .035, rR.y + .02, rR.z), rR.clone().add(V(-.02, .002, 0)), rR.clone().add(V(.004, 0, 0))], .0042, { seg: 52, sides: 10 }));
      mk(K.merge(fuel), mFl, "fuel"), out.lab.pump = pmp.clone().add(V(-.03, .05, 0)), out.lab.coil = cyl[4].dir.clone().multiplyScalar(deckD + vtop + .03).setX(cyl[4].x)
    }
    Object.assign(out, { turbo, comp, turb, ty, Xc, Xt });
    return out
  }
  /* panal del intercooler: aletas finas entre tubos planos */
  function finTex(THREE) {
    const c = document.createElement("canvas"); c.width = 256, c.height = 128; const g = c.getContext("2d");
    g.fillStyle = "#8f969d", g.fillRect(0, 0, 256, 128);
    for (let y = 0; y < 128; y += 16) { g.fillStyle = "#c9ced3", g.fillRect(0, y, 256, 3); for (let x = 0; x < 256; x += 4) g.fillStyle = x % 8 ? "#5d646b" : "#aeb4ba", g.fillRect(x, y + 3, 2, 13) }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping, t.repeat.set(6, 3), t.colorSpace = THREE.SRGBColorSpace, t.anisotropy = 4; return t
  }
  /* rejilla de la toma de aire */
  function meshTex(THREE) {
    const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
    g.clearRect(0, 0, 128, 128), g.strokeStyle = "#9aa1a8", g.lineWidth = 2;
    for (let i = 0; i <= 128; i += 8) g.beginPath(), g.moveTo(i, 0), g.lineTo(i, 128), g.moveTo(0, i), g.lineTo(128, i), g.stroke();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
  }
  /* comprobación de que ningún tubo atraviesa a otro: separación mínima entre ejes menos la suma de radios (negativo = se cortan).
     Los extremos (2 cm) no cuentan: ahí es donde cada tubo entra en su brida, su colector o su carcasa */
  function check(min = 0) {
    const res = [];
    const trim = T => { const o = [], L = []; let s = 0; for (let k = 0; k < T.P.length; k++) k && (s += T.P[k].distanceTo(T.P[k - 1])), L.push(s); for (let k = 0; k < T.P.length; k++) L[k] > .02 && L[k] < s - .02 && o.push(T.P[k]); return o };
    const tr = tubes.map(trim);
    for (let i = 0; i < tubes.length; i++) for (let j = i + 1; j < tubes.length; j++) {
      let best = 1e9, at = null;
      for (const p of tr[i]) for (const q of tr[j]) { const d = p.distanceTo(q); d < best && (best = d, at = p) }
      const cl = best - tubes[i].r - tubes[j].r;
      cl < min && res.push([tubes[i].n, tubes[j].n, +(cl * 1e3).toFixed(1), at && [+at.x.toFixed(3), +at.y.toFixed(3), +at.z.toFixed(3)]])
    }
    return res
  }
  return { build, check }
})();
