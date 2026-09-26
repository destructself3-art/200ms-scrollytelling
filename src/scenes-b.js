/* Scenes, part B: relay, Frankfurt, dive, Atlantic, New York, the way back. */
(() => {
'use strict';
const A = window.APP;
const { clamp, lerp, sstep, rng } = A.u;
const TAU = Math.PI * 2;
if (!A.map.P) { console.warn('map projection unavailable'); }

const ALL_OUT = A.routeOut ? A.allPts(A.routeOut) : [];
const ALL_BACK = A.routeBack ? A.allPts(A.routeBack) : [];

function mapBase(c, a, T, o = {}) {
  A.bg(o.top || '#070B11', o.bot || '#04070B', a);
  c.save(); c.globalAlpha = a;
  A.drawLand(T, { fill: o.land || '#0E151E', stroke: o.coast || 'rgba(127,140,153,.45)', grat: o.grat === false ? null : 'rgba(127,140,153,.07)' });
  c.restore();
}
function city(T, id, a, o = {}) {
  if (a <= 0.01) return;
  const p = T.S(A.map.P(A.PLACES[id]));
  const c = A.ctx;
  c.save(); c.globalAlpha = a;
  c.fillStyle = o.hot ? A.C.signal : A.C.fog;
  c.beginPath(); c.arc(p[0], p[1], o.r || 3, 0, TAU); c.fill();
  if (o.ring) { c.strokeStyle = A.rgba(o.ringColor || A.C.signal, 0.7); c.lineWidth = 1; c.beginPath(); c.arc(p[0], p[1], o.ring, 0, TAU); c.stroke(); }
  c.restore();
  const dx = o.dx === undefined ? 8 : o.dx, dy = o.dy || 0;
  A.label(A.t('city.' + id), p[0] + dx, p[1] + dy, { a, align: dx < 0 ? 'right' : 'left', color: o.hot ? A.C.signal2 : A.C.mist, size: o.size || 10.5, bg: o.bg });
}
function pulseRings(T, wps, t, color) {
  const c = A.ctx;
  wps.forEach(([id, tc]) => {
    const age = t - tc;
    if (age < 0 || age > 3) return;
    const p = T.S(A.map.P(A.PLACES[id]));
    c.save();
    c.strokeStyle = A.rgba(color, (1 - age / 3) * 0.8);
    c.lineWidth = 1.2;
    c.beginPath(); c.arc(p[0], p[1], 4 + age * 9, 0, TAU); c.stroke();
    c.restore();
  });
}
function routeLayer(T, t, a, o = {}) {
  const c = A.ctx;
  c.save(); c.globalAlpha = a;
  A.strokePts(ALL_OUT, T, 'rgba(255,178,63,.2)', 1, [3, 5]);
  const r = A.routeAt(A.routeOut, t);
  A.strokePts(r.trail, T, 'rgba(255,190,90,.95)', o.w || 2);
  c.restore();
  const h = T.S(r.head);
  A.glow(h[0], h[1], o.glow || 26, 'amber', a);
  return h;
}

/* ================= RELAY ================= */
(() => {
  const CAM = [[0, 37.62, 55.75, 90], [1.0, 31, 57.8, 240], [2.2, 23.5, 55.8, 350], [3, 22.5, 55, 360]];
  const HOPS = [
    ['gw.home', 6.0], ['olt-3.msk.isp.example', 7.6], ['core1.msk.isp.example', 9.4], ['ix.msk.example', 10.2],
    ['spb.transit.example', 14.0], ['hel.transit.example', 16.5], ['sto.transit.example', 19.5],
    ['cph.transit.example', 24.0], ['ham.transit.example', 27.0], ['fra.ix.example', 32.0], ['edge.fra.messenger.example', 33.0]
  ];
  let lines = [];
  A.SC.relay = {
    keys: [[0, 10.0], [0.3, 10.0], [2.8, 33.0], [3, 33.0]],
    draw(c, st) {
      const { s, a, t } = st;
      const T = A.cam(A.camAt(CAM, s));
      mapBase(c, a, T);
      const h = routeLayer(T, t, a);
      pulseRings(T, A.OUT.slice(0, 7), t, A.C.signal);
      ['msk', 'spb', 'hel', 'sto', 'cph', 'ham', 'fra'].forEach((id) => {
        const wp = A.OUT.find((w) => w[0] === id);
        const passed = t >= wp[1];
        city(T, id, a * (passed ? 1 : 0.55), { hot: passed && t - wp[1] < 2.5, dx: id === 'msk' ? 9 : (id === 'fra' || id === 'ham' || id === 'cph' ? -9 : 9) });
      });
      void h;
    },
    build(el) {
      const u = A.t('u.ms');
      const pad = (str, n) => (str.length > n ? str.slice(0, n) : str + ' '.repeat(n - str.length));
      el.innerHTML = '<div class="term" aria-hidden="true"><div class="term__hd">$ trace <b>edge.fra.messenger.example</b></div>' +
        HOPS.map(([h, tm], i) => '<span class="term__ln">' + String(i + 1).padStart(2, ' ') + '  <span class="h">' + pad(h, 27) + '</span>' + A.fmt(tm, 1).padStart(5, ' ') + ' ' + u + '</span>').join('') + '</div>';
      lines = Array.from(el.querySelectorAll('.term__ln'));
    },
    update(st) {
      const { t } = st;
      let now = -1;
      HOPS.forEach(([, tm], i) => { if (t >= tm) now = i; });
      lines.forEach((ln, i) => {
        const on = i <= now;
        if (on !== ln._on) { ln.classList.toggle('is-on', on); ln._on = on; }
        const cur = i === now;
        if (cur !== ln._cur) { ln.classList.toggle('is-now', cur); ln._cur = cur; }
      });
    }
  };
})();

/* ================= FRANKFURT ================= */
(() => {
  const CAM = [[0, 22.5, 55, 360], [0.85, 8.68, 50.11, 44]];
  const R0 = rng(4242);
  const NETS = Array.from({ length: 150 }, (_, i) => ({ ang: (i / 150) * TAU + (R0() - 0.5) * 0.05, rr: 0.72 + R0() * 0.34, sp: 0.3 + R0() * 0.9, ph: R0(), hot: R0() < 0.08 }));
  const RACKS = [];
  const R1 = rng(77);
  for (let r = 0; r < 4; r++) for (let j = 0; j < 8; j++) {
    RACKS.push({ r, j, leds: Array.from({ length: 22 }, () => ({ ph: R1(), rate: 0.4 + R1() * 2.4, duty: 0.2 + R1() * 0.6, col: R1() < 0.08 ? 1 : R1() < 0.12 ? 2 : 0 })) });
  }
  const SERVER = { r: 1, j: 5 };
  function isoP(x, y, z, u, ox, oy) { return [ox + (x - y) * 0.866 * u, oy + (x + y) * 0.5 * u - z * u]; }
  function poly(c, pts) { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); }
  A.SC.fra = {
    keys: [[0, 33.0], [1.8, 34.0], [3.0, 35.4], [3.8, 36.0], [4, 36.0]],
    draw(c, st) {
      const { s, a, now, V, W, H } = st;
      const pa = a * (1 - sstep(1.05, 1.45, s));
      const pb = a * sstep(1.05, 1.45, s) * (1 - sstep(2.25, 2.6, s));
      const pc = a * sstep(2.25, 2.6, s);
      // --- IX over the map
      if (pa > 0.01) {
        const T = A.cam(A.camAt(CAM, s));
        mapBase(c, pa, T);
        const f = T.S(A.map.P(A.PLACES.fra));
        const ring = sstep(0.55, 1.0, s);
        const RR = Math.min(V.w, V.h) * 0.36;
        c.save(); c.globalAlpha = pa * ring;
        NETS.forEach((n) => {
          const x = f[0] + Math.cos(n.ang) * RR * n.rr, y = f[1] + Math.sin(n.ang) * RR * n.rr;
          c.strokeStyle = n.hot ? 'rgba(255,178,63,.55)' : 'rgba(127,160,190,.27)';
          c.lineWidth = 1;
          c.beginPath(); c.moveTo(f[0], f[1]); c.lineTo(x, y); c.stroke();
          const q = (now * n.sp + n.ph) % 1;
          c.fillStyle = n.hot ? A.C.signal : 'rgba(200,220,240,.7)';
          c.fillRect(lerp(x, f[0], q) - 1, lerp(y, f[1], q) - 1, 2, 2);
          c.fillStyle = n.hot ? A.C.signal : 'rgba(190,205,220,.9)';
          c.beginPath(); c.arc(x, y, n.hot ? 2.6 : 2.1, 0, TAU); c.fill();
        });
        c.restore();
        A.glow(f[0], f[1], 34, 'amber', pa * (0.6 + 0.4 * ring));
        A.label(A.t('city.fra'), f[0] + 12, f[1] - 14, { a: pa, color: A.C.signal2, size: 11 });
        A.label(A.t('c.ix'), f[0] + 12, f[1] + 4, { a: pa * ring, size: 10 });
        A.label(A.t('c.nets'), V.x + V.w - 4, V.y + 12, { a: pa * ring, align: 'right', color: A.C.fog, size: 11 });
      }
      // --- data hall
      if (pb > 0.01) {
        A.bg('#07121B', '#03080D', pb);
        A.vignette(V.cx, V.cy, V.w * 0.7, 'rgba(98,210,245,.07)', pb);
        const u = Math.min(V.w / 14, V.h / 9.5);
        const ox = V.cx - (4 - 5) * 0.866 * u, oy = V.cy - (4 + 5) * 0.5 * u + 1.2 * u;
        const order = RACKS.slice().sort((p, q) => (p.j + p.r * 2.6) - (q.j + q.r * 2.6));
        const reveal = sstep(1.1, 1.6, s);
        const srvOn = sstep(1.6, 1.9, s);
        c.save(); c.globalAlpha = pb;
        order.forEach((rk) => {
          const x0 = rk.j * 1.0, x1 = x0 + 0.84, y0 = rk.r * 2.6, y1 = y0 + 1.1, h = 2.5 * (0.2 + 0.8 * clamp(reveal * 1.6 - (rk.j + rk.r) * 0.05));
          const P = (x, y, z) => isoP(x, y, z, u, ox, oy);
          const isSrv = rk.r === SERVER.r && rk.j === SERVER.j;
          poly(c, [P(x0, y1, 0), P(x1, y1, 0), P(x1, y1, h), P(x0, y1, h)]); c.fillStyle = '#101B26'; c.fill();
          c.strokeStyle = isSrv && srvOn > 0 ? A.rgba(A.C.signal, 0.5 + 0.5 * srvOn) : 'rgba(127,160,190,.22)'; c.lineWidth = 1; c.stroke();
          poly(c, [P(x1, y0, 0), P(x1, y1, 0), P(x1, y1, h), P(x1, y0, h)]); c.fillStyle = '#0B141D'; c.fill(); c.stroke();
          poly(c, [P(x0, y0, h), P(x1, y0, h), P(x1, y1, h), P(x0, y1, h)]); c.fillStyle = '#18242F'; c.fill(); c.stroke();
          rk.leds.forEach((l, i) => {
            const col = i % 2, row = Math.floor(i / 2);
            const z = 0.25 + row * 0.19;
            if (z > h - 0.1) return;
            const p = P(x0 + 0.2 + col * 0.36, y1, z);
            const on = ((now * l.rate + l.ph) % 1) < l.duty;
            c.fillStyle = l.col === 1 ? (on ? '#FFB23F' : 'rgba(255,178,63,.2)') : l.col === 2 ? (on ? '#62D2F5' : 'rgba(98,210,245,.18)') : (on ? 'rgba(210,230,245,.85)' : 'rgba(210,230,245,.15)');
            c.fillRect(p[0] - 1, p[1] - 1, 2.2, 2);
          });
          if (isSrv && srvOn > 0) {
            const m = P(x0 + 0.42, y1, h * 0.55);
            A.glow(m[0], m[1], 50, 'amber', pb * srvOn * (0.7 + 0.3 * Math.sin(now * 4)));
          }
        });
        c.restore();
        const ms = isoP(SERVER.j + 0.84, SERVER.r * 2.6 + 1.1, 2.5, u, ox, oy);
        A.callout(ms[0], ms[1], ms[0] + (A.mobile ? 20 : 60), ms[1] - 40, A.t('c.server'), { a: pb * srvOn });
      }
      // --- connections grid
      if (pc > 0.01) {
        A.bg('#060C12', '#03070A', pc);
        const cols = A.mobile ? 34 : 84, rows = A.mobile ? 26 : 40;
        const cell = Math.min(V.w / cols, V.h / rows);
        const gx = V.cx - (cols * cell) / 2, gy = V.cy - (rows * cell) / 2;
        const ai = Math.floor(cols * 0.71), aj = Math.floor(rows * 0.37);
        const scan = (s - 2.55) / 0.65;
        const found = sstep(3.1, 3.25, s);
        c.save(); c.globalAlpha = pc;
        for (let i = 0; i < cols; i++) {
          const sx = scan * cols;
          const near = found < 1 ? Math.max(0, 1 - Math.abs(i - sx) / 4) : 0;
          for (let j = 0; j < rows; j++) {
            const tw = 0.2 + 0.18 * Math.sin(i * 12.9898 + j * 78.233 + now * 1.3);
            c.fillStyle = near > 0 ? 'rgba(228,233,238,' + (tw + near * 0.6).toFixed(3) + ')' : 'rgba(127,160,190,' + tw.toFixed(3) + ')';
            c.fillRect(gx + i * cell + cell * 0.3, gy + j * cell + cell * 0.3, Math.max(1.2, cell * 0.36), Math.max(1.2, cell * 0.36));
          }
        }
        c.restore();
        const ax = gx + ai * cell + cell * 0.5, ay = gy + aj * cell + cell * 0.5;
        if (found > 0) {
          A.glow(ax, ay, 26, 'amber', pc * found);
          c.save(); c.globalAlpha = pc * found; c.strokeStyle = A.C.signal; c.lineWidth = 1.2;
          c.beginPath(); c.arc(ax, ay, 9, 0, TAU); c.stroke(); c.restore();
          A.callout(ax, ay, ax + (A.mobile ? -18 : 36), ay - 34, A.t('c.anya'), { a: pc * found, align: A.mobile ? 'right' : 'left', color: A.C.signal2 });
        }
        A.label(A.t('c.conns'), gx, gy + rows * cell + 18, { a: pc * 0.85, size: 10 });
        const ack = sstep(3.45, 3.95, s);
        if (ack > 0 && ack < 1) {
          const x = lerp(V.cx, 0, ack), y = V.cy + V.h * 0.4;
          A.glow(x, y, 22, 'cyan', pc);
        }
        A.label(A.t('c.ack1'), V.x + (A.mobile ? 0 : 0), V.cy + V.h * 0.4 + (A.mobile ? 22 : 0), { a: pc * sstep(3.4, 3.6, s), color: A.C.ack, size: 11 });
      }
    }
  };
})();

/* ================= DIVE ================= */
(() => {
  const CAM = [[0, 8.68, 50.11, 60], [1.0, 4.3, 50.9, 150], [1.8, -4.55, 50.83, 46], [2.3, -4.9, 50.8, 36]];
  const DEPTH = [[2.2, 0], [2.75, 0], [3.5, 150], [4.4, 430], [5.15, 1150], [5.75, 3800], [6, 4700]];
  const STOPS = [[0, [28, 86, 99]], [40, [18, 62, 76]], [150, [10, 37, 51]], [400, [6, 21, 31]], [1000, [3, 10, 16]], [4700, [1, 4, 7]]];
  const R = rng(9);
  const SNOW = Array.from({ length: 170 }, () => ({ x: R(), y: R(), r: 0.5 + R() * 1.4, al: 0.2 + R() * 0.6, sp: 0.3 + R() }));
  function water(z) {
    z = clamp(z, 0, 4700);
    for (let i = 1; i < STOPS.length; i++) {
      if (z <= STOPS[i][0]) {
        const f = (z - STOPS[i - 1][0]) / (STOPS[i][0] - STOPS[i - 1][0]);
        const a = STOPS[i - 1][1], b = STOPS[i][1];
        return 'rgb(' + Math.round(lerp(a[0], b[0], f)) + ',' + Math.round(lerp(a[1], b[1], f)) + ',' + Math.round(lerp(a[2], b[2], f)) + ')';
      }
    }
    return 'rgb(1,4,7)';
  }
  let els = null;
  A.SC.dive = {
    keys: [[0, 36.0], [1.2, 40.5], [2.0, 43.0], [3.0, 43.3], [6, 45.0]],
    depth: (s) => A.u.keys(DEPTH, s),
    draw(c, st) {
      const { s, a, now, V, W, H, t } = st;
      const pm = a * (1 - sstep(2.05, 2.45, s));
      const po = a * sstep(2.05, 2.45, s);
      if (pm > 0.01) {
        const T = A.cam(A.camAt(CAM, s));
        mapBase(c, pm, T);
        routeLayer(T, t, pm);
        const lonT = A.OUT.find((w) => w[0] === 'lon')[1], budeT = A.OUT.find((w) => w[0] === 'bude')[1];
        city(T, 'fra', pm * 0.8, { dx: 9 });
        city(T, 'lon', pm, { hot: t >= lonT && t - lonT < 3, dx: 9, dy: -2 });
        city(T, 'bude', pm, { hot: t >= budeT, dx: -9, ring: t >= budeT ? 10 + Math.sin(now * 3) * 2 : 0 });
      }
      if (po <= 0.01) return;
      const D = A.u.keys(DEPTH, s);
      const k = H / 420;
      const Y = (z) => H * 0.5 + (z - D) * k;
      const yTop = Y(0);
      // water column
      const zt = D - H * 0.5 / k, zb = D + H * 0.5 / k;
      c.save(); c.globalAlpha = po;
      const g = c.createLinearGradient(0, Math.max(0, yTop), 0, H);
      g.addColorStop(0, water(Math.max(0, zt))); g.addColorStop(1, water(zb));
      c.fillStyle = g; c.fillRect(0, Math.max(0, yTop), W, H);
      // sky at dusk
      if (yTop > 0) {
        const sg = c.createLinearGradient(0, 0, 0, yTop);
        sg.addColorStop(0, '#141B2A'); sg.addColorStop(0.55, '#3A3346'); sg.addColorStop(0.85, '#B8714A'); sg.addColorStop(1, '#E09A5E');
        c.fillStyle = sg; c.fillRect(0, 0, W, yTop);
        const sunX = V.x + V.w * 0.78;
        const sgl = c.createRadialGradient(sunX, yTop, 0, sunX, yTop, V.w * 0.4);
        sgl.addColorStop(0, 'rgba(255,214,150,.75)'); sgl.addColorStop(1, 'rgba(255,214,150,0)');
        c.fillStyle = sgl; c.fillRect(0, 0, W, yTop + 40);
        // surface
        c.strokeStyle = 'rgba(255,220,180,.55)'; c.lineWidth = 1.2; c.beginPath();
        for (let x = 0; x <= W; x += 8) { const yy = yTop + Math.sin(x * 0.03 + now * 1.6) * 1.8; x ? c.lineTo(x, yy) : c.moveTo(x, yy); }
        c.stroke();
        // reflection streak
        c.fillStyle = 'rgba(255,200,140,.12)'; c.fillRect(sunX - 60, yTop + 2, 120, 3);
      }
      // god rays
      const ra = clamp(1 - D / 260);
      if (ra > 0) {
        c.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 7; i++) {
          const x = V.x + V.w * (0.1 + i * 0.14) + Math.sin(now * 0.3 + i) * 30;
          const top = Math.max(yTop, 0);
          const len = 380 * k;
          const rg = c.createLinearGradient(0, top, 0, top + len);
          rg.addColorStop(0, 'rgba(255,220,170,' + (0.1 * ra).toFixed(3) + ')'); rg.addColorStop(1, 'rgba(255,220,170,0)');
          c.fillStyle = rg;
          c.beginPath(); c.moveTo(x - 14, top); c.lineTo(x + 14, top); c.lineTo(x + 60 + i * 6, top + len); c.lineTo(x + 10 + i * 6, top + len); c.closePath(); c.fill();
        }
        c.globalCompositeOperation = 'source-over';
      }
      // seabed + cable through the frame (slope follows the depth: shelf, continental slope, abyssal plain)
      const th = lerp(lerp(0.07, 0.92, sstep(110, 420, D)), 0.05, sstep(4200, 4650, D));
      const cxp = V.cx, cyp = (A.mobile ? V.cy + V.h * 0.12 : H * 0.5) + lerp(A.mobile ? 90 : 170, A.mobile ? 20 : 40, sstep(0, 220, D));
      const dx = Math.cos(th), dy = Math.sin(th);
      const x0 = cxp - dx * W * 1.5, y0 = cyp - dy * W * 1.5, x1 = cxp + dx * W * 1.5, y1 = cyp + dy * W * 1.5;
      const ba = 1 - sstep(40, 170, D);
      c.fillStyle = D > 4300 ? '#0A0E12' : 'rgba(8,12,16,.9)';
      c.beginPath(); c.moveTo(x0, y0 + 14); c.lineTo(x1, y1 + 14); c.lineTo(x1, H + 900); c.lineTo(x0, H + 900); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(127,140,153,.35)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(x0, y0 + 14); c.lineTo(x1, y1 + 14); c.stroke();
      // beach near the surface: sand dune, manhole, the cable coming down the slope
      const bx = A.mobile ? 10 : V.x - V.w * 0.12;
      const mh = [bx + V.w * 0.14, yTop - 14];
      const meetX = bx + V.w * 0.42, meetY = cyp + (meetX - cxp) * Math.tan(th);
      if (ba > 0.01) {
        c.globalAlpha = po * ba;
        c.fillStyle = '#231D15';
        c.beginPath(); c.moveTo(-10, yTop - 74); c.lineTo(bx, yTop - 60); c.lineTo(bx + V.w * 0.2, yTop - 8); c.lineTo(bx + V.w * 0.3, yTop + 26); c.lineTo(meetX, meetY + 14); c.lineTo(meetX, H + 10); c.lineTo(-10, H + 10); c.closePath(); c.fill();
        c.strokeStyle = 'rgba(224,154,94,.55)'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(-10, yTop - 74); c.lineTo(bx, yTop - 60); c.lineTo(bx + V.w * 0.2, yTop - 8); c.stroke();
        c.fillStyle = '#0B0D10'; c.fillRect(mh[0] - 7, mh[1] - 5, 14, 12);
        c.strokeStyle = 'rgba(228,233,238,.6)'; c.strokeRect(mh[0] - 7, mh[1] - 5, 14, 12);
        c.globalAlpha = po;
      }
      const shore = [mh, [bx + V.w * 0.24, yTop + 6], [meetX, meetY + 8]];
      const poly = (pts) => { c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.stroke(); };
      c.lineJoin = 'round';
      c.strokeStyle = 'rgba(40,52,64,1)'; c.lineWidth = 4;
      c.globalAlpha = po * (1 - ba); poly([[x0, y0 + 8], [x1, y1 + 8]]);
      if (ba > 0.01) { c.globalAlpha = po * ba; poly(shore.concat([[x1, y1 + 8]])); }
      c.globalCompositeOperation = 'lighter';
      c.strokeStyle = 'rgba(255,190,90,.85)'; c.lineWidth = 2;
      c.globalAlpha = po * (1 - ba); poly([[cxp - dx * 280, cyp - dy * 280 + 8], [cxp, cyp + 8]]);
      if (ba > 0.01) { c.globalAlpha = po * ba; poly(shore.concat([[cxp, cyp + 8]])); }
      c.globalCompositeOperation = 'source-over';
      c.restore();
      if (ba > 0.05) A.label(A.t('c.shore'), mh[0], mh[1] - 18, { a: po * ba, align: 'center', size: 10, color: A.C.fog });
      A.glow(cxp, cyp + 8, 30, 'amber', po * (0.8 + 0.2 * Math.sin(now * 5)));
      // marine snow
      c.save(); c.globalAlpha = po;
      const band = H + 40;
      SNOW.forEach((p) => {
        const y = ((p.y * band - D * k * 0.9 - now * 8 * p.sp) % band + band) % band - 20;
        if (y < yTop) return;
        const x = p.x * W + Math.sin(now * 0.5 + p.y * 10) * 6;
        c.fillStyle = 'rgba(190,210,222,' + (p.al * (D > 60 ? 1 : D / 60)).toFixed(3) + ')';
        c.fillRect(x, y, p.r, p.r);
      });
      // bioluminescent sparks
      if (D > 700) {
        for (let i = 0; i < 6; i++) {
          const ph = (now * 0.35 + i * 0.37) % 1;
          if (ph < 0.12) {
            const x = (Math.sin(i * 91.7) * 0.5 + 0.5) * W, y = (Math.sin(i * 33.1 + Math.floor(now * 0.35 + i * 0.37)) * 0.5 + 0.5) * H;
            A.glow(x, y, 10, 'cyan', po * Math.sin((ph / 0.12) * Math.PI) * 0.6);
          }
        }
      }
      c.restore();
      // depth markers
      [[200, 'c.d200'], [1000, 'c.d1000'], [3800, 'c.d3800']].forEach(([z, key]) => {
        const y = Y(z);
        if (y < -20 || y > H + 20) return;
        c.save(); c.globalAlpha = po * 0.9; c.strokeStyle = 'rgba(228,233,238,.4)'; c.setLineDash([2, 5]); c.lineWidth = 1;
        c.beginPath(); c.moveTo(A.mobile ? 12 : V.x - V.w * 0.1, y); c.lineTo(W - (A.mobile ? 12 : 70), y); c.stroke(); c.restore();
        A.label('−' + A.fmt(z) + ' ' + A.t('u.m') + ' · ' + A.t(key), A.mobile ? 14 : V.x - V.w * 0.1, y - 11, { a: po, color: A.C.fog, size: 10.5, upper: false, ls: 0.4 });
      });
      // ruler
      const rx = W - (A.mobile ? 10 : 28);
      c.save(); c.globalAlpha = po * 0.8; c.strokeStyle = 'rgba(228,233,238,.5)'; c.lineWidth = 1;
      const z0 = Math.floor(zt / 50) * 50;
      for (let z = Math.max(0, z0); z < zb + 50; z += 50) {
        const y = Y(z);
        c.beginPath(); c.moveTo(rx, y); c.lineTo(rx - (z % 500 === 0 ? 14 : z % 100 === 0 ? 8 : 4), y); c.stroke();
      }
      c.restore();
    },
    build(el) {
      el.innerHTML = '<div class="depth"><div class="depth__n">0</div><div class="depth__u">' + A.t('c.depth') + '</div></div>';
      els = { box: el.querySelector('.depth'), n: el.querySelector('.depth__n'), _o: -1 };
    },
    update(st) {
      if (!els) return;
      const o = sstep(2.35, 2.7, st.s);
      if (Math.abs(o - els._o) > 0.004) { els.box.style.opacity = o.toFixed(3); els._o = o; }
      const D = Math.round(A.u.keys(DEPTH, st.s));
      if (D !== els._d) { els.n.textContent = (D > 0 ? '−' : '') + A.fmt(D); els._d = D; }
    }
  };
})();

/* ================= ATLANTIC ================= */
(() => {
  const CAM = [[0.9, -4.55, 50.83, 70], [1.6, -18, 50.5, 330], [2.6, -40, 49, 760], [5, -40, 49, 760]];
  let reps = null;
  function repeaters() {
    const seg = A.routeOut.find((q) => q.a === 'bude' && q.b === 'li');
    const out = [];
    const N = 96;
    for (let i = 1; i < N; i++) {
      const L = (i / N) * seg.len;
      let j = 1; while (j < seg.cum.length - 1 && seg.cum[j] < L) j++;
      const f = (L - seg.cum[j - 1]) / ((seg.cum[j] - seg.cum[j - 1]) || 1);
      const p = [lerp(seg.pts[j - 1][0], seg.pts[j][0], f), lerp(seg.pts[j - 1][1], seg.pts[j][1], f)];
      const ang = Math.atan2(seg.pts[j][1] - seg.pts[j - 1][1], seg.pts[j][0] - seg.pts[j - 1][0]);
      out.push({ p, ang, t: seg.ta + (i / N) * (seg.tb - seg.ta) });
    }
    return { list: out, mid: seg.pts[Math.floor(seg.pts.length / 2)] };
  }
  A.SC.atl = {
    keys: [[0, 45.0], [1.0, 45.0], [3.0, 74.0], [5, 74.0]],
    draw(c, st) {
      const { s, a, now, V, W, H, t } = st;
      const pa = a * (1 - sstep(1.0, 1.35, s));
      const pb = a * sstep(0.95, 1.3, s);
      if (pa > 0.01) {
        A.bg('#050A10', '#02050A', pa);
        // "zoom into the cable": the cross-section grows out of the pulse from the dive
        const grow = A.u.ease.out(sstep(-0.45, 0.4, s));
        const fromY = (A.mobile ? V.cy + V.h * 0.12 + 20 : H * 0.5 + 40) + 8;
        const cx = V.cx, cy = lerp(fromY, V.cy - (A.mobile ? 10 : 0), grow);
        const Rr = Math.min(V.w, V.h) * 0.3 * lerp(0.06, 1, grow);
        const pr = sstep(0, 0.55, s);
        c.save(); c.globalAlpha = pa;
        let g = c.createRadialGradient(cx - Rr * 0.3, cy - Rr * 0.3, 0, cx, cy, Rr);
        g.addColorStop(0, '#262C33'); g.addColorStop(1, '#12161B');
        c.fillStyle = g; c.beginPath(); c.arc(cx, cy, Rr * (0.6 + 0.4 * pr), 0, TAU); c.fill();
        c.strokeStyle = 'rgba(169,181,193,.5)'; c.lineWidth = 1; c.stroke();
        g = c.createRadialGradient(cx - Rr * 0.2, cy - Rr * 0.2, 0, cx, cy, Rr * 0.6);
        g.addColorStop(0, '#E0A36A'); g.addColorStop(1, '#8A5424');
        c.fillStyle = g; c.beginPath(); c.arc(cx, cy, Rr * 0.6, 0, TAU); c.fill();
        c.fillStyle = '#12161B'; c.beginPath(); c.arc(cx, cy, Rr * 0.53, 0, TAU); c.fill();
        const nW = 22;
        for (let i = 0; i < nW; i++) {
          const an = (i / nW) * TAU;
          const x = cx + Math.cos(an) * Rr * 0.43, y = cy + Math.sin(an) * Rr * 0.43;
          const wg = c.createRadialGradient(x - 2, y - 2, 0, x, y, Rr * 0.075);
          wg.addColorStop(0, '#C9D2DA'); wg.addColorStop(1, '#5B6670');
          c.fillStyle = wg; c.beginPath(); c.arc(x, y, Rr * 0.07 * sstep(0.15, 0.6, s), 0, TAU); c.fill();
        }
        c.fillStyle = '#1B232C'; c.beginPath(); c.arc(cx, cy, Rr * 0.3, 0, TAU); c.fill();
        c.strokeStyle = 'rgba(169,181,193,.4)'; c.stroke();
        const lit = sstep(0.4, 0.7, s);
        for (let i = 0; i < 16; i++) {
          const ring = i < 6 ? 0.09 : 0.2, n = i < 6 ? 6 : 10, idx = i < 6 ? i : i - 6;
          const an = (idx / n) * TAU + (i < 6 ? 0 : 0.3);
          const x = cx + Math.cos(an) * Rr * ring, y = cy + Math.sin(an) * Rr * ring;
          c.fillStyle = lit > 0 ? 'rgba(255,216,154,' + (0.35 + 0.65 * lit) + ')' : 'rgba(160,205,235,.5)';
          c.beginPath(); c.arc(x, y, Math.max(1.6, Rr * 0.028), 0, TAU); c.fill();
        }
        c.restore();
        A.glow(cx, cy, Rr * 0.34, 'amber', pa * lit * 0.8);
        const la = pa * sstep(0.35, 0.7, s);
        if (!A.mobile) {
          const lx = cx + Rr * 1.25;
          A.callout(cx + Rr * 0.92, cy - Rr * 0.35, lx, cy - Rr * 0.72, A.t('c.pe'), { a: la });
          A.callout(cx + Rr * 0.57, cy - Rr * 0.18, lx, cy - Rr * 0.3, A.t('c.cu'), { a: la });
          A.callout(cx + Rr * 0.43, cy + Rr * 0.02, lx, cy + Rr * 0.12, A.t('c.steel'), { a: la });
          A.callout(cx + Rr * 0.12, cy + Rr * 0.12, lx, cy + Rr * 0.54, A.t('c.fibers'), { a: la, color: A.C.signal2 });
        } else {
          ['c.pe', 'c.cu', 'c.steel', 'c.fibers'].forEach((key, i) => A.label(A.t(key), cx, cy + Rr + 30 + i * 16, { a: la, align: 'center', size: 10, color: i === 3 ? A.C.signal2 : A.C.mist }));
        }
        // dimension
        c.save(); c.globalAlpha = la; c.strokeStyle = 'rgba(228,233,238,.7)'; c.lineWidth = 1;
        const dy = cy - Rr - 18;
        c.beginPath(); c.moveTo(cx - Rr, dy); c.lineTo(cx + Rr, dy); c.moveTo(cx - Rr, dy - 5); c.lineTo(cx - Rr, dy + 5); c.moveTo(cx + Rr, dy - 5); c.lineTo(cx + Rr, dy + 5); c.stroke();
        c.restore();
        A.label(A.t('c.mm'), cx, dy, { a: la, align: 'center', color: A.C.fog, size: 11, bg: '#05090E', upper: false });
      }
      if (pb > 0.01) {
        const cam = A.camAt(CAM, s);
        if (A.mobile) cam[2] *= 1.05;
        const T = A.cam(cam);
        mapBase(c, pb, T, { top: '#050B12', bot: '#03070C' });
        reps = reps || repeaters();
        const h = routeLayer(T, t, pb, { w: 2 });
        const ra = pb * sstep(1.5, 1.9, s);
        c.save(); c.globalAlpha = ra;
        reps.list.forEach((r) => {
          const p = T.S(r.p);
          const hot = Math.exp(-((t - r.t) ** 2) / 0.12);
          const len = 4 + hot * 4;
          const nx = -Math.sin(r.ang), ny = Math.cos(r.ang);
          c.strokeStyle = hot > 0.05 ? 'rgba(255,216,154,' + (0.4 + 0.6 * hot).toFixed(3) + ')' : (t > r.t ? 'rgba(255,178,63,.45)' : 'rgba(169,181,193,.35)');
          c.lineWidth = 1;
          c.beginPath(); c.moveTo(p[0] - nx * len, p[1] - ny * len); c.lineTo(p[0] + nx * len, p[1] + ny * len); c.stroke();
          if (hot > 0.3) A.glow(p[0], p[1], 10, 'amber', hot * 0.6);
        });
        c.restore();
        void h;
        city(T, 'bude', pb, { hot: true, dx: 9, dy: 8 });
        city(T, 'li', pb * sstep(1.4, 1.8, s), { hot: t >= 74, dx: -9, dy: -10 });
        const mid = T.S(reps.mid);
        A.label(A.t('c.km6k'), mid[0], mid[1] - 22, { a: ra, align: 'center', color: A.C.fog, size: 11, upper: false });
        A.label(A.t('c.rep') + ' · ' + A.t('c.every'), mid[0], mid[1] + 24, { a: ra * 0.9, align: 'center', size: 10 });
        // numbers
        const na = pb * sstep(4.05, 4.4, s);
        if (na > 0.01) {
          const bx = A.mobile ? V.cx : V.x + V.w * 0.72, by = V.y + V.h * (A.mobile ? 0.2 : 0.2);
          A.bigNum('≈600', bx, by, { a: na, size: A.mobile ? 48 : 84 });
          A.label(A.t('c.cables'), bx, by + 18, { a: na, align: 'center', size: 11, color: A.C.signal });
          A.bigNum(A.t('c.len'), bx, by + (A.mobile ? 78 : 120), { a: na, size: A.mobile ? 40 : 66 });
          A.label(A.t('c.mkm'), bx, by + (A.mobile ? 96 : 140), { a: na, align: 'center', size: 11, color: A.C.signal });
        }
        void W; void H; void now;
      }
    }
  };
})();

/* ================= NEW YORK (paper) ================= */
(() => {
  const R = rng(311);
  const BLD = Array.from({ length: 34 }, (_, i) => ({ w: 0.018 + R() * 0.03, h: 0.18 + R() * R() * 0.62, sb: R() < 0.35, ant: R() < 0.12, i }));
  let els = null;
  function inkLine(c, pts, color, w, dash) {
    c.save(); c.strokeStyle = color; c.lineWidth = w; c.lineJoin = 'round'; c.lineCap = 'round';
    if (dash) c.setLineDash(dash);
    c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.stroke(); c.restore();
  }
  function along(pts, f) {
    let L = 0; const seg = [];
    for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); L += d; }
    let x = f * L;
    for (let i = 0; i < seg.length; i++) { if (x <= seg[i]) { const q = x / seg[i]; return [lerp(pts[i][0], pts[i + 1][0], q), lerp(pts[i][1], pts[i + 1][1], q)]; } x -= seg[i]; }
    return pts[pts.length - 1];
  }
  A.SC.ny = {
    keys: [[0, 74.0], [1.0, 75.0], [2.2, 80.0], [3.3, 100.0], [4, 100.0]],
    vars() {
      const g = A.state.guess;
      if (g == null) return { guess: A.t('ny.noguess') };
      const r = g / 0.1;
      const x = r >= 1 ? r : 1 / r;
      const cmp = x < 1.25 ? A.t('cmp.same') : A.t(r >= 1 ? 'cmp.faster' : 'cmp.slower', { x: A.fmt(x, x < 10 ? 1 : 0) + ' ' + A.plural(Math.round(x), 'times') });
      return { guess: A.t('ny.guess', { g: A.fmtDur(g), cmp }) };
    },
    draw(c, st) {
      const { s, a, now, V, W, H, t } = st;
      A.bg('#EEF0F2', '#D7DDE3', a);
      const ink = 'rgba(14,19,25,.8)', inkSoft = 'rgba(14,19,25,.35)';
      const gy = V.y + V.h * (A.mobile ? 0.78 : 0.74);
      const pa = a * (1 - sstep(1.05, 1.45, s));
      const pb = a * sstep(1.0, 1.4, s);
      const art = A.mobile ? { x: V.x, w: V.w } : { x: V.x - V.w * 0.05, w: V.w * 0.7 };
      // --- landing
      if (pa > 0.01) {
        c.save(); c.globalAlpha = pa;
        const sx = art.x + art.w * 0.32;
        const L = art.x - 60;
        c.fillStyle = '#C3D0D8'; c.fillRect(L, gy + 8, sx + 80 - L, H - gy);
        for (let i = 0; i < 4; i++) inkLine(c, [[L + 20 + i * 26, gy + 20 + i * 12], [sx - 60 - i * 12, gy + 20 + i * 12]], 'rgba(14,19,25,.1)', 1);
        c.fillStyle = '#DDD6C6';
        c.beginPath(); c.moveTo(L, gy + 150); c.lineTo(sx - 40, gy + 78); c.lineTo(sx + 42, gy + 14); c.lineTo(sx + 70, gy - 4); c.lineTo(W + 20, gy - 4); c.lineTo(W + 20, H + 10); c.lineTo(L, H + 10); c.closePath(); c.fill();
        inkLine(c, [[L, gy + 150], [sx - 40, gy + 78], [sx + 42, gy + 14], [sx + 70, gy - 4], [W + 20, gy - 4]], inkSoft, 1);
        inkLine(c, [[L, gy + 8], [sx + 28, gy + 8]], ink, 1.2);
        inkLine(c, [[sx + 70, gy - 4], [W + 20, gy - 4]], ink, 1.2);
        const st0 = art.x + art.w * 0.58;
        c.fillStyle = '#E6E9EC'; c.strokeStyle = ink; c.lineWidth = 1.2;
        c.fillRect(st0, gy - 64, 110, 60); c.strokeRect(st0, gy - 64, 110, 60);
        inkLine(c, [[st0 + 88, gy - 64], [st0 + 88, gy - 96]], ink, 1.2);
        c.strokeRect(sx + 34, gy - 2, 16, 12);
        const path = [[L, gy + 142], [sx - 40, gy + 70], [sx + 42, gy + 6], [st0 + 20, gy + 6], [st0 + 20, gy - 4], [st0 + 60, gy - 4], [st0 + 60, gy + 14], [W + 20, gy + 14]];
        inkLine(c, path, 'rgba(138,75,0,.55)', 2);
        inkLine(c, [[st0 + 110, gy + 14], [W + 20, gy + 14]], 'rgba(138,75,0,.6)', 2, [6, 6]);
        c.restore();
        const f = clamp((t - 74) / 1.0);
        const p = along(path, 0.35 + f * 0.65);
        A.glow(p[0], p[1], 22, 'amber', pa);
        A.label(A.t('c.station'), st0 + 55, gy - 80, { a: pa, align: 'center', color: A.C.ink, size: 10 });
        A.label(A.t('c.shore'), sx + 42, gy + 24, { a: pa * 0.9, align: 'center', color: A.C.ink2, size: 9.5 });
        A.label('→ ' + A.t('c.manh') + ' ≈100 ' + A.t('u.km'), W - 24, gy + 30, { a: pa, align: 'right', color: A.C.ink, size: 10 });
      }
      // --- skyline + 60 Hudson + tower
      if (pb > 0.01) {
        const sky = sstep(1.0, 1.7, s);
        c.save(); c.globalAlpha = pb;
        let x = art.x;
        const hudIdx = 14;
        let hud = null;
        BLD.forEach((b, i) => {
          const w = b.w * art.w * 1.6;
          const h = b.h * V.h * 0.55 * (0.3 + 0.7 * clamp(sky * 1.4 - i * 0.012));
          if (x > art.x + art.w * 1.05) return;
          if (i === hudIdx) {
            const hw = art.w * 0.09, hh = V.h * 0.38 * sky;
            hud = { x, w: hw, h: hh };
            c.fillStyle = '#E3D6C3';
            c.fillRect(x, gy - hh, hw, hh);
            c.fillRect(x + hw * 0.12, gy - hh * 1.12, hw * 0.76, hh * 0.12);
            c.fillRect(x + hw * 0.26, gy - hh * 1.22, hw * 0.48, hh * 0.1);
            c.strokeStyle = 'rgba(138,75,0,.9)'; c.lineWidth = 1.4;
            c.strokeRect(x, gy - hh, hw, hh); c.strokeRect(x + hw * 0.12, gy - hh * 1.12, hw * 0.76, hh * 0.12); c.strokeRect(x + hw * 0.26, gy - hh * 1.22, hw * 0.48, hh * 0.1);
            c.strokeStyle = 'rgba(138,75,0,.35)'; c.lineWidth = 1;
            for (let k = 1; k < 5; k++) { c.beginPath(); c.moveTo(x + (hw * k) / 5, gy - hh + 6); c.lineTo(x + (hw * k) / 5, gy - 4); c.stroke(); }
            x += hw + 4;
            return;
          }
          c.fillStyle = i % 3 ? '#D2D9DF' : '#C8D0D7';
          c.fillRect(x, gy - h, w, h);
          c.strokeStyle = inkSoft; c.lineWidth = 1; c.strokeRect(x, gy - h, w, h);
          if (b.sb) { c.fillRect(x + w * 0.2, gy - h - h * 0.12, w * 0.6, h * 0.12); c.strokeRect(x + w * 0.2, gy - h - h * 0.12, w * 0.6, h * 0.12); }
          if (b.ant) inkLine(c, [[x + w / 2, gy - h * (b.sb ? 1.12 : 1)], [x + w / 2, gy - h * (b.sb ? 1.12 : 1) - 24]], inkSoft, 1);
          x += w + 3;
        });
        inkLine(c, [[art.x - 30, gy], [W + 20, gy]], ink, 1.2);
        c.restore();
        if (hud) {
          const on = t >= 75 ? 1 : 0;
          A.glow(hud.x + hud.w / 2, gy - 10, 30, 'amber', pb * on * sstep(1.2, 1.6, s));
          A.callout(hud.x + hud.w / 2, gy - hud.h * 1.22, hud.x + hud.w / 2 - 34, gy - hud.h * 1.22 - 34, A.t('c.hudson'), { a: pb * sstep(1.3, 1.7, s), color: A.C.ink, line: 'rgba(14,19,25,.6)', dot: '#8A4B00', align: 'right' });
        }
        // tower + radio
        const ta = pb * sstep(1.9, 2.3, s);
        if (ta > 0.01) {
          const tx = art.x + art.w * (A.mobile ? 0.16 : 0.08), th = V.h * 0.46;
          c.save(); c.globalAlpha = ta; c.strokeStyle = ink; c.lineWidth = 1.2;
          c.beginPath(); c.moveTo(tx - 22, gy); c.lineTo(tx, gy - th); c.lineTo(tx + 22, gy); c.stroke();
          for (let k = 1; k < 7; k++) {
            const y1 = gy - (th * k) / 7, y2 = gy - (th * (k - 1)) / 7;
            const w1 = 22 * (1 - k / 7), w2 = 22 * (1 - (k - 1) / 7);
            c.beginPath(); c.moveTo(tx - w2, y2); c.lineTo(tx + w1, y1); c.moveTo(tx + w2, y2); c.lineTo(tx - w1, y1); c.stroke();
          }
          c.fillStyle = ink; c.fillRect(tx - 7, gy - th + 10, 5, 16); c.fillRect(tx + 2, gy - th + 10, 5, 16);
          const f = clamp((t - 80) / 20);
          for (let k = 0; k < 6; k++) {
            const r = (f * 1.3 - k * 0.08) * V.w * 0.7;
            if (r <= 4) continue;
            c.strokeStyle = 'rgba(138,75,0,' + ((1 - k / 6) * 0.6 * (1 - sstep(0.95, 1, f))).toFixed(3) + ')';
            c.lineWidth = 1.4;
            c.beginPath(); c.arc(tx, gy - th + 18, r, -0.5, 0.35); c.stroke();
          }
          c.restore();
          A.label(A.t('c.tower'), tx, gy + 16, { a: ta, align: 'center', color: A.C.ink, size: 10 });
        }
        void now;
      }
    },
    build(el) {
      const d = new Date();
      const date = d.toLocaleDateString(A.lang === 'ru' ? 'ru-RU' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' });
      el.innerHTML = '<div class="nyphone"><div class="nyphone__scr"><div class="nyphone__time">14:04</div><div class="nyphone__date">' + date + '</div>' +
        '<div class="note"><div class="note__app"><span>' + A.t('ny.app') + '</span><span>' + A.t('ny.now') + '</span></div><div class="note__t">' + A.t('ny.title') + '</div><div class="note__m"></div></div></div></div>';
      els = { phone: el.querySelector('.nyphone'), note: el.querySelector('.note'), m: el.querySelector('.note__m'), _p: -1 };
      els.m.textContent = A.msg.text;
    },
    update(st) {
      if (!els) return;
      const { s, t, now } = st;
      const pa = sstep(2.35, 2.75, s);
      if (Math.abs(pa - els._p) > 0.004) { els.phone.style.opacity = pa.toFixed(3); els.phone.style.transform = 'translate(' + (A.mobile ? '50%' : '0') + ', calc(-50% + ' + ((1 - pa) * 30).toFixed(1) + 'px))'; els._p = pa; }
      const na = sstep(99, 100, t);
      const shake = t >= 100 && s < 3.6 ? Math.sin(now * 60) * 2 * (1 - sstep(3.3, 3.6, s)) : 0;
      els.note.style.opacity = na.toFixed(3);
      els.note.style.transform = 'translate(' + shake.toFixed(1) + 'px,' + ((1 - na) * -14).toFixed(1) + 'px) scale(' + (0.96 + 0.04 * na).toFixed(3) + ')';
      if (els.m.textContent !== A.msg.text) els.m.textContent = A.msg.text;
    }
  };
  A.on('guess', () => A.refreshCard('s.ny.4'));
})();

/* ================= THE WAY BACK ================= */
(() => {
  let els = null;
  A.SC.back = {
    keys: [[0, 100.0], [2.3, 200.0], [3, 200.0]],
    draw(c, st) {
      const { s, a, t, V } = st;
      const T = A.cam([-17, 51.5, A.mobile ? 900 : 1000], V.cx, V.cy + (A.mobile ? 0 : V.h * 0.02));
      mapBase(c, a, T, { top: '#060A10', bot: '#03060A' });
      c.save(); c.globalAlpha = a;
      A.strokePts(ALL_OUT, T, 'rgba(255,178,63,.4)', 1.2);
      const r = A.routeAt(A.routeBack, t);
      A.strokePts(r.trail, T, 'rgba(120,220,250,.95)', 2);
      c.restore();
      const h = T.S(r.head);
      A.glow(h[0], h[1], 26, 'cyan', a * (1 - sstep(2.2, 2.5, s)));
      pulseRings(T, A.BACK, t, A.C.ack);
      [['nyc', -8, -2], ['bude', 0, 14], ['fra', 8, 10], ['msk', 8, -10]].forEach(([id, dx, dy]) => {
        const wp = A.BACK.find((w) => w[0] === id);
        city(T, id, a * (t >= wp[1] ? 1 : 0.6), { dx, dy, hot: false, size: 10 });
      });
      void s;
    },
    build(el) {
      el.innerHTML = '<div class="done"><div><div class="done__bub"><span class="done__txt"></span><div class="done__meta"><span>21:04</span>' + A.ST_ICONS.two.replace('viewBox="0 0 22 13"', 'viewBox="0 0 22 13" width="26" height="16"') + '</div></div><p class="done__lbl">' + A.t('done.lbl') + '</p><p class="done__lbl done__ping" hidden>' + A.t('done.ping') + '</p></div></div>';
      els = { box: el.querySelector('.done'), txt: el.querySelector('.done__txt'), ping: el.querySelector('.done__ping'), _o: -1 };
      els.txt.textContent = A.msg.text;
    },
    update(st) {
      if (!els) return;
      const o = sstep(2.2, 2.55, st.s);
      if (Math.abs(o - els._o) > 0.004) {
        els.box.style.opacity = o.toFixed(3);
        els.box.style.transform = 'scale(' + (0.94 + 0.06 * A.u.ease.out(o)).toFixed(4) + ')';
        els._o = o;
      }
      if (els.txt.textContent !== A.msg.text) els.txt.textContent = A.msg.text;
      const isPing = /^\s*ping\s*$/i.test(A.msg.text);
      if (els.ping.hidden === isPing) els.ping.hidden = !isPing;
    }
  };
})();
})();
