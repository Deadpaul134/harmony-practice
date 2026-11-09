const C = require('../js/game-core.js');
let fails = 0;
function ok(cond, msg) { if (cond) console.log('ok  ', msg); else { console.log('FAIL', msg); fails++; } }

ok(C.xpLevel(0).level === 1 && C.xpLevel(0).to === 100, 'xp level 1 at 0');
ok(C.xpLevel(100).level === 2 && C.xpLevel(100).xp === 0, 'xp level 2 at 100');
ok(C.xpLevel(300).level === 3, 'xp level 3 at 300');
ok(C.answerPoints(false, 9) === 0, 'wrong = 0 pts');
ok(C.answerPoints(true, 1) === 10, 'first correct 10');
ok(C.answerPoints(true, 5) === 12, 'run bonus at 5');

const migrated = C.migrateState({ topic: 'modes', stats: { 'iv-count': { r: 3, t: 4 } } });
ok(migrated.stats['iv-count'].r === 3, 'keeps legacy stats');
ok(migrated.points === 30, 'seeds points from legacy rights');
ok(migrated.topic === 'modes', 'keeps topic');

const st = C.migrateState({});
const a1 = C.recordAnswer(st, { ok: true, typeId: 'iv-count', topic: 'intervals' });
ok(a1.pts === 10 && st.run === 1 && st.points === 10, 'record correct');
ok(a1.streak === 1 && a1.streakUp, 'streak starts');
C.recordAnswer(st, { ok: false, typeId: 'iv-count', topic: 'intervals' });
ok(st.run === 0, 'run resets on wrong');

// fill a session
st.session = null;
for (let i = 0; i < 10; i++) C.recordAnswer(st, { ok: true, typeId: 'iv-count', topic: 'intervals' });
ok(st.session.n === 10, 'session length 10');
const entry = C.finishSession(st);
ok(entry && entry.bonus === 20 && entry.n === 10, 'session bonus');
ok(st.session === null && st.log.length === 1, 'session cleared and logged');

const acc = C.topicAccuracy({ a: { r: 2, t: 4 }, b: { r: 1, t: 1 } }, ['a', 'b']);
ok(acc.pct === 60 && acc.t === 5, 'topic accuracy');

const day = C.dailyProgress(st);
ok(day.goal === 25 && day.answered >= 10, 'daily progress');

if (fails) { console.error(fails + ' failed'); process.exit(1); }
console.log('\n' + 'game-core checks passed');
