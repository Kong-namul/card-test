import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scrollWindow, windowProgress } from '../shared/scroll-progress.js';

test('첫 화면 안에 있는 요소는 스크롤 0에서 시작한다 (Locomotive "fold") — 06 탈출 구간 0%, 25%', () => {
  const win = scrollWindow({ top: 0, height: 1000, viewport: 1000 }, { startOffset: 0, endOffset: 0.25 });
  assert.deepEqual(win, { start: 0, end: 750 }); // 아랫변이 화면 위에서 25% 내려온 순간 끝
});

test('아래에 있는 요소는 윗변이 화면 아래에서 startOffset만큼 올라온 순간 시작하고, 아랫변이 화면 위에서 endOffset만큼 내려온 순간 끝난다 — 06 귀환 구간 5%, 75%', () => {
  const win = scrollWindow({ top: 1600, height: 3500, viewport: 1000 }, { startOffset: 0.05, endOffset: 0.75 });
  assert.equal(win.start, 1600 - 1000 + 50);
  assert.equal(win.end, 1600 + 3500 - 750);
});

test('offset을 안 주면 0으로 본다', () => {
  assert.deepEqual(scrollWindow({ top: 2000, height: 500, viewport: 1000 }), { start: 1000, end: 2500 });
});

test('끝이 시작보다 앞이거나 같으면 끝 = 시작 + 1 (Locomotive와 같음)', () => {
  // 시작 2000 − 1000 + 900 = 1900, 끝 2010 − 900 = 1110 → 1901
  assert.deepEqual(scrollWindow({ top: 2000, height: 10, viewport: 1000 }, { startOffset: 0.9, endOffset: 0.9 }), { start: 1900, end: 1901 });
});

test('windowProgress는 구간 안에서 0~1, 밖은 0이나 1로 자른다', () => {
  const win = { start: 100, end: 300 };
  assert.equal(windowProgress(0, win), 0);
  assert.equal(windowProgress(100, win), 0);
  assert.equal(windowProgress(200, win), 0.5);
  assert.equal(windowProgress(300, win), 1);
  assert.equal(windowProgress(999, win), 1);
});
