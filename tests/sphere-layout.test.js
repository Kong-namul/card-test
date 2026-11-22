import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fibonacciSphere, depthBrightness } from '../demos/02-sphere/layout.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const len = (p) => Math.hypot(p.x, p.y, p.z);

test('fibonacciSphere: 개수만큼, 전부 반지름 위에, 위아래로 고르게', () => {
  const pts = fibonacciSphere(40, 2);
  assert.equal(pts.length, 40);
  pts.forEach((p) => close(len(p), 2));
  const meanY = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  close(meanY, 0, 1e-9);                         // 위아래 균형
  assert.ok(pts[0].y > 1.9 && pts[39].y < -1.9); // 첫 카드는 꼭대기 근처, 마지막은 바닥 근처
});

test('fibonacciSphere: 정확히 극(꼭짓점)에 놓이는 카드는 없다', () => {
  fibonacciSphere(40, 2).forEach((p) => assert.ok(Math.abs(p.y) < 2 - 1e-6));
});

test('depthBrightness: 맨 뒤 min, 맨 앞 max, 가운데는 중간', () => {
  close(depthBrightness(-2.8, 2, 0.1, 1), 0.1);
  close(depthBrightness(2.8, 2, 0.1, 1), 1);
  close(depthBrightness(0, 2, 0.1, 1), 0.55);
  close(depthBrightness(-99, 2, 0.1, 1), 0.1); // 범위 밖은 잘린다
});
