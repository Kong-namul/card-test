import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clamp, lerp, damp, smoothstep, easeOutCubic, easeInOutCubic,
  depthDim, magnetOffset, Inertia, Momentum, wrapCentered,
} from '../shared/motion.js';

// 부동소수점 비교용: 아주 작은 오차는 같은 값으로 본다
const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('clamp는 범위 밖 값을 경계로 자른다', () => {
  assert.equal(clamp(5, 0, 1), 1);
  assert.equal(clamp(-1, 0, 1), 0);
  close(clamp(0.3, 0, 1), 0.3);
});

test('lerp는 t=0이면 a, t=1이면 b, 중간이면 사이값', () => {
  close(lerp(2, 10, 0), 2);
  close(lerp(2, 10, 1), 10);
  close(lerp(2, 10, 0.5), 6);
});

test('damp는 프레임을 둘로 쪼개도 결과가 같다 (프레임레이트 무관)', () => {
  const once = damp(0, 10, 8, 0.1);
  const twice = damp(damp(0, 10, 8, 0.05), 10, 8, 0.05);
  close(once, twice);
  assert.ok(once > 0 && once < 10);
});

test('smoothstep 경계 밖은 0과 1, 가운데는 0.5', () => {
  close(smoothstep(0, 1, -1), 0);
  close(smoothstep(0, 1, 2), 1);
  close(smoothstep(0, 1, 0.5), 0.5);
});

test('이징 함수는 0→0, 1→1, 범위 밖은 잘린다', () => {
  close(easeOutCubic(0), 0);
  close(easeOutCubic(1), 1);
  close(easeOutCubic(2), 1);
  close(easeInOutCubic(0), 0);
  close(easeInOutCubic(1), 1);
  close(easeInOutCubic(0.5), 0.5);
});

test('depthDim: 정면 1, 정반대 뒤는 최소 밝기, 옆은 0.5', () => {
  close(depthDim(1, 0.3), 1);
  close(depthDim(-1, 0.3), 0.3);
  close(depthDim(0, 0.3), 0.5);
});

test('magnetOffset: 세기 0이면 그대로, 멀면 거의 0, 가까우면 커서 쪽으로', () => {
  const none = magnetOffset(0, 0, 1, 0, 0, 3);
  close(none.x, 0);
  close(none.y, 0);
  const far = magnetOffset(0, 0, 100, 0, 0.1, 3);
  close(far.x, 0, 1e-9);
  const near = magnetOffset(0, 0, 1, 0, 0.1, 3);
  close(near.x, 0.1 * Math.exp(-1 / 9));
  close(near.y, 0);
});

test('Inertia는 목표를 서서히 따라가고, 속도가 생겼다가 멈추면 사라진다', () => {
  const inertia = new Inertia({ follow: 8 });
  inertia.target = 10;
  inertia.update(1 / 60);
  assert.ok(inertia.current > 0 && inertia.current < 10);
  assert.ok(inertia.velocity > 0);
  for (let i = 0; i < 600; i++) inertia.update(1 / 60);
  close(inertia.current, 10, 1e-3);
  assert.ok(Math.abs(inertia.velocity) < 0.01);
});

test('Momentum: 드래그한 만큼 바로 따라가고, 놓으면 미끄러지다 멈춘다', () => {
  const m = new Momentum({ friction: 3 });
  m.drag(0.1, 1 / 60);
  close(m.value, 0.1);
  assert.ok(m.velocity > 0);
  const afterDrag = m.value;
  m.update(1 / 60, false);
  assert.ok(m.value > afterDrag); // 놓은 뒤에도 같은 방향으로 미끄러짐
  for (let i = 0; i < 1200; i++) m.update(1 / 60, false);
  assert.equal(m.velocity, 0);    // 마찰로 완전히 멈춤
  assert.ok(Number.isFinite(m.value));
});

test('Momentum: 누르고 가만히 있으면 움직이지 않고, 그 상태로 놓으면 던져지지 않는다', () => {
  const m = new Momentum({ friction: 3 });
  m.drag(0.1, 1 / 60);
  const held = m.value;
  for (let i = 0; i < 60; i++) m.update(1 / 60, true); // 1초 동안 누른 채 정지
  close(m.value, held);
  assert.ok(Math.abs(m.velocity) < 0.01);
});

test('wrapCentered: 공통 motion.js에서 값을 [-주기/2, 주기/2) 안으로 접는다', () => {
  assert.equal(wrapCentered(6, 10), -4);
  assert.equal(wrapCentered(-6, 10), 4);
  assert.equal(wrapCentered(23, 10), 3);
});
