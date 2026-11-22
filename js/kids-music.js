/* Harmona kids: small music-theory helpers (spelling, chords, scales, sound specs).
   Pure functions, no DOM. Used by the lessons UI and by tests/kids.test.js. */
(function (root) {
  'use strict';
  const HP = root.HP = root.HP || {};
  const M = HP.kidsMusic = {};

  const LET = 'CDEFGAB';
  const NAT = [0, 2, 4, 5, 7, 9, 11];
  const mod = (x, m) => ((x % m) + m) % m;
  M.LET = LET;
  M.NAT = NAT;

  /* 'C#4' -> { l, a, oct, pc, midi, name }. Octave defaults to 4. C4 = midi 60. */
  M.note = function (s) {
    const m = /^([A-G])(##|#|bb|b)?(-?\d)?$/.exec(String(s).trim());
    if (!m) throw new Error('bad note: ' + s);
    const l = LET.indexOf(m[1]);
    const acc = m[2] || '';
    const a = acc[0] === '#' ? acc.length : acc[0] === 'b' ? -acc.length : 0;
    const oct = m[3] == null ? 4 : +m[3];
    const midi = 12 * (oct + 1) + NAT[l] + a;
    return { l: l, a: a, oct: oct, pc: mod(NAT[l] + a, 12), midi: midi, name: m[1] + acc + oct };
  };
  M.notes = function (s) {
    return (Array.isArray(s) ? s : String(s).trim().split(/\s+/)).filter(Boolean).map(M.note);
  };
  M.midi = function (s) { return M.note(s).midi; };
  M.pcOf = function (s) { return M.note(s).pc; };
  M.spell = function (l, a, oct) {
    return LET[l] + (a > 0 ? '#'.repeat(a) : 'b'.repeat(-a)) + (oct == null ? '' : oct);
  };
  M.bare = function (s) { return String(s).replace(/-?\d+$/, ''); };

  /* Chord qualities in the book's symbols: [degree, semitones above root] */
  const Q = {
    '':     [[1, 0], [3, 4], [5, 7]],
    '-':    [[1, 0], [3, 3], [5, 7]],
    '°':    [[1, 0], [3, 3], [5, 6]],
    '+':    [[1, 0], [3, 4], [5, 8]],
    'maj7': [[1, 0], [3, 4], [5, 7], [7, 11]],
    '7':    [[1, 0], [3, 4], [5, 7], [7, 10]],
    '-7':   [[1, 0], [3, 3], [5, 7], [7, 10]],
    '-7b5': [[1, 0], [3, 3], [5, 6], [7, 10]],
    '°7':   [[1, 0], [3, 3], [5, 6], [7, 9]],
    'maj9': [[1, 0], [3, 4], [5, 7], [7, 11], [9, 14]],
    '9':    [[1, 0], [3, 4], [5, 7], [7, 10], [9, 14]],
    '-9':   [[1, 0], [3, 3], [5, 7], [7, 10], [9, 14]],
  };
  M.QUALITIES = Q;
  M.FAMILY_HE = {
    '': 'מז׳ורי', '-': 'מינורי', '°': 'מוקטן', '+': 'מוגדל',
    'maj7': 'מז׳ור 7', '7': 'דומיננטי', '-7': 'מינור 7', '-7b5': 'חצי מוקטן', '°7': 'מוקטן 7',
    'maj9': 'מז׳ור 9', '9': 'דומיננטי 9', '-9': 'מינור 9',
  };

  M.parseChord = function (sym) {
    const m = /^([A-G](?:#|b)?)(.*)$/.exec(String(sym).trim());
    if (!m || !Object.prototype.hasOwnProperty.call(Q, m[2])) throw new Error('bad chord: ' + sym);
    return { root: m[1], q: m[2], sym: m[1] + m[2] };
  };

  /* Spelled chord tones, stacked in thirds from the root (letters skip one each floor). */
  M.chordNotes = function (sym, oct) {
    const c = M.parseChord(sym);
    const r = M.note(c.root + (oct == null ? 3 : oct));
    return Q[c.q].map(function (d) {
      const L = r.l + d[0] - 1;
      const l = L % 7, o = r.oct + Math.floor(L / 7);
      const natural = 12 * (o + 1) + NAT[l];
      return M.spell(l, r.midi + d[1] - natural, o);
    });
  };

  /* semitone stack of a set of notes above the lowest -> quality key, or null */
  M.qualityOf = function (names) {
    const ns = M.notes(names).sort(function (x, y) { return x.midi - y.midi; });
    const semis = ns.map(function (n) { return n.midi - ns[0].midi; }).join(',');
    for (const k of Object.keys(Q)) {
      if (Q[k].map(function (d) { return d[1]; }).join(',') === semis) return k;
    }
    return null;
  };

  M.semis = function (a, b) { return M.midi(b) - M.midi(a); };

  M.MAJOR_STEPS = [2, 2, 1, 2, 2, 2, 1];
  /* spelled major scale, one letter per degree, plus the octave on top */
  M.majorScale = function (rootName) {
    const r = M.note(/\d$/.test(rootName) ? rootName : rootName + 4);
    const out = [];
    let semi = 0;
    for (let i = 0; i <= 7; i++) {
      const L = r.l + i, l = L % 7, o = r.oct + Math.floor(L / 7);
      const natural = 12 * (o + 1) + NAT[l];
      out.push(M.spell(l, r.midi + semi - natural, o));
      semi += M.MAJOR_STEPS[i % 7];
    }
    return out;
  };

  M.ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  /* seventh chords built from a major scale by stacking its own notes in thirds */
  M.diatonicSevenths = function (key) {
    const sc = M.majorScale(key + 3).slice(0, 7);
    const ext = sc.concat(sc.map(function (n) { const x = M.note(n); return M.spell(x.l, x.a, x.oct + 1); }));
    return sc.map(function (_, i) {
      const tones = [ext[i], ext[i + 2], ext[i + 4], ext[i + 6]];
      const q = M.qualityOf(tones);
      const sym = M.bare(tones[0]) + q;
      return { degree: i + 1, roman: M.ROMAN[i] + q, sym: sym, q: q, tones: tones };
    });
  };

  /* Harmonic functions in a major key (book, pp. 28-30) */
  M.FUNCTIONS = { T: ['I', 'III', 'VI'], SD: ['II', 'IV'], D: ['V', 'VII'] };
  M.functionOf = function (roman) {
    const base = String(roman).replace(/[^IV]/g, '');
    for (const f of Object.keys(M.FUNCTIONS)) if (M.FUNCTIONS[f].indexOf(base) !== -1) return f;
    return null;
  };

  M.iiVI = function (key) {
    const d = M.diatonicSevenths(key);
    return [d[1].sym, d[4].sym, d[0].sym];
  };

  /* secondary dominant of a chord: dominant 7 a perfect fifth above its root */
  M.secondaryDominant = function (targetSym) {
    const t = M.parseChord(targetSym);
    const r = M.note(t.root + 3);
    const L = r.l + 4, l = L % 7, o = r.oct + Math.floor(L / 7);
    const natural = 12 * (o + 1) + NAT[l];
    return M.spell(l, r.midi + 7 - natural) + '7';
  };

  M.BLUES_ROMAN = ['I7', 'I7', 'I7', 'I7', 'IV7', 'IV7', 'I7', 'I7', 'V7', 'IV7', 'I7', 'V7'];
  M.blues = function (key) {
    const sc = M.majorScale(key + 3);
    const by = { I7: M.bare(sc[0]) + '7', IV7: M.bare(sc[3]) + '7', V7: M.bare(sc[4]) + '7' };
    return M.BLUES_ROMAN.map(function (r) { return by[r]; });
  };

  /* Sound spec -> timed events. Specs:
     { n: 'C4 E4', how: 'up'|'down'|'together'|'both' }  notes
     { chord: 'Cmaj7', how?, oct? }                      one chord
     { prog: 'D-7 G7 Cmaj7', beat? }                    chord progression
     { seq: ['B3 F4', 'C4 E4'], beat? }                  groups played one after another */
  M.events = function (spec) {
    const ev = [];
    let t = 0;
    const step = spec.step || 0.42;
    function group(midis, dur) { ev.push({ t: t, midis: midis, dur: dur }); }
    function line(midis, how) {
      if (how === 'together') { group(midis, 1.6); t += 1.6; return; }
      const seq = how === 'down' ? midis.slice().reverse() : midis;
      seq.forEach(function (m) { group([m], step * 1.5); t += step; });
      if (how === 'both') { t += 0.25; group(midis, 1.6); t += 1.6; }
      else t += step * 0.6;
    }
    if (spec.n) line(M.notes(spec.n).map(function (x) { return x.midi; }), spec.how || 'up');
    else if (spec.chord) line(M.chordNotes(spec.chord, spec.oct).map(M.midi), spec.how || 'together');
    else if (spec.prog || spec.seq) {
      const beat = spec.beat || 1.15;
      const groups = spec.prog
        ? String(spec.prog).trim().split(/\s+/).map(function (s) { return M.chordNotes(s, spec.oct).map(M.midi); })
        : spec.seq.map(function (g) { return M.notes(g).map(function (x) { return x.midi; }); });
      groups.forEach(function (g, i) {
        const last = i === groups.length - 1;
        group(g, last ? 1.8 : beat * 0.95); t += last ? 1.8 : beat;
      });
    }
    return { events: ev, total: t };
  };

  /* All chord symbols a spec will sound (for tests and labels) */
  M.specChords = function (spec) {
    if (spec.chord) return [spec.chord];
    if (spec.prog) return String(spec.prog).trim().split(/\s+/);
    return [];
  };

  /* white keys between two white notes, inclusive, as note names */
  M.whiteRange = function (from, to) {
    const a = M.note(from), b = M.note(to), out = [];
    for (let m = a.midi; m <= b.midi; m++) {
      const pc = mod(m, 12);
      const l = NAT.indexOf(pc);
      if (l !== -1) out.push(LET[l] + (Math.floor(m / 12) - 1));
    }
    return out;
  };
  /* all key midis (white and black) in a range */
  M.keysIn = function (from, to) {
    const a = M.midi(from), b = M.midi(to), out = [];
    for (let m = a; m <= b; m++) out.push(m);
    return out;
  };

  /* Display: ASCII accidentals -> music signs (data stays ASCII) */
  M.pretty = function (s) {
    return String(s)
      .replace(/([A-G])bb/g, '$1♭♭')
      .replace(/([A-G])b/g, '$1♭')
      .replace(/b(?=\d)/g, '♭')
      .replace(/#/g, '♯');
  };

  const SOLFEGE = ['דו', 'רה', 'מי', 'פה', 'סול', 'לה', 'סי'];
  M.SOLFEGE = SOLFEGE;
  /* Hebrew-friendly name of a key by midi: white -> letter, black -> sharp/flat pair */
  M.keyName = function (midi) {
    const pc = mod(midi, 12);
    const l = NAT.indexOf(pc);
    if (l !== -1) return { white: true, letter: LET[l], solfege: SOLFEGE[l], names: [LET[l]] };
    const lo = NAT.indexOf(pc - 1), hi = NAT.indexOf(pc + 1);
    return { white: false, letter: null, names: [LET[lo] + '#', LET[hi] + 'b'] };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = M;
})(typeof window !== 'undefined' ? window : globalThis);
