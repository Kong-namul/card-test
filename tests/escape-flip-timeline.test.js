import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  STAGGER, ESCAPE, RETURN, FLOAT, TINY, TUNE_DEFAULTS,
  escapeKeyframes, returnKeyframes, reducedEscapeKeyframes, reducedReturnKeyframes,
  veilOpacity, tinyFill, escapeDelay, returnDelay,
} from '../demos/06-escape-flip/timeline.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const closeAll = (list, expected) => list.forEach((value, i) => close(value, expected[i]));

const escapeSize = { cardWidth: 100, cardHeight: 142, sectionHeight: 900 };
const returnSize = { cardWidth: 200, viewportHeight: 1000 };
const all = (make) => [0, 1, 2].map(make);

test('원본 숫자: 카드 시차 0.012, 둥실 ±3% · 1.5~2.5초 · sine.inOut, 구간 offset 0%/25% · 5%/75%', () => {
  assert.equal(STAGGER, 0.012);
  assert.deepEqual(FLOAT, { amount: 3, durationMin: 1.5, durationMax: 2.5, ease: 'sine.inOut' });
  assert.deepEqual(ESCAPE.window, { startOffset: 0, endOffset: 0.25 });
  assert.deepEqual(RETURN.window, { startOffset: 0.05, endOffset: 0.75 });
});

test('패널 기본값은 원본 숫자 (둥실 3, 부채꼴 12°, 모이기 0.9, 눕기 16°, 뒤집기 넘침 10°) + 원근 1200 · 영상에서 잰 사라짐·나타남 구간', () => {
  assert.deepEqual(TUNE_DEFAULTS, {
    float: 3, fanAngle: 12, gather: 0.9, tilt: 16, overshoot: 10, perspective: 1200,
    veilStart: 0.33, veilEnd: 0.53, appearStart: 0.1, appearEnd: 0.21,
  });
});

test('탈출 75%: 바깥 두 장이 카드폭 0.9배만큼 가운데로 모이며 −12 / 0 / 12° 부채꼴', () => {
  const frames = all((i) => escapeKeyframes(i, escapeSize));
  closeAll(frames.map((f) => f['75%'].x), [90, 0, -90]);
  assert.deepEqual(frames.map((f) => f['75%'].rotationZ), [-12, 0, 12]);
});

test('탈출 100%: 구간 아래까지 가라앉되 16 / 32 / 48px 덜, 0.85배, 뒤로 −16°', () => {
  const frames = all((i) => escapeKeyframes(i, escapeSize));
  assert.deepEqual(frames.map((f) => f['100%'].y), [900 - 142 - 16, 900 - 142 - 32, 900 - 142 - 48]);
  frames.forEach((f) => {
    assert.equal(f['100%'].scale, 0.85);
    assert.equal(f['100%'].rotateX, -16);
  });
});

test('귀환 0%: 화면 높이 × −0.75 + 1px 위에서, 한 줄 자리(카드폭 1.15배)를 지워 세 장이 가운데 겹치고, 0.2배 · 12 / 0 / −12° · 앞으로 24°', () => {
  const frames = all((i) => returnKeyframes(i, returnSize));
  closeAll(frames.map((f) => f['0%'].x), [-230, 0, 230]); // index 0이 오른쪽 자리(+1.15w) → −1.15w로 가운데
  assert.deepEqual(frames.map((f) => f['0%'].rotationZ), [12, 0, -12]);
  frames.forEach((f) => {
    assert.equal(f['0%'].y, -749);
    assert.equal(f['0%'].scale, 0.2);
    assert.equal(f['0%'].rotateX, 24);
  });
  assert.equal(RETURN.gapRatio, 1.15);
});

test('귀환 40%: 카드 높이 20% 자리로 내려앉아 0.8배, 기울기 5 / 0 / −5°, 똑바로', () => {
  const frames = all((i) => returnKeyframes(i, returnSize));
  assert.deepEqual(frames.map((f) => f['40%'].rotationZ), [5, 0, -5]);
  frames.forEach((f) => {
    assert.equal(f['40%'].y, '20%');
    assert.equal(f['40%'].scale, 0.8);
    assert.equal(f['40%'].rotationY, 0);
    assert.equal(f['40%'].rotateX, 0);
  });
});

test('귀환 55%: 잠깐 멈춤 — y 0, x는 그 순간 x 그대로 (콜백을 그대로 넘긴다)', () => {
  const currentX = () => 123;
  const frame = returnKeyframes(0, returnSize, TUNE_DEFAULTS, currentX)['55%'];
  assert.equal(frame.x, currentX);
  assert.equal(frame.y, 0);
  assert.equal(frame.rotationY, 0);
});

test('귀환 75% · 82% · 100%: 한 줄로 벌어지며 −190° 뒤집혔다 −180°로 착, 마지막에 기울기 0', () => {
  all((i) => returnKeyframes(i, returnSize)).forEach((f) => {
    assert.deepEqual(f['75%'], { x: 0, rotationZ: 0, rotationY: -190, scale: 1 });
    assert.deepEqual(f['82%'], { rotationY: -180 });
    assert.deepEqual(f['100%'], { rotationZ: 0 });
  });
});

test('패널 값이 키프레임에 들어간다: 부채꼴 각도 · 모이는 정도 · 눕는 각도 · 뒤집기 넘침', () => {
  const tune = { ...TUNE_DEFAULTS, fanAngle: 24, gather: 0.5, tilt: 30, overshoot: 20 };
  const escape = escapeKeyframes(0, escapeSize, tune);
  close(escape['75%'].x, 50);
  assert.equal(escape['75%'].rotationZ, -24);
  assert.equal(escape['100%'].rotateX, -30);
  const back = returnKeyframes(0, returnSize, tune);
  assert.equal(back['0%'].rotationZ, 24);
  assert.equal(back['40%'].rotationZ, 10);
  assert.equal(back['75%'].rotationY, -200);
  assert.equal(back['82%'].rotationY, -180);
});

test('시차 순서: 탈출은 왼쪽(라벤더)부터, 귀환은 맨 앞에 그려지는 마지막 카드(라벤더)부터 0.012씩 — 원본 영상 기준', () => {
  // 원본 영상에선 두 장면 모두 라벤더가 맨 앞이고 제일 먼저 움직여서(제일 아래·제일 큼) 뒤 카드가 오른쪽 위로 삐죽 나온다
  assert.deepEqual([0, 1, 2].map((i) => escapeDelay(i)), [0, 0.012, 0.024]);
  closeAll([0, 1, 2].map((i) => returnDelay(i, 3)), [0.024, 0.012, 0]);
});

test('동작 줄이기: 탈출은 24px 내려가며 흐려지기만, 귀환은 제자리에서 나타나기만', () => {
  assert.deepEqual(reducedEscapeKeyframes(), { '100%': { y: 24, opacity: 0 } });
  assert.deepEqual(reducedReturnKeyframes(), { '0%': { opacity: 0 }, '40%': { opacity: 1 } });
});

test('막 불투명도: 구간 시작 전엔 0, 시작부터 끝까지 0 → 1, 끝 뒤엔 1', () => {
  assert.equal(veilOpacity(0.2, 0.33, 0.53), 0);
  assert.equal(veilOpacity(0.33, 0.33, 0.53), 0);
  close(veilOpacity(0.43, 0.33, 0.53), 0.5);
  assert.equal(veilOpacity(0.53, 0.33, 0.53), 1);
  assert.equal(veilOpacity(0.9, 0.33, 0.53), 1);
  assert.equal(veilOpacity(0.49, 0.5, 0.5), 0); // 시작 = 끝이면 그 순간 확 바뀐다
  assert.equal(veilOpacity(0.5, 0.5, 0.5), 1);
});

test('원본 영상에서 잰 사라짐·나타남 구간: 탈출 33~53%에 덮이고, 귀환 10~21%에 걷힌다', () => {
  // Codrops 05번 영상: 탈출 카드는 1.15~1.35초(진행도 약 0.35~0.53)에 사라지고,
  // 귀환 카드는 2.55~3.5초(진행도 약 0.10~0.21)에 나타난다 (픽셀로 잼)
  assert.deepEqual(ESCAPE.veil, { start: 0.33, end: 0.53 });
  assert.deepEqual(RETURN.appear, { start: 0.1, end: 0.21 });
  assert.equal(TUNE_DEFAULTS.veilStart, ESCAPE.veil.start);
  assert.equal(TUNE_DEFAULTS.veilEnd, ESCAPE.veil.end);
  assert.equal(TUNE_DEFAULTS.appearStart, RETURN.appear.start);
  assert.equal(TUNE_DEFAULTS.appearEnd, RETURN.appear.end);
});

test('미니카드: 진행도 1/3마다 한 장씩 아래→위로 차오르고, 덜 찬 만큼 4px 아래에 있다', () => {
  assert.deepEqual(TINY, { segments: [0, 0.33, 0.66], speed: 3, lift: 4 });
  assert.deepEqual(tinyFill(0, 0), { fill: 0, lift: 4 });
  close(tinyFill(0.165, 0).fill, 0.495);
  close(tinyFill(0.165, 0).lift, 4 * (1 - 0.495));
  assert.equal(tinyFill(0.34, 0).fill, 1);
  assert.equal(tinyFill(0.33, 1).fill, 0);
  close(tinyFill(0.5, 1).fill, 0.51);
  assert.equal(tinyFill(0.6, 2).fill, 0);
  assert.deepEqual(tinyFill(1, 2), { fill: 1, lift: 0 });
});
