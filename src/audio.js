/* Generative sound: one bed per environment, cross-faded by scene visibility. No audio files. */
(() => {
'use strict';
const A = window.APP;
const AU = A.audio = { on: false, ctx: null };
let master = null;
const beds = {};
const LVL = { room: 0.55, hiss: 0.07, glass: 0.022, fans: 0.2, hum50: 0.05, hum60: 0.045, deep: 0.85, city: 0.11, pad: 0.07 };
const MIX = {
  before: { pad: 0.55, room: 0.3 }, after: { pad: 0.45 },
  touch: { room: 0.7, pad: 0.35 }, bits: { pad: 0.6 }, env: { pad: 0.6 },
  radio: { hiss: 0.8, room: 0.35 }, fiber: { glass: 1, pad: 0.3 },
  relay: { pad: 0.45, deep: 0.12 }, fra: { fans: 1, hum50: 1 },
  dive: { deep: 1, pad: 0.12 }, atl: { deep: 0.7, glass: 0.5 },
  ny: { city: 1, hum60: 1 }, back: { pad: 0.55, deep: 0.25 }
};

function noise(ctx, sec, type) {
  const len = Math.floor(ctx.sampleRate * sec);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (type === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; } else d[i] = w;
  }
  return buf;
}
function build() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return false;
  const ctx = AU.ctx = new Ctx();
  master = ctx.createGain(); master.gain.value = 0;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -20; comp.ratio.value = 4;
  master.connect(comp); comp.connect(ctx.destination);
  const white = noise(ctx, 2, 'white'), brown = noise(ctx, 4, 'brown');
  const bed = (name) => { const g = ctx.createGain(); g.gain.value = 0; g.connect(master); beds[name] = g; return g; };
  const src = (buf) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; };
  const filt = (type, f, q) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q) b.Q.value = q; return b; };
  const osc = (type, f) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.start(); return o; };
  const lfo = (target, rate, depth, base) => { const o = osc('sine', rate); const g = ctx.createGain(); g.gain.value = depth; o.connect(g); g.connect(target); if (base !== undefined) target.value = base; };

  { const s = src(brown), f = filt('lowpass', 260); s.connect(f); f.connect(bed('room')); }
  { const s = src(white), f = filt('bandpass', 3200, 0.6); s.connect(f); f.connect(bed('hiss')); }
  { const g = bed('glass'); const t = ctx.createGain(); t.gain.value = 0.6; t.connect(g); [2093, 3136, 4186].forEach((f, i) => { const o = osc('sine', f * (1 + i * 0.0007)); o.connect(t); }); lfo(t.gain, 0.35, 0.4, 0.6); }
  { const s = src(white), f1 = filt('lowpass', 900), f2 = filt('highpass', 120); s.connect(f1); f1.connect(f2); f2.connect(bed('fans')); }
  [['hum50', 50], ['hum60', 60]].forEach(([n, base]) => { const g = bed(n); [1, 2, 3].forEach((h) => { const o = osc('sine', base * h); const a = ctx.createGain(); a.gain.value = 1 / (h * h); o.connect(a); a.connect(g); }); });
  { const s = src(brown), f = filt('lowpass', 120); s.connect(f); f.connect(bed('deep')); lfo(f.frequency, 0.07, 40, 120); }
  { const s = src(white), f = filt('lowpass', 650); s.connect(f); f.connect(bed('city')); }
  { const g = bed('pad'); const f = filt('lowpass', 700); f.connect(g); [[110, 'triangle'], [164.81, 'triangle'], [220.4, 'sine']].forEach(([fr, ty]) => { const o = osc(ty, fr); o.connect(f); }); lfo(f.frequency, 0.05, 260, 700); }
  return true;
}

AU.toggle = (on) => {
  if (on && !AU.ctx && !build()) return;
  AU.on = on;
  if (!AU.ctx) return;
  if (on && AU.ctx.state !== 'running') AU.ctx.resume();
  master.gain.setTargetAtTime(on ? 0.9 : 0, AU.ctx.currentTime, 0.35);
};
document.addEventListener('visibilitychange', () => {
  if (!AU.ctx || !AU.on) return;
  master.gain.setTargetAtTime(document.hidden ? 0 : 0.9, AU.ctx.currentTime, 0.2);
});

function env(node, peak, a, d) {
  const t = AU.ctx.currentTime;
  node.gain.cancelScheduledValues(t);
  node.gain.setValueAtTime(0.0001, t);
  node.gain.exponentialRampToValueAtTime(peak, t + a);
  node.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}
function tone(freq, peak, a, d, type = 'sine') {
  if (!AU.on || !AU.ctx) return;
  const o = AU.ctx.createOscillator(), g = AU.ctx.createGain();
  o.type = type; o.frequency.value = freq; o.connect(g); g.connect(master);
  env(g, peak, a, d);
  o.start(); o.stop(AU.ctx.currentTime + a + d + 0.05);
}
AU.blip = (f = 880, d = 0.1) => tone(f, 0.12, 0.005, d);
AU.tick = () => {
  if (!AU.on || !AU.ctx) return;
  const ctx = AU.ctx;
  const len = Math.floor(ctx.sampleRate * 0.03);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const s = ctx.createBufferSource(); s.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2400;
  const g = ctx.createGain(); g.gain.value = 0.35;
  s.connect(f); f.connect(g); g.connect(master); s.start();
};
AU.ding = () => { tone(880, 0.16, 0.005, 1.3); setTimeout(() => tone(1318.5, 0.12, 0.005, 1.5), 90); };
AU.chime = () => { tone(1046.5, 0.12, 0.005, 1.6); setTimeout(() => tone(1568, 0.1, 0.005, 1.8), 70); setTimeout(() => tone(2093, 0.06, 0.005, 2), 140); };
AU.whoosh = (sec = 1) => {
  if (!AU.on || !AU.ctx) return;
  const ctx = AU.ctx;
  const dur = Math.max(0.25, Math.min(sec, 10));
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const s = ctx.createBufferSource(); s.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
  const t = ctx.currentTime;
  f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(3800, t + dur * 0.5); f.frequency.exponentialRampToValueAtTime(500, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + dur * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(); s.stop(t + dur + 0.05);
};

// Mix + story-time events
let lastT = 0;
const MARKS = [];
A.on('boot', () => {
  const add = (list) => list.forEach(([, tm]) => { if (!MARKS.includes(tm)) MARKS.push(tm); });
  add(A.OUT); add(A.BACK);
  MARKS.sort((a, b) => a - b);
});
A.on('tick', ({ t, center }) => {
  if (!AU.on || !AU.ctx) { lastT = t; return; }
  const want = {};
  const addMix = (m, w) => Object.keys(m).forEach((k) => { want[k] = (want[k] || 0) + m[k] * w; });
  let story = 0;
  A.scenes.forEach((sc) => { if (sc.a > 0.001 && MIX[sc.id]) { addMix(MIX[sc.id], sc.a); story = Math.max(story, sc.a); } });
  if (story < 1) addMix(center < A.storyTop + A.H ? MIX.before : MIX.after, 1 - story);
  const now = AU.ctx.currentTime;
  Object.keys(beds).forEach((k) => beds[k].gain.setTargetAtTime(Math.min(1.2, want[k] || 0) * LVL[k], now, 0.3));
  if (t > lastT && t - lastT < 30) {
    MARKS.forEach((m) => { if (lastT < m && t >= m) AU.tick(); });
    if (lastT < 65 && t >= 65) AU.blip(1567, 0.06);
    if (lastT < 100 && t >= 100) AU.ding();
    if (lastT < 200 && t >= 200) AU.chime();
  }
  lastT = t;
});
})();
