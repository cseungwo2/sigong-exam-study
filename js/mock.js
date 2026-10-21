(function (global) {
  'use strict';

  // 실제 시험: 45문제 = 객관식 40 + 주관식 5 (6~8주차 p35 필기 "주관식 5개 4점 / 시험 45문제").
  // 객관식 2점 × 40 + 주관식 4점 × 5 = 100점으로 환산한다(객관식 배점은 추정).
  const MC_COUNT = 40;
  const MC_POINTS = 2;
  const ESSAY_POINTS = 4;

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // 주차별 문제 수 비율대로 객관식 40개를 나눠 뽑는다(최대잉여법).
  function quota(mcs, total) {
    const byWeek = {};
    for (const q of mcs) (byWeek[q.week] = byWeek[q.week] || []).push(q);
    const weeks = Object.keys(byWeek);
    const raw = weeks.map((w) => ({ w, exact: (byWeek[w].length / mcs.length) * total }));
    raw.forEach((r) => { r.n = Math.floor(r.exact); });
    let left = total - raw.reduce((s, r) => s + r.n, 0);
    raw.slice().sort((a, b) => (b.exact - b.n) - (a.exact - a.n)).forEach((r) => {
      if (left > 0) { r.n++; left--; }
    });
    return { byWeek, raw };
  }

  function pick(questions) {
    const mcs = questions.filter((q) => q.type === 'mc');
    const { byWeek, raw } = quota(mcs, Math.min(MC_COUNT, mcs.length));
    let mcIds = [];
    raw.forEach((r) => { mcIds = mcIds.concat(shuffle(byWeek[r.w]).slice(0, r.n).map((q) => q.id)); });
    const essayIds = questions.filter((q) => q.type === 'essay' && q.main).map((q) => q.id);
    const ids = shuffle(mcIds).concat(essayIds);
    const pts = {};
    mcIds.forEach((id) => { pts[id] = MC_POINTS; });
    essayIds.forEach((id) => { pts[id] = ESSAY_POINTS; });
    return { ids, pts, totalPoints: mcIds.length * MC_POINTS + essayIds.length * ESSAY_POINTS };
  }

  global.Mock = { MC_COUNT, quota, pick };
})(typeof window !== 'undefined' ? window : globalThis);
