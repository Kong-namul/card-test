# 04 플로팅 필드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 휘어진 종이 카드가 어두운 공간 앞뒤로 흩어져 둥실 떠 있고, 드래그·휠로 그 사이를 헤엄치듯 끝없이 돌아다니는 04 데모를 만든다.

**Architecture:** 숫자 계산(배치·접기·카메라 관성·기울기·둥실·흐림 반경)은 `demos/04-floating/layout.js`에 Three.js 없이 모아 Node로 테스트한다. 장면은 01~03 공통 부품(stage, card-material, card-geometry, panel, texture-panel)을 그대로 쓰고, 공통 카드 재질에 카드별 "가장자리 퍼짐(instanceSoft)"을 추가해 초점 흐림을 카드마다 준다. 끝없는 공간은 03의 `wrapCentered`를 공통 `motion.js`로 옮겨서 카메라 주변 상자 안으로 카드를 접는 방식.

**Tech Stack:** Three.js 0.187.0 (CDN importmap), lil-gui(공통 panel.js), Node 내장 테스트 러너.

## Global Constraints

- 반말 주석·문구, 한국어 주석 자세히(학습용).
- 색·폰트는 `shared/tokens.css` 토큰만 (배경·안개 = `--bg-1`). 새 토큰 필요하면 사용자에게 먼저 묻기.
- 공통 JS/CSS를 고치면 import하는 모든 곳의 `?v=`를 올린다.
- 타이틀 단색, 폰트 사이즈는 타입 스케일(공통 base.css가 처리).
- 레퍼런스 코드는 복사 금지, 기법·숫자만 (Codrops Infinite Canvas: 단위 ÷ 10).
- git 저장소 아님 → 커밋 단계 없음.

## File Structure

- Modify `shared/motion.js` (v2→v3): `wrapCentered` 이사 옴.
- Modify `shared/card-material.js` (v3→v4): `instanceSoft` 가장자리 퍼짐.
- Modify `shared/card-geometry.js` (v1→v2): `instanceSoft` 속성 + `setSoft`.
- Modify `shared/stack-choreography.js` (v2→v3), `shared/texture-panel.js` (v1→v2): 버전 연쇄.
- Modify `demos/03-tunnel/layout.js`: `wrapCentered`를 공통에서 가져와 다시 내보냄.
- Modify 01/02/03 `main.js`·`layout.js`·`index.html`: import 버전 올림.
- Create `demos/04-floating/layout.js`, `demos/04-floating/main.js`, `demos/04-floating/index.html`.
- Create `tests/floating-layout.test.js`; Modify `tests/motion.test.js`.
- Modify `index.html`(아카이브): 04를 링크·완성으로.

---

### Task 1: wrapCentered를 공통으로 옮기기

**Files:** Modify `shared/motion.js`, `demos/03-tunnel/layout.js`, `tests/motion.test.js`

**Interfaces:** Produces `wrapCentered(value, period) → number` in `shared/motion.js` (값을 [-period/2, period/2)로 접음).

- [ ] **Step 1: 실패하는 테스트** — `tests/motion.test.js` import에 `wrapCentered` 추가 후:

```js
test('wrapCentered: 공통 motion.js에서 값을 [-주기/2, 주기/2) 안으로 접는다', () => {
  assert.equal(wrapCentered(6, 10), -4);
  assert.equal(wrapCentered(-6, 10), 4);
  assert.equal(wrapCentered(23, 10), 3);
});
```

- [ ] **Step 2:** `npm test` → FAIL (wrapCentered 없음)
- [ ] **Step 3:** `shared/motion.js`의 `lerp` 아래에 추가:

```js
// 값을 [-주기/2, 주기/2) 안으로 접는다. 넘어간 카드를 반대편으로 돌려보내서
// 끝없는 루프·공간을 만들 때 쓴다 (03 터널에서 공통으로 옮겨옴)
export function wrapCentered(value, period) {
  const half = period / 2;
  return ((((value + half) % period) + period) % period) - half;
}
```

`demos/03-tunnel/layout.js`: 자체 `wrapCentered` 정의를 지우고 맨 위 import를 `import { smoothstep, wrapCentered } from '../../shared/motion.js?v=3';` + `export { wrapCentered };`로.

- [ ] **Step 4:** `npm test` → PASS (터널 테스트의 wrapCentered도 그대로 통과)

### Task 2: 카드별 가장자리 퍼짐 (공통 재질·묶음)

**Files:** Modify `shared/card-material.js`, `shared/card-geometry.js`

**Interfaces:** Produces `cards.setSoft(i, value)` (카드 자기 좌표 기준 퍼짐 폭, 0이면 지금과 동일).

- [ ] **Step 1:** `card-material.js` 정점 셰이더 `#include <common>`에 `attribute float instanceSoft; varying float vInstanceSoft;`, `begin_vertex` 끝에 `vInstanceSoft = instanceSoft;`, 픽셀 셰이더 `common`에 `varying float vInstanceSoft;`, 둥근 모서리 부분 `float aa = max(fwidth(d), vInstanceSoft);`, 캐시 키 `'card-instanced-dim-flip-round-soft'`, 머리 주석에 4) 추가.
- [ ] **Step 2:** `card-geometry.js`에 `instanceSoft` InstancedBufferAttribute(0으로 채움, DynamicDrawUsage), `setSoft(i, v)`, `commit()`에서 `soft.needsUpdate = true`.
- [ ] **Step 3:** 버전 연쇄 — motion v3, card-material v4, card-geometry v2, stack-choreography v3, texture-panel v2를 01/02/03과 shared에서 모두 교체, 01 layout v6, 02 layout v3, 03 layout v3, 01 main v16, 02 main v6, 03 main v18.
- [ ] **Step 4:** 브라우저로 01·02·03 열어 콘솔 에러 0, 모양 그대로인지 확인.

### Task 3: 04 숫자 계산 (layout.js)

**Files:** Create `demos/04-floating/layout.js`, `tests/floating-layout.test.js`

**Interfaces:** Produces `CHUNK`, `MAX_BLUR`, `mulberry32(seed)`, `fieldBox({fogFar, fov}) → {halfX, halfY, zNear, zFar}`, `fieldCount(density, box)`, `createField(count, box, seed) → [{x,y,z,size,phase,speed}]`, `fieldSlot(card, cam, box) → {x,y,z,fade}`, `createFloatState()`, `pushDrag(state, dx, dy, perPx)`, `pushWheel(state, delta, perPx)`, `stepFloat(state, opts, dt)`, `leanAngles(velocity, strength) → {rotX, rotY}`, `bob(card, time, amount) → {y, roll}`, `blurRadius(distance, focus, strength)`.

- [ ] **Step 1: 실패하는 테스트**

```js
// FILE: tests/floating-layout.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHUNK, MAX_BLUR, mulberry32, fieldBox, fieldCount, createField, fieldSlot,
  createFloatState, pushDrag, pushWheel, stepFloat, leanAngles, bob, blurRadius,
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
```

- [ ] **Step 2:** `npm test` → FAIL (모듈 없음)
- [ ] **Step 3: 구현**

```js
// FILE: demos/04-floating/layout.js
// ─────────────────────────────────────────────────────────────
// layout.js — 04 플로팅 필드: 공간에 흩뿌린 카드 위치 + 헤엄치는 카메라 움직임 (Three.js 없이 숫자만)
// 참고: Codrops "Infinite Canvas" (Edoardo Lunardi) — 코드 복사 없이 기법·숫자만. 단위는 레퍼 ÷ 10
//       Framer "Depth Drift Gallery" (Konstantin Nikolaev) — 먼 카드 흐림·진행 방향 기울기 아이디어만
// ─────────────────────────────────────────────────────────────
import { clamp, smoothstep, wrapCentered } from '../../shared/motion.js?v=3';

export const CHUNK = 11;            // 레퍼 칸 크기 110 ÷ 10. 이 정육면체마다 카드 density장 (레퍼 5장)
export const MAX_ASPECT = 2.4;      // 이 화면비(가로÷세로)까지는 화면 옆에서 카드가 툭 생기지 않게 상자를 넓힌다
const BEHIND = 3;                   // 카메라 뒤쪽 여유: 막 지나친 카드가 바로 반대편으로 안 넘어가게
const MARGIN = 3;                   // 화면 밖 여유: 마우스 시점(0.8) + 카드 반 크기(1) + 둥실
const EDGE_BAND = 2;                // 상자 가장자리에서 이만큼 구간은 카드가 작아지며 사라진다
export const BLUR_PER_UNIT = 0.027; // 흐림 세기 1: 초점에서 1 멀어질 때마다 가장자리가 0.027씩 퍼진다
export const MAX_BLUR = 0.45;       // 가장자리 퍼짐 상한 (카드 높이가 1.2~2.0)
const LEAN_LIMIT = 0.5;             // 기울기 상한 (라디안, 약 29°)

// 같은 숫자(seed)를 넣으면 항상 같은 순서로 나오는 난수 → 열 때마다 같은 배치
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 카메라 주변 상자 크기: 안개가 끝나는 거리(fogFar)까지 화면에 보이는 범위 + 여유
//   세로 반폭 = tan(화각/2) × fogFar, 가로 반폭 = 세로 반폭 × 화면비 2.4
//   앞쪽은 안개 끝보다 1 더 (거기서 접히면 이미 안개 속이라 안 보임), 뒤쪽은 3
export function fieldBox({ fogFar, fov }) {
  const halfView = Math.tan((fov * Math.PI) / 360) * fogFar;
  return {
    halfX: halfView * MAX_ASPECT + MARGIN,
    halfY: halfView + MARGIN,
    zNear: BEHIND,
    zFar: fogFar + 1,
  };
}

// 밀도 → 카드 수: 칸(11³)마다 density장 × 상자 부피. 레퍼는 칸을 만들고 지우지만 우리는 상자 하나로 끝
export function fieldCount(density, box) {
  const volume = 2 * box.halfX * 2 * box.halfY * (box.zNear + box.zFar);
  return Math.max(1, Math.round((density / CHUNK ** 3) * volume));
}

// 카드 count장을 상자 안에 고르게 흩뿌린다 (처음 카메라 위치 기준 좌표).
//   size: 카드 높이 1.2~2.0 (레퍼 12~20), phase·speed: 카드마다 다른 둥실 박자 (0.5~0.9)
export function createField(count, box, seed = 4) {
  const random = mulberry32(seed);
  const cards = [];
  for (let i = 0; i < count; i++) {
    cards.push({
      x: (random() * 2 - 1) * box.halfX,
      y: (random() * 2 - 1) * box.halfY,
      z: -box.zFar + random() * (box.zNear + box.zFar),
      size: 1.2 + random() * 0.8,
      phase: random() * Math.PI * 2,
      speed: 0.5 + random() * 0.4,
    });
  }
  return cards;
}

// 카드의 지금 위치: 카메라(cam)가 어디로 가든 카드는 카메라 주변 상자 안으로 접힌다 → 끝없는 공간.
// 우리 카드는 무늬가 없어서 같은 카드가 반대편에서 다시 나와도 티가 안 난다.
//   fade: 상자 옆 가장자리 2만큼 구간에서 1→0 (카드 크기에 곱해서 작아지며 사라지게)
export function fieldSlot(card, cam, box) {
  const depth = box.zNear + box.zFar;
  const zCenter = (box.zNear - box.zFar) / 2;
  const rx = wrapCentered(card.x - cam.x, box.halfX * 2);
  const ry = wrapCentered(card.y - cam.y, box.halfY * 2);
  const rz = wrapCentered(card.z - cam.z - zCenter, depth) + zCenter;
  const fade = (1 - smoothstep(box.halfX - EDGE_BAND, box.halfX, Math.abs(rx)))
    * (1 - smoothstep(box.halfY - EDGE_BAND, box.halfY, Math.abs(ry)));
  return { x: cam.x + rx, y: cam.y + ry, z: cam.z + rz, fade };
}

// 카메라 움직임 상태: 위치(base) · 실제 속도 · 목표 속도 · 휠 누적분 · 마우스 시점(drift)
export function createFloatState() {
  return {
    base: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    target: { x: 0, y: 0, z: 0 },
    wheel: 0,
    drift: { x: 0, y: 0 },
  };
}

// 드래그: 손을 따라 카드가 움직이도록 카메라 목표 속도는 반대로 (화면 y는 아래가 +라서 y는 그대로 더함)
export function pushDrag(state, dxPx, dyPx, perPx) {
  state.target.x -= dxPx * perPx;
  state.target.y += dyPx * perPx;
}

// 휠: 아래로 굴리면 앞으로(화면 안쪽, −z) 파고든다. 레퍼는 반대(뒤로)였는데 "파고들기"가 더 자연스러워서 뒤집음
export function pushWheel(state, deltaPx, perPx) {
  state.wheel -= deltaPx * perPx;
}

// 매 프레임 카메라 움직임 — Codrops 숫자는 60fps 한 프레임 기준이라 프레임 시간으로 보정한다.
//   opts: follow(0.16) · decay(0.9) · maxSpeed(0.32) · wheelKeep(0.8) · driftFollow(0.12) · driftTarget · dragging
export function stepFloat(state, opts, dt) {
  const frames = dt * 60;
  // 1) 휠 누적분을 목표 속도(z)로 흘려보낸다: 60fps면 한 프레임에 전부 더하고 남은 양은 0.8배
  const keep = Math.pow(opts.wheelKeep, frames);
  state.target.z += state.wheel * ((1 - keep) / (1 - opts.wheelKeep));
  state.wheel *= keep;
  // 2) 실제 속도가 목표 속도를 따라가고(쫀득함) → 위치 이동 → 목표 속도는 줄어든다(손 떼면 미끄러지다 멈춤)
  const follow = 1 - Math.pow(1 - opts.follow, frames);
  const decay = Math.pow(opts.decay, frames);
  for (const axis of ['x', 'y', 'z']) {
    state.target[axis] = clamp(state.target[axis], -opts.maxSpeed, opts.maxSpeed);
    state.velocity[axis] += (state.target[axis] - state.velocity[axis]) * follow;
    state.base[axis] += state.velocity[axis] * frames;
    state.target[axis] *= decay;
  }
  // 3) 마우스 시점: 드래그 중엔 그 자리에 멈추고, 아니면 커서 쪽으로 스르르
  if (!opts.dragging) {
    const driftFollow = 1 - Math.pow(1 - opts.driftFollow, frames);
    state.drift.x += (opts.driftTarget.x - state.drift.x) * driftFollow;
    state.drift.y += (opts.driftTarget.y - state.drift.y) * driftFollow;
  }
  return state;
}

// 진행 방향으로 카드 기울이기 (Depth Drift 아이디어): 카드가 화면에서 흘러가는 쪽 가장자리가 살짝 뒤로 눕는다.
//   카메라가 +x로 가면 카드는 화면에서 ← 로 흐른다 → 왼쪽 가장자리가 뒤로 (rotY 음수)
//   strength 1이면 최고 속도(0.32)에서 0.32rad ≈ 18°
export function leanAngles(velocity, strength) {
  return {
    rotX: clamp(velocity.y * strength, -LEAN_LIMIT, LEAN_LIMIT),
    rotY: clamp(-velocity.x * strength, -LEAN_LIMIT, LEAN_LIMIT),
  };
}

// 둥실둥실: 카드마다 다른 박자로 위아래 + 살짝 갸웃 (갸웃은 세기의 1/4 라디안)
export function bob(card, time, amount) {
  const t = time * card.speed + card.phase;
  return { y: Math.sin(t) * amount, roll: Math.sin(t * 0.7 + 1.3) * amount * 0.25 };
}

// 카드별 초점 흐림 반경 (공간 단위).
// 렌즈에서 흐림 원 크기를 "그 거리에서의 공간 크기"로 바꾸면 거리가 약분돼서 |거리 − 초점|에 비례한다.
export function blurRadius(distance, focus, strength) {
  return Math.min(MAX_BLUR, Math.abs(distance - focus) * BLUR_PER_UNIT * strength);
}
```

- [ ] **Step 4:** `npm test` → PASS

### Task 4: 04 페이지·장면·패널 + 카드별 초점 흐림

**Files:** Create `demos/04-floating/main.js`, `demos/04-floating/index.html`

**Interfaces:** Consumes Task 1~3 전부. 공통: `createStage({canvas, fov})`, `createCardMaterial`, `syncMaterial`, `setCornerRadius`, `createCardInstances(...).setSoft/setFlip/commit/setBend/dispose`, `createPanel`, `addSettingsButtons`, `addTextureFolder`, `presetToParams`, `DEFAULT_PRESET`, `readToken`.

- [ ] **Step 1:** main.js

```js
// FILE: demos/04-floating/main.js
// ─────────────────────────────────────────────────────────────
// 04 플로팅 필드 — 휘어진 종이 카드가 어두운 공간 앞뒤로 흩어져 둥실 떠 있고,
// 드래그·휠로 그 사이를 헤엄치듯 끝없이 돌아다닌다. 먼 카드는 안개와 초점 흐림으로 사라진다.
// 참고: Codrops "Infinite Canvas"(Edoardo Lunardi) 뼈대 + Framer "Depth Drift Gallery" 아이디어
//       — 코드 복사 없이 기법·숫자만 (단위는 레퍼 ÷ 10)
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { createStage, showWebGLFallback, readToken } from '../../shared/stage.js?v=6';
import { createCardMaterial, syncMaterial, setCornerRadius } from '../../shared/card-material.js?v=4';
import { createCardInstances } from '../../shared/card-geometry.js?v=2';
import { easeOutCubic, easeInOutCubic, prefersReducedMotion } from '../../shared/motion.js?v=3';
import { DEFAULT_PRESET, presetToParams } from '../../shared/texture-presets.js?v=1';
import { createPanel, addSettingsButtons } from '../../shared/panel.js?v=2';
import { addTextureFolder } from '../../shared/texture-panel.js?v=2';
import {
  fieldBox, fieldCount, createField, fieldSlot, createFloatState, stepFloat,
  pushDrag, pushWheel, leanAngles, bob, blurRadius,
} from './layout.js?v=1';

const CARD_W = 1.6;                    // 01~03과 같은 카드 (Grail 비율 1.42, R 20/345)
const CARD_H = CARD_W * (490 / 345);
const CORNER_RADIUS = CARD_W * (20 / 345);
const CAMERA_FOV = 60;                 // Codrops 60°
const DRAG_PER_PX = 0.0025;            // 마우스 드래그 1px (Codrops 0.025 ÷ 10)
const TOUCH_PER_PX = 0.002;            // 손가락 드래그 1px (Codrops 0.02 ÷ 10)
const WHEEL_PER_PX = 0.0006;           // 휠·두 손가락 벌리기 1px (Codrops 0.006 ÷ 10)
const WHEEL_KEEP = 0.8;                // 휠로 쌓인 양이 프레임마다 남는 비율 (Codrops 0.8)
const MAX_SPEED = 0.32;                // 목표 속도 상한 (Codrops 3.2 ÷ 10)
const DRIFT_FOLLOW = 0.12;             // 마우스 시점이 따라가는 빠르기 (Codrops 0.12)
const MAX_LOCAL_SOFT = CARD_W * 0.35;  // 카드 자기 크기 기준 가장자리 퍼짐 상한 (카드가 통째로 사라지지 않게)
const INTRO_DURATION = 2.2;
const INTRO_DISTANCE = 14;             // 처음엔 14만큼 뒤에서 미끄러져 들어온다
const FLIP_DURATION = 1.1;
const CLICK_TOLERANCE_PX = 6;
const FIELD_SEED = 4;                  // 고정 시드 → 열 때마다 같은 배치

function main() {
  const canvas = document.getElementById('stage-canvas');
  let stage;
  try {
    stage = createStage({ canvas, fov: CAMERA_FOV });
  } catch (error) {
    console.warn('WebGL 초기화 실패', error);
    showWebGLFallback(canvas);
    return;
  }

  // ── 기본값 ──────────────────────────────────────────────────
  const paper = readToken('--card-paper');
  const DEFAULTS = {
    ...presetToParams(DEFAULT_PRESET, paper),
    bend: 0.06,          // 살짝 휜 종이
    corner: CORNER_RADIUS,
    density: 5,          // 칸(11×11×11)마다 카드 수 (Codrops 5)
    cardScale: 1,        // 카드 크기 배율 (기본: 높이 1.2~2.0, Codrops 12~20)
    fogNear: 12,         // 이 거리부터 흐려지기 시작 (Codrops 안개 120)
    fogFar: 26,          // 이 거리에서 완전히 사라짐 (Codrops 투명도 끝 260)
    dragSpeed: 1,        // 드래그 감도 배율
    wheelSpeed: 1,       // 휠 감도 배율
    follow: 0.16,        // 속도가 목표를 따라가는 빠르기 (Codrops 0.16)
    decay: 0.9,          // 관성: 손 뗀 뒤 목표 속도가 프레임마다 남는 비율 (Codrops 0.9, 클수록 오래 미끄러짐)
    drift: 0.8,          // 마우스 시점 세기: 커서 쪽으로 카메라가 옮겨가는 최대 거리 (Codrops 8 ÷ 10)
    bobAmount: 0.15,     // 둥실 세기 (위아래 폭)
    lean: 1,             // 기울기 세기: 1이면 최고 속도에서 약 18°
    dof: true,           // 초점 흐림 켜기
    focus: 7,            // 초점 거리: 이 거리의 카드가 가장 또렷
    blur: 1,             // 흐림 세기
  };
  const params = structuredClone(DEFAULTS);

  // ── 장면 ────────────────────────────────────────────────────
  // 먼 카드는 배경색 안개 속으로 사라진다 (Codrops: 안개 + 투명도를 합친 느낌)
  stage.scene.fog = new THREE.Fog(new THREE.Color(readToken('--bg-1')), params.fogNear, params.fogFar);

  const material = createCardMaterial({ cardWidth: CARD_W, cardHeight: CARD_H, cornerRadius: CORNER_RADIUS });
  // 카드 가장자리를 반투명하게 퍼뜨리려면(초점 흐림) 투명 모드로 그리고, 매 프레임 먼 카드부터 칠한다.
  // 알파→MSAA 변환(alphaToCoverage)은 투명 섞기와 겹치면 가장자리가 두 번 흐려져서 끈다
  material.transparent = true;
  material.depthWrite = false;
  material.alphaToCoverage = false;
  syncMaterial(material, params);

  const flips = new Map(); // 카드 번호 → 뒤집기 시작 시각(초)
  let box;
  let field = [];
  let cards = null;
  let order = [];  // 그리는 순서 (먼 카드부터) → 카드 번호
  let slots = [];

  function buildField() {
    box = fieldBox({ fogFar: params.fogFar, fov: CAMERA_FOV });
    field = createField(fieldCount(params.density, box), box, FIELD_SEED);
    if (cards) {
      stage.scene.remove(cards.mesh);
      cards.dispose();
    }
    cards = createCardInstances({ count: field.length, width: CARD_W, height: CARD_H, bend: params.bend, material });
    stage.scene.add(cards.mesh);
    order = field.map((_, i) => i);
    slots = field.map(() => null);
    flips.clear();
  }
  buildField();

  function applyFog() {
    stage.scene.fog.near = params.fogNear;
    stage.scene.fog.far = params.fogFar;
  }

  function applyAll() {
    syncMaterial(material, params);
    setCornerRadius(material, params.corner);
    applyFog();
    buildField();
  }

  // ── 패널 ────────────────────────────────────────────────────
  const gui = createPanel('04 플로팅 필드 · 조절 패널');
  const texture = addTextureFolder(gui, { params, material, paperColor: paper });
  texture.add(params, 'bend', 0, 0.5, 0.01).name('휨').onChange((value) => cards.setBend(value));

  const spaceFolder = gui.addFolder('공간');
  spaceFolder.add(params, 'density', 1, 15, 0.5).name('카드 밀도').onFinishChange(buildField);
  spaceFolder.add(params, 'cardScale', 0.4, 2.5, 0.01).name('카드 크기');
  spaceFolder.add(params, 'fogNear', 0, 40, 0.5).name('흐려지기 시작').onChange(applyFog);
  spaceFolder.add(params, 'fogFar', 8, 60, 0.5).name('완전히 사라짐').onChange(applyFog).onFinishChange(buildField);

  const motionFolder = gui.addFolder('움직임');
  motionFolder.add(params, 'dragSpeed', 0.2, 3, 0.05).name('드래그 감도');
  motionFolder.add(params, 'wheelSpeed', 0.2, 3, 0.05).name('휠 감도');
  motionFolder.add(params, 'follow', 0.02, 0.5, 0.01).name('따라가기 (쫀득함)');
  motionFolder.add(params, 'decay', 0.5, 0.98, 0.01).name('관성 (미끄러짐)');
  motionFolder.add(params, 'drift', 0, 3, 0.05).name('마우스 시점 세기');
  motionFolder.add(params, 'bobAmount', 0, 0.6, 0.01).name('둥실 세기');
  motionFolder.add(params, 'lean', 0, 3, 0.05).name('기울기 세기');

  const focusFolder = gui.addFolder('초점 흐림');
  focusFolder.add(params, 'dof').name('켜기');
  focusFolder.add(params, 'focus', 1, 25, 0.1).name('초점 거리');
  focusFolder.add(params, 'blur', 0, 3, 0.05).name('흐림 세기');

  addSettingsButtons(gui, { params, defaults: DEFAULTS, onApply: applyAll });

  // ── 입력: 드래그(헤엄치기)·휠(앞뒤)·터치·클릭(뒤집기) ─────────
  const reduced = prefersReducedMotion();
  const motion = createFloatState();
  const raycaster = new THREE.Raycaster();
  const pointer = { x: 0, y: 0, inside: false };
  const drag = { active: false, lastX: 0, lastY: 0, startX: 0, startY: 0 };
  const touch = { active: false, x: 0, y: 0, startX: 0, startY: 0, pinch: 0, multi: false };
  canvas.style.cursor = 'grab'; // 잡아서 끄는 공간이라는 신호 (Codrops와 같음)

  function toNdc(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * 2 - 1,
      y: -(((clientY - rect.top) / rect.height) * 2 - 1),
    };
  }
  // 누른 곳의 카드 번호. 그리는 순서가 매 프레임 바뀌어서 order로 진짜 카드 번호를 찾는다
  function flipAt(clientX, clientY) {
    const ndc = toNdc(clientX, clientY);
    raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), stage.camera);
    const hit = raycaster.intersectObject(cards.mesh, false)[0];
    if (!hit || hit.instanceId === undefined) return;
    const id = order[hit.instanceId];
    if (!flips.has(id)) flips.set(id, performance.now() / 1000);
  }

  // 마우스 (터치는 두 손가락 벌리기 때문에 아래 터치 이벤트에서 따로)
  canvas.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'touch') return;
    drag.active = true;
    drag.lastX = drag.startX = event.clientX;
    drag.lastY = drag.startY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = 'grabbing';
  });
  canvas.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return;
    const ndc = toNdc(event.clientX, event.clientY);
    pointer.x = ndc.x;
    pointer.y = ndc.y;
    pointer.inside = true;
    if (!drag.active) return;
    pushDrag(motion, event.clientX - drag.lastX, event.clientY - drag.lastY, DRAG_PER_PX * params.dragSpeed);
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
  });
  const endDrag = (event) => {
    if (event.pointerType === 'touch' || !drag.active) return;
    drag.active = false;
    canvas.style.cursor = 'grab';
    const moved = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (event.type === 'pointerup' && moved < CLICK_TOLERANCE_PX) flipAt(event.clientX, event.clientY);
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointerleave', () => { pointer.inside = false; });

  // 휠: 공간이 화면에 꽉 차 있을 때만 가져간다. 노트를 보는 중이면 페이지 스크롤에 맡긴다
  const stageInView = () => window.scrollY < 4;
  canvas.addEventListener('wheel', (event) => {
    if (!stageInView()) return;
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : 1; // 줄 단위 휠은 px로 환산
    pushWheel(motion, event.deltaY * unit, WHEEL_PER_PX * params.wheelSpeed);
  }, { passive: false });

  // 터치: 한 손가락 = 헤엄치기, 두 손가락 벌리기 = 앞으로, 톡 = 뒤집기
  const touchDistance = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  canvas.addEventListener('touchstart', (event) => {
    touch.active = true;
    if (event.touches.length === 1) {
      touch.x = touch.startX = event.touches[0].clientX;
      touch.y = touch.startY = event.touches[0].clientY;
      touch.multi = false;
    } else {
      touch.pinch = touchDistance(event.touches);
      touch.multi = true;
    }
  }, { passive: true });
  canvas.addEventListener('touchmove', (event) => {
    if (!touch.active) return;
    event.preventDefault();
    if (event.touches.length >= 2) {
      const distance = touchDistance(event.touches);
      pushWheel(motion, distance - touch.pinch, WHEEL_PER_PX * params.wheelSpeed);
      touch.pinch = distance;
      return;
    }
    const t = event.touches[0];
    pushDrag(motion, t.clientX - touch.x, t.clientY - touch.y, TOUCH_PER_PX * params.dragSpeed);
    touch.x = t.clientX;
    touch.y = t.clientY;
  }, { passive: false });
  canvas.addEventListener('touchend', (event) => {
    if (event.touches.length === 1) {
      // 두 손가락 중 하나를 떼면 남은 손가락 위치에서 이어서 헤엄친다
      touch.x = event.touches[0].clientX;
      touch.y = event.touches[0].clientY;
      return;
    }
    if (event.touches.length > 0) return;
    const t = event.changedTouches[0];
    const moved = Math.hypot(t.clientX - touch.startX, t.clientY - touch.startY);
    if (!touch.multi && moved < CLICK_TOLERANCE_PX) flipAt(t.clientX, t.clientY);
    touch.active = false;
  });

  // ── 매 프레임 ───────────────────────────────────────────────
  const dummy = new THREE.Object3D();
  const startTime = performance.now() / 1000;
  let lastTime = startTime;

  function frame() {
    const now = performance.now() / 1000;
    const dt = Math.min(0.05, now - lastTime) || 1 / 60;
    lastTime = now;
    const intro = reduced ? 1 : easeOutCubic((now - startTime) / INTRO_DURATION);

    // 1) 카메라: 입력 → 속도 → 위치, 그리고 커서 쪽으로 살짝 (마우스 시점)
    const followCursor = pointer.inside && !reduced;
    stepFloat(motion, {
      follow: params.follow,
      decay: params.decay,
      maxSpeed: MAX_SPEED,
      wheelKeep: WHEEL_KEEP,
      driftFollow: DRIFT_FOLLOW,
      driftTarget: followCursor ? { x: pointer.x * params.drift, y: pointer.y * params.drift } : { x: 0, y: 0 },
      dragging: drag.active || touch.active,
    }, dt);
    const cam = { x: motion.base.x, y: motion.base.y, z: motion.base.z + (1 - intro) * INTRO_DISTANCE };
    stage.camera.position.set(cam.x + motion.drift.x, cam.y + motion.drift.y, cam.z);

    // 2) 카드 위치를 카메라 주변 상자 안으로 접고, 먼 카드부터 그리게 정렬 (반투명 가장자리가 제대로 섞이게)
    for (let i = 0; i < field.length; i++) slots[i] = fieldSlot(field[i], cam, box);
    order.sort((a, b) => slots[a].z - slots[b].z);

    // 3) 카드마다 둥실·기울기·초점 흐림·뒤집기
    const lean = leanAngles(motion.velocity, reduced ? 0 : params.lean);
    const time = now - startTime;
    for (let k = 0; k < order.length; k++) {
      const i = order[k];
      const card = field[i];
      const slot = slots[i];
      const wobble = bob(card, time, reduced ? 0 : params.bobAmount);
      const scale = (card.size / CARD_H) * params.cardScale * slot.fade;
      dummy.position.set(slot.x, slot.y + wobble.y, slot.z);
      dummy.rotation.set(lean.rotX, lean.rotY, wobble.roll);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      cards.mesh.setMatrixAt(k, dummy.matrix);

      // 초점 흐림: 공간에서 퍼지는 폭을 카드 자기 크기 기준으로 바꿔서 둥근 가장자리를 그만큼 부드럽게
      const blur = params.dof ? blurRadius(cam.z - slot.z, params.focus, params.blur) : 0;
      cards.setSoft(k, Math.min(MAX_LOCAL_SOFT, blur / Math.max(scale, 1e-3)));

      let flipProgress = 0;
      const flipStart = flips.get(i);
      if (flipStart !== undefined) {
        const t = (now - flipStart) / FLIP_DURATION;
        if (t >= 1) flips.delete(i);
        else flipProgress = easeInOutCubic(t);
      }
      cards.setFlip(k, flipProgress);
    }
    cards.commit();

    stage.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

main();
```

- [ ] **Step 2:** index.html

```html
<!-- FILE: demos/04-floating/index.html -->
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>04 플로팅 필드 · Card Archive</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
  <link rel="stylesheet" href="../../shared/tokens.css?v=1">
  <link rel="stylesheet" href="../../shared/base.css?v=4">
  <script type="importmap">
  {
    "imports": {
      "three": "https://cdn.jsdelivr.net/npm/three@0.187.0/build/three.module.js",
      "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.187.0/examples/jsm/"
    }
  }
  </script>
</head>
<body>
  <a class="back-link" href="../../">← 아카이브</a>

  <section class="stage-wrap is-fixed">
    <div class="stage">
      <canvas id="stage-canvas" aria-label="휘어진 흰 카드들이 어두운 공간 앞뒤로 흩어져 둥실 떠 있고, 끌면 그 사이를 헤엄치듯 움직이는 3D 장면"></canvas>
      <div class="stage-caption">
        <p class="caption-index">04</p>
        <h1>플로팅 필드</h1>
        <p>휘어진 종이 카드가 공간 앞뒤로 흩어져 둥실 떠 있어.</p>
        <p class="caption-hint">끌어서 헤엄치기 · 휠·두 손가락으로 앞뒤 · 누르면 뒤집혀</p>
        <a class="notes-jump" href="#notes">기법 노트 ↓</a>
      </div>
    </div>
  </section>

  <main class="notes" id="notes">
    <section>
      <h2>이 데모에 쓴 기법</h2>
      <dl>
        <dt>흩뿌린 공간</dt>
        <dd>가로·세로·깊이 11짜리 정육면체마다 카드 5장 꼴로 공간 전체에 고르게 흩뿌렸어 (Codrops 숫자 ÷ 10). 난수 씨앗을 고정해서 열 때마다 같은 배치야. 카드 높이는 1.2~2.0으로 제각각이고, 화각 60°로 넓게 봐.</dd>
        <dt>끝없는 공간</dt>
        <dd>카드는 300장 남짓뿐인데, 카메라 주변 상자를 벗어난 카드를 반대편으로 돌려보내서 어느 쪽으로 가도 끝이 없어. 우리 카드는 무늬가 없어서 같은 카드가 다시 나와도 티가 안 나. 상자 가장자리에선 카드가 작아지며 사라져서 넘어가는 순간이 안 보여.</dd>
        <dt>헤엄치는 카메라</dt>
        <dd>드래그·휠은 위치를 바로 바꾸지 않고 "목표 속도"만 바꿔. 실제 속도는 매 프레임 16%씩 목표를 따라가고, 목표 속도는 매 프레임 0.9배로 줄어서 손을 떼도 스르르 미끄러지다 멈춰. 휠을 아래로 굴리면 앞으로 파고들어.</dd>
        <dt>마우스 시점</dt>
        <dd>커서 쪽으로 카메라가 최대 0.8만큼 옮겨가. 가까운 카드는 많이, 먼 카드는 조금 움직여서 깊이감이 생겨 (패럴랙스). 끄는 동안엔 멈춰 있어.</dd>
        <dt>안개</dt>
        <dd>배경색과 같은 안개를 깔아서, 거리 12부터 흐려지기 시작한 카드가 26에서 어둠 속으로 완전히 사라져.</dd>
        <dt>카드별 초점 흐림</dt>
        <dd>화면 전체를 흐리게 하면 배경까지 번져서 또렷한 카드 주변에도 뿌연 빛이 생겨. 우리 카드는 무늬 없는 종이라 흐려지면 가장자리만 퍼지니까, 카드마다 초점 거리(7)에서 떨어진 만큼 둥근 가장자리를 부드럽게 퍼뜨렸어. 반투명 가장자리가 제대로 겹치게 매 프레임 먼 카드부터 순서대로 그려.</dd>
        <dt>진행 방향 기울기 · 둥실둥실</dt>
        <dd>움직이는 속도만큼 카드가 흘러가는 쪽 가장자리가 살짝 뒤로 눕고, 카드마다 다른 박자로 위아래로 둥실거려.</dd>
      </dl>
    </section>
    <section>
      <h2>참고한 곳</h2>
      <p><a href="https://tympanus.net/codrops/2026/01/07/infinite-canvas-building-a-seamless-pan-anywhere-image-space/" target="_blank" rel="noopener">Codrops · Infinite Canvas</a> (Edoardo Lunardi): 사방으로 끝없이 이어지는 3D 이미지 공간. 코드는 복사하지 않고 기법과 숫자만 공부해서 다시 만들었어.</p>
      <p><a href="https://www.framer.com/marketplace/components/depth-drift-gallery/" target="_blank" rel="noopener">Framer · Depth Drift Gallery</a> (Konstantin Nikolaev): 먼 층일수록 흐리고, 움직이는 방향으로 카드가 기울어지는 아이디어.</p>
      <p><a href="#stage-canvas">↑ 공간으로 돌아가기</a></p>
    </section>
  </main>

  <script type="module" src="./main.js?v=1"></script>
</body>
</html>
```

- [ ] **Step 3:** 브라우저에서 1280×800·375×812로 열어 콘솔 에러 0, 드래그·휠·클릭 뒤집기·안개·흐림·기울기 확인.

### Task 5: 아카이브 목록 연결

**Files:** Modify `index.html`

- [ ] 04 항목을 `<a class="demo-item" href="demos/04-floating/">`로, 상태 "완성", 설명 "휘어진 카드가 공간 앞뒤로 둥실 떠 있고, 끌면 그 사이를 헤엄쳐."로.
