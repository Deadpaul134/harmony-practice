// Checks the music logic inside index.html. Run: node tests/logic.test.js
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const core = html.slice(html.indexOf('// ---------- music core'), html.indexOf('// ---------- storage'));
const { EX, pc, nm, parse, spellIv, IV, MODES, spellMode, onLetter } =
  new Function(core + ';return {EX,pc,nm,parse,spellIv,IV,MODES,spellMode,onLetter};')();

const iv = sym => IV.find(i => i.sym === sym);
const mode = en => MODES.find(m => m.en === en);
let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('ok   ' + name); };

check('interval spelling', () => {
  assert.strictEqual(nm(spellIv(parse('E#'), iv('+3'), 1)), 'G##');
  assert.strictEqual(nm(spellIv(parse('A#'), iv('−7'), -1)), 'B#');
  assert.strictEqual(nm(spellIv(parse('D#'), iv('+6'), -1)), 'F#');
  assert.strictEqual(nm(spellIv(parse('D#'), iv('−6'), -1)), 'F##');
  assert.strictEqual(nm(spellIv(parse('B#'), iv('P5'), 1)), 'F##');
});

check('mode spelling', () => {
  assert.strictEqual(spellMode(parse('F'), mode('Locrian')).map(nm).join(' '), 'F Gb Ab Bb Cb Db Eb');
  assert.strictEqual(spellMode(parse('D#'), mode('Dorian')).map(nm).join(' '), 'D# E# F# G# A# B# C#');
  assert.strictEqual(spellMode(parse('A'), mode('Mixolydian')).map(nm).join(' '), 'A B C# D E F# G');
});

check('chromatic degrees (notebook examples)', () => {
  // B = #2 of Ab major; B = b7 of C# major
  assert.strictEqual(nm(onLetter(6 - 1, 11 - 2 - 1)), 'Ab');
  assert.strictEqual(nm(onLetter(6 - 6, 11 - 11 + 1)), 'C#');
});

check('every generator, every level, 2000 times', () => {
  for (const topic of Object.values(EX)) for (const ty of topic.types) for (const lv of [1, 2, 3]) {
    for (let k = 0; k < 2000; k++) {
      const q = ty.gen(lv);
      assert.ok(q, `${ty.id} level ${lv} returned nothing`);
      if (q.kind === 'chain') {
        for (const s of q.steps) {
          assert.strictEqual(((pc(s.from) + s.dir * s.iv.s - pc(s.to)) % 12 + 12) % 12, 0, 'chain step pitch');
          assert.ok(Math.abs(s.to.a) <= 2, 'chain note has at most two accidentals');
        }
        continue;
      }
      const text = q.prompt + q.explain();
      assert.ok(!/undefined|NaN/.test(text), `${ty.id} level ${lv}: ${text}`);
      if (ty.id === 'md-build') assert.strictEqual(new Set(q.correct).size, 7);
    }
  }
});

console.log(`\n${passed} checks passed`);
