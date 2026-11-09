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
    if (st.log.length > 100) st.log = st.log.slice(-100);
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

  if (typeof module !== 'undefined' && module.exports) module.exports = CORE;
})(typeof window !== 'undefined' ? window : globalThis);
