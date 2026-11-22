/* Lightweight Web Audio: feedback sounds (ding, thud, level-up; honour mute) and the piano for
   lesson content (notes, chords, progressions). Piano notes use the sampled grand piano from
   js/piano-sampler.js once its samples are decoded, and a small synth until then (or if a
   sample fails), so playback is never silent or delayed. One AudioContext for the whole app. */
(function (root) {
  'use strict';
  const HP = root.HP = root.HP || {};
  const A = HP.audio = { ctx: null, master: null, piano: null, mute: false };
  const P = () => HP.piano || null;

  function needsResume(c) { return c && (c.state === 'suspended' || c.state === 'interrupted'); }
  function resume(c) {
    try { const p = c.resume && c.resume(); if (p && p.catch) p.catch(function () {}); return p; } catch (e) { return null; }
  }

  function ensure() {
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    try {
      if (!A.ctx) {
        let c;
        try { c = new AC({ latencyHint: 'interactive' }); } catch (e) { c = new AC(); }
        A.ctx = c;
        A.master = c.createGain();
        A.master.gain.value = 0.7;
        A.master.connect(c.destination);
        // piano bus: soft limiter so big chords never clip; feedback sounds bypass it
        A.piano = c.createGain();
        A.piano.gain.value = 1;
        let out = A.piano;
        if (c.createDynamicsCompressor) {
          const comp = c.createDynamicsCompressor();
          comp.threshold.value = -10; comp.knee.value = 8; comp.ratio.value = 12;
          comp.attack.value = 0.003; comp.release.value = 0.2;
          A.piano.connect(comp); out = comp;
        }
        out.connect(A.master);
      }
      if (needsResume(A.ctx)) resume(A.ctx);
    } catch (e) { A.ctx = null; }
    if (A.ctx && P()) P().load(A.ctx);
    return A.ctx;
  }

  /* ---- iOS / Safari unlock: resume inside a user gesture, play a silent buffer once ---- */
  let silentDone = false;
  function unlockGesture() {
    const c = ensure(); if (!c) return;
    if (needsResume(c)) resume(c);
    if (!silentDone) {
      try {
        const b = c.createBuffer(1, 1, 22050), s = c.createBufferSource();
        s.buffer = b; s.connect(c.destination);
        s.onended = function () { try { s.disconnect(); } catch (e) {} };
        if (s.start) s.start(0); else s.noteOn(0);
        silentDone = true;
      } catch (e) {}
    }
    // still not running (e.g. iOS ignored it): wait for the next gesture
    setTimeout(function () { if (!A.ctx || A.ctx.state !== 'running') arm(); }, 300);
  }
  const GESTURES = ['pointerup', 'click', 'touchend', 'keydown'];
  let armed = false;
  function onGesture() { disarm(); unlockGesture(); }
  function arm() {
    if (armed || typeof root.addEventListener !== 'function') return;
    armed = true;
    GESTURES.forEach(function (ev) { root.addEventListener(ev, onGesture, { capture: true, passive: true }); });
  }
  function disarm() {
    if (!armed) return;
    armed = false;
    GESTURES.forEach(function (ev) { root.removeEventListener(ev, onGesture, { capture: true, passive: true }); });
  }
  function wake() {
    if (A.ctx && needsResume(A.ctx)) { resume(A.ctx); arm(); }
  }
  if (typeof root.document !== 'undefined' && typeof root.addEventListener === 'function') {
    arm();
    root.document.addEventListener('visibilitychange', function () { if (root.document.visibilityState === 'visible') wake(); });
    root.addEventListener('pageshow', wake);
  }

  A.setMute = function (m) { A.mute = !!m; };
  A.unlock = function () { unlockGesture(); };

  A.ding = function () {
    if (A.mute) return;
    const c = ensure(); if (!c || c.state !== 'running') return;
    const t = c.currentTime + 0.01;
    [[1568, 0.12], [2093, 0.08]].forEach(function (h, i) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.value = h[0];
      g.gain.setValueAtTime(0.0001, t + i * 0.07);
      g.gain.exponentialRampToValueAtTime(h[1], t + i * 0.07 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.07 + 0.5);
      o.connect(g); g.connect(A.master); o.start(t + i * 0.07); o.stop(t + i * 0.07 + 0.55);
    });
  };

  A.wrong = function () {
    if (A.mute) return;
    const c = ensure(); if (!c || c.state !== 'running') return;
    const t = c.currentTime + 0.01;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(110, t + 0.18);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g); g.connect(A.master); o.start(t); o.stop(t + 0.25);
  };

  /* ---- musical notes (lessons). Content sound: plays even when effects are muted. ---- */
  let pool = null;
  let timers = [];
  function getPool() {
    if (!pool) pool = P() ? P().createPool(P().MAX_VOICES) : { add: function () { return []; }, remove: function () {}, clear: function () { return []; } };
    return pool;
  }
  function freq(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  /* every voice: { start, end, g, pts, kill(T, tau) }; ended voices disconnect themselves */
  function finish(v, nodes) {
    getPool().remove(v);
    nodes.forEach(function (n) { try { n.disconnect(); } catch (e) {} });
  }

  function sampleVoice(c, pick, buf, t0, dur, peak) {
    const Pz = P();
    const src = c.createBufferSource(), g = c.createGain();
    src.buffer = buf;
    src.playbackRate.value = pick.rate;
    const pts = Pz.sampleEnv(t0, dur, peak);
    g.gain.value = 0; // silent before t0 even if the schedule is cancelled
    Pz.applyEnv(g.gain, pts);
    src.connect(g); g.connect(A.piano);
    const v = { start: t0, end: pts[pts.length - 1].t, g: g, pts: pts };
    v.kill = function (T, tau) {
      const stopAt = Pz.fadeOut(g.gain, v.pts, T, tau);
      v.end = Math.min(v.end, stopAt);
      try { src.stop(stopAt); } catch (e) {}
    };
    src.onended = function () { finish(v, [src, g]); };
    src.start(t0);
    try { src.stop(v.end + 0.02); } catch (e) {}
    return v;
  }

  function synthVoice(c, midi, t0, dur, vel) {
    const f = freq(midi);
    const g = c.createGain(), lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(Math.min(6000, f * 7), t0);
    lp.frequency.exponentialRampToValueAtTime(Math.max(400, f * 2), t0 + dur);
    const peak = 0.16 * (vel || 1);
    const pts = [
      { t: t0, v: 0.0001, type: 'set' },
      { t: t0 + 0.012, v: peak, type: 'exp' },
      { t: t0 + 0.25, v: peak * 0.45, type: 'exp' },
      { t: t0 + dur + 0.35, v: 0.0001, type: 'exp' }
    ];
    g.gain.value = 0.0001;
    if (P()) P().applyEnv(g.gain, pts);
    else pts.forEach(function (p) { if (p.type === 'set') g.gain.setValueAtTime(p.v, p.t); else g.gain.exponentialRampToValueAtTime(p.v, p.t); });
    lp.connect(g); g.connect(A.piano);
    const nodes = [lp, g];
    let left = 3;
    const v = { start: t0, end: t0 + dur + 0.4, g: g, pts: pts, oscs: [] };
    v.oscs = [['triangle', 1, 1], ['sine', 2, 0.35], ['sine', 1, 0.6]].map(function (o) {
      const x = c.createOscillator(), xg = c.createGain();
      x.type = o[0]; x.frequency.value = f * o[1]; xg.gain.value = o[2];
      x.connect(xg); xg.connect(lp);
      nodes.push(x, xg);
      x.onended = function () { if (--left === 0) finish(v, nodes); };
      x.start(t0); x.stop(t0 + dur + 0.4);
      return x;
    });
    v.kill = function (T, tau) {
      let stopAt = T + tau * 8;
      if (P()) stopAt = P().fadeOut(g.gain, pts, T, tau);
      else { g.gain.cancelScheduledValues(T); g.gain.setTargetAtTime(0.0001, T, tau); }
      v.end = Math.min(v.end, stopAt);
      v.oscs.forEach(function (o) { try { o.stop(stopAt); } catch (e) {} });
    };
    return v;
  }

  /* one piano voice: sample if decoded, else synth; respects the polyphony cap */
  function voice(c, midi, t0, dur, vel, nNotes) {
    const Pz = P();
    const pick = Pz ? Pz.pick(midi) : null;
    const buf = pick ? Pz.buffer(pick.name) : null;
    let v;
    try {
      v = buf ? sampleVoice(c, pick, buf, t0, dur, Pz.level(nNotes, vel))
        : synthVoice(c, midi, t0, dur, vel);
    } catch (e) {
      try { v = synthVoice(c, midi, t0, dur, vel); } catch (e2) { return; }
    }
    getPool().add(v).forEach(function (old) {
      try { old.kill(Math.max(c.currentTime, t0), Pz ? Pz.STEAL_TAU : 0.04); } catch (e) {}
    });
  }

  /* release everything that is sounding or scheduled (no clicks: gains fade from where they are) */
  A.stop = function () {
    timers.forEach(clearTimeout); timers = [];
    const c = A.ctx;
    const all = getPool().clear();
    if (!c) return;
    const now = c.currentTime;
    const tau = (P() ? P().RELEASE : 0.25) / 4;
    all.forEach(function (v) {
      try { v.kill(now, tau); } catch (e) {}
    });
  };

  function whenReady(fn) {
    const c = ensure(); if (!c) return false;
    if (c.state === 'running') { fn(c); return true; }
    const p = resume(c);
    if (p && typeof p.then === 'function') p.then(function () { fn(c); }).catch(function () {});
    else fn(c);
    return true;
  }

  /* one key press */
  A.note = function (midi, dur) {
    whenReady(function (c) { voice(c, midi, c.currentTime + 0.005, dur || 0.9, 1, 1); });
  };

  /* timed events from HP.kidsMusic.events(spec): [{ t, midis, dur }].
     onEvent(i) fires as each group starts (for highlighting); onEnd when done. */
  A.playEvents = function (seq, onEvent, onEnd) {
    A.stop();
    return whenReady(function (c) {
      const t0 = c.currentTime + 0.05;
      seq.events.forEach(function (e, i) {
        const n = e.midis.length;
        e.midis.forEach(function (m) { voice(c, m, t0 + e.t, e.dur, n > 2 ? 0.75 : 0.9, n); });
        if (onEvent) timers.push(setTimeout(function () { onEvent(i, e); }, Math.max(0, e.t * 1000 + 50)));
      });
      if (onEnd) timers.push(setTimeout(onEnd, seq.total * 1000 + 150));
    });
  };

  A.levelUp = function () {
    if (A.mute) return;
    const c = ensure(); if (!c || c.state !== 'running') return;
    const t = c.currentTime + 0.01;
    [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.value = f;
      const t0 = t + i * 0.09;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.14, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
      o.connect(g); g.connect(A.master); o.start(t0); o.stop(t0 + 0.4);
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
