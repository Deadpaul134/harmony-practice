/* Harmona piano sampler: Salamander Grand Piano V3 (Alexander Holm, CC BY 3.0) samples,
   one every minor third (A1 ... C7) in assets/piano/. Pure helpers (note names, nearest
   sample + playbackRate, polyphony pool, envelopes) are exported for Node tests; the loader
   (lazy fetch + decodeAudioData) only runs in the browser and is driven by js/game-audio.js. */
(function (root) {
  'use strict';
  const HP = root.HP = root.HP || {};
  const P = HP.piano = {};

  P.BASE = 'assets/piano/';
  P.SAMPLES = ['A1', 'C2', 'Ds2', 'Fs2', 'A2', 'C3', 'Ds3', 'Fs3', 'A3', 'C4', 'Ds4', 'Fs4',
    'A4', 'C5', 'Ds5', 'Fs5', 'A5', 'C6', 'Ds6', 'Fs6', 'A6', 'C7'];
  /* loaded first: the octaves around C4 (C3..C6) */
  P.CORE = ['C3', 'Ds3', 'Fs3', 'A3', 'C4', 'Ds4', 'Fs4', 'A4', 'C5', 'Ds5', 'Fs5', 'A5', 'C6'];
  /* precached by the service worker at install (keep in sync with sw.js PIANO_CORE) */
  P.PRECACHE = ['Fs3', 'A3', 'C4', 'Ds4', 'Fs4', 'A4', 'C5', 'Ds5'];
  P.MAX_SHIFT = 1.5;      // semitones inside the sampled range
  P.MAX_EDGE_SHIFT = 12;  // outside the range: stretch the edge sample at most an octave
  P.MAX_VOICES = 24;
  P.ATTACK = 0.006;
  P.RELEASE = 0.25;       // note-off fade length (s)
  P.STEAL_TAU = 0.04;     // time constant when a voice is stolen

  const NAT = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  /* 'C4' -> 60, 'Ds2'/'D#2' -> 39, 'Cb5' -> 71, 'Db4' -> 61, 'Bbb3', 'F##4', 'Ex4'. null if bad. */
  P.toMidi = function (name) {
    const m = /^([A-Ga-g])(##|x|#|s|bb|b)?(-?\d+)$/.exec(String(name).trim());
    if (!m) return null;
    const acc = m[2] || '';
    const a = acc === '##' || acc === 'x' ? 2 : acc === '#' || acc === 's' ? 1
      : acc === 'bb' ? -2 : acc === 'b' ? -1 : 0;
    return 12 * (+m[3] + 1) + NAT[m[1].toUpperCase()] + a;
  };

  P.SAMPLE_MIDIS = P.SAMPLES.map(P.toMidi);
  P.url = function (name) { return P.BASE + name + '.mp3'; };
  P.rate = function (diff) { return Math.pow(2, diff / 12); };

  /* nearest sample for a MIDI note: { name, base, diff, rate } or null when the note is too far
     outside A1..C7 (caller falls back to the synth). */
  P.pick = function (midi) {
    if (typeof midi !== 'number' || !isFinite(midi)) return null;
    const ms = P.SAMPLE_MIDIS;
    let best = 0;
    for (let i = 1; i < ms.length; i++) {
      if (Math.abs(ms[i] - midi) < Math.abs(ms[best] - midi)) best = i;
    }
    const diff = midi - ms[best];
    const inside = midi >= ms[0] && midi <= ms[ms.length - 1];
    if (Math.abs(diff) > (inside ? P.MAX_SHIFT : P.MAX_EDGE_SHIFT)) return null;
    return { name: P.SAMPLES[best], base: ms[best], diff: diff, rate: P.rate(diff) };
  };

  /* load order: CORE nearest-to-C4 first, then the rest nearest-to-C4 first */
  P.loadOrder = function () {
    const c4 = 60;
    const byDist = function (a, b) { return Math.abs(P.toMidi(a) - c4) - Math.abs(P.toMidi(b) - c4) || P.toMidi(a) - P.toMidi(b); };
    const core = P.CORE.slice().sort(byDist);
    const rest = P.SAMPLES.filter(function (n) { return core.indexOf(n) < 0; }).sort(byDist);
    return core.concat(rest);
  };

  /* per-voice level: quieter voices in bigger chords so sums stay below clipping */
  P.level = function (nNotes, vel) {
    const n = Math.max(1, nNotes | 0);
    return 0.8 * (vel == null ? 1 : vel) / Math.sqrt(n);
  };

  /* polyphony pool. Voices are { start, end }; add() returns the voices to steal (oldest first)
     so that at most `max` voices overlap the new voice's start. */
  P.createPool = function (max) {
    const cap = Math.max(1, max || P.MAX_VOICES);
    const pool = { voices: [], max: cap };
    pool.add = function (v) {
      const stolen = [];
      for (;;) {
        const live = pool.voices.filter(function (x) { return x.end > v.start && x.start <= v.start; });
        if (live.length < cap) break;
        let old = live[0];
        live.forEach(function (x) { if (x.start < old.start) old = x; });
        pool.remove(old);
        stolen.push(old);
      }
      pool.voices.push(v);
      return stolen;
    };
    pool.remove = function (v) {
      const i = pool.voices.indexOf(v);
      if (i >= 0) pool.voices.splice(i, 1);
    };
    pool.clear = function () { const all = pool.voices; pool.voices = []; return all; };
    return pool;
  };

  /* gain envelope as points [{ t, v, type }] (type: 'set' | 'lin' | 'exp'), as scheduled on an
     AudioParam. envAt() gives the value at time t so a release can start from the real level. */
  P.sampleEnv = function (t0, dur, peak) {
    const hold = t0 + Math.max(P.ATTACK, dur);
    return [
      { t: t0, v: 0, type: 'set' },
      { t: t0 + P.ATTACK, v: peak, type: 'lin' },
      { t: hold, v: peak, type: 'lin' },
      { t: hold + P.RELEASE, v: 0.0001, type: 'exp' }
    ];
  };
  P.envAt = function (pts, t) {
    if (!pts.length || t <= pts[0].t) return pts.length ? pts[0].v : 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      if (t < b.t) {
        const k = (t - a.t) / (b.t - a.t);
        if (b.type === 'exp' && a.v > 0 && b.v > 0) return a.v * Math.pow(b.v / a.v, k);
        if (b.type === 'set') return a.v;
        return a.v + (b.v - a.v) * k;
      }
    }
    return pts[pts.length - 1].v;
  };
  P.applyEnv = function (param, pts) {
    pts.forEach(function (p) {
      if (p.type === 'set') param.setValueAtTime(p.v, p.t);
      else if (p.type === 'exp') param.exponentialRampToValueAtTime(p.v, p.t);
      else param.linearRampToValueAtTime(p.v, p.t);
    });
  };
  /* fade a param out from time T, continuing from its current envelope value (no clicks) */
  P.fadeOut = function (param, pts, T, tau) {
    const v = P.envAt(pts, T);
    if (param.cancelAndHoldAtTime) {
      try { param.cancelAndHoldAtTime(T); } catch (e) { param.cancelScheduledValues(T); param.linearRampToValueAtTime(v, T); }
    } else {
      param.cancelScheduledValues(T);
      param.linearRampToValueAtTime(v, T);
    }
    param.setTargetAtTime(0, T, tau);
    return T + tau * 8; // effectively silent (-70 dB)
  };

  /* ---------- browser loader ---------- */
  const buffers = {};   // name -> AudioBuffer
  const state = {};     // name -> 'loading' | 'ok' | 'fail'
  let queue = null, inflight = 0;
  const CONCURRENCY = 3;

  P.buffer = function (name) { return buffers[name] || null; };
  P.status = function (name) { return state[name] || 'idle'; };

  /* decodeAudioData: promise form, with callback fallback for old Safari */
  P.decode = function (ctx, data) {
    return new Promise(function (resolve, reject) {
      let done = false;
      const ok = function (b) { if (!done) { done = true; b ? resolve(b) : reject(new Error('empty buffer')); } };
      const ko = function (e) { if (!done) { done = true; reject(e || new Error('decode failed')); } };
      try {
        const p = ctx.decodeAudioData(data, ok, ko);
        if (p && typeof p.then === 'function') p.then(ok, ko);
      } catch (e) { ko(e); }
    });
  };

  function pump(ctx) {
    while (queue && queue.length && inflight < CONCURRENCY) {
      const name = queue.shift();
      if (state[name]) continue;
      state[name] = 'loading';
      inflight++;
      root.fetch(P.url(name))
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
        .then(function (ab) { return P.decode(ctx, ab); })
        .then(function (b) { buffers[name] = b; state[name] = 'ok'; })
        .catch(function () { state[name] = 'fail'; }) // keep the synth for this range
        .then(function () { inflight--; pump(ctx); });
    }
  }

  /* start lazy loading once (idempotent) */
  P.load = function (ctx) {
    if (queue || !ctx || typeof root.fetch !== 'function' || !ctx.decodeAudioData) return;
    queue = P.loadOrder();
    pump(ctx);
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = P;
})(typeof window !== 'undefined' ? window : globalThis);
