import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GATHER, expoInOut, staggerProgress, curvedPoint } from '../demos/02-sphere/gather.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('기본값: 줄줄이 곡선이 기본, 시간차 0.5, 앞 카드부터, 위아래 먼저 (실험 페이지에서 고른 B 그대로)', () => {
  assert.deepEqual(GATHER, { mode: 'flow', spread: 0.5, frontFirst: true, verticalFirst: true, waypointNear: 0.95, waypointFar: 0.095 });
});

test('expoInOut: GSAP expo.inOut 모양 — 0·1 고정, 가운데 0.5, 앞뒤 대칭, 처음엔 거의 안 움직임', () => {
  assert.equal(expoInOut(0), 0);
  assert.equal(expoInOut(1), 1);
  close(expoInOut(0.5), 0.5);
  close(expoInOut(0.2) + expoInOut(0.8), 1);
  assert.ok(expoInOut(0.1) < 0.01);
  assert.equal(expoInOut(-1), 0);
  assert.equal(expoInOut(2), 1);
});

test('staggerProgress: 첫 장은 바로, 마지막 장은 시간차만큼 늦게 출발하고 모두 끝에 도착', () => {
  // 32장, 시간차 0.5 → 카드마다 자기 몫은 전체의 절반
  assert.equal(staggerProgress(0, 0, 32, 0.5), 0);
  close(staggerProgress(0.25, 0, 32, 0.5), 0.5);
  assert.equal(staggerProgress(0.5, 0, 32, 0.5), 1);
  assert.equal(staggerProgress(0.5, 31, 32, 0.5), 0);   // 마지막 장은 이제 출발
  close(staggerProgress(0.75, 31, 32, 0.5), 0.5);
  assert.equal(staggerProgress(1, 31, 32, 0.5), 1);
  // 순위가 뒤일수록 늦다
  assert.ok(staggerProgress(0.4, 5, 32, 0.5) > staggerProgress(0.4, 20, 32, 0.5));
  // 시간차 0이면 다 같이
  close(staggerProgress(0.3, 31, 32, 0), 0.3);
});

test('curvedPoint: 출발·도착은 정확히, 위아래 먼저면 중간에 높이가 거의 다 맞춰지고 옆은 덜 왔다', () => {
  const from = { x: 4, y: 3, z: 2 };
  const to = { x: 0, y: 0, z: 0 };
  assert.deepEqual(curvedPoint(from, to, 0, true), from);
  const end = curvedPoint(from, to, 1, true);
  close(end.x, 0); close(end.y, 0); close(end.z, 0);

  const mid = curvedPoint(from, to, 0.5, true);
  const yDone = (from.y - mid.y) / from.y;
  const xDone = (from.x - mid.x) / from.x;
  assert.ok(yDone > 0.7 && xDone < 0.3, `위아래 ${yDone}, 옆 ${xDone}`);
  close((from.z - mid.z) / from.z, xDone); // 앞뒤는 옆과 같이

  // 옆 먼저(원본 Thumbnail Flow 방향)는 반대
  const side = curvedPoint(from, to, 0.5, false);
  assert.ok((from.x - side.x) / from.x > 0.7 && (from.y - side.y) / from.y < 0.3);
});
