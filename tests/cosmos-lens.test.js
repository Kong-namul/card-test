import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LENS, LENS_NARROW_PX, lensConfig, lensSample } from '../demos/05-cosmos/lens.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('LENS: 레퍼 LiquidGlass 데스크톱 값 그대로', () => {
  assert.deepEqual(LENS, { glassRadius: 0.35, refraction: 1.3, dispersion: 0.004, distortion: 0.32, motionBoost: 0.2, edgeOffset: 0.09 });
  assert.equal(LENS_NARROW_PX, 1024);
});

test('lensConfig: 폭 1024px 이하면 전부 절반, 넘으면 그대로', () => {
  assert.deepEqual(lensConfig(1440), LENS);
  const narrow = lensConfig(1024);
  for (const key of Object.keys(LENS)) close(narrow[key], LENS[key] / 2);
  close(lensConfig(375, { ...LENS, refraction: 2 }).refraction, 1); // 패널에서 바꾼 값도 절반
});

test('lensSample: 화면 가운데 쪽은 그대로, 가장자리 띠에서만 옮긴다', () => {
  const aspect = 1.6;
  const middle = lensSample(0.5, 0.5, aspect, LENS);
  close(middle.u, 0.5);
  close(middle.v, 0.5);
  assert.equal(middle.mask, 0);
  const clean = lensSample(0.36, 0.62, aspect, LENS); // 좌우 띠(0.35×1.6 = 0.56)·위아래 띠(0.35) 밖
  close(clean.u, 0.36);
  close(clean.v, 0.62);
  const edge = lensSample(0.02, 0.5, aspect, LENS);
  assert.ok(edge.mask > 0.5);
  assert.ok(edge.u > 0.02 + 0.01, `왼쪽 끝은 가운데 쪽 그림을 끌어온다 ${edge.u}`);
  close(edge.v, 0.5);
});

test('lensSample: 좌우·위아래 대칭이고, 늘림을 키우면(빠른 스크롤) 더 많이 옮긴다', () => {
  const aspect = 1.6;
  const left = lensSample(0.02, 0.5, aspect, LENS);
  const right = lensSample(0.98, 0.5, aspect, LENS);
  close(right.u, 1 - left.u);
  const bottom = lensSample(0.5, 0.03, aspect, LENS);
  const top = lensSample(0.5, 0.97, aspect, LENS);
  close(top.v, 1 - bottom.v);
  const boosted = lensSample(0.02, 0.5, aspect, LENS, LENS.distortion + LENS.motionBoost);
  assert.ok(boosted.u > left.u);
});
