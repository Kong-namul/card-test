# 05 우주 표류 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 별먼지 속에 종이 카드 26장이 아주 느리게 떠다니고, 8자로 훑는 보이지 않는 빛에 각도가 맞는 카드가 번쩍(글레어)이며 반짝이 알갱이가 반짝이는 05 데모를 만든다.

**Architecture:** 숫자 계산(배치·둥실·흔들림·빛 방향·별 위치·깊이 어둠)은 `demos/05-cosmos/layout.js`에 Three.js 없이 모아 Node로 테스트한다. 공통 카드 재질은 그대로 두고 05 전용 `glint-material.js`가 셰이더를 덧붙인다. 별먼지는 `stars.js`(Points + 깜빡임 셰이더), 빛 번짐은 three의 UnrealBloomPass. 04에서 쓴 `mulberry32`는 공통 `shared/random.js`로 옮긴다.

**Tech Stack:** Three.js 0.187.0 (CDN importmap), lil-gui(공통 panel.js), Node 내장 테스트 러너.

## Global Constraints

- 반말 주석·문구, 한국어 주석 자세히(학습용).
- 색은 토큰만: 배경 `--bg-1`(공통 stage), 종이 `--card-paper`, 별 `--fg-1`. 새 토큰 필요하면 먼저 묻기.
- 공통 JS를 고치면 import하는 모든 곳의 `?v=`를 올린다.
- 레퍼런스 코드는 복사 금지 (포켓몬 카드 CSS GPL, 포일 스티커 모든 권리 보유) — 원리만.
- git 저장소 아님 → 커밋 단계 없음.

## File Structure

- Create `shared/random.js` (v1): `mulberry32`.
- Modify `demos/04-floating/layout.js` (→ v4): `mulberry32`를 공통에서 가져와 다시 내보냄. 04 main import·index 버전 올림.
- Create `demos/05-cosmos/layout.js`, `tests/cosmos-layout.test.js`.
- Create `demos/05-cosmos/glint-material.js`, `demos/05-cosmos/stars.js`.
- Create `demos/05-cosmos/main.js`, `demos/05-cosmos/index.html`.
- Modify `index.html`(아카이브): 05 링크·완성.

---

### Task 1: mulberry32를 공통으로

**Files:** Create `shared/random.js`; Modify `demos/04-floating/layout.js`, `demos/04-floating/main.js`, `demos/04-floating/index.html`

- [ ] **Step 1:** 공통 파일

```js
// FILE: shared/random.js
// ─────────────────────────────────────────────────────────────
// random.js — 같은 숫자(시드)를 넣으면 항상 같은 순서로 나오는 난수 (모든 데모 공통)
// "열 때마다 같은 배치"를 만들 때 쓴다. (04 플로팅에서 공통으로 옮겨옴)
// ─────────────────────────────────────────────────────────────
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
```

- [ ] **Step 2:** 04 layout.js에서 `mulberry32` 정의를 지우고 `import { mulberry32 } from '../../shared/random.js?v=1';` + `export { mulberry32 };`. 04 main의 `./layout.js?v=3` → `?v=4`, 04 index `main.js?v=8` → `?v=9`.
- [ ] **Step 3:** `npm test` → 04 테스트 그대로 PASS.

### Task 2: 05 숫자 계산 (layout.js)

**Files:** Create `demos/05-cosmos/layout.js`, `tests/cosmos-layout.test.js`

**Interfaces:** Produces `DEPTH_NEAR`(7), `DEPTH_FAR`(26), `createCosmos(count, seed, {minDist}) → [{sx, sy, depth, size, yaw, pitch, roll, floatPeriod, floatPhase, wobblePeriodX, wobblePeriodY, wobblePhaseX, wobblePhaseY}]`, `cosmosGap(a, b)`, `cosmosPosition(card, {fov, aspect}) → {x, y, z}`, `floatOffset(card, clock, amount) → {x, y}`, `wobbleAngles(card, clock, maxAngle) → {rotX, rotY, rotZ}`, `glintDirection(angle) → [x, y, z]`, `createStars(count, seed) → [{x, y, z, size, phase, speed}]`, `depthDimming(distance, minBrightness)`.

- [ ] **Step 1: 실패하는 테스트**

```js
// FILE: tests/cosmos-layout.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../shared/random.js';
import {
  DEPTH_NEAR, DEPTH_FAR, createCosmos, cosmosGap, cosmosPosition, floatOffset, wobbleAngles,
  glintDirection, createStars, depthDimming,
} from '../demos/05-cosmos/layout.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('mulberry32 (공통 random.js): 같은 시드면 같은 순서, 0 이상 1 미만', () => {
  const a = mulberry32(5);
  const b = mulberry32(5);
  for (let i = 0; i < 50; i++) {
    const v = a();
    assert.equal(v, b());
    assert.ok(v >= 0 && v < 1);
  }
});

test('createCosmos: 같은 시드면 같은 배치, 화면 좌표 −1~1·깊이 0~1, 카드 높이 1.6~2.6, 처음 방향 ±25°·±15°·±8°', () => {
  const cards = createCosmos(26, 3, { minDist: 0.3 });
  assert.deepEqual(cards, createCosmos(26, 3, { minDist: 0.3 }));
  assert.equal(cards.length, 26);
  for (const c of cards) {
    assert.ok(Math.abs(c.sx) <= 1 && Math.abs(c.sy) <= 1 && c.depth >= 0 && c.depth <= 1);
    assert.ok(c.size >= 1.6 && c.size <= 2.6);
    assert.ok(Math.abs(c.yaw) <= 0.44 && Math.abs(c.pitch) <= 0.26 && Math.abs(c.roll) <= 0.14);
    assert.ok(c.floatPeriod >= 14 && c.floatPeriod <= 24);
    assert.ok(c.wobblePeriodX >= 9 && c.wobblePeriodX <= 17 && c.wobblePeriodY >= 9 && c.wobblePeriodY <= 17);
  }
});

test('createCosmos: 간격을 주면 모든 카드 쌍이 그 이상 떨어진다 (겹침 방지)', () => {
  const cards = createCosmos(26, 3, { minDist: 0.3 });
  let nearest = Infinity;
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) nearest = Math.min(nearest, cosmosGap(cards[i], cards[j]));
  }
  assert.ok(nearest >= 0.3, `가장 가까운 쌍 ${nearest}`);
});

test('cosmosPosition: 깊이 0 → 거리 7, 깊이 1 → 거리 26, 화면 끝은 그 거리 화면 가장자리의 95%, 화면비는 가로만 바꾼다', () => {
  const near = cosmosPosition({ sx: 0, sy: 0, depth: 0 }, { fov: 40, aspect: 1.6 });
  close(near.z, -DEPTH_NEAR);
  const far = cosmosPosition({ sx: 1, sy: -1, depth: 1 }, { fov: 40, aspect: 1.6 });
  const half = Math.tan((20 * Math.PI) / 180) * DEPTH_FAR;
  close(far.z, -DEPTH_FAR);
  close(far.x, half * 1.6 * 0.95);
  close(far.y, -half * 0.95);
  close(cosmosPosition({ sx: 1, sy: -1, depth: 1 }, { fov: 40, aspect: 0.5 }).x, half * 0.5 * 0.95);
  close(cosmosPosition({ sx: 1, sy: -1, depth: 1 }, { fov: 40, aspect: 0.5 }).y, -half * 0.95);
});

test('floatOffset·wobbleAngles: 세기 0이면 제자리·처음 방향, 아니면 정해진 폭 안에서', () => {
  const card = createCosmos(1, 9)[0];
  const still = floatOffset(card, 5, 0);
  close(still.x, 0);
  close(still.y, 0);
  const base = wobbleAngles(card, 5, 0);
  close(base.rotX, card.pitch);
  close(base.rotY, card.yaw);
  close(base.rotZ, card.roll);
  for (let t = 0; t < 60; t += 0.7) {
    const f = floatOffset(card, t, 1);
    assert.ok(Math.abs(f.y) <= 0.18 + 1e-9 && Math.abs(f.x) <= 0.08 + 1e-9);
    const w = wobbleAngles(card, t, 0.2);
    assert.ok(Math.abs(w.rotX - card.pitch) <= 0.2 + 1e-9 && Math.abs(w.rotY - card.yaw) <= 0.2 + 1e-9);
  }
});

test('glintDirection: 길이 1, 항상 카메라 쪽(z > 0.6) 앞 반구에서 좌우 넓게 8자로 훑는다', () => {
  let minX = 1;
  let maxX = -1;
  for (let a = 0; a < Math.PI * 20; a += 0.05) {
    const [x, y, z] = glintDirection(a);
    close(Math.hypot(x, y, z), 1);
    assert.ok(z > 0.6);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
  }
  assert.ok(minX < -0.5 && maxX > 0.5);
});

test('createStars: 같은 시드면 같은 별, 카드 뒤(거리 28~88) 넓은 상자 안, 크기 0.6~2.2px', () => {
  const stars = createStars(500, 5);
  assert.deepEqual(stars, createStars(500, 5));
  assert.equal(stars.length, 500);
  for (const s of stars) {
    assert.ok(Math.abs(s.x) <= 70 && Math.abs(s.y) <= 42);
    assert.ok(s.z <= -28 && s.z >= -88);
    assert.ok(s.size >= 0.6 && s.size <= 2.2);
  }
});

test('depthDimming: 가장 가까운 카드는 1, 가장 먼 카드는 최소 밝기, 사이는 그 사이', () => {
  close(depthDimming(DEPTH_NEAR, 0.45), 1);
  close(depthDimming(DEPTH_FAR, 0.45), 0.45);
  const mid = depthDimming((DEPTH_NEAR + DEPTH_FAR) / 2, 0.45);
  assert.ok(mid < 1 && mid > 0.45);
});
```

- [ ] **Step 2:** `npm test` → FAIL (모듈 없음)
- [ ] **Step 3: 구현**

```js
// FILE: demos/05-cosmos/layout.js
// ─────────────────────────────────────────────────────────────
// layout.js — 05 우주 표류: 카드 배치·둥실·흔들림·빛 방향·별먼지 (Three.js 없이 숫자만)
// 반짝임 원리 참고(코드 X): 포켓몬 홀로 카드 CSS의 글레어, 포일 스티커 셰이더의 반짝이 알갱이
// ─────────────────────────────────────────────────────────────
import { smoothstep } from '../../shared/motion.js?v=3';
import { mulberry32 } from '../../shared/random.js?v=1';

const TAU = Math.PI * 2;
export const DEPTH_NEAR = 7;   // 카메라에서 가장 가까운 카드 거리
export const DEPTH_FAR = 26;   // 가장 먼 카드 거리
const EDGE_USE = 0.95;         // 화면 끝까지 꽉 채우지 않고 95%까지 (가장자리 카드가 너무 많이 잘리지 않게)
const REF_ASPECT = 1.6;        // 겹침 간격을 잴 때 기준 화면비 (가로가 더 넓으니 가로 차이를 더 크게 친다)
const DEPTH_WEIGHT = 0.5;      // 겹침 간격을 잴 때 깊이 차이는 절반만 (정면에서 보면 앞뒤로 떨어져도 겹쳐 보여서)
const SPACING_TRIES = 40;      // 겹침 방지로 자리를 다시 뽑는 최대 횟수

// 카드 배치: 화면 좌표(−1~1)와 깊이 비율(0~1)로 저장한다 → 그릴 때 화면비에 맞춰 공간 좌표로 바꾼다.
// 그래서 폰이든 와이드 모니터든 카드가 화면 전체에 고르게 퍼지고, 화면을 돌려도 재배치되지 않는다.
//   minDist: 겹침 방지 간격. 이미 놓인 카드와 이보다 가까우면 자리를 다시 뽑는다 (끝내 안 되면 가장 먼 자리)
export function createCosmos(count, seed, { minDist = 0 } = {}) {
  const random = mulberry32(seed);
  const randomSpot = () => ({ sx: random() * 2 - 1, sy: random() * 2 - 1, depth: random() });
  const cards = [];
  for (let i = 0; i < count; i++) {
    let spot = randomSpot();
    if (minDist > 0) {
      let gap = nearestGap(spot, cards);
      for (let tries = 1; tries < SPACING_TRIES && gap < minDist; tries++) {
        const other = randomSpot();
        const otherGap = nearestGap(other, cards);
        if (otherGap > gap) {
          spot = other;
          gap = otherGap;
        }
      }
    }
    cards.push({
      ...spot,
      size: 1.6 + random() * 1.0,               // 카드 높이 1.6~2.6
      yaw: (random() * 2 - 1) * 0.44,           // 처음 보는 방향 ±25° → 카드마다 빛 받는 순간이 다르다
      pitch: (random() * 2 - 1) * 0.26,         // ±15°
      roll: (random() * 2 - 1) * 0.14,          // ±8°
      floatPeriod: 14 + random() * 10,          // 한 번 오르내리는 데 14~24초
      floatPhase: random() * TAU,
      wobblePeriodX: 9 + random() * 8,          // 각도가 한 번 흔들리는 데 9~17초
      wobblePeriodY: 9 + random() * 8,
      wobblePhaseX: random() * TAU,
      wobblePhaseY: random() * TAU,
    });
  }
  return cards;
}

// 두 카드 사이 "겹침 거리": 가로는 화면비만큼 길게, 깊이는 절반만
export function cosmosGap(a, b) {
  return Math.hypot((a.sx - b.sx) * REF_ASPECT, a.sy - b.sy, (a.depth - b.depth) * DEPTH_WEIGHT);
}

function nearestGap(spot, cards) {
  let gap = Infinity;
  for (const card of cards) gap = Math.min(gap, cosmosGap(spot, card));
  return gap;
}

// 화면 좌표·깊이 비율 → 공간 좌표 (카메라는 원점에서 −z를 본다)
//   거리 d에서 화면 세로 반폭 = tan(화각/2) × d, 가로 반폭 = 세로 반폭 × 화면비
export function cosmosPosition(card, { fov, aspect }) {
  const distance = DEPTH_NEAR + card.depth * (DEPTH_FAR - DEPTH_NEAR);
  const half = Math.tan((fov * Math.PI) / 360) * distance;
  return { x: card.sx * half * aspect * EDGE_USE, y: card.sy * half * EDGE_USE, z: -distance };
}

// 둥실둥실: 위아래 0.18 + 좌우 0.08 (× amount), 카드마다 다른 박자. clock은 "떠다니는 시계"(초)
export function floatOffset(card, clock, amount) {
  const t = (clock * TAU) / card.floatPeriod + card.floatPhase;
  return { x: Math.cos(t * 0.6) * 0.08 * amount, y: Math.sin(t) * 0.18 * amount };
}

// 각도 흔들림: 처음 방향에서 최대 maxAngle(라디안) 안에서 천천히. 갸웃(roll)은 고정
export function wobbleAngles(card, clock, maxAngle) {
  return {
    rotX: card.pitch + Math.sin((clock * TAU) / card.wobblePeriodX + card.wobblePhaseX) * maxAngle,
    rotY: card.yaw + Math.sin((clock * TAU) / card.wobblePeriodY + card.wobblePhaseY) * maxAngle,
    rotZ: card.roll,
  };
}

// 글레어 빛 방향: 카메라 앞쪽 반구에서 8자(리사주)로 훑는다.
// 빛이 카메라 쪽(+z)에 있어야 카드가 그 빛을 카메라로 반사할 수 있다 (거울에 비친 해를 보는 원리).
//   angle: 0→2π가 한 바퀴. 가로로 ±0.9, 세로로 ±0.6 기울였다가 길이 1로 맞춘다
export function glintDirection(angle) {
  const x = Math.sin(angle) * 0.9;
  const y = Math.sin(angle * 0.7 + 1) * 0.6;
  const length = Math.hypot(x, y, 1);
  return [x / length, y / length, 1 / length];
}

// 별먼지: 카드 뒤(거리 28~88) 넓은 상자에 흩뿌린 점.
//   size: 화면 픽셀 0.6~2.2 (대부분 작고 가끔 큰 별), phase·speed: 별마다 다른 깜빡임 박자
export function createStars(count, seed) {
  const random = mulberry32(seed);
  const stars = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: (random() * 2 - 1) * 70,
      y: (random() * 2 - 1) * 42,
      z: -28 - random() * 60,
      size: 0.6 + Math.pow(random(), 3) * 1.6,
      phase: random() * TAU,
      speed: 0.6 + random() * 1.6,
    });
  }
  return stars;
}

// 먼 카드일수록 어둡게: 가장 가까운 거리 1 → 가장 먼 거리 minBrightness (부드러운 S자)
export function depthDimming(distance, minBrightness) {
  return 1 - (1 - minBrightness) * smoothstep(DEPTH_NEAR, DEPTH_FAR, distance);
}
```

- [ ] **Step 4:** `npm test` → PASS

### Task 3: 글레어 + 반짝이 재질, 별먼지

**Files:** Create `demos/05-cosmos/glint-material.js`, `demos/05-cosmos/stars.js`

**Interfaces:** Produces `addGlint(material) → uniforms {uGlintDir: Vector3, uGlare, uGlareSharpness, uSparkleDensity, uSparkleAmount, uSparkle, uTime}`; `createStarDust({stars, color, pixelRatio, opacity}) → {points, setTime(t), setTwinkle(v), dispose()}`.

- [ ] **Step 1:**

```js
// FILE: demos/05-cosmos/glint-material.js
// ─────────────────────────────────────────────────────────────
// glint-material.js — 05 우주 표류: 공통 카드 재질에 "글레어 + 반짝이 알갱이"를 덧붙인다 (공통 파일은 그대로)
//   글레어 : 빛 방향(L)과 카메라 방향(V)의 딱 중간 방향(H)이 카드 법선과 맞을수록 밝아지는 빛 점.
//            카드가 흔들리다 각도가 맞는 순간 카드 위로 빛 점이 쓱 지나간다 (포켓몬 홀로 카드 글레어 원리)
//   반짝이 : 카드 표면을 작은 칸으로 나눠 일부 칸에 "알갱이"를 박고, 알갱이마다 법선을 살짝 비튼다.
//            아주 날카로운 반사라서 각도가 딱 맞는 알갱이만 번쩍 → 반짝반짝 (포일 스티커 원리)
//   둘 다 코드는 안 가져오고 원리만. 결과는 1보다 밝게(HDR) 더해서 빛 번짐이 번쩍이는 곳만 잡는다
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

export function addGlint(material) {
  const uniforms = {
    uGlintDir: { value: new THREE.Vector3(0, 0, 1) }, // 화면 기준 빛 방향 (카메라 쪽이 +z)
    uGlare: { value: 1.2 },
    uGlareSharpness: { value: 60 },
    uSparkleDensity: { value: 40 },                   // 카드 1단위당 칸 수 (카드 가로 1.6 → 64칸)
    uSparkleAmount: { value: 0.12 },
    uSparkle: { value: 6 },
    uTime: { value: 0 },
  };

  // 공통 재질의 셰이더 덧붙이기(휨·뒤집기·둥근 모서리)를 먼저 하고, 그 위에 반짝임을 더한다
  const baseCompile = material.onBeforeCompile;
  const baseKey = material.customProgramCacheKey();
  material.customProgramCacheKey = () => `${baseKey}-glint`;
  material.onBeforeCompile = (shader, renderer) => {
    baseCompile(shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform vec3 uGlintDir;
uniform float uGlare;
uniform float uGlareSharpness;
uniform float uSparkleDensity;
uniform float uSparkleAmount;
uniform float uSparkle;
uniform float uTime;
// 칸 번호 → 0~1 난수 (같은 칸은 항상 같은 값)
float glintHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
{
  vec3 viewDir = normalize(vViewPosition);            // 이 픽셀 → 카메라
  vec3 halfDir = normalize(uGlintDir + viewDir);      // 빛과 카메라의 딱 중간 방향
  float facing = max(dot(normal, halfDir), 0.0);      // 1이면 빛을 정확히 카메라로 반사
  float glare = pow(facing, uGlareSharpness) * uGlare;

  vec2 cell = floor(vCardPos * uSparkleDensity);      // 카드 위 칸 번호
  float seed = glintHash(cell);
  float isFlake = step(1.0 - uSparkleAmount, seed);   // 일부 칸에만 알갱이
  vec3 flakeNormal = normalize(normal + vec3(glintHash(cell + 17.3) - 0.5, glintHash(cell + 41.7) - 0.5, 0.0) * 0.6);
  float flake = pow(max(dot(flakeNormal, halfDir), 0.0), 300.0); // 아주 날카롭게 → 각도 맞는 알갱이만
  float twinkle = 0.6 + 0.4 * sin(uTime * 5.0 + seed * 40.0);    // 알갱이마다 다른 박자로 깜빡
  float nearGlare = pow(facing, 6.0);                            // 글레어가 지나가는 근처에서만 반짝
  float sparkle = isFlake * flake * twinkle * uSparkle * nearGlare;

  gl_FragColor.rgb += vec3(glare + sparkle);
}`);
  };
  return uniforms;
}
```

```js
// FILE: demos/05-cosmos/stars.js
// ─────────────────────────────────────────────────────────────
// stars.js — 05 우주 표류 배경 별먼지
// 점(Points) 수천 개를 한 번에 그리고, 셰이더에서 별마다 다른 박자로 깜빡이게 한다.
// 색은 공통 토큰(--fg-1)을 받아 쓴다. 더하기 섞기라 겹치면 더 밝아진다.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

const vertexShader = /* glsl */ `
attribute float aSize;
attribute float aPhase;
attribute float aSpeed;
uniform float uTime;
uniform float uTwinkle;
uniform float uPixelRatio;
varying float vBrightness;

void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uPixelRatio;                     // 화면 픽셀 크기: 별은 거리와 상관없이 작은 점
  float wave = 0.5 + 0.5 * sin(uTime * aSpeed + aPhase);  // 별마다 다른 박자
  vBrightness = 1.0 - uTwinkle * wave;
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vBrightness;

void main() {
  // 동그랗고 가장자리가 부드러운 점
  float glow = 1.0 - smoothstep(0.0, 0.5, length(gl_PointCoord - 0.5));
  if (glow <= 0.0) discard;
  gl_FragColor = vec4(uColor * vBrightness * uOpacity, glow);
}
`;

export function createStarDust({ stars, color, pixelRatio, opacity = 0.85 }) {
  const count = stars.length;
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  const speeds = new Float32Array(count);
  stars.forEach((star, i) => {
    positions.set([star.x, star.y, star.z], i * 3);
    sizes[i] = star.size;
    phases[i] = star.phase;
    speeds[i] = star.speed;
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uTwinkle: { value: 0.6 },
      uPixelRatio: { value: pixelRatio },
      uColor: { value: color },
      uOpacity: { value: opacity },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,                 // 별끼리·카드 뒤에서 깊이를 안 남긴다
    blending: THREE.AdditiveBlending,  // 겹치면 더 밝게 (빛은 더해진다)
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return {
    points,
    setTime(time) { material.uniforms.uTime.value = time; },
    setTwinkle(value) { material.uniforms.uTwinkle.value = value; },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
```

### Task 4: 05 장면·패널·페이지 + 아카이브 연결

**Files:** Create `demos/05-cosmos/main.js`, `demos/05-cosmos/index.html`; Modify `index.html`

- [ ] **Step 1:** main.js

```js
// FILE: demos/05-cosmos/main.js
// ─────────────────────────────────────────────────────────────
// 05 우주 표류 — 별먼지 속에 종이 카드가 아주 느리게 떠다니고,
// 보이지 않는 빛이 훑고 지나갈 때 각도가 맞는 카드가 번쩍이며 반짝이 알갱이가 반짝인다.
// 04처럼 끌고 헤엄치는 장면이 아니라, 가만히 바라보는 장면 (마우스로 시점만 살짝)
// 반짝임 원리 참고(코드 X): 포켓몬 홀로 카드 CSS 글레어 · 포일 스티커 셰이더 알갱이 · Ziggy 카드
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { createStage, showWebGLFallback, readToken } from '../../shared/stage.js?v=6';
import { createCardMaterial, syncMaterial, setCornerRadius } from '../../shared/card-material.js?v=6';
import { createCardInstances } from '../../shared/card-geometry.js?v=3';
import { damp, easeOutCubic, easeInOutCubic, prefersReducedMotion } from '../../shared/motion.js?v=3';
import { DEFAULT_PRESET, presetToParams } from '../../shared/texture-presets.js?v=1';
import { createPanel, addSettingsButtons } from '../../shared/panel.js?v=2';
import { addTextureFolder } from '../../shared/texture-panel.js?v=4';
import {
  createCosmos, cosmosPosition, floatOffset, wobbleAngles, glintDirection, createStars, depthDimming,
} from './layout.js?v=1';
import { addGlint } from './glint-material.js?v=1';
import { createStarDust } from './stars.js?v=1';

const CARD_W = 1.6;                    // 01~04와 같은 카드 (Grail 비율 1.42)
const CARD_H = CARD_W * (490 / 345);
// 모서리: Grail 비율(R 20/345)의 1.5배. 카드가 화면에서 작게 보이면 같은 비율로는 뾰족해 보여서 (04에서 배움)
const CORNER_RADIUS = CARD_W * (30 / 345);
const CAMERA_FOV = 40;                 // 01~03(38°)과 비슷한 차분한 화각
const MIN_BRIGHTNESS = 0.45;           // 가장 먼 카드 밝기
const SPACING = 0.3;                   // 겹침 방지 간격 (화면 좌표 기준)
const PARALLAX_RATE = 2.5;             // 마우스 시점이 따라가는 빠르기 (초당, 클수록 빨리)
const INTRO_DURATION = 3;
const INTRO_DISTANCE = 6;              // 처음엔 6만큼 뒤에서 천천히 다가온다
const FLIP_DURATION = 1.1;
const CLICK_TOLERANCE_PX = 6;
const FIELD_SEED = 1;                  // 배치 번호 기본값 (Task 5에서 첫 화면이 예쁜 번호로 바꾼다)
const STAR_SEED = 5;
const TAU = Math.PI * 2;

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
    bend: 0.04,             // 아주 살짝 휜 종이 → 글레어가 카드 위를 띠처럼 지나간다
    corner: CORNER_RADIUS,
    count: 26,              // 카드 수
    seed: FIELD_SEED,       // 배치 번호: 같은 번호면 열 때마다 같은 배치
    cardScale: 1,           // 카드 크기 배율 (기본 높이 1.6~2.6)
    speed: 1,               // 떠다니는 속도 (시간 배율)
    floatAmount: 1,         // 둥실 폭 (위아래 0.18 × 이 값)
    wobble: 12,             // 각도 흔들림 최대 (도)
    parallax: 0.6,          // 마우스 시점: 커서 쪽으로 카메라가 옮겨가는 최대 거리
    lightPeriod: 18,        // 빛이 8자로 한 바퀴 도는 데 걸리는 시간 (초)
    glare: 1.2,             // 글레어 세기 (1을 넘는 부분이 빛 번짐으로 번진다)
    glareSharpness: 60,     // 글레어 날카로움 (클수록 작고 또렷한 빛 점)
    sparkleAmount: 0.12,    // 반짝이 알갱이가 박힌 칸 비율
    sparkle: 6,             // 반짝이 세기
    bloomStrength: 0.7,     // 빛 번짐 세기
    bloomRadius: 0.5,       // 빛 번짐 퍼짐
    bloomThreshold: 1,      // 이 밝기(1)를 넘는 곳만 번진다 → 종이는 그대로, 번쩍이는 곳만
    starCount: 1800,        // 별먼지 개수
    twinkle: 0.6,           // 별 깜빡임 (0이면 안 깜빡임)
  };
  const params = structuredClone(DEFAULTS);

  // ── 장면 ────────────────────────────────────────────────────
  const material = createCardMaterial({ cardWidth: CARD_W, cardHeight: CARD_H, cornerRadius: CORNER_RADIUS });
  syncMaterial(material, params);
  const glint = addGlint(material); // 공통 재질 위에 글레어 + 반짝이를 덧붙인다 (05 전용)

  const flips = new Map(); // 카드 번호 → 뒤집기 시작 시각(초)
  let field = [];
  let cards = null;
  function buildField() {
    field = createCosmos(params.count, params.seed, { minDist: SPACING });
    if (cards) {
      stage.scene.remove(cards.mesh);
      cards.dispose();
    }
    cards = createCardInstances({ count: field.length, width: CARD_W, height: CARD_H, bend: params.bend, material });
    stage.scene.add(cards.mesh);
    flips.clear();
  }
  buildField();

  const starColor = new THREE.Color(readToken('--fg-1'));
  let stars = null;
  function buildStars() {
    if (stars) {
      stage.scene.remove(stars.points);
      stars.dispose();
    }
    stars = createStarDust({
      stars: createStars(params.starCount, STAR_SEED),
      color: starColor,
      pixelRatio: stage.renderer.getPixelRatio(),
    });
    stage.scene.add(stars.points);
  }
  buildStars();

  // 빛 번짐: 1보다 밝은 곳(글레어·반짝이)만 은은하게 번진다
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), params.bloomStrength, params.bloomRadius, params.bloomThreshold);
  stage.addEffect(bloom);
  stage.resize();

  function applyAll() {
    syncMaterial(material, params);
    setCornerRadius(material, params.corner);
    buildField();
    buildStars();
  }

  // ── 패널 ────────────────────────────────────────────────────
  const gui = createPanel('05 우주 표류 · 조절 패널');
  const texture = addTextureFolder(gui, { params, material, paperColor: paper });
  texture.add(params, 'bend', 0, 0.5, 0.01).name('휨').onChange((value) => cards.setBend(value));

  const spaceFolder = gui.addFolder('공간');
  spaceFolder.add(params, 'count', 6, 60, 1).name('카드 수').onFinishChange(buildField);
  spaceFolder.add(params, 'seed', 1, 999, 1).name('배치 번호').onFinishChange(buildField);
  spaceFolder.add(params, 'cardScale', 0.5, 2, 0.01).name('카드 크기');

  const motionFolder = gui.addFolder('움직임');
  motionFolder.add(params, 'speed', 0, 3, 0.05).name('떠다니는 속도');
  motionFolder.add(params, 'floatAmount', 0, 3, 0.05).name('둥실 폭');
  motionFolder.add(params, 'wobble', 0, 40, 1).name('흔들림 각도 (도)');
  motionFolder.add(params, 'parallax', 0, 2, 0.05).name('마우스 시점');

  const glintFolder = gui.addFolder('반짝임');
  glintFolder.add(params, 'lightPeriod', 4, 60, 1).name('빛 한 바퀴 (초)');
  glintFolder.add(params, 'glare', 0, 4, 0.05).name('글레어 세기');
  glintFolder.add(params, 'glareSharpness', 5, 300, 1).name('글레어 날카로움');
  glintFolder.add(params, 'sparkleAmount', 0, 0.6, 0.01).name('반짝이 양');
  glintFolder.add(params, 'sparkle', 0, 20, 0.1).name('반짝이 세기');

  const bloomFolder = gui.addFolder('빛 번짐');
  bloomFolder.add(params, 'bloomStrength', 0, 3, 0.05).name('세기');
  bloomFolder.add(params, 'bloomRadius', 0, 1, 0.01).name('퍼짐');
  bloomFolder.add(params, 'bloomThreshold', 0, 2, 0.01).name('문턱');

  const starFolder = gui.addFolder('별먼지');
  starFolder.add(params, 'starCount', 0, 5000, 100).name('개수').onFinishChange(buildStars);
  starFolder.add(params, 'twinkle', 0, 1, 0.01).name('깜빡임');

  addSettingsButtons(gui, { params, defaults: DEFAULTS, onApply: applyAll });

  // ── 입력: 마우스 시점 · 누르면 뒤집기 ─────────────────────────
  const reduced = prefersReducedMotion();
  const raycaster = new THREE.Raycaster();
  const pointer = { x: 0, y: 0, inside: false };
  const press = { active: false, x: 0, y: 0 };

  function toNdc(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * 2 - 1,
      y: -(((clientY - rect.top) / rect.height) * 2 - 1),
    };
  }
  canvas.addEventListener('pointermove', (event) => {
    const ndc = toNdc(event.clientX, event.clientY);
    pointer.x = ndc.x;
    pointer.y = ndc.y;
    pointer.inside = event.pointerType !== 'touch';
  });
  canvas.addEventListener('pointerleave', () => { pointer.inside = false; });
  canvas.addEventListener('pointerdown', (event) => {
    press.active = true;
    press.x = event.clientX;
    press.y = event.clientY;
  });
  canvas.addEventListener('pointerup', (event) => {
    const moved = Math.hypot(event.clientX - press.x, event.clientY - press.y);
    if (press.active && moved < CLICK_TOLERANCE_PX) {
      const ndc = toNdc(event.clientX, event.clientY);
      raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), stage.camera);
      const hit = raycaster.intersectObject(cards.mesh, false)[0];
      if (hit && hit.instanceId !== undefined && !flips.has(hit.instanceId)) {
        flips.set(hit.instanceId, performance.now() / 1000);
      }
    }
    press.active = false;
  });

  // ── 매 프레임 ───────────────────────────────────────────────
  const dummy = new THREE.Object3D();
  const startTime = performance.now() / 1000;
  let lastTime = startTime;
  let driftClock = 0;  // 떠다니는 시계: 떠다니는 속도를 곱해서 흐른다 (속도를 바꿔도 위치가 튀지 않게)
  let lightAngle = 0;  // 빛이 8자로 도는 각도
  let sparkleClock = 0;
  const camOffset = { x: 0, y: 0 };

  function frame() {
    const now = performance.now() / 1000;
    const dt = Math.min(0.05, now - lastTime) || 1 / 60;
    lastTime = now;
    const intro = reduced ? 1 : easeOutCubic((now - startTime) / INTRO_DURATION);
    if (!reduced) {
      driftClock += dt * params.speed;
      lightAngle += (dt * TAU) / params.lightPeriod;
      sparkleClock += dt;
    }

    // 1) 카메라: 커서 쪽으로 아주 천천히. 회전 없이 위치만 옮겨서 빛 방향을 화면 기준 그대로 쓸 수 있다
    const followCursor = pointer.inside && !reduced;
    camOffset.x = damp(camOffset.x, followCursor ? pointer.x * params.parallax : 0, PARALLAX_RATE, dt);
    camOffset.y = damp(camOffset.y, followCursor ? pointer.y * params.parallax : 0, PARALLAX_RATE, dt);
    stage.camera.position.set(camOffset.x, camOffset.y, (1 - intro) * INTRO_DISTANCE);

    // 2) 빛·반짝임·빛 번짐·별: 패널 값을 매 프레임 그대로 넘긴다
    const [lx, ly, lz] = glintDirection(lightAngle);
    glint.uGlintDir.value.set(lx, ly, lz);
    glint.uGlare.value = params.glare;
    glint.uGlareSharpness.value = params.glareSharpness;
    glint.uSparkleAmount.value = params.sparkleAmount;
    glint.uSparkle.value = params.sparkle;
    glint.uTime.value = sparkleClock;
    bloom.strength = params.bloomStrength;
    bloom.radius = params.bloomRadius;
    bloom.threshold = params.bloomThreshold;
    stars.setTime(sparkleClock);
    stars.setTwinkle(reduced ? 0 : params.twinkle);

    // 3) 카드: 화면 좌표·깊이 → 공간 위치, 둥실·흔들림·깊이 어둠·뒤집기
    const view = { fov: CAMERA_FOV, aspect: stage.camera.aspect };
    const maxWobble = THREE.MathUtils.degToRad(params.wobble);
    for (let i = 0; i < field.length; i++) {
      const card = field[i];
      const base = cosmosPosition(card, view);
      const drift = floatOffset(card, driftClock, params.floatAmount);
      const angles = wobbleAngles(card, driftClock, maxWobble);
      dummy.position.set(base.x + drift.x, base.y + drift.y, base.z);
      dummy.rotation.set(angles.rotX, angles.rotY, angles.rotZ);
      dummy.scale.setScalar((card.size / CARD_H) * params.cardScale);
      dummy.updateMatrix();
      cards.mesh.setMatrixAt(i, dummy.matrix);
      cards.setDim(i, depthDimming(-base.z, MIN_BRIGHTNESS));

      let flipProgress = 0;
      const flipStart = flips.get(i);
      if (flipStart !== undefined) {
        const t = (now - flipStart) / FLIP_DURATION;
        if (t >= 1) flips.delete(i);
        else flipProgress = easeInOutCubic(t);
      }
      cards.setFlip(i, flipProgress);
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
<!-- FILE: demos/05-cosmos/index.html -->
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>05 우주 표류 · Card Archive</title>
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
      <canvas id="stage-canvas" aria-label="별먼지 속에 흰 종이 카드들이 아주 느리게 떠다니다가 빛을 받는 순간 반짝이는 3D 장면"></canvas>
      <div class="stage-caption">
        <p class="caption-index">05</p>
        <h1>우주 표류</h1>
        <p>종이 카드가 별먼지 속을 떠다니다 빛을 받으면 반짝여.</p>
        <p class="caption-hint">마우스로 시점 살짝 · 누르면 뒤집혀</p>
        <a class="notes-jump" href="#notes">기법 노트 ↓</a>
      </div>
    </div>
  </section>

  <main class="notes" id="notes">
    <section>
      <h2>이 데모에 쓴 기법</h2>
      <dl>
        <dt>화면 기준 배치</dt>
        <dd>카드 26장의 자리를 공간 좌표가 아니라 "화면의 어디쯤(−1~1)·얼마나 깊이(0~1)"로 정해두고, 그릴 때 화면비에 맞춰 공간 좌표로 바꿔. 그래서 폰이든 와이드 모니터든 카드가 화면 전체에 고르게 퍼지고, 화면을 돌려도 다시 섞이지 않아. 배치 번호(시드)를 고정해서 열 때마다 같은 우주야.</dd>
        <dt>둥실·흔들림</dt>
        <dd>카드마다 처음 보는 방향이 조금씩 달라(±25°). 14~24초에 한 번 위아래로 둥실거리고, 9~17초에 한 번 각도가 최대 12°까지 흔들려. 먼 카드일수록 어둡게 해서 깊이가 느껴져.</dd>
        <dt>글레어</dt>
        <dd>보이지 않는 빛이 카메라 앞쪽에서 18초에 한 바퀴 8자를 그리며 훑어. 빛과 카메라의 딱 중간 방향이 카드 면과 맞는 순간, 거울에 해가 비치듯 빛 점이 카드 위를 쓱 지나가며 번쩍해.</dd>
        <dt>반짝이 알갱이</dt>
        <dd>카드 표면을 아주 작은 칸으로 나눠서 12% 칸에 알갱이를 박고, 알갱이마다 기울기를 살짝 다르게 줬어. 아주 날카로운 반사라 각도가 딱 맞는 알갱이만 번쩍이고, 글레어가 지나갈 때 그 근처에서 반짝반짝해.</dd>
        <dt>빛 번짐</dt>
        <dd>글레어와 반짝이는 일부러 1보다 밝게 그려. 빛 번짐은 밝기 1을 넘는 곳만 번지게 해서, 종이는 하얗게 날아가지 않고 번쩍이는 순간만 빛이 퍼져.</dd>
        <dt>별먼지</dt>
        <dd>카드 뒤 먼 곳에 점 1,800개를 흩뿌리고, 별마다 다른 박자로 깜빡이게 했어. 대부분 아주 작고 가끔 조금 큰 별이 섞여 있어.</dd>
      </dl>
    </section>
    <section>
      <h2>참고한 곳</h2>
      <p>반짝임 원리만 공부했고, 코드는 가져오지 않았어.</p>
      <p><a href="https://github.com/simeydotme/pokemon-cards-css" target="_blank" rel="noopener">Pokémon Cards CSS</a> (Simon Goellner): 커서를 따라 카드 위를 지나가는 글레어.</p>
      <p><a href="https://www.4rknova.com/blog/2025/08/30/foil-sticker" target="_blank" rel="noopener">Foil Sticker Shader</a> (4rknova): 칸마다 기울기를 비튼 반짝이 알갱이.</p>
      <p><a href="https://zackon-blog.pages.dev/posts/building-ziggy-card/" target="_blank" rel="noopener">Ziggy Card</a> (Isaac Johnson): Three.js 기본 재질에 셰이더를 덧붙여 각도별로 반짝이게 하는 방법.</p>
      <p><a href="#stage-canvas">↑ 우주로 돌아가기</a></p>
    </section>
  </main>

  <script type="module" src="./main.js?v=1"></script>
</body>
</html>
```

- [ ] **Step 3:** 아카이브 `index.html`의 05 항목을 `<a class="demo-item" href="demos/05-cosmos/">`, 상태 "완성", 설명 "종이 카드가 별먼지 속을 떠다니다 빛을 받는 순간 반짝여."로.

### Task 5: 첫 화면 배치 번호 고르기 + 화면 확인

- [ ] **Step 1:** 시드 1~600을 계산해서, 화면비 1.6 첫 화면에서 카드끼리 화면상 겹치는 쌍이 가장 적고 가운데에도 카드가 있는 번호를 `FIELD_SEED`로.
- [ ] **Step 2:** 1280×800·375×812에서 콘솔 에러 0, 글레어·반짝이·빛 번짐·별·뒤집기 확인. 01~04도 콘솔 에러 0.
