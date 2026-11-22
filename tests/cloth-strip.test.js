import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RIG, STRIP, rollFor, fovFromFocal, toRoom, facing, toCard, slideOffsets, cardSize, easeToward, dragDelta,
} from '../demos/09-cloth/strip.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const closeAll = (list, expected, eps) => list.forEach((v, i) => close(v, expected[i], eps));

test('원본 숫자 (rig.ts · Strip.vue): 기울기 0.56 / 세로 화면 0.34, 비틀기 0.5, 눈 거리 화면 높이 × 1.5, 카드 방향 1.15', () => {
  assert.deepEqual(RIG, { roll: 0.56, rollTall: 0.34, yaw: 0.5, focal: 1.5, turn: 1.15 });
  assert.deepEqual(STRIP, {
    count: 10, aspect: 4 / 3,
    wide: { width: 36, gap: 2, size: 1440 }, narrow: { width: 28, gap: 1, size: 390 }, breakpoint: 650, remMin: 5,
    ease: 0.1, enter: { from: 1.5, wait: 0.15, ease: 0.04 }, dragGear: 1.5,
  });
});

test('세로로 긴 화면은 띠를 덜 기울인다', () => {
  assert.equal(rollFor(1440, 900), 0.56);
  assert.equal(rollFor(375, 812), 0.34);
});

test('눈이 화면 높이 1.5배 거리면 세로 화각 = 2·atan(1/3) ≈ 36.87°', () => {
  close(fovFromFocal(1.5), (2 * Math.atan(1 / 3) * 180) / Math.PI);
  close(fovFromFocal(1.5), 36.8699, 1e-3);
});

test('띠 방향: 오른쪽 위로 기울고(y 위) 오른쪽이 멀어진다(z −)', () => {
  closeAll(toRoom(1, 0, 0), [Math.cos(0.5) * Math.cos(0.56), Math.cos(0.5) * Math.sin(0.56), -Math.sin(0.5)]);
  closeAll(toRoom(0, 1, 0), [-Math.sin(0.56), Math.cos(0.56), 0]);
});

test('카드 방향 행렬은 회전(직교 · 행렬식 1)이고, 0·0이면 그대로', () => {
  const m = facing();
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const dot = m[r * 3] * m[c * 3] + m[r * 3 + 1] * m[c * 3 + 1] + m[r * 3 + 2] * m[c * 3 + 2];
      close(dot, r === c ? 1 : 0);
    }
  }
  const det = m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);
  close(det, 1);
  closeAll(facing(0, 0), [1, 0, 0, 0, 1, 0, 0, 0, 1]);
});

test('띠를 따라 움직이면 카드 입장에선 대부분 얼굴 방향(z)으로 밀린다 → 가장자리가 공기에 접힌다', () => {
  const local = toCard(toRoom(1, 0, 0), facing());
  assert.ok(Math.abs(local[2]) > 0.8, `z 성분 ${local[2]}`);
});

test('카드 위치: 10장이 간격마다 놓이고 띠 길이로 감긴다 (가운데 = 0)', () => {
  closeAll(slideOffsets(10, 608, 0), [0, 608, 1216, 1824, 2432, -3040, -2432, -1824, -1216, -608]);
  closeAll(slideOffsets(10, 608, 608), [-608, 0, 608, 1216, 1824, 2432, -3040, -2432, -1824, -1216]);
});

test('카드 크기 (원본 1rem = 화면 폭 1440일 때 10px, 폭에 비례): 넓은 화면 36rem · 간격 2rem, 좁은 화면(기준 390) 28rem · 1rem', () => {
  assert.deepEqual(cardSize(1440), { width: 360, height: 480, gap: 20, spacing: 380 });
  assert.deepEqual(cardSize(2880), { width: 720, height: 960, gap: 40, spacing: 760 });
  const narrow = cardSize(375);
  close(narrow.width, 28 * 10 * 375 / 390);
  close(narrow.height, narrow.width * 4 / 3);
  close(narrow.gap, 10 * 375 / 390);
  close(cardSize(100).width, 28 * 5); // 1rem은 5px 아래로 안 작아짐
});

test('스크롤 무게: 60fps 한 프레임에 남은 거리의 10%, 프레임이 길면 그만큼 더', () => {
  close(easeToward(0, 100, 0.1, 1 / 60), 10);
  close(easeToward(0, 100, 0.1, 1 / 30), 19);
});

test('드래그: 띠 방향 성분 × 1.5 ÷ cos(비틀기)', () => {
  close(dragDelta(100, 0, 0, 0), 150);
  close(dragDelta(0, -100, Math.PI / 2, 0), 150);
  close(dragDelta(100, 0, 0, 0.5), 150 / Math.cos(0.5));
});
