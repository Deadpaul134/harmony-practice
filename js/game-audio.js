/* Lightweight Web Audio feedback: ding (correct), thud (wrong). Honours mute. */
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
