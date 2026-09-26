/* Scenes, part A: touch, bits, envelopes, radio, fiber. */
(() => {
'use strict';
const A = window.APP;
const { clamp, lerp, sstep, rng } = A.u;
const TAU = Math.PI * 2;

/* ================= TOUCH ================= */
(() => {
  const TOUCH = [0.6, 0.3];
  const PU = 1, PV = 0.62;
  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function textAt(c, str, u, v, size, color, o = {}) {
    c.save();
    c.translate(u, v);
    c.scale(0.01, 0.01);
    c.font = (o.weight || 400) + ' ' + size + 'px ' + (o.mono ? '"Source Code Pro", monospace' : 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif');
    c.fillStyle = color;
    c.textBaseline = 'middle';
    c.textAlign = o.align || 'left';
    c.fillText(str, 0, 0);
    c.restore();
  }
  A.SC.touch = {
    keys: [[0, 0], [0.45, 0], [2.6, 4.0], [3, 4.0]],
    draw(c, st) {
      const { s, a, now, V, W, H } = st;
      const d = A.dpr;
      A.bg('#0A0E14', '#040609', a);
      const iso = 1 - sstep(1.85, 2.55, s);
      const ex = sstep(0.05, 0.85, s) * iso;
      const pT = sstep(0.3, 0.75, s);
      const R = Math.min(V.w * (A.mobile ? 0.34 : 0.4), V.h * 0.62);
      const flatA = [R, 0], flatB = [0, R];
      const Ri = R * 0.96;
      const isoA = [Ri * 0.866, Ri * 0.5], isoB = [-Ri * 0.866, Ri * 0.5];
      const Ax = lerp(flatA[0], isoA[0], iso), Ay = lerp(flatA[1], isoA[1], iso);
      const Bx = lerp(flatB[0], isoB[0], iso), By = lerp(flatB[1], isoB[1], iso);
      const sep = V.h * (A.mobile ? 0.25 : 0.2) * ex;
      const ox = V.cx, oy = V.cy + (A.mobile ? 0 : V.h * 0.02);
      const P = (u, v, k) => [ox + u * Ax + v * Bx, oy + u * Ay + v * By - (k - 1) * sep];
      const setT = (k) => c.setTransform(d * Ax, d * Ay, d * Bx, d * By, d * ox, d * (oy - (k - 1) * sep));
      const tp = P(TOUCH[0], TOUCH[1], 2);
      A.vignette(tp[0], tp[1], V.w * 0.7, 'rgba(255,160,60,.10)', a * (0.4 + 0.6 * pT));
      const lw = 1 / R;
      const press = sstep(2.15, 2.35, s) * (1 - sstep(2.6, 2.9, s));

      // --- display layer (k=0)
      c.save(); setT(0); c.globalAlpha = a;
      roundRect(c, -PU, -PV, PU * 2, PV * 2, 0.08);
      c.fillStyle = '#0B1015'; c.fill();
      c.lineWidth = lw; c.strokeStyle = 'rgba(169,181,193,.28)'; c.stroke();
      roundRect(c, -0.9, -0.46, 0.92, 0.26, 0.11); c.fillStyle = '#1C2631'; c.fill();
      textAt(c, A.t('chat.in1'), -0.83, -0.33, 8, '#E9EEF2');
      roundRect(c, -0.9, 0.17, 1.28, 0.26, 0.13); c.fillStyle = '#111922'; c.fill();
      c.strokeStyle = 'rgba(233,238,242,.14)'; c.stroke();
      let msg = A.msg.text; if (msg.length > 22) msg = msg.slice(0, 21) + '…';
      textAt(c, msg, -0.82, 0.3, 7.6, '#E9EEF2');
      const br = 0.13 * (1 - press * 0.1);
      c.beginPath(); c.arc(TOUCH[0], TOUCH[1], br, 0, TAU);
      c.fillStyle = press > 0 ? A.rgba('#FFD89A', 1) : A.C.signal; c.fill();
      c.strokeStyle = '#1E1200'; c.lineWidth = 0.02; c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath(); c.moveTo(TOUCH[0] - 0.06, TOUCH[1]); c.lineTo(TOUCH[0] + 0.05, TOUCH[1]);
      c.moveTo(TOUCH[0] + 0.005, TOUCH[1] - 0.05); c.lineTo(TOUCH[0] + 0.055, TOUCH[1]); c.lineTo(TOUCH[0] + 0.005, TOUCH[1] + 0.05); c.stroke();
      c.restore();

      // --- sensor layer (k=1): diamond lattice (TX rows + RX columns)
      c.save(); setT(1); c.globalAlpha = a;
      const g = 0.155, hd = g * 0.44;
      const scanOn = s > 0.8 && s < 2.45;
      const rows = Math.ceil((PV * 2) / g) + 1;
      const scanRow = Math.floor((now * 16) % rows);
      const field = (u, v) => Math.exp(-((u - TOUCH[0]) ** 2 + (v - TOUCH[1]) ** 2) / (2 * 0.13 * 0.13));
      c.lineWidth = lw;
      const lat = 0.22 + 0.25 * ex + 0.15 * (1 - iso);
      for (let pass = 0; pass < 2; pass++) {
        const off = pass === 0 ? 0 : g / 2;
        for (let j = 0, v = -PV + off; v <= PV + 1e-6; v += g, j++) {
          for (let u = -PU + off; u <= PU + 1e-6; u += g) {
            const f = field(u, v) * pT;
            c.beginPath();
            c.moveTo(u, v - hd); c.lineTo(u + hd, v); c.lineTo(u, v + hd); c.lineTo(u - hd, v); c.closePath();
            if (f > 0.02) { c.fillStyle = A.rgba(A.C.signal, f * 0.55); c.fill(); }
            const hot = pass === 0 && scanOn && j === scanRow;
            c.strokeStyle = hot ? 'rgba(228,233,238,.8)' : (pass === 0 ? 'rgba(122,168,205,' + lat + ')' : 'rgba(127,140,153,' + lat * 0.85 + ')');
            c.stroke();
            if (u + g <= PU + 1e-6 || v + g <= PV + 1e-6) {
              c.beginPath();
              if (pass === 0) { c.moveTo(u + hd, v); c.lineTo(u + g - hd, v); } else { c.moveTo(u, v + hd); c.lineTo(u, v + g - hd); }
              c.stroke();
            }
          }
        }
      }
      c.restore();

      // readout matrix (screen space, sensor layer)
      const mA = a * sstep(1.0, 1.35, s) * (1 - sstep(2.05, 2.35, s));
      if (mA > 0.01) {
        const r = rng(7);
        for (let i = -2; i <= 2; i++) {
          for (let j = -2; j <= 2; j++) {
            const u = TOUCH[0] + i * g * 0.5, v = TOUCH[1] + j * g * 0.5;
            const val = Math.max(0, Math.round(118 * field(u, v) + (r() - 0.5) * 6 + Math.sin(now * 7 + i * 3 + j) * 1.5));
            const p = P(u, v, 1);
            A.label(String(val), p[0], p[1], { a: mA * (0.45 + 0.55 * Math.min(1, val / 90)), color: val > 60 ? A.C.signal2 : A.C.mist, size: 9.5, align: 'center', upper: false, spacing: false });
          }
        }
      }

      // --- glass layer (k=2)
      c.save(); setT(2); c.globalAlpha = a * (0.25 + 0.75 * iso);
      roundRect(c, -PU, -PV, PU * 2, PV * 2, 0.08);
      const gg = c.createLinearGradient(-PU, -PV, PU, PV);
      gg.addColorStop(0, 'rgba(170,200,230,.10)'); gg.addColorStop(0.5, 'rgba(170,200,230,.03)'); gg.addColorStop(1, 'rgba(170,200,230,.08)');
      c.fillStyle = gg; c.fill();
      c.lineWidth = lw * 1.2; c.strokeStyle = 'rgba(210,225,240,.35)'; c.stroke();
      c.restore();
      // ripple (glass)
      if (pT > 0) {
        c.save(); setT(2); c.globalAlpha = a;
        for (let k = 0; k < 3; k++) {
          const ph = ((now * 0.8 + k / 3) % 1);
          const rr = 0.05 + ph * 0.55;
          c.beginPath(); c.arc(TOUCH[0], TOUCH[1], rr, 0, TAU);
          c.strokeStyle = A.rgba(A.C.signal, (1 - ph) * 0.5 * pT * (1 - sstep(2.5, 3, s)));
          c.lineWidth = lw * 1.4; c.stroke();
        }
        c.restore();
        A.glow(tp[0], tp[1], 40 + 20 * press, 'amber', a * pT * (0.75 + 0.25 * Math.sin(now * 5)));
      }

      // layer callouts
      const cA = a * sstep(0.35, 0.8, s) * iso;
      if (cA > 0.01) {
        [[2, 'c.glass'], [1, 'c.sensor'], [0, 'c.display']].forEach(([k, key], i) => {
          if (A.mobile) {
            const p = P(-PU, -PV, k);
            A.label(A.t(key), Math.max(12, p[0] - 10), p[1] - 14, { a: cA, size: 10, color: A.C.fog, bg: 'rgba(6,8,12,.85)' });
          } else {
            const p = P(PU, PV * 0.1, k);
            A.callout(p[0], p[1], Math.min(W - 150, p[0] + 34 + i * 6), p[1], A.t(key), { a: cA });
          }
        });
      }

      // coordinates (flat view)
      const xA = a * sstep(2.05, 2.4, s) * (1 - sstep(2.8, 3.0, s));
      if (xA > 0.01) {
        const p = P(TOUCH[0], TOUCH[1], 2);
        const l = P(-PU, TOUCH[1], 2), tpp = P(TOUCH[0], -PV, 2);
        c.save(); c.globalAlpha = xA; c.strokeStyle = A.rgba(A.C.signal, 0.75); c.setLineDash([4, 4]); c.lineWidth = 1;
        c.beginPath(); c.moveTo(l[0], p[1]); c.lineTo(p[0] - 16, p[1]); c.moveTo(p[0], tpp[1]); c.lineTo(p[0], p[1] - 16); c.stroke();
        c.setLineDash([]); c.beginPath(); c.arc(p[0], p[1], 12, 0, TAU); c.stroke();
        c.restore();
        A.label('x = 928', l[0] + 6, p[1] - 12, { a: xA, color: A.C.signal2, size: 11 });
        A.label('y = 2' + ' ' + '214', p[0] + 8, tpp[1] + 14, { a: xA, color: A.C.signal2, size: 11 });
        A.label(A.t('c.tapOk'), p[0], p[1] + 62, { a: xA, color: A.C.fog, size: 11, align: 'center', bg: 'rgba(6,8,12,.88)' });
      }
    }
  };
})();

/* ================= BITS ================= */
(() => {
  let els = null;
  let state = [];
  const R = rng(1234);
  function firstChar() {
    const chars = A.msg.chars;
    return chars.find((c) => c.ch.trim()) || chars[0];
  }
  A.SC.bits = {
    keys: [[0, 4.0], [1.6, 4.0005], [2.4, 4.0005], [3.4, 4.002], [4, 4.002]],
    vars(k) {
      const f = firstChar();
      const n = A.msg.bytes.length;
      return {
        c: f.ch, nb: A.nBytes(f.bytes.length), bits: f.bytes.map(A.bin).join(' '),
        bytes: A.nBytes(n), bitsN: A.nBits(n * 8)
      };
    },
    build(el) {
      el.innerHTML = '<div class="glyphs"></div><div class="bits-meta"></div><div class="extra"></div><div class="bits-tip" aria-live="polite"></div>';
      els = { glyphs: el.querySelector('.glyphs'), meta: el.querySelector('.bits-meta'), extra: el.querySelector('.extra'), tip: el.querySelector('.bits-tip') };
      render();
    },
    update(st) {
      if (!els) return;
      const { s } = st;
      const n = state.length;
      const unfold = sstep(0.75, 1.45, s);
      const dim = sstep(2.0, 2.5, s);
      const q = (s - 2.35) / 1.0;
      let bi = 0;
      const total = A.msg.bytes.length;
      const cipher = A.msg.cipher;
      state.forEach((g, i) => {
        const p = sstep(0.05 + i * 0.018, 0.5 + i * 0.018, s);
        if (Math.abs(p - g.p) > 0.003) { g.el.style.opacity = p.toFixed(3); g.el.style.transform = 'translateY(' + ((1 - p) * 16).toFixed(1) + 'px)'; g.p = p; }
        if (Math.abs(unfold - g.u) > 0.003) { g.cp.style.opacity = unfold.toFixed(3); g.bs.forEach((b) => { b.style.opacity = unfold.toFixed(3); }); g.u = unfold; }
        if (Math.abs(dim - g.d) > 0.003) { g.ch.style.opacity = (1 - 0.72 * dim).toFixed(3); g.d = dim; }
        g.bs.forEach((b, j) => {
          const f = bi / Math.max(1, total);
          let mode = 0;
          if (cipher && q > f + 0.07) mode = 2; else if (q > f) mode = 1;
          if (mode === 1) { b.textContent = A.bin(Math.floor(R() * 256)); b.classList.add('is-c'); }
          else if (mode !== b._m) {
            b.textContent = mode === 2 ? A.bin(cipher[bi]) : A.bin(g.c.bytes[j]);
            b.classList.toggle('is-c', mode === 2);
          }
          b._m = mode;
          bi++;
        });
      });
      const ex = sstep(3.25, 3.7, s);
      if (Math.abs(ex - (els._ex || 0)) > 0.003) { els.extra.style.opacity = ex.toFixed(3); els._ex = ex; }
      const encd = s > 3.3;
      if (encd !== els._encd) {
        els._encd = encd;
        els.meta.innerHTML = encd
          ? A.t('bits.meta2', { bytes: '<b>' + A.nBytes(total + 28) + '</b>' })
          : A.t('bits.meta', { chars: A.fmt(n) + ' ' + A.plural(n, 'char'), bytes: '<b>' + A.nBytes(total) + '</b>', bits: A.nBits(total * 8) });
      }
    }
  };
  function hex(arr) { return Array.from(arr || []).map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' '); }
  function render() {
    if (!els) return;
    els.glyphs.innerHTML = '';
    state = A.msg.chars.map((c, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'g' + (c.ch === ' ' ? ' g--space' : '');
      b.setAttribute('aria-label', (c.ch === ' ' ? A.t('bits.space') : c.ch) + ', ' + c.hex);
      b.innerHTML = '<span class="g__cp">' + c.hex + '</span><span class="g__ch">' + (c.ch === ' ' ? '' : c.ch.replace(/[<&>]/g, (m) => ({ '<': '&lt;', '&': '&amp;', '>': '&gt;' }[m]))) + '</span>' +
        c.bytes.map((x) => '<span class="g__b">' + A.bin(x) + '</span>').join('');
      const show = () => {
        els.glyphs.querySelectorAll('.g.is-active').forEach((x) => x.classList.remove('is-active'));
        b.classList.add('is-active');
        els.tip.textContent = A.t('bits.tip', { ch: c.ch === ' ' ? A.t('bits.space') : c.ch, cp: c.hex, hex: hex(c.bytes), nb: A.nBytes(c.bytes.length) });
      };
      b.addEventListener('mouseenter', show);
      b.addEventListener('focus', show);
      b.addEventListener('click', show);
      els.glyphs.appendChild(b);
      return { el: b, ch: b.querySelector('.g__ch'), cp: b.querySelector('.g__cp'), bs: Array.from(b.querySelectorAll('.g__b')), c, p: -1, u: -1, d: -1 };
    });
    const m = A.msg;
    const n = m.bytes.length;
    const tag = m.cipher ? m.cipher.slice(n) : [];
    els.extra.innerHTML = '<span>' + A.t('bits.nonce') + ': ' + hex(m.iv) + '</span><span>' + A.t('bits.tag') + ': ' + hex(tag) + '</span>';
    els._encd = null; els._ex = -1;
    els.tip.textContent = '';
  }
  A.on('msg', () => { render(); A.refreshCard('s.bits.1'); A.refreshCard('s.bits.2'); });
  A.on('cipher', () => { render(); });
})();

/* ================= ENVELOPES ================= */
(() => {
  let els = null;
  let userSel = null;
  const ORDER = ['tls', 'tcp', 'ip', 'wifi'];
  const AT = { tls: 0.45, tcp: 0.85, ip: 1.25, wifi: 1.65 };
  A.SC.env = {
    keys: [[0, 4.002], [2.6, 4.008], [3, 4.008]],
    vars() {
      const p = A.pkt();
      return { total: A.nBytes(p.total), pct: A.fmt(Math.round((p.payload / p.total) * 100)) };
    },
    build(el) {
      const p = A.pkt();
      const L = p.layers;
      const B = A.t('u.B');
      const hd = (id, name, n) => '<button class="lay__hd" type="button" data-l="' + id + '">' + name + '<em>+' + n + ' ' + B + '</em></button>';
      const bits = A.msg.cipher ? Array.from(A.msg.cipher).slice(0, 40).map(A.bin).join(' ') : '';
      el.innerHTML =
        '<div class="pkt">' +
          '<div class="lay" data-l="wifi">' + hd('wifi', 'Wi‑Fi', L.wifi) +
            '<div class="lay" data-l="ip">' + hd('ip', 'IP', L.ip) +
              '<div class="lay" data-l="tcp">' + hd('tcp', 'TCP', L.tcp) +
                '<div class="lay" data-l="tls">' + hd('tls', 'TLS', L.tls) +
                  '<div class="core" data-l="core"><span>' + A.t('pkt.core') + ' · ' + L.core + ' ' + B + '</span>' + bits + '</div>' +
          '</div></div></div></div>' +
          '<div class="pkt-info" aria-live="polite"></div>' +
          '<div class="pkt-bar"><i style="width:' + (p.payload / p.total * 100) + '%;background:#FFB23F"></i><i style="width:' + (28 / p.total * 100) + '%;background:#62D2F5"></i><i style="flex:1;background:rgba(127,140,153,.45)"></i></div>' +
          '<div class="pkt-legend"><span><b>' + A.t('pkt.legend', { pct: A.fmt(Math.round(p.payload / p.total * 100)) }) + '</b></span><span>' + A.t('pkt.legend2', { rest: A.fmt(100 - Math.round(p.payload / p.total * 100)) }) + ' · ' + A.nBytes(p.total) + '</span></div>' +
        '</div>';
      els = {
        lays: Object.fromEntries(Array.from(el.querySelectorAll('.lay')).map((x) => [x.dataset.l, x])),
        info: el.querySelector('.pkt-info'), bar: el.querySelector('.pkt-bar'), legend: el.querySelector('.pkt-legend'), sel: null, _b: -1
      };
      el.querySelectorAll('.lay__hd').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); userSel = b.dataset.l; select(userSel); }));
      el.querySelector('.core').addEventListener('click', () => { userSel = 'core'; select('core'); });
      els.lastVis = null;
    },
    update(st) {
      if (!els) return;
      const { s } = st;
      let newest = 'core';
      ORDER.forEach((id) => {
        const v = sstep(AT[id], AT[id] + 0.3, s);
        const lay = els.lays[id];
        if (Math.abs(v - (lay._v === undefined ? -1 : lay._v)) > 0.004) {
          lay.style.borderColor = 'rgba(127,140,153,' + (0.38 * v).toFixed(3) + ')';
          lay.style.background = 'rgba(11,17,24,' + (0.5 * v).toFixed(3) + ')';
          lay.firstElementChild.style.opacity = v.toFixed(3);
          lay.style.transform = v < 1 ? 'scale(' + (1 + (1 - v) * 0.025).toFixed(4) + ')' : '';
          lay._v = v;
        }
        if (v > 0.5) newest = id;
      });
      if (!userSel && newest !== els.lastVis) { select(newest); els.lastVis = newest; }
      const b = sstep(2.1, 2.5, s);
      if (Math.abs(b - els._b) > 0.004) { els.bar.style.opacity = b.toFixed(3); els.legend.style.opacity = b.toFixed(3); els._b = b; }
    }
  };
  function select(id) {
    if (!els) return;
    Object.values(els.lays).forEach((l) => l.classList.toggle('is-sel', l.dataset.l === id));
    els.info.innerHTML = id === 'core' ? A.t('pkt.core.i', { n: A.nBytes(A.pkt().layers.core) }) : A.t('pkt.' + id);
  }
  A.on('msg', () => { userSel = null; A.refreshCard('s.env.3'); });
  A.on('cipher', () => { const sc = A.scenes.find((x) => x.id === 'env'); if (sc && sc.ov) { sc.ov.innerHTML = ''; A.SC.env.build(sc.ov); } });
})();

/* ================= RADIO ================= */
(() => {
  A.SC.radio = {
    keys: [[0, 4.008], [0.3, 4.01], [1.3, 5.96], [1.8, 5.999967], [2.7, 6.0], [3, 6.0]],
    draw(c, st) {
      const { s, a, now, V, t } = st;
      A.bg('#0A0F16', '#05080C', a);
      const floorY = V.y + V.h * (A.mobile ? 0.84 : 0.8);
      const px = V.x + V.w * 0.1, py = floorY - V.h * 0.16;
      const rx = V.x + V.w * 0.9, ry = floorY - V.h * 0.46;
      const dist = Math.hypot(rx - px, ry - py);
      c.save(); c.globalAlpha = a;
      // room lines
      c.strokeStyle = 'rgba(127,140,153,.35)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(V.x - 20, floorY); c.lineTo(V.x + V.w + 20, floorY); c.stroke();
      c.beginPath(); c.moveTo(px - 46, py + 22); c.lineTo(px + 46, py + 22); c.moveTo(px - 38, py + 22); c.lineTo(px - 38, floorY); c.moveTo(px + 38, py + 22); c.lineTo(px + 38, floorY); c.stroke();
      c.beginPath(); c.moveTo(rx - 70, ry + 12); c.lineTo(rx + 44, ry + 12); c.stroke();
      // dimension line
      const dy = floorY + 22;
      c.strokeStyle = 'rgba(169,181,193,.6)';
      c.beginPath(); c.moveTo(px, dy); c.lineTo(rx, dy); c.moveTo(px, dy - 6); c.lineTo(px, dy + 6); c.moveTo(rx, dy - 6); c.lineTo(rx, dy + 6); c.stroke();
      c.restore();
      A.label(A.t('c.10m'), (px + rx) / 2, dy, { a, color: A.C.fog, size: 11, align: 'center', bg: '#070A0F' });

      // neighbours' waves
      const busy = 1 - sstep(0.95, 1.25, s);
      if (busy > 0.01) {
        const srcs = [[V.x + V.w * 0.28, V.y - V.h * 0.35], [V.x + V.w * 1.2, V.y + V.h * 0.2]];
        c.save(); c.globalAlpha = a * busy; c.lineWidth = 1;
        srcs.forEach(([sx, sy], i) => {
          for (let k = 0; k < 6; k++) {
            const ph = (now * (0.28 + i * 0.07) + k / 6) % 1;
            c.strokeStyle = 'rgba(122,168,205,' + ((1 - ph) * 0.22).toFixed(3) + ')';
            c.beginPath(); c.arc(sx, sy, 30 + ph * V.w * 1.1, 0, TAU); c.stroke();
          }
        });
        c.restore();
        A.label(A.t('c.neighbors'), V.x + V.w * 0.62, V.y + 14, { a: a * busy * 0.9, color: 'rgba(122,168,205,.9)', size: 10 });
      }

      // devices
      c.save(); c.globalAlpha = a;
      c.fillStyle = '#0E151D'; c.strokeStyle = 'rgba(228,233,238,.8)'; c.lineWidth = 1.2;
      c.beginPath(); c.roundRect ? c.roundRect(px - 11, py - 20, 22, 40, 4) : c.rect(px - 11, py - 20, 22, 40); c.fill(); c.stroke();
      c.fillStyle = 'rgba(255,178,63,.55)'; c.fillRect(px - 7, py - 15, 14, 26);
      c.beginPath(); c.roundRect ? c.roundRect(rx - 36, ry - 6, 72, 18, 3) : c.rect(rx - 36, ry - 6, 72, 18); c.fillStyle = '#0E151D'; c.fill(); c.stroke();
      c.beginPath(); c.moveTo(rx - 26, ry - 6); c.lineTo(rx - 32, ry - 34); c.moveTo(rx + 26, ry - 6); c.lineTo(rx + 32, ry - 34); c.stroke();
      c.restore();
      A.label(A.t('c.phone'), px, py + 40, { a: a * 0.9, align: 'center', size: 10 });
      A.label(A.t('c.router'), rx, ry + 30, { a: a * 0.9, align: 'center', size: 10 });

      // listening status
      if (s < 1.6) {
        const st2 = s < 1.0 ? (Math.floor(now * 2.5) % 2 ? A.t('c.busy') : '') : A.t('c.free');
        const la = a * (1 - sstep(1.35, 1.6, s));
        A.label(A.t('c.listen') + (st2 ? ' · ' + st2 : ''), px - 14, py - 44, { a: la, color: s < 1.0 ? A.C.mist : A.C.signal, size: 10.5 });
      }
      // antenna glow while transmitting
      const tx = sstep(1.2, 1.35, s) * (1 - sstep(2.6, 2.9, s));
      if (tx > 0) A.glow(px, py - 16, 26 + Math.sin(now * 20) * 3, 'amber', a * tx * 0.7);

      // wavefront
      const f = clamp((t - 5.999967) / 0.000033);
      if (s > 1.75) {
        const Rf = f * dist;
        c.save();
        c.beginPath(); c.rect(V.x - 30, V.y - 40, V.w + 60, floorY - V.y + 40); c.clip();
        c.globalAlpha = a;
        for (let k = 0; k < 11; k++) {
          const r = Rf - k * 15;
          if (r <= 2) continue;
          c.strokeStyle = A.rgba(A.C.signal, (1 - k / 11) * 0.75);
          c.lineWidth = k === 0 ? 2 : 1.2;
          c.beginPath(); c.arc(px, py - 16, r, -Math.PI * 0.62, Math.PI * 0.2); c.stroke();
        }
        c.restore();
        // loupe with the real wavelength
        const la = a * sstep(0.04, 0.12, f) * (1 - sstep(0.9, 0.99, f));
        if (la > 0.01) {
          const ang = Math.atan2(ry - (py - 16), rx - px);
          const fx = px + Math.cos(ang) * Rf, fy = py - 16 + Math.sin(ang) * Rf;
          const lx = fx - 10, ly = fy - (A.mobile ? 70 : 96), lr = A.mobile ? 38 : 52;
          c.save(); c.globalAlpha = la;
          c.strokeStyle = 'rgba(228,233,238,.5)'; c.lineWidth = 1;
          c.beginPath(); c.moveTo(fx, fy); c.lineTo(lx, ly + lr); c.stroke();
          c.beginPath(); c.arc(lx, ly, lr, 0, TAU); c.fillStyle = 'rgba(6,8,12,.92)'; c.fill(); c.stroke();
          c.beginPath(); c.arc(lx, ly, lr - 1, 0, TAU); c.clip();
          c.strokeStyle = A.C.signal; c.lineWidth = 1.6; c.beginPath();
          const wl = lr * 0.9;
          for (let x = -lr; x <= lr; x += 2) { const y = Math.sin(((x + now * 60) / wl) * TAU) * lr * 0.32; x === -lr ? c.moveTo(lx + x, ly + y) : c.lineTo(lx + x, ly + y); }
          c.stroke();
          c.strokeStyle = 'rgba(228,233,238,.7)'; c.beginPath(); c.moveTo(lx - wl / 2, ly + lr * 0.55); c.lineTo(lx + wl / 2, ly + lr * 0.55); c.stroke();
          c.restore();
          A.label(A.t('c.lambda'), lx, ly + lr + 14, { a: la, align: 'center', color: A.C.fog, size: 10.5, upper: false });
        }
        A.glow(px + Math.cos(Math.atan2(ry - py, rx - px)) * Rf, py - 16 + Math.sin(Math.atan2(ry - py, rx - px)) * Rf, 18, 'amber', a * (1 - f) * 0.8);
      }
      // router LED + number
      const hit = sstep(0.98, 1, f);
      if (hit > 0) {
        A.glow(rx + 22, ry + 3, 22, 'amber', a * hit * (0.6 + 0.4 * Math.sin(now * 12)));
        A.bigNum('33 ' + A.t('u.ns'), V.x + V.w * 0.5, V.y + V.h * (A.mobile ? 0.26 : 0.3), { a: a * hit, size: A.mobile ? 56 : 104, color: A.C.fog });
      }
      A.label(A.t('c.notScale'), V.x + V.w, floorY + 46, { a: a * 0.6, align: 'right', size: 9.5 });
    }
  };
})();

/* ================= FIBER ================= */
(() => {
  A.SC.fiber = {
    keys: [[0, 6.0], [1.5, 6.4], [3, 10.0]],
    draw(c, st) {
      const { s, a, now, V, W } = st;
      A.bg('#070A0E', '#030507', a);
      const pa = a * (1 - sstep(1.25, 1.65, s));
      const pb = a * sstep(1.3, 1.75, s);
      // ---- cross-section
      if (pa > 0.01) {
        const cx = V.cx - (A.mobile ? 0 : V.w * 0.12), cy = V.cy - (A.mobile ? V.h * 0.02 : 0);
        const Rc = Math.min(V.w, V.h) * (A.mobile ? 0.36 : 0.36);
        const pr = sstep(0.0, 0.6, s);
        const lit = sstep(0.85, 1.15, s);
        c.save(); c.globalAlpha = pa;
        let gr = c.createRadialGradient(cx - Rc * 0.3, cy - Rc * 0.3, Rc * 0.1, cx, cy, Rc);
        gr.addColorStop(0, '#1C2530'); gr.addColorStop(1, '#10161D');
        c.fillStyle = gr; c.beginPath(); c.arc(cx, cy, Rc, 0, TAU); c.fill();
        gr = c.createRadialGradient(cx - Rc * 0.15, cy - Rc * 0.15, 0, cx, cy, Rc * 0.5);
        gr.addColorStop(0, '#24394A'); gr.addColorStop(1, '#10202C');
        c.fillStyle = gr; c.beginPath(); c.arc(cx, cy, Rc * 0.5, 0, TAU); c.fill();
        c.lineWidth = 1.2;
        c.strokeStyle = 'rgba(169,181,193,.7)'; c.beginPath(); c.arc(cx, cy, Rc, -Math.PI / 2, -Math.PI / 2 + TAU * pr); c.stroke();
        c.strokeStyle = 'rgba(160,205,235,.7)'; c.beginPath(); c.arc(cx, cy, Rc * 0.5, -Math.PI / 2, -Math.PI / 2 + TAU * pr); c.stroke();
        c.fillStyle = lit > 0 ? A.rgba('#FFD89A', 0.5 + 0.5 * lit) : 'rgba(160,205,235,.5)';
        c.beginPath(); c.arc(cx, cy, Math.max(2.5, Rc * 0.036), 0, TAU); c.fill();
        c.restore();
        A.glow(cx, cy, Rc * 0.22, 'amber', pa * lit * (0.85 + 0.15 * Math.sin(now * 3)));
        const la = pa * sstep(0.45, 0.8, s);
        const lx = A.mobile ? cx - Rc * 0.1 : cx + Rc * 1.18;
        const labs = [[Math.PI * -0.28, Rc, 'c.coat', -Rc * 0.72], [Math.PI * -0.1, Rc * 0.5, 'c.clad', -Rc * 0.28], [0.02, Rc * 0.036, 'c.core', Rc * 0.1]];
        if (!A.mobile) {
          labs.forEach(([ang, r, key, yy]) => {
            const x1 = cx + Math.cos(ang) * r, y1 = cy + Math.sin(ang) * r;
            A.callout(x1, y1, lx, cy + yy, A.t(key), { a: la });
          });
        } else {
          labs.forEach(([, , key], i) => A.label(A.t(key), cx, cy + Rc + 22 + i * 17, { a: la, align: 'center', size: 10, color: i === 2 ? A.C.signal2 : A.C.mist }));
        }
        // hair
        const ha = pa * sstep(0.95, 1.3, s);
        if (ha > 0.01) {
          const hx = A.mobile ? cx + Rc * 0.78 : cx + Rc * 1.45, hy = A.mobile ? cy - Rc * 0.95 : cy + Rc * 0.66;
          const hr = Rc * 0.28;
          c.save(); c.globalAlpha = ha;
          const hg = c.createRadialGradient(hx - hr * 0.3, hy - hr * 0.3, 0, hx, hy, hr);
          hg.addColorStop(0, '#6A4A36'); hg.addColorStop(1, '#2E2018');
          c.fillStyle = hg; c.beginPath(); c.arc(hx, hy, hr, 0, TAU); c.fill();
          c.strokeStyle = 'rgba(210,170,140,.5)'; c.stroke();
          c.restore();
          A.label(A.t('c.hair'), hx, hy + hr + 14, { a: ha, align: 'center', size: 10 });
        }
      }
      // ---- longitudinal fibre with light pulses
      if (pb > 0.01) {
        const y = V.cy + (A.mobile ? 0 : V.h * 0.04);
        const hc = Math.min(120, V.h * 0.3), hk = 12;
        const x0 = A.mobile ? -20 : V.x - V.w * 0.12, x1 = W + 20;
        c.save(); c.globalAlpha = pb;
        let gr = c.createLinearGradient(0, y - hc / 2, 0, y + hc / 2);
        gr.addColorStop(0, '#16222D'); gr.addColorStop(0.5, '#1D3141'); gr.addColorStop(1, '#101922');
        c.fillStyle = gr; c.fillRect(x0, y - hc / 2, x1 - x0, hc);
        c.strokeStyle = 'rgba(160,205,235,.45)'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(x0, y - hc / 2); c.lineTo(x1, y - hc / 2); c.moveTo(x0, y + hc / 2); c.lineTo(x1, y + hc / 2); c.stroke();
        c.fillStyle = 'rgba(255,216,154,.07)'; c.fillRect(x0, y - hk / 2, x1 - x0, hk);
        c.strokeStyle = 'rgba(255,216,154,.22)';
        c.beginPath(); c.moveTo(x0, y - hk / 2); c.lineTo(x1, y - hk / 2); c.moveTo(x0, y + hk / 2); c.lineTo(x1, y + hk / 2); c.stroke();
        c.restore();
        // pulses: real packet bits
        const bytes = A.msg.cipher || A.msg.bytes;
        const bits = [];
        for (let i = 0; i < Math.min(bytes.length, 16); i++) for (let b = 7; b >= 0; b--) bits.push((bytes[i] >> b) & 1);
        const slot = A.mobile ? 20 : 28, len = slot * 0.62;
        const off = (s - 1.3) * W * 1.25;
        c.save(); c.globalAlpha = pb; c.globalCompositeOperation = 'lighter';
        for (let i = 0; i < bits.length; i++) {
          if (!bits[i]) continue;
          const x = x0 + off - i * slot;
          if (x < x0 - len || x > x1) continue;
          const gg = c.createLinearGradient(x, 0, x + len, 0);
          gg.addColorStop(0, 'rgba(255,178,63,0)'); gg.addColorStop(0.5, 'rgba(255,230,180,1)'); gg.addColorStop(1, 'rgba(255,178,63,0)');
          c.fillStyle = gg; c.fillRect(x, y - 3, len, 6);
          c.fillStyle = 'rgba(255,178,63,.12)'; c.fillRect(x - 6, y - hc * 0.22, len + 12, hc * 0.44);
        }
        c.restore();
        // ruler
        const ra = pb * sstep(1.9, 2.3, s);
        if (ra > 0.01) {
          const ry = y - hc / 2 - 30, rl = A.mobile ? 120 : 220;
          const rx0 = A.mobile ? V.x + 10 : V.x + 20;
          c.save(); c.globalAlpha = ra; c.strokeStyle = 'rgba(228,233,238,.7)'; c.lineWidth = 1;
          c.beginPath(); c.moveTo(rx0, ry); c.lineTo(rx0 + rl, ry);
          for (let i = 0; i <= 10; i++) { const x = rx0 + (rl * i) / 10; c.moveTo(x, ry); c.lineTo(x, ry - (i % 5 ? 4 : 8)); }
          c.stroke(); c.restore();
          A.label(A.t('c.perM'), rx0, ry - 18, { a: ra, color: A.C.fog, size: 10.5 });
        }
        const na = pb * sstep(2.3, 2.7, s);
        if (na > 0.01) {
          A.bigNum(A.lang === 'ru' ? '200 000' : '200,000', V.x + V.w * (A.mobile ? 0.5 : 0.56), y + hc / 2 + (A.mobile ? 70 : 110), { a: na, size: A.mobile ? 50 : 92 });
          A.label(A.t('c.speed'), V.x + V.w * (A.mobile ? 0.5 : 0.56), y + hc / 2 + (A.mobile ? 92 : 138), { a: na, align: 'center', size: 11, color: A.C.signal });
        }
      }
    }
  };
})();
})();
