# 카드 아카이브 02 구 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 휜 종이 카드가 피보나치 구 표면에 붙어 자전·드래그(던지는 관성)로 돌고, 스크롤하면 토성 고리 두 겹으로 변신하는 "02 구" 데모를 만든다.

**Architecture:** 01 나선의 공통 부품(stage, card-material, card-geometry, panel, texture-presets)을 그대로 쓴다. 새 순수 계산(구·고리 배치, 깊이 밝기, 변신 진행도, 각도 접기)은 `demos/02-sphere/layout.js`, 던지는 관성 `Momentum`은 `shared/motion.js`에 추가해 Node 테스트로 TDD 한다. 질감 패널 폴더는 `shared/texture-panel.js`로 빼서 01도 같이 쓰게 바꾼다.

**Tech Stack:** three@0.187.0, lenis@1.3.27, Pretendard 1.3.9, Node `node --test`.

**Reference:** Seventeen About 페이지 Sphere Interaction (https://www.seventeenagency.com/about) — 피보나치 구, 바깥 고리 60%(반지름 0.9배, 7° 기울임) + 안쪽 고리 40%(0.6배), 깊이 밝기 10%~100%, 공 크기 = 화면 짧은 쪽 40%, 변신 시 공 회전을 풀어서 고리를 반듯하게. **코드는 복사하지 않고 기법·비율만 참고.**

## Global Constraints

- 01 계획의 Global Constraints 전부 그대로 (three 0.187.0 고정, 토큰 SSOT, 72/48/32/24/22/18/14px, 제목 흰색, 공통 파일 수정 시 `?v=` 올리기, 한국어 주석, Grail·Seventeen 코드 복사 금지, git 없음 → 커밋 단계 없음).
- 스크롤은 감기·회전에 직접 쓰지 않는다. 스크롤 = 연출 진행도 (01에서 배운 것). Lenis 1.3.27.
- 깊이 밝기는 Seventeen 값: 뒤 0.1 ~ 앞 1.0.
- 카드 고리 반지름은 Seventeen 비율(0.9 / 0.6)에 `ringScale`(기본 1.67)을 곱한다. 아이콘보다 카드가 커서, 그대로면 고리에서 카드가 겹치기 때문.

## 파일 구조

| 파일 | 역할 | 테스트 |
|---|---|---|
| `shared/motion.js` (수정) | `Momentum` 추가: 드래그 중엔 손을 따라가고 놓으면 그 속도로 미끄러지다 마찰로 멈춤 | `tests/motion.test.js` |
| `demos/02-sphere/layout.js` | 순수: `fibonacciSphere`, `ringPoints`, `depthBrightness`, `morphProgress`, `wrapAngle` | `tests/sphere-layout.test.js` |
| `shared/texture-panel.js` | 질감 폴더(프리셋·광택·거칠기·무지개·색·R)를 패널에 붙이는 공통 함수 | 브라우저 |
| `demos/01-spiral/main.js` (수정) | 질감 폴더를 공통 함수로 교체, motion v2 | 브라우저(회귀) |
| `demos/01-spiral/layout.js` (수정) | motion import v2 | `tests/spiral-layout.test.js` |
| `demos/02-sphere/main.js` | 장면 조립, 드래그·자전·호버·클릭, 스크롤 변신, 패널 | 브라우저 |
| `demos/02-sphere/index.html` | 02 페이지 (캡션, 기법 노트, 참고 링크) | 브라우저 |
| `index.html` (수정) | 02를 완성·링크로 | 브라우저 |

---

### Task 1: `Momentum` — 던지는 관성 (TDD)

**Files:** Modify `shared/motion.js`, Test `tests/motion.test.js`

**Interfaces:**
- Produces: `class Momentum { value; velocity; friction; constructor({ friction = 3 } = {}); drag(delta: number, dt: number): void; update(dt: number, held: boolean): number }`

- [ ] **Step 1: 실패 테스트 추가** (`tests/motion.test.js` 맨 아래, import 줄에 `Momentum` 추가)

```js
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
```

- [ ] **Step 2: 실패 확인** — `npm test` → `Momentum` export 없음으로 FAIL
- [ ] **Step 3: 구현** (`shared/motion.js` 맨 아래)

```js
// "던지는 관성": 드래그하는 동안은 손을 바로 따라가고(value += delta),
// 손을 놓으면 마지막 속도로 계속 미끄러지다 마찰(friction)로 서서히 멈춘다.
// 누른 채 가만히 있으면 속도가 빠르게 0이 돼서, 그대로 놓아도 던져지지 않는다.
export class Momentum {
  constructor({ friction = 3 } = {}) {
    this.value = 0;
    this.velocity = 0;      // 초당 이동량
    this.friction = friction; // 클수록 빨리 멈춘다
  }

  drag(delta, dt) {
    this.value += delta;
    // 순간 속도를 바로 쓰면 튀니까 직전 속도와 반반 섞는다
    if (dt > 0) this.velocity = lerp(this.velocity, delta / dt, 0.5);
  }

  update(dt, held) {
    if (held) {
      this.velocity *= Math.exp(-12 * dt); // 누른 채 멈춰 있으면 속도를 빠르게 지운다
      return this.value;
    }
    this.value += this.velocity * dt;
    this.velocity *= Math.exp(-this.friction * dt);
    if (Math.abs(this.velocity) < 1e-4) this.velocity = 0;
    return this.value;
  }
}
```

- [ ] **Step 4: 통과 확인** — `npm test` → `# pass 28`

---

### Task 2: 구·고리 배치 계산 `demos/02-sphere/layout.js` (TDD)

**Files:** Create `demos/02-sphere/layout.js`, Test `tests/sphere-layout.test.js`

**Interfaces:**
- Consumes: `clamp`, `smoothstep` from `shared/motion.js?v=2`
- Produces:
  - `fibonacciSphere(count, radius): {x,y,z}[]`
  - `ringPoints(count, radius, { ringScale = 1, outerRatio = 0.6, tilt = 0, innerTiltOffset = 0, spin = 0 } = {}): {x,y,z}[]` — 앞 `ceil(count×outerRatio)`개가 바깥 고리
  - `depthBrightness(z, radius, min, max): number`
  - `MORPH_STAGE = [0.2, 1.2]`, `morphProgress(screens): number`
  - `wrapAngle(a): number` — (-π, π]

- [ ] **Step 1: 실패 테스트** — `tests/sphere-layout.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fibonacciSphere, ringPoints, depthBrightness, morphProgress, wrapAngle } from '../demos/02-sphere/layout.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const len = (p) => Math.hypot(p.x, p.y, p.z);

test('fibonacciSphere: 개수만큼, 전부 반지름 위에, 위아래로 고르게', () => {
  const pts = fibonacciSphere(40, 2);
  assert.equal(pts.length, 40);
  pts.forEach((p) => close(len(p), 2));
  const meanY = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  close(meanY, 0, 1e-9);                // 위아래 균형
  assert.ok(pts[0].y > 1.9 && pts[39].y < -1.9); // 첫 카드는 꼭대기 근처, 마지막은 바닥 근처
});

test('fibonacciSphere: 정확히 극(꼭짓점)에 놓이는 카드는 없다', () => {
  fibonacciSphere(40, 2).forEach((p) => assert.ok(Math.abs(p.y) < 2 - 1e-6));
});

test('ringPoints: 60%는 바깥 고리(0.9배), 나머지는 안쪽 고리(0.6배)', () => {
  const pts = ringPoints(10, 2, { ringScale: 1 });
  assert.equal(pts.length, 10);
  pts.slice(0, 6).forEach((p) => close(len(p), 1.8));
  pts.slice(6).forEach((p) => close(len(p), 1.2));
  pts.forEach((p) => close(p.y, 0)); // 기울기 0이면 수평
});

test('ringPoints: 90° 기울이면 고리가 세로로 선다', () => {
  ringPoints(8, 2, { tilt: Math.PI / 2 }).forEach((p) => close(p.z, 0));
});

test('depthBrightness: 맨 뒤 min, 맨 앞 max, 가운데는 중간', () => {
  close(depthBrightness(-2.8, 2, 0.1, 1), 0.1);
  close(depthBrightness(2.8, 2, 0.1, 1), 1);
  close(depthBrightness(0, 2, 0.1, 1), 0.55);
  close(depthBrightness(-99, 2, 0.1, 1), 0.1); // 범위 밖은 잘린다
});

test('morphProgress: 0.2화면 전엔 공, 1.2화면 뒤엔 고리, 가운데는 반', () => {
  close(morphProgress(0), 0);
  close(morphProgress(0.7), 0.5);
  close(morphProgress(2), 1);
});

test('wrapAngle: 몇 바퀴를 돌았든 -π~π로 접는다', () => {
  close(wrapAngle(0.5), 0.5);
  close(Math.abs(wrapAngle(3 * Math.PI)), Math.PI);
  close(wrapAngle(2 * Math.PI + 0.3), 0.3);
});
```

- [ ] **Step 2: 실패 확인** — `npm test` → 모듈 없음 FAIL
- [ ] **Step 3: 구현** — `demos/02-sphere/layout.js`

```js
// ─────────────────────────────────────────────────────────────
// layout.js — 02 구: 카드를 공·토성 고리에 배치하는 계산 (Three.js 없이 숫자만)
// 참고: Seventeen Sphere Interaction의 배치 비율 (코드 복사 X, 기법만)
// ─────────────────────────────────────────────────────────────
import { clamp, smoothstep } from '../../shared/motion.js?v=2';

// 피보나치 구: 해바라기 씨앗처럼 황금비(1.618…)만큼씩 돌려가며 점을 놓으면
// 공 표면에 빈틈 없이 고르게 퍼진다.
// y를 위아래 축으로 쓰고, (i + 0.5)로 반 칸 밀어서 정확히 꼭짓점에 놓이는 카드가 없게 한다.
// (꼭짓점에 카드가 있으면 "바깥 보기" 방향 계산이 흔들린다)
export function fibonacciSphere(count, radius) {
  const golden = (1 + Math.sqrt(5)) / 2;
  const points = [];
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const polar = Math.acos(1 - 2 * t);         // 0(꼭대기) → π(바닥)
    const azimuth = (2 * Math.PI * i) / golden; // 황금비만큼씩 돌기
    points.push({
      x: radius * Math.sin(polar) * Math.cos(azimuth),
      y: radius * Math.cos(polar),
      z: radius * Math.sin(polar) * Math.sin(azimuth),
    });
  }
  return points;
}

// 토성 고리 두 겹. 앞쪽 outerRatio(60%)는 바깥 고리, 나머지는 안쪽 고리.
//   바깥 반지름 = radius × 0.9 × ringScale, 안쪽 = radius × 0.6 × ringScale (Seventeen 비율)
//   tilt: 고리를 X축으로 기울이는 각도. 안쪽 고리는 innerTiltOffset만큼 더 기울여 살짝 엇갈리게
//   spin: 고리가 돈 각도. 안쪽 고리는 1.3배 빨리 돈다 (토성처럼 안쪽이 더 빠르게)
export function ringPoints(count, radius, { ringScale = 1, outerRatio = 0.6, tilt = 0, innerTiltOffset = 0, spin = 0 } = {}) {
  const outerCount = Math.ceil(count * outerRatio);
  const innerCount = count - outerCount;
  const points = [];
  const addRing = (n, r, tiltX, angleOffset) => {
    const c = Math.cos(tiltX);
    const s = Math.sin(tiltX);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + angleOffset;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      // 수평 고리(y=0)를 X축으로 tiltX만큼 돌린 위치
      points.push({ x, y: -z * s, z: z * c });
    }
  };
  addRing(outerCount, radius * 0.9 * ringScale, tilt, spin);
  addRing(innerCount, radius * 0.6 * ringScale, tilt + innerTiltOffset, spin * 1.3);
  return points;
}

// Seventeen식 깊이 밝기: 카메라 쪽(+z)일수록 밝고 뒤(-z)일수록 어둡다.
// 공 반지름의 1.4배 범위를 0~1로 펴서 min~max로 바꾼다 (Seventeen: 0.1 ~ 1.0)
export function depthBrightness(z, radius, min, max) {
  const range = radius * 1.4;
  return min + (max - min) * clamp((z + range) / (range * 2), 0, 1);
}

// 스크롤 변신 구간 (화면 높이 단위): 0.2화면부터 1.2화면까지 공 → 고리
export const MORPH_STAGE = [0.2, 1.2];
export function morphProgress(screens) {
  return smoothstep(MORPH_STAGE[0], MORPH_STAGE[1], screens);
}

// 각도를 -π~π 사이로 접는다. 공을 몇 바퀴 돌렸든 변신할 때 회전을 풀면서
// 반 바퀴 이상 휘리릭 돌지 않게 하려고 쓴다
export function wrapAngle(a) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}
```

- [ ] **Step 4: 통과 확인** — `npm test` → `# pass 35`

---

### Task 3: 질감 패널 공통화 + 01 회귀 확인

**Files:** Create `shared/texture-panel.js`; Modify `demos/01-spiral/main.js`, `demos/01-spiral/layout.js`, `demos/01-spiral/index.html`

**Interfaces:**
- Consumes: `syncMaterial`, `setCornerRadius` (card-material v3), `PRESET_NAMES`, `presetToParams` (texture-presets v1), `refreshPanel` (panel v2)
- Produces: `addTextureFolder(gui, { params, material, paperColor }): GUI` — '질감' 폴더를 만들어 돌려준다 (휨은 데모마다 다르게 붙이도록 넣지 않음)

- [ ] **Step 1: `shared/texture-panel.js` 작성**

```js
// ─────────────────────────────────────────────────────────────
// texture-panel.js — 모든 데모에 똑같이 들어가는 "질감" 패널 폴더
// 프리셋·광택·거칠기·무지개·카드 색·모서리 R. (휨은 데모마다 적용 방식이 달라서 데모가 직접 붙인다)
// ─────────────────────────────────────────────────────────────
import { syncMaterial, setCornerRadius } from './card-material.js?v=3';
import { PRESET_NAMES, presetToParams } from './texture-presets.js?v=1';
import { refreshPanel } from './panel.js?v=2';

export function addTextureFolder(gui, { params, material, paperColor }) {
  const sync = () => syncMaterial(material, params);
  const folder = gui.addFolder('질감');
  folder.add(params, 'preset', PRESET_NAMES).name('질감 프리셋').onChange((name) => {
    // 프리셋을 고르면 광택·거칠기·무지개·색을 프리셋 값으로 채운다
    Object.assign(params, presetToParams(name, paperColor));
    sync();
    refreshPanel(gui);
  });
  folder.add(params, 'gloss', 0, 1, 0.01).name('광택 (코팅)').onChange(sync);
  folder.add(params, 'roughness', 0, 1, 0.01).name('거칠기').onChange(sync);
  folder.add(params, 'rainbow', 0, 1, 0.01).name('무지개 세기').onChange(sync);
  folder.addColor(params, 'cardColor').name('카드 색').onChange(sync);
  folder.add(params, 'corner', 0, 0.4, 0.005).name('모서리 둥글기 (R)').onChange((value) => setCornerRadius(material, value));
  return folder;
}
```

- [ ] **Step 2: 01 main.js — import 정리**
  - `import { DEFAULT_PRESET, PRESET_NAMES, presetToParams } …` → `import { DEFAULT_PRESET, presetToParams } from '../../shared/texture-presets.js?v=1';`
  - `import { createPanel, addSettingsButtons, refreshPanel } …` → `import { createPanel, addSettingsButtons } from '../../shared/panel.js?v=2';` + 다음 줄 `import { addTextureFolder } from '../../shared/texture-panel.js?v=1';`
  - `motion.js?v=1` → `motion.js?v=2`, `layout.js?v=3` → `layout.js?v=4`
- [ ] **Step 3: 01 main.js — 질감 폴더 블록 교체.** 기존 `const syncTexture = …` 부터 `texture.add(params, 'corner', …)` 줄까지를 아래로:

```js
  const texture = addTextureFolder(gui, { params, material, paperColor: paper });
  texture.add(params, 'bend', 0, 0.5, 0.01).name('휨'); // 실제 적용은 매 프레임 루프에서
```

- [ ] **Step 4: 01 layout.js** — `motion.js?v=1` → `motion.js?v=2`; 01 index.html `main.js?v=11` → `?v=12`
- [ ] **Step 5: 회귀 확인** — `npm test` 35 통과. 브라우저 `/demos/01-spiral/`: 콘솔 에러 0, 질감 프리셋 금박 전환 시 패널 값 갱신, R 슬라이더 동작, 스크롤 1.8화면에서 한 장 남기.

---

### Task 4: 02 페이지 + 공 배치 + 드래그·자전·호버·클릭

**Files:** Create `demos/02-sphere/index.html`, `demos/02-sphere/main.js`

**Interfaces:**
- Consumes: stage v5, card-material v3, card-geometry v1, motion v2(`damp`, `lerp`, `easeOutCubic`, `easeInOutCubic`, `Momentum`, `prefersReducedMotion`), texture-presets v1, panel v2, texture-panel v1, layout v1(Task 2 전부)

- [ ] **Step 1: `demos/02-sphere/index.html`** — 01 페이지와 같은 뼈대(Pretendard, lenis.css, tokens v1, base v3, importmap three·addons·lenis), 제목/설명:
  - caption: `02` / `구` / `휘어진 종이 카드가 공 표면을 덮고 돌아.` / hint `드래그로 던지듯 돌리기 · 스크롤하면 토성 고리로 · 카드를 누르면 뒤집혀`
  - 기법 노트 dt/dd: 피보나치 구, 바깥 보기 + 항상 똑바로, 던지는 관성, 깊이 밝기(뒤 10%), 공 → 토성 고리 변신(위치 섞기 + 방향 섞기 + 회전 풀기), 떠오르는 카드, 스크롤 연출 + Lenis
  - 참고한 곳: Seventeen 링크 + "코드는 복사하지 않고 기법만 공부해서 다시 만들었어."
  - `<script type="module" src="./main.js?v=1">`
  - (전체 HTML은 실행 단계에서 01 index.html을 복제해 위 항목만 바꾼다 — 구조·클래스는 01과 동일)
- [ ] **Step 2: `demos/02-sphere/main.js`** — 아래 전체 코드

```js
// ─────────────────────────────────────────────────────────────
// 02 구 — 휘어진 종이 카드가 공 표면에 붙어 돌고, 스크롤하면 토성 고리로 변신한다
// 참고: Seventeen(seventeenagency.com/about) Sphere Interaction — 코드 복사 없이 기법만
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import Lenis from 'lenis';
import { createStage, showWebGLFallback, readToken } from '../../shared/stage.js?v=5';
import { createCardMaterial, syncMaterial, setCornerRadius } from '../../shared/card-material.js?v=3';
import { createCardInstances } from '../../shared/card-geometry.js?v=1';
import { damp, lerp, easeOutCubic, easeInOutCubic, Momentum, prefersReducedMotion } from '../../shared/motion.js?v=2';
import { DEFAULT_PRESET, presetToParams } from '../../shared/texture-presets.js?v=1';
import { createPanel, addSettingsButtons } from '../../shared/panel.js?v=2';
import { addTextureFolder } from '../../shared/texture-panel.js?v=1';
import { fibonacciSphere, ringPoints, depthBrightness, morphProgress, wrapAngle } from './layout.js?v=1';

const CARD_W = 1.6;                  // 01과 같은 카드 (Grail 비율 1.42, R 20/345)
const CARD_H = CARD_W * (490 / 345);
const CORNER_RADIUS = CARD_W * (20 / 345);
// 공 반지름 2.75가 화면 높이의 40%가 되는 거리 (Seventeen: 화면 짧은 쪽의 40%)
//   화면 절반 높이 = 2.75 / 0.4 / 2 = 3.44 → 거리 = 3.44 / tan(19°) ≈ 10
const CAMERA_DISTANCE = 10;
const MIN_BRIGHTNESS = 0.1;          // Seventeen: 맨 뒤 10%
const MAX_BRIGHTNESS = 1.0;
const DRAG_RADIANS_PER_PX = 0.005;   // 1px 드래그 = 0.005라디안 회전
const INNER_TILT_OFFSET = -0.12;     // 안쪽 고리를 바깥 고리보다 살짝 더 기울여 엇갈리게
const INTRO_DURATION = 1.8;
const INTRO_RADIUS_SCALE = 2.2;      // 등장할 때 2.2배 크게 흩어져 있다가 모인다
const FLIP_DURATION = 1.1;
const CLICK_TOLERANCE_PX = 6;

function main() {
  const canvas = document.getElementById('stage-canvas');
  let stage;
  try {
    stage = createStage({ canvas, fov: 38 });
  } catch (error) {
    console.warn('WebGL 초기화 실패', error);
    showWebGLFallback(canvas);
    return;
  }

  // ── 기본값 ──────────────────────────────────────────────────
  const paper = readToken('--card-paper');
  const DEFAULTS = {
    ...presetToParams(DEFAULT_PRESET, paper),
    bend: 0.11,        // 공 곡면에 맞춘 휨: 카드 크기 0.6 ÷ (2 × 반지름 2.75)
    corner: CORNER_RADIUS,
    count: 40,         // 카드 수
    radius: 2.75,      // 공 반지름
    cardScale: 0.6,    // 카드 크기 배율 (가로 0.96)
    autoSpin: 0.15,    // 자전 속도 (초당 라디안)
    friction: 3,       // 관성 마찰: 클수록 빨리 멈춘다
    lift: 0.35,        // 커서 아래 카드가 바깥으로 떠오르는 높이
    ringScale: 1.67,   // 고리 크기: 카드가 겹치지 않게 Seventeen 비율에 곱하는 값
    ringTilt: 0.35,    // 고리 기울기 (라디안, ≈20°)
    innerRatio: 0.4,   // 안쪽 고리 카드 비율 (Seventeen 40%)
    ringSpin: 0.2,     // 고리 도는 속도 (초당 라디안)
    morphPreview: 0,   // 스크롤 없이 변신 미리보기 (0=공, 1=고리)
  };
  const params = structuredClone(DEFAULTS);

  // ── 장면 ────────────────────────────────────────────────────
  const material = createCardMaterial({ cardWidth: CARD_W, cardHeight: CARD_H, cornerRadius: CORNER_RADIUS });
  syncMaterial(material, params);
  let cards = createCardInstances({ count: params.count, width: CARD_W, height: CARD_H, bend: params.bend, material });
  stage.scene.add(cards.mesh);
  let lifts = new Float32Array(params.count); // 카드별 현재 떠오른 높이

  function rebuildCards() {
    stage.scene.remove(cards.mesh);
    cards.dispose();
    cards = createCardInstances({ count: params.count, width: CARD_W, height: CARD_H, bend: params.bend, material });
    stage.scene.add(cards.mesh);
    lifts = new Float32Array(params.count);
    flips.clear();
  }

  function applyAll() {
    syncMaterial(material, params);
    setCornerRadius(material, params.corner);
    if (params.count !== cards.count) rebuildCards();
    cards.setBend(params.bend);
  }

  // ── 패널 ────────────────────────────────────────────────────
  const gui = createPanel('02 구 · 조절 패널');
  const texture = addTextureFolder(gui, { params, material, paperColor: paper });
  texture.add(params, 'bend', 0, 0.5, 0.01).name('휨').onChange((value) => cards.setBend(value));

  const sphereFolder = gui.addFolder('공');
  sphereFolder.add(params, 'radius', 1.5, 4, 0.05).name('반지름');
  sphereFolder.add(params, 'count', 12, 80, 1).name('카드 수').onFinishChange(rebuildCards);
  sphereFolder.add(params, 'cardScale', 0.3, 1.2, 0.01).name('카드 크기');
  sphereFolder.add(params, 'autoSpin', 0, 1, 0.01).name('자전 속도');
  sphereFolder.add(params, 'friction', 0.5, 8, 0.1).name('관성 마찰');
  sphereFolder.add(params, 'lift', 0, 1, 0.01).name('떠오름');

  const ringFolder = gui.addFolder('토성 고리');
  ringFolder.add(params, 'ringScale', 1, 2.5, 0.01).name('고리 크기');
  ringFolder.add(params, 'ringTilt', -1, 1, 0.01).name('고리 기울기');
  ringFolder.add(params, 'innerRatio', 0, 0.8, 0.01).name('안쪽 고리 비율');
  ringFolder.add(params, 'ringSpin', 0, 1, 0.01).name('고리 속도');
  ringFolder.add(params, 'morphPreview', 0, 1, 0.01).name('변신 미리보기 (0=공, 1=고리)');

  addSettingsButtons(gui, { params, defaults: DEFAULTS, onApply: applyAll });

  // ── 입력 ────────────────────────────────────────────────────
  const reduced = prefersReducedMotion();
  const lenis = reduced ? null : new Lenis({ autoRaf: true, syncTouch: false });
  const scrollScreens = () => (lenis ? lenis.scroll : window.scrollY) / window.innerHeight;

  const spinY = new Momentum({ friction: params.friction }); // 좌우 드래그 → Y축 회전
  const spinX = new Momentum({ friction: params.friction }); // 상하 드래그 → X축 회전
  const pointer = { x: 0, y: 0, inside: false };
  const press = { active: false, held: false, startX: 0, startY: 0, lastX: 0, lastY: 0, lastT: 0 };

  function toNdc(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
      y: -(((event.clientY - rect.top) / rect.height) * 2 - 1),
    };
  }

  canvas.addEventListener('pointermove', (event) => {
    const ndc = toNdc(event);
    pointer.x = ndc.x;
    pointer.y = ndc.y;
    pointer.inside = event.pointerType !== 'touch';
    if (press.held) {
      const dt = (event.timeStamp - press.lastT) / 1000;
      spinY.drag((event.clientX - press.lastX) * DRAG_RADIANS_PER_PX, dt);
      spinX.drag((event.clientY - press.lastY) * DRAG_RADIANS_PER_PX, dt);
      press.lastX = event.clientX;
      press.lastY = event.clientY;
      press.lastT = event.timeStamp;
    }
  });
  canvas.addEventListener('pointerleave', () => {
    pointer.inside = false;
    press.held = false;
  });
  canvas.addEventListener('pointerdown', (event) => {
    press.active = true;
    press.startX = press.lastX = event.clientX;
    press.startY = press.lastY = event.clientY;
    press.lastT = event.timeStamp;
    if (event.pointerType !== 'touch') { // 터치는 스크롤(= 변신 연출)에 맡긴다
      press.held = true;
      canvas.setPointerCapture(event.pointerId);
    }
  });
  canvas.addEventListener('pointerup', (event) => {
    const moved = Math.hypot(event.clientX - press.startX, event.clientY - press.startY);
    if (press.active && moved < CLICK_TOLERANCE_PX) handleClick(event);
    press.active = false;
    press.held = false;
  });
  canvas.addEventListener('pointercancel', () => {
    press.active = false;
    press.held = false;
  });

  // ── 클릭 → 뒤집기, 호버 → 떠오르기 ─────────────────────────
  const raycaster = new THREE.Raycaster();
  const flips = new Map(); // 카드 번호 → 뒤집기 시작 시각(초)

  function pick(ndcX, ndcY) {
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), stage.camera);
    const hit = raycaster.intersectObject(cards.mesh, false)[0];
    return hit && hit.instanceId !== undefined ? hit.instanceId : -1;
  }
  function handleClick(event) {
    const ndc = toNdc(event);
    const id = pick(ndc.x, ndc.y);
    if (id >= 0 && !flips.has(id)) flips.set(id, performance.now() / 1000);
  }

  // ── 매 프레임 ───────────────────────────────────────────────
  const dummy = new THREE.Object3D();
  const facer = new THREE.Object3D(); // "바깥을 보는 방향" 계산용 도우미
  const sphereRotation = new THREE.Matrix4();
  const euler = new THREE.Euler();
  const sphereVec = new THREE.Vector3();
  const ringVec = new THREE.Vector3();
  const position = new THREE.Vector3();
  const outward = new THREE.Vector3();
  const sphereQuat = new THREE.Quaternion();
  const ringQuat = new THREE.Quaternion();
  const startTime = performance.now() / 1000;
  let lastTime = startTime;
  let ringSpin = 0;

  // p에서 바깥(원점 반대쪽)을 보면서, 화면 기준으로 항상 똑바로 선 방향
  // (lookAt의 기준 위쪽 = 월드 Y라서 카드가 거꾸로 뒤집히지 않는다)
  function faceOutward(target, p) {
    facer.position.copy(p);
    facer.lookAt(p.x * 2, p.y * 2, p.z * 2);
    target.copy(facer.quaternion);
  }

  function frame() {
    const now = performance.now() / 1000;
    const dt = Math.min(0.05, now - lastTime) || 1 / 60;
    lastTime = now;
    const intro = reduced ? 1 : easeOutCubic((now - startTime) / INTRO_DURATION);

    // 1) 변신 진행도: 스크롤 연출과 패널 미리보기 중 큰 쪽
    const morph = Math.max(morphProgress(scrollScreens()), params.morphPreview);

    // 2) 회전: 자전(공일 때만) + 드래그 던지기 관성
    spinY.friction = spinX.friction = params.friction;
    if (!reduced && !press.held) spinY.value += params.autoSpin * dt * (1 - morph);
    spinY.update(dt, press.held);
    spinX.update(dt, press.held);
    if (!reduced) ringSpin += params.ringSpin * dt;

    // 3) 카메라: 폰처럼 좁은 화면이면 조금 뒤로
    const narrowFit = Math.sqrt(Math.max(1, 1 / stage.camera.aspect));
    stage.camera.position.set(0, 0, CAMERA_DISTANCE * narrowFit);

    // 4) 두 가지 배치를 계산해 두고 morph만큼 섞는다
    const radius = lerp(params.radius * INTRO_RADIUS_SCALE, params.radius, intro);
    const spherePoints = fibonacciSphere(cards.count, radius);
    const ringPts = ringPoints(cards.count, params.radius, {
      ringScale: params.ringScale,
      outerRatio: 1 - params.innerRatio,
      tilt: params.ringTilt,
      innerTiltOffset: INNER_TILT_OFFSET,
      spin: ringSpin,
    });
    // 변신할수록 공 회전을 풀어서 고리가 반듯하게 선다 (Seventeen 방식)
    const unwind = 1 - morph;
    euler.set(wrapAngle(spinX.value) * unwind, wrapAngle(spinY.value) * unwind, 0);
    sphereRotation.makeRotationFromEuler(euler);

    // 5) 호버: 커서 아래 카드 (드래그 중엔 안 함)
    const hovered = pointer.inside && !press.held ? pick(pointer.x, pointer.y) : -1;
    const scale = params.cardScale * lerp(0.4, 1, intro);

    for (let i = 0; i < cards.count; i++) {
      sphereVec.set(spherePoints[i].x, spherePoints[i].y, spherePoints[i].z).applyMatrix4(sphereRotation);
      ringVec.set(ringPts[i].x, ringPts[i].y, ringPts[i].z);
      faceOutward(sphereQuat, sphereVec);
      faceOutward(ringQuat, ringVec);

      position.lerpVectors(sphereVec, ringVec, morph);
      dummy.quaternion.slerpQuaternions(sphereQuat, ringQuat, morph);

      // 떠오르기: 바깥 방향으로 lift만큼 (부드럽게)
      lifts[i] = damp(lifts[i], i === hovered ? params.lift : 0, 10, dt);
      outward.copy(position).normalize();
      position.addScaledVector(outward, lifts[i]);

      dummy.position.copy(position);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      cards.mesh.setMatrixAt(i, dummy.matrix);
      cards.setDim(i, depthBrightness(position.z, params.radius, MIN_BRIGHTNESS, MAX_BRIGHTNESS));

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

- [ ] **Step 3: 브라우저 확인** — `/demos/02-sphere/`: 콘솔 에러 0; 등장 시 흩어졌다 공으로 모임; 공이 천천히 자전; 뒤쪽 카드 진하게 어두움; 드래그 후 놓으면 미끄러지다 멈춤; 카드 위 커서 → 바깥으로 떠오름; 클릭 → 물결 뒤집기.

---

### Task 5: 스크롤 변신·패널 검증 + 아카이브 목록 갱신

**Files:** Modify `index.html` (02 항목)

- [ ] **Step 1: 변신 구간 확인** — 스크롤 0 / 0.7 / 1.5화면에서 스크린샷: 공 → 섞이는 중 → 토성 고리 두 겹(바깥 24장, 안쪽 16장), 고리가 돈다. 다시 0으로 올리면 공.
- [ ] **Step 2: 패널 확인** — 변신 미리보기 0→1, 고리 기울기, 안쪽 고리 비율, 카드 수 20(재생성 에러 없음), 금박 프리셋, 설정 복사(프롬프트 대체 경로)·기본값.
- [ ] **Step 3: 모바일 375px** — 가로 넘침 없음, 패널 접힘, 공이 화면 안.
- [ ] **Step 4: `index.html` 02 항목을 링크·완성으로**

```html
      <li>
        <a class="demo-item" href="demos/02-sphere/">
          <span class="demo-index">02</span>
          <span class="demo-name">구</span>
          <span class="demo-status">완성</span>
          <span class="demo-desc">휘어진 카드가 공을 덮고 돌다가, 스크롤하면 토성 고리로 변신해.</span>
        </a>
      </li>
```

- [ ] **Step 5: `npm test` 35 통과, 사용자 "개멋짐" 판정**
