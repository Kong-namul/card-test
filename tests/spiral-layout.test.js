import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spiralSlot, endFade, windowStart, visibleHalf } from '../demos/01-spiral/layout.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const P = { angleStep: 0.5, radius: 3, squish: 0.7, gapY: 0.4, gapX: 0, edgeTwist: 0.1 };

test('n=0 카드는 정면 가운데에서 카메라를 본다', () => {
  const s = spiralSlot(0, P);
  close(s.x, 0); close(s.y, 0); close(s.z, 2.1);
  close(s.rotY, 0); close(s.rotZ, 0); close(s.facing, 1);
});

test('반 바퀴 떨어진 카드는 뒤쪽에 있고 facing이 -1', () => {
  const s = spiralSlot(Math.PI / P.angleStep, P);
  close(s.z, -2.1); close(s.facing, -1);
});

test('Grail처럼 오른쪽으로 갈수록 올라가는 나선: n>0 카드는 위쪽에 있다', () => {
  close(spiralSlot(2, P).y, 0.8);
  close(spiralSlot(-2, P).y, -0.8);
});

test('endFade: 가운데는 1, 창 끝에선 0', () => {
  close(endFade(0, 10), 1);
  close(endFade(10, 10), 0);
  close(endFade(-10, 10), 0);
});

test('windowStart: offset을 반올림한 위치가 창 가운데에 오도록', () => {
  assert.equal(windowStart(5.4, 10), 0);
  assert.equal(windowStart(5.6, 10), 1);
});

test('visibleHalf: 층이 안 겹치면 절반, 겹치면 한 바퀴 반경으로 제한', () => {
  assert.equal(visibleHalf(36, 0.5, 0.42, 2.24), 18);
  close(visibleHalf(36, 0.5, 0, 2.24), Math.PI / 0.5);
});
