/* Harmona shell: routes, HUD, progress, summary, sounds, celebrations. */
(function () {
  'use strict';
  const G = (window.HPGame = {});
  const TOPIC_HE = { intervals: 'מרווחים', modes: 'מודוסים', chroma: 'דרגות כרומטיות' };
  const TOPIC_DESC = {
    intervals: 'ספירה, שמות ובנייה לפי הספר',
    modes: 'בנייה, זיהוי וסולם האב',
    chroma: 'דרגות מוגבהות ומנומכות',
  };

  function core() { return window.HP && HP.core; }
  function audio() { return window.HP && HP.audio; }
  function hp() { return window.__hp || window.HPDrill; }
  function st() { return hp().st; }
  function $(id) { return document.getElementById(id); }
  function save() { hp().persist(); if (hp().sync && hp().sync.onSave) hp().sync.onSave(); }

  let routeName = 'home';
  let lastLevel = 1;

  G.route = function (name) {
    routeName = name;
    ['home', 'practice', 'progress', 'summary'].forEach(function (id) {
      const el = $('screen-' + id);
      if (el) el.hidden = id !== name;
    });
    document.querySelectorAll('.nav-i').forEach(function (b) {
      b.classList.toggle('on', b.dataset.route === name || (name === 'summary' && b.dataset.route === 'practice'));
    });
    if (name === 'practice') {
      if (hp() && hp().renderAll) hp().renderAll();
      G.refreshHud();
    }
    if (name === 'home') G.renderHome();
    if (name === 'progress') G.renderProgress();
    try { history.replaceState(null, '', '#' + (name === 'summary' ? 'practice' : name)); } catch (e) {}
  };

  function hudHTML() {
    const C = core(); if (!C) return '';
    const s = st();
    const xp = C.xpLevel(s.points | 0);
    const streak = C.effectiveStreak(s.streak, C.today());
    const mute = !!s.mute;
    return (
      '<span class="hud-chip">רמה <b>' + xp.level + '</b></span>' +
      '<span class="hud-chip"><b dir="ltr">' + xp.xp + '/' + xp.to + '</b> XP</span>' +
      '<span class="hud-chip">🔥 <b>' + streak + '</b></span>' +
      '<span class="hud-chip"><b>' + (s.points | 0) + '</b> נק׳</span>' +
      '<button type="button" class="mute-btn' + (mute ? ' on' : '') + '" id="muteBtn" aria-label="' + (mute ? 'הפעל צלילים' : 'השתק') + '" title="צלילים">' +
        (mute
          ? '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9v6h4l5 5V4L7 9H3z"/><path d="M16 9l5 5M21 9l-5 5"/></svg>'
          : '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9v6h4l5 5V4L7 9H3z"/><path d="M16 9a4 4 0 010 6"/><path d="M18.5 7a7 7 0 010 10"/></svg>') +
      '</button>'
    );
  }

  function bindMute(root) {
    const b = (root || document).querySelector('#muteBtn');
    if (!b) return;
    b.onclick = function () {
      st().mute = !st().mute;
      if (audio()) audio().setMute(st().mute);
      save();
      G.refreshHud();
      if (routeName === 'home') G.renderHome();
      if (routeName === 'progress') G.renderProgress();
    };
  }

  G.refreshHud = function () {
    const host = $('practiceHud');
    if (host) { host.innerHTML = hudHTML(); bindMute(host); }
    const combo = $('comboBar');
    if (combo) {
      const run = st().run | 0;
      const hot = run >= 5;
      combo.className = 'combo' + (hot ? ' hot' : '') + (run ? ' bump' : '');
      combo.innerHTML = '<span>רצף</span><b>' + run + '</b><span class="bar"><i style="width:' + Math.min(100, run * 12) + '%"></i></span>';
      combo.hidden = false;
    }
  };

  G.renderHome = function () {
    const C = core(); if (!C) return;
    const s = st();
    $('homeHud').innerHTML = hudHTML();
    bindMute($('homeHud'));
    const hour = new Date().getHours();
    $('homeTitle').textContent = hour < 12 ? 'בוקר טוב' : hour < 18 ? 'צהריים טובים' : 'ערב טוב';
    const day = C.dailyProgress(s);
    $('homeGoalLabel').textContent = day.answered + '/' + day.goal;
    $('homeGoalFill').style.width = Math.min(100, Math.round(100 * day.answered / day.goal)) + '%';
    $('homeGoalMeta').textContent = day.done
      ? 'המטרה הושלמה להיום. אפשר להמשיך לתרגל חופשי.'
      : 'עוד ' + Math.max(0, day.goal - day.answered) + ' שאלות למטרה היומית · רצף ' + C.effectiveStreak(s.streak, C.today()) + ' ימים';
    const topics = $('homeTopics');
    topics.innerHTML = Object.keys(TOPIC_HE).map(function (k) {
      const ids = (hp().EX && hp().EX[k]) ? hp().EX[k].types.map(function (t) { return t.id; }) : [];
      const acc = C.topicAccuracy(s.stats, ids);
      const pct = acc.pct == null ? '—' : acc.pct + '%';
      return '<button type="button" class="topic-card" data-topic="' + k + '"><b>' + TOPIC_HE[k] + '</b><span>' + TOPIC_DESC[k] + '</span><span class="pct">דיוק ' + pct + (acc.t ? ' · ' + acc.t + ' שאלות' : '') + '</span></button>';
    }).join('');
    topics.querySelectorAll('.topic-card').forEach(function (b) {
      b.onclick = function () {
        hp().setTopic(b.dataset.topic);
        G.route('practice');
      };
    });
    // weak tip
    let weak = null, worst = 1;
    Object.keys(s.stats || {}).forEach(function (id) {
      const x = s.stats[id];
      if (x && x.t >= 5) {
        const a = x.r / x.t;
        if (a < worst) { worst = a; weak = id; }
      }
    });
    const box = $('homeWeak');
    if (weak && worst < 0.85) {
      let title = weak;
      Object.values(hp().EX || {}).forEach(function (t) {
        t.types.forEach(function (x) { if (x.id === weak) title = x.title; });
      });
      box.hidden = false;
      $('homeWeakText').textContent = title + ' · ' + Math.round(100 * worst) + '% הצלחה';
    } else box.hidden = true;
  };

  G.renderProgress = function () {
    const C = core(); if (!C) return;
    const s = st();
    const xp = C.xpLevel(s.points | 0);
    $('progHud').innerHTML = hudHTML();
    bindMute($('progHud'));
    const played = Object.keys(s.days || {}).filter(function (k) { return (s.days[k].answered | 0) > 0; }).length;
    $('progMeta').textContent = played + ' ימי אימון · שיא רצף ' + (s.streak.best | 0) + ' · רמה ' + xp.level;
    const day = C.dailyProgress(s);
    $('progGoalLabel').textContent = day.answered + '/' + day.goal;
    $('progGoalFill').style.width = Math.min(100, Math.round(100 * day.answered / day.goal)) + '%';
    $('progGoalMeta').textContent = 'היום: ' + day.correct + ' נכונות מתוך ' + day.answered + ' · ' + (day.points | 0) + ' נקודות';

    $('progTopics').innerHTML = Object.keys(TOPIC_HE).map(function (k) {
      const ids = (hp().EX && hp().EX[k]) ? hp().EX[k].types.map(function (t) { return t.id; }) : [];
      const acc = C.topicAccuracy(s.stats, ids);
      return '<div class="row-item"><span><b>' + TOPIC_HE[k] + '</b><br><span class="muted small">' + (acc.t ? acc.r + '/' + acc.t : 'עוד לא תרגלת') + '</span></span><span class="pct">' + (acc.pct == null ? '—' : acc.pct + '%') + '</span></div>';
    }).join('');

    // 14-day chart
    const host = $('accChart');
    const today = C.today();
    const pts = [];
    for (let i = 13; i >= 0; i--) {
      const dt = new Date(); dt.setDate(dt.getDate() - i);
      const k = C.today(dt);
      const d = s.days[k];
      pts.push({ k: k, acc: d && d.answered ? d.correct / d.answered : null, n: d ? d.answered : 0 });
    }
    if (!pts.some(function (p) { return p.acc != null; })) {
      host.innerHTML = '<div class="hint">אחרי התרגול הראשון יופיע כאן גרף</div>';
    } else {
      const W = 640, H = 180, L = 36, R = 16, Tp = 12, B = 28, iw = W - L - R, ih = H - Tp - B;
      const x = function (i) { return L + i * iw / 13; };
      const y = function (a) { return Tp + (1 - a) * ih; };
      let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="גרף דיוק יומי">';
      [0, 0.5, 0.85, 1].forEach(function (a) {
        svg += '<line class="gl' + (a === 0.85 ? ' th' : '') + '" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(a) + '" y2="' + y(a) + '"/>';
        svg += '<text class="ax" x="4" y="' + (y(a) + 3) + '">' + Math.round(a * 100) + '</text>';
      });
      let path = '';
      pts.forEach(function (p, i) {
        if (p.acc == null) return;
        path += (path ? 'L' : 'M') + x(i) + ' ' + y(p.acc);
      });
      if (path) svg += '<path class="ln" d="' + path + '"/>';
      pts.forEach(function (p, i) {
        if (p.acc == null) return;
        svg += '<circle class="pt" cx="' + x(i) + '" cy="' + y(p.acc) + '" r="3.5"/>';
      });
      svg += '</svg>';
      host.innerHTML = svg;
    }

    const log = (s.log || []).slice(-8).reverse();
    $('hist').innerHTML = log.length
      ? log.map(function (e) {
          const d = new Date(e.ts);
          const pct = e.n ? Math.round(100 * e.ok / e.n) : 0;
          return '<li><span class="kind">' + (TOPIC_HE[e.topic] || e.topic) + '</span><span class="muted small">' + d.getDate() + '.' + (d.getMonth() + 1) + '</span><b>+' + e.points + '</b><span class="muted small">' + e.ok + '/' + e.n + ' · ' + pct + '%</span></li>';
        }).join('')
      : '<li class="empty">עוד אין סטים. מתחילים מהבית או מהתרגול.</li>';
  };

  G.onAnswer = function (info) {
    const C = core(); if (!C) return null;
    const s = st();
    const before = C.xpLevel(s.points | 0).level;
    const award = C.recordAnswer(s, info);
    save();
    if (audio()) {
      audio().setMute(!!s.mute);
      audio().unlock();
      if (info.ok) audio().ding(); else audio().wrong();
    }
    const after = C.xpLevel(s.points | 0).level;
    if (after > before) {
      if (audio()) audio().levelUp();
      celebrate();
    } else if (info.ok && award.run >= 5) {
      softCelebrate();
    }
    G.refreshHud();
    return award;
  };

  G.showSummary = function () {
    const C = core(); if (!C) return;
    const entry = C.finishSession(st());
    save();
    if (!entry) { G.route('practice'); return; }
    $('sumPts').textContent = '+' + entry.points;
    $('sumAcc').textContent = entry.ok + '/' + entry.n + ' נכונות · ' + Math.round(100 * entry.ok / Math.max(1, entry.n)) + '%' +
      (entry.bonus ? ' · בונוס סיום +' + entry.bonus : '');
    const streak = C.effectiveStreak(st().streak, C.today());
    const box = $('sumStreak');
    if (streak > 0) {
      box.hidden = false;
      box.querySelector('span:last-child').textContent = 'רצף: ' + streak + ' ימים' + (st().streak.best ? ' (שיא ' + st().streak.best + ')' : '');
    } else box.hidden = true;
    celebrate();
    G.route('summary');
  };

  function celebrate() {
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const layer = document.createElement('div');
    layer.className = 'celeb'; layer.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 18; i++) {
      const d = document.createElement('i');
      d.style.left = Math.random() * 100 + '%';
      d.style.background = i % 3 ? 'var(--accent)' : 'var(--good)';
      d.style.animationDelay = (Math.random() * 0.4) + 's';
      layer.appendChild(d);
    }
    document.body.appendChild(layer);
    setTimeout(function () { layer.remove(); }, 1400);
  }
  function softCelebrate() { /* combo glow only via refreshHud */ }

  G.init = function () {
    if (audio()) audio().setMute(!!st().mute);
    // practice HUD + combo slot
    const practice = $('screen-practice');
    if (practice && !$('practiceHud')) {
      const hud = document.createElement('div');
      hud.className = 'hud'; hud.id = 'practiceHud';
      practice.insertBefore(hud, practice.firstChild);
      const combo = document.createElement('div');
      combo.className = 'combo'; combo.id = 'comboBar'; combo.hidden = true;
      const card = $('card');
      if (card && card.parentNode) card.parentNode.insertBefore(combo, card);
    }
    document.querySelectorAll('.nav-i').forEach(function (b) {
      b.onclick = function () { G.route(b.dataset.route); };
    });
    const start = $('startPractice');
    if (start) start.onclick = function () { if (audio()) audio().unlock(); G.route('practice'); };
    const sumAgain = $('sumAgain');
    if (sumAgain) sumAgain.onclick = function () { st().session = null; save(); G.route('practice'); };
    const sumHome = $('sumHome');
    if (sumHome) sumHome.onclick = function () { G.route('home'); };
    const sumProg = $('sumProg');
    if (sumProg) sumProg.onclick = function () { G.route('progress'); };

    const hash = (location.hash || '#home').replace(/^#/, '') || 'home';
    const initial = ['home', 'practice', 'progress'].includes(hash) ? hash : 'home';
    G.route(initial);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { if (window.__hp) G.init(); });
  } else if (window.__hp) {
    G.init();
  }
})();
