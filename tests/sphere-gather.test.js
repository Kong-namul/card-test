import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GATHER, CYLINDER, expoInOut, staggerProgress, curvedPoint, cylinderPoint, collapseYaw, outwardAngles } from '../demos/02-sphere/gather.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('기본값: 한 번에 + 각도만큼 돌기가 기본 (사용자: "한 번에 찹"), 줄줄이 옵션은 시간차 0.5 · 앞 카드부터 · 위아래 먼저', () => {
  assert.deepEqual(GATHER, { mode: 'classicSpin', spread: 0.5, frontFirst: true, verticalFirst: true, waypointNear: 0.95, waypointFar: 0.095 });
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

test('원통 자리: 공 위 각도(좌우)는 그대로, 반지름은 원통으로 통일, 높이는 줄여서', () => {
  const R = CYLINDER.radius;
  // 꼭대기 근처 카드(옆 반지름이 작음)도 원통 반지름까지 밀려난다
  const top = cylinderPoint({ x: 0.3, y: 4.4, z: 0.4 });
  close(Math.hypot(top.x, top.z), R);
  close(top.y, 4.4 * CYLINDER.heightScale);
  close(Math.atan2(top.x, top.z), Math.atan2(0.3, 0.4));
  close(top.yaw, Math.atan2(0.3, 0.4));
  // 정면·뒤 카드: 정면은 0, 뒤는 ±π
  close(cylinderPoint({ x: 0, y: 0, z: 4.5 }).yaw, 0);
  close(Math.abs(cylinderPoint({ x: 0, y: 0, z: -4.5 }).yaw), Math.PI);
});

test('원통 → 가운데에서 도는 양: 세로축으로 자기 각도만큼 (정면 0, 옆 90°, 뒤 180°) — 좌우 대칭', () => {
  close(collapseYaw(0, 0.5), 0);
  close(collapseYaw(Math.PI / 2, 0), Math.PI / 2);   // 아직 출발 전
  close(collapseYaw(Math.PI / 2, 1), 0);             // 도착하면 정면
  close(collapseYaw(Math.PI, 0.5), Math.PI / 2);     // 뒤 카드는 반쯤 왔을 때 90°만큼 남음
  close(collapseYaw(-2, 0.25), -1.5);                // 왼쪽은 반대로
});

test('원통이 되면서 모이기: 한 번에(같은 진행도), 원통은 덜(60%까지만) · 천천히(진행도 0~0.9에 걸쳐) — 사용자 "원통 조금만 덜, 더 느리게"', () => {
  assert.deepEqual(
    [CYLINDER.amount, CYLINDER.unfold, CYLINDER.collapse, CYLINDER.spread],
    [0.6, [0, 0.9], [0, 1], 0],
  );
});

test('cylinderPoint는 원통 정도만큼만 섞어 쓸 수 있다 (0 = 공 그대로, 1 = 완전한 원통)', () => {
  const p = { x: 0.3, y: 4.4, z: 0.4 };
  const full = cylinderPoint(p);
  const half = { x: p.x + (full.x - p.x) * 0.5, y: p.y + (full.y - p.y) * 0.5, z: p.z + (full.z - p.z) * 0.5 };
  // 공 → 원통 섞기는 main에서 lerp(공, 원통, 진행 × 원통 정도)로 한다: 정도 0.6이면 끝까지 가도 60% 지점
  close(half.y, (4.4 + 4.4 * CYLINDER.heightScale) / 2);
});

test('바깥 보기 방향 나누기: 좌우 각도(yaw)와 위아래 숙임(pitch) — 시안 1·2가 세로축으로만 돌리는 기준', () => {
  const front = outwardAngles({ x: 0, y: 0, z: 2 });
  close(front.yaw, 0); close(front.pitch, 0);
  close(outwardAngles({ x: 3, y: 0, z: 0 }).yaw, Math.PI / 2);
  close(Math.abs(outwardAngles({ x: 0, y: 0, z: -1 }).yaw), Math.PI);
  close(outwardAngles({ x: 0, y: 1, z: 1 }).pitch, -Math.PI / 4); // 위쪽 카드는 위를 본다 (X축 음의 회전)
});
