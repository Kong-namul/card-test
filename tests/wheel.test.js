import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WHEEL, OVERLAY_STOPS, CARD_COLORS, TUNE_DEFAULTS,
  visibleSlots, wheelRotation, overlayStops, overlayGradient,
} from '../demos/08-wheel/wheel.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('원본 숫자: 지름 70 · 카드 7.5 · 24칸 × 15° · 8~19번 뺌 · −65° · 스크롤 구간은 Locomotive 기본값 0%, 0%', () => {
  assert.deepEqual(WHEEL, {
    size: 70, cardWidth: 7.5, slots: 24, angle: 15, hidden: [8, 19], rotate: -65,
    window: { startOffset: 0, endOffset: 0 },
  });
});

test('원본 그라데이션: 9% · 16% · 22% · 32%에 검정 3d · 80 · b8 · ff', () => {
  assert.deepEqual(OVERLAY_STOPS.map((s) => s.at), [0, 9, 16, 22, 32]);
  assert.deepEqual(OVERLAY_STOPS.map((s) => Math.round(s.alpha * 255)), [0, 0x3d, 0x80, 0xb8, 0xff]);
});

test('보이는 카드 12장: 호 왼쪽 20번(−60°)부터 오른쪽 7번(105°)까지, 각도 = 번호 × 15°', () => {
  const slots = visibleSlots();
  assert.equal(slots.length, 12);
  assert.deepEqual(slots.map((s) => s.index), [20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6, 7]);
  slots.forEach((s) => assert.equal(s.angle, s.index * 15));
});

test('카드 색: 호 왼쪽부터 라벤더 · 분홍 · 노랑 순서로 반복', () => {
  assert.deepEqual(CARD_COLORS, ['lavender', 'pink', 'yellow']);
  assert.deepEqual(visibleSlots().map((s) => s.color).slice(0, 6), ['lavender', 'pink', 'yellow', 'lavender', 'pink', 'yellow']);
});

test('회전: 진행도에 정비례(linear), 끝에서 −65°, 패널 값 반영', () => {
  assert.equal(wheelRotation(0), 0);
  close(wheelRotation(0.5), -32.5);
  assert.equal(wheelRotation(1), -65);
  assert.equal(wheelRotation(1, { ...TUNE_DEFAULTS, rotate: -90 }), -90);
});

test('그라데이션 끝(패널): 32% 기본, 64%로 바꾸면 단계 위치가 전부 2배', () => {
  assert.deepEqual(overlayStops(32), OVERLAY_STOPS);
  assert.deepEqual(overlayStops(64).map((s) => s.at), [0, 18, 32, 44, 64]);
});

test('그라데이션 CSS: 배경색(--bg-1)을 단계별 진하기로 섞는다', () => {
  assert.equal(
    overlayGradient(32),
    'linear-gradient(color-mix(in srgb, var(--bg-1) 0%, transparent) 0%, '
      + 'color-mix(in srgb, var(--bg-1) 23.9%, transparent) 9%, '
      + 'color-mix(in srgb, var(--bg-1) 50.2%, transparent) 16%, '
      + 'color-mix(in srgb, var(--bg-1) 72.2%, transparent) 22%, '
      + 'color-mix(in srgb, var(--bg-1) 100%, transparent) 32%)',
  );
});

test('패널 기본값', () => {
  assert.deepEqual(TUNE_DEFAULTS, { rotate: -65, wheelScale: 1, fadeEnd: 32 });
});
