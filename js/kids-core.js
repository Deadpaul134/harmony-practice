/* Harmona kids: progress logic for the learning path. Pure, testable.
   Storage stays inside the existing synced `stats` map, so the Firestore doc keeps
   the same top-level keys (no rules change):
     stats['kids-L01'] = { r: stars earned (clamped to 3 when read), t: times completed }
   Both fields only ever grow, so they sync with the existing increment() writes
   and two devices can never lower each other's progress. */
(function (root) {
  'use strict';
  const HP = root.HP = root.HP || {};
  const K = HP.kidsCore = {};
  const CORE = HP.core || (typeof require !== 'undefined' ? require('./game-core.js') : null);

  K.PREFIX = 'kids-';
  K.XP = { answer: 10, lessonFirst: 20, lessonReplay: 5, perNewStar: 10 };
  K.MAX_STARS = 3;

  K.statId = function (id) { return K.PREFIX + id; };
  K.isKidsStat = function (statId) { return String(statId).indexOf(K.PREFIX) === 0; };

  K.entry = function (st, id) {
    const s = st && st.stats && st.stats[K.statId(id)];
    return { r: s ? s.r | 0 : 0, t: s ? s.t | 0 : 0 };
  };
  K.stars = function (st, id) { return Math.max(0, Math.min(K.MAX_STARS, K.entry(st, id).r)); };
  K.done = function (st, id) { return K.entry(st, id).t > 0; };

  K.unlocked = function (st, lessons, idx) {
    if (idx <= 0) return true;
    return K.done(st, lessons[idx - 1].id);
  };

  /* first unlocked lesson not completed yet; null when the whole path is done */
  K.nextIndex = function (st, lessons) {
    for (let i = 0; i < lessons.length; i++) {
      if (!K.done(st, lessons[i].id)) return K.unlocked(st, lessons, i) ? i : null;
    }
    return null;
  };

  K.starsFor = function (firstTryCorrect, total) {
    if (!total) return 1;
    const r = firstTryCorrect / total;
    if (r >= 1) return 3;
    if (r >= 0.6) return 2;
    return 1;
  };

  K.totals = function (st, lessons) {
    let stars = 0, done = 0;
    lessons.forEach(function (l) { stars += K.stars(st, l.id); if (K.done(st, l.id)) done++; });
    return { stars: stars, maxStars: lessons.length * K.MAX_STARS, done: done, count: lessons.length };
  };

  K.worldSummary = function (st, worlds, lessons) {
    return worlds.map(function (w) {
      const ls = lessons.filter(function (l) { return l.world === w.id; });
      const done = ls.filter(function (l) { return K.done(st, l.id); }).length;
      const stars = ls.reduce(function (a, l) { return a + K.stars(st, l.id); }, 0);
      return { world: w, lessons: ls, done: done, stars: stars, maxStars: ls.length * K.MAX_STARS };
    });
  };

  function today(ts) { return CORE.today(ts ? new Date(ts) : undefined); }

  /* One quiz answer. Counts for the daily goal and the streak, like the drills.
     Only a first-try answer is recorded; a retry after "כמעט!" is free. */
  K.recordAnswer = function (st, ok, ts) {
    const ymd = today(ts);
    const day = CORE.ensureDay(st, ymd);
    day.answered += 1;
    let pts = 0;
    if (ok) { day.correct += 1; pts = K.XP.answer; }
    st.points = (st.points | 0) + pts;
    day.points = (day.points | 0) + pts;
    const prev = CORE.effectiveStreak(st.streak, ymd);
    st.streak = CORE.touchStreak(st.streak, ymd);
    const streak = CORE.effectiveStreak(st.streak, ymd);
    return { pts: pts, streak: streak, streakUp: streak > prev };
  };

  /* Fisher-Yates order of option indexes; every question is shuffled each time it is shown */
  K.shuffleOrder = function (n, rnd) {
    rnd = rnd || Math.random;
    const order = Array.from({ length: n }, function (_, i) { return i; });
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const x = order[i]; order[i] = order[j]; order[j] = x;
    }
    return order;
  };

  K.lessonBonus = function (prevStars, newStars, first) {
    return (first ? K.XP.lessonFirst : K.XP.lessonReplay) + K.XP.perNewStar * Math.max(0, newStars - prevStars);
  };

  /* Lesson finished. Returns the stats delta so the caller can queue it for sync. */
  K.finishLesson = function (st, lessons, id, firstTryCorrect, total, quizPoints, ts) {
    if (!st.stats || typeof st.stats !== 'object') st.stats = {};
    const idx = lessons.findIndex(function (l) { return l.id === id; });
    const wasNext = K.nextIndex(st, lessons);
    const prevStars = K.stars(st, id);
    const first = !K.done(st, id);
    const stars = K.starsFor(firstTryCorrect, total);
    const dr = Math.max(0, stars - prevStars);
    const sid = K.statId(id);
    const s = st.stats[sid] || (st.stats[sid] = { r: 0, t: 0 });
    s.r = (s.r | 0) + dr;
    s.t = (s.t | 0) + 1;
    const bonus = K.lessonBonus(prevStars, stars, first);
    const ymd = today(ts);
    st.points = (st.points | 0) + bonus;
    const day = CORE.ensureDay(st, ymd);
    day.points = (day.points | 0) + bonus;
    st.streak = CORE.touchStreak(st.streak, ymd);
    if (!Array.isArray(st.log)) st.log = [];
    st.log.push({ ts: ts || Date.now(), topic: 'kids', n: total, ok: firstTryCorrect, points: bonus + (quizPoints | 0), bonus: bonus, runBest: 0 });
    if (st.log.length > CORE.LOG_CAP) st.log = st.log.slice(-CORE.LOG_CAP);
    const unlockedNext = first && idx === wasNext && idx + 1 < lessons.length ? lessons[idx + 1].id : null;
    return {
      stars: stars, prevStars: prevStars, best: Math.max(stars, prevStars), first: first,
      bonus: bonus, delta: { id: sid, r: dr, t: 1 }, unlockedNext: unlockedNext,
      streak: CORE.effectiveStreak(st.streak, ymd),
    };
  };

  /* One click on a quiz option. `tries` = wrong tries on this question so far.
     Only the first try is recorded (XP, day, streak); a retry is free; a second miss reveals.
     Returns what the caller applies: new tries, points and first-try count to add. */
  K.answerQuiz = function (st, tries, ok, ts) {
    const first = (tries | 0) === 0;
    const out = { done: false, reveal: false, tries: tries | 0, pts: 0, firstOk: 0, recorded: first };
    if (ok) {
      out.done = true;
      if (first) { out.pts = K.recordAnswer(st, true, ts).pts; out.firstOk = 1; }
    } else {
      out.tries++;
      if (first) K.recordAnswer(st, false, ts);
      else { out.done = true; out.reveal = true; }
    }
    return out;
  };

  /* Commit a lesson run once: run = { lesson: { id, quiz }, firstOk, quizPts, saved, result }.
     Returns the finishLesson result the first time, null when the run was already committed. */
  K.commitLesson = function (st, lessons, run, ts) {
    if (!run || run.saved) return null;
    const res = K.finishLesson(st, lessons, run.lesson.id, run.firstOk | 0, run.lesson.quiz.length, run.quizPts | 0, ts);
    run.saved = true;
    run.result = res;
    return res;
  };

  /* ---------- resume a lesson after leaving or reloading (device-only, never synced) ---------- */
  K.RESUME_KEY = 'harmona-kids-resume';
  K.PHASES = ['learn', 'hear', 'try', 'quiz'];

  /* Position to save for a run. On the quiz, a resolved question moves the position to the next
     one, and a question with a recorded first try resumes with tries = 1, so XP already given is
     never given again. run = { lesson, phase, i, firstOk, quizPts, q: { i, tries, done } | null } */
  K.resumeEntry = function (run) {
    if (!run || !run.lesson || K.PHASES.indexOf(run.phase) < 0) return null;
    let i = run.i | 0, tries = 0;
    if (run.phase === 'quiz' && run.q && run.q.i === i) {
      if (run.q.done) i++;
      else if (run.q.tries > 0) tries = 1;
    }
    return { id: run.lesson.id, phase: run.phase, i: i, firstOk: run.firstOk | 0, quizPts: run.quizPts | 0, tries: tries };
  };

  /* Where to continue, or null: the lesson must exist, be unlocked and not completed yet,
     and the position must fit the lesson. */
  K.resumeState = function (st, lessons, entry) {
    if (!entry || typeof entry !== 'object') return null;
    const idx = lessons.findIndex(function (l) { return l.id === entry.id; });
    if (idx < 0 || !K.unlocked(st, lessons, idx) || K.done(st, entry.id)) return null;
    const l = lessons[idx];
    if (K.PHASES.indexOf(entry.phase) < 0) return null;
    const len = entry.phase === 'hear' ? 1 : (l[entry.phase] || []).length;
    const i = entry.i | 0;
    if (i < 0 || i >= len) return null;
    if (entry.phase === 'learn' && i === 0) return null; /* nothing to continue */
    const quizI = entry.phase === 'quiz' ? i : 0;
    const firstOk = Math.max(0, Math.min(quizI, entry.firstOk | 0));
    const quizPts = Math.max(0, Math.min(quizI * K.XP.answer, entry.quizPts | 0));
    return { idx: idx, phase: entry.phase, i: i, firstOk: firstOk, quizPts: quizPts, tries: entry.phase === 'quiz' && entry.tries ? 1 : 0 };
  };

  /* One-time progress restore (preview): "#restore-kids=N" marks lessons 1..N done.
     Monotonic: a lesson already done is left alone; a missing lesson gets t:+1 and at
     least 1 star. No XP is given (the answers' XP was already saved). Returns the stats
     deltas so the caller can queue them for sync exactly like a real completion. */
  K.RESTORE_RE = /^#?restore-kids=(\d{1,3})$/;
  K.parseRestore = function (hash, lessons) {
    const m = K.RESTORE_RE.exec(String(hash || ''));
    if (!m) return null;
    const n = parseInt(m[1], 10);
    if (!(n >= 1)) return null;
    return Math.min(n, lessons.length);
  };
  K.restoreUpTo = function (st, lessons, n) {
    if (!st.stats || typeof st.stats !== 'object') st.stats = {};
    const count = Math.max(0, Math.min(n | 0, lessons.length));
    const deltas = [];
    for (let i = 0; i < count; i++) {
      const id = lessons[i].id;
      if (K.done(st, id)) continue;
      const sid = K.statId(id);
      const s = st.stats[sid] || (st.stats[sid] = { r: 0, t: 0 });
      const dr = (s.r | 0) < 1 ? 1 : 0;
      s.r = (s.r | 0) + dr;
      s.t = (s.t | 0) + 1;
      deltas.push({ id: sid, r: dr, t: 1 });
    }
    return deltas;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = K;
})(typeof window !== 'undefined' ? window : globalThis);
