/* Harmona kids UI: learning-path home, lesson player (learn, hear, try, quiz), celebration,
   and the kids part of the progress screen. Uses HP.kidsMusic / kidsLessons / kidsCore,
   the shared audio engine (HP.audio) and the drill bridge (window.__hp) for storage + sync. */
(function () {
  'use strict';
  const HP = window.HP || {};
  const M = HP.kidsMusic, D = HP.kidsLessons, K = HP.kidsCore;
  if (!M || !D || !K) return;
  const KU = (window.HPKids = {});
  const LESSONS = D.LESSONS, WORLDS = D.WORLDS;

  const hp = () => window.__hp;
  const st = () => hp().st;
  const audio = () => HP.audio;
  const $ = (id) => document.getElementById(id);
  const reduced = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  function save() {
    hp().persist();
    if (hp().sync && hp().sync.onSave) hp().sync.onSave();
  }

  /* ---------- text ---------- */
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function prettyTok(s) {
    if (s === 'b') return '♭';
    if (s === '#') return '♯';
    return M.pretty(s).replace(/(\S)-|^-/g, (m, a) => (a ? a + '−' : '−'));
  }
  const tok = (s) => `<bdi class="mt" dir="ltr">${esc(prettyTok(s))}</bdi>`;
  /* {X} -> music token, *x* -> bold. Everything else escaped. */
  function rich(s) {
    return String(s).split(/(\{[^}]*\}|\*[^*]+\*)/).map((part) => {
      if (/^\{[^}]*\}$/.test(part)) return tok(part.slice(1, -1));
      if (/^\*[^*]+\*$/.test(part)) return `<b class="term">${esc(part.slice(1, -1))}</b>`;
      return esc(part);
    }).join('');
  }
  const plain = (s) => String(s).replace(/[{}*]/g, '');

  /* ---------- icons (inline SVG, no assets) ---------- */
  const I = {
    star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17l-5.7 3.1 1.2-6.4L2.8 9.3l6.4-.8z"/></svg>',
    lock: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor" stroke="none"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.2v13.6a1 1 0 0 0 1.5.86l11-6.8a1 1 0 0 0 0-1.72l-11-6.8A1 1 0 0 0 8 5.2z"/></svg>',
    stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="6.5" width="11" height="11" rx="2"/></svg>',
    replay: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    flame: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.5 2.5c.6 3.2-1 4.9-2.6 6.6C8.3 10.8 6.5 12.6 6.5 15.6A5.6 5.6 0 0 0 12 21.5a5.6 5.6 0 0 0 5.5-5.7c0-2.6-1.3-4.3-2.3-5.4-.2 1.5-.9 2.6-2 3.1.7-3.6-.1-7.4-.7-11z"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 2L4.5 13.5h6L9.5 22l10-12.5h-6.2z"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    back: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
    sound: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9v6h4l5 5V4L7 9H3z" fill="currentColor"/><path d="M16 9a4 4 0 0 1 0 6"/><path d="M18.5 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
    mute: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M3 9v6h4l5 5V4L7 9H3z" fill="currentColor"/><path d="M16 9l5 5M21 9l-5 5"/></svg>',
    share: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v13"/></svg>',
    dumbbell: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>',
    /* world icons */
    note: '<svg viewBox="0 0 32 32" aria-hidden="true"><ellipse cx="11" cy="23" rx="5.5" ry="4.2" transform="rotate(-18 11 23)"/><rect x="15" y="5" width="3" height="18" rx="1.5"/><path d="M16.5 5c4 1 7 3 8 7-2.5-1.6-5-2.2-8-2.2z"/></svg>',
    stairs: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 26h6v-5h6v-5h6v-5h6v-5h2v22H4z"/></svg>',
    tower: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="6" y="21" width="20" height="6" rx="2"/><rect x="8" y="13.5" width="16" height="6" rx="2"/><rect x="10" y="6" width="12" height="6" rx="2"/></svg>',
    house: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 4L3.5 14.5h3.5V27h7v-7h4v7h7V14.5h3.5z"/></svg>',
    path: '<svg viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-dasharray="1 5"><path d="M5 26c6-1 9-5 8-10s3-9 14-10"/></svg>',
    homeward: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 14h15V8l10 8-10 8v-6H4z"/></svg>',
    starw: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3l3.8 8 8.7 1.1-6.4 6 1.6 8.7L16 22.5l-7.7 4.3 1.6-8.7-6.4-6 8.7-1.1z"/></svg>',
    melody: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="3" y="24" width="26" height="4" rx="2"/><ellipse cx="8" cy="18" rx="3.6" ry="2.8" transform="rotate(-18 8 18)"/><rect x="10.4" y="5" width="2.4" height="13" rx="1.2"/><ellipse cx="21" cy="14" rx="3.6" ry="2.8" transform="rotate(-18 21 14)"/><rect x="23.4" y="3" width="2.4" height="11" rx="1.2"/><path d="M11.6 5l14.2-2v3.4L11.6 8.4z"/></svg>',
    moon: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M19.5 3.5A12.5 12.5 0 1 0 28.5 21 10 10 0 0 1 19.5 3.5z"/><path d="M24 6l.9 2.1 2.1.9-2.1.9L24 12l-.9-2.1-2.1-.9 2.1-.9z"/></svg>',
    wand: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="3" y="20.5" width="20" height="4.4" rx="2.2" transform="rotate(-45 13 22.7)"/><path d="M22 3l1.6 3.8L27.5 8.4l-3.9 1.6L22 13.8l-1.6-3.8L16.5 8.4l3.9-1.6z"/><circle cx="27" cy="17" r="1.8"/><circle cx="14" cy="5" r="1.5"/></svg>',
  };
  const ROLE = {
    T: { he: 'טוניקה', short: 'בית', icon: 'house', degs: 'I III VI' },
    SD: { he: 'סאב־דומיננטה', short: 'טיול', icon: 'path', degs: 'II IV' },
    D: { he: 'דומיננטה', short: 'דרך הביתה', icon: 'homeward', degs: 'V VII' },
  };
  const STEP_NAMES = ['מבינים', 'שומעים', 'מנסים', 'חידון'];
  const PHASES = ['learn', 'hear', 'try', 'quiz'];

  const worldOf = (l) => WORLDS.find((w) => w.id === l.world);
  const stars = (n, max = 3, cls = '') =>
    `<span class="k-stars ${cls}" role="img" aria-label="${n} מתוך ${max} כוכבים">` +
    Array.from({ length: max }, (_, i) => `<i class="${i < n ? 'on' : ''}">${I.star}</i>`).join('') + '</span>';

  /* ---------- toast ---------- */
  let toastEl = null, toastT = null;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'k-toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('show'), 2400);
  }

  /* ---------- keyboard (interactive or figure) ---------- */
  function keyLabel(m, opts) {
    const k = M.keyName(m);
    const named = opts.names && opts.names[m];
    if (!k.white) return named ? `<span class="kk-lab">${esc(prettyTok(named))}</span>` : '';
    if (opts.labels === 'none') return '';
    if (opts.labels === 'solfege') return `<span class="kk-lab"><span class="kk-sol">${k.solfege}</span>${k.letter}</span>`;
    return `<span class="kk-lab">${named ? esc(prettyTok(named)) : k.letter}</span>`;
  }
  function keyboard(opts) {
    const r = (opts.range || 'C4 C5').split(/\s+/);
    const whites = M.whiteRange(r[0], r[1]).map(M.midi);
    const n = whites.length, w = 100 / n;
    const el = document.createElement('div');
    el.className = 'kk' + (opts.fig ? ' kk-fig' : '');
    el.setAttribute('dir', 'ltr');
    const hl = opts.hl || {};
    const tag = opts.fig ? 'span' : 'button';
    let html = '';
    const keyHTML = (m, white, left, width) => {
      const k = M.keyName(m);
      const name = k.white ? `${k.letter} ${k.solfege}` : `${prettyTok(k.names[0])} או ${prettyTok(k.names[1])}`;
      const attrs = opts.fig ? '' : ` type="button" aria-label="${esc(name)}"`;
      return `<${tag} class="kk-k ${white ? 'kk-w' : 'kk-b'} ${hl[m] || ''}" data-m="${m}"${attrs} style="left:${left}%;width:${width}%">${keyLabel(m, opts)}</${tag}>`;
    };
    whites.forEach((m, i) => { html += keyHTML(m, true, i * w, w); });
    whites.forEach((m, i) => {
      if (i < n - 1 && whites[i + 1] - m === 2) html += keyHTML(m + 1, false, (i + 1) * w - w * 0.31, w * 0.62);
    });
    el.innerHTML = html;
    if (opts.fig) {
      el.setAttribute('role', 'img');
      el.setAttribute('aria-label', opts.aria || 'מקלדת');
    } else {
      el.querySelectorAll('.kk-k').forEach((b) => {
        b.addEventListener('click', () => opts.onTap && opts.onTap(+b.dataset.m, b));
      });
    }
    el.key = (m) => el.querySelector(`[data-m="${m}"]`);
    el.flash = (m, cls) => {
      const b = el.key(m); if (!b) return;
      b.classList.remove(cls); void b.offsetWidth; b.classList.add(cls);
      setTimeout(() => b.classList.remove(cls), 650);
    };
    return el;
  }

  /* ---------- figures ---------- */
  function figKeys(f) {
    const ns = M.notes(f.keys);
    let range = f.range;
    if (!range) {
      const lo = Math.min(...ns.map((x) => x.midi)), hi = Math.max(...ns.map((x) => x.midi));
      const o = Math.floor(lo / 12) - 1;
      const top = Math.max(12 * (o + 2), hi);
      const topWhite = M.NAT.includes(top % 12) ? top : top + 1;
      range = 'C' + o + ' ' + (M.LET[M.NAT.indexOf(topWhite % 12)] + (Math.floor(topWhite / 12) - 1));
    }
    const hl = {}, names = {};
    ns.forEach((x) => { hl[x.midi] = 'on'; names[x.midi] = M.bare(x.name); });
    const kb = keyboard({ fig: true, range, hl, names, labels: f.labels || 'letters', aria: 'מקלדת: ' + ns.map((x) => M.pretty(M.bare(x.name))).join(' ') });
    return kb.outerHTML;
  }
  function figTower(sym) {
    const notes = M.chordNotes(sym, 4);
    const q = M.QUALITIES[M.parseChord(sym).q];
    const floors = notes.map((n, i) => {
      const gap = i > 0 ? q[i][1] - q[i - 1][1] : null;
      return { n: M.bare(n), deg: q[i][0], gap };
    }).reverse();
    return `<div class="k-tower" role="img" aria-label="${esc('האקורד ' + M.pretty(sym) + ': ' + notes.map((n) => M.pretty(M.bare(n))).join(' '))}">
      <div class="k-roof">${tok(sym)}</div>
      ${floors.map((f) => `<div class="k-floor"><span class="k-deg">${f.deg}</span><span class="k-fn">${tok(f.n)}</span>${f.gap ? `<span class="k-gap" title="חצאי טונים">+${f.gap}</span>` : '<span class="k-gap root">שורש</span>'}</div>`).join('')}
    </div>`;
  }
  function figStairs(rootName) {
    const sc = M.majorScale(rootName);
    let semi = 0;
    const cols = sc.map((n, i) => {
      if (i > 0) semi += M.MAJOR_STEPS[i - 1];
      const step = i > 0 ? M.MAJOR_STEPS[i - 1] : 0;
      return `<div class="k-stair" style="--h:${semi}"><span class="k-step ${step === 1 ? 'half' : step === 2 ? 'whole' : ''}">${step === 1 ? 'חצי' : step === 2 ? 'טון' : ''}</span><b>${tok(M.bare(n))}</b></div>`;
    });
    return `<div class="k-stairs" dir="ltr" role="img" aria-label="מדרגות הסולם: טון טון חצי טון טון טון חצי">${cols.join('')}</div>`;
  }
  function figChips(f) {
    const dia = f.roman ? M.diatonicSevenths('C') : null;
    const fnHe = { T: 'בית', SD: 'טיול', D: 'דרך הביתה' };
    return `<div class="k-chips" dir="ltr">${f.chips.map((c, i) => {
      const sub = f.subs ? tok(f.subs[i]) : dia ? tok(dia[i].roman) : f.fn ? `<span>${fnHe[f.fn[i]]}</span>` : `<span>${esc(M.FAMILY_HE[M.parseChord(c).q] || '')}</span>`;
      return (i && f.fn ? '<span class="k-arrow" aria-hidden="true">→</span>' : '') + `<span class="k-chip">${tok(c)}<small>${sub}</small></span>`;
    }).join('')}</div>`;
  }
  function figRoles(which) {
    return `<div class="k-roles">${['T', 'SD', 'D'].map((r) => {
      const R = ROLE[r];
      const on = which === true || which === r;
      return `<div class="k-role r-${r.toLowerCase()} ${on ? 'on' : 'dim'}"><span class="k-ricon">${I[R.icon]}</span><b>${R.short}</b><span>${R.he} ${tok(r)}</span><span class="k-rdeg">${tok(R.degs)}</span></div>`;
    }).join('')}</div>`;
  }
  function figBlues(key) {
    const bars = M.blues(key);
    return `<div class="k-blues" dir="ltr" role="img" aria-label="12 תיבות של בלוז">${bars.map((c, i) =>
      `<span class="k-bar" data-bar="${i}"><small>${i + 1}</small>${tok(c)}</span>`).join('')}</div>`;
  }
  function figure(f) {
    if (!f) return '';
    if (f.keys) return `<div class="k-fig">${figKeys(f)}</div>`;
    if (f.tower) return `<div class="k-fig">${figTower(f.tower)}</div>`;
    if (f.stairs) return `<div class="k-fig">${figStairs(f.stairs)}</div>`;
    if (f.chips) return `<div class="k-fig">${figChips(f)}</div>`;
    if (f.roles) return `<div class="k-fig">${figRoles(f.roles)}</div>`;
    if (f.blues) return `<div class="k-fig">${figBlues(f.blues)}</div>`;
    return '';
  }

  /* ---------- sound ---------- */
  let playingBtn = null;
  function stopSound() {
    if (audio() && audio().stop) audio().stop();
    if (playingBtn) { playingBtn.classList.remove('is-playing'); playingBtn.setAttribute('aria-pressed', 'false'); }
    playingBtn = null;
    document.querySelectorAll('.k-bar.now').forEach((b) => b.classList.remove('now'));
  }
  function playSpec(spec, btn, onEvent) {
    const A = audio(); if (!A || !A.playEvents) return;
    if (btn && btn === playingBtn) { stopSound(); return; }
    stopSound();
    if (btn) { btn.classList.add('is-playing'); btn.setAttribute('aria-pressed', 'true'); playingBtn = btn; }
    A.playEvents(M.events(spec), onEvent, () => {
      if (btn && playingBtn === btn) { btn.classList.remove('is-playing'); btn.setAttribute('aria-pressed', 'false'); playingBtn = null; }
      document.querySelectorAll('.k-bar.now').forEach((b) => b.classList.remove('now'));
    });
  }

  /* ---------- top bar (home) ---------- */
  function statsHTML() {
    const C = HP.core, s = st();
    const xp = C.xpLevel(s.points | 0);
    const streak = C.effectiveStreak(s.streak, C.today());
    const tot = K.totals(s, LESSONS);
    return `<div class="k-pills">
      <span class="k-pill p-streak" title="רצף ימים"><i>${I.flame}</i><b>${streak}</b><span>${streak === 1 ? 'יום' : 'ימים'}</span></span>
      <span class="k-pill p-stars" title="כוכבים"><i>${I.star}</i><b>${tot.stars}</b><span>כוכבים</span></span>
      <span class="k-pill p-xp" title="נקודות ניסיון"><i>${I.bolt}</i><b>${xp.level}</b><span>רמה</span></span>
    </div>`;
  }
  function topHTML() {
    const mute = !!st().mute;
    return `<span class="k-brand">
        <span class="k-logo" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M4 16V8l4 3 4-5 4 4 4-2v8H4z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="19" r="1.6" fill="currentColor"/></svg></span>
        <span class="k-brand-t"><b>הַרְמוֹנָה</b><span>לומדים ג׳אז</span></span>
      </span>
      <div class="k-actions">
        <button type="button" class="k-icon-btn k-share" aria-label="שתפו קישור להרמונה">${I.share}</button>
        <button type="button" class="k-icon-btn k-mute${mute ? ' on' : ''}" aria-pressed="${mute}" aria-label="${mute ? 'הפעלת צלילי משוב' : 'השתקת צלילי משוב'}">${mute ? I.mute : I.sound}</button>
      </div>`;
  }
  function bindTop(host) {
    const m = host.querySelector('.k-mute');
    if (m) m.onclick = () => {
      st().mute = !st().mute;
      if (audio()) audio().setMute(st().mute);
      save();
      KU.renderHome();
    };
    const sh = host.querySelector('.k-share');
    if (sh) sh.onclick = () => { const b = document.querySelector('#screen-drills [data-share-app]'); if (b) b.click(); };
  }

  /* ---------- home: the learning path ---------- */
  KU.renderHome = function () {
    const host = $('kidsHome'); if (!host) return;
    const s = st(), C = HP.core;
    const nextI = K.nextIndex(s, LESSONS);
    const tot = K.totals(s, LESSONS);
    const xp = C.xpLevel(s.points | 0);
    const hour = new Date().getHours();
    const hello = hour < 12 ? 'בוקר טוב!' : hour < 18 ? 'צהריים טובים!' : 'ערב טוב!';
    const next = nextI == null ? null : LESSONS[nextI];
    const nw = next ? worldOf(next) : WORLDS[WORLDS.length - 1];
    let hero;
    if (next) {
      const fresh = tot.done === 0;
      hero = `<div class="k-hero w-${nw.color}">
        <div class="k-hero-art" aria-hidden="true">${I[nw.icon]}</div>
        <div class="k-hero-copy">
          <p class="k-hello">${hello}</p>
          <h1 class="k-h1">${fresh ? 'מוכנים ללמוד ג׳אז?' : 'ממשיכים מאיפה שעצרנו'}</h1>
          <p class="k-next">שיעור ${next.n}: ${esc(next.title)}</p>
        </div>
        <button type="button" class="k-btn k-btn-xl" data-open="${nextI}">${fresh ? 'בואו נתחיל' : 'להמשיך'}<i>${I.arrow}</i></button>
      </div>`;
    } else {
      hero = `<div class="k-hero w-${nw.color}">
        <div class="k-hero-art" aria-hidden="true">${I.starw}</div>
        <div class="k-hero-copy">
          <p class="k-hello">${hello}</p>
          <h1 class="k-h1">סיימתם את כל המסלול!</h1>
          <p class="k-next">אפשר לחזור לכל שיעור ולאסוף עוד כוכבים.</p>
        </div>
      </div>`;
    }
    const lvl = `<div class="k-level" aria-label="רמה ${xp.level}, ${xp.xp} מתוך ${xp.to} נקודות">
        <span>רמה ${xp.level}</span><span class="k-meter"><i style="width:${Math.round(100 * xp.xp / xp.to)}%"></i></span><span dir="ltr">${xp.xp}/${xp.to} XP</span>
      </div>`;
    const worlds = K.worldSummary(s, WORLDS, LESSONS).map((ws) => {
      const w = ws.world;
      const items = ws.lessons.map((l) => {
        const idx = l.n - 1;
        const open = K.unlocked(s, LESSONS, idx);
        const done = K.done(s, l.id);
        const isNext = idx === nextI;
        const state = done ? 'done' : isNext ? 'next' : open ? 'open' : 'locked';
        const badge = done ? I.check : open ? String(l.n) : I.lock;
        const aria = `שיעור ${l.n}: ${l.title}. ` + (done ? `הושלם, ${K.stars(s, l.id)} כוכבים` : isNext ? 'השיעור הבא' : open ? 'פתוח' : 'נעול');
        return `<li class="k-node is-${state}">
          <button type="button" class="k-node-btn" data-open="${idx}" ${open ? '' : 'aria-disabled="true"'} aria-label="${esc(aria)}">
            <span class="k-badge">${badge}</span>
            <span class="k-node-t"><b>${esc(l.title)}</b>${done ? stars(K.stars(s, l.id)) : isNext ? '<span class="k-tag">הבא בתור</span>' : open || idx !== nextI + 1 ? '' : '<span class="k-sub">נפתח אחרי השיעור הקודם</span>'}</span>
            ${open ? `<span class="k-go">${I.arrow}</span>` : ''}
          </button>
        </li>`;
      }).join('');
      return `<section class="k-world w-${w.color}" aria-labelledby="kw${w.id}">
        <header class="k-wh">
          <span class="k-wicon" aria-hidden="true">${I[w.icon]}</span>
          <div class="k-wt"><h2 id="kw${w.id}"><span class="k-wn">עולם ${w.id}</span>${esc(w.title)}</h2><p>${esc(w.sub)}</p></div>
          <span class="k-wcount" aria-label="${ws.done} מתוך ${ws.lessons.length} שיעורים">${ws.done}/${ws.lessons.length}</span>
        </header>
        <ol class="k-track">${items}</ol>
      </section>`;
    }).join('');
    host.innerHTML = `<div class="k-top">${topHTML()}</div>${statsHTML()}${hero}${lvl}<div class="k-path">${worlds}</div>`;
    bindTop(host.querySelector('.k-top'));
    host.querySelectorAll('[data-open]').forEach((b) => {
      b.onclick = () => {
        const idx = +b.dataset.open;
        if (!K.unlocked(st(), LESSONS, idx)) { toast('השיעור ייפתח אחרי שתסיימו את השיעור הקודם'); return; }
        if (audio()) audio().unlock();
        KU.open(idx);
      };
    });
  };

  KU.refresh = function () {
    const shown = (id) => { const el = $(id); return el && !el.hidden; };
    if (shown('screen-home')) KU.renderHome();
    if (shown('screen-progress')) KU.renderProgress();
  };

  /* ---------- progress screen part ---------- */
  KU.renderProgress = function () {
    const host = $('progKids'); if (!host) return;
    const s = st();
    const tot = K.totals(s, LESSONS);
    const rows = K.worldSummary(s, WORLDS, LESSONS).map((ws) =>
      `<div class="k-prow w-${ws.world.color}">
        <span class="k-wicon sm" aria-hidden="true">${I[ws.world.icon]}</span>
        <span class="k-prow-t"><b>${esc(ws.world.title)}</b><span class="k-meter"><i style="width:${Math.round(100 * ws.done / ws.lessons.length)}%"></i></span></span>
        <span class="k-prow-n"><span dir="ltr">${ws.done}/${ws.lessons.length}</span><span class="k-mini-star">${I.star}<span dir="ltr">${ws.stars}</span></span></span>
      </div>`).join('');
    host.innerHTML = `<div class="k-psum">
        <div><b dir="ltr">${tot.done}/${tot.count}</b><span>שיעורים</span></div>
        <div><b dir="ltr">${tot.stars}/${tot.maxStars}</b><span>כוכבים</span></div>
        <div><b dir="ltr">${(s.streak && s.streak.best) | 0}</b><span>שיא רצף</span></div>
      </div>${rows}`;
  };

  /* ---------- lesson player ---------- */
  let L = null; /* { idx, lesson, phase, i, quiz:{...}, try:{...}, result } */

  KU.open = function (idx) {
    const lesson = LESSONS[idx];
    L = { idx, lesson, phase: 'learn', i: 0, q: null, result: null, quizPts: 0, firstOk: 0 };
    if (window.HPGame && HPGame.route) HPGame.route('lesson'); else showLessonScreen();
    renderLesson();
  };
  function showLessonScreen() {
    ['home', 'drills', 'practice', 'progress', 'summary', 'lesson'].forEach((id) => { const el = $('screen-' + id); if (el) el.hidden = id !== 'lesson'; });
  }
  KU.onRoute = function (name) {
    document.body.classList.toggle('in-lesson', name === 'lesson');
    if (name !== 'lesson') { stopSound(); if (name === 'home') KU.renderHome(); }
    if (name === 'lesson' && !L) { setTimeout(() => HPGame.route('home'), 0); }
  };
  function exitLesson() {
    stopSound();
    L = null;
    if (window.HPGame) HPGame.route('home');
  }

  function stepsBar() {
    const p = PHASES.indexOf(L.phase);
    const len = L.phase === 'learn' ? L.lesson.learn.length : L.phase === 'try' ? L.lesson.try.length : L.phase === 'quiz' ? L.lesson.quiz.length : 1;
    return STEP_NAMES.map((n, i) => {
      const fill = L.phase === 'done' || i < p ? 100 : i === p ? Math.round(100 * (L.i + 1) / len) : 0;
      return `<span class="k-seg ${i === p ? 'cur' : ''} ${fill === 100 ? 'full' : ''}"><span class="k-seg-bar"><i style="width:${fill}%"></i></span><span class="k-seg-l">${n}</span></span>`;
    }).join('');
  }

  function renderLesson() {
    const scr = $('screen-lesson'); if (!scr || !L) return;
    const w = worldOf(L.lesson);
    scr.className = `screen k-lesson w-${w.color}`;
    scr.querySelector('.k-lbar').innerHTML =
      `<button type="button" class="k-icon-btn k-close" aria-label="יציאה מהשיעור">${I.close}</button>
       <div class="k-steps" role="progressbar" aria-label="התקדמות בשיעור" aria-valuemin="0" aria-valuemax="4" aria-valuenow="${Math.min(4, PHASES.indexOf(L.phase) + (L.phase === 'done' ? 5 : 0))}">${stepsBar()}</div>`;
    scr.querySelector('.k-close').onclick = exitLesson;
    const stage = $('kStage');
    stopSound();
    const head = `<p class="k-ltitle">שיעור ${L.lesson.n} · ${esc(L.lesson.title)}</p>`;
    if (L.phase === 'learn') stage.innerHTML = head + learnHTML();
    if (L.phase === 'hear') stage.innerHTML = head + hearHTML();
    if (L.phase === 'try') { stage.innerHTML = head + tryHTML(); }
    if (L.phase === 'quiz') stage.innerHTML = head + quizHTML();
    if (L.phase === 'done') stage.innerHTML = doneHTML();
    bindStage(stage);
    const h = stage.querySelector('[data-focus]');
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    if (h) h.focus({ preventScroll: true });
  }

  function go(phase, i) { L.phase = phase; L.i = i || 0; L.q = null; renderLesson(); }
  function nextStep() {
    const ls = L.lesson;
    if (L.phase === 'learn') { if (L.i < ls.learn.length - 1) go('learn', L.i + 1); else go('hear'); }
    else if (L.phase === 'hear') go('try');
    else if (L.phase === 'try') { if (L.i < ls.try.length - 1) go('try', L.i + 1); else go('quiz'); }
    else if (L.phase === 'quiz') { if (L.i < ls.quiz.length - 1) go('quiz', L.i + 1); else finish(); }
  }
  function prevStep() {
    if (L.phase === 'learn' && L.i > 0) go('learn', L.i - 1);
    else if (L.phase === 'hear') go('learn', L.lesson.learn.length - 1);
    else if (L.phase === 'try') { if (L.i > 0) go('try', L.i - 1); else go('hear'); }
  }
  const foot = (main, opts = {}) =>
    `<div class="k-foot">${opts.back ? `<button type="button" class="k-btn k-ghost" data-act="back"><i>${I.back}</i>הקודם</button>` : ''}${main}</div>`;
  const nextBtn = (label = 'הבא', extra = '') => `<button type="button" class="k-btn k-main" data-act="next" ${extra}>${label}<i>${I.arrow}</i></button>`;

  /* learn */
  function learnHTML() {
    const scr = L.lesson.learn[L.i];
    return `<div class="k-card k-learn">
        <span class="k-chip-step">מבינים <span dir="ltr">${L.i + 1}/${L.lesson.learn.length}</span></span>
        <p class="k-say" tabindex="-1" data-focus>${rich(scr.t)}</p>
        ${figure(scr.fig)}
      </div>` + foot(nextBtn(L.i === L.lesson.learn.length - 1 ? 'לשמוע' : 'הבא'), { back: L.i > 0 });
  }

  /* hear */
  function hearHTML() {
    const items = L.lesson.hear;
    const hero = items[0];
    const rest = items.slice(1);
    return `<div class="k-card k-hear">
        <span class="k-chip-step">שומעים</span>
        <h2 class="k-say" tabindex="-1" data-focus>לחצו ותקשיבו.</h2>
        <div class="k-hero-play">
          <button type="button" class="k-play-xl" data-snd="0" aria-pressed="false" aria-label="${esc('לנגן: ' + plain(hero.label))}"><span class="k-pi">${I.play}</span><span class="k-ps">${I.stop}</span></button>
          <p class="k-play-label">${rich(hero.label)}</p>
        </div>
        ${hero.grid ? figBlues(hero.grid) : ''}
        ${rest.length ? `<div class="k-sounds">${rest.map((h, i) =>
          `<button type="button" class="k-sound" data-snd="${i + 1}" aria-pressed="false" aria-label="${esc('לנגן: ' + plain(h.label))}"><span class="k-play-sm"><span class="k-pi">${I.play}</span><span class="k-ps">${I.stop}</span></span><span class="k-sound-t">${rich(h.label)}</span></button>`).join('')}</div>` : ''}
      </div>` + foot(nextBtn('לנסות בעצמי'), { back: true });
  }

  /* try */
  function tryTask() { return L.lesson.try[L.i]; }
  function tryHTML() {
    const t = tryTask();
    const need = t.mode === 'set' ? M.notes(t.target).length : 0;
    return `<div class="k-card k-try">
        <span class="k-chip-step">מנסים <span dir="ltr">${L.i + 1}/${L.lesson.try.length}</span></span>
        <p class="k-say" tabindex="-1" data-focus>${rich(t.p)}</p>
        ${need > 1 ? `<div class="k-dots" aria-hidden="true">${Array.from({ length: need }, () => '<i></i>').join('')}</div>` : ''}
        ${t.mode === 'seq' ? `<div class="k-dots" aria-hidden="true">${M.notes(t.target).map(() => '<i></i>').join('')}</div>` : ''}
        <div class="k-kb-host"></div>
        <p class="k-fb" role="status" aria-live="polite"></p>
      </div>` + foot(`<button type="button" class="k-btn k-ghost k-skip" data-act="next">דלגו</button>` + nextBtn('הבא', 'hidden'), { back: true });
  }
  function mountTry(stage) {
    const t = tryTask();
    const targets = M.notes(t.target);
    const byMidi = t.match === 'midi';
    const keyOf = (m) => byMidi ? m : ((m % 12) + 12) % 12;
    const want = targets.map((x) => (byMidi ? x.midi : x.pc));
    const found = new Set();
    let pos = 0, finished = false;
    const fb = stage.querySelector('.k-fb');
    const dots = stage.querySelectorAll('.k-dots i');
    const hl = {};
    if (t.mark) M.notes(t.mark).forEach((x) => { hl[x.midi] = 'given'; });
    const names = {};
    if (t.mark) M.notes(t.mark).forEach((x) => { names[x.midi] = M.bare(x.name); });
    const kb = keyboard({
      range: t.range || 'C4 C5', labels: t.labels || 'letters', hl, names,
      onTap(m, el) {
        if (audio()) audio().note(m);
        if (finished) return;
        const k = keyOf(m);
        const nameOf = (mm) => { const kn = M.keyName(mm); return kn.white ? kn.letter : kn.names.join(' / '); };
        const spelled = () => {
          const hit = targets.find((x) => (byMidi ? x.midi : x.pc) === k);
          return hit ? M.bare(hit.name) : nameOf(m);
        };
        if (t.mode === 'seq') {
          if (k === want[pos]) {
            el.classList.add('ok'); if (dots[pos]) dots[pos].classList.add('on');
            pos++;
            fb.className = 'k-fb good'; fb.innerHTML = rich(`{${spelled()}}`);
            if (pos === want.length) complete();
          } else {
            kb.flash(m, 'oops');
            fb.className = 'k-fb oops'; fb.innerHTML = 'כמעט! זה לא הצליל הבא. נסו קליד אחר.';
          }
          return;
        }
        if (want.includes(k)) {
          if (!found.has(k)) {
            found.add(k);
            kb.querySelectorAll('.kk-k').forEach((b) => { if (keyOf(+b.dataset.m) === k && (!byMidi || +b.dataset.m === m)) b.classList.add('ok'); });
            if (!byMidi) el.classList.add('ok');
            if (dots[found.size - 1]) dots[found.size - 1].classList.add('on');
          }
          fb.className = 'k-fb good';
          fb.innerHTML = rich(`יופי! זה {${spelled()}}.`) + (t.mode === 'set' && found.size < want.length ? ` עוד ${want.length - found.size}.` : '');
          if (found.size === want.length) complete();
        } else {
          kb.flash(m, 'oops');
          fb.className = 'k-fb oops';
          fb.innerHTML = rich(`כמעט! זה {${nameOf(m)}}. נסו קליד אחר.`);
        }
      },
    });
    function complete() {
      finished = true;
      kb.classList.add('kk-done');
      const end = () => {
        if (t.end === 'prog' && t.prog) playSpec({ prog: t.prog });
        else if (t.end === 'together') playSpec({ n: targets.map((x) => x.name).join(' '), how: 'together' });
      };
      setTimeout(end, 380);
      const praise = t.chord ? `מעולה! בניתם {${t.chord}}.` : t.mode === 'seq' ? 'מעולה! ניגנתם את כל הצלילים.' : 'מעולה!';
      fb.className = 'k-fb good big';
      fb.innerHTML = rich(praise);
      const nb = stage.querySelector('[data-act="next"]:not(.k-skip)');
      const sk = stage.querySelector('.k-skip');
      if (sk) sk.hidden = true;
      if (nb) { nb.hidden = false; nb.focus({ preventScroll: true }); }
    }
    stage.querySelector('.k-kb-host').appendChild(kb);
  }

  /* quiz */
  function quizState() {
    if (L.q && L.q.i === L.i) return L.q;
    const q = L.lesson.quiz[L.i];
    const order = K.shuffleOrder(q.opts.length, Math.random);
    L.q = { i: L.i, order, tries: 0, done: false, wrong: [] };
    return L.q;
  }
  function quizHTML() {
    const q = L.lesson.quiz[L.i];
    const qs = quizState();
    const long = q.opts.some((o) => plain(o).length > 14);
    return `<div class="k-card k-quiz">
        <span class="k-chip-step">חידון <span dir="ltr">${L.i + 1}/${L.lesson.quiz.length}</span></span>
        <h2 class="k-say" tabindex="-1" data-focus>${rich(q.q)}</h2>
        ${q.play ? `<button type="button" class="k-replay" data-act="replay" aria-pressed="false"><span class="k-pi">${I.play}</span><span class="k-ps">${I.stop}</span><span>שמעו שוב</span></button>` : ''}
        <div class="k-opts n${q.opts.length} ${long ? 'one' : ''}" role="group" aria-label="תשובות">${qs.order.map((oi) =>
          `<button type="button" class="k-opt" data-o="${oi}">${rich(q.opts[oi])}</button>`).join('')}</div>
        <div class="k-qfb" role="status" aria-live="polite"></div>
      </div>` + foot(nextBtn(L.i === L.lesson.quiz.length - 1 ? 'לסיום' : 'הבא', 'hidden'));
  }
  function bindQuiz(stage) {
    const q = L.lesson.quiz[L.i];
    const qs = quizState();
    const fb = stage.querySelector('.k-qfb');
    const nb = stage.querySelector('[data-act="next"]');
    const rp = stage.querySelector('[data-act="replay"]');
    if (rp) {
      rp.onclick = () => playSpec(q.play, rp);
      setTimeout(() => { if (L && L.phase === 'quiz' && L.q === qs && !qs.done) playSpec(q.play, rp); }, 350);
    }
    stage.querySelectorAll('.k-opt').forEach((b) => {
      b.onclick = () => {
        if (qs.done) return;
        const oi = +b.dataset.o;
        const ok = oi === q.a;
        const A = audio();
        if (A) { A.setMute(!!st().mute); A.unlock(); }
        if (ok) {
          qs.done = true;
          b.classList.add('ok');
          let msg = 'נכון!';
          if (qs.tries === 0) {
            const r = K.recordAnswer(st(), true);
            L.firstOk++; L.quizPts += r.pts;
            msg = `נכון! <span class="k-xp" dir="ltr">+${r.pts} XP</span>`;
            save();
          } else msg = 'נכון! כל הכבוד שניסיתם שוב.';
          if (A) A.ding();
          fb.className = 'k-qfb good'; fb.innerHTML = msg;
          lockOpts();
        } else {
          qs.tries++;
          qs.wrong.push(oi);
          b.classList.add('bad'); b.disabled = true;
          if (A) A.wrong();
          if (qs.tries === 1) {
            K.recordAnswer(st(), false); save();
            fb.className = 'k-qfb oops';
            fb.textContent = q.play ? 'כמעט! תקשיבו שוב ונסו עוד פעם.' : 'כמעט! נסו עוד פעם.';
            return;
          }
          qs.done = true;
          const right = stage.querySelector(`.k-opt[data-o="${q.a}"]`);
          if (right) right.classList.add('ok', 'reveal');
          fb.className = 'k-qfb oops';
          fb.innerHTML = 'לא נורא! התשובה היא: ' + rich(q.opts[q.a]) + (q.why ? '. ' + rich(q.why) : '.');
          lockOpts();
        }
      };
    });
    function lockOpts() {
      stage.querySelectorAll('.k-opt').forEach((x) => { x.disabled = true; });
      if (nb) { nb.hidden = false; nb.focus({ preventScroll: true }); }
    }
  }

  /* done */
  function finish() {
    const total = L.lesson.quiz.length;
    const res = K.finishLesson(st(), LESSONS, L.lesson.id, L.firstOk, total, L.quizPts);
    const sync = hp().sync;
    if (sync && sync.onAdd) sync.onAdd(res.delta.id, res.delta.r, res.delta.t);
    save();
    L.result = res;
    L.phase = 'done'; L.i = 0;
    renderLesson();
    const A = audio();
    if (A) { A.setMute(!!st().mute); A.levelUp(); }
    confetti(worldOf(L.lesson).color);
  }
  function doneHTML() {
    const r = L.result;
    const titles = { 3: 'מושלם!', 2: 'כל הכבוד!', 1: 'סיימתם את השיעור!' };
    const sub = { 3: 'ענית נכון על הכול כבר בפעם הראשונה.', 2: 'עוד קצת תרגול, ותגיעו לשלושה כוכבים.', 1: 'כל פעם שמתרגלים, האוזן מתחזקת.' };
    const next = L.idx + 1 < LESSONS.length ? LESSONS[L.idx + 1] : null;
    const total = L.quizPts + r.bonus;
    return `<div class="k-card k-done">
        <div class="k-burst" aria-hidden="true">${[0, 1, 2].map((i) => `<i class="${i < r.stars ? 'on' : ''}" style="--d:${i * 0.18}s">${I.star}</i>`).join('')}</div>
        <h1 class="k-h1" tabindex="-1" data-focus>${titles[r.stars]}</h1>
        <p class="k-sr">${r.stars} מתוך 3 כוכבים</p>
        <p class="k-done-sub">${esc(sub[r.stars])}</p>
        <div class="k-done-stats">
          <span class="k-pill p-xp"><i>${I.bolt}</i><b dir="ltr">+${total}</b><span>XP</span></span>
          <span class="k-pill p-stars"><i>${I.star}</i><b dir="ltr">${L.firstOk}/${L.lesson.quiz.length}</b><span>בפעם הראשונה</span></span>
          ${r.streak ? `<span class="k-pill p-streak"><i>${I.flame}</i><b>${r.streak}</b><span>${r.streak === 1 ? 'יום ברצף' : 'ימים ברצף'}</span></span>` : ''}
        </div>
        ${r.unlockedNext && next ? `<p class="k-unlock"><span>נפתח שיעור חדש:</span> <b>${esc(next.title)}</b></p>` : ''}
      </div>
      <div class="k-foot k-foot-col">
        ${next ? `<button type="button" class="k-btn k-main" data-act="nextlesson">לשיעור הבא<i>${I.arrow}</i></button>` : ''}
        <button type="button" class="k-btn ${next ? 'k-ghost' : 'k-main'}" data-act="home">למסלול</button>
        <button type="button" class="k-btn k-ghost" data-act="again">עוד פעם</button>
      </div>`;
  }

  function confetti(color) {
    if (reduced()) return;
    const layer = document.createElement('div');
    layer.className = 'k-confetti'; layer.setAttribute('aria-hidden', 'true');
    const cols = ['var(--w-fill)', '#FFC53D', '#22C55E', '#3B82F6', '#EC4899'];
    for (let i = 0; i < 26; i++) {
      const d = document.createElement('i');
      d.style.left = (Math.random() * 100) + '%';
      d.style.background = cols[i % cols.length];
      d.style.animationDelay = (Math.random() * 0.5) + 's';
      d.style.setProperty('--r', (Math.random() * 540 - 270) + 'deg');
      if (i % 3 === 0) d.style.borderRadius = '50%';
      layer.appendChild(d);
    }
    const scr = $('screen-lesson');
    (scr || document.body).appendChild(layer);
    setTimeout(() => layer.remove(), 2200);
  }

  function bindStage(stage) {
    stage.querySelectorAll('[data-act="next"]').forEach((b) => { b.onclick = nextStep; });
    stage.querySelectorAll('[data-act="back"]').forEach((b) => { b.onclick = prevStep; });
    if (L.phase === 'hear') {
      stage.querySelectorAll('[data-snd]').forEach((b) => {
        b.onclick = () => {
          const h = L.lesson.hear[+b.dataset.snd];
          const bars = stage.querySelectorAll('.k-bar');
          playSpec(h.play, b, h.grid ? (i) => { bars.forEach((x) => x.classList.toggle('now', +x.dataset.bar === i)); } : null);
        };
      });
    }
    if (L.phase === 'try') mountTry(stage);
    if (L.phase === 'quiz') bindQuiz(stage);
    if (L.phase === 'done') {
      const nl = stage.querySelector('[data-act="nextlesson"]');
      if (nl) nl.onclick = () => KU.open(L.idx + 1);
      stage.querySelector('[data-act="home"]').onclick = exitLesson;
      stage.querySelector('[data-act="again"]').onclick = () => KU.open(L.idx);
    }
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && L && document.body.classList.contains('in-lesson')) exitLesson();
  });

  KU._test = { rich, prettyTok };
})();
