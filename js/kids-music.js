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
    /* minor-key chords (book pp. 50-57) */
    '-maj7':   [[1, 0], [3, 3], [5, 7], [7, 11]],
    'maj7#5':  [[1, 0], [3, 4], [5, 8], [7, 11]],
    '-6':      [[1, 0], [3, 3], [5, 7], [6, 9]],
    '7b9':     [[1, 0], [3, 4], [5, 7], [7, 10], [9, 13]],
    /* altered dominant voicing: 1 3 b7 b9 b13 (book p. 57, VII7b5 / V7alt) */
    '7alt':    [[1, 0], [3, 4], [7, 10], [9, 13], [13, 20]],
  };
  M.QUALITIES = Q;
  M.FAMILY_HE = {
    '': 'מז׳ורי', '-': 'מינורי', '°': 'מוקטן', '+': 'מוגדל',
    'maj7': 'מז׳ור 7', '7': 'דומיננטי', '-7': 'מינור 7', '-7b5': 'חצי מוקטן', '°7': 'מוקטן 7',
    'maj9': 'מז׳ור 9', '9': 'דומיננטי 9', '-9': 'מינור 9',
    '-maj7': 'מינור מז׳ור 7', 'maj7#5': 'מז׳ור 7 מוגדל', '-6': 'מינור 6', '7b9': 'דומיננטי עם תבלין', '7alt': 'דומיננטי אלטרד',
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
  /* Step recipes. Minor scales as the book uses them (pp. 50-57; jazz melodic minor is
     the same going up and down). The last three are the "colour" modes of lesson 26. */
  M.STEPS = {
    major: [2, 2, 1, 2, 2, 2, 1],
    natural: [2, 1, 2, 2, 1, 2, 2],
    harmonic: [2, 1, 2, 2, 1, 3, 1],
    melodic: [2, 1, 2, 2, 2, 2, 1],
    lydianDominant: [2, 2, 2, 1, 2, 1, 2],   /* 4th mode of melodic minor ("Lydian b7", p. 57, 68) */
    altered: [1, 2, 1, 2, 2, 2, 2],          /* 7th mode of melodic minor (p. 57) */
    phrygianDominant: [1, 3, 1, 2, 1, 2, 2], /* 5th mode of harmonic minor ("H-5th below", p. 53) */
  };
  /* spelled scale, one letter per degree, plus the octave on top */
  M.scale = function (rootName, type) {
    const steps = M.STEPS[type || 'major'];
    if (!steps) throw new Error('bad scale: ' + type);
    const r = M.note(/\d$/.test(rootName) ? rootName : rootName + 4);
    const out = [];
    let semi = 0;
    for (let i = 0; i <= 7; i++) {
      const L = r.l + i, l = L % 7, o = r.oct + Math.floor(L / 7);
      const natural = 12 * (o + 1) + NAT[l];
      out.push(M.spell(l, r.midi + semi - natural, o));
      semi += steps[i % 7];
    }
    return out;
  };
  M.majorScale = function (rootName) { return M.scale(rootName, 'major'); };
  M.minorScale = function (rootName, type) { return M.scale(rootName, type || 'natural'); };

  /* degree names compared with the major scale on the same root: 1 2 b3 4 5 b6 b7 */
  M.degreeNames = function (rootName, type) {
    const sc = M.scale(rootName, type).slice(0, 7);
    const maj = M.majorScale(rootName).slice(0, 7);
    return sc.map(function (n, i) {
      const d = M.semis(maj[i], n);
      return (d < 0 ? 'b'.repeat(-d) : '#'.repeat(d)) + (i + 1);
    });
  };

  M.ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  /* seventh chords built from a scale by stacking its own notes in thirds;
     the roman numeral gets b/# when the root differs from the major scale (bIII, bVI, bVII) */
  M.diatonicSevenths = function (key, type) {
    const sc = M.scale(key + 3, type).slice(0, 7);
    const maj = M.majorScale(key + 3).slice(0, 7);
    const ext = sc.concat(sc.map(function (n) { const x = M.note(n); return M.spell(x.l, x.a, x.oct + 1); }));
    return sc.map(function (_, i) {
      const tones = [ext[i], ext[i + 2], ext[i + 4], ext[i + 6]];
      const q = M.qualityOf(tones);
      const sym = M.bare(tones[0]) + q;
      const d = M.semis(maj[i], sc[i]);
      const acc = d < 0 ? 'b' : d > 0 ? '#' : '';
      return { degree: i + 1, roman: acc + M.ROMAN[i] + q, sym: sym, q: q, tones: tones };
    });
  };

  /* The minor-key chord table of lesson 24, as jazz uses it (book pp. 50-55):
     natural minor chords, but V7 and VII°7 come from harmonic minor (raised 7). */
  M.minorKeyChords = function (key) {
    const nat = M.diatonicSevenths(key, 'natural');
    const har = M.diatonicSevenths(key, 'harmonic');
    return { natural: nat, harmonic: har, V: har[4], VII: har[6] };
  };

  /* Minor II-V-I (book pp. 54-55): II-7b5 -> V7 (b9 from harmonic minor) -> I-maj7 */
  M.minorIIVI = function (key, flavour) {
    const har = M.diatonicSevenths(key, 'harmonic');
    const v = M.bare(har[4].tones[0]);
    const i = M.bare(har[0].tones[0]);
    return [har[1].sym, v + (flavour === 'plain' ? '7' : '7b9'), i + (flavour === 'six' ? '-6' : '-maj7')];
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

  /* a note spelled `letters` letter-steps and `semis` semitones above a root name */
  function above(rootName, letters, semis) {
    const r = M.note(M.bare(rootName) + 3);
    const L = r.l + letters, l = L % 7, o = r.oct + Math.floor(L / 7);
    const natural = 12 * (o + 1) + NAT[l];
    return M.spell(l, r.midi + semis - natural);
  }
  M.above = above;

  /* Related II (book pp. 32, 70): the -7 chord a fifth above the dominant's root.
     Before a minor target we use -7b5 (minor II-V, book p. 32 allows both). */
  M.relatedII = function (domSym, targetSym) {
    const d = M.parseChord(domSym);
    const minorTarget = targetSym && /^-/.test(M.parseChord(targetSym).q);
    return above(d.root, 4, 7) + (minorTarget ? '-7b5' : '-7');
  };

  /* Secondary dominants of a major key (book pp. 45-47): V7/II .. V7/VI.
     V7/VII is not used: its root is not in the key. */
  M.secondaryDominants = function (key) {
    const d = M.diatonicSevenths(key);
    return [1, 2, 3, 4, 5].map(function (i) {
      return { of: M.ROMAN[i], target: d[i].sym, dom: M.secondaryDominant(d[i].sym), label: 'V7/' + M.ROMAN[i] };
    });
  };

  /* Tritone substitution (book pp. 68-70): the dominant a tritone away (aug 4th spelled
     as a diminished 5th, so G7 -> Db7). It shares the 3rd and 7th of the original. */
  M.tritoneSub = function (domSym) {
    const d = M.parseChord(domSym);
    return above(d.root, 4, 6) + '7';
  };
  /* SubV7 of a target chord: the dominant a half step above the target's root */
  M.subV7 = function (targetSym) { return M.tritoneSub(M.secondaryDominant(targetSym)); };

  /* the 3rd and 7th of a chord (the "guide tones") */
  M.guideTones = function (sym, oct) {
    const c = M.parseChord(sym);
    const ns = M.chordNotes(sym, oct);
    const idx = function (deg) { return Q[c.q].findIndex(function (d) { return d[0] === deg; }); };
    return [ns[idx(3)], ns[idx(7)]];
  };
  /* tritone inside a dominant chord: its 3rd and 7th, 6 semitones apart */
  M.tritoneOf = function (domSym) { return M.guideTones(domSym, 4).map(M.bare); };

  /* Guide-tone voice leading: start on the 3rd and 7th of the first chord and move each
     voice to the closest guide tone of the next chord (often it stays or moves a half step). */
  M.guideToneLine = function (prog, oct) {
    const chords = String(prog).trim().split(/\s+/);
    let voices = M.guideTones(chords[0], oct == null ? 4 : oct);
    const out = [voices.slice()];
    for (let k = 1; k < chords.length; k++) {
      const next = M.guideTones(chords[k], 4).map(M.bare);
      const used = new Set();
      voices = voices.map(function (v) {
        const vm = M.midi(v);
        let best = null, bestD = 99, bestG = null;
        next.forEach(function (g) {
          if (used.has(g)) return;
          for (let o = 2; o <= 6; o++) {
            const d = Math.abs(M.midi(g + o) - vm);
            if (d < bestD) { bestD = d; best = g + o; bestG = g; }
          }
        });
        used.add(bestG);
        return best;
      });
      out.push(voices.slice());
    }
    return out;
  };
  /* total semitones moved between two voicings (voice by voice) */
  M.motion = function (a, b) {
    return a.reduce(function (s, n, i) { return s + Math.abs(M.midi(b[i]) - M.midi(n)); }, 0);
  };

  /* Functions incl. substitutes (book pp. 28-30, 36, 55, 68): chords of the same family
     can replace each other. SubV7 joins the dominant family. */
  M.FUNCTION_CHORDS = {
    T: ['Imaj7', 'III-7', 'VI-7'],
    SD: ['II-7', 'IVmaj7'],
    D: ['V7', 'VII-7b5', 'subV7'],
  };
  M.romanChord = function (key, roman) {
    if (roman === 'subV7') return M.subV7(M.diatonicSevenths(key)[0].sym);
    const base = roman.replace(/[^IV]/g, '');
    return M.diatonicSevenths(key)[M.ROMAN.indexOf(base)].sym;
  };
  /* function of a chord symbol inside a major key (diatonic chords and SubV7 of I) */
  M.chordFunction = function (sym, key) {
    key = key || 'C';
    const d = M.diatonicSevenths(key).find(function (x) { return x.sym === sym; });
    if (d) return M.functionOf(d.roman);
    if (sym === M.romanChord(key, 'subV7')) return 'D';
    return null;
  };
  M.substitutes = function (roman) {
    const f = M.functionOf(roman);
    return M.FUNCTION_CHORDS[f].filter(function (r) { return r !== roman; });
  };

  /* Avoid notes on the diatonic chords of a major key (book pp. 33-36):
     tonal avoid = a scale note a half step above a chord tone;
     functional avoid = 4 on T chords, 7 on SD chords that hold the 4, 1 on D chords. */
  M.avoidNotes = function (sym, key) {
    key = key || 'C';
    const sc = M.majorScale(key + 4).slice(0, 7).map(M.bare);
    const tones = M.chordNotes(sym).map(M.bare);
    const tonePcs = tones.map(function (n) { return M.pcOf(n); });
    const out = new Set();
    sc.forEach(function (n) {
      if (tones.indexOf(n) !== -1) return;
      const pc = M.pcOf(n);
      if (tonePcs.some(function (t) { return mod(pc - t, 12) === 1; })) out.add(n);
    });
    const dia = M.diatonicSevenths(key).find(function (d) { return d.sym === M.parseChord(sym).sym; });
    if (dia) {
      const f = M.functionOf(dia.roman);
      if (f === 'T' && tones.indexOf(sc[3]) === -1) out.add(sc[3]);
      if (f === 'SD' && tones.indexOf(sc[3]) !== -1 && tones.indexOf(sc[6]) === -1) out.add(sc[6]);
      if (f === 'D' && tones.indexOf(sc[0]) === -1) out.add(sc[0]);
    }
    return sc.filter(function (n) { return out.has(n); });
  };
  /* available tensions (9, 11, 13 and their flats) = scale notes that are neither chord tones nor avoid */
  M.tensions = function (sym, key) {
    key = key || 'C';
    const c = M.parseChord(sym);
    const sc = M.majorScale(key + 4).slice(0, 7).map(M.bare);
    const tones = M.chordNotes(sym).map(M.bare);
    const av = M.avoidNotes(sym, key);
    const root = M.pcOf(c.root);
    const NUM = { 1: 'b9', 2: '9', 3: '#9', 5: '11', 6: '#11', 8: 'b13', 9: '13' };
    return sc.filter(function (n) { return tones.indexOf(n) === -1 && av.indexOf(n) === -1; })
      .map(function (n) { return { note: n, num: NUM[mod(M.pcOf(n) - root, 12)] }; });
  };
  /* is `note` a half step above one of the chord tones? (the clash rule of p. 35) */
  M.halfStepAboveChordTone = function (note, sym) {
    const pc = M.pcOf(M.bare(note));
    return M.chordNotes(sym).some(function (t) { return mod(pc - M.pcOf(t), 12) === 1; });
  };

  /* Melody harmonisation: diatonic seventh chords of the key that hold the note */
  M.chordsWithNote = function (note, key) {
    const pc = M.pcOf(M.bare(note));
    return M.diatonicSevenths(key || 'C').filter(function (d) {
      return d.tones.some(function (t) { return M.pcOf(t) === pc; });
    });
  };

  /* chromatic approach from below: one half step under the target, spelled with the
     letter below when that keeps it a half step (D# -> E), else a sharp/flat of the same name */
  M.approachBelow = function (target) {
    const t = M.note(target);
    const l = (t.l + 6) % 7, o = t.oct - (t.l === 0 ? 1 : 0);
    const natural = 12 * (o + 1) + NAT[l];
    return M.spell(l, t.midi - 1 - natural, o);
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
      .replace(/(^|[^A-Za-z])b(?=[IV])/g, '$1♭')   /* bIII, bVI, bVII */
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
