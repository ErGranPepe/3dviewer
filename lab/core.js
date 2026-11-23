/* Laboratorio técnico de Parrilla Neuronal: utilidades comunes (parámetros, gráficas, FFT, exportación) */
"use strict";
const LAB = {};
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const fmt = (v, d = 1) => !isFinite(v) ? "—" : Math.abs(v) >= 1e4 ? v.toFixed(0) : v.toFixed(d);
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const el = (tag, attrs = {}, kids = []) => {
  const e = document.createElement(tag);
  for (const k in attrs) k === "text" ? e.textContent = attrs[k] : k === "html" ? e.innerHTML = attrs[k] : k.startsWith("on") ? e.addEventListener(k.slice(2), attrs[k]) : e.setAttribute(k, attrs[k]);
  for (const c of [].concat(kids)) c != null && e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  return e
};

/* ---------- modo fácil / ingeniero ---------- */
LAB.mode = (() => { try { return localStorage.getItem("lab-mode") || "easy" } catch { return "easy" } })();
LAB.setMode = m => {
  LAB.mode = m, document.body.dataset.mode = m;
  try { localStorage.setItem("lab-mode", m) } catch {}
  for (const b of document.querySelectorAll("[data-setmode]")) b.classList.toggle("on", b.dataset.setmode === m);
  window.dispatchEvent(new Event("labmode"))
};

/* ---------- panel de parámetros ----------
   def: {id, label, unit, min, max, step, v, adv (solo ingeniero), help, scale (unidad mostrada = interna*scale), opts (select)} */
class Params {
  constructor(host, groups, onChange) {
    this.v = {}, this.defs = {}, this.inputs = {}, this.onChange = onChange, this.host = host;
    for (const g of groups) {
      const box = el("details", { class: "pg" + (g.adv ? " adv" : ""), ...(g.open ? { open: "" } : {}) }, [el("summary", { text: g.title })]);
      g.help && box.appendChild(el("p", { class: "ghelp", text: g.help }));
      for (const d of g.items) {
        this.defs[d.id] = d, this.v[d.id] = d.v;
        const row = el("div", { class: "prow" + (d.adv ? " adv" : ""), title: d.help || "" });
        const lab = el("label", { text: d.label });
        if (d.opts) {
          const s = el("select", {});
          for (const [val, txt] of d.opts) s.appendChild(el("option", { value: val, text: txt }));
          s.value = d.v, s.addEventListener("change", () => { this.v[d.id] = isNaN(+s.value) ? s.value : +s.value, this.changed(d.id) });
          row.append(lab, s), this.inputs[d.id] = { s }
        } else {
          const sc = d.scale || 1,
            r = el("input", { type: "range", min: d.min, max: d.max, step: d.step || (d.max - d.min) / 200 }),
            n = el("input", { type: "number", min: d.min, max: d.max, step: d.step || "any" }),
            u = el("span", { class: "unit", text: d.unit || "" });
          r.value = n.value = +(d.v * sc).toPrecision(6);
          const set = x => { x = clamp(+x, d.min, d.max); if (!isFinite(x)) return; r.value = n.value = +x.toPrecision(6), this.v[d.id] = x / sc, this.changed(d.id) };
          r.addEventListener("input", () => set(r.value)), n.addEventListener("change", () => set(n.value));
          row.append(lab, r, n, u), this.inputs[d.id] = { r, n }
        }
        d.help && row.appendChild(el("p", { class: "phelp", text: d.help }));
        box.appendChild(row)
      }
      host.appendChild(box)
    }
  }
  changed(id) { this.onChange && this.onChange(id) }
  set(vals, silent) {
    for (const k in vals) {
      if (!(k in this.defs)) continue;
      const d = this.defs[k], x = vals[k];
      this.v[k] = x;
      const I = this.inputs[k];
      I.s ? I.s.value = x : (I.r.value = I.n.value = +(x * (d.scale || 1)).toPrecision(6))
    }
    silent || this.changed("*")
  }
}

/* ---------- gráfica de líneas (osciloscopio o XY) ---------- */
class Plot {
  constructor(canvas, o = {}) {
    this.c = canvas, this.g = canvas.getContext("2d"), this.o = o, this.series = [], this.marks = [];
    const ro = new ResizeObserver(() => this.fit());
    ro.observe(canvas), this.fit()
  }
  fit() {
    const r = this.c.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    const W = Math.max(50, r.width), H = Math.max(40, r.height);
    if (W === this.W && H === this.H && this.c.width === Math.round(W * dpr)) return;
    this.W = W, this.H = H, this.c.width = Math.round(W * dpr), this.c.height = Math.round(H * dpr), this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    /* al cambiar de tamaño el lienzo se borra: se vuelve a pintar lo último */
    this.last && this.draw(...this.last)
  }
  /* series: [{x:Float32Array|null, y:Float32Array, n, col, label, w, dash, fill}] */
  draw(series, o = {}) {
    this.last = [series, o];
    const g = this.g, W = this.W, H = this.H, O = { ...this.o, ...o }, L = 46, R = 10, T = 18, B = 22;
    g.clearRect(0, 0, W, H);
    let x0 = O.xmin, x1 = O.xmax, y0 = O.ymin, y1 = O.ymax;
    if (x0 == null || x1 == null || y0 == null || y1 == null) {
      let a = 1e30, b = -1e30, c = 1e30, d = -1e30;
      for (const s of series) for (let i = 0; i < s.n; i++) { const xv = s.x ? s.x[i] : i, yv = s.y[i]; if (!isFinite(yv)) continue; xv < a && (a = xv), xv > b && (b = xv), yv < c && (c = yv), yv > d && (d = yv) }
      x0 ??= a, x1 ??= b;
      if (y0 == null || y1 == null) { const pad = (d - c) * .08 || Math.abs(d) * .1 || 1; y0 ??= c - pad, y1 ??= d + pad }
      O.zero && (y0 = Math.min(y0, 0), y1 = Math.max(y1, 0))
    }
    if (!(x1 > x0)) x1 = x0 + 1;
    if (!(y1 > y0)) y1 = y0 + 1;
    const X = v => L + (v - x0) / (x1 - x0) * (W - L - R), Y = v => H - B - (v - y0) / (y1 - y0) * (H - T - B);
    this.map = { X, Y, x0, x1, y0, y1, L, R, T, B };
    g.font = "10px " + (css("--mono") || "monospace"), g.fillStyle = "#8b97a4", g.strokeStyle = "rgba(255,255,255,.06)", g.lineWidth = 1;
    const tick = (a, b, n) => { const st = Math.pow(10, Math.floor(Math.log10((b - a) / n))), m = [1, 2, 2.5, 5, 10].find(k => (b - a) / (st * k) <= n) * st; const out = []; for (let v = Math.ceil(a / m) * m; v <= b + 1e-9; v += m) out.push(+v.toPrecision(10)); return out };
    for (const v of tick(y0, y1, 5)) { const y = Y(v); g.beginPath(), g.moveTo(L, y), g.lineTo(W - R, y), g.stroke(), g.textAlign = "right", g.fillText(fmtTick(v), L - 4, y + 3) }
    for (const v of tick(x0, x1, Math.max(3, W / 90 | 0))) { const x = X(v); g.beginPath(), g.moveTo(x, T), g.lineTo(x, H - B), g.stroke(), g.textAlign = "center", g.fillText(fmtTick(v), x, H - 8) }
    O.zero !== !1 && y0 < 0 && y1 > 0 && (g.strokeStyle = "rgba(255,255,255,.18)", g.beginPath(), g.moveTo(L, Y(0)), g.lineTo(W - R, Y(0)), g.stroke());
    for (const m of O.hlines || []) g.strokeStyle = m.col, g.setLineDash([4, 4]), g.beginPath(), g.moveTo(L, Y(m.y)), g.lineTo(W - R, Y(m.y)), g.stroke(), g.setLineDash([]), m.label && (g.fillStyle = m.col, g.textAlign = "left", g.fillText(m.label, L + 4, Y(m.y) - 3));
    for (const m of O.vlines || []) g.strokeStyle = m.col, g.setLineDash([3, 4]), g.beginPath(), g.moveTo(X(m.x), T), g.lineTo(X(m.x), H - B), g.stroke(), g.setLineDash([]), m.label && (g.fillStyle = m.col, g.textAlign = "left", g.fillText(m.label, X(m.x) + 3, T + 10));
    g.save(), g.beginPath(), g.rect(L, T, W - L - R, H - T - B), g.clip();
    for (const s of series) {
      if (!s.n) continue;
      g.strokeStyle = s.col, g.lineWidth = s.w || 1.6, g.setLineDash(s.dash || []), g.beginPath();
      const step = Math.max(1, Math.floor(s.n / (W * 2)));
      for (let i = 0; i < s.n; i += step) { const x = X(s.x ? s.x[i] : i), y = Y(s.y[i]); i ? g.lineTo(x, y) : g.moveTo(x, y) }
      if (s.fill) { g.stroke(); g.lineTo(X(s.x ? s.x[s.n - 1] : s.n - 1), Y(Math.max(y0, 0))), g.lineTo(X(s.x ? s.x[0] : 0), Y(Math.max(y0, 0))), g.fillStyle = s.fill, g.fill() } else g.stroke();
      g.setLineDash([])
    }
    for (const p of O.points || []) g.fillStyle = p.col, g.beginPath(), g.arc(X(p.x), Y(p.y), p.r || 3.5, 0, TAU), g.fill();
    g.restore();
    let lx = L + 6;
    g.textAlign = "left", g.font = "600 10px " + (css("--body") || "sans-serif");
    for (const s of series) if (s.label) { g.fillStyle = s.col, g.fillRect(lx, 5, 10, 3), g.fillStyle = "#c9d2db", g.fillText(s.label, lx + 13, 10), lx += g.measureText(s.label).width + 26 }
    O.title && (g.fillStyle = "#e9eef3", g.textAlign = "right", g.font = "600 11px " + (css("--body") || "sans-serif"), g.fillText(O.title, W - R, 11));
    O.xlabel && (g.fillStyle = "#5b6672", g.textAlign = "right", g.font = "10px sans-serif", g.fillText(O.xlabel, W - R, H - 8 - 11))
  }
}
function fmtTick(v) { const a = Math.abs(v); return a >= 1e4 ? (v / 1e3).toFixed(0) + "k" : a >= 100 ? v.toFixed(0) : a >= 1 ? +v.toFixed(2) + "" : a === 0 ? "0" : +v.toPrecision(2) + "" }

/* ---------- FFT (radix-2, real) ---------- */
function fftMag(sig, dt) {
  let n = 1;
  for (; n < sig.length;) n <<= 1;
  const re = new Float64Array(n), im = new Float64Array(n), N0 = sig.length;
  let mean = 0;
  for (let i = 0; i < N0; i++) mean += sig[i];
  mean /= N0;
  for (let i = 0; i < N0; i++) { const w = .5 - .5 * Math.cos(TAU * i / (N0 - 1)); re[i] = (sig[i] - mean) * w }
  for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]], [im[i], im[j]] = [im[j], im[i]] } }
  for (let len = 2; len <= n; len <<= 1) {
    const a = -TAU / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) { const ur = re[i + k], ui = im[i + k], vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr; re[i + k] = ur + vr, im[i + k] = ui + vi, re[i + k + len / 2] = ur - vr, im[i + k + len / 2] = ui - vi; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr, cr = t } }
  }
  const m = n >> 1, f = new Float32Array(m), A = new Float32Array(m);
  for (let k = 0; k < m; k++) f[k] = k / (n * dt), A[k] = 4 * Math.hypot(re[k], im[k]) / N0;
  return { f, A, n: m }
}

/* ---------- exportar CSV ---------- */
function downloadCSV(name, cols, rows) {
  const s = cols.join(";") + "\n" + rows.map(r => r.map(v => typeof v === "number" ? (+v.toPrecision(7)).toString().replace(".", ",") : v).join(";")).join("\n");
  const a = el("a", { href: URL.createObjectURL(new Blob([s], { type: "text/csv" })), download: name });
  document.body.appendChild(a), a.click(), a.remove()
}

/* ---------- indicadores (tarjetas con valor) ---------- */
class Readouts {
  constructor(host, items) {
    this.v = {};
    for (const it of items) {
      const c = el("div", { class: "ro" + (it.adv ? " adv" : ""), title: it.help || "" }, [el("span", { class: "rl", text: it.label }), el("b", { text: "—" }), el("small", { text: it.unit || "" })]);
      host.appendChild(c), this.v[it.id] = { b: c.querySelector("b"), c, it }
    }
  }
  set(id, val, d = 1, state) {
    const r = this.v[id];
    if (!r) return;
    r.b.textContent = typeof val === "string" ? val : fmt(val, d), r.c.dataset.state = state || ""
  }
}

/* ---------- comparación con datos reales publicados ----------
   Cada fila pone al lado el valor del Laboratorio y el dato real (un límite del reglamento o una cifra que el fabricante ha hecho
   pública) con su fuente. ok: true = dentro, false = fuera, null = no hay dato real con el que comparar. */
LAB.bench = (host, rows, srcs) => {
  if (!host) return;
  host.innerHTML = `<b>Comparado con datos reales</b><div class="bh"><span>Magnitud</span><span>Laboratorio</span><span>Dato real publicado</span></div>` + rows.map(r => `<div class="br ${r.ok === !0 ? "ok" : r.ok === !1 ? "bad" : r.ok === "near" ? "near" : ""}"><span>${r.k}</span><span>${r.lab}</span><span>${r.real}${r.s ? ` <sup>${r.s}</sup>` : ""}</span></div>`).join("") + `<small>✓ dentro del límite o del dato publicado · ≈ cerca (a menos de un 10 %) · ✗ fuera. Solo se compara lo que es público: los límites del reglamento y las cifras que han dado los fabricantes. Presiones, temperaturas y tensiones internas no se publican.<br>Fuentes: ` + srcs.map((q, i) => `<sup>${i + 1}</sup> <a href="${q[1]}" target="_blank" rel="noopener">${q[0]}</a>`).join(" · ") + `</small>`
};
LAB.nf = (v, d = 0) => v.toFixed(d).replace(".", ",");
LAB.SRC = {
  fia22: ["FIA, Reglamento Técnico de F1 2022 (ed. 5)", "https://api.fia.com/sites/default/files/2022_formula_1_technical_regulations_-_iss_5_-_2021-07-08.pdf"],
  mbw16: ["Mercedes-AMG F1, ficha técnica del W16", "https://www.mercedesamgf1.com/f1-w16-2025-technical-specifications"],
  mb50: ["Motorsport.com, 13-9-2017: Mercedes supera el 50 % en banco", "https://www.motorsport.com/f1/news/mercedes-f1-engine-hits-new-benchmark-on-dyno-952330/"],
  mbpu26: ["Mercedes-AMG F1, cambios de la unidad de potencia en 2026", "https://www.mercedesamgf1.com/facts-and-stats-power-unit-regulation-changes"],
  mbch26: ["Mercedes-AMG F1, cambios del chasis en 2026", "https://www.mercedesamgf1.com/facts-and-stats-chassis-regulation-changes"],
  honda26: ["Honda, el reglamento de 2026", "https://global.honda/en/F1/features/2026_Commentary/regulations/"],
  pirelli19: ["Pirelli, gama de 2019 (ventanas de temperatura)", "https://press.pirelli.com/whats-new-with-pirellis-2019-formula-1-tyres/"]
};
