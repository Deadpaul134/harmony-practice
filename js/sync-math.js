/* Harmona sync math: pure helpers for the stats deltas queued for the cloud and for
   merging state written by another tab. Used by index.html (drills + sign-in module).
   stats = { id: { r, t } }; pending / inflight are the same shape (deltas). */
(function (root) {
  'use strict';
  const HP = root.HP = root.HP || {};
  const S = HP.syncMath = {};
  const CORE = () => HP.core || (typeof require !== 'undefined' ? require('./game-core.js') : null);

  /* a + sign * b, per key (new object, inputs untouched) */
  S.add = function (a, b, sign) {
    if (sign == null) sign = 1;
    const out = JSON.parse(JSON.stringify(a || {}));
    Object.keys(b || {}).forEach(function (id) {
      const s = b[id] || {};
      const o = out[id] || (out[id] = { r: 0, t: 0 });
      o.r = (o.r | 0) + sign * (s.r | 0);
      o.t = (o.t | 0) + sign * (s.t | 0);
    });
    return out;
  };

  /* deltas not on their way to the cloud yet */
  S.unsent = function (pending, inflight) {
    return inflight ? S.add(pending, inflight, -1) : (pending || {});
  };

  /* local view = what the cloud has (incl. writes on their way) + answers not yet sent */
  S.applyCloud = function (cloudStats, pending, inflight, reset) {
    return S.add(reset || !cloudStats ? {} : cloudStats, S.unsent(pending, inflight));
  };

  /* pending after a successful write of `sent`; zero rows dropped */
  S.afterSend = function (pending, sent) {
    const out = S.add(pending, sent, -1);
    Object.keys(out).forEach(function (id) { if (!out[id].r && !out[id].t) delete out[id]; });
    return out;
  };

  /* per-key max of r and t: progress counters never go down */
  S.maxStats = function (a, b) {
    const out = {};
    [a || {}, b || {}].forEach(function (m) {
      Object.keys(m).forEach(function (id) {
        const s = m[id] || {}, o = out[id] || (out[id] = { r: 0, t: 0 });
        o.r = Math.max(o.r, s.r | 0);
        o.t = Math.max(o.t, s.t | 0);
      });
    });
    return out;
  };

  /* a deliberate wipe (reset button or sign-out): no stats, no points, no log */
  S.isWipe = function (raw) {
    return !!raw && (!raw.stats || !Object.keys(raw.stats).length) && !(raw.points | 0) && !(raw.log && raw.log.length);
  };

  /* Another tab wrote `storedRaw` (parsed JSON). Take it as the newer state, but never lower
     progress this tab already holds: stats keep the per-key max of r and t; points, streak,
     days and log merge like a cloud snapshot. A deliberate wipe is adopted as is. */
  S.mergeStored = function (mem, storedRaw) {
    const C = CORE();
    const stored = C.migrateState(storedRaw);
    if (!mem || S.isWipe(storedRaw)) return stored;
    stored.stats = S.maxStats(mem.stats, stored.stats);
    const g = C.mergeGame(stored, { points: mem.points, streak: mem.streak, days: mem.days, log: mem.log });
    stored.points = g.points; stored.streak = g.streak; stored.days = g.days; stored.log = g.log;
    return stored;
  };

  /* true when `merged` holds progress the stored copy lacks (higher r/t or points), so the
     merged state must be written back. Order-insensitive, so two tabs never ping-pong. */
  S.gains = function (stored, merged) {
    const a = (stored && stored.stats) || {}, b = (merged && merged.stats) || {};
    if (((merged && merged.points) | 0) > ((stored && stored.points) | 0)) return true;
    return Object.keys(b).some(function (id) {
      const x = a[id] || {}, y = b[id] || {};
      return (y.r | 0) > (x.r | 0) || (y.t | 0) > (x.t | 0);
    });
  };

  /* Sync meta written by another tab (or re-read before a change). Every tab saves its meta
     right after each change, so the stored copy already holds this tab's deltas plus the other
     tab's, minus what was sent. Adopt it; no max here, or sent deltas would be queued again. */
  S.readMeta = function (storedRaw) {
    const m = Object.assign({ uid: null, pending: {}, reset: false }, storedRaw || {});
    if (!m.pending || typeof m.pending !== 'object') m.pending = {};
    m.reset = !!m.reset;
    return m;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = S;
})(typeof window !== 'undefined' ? window : globalThis);
