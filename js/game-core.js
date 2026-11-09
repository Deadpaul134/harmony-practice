/* Harmona game core: XP, streak, daily goal, session summary. Pure logic for tests.
   Progress is stored alongside existing harmony-practice-v1 fields; never deletes stats. */
(function (root) {
  'use strict';
  const HP = root.HP = root.HP || {};
  const CORE = HP.core = {};

  CORE.POINTS = { first: 10, runBonus: 2, runMin: 5, setBonus: 20, dailyGoal: 25 };
  CORE.SESSION_LEN = 10;

  /* level L starts at 50·L·(L−1) XP — same curve as Mentora */
  CORE.xpLevel = function (points) {
    const p = Math.max(0, points | 0);
    let L = 1;
    while (50 * (L + 1) * L <= p) L++;
    const from = 50 * L * (L - 1);
    const to = 50 * (L + 1) * L;
    return { level: L, xp: p - from, to: to - from, points: p };
  };

  CORE.answerPoints = function (ok, run) {
    if (!ok) return 0;
    return CORE.POINTS.first + (run >= CORE.POINTS.runMin ? CORE.POINTS.runBonus : 0);
  };

  CORE.today = function (d) {
    const x = d || new Date();
    const y = x.getFullYear();
    const m = String(x.getMonth() + 1).padStart(2, '0');
    const day = String(x.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  };

  CORE.dayDiff = function (a, b) {
    const pa = a.split('-').map(Number), pb = b.split('-').map(Number);
    const da = Date.UTC(pa[0], pa[1] - 1, pa[2]);
    const db = Date.UTC(pb[0], pb[1] - 1, pb[2]);
    return Math.round((db - da) / 86400000);
  };

  CORE.normStreak = function (s) {
    s = s || {};
    return {
      current: s.current | 0,
      best: s.best | 0,
      lastDay: s.lastDay || null,
      freezes: s.freezes == null ? 1 : s.freezes | 0,
      freezeWeek: s.freezeWeek || null,
    };
  };

  CORE.isoWeek = function (ymd) {
    const [y, m, d] = ymd.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    const dayNum = dt.getUTCDay() || 7;
    dt.setUTCDate(dt.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((dt - yearStart) / 86400000) + 1) / 7);
    return dt.getUTCFullYear() + '-W' + String(week).padStart(2, '0');
  };

  CORE.refillFreeze = function (s, today) {
    s = CORE.normStreak(s);
    const wk = CORE.isoWeek(today);
    if (s.freezeWeek !== wk) { s.freezes = 1; s.freezeWeek = wk; }
    return s;
  };

  CORE.touchStreak = function (s, today) {
    s = CORE.refillFreeze(s, today);
    if (s.lastDay === today) return s;
    const gap = s.lastDay ? CORE.dayDiff(s.lastDay, today) : null;
    if (gap === null) s.current = 1;
    else if (gap < 0) return s;
    else if (gap === 1) s.current += 1;
    else if (gap === 2 && s.freezes > 0) { s.freezes -= 1; s.current += 1; s.usedFreeze = true; }
    else s.current = 1;
    s.lastDay = today;
    if (s.current > s.best) s.best = s.current;
    return s;
  };

  CORE.effectiveStreak = function (s, today) {
    s = CORE.normStreak(s);
    if (!s.lastDay) return 0;
    const gap = CORE.dayDiff(s.lastDay, today);
    if (gap <= 1) return s.current;
    if (gap === 2 && CORE.refillFreeze(s, today).freezes > 0) return s.current;
    return 0;
  };

  CORE.migrateState = function (raw) {
    const st = Object.assign({
      topic: 'intervals', type: {}, level: 1, stats: {},
      points: 0, streak: CORE.normStreak(null), days: {}, log: [],
      mute: false, run: 0, session: null,
    }, raw || {});
    if (!st.stats || typeof st.stats !== 'object') st.stats = {};
    st.streak = CORE.normStreak(st.streak);
    if (!st.days || typeof st.days !== 'object') st.days = {};
    if (!Array.isArray(st.log)) st.log = [];
    st.points = st.points | 0;
    st.run = st.run | 0;
    st.mute = !!st.mute;
    /* seed points from legacy stats once if brand-new game fields */
    if (raw && raw.stats && raw.points == null) {
      let t = 0, r = 0;
      Object.values(raw.stats).forEach(function (s) { t += s.t | 0; r += s.r | 0; });
      st.points = r * CORE.POINTS.first;
    }
    return st;
  };

  CORE.ensureDay = function (st, ymd) {
    if (!st.days[ymd]) st.days[ymd] = { answered: 0, correct: 0, points: 0 };
    return st.days[ymd];
  };

  CORE.recordAnswer = function (st, info) {
    /* info: { ok, typeId, topic, ts? } */
    const today = CORE.today(info.ts ? new Date(info.ts) : undefined);
    const day = CORE.ensureDay(st, today);
    day.answered += 1;
    if (info.ok) {
      st.run = (st.run | 0) + 1;
      day.correct += 1;
    } else {
      st.run = 0;
    }
    const pts = CORE.answerPoints(!!info.ok, st.run);
    st.points = (st.points | 0) + pts;
    day.points = (day.points | 0) + pts;

    if (!st.session) {
      st.session = { n: 0, ok: 0, points: 0, topic: info.topic, started: Date.now(), runBest: 0 };
    }
    st.session.n += 1;
    if (info.ok) st.session.ok += 1;
    st.session.points += pts;
    if (st.run > (st.session.runBest | 0)) st.session.runBest = st.run;

    const prev = CORE.effectiveStreak(st.streak, today);
    st.streak = CORE.touchStreak(st.streak, today);
    const streakUp = CORE.effectiveStreak(st.streak, today) > prev;

    return {
      pts: pts,
      run: st.run,
      streakUp: streakUp,
      streak: CORE.effectiveStreak(st.streak, today),
      usedFreeze: !!st.streak.usedFreeze,
      xp: CORE.xpLevel(st.points),
      day: day,
      sessionDone: st.session.n >= CORE.SESSION_LEN,
    };
  };

  CORE.finishSession = function (st) {
    const s = st.session;
    if (!s) return null;
    const bonus = s.n >= CORE.SESSION_LEN ? CORE.POINTS.setBonus : 0;
    st.points = (st.points | 0) + bonus;
    const today = CORE.today();
    CORE.ensureDay(st, today).points = (st.days[today].points | 0) + bonus;
    const entry = {
      ts: Date.now(),
      topic: s.topic,
      n: s.n,
      ok: s.ok,
      points: s.points + bonus,
      bonus: bonus,
      runBest: s.runBest | 0,
    };
    st.log.push(entry);
    if (st.log.length > CORE.LOG_CAP) st.log = st.log.slice(-CORE.LOG_CAP);
    st.session = null;
    return entry;
  };

  CORE.topicAccuracy = function (stats, typeIds) {
    let r = 0, t = 0;
    typeIds.forEach(function (id) {
      const s = stats[id];
      if (s) { r += s.r | 0; t += s.t | 0; }
    });
    return { r: r, t: t, pct: t ? Math.round(100 * r / t) : null };
  };

  CORE.dailyProgress = function (st, today) {
    today = today || CORE.today();
    const d = st.days[today] || { answered: 0, correct: 0, points: 0 };
    const goal = CORE.POINTS.dailyGoal;
    return { answered: d.answered | 0, correct: d.correct | 0, points: d.points | 0, goal: goal, done: (d.answered | 0) >= goal };
  };


  CORE.LOG_CAP = 40;
  CORE.DAYS_CAP = 60; /* keep last ~2 months of day rows */

  CORE.mergeStreak = function (a, b) {
    a = CORE.normStreak(a); b = CORE.normStreak(b);
    const out = CORE.normStreak(null);
    out.best = Math.max(a.best, b.best);
    /* prefer the side that practiced more recently */
    if (!a.lastDay) return Object.assign(out, { current: b.current, lastDay: b.lastDay, freezes: b.freezes, freezeWeek: b.freezeWeek });
    if (!b.lastDay) return Object.assign(out, { current: a.current, lastDay: a.lastDay, freezes: a.freezes, freezeWeek: a.freezeWeek });
    const cmp = CORE.dayDiff(a.lastDay, b.lastDay);
    const newer = cmp > 0 ? b : cmp < 0 ? a : (a.current >= b.current ? a : b);
    const older = newer === a ? b : a;
    out.current = newer.current;
    out.lastDay = newer.lastDay;
    out.freezes = Math.max(a.freezes, b.freezes);
    out.freezeWeek = newer.freezeWeek || older.freezeWeek;
    if (out.current > out.best) out.best = out.current;
    return out;
  };

  CORE.mergeDays = function (a, b) {
    const out = {};
    const keys = new Set([].concat(Object.keys(a || {}), Object.keys(b || {})));
    keys.forEach(function (k) {
      const x = (a && a[k]) || {}, y = (b && b[k]) || {};
      out[k] = {
        answered: Math.max(x.answered | 0, y.answered | 0),
        correct: Math.max(x.correct | 0, y.correct | 0),
        points: Math.max(x.points | 0, y.points | 0),
      };
    });
    /* cap by newest ymd */
    const sorted = Object.keys(out).sort();
    if (sorted.length > CORE.DAYS_CAP) {
      sorted.slice(0, sorted.length - CORE.DAYS_CAP).forEach(function (k) { delete out[k]; });
    }
    return out;
  };

  CORE.mergeLog = function (a, b) {
    const map = new Map();
    function key(e) { return String(e.ts) + '|' + (e.topic || '') + '|' + (e.n | 0) + '|' + (e.ok | 0); }
    [].concat(a || [], b || []).forEach(function (e) {
      if (!e || e.ts == null) return;
      const k = key(e);
      const prev = map.get(k);
      if (!prev || (e.points | 0) > (prev.points | 0)) map.set(k, {
        ts: e.ts, topic: e.topic, n: e.n | 0, ok: e.ok | 0,
        points: e.points | 0, bonus: e.bonus | 0, runBest: e.runBest | 0,
      });
    });
    return Array.from(map.values()).sort(function (x, y) { return x.ts - y.ts; }).slice(-CORE.LOG_CAP);
  };

  /* Merge cloud game snapshot into local state. Never decreases points / best streak. */
  CORE.mergeGame = function (local, cloud) {
    const L = CORE.migrateState(local || {});
    if (!cloud) return L;
    L.points = Math.max(L.points | 0, cloud.points | 0);
    L.streak = CORE.mergeStreak(L.streak, cloud.streak);
    L.days = CORE.mergeDays(L.days, cloud.days);
    L.log = CORE.mergeLog(L.log, cloud.log);
    return L;
  };

  /* Snapshot of syncable game fields (small). */
  CORE.gameSnapshot = function (st) {
    const s = CORE.migrateState(st || {});
    return {
      points: s.points | 0,
      streak: {
        current: s.streak.current | 0,
        best: s.streak.best | 0,
        lastDay: s.streak.lastDay || null,
        freezes: s.streak.freezes | 0,
        freezeWeek: s.streak.freezeWeek || null,
      },
      days: CORE.mergeDays(s.days, {}),
      log: CORE.mergeLog(s.log, []),
    };
  };


  if (typeof module !== 'undefined' && module.exports) module.exports = CORE;
})(typeof window !== 'undefined' ? window : globalThis);
