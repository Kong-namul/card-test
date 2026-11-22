# 카드 아카이브 03 터널(튜브) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 휜 종이 카드 6줄 × 12칸이 세로 원통을 감싸고, 휠·트랙패드·터치로 위아래 끝없이 쫀득하게 흐르며, 카드에 커서를 올리면 슬로모션이 되고, 뒤에 휘어진 격자가 같이 움직이는 "03 터널" 데모를 만든다.

**Architecture:** 01·02 공통 부품(stage, card-material, card-geometry, panel, texture-panel, texture-presets, motion)을 그대로 쓴다. 튜브 배치·루프·움직임 계산은 `demos/03-tunnel/layout.js`(순수, TDD), 휘어진 격자는 `demos/03-tunnel/grid.js`(셰이더). 페이지는 화면 고정형(휠을 3D가 가져감)이라 base.css에 `.stage-wrap.is-fixed`와 노트 이동 링크를 추가한다. 토큰 rgba 색을 3D에서 읽는 `readTokenRGBA`를 stage.js에 추가한다.

**Tech Stack:** three@0.187.0, Pretendard 1.3.9, Node `node --test`. (03은 페이지 스크롤을 거의 안 써서 Lenis 없음)

**Reference:** Codrops "Reactive Depth: Building a Scroll-Driven 3D Image Tube with React Three Fiber" (Matis Dené, 2026-02-17), 데모 https://tympanus.net/Tutorials/3DImageTubeR3F/ — 카드 5줄×12칸, 스크롤 따라가기 프레임당 12%, 회전 속도 프레임당 8% 감쇠, 호버 시 시간 느려짐, 가장자리·가운데를 셰이더로 민 휘어진 격자. **코드는 복사하지 않고 기법만.**

## Global Constraints

- 01 계획의 Global Constraints 전부 그대로 (three 0.187.0, 토큰 SSOT, 72/48/32/24/22/18/14px, 제목 흰색, 공통 파일 수정 시 사용하는 모든 곳의 `?v=` 올리기, 한국어 주석, 레퍼런스 코드 복사 금지, git 없음).
- 격자 선 색은 토큰 `--border`(rgba(255,255,255,0.12))만 쓴다.
- 실행 방식: 이 문서의 코드 블록 첫 줄이 `// FILE: 경로` 또는 `<!-- FILE: 경로 -->`인 블록은 그 경로 파일의 **전체 내용**이다. 실행 단계에서 스크립트로 그대로 추출해 쓴다(재타이핑 금지).

## 파일 구조

| 파일 | 역할 | 테스트 |
|---|---|---|
| `demos/03-tunnel/layout.js` | 순수: `wrapCentered`, `tubeSlot`, `edgeFade`, `stepTubeMotion` | `tests/tunnel-layout.test.js` |
| `shared/stage.js` (수정) | `readTokenRGBA` 추가 → v6, 01·02·03 import v6 | 브라우저 |
| `shared/base.css` (수정) | `.stage-wrap.is-fixed`, `.notes-jump` → v4, 모든 페이지 v4 | 브라우저 |
| `demos/03-tunnel/grid.js` | 휘어진 배경 격자 (ShaderMaterial) | 브라우저 |
| `demos/03-tunnel/main.js` | 장면, 휠·터치 입력, 호버 슬로모션, 클릭 뒤집기, 패널 | 브라우저 |
| `demos/03-tunnel/index.html` | 03 페이지 | 브라우저 |
| `index.html` (수정) | 03 완성·링크 | 브라우저 |

---

### Task 1: 튜브 계산 (TDD)

**Interfaces (Produces):**
- `wrapCentered(value, period): number` — [-period/2, period/2)
- `tubeSlot(row, col, { rows, cols, radius, rowGap, angle = 0, scroll = 0 }): { x, y, z, rotY, facing }` — 홀수 줄은 반 칸(π/cols) 엇갈림
- `edgeFade(y, loopHeight, band): number` — 루프 경계 band 안에서 1→0
- `stepTubeMotion(state, { baseSpeed, follow, spinDecay, speedTarget, speedLerp }, dt): state` — state = `{ scrollCurrent, scrollTarget, spinVelocity, angle, speedScale }`, 60fps 기준 비율을 프레임레이트와 무관하게 적용

- [ ] **Step 1: 실패 테스트**

```js
// FILE: tests/tunnel-layout.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wrapCentered, tubeSlot, edgeFade, stepTubeMotion } from '../demos/03-tunnel/layout.js';

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
```

- [ ] **Step 2: 실패 확인** — `npm test` → 모듈 없음
- [ ] **Step 3: 구현**

```js
// FILE: demos/03-tunnel/layout.js
// ─────────────────────────────────────────────────────────────
// layout.js — 03 터널(튜브): 원통 위 카드 위치 + 쫀득한 움직임 계산 (Three.js 없이 숫자만)
// 참고: Codrops "Reactive Depth" (Matis Dené) — 코드 복사 없이 기법·비율만
// ─────────────────────────────────────────────────────────────
import { smoothstep } from '../../shared/motion.js?v=2';

// 값을 [-주기/2, 주기/2) 안으로 접는다.
// 카드 높이를 이걸로 접으면, 위로 넘어간 줄이 아래에서 다시 나타나서 끝없는 튜브가 된다.
export function wrapCentered(value, period) {
  const half = period / 2;
  return ((((value + half) % period) + period) % period) - half;
}

// row줄 col칸 카드의 원통 위 위치.
//   각도 = 칸 비율 × 한 바퀴 + 튜브가 돈 각도(angle). 홀수 줄은 반 칸 엇갈려서 벽돌처럼 쌓인다
//   높이 = 줄 × 간격 − 스크롤, 그리고 (줄 수 × 간격) 범위로 접어서 무한 루프
//   카드는 원통 바깥(카메라 쪽)을 보도록 rotY = 각도
export function tubeSlot(row, col, { rows, cols, radius, rowGap, angle = 0, scroll = 0 }) {
  const stagger = row % 2 === 1 ? Math.PI / cols : 0;
  const a = (col / cols) * Math.PI * 2 + stagger + angle;
  return {
    x: radius * Math.sin(a),
    y: wrapCentered(row * rowGap - scroll, rows * rowGap),
    z: radius * Math.cos(a),
    rotY: a,
    facing: Math.cos(a),
  };
}

// 루프 경계(±루프 높이/2) 근처 band 구간에서 카드가 작아지며 사라지게 한다.
// 그래야 맨 위 줄이 맨 아래로 순간이동할 때 안 보인다
export function edgeFade(y, loopHeight, band) {
  const half = loopHeight / 2;
  return 1 - smoothstep(half - band, half, Math.abs(y));
}

// 매 프레임 움직임 계산 (Codrops식 감쇠를 프레임레이트와 무관하게):
//   스크롤 현재값이 목표를 follow(60fps 한 프레임당 12%)씩 따라간다 → 쫀득함
//   회전 속도는 spinDecay(한 프레임당 0.92배)로 줄어든다 → 휠을 세게 굴리면 휙 돌다 서서히 멈춤
//   속도 배율은 speedTarget(호버 시 슬로모션)으로 speedLerp씩 다가간다 → 시간이 서서히 느려짐
//   각도 += (기본 속도 + 회전 속도) × dt × 속도 배율
export function stepTubeMotion(state, { baseSpeed, follow, spinDecay, speedTarget, speedLerp }, dt) {
  const frames = dt * 60;
  state.scrollCurrent += (state.scrollTarget - state.scrollCurrent) * (1 - Math.pow(1 - follow, frames));
  state.spinVelocity *= Math.pow(spinDecay, frames);
  state.speedScale += (speedTarget - state.speedScale) * (1 - Math.pow(1 - speedLerp, frames));
  state.angle += (baseSpeed + state.spinVelocity) * dt * state.speedScale;
  return state;
}
```

- [ ] **Step 4: 통과 확인** — `npm test` → `# pass 40`

---

### Task 2: 공통 부품 보강

- [ ] **Step 1: `shared/stage.js`에 `readTokenRGBA` 추가** (`readToken` 함수 바로 아래)

```js
// rgba(…) 토큰을 3D에서 쓸 수 있게 색과 투명도로 나눠 읽는다. (예: --border → 흰색 + 0.12)
export function readTokenRGBA(name) {
  const value = readToken(name);
  const match = value.match(/rgba?\(([^)]+)\)/);
  if (!match) return { color: new THREE.Color(value), alpha: 1 };
  const [r, g, b, a = '1'] = match[1].split(',').map((part) => part.trim());
  return { color: new THREE.Color(`rgb(${r}, ${g}, ${b})`), alpha: parseFloat(a) };
}
```

- [ ] **Step 2: `shared/base.css`에 추가** (`.fallback` 규칙 위)

```css
/* 화면 고정형 데모(03 터널): 휠·터치를 3D 장면이 가져가서 스크롤 공간이 필요 없다 */
.stage-wrap.is-fixed { height: 100svh; }
.stage-wrap.is-fixed canvas { touch-action: none; cursor: default; }

/* 캡션 안 "기법 노트 ↓" 링크 (캡션은 클릭이 통과되니 이 링크만 다시 켠다) */
.stage-caption .notes-jump {
  display: inline-block;
  margin-top: 16px;
  padding: 8px 16px;
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--fg-2);
  font-size: var(--text-14);
  line-height: var(--lh-14);
  text-decoration: none;
  pointer-events: auto;
}
.stage-caption .notes-jump:hover { color: var(--fg-1); }
```

- [ ] **Step 3: 버전 올리기** — 모든 페이지 `base.css?v=3` → `?v=4`; 01·02 `stage.js?v=5` → `?v=6`; 01 `main.js?v=14` → `?v=15`, 02 `main.js?v=4` → `?v=5`
- [ ] **Step 4: 01·02 회귀** — 두 페이지 콘솔 에러 0

---

### Task 3: 휘어진 배경 격자 + 03 페이지

```js
// FILE: demos/03-tunnel/grid.js
// ─────────────────────────────────────────────────────────────
// grid.js — 03 터널 뒤에 깔리는 휘어진 격자판
// 평평한 판의 가장자리는 카메라 쪽으로, 가운데는 뒤로 밀어서 오목한 곡면을 만든다.
// 격자 선은 픽셀 셰이더에서 그리고, 튜브가 움직일 때 같이 흐르게 오프셋을 받는다.
// 참고: Codrops "Reactive Depth"의 격자 변형 아이디어 (코드 복사 X)
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

const vertexShader = /* glsl */ `
uniform float uEdgeWidth;   // 가장자리에서 얼마나 안쪽까지 휘게 할지 (판 크기 대비 비율)
uniform float uEdgeAmp;     // 가장자리를 카메라 쪽으로 미는 양
uniform float uCenterRadius;
uniform float uCenterAmp;   // 가운데를 뒤로 미는 양 (음수)
varying vec2 vUv;

void main() {
  vUv = uv;
  vec3 p = position;
  // 가장 가까운 가장자리까지 거리 → 가장자리일수록 1
  float edgeDistance = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
  float edgeMask = 1.0 - smoothstep(0.0, uEdgeWidth, edgeDistance);
  // 가운데까지 거리 → 가운데일수록 1
  float centerMask = 1.0 - smoothstep(0.0, uCenterRadius, distance(uv, vec2(0.5)));
  p.z += edgeMask * uEdgeAmp + centerMask * uCenterAmp;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
uniform vec2 uCells;   // 가로·세로 칸 수
uniform vec2 uOffset;  // 튜브 움직임을 따라 흐르는 양
varying vec2 vUv;

void main() {
  vec2 g = (vUv + uOffset) * uCells;
  // 칸 경계까지의 거리를 픽셀 폭(fwidth)으로 나눠서, 화면에서 항상 1px 두께의 선이 나오게
  vec2 d = abs(fract(g - 0.5) - 0.5) / fwidth(g);
  float line = 1.0 - min(min(d.x, d.y), 1.0);
  gl_FragColor = vec4(uColor, line * uAlpha);
}
`;

export function createCurvedGrid({ color, alpha, width = 44, height = 26, cells = [22, 13] }) {
  const geometry = new THREE.PlaneGeometry(width, height, 88, 52);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: color },
      uAlpha: { value: alpha },
      uCells: { value: new THREE.Vector2(cells[0], cells[1]) },
      uOffset: { value: new THREE.Vector2() },
      uEdgeWidth: { value: 0.22 },
      uEdgeAmp: { value: 5 },
      uCenterRadius: { value: 0.45 },
      uCenterAmp: { value: -2.5 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false, // 반투명 선이라 깊이를 기록하지 않는다 (카드를 가리지 않게)
  });
  const mesh = new THREE.Mesh(geometry, material);
  return {
    mesh,
    setOffset(x, y) { material.uniforms.uOffset.value.set(x, y); },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
```

```html
<!-- FILE: demos/03-tunnel/index.html -->
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>03 터널 · Card Archive</title>
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
      <canvas id="stage-canvas" aria-label="휘어진 흰 카드들이 세로 원통을 감싸고 위아래로 끝없이 흐르는 3D 장면"></canvas>
      <div class="stage-caption">
        <p class="caption-index">03</p>
        <h1>터널</h1>
        <p>휘어진 종이 카드가 원통을 감싸고 끝없이 흘러.</p>
        <p class="caption-hint">휠·트랙패드·터치로 흘리기 · 카드에 올리면 느려져 · 누르면 뒤집혀</p>
        <a class="notes-jump" href="#notes">기법 노트 ↓</a>
      </div>
    </div>
  </section>

  <main class="notes" id="notes">
    <section>
      <h2>이 데모에 쓴 기법</h2>
      <dl>
        <dt>원통 튜브</dt>
        <dd>카드 6줄 × 12칸을 원통 둘레에 놓고, 홀수 줄은 반 칸씩 엇갈려서 벽돌처럼 쌓았어. 카드는 원통 바깥을 보고, 뒤쪽은 어둡게 칠해.</dd>
        <dt>끝없는 루프</dt>
        <dd>카드마다 높이를 "줄 수 × 간격" 범위 안으로 접어서, 위로 넘어간 줄이 아래에서 다시 나타나. 경계 근처에선 카드가 작아지며 사라져서 순간이동이 안 보여.</dd>
        <dt>쫀득한 휠</dt>
        <dd>휠을 굴리면 목표 위치만 바뀌고, 실제 위치는 매 프레임 남은 거리의 12%씩 따라가. 세게 굴리면 회전에 속도가 붙었다가 매 프레임 8%씩 줄어들어. 화면이 120Hz여도 같은 느낌이 나게 프레임 시간으로 보정했어.</dd>
        <dt>슬로모션</dt>
        <dd>카드에 커서를 올리면 시간 배율이 15%까지 천천히 내려가서 튜브 전체가 느려져. 커서를 떼면 다시 천천히 빨라져.</dd>
        <dt>휘어진 격자</dt>
        <dd>뒤에 깔린 평평한 판의 가장자리는 앞으로, 가운데는 뒤로 밀어서 오목한 곡면을 만들고, 격자 선은 튜브 움직임을 따라 같이 흘러.</dd>
      </dl>
    </section>
    <section>
      <h2>참고한 곳</h2>
      <p><a href="https://tympanus.net/codrops/2026/02/17/reactive-depth-building-a-scroll-driven-3d-image-tube-with-react-three-fiber/" target="_blank" rel="noopener">Codrops · Reactive Depth</a> (Matis Dené): 스크롤로 움직이는 3D 이미지 튜브. 코드는 복사하지 않고 기법만 공부해서 다시 만들었어.</p>
      <p><a href="#stage-canvas">↑ 튜브로 돌아가기</a></p>
    </section>
  </main>

  <script type="module" src="./main.js?v=1"></script>
</body>
</html>
```

```js
// FILE: demos/03-tunnel/main.js
// ─────────────────────────────────────────────────────────────
// 03 터널 — 휘어진 종이 카드가 세로 원통(튜브)을 감싸고, 휠·터치로 위아래 끝없이 흐른다.
// 카드에 커서를 올리면 시간이 느려지고, 뒤에는 휘어진 격자가 같이 흐른다.
// 참고: Codrops "Reactive Depth" (Matis Dené) — 코드 복사 없이 기법·비율만
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { createStage, showWebGLFallback, readToken, readTokenRGBA } from '../../shared/stage.js?v=6';
import { createCardMaterial, syncMaterial, setCornerRadius } from '../../shared/card-material.js?v=3';
import { createCardInstances } from '../../shared/card-geometry.js?v=1';
import { lerp, clamp, easeOutCubic, easeInOutCubic, depthDim, prefersReducedMotion } from '../../shared/motion.js?v=2';
import { DEFAULT_PRESET, presetToParams } from '../../shared/texture-presets.js?v=1';
import { createPanel, addSettingsButtons } from '../../shared/panel.js?v=2';
import { addTextureFolder } from '../../shared/texture-panel.js?v=1';
import { tubeSlot, edgeFade, stepTubeMotion } from './layout.js?v=1';
import { createCurvedGrid } from './grid.js?v=1';

const CARD_W = 1.6;                  // 01·02와 같은 카드 (Grail 비율 1.42, R 20/345)
const CARD_H = CARD_W * (490 / 345);
const CORNER_RADIUS = CARD_W * (20 / 345);
const CAMERA_OFFSET = 8;             // 튜브 앞면 ~ 카메라 거리
const GRID_GAP = 6;                  // 튜브 뒷면 ~ 격자판 거리
const MIN_BRIGHTNESS = 0.15;         // 맨 뒤 카드 밝기
const SCROLL_PER_PX = 0.006;         // 휠 1px = 위아래 0.006만큼 (트랙패드 한 번 ≈ 카드 3줄)
const SPIN_PER_PX = 0.0015;          // 휠 1px = 회전 속도 +0.0015 rad/s
const MAX_SPIN = 2.5;                // 회전 속도 상한 (rad/s) — 01처럼 난리 나지 않게
const TOUCH_MULTIPLIER = 1.5;        // 터치는 손가락 이동이 짧아서 1.5배
const SPEED_LERP = 0.08;             // 슬로모션 배율이 바뀌는 빠르기 (60fps 한 프레임당 8%)
const INTRO_DURATION = 1.8;
const INTRO_RADIUS_SCALE = 2;        // 등장할 때 2배 넓게 퍼져 있다가 모인다
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
    bend: 0.08,          // 원통 곡면에 맞춘 휨: 카드 크기 0.7 ÷ (2 × 반지름 4.2)
    corner: CORNER_RADIUS,
    rows: 6,             // 줄 수 (Codrops 5줄 + 루프 경계 여유 1줄)
    cols: 12,            // 칸 수 (Codrops 12칸)
    radius: 4.2,         // 원통 반지름
    cardScale: 0.7,      // 카드 크기 배율 (가로 1.12)
    rowGapRatio: 1.18,   // 줄 간격 = 카드 높이 × 이 값
    baseSpeed: 0.12,     // 가만히 있어도 도는 속도 (rad/s)
    follow: 0.12,        // 스크롤 따라가기 (60fps 한 프레임당, Codrops 0.12)
    spinDecay: 0.92,     // 회전 속도 감쇠 (60fps 한 프레임당 곱하는 값, Codrops 0.92)
    slowmo: 0.85,        // 슬로모션 세기: 0.85면 속도가 15%까지 느려짐
    grid: true,          // 휘어진 배경 격자
  };
  const params = structuredClone(DEFAULTS);
  const count = () => params.rows * params.cols;

  // ── 장면 ────────────────────────────────────────────────────
  const material = createCardMaterial({ cardWidth: CARD_W, cardHeight: CARD_H, cornerRadius: CORNER_RADIUS });
  syncMaterial(material, params);
  let cards = createCardInstances({ count: count(), width: CARD_W, height: CARD_H, bend: params.bend, material });
  stage.scene.add(cards.mesh);
  const flips = new Map(); // 카드 번호 → 뒤집기 시작 시각(초)

  const border = readTokenRGBA('--border');
  const grid = createCurvedGrid({ color: border.color, alpha: border.alpha });
  stage.scene.add(grid.mesh);

  function rebuildCards() {
    stage.scene.remove(cards.mesh);
    cards.dispose();
    cards = createCardInstances({ count: count(), width: CARD_W, height: CARD_H, bend: params.bend, material });
    stage.scene.add(cards.mesh);
    flips.clear();
  }

  function applyAll() {
    syncMaterial(material, params);
    setCornerRadius(material, params.corner);
    if (count() !== cards.count) rebuildCards();
    cards.setBend(params.bend);
    grid.mesh.visible = params.grid;
  }

  // ── 패널 ────────────────────────────────────────────────────
  const gui = createPanel('03 터널 · 조절 패널');
  const texture = addTextureFolder(gui, { params, material, paperColor: paper });
  texture.add(params, 'bend', 0, 0.5, 0.01).name('휨').onChange((value) => cards.setBend(value));

  const tubeFolder = gui.addFolder('튜브');
  tubeFolder.add(params, 'rows', 3, 12, 1).name('줄 수').onFinishChange(rebuildCards);
  tubeFolder.add(params, 'cols', 6, 24, 1).name('칸 수').onFinishChange(rebuildCards);
  tubeFolder.add(params, 'radius', 2, 8, 0.05).name('반지름');
  tubeFolder.add(params, 'cardScale', 0.3, 1.2, 0.01).name('카드 크기');
  tubeFolder.add(params, 'rowGapRatio', 1, 1.8, 0.01).name('줄 간격');

  const motionFolder = gui.addFolder('움직임');
  motionFolder.add(params, 'baseSpeed', 0, 1, 0.01).name('기본 속도');
  motionFolder.add(params, 'follow', 0.02, 0.4, 0.01).name('따라가기 (쫀득함)');
  motionFolder.add(params, 'spinDecay', 0.8, 0.99, 0.001).name('회전 감쇠');
  motionFolder.add(params, 'slowmo', 0, 0.95, 0.01).name('슬로모션 세기');
  motionFolder.add(params, 'grid').name('배경 격자').onChange((value) => { grid.mesh.visible = value; });

  addSettingsButtons(gui, { params, defaults: DEFAULTS, onApply: applyAll });

  // ── 입력: 휠·터치 → 스크롤 목표 + 회전 속도 ─────────────────
  const reduced = prefersReducedMotion();
  const motion = { scrollCurrent: 0, scrollTarget: 0, spinVelocity: 0, angle: 0, speedScale: 1 };

  function push(deltaPx) {
    motion.scrollTarget += deltaPx * SCROLL_PER_PX;
    motion.spinVelocity = clamp(motion.spinVelocity + deltaPx * SPIN_PER_PX, -MAX_SPIN, MAX_SPIN);
  }

  // 튜브가 화면에 꽉 차 있을 때만 휠을 가져간다. 노트를 보는 중이면 페이지 스크롤에 맡긴다
  const stageInView = () => window.scrollY < 4;

  canvas.addEventListener('wheel', (event) => {
    if (!stageInView()) return;
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : 1; // 줄 단위 휠은 px로 환산
    push(event.deltaY * unit);
  }, { passive: false });

  let touchY = null;
  canvas.addEventListener('touchstart', (event) => { touchY = event.touches[0].clientY; }, { passive: true });
  canvas.addEventListener('touchmove', (event) => {
    if (touchY === null) return;
    event.preventDefault();
    const y = event.touches[0].clientY;
    push((touchY - y) * TOUCH_MULTIPLIER);
    touchY = y;
  }, { passive: false });
  canvas.addEventListener('touchend', () => { touchY = null; });

  // ── 호버(슬로모션)·클릭(뒤집기) ─────────────────────────────
  const pointer = { x: 0, y: 0, inside: false };
  const press = { active: false, startX: 0, startY: 0 };
  const raycaster = new THREE.Raycaster();

  function toNdc(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
      y: -(((event.clientY - rect.top) / rect.height) * 2 - 1),
    };
  }
  function pick(ndcX, ndcY) {
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), stage.camera);
    const hit = raycaster.intersectObject(cards.mesh, false)[0];
    return hit && hit.instanceId !== undefined ? hit.instanceId : -1;
  }

  canvas.addEventListener('pointermove', (event) => {
    const ndc = toNdc(event);
    pointer.x = ndc.x;
    pointer.y = ndc.y;
    pointer.inside = event.pointerType !== 'touch';
  });
  canvas.addEventListener('pointerleave', () => { pointer.inside = false; });
  canvas.addEventListener('pointerdown', (event) => {
    press.active = true;
    press.startX = event.clientX;
    press.startY = event.clientY;
  });
  canvas.addEventListener('pointerup', (event) => {
    const moved = Math.hypot(event.clientX - press.startX, event.clientY - press.startY);
    if (press.active && moved < CLICK_TOLERANCE_PX) {
      const ndc = toNdc(event);
      const id = pick(ndc.x, ndc.y);
      if (id >= 0 && !flips.has(id)) flips.set(id, performance.now() / 1000);
    }
    press.active = false;
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

    // 1) 호버 중이면 슬로모션 목표로
    const hovered = pointer.inside ? pick(pointer.x, pointer.y) : -1;
    stepTubeMotion(motion, {
      baseSpeed: reduced ? 0 : params.baseSpeed,
      follow: params.follow,
      spinDecay: params.spinDecay,
      speedTarget: hovered >= 0 ? 1 - params.slowmo : 1,
      speedLerp: SPEED_LERP,
    }, dt);

    // 2) 카메라·격자 위치 (폰처럼 세로로 긴 화면이면 조금 뒤로)
    const radius = lerp(params.radius * INTRO_RADIUS_SCALE, params.radius, intro);
    const narrowFit = Math.sqrt(Math.max(1, 1 / stage.camera.aspect));
    stage.camera.position.set(0, 0, (params.radius + CAMERA_OFFSET) * narrowFit);
    grid.mesh.position.z = -(params.radius + GRID_GAP);
    const rowGap = CARD_H * params.cardScale * params.rowGapRatio;
    const loopHeight = params.rows * rowGap;
    // 격자도 같은 움직임 신호로: 가로는 튜브 회전, 세로는 스크롤을 따라 흐른다
    grid.setOffset(motion.angle / (Math.PI * 2), motion.scrollCurrent / loopHeight);

    // 3) 카드마다 원통 위 위치·밝기·뒤집기
    const scale = params.cardScale * lerp(0.4, 1, intro);
    for (let row = 0; row < params.rows; row++) {
      for (let col = 0; col < params.cols; col++) {
        const i = row * params.cols + col;
        if (i >= cards.count) continue;
        const slot = tubeSlot(row, col, {
          rows: params.rows, cols: params.cols, radius, rowGap, angle: motion.angle, scroll: motion.scrollCurrent,
        });
        const fade = edgeFade(slot.y, loopHeight, rowGap);
        dummy.position.set(slot.x, slot.y, slot.z);
        dummy.rotation.set(0, slot.rotY, 0);
        dummy.scale.setScalar(scale * fade);
        dummy.updateMatrix();
        cards.mesh.setMatrixAt(i, dummy.matrix);
        cards.setDim(i, depthDim(slot.facing, MIN_BRIGHTNESS) * fade);

        let flipProgress = 0;
        const flipStart = flips.get(i);
        if (flipStart !== undefined) {
          const t = (now - flipStart) / FLIP_DURATION;
          if (t >= 1) flips.delete(i);
          else flipProgress = easeInOutCubic(t);
        }
        cards.setFlip(i, flipProgress);
      }
    }
    cards.commit();

    stage.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

main();
```

- [ ] **확인** — `/demos/03-tunnel/`: 콘솔 에러 0; 튜브가 6줄로 감싸고 천천히 돎; 휠 → 위아래로 흐르며 회전 붙었다 감속; 위아래로 계속 굴려도 끊김 없이 무한; 카드에 커서 → 서서히 느려짐; 클릭 → 뒤집기; 격자가 뒤에서 곡면으로 같이 흐름; "기법 노트 ↓" → 노트로 이동, 거기서 휠은 페이지 스크롤; 폰 375px에서 가로 넘침 없음.

### Task 4: 아카이브 목록 갱신

```html
      <li>
        <a class="demo-item" href="demos/03-tunnel/">
          <span class="demo-index">03</span>
          <span class="demo-name">터널</span>
          <span class="demo-status">완성</span>
          <span class="demo-desc">휘어진 카드가 원통을 감싸고, 휠을 굴리면 끝없이 흘러가.</span>
        </a>
      </li>
```
