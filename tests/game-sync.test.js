const C = require('../js/game-core.js');
let fails = 0;
function ok(cond, msg) { if (cond) console.log('ok  ', msg); else { console.log('FAIL', msg); fails++; } }

/* points: take max */
{
  const m = C.mergeGame({ points: 50, stats: {} }, { points: 80 });
  ok(m.points === 80, 'points max cloud');
  const m2 = C.mergeGame({ points: 120, stats: {} }, { points: 80 });
  ok(m2.points === 120, 'points max local');
}

/* streak: newer lastDay wins current; best is max */
{
  const m = C.mergeGame(
    { streak: { current: 2, best: 4, lastDay: '2026-11-07', freezes: 0, freezeWeek: '2026-W45' }, stats: {} },
    { streak: { current: 5, best: 5, lastDay: '2026-11-09', freezes: 1, freezeWeek: '2026-W46' } }
  );
  ok(m.streak.current === 5 && m.streak.lastDay === '2026-11-09', 'streak prefers newer day');
  ok(m.streak.best === 5, 'streak best is max');
  ok(m.streak.freezes === 1, 'freezes max');
}

/* days: per-day max union */
{
  const m = C.mergeGame(
    { days: { '2026-11-08': { answered: 10, correct: 7, points: 70 }, '2026-11-09': { answered: 3, correct: 2, points: 20 } }, stats: {} },
    { days: { '2026-11-09': { answered: 12, correct: 9, points: 100 }, '2026-11-07': { answered: 5, correct: 5, points: 50 } } }
  );
  ok(m.days['2026-11-09'].answered === 12 && m.days['2026-11-09'].correct === 9, 'day max answered/correct');
  ok(m.days['2026-11-08'].answered === 10, 'keeps local-only day');
  ok(m.days['2026-11-07'].answered === 5, 'keeps cloud-only day');
}

/* log: union by identity, capped */
{
  const a = [{ ts: 1, topic: 'intervals', n: 10, ok: 8, points: 100, bonus: 20, runBest: 3 }];
  const b = [
    { ts: 1, topic: 'intervals', n: 10, ok: 8, points: 100, bonus: 20, runBest: 3 },
    { ts: 2, topic: 'modes', n: 10, ok: 7, points: 90, bonus: 20, runBest: 2 },
  ];
  const m = C.mergeGame({ log: a, stats: {} }, { log: b });
  ok(m.log.length === 2, 'log dedupes identical entries');
  ok(m.log[1].topic === 'modes', 'log keeps cloud entry');
}

/* snapshot shape */
{
  const snap = C.gameSnapshot({
    points: 42,
    streak: { current: 1, best: 2, lastDay: '2026-11-09', freezes: 1, freezeWeek: '2026-W46' },
    days: { '2026-11-09': { answered: 4, correct: 3, points: 30 } },
    log: [{ ts: 9, topic: 'intervals', n: 10, ok: 9, points: 110, bonus: 20, runBest: 4 }],
    mute: true, run: 7, session: { n: 3 },
    stats: { 'iv-count': { r: 1, t: 1 } },
  });
  ok(snap.points === 42 && snap.streak.best === 2, 'snapshot points/streak');
  ok(snap.days['2026-11-09'].answered === 4, 'snapshot days');
  ok(snap.log.length === 1 && !('mute' in snap) && !('run' in snap), 'snapshot omits device-only fields');
}

/* never lose legacy stats during migrate+merge */
{
  const m = C.mergeGame(
    { stats: { 'iv-count': { r: 3, t: 5 } }, points: 10 },
    { points: 10, streak: { current: 0, best: 0, lastDay: null, freezes: 1 } }
  );
  ok(m.stats['iv-count'].t === 5, 'stats preserved through mergeGame');
}

if (fails) { console.error(fails + ' failed'); process.exit(1); }
console.log('\ngame-sync checks passed');
