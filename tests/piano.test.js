// Piano sampler: pure parts (note names, sample choice, polyphony, envelopes) + SW/HTML wiring.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const P = require('../js/piano-sampler.js');
const M = require('../js/kids-music.js');

let passed = 0;
const pending = [];
function check(name, fn) {
  const ok = () => { passed++; console.log('ok   ' + name); };
  const r = fn();
  if (r && typeof r.then === 'function') pending.push(r.then(ok));
  else ok();
}
const ROOT = path.join(__dirname, '..');
const near = (a, b, eps) => Math.abs(a - b) < (eps || 1e-9);

check('note name -> MIDI (sample names, sharps, flats, double accidentals)', () => {
  const cases = { A1: 33, C2: 36, Ds2: 39, Fs2: 42, A2: 45, C4: 60, A4: 69, C7: 96,
    'C#4': 61, Db4: 61, Cb5: 71, 'B#3': 60, Fb4: 64, 'E#4': 65, Bbb3: 57, 'F##4': 67, Fx4: 67,
    Eb3: 51, 'G#2': 44, c4: 60, 'C-1': 0 };
  for (const [n, m] of Object.entries(cases)) assert.strictEqual(P.toMidi(n), m, n);
  for (const bad of ['', 'H4', 'C', '4', 'C#', 'Cbbb4', null]) assert.strictEqual(P.toMidi(bad), null, String(bad));
});

check('sampler note names agree with the lessons note parser', () => {
  for (const n of ['C4', 'Db4', 'Cb5', 'C#4', 'B#3', 'Fb4', 'Bbb3', 'F##4', 'A1', 'C7', 'Eb2', 'G#6'])
    assert.strictEqual(P.toMidi(n), M.midi(n), n);
});

check('22 samples A1..C7, one every minor third, files exist with licence', () => {
  assert.strictEqual(P.SAMPLES.length, 22);
  assert.strictEqual(P.SAMPLE_MIDIS[0], 33);
  assert.strictEqual(P.SAMPLE_MIDIS[21], 96);
  for (let i = 1; i < 22; i++) assert.strictEqual(P.SAMPLE_MIDIS[i] - P.SAMPLE_MIDIS[i - 1], 3);
  for (const n of P.SAMPLES) assert.ok(fs.existsSync(path.join(ROOT, P.url(n))), P.url(n));
  assert.strictEqual(P.url('Ds4'), 'assets/piano/Ds4.mp3');
  const lic = fs.readFileSync(path.join(ROOT, 'assets', 'piano', 'LICENSE.txt'), 'utf8');
  assert.ok(/Salamander/.test(lic) && /CC BY 3\.0/.test(lic));
});

check('nearest sample within 1.5 semitones and playbackRate = 2^(diff/12) for every note A1..C7', () => {
  for (let m = 33; m <= 96; m++) {
    const p = P.pick(m);
    assert.ok(p, 'pick ' + m);
    assert.ok(Math.abs(p.diff) <= 1.5, m + ' diff ' + p.diff);
    assert.strictEqual(p.base + p.diff, m);
    assert.strictEqual(P.toMidi(p.name), p.base);
    assert.ok(near(p.rate, Math.pow(2, p.diff / 12)), 'rate ' + m);
    const best = Math.min(...P.SAMPLE_MIDIS.map((s) => Math.abs(s - m)));
    assert.strictEqual(Math.abs(p.diff), best, 'nearest for ' + m);
  }
  assert.deepStrictEqual(P.pick(60), { name: 'C4', base: 60, diff: 0, rate: 1 });
  assert.strictEqual(P.pick(61).name, 'C4'); assert.ok(near(P.pick(61).rate, Math.pow(2, 1 / 12)));
  assert.strictEqual(P.pick(62).name, 'Ds4'); assert.ok(near(P.pick(62).rate, Math.pow(2, -1 / 12)));
  assert.strictEqual(P.pick(33).name, 'A1'); assert.strictEqual(P.pick(33).rate, 1);
  assert.strictEqual(P.pick(96).name, 'C7'); assert.strictEqual(P.pick(96).rate, 1);
});

check('outside A1..C7: clamp to the edge sample up to an octave, then null (synth)', () => {
  assert.strictEqual(P.pick(32).name, 'A1'); assert.strictEqual(P.pick(32).diff, -1);
  assert.strictEqual(P.pick(21).name, 'A1'); assert.ok(near(P.pick(21).rate, 0.5));
  assert.strictEqual(P.pick(20), null);
  assert.strictEqual(P.pick(100).name, 'C7'); assert.strictEqual(P.pick(100).diff, 4);
  assert.strictEqual(P.pick(108).name, 'C7'); assert.ok(near(P.pick(108).rate, 2));
  assert.strictEqual(P.pick(109), null);
  assert.strictEqual(P.pick(NaN), null);
  assert.strictEqual(P.pick('60'), null);
});

check('load order: C3..C6 first (nearest C4 first), then the rest, each sample once', () => {
  const o = P.loadOrder();
  assert.strictEqual(o.length, 22);
  assert.strictEqual(new Set(o).size, 22);
  assert.strictEqual(o[0], 'C4');
  assert.deepStrictEqual(o.slice(0, P.CORE.length).slice().sort(), P.CORE.slice().sort());
  for (const n of P.CORE) assert.ok(P.toMidi(n) >= 48 && P.toMidi(n) <= 84, n);
  assert.ok(P.PRECACHE.every((n) => P.CORE.includes(n)), 'precache is part of the core');
});

check('polyphony cap: at most 24 overlapping voices, oldest stolen first', () => {
  const pool = P.createPool(24);
  assert.strictEqual(P.MAX_VOICES, 24);
  const vs = [];
  for (let i = 0; i < 24; i++) { const v = { start: i * 0.01, end: 10, id: i }; vs.push(v); assert.deepStrictEqual(pool.add(v), []); }
  const extra = { start: 0.5, end: 10, id: 'x' };
  const stolen = pool.add(extra);
  assert.deepStrictEqual(stolen.map((v) => v.id), [0]);
  assert.strictEqual(pool.voices.length, 24);
  for (let i = 0; i < 10; i++) pool.add({ start: 1 + i, end: 20, id: 'y' + i });
  for (let t = 0; t <= 11; t += 0.25) {
    assert.ok(pool.voices.filter((v) => v.start <= t && v.end > t).length <= 24, 'cap at t=' + t);
  }
  // y0..y8 overlap the first voices (end 10) and steal vs1..vs9; y9 starts at 10, after they end
  assert.ok(!pool.voices.includes(vs[1]) && !pool.voices.includes(vs[9]), 'oldest went first');
  assert.ok(pool.voices.includes(vs[10]), 'no steal once the old voices have ended');
  pool.remove(extra);
  assert.ok(!pool.voices.includes(extra));
  assert.strictEqual(pool.clear().length > 0, true);
  assert.strictEqual(pool.voices.length, 0);
});

check('polyphony: finished or later voices do not count against the cap', () => {
  const pool = P.createPool(3);
  // a long progression scheduled at once: 8 chords of 3 notes, each chord ends before the next
  let stolenBeforeEnd = 0;
  for (let c = 0; c < 8; c++) {
    for (let n = 0; n < 3; n++) {
      const st = pool.add({ start: c, end: c + 0.9 });
      stolenBeforeEnd += st.length;
    }
  }
  assert.strictEqual(stolenBeforeEnd, 0, 'non-overlapping chords are never stolen');
  const st = pool.add({ start: 7.5, end: 8 });
  assert.strictEqual(st.length, 1, 'fourth overlapping note steals one');
});

check('levels: chords are scaled so they do not clip', () => {
  assert.ok(near(P.level(1, 1), 0.8));
  for (let n = 1; n <= 12; n++) {
    assert.ok(P.level(n, 1) * Math.sqrt(n) <= 0.8 + 1e-9);
    assert.ok(P.level(n + 1, 1) < P.level(n, 1));
  }
  assert.ok(P.level(4, 0.75) < P.level(4, 1));
  assert.ok(near(P.level(0), 0.8), 'zero notes treated as one');
});

check('envelope: quick attack, hold, release fade; envAt follows the schedule', () => {
  const pts = P.sampleEnv(1, 0.9, 0.5);
  assert.strictEqual(pts[0].v, 0);
  assert.ok(pts[1].t - pts[0].t <= 0.01, 'quick attack');
  assert.ok(near(P.envAt(pts, 1), 0));
  assert.ok(near(P.envAt(pts, 1 + P.ATTACK / 2), 0.25));
  assert.ok(near(P.envAt(pts, 1.5), 0.5));
  const rel = pts[3].t - pts[2].t;
  assert.ok(rel >= 0.15 && rel <= 0.3, 'release 0.15-0.3 s');
  const mid = P.envAt(pts, pts[2].t + rel / 2);
  assert.ok(mid < 0.5 && mid > 0.0001);
  assert.ok(near(P.envAt(pts, 99), 0.0001));
  assert.ok(near(P.envAt(pts, 0), 0));
});

check('fadeOut ramps from the current level (never jumps to 0), stops after the fade', () => {
  const calls = [];
  const param = {
    cancelScheduledValues: (t) => calls.push(['cancel', t]),
    linearRampToValueAtTime: (v, t) => calls.push(['lin', v, t]),
    setTargetAtTime: (v, t, tau) => calls.push(['target', v, t, tau]),
    setValueAtTime: (v, t) => calls.push(['set', v, t])
  };
  const pts = P.sampleEnv(0, 2, 0.5);
  const end = P.fadeOut(param, pts, 1, 0.05);
  assert.deepStrictEqual(calls[0], ['cancel', 1]);
  assert.strictEqual(calls[1][0], 'lin'); assert.ok(near(calls[1][1], 0.5)); assert.strictEqual(calls[1][2], 1);
  assert.deepStrictEqual(calls[2], ['target', 0, 1, 0.05]);
  assert.ok(!calls.some((c) => c[0] === 'set' && c[1] === 0), 'no abrupt set to 0');
  assert.ok(near(end, 1.4));
  // with cancelAndHoldAtTime the browser holds the live value
  const c2 = [];
  const p2 = Object.assign({}, param, { cancelAndHoldAtTime: (t) => c2.push(['hold', t]), setTargetAtTime: (v, t, tau) => c2.push(['target', v, t, tau]) });
  P.fadeOut(p2, pts, 1, 0.05);
  assert.deepStrictEqual(c2, [['hold', 1], ['target', 0, 1, 0.05]]);
});

check('decode: promise form and old Safari callback form, errors reject', async () => {
  const buf = { duration: 3.5 };
  const promiseCtx = { decodeAudioData: () => Promise.resolve(buf) };
  const cbCtx = { decodeAudioData: (d, ok) => { setTimeout(() => ok(buf), 0); } };
  const badCtx = { decodeAudioData: (d, ok, ko) => { ko(new Error('x')); return Promise.reject(new Error('x')); } };
  const throwCtx = { decodeAudioData: () => { throw new Error('old'); } };
  return Promise.all([
    P.decode(promiseCtx, {}).then((b) => assert.strictEqual(b, buf)),
    P.decode(cbCtx, {}).then((b) => assert.strictEqual(b, buf)),
    P.decode(badCtx, {}).then(() => assert.fail('should reject'), () => {}),
    P.decode(throwCtx, {}).then(() => assert.fail('should reject'), () => {})
  ]);
});

check('service worker: ha-v8, sampler precached, piano runtime cache survives version bumps', () => {
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  assert.ok(/VERSION = "ha-v8"/.test(sw), 'ha-v8');
  assert.ok(sw.includes('"js/piano-sampler.js"'), 'sampler in app shell');
  assert.ok(/PIANO = "ha-piano-v1"/.test(sw), 'dedicated piano cache');
  assert.ok(/k !== APP && k !== PIANO/.test(sw), 'piano cache kept on activate');
  const re = eval(/PIANO_RE = (\/.*\/);/.exec(sw)[1]);
  for (const n of P.SAMPLES) assert.ok(re.test('/harmony-practice/' + P.url(n)), 'handles ' + n);
  assert.ok(!re.test('/assets/icons/logo.svg') && !re.test('/assets/piano/LICENSE.txt'));
  const core = /PIANO_CORE = \[([^\]]*)\]/.exec(sw)[1].match(/"([^"]+)"/g).map((s) => s.slice(1, -1));
  assert.deepStrictEqual(core, P.PRECACHE, 'sw core list matches the sampler');
  assert.ok(!/FILES = \[[^\]]*assets\/piano/.test(sw), 'samples are not in the blocking app-shell list');
});

check('index.html loads the sampler before the audio engine; credits shown', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const a = html.indexOf('js/piano-sampler.js'), b = html.indexOf('js/game-audio.js');
  assert.ok(a > 0 && a < b);
  assert.ok(html.includes('Salamander Grand Piano V3') && html.includes('creativecommons.org/licenses/by/3.0'));
  const pr = fs.readFileSync(path.join(ROOT, 'privacy.html'), 'utf8');
  assert.ok(pr.includes('Alexander Holm') && pr.includes('CC BY 3.0'));
  const audio = fs.readFileSync(path.join(ROOT, 'js', 'game-audio.js'), 'utf8');
  assert.ok(/latencyHint: 'interactive'/.test(audio));
  for (const ev of ['pointerup', 'click', 'touchend', 'keydown', 'visibilitychange', 'pageshow', 'interrupted'])
    assert.ok(audio.includes(ev), ev);
});

Promise.all(pending).then(() => {
  console.log(`\n${passed} piano checks passed`);
}, (e) => { console.error(e); process.exit(1); });
