/* Core: utils, i18n, message model, layout, scroll → story time, render loop, HUD. */
(() => {
'use strict';
const A = window.APP = window.APP || {};

// ---------- utils ----------
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const keys = (ks, s) => {
  if (s <= ks[0][0]) return ks[0][1];
  for (let i = 1; i < ks.length; i++) {
    if (s <= ks[i][0]) {
      const [s0, v0] = ks[i - 1], [s1, v1] = ks[i];
      return lerp(v0, v1, (s - s0) / ((s1 - s0) || 1));
    }
  }
  return ks[ks.length - 1][1];
};
// Smooth keyframes for camera-like values: [[s, ...vals]] with smoothstep easing between keys.
const keysN = (ks, s) => {
  if (s <= ks[0][0]) return ks[0].slice(1);
  for (let i = 1; i < ks.length; i++) {
    if (s <= ks[i][0]) {
      const a = ks[i - 1], b = ks[i];
      const t = sstep(a[0], b[0], s);
      return a.slice(1).map((v, j) => lerp(v, b[j + 1], t));
    }
  }
  return ks[ks.length - 1].slice(1);
};
const ease = {
  out: (t) => 1 - Math.pow(1 - t, 3),
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t) => { const c = 1.6; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
};
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
A.u = { clamp, lerp, sstep, keys, keysN, ease, rng };

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
A.$ = $; A.$$ = $$;

// ---------- events ----------
const handlers = {};
A.on = (ev, fn) => { (handlers[ev] = handlers[ev] || []).push(fn); };
A.emit = (ev, data) => { (handlers[ev] || []).forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } }); };

// ---------- storage (per-viewer conveniences only) ----------
A.store = {
  get(k) { try { return localStorage.getItem('200ms.' + k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem('200ms.' + k, v); } catch (e) { /* storage unavailable */ } }
};

// ---------- i18n ----------
A.lang = (A.store.get('lang') === 'en') ? 'en' : (A.store.get('lang') === 'ru' ? 'ru' : ((navigator.language || 'ru').toLowerCase().startsWith('ru') ? 'ru' : 'en'));
A.t = (key, vars) => {
  let s = (A.I18N[A.lang] && A.I18N[A.lang][key]);
  if (s === undefined) s = A.I18N.ru[key];
  if (s === undefined) return key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
  return s;
};
const pr = { ru: new Intl.PluralRules('ru-RU'), en: new Intl.PluralRules('en-US') };
A.plural = (n, key) => {
  const forms = A.t('plural.' + key);
  if (A.lang === 'ru') {
    const c = pr.ru.select(n);
    return c === 'one' ? forms[0] : c === 'few' ? forms[1] : forms[2];
  }
  return pr.en.select(n) === 'one' ? forms[0] : forms[1];
};
const nfCache = {};
A.fmt = (n, d = 0) => {
  const k = A.lang + d;
  const nf = nfCache[k] || (nfCache[k] = new Intl.NumberFormat(A.lang === 'ru' ? 'ru-RU' : 'en-US', { minimumFractionDigits: d, maximumFractionDigits: d }));
  return nf.format(n).replace(/ | /g, ' ');
};
A.dec = () => (A.lang === 'ru' ? ',' : '.');
// Human duration from seconds, e.g. 0.035 → "35 мс", 2.5 → "2,5 с"
A.fmtDur = (sec) => {
  if (sec < 0.001) return A.fmt(sec * 1e6, sec * 1e6 < 10 ? 1 : 0) + ' ' + A.t('u.us');
  if (sec < 1) { const ms = sec * 1000; return A.fmt(ms, ms < 10 ? 1 : 0) + ' ' + A.t('u.ms'); }
  if (sec < 60) return A.fmt(sec, sec < 10 ? 1 : 0) + ' ' + A.t('u.s');
  if (sec < 3600) return A.fmt(sec / 60, 1) + ' ' + A.t('u.min');
  if (sec < 86400 * 2) return A.fmt(sec / 3600, 1) + ' ' + A.t('u.h');
  return A.fmt(sec / 86400, 0) + ' ' + A.t('u.d');
};
A.nBytes = (n) => A.fmt(n) + ' ' + A.plural(n, 'byte');
A.nBits = (n) => A.fmt(n) + ' ' + A.plural(n, 'bit');

A.applyI18n = (root = document) => {
  $$('[data-i18n]', root).forEach((el) => { el.innerHTML = A.t(el.dataset.i18n); });
};

A.state = A.state || { guess: null, react: null, best: null };

// ---------- message model ----------
const enc = new TextEncoder();
A.msg = { text: '', chars: [], bytes: new Uint8Array(0), cipher: null, iv: null, real: true, custom: false };
let cryptoKey = null;
let encSeq = 0;
A.setMessage = (text, custom) => {
  text = Array.from(String(text || '').replace(/\s+/g, ' ')).slice(0, 32).join('');
  if (!text.trim()) text = A.t('chat.default');
  const m = A.msg;
  m.text = text;
  if (custom !== undefined) m.custom = custom;
  m.chars = Array.from(text).map((ch) => {
    const cp = ch.codePointAt(0);
    return { ch, cp, hex: 'U+' + cp.toString(16).toUpperCase().padStart(4, '0'), bytes: Array.from(enc.encode(ch)) };
  });
  m.bytes = enc.encode(text);
  m.cipher = null;
  const seq = ++encSeq;
  encrypt(m.bytes).then((r) => {
    if (seq !== encSeq) return;
    m.cipher = r.ct; m.iv = r.iv; m.real = r.real;
    A.emit('cipher', m);
  });
  A.emit('msg', m);
};
async function encrypt(bytes) {
  try {
    if (!window.crypto || !crypto.subtle) throw new Error('no subtle');
    cryptoKey = cryptoKey || await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, bytes));
    return { iv, ct, real: true };
  } catch (e) {
    const r = rng(bytes.length * 7919 + 17);
    const ct = new Uint8Array(bytes.length + 16).map(() => Math.floor(r() * 256));
    const iv = new Uint8Array(12).map(() => Math.floor(r() * 256));
    return { iv, ct, real: false };
  }
}
A.pkt = () => {
  const p = A.msg.bytes.length;
  const L = { core: p + 28, tls: 22, tcp: 20, ip: 20, wifi: 54 };
  return { payload: p, layers: L, total: L.core + L.tls + L.tcp + L.ip + L.wifi };
};
A.bin = (b) => b.toString(2).padStart(8, '0');

// ---------- layout ----------
const cv = $('#cv');
const ctx = cv.getContext('2d');
A.ctx = ctx;
A.W = 0; A.H = 0; A.dpr = 1; A.V = { x: 0, y: 0, w: 0, h: 0, cx: 0, cy: 0 }; A.mobile = false;
A.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
A.coarse = window.matchMedia('(pointer: coarse)').matches;
let lastW = 0, lastH = 0;

function layout(force) {
  const W = window.innerWidth;
  const Hs = Math.max(window.innerHeight, document.documentElement.clientHeight || 0);
  // Ignore small height changes from mobile browser chrome to avoid canvas thrash.
  if (!force && W === lastW && Math.abs(Hs - lastH) < 120) return false;
  lastW = W; lastH = Hs;
  const H = cv.clientHeight || Hs;
  const mobile = W < 821;
  const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.75 : 2);
  A.W = W; A.H = H; A.dpr = dpr; A.mobile = mobile;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  const V = mobile
    ? { x: 14, y: Math.max(64, H * 0.085), w: W - 28, h: H * 0.5 }
    : { x: W * 0.37, y: H * 0.1, w: W * 0.6, h: H * 0.78 };
  V.cx = V.x + V.w / 2; V.cy = V.y + V.h / 2;
  A.V = V;
  const r = document.documentElement.style;
  r.setProperty('--vx', V.x + 'px'); r.setProperty('--vy', V.y + 'px');
  r.setProperty('--vw', V.w + 'px'); r.setProperty('--vh', V.h + 'px');
  A.emit('resize');
  return true;
}
A.layout = layout;

// ---------- canvas helpers ----------
function sprite(inner, mid, outer) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, inner); gr.addColorStop(0.16, mid); gr.addColorStop(0.45, outer); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return c;
}
const SPR = {
  amber: sprite('rgba(255,244,220,1)', 'rgba(255,190,90,.85)', 'rgba(255,160,40,.22)'),
  cyan: sprite('rgba(230,250,255,1)', 'rgba(120,220,250,.8)', 'rgba(60,180,230,.2)'),
  white: sprite('rgba(255,255,255,1)', 'rgba(220,230,240,.5)', 'rgba(200,215,230,.12)')
};
A.glow = (x, y, r, kind = 'amber', a = 1) => {
  if (a <= 0 || r <= 0) return;
  const c = ctx;
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.globalAlpha = clamp(a);
  c.drawImage(SPR[kind], x - r, y - r, r * 2, r * 2);
  c.restore();
};
A.C = {
  night: '#06080C', night2: '#0B1118', steel: '#7F8C99', mist: '#A9B5C1', fog: '#E4E9EE',
  signal: '#FFB23F', signal2: '#FFD89A', ack: '#62D2F5', paper: '#E6E9EC', ink: '#0E1319', ink2: '#46515D'
};
A.rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
};
A.font = (size, { mono = true, weight = 500, italic = false } = {}) =>
  (italic ? 'italic ' : '') + weight + ' ' + size + 'px ' + (mono ? '"Source Code Pro", ui-monospace, monospace' : '"Source Serif 4", Georgia, serif');
// Small mono label (uppercased by default).
A.label = (text, x, y, o = {}) => {
  const c = ctx;
  c.save();
  c.globalAlpha = clamp(o.a === undefined ? 1 : o.a);
  c.font = A.font(o.size || 10.5, { mono: o.mono !== false, weight: o.weight || 500, italic: o.italic });
  c.fillStyle = o.color || A.C.mist;
  c.textAlign = o.align || 'left';
  c.textBaseline = o.base || 'middle';
  const t = o.upper === false ? text : String(text).toUpperCase();
  if (o.spacing !== false && 'letterSpacing' in c) c.letterSpacing = (o.ls !== undefined ? o.ls : (o.upper === false ? 0 : 1.1)) + 'px';
  if (o.bg) {
    const w = c.measureText(t).width;
    const ax = c.textAlign === 'center' ? x - w / 2 : c.textAlign === 'right' ? x - w : x;
    c.fillStyle = o.bg; c.fillRect(ax - 5, y - 9, w + 10, 18);
    c.fillStyle = o.color || A.C.mist;
  }
  c.fillText(t, x, y);
  c.restore();
};
// Callout: dot at (x1,y1), line to (x2,y2), text after.
A.callout = (x1, y1, x2, y2, text, o = {}) => {
  const c = ctx;
  const a = clamp(o.a === undefined ? 1 : o.a);
  if (a <= 0) return;
  c.save();
  c.globalAlpha = a;
  c.strokeStyle = o.line || A.rgba(A.C.steel, 0.8);
  c.lineWidth = 1;
  c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
  c.fillStyle = o.dot || A.C.signal;
  c.beginPath(); c.arc(x1, y1, 2.4, 0, Math.PI * 2); c.fill();
  c.restore();
  A.label(text, x2 + (o.align === 'right' ? -6 : 6), y2, { a, align: o.align || 'left', color: o.color, size: o.size });
};
A.bigNum = (text, x, y, o = {}) => {
  const c = ctx;
  c.save();
  c.globalAlpha = clamp(o.a === undefined ? 1 : o.a);
  c.font = A.font(o.size || 96, { mono: false, weight: o.weight || 250, italic: o.italic });
  c.fillStyle = o.color || A.C.fog;
  c.textAlign = o.align || 'center';
  c.textBaseline = o.base || 'alphabetic';
  if ('letterSpacing' in c) c.letterSpacing = (o.ls !== undefined ? o.ls : -2) + 'px';
  c.fillText(text, x, y);
  c.restore();
};
A.bg = (top, bottom, a = 1) => {
  const c = ctx;
  c.save();
  c.globalAlpha = a;
  const g = c.createLinearGradient(0, 0, 0, A.H);
  g.addColorStop(0, top); g.addColorStop(1, bottom);
  c.fillStyle = g; c.fillRect(0, 0, A.W, A.H);
  c.restore();
};
A.vignette = (x, y, r, color, a = 1) => {
  const c = ctx;
  c.save();
  c.globalAlpha = a;
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(0, 0, A.W, A.H);
  c.restore();
};

// ---------- maps ----------
const MD = window.MAP_DATA;
A.map = {};
if (window.d3 && MD) {
  const r = MD.route;
  const proj = d3.geoConicConformal().parallels(r.parallels).rotate(r.rotate).center(r.center).scale(r.scale).translate(r.translate);
  A.map.proj = proj;
  A.map.land = new Path2D(MD.route.land);
  A.map.land110 = MD.route.land110 ? new Path2D(MD.route.land110) : null;
  A.map.clip = MD.route.clip;
  A.map.grat = new Path2D(d3.geoPath(proj)(d3.geoGraticule().step([10, 10]).extent([[-180, 0], [180, 84]])()));
  A.map.P = (ll) => proj(ll);
  const W = MD.world;
  const wproj = d3.geoEqualEarth().scale(W.scale).translate(W.translate);
  A.map.wproj = wproj;
  A.map.wland = new Path2D(W.land);
  A.map.wsphere = new Path2D(d3.geoPath(wproj)({ type: 'Sphere' }));
  A.map.wgrat = new Path2D(d3.geoPath(wproj)(d3.geoGraticule10()));
}
// Camera → screen transform for the route map. cam = [lon, lat, span]: `span` base units fit the visual box.
A.cam = (cam, cx = A.V.cx, cy = A.V.cy) => {
  const p = A.map.P([cam[0], cam[1]]);
  const k = Math.min(A.V.w, A.V.h * 1.25) / cam[2];
  return { k, ox: cx - p[0] * k, oy: cy - p[1] * k, S: (q) => [q[0] * k + cx - p[0] * k, q[1] * k + cy - p[1] * k] };
};
// Camera keyframes [[s, lon, lat, span]]: eased position, log-interpolated span.
A.camAt = (ks, s) => {
  if (s <= ks[0][0]) return ks[0].slice(1);
  for (let i = 1; i < ks.length; i++) {
    if (s <= ks[i][0]) {
      const a = ks[i - 1], b = ks[i];
      const t = sstep(a[0], b[0], s);
      return [lerp(a[1], b[1], t), lerp(a[2], b[2], t), Math.exp(lerp(Math.log(a[3]), Math.log(b[3]), t))];
    }
  }
  return ks[ks.length - 1].slice(1);
};
A.drawLand = (T, o = {}) => {
  const c = ctx, d = A.dpr;
  c.save();
  c.setTransform(d * T.k, 0, 0, d * T.k, d * T.ox, d * T.oy);
  if (o.grat) { c.strokeStyle = o.grat; c.lineWidth = 1 / T.k; c.stroke(A.map.grat); }
  const fill = o.fill || '#0E151E', stroke = o.stroke || 'rgba(127,140,153,.42)', lw = (o.lw || 0.9) / T.k;
  c.lineJoin = 'round';
  const [[x0, y0], [x1, y1]] = A.map.clip || [[-1e5, -1e5], [1e5, 1e5]];
  const inset = 3;
  // Is any part of the view outside the detailed box? Then paint the coarse backdrop there.
  const vx0 = -T.ox / T.k, vy0 = -T.oy / T.k, vx1 = (A.W - T.ox) / T.k, vy1 = (A.H - T.oy) / T.k;
  if (A.map.land110 && (vx0 < x0 + inset || vy0 < y0 + inset || vx1 > x1 - inset || vy1 > y1 - inset)) {
    c.save();
    const hole = new Path2D();
    hole.rect(vx0 - 10, vy0 - 10, vx1 - vx0 + 20, vy1 - vy0 + 20);
    hole.rect(x0 + inset, y0 + inset, x1 - x0 - inset * 2, y1 - y0 - inset * 2);
    c.clip(hole, 'evenodd');
    c.fillStyle = fill; c.fill(A.map.land110);
    c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(A.map.land110);
    c.restore();
    c.save();
    c.beginPath(); c.rect(x0 + inset, y0 + inset, x1 - x0 - inset * 2, y1 - y0 - inset * 2); c.clip();
  } else c.save();
  c.fillStyle = fill; c.fill(A.map.land);
  c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(A.map.land);
  c.restore();
  c.restore();
};

// Route model: waypoints with times, great-circle polylines in projected base coords.
const PLACES = {
  msk: [37.62, 55.75], spb: [30.32, 59.94], hel: [24.94, 60.17], sto: [18.07, 59.33], cph: [12.57, 55.68],
  ham: [9.99, 53.55], fra: [8.68, 50.11], lon: [-0.13, 51.51], bude: [-4.55, 50.83], li: [-72.87, 40.8], nyc: [-74.0, 40.71]
};
A.PLACES = PLACES;
const OUT = [['msk', 10], ['spb', 14], ['hel', 16.5], ['sto', 19.5], ['cph', 24], ['ham', 27], ['fra', 32], ['fra', 36], ['lon', 40.5], ['bude', 43], ['li', 74], ['nyc', 75], ['nyc', 100]];
const BACK = [['nyc', 100], ['nyc', 123], ['li', 124], ['bude', 155], ['lon', 157.5], ['fra', 162], ['fra', 165], ['ham', 170], ['cph', 173], ['sto', 177.5], ['hel', 180.5], ['spb', 183], ['msk', 187], ['msk', 200]];
A.OUT = OUT; A.BACK = BACK;
function buildRoute(wps) {
  const segs = [];
  for (let i = 1; i < wps.length; i++) {
    const [a, ta] = wps[i - 1], [b, tb] = wps[i];
    const pa = PLACES[a], pb = PLACES[b];
    const pts = [];
    if (a === b) { pts.push(A.map.P(pa), A.map.P(pb)); }
    else {
      const ip = d3.geoInterpolate(pa, pb);
      const n = b === 'li' || a === 'li' ? 90 : 16;
      for (let j = 0; j <= n; j++) pts.push(A.map.P(ip(j / n)));
    }
    let len = 0; const cum = [0];
    for (let j = 1; j < pts.length; j++) { len += Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]); cum.push(len); }
    segs.push({ a, b, ta, tb, pts, cum, len });
  }
  return segs;
}
if (A.map.P) { A.routeOut = buildRoute(OUT); A.routeBack = buildRoute(BACK); }
// Position (base coords) + traveled polyline at time t.
A.routeAt = (segs, t) => {
  const trail = [];
  let head = segs[0].pts[0];
  for (const s of segs) {
    if (t >= s.tb) { trail.push(...s.pts); head = s.pts[s.pts.length - 1]; continue; }
    if (t <= s.ta) break;
    const f = (t - s.ta) / (s.tb - s.ta);
    const L = f * s.len;
    let j = 1;
    while (j < s.cum.length - 1 && s.cum[j] < L) j++;
    const f2 = (L - s.cum[j - 1]) / ((s.cum[j] - s.cum[j - 1]) || 1);
    const p = [lerp(s.pts[j - 1][0], s.pts[j][0], f2), lerp(s.pts[j - 1][1], s.pts[j][1], f2)];
    trail.push(...s.pts.slice(0, j), p);
    head = p;
    break;
  }
  return { head, trail };
};
A.strokePts = (pts, T, style, width, dash) => {
  if (pts.length < 2) return;
  const c = ctx;
  c.save();
  c.strokeStyle = style; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round';
  if (dash) c.setLineDash(dash);
  c.beginPath();
  const p0 = T.S(pts[0]); c.moveTo(p0[0], p0[1]);
  for (let i = 1; i < pts.length; i++) { const p = T.S(pts[i]); c.lineTo(p[0], p[1]); }
  c.stroke();
  c.restore();
};
A.allPts = (segs) => segs.reduce((acc, s) => acc.concat(s.pts), []);

// ---------- story DOM ----------
A.SC = A.SC || {};
A.scenes = [];
function buildStory() {
  const host = $('#scenes');
  host.innerHTML = '';
  A.scenes = A.STORY.map((def) => {
    const sec = document.createElement('section');
    sec.className = 'scene';
    sec.id = 'sc-' + def.id;
    sec.dataset.scene = def.id;
    sec.dataset.tone = def.tone;
    sec.setAttribute('aria-label', A.t('ch.' + def.id));
    def.steps.forEach((st, i) => {
      const step = document.createElement('div');
      step.className = 'step';
      step.dataset.i = i;
      const card = document.createElement('article');
      card.className = 'card';
      if (st.startsWith('q:')) { card.classList.add('quiz'); card.dataset.quiz = st.slice(2); }
      else if (st === 'race') { card.classList.add('card--wide'); card.dataset.race = '1'; }
      else card.dataset.k = 's.' + def.id + '.' + st;
      step.appendChild(card);
      sec.appendChild(step);
    });
    host.appendChild(sec);
    const sc = A.SC[def.id] || {};
    return Object.assign({ id: def.id, tone: def.tone, n: def.steps.length, el: sec, top: 0, h: 1, s: -1, a: 0, ov: null, keys: [[0, 0]] }, sc, { def });
  });
  fillCards();
  // Overlays
  const ovHost = $('#overlay');
  ovHost.innerHTML = '';
  A.scenes.forEach((sc) => {
    if (sc.build) {
      const el = document.createElement('div');
      el.className = 'ov ov-' + sc.id;
      ovHost.appendChild(el);
      sc.ov = el;
      sc.build(el);
    }
  });
}
function fillCards() {
  A.scenes.forEach((sc) => {
    $$('.card', sc.el).forEach((card) => {
      if (card.dataset.k) {
        const k = card.dataset.k;
        const vars = sc.vars ? sc.vars(k) : null;
        let html = '<p class="card__k">' + A.t(k + '.k') + '</p><p class="card__b">' + A.t(k + '.b', vars) + '</p>';
        if (A.I18N.ru[k + '.n']) html += '<p class="card__n x-nerd">' + A.t(k + '.n', vars) + '</p>';
        if (k === 's.bits.4' && !A.msg.real) html += '<p class="card__n">' + A.t('s.bits.4.fake') + '</p>';
        card.innerHTML = html;
      } else if (card.dataset.quiz) {
        A.emit('quiz:build', card);
      } else if (card.dataset.race) {
        A.emit('race:build', card);
      }
    });
  });
}
A.fillCards = fillCards;
A.refreshCard = (key) => {
  const card = $('.card[data-k="' + key + '"]');
  if (!card) return;
  const sc = A.scenes.find((s) => key.startsWith('s.' + s.id + '.'));
  const vars = sc && sc.vars ? sc.vars(key) : null;
  const b = $('.card__b', card);
  if (b) b.innerHTML = A.t(key + '.b', vars);
};

// ---------- measuring ----------
const blocks = [];
function measure() {
  const y = scrollY();
  A.scenes.forEach((sc) => {
    const r = sc.el.getBoundingClientRect();
    sc.top = r.top + y; sc.h = r.height;
  });
  blocks.length = 0;
  ['hero', 'setup', 'finale', 'sandbox', 'epilogue'].forEach((id) => {
    const el = document.getElementById(id);
    const r = el.getBoundingClientRect();
    blocks.push({ id, top: r.top + y, h: r.height, theme: el.dataset.theme });
  });
  const f = A.scenes[0], l = A.scenes[A.scenes.length - 1];
  A.storyTop = f.top; A.storyBot = l.top + l.h;
  A.docH = document.documentElement.scrollHeight;
  A.emit('measure');
}
A.measure = measure;

// ---------- scroll ----------
A.lenis = null;
function scrollY() { return A.lenis ? A.lenis.animatedScroll : (window.scrollY || window.pageYOffset || 0); }
A.scrollY = scrollY;
A.scrollTo = (y, opts = {}) => {
  y = clamp(y, 0, Math.max(0, (A.docH || document.documentElement.scrollHeight) - window.innerHeight));
  if (A.lenis) A.lenis.scrollTo(y, { immediate: !!opts.immediate, duration: opts.duration || 1.4, lock: false, force: true });
  else window.scrollTo({ top: y, behavior: opts.immediate || A.reduced ? 'auto' : 'smooth' });
};
// Scroll position where scene sc has step position s at the viewport centre.
A.yFor = (sc, s) => sc.top + (s / sc.n) * sc.h - A.H / 2;
A.yForTime = (ms) => {
  for (const sc of A.scenes) {
    const ks = sc.keys;
    const t0 = ks[0][1], t1 = ks[ks.length - 1][1];
    if (ms >= t0 && ms <= t1 && t1 > t0) {
      // invert piecewise-linear keys: first s where t(s) >= ms
      for (let i = 1; i < ks.length; i++) {
        if (ks[i][1] >= ms && ks[i][1] > ks[i - 1][1]) {
          const f = (ms - ks[i - 1][1]) / (ks[i][1] - ks[i - 1][1]);
          return A.yFor(sc, lerp(ks[i - 1][0], ks[i][0], clamp(f)));
        }
      }
    }
  }
  return ms <= 0 ? A.yFor(A.scenes[0], 0.5) : A.yFor(A.scenes[A.scenes.length - 1], A.scenes[A.scenes.length - 1].n - 0.5);
};

// ---------- HUD ----------
const hud = $('#hud'), hudT = $('#hudT'), hudX = $('#hudX'), trackFill = $('#trackFill'), trackHead = $('#trackHead');
const hudMsg = $('#hudMsg'), hudSt = $('#hudSt'), progressBar = $('#progressBar'), track = $('#track');
A.fmtT = (ms) => {
  const s = Math.max(0, ms).toFixed(6);
  const [i, d] = s.split('.');
  return i + A.dec() + d.slice(0, 3) + ' ' + d.slice(3);
};
const ST_ICONS = {
  wait: '<svg viewBox="0 0 22 13" aria-hidden="true"><circle class="clk" cx="11" cy="6.5" r="5"/><path d="M11 3.8v2.9l1.8 1.1"/></svg>',
  one: '<svg viewBox="0 0 22 13" aria-hidden="true"><path d="M5 6.8l3 3 6-6.6"/></svg>',
  two: '<svg viewBox="0 0 22 13" aria-hidden="true"><path d="M2 6.8l3 3 6-6.6M9 9.8l6.2-6.6M11.5 9.1l.7.7"/></svg>'
};
A.ST_ICONS = ST_ICONS;
let hudState = { t: -1, st: '', x: '', on: null, cur: '' };
function statusFor(t) { return t >= 200 ? 'two' : t >= 65 ? 'one' : 'wait'; }
function updateHud(t, factor, curId, prog) {
  const on = A.hudOn;
  if (on !== hudState.on) { hud.classList.toggle('is-on', on); hudState.on = on; }
  if (!on) return;
  if (Math.abs(t - hudState.t) > 1e-9) { hudT.textContent = A.fmtT(t); hudState.t = t; }
  const x = factor ? A.t('ui.slow', { x: A.fmt(factor) }) : A.t('ui.still');
  if (x !== hudState.x) { hudX.textContent = x; hudState.x = x; }
  const st = statusFor(t);
  if (st !== hudState.st) {
    hudSt.innerHTML = ST_ICONS[st];
    hudSt.classList.toggle('is-ack', st === 'two');
    hudState.st = st;
  }
  trackFill.style.transform = 'scaleX(' + prog + ')';
  trackHead.style.left = (prog * 100) + '%';
  track.setAttribute('aria-valuenow', Math.round(prog * 100));
  if (curId !== hudState.cur) {
    $$('.hud__tick', hud).forEach((b) => b.classList.toggle('is-cur', b.dataset.id === curId));
    $$('#chapterList button').forEach((b) => b.classList.toggle('is-cur', b.dataset.id === curId));
    hudState.cur = curId;
  }
}
A.buildTicks = () => {
  const host = $('#trackTicks');
  host.innerHTML = '';
  const span = A.storyBot - A.storyTop;
  A.scenes.forEach((sc) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'hud__tick';
    b.dataset.id = sc.id;
    b.style.left = (((sc.top - A.storyTop) / span) * 100) + '%';
    b.setAttribute('aria-label', A.t('ch.' + sc.id));
    b.innerHTML = '<span>' + A.t('ch.' + sc.id) + '</span>';
    b.addEventListener('click', (e) => { e.stopPropagation(); A.stopAuto && A.stopAuto(); A.scrollTo(A.yFor(sc, 0.5)); });
    host.appendChild(b);
  });
  const list = $('#chapterList');
  list.innerHTML = '';
  A.scenes.forEach((sc) => {
    const li = document.createElement('li');
    const t0 = sc.keys[0][1];
    li.innerHTML = '<button type="button" data-id="' + sc.id + '">' + A.t('ch.' + sc.id) + '<span>' + A.fmt(t0, t0 % 1 ? 1 : 0) + ' ' + A.t('u.ms') + '</span></button>';
    li.firstChild.addEventListener('click', () => { $('#chapters').hidden = true; A.scrollTo(A.yFor(sc, 0.5)); });
    list.appendChild(li);
  });
  const fin = document.createElement('li');
  fin.innerHTML = '<button type="button" data-id="fin">' + A.t('ch.fin') + '<span>200 ' + A.t('u.ms') + '</span></button>';
  fin.firstChild.addEventListener('click', () => { $('#chapters').hidden = true; A.scrollTo(blocks.find((b) => b.id === 'finale').top); });
  list.appendChild(fin);
};
A.setHudMsg = () => { hudMsg.textContent = A.msg.text; };

// ---------- render loop ----------
const SEC_PER_STEP = 2.5;
A.time = 0; A.cur = null; A.hudOn = false;
let last = performance.now();
let uiTheme = '';
A.frame = 0;
function frame(now) {
  requestAnimationFrame(frame);
  step(now);
}
// One synchronous render (also used when the tab is throttled, e.g. for thumbnails).
A.renderNow = () => step(performance.now());
function step(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  A.frame++;
  if (A.lenis) A.lenis.raf(now);
  A.emit('pre', dt);
  const y = scrollY();
  const H = A.H, W = A.W;
  const center = y + H / 2;

  // scene visibility
  let dom = null, domA = 0;
  for (const sc of A.scenes) {
    const s = ((center - sc.top) / sc.h) * sc.n;
    sc.s = s;
    const a = sstep(-0.42, 0.12, s) * (1 - sstep(sc.n - 0.12, sc.n + 0.42, s));
    sc.a = a;
    if (a > domA) { domA = a; dom = sc; }
  }

  // story time
  let t = 0, factor = 0, curId = '';
  if (center < A.storyTop) t = 0;
  else if (center >= A.storyBot) t = 200;
  else {
    const sc = A.scenes.find((q) => center >= q.top && center < q.top + q.h) || dom;
    if (sc) {
      const s = clamp(sc.s, 0, sc.n);
      t = keys(sc.keys, s);
      const t2 = keys(sc.keys, clamp(s + 0.02, 0, sc.n));
      const d = (t2 - t) / 0.02;
      if (d > 1e-12) {
        const f = (SEC_PER_STEP * 1000) / d;
        const p = Math.pow(10, Math.floor(Math.log10(f)) - 1);
        factor = Math.max(1, Math.round(f / p) * p);
      }
      curId = sc.id;
    }
  }
  A.time = t; A.cur = dom;
  A.hudOn = center > A.storyTop - H * 0.1 && center < A.storyBot + H * 0.05;

  // draw
  const anyVisible = A.scenes.some((sc) => sc.a > 0.001);
  const c = ctx;
  c.setTransform(A.dpr, 0, 0, A.dpr, 0, 0);
  if (anyVisible) {
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    c.fillStyle = '#05070A'; c.fillRect(0, 0, W, H);
    for (const sc of A.scenes) {
      if (sc.a > 0.001 && sc.draw) {
        c.save();
        // With reduced motion, ambient (time-based) movement freezes; scroll-driven changes stay.
        try { sc.draw(c, { s: sc.s, n: sc.n, a: sc.a, now: A.reduced ? 0 : now / 1000, dt, t, W, H, V: A.V }); } catch (e) { if (!sc._err) { console.error(sc.id, e); sc._err = 1; } }
        c.restore();
        c.setTransform(A.dpr, 0, 0, A.dpr, 0, 0);
      }
    }
  }
  // overlays
  for (const sc of A.scenes) {
    if (!sc.ov) continue;
    const a = sc.a;
    const live = a > 0.004;
    if (live !== sc._live) { sc.ov.classList.toggle('is-live', live); sc._live = live; }
    const hot = a > 0.6;
    if (hot !== sc._hot) { sc.ov.classList.toggle('is-hot', hot); sc._hot = hot; }
    if (live || sc._lastA > 0.004) {
      sc.ov.style.opacity = a.toFixed(3);
      if (sc.update) { try { sc.update({ s: sc.s, n: sc.n, a, t, now: A.reduced ? 0 : now / 1000 }); } catch (e) { if (!sc._uerr) { console.error(sc.id, e); sc._uerr = 1; } } }
    }
    sc._lastA = a;
  }

  // HUD + progress + theme
  const prog = clamp((center - A.storyTop) / (A.storyBot - A.storyTop));
  updateHud(t, factor, curId, prog);
  const docMax = Math.max(1, A.docH - window.innerHeight);
  progressBar.style.transform = 'scaleX(' + clamp(y / docMax).toFixed(4) + ')';
  const probe = y + 36;
  let th = 'night';
  const b = blocks.find((q) => probe >= q.top && probe < q.top + q.h);
  if (b) th = b.theme;
  else {
    const sc = A.scenes.find((q) => probe >= q.top && probe < q.top + q.h);
    if (sc) th = sc.tone;
  }
  if (th !== uiTheme) { document.body.dataset.ui = th; uiTheme = th; }
  A.emit('tick', { t, dt, now, y, center });
}

// ---------- boot ----------
function grain() {
  const c = document.createElement('canvas');
  c.width = c.height = 220;
  const g = c.getContext('2d');
  const img = g.createImageData(220, 220);
  const r = rng(99);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = r() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  document.documentElement.style.setProperty('--grain', 'url(' + c.toDataURL('image/png') + ')');
}

A.boot = () => {
  document.documentElement.lang = A.lang;
  A.setMessage(A.store.get('msg') || A.t('chat.default'), !!A.store.get('msg'));
  A.applyI18n();
  buildStory();
  layout(true);
  grain();
  if (window.Lenis && !A.reduced) {
    try {
      A.lenis = new Lenis({ autoRaf: false, lerp: 0.11, wheelMultiplier: 0.9, smoothWheel: true });
    } catch (e) { A.lenis = null; }
  }
  measure();
  A.buildTicks();
  A.setHudMsg();
  A.emit('boot');
  requestAnimationFrame(frame);
  window.addEventListener('resize', () => { if (layout()) { measure(); A.buildTicks(); } });
  window.addEventListener('orientationchange', () => setTimeout(() => { layout(true); measure(); A.buildTicks(); }, 250));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measure(); A.buildTicks(); A.emit('fonts'); });
  window.addEventListener('load', () => { measure(); A.buildTicks(); });
  if ('ResizeObserver' in window) {
    let to = 0;
    new ResizeObserver(() => { clearTimeout(to); to = setTimeout(() => { measure(); A.buildTicks(); }, 120); }).observe(document.body);
  }
};

A.setLang = (lang) => {
  A.lang = lang;
  A.store.set('lang', lang);
  document.documentElement.lang = lang;
  if (!A.msg.custom) A.setMessage(A.t('chat.default'), false);
  A.applyI18n();
  A.scenes.forEach((sc) => { sc.el.setAttribute('aria-label', A.t('ch.' + sc.id)); if (sc.ov && sc.build) { sc.ov.innerHTML = ''; sc.build(sc.ov); } });
  fillCards();
  hudState.x = ''; hudState.t = -1; hudState.cur = '';
  A.setHudMsg();
  measure();
  A.buildTicks();
  A.emit('lang', lang);
};
})();
