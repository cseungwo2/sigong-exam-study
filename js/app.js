(function () {
  'use strict';

  var STORAGE_KEY = 'sigong-progress-v1';
  var app = document.getElementById('app');

  // ---------------------------------------------------------------------
  // Progress persistence
  // ---------------------------------------------------------------------
  function loadProgress() {
    var raw;
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      raw = stored ? JSON.parse(stored) : {};
    } catch (e) {
      raw = {};
    }
    return Stats.migrateProgress(raw).progress;
  }

  function saveProgress() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch (e) {
      /* storage unavailable — ignore */
    }
  }

  var progress = loadProgress();

  function getEntry(id) {
    return Stats.normalizeEntry(progress[id]);
  }

  function setEntry(id, patch) {
    var cur = getEntry(id);
    progress[id] = {
      correct: patch.correct != null ? patch.correct : cur.correct,
      wrong: patch.wrong != null ? patch.wrong : cur.wrong,
      lastCorrect: patch.lastCorrect != null ? patch.lastCorrect : cur.lastCorrect,
      lastAnswer: patch.lastAnswer != null ? patch.lastAnswer : cur.lastAnswer,
      inWrongNote: patch.inWrongNote != null ? patch.inWrongNote : cur.inWrongNote
    };
    saveProgress();
  }

  // ---------------------------------------------------------------------
  // Session state (in-memory only)
  // ---------------------------------------------------------------------
  var session = null; // { ids, index, stats, mode, wrongIds, pts?, totalPoints?, score? }

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function circled(i) {
    return String.fromCodePoint(0x2460 + (i - 1));
  }

  function questionById(id) {
    for (var i = 0; i < QUESTIONS.length; i++) {
      if (QUESTIONS[i].id === id) return QUESTIONS[i];
    }
    return null;
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function idsWhere(fn) {
    return QUESTIONS.filter(fn).map(function (q) { return q.id; });
  }

  function formatAcc(acc) {
    return acc == null ? '-' : acc + '%';
  }

  function wrongNoteIds() {
    return idsWhere(function (q) {
      var e = progress[q.id];
      return e && e.inWrongNote;
    });
  }

  function startSession(ids, mode, extra) {
    if (!ids.length) return;
    session = { ids: ids, index: 0, stats: { correct: 0, wrong: 0 }, mode: mode, wrongIds: [] };
    if (extra) Object.keys(extra).forEach(function (k) { session[k] = extra[k]; });
    location.hash = mode === 'review' ? '#review' : '#quiz';
    render();
  }

  // ---------------------------------------------------------------------
  // Routing
  // ---------------------------------------------------------------------
  function render() {
    var hash = location.hash || '#home';
    if ((hash === '#quiz' || hash === '#review') && session) {
      renderQuizView();
    } else {
      if (hash === '#quiz' || hash === '#review') location.hash = '#home';
      renderHome();
    }
  }

  window.addEventListener('hashchange', render);

  // ---------------------------------------------------------------------
  // Home view
  // ---------------------------------------------------------------------
  function groupButton(action, value, name, ids) {
    var s = Stats.accuracy(progress, ids);
    var pct = ids.length === 0 ? 0 : Math.round((s.attempted / ids.length) * 100);
    return (
      '<button type="button" class="btn round-btn" data-action="' + action + '" data-value="' + value + '">' +
      '<span class="round-name">' + escapeHtml(name) + '</span>' +
      '<span class="round-count">' + ids.length + '문제' +
      (s.accuracy == null ? '' : ' · ' + s.accuracy + '%') + '</span>' +
      '<span class="round-gauge"><span class="round-gauge-fill" style="width:' + pct + '%"></span></span>' +
      '</button>'
    );
  }

  function renderHome() {
    var allIds = QUESTIONS.map(function (q) { return q.id; });
    var overall = Stats.accuracy(progress, allIds);
    var answered = overall.attempted;
    var total = overall.total;
    var pct = total === 0 ? 0 : Math.round((answered / total) * 100);
    var wrongIds = wrongNoteIds();

    var weekButtons = WEEKS.map(function (name, w) {
      return groupButton('start-week', w, name, idsWhere(function (q) { return q.type === 'mc' && q.week === w; }));
    }).join('') +
      groupButton('start-essay', '', '주관식', idsWhere(function (q) { return q.type === 'essay'; }));

    app.innerHTML =
      '<div class="page page-home">' +
      '<div class="home-top">' +
      '<h1 class="home-header">스마트빌딩시공학<span class="home-sub">중간고사 CBT · 강의 필기 강조 부분</span></h1>' +
      '<button type="button" class="btn-reset" data-action="reset-progress"' +
      (answered === 0 ? ' disabled' : '') + '>기록 초기화</button>' +
      '</div>' +
      '<div class="stat-card">' +
      '<div class="stat-row">' +
      '<div class="stat"><span class="stat-value">' + answered + '<em>/' + total + '</em></span><span class="stat-label">푼 문제</span></div>' +
      '<div class="stat"><span class="stat-value">' + formatAcc(overall.accuracy) + '</span><span class="stat-label">정답률</span></div>' +
      '<div class="stat"><span class="stat-value">' + wrongIds.length + '</span><span class="stat-label">오답노트</span></div>' +
      '</div>' +
      '<div class="progress-bar"><div class="progress-bar-fill" style="width:' + pct + '%"></div></div>' +
      '</div>' +
      '<div class="btn-list">' +
      '<button type="button" class="btn btn-primary" data-action="start-mock">모의고사 45문제 (객관식 40 + 주관식 5)</button>' +
      '<div class="btn-row">' +
      '<button type="button" class="btn btn-secondary" data-action="start-random">객관식 전체 랜덤</button>' +
      '<button type="button" class="btn btn-secondary" data-action="start-review"' +
      (wrongIds.length === 0 ? ' disabled' : '') + '>오답노트 ' + wrongIds.length + '</button>' +
      '</div>' +
      '</div>' +
      '<h2>주차별</h2>' +
      '<div class="round-grid">' + weekButtons + '</div>' +
      '<p class="home-note">모든 문제는 강의자료 필기(★·암기·나옴·밑줄·동그라미) 부분으로 만들었고, 받은 기출 요약 문제는 넣지 않았어요. 풀 때마다 정답·해설·근거 쪽수가 나와요.</p>' +
      '</div>';
  }

  // ---------------------------------------------------------------------
  // Quiz view
  // ---------------------------------------------------------------------
  function renderQuizView() {
    if (session.index >= session.ids.length) {
      renderSummary();
      return;
    }
    var id = session.ids[session.index];
    var q = questionById(id);
    if (!q) {
      session.index++;
      renderQuizView();
      return;
    }

    var meta = [WEEKS[q.week], q.type === 'essay' ? '주관식' : '객관식'];
    if (session.mode === 'mock') meta.push(session.pts[id] + '점');

    var body;
    if (q.type === 'mc') {
      body = '<div class="choice-list">' + q.choices.map(function (c, i) {
        return '<button type="button" class="btn choice" data-action="choose" data-value="' + (i + 1) + '">' +
          '<span class="choice-no">' + circled(i + 1) + '</span><span class="choice-text">' + escapeHtml(c) + '</span></button>';
      }).join('') + '</div>';
    } else {
      body =
        '<div class="quiz-input-area"><textarea class="essay-input" id="essay-input" rows="5" placeholder="답안을 입력하세요 (안 써도 채점 가능)"></textarea></div>' +
        '<div class="quiz-actions"><button type="button" class="btn btn-primary" data-action="grade-essay">채점</button></div>';
    }

    app.innerHTML =
      '<div class="page page-quiz">' +
      '<div class="quiz-header">' +
      '<a href="#home" class="link-home" data-action="go-home">← 홈</a>' +
      '<span class="quiz-progress">' + (session.index + 1) + ' / ' + session.ids.length + '</span>' +
      '</div>' +
      '<div class="quiz-meta">' + escapeHtml(meta.join(' · ')) + '</div>' +
      '<div class="quiz-question pre">' + escapeHtml(q.question) + '</div>' +
      body +
      '<div class="quiz-result" id="quiz-result"></div>' +
      '<div class="quiz-next">' +
      '<button type="button" class="btn btn-secondary" data-action="next" id="next-btn" disabled>' +
      (session.index + 1 === session.ids.length ? '결과 보기' : '다음 문제') + '</button>' +
      '</div>' +
      '</div>';
    window.scrollTo(0, 0);
  }

  function explainHtml(q) {
    return '<div class="explain pre"><h4>해설</h4>' + escapeHtml(q.explanation) + '</div>' +
      '<div class="source">근거 · ' + escapeHtml(q.source) + '</div>';
  }

  function enableNext() {
    var btn = document.getElementById('next-btn');
    if (btn) { btn.disabled = false; btn.focus({ preventScroll: true }); }
  }

  function finalizeAttempt(q, isCorrect, lastAnswerValue) {
    var cur = getEntry(q.id);
    setEntry(q.id, {
      correct: cur.correct + (isCorrect ? 1 : 0),
      wrong: cur.wrong + (isCorrect ? 0 : 1),
      lastCorrect: isCorrect,
      lastAnswer: lastAnswerValue,
      inWrongNote: !isCorrect
    });
    if (isCorrect) session.stats.correct++;
    else { session.stats.wrong++; session.wrongIds.push(q.id); }
    if (session.mode === 'mock' && isCorrect) session.score += session.pts[q.id] || 0;
  }

  function handleChoose(q, picked) {
    if (session.graded) return;
    session.graded = true;
    var ok = picked === q.answer;
    app.querySelectorAll('.choice').forEach(function (el) {
      var v = Number(el.getAttribute('data-value'));
      el.disabled = true;
      if (v === q.answer) el.classList.add('is-answer');
      else if (v === picked) el.classList.add('is-picked-wrong');
    });
    document.getElementById('quiz-result').innerHTML =
      '<div class="result-box">' +
      '<div class="result-summary ' + (ok ? 'is-correct' : 'is-wrong') + '">' +
      (ok ? '정답' : '오답 · 정답은 ' + circled(q.answer)) + '</div>' +
      explainHtml(q) + '</div>';
    finalizeAttempt(q, ok, String(picked));
    enableNext();
  }

  function handleGradeEssay(q) {
    var textEl = document.getElementById('essay-input');
    var textVal = textEl ? textEl.value : '';
    var kw = Grading.findKeywords(textVal, q.keywords || []);
    if (textEl) textEl.disabled = true;
    var gradeBtn = app.querySelector('[data-action="grade-essay"]');
    if (gradeBtn) gradeBtn.disabled = true;

    var chips = kw.map(function (k) {
      return '<span class="chip ' + (k.found ? 'chip-found' : 'chip-missing') + '">' + escapeHtml(k.keyword) + '</span>';
    }).join('');

    document.getElementById('quiz-result').innerHTML =
      '<div class="result-box">' +
      '<div class="essay-compare">' +
      '<div><h4>내 답안</h4><p class="pre">' + escapeHtml(textVal || '(입력 없음)') + '</p></div>' +
      '<div><h4>모범답안</h4><p class="pre">' + escapeHtml(q.answerText) + '</p></div>' +
      '</div>' +
      (textVal ? '<div class="chip-list">' + chips + '</div>' : '') +
      explainHtml(q) +
      '<div class="confirm-row" id="essay-confirm">' +
      '<button type="button" class="btn btn-correct" data-action="confirm" data-value="correct">맞음</button>' +
      '<button type="button" class="btn btn-wrong" data-action="confirm" data-value="wrong">틀림</button>' +
      '</div>' +
      '</div>';
    session.pendingLastAnswer = textVal;
  }

  function handleConfirm(q, value) {
    var isCorrect = value === 'correct';
    finalizeAttempt(q, isCorrect, session.pendingLastAnswer || '');
    var row = document.getElementById('essay-confirm');
    if (row) {
      row.outerHTML = '<div class="confirmed-label ' + (isCorrect ? 'mark-correct' : 'mark-wrong') + '">' +
        '확정: ' + (isCorrect ? '맞음' : '틀림') + '</div>';
    }
    enableNext();
  }

  function handleNext() {
    session.index++;
    session.graded = false;
    render();
  }

  // 결과 화면 — 이번에 틀린 문제를 정답·해설과 함께 다시 보여준다
  function renderSummary() {
    var stats = session.stats;
    var totalDone = stats.correct + stats.wrong;
    var isMock = session.mode === 'mock';
    var score = isMock && session.totalPoints > 0 ? Math.round((session.score / session.totalPoints) * 100) : 0;
    var mockHtml = isMock
      ? '<div class="mock-score ' + (score >= 60 ? 'is-correct' : 'is-wrong') + '">' + score + '점</div>' +
        '<p class="summary-note">객관식 2점 × 40 + 주관식 4점 × 5 = 100점 기준(객관식 배점은 추정)</p>'
      : '';

    var wrongList = session.wrongIds.map(function (id) {
      var q = questionById(id);
      var ans = q.type === 'mc'
        ? circled(q.answer) + ' ' + q.choices[q.answer - 1]
        : q.answerText;
      return '<li class="wrong-item">' +
        '<div class="wrong-q pre">' + escapeHtml(q.question) + '</div>' +
        '<div class="wrong-a pre"><span class="mark-correct">정답</span> ' + escapeHtml(ans) + '</div>' +
        explainHtml(q) + '</li>';
    }).join('');

    app.innerHTML =
      '<div class="page page-summary">' +
      '<div class="summary-box">' +
      '<h2>' + (isMock ? '모의고사 완료' : '풀이 완료') + '</h2>' +
      mockHtml +
      '<div class="summary-score">' +
      '<span class="mark-correct">맞음 ' + stats.correct + '</span>' +
      '<span class="mark-wrong">틀림 ' + stats.wrong + '</span>' +
      '</div>' +
      '<p>총 ' + totalDone + '문제 풀이</p>' +
      '<div class="btn-row summary-actions">' +
      (session.wrongIds.length ? '<button type="button" class="btn btn-secondary" data-action="retry-wrong">틀린 문제만 다시</button>' : '') +
      '<button type="button" class="btn btn-primary" data-action="go-home">홈으로</button>' +
      '</div>' +
      '</div>' +
      (wrongList ? '<h2>틀린 문제 정답·해설</h2><ol class="wrong-list">' + wrongList + '</ol>' : '') +
      '</div>';
    window.scrollTo(0, 0);
  }

  // ---------------------------------------------------------------------
  // Event delegation
  // ---------------------------------------------------------------------
  app.addEventListener('click', function (e) {
    var target = e.target.closest('[data-action]');
    if (!target || target.disabled) return;
    var action = target.getAttribute('data-action');
    var value = target.getAttribute('data-value');
    var q = session ? questionById(session.ids[session.index]) : null;

    if (action === 'start-mock') {
      var paper = Mock.pick(QUESTIONS);
      startSession(paper.ids, 'mock', { pts: paper.pts, totalPoints: paper.totalPoints, score: 0 });
    } else if (action === 'start-random') {
      startSession(shuffle(idsWhere(function (q) { return q.type === 'mc'; })), 'random');
    } else if (action === 'start-week') {
      var w = Number(value);
      startSession(idsWhere(function (q) { return q.type === 'mc' && q.week === w; }), 'week');
    } else if (action === 'start-essay') {
      startSession(idsWhere(function (q) { return q.type === 'essay'; }), 'essay');
    } else if (action === 'start-review') {
      startSession(wrongNoteIds(), 'review');
    } else if (action === 'retry-wrong') {
      startSession(session.wrongIds.slice(), 'review');
    } else if (action === 'reset-progress') {
      if (!confirm('풀이 기록을 모두 초기화할까요?\n정답률·풀이 수·오답노트가 전부 삭제됩니다.')) return;
      progress = {};
      try { localStorage.removeItem(STORAGE_KEY); } catch (err) { /* ignore */ }
      render();
    } else if (action === 'go-home') {
      e.preventDefault();
      session = null;
      location.hash = '#home';
      render();
    } else if (action === 'choose') {
      handleChoose(q, Number(value));
    } else if (action === 'grade-essay') {
      handleGradeEssay(q);
    } else if (action === 'confirm') {
      handleConfirm(q, value);
    } else if (action === 'next') {
      handleNext();
    }
  });

  render();
})();
