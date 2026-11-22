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

/* ---------- worlds 6-8 theory (book pp. 33-36, 45-57, 65-70, 101-102) ---------- */
const bare = (arr) => arr.map(M.bare).join(' ');
check('new chord qualities: semitones and spelling', () => {
  const sp = (s) => M.chordNotes(s, 3).map(M.bare).join(' ');
  const st = (s) => { const n = M.chordNotes(s, 3); return n.map((x) => M.semis(n[0], x)).join(','); };
  assert.strictEqual(sp('C-maj7'), 'C Eb G B');      assert.strictEqual(st('C-maj7'), '0,3,7,11');
  assert.strictEqual(sp('Ebmaj7#5'), 'Eb G B D');    assert.strictEqual(st('Ebmaj7#5'), '0,4,8,11');
  assert.strictEqual(sp('C-6'), 'C Eb G A');         assert.strictEqual(st('C-6'), '0,3,7,9');
  assert.strictEqual(sp('G7b9'), 'G B D F Ab');      assert.strictEqual(st('G7b9'), '0,4,7,10,13');
  assert.strictEqual(sp('B7alt'), 'B D# A C G');     assert.strictEqual(st('B7alt'), '0,4,10,13,20');
  assert.strictEqual(sp('Db7'), 'Db F Ab Cb');       assert.strictEqual(st('Db7'), '0,4,7,10');
  assert.strictEqual(sp('B°7'), 'B D F Ab');         assert.strictEqual(st('B°7'), '0,3,6,9');
  assert.strictEqual(sp('Ab-7'), 'Ab Cb Eb Gb');
  assert.strictEqual(sp('E7b9'), 'E G# B D F');
});

check('three minor scales (book pp. 50, 54): steps and spelling', () => {
  assert.strictEqual(bare(M.minorScale('C4', 'natural')), 'C D Eb F G Ab Bb C');
  assert.strictEqual(bare(M.minorScale('C4', 'harmonic')), 'C D Eb F G Ab B C');
  assert.strictEqual(bare(M.minorScale('C4', 'melodic')), 'C D Eb F G A B C');
  assert.strictEqual(bare(M.minorScale('A3', 'natural')), 'A B C D E F G A');
  assert.strictEqual(bare(M.minorScale('A3', 'harmonic')), 'A B C D E F G# A');
  assert.strictEqual(bare(M.minorScale('A3', 'melodic')), 'A B C D E F# G# A');
  for (const t of ['natural', 'harmonic', 'melodic']) for (const k of ['C4', 'A3', 'D4', 'G3']) {
    const s = M.minorScale(k, t);
    assert.deepStrictEqual(s.slice(1).map((n, i) => M.semis(s[i], n)), M.STEPS[t], t + ' ' + k);
    assert.strictEqual(new Set(s.slice(0, 7).map((n) => M.note(n).l)).size, 7, 'one letter per degree');
  }
  // natural minor = relative major's notes
  assert.strictEqual(pcs(M.minorScale('A3', 'natural').slice(0, 7)), pcs(M.majorScale('C4').slice(0, 7)));
});

check('minor degrees vs major: b3 b6 b7 (natural), 7 back in harmonic, 6 and 7 in melodic', () => {
  assert.deepStrictEqual(M.degreeNames('C', 'natural'), ['1', '2', 'b3', '4', '5', 'b6', 'b7']);
  assert.deepStrictEqual(M.degreeNames('C', 'harmonic'), ['1', '2', 'b3', '4', '5', 'b6', '7']);
  assert.deepStrictEqual(M.degreeNames('C', 'melodic'), ['1', '2', 'b3', '4', '5', '6', '7']);
  assert.deepStrictEqual(M.degreeNames('A', 'natural'), ['1', '2', 'b3', '4', '5', 'b6', 'b7']);
  assert.strictEqual(M.semis('C4', 'Eb4'), 3);
  assert.strictEqual(M.semis('C4', 'Ab4'), 8);
  assert.strictEqual(M.semis('C4', 'Bb4'), 10);
});

check('seventh chords in minor match the book tables (pp. 50, 51, 54)', () => {
  const t = (type) => M.diatonicSevenths('C', type);
  assert.deepStrictEqual(t('natural').map((x) => x.sym), ['C-7', 'D-7b5', 'Ebmaj7', 'F-7', 'G-7', 'Abmaj7', 'Bb7']);
  assert.deepStrictEqual(t('natural').map((x) => x.roman), ['I-7', 'II-7b5', 'bIIImaj7', 'IV-7', 'V-7', 'bVImaj7', 'bVII7']);
  assert.deepStrictEqual(t('harmonic').map((x) => x.roman), ['I-maj7', 'II-7b5', 'bIIImaj7#5', 'IV-7', 'V7', 'bVImaj7', 'VII°7']);
  assert.deepStrictEqual(t('harmonic').map((x) => x.sym), ['C-maj7', 'D-7b5', 'Ebmaj7#5', 'F-7', 'G7', 'Abmaj7', 'B°7']);
  assert.deepStrictEqual(t('melodic').map((x) => x.roman), ['I-maj7', 'II-7', 'bIIImaj7#5', 'IV7', 'V7', 'VI-7b5', 'VII-7b5']);
  assert.deepStrictEqual(M.diatonicSevenths('A', 'natural').map((x) => x.sym), ['A-7', 'B-7b5', 'Cmaj7', 'D-7', 'E-7', 'Fmaj7', 'G7']);
  // the jazz minor team of lesson 24 = natural minor + V7 and VII°7 from harmonic minor
  const mk = M.minorKeyChords('C');
  assert.strictEqual(mk.V.sym, 'G7');
  assert.strictEqual(mk.VII.sym, 'B°7');
  // major key unchanged
  assert.deepStrictEqual(M.diatonicSevenths('C').map((x) => x.roman), ['Imaj7', 'II-7', 'III-7', 'IVmaj7', 'V7', 'VI-7', 'VII-7b5']);
});

check('minor II-V-I: II-7b5 -> V7b9 -> I-maj7 (book pp. 51, 54-55, 58)', () => {
  assert.deepStrictEqual(M.minorIIVI('C'), ['D-7b5', 'G7b9', 'C-maj7']);
  assert.deepStrictEqual(M.minorIIVI('A'), ['B-7b5', 'E7b9', 'A-maj7']);
  assert.deepStrictEqual(M.minorIIVI('D'), ['E-7b5', 'A7b9', 'D-maj7']);
  assert.deepStrictEqual(M.minorIIVI('C', 'six'), ['D-7b5', 'G7b9', 'C-6']);
  // the b9 of V7 is the b6 of the minor key; it is a semitone above the root of V
  assert.strictEqual(M.bare(M.chordNotes('G7b9')[4]), M.bare(M.minorScale('C4', 'harmonic')[5]));
  assert.strictEqual(M.semis('G3', M.chordNotes('G7b9', 3)[4]) - 12, 1);
});

check('colour modes are rotations of melodic / harmonic minor (book pp. 53, 57, 68)', () => {
  const rot = (s, k) => s.slice(k - 1, 7).concat(s.slice(0, k - 1));
  const cmm = M.minorScale('C4', 'melodic').slice(0, 7).map(M.bare);
  const chm = M.minorScale('C4', 'harmonic').slice(0, 7).map(M.bare);
  assert.deepStrictEqual(M.scale('F4', 'lydianDominant').slice(0, 7).map(M.bare), rot(cmm, 4));
  assert.deepStrictEqual(M.scale('B3', 'altered').slice(0, 7).map(M.bare), rot(cmm, 7));
  assert.deepStrictEqual(M.scale('G3', 'phrygianDominant').slice(0, 7).map(M.bare), rot(chm, 5));
  assert.strictEqual(bare(M.scale('Db4', 'lydianDominant')), 'Db Eb F G Ab Bb Cb Db'); // book p.69: Db Lyd b7
  // every colour mode holds a dominant 7 chord on its root
  for (const [r, t] of [['F4', 'lydianDominant'], ['G3', 'phrygianDominant'], ['Db4', 'lydianDominant']]) {
    const s = M.scale(r, t);
    assert.strictEqual(M.qualityOf([s[0], s[2], s[4], s[6]]), '7', t);
  }
  const alt = M.scale('B3', 'altered');
  const d = M.chordNotes('B7alt', 3).map((n) => M.pcOf(n));
  d.forEach((pc) => assert.ok(alt.some((n) => M.pcOf(n) === pc), 'B7alt notes come from B altered'));
});

check('secondary dominants + related II (book pp. 32, 45-47, 70)', () => {
  const sd = M.secondaryDominants('C');
  assert.deepStrictEqual(sd.map((x) => x.dom), ['A7', 'B7', 'C7', 'D7', 'E7']);
  assert.deepStrictEqual(sd.map((x) => x.target), ['D-7', 'E-7', 'Fmaj7', 'G7', 'A-7']);
  assert.deepStrictEqual(sd.map((x) => x.label), ['V7/II', 'V7/III', 'V7/IV', 'V7/V', 'V7/VI']);
  // no V7/VII: F#7 root is not in C major
  assert.ok(!M.majorScale('C4').map(M.bare).includes(M.parseChord(M.secondaryDominant('B-7b5')).root));
  sd.forEach((x) => assert.ok(M.majorScale('C4').map(M.bare).includes(M.parseChord(x.dom).root), x.dom + ' root diatonic'));
  assert.strictEqual(M.relatedII('D7', 'G7'), 'A-7');
  assert.strictEqual(M.relatedII('C7', 'Fmaj7'), 'G-7');
  assert.strictEqual(M.relatedII('E7', 'A-7'), 'B-7b5');
  assert.strictEqual(M.relatedII('G7', 'Cmaj7'), 'D-7');
  assert.strictEqual(M.relatedII('Db7'), 'Ab-7');      // book p.70
  sd.forEach((x) => {
    const ii = M.parseChord(M.relatedII(x.dom, x.target)).root;
    assert.strictEqual(((M.pcOf(ii) - M.pcOf(M.parseChord(x.dom).root)) + 12) % 12, 7, 'related II a fifth above ' + x.dom);
  });
});

check('tritone substitution SubV7 (book pp. 68-70)', () => {
  assert.strictEqual(M.tritoneSub('G7'), 'Db7');
  assert.strictEqual(M.tritoneSub('D7'), 'Ab7');
  assert.strictEqual(M.tritoneSub('C7'), 'Gb7');
  assert.strictEqual(M.tritoneSub('A7'), 'Eb7');
  assert.strictEqual(M.subV7('Cmaj7'), 'Db7');   // p.69 examples
  assert.strictEqual(M.subV7('Dmaj7'), 'Eb7');
  assert.strictEqual(M.subV7('Fmaj7'), 'Gb7');
  for (const g of ['G7', 'D7', 'C7', 'A7', 'E7', 'B7']) {
    const s = M.tritoneSub(g);
    assert.strictEqual(((M.pcOf(M.parseChord(s).root) - M.pcOf(M.parseChord(g).root)) + 12) % 12, 6, g);
    assert.strictEqual(pcs(M.tritoneOf(g)), pcs(M.tritoneOf(s)), g + ' shares the tritone');
  }
  assert.deepStrictEqual(M.tritoneOf('G7'), ['B', 'F']);
  assert.deepStrictEqual(M.tritoneOf('Db7'), ['F', 'Cb']);   // Cb = B
  assert.strictEqual(M.pcOf('Cb'), M.pcOf('B'));
  // SubV7 root resolves down a half step to the tonic
  assert.strictEqual(M.semis('Db4', 'C4'), -1);
});

check('guide tones and smooth voice leading', () => {
  assert.deepStrictEqual(M.guideTones('D-7').map(M.bare), ['F', 'C']);
  assert.deepStrictEqual(M.guideTones('G7').map(M.bare), ['B', 'F']);
  assert.deepStrictEqual(M.guideTones('Cmaj7').map(M.bare), ['E', 'B']);
  assert.deepStrictEqual(M.guideTones('D-7b5').map(M.bare), ['F', 'C']);
  const line = M.guideToneLine('D-7 G7 Cmaj7', 4);
  assert.deepStrictEqual(line, [['F4', 'C5'], ['F4', 'B4'], ['E4', 'B4']]);   // F->F, C->B, B->B, F->E
  assert.strictEqual(M.motion(line[0], line[1]), 1);
  assert.strictEqual(M.motion(line[1], line[2]), 1);
  const line2 = M.guideToneLine('A-7 D7 G7', 4);
  line2.slice(1).forEach((v, i) => assert.ok(M.motion(line2[i], v) <= 2, 'guide tones move by step'));
});

check('avoid notes and tensions on the diatonic chords of C (book pp. 33-36, 67, 72)', () => {
  const want = { Cmaj7: 'F', 'D-7': 'B', 'E-7': 'C F', Fmaj7: 'B', G7: 'C', 'A-7': 'F', 'B-7b5': 'C' };
  for (const [c, a] of Object.entries(want)) assert.strictEqual(M.avoidNotes(c).join(' '), a, c);
  const tens = (c) => M.tensions(c).map((x) => x.num).sort().join(' ');
  assert.strictEqual(tens('Cmaj7'), '13 9');
  assert.strictEqual(tens('D-7'), '11 9');
  assert.strictEqual(tens('G7'), '13 9');
  assert.strictEqual(tens('A-7'), '11 9');
  assert.ok(M.halfStepAboveChordTone('F', 'Cmaj7'));
  assert.ok(M.halfStepAboveChordTone('C', 'G7'));
  assert.ok(!M.halfStepAboveChordTone('D', 'Cmaj7'));
  assert.ok(!M.halfStepAboveChordTone('A', 'Cmaj7'));
});

check('melody harmonisation and approach notes', () => {
  const holders = (n) => M.chordsWithNote(n).map((d) => d.sym).join(' ');
  assert.strictEqual(holders('E'), 'Cmaj7 E-7 Fmaj7 A-7');
  assert.strictEqual(holders('B'), 'Cmaj7 E-7 G7 B-7b5');
  assert.strictEqual(holders('A'), 'D-7 Fmaj7 A-7 B-7b5');
  M.majorScale('C4').slice(0, 7).forEach((n) => assert.strictEqual(M.chordsWithNote(n).length, 4, n + ' is in 4 chords'));
  assert.strictEqual(M.approachBelow('E4'), 'D#4');
  assert.strictEqual(M.approachBelow('C5'), 'B4');
  assert.strictEqual(M.approachBelow('G4'), 'F#4');
  for (const n of ['E4', 'C5', 'G4', 'B4']) assert.strictEqual(M.semis(M.approachBelow(n), n), 1);
});

check('functions incl. SubV7; substitutes share a function', () => {
  assert.deepStrictEqual(M.FUNCTION_CHORDS, { T: ['Imaj7', 'III-7', 'VI-7'], SD: ['II-7', 'IVmaj7'], D: ['V7', 'VII-7b5', 'subV7'] });
  assert.strictEqual(M.functionOf('subV7'), 'D');
  assert.strictEqual(M.romanChord('C', 'subV7'), 'Db7');
  assert.deepStrictEqual(M.substitutes('Imaj7'), ['III-7', 'VI-7']);
  assert.deepStrictEqual(M.substitutes('V7'), ['VII-7b5', 'subV7']);
  const fn = { Cmaj7: 'T', 'E-7': 'T', 'A-7': 'T', 'D-7': 'SD', Fmaj7: 'SD', G7: 'D', 'B-7b5': 'D', Db7: 'D', E7: null };
  for (const [c, f] of Object.entries(fn)) assert.strictEqual(M.chordFunction(c), f, c);
});

/* ---------- lesson structure ---------- */
check('8 worlds, 30 lessons in curriculum order', () => {
  assert.strictEqual(WORLDS.length, 8);
  assert.strictEqual(LESSONS.length, 30);
  const perWorld = WORLDS.map((w) => LESSONS.filter((l) => l.world === w.id).length);
  assert.deepStrictEqual(perWorld, [5, 3, 5, 3, 2, 3, 5, 4]);
  LESSONS.forEach((l, i) => {
    assert.strictEqual(l.n, i + 1);
    assert.strictEqual(l.id, 'L' + String(i + 1).padStart(2, '0'));
    if (i) assert.ok(l.world >= LESSONS[i - 1].world, 'worlds in order');
  });
  const ids = new Set(LESSONS.map((l) => l.id));
  assert.strictEqual(ids.size, 30);
  const colors = new Set(WORLDS.map((w) => w.color));
  assert.strictEqual(colors.size, 8, 'each world has its own colour');
  const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'kids.css'), 'utf8');
  const ui = fs.readFileSync(path.join(__dirname, '..', 'js', 'kids-ui.js'), 'utf8');
  WORLDS.forEach((w) => {
    assert.ok(css.includes('.w-' + w.color + ' '), 'css colour ' + w.color);
    assert.ok(new RegExp('\\b' + w.icon + ": '<svg").test(ui), 'icon ' + w.icon);
  });
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
    const c = M.parseChord(s);
    const rootL = M.note(c.root).l;
    // each chord tone is spelled on the letter of its degree (3rds: +2 letters, 6 = +5, 13 = +5)
    notes.forEach((n, i) => assert.strictEqual(M.note(n).l, (rootL + M.QUALITIES[c.q][i][0] - 1) % 7, s + ' spelled by degree'));
    if (M.QUALITIES[c.q].every((d, i) => d[0] === 2 * i + 1)) {
      const letters = notes.map((n) => M.note(n).l);
      letters.slice(1).forEach((x, i) => assert.strictEqual((x - letters[i] + 7) % 7, 2, s + ' stacked in thirds'));
    }
    assert.strictEqual(M.qualityOf(notes), c.q, s + ' quality');
  }
  assert.ok(syms.size >= 40, 'chords checked: ' + syms.size);
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
    if (t.minor) assert.strictEqual(t.target, M.minorScale(t.target.split(' ')[0], t.minor).join(' '), l.id + ' minor scale');
    if (t.colour) assert.strictEqual(t.target, M.scale(t.target.split(' ')[0], t.colour[1]).join(' '), l.id + ' colour scale');
    if (t.colour) assert.strictEqual(M.bare(t.target.split(' ')[0]), t.colour[0]);
    if (t.holds) assert.ok(M.chordNotes(t.chord).map(M.bare).includes(t.holds), l.id + ' chord holds the melody note');
    if (t.guide) assert.strictEqual(pcs(t.target), pcs(M.guideTones(t.guide)), l.id + ' guide tones of ' + t.guide);
    if (t.replaces) assert.strictEqual(M.chordFunction(t.chord), M.chordFunction(t.replaces), l.id + ' same function');
    if (t.approach) { const [a, b] = t.target.split(' '); assert.strictEqual(M.approachBelow(b), a); }
  }
});

check('try-it tasks in worlds 6-8 are correct', () => {
  const one = (id, i) => { const t = byId(id).try[i]; return M.semis(t.mark, t.target); };
  assert.strictEqual(one('L19', 0), 1);   // F half step above E = avoid on Cmaj7
  assert.ok(M.avoidNotes('Cmaj7').includes(M.bare(byId('L19').try[0].target)));
  assert.strictEqual(one('L19', 1), 2);   // 9 of C
  assert.ok(M.tensions('Cmaj7').some((x) => x.note === M.bare(byId('L19').try[1].target) && x.num === '9'));
  assert.strictEqual(one('L19', 2), 1);   // C half step above B = avoid on G7
  assert.ok(M.avoidNotes('G7').includes(M.bare(byId('L19').try[2].target)));
  assert.strictEqual(byId('L20').try[0].target, M.chordNotes('Cmaj7', 4).join(' '));   // arpeggio
  assert.strictEqual(one('L20', 2), 2);   // 9 of G
  assert.strictEqual(one('L20', 3), 9);   // 13 = 6th of C
  assert.ok(M.tensions('Cmaj7').some((x) => x.note === 'A' && x.num === '13'));
  assert.strictEqual(one('L23', 0), 3);   // b3
  assert.strictEqual(one('L23', 1), 8);   // b6
  assert.strictEqual(one('L23', 2), 10);  // b7
  assert.strictEqual(one('L23', 3), 3);   // b3 of A
  assert.strictEqual(one('L28', 1), -6);  // tritone below G = Db
  assert.strictEqual(M.parseChord(M.tritoneSub('G7')).root, M.bare(byId('L28').try[1].target));
  const gl = M.guideToneLine('D-7 G7 Cmaj7', 4);
  assert.deepStrictEqual(byId('L29').try.map((t) => t.target), gl.map((v) => v.join(' ')));
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
    /* worlds 6-8 */
    const optSyms = q.opts.map(strip);
    if (c.avoid) assert.ok(M.avoidNotes(c.avoid[0]).includes(c.avoid[1]) && M.halfStepAboveChordTone(c.avoid[1], c.avoid[0]), l.id + ' avoid');
    if (c.avoid && q.play) assert.ok(M.notes(q.play.seq.join(' ')).some((x) => M.bare(x.name) === c.avoid[1]), l.id + ' plays the avoid note');
    if (c.tension) {
      const tt = M.tensions(c.tension[0]).find((x) => x.note === c.tension[1]);
      assert.ok(tt, l.id + ' tension ' + c.tension[1]);
      if (c.tension[2]) { assert.strictEqual(tt.num, c.tension[2]); }
      if (!q.play && q.opts.length === 3) assert.strictEqual(ans, c.tension[1]);
      if (q.play) assert.ok(M.notes(q.play.seq.join(' ')).some((x) => M.bare(x.name) === c.tension[1]), l.id + ' plays the tension');
    }
    if (c.avoidOpts) optSyms.forEach((o, i) => assert.strictEqual(M.avoidNotes(c.avoidOpts).includes(o), i === q.a, l.id + ' ' + o));
    if (c.halfAbove) assert.ok(M.halfStepAboveChordTone(c.halfAbove[0], c.halfAbove[1]));
    if (c.approach) { assert.strictEqual(M.approachBelow(c.approach[0]), c.approach[1]); assert.strictEqual(ans, M.bare(c.approach[1])); }
    if (c.holds) optSyms.forEach((o, i) => assert.strictEqual(M.chordNotes(o).map(M.bare).includes(c.holds), i === q.a, l.id + ' ' + o));
    if (c.holdsNot) optSyms.forEach((o, i) => assert.strictEqual(M.chordNotes(o).map(M.bare).includes(c.holdsNot), i !== q.a, l.id + ' ' + o));
    if (c.minorPlay) assert.strictEqual(q.play.n, M.minorScale('C4', c.minorPlay).join(' '), l.id);
    if (c.raised) {
      const nat = M.degreeNames('C', 'natural'), other = M.degreeNames('C', c.raised[0]);
      const changed = nat.map((d, i) => (d !== other[i] ? String(i + 1) : null)).filter(Boolean).join(' ');
      assert.strictEqual(changed, c.raised[1], l.id + ' raised degrees');
    }
    if (c.degree) { assert.strictEqual(M.bare(M.minorScale(c.degree[0] + 4, c.degree[1])[c.degree[2] - 1]), c.degree[3]); assert.strictEqual(ans, c.degree[3]); }
    if (c.chordQ) { assert.strictEqual(q.play.chord, c.chordQ[0]); assert.strictEqual(M.parseChord(c.chordQ[0]).q, c.chordQ[1]); }
    if (c.flats) assert.strictEqual(M.degreeNames('C', c.flats[0]).filter((d) => d[0] === 'b').length, +ans);
    if (c.minorDia) {
      const d = M.diatonicSevenths(c.minorDia[0], c.minorDia[1])[c.minorDia[2] - 1];
      assert.strictEqual(d.sym, c.minorDia[3]);
      assert.ok(ans === d.sym || ans === d.roman, l.id + ' ' + ans);
    }
    if (c.chordHas) assert.ok(M.chordNotes(c.chordHas[0]).map(M.bare).includes(c.chordHas[1]));
    if (c.progAns) assert.strictEqual(ans.split(' → ').join(' '), q.play.prog);
    if (c.minorIIVIplay) assert.strictEqual(q.play.prog, M.minorIIVI(c.minorIIVIplay).join(' '));
    if (c.minorIIVI) assert.strictEqual(ans, M.minorIIVI(c.minorIIVI[0])[c.minorIIVI[1]]);
    if (c.minorIIVIfull) assert.strictEqual(ans.split(' → ').join(' '), M.minorIIVI(c.minorIIVIfull).join(' '));
    if (c.modeOf) {
      const [mode, parent, k] = c.modeOf;
      const p = M.minorScale('C4', parent).slice(0, 7);
      const root = p[k - 1];
      assert.strictEqual(pcs(M.scale(root, mode).slice(0, 7)), pcs(p), l.id + ' ' + mode + ' is mode ' + k + ' of ' + parent);
    }
    if (c.colourPlay) assert.strictEqual(q.play.n, M.scale(q.play.n.split(' ')[0], c.colourPlay).join(' '));
    if (c.relII) { assert.strictEqual(M.relatedII(c.relII[0], c.relII[1]), c.relII[2]); assert.strictEqual(ans, c.relII[2]); }
    if (c.tritoneSub) { assert.strictEqual(M.tritoneSub(c.tritoneSub[0]), c.tritoneSub[1]); assert.strictEqual(ans, c.tritoneSub[1]); }
    if (c.sharedTritone) assert.strictEqual(pcs(ans.split(' ')), pcs(M.tritoneOf(c.sharedTritone[1])));
    if (c.sharedTritone) assert.strictEqual(pcs(ans.split(' ')), pcs(M.tritoneOf(c.sharedTritone[0])));
    if (c.progMid) { assert.strictEqual(q.play.prog.split(' ')[1], c.progMid); assert.ok(ans.startsWith(c.progMid + ':')); }
    if (c.guide) { assert.strictEqual(ans, M.guideTones(c.guide).map(M.bare).join(' ')); }
    if (c.glMove) {
      const gl = M.guideToneLine(c.glMove[0], 4);
      const from = gl[0].findIndex((n) => M.bare(n) === c.glMove[1]);
      assert.strictEqual(M.bare(gl[1][from]), c.glMove[2]);
    }
    if (c.smooth != null) {
      const g = q.play.seq.map((x) => x.split(' '));
      const maxMove = Math.max(...g.slice(1).map((v, i) => Math.max(...v.map((n, j) => Math.abs(M.midi(n) - M.midi(g[i][j]))))));
      assert.strictEqual(maxMove <= 2, c.smooth, l.id + ' max move ' + maxMove);
    }
    if (c.sameFn) optSyms.forEach((o, i) => assert.strictEqual(M.chordFunction(o) === M.chordFunction(c.sameFn), i === q.a, l.id + ' ' + o));
    if (c.story) assert.strictEqual(q.play.prog.split(' ').map((s) => M.chordFunction(s)).join(' '), c.story);
    n++;
  }
  assert.ok(n >= 85, 'checked quiz questions: ' + n);
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

check('lessons 19-30 content matches theory', () => {
  // L22: hear = the three minor scales + jazz melodic minor going down unchanged
  const h22 = byId('L22').hear.map((h) => h.play.n);
  assert.deepStrictEqual(h22.slice(0, 3), ['natural', 'harmonic', 'melodic'].map((t) => M.minorScale('C4', t).join(' ')));
  assert.strictEqual(h22[3], M.minorScale('C4', 'melodic').slice().reverse().join(' '));
  // L24: chips = natural-minor chords, then the jazz minor team (V7 and VII°7 from harmonic minor)
  const f24 = byId('L24').learn[0].fig;
  assert.deepStrictEqual(f24.chips, M.diatonicSevenths('C', 'natural').map((x) => x.sym));
  assert.deepStrictEqual(f24.subs, M.diatonicSevenths('C', 'natural').map((x) => x.roman));
  const team = byId('L24').learn[5].fig;
  const mk = M.minorKeyChords('C');
  const want = mk.natural.map((x, i) => (i === 4 ? mk.V : x)).concat([mk.VII]);
  assert.deepStrictEqual(team.chips, want.map((x) => x.sym));
  assert.deepStrictEqual(team.subs, want.map((x) => x.roman));
  assert.strictEqual(byId('L24').hear[0].play.prog, M.diatonicSevenths('C', 'natural').map((x) => x.sym).join(' '));
  // L25: minor II-V-I in C and A, and the C-6 ending
  const h25 = byId('L25').hear.map((h) => h.play.prog);
  assert.strictEqual(h25[0], M.minorIIVI('C').join(' '));
  assert.strictEqual(h25[1], M.iiVI('C').join(' '));
  assert.strictEqual(h25[2], M.minorIIVI('A').join(' '));
  assert.strictEqual(h25[3], M.minorIIVI('C', 'six').join(' '));
  assert.deepStrictEqual(byId('L25').learn[1].fig.chips, M.minorIIVI('C'));
  // L26: hear = the three colour scales
  const h26 = byId('L26').hear.map((h) => h.play.n);
  assert.strictEqual(h26[0], M.scale('F4', 'lydianDominant').join(' '));
  assert.strictEqual(h26[1], M.scale('B3', 'altered').join(' '));
  assert.strictEqual(h26[2], M.scale('G3', 'phrygianDominant').join(' '));
  // L27: the five secondary dominants with their labels; II-V examples use the related II
  const f27 = byId('L27').learn[1].fig;
  assert.deepStrictEqual(f27.chips, M.secondaryDominants('C').map((x) => x.dom));
  assert.deepStrictEqual(f27.subs, M.secondaryDominants('C').map((x) => x.label));
  byId('L27').hear.slice(0, 3).forEach((h) => {
    const [ii, v, t] = h.play.prog.split(' ');
    assert.strictEqual(M.secondaryDominant(t), v);
    assert.strictEqual(M.relatedII(v, t), ii);
  });
  // L28: SubV7 progressions, related II Ab-7
  assert.strictEqual(byId('L28').hear[1].play.prog, ['D-7', M.subV7('Cmaj7'), 'Cmaj7'].join(' '));
  assert.strictEqual(byId('L28').hear[3].play.prog, [M.relatedII('Db7'), 'Db7', 'Cmaj7'].join(' '));
  assert.strictEqual(pcs(byId('L28').hear[2].play.n), pcs(M.tritoneOf('Db7')));
  // L29: the guide-tone line and the voiced version
  const gl = M.guideToneLine('D-7 G7 Cmaj7', 4).map((v) => v.join(' '));
  assert.deepStrictEqual(byId('L29').hear[0].play.seq, gl);
  byId('L29').hear[1].play.seq.forEach((g, i) => assert.strictEqual(g.split(' ').slice(1).join(' '), gl[i]));
  // L30: every substitute progression keeps the story T SD D T
  byId('L30').hear.forEach((h) => assert.strictEqual(h.play.prog.split(' ').map((s) => M.chordFunction(s)).join(' '), 'T SD D T'));
  byId('L30').learn.forEach((s) => {
    if (!s.fig || !s.fig.subs) return;
    const fns = s.fig.chips.map((c) => M.chordFunction(c));
    assert.strictEqual(new Set(fns).size, 1, 'one function per substitution screen');
    s.fig.subs.forEach((r, i) => assert.strictEqual(M.romanChord('C', r === 'SubV7' ? 'subV7' : r), s.fig.chips[i]));
  });
  // L21: the melody chords hold the melody notes
  const h21 = byId('L21').hear[1].play.seq;
  const chords21 = ['Cmaj7', 'D-7', 'G7', 'Cmaj7'];
  const mel21 = byId('L21').hear[0].play.n.split(' ');
  mel21.forEach((n, i) => assert.ok(M.chordNotes(chords21[i]).map(M.bare).includes(M.bare(n)), n + ' in ' + chords21[i]));
  h21.forEach((g, i) => assert.ok(g.split(' ').map(M.bare).every((x) => M.chordNotes(chords21[i]).map(M.bare).includes(x)), 'voicing ' + g));
});

check('unlock order continues into the new worlds (L19 after L18 ... L30)', () => {
  const s = CORE.migrateState({});
  const TS = new Date(2026, 10, 22, 12).getTime();
  for (let i = 0; i < 18; i++) K.finishLesson(s, LESSONS, LESSONS[i].id, 3, 4, 0, TS);
  assert.strictEqual(K.unlocked(s, LESSONS, 18), true);
  assert.strictEqual(LESSONS[18].id, 'L19');
  assert.strictEqual(K.unlocked(s, LESSONS, 19), false);
  const r = K.finishLesson(s, LESSONS, 'L19', 5, 5, 0, TS);
  assert.strictEqual(r.unlockedNext, 'L20');
  assert.deepStrictEqual(r.delta, { id: 'kids-L19', r: 3, t: 1 });
  for (let i = 19; i < 29; i++) K.finishLesson(s, LESSONS, LESSONS[i].id, 4, 4, 0, TS);
  assert.strictEqual(K.nextIndex(s, LESSONS), 29);
  const last = K.finishLesson(s, LESSONS, 'L30', 4, 5, 0, TS);
  assert.strictEqual(last.unlockedNext, null);
  assert.strictEqual(K.nextIndex(s, LESSONS), null);
  assert.ok(Object.keys(s.stats).filter(K.isKidsStat).length === 30);
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
  assert.deepStrictEqual([t.stars, t.done, t.maxStars, t.count], [5, 2, 90, 30]);
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
  assert.ok(/VERSION = "ha-v6"/.test(sw), 'cache version bumped to ha-v6 for worlds 6-8');
});

console.log(`\n${passed} kids checks passed`);
