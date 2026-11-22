import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHUNK, MAX_BLUR, mulberry32, fieldBox, fieldCount, createField, fieldSlot,
  createFloatState, pushDrag, pushWheel, stepFloat, leanAngles, bob, blurRadius,
  cursorInfluence, stepSpring, spacingDistance, hoverTurn,
} from '../demos/04-floating/layout.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const OPTS = { follow: 0.16, decay: 0.9, maxSpeed: 0.32, wheelKeep: 0.8, driftFollow: 0.12, driftTarget: { x: 0, y: 0 }, dragging: false };
const BOX = fieldBox({ fogFar: 26, fov: 60 });

test('mulberry32: 같은 시드면 같은 난수 순서, 값은 0 이상 1 미만', () => {
  const a = mulberry32(4);
  const b = mulberry32(4);
  for (let i = 0; i < 100; i++) {
    const v = a();
    assert.equal(v, b());
    assert.ok(v >= 0 && v < 1);
  }
});

test('fieldBox: 안개 끝(26)까지 화면에 보이는 범위 + 여유 3, 가로는 화면비 2.4까지 덮는다', () => {
  const half = Math.tan(Math.PI / 6) * 26; // 화각 60° → 반각 30°
  close(BOX.halfY, half + 3);
  close(BOX.halfX, half * 2.4 + 3);
  assert.equal(BOX.zNear, 3);
  assert.equal(BOX.zFar, 27);
});

test('fieldCount: 칸(11×11×11)마다 density장 밀도를 그대로 지킨다 (Codrops 5장)', () => {
  const volume = 2 * BOX.halfX * 2 * BOX.halfY * (BOX.zNear + BOX.zFar);
  const count = fieldCount(5, BOX);
  close((count / volume) * CHUNK ** 3, 5, 0.05);
  assert.ok(Math.abs(fieldCount(10, BOX) - 2 * count) <= 1);
  assert.equal(fieldCount(0, BOX), 1); // 최소 1장
});

test('createField: 같은 시드면 같은 배치, 모두 상자 안, 카드 높이 1.2~2.0', () => {
  const a = createField(200, BOX, 4);
  assert.deepEqual(a, createField(200, BOX, 4));
  for (const c of a) {
    assert.ok(Math.abs(c.x) <= BOX.halfX && Math.abs(c.y) <= BOX.halfY);
    assert.ok(c.z >= -BOX.zFar && c.z <= BOX.zNear);
    assert.ok(c.size >= 1.2 && c.size <= 2.0);
    assert.ok(c.speed >= 0.5 && c.speed <= 0.9);
  }
});

test('fieldSlot: 카메라가 아무리 멀리 가도 카드는 카메라 주변 상자 안으로 접힌다 (끝없는 공간)', () => {
  const card = { x: 5, y: -4, z: -10 };
  for (const cam of [{ x: 0, y: 0, z: 0 }, { x: 1000, y: -730, z: -5000 }, { x: -3.3, y: 12, z: 77 }]) {
    const s = fieldSlot(card, cam, BOX);
    assert.ok(Math.abs(s.x - cam.x) <= BOX.halfX);
    assert.ok(Math.abs(s.y - cam.y) <= BOX.halfY);
    assert.ok(s.z - cam.z >= -BOX.zFar - 1e-9 && s.z - cam.z < BOX.zNear);
  }
  const still = fieldSlot(card, { x: 0, y: 0, z: 0 }, BOX);
  close(still.x, 5);
  close(still.y, -4);
  close(still.z, -10);
  assert.equal(still.fade, 1);
});

test('fieldSlot: 상자 가장자리 근처 카드는 작아지며 사라진다 (반대편으로 넘어가는 순간이 안 보이게)', () => {
  assert.ok(fieldSlot({ x: BOX.halfX - 0.5, y: 0, z: -5 }, { x: 0, y: 0, z: 0 }, BOX).fade < 0.2);
  assert.equal(fieldSlot({ x: BOX.halfX - 3, y: 0, z: -5 }, { x: 0, y: 0, z: 0 }, BOX).fade, 1);
});

test('stepFloat: 60fps 한 프레임 = Codrops 공식 그대로 (속도 16% 따라가기 → 이동 → 목표 속도 0.9배)', () => {
  const s = createFloatState();
  s.target.x = 0.1;
  stepFloat(s, OPTS, 1 / 60);
  close(s.velocity.x, 0.016);
  close(s.base.x, 0.016);
  close(s.target.x, 0.09);
});

test('stepFloat: 휠로 쌓인 양은 첫 프레임에 전부 목표 속도로 들어가고, 남은 양은 0.8배', () => {
  const s = createFloatState();
  s.wheel = -0.05;
  stepFloat(s, OPTS, 1 / 60);
  close(s.wheel, -0.04);
  close(s.velocity.z, -0.05 * 0.16);
  close(s.target.z, -0.05 * 0.9);
});

test('stepFloat: 목표 속도는 ±0.32를 넘지 않는다 (Codrops 3.2 ÷ 10)', () => {
  const s = createFloatState();
  s.target.y = 5;
  stepFloat(s, OPTS, 1 / 60);
  close(s.velocity.y, 0.32 * 0.16);
});

test('stepFloat: 120Hz 화면에서 반 프레임 두 번 ≈ 60Hz 한 프레임 (프레임레이트 보정)', () => {
  const a = createFloatState();
  const b = createFloatState();
  a.target.x = b.target.x = 0.2;
  a.wheel = b.wheel = 0.1;
  for (let i = 0; i < 30; i++) stepFloat(a, OPTS, 1 / 60);
  for (let i = 0; i < 60; i++) stepFloat(b, OPTS, 1 / 120);
  close(a.base.x, b.base.x, Math.abs(a.base.x) * 0.06);
  close(a.base.z, b.base.z, Math.abs(a.base.z) * 0.06);
});

test('stepFloat: 마우스 시점은 커서 쪽으로 12%씩, 드래그 중엔 그 자리에 멈춘다', () => {
  const s = createFloatState();
  stepFloat(s, { ...OPTS, driftTarget: { x: 0.8, y: -0.4 } }, 1 / 60);
  close(s.drift.x, 0.8 * 0.12);
  close(s.drift.y, -0.4 * 0.12);
  const before = { ...s.drift };
  stepFloat(s, { ...OPTS, dragging: true }, 1 / 60);
  assert.deepEqual(s.drift, before);
});

test('pushDrag·pushWheel: 끄는 쪽으로 카드가 따라오고(카메라는 반대로), 휠 아래 = 앞으로(−z)', () => {
  const s = createFloatState();
  pushDrag(s, 100, 40, 0.0025);
  close(s.target.x, -0.25); // 오른쪽으로 끌면 카메라는 왼쪽 → 카드가 손 따라 오른쪽
  close(s.target.y, 0.1);   // 아래로 끌면 카메라는 위 → 카드가 손 따라 아래
  pushWheel(s, 100, 0.0006);
  close(s.wheel, -0.06);
});

test('leanAngles: 카드가 화면에서 흐르는 쪽 가장자리가 뒤로 눕고, ±0.5rad를 넘지 않는다', () => {
  const right = leanAngles({ x: 0.32, y: 0 }, 1); // 카메라 → 이동, 카드는 화면에서 ← 로 흐름
  close(right.rotY, -0.32);
  close(right.rotX, 0);
  close(leanAngles({ x: 0, y: 0.1 }, 1).rotX, 0.1);
  close(leanAngles({ x: -3, y: 0 }, 1).rotY, 0.5);
  close(leanAngles({ x: 0.3, y: 0.3 }, 0).rotY, 0);
});

test('bob: 세기 0이면 가만히, 아니면 ±세기 안에서 카드마다 다른 박자로', () => {
  const card = { phase: 1, speed: 0.7 };
  close(bob(card, 3, 0).y, 0);
  for (let t = 0; t < 20; t += 0.37) assert.ok(Math.abs(bob(card, t, 0.15).y) <= 0.15);
  assert.notEqual(bob(card, 1, 0.15).y, bob({ phase: 2.5, speed: 0.6 }, 1, 0.15).y);
});

test('blurRadius: 초점 거리에선 0, 멀어질수록 |거리 − 초점|에 비례해 퍼지고 상한이 있다', () => {
  close(blurRadius(7, 7, 1), 0);
  close(blurRadius(20, 7, 1), 13 * 0.027);
  close(blurRadius(2, 7, 1), 5 * 0.027);
  close(blurRadius(100, 7, 1), MAX_BLUR);
  close(blurRadius(20, 7, 0), 0);
});

test('fieldBox: 카드를 키우면 화면 밖 여유도 그만큼 늘린다 (큰 카드가 화면 옆에서 툭 생기지 않게)', () => {
  const big = fieldBox({ fogFar: 26, fov: 60, cardScale: 1.6 });
  close(big.halfY - BOX.halfY, 0.6);
  close(big.halfX - BOX.halfX, 0.6);
});

test('cursorInfluence: 커서 바로 위 카드는 1, 반경 밖은 0, 큰 카드는 가장자리부터 잰다', () => {
  close(cursorInfluence({ x: 0.2, y: 0.1 }, { x: 0.2, y: 0.1 }, 1.6, 0.45), 1);
  close(cursorInfluence({ x: 0, y: 0 }, { x: 0, y: 0.6 }, 1.6, 0.45), 0);
  const mid = cursorInfluence({ x: 0, y: 0 }, { x: 0, y: 0.2 }, 1.6, 0.45);
  assert.ok(mid > 0 && mid < 1);
  // 화면 좌표는 가로·세로 모두 −1~1이라, 넓은 화면에선 같은 0.2라도 가로가 더 먼 거리
  assert.ok(cursorInfluence({ x: 0, y: 0 }, { x: 0.2, y: 0 }, 1.6, 0.45) < mid);
  // 카드 반 크기 0.2 → 커서가 카드 가장자리 안쪽이면 1
  close(cursorInfluence({ x: 0, y: 0 }, { x: 0, y: 0.15 }, 1.6, 0.45, 0.2), 1);
});

test('stepSpring: 목표로 가다가 살짝 지나쳤다 돌아와서 멈춘다 (종이 탄성)', () => {
  const s = { value: 0, velocity: 0 };
  let peak = 0;
  for (let i = 0; i < 240; i++) {
    stepSpring(s, 1, 1 / 60);
    peak = Math.max(peak, s.value);
  }
  close(s.value, 1, 1e-3);
  assert.ok(peak > 1 && peak < 1.25);
});

test('spacingDistance: 상자 경계를 넘어 접히는 것까지 치고, 앞뒤 차이는 0.35만 쳐준다', () => {
  close(spacingDistance({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 }, BOX), 5);
  close(spacingDistance({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -10 }, BOX), 3.5);
  // 상자 오른쪽 끝과 왼쪽 끝 카드는 접히면 바로 옆이라 가깝다
  close(spacingDistance({ x: BOX.halfX - 0.5, y: 0, z: 0 }, { x: -BOX.halfX + 0.5, y: 0, z: 0 }, BOX), 1);
});

test('createField: 간격(minDist)을 주면 모든 카드 쌍이 그 이상 떨어진다 (겹침 방지)', () => {
  const box = fieldBox({ fogFar: 26, fov: 60, cardScale: 1.6 });
  const count = fieldCount(1.5, box);
  const cards = createField(count, box, 7, { minDist: 3.5 });
  assert.equal(cards.length, count);
  let nearest = Infinity;
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) nearest = Math.min(nearest, spacingDistance(cards[i], cards[j], box));
  }
  assert.ok(nearest >= 3.5, `가장 가까운 쌍 ${nearest}`);
  assert.deepEqual(cards, createField(count, box, 7, { minDist: 3.5 })); // 같은 시드면 같은 배치
});

test('hoverTurn: 커서가 카드 정중앙이면 정면, 옆에 있으면 그쪽을 바라보고(오른쪽 → rotY+, 위 → rotX−), 상한이 있다', () => {
  const center = hoverTurn(0, 0, 4, 0.3);
  close(center.rotX, 0);
  close(center.rotY, 0);
  close(hoverTurn(1, 0, 4, 0.3).rotY, Math.atan2(1, 4));
  close(hoverTurn(0, 1, 4, 0.3).rotX, -Math.atan2(1, 4));
  close(hoverTurn(100, -100, 4, 0.3).rotY, 0.3);
  close(hoverTurn(100, -100, 4, 0.3).rotX, 0.3);
});
