// SATE BAKAR — synthesized sound: WebAudio bleeps only, no audio files.
// Sizzle, chop, ding, serve fanfare and the fail buzz, all from oscillators.
export function makeAudio() {
  return { ctx: null, enabled: true, sizzleNodes: null };
}

function ensureCtx(a) {
  if (!a.ctx) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      a.ctx = new AC();
    } catch (e) {
      a.ctx = null;
    }
  }
  if (a.ctx && a.ctx.state === 'suspended') a.ctx.resume();
  return a.ctx;
}

export function audioUnlock(a) {
  ensureCtx(a);
}

function blip(a, freq, dur, type, vol, slideTo) {
  if (!a.enabled) return;
  const ctx = ensureCtx(a);
  if (!ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type || 'sine';
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  gain.gain.setValueAtTime(vol || 0.12, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export function audioChop(a) { blip(a, 220, 0.08, 'square', 0.08, 90); }
export function audioPlace(a) { blip(a, 520, 0.1, 'triangle', 0.1, 660); }
export function audioDing(a) { blip(a, 880, 0.25, 'sine', 0.14, 1320); }
export function audioFail(a) { blip(a, 160, 0.35, 'sawtooth', 0.12, 70); }
export function audioServe(a) {
  blip(a, 523, 0.12, 'triangle', 0.12);
  setTimeout(() => blip(a, 659, 0.12, 'triangle', 0.12), 110);
  setTimeout(() => blip(a, 784, 0.22, 'triangle', 0.14), 220);
}
export function audioStoke(a) {
  if (!a.enabled) return;
  const ctx = ensureCtx(a);
  if (!ctx) return;
  const t = ctx.currentTime;
  const len = Math.floor(ctx.sampleRate * 0.4);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len) * 0.25;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.value = 900;
  src.connect(filt);
  filt.connect(ctx.destination);
  src.start(t);
}
