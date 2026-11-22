import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wrapCentered, tubeSlot, edgeFade, stepTubeMotion, rowSpinFactor } from '../demos/03-tunnel/layout.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('wrapCentered: 값을 [-주기/2, 주기/2) 안으로 접는다', () => {
  close(wrapCentered(0, 10), 0);
  close(wrapCentered(6, 10), -4);
  close(wrapCentered(-6, 10), 4);
  close(wrapCentered(5, 10), -5);
  close(wrapCentered(23, 10), 3);
});

test('tubeSlot: 0줄 0칸은 정면, 바깥(카메라)을 본다', () => {
  const s = tubeSlot(0, 0, { rows: 4, cols: 12, radius: 3, rowGap: 1 });
  close(s.x, 0); close(s.y, 0); close(s.z, 3); close(s.rotY, 0); close(s.facing, 1);
});

test('tubeSlot: 홀수 줄은 반 칸 엇갈리고, 위로 갈수록 rowGap씩 올라간다', () => {
  const s = tubeSlot(1, 0, { rows: 4, cols: 12, radius: 3, rowGap: 1 });
  close(s.rotY, Math.PI / 12);
  close(s.y, 1);
});

test('tubeSlot: 루프 높이를 넘은 줄은 아래쪽으로 접혀 들어온다 (무한 루프)', () => {
  // 4줄 × 간격 1 = 루프 높이 4 → 3번째 줄(y=3)은 -1로
  close(tubeSlot(3, 0, { rows: 4, cols: 12, radius: 3, rowGap: 1 }).y, -1);
  // 스크롤 2만큼 → 0번째 줄이 -2로
  close(tubeSlot(0, 0, { rows: 4, cols: 12, radius: 3, rowGap: 1, scroll: 2 }).y, -2);
});

test('edgeFade: 가운데는 1, 루프 경계에선 0', () => {
  close(edgeFade(0, 8, 1), 1);
  close(edgeFade(4, 8, 1), 0);
  close(edgeFade(-4, 8, 1), 0);
  close(edgeFade(2.9, 8, 1), 1);
});

test('stepTubeMotion: 60fps 한 프레임에 스크롤 12% 따라가고, 회전 속도는 8% 줄어든다', () => {
  const state = { scrollCurrent: 0, scrollTarget: 10, spinVelocity: 1, angle: 0, speedScale: 1 };
  stepTubeMotion(state, { baseSpeed: 0.1, follow: 0.12, spinDecay: 0.92, speedTarget: 1, speedLerp: 0.08 }, 1 / 60);
  close(state.scrollCurrent, 1.2);
  close(state.spinVelocity, 0.92);
  close(state.angle, (0.1 + 0.92) / 60);
});

test('stepTubeMotion: 프레임을 반으로 쪼개도 결과가 같다 (프레임레이트 무관)', () => {
  const opts = { baseSpeed: 0, follow: 0.12, spinDecay: 0.92, speedTarget: 0.15, speedLerp: 0.08 };
  const a = { scrollCurrent: 0, scrollTarget: 10, spinVelocity: 1, angle: 0, speedScale: 1 };
  const b = { ...a };
  stepTubeMotion(a, opts, 1 / 60);
  stepTubeMotion(b, opts, 1 / 120);
  stepTubeMotion(b, opts, 1 / 120);
  close(a.scrollCurrent, b.scrollCurrent);
  close(a.spinVelocity, b.spinVelocity);
  close(a.speedScale, b.speedScale);
});

test('stepTubeMotion: 슬로모션 목표(0.15)로 속도 배율이 서서히 내려간다', () => {
  const s = { scrollCurrent: 0, scrollTarget: 0, spinVelocity: 0, angle: 0, speedScale: 1 };
  stepTubeMotion(s, { baseSpeed: 1, follow: 0.12, spinDecay: 0.92, speedTarget: 0.15, speedLerp: 0.08 }, 1 / 60);
  close(s.speedScale, 1 - 0.85 * 0.08);
});

test('rowSpinFactor: 기본 5줄 묶음 안에서 0.65배 → 1.55배로 줄마다 다른 속도, 5줄마다 반복', () => {
  close(rowSpinFactor(0, 5), 0.65);
  close(rowSpinFactor(2, 5), 1.1);
  close(rowSpinFactor(4, 5), 1.55);
  close(rowSpinFactor(5, 5), 0.65); // 다음 묶음 첫 줄
  close(rowSpinFactor(3, 1), 0.65); // 묶음이 1줄이면 다 같은 속도
});
