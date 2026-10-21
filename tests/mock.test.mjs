import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = vm.createContext({});
vm.runInContext(readFileSync(new URL('../data/questions.js', import.meta.url), 'utf8') + ';globalThis.QUESTIONS=QUESTIONS;globalThis.WEEKS=WEEKS;', ctx);
vm.runInContext(readFileSync(new URL('../js/mock.js', import.meta.url), 'utf8'), ctx);
const { QUESTIONS, WEEKS, Mock } = ctx;

test('문제은행 형식', () => {
  const ids = new Set();
  for (const q of QUESTIONS) {
    assert.ok(!ids.has(q.id), '중복 id ' + q.id); ids.add(q.id);
    assert.ok(q.week >= 0 && q.week < WEEKS.length, q.id);
    assert.ok(q.explanation && q.source, q.id + ' 해설·근거');
    if (q.type === 'mc') {
      assert.equal(q.choices.length, 4, q.id);
      assert.ok(q.answer >= 1 && q.answer <= 4, q.id);
    } else assert.ok(q.answerText, q.id);
  }
});

test('모의고사 = 객관식 40 + 주관식 5, 100점, 중복 없음', () => {
  for (let k = 0; k < 20; k++) {
    const p = Mock.pick(QUESTIONS);
    const qs = p.ids.map((id) => QUESTIONS.find((q) => q.id === id));
    assert.equal(new Set(p.ids).size, p.ids.length);
    assert.equal(qs.filter((q) => q.type === 'mc').length, 40);
    assert.equal(qs.filter((q) => q.type === 'essay').length, 5);
    assert.equal(p.totalPoints, 100);
  }
});
