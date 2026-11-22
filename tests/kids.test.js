// Kids learning path: music correctness of the lesson data + progress/sync logic.
// Run: node tests/kids.test.js
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const CORE = require('../js/game-core.js');
const M = require('../js/kids-music.js');
const { WORLDS, LESSONS } = require('../js/kids-lessons.js');
const K = require('../js/kids-core.js');

let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('ok   ' + name); };
const pcs = (names) => [...new Set(M.notes(names).map((n) => n.pc))].sort((a, b) => a - b).join(',');
const strip = (s) => String(s).replace(/[{}]/g, '').trim();
const byId = (id) => LESSONS.find((l) => l.id === id);

/* ---------- theory helpers ---------- */
check('note parsing and midi', () => {
  assert.strictEqual(M.midi('C4'), 60);
  assert.strictEqual(M.midi('A4'), 69);
  assert.strictEqual(M.midi('Cb4'), 59);
  assert.strictEqual(M.midi('B#3'), 60);
  assert.strictEqual(M.pcOf('Db4'), M.pcOf('C#4'));
});

check('interval semitone table (book p.8)', () => {
  assert.strictEqual(M.semis('C4', 'Eb4'), 3);  // minor third
  assert.strictEqual(M.semis('C4', 'E4'), 4);   // major third
  assert.strictEqual(M.semis('C4', 'F4'), 5);   // perfect fourth
  assert.strictEqual(M.semis('F4', 'B4'), 6);   // tritone
  assert.strictEqual(M.semis('C4', 'G4'), 7);   // perfect fifth
  assert.strictEqual(M.semis('C4', 'C5'), 12);  // octave
  assert.strictEqual(M.semis('E4', 'F4'), 1);
  assert.strictEqual(M.semis('B4', 'C5'), 1);
  assert.strictEqual(M.semis('C4', 'D4'), 2);
});

check('chord spelling in stacked thirds, book symbols', () => {
  const sp = (s) => M.chordNotes(s, 4).map(M.bare).join(' ');
  assert.strictEqual(sp('C'), 'C E G');
  assert.strictEqual(sp('C-'), 'C Eb G');
  assert.strictEqual(sp('C°'), 'C Eb Gb');
  assert.strictEqual(sp('C+'), 'C E G#');
  assert.strictEqual(sp('Cmaj7'), 'C E G B');
  assert.strictEqual(sp('C7'), 'C E G Bb');
  assert.strictEqual(sp('C-7'), 'C Eb G Bb');
  assert.strictEqual(sp('C-7b5'), 'C Eb Gb Bb');
  assert.strictEqual(sp('C°7'), 'C Eb Gb Bbb');
  assert.strictEqual(sp('Cmaj9'), 'C E G B D');
  assert.strictEqual(sp('A7'), 'A C# E G');
  assert.strictEqual(sp('E7'), 'E G# B D');
  assert.strictEqual(sp('Bbmaj7'), 'Bb D F A');
  assert.strictEqual(sp('B°'), 'B D F');
  assert.strictEqual(sp('B-7b5'), 'B D F A');
});

check('major scales follow T T H T T T H', () => {
  assert.strictEqual(M.majorScale('C4').map(M.bare).join(' '), 'C D E F G A B C');
  assert.strictEqual(M.majorScale('G3').map(M.bare).join(' '), 'G A B C D E F# G');
  assert.strictEqual(M.majorScale('F4').map(M.bare).join(' '), 'F G A Bb C D E F');
  for (const k of ['C4', 'G3', 'F4', 'Bb3', 'D4']) {
    const s = M.majorScale(k);
    const steps = s.slice(1).map((n, i) => M.semis(s[i], n));
    assert.deepStrictEqual(steps, [2, 2, 1, 2, 2, 2, 1], k);
  }
});

check('diatonic seventh chords and roman numerals of C major', () => {
  const d = M.diatonicSevenths('C');
  assert.deepStrictEqual(d.map((x) => x.sym), ['Cmaj7', 'D-7', 'E-7', 'Fmaj7', 'G7', 'A-7', 'B-7b5']);
  assert.deepStrictEqual(d.map((x) => x.roman), ['Imaj7', 'II-7', 'III-7', 'IVmaj7', 'V7', 'VI-7', 'VII-7b5']);
  assert.deepStrictEqual(M.diatonicSevenths('F').map((x) => x.sym), ['Fmaj7', 'G-7', 'A-7', 'Bbmaj7', 'C7', 'D-7', 'E-7b5']);
});

check('functions: T=I,III,VI  SD=II,IV  D=V,VII', () => {
  assert.deepStrictEqual(M.FUNCTIONS, { T: ['I', 'III', 'VI'], SD: ['II', 'IV'], D: ['V', 'VII'] });
  const want = { I: 'T', II: 'SD', III: 'T', IV: 'SD', V: 'D', VI: 'T', VII: 'D' };
  M.diatonicSevenths('C').forEach((c) => assert.strictEqual(M.functionOf(c.roman), want[M.ROMAN[c.degree - 1]], c.roman));
});

check('II-V-I, secondary dominants, blues', () => {
  assert.deepStrictEqual(M.iiVI('C'), ['D-7', 'G7', 'Cmaj7']);
  assert.deepStrictEqual(M.iiVI('F'), ['G-7', 'C7', 'Fmaj7']);
  assert.deepStrictEqual(M.iiVI('Bb'), ['C-7', 'F7', 'Bbmaj7']);
  assert.strictEqual(M.secondaryDominant('D-7'), 'A7');
  assert.strictEqual(M.secondaryDominant('G7'), 'D7');
  assert.strictEqual(M.secondaryDominant('A-7'), 'E7');
  assert.strictEqual(M.secondaryDominant('E-7'), 'B7');
  assert.deepStrictEqual(M.blues('C'), 'C7 C7 C7 C7 F7 F7 C7 C7 G7 F7 C7 G7'.split(' '));
});

/* ---------- lesson structure ---------- */
check('5 worlds, 18 lessons in curriculum order', () => {
  assert.strictEqual(WORLDS.length, 5);
  assert.strictEqual(LESSONS.length, 18);
  const perWorld = WORLDS.map((w) => LESSONS.filter((l) => l.world === w.id).length);
  assert.deepStrictEqual(perWorld, [5, 3, 5, 3, 2]);
  LESSONS.forEach((l, i) => {
    assert.strictEqual(l.n, i + 1);
    assert.strictEqual(l.id, 'L' + String(i + 1).padStart(2, '0'));
    if (i) assert.ok(l.world >= LESSONS[i - 1].world, 'worlds in order');
  });
  const ids = new Set(LESSONS.map((l) => l.id));
  assert.strictEqual(ids.size, 18);
});

check('every lesson has the 4 steps; quiz has 3-5 questions', () => {
  for (const l of LESSONS) {
    assert.ok(l.learn.length >= 2, l.id + ' learn');
    assert.ok(l.hear.length >= 1, l.id + ' hear');
    assert.ok(l.try.length >= 1, l.id + ' try');
    assert.ok(l.quiz.length >= 3 && l.quiz.length <= 5, l.id + ' quiz size');
  }
});

check('short, simple text (one idea per screen)', () => {
  const all = [];
  for (const l of LESSONS) {
    l.learn.forEach((s) => all.push([l.id, s.t, 130]));
    l.try.forEach((t) => all.push([l.id, t.p, 110]));
    l.quiz.forEach((q) => { all.push([l.id, q.q, 80]); q.opts.forEach((o) => all.push([l.id, o, 40])); });
    l.hear.forEach((h) => all.push([l.id, h.label, 60]));
  }
  for (const [id, s, max] of all) {
    assert.ok(s.replace(/[{}*]/g, '').length <= max, `${id} too long: ${s}`);
    assert.strictEqual((s.match(/\{/g) || []).length, (s.match(/\}/g) || []).length, `${id} braces: ${s}`);
    assert.strictEqual((s.match(/\*/g) || []).length % 2, 0, `${id} bold: ${s}`);
    const sentences = s.split(/[.!?](?:\s|$)/).filter((x) => x.trim()).length;
    assert.ok(sentences <= 3, `${id} too many sentences: ${s}`);
  }
});

check('quiz answers valid, options unique', () => {
  for (const l of LESSONS) for (const q of l.quiz) {
    assert.ok(Number.isInteger(q.a) && q.a >= 0 && q.a < q.opts.length, l.id + ' ' + q.q);
    assert.ok(q.opts.length >= 2 && q.opts.length <= 4, l.id + ' opts count');
    assert.strictEqual(new Set(q.opts).size, q.opts.length, l.id + ' duplicate opts');
  }
});

check('quiz is mostly ear + recognition (at least one ear question per lesson)', () => {
  let ear = 0, total = 0;
  for (const l of LESSONS) {
    const n = l.quiz.filter((q) => q.play).length;
    assert.ok(n >= 1, l.id + ' needs an ear question');
    ear += n; total += l.quiz.length;
  }
  assert.ok(ear / total >= 0.35, 'share of ear questions ' + ear + '/' + total);
});

check('option shuffling: permutation, and moves the answer around', () => {
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const firstPos = new Set();
  for (let k = 0; k < 60; k++) {
    const o = K.shuffleOrder(3, rnd);
    assert.deepStrictEqual(o.slice().sort(), [0, 1, 2]);
    firstPos.add(o.indexOf(0));
  }
  assert.strictEqual(firstPos.size, 3, 'answer appears in every position');
  const two = new Set();
  for (let k = 0; k < 40; k++) two.add(K.shuffleOrder(2, rnd).join(''));
  assert.strictEqual(two.size, 2, 'two-option questions are shuffled too');
  const ui = fs.readFileSync(path.join(__dirname, '..', 'js', 'kids-ui.js'), 'utf8');
  assert.ok(/K\.shuffleOrder\(q\.opts\.length/.test(ui), 'quiz UI uses shuffleOrder for every question');
});

/* ---------- every sound spec and chord used is musically valid ---------- */
function allSpecs() {
  const out = [];
  for (const l of LESSONS) {
    l.hear.forEach((h) => out.push([l.id, h.play]));
    l.quiz.forEach((q) => q.play && out.push([l.id, q.play]));
  }
  return out;
}
check('all sound specs resolve to events', () => {
  for (const [id, spec] of allSpecs()) {
    const ev = M.events(spec);
    assert.ok(ev.events.length > 0 && ev.total > 0, id);
    ev.events.forEach((e) => e.midis.forEach((m) => assert.ok(m >= 40 && m <= 90, id + ' range ' + m)));
  }
});

check('every chord symbol in lessons is a book symbol and spells as thirds', () => {
  const syms = new Set();
  for (const [, spec] of allSpecs()) M.specChords(spec).forEach((s) => syms.add(s));
  for (const l of LESSONS) {
    l.learn.forEach((s) => { if (s.fig && s.fig.tower) syms.add(s.fig.tower); if (s.fig && s.fig.chips) s.fig.chips.forEach((c) => syms.add(c)); });
    l.try.forEach((t) => { if (t.chord) syms.add(t.chord); if (t.prog) t.prog.split(' ').forEach((c) => syms.add(c)); });
  }
  for (const s of syms) {
    const notes = M.chordNotes(s, 3);
    const letters = notes.map((n) => M.note(n).l);
    letters.slice(1).forEach((x, i) => assert.strictEqual((x - letters[i] + 7) % 7, 2, s + ' stacked in thirds'));
    assert.strictEqual(M.qualityOf(notes), M.parseChord(s).q, s + ' quality');
  }
  assert.ok(syms.size >= 25, 'chords checked: ' + syms.size);
});

check('try-it targets fit their keyboard and match the named chord', () => {
  for (const l of LESSONS) for (const t of l.try) {
    const [a, b] = (t.range || 'C4 C5').split(' ');
    const lo = M.midi(a), hi = M.midi(b);
    M.notes(t.target).forEach((n) => assert.ok(n.midi >= lo && n.midi <= hi, `${l.id} ${n.name} outside ${t.range || 'C4 C5'}`));
    if (t.mark) M.notes(t.mark).forEach((n) => assert.ok(n.midi >= lo && n.midi <= hi, l.id + ' mark'));
    assert.ok(['one', 'set', 'seq'].includes(t.mode), l.id + ' mode');
    if (t.mode === 'one') assert.strictEqual(M.notes(t.target).length, 1, l.id);
    if (t.chord) assert.strictEqual(pcs(t.target), pcs(M.chordNotes(t.chord, 4)), `${l.id} target is ${t.chord}`);
    if (t.scale) assert.strictEqual(t.target, M.majorScale(t.target.split(' ')[0]).join(' '), l.id + ' scale');
    if (t.prog) assert.ok(t.prog.split(' ').includes(t.chord), l.id + ' prog ends on built chord');
  }
});

check('try-it interval/step tasks are correct', () => {
  const one = (id, i) => { const t = byId(id).try[i]; return M.semis(t.mark, t.target); };
  assert.strictEqual(one('L02', 0), 1);  // half step above E = F
  assert.strictEqual(one('L02', 1), 2);  // whole step above F = G
  assert.strictEqual(one('L02', 2), 1);  // half step above C = C#
  assert.strictEqual(one('L04', 0), 4);  // major third above C
  assert.strictEqual(one('L04', 1), 7);  // fifth above C
  assert.strictEqual(one('L04', 2), 3);  // minor third above A
  assert.strictEqual(M.bare(byId('L07').try[1].target), M.bare(M.majorScale('C4')[5]));   // 6th degree = relative minor
  assert.strictEqual(M.semis('G4', byId('L13').try[1].target) % 12, 2); // 9th of G = A
  assert.strictEqual(M.semis('C4', 'D5'), 14);                                   // 9 = 2 + octave
  assert.strictEqual(byId('L06').try[1].target, M.majorScale('G3').join(' '));
  assert.strictEqual(pcs(byId('L07').try[0].target), pcs(M.majorScale('C4').slice(0, 7))); // A minor = C major keys
  // modes start on the right white key, same keys as C major
  assert.strictEqual(byId('L08').try[0].target.split(' ')[0], 'D4');
  assert.strictEqual(pcs(byId('L08').try[0].target), pcs(M.majorScale('C4').slice(0, 7)));
  const tri = byId('L15').try[0].target;
  assert.strictEqual(Math.abs(M.semis(...tri.split(' '))), 6);
});

check('quiz checks (intervals, chords, functions, keys)', () => {
  const FAM_HE = { '': 'מז׳ורי', '-': 'מינורי', '°': 'מוקטן', '+': 'מוגדל' };
  const MODE_START = { ionian: 'C', dorian: 'D', phrygian: 'E', lydian: 'F', mixolydian: 'G', aeolian: 'A', locrian: 'B' };
  let n = 0;
  for (const l of LESSONS) for (const q of l.quiz) {
    const c = q.check; if (!c) continue;
    const ans = strip(q.opts[q.a]);
    if (c.iv != null) {
      const ns = (c.notes || (q.play && q.play.n)).split(' ');
      assert.strictEqual(M.semis(ns[0], ns[1]), c.iv, l.id + ' ' + q.q);
    }
    if (c.same) assert.strictEqual(M.pcOf(c.same[0]), M.pcOf(c.same[1]), l.id);
    if (c.scale) assert.ok(M.majorScale(c.scale + 4).map(M.bare).includes(c.has) && ans === c.has, l.id);
    if (c.relMinor) { assert.strictEqual(M.bare(M.majorScale(c.relMinor[0] + 4)[5]), c.relMinor[1]); assert.strictEqual(ans, c.relMinor[1]); }
    if (c.modeStart) assert.strictEqual(ans, MODE_START[c.modeStart[0]]);
    if (c.chordTones) assert.ok(M.chordNotes(c.chordTones[0], 4).map(M.bare).join(' ') === c.chordTones[1] && c.chordTones[1].endsWith(ans), l.id);
    if (c.fam != null && !c.sym) {
      assert.strictEqual(M.parseChord(q.play.chord).q, c.fam, l.id);
      assert.strictEqual(ans, FAM_HE[c.fam], l.id + ' family name');
    }
    if (c.fam != null && c.sym) assert.strictEqual(M.parseChord(c.sym).q, c.fam, l.id);
    if (c.chord) { assert.strictEqual(q.play.chord, c.chord); assert.ok(ans === c.chord || ans.startsWith(c.chord + ':') || l.id === 'L14', l.id + ' ' + ans); }
    if (c.size) assert.strictEqual(String(M.chordNotes(c.size[0]).length), ans);
    if (c.diatonic) {
      const d = M.diatonicSevenths(c.diatonic[0])[c.diatonic[1] - 1];
      assert.strictEqual(d.sym, c.diatonic[2]);
      assert.ok(ans === d.sym || ans === d.roman, l.id + ' ' + ans);
    }
    if (c.fn) assert.strictEqual(M.functionOf(c.fn[0]), c.fn[1], l.id);
    if (c.tritoneIn) {
      const [a, b] = c.tritoneIn[1].split(' ');
      const tones = M.chordNotes(c.tritoneIn[0]).map(M.bare);
      assert.ok(tones.includes(a) && tones.includes(b) && ans === c.tritoneIn[1]);
      assert.strictEqual(((M.pcOf(b + 4) - M.pcOf(a + 4)) + 12) % 12, 6);
    }
    if (c.iiVI) assert.strictEqual(M.iiVI(c.iiVI[0])[c.iiVI[1]], ans);
    if (c.iiVIopts) {
      q.opts.forEach((o, i) => assert.strictEqual(strip(o).split(' → ').join(' '), M.iiVI(c.iiVIopts[i]).join(' ')));
    }
    if (c.secdom) { assert.strictEqual(M.secondaryDominant(c.secdom[0]), c.secdom[1]); assert.strictEqual(ans, c.secdom[1]); }
    if (c.bluesBars) assert.strictEqual(M.blues('C').length, +ans);
    if (c.bluesBar) assert.strictEqual(M.blues(c.bluesBar[0])[c.bluesBar[1]], c.bluesBar[2]);
    if (c.ninth) assert.strictEqual(M.bare(M.chordNotes(c.ninth[0] + 'maj9')[4]), c.ninth[1]);
    n++;
  }
  assert.ok(n >= 35, 'checked quiz questions: ' + n);
});

check('lesson 14 / 15 / 16 / 17 / 18 content matches theory', () => {
  const chips14 = byId('L14').learn[1].fig.chips;
  assert.deepStrictEqual(chips14, M.diatonicSevenths('C').map((x) => x.sym));
  assert.deepStrictEqual(byId('L16').hear.map((h) => h.play.prog), ['C', 'F', 'Bb'].map((k) => M.iiVI(k).join(' ')));
  assert.deepStrictEqual(byId('L16').learn[1].fig.fn, ['SD', 'D', 'T']);
  byId('L17').hear.slice(0, 3).forEach((h) => {
    const [dom, target] = h.play.prog.split(' ');
    assert.strictEqual(M.secondaryDominant(target), dom);
  });
  assert.strictEqual(byId('L18').hear[0].play.prog, M.blues('C').join(' '));
  assert.ok(byId('L12').learn[3].fig.chips.join(' ') === 'Cmaj7 C7 C-7 C-7b5 C°7');
});

/* ---------- progress logic ---------- */
const fresh = () => CORE.migrateState({});
const TS = new Date(2026, 10, 22, 12).getTime();

check('unlocking: only lesson 1 open at start, then one by one', () => {
  const s = fresh();
  assert.strictEqual(K.unlocked(s, LESSONS, 0), true);
  assert.strictEqual(K.unlocked(s, LESSONS, 1), false);
  assert.strictEqual(K.nextIndex(s, LESSONS), 0);
  const r = K.finishLesson(s, LESSONS, 'L01', 4, 4, 40, TS);
  assert.strictEqual(r.unlockedNext, 'L02');
  assert.strictEqual(K.unlocked(s, LESSONS, 1), true);
  assert.strictEqual(K.unlocked(s, LESSONS, 2), false);
  assert.strictEqual(K.nextIndex(s, LESSONS), 1);
});

check('stars 1-3 from first-try answers', () => {
  assert.strictEqual(K.starsFor(4, 4), 3);
  assert.strictEqual(K.starsFor(5, 5), 3);
  assert.strictEqual(K.starsFor(3, 4), 2);
  assert.strictEqual(K.starsFor(3, 5), 2);
  assert.strictEqual(K.starsFor(2, 4), 1);
  assert.strictEqual(K.starsFor(0, 4), 1);
});

check('replay keeps best stars and gives smaller XP', () => {
  const s = fresh();
  const a = K.finishLesson(s, LESSONS, 'L01', 2, 4, 20, TS);
  assert.strictEqual(a.stars, 1);
  assert.strictEqual(a.bonus, K.XP.lessonFirst + K.XP.perNewStar);
  assert.deepStrictEqual(a.delta, { id: 'kids-L01', r: 1, t: 1 });
  const b = K.finishLesson(s, LESSONS, 'L01', 4, 4, 40, TS);
  assert.strictEqual(b.stars, 3);
  assert.strictEqual(b.bonus, K.XP.lessonReplay + 2 * K.XP.perNewStar);
  assert.strictEqual(b.unlockedNext, null);
  const c = K.finishLesson(s, LESSONS, 'L01', 1, 4, 10, TS);
  assert.strictEqual(c.best, 3);
  assert.strictEqual(c.delta.r, 0);
  assert.strictEqual(K.stars(s, 'L01'), 3);
  assert.strictEqual(s.stats['kids-L01'].t, 3);
  assert.strictEqual(c.bonus, K.XP.lessonReplay);
});

check('quiz answers give XP, count for the day and the streak', () => {
  const s = fresh();
  const r1 = K.recordAnswer(s, true, TS);
  const r2 = K.recordAnswer(s, false, TS);
  assert.strictEqual(r1.pts, 10);
  assert.strictEqual(r2.pts, 0);
  assert.strictEqual(s.points, 10);
  const d = s.days[CORE.today(new Date(TS))];
  assert.deepStrictEqual([d.answered, d.correct, d.points], [2, 1, 10]);
  assert.strictEqual(r1.streak, 1);
  assert.strictEqual(r1.streakUp, true);
  assert.strictEqual(r2.streakUp, false);
  assert.strictEqual(s.session, null, 'drill session untouched');
});

check('lesson log entry fits the existing log format', () => {
  const s = fresh();
  K.finishLesson(s, LESSONS, 'L01', 3, 4, 30, TS);
  const e = s.log[s.log.length - 1];
  assert.deepStrictEqual(Object.keys(e).sort(), ['bonus', 'n', 'ok', 'points', 'runBest', 'topic', 'ts']);
  assert.strictEqual(e.topic, 'kids');
  const merged = CORE.mergeLog(s.log, []);
  assert.strictEqual(merged.length, 1);
});

check('totals and world summary', () => {
  const s = fresh();
  K.finishLesson(s, LESSONS, 'L01', 4, 4, 0, TS);
  K.finishLesson(s, LESSONS, 'L02', 3, 4, 0, TS);
  const t = K.totals(s, LESSONS);
  assert.deepStrictEqual([t.stars, t.done, t.maxStars, t.count], [5, 2, 54, 18]);
  const w = K.worldSummary(s, WORLDS, LESSONS);
  assert.strictEqual(w[0].done, 2);
  assert.strictEqual(w[1].done, 0);
});

/* ---------- backward-compatible sync ---------- */
check('old docs without kids fields still load; lesson 1 open', () => {
  const old = CORE.migrateState({ topic: 'modes', stats: { 'iv-count': { r: 3, t: 5 } }, level: 2 });
  assert.strictEqual(K.nextIndex(old, LESSONS), 0);
  assert.strictEqual(K.stars(old, 'L01'), 0);
  assert.deepStrictEqual(old.stats['iv-count'], { r: 3, t: 5 });
});

check('kids progress lives in stats; Firestore top-level keys unchanged', () => {
  const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
  const allowed = rules.match(/hasOnly\(\[([\s\S]*?)\]\)/)[1].match(/'([^']+)'/g).map((x) => x.slice(1, -1));
  const s = fresh();
  K.finishLesson(s, LESSONS, 'L01', 4, 4, 40, TS);
  const doc = Object.assign({ stats: s.stats, topic: s.topic, type: s.type, level: s.level, updated: 0 }, CORE.gameSnapshot(s));
  Object.keys(doc).forEach((k) => assert.ok(allowed.includes(k), 'key allowed by rules: ' + k));
  assert.ok(Object.keys(s).every((k) => k !== 'kids'), 'no new top-level state key');
});

check('two devices: increments merge, stars clamp at 3, never decrease', () => {
  // both devices raise L01 from 0 to 3 stars offline; cloud sums both increments
  const a = fresh(), b = fresh();
  const da = K.finishLesson(a, LESSONS, 'L01', 4, 4, 0, TS).delta;
  const db = K.finishLesson(b, LESSONS, 'L01', 4, 4, 0, TS).delta;
  const cloud = { 'kids-L01': { r: da.r + db.r, t: da.t + db.t } };
  const merged = CORE.migrateState({ stats: cloud, points: 0 });
  assert.strictEqual(K.stars(merged, 'L01'), 3);
  assert.strictEqual(K.done(merged, 'L01'), true);
  const g = CORE.mergeGame(merged, { points: 5 });
  assert.deepStrictEqual(g.stats['kids-L01'], cloud['kids-L01']);
});

check('drill totals ignore kids stats', () => {
  assert.strictEqual(K.isKidsStat('kids-L01'), true);
  assert.strictEqual(K.isKidsStat('iv-count'), false);
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.ok(html.includes("sync.onAdd"), 'sign-in module queues kids deltas');
  assert.ok(/isKidsStat|kids-/.test(html), 'drill stats filter kids entries');
});

check('service worker precaches the new files', () => {
  const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
  for (const f of ['js/kids-music.js', 'js/kids-lessons.js', 'js/kids-core.js', 'js/kids-ui.js', 'css/kids.css']) {
    assert.ok(sw.includes('"' + f + '"'), f);
    assert.ok(fs.existsSync(path.join(__dirname, '..', f)), f + ' exists');
  }
  assert.ok(!/VERSION = "ha-v4"/.test(sw), 'cache version bumped');
});

console.log(`\n${passed} kids checks passed`);
