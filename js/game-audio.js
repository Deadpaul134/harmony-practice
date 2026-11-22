/* Lightweight Web Audio: feedback sounds (ding, thud, level-up; honour mute) and a small
   piano-like synth for lesson content (notes, chords, progressions). */
(function (root) {
  'use strict';
  const HP = root.HP = root.HP || {};
  const A = HP.audio = { ctx: null, master: null, mute: false };

  function ensure() {
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    try {
      if (!A.ctx) {
        A.ctx = new AC();
        A.master = A.ctx.createGain();
        A.master.gain.value = 0.7;
        A.master.connect(A.ctx.destination);
      }
      if (A.ctx.state === 'suspended') A.ctx.resume();
    } catch (e) { A.ctx = null; }
    return A.ctx;
  }

  A.setMute = function (m) { A.mute = !!m; };
  A.unlock = function () { ensure(); };

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
  let voices = [];
  let timers = [];
  function freq(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function voice(c, midi, t0, dur, vel) {
    const f = freq(midi);
    const g = c.createGain(), lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(Math.min(6000, f * 7), t0);
    lp.frequency.exponentialRampToValueAtTime(Math.max(400, f * 2), t0 + dur);
    const peak = 0.16 * (vel || 1);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(peak * 0.45, t0 + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.35);
    lp.connect(g); g.connect(A.master);
    const oscs = [['triangle', 1, 1], ['sine', 2, 0.35], ['sine', 1, 0.6]].map(function (o) {
      const x = c.createOscillator(), xg = c.createGain();
      x.type = o[0]; x.frequency.value = f * o[1]; xg.gain.value = o[2];
      x.connect(xg); xg.connect(lp);
      x.start(t0); x.stop(t0 + dur + 0.4);
      return x;
    });
    voices.push({ oscs: oscs, g: g });
    if (voices.length > 48) voices = voices.slice(-48);
  }

  A.stop = function () {
    timers.forEach(clearTimeout); timers = [];
    const c = A.ctx;
    voices.forEach(function (v) {
      try {
        if (c) { v.g.gain.cancelScheduledValues(c.currentTime); v.g.gain.setTargetAtTime(0.0001, c.currentTime, 0.03); }
        v.oscs.forEach(function (o) { try { o.stop(c ? c.currentTime + 0.15 : 0); } catch (e) {} });
      } catch (e) {}
    });
    voices = [];
  };

  function whenReady(fn) {
    const c = ensure(); if (!c) return false;
    if (c.state === 'running') fn(c);
    else c.resume().then(function () { fn(c); }).catch(function () {});
    return true;
  }

  /* one key press */
  A.note = function (midi, dur) {
    whenReady(function (c) { voice(c, midi, c.currentTime + 0.005, dur || 0.9, 1); });
  };

  /* timed events from HP.kidsMusic.events(spec): [{ t, midis, dur }].
     onEvent(i) fires as each group starts (for highlighting); onEnd when done. */
  A.playEvents = function (seq, onEvent, onEnd) {
    A.stop();
    return whenReady(function (c) {
      const t0 = c.currentTime + 0.05;
      seq.events.forEach(function (e, i) {
        e.midis.forEach(function (m) { voice(c, m, t0 + e.t, e.dur, e.midis.length > 2 ? 0.75 : 0.9); });
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
