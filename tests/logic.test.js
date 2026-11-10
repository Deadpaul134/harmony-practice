// Checks the music logic inside index.html. Run: node tests/logic.test.js
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const core = html.slice(html.indexOf('// ---------- music core'), html.indexOf('// ---------- storage'));
const { EX, pc, nm, parse, spellIv, IV, MODES, spellMode, onLetter, modeAlts, nmPretty, degPretty, DEG_HE, chromaRootOf, chromaNoteInKey, MAJ } =
  new Function(core + ';return {EX,pc,nm,parse,spellIv,IV,MODES,spellMode,onLetter,modeAlts,nmPretty,degPretty,DEG_HE,chromaRootOf,chromaNoteInKey,MAJ};')();

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

check('mode alterations relative to major (course table)', () => {
  const alts = en => modeAlts(mode(en)).join(' ');
  assert.strictEqual(alts('Ionian'), '');
  assert.strictEqual(alts('Dorian'), 'b3 b7');
  assert.strictEqual(alts('Phrygian'), 'b2 b3 b6 b7');
  assert.strictEqual(alts('Lydian'), '#4');
  assert.strictEqual(alts('Mixolydian'), 'b7');
  assert.strictEqual(alts('Aeolian'), 'b3 b6 b7');
  assert.strictEqual(alts('Locrian'), 'b2 b3 b5 b6 b7');
});

check('pretty accidentals and degrees (display only)', () => {
  assert.strictEqual(nm(parse('Eb')), 'Eb');
  assert.strictEqual(nmPretty(parse('Eb')), 'E♭');
  assert.strictEqual(nmPretty(parse('C#')), 'C♯');
  assert.strictEqual(nmPretty(parse('F##')), 'F♯♯');
  assert.strictEqual(nmPretty(parse('Bbb')), 'B♭♭');
  assert.strictEqual(degPretty('b3'), '♭3');
  assert.strictEqual(degPretty('#4'), '♯4');
  assert.strictEqual(degPretty('b7'), '♭7');
  for (const d of Object.keys(DEG_HE)) assert.ok(DEG_HE[d].length > 2, d);
});

check('chromatic degrees (notebook examples)', () => {
  // B = #2 of Ab major; B = b7 of C# major
  assert.strictEqual(nm(onLetter(6 - 1, 11 - 2 - 1)), 'Ab');
  assert.strictEqual(nm(onLetter(6 - 6, 11 - 11 + 1)), 'C#');
  // ♭3 = E → C♯ major (E is the lowered third of C♯; not D♭, which would spell the third as F♭)
  assert.strictEqual(nm(chromaRootOf(parse('E'), 'b3')), 'C#');
  assert.strictEqual(nm(chromaNoteInKey(parse('C#'), 'b3').x), 'E');
  assert.strictEqual(nm(chromaRootOf(parse('B'), '#2')), 'Ab');
  assert.strictEqual(nm(chromaRootOf(parse('B'), 'b7')), 'C#');
});

check('chroma spelling and task sentences', () => {
  const asciiAccidental = /(?:^|[^a-zA-Z#])(?:[A-G](?:#{1,2}|b{1,2})|#[1-7]|b[1-7])(?:[^0-9a-zA-Z]|$)/;
  for (const id of ['ch-which', 'ch-what']) {
    const ty = EX.chroma.types.find(t => t.id === id);
    for (const lv of [1, 2, 3]) {
      for (let k = 0; k < 500; k++) {
        const q = ty.gen(lv);
        assert.ok(q && q.chroma, `${id} lv ${lv} missing chroma detail`);
        const { x, d, root, dia } = q.chroma;
        const { alt, deg } = { alt: d[0] === '#' ? 1 : -1, deg: +d.slice(1) };
        // musical relationship: the given note is degree d of root major
        const expectPc = (pc(root) + MAJ[deg - 1] + alt + 120) % 12;
        assert.strictEqual(pc(x), expectPc, `${id}: ${nm(x)} is not ${d} of ${nm(root)} major`);
        assert.strictEqual((x.l - root.l + 7) % 7, (deg - 1) % 7, `${id}: letter of ${nm(x)} does not match degree ${d} in ${nm(root)}`);
        if (id === 'ch-which') {
          assert.strictEqual(q.correct, pc(root));
          assert.strictEqual(nm(chromaRootOf(x, d)), nm(root));
          assert.ok(q.prompt.includes('מצא את הטוניקה'), q.prompt);
        } else {
          assert.strictEqual(q.correct, pc(x));
          assert.strictEqual(nm(chromaNoteInKey(root, d).x), nm(x));
          assert.ok(q.prompt.includes('מהו הצליל שנמצא בדרגה'), q.prompt);
        }
        assert.ok(q.prompt.includes(degPretty(d)), `${id} prompt missing ${degPretty(d)}: ${q.prompt}`);
        assert.ok(q.prompt.includes(nmPretty(id === 'ch-which' ? x : root)), q.prompt);
        assert.ok(q.prompt.includes(DEG_HE[d]), `${id} prompt missing ${DEG_HE[d]}`);
        assert.ok(q.prompt.includes('dir="ltr"'), 'formula must force LTR');
        // display text must not leak ASCII accidentals like Eb or b3 (data keys stay ASCII)
        const promptText = q.prompt.replace(/<[^>]+>/g, ' ');
        assert.ok(!asciiAccidental.test(promptText), `ASCII accidental in prompt: ${promptText}`);
        const explainText = q.explain().replace(/<[^>]+>/g, ' ');
        assert.ok(!asciiAccidental.test(explainText), `ASCII accidental in explain: ${explainText}`);
        // diatonic degree in the key, then altered, matches x
        assert.strictEqual(pc(x), (pc(dia) + alt + 12) % 12);
      }
    }
  }
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
      if (ty.id === 'md-alter' && q.kind === 'multi') {
        assert.ok(q.choices.every(c => /^[b#][1-7]$/.test(c.value)), 'alt values stay ASCII');
        assert.ok(q.choices.every(c => /[♯♭]/.test(c.label)), 'alt labels are pretty');
      }
    }
  }
});

console.log(`\n${passed} checks passed`);
