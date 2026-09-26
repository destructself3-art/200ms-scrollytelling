/* Features: setup chat + guess, quizzes, race chart, finale widgets, sandbox, epilogue, controls, autoplay, keys. */
(() => {
'use strict';
const A = window.APP;
const { clamp, lerp, sstep } = A.u;
const $ = A.$, $$ = A.$$;
const TAU = Math.PI * 2;
A.state = A.state || { guess: null, react: null, best: null };

// ---------- toast ----------
const toastEl = $('#toast');
let toastTo = 0;
A.toast = (html, ms = 4600) => {
  toastEl.innerHTML = html;
  toastEl.hidden = false;
  toastEl.style.animation = 'none'; void toastEl.offsetWidth; toastEl.style.animation = '';
  clearTimeout(toastTo);
  toastTo = setTimeout(() => { toastEl.hidden = true; }, ms);
};

// ---------- clipboard ----------
async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) { return false; }
}
function baseUrl() {
  const ref = document.referrer || '';
  if (/^https:\/\/claude\.ai\/.*artifact/.test(ref)) return ref.split('#')[0];
  return location.href.split('#')[0];
}

/* ================= setup: chat + guess ================= */
const input = $('#msgInput'), countEl = $('#msgCount'), form = $('#chatForm'), draft = $('#draftBubble'), draftText = $('#draftText');
function syncInput() {
  input.value = A.msg.text;
  countEl.textContent = Array.from(input.value).length;
  $('#sendBtn').setAttribute('aria-label', A.t('chat.send'));
}
input.addEventListener('input', () => {
  let v = input.value;
  const arr = Array.from(v);
  if (arr.length > 32) { v = arr.slice(0, 32).join(''); input.value = v; }
  countEl.textContent = Array.from(v).length;
  A.setMessage(v, true);
  A.store.set('msg', v.trim() ? v : '');
  A.setHudMsg();
});
form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!input.value.trim()) { input.value = A.msg.text; }
  A.setMessage(input.value, input.value !== A.t('chat.default'));
  A.setHudMsg();
  draftText.textContent = A.msg.text;
  draft.querySelector('time').innerHTML = '21:04 <svg class="st" viewBox="0 0 22 13" aria-hidden="true"><circle cx="11" cy="6.5" r="5" fill="none" stroke="rgba(30,18,0,.55)" stroke-width="1.5"/><path d="M11 3.8v2.9l1.8 1.1" fill="none" stroke="rgba(30,18,0,.55)" stroke-width="1.5" stroke-linecap="round"/></svg>';
  draft.classList.remove('is-sent'); void draft.offsetWidth; draft.classList.add('is-sent');
  const txt = A.msg.text.trim();
  if (/^lo$/i.test(txt)) A.toast(A.t('toast.lo'), 8000);
  else if (/^ping$/i.test(txt)) A.toast(A.t('toast.ping'));
  else A.toast(A.t('toast.sent'), 3200);
  A.audio && A.audio.blip && A.audio.blip(880, 0.08);
  setTimeout(() => A.scrollTo(A.yFor(A.scenes[0], 0.5), { duration: 2.2 }), 650);
});

const range = $('#guessRange'), gOut = $('#guessOut'), gNote = $('#guessNote');
const toSec = (v) => Math.pow(10, -3 + (v / 1000) * 4);
const toVal = (sec) => clamp(((Math.log10(sec) + 3) / 4) * 1000, 0, 1000);
function niceSec(sec) {
  const p = Math.pow(10, Math.floor(Math.log10(sec)));
  const m = sec / p;
  const r = m < 1.5 ? 1 : m < 2.25 ? 2 : m < 3.5 ? 3 : m < 4.5 ? 4 : m < 6 ? 5 : m < 8.5 ? 7 : 10;
  return r * p;
}
function syncGuess() {
  const sec = niceSec(toSec(+range.value));
  gOut.textContent = A.fmtDur(sec);
  range.style.setProperty('--fill', (+range.value / 10) + '%');
  range.setAttribute('aria-valuetext', A.fmtDur(sec));
  return sec;
}
range.addEventListener('input', () => { syncGuess(); });
$('#guessLock').addEventListener('click', () => {
  const sec = syncGuess();
  A.state.guess = sec;
  A.store.set('guess', String(sec));
  gNote.textContent = A.t('guess.locked', { v: A.fmtDur(sec) });
  A.emit('guess', sec);
});

/* ================= quizzes ================= */
const QUIZ = { sat: { n: 2, right: 1 }, shark: { n: 3, right: 1 } };
A.on('quiz:build', (card) => {
  const id = card.dataset.quiz;
  const q = QUIZ[id];
  const done = card.dataset.ans;
  let html = '<p class="card__k">' + A.t('q.kicker') + '</p><p class="quiz__q">' + A.t('q.' + id + '.q') + '</p><div class="quiz__opts">';
  for (let i = 0; i < q.n; i++) html += '<button type="button" class="opt" data-i="' + i + '">' + A.t('q.' + id + '.o' + (i + 1)) + '</button>';
  html += '</div><div class="quiz__a"><p class="quiz__verdict"></p><p>' + A.t('q.' + id + '.a') + '</p></div>';
  card.innerHTML = html;
  card.querySelectorAll('.opt').forEach((b) => b.addEventListener('click', () => answer(card, +b.dataset.i)));
  if (done !== undefined) answer(card, +done, true);
});
function answer(card, i, silent) {
  const q = QUIZ[card.dataset.quiz];
  card.dataset.ans = i;
  card.classList.add('is-done');
  card.querySelectorAll('.opt').forEach((b) => {
    const k = +b.dataset.i;
    b.classList.toggle('is-right', k === q.right);
    b.classList.toggle('is-wrong', i >= 0 && k === i && k !== q.right);
    b.setAttribute('aria-pressed', k === i ? 'true' : 'false');
  });
  card.querySelector('.quiz__verdict').textContent = i < 0 ? A.t('q.auto') : A.t(i === q.right ? 'q.right' : 'q.wrong');
  if (!silent && A.audio && A.audio.blip) A.audio.blip(i === q.right ? 1175 : 330, 0.12);
}

/* ================= race chart ================= */
const RACE = [['ship', 864000], ['tel', 57600], ['conc', 12600], ['you', 0.031], ['light', 0.0177]];
const RMIN = Math.log10(0.01), RMAX = Math.log10(2e6);
const rpos = (v) => ((Math.log10(v) - RMIN) / (RMAX - RMIN)) * 100;
A.on('race:build', (card) => {
  const ticks = [[0.01, '10 ' + A.t('u.ms')], [1, '1 ' + A.t('u.s')], [60, '1 ' + A.t('u.min')], [3600, '1 ' + A.t('u.h')], [86400, '1 ' + A.t('u.d')]];
  card.innerHTML = '<p class="card__k">' + A.t('s.atl.race.k') + '</p><div class="race">' +
    RACE.map(([k, v]) => '<div class="race__row' + (k === 'you' ? ' race__row--you' : '') + '"><div class="race__lbl"><span>' + A.t('race.' + k) + '</span><b>' + A.t('race.' + k + '.v') + '</b></div><div class="race__bar"><i data-w="' + rpos(v).toFixed(2) + '"></i></div></div>').join('') +
    '<div class="race__axis" style="position:relative;height:14px">' + ticks.map(([v, l]) => '<span style="position:absolute;left:' + rpos(v).toFixed(2) + '%;transform:translateX(' + (v === 0.01 ? '0' : '-50%') + ')">' + l + '</span>').join('') + '</div>' +
    '</div><p class="race__note">' + A.t('race.note') + '</p>';
  const grow = () => card.querySelectorAll('.race__bar i').forEach((i) => { i.style.width = i.dataset.w + '%'; });
  if ('IntersectionObserver' in window && !A.reduced) {
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { grow(); io.disconnect(); } }, { threshold: 0.3 });
    io.observe(card);
    setTimeout(grow, 20000);
  } else grow();
});

/* ================= finale: replay ================= */
const rcv = $('#replayCv'), rctx = rcv.getContext('2d'), rRead = $('#replayRead');
let rAnim = null;
function fitRoute(w, h, pad) {
  const x0 = 40, x1 = 995, y0 = 60, y1 = 330;
  const k = Math.min((w - pad * 2) / (x1 - x0), (h - pad * 2) / (y1 - y0));
  const ox = (w - (x1 - x0) * k) / 2 - x0 * k, oy = (h - (y1 - y0) * k) / 2 - y0 * k;
  return { k, ox, oy, S: (q) => [q[0] * k + ox, q[1] * k + oy] };
}
function drawReplay(t) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = rcv.clientWidth || 800, h = rcv.clientHeight || 300;
  if (rcv.width !== Math.round(w * dpr)) { rcv.width = Math.round(w * dpr); rcv.height = Math.round(h * dpr); }
  const c = rctx;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.fillStyle = '#06080C'; c.fillRect(0, 0, w, h);
  const T = fitRoute(w, h, 18);
  c.save(); c.setTransform(dpr * T.k, 0, 0, dpr * T.k, dpr * T.ox, dpr * T.oy);
  c.fillStyle = '#0E151E'; c.fill(A.map.land);
  c.strokeStyle = 'rgba(127,140,153,.4)'; c.lineWidth = 0.8 / T.k; c.stroke(A.map.land);
  c.restore();
  const line = (pts, style, lw, dash) => {
    if (pts.length < 2) return;
    c.save(); c.strokeStyle = style; c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round'; if (dash) c.setLineDash(dash);
    c.beginPath(); const p0 = T.S(pts[0]); c.moveTo(p0[0], p0[1]);
    for (let i = 1; i < pts.length; i++) { const p = T.S(pts[i]); c.lineTo(p[0], p[1]); }
    c.stroke(); c.restore();
  };
  line(A.allPts(A.routeOut), 'rgba(255,178,63,.22)', 1, [3, 4]);
  const glow = (p, col) => {
    const g = c.createRadialGradient(p[0], p[1], 0, p[0], p[1], 18);
    g.addColorStop(0, col === 'a' ? 'rgba(255,240,210,1)' : 'rgba(230,250,255,1)');
    g.addColorStop(0.3, col === 'a' ? 'rgba(255,178,63,.7)' : 'rgba(98,210,245,.7)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(p[0] - 18, p[1] - 18, 36, 36);
  };
  if (t > 0) {
    const o = A.routeAt(A.routeOut, Math.min(t, 100));
    line(o.trail, 'rgba(255,190,90,.95)', 2);
    if (t <= 100) glow(T.S(o.head), 'a');
    if (t > 100) {
      const b = A.routeAt(A.routeBack, t);
      line(b.trail, 'rgba(120,220,250,.95)', 2);
      if (t < 200) glow(T.S(b.head), 'c');
    }
  }
  ['msk', 'fra', 'bude', 'nyc'].forEach((id) => {
    const p = T.S(A.map.P(A.PLACES[id]));
    c.fillStyle = '#E4E9EE'; c.beginPath(); c.arc(p[0], p[1], 2.5, 0, TAU); c.fill();
    c.font = '500 10px "Source Code Pro", monospace'; c.fillStyle = '#A9B5C1';
    c.textAlign = id === 'nyc' ? 'left' : 'left'; c.fillText(A.t('city.' + id).toUpperCase(), p[0] + 6, p[1] - 6);
  });
  if (t >= 200) {
    c.font = '600 14px "Source Code Pro", monospace'; c.fillStyle = '#62D2F5'; c.textAlign = 'right';
    c.fillText('✓✓ ' + A.t('done.lbl').toUpperCase(), w - 16, h - 16);
  }
}
function playReplay(mult) {
  cancelAnimationFrame(rAnim);
  const dur = 200 * mult;
  const t0 = performance.now();
  $$('#replay [data-speed]').forEach((b) => b.classList.toggle('is-on', +b.dataset.speed === mult));
  if (A.audio && A.audio.whoosh) A.audio.whoosh(dur / 1000);
  const step = (now) => {
    const f = clamp((now - t0) / dur);
    const t = f * 200;
    drawReplay(t);
    rRead.textContent = 't = ' + A.fmt(t, 1) + ' ' + A.t('u.ms') + (mult > 1 ? ' · ×' + mult : '');
    if (f < 1) rAnim = requestAnimationFrame(step);
    else { rRead.textContent = A.t('done.lbl') + ' · 200 ' + A.t('u.ms') + (mult === 1 ? ' · ' + A.t('rep.blink') : ''); if (A.audio && A.audio.chime) A.audio.chime(); }
  };
  rAnim = requestAnimationFrame(step);
}
$$('#replay [data-speed]').forEach((b) => b.addEventListener('click', () => playReplay(+b.dataset.speed)));

/* ================= finale: reaction ================= */
const pad = $('#reactPad'), padLbl = $('#reactLabel'), res = $('#reactRes');
let rx = { st: 'idle', to: 0, t0: 0 };
function rxLabel(key) { padLbl.textContent = A.t(key); padLbl.dataset.i18n = key; }
function rxHandle() {
  if (rx.st === 'idle') {
    rx.st = 'wait';
    pad.classList.add('is-wait'); pad.classList.remove('is-go');
    rxLabel('rx.wait');
    res.innerHTML = A.state.best ? A.t('rx.best', { ms: A.fmt(A.state.best) }) : '';
    rx.to = setTimeout(() => {
      rx.st = 'go'; rx.t0 = performance.now();
      pad.classList.remove('is-wait'); pad.classList.add('is-go');
      rxLabel('rx.go');
    }, 1200 + Math.random() * 2200);
  } else if (rx.st === 'wait') {
    clearTimeout(rx.to);
    rx.st = 'idle';
    pad.classList.remove('is-wait', 'is-go');
    rxLabel('rx.again');
    res.innerHTML = A.t('rx.early');
  } else if (rx.st === 'go') {
    const ms = Math.round(performance.now() - rx.t0);
    rx.st = 'idle';
    pad.classList.remove('is-wait', 'is-go');
    rxLabel('rx.again');
    A.state.react = ms;
    A.state.best = A.state.best ? Math.min(A.state.best, ms) : ms;
    res.innerHTML = A.t(ms < 200 ? 'rx.faster' : 'rx.slower', { ms: A.fmt(ms) });
    A.emit('react', ms);
  }
}
pad.addEventListener('pointerdown', (e) => { if (e.button !== 0 && e.pointerType === 'mouse') return; e.preventDefault(); rxHandle(); });
pad.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!e.repeat) rxHandle(); } });
pad.addEventListener('click', (e) => e.preventDefault());

/* ================= finale: verdict ================= */
function drawVerdict() {
  const svg = $('#verdictSvg');
  const x0 = 110, x1 = 505;
  const L0 = Math.log10(0.001), L1 = Math.log10(10);
  const X = (v) => x0 + ((Math.log10(clamp(v, 0.001, 10)) - L0) / (L1 - L0)) * (x1 - x0);
  const rows = [];
  if (A.state.guess != null) rows.push(['vd.guess', A.state.guess, '#46515D']);
  rows.push(['vd.anya', 0.1, '#8A4B00'], ['vd.ack', 0.2, '#0B6583']);
  let h = '<desc id="verdictDesc">' + A.t('vd.desc') + '</desc>';
  const axisY = 20 + rows.length * 42;
  [[0.001, '1 ' + A.t('u.ms')], [0.01, '10 ' + A.t('u.ms')], [0.1, A.fmt(0.1, 1) + ' ' + A.t('u.s')], [1, '1 ' + A.t('u.s')], [10, '10 ' + A.t('u.s')]].forEach(([v, l]) => {
    h += '<line x1="' + X(v) + '" x2="' + X(v) + '" y1="8" y2="' + (axisY - 6) + '" stroke="rgba(14,19,25,.12)"/>';
    h += '<text x="' + X(v) + '" y="' + (axisY + 10) + '" text-anchor="middle">' + l + '</text>';
  });
  rows.forEach(([k, v, col], i) => {
    const y = 26 + i * 42;
    h += '<text class="v-lbl" x="0" y="' + (y + 5) + '">' + A.t(k) + '</text>';
    h += '<rect x="' + x0 + '" y="' + (y - 7) + '" width="' + Math.max(2, X(v) - x0) + '" height="14" fill="' + col + '" opacity="' + (k === 'vd.guess' ? 0.55 : 0.9) + '"/>';
    const tx = X(v) + 8, anchor = X(v) > 430 ? 'end' : 'start';
    h += '<text class="v-val" x="' + (anchor === 'end' ? X(v) - 8 : tx) + '" y="' + (y + 4) + '" text-anchor="' + anchor + '"' + (anchor === 'end' ? ' style="fill:#fff"' : '') + '>' + A.fmtDur(v) + '</text>';
  });
  svg.innerHTML = h;
  svg.setAttribute('viewBox', '0 0 520 ' + (axisY + 18));
  $('#verdictText').textContent = A.state.guess != null ? A.t('vd.text', { g: A.fmtDur(A.state.guess) }) : A.t('vd.none');
}

/* ================= sandbox ================= */
const wcv = $('#worldCv'), wctx = wcv.getContext('2d'), statsEl = $('#sbStats'), chipsEl = $('#chips');
const MSK = [37.62, 55.75];
let target = { id: 'nyc', ll: [-74.006, 40.713] };
let arcAnim = { t0: 0, dur: 1300 };
function worldScale() { return (wcv.clientWidth || 800) / 1000; }
function drawWorld(now) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = wcv.clientWidth || 800, h = w * (A.map.wproj ? 487 / 1000 : 0.5);
  if (wcv.width !== Math.round(w * dpr)) { wcv.width = Math.round(w * dpr); wcv.height = Math.round(h * dpr); }
  const c = wctx, k = w / 1000;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, w, h);
  c.save(); c.setTransform(dpr * k, 0, 0, dpr * k, 0, 0);
  c.fillStyle = '#EEF0F2'; c.fill(A.map.wsphere);
  c.strokeStyle = 'rgba(14,19,25,.07)'; c.lineWidth = 0.6 / k * k; c.stroke(A.map.wgrat);
  c.fillStyle = '#C5CDD5'; c.fill(A.map.wland);
  c.strokeStyle = 'rgba(14,19,25,.28)'; c.lineWidth = 0.5; c.stroke(A.map.wland);
  c.strokeStyle = 'rgba(14,19,25,.3)'; c.lineWidth = 0.8; c.stroke(A.map.wsphere);
  c.restore();
  const P = (ll) => { const p = A.map.wproj(ll); return [p[0] * k, p[1] * k]; };
  const m = P(MSK);
  const f = clamp((now - arcAnim.t0) / arcAnim.dur);
  if (target.ll) {
    const ip = d3.geoInterpolate(MSK, target.ll);
    const n = 96;
    c.save(); c.strokeStyle = 'rgba(138,75,0,.9)'; c.lineWidth = 2; c.lineCap = 'round'; c.beginPath();
    let prev = null, head = m;
    for (let i = 0; i <= n * f; i++) {
      const p = P(ip(i / n));
      if (prev && Math.abs(p[0] - prev[0]) > w * 0.5) { c.moveTo(p[0], p[1]); } else if (i === 0) c.moveTo(p[0], p[1]); else c.lineTo(p[0], p[1]);
      prev = p; head = p;
    }
    c.stroke(); c.restore();
    const tp = P(target.ll);
    c.fillStyle = '#8A4B00'; c.beginPath(); c.arc(tp[0], tp[1], 4, 0, TAU); c.fill();
    if (f < 1) {
      const g = c.createRadialGradient(head[0], head[1], 0, head[0], head[1], 16);
      g.addColorStop(0, 'rgba(255,178,63,1)'); g.addColorStop(1, 'rgba(255,178,63,0)');
      c.fillStyle = g; c.fillRect(head[0] - 16, head[1] - 16, 32, 32);
    } else {
      c.strokeStyle = 'rgba(138,75,0,.6)'; c.lineWidth = 1; c.beginPath(); c.arc(tp[0], tp[1], 9 + Math.sin(now / 300) * 2, 0, TAU); c.stroke();
    }
    c.font = '600 11px "Source Code Pro", monospace'; c.fillStyle = '#0E1319';
    c.textAlign = tp[0] > w * 0.8 ? 'right' : 'left';
    c.fillText(targetName().toUpperCase(), tp[0] + (c.textAlign === 'right' ? -10 : 10), tp[1] - 8);
  } else {
    c.save(); c.strokeStyle = 'rgba(138,75,0,.8)'; c.setLineDash([4, 5]); c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(m[0], m[1]); c.lineTo(m[0] + (w - m[0]) * 0.55 * f, m[1] - m[1] * 0.92 * f); c.stroke(); c.restore();
    c.font = '600 11px "Source Code Pro", monospace'; c.fillStyle = '#0E1319'; c.textAlign = 'left';
    c.fillText(A.t('cityx.moon').toUpperCase() + ' · 384 400 ' + A.t('u.km'), Math.min(w - 170, m[0] + (w - m[0]) * 0.55 + 8), Math.max(14, m[1] * 0.08 + 4));
  }
  c.fillStyle = '#0E1319'; c.beginPath(); c.arc(m[0], m[1], 3.5, 0, TAU); c.fill();
  c.font = '600 11px "Source Code Pro", monospace'; c.textAlign = 'left';
  c.fillText(A.t('cityx.msk').toUpperCase(), m[0] + 8, m[1] + 14);
}
function targetName() { return target.id === 'point' ? A.t('sb.point') : A.t('cityx.' + target.id); }
function stat(label, value, sub, key) {
  return '<div' + (key ? ' class="is-key"' : '') + '><dt>' + label + '</dt><dd>' + value + (sub ? ' <small>' + sub + '</small>' : '') + '</dd></div>';
}
function renderStats() {
  const ms = A.t('u.ms');
  if (!target.ll) {
    statsEl.innerHTML = stat(A.t('sb.moon.d'), '384 400 ' + A.t('u.km')) +
      stat(A.t('sb.moon.t'), A.fmt(1.28, 2) + ' ' + A.t('u.s'), A.t('sb.oneway'), true) +
      stat(A.t('sb.rtt'), A.fmt(2.56, 2) + ' ' + A.t('u.s')) +
      '<div><dt>&nbsp;</dt><dd><small>' + A.t('sb.moon.n') + '</small></dd></div>';
    return;
  }
  const km = d3.geoDistance(MSK, target.ll) * 6371;
  const min = (km / 204190) * 1000;
  const a = min * 1.5, b = min * 2;
  statsEl.innerHTML = stat(A.t('sb.dist'), A.fmt(Math.round(km / 10) * 10) + ' ' + A.t('u.km')) +
    stat(A.t('sb.min'), A.fmt(min, min < 10 ? 1 : 0) + ' ' + ms, A.t('sb.oneway'), true) +
    stat(A.t('sb.real'), A.fmt(a, 0) + '–' + A.fmt(b, 0) + ' ' + ms, A.t('sb.oneway')) +
    stat(A.t('sb.rtt'), '≈' + A.fmt(a * 2, 0) + '–' + A.fmt(b * 2, 0) + ' ' + ms);
}
function buildChips() {
  chipsEl.innerHTML = '';
  chipsEl.setAttribute('aria-label', A.t('sb.cities'));
  A.CITIES.forEach((cty) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip' + (target.id === cty.id ? ' is-on' : '');
    b.textContent = A.t('cityx.' + cty.id);
    b.setAttribute('aria-pressed', target.id === cty.id ? 'true' : 'false');
    b.addEventListener('click', () => setTarget({ id: cty.id, ll: cty.ll }));
    chipsEl.appendChild(b);
  });
}
function setTarget(tg) {
  target = tg;
  arcAnim.t0 = performance.now();
  $$('.chip', chipsEl).forEach((b, i) => { const on = A.CITIES[i].id === tg.id; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
  renderStats();
  if (A.audio && A.audio.blip) A.audio.blip(660, 0.06);
}
wcv.addEventListener('click', (e) => {
  if (!A.map.wproj) return;
  const r = wcv.getBoundingClientRect();
  const k = worldScale();
  const ll = A.map.wproj.invert([(e.clientX - r.left) / k, (e.clientY - r.top) / k]);
  if (!ll || !isFinite(ll[0]) || !isFinite(ll[1])) return;
  const back = A.map.wproj(ll);
  if (!back || Math.hypot(back[0] * k - (e.clientX - r.left), back[1] * k - (e.clientY - r.top)) > 2) return;
  setTarget({ id: 'point', ll });
});

/* ================= epilogue ================= */
const counterEl = $('#counterNum');
const t0Page = performance.now();
let lastCounter = 0;
A.on('tick', ({ now }) => {
  if (now - lastCounter > 90) {
    lastCounter = now;
    const n = Math.floor(((now - t0Page) / 1000) * (100e9 / 86400));
    counterEl.textContent = A.fmt(n);
  }
  if (target && now - arcAnim.t0 < arcAnim.dur + 600) drawWorld(now);
  else if (A.frame % 30 === 0) drawWorld(now);
});

function renderSources() {
  const ul = $('#sourceList');
  ul.innerHTML = A.SOURCES.map((s) => '<li><a href="' + s.url + '" target="_blank" rel="noopener">' + A.t(s.k) + '</a></li>').join('');
}

// postcard
const pcv = $('#postCv'), pctx = pcv.getContext('2d');
function wrap(c, text, maxW) {
  const words = text.split(' ');
  const lines = []; let line = '';
  words.forEach((w) => {
    const test = line ? line + ' ' + w : w;
    if (c.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
  });
  if (line) lines.push(line);
  return lines;
}
function drawPostcard() {
  const c = pctx, W = 1080, H = 1350;
  c.setTransform(1, 0, 0, 1, 0, 0);
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0B1118'); g.addColorStop(1, '#05070A');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const rg = c.createRadialGradient(820, 260, 0, 820, 260, 700);
  rg.addColorStop(0, 'rgba(255,178,63,.12)'); rg.addColorStop(1, 'rgba(255,178,63,0)');
  c.fillStyle = rg; c.fillRect(0, 0, W, H);
  c.fillStyle = '#E4E9EE';
  c.font = '200 190px "Source Serif 4", Georgia, serif';
  c.textBaseline = 'alphabetic'; c.textAlign = 'left';
  c.fillText('200', 64, 232);
  const w200 = c.measureText('200').width;
  c.font = 'italic 300 86px "Source Serif 4", Georgia, serif';
  c.fillText(A.t('u.ms'), 64 + w200 + 18, 232);
  c.font = '500 22px "Source Code Pro", monospace';
  c.fillStyle = '#FFB23F';
  if ('letterSpacing' in c) c.letterSpacing = '3px';
  c.fillText(A.t('pc.sub').toUpperCase(), 70, 290);
  c.fillStyle = '#A9B5C1';
  c.fillText(A.t('pc.route').toUpperCase(), 70, 326);
  if ('letterSpacing' in c) c.letterSpacing = '0px';
  // map
  const mx = 60, my = 360, mw = 960, mh = 420;
  c.save();
  c.beginPath(); c.rect(mx, my, mw, mh); c.clip();
  c.fillStyle = '#070B11'; c.fillRect(mx, my, mw, mh);
  const T = fitRoute(mw, mh, 26);
  c.translate(mx, my);
  c.save(); c.transform(T.k, 0, 0, T.k, T.ox, T.oy);
  c.fillStyle = '#111A24'; c.fill(A.map.land);
  c.strokeStyle = 'rgba(127,140,153,.45)'; c.lineWidth = 1 / T.k; c.stroke(A.map.land);
  c.restore();
  const line = (pts, style, lw) => { c.save(); c.strokeStyle = style; c.lineWidth = lw; c.lineJoin = 'round'; c.lineCap = 'round'; c.beginPath(); pts.forEach((q, i) => { const p = T.S(q); i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); }); c.stroke(); c.restore(); };
  line(A.allPts(A.routeBack), 'rgba(98,210,245,.8)', 2);
  line(A.allPts(A.routeOut), 'rgba(255,190,90,.95)', 3);
  ['msk', 'fra', 'bude', 'nyc'].forEach((id) => {
    const p = T.S(A.map.P(A.PLACES[id]));
    c.fillStyle = '#E4E9EE'; c.beginPath(); c.arc(p[0], p[1], 5, 0, TAU); c.fill();
    c.font = '600 17px "Source Code Pro", monospace'; c.fillStyle = '#C9D2DB';
    c.fillText(A.t('city.' + id).toUpperCase(), p[0] + 10, p[1] - 10);
  });
  c.restore();
  c.strokeStyle = 'rgba(127,140,153,.3)'; c.lineWidth = 1; c.strokeRect(mx + 0.5, my + 0.5, mw - 1, mh - 1);
  // message
  c.fillStyle = '#FFD89A';
  c.font = 'italic 400 46px "Source Serif 4", Georgia, serif';
  const q = A.lang === 'ru' ? ['«', '»'] : ['“', '”'];
  const lines = wrap(c, q[0] + A.msg.text + q[1], 950).slice(0, 2);
  lines.forEach((l, i) => c.fillText(l, 64, 862 + i * 58));
  // stats
  const n = A.msg.bytes.length;
  const cells = [
    [A.t('pc.size'), A.nBytes(n) + ' · ' + A.nBits(n * 8)],
    [A.t('pc.dist'), '≈7' + (A.lang === 'ru' ? ' ' : ',') + '500 ' + A.t('u.km')],
    [A.t('pc.oneway'), '≈100 ' + A.t('u.ms')],
    [A.t('pc.ack'), '≈200 ' + A.t('u.ms')],
    [A.t('pc.guess'), A.state.guess != null ? A.fmtDur(A.state.guess) : A.t('pc.none')],
    [A.t('pc.react'), A.state.best ? A.fmt(A.state.best) + ' ' + A.t('u.ms') : A.t('pc.none')]
  ];
  const y0 = lines.length > 1 ? 1010 : 960;
  cells.forEach(([k, v], i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = 64 + col * 320, y = y0 + row * 118;
    c.strokeStyle = 'rgba(127,140,153,.35)'; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 290, y); c.stroke();
    c.font = '500 17px "Source Code Pro", monospace'; c.fillStyle = '#A9B5C1';
    if ('letterSpacing' in c) c.letterSpacing = '2px';
    c.fillText(k.toUpperCase(), x, y + 34);
    if ('letterSpacing' in c) c.letterSpacing = '0px';
    c.font = '500 30px "Source Code Pro", monospace'; c.fillStyle = i === 3 ? '#62D2F5' : '#E4E9EE';
    const vv = wrap(c, v, 300)[0];
    c.fillText(vv, x, y + 76);
  });
  c.font = '400 18px "Source Code Pro", monospace'; c.fillStyle = '#7F8C99';
  const date = new Date().toLocaleDateString(A.lang === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  c.fillText(date, 64, H - 52);
  c.textAlign = 'right'; c.fillText(A.t('pc.foot'), W - 64, H - 52); c.textAlign = 'left';
}
let pcTo = 0;
function schedulePostcard() { clearTimeout(pcTo); pcTo = setTimeout(() => { try { drawPostcard(); } catch (e) { console.error(e); } }, 250); }
const postNote = $('#postNote');
$('#postSave').addEventListener('click', async () => {
  drawPostcard();
  postNote.textContent = '';
  const old = $('.post__img'); if (old) old.remove();
  const blob = await new Promise((r) => pcv.toBlob(r, 'image/png'));
  if (!blob) return;
  const fname = '200ms-postcard.png';
  if (window.claude && typeof window.claude.use === 'function') {
    let dl = null;
    try { dl = await window.claude.use('downloads'); } catch (e) { dl = null; }
    if (dl) {
      try { await dl.save({ filename: fname, data: blob }); postNote.textContent = A.t('pc.saved'); return; }
      catch (err) {
        if (err && err.code === 'declined') { postNote.textContent = A.t('pc.declined'); return; }
      }
    }
    manualSave();
    return;
  }
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fname; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    postNote.textContent = A.t('pc.saved');
  } catch (e) { manualSave(); }
});
function manualSave() {
  const img = document.createElement('img');
  img.className = 'post__img';
  img.alt = A.t('pc.title');
  img.src = pcv.toDataURL('image/png');
  postNote.textContent = A.t('pc.manual');
  postNote.after(img);
}
$('#shareBtn').addEventListener('click', async () => {
  const url = baseUrl();
  const ok = await copy(url);
  A.toast(ok ? A.t('pc.copied') : A.t('ui.linkFail', { url }));
});
$('#hudLink').addEventListener('click', async () => {
  const t = Math.round(A.time * 10) / 10;
  const url = baseUrl() + '#ms' + t;
  const ok = await copy(url);
  A.toast(ok ? A.t('ui.linkCopied', { t: A.fmt(t, t % 1 ? 1 : 0) + ' ' + A.t('u.ms') }) : A.t('ui.linkFail', { url }));
});

/* ================= controls ================= */
const bPlay = $('#bPlay'), bSpeed = $('#bSpeed'), bSound = $('#bSound'), bNerd = $('#bNerd'), bLang = $('#bLang');
function syncControls() {
  bLang.textContent = A.t('ui.langBtn');
  bLang.setAttribute('aria-label', A.t('ui.langAria'));
  $('.ctrl').setAttribute('aria-label', A.t('ui.ctrlAria'));
  $('#hud').setAttribute('aria-label', A.t('ui.hudAria'));
  $('#track').setAttribute('aria-label', A.t('ui.trackAria'));
  $('#hudLink').setAttribute('aria-label', A.t('ui.linkAria'));
  $('#worldCv').setAttribute('aria-label', A.t('sb.aria'));
  $('#replay .seg').setAttribute('aria-label', A.t('rep.speedAria'));
  bPlay.querySelector('span').textContent = A.t(auto.on ? 'ui.pause' : 'ui.play');
  document.title = A.t('ui.title');
}
bLang.addEventListener('click', () => A.setLang(A.lang === 'ru' ? 'en' : 'ru'));
bNerd.addEventListener('click', () => setNerd(!document.body.classList.contains('nerd')));
function setNerd(on) {
  document.body.classList.toggle('nerd', on);
  bNerd.setAttribute('aria-pressed', on ? 'true' : 'false');
  A.store.set('nerd', on ? '1' : '');
  if (on && !setNerd.told) { A.toast(A.t('toast.nerd'), 3600); setNerd.told = 1; }
  A.measure();
}
bSound.addEventListener('click', () => setSound(!(A.audio && A.audio.on)));
function setSound(on) {
  if (!A.audio) return;
  A.audio.toggle(on);
  bSound.setAttribute('aria-pressed', on ? 'true' : 'false');
  if (on && !setSound.told) { A.toast(A.t('toast.sound'), 3000); setSound.told = 1; }
}

// ---------- autoplay ----------
const auto = { on: false, speed: 1, pause: 0, lastY: 0 };
A.stopAuto = () => {
  if (!auto.on) return;
  auto.on = false;
  bPlay.setAttribute('aria-pressed', 'false');
  bPlay.querySelector('span').textContent = A.t('ui.play');
  bSpeed.hidden = true;
};
function startAuto() {
  auto.on = true;
  bPlay.setAttribute('aria-pressed', 'true');
  bPlay.querySelector('span').textContent = A.t('ui.pause');
  bSpeed.hidden = false;
  bSpeed.textContent = auto.speed + '×';
  const y = A.scrollY();
  if (y + A.H / 2 < A.storyTop || y + A.H / 2 > A.storyBot) A.scrollTo(A.yFor(A.scenes[0], 0.35), { immediate: true });
  auto.pause = performance.now() + 400;
}
bPlay.addEventListener('click', () => (auto.on ? A.stopAuto() : startAuto()));
bSpeed.addEventListener('click', () => { auto.speed = auto.speed === 1 ? 2 : 1; bSpeed.textContent = auto.speed + '×'; });
['wheel', 'touchstart'].forEach((ev) => window.addEventListener(ev, () => A.stopAuto(), { passive: true }));
A.on('pre', (dt) => {
  if (!auto.on) return;
  const now = performance.now();
  // Reveal quizzes when they reach the centre and pause for a moment.
  const mid = A.H / 2;
  $$('.quiz:not(.is-done)').forEach((card) => {
    const r = card.getBoundingClientRect();
    if (Math.abs((r.top + r.bottom) / 2 - mid) < A.H * 0.18) { answer(card, -1); auto.pause = now + 2600; }
  });
  if (now < auto.pause) return;
  const sec = A.u.clamp(A.cur && A.cur.id === 'dive' && A.cur.s > 2 ? 3.4 : 4.4, 2, 6) / auto.speed;
  const y = A.scrollY();
  const target = y + (A.H / sec) * dt;
  const end = A.storyBot - A.H * 0.5;
  if (target >= end) { A.stopAuto(); A.scrollTo(document.getElementById('finale').getBoundingClientRect().top + A.scrollY(), { duration: 1.6 }); return; }
  A.scrollTo(target, { immediate: true });
});

// ---------- HUD scrubbing + chapters ----------
const track = $('#track');
function scrubTo(clientX) {
  const r = track.getBoundingClientRect();
  const f = clamp((clientX - r.left) / r.width);
  A.scrollTo(A.storyTop + f * (A.storyBot - A.storyTop) - A.H / 2, { immediate: true });
}
track.addEventListener('pointerdown', (e) => {
  if (e.target.closest('.hud__tick')) return;
  A.stopAuto();
  track.setPointerCapture(e.pointerId);
  scrubTo(e.clientX);
  const move = (ev) => scrubTo(ev.clientX);
  const up = () => { track.removeEventListener('pointermove', move); track.removeEventListener('pointerup', up); track.removeEventListener('pointercancel', up); };
  track.addEventListener('pointermove', move);
  track.addEventListener('pointerup', up);
  track.addEventListener('pointercancel', up);
});
track.addEventListener('keydown', (e) => {
  const span = A.storyBot - A.storyTop;
  let d = 0;
  if (e.key === 'ArrowRight' || e.key === 'ArrowUp') d = span * 0.01;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') d = -span * 0.01;
  if (e.key === 'PageDown') d = span * 0.1;
  if (e.key === 'PageUp') d = -span * 0.1;
  if (d) { e.preventDefault(); e.stopPropagation(); A.stopAuto(); A.scrollTo(A.scrollY() + d, { immediate: true }); }
});
const chaptersEl = $('#chapters');
$('#hudTime').addEventListener('click', (e) => {
  e.stopPropagation();
  chaptersEl.hidden = !chaptersEl.hidden;
  $('#hudTime').setAttribute('aria-expanded', chaptersEl.hidden ? 'false' : 'true');
  if (!chaptersEl.hidden) { const cur = $('#chapterList .is-cur') || $('#chapterList button'); cur && cur.focus(); }
});
document.addEventListener('click', (e) => { if (!chaptersEl.hidden && !e.target.closest('#chapters')) chaptersEl.hidden = true; });

// ---------- help ----------
const helpEl = $('#help');
let helpReturn = null;
function openHelp() {
  const rows = [['← →', 'help.k.arrows'], ['P', 'help.k.p'], ['M', 'help.k.m'], ['E', 'help.k.e'], ['L', 'help.k.l'], ['?', 'help.k.q'], ['Esc', 'help.k.esc']];
  $('#helpList').innerHTML = rows.map(([k, v]) => '<dt>' + k + '</dt><dd>' + A.t(v) + '</dd>').join('');
  helpReturn = document.activeElement;
  helpEl.hidden = false;
  $('#helpClose').focus();
}
function closeHelp() { helpEl.hidden = true; if (helpReturn && helpReturn.focus) helpReturn.focus(); }
$('#helpClose').addEventListener('click', closeHelp);
helpEl.addEventListener('click', (e) => { if (e.target === helpEl) closeHelp(); });

// ---------- keyboard ----------
function stops() {
  const list = [document.getElementById('setup').getBoundingClientRect().top + A.scrollY()];
  A.scenes.forEach((sc) => list.push(A.yFor(sc, 0.5)));
  ['finale', 'sandbox', 'epilogue'].forEach((id) => list.push(document.getElementById(id).getBoundingClientRect().top + A.scrollY()));
  return list;
}
document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const tag = (e.target && e.target.tagName) || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable)) return;
  if (e.target && e.target.id === 'track') return;
  const k = e.key;
  if (k === 'Escape') { if (!helpEl.hidden) closeHelp(); chaptersEl.hidden = true; return; }
  if (!helpEl.hidden) return;
  if (k === 'ArrowRight' || k === 'ArrowLeft' || k === 'j' || k === 'k' || k === 'о' || k === 'л') {
    e.preventDefault();
    A.stopAuto();
    const y = A.scrollY();
    const list = stops();
    const fwd = k === 'ArrowRight' || k === 'j' || k === 'о';
    const next = fwd ? list.find((v) => v > y + 8) : list.slice().reverse().find((v) => v < y - 8);
    if (next !== undefined) A.scrollTo(next, { duration: 1.2 });
    return;
  }
  const low = k.toLowerCase();
  if (low === 'p' || low === 'з') { e.preventDefault(); auto.on ? A.stopAuto() : startAuto(); }
  else if (low === 'm' || low === 'ь') setSound(!(A.audio && A.audio.on));
  else if (low === 'e' || low === 'у') setNerd(!document.body.classList.contains('nerd'));
  else if (low === 'l' || low === 'д') A.setLang(A.lang === 'ru' ? 'en' : 'ru');
  else if (k === '?' || k === ',') { e.preventDefault(); openHelp(); }
});

// ---------- cursor ----------
const cur = $('#cursor');
if (!A.coarse && !A.reduced && window.matchMedia('(hover: hover)').matches) {
  let mx = -100, my = -100, cx = -100, cy = -100;
  window.addEventListener('pointermove', (e) => {
    mx = e.clientX; my = e.clientY;
    cur.classList.add('is-on');
    const hot = e.target.closest && e.target.closest('a, button, input[type="range"], .g, .lay__hd, #worldCv, .opt, .chip');
    cur.classList.toggle('is-big', !!hot);
  }, { passive: true });
  document.addEventListener('pointerleave', () => cur.classList.remove('is-on'));
  A.on('tick', () => {
    cx += (mx - cx) * 0.22; cy += (my - cy) * 0.22;
    cur.style.transform = 'translate(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px)';
  });
}

// ---------- hero ----------
function placeHeroUnit() {
  const svg = $('#heroSvg');
  const base = svg.querySelector('.hero__base'), unit = svg.querySelector('.hero__unit');
  try {
    const w = base.getComputedTextLength();
    if (w > 0) unit.setAttribute('x', Math.round(w + 26));
  } catch (e) { /* not rendered yet */ }
}
const pingEl = $('#ping');
let pings = [];
function pingTick() {
  if (document.hidden) return;
  const v = 112 + Math.round(Math.random() * 16) + Math.random() * 0.9;
  pings.push(v);
  if (pings.length > 3) pings.shift();
  pingEl.innerHTML = A.t('hero.ping') + ': ' + pings.map((p, i) => (i === pings.length - 1 ? '<b>' : '') + A.fmt(p, 1) + ' ' + A.t('u.ms') + (i === pings.length - 1 ? '</b>' : '')).join(' · ');
}

// ---------- deep links ----------
function applyHash() {
  const h = (location.hash || '').slice(1);
  if (!h) return;
  const m = /^ms(\d+(?:\.\d+)?)$/.exec(h);
  if (m) { A.scrollTo(A.yForTime(parseFloat(m[1])), { immediate: true }); return; }
  const sc = A.scenes.find((s) => s.id === h);
  if (sc) A.scrollTo(A.yFor(sc, 0.5), { immediate: true });
}

// ---------- wiring ----------
A.on('boot', () => {
  syncInput();
  const g = parseFloat(A.store.get('guess'));
  if (isFinite(g) && g > 0) { A.state.guess = g; range.value = toVal(g); gNote.textContent = A.t('guess.locked', { v: A.fmtDur(g) }); }
  syncGuess();
  buildChips(); renderStats(); renderSources(); drawVerdict();
  syncControls();
  if (A.store.get('nerd') === '1') setNerd(true);
  pingTick(); setInterval(pingTick, 1300);
  drawReplay(0); rRead.textContent = A.t('rep.idle');
  setTimeout(applyHash, 60);
});
A.on('fonts', () => { placeHeroUnit(); drawPostcard(); drawReplay(0); });
A.on('resize', () => { drawReplay(0); schedulePostcard(); });
A.on('lang', () => {
  syncInput(); syncGuess(); buildChips(); renderStats(); renderSources(); drawVerdict(); syncControls();
  if (A.state.guess != null) gNote.textContent = A.t('guess.locked', { v: A.fmtDur(A.state.guess) });
  rxLabel(padLbl.dataset.i18n || 'rx.start');
  if (A.state.react != null) res.innerHTML = A.t(A.state.react < 200 ? 'rx.faster' : 'rx.slower', { ms: A.fmt(A.state.react) });
  placeHeroUnit(); schedulePostcard(); drawReplay(0); rRead.textContent = A.t('rep.idle');
  pingTick();
});
A.on('guess', () => { drawVerdict(); schedulePostcard(); });
A.on('react', schedulePostcard);
A.on('msg', schedulePostcard);
window.addEventListener('hashchange', applyHash);
})();
