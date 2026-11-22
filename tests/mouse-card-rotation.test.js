import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  INTRO, FOLLOW, LEAVE, REFLECTION, TUNE_DEFAULTS, followRotation, restPose,
} from '../demos/07-mouse-card/rotation.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('원본 숫자: 등장은 옆으로 선 채(−90°) 64px 위에서 정면으로, 1초 elastic.out(1,0.75)', () => {
  assert.deepEqual(INTRO, {
    from: { rotationZ: 0, rotationY: -90, y: -64 },
    to: { rotationY: 0, y: 0 },
    duration: 1,
    ease: 'elastic.out(1,0.75)',
  });
});

test('원본 숫자: 따라가기 회전 세기 200 · 기본 기울기 6° · 0.5초 power2.out, 복귀 1.5초 elastic.out(1,0.75)', () => {
  assert.deepEqual(FOLLOW, { rotationFactor: 200, baseTilt: 6, duration: 0.5, ease: 'power2.out' });
  assert.deepEqual(LEAVE, { duration: 1.5, ease: 'elastic.out(1,0.75)' });
});

test('마우스가 화면 가운데면 정면 + 기본 기울기 6°', () => {
  assert.deepEqual(followRotation(500, 1000), { rotationY: 0, rotationZ: 6 });
});

test('화면 끝이면 ±200° 돌고, 180°를 넘으면 기울기는 −6°에서 멈춘다', () => {
  assert.deepEqual(followRotation(1000, 1000), { rotationY: 200, rotationZ: -6 });
  assert.deepEqual(followRotation(0, 1000), { rotationY: -200, rotationZ: -6 });
});

test('사이 값: 화면 3/4 지점이면 100°, 기울기 6 − (100/180) × 12', () => {
  const pose = followRotation(750, 1000);
  close(pose.rotationY, 100);
  close(pose.rotationZ, 6 - (100 / 180) * 12);
});

test('패널 값 반영: 회전 세기 90이면 끝에서 90°·기울기 0, 기본 기울기 10이면 가운데서 10°', () => {
  assert.deepEqual(followRotation(1000, 1000, { ...TUNE_DEFAULTS, rotationFactor: 90 }), { rotationY: 90, rotationZ: 0 });
  assert.deepEqual(followRotation(500, 1000, { ...TUNE_DEFAULTS, baseTilt: 10 }), { rotationY: 0, rotationZ: 10 });
});

test('복귀 자세: X·Y 0, Z는 기본 기울기', () => {
  assert.deepEqual(restPose(), { rotationX: 0, rotationY: 0, rotationZ: 6 });
  assert.equal(restPose({ ...TUNE_DEFAULTS, baseTilt: 10 }).rotationZ, 10);
});

test('반사(영상에서 잼: 틈 3% · 15%만 보임)와 패널 기본값', () => {
  assert.deepEqual(REFLECTION, { gap: 0.03, visible: 0.15 });
  assert.deepEqual(TUNE_DEFAULTS, {
    rotationFactor: 200, baseTilt: 6, followDuration: 0.5, leaveDuration: 1.5,
    perspective: 800, reflectionOpacity: 0.35, reflectionBlur: 6,
  });
});
