# 10 휘어진 호 캐러셀 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mathias Adolfsson 포트폴리오의 "휘어진 호 캐러셀"을 Three.js로 다시 만든 아카이브 데모 10 (가로 16:9 바둑판 카드).

**Architecture:** 원본 숫자와 계산(호 위치·가장자리 크기/밝기/사라짐·카드 휨·속도 반응·마우스 기울기)은 `arc.js` 순수 함수. `main.js`가 카드 8장(가로 48 × 세로 27칸 판)을 매 프레임 CPU로 휘고, 공통 카드 재질 + `arc-material.js`(원본의 둥근 점빛·속도 색 번짐 덧붙이기)로 그린다. 바둑판 텍스처는 09와 같이 쓰도록 공통 `shared/checker-texture.js`로 뺀다.

**Tech Stack:** Three.js 0.187.0, 공통 stage · card-material(v8) · panel · motion, node --test.

spec: `docs/superpowers/specs/2026-11-22-card-archive-threejs-2-design.md` 5장

## Global Constraints

- 반말, 제목 흰색, 글자 크기 토큰만, 색은 tokens.css만(새 색 없음). 공통 파일 고치면 `?v=` 올림. `three@0.187.0`.
- 원본(mathiasadolfsson.dev) 코드는 복사하지 않는다. 숫자·식만.
- 커밋은 사용자 요청 때만. 시작 시점 테스트 144개.

---

### Task 1: 원본 숫자 → 호 계산 (`arc.js`)

**Produces:** `ARC`, `slideMetrics(vw, vh, widthRatio)`, `cameraDistance(vh, fov)`, `arcGeometry(count, spacing, arcDeg)`, `carouselTarget(index, pos, spacing, arc, open)`, `stretchScales(scale, velocity, open)`, `deformPoint(x, y, u, v, opts)`, `smoothVelocity(current, delta, dt)`, `chromaOffset(velocity)`, `tiltFromPointer(nx, ny, slideWidth, tilt)`, `expoOut(t)`, `follow(rate, dt)`

- [ ] **Step 1: 실패하는 테스트**

```js
// FILE: tests/arc.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ARC, slideMetrics, cameraDistance, arcGeometry, carouselTarget, stretchScales,
  deformPoint, smoothVelocity, chromaOffset, tiltFromPointer, expoOut, follow,
} from '../demos/10-arc/arc.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('원본 숫자 (mathiasadolfsson.dev 설정값 · 캐러셀 계산)', () => {
  assert.deepEqual(ARC, {
    fov: 45,
    slide: { wide: 0.58, small: 0.8, max: 1280, aspect: 0.5625, aspectTall: 1.1, gap: 50, gapSmall: 25, smallBelow: 768 },
    arcDeg: 180, oval: 1,
    edge: { minScale: 0.65, shrink: 0.35, follow: 0.15, dimBase: 0.55, curve: 0.4, fade: 0.15 },
    lerp: 0.085, velocityLimit: 70,
    stretch: { per: 0.0016, max: 0.045, squash: 0.6 },
    bulge: 0.06, press: 0.008, curveK: 6e-4,
    chroma: { per: 0.0022, max: 0.018 },
    wheel: 0.6, tilt: 50,
    light: { offset: 0.0808, distance: 0.5853, radius: 0.8621, intensity: 0.75 },
    hover: { pull: 25, follow: 0.17 },
    intro: { duration: 1.75, scaleFrom: 0.75 },
    count: 8, cornerRadius: 4.5,
  });
});

test('카드 크기: 화면 폭 58%(최대 1280) · 16:9 · 간격 50, 작은 화면은 80% · 25, 세로 폰은 세로 1.1배', () => {
  const wide = slideMetrics(1440, 900);
  close(wide.width, 835.2);
  close(wide.height, 835.2 * 0.5625);
  close(wide.spacing, 885.2);
  assert.equal(slideMetrics(3000, 1500).width, 1280);
  const phone = slideMetrics(375, 812);
  close(phone.width, 300);
  close(phone.height, 330);
  close(phone.spacing, 325);
});

test('카메라: 화각 45°, 거리 = 화면 높이 / (2·tan 22.5°) → 깊이 0에서 1단위 = 1px', () => {
  close(cameraDistance(900), 900 / (2 * Math.tan(Math.PI / 8)));
});

test('호: 180°, 둘레 = 장수 × 간격, 반지름 = 둘레 / π, 원 (앞뒤 납작함 1)', () => {
  const arc = arcGeometry(8, 885.2);
  close(arc.loop, 7081.6);
  close(arc.radiusX, 7081.6 / Math.PI);
  close(arc.radiusZ, arc.radiusX);
  close(arc.halfArc, Math.PI / 2);
});

test('호 위치: 가운데는 정면 그대로, 한 칸 옆은 원 위로 돌아 앉고 조금 작아진다', () => {
  const arc = arcGeometry(8, 885.2);
  const center = carouselTarget(0, 0, 885.2, arc, 1);
  assert.deepEqual([center.x, center.z, center.rotY, center.scale, center.alpha], [0, 0, 0, 1, 1]);
  const next = carouselTarget(1, 0, 885.2, arc, 1);
  const angle = 885.2 / arc.radiusX; // = π/8
  close(next.x, Math.sin(angle) * arc.radiusX);
  close(next.z, (Math.cos(angle) - 1) * arc.radiusX);
  close(next.rotY, angle);
  close(next.p, 0.25);
  close(next.scale, 1 - 0.25 * 0.35);
  close(next.curve, 0.1);
  assert.equal(next.alpha, 1);
});

test('가장자리: 0.65배까지 작아지고, 마지막 15% 구간에서 사라진다. 띠 위치는 감겨서 끝없이 돈다', () => {
  const arc = arcGeometry(8, 885.2);
  const edge = carouselTarget(4, 0, 885.2, arc, 1); // 반 바퀴 = 90°
  close(edge.p, 1);
  close(edge.scale, 0.65);
  assert.equal(edge.alpha, 0);
  const near = carouselTarget(0, arc.loop / 2 * 0.9, 885.2, arc, 1); // p = 0.9
  close(near.alpha, 1 - (0.9 - 0.85) / 0.15);
  close(carouselTarget(9, 0, 885.2, arc, 1).x, carouselTarget(1, 0, 885.2, arc, 1).x);
});

test('등장 전(호가 안 펴짐): 평평한 한 줄 그대로, 크기 1, 안 보임', () => {
  const arc = arcGeometry(8, 885.2);
  const flat = carouselTarget(1, 0, 885.2, arc, 0);
  assert.deepEqual([flat.x, flat.z, flat.rotY, flat.scale, flat.alpha], [885.2, 0, 0, 1, 0]);
});

test('속도: 가로로 늘고(최대 4.5%) 세로로 눌린다(0.6배만큼). 밝기 = 0.55 + 0.45 × 크기, 등장 중엔 0.75배부터', () => {
  const slow = stretchScales(1, 10, 1);
  close(slow.scaleX, 1.016);
  close(slow.scaleY, 1 - 0.016 * 0.6);
  close(slow.dim, 1);
  const fast = stretchScales(0.8, -200, 1);
  close(fast.scaleX, 0.8 * 1.045);
  close(fast.dim, 0.55 + 0.45 * 0.8);
  close(stretchScales(1, 0, 0).scaleX, 0.75);
});

test('카드 휨: 같은 반지름 원통에 감고, 추가 휨은 (x² + 0.3y²) × 휨 × 0.0006', () => {
  const R = 2000;
  const [x, , z] = deformPoint((Math.PI / 4) * R, 0, 0.5, 0.5, { radius: R, ovalRatio: 1, wrap: 1 });
  close(x, Math.sin(Math.PI / 4) * R);
  close(z, -(1 - Math.cos(Math.PI / 4)) * R);
  const bent = deformPoint(100, 50, 0.5, 0.5, { radius: R, ovalRatio: 1, wrap: 0, curve: 1 });
  close(bent[2], -(100 * 100 + 0.3 * 50 * 50) * 6e-4);
});

test('속도 불룩: 가운데 줄이 진행 방향으로 속도 × 0.06, 위·아래 끝은 0. 세로는 |속도| × 0.008 눌림', () => {
  const opts = { radius: 1e9, ovalRatio: 1, wrap: 0, velocity: 50 };
  close(deformPoint(0, 10, 0.5, 0.5, opts)[0], 50 * 0.06);
  close(deformPoint(0, 10, 0.5, 0.5, opts)[1], 10 * (1 - 50 * 0.008));
  close(deformPoint(0, 10, 0.5, 1, opts)[0], 0);
});

test('마우스 올린 카드: 커서 자리에서 25px 앞으로, 0.9 떨어지면 0', () => {
  const opts = { radius: 1e9, ovalRatio: 1, wrap: 0, pull: 25, pullX: 0.3, pullY: 0.6 };
  close(deformPoint(0, 0, 0.3, 0.6, opts)[2], 25);
  close(deformPoint(0, 0, 1, 1.6, opts)[2], 0);
});

test('속도는 매 프레임 0.085씩 따라가고 ±70을 안 넘는다. 색 번짐 = 속도 × 0.0022 (±0.018)', () => {
  close(smoothVelocity(0, 100, 1 / 60), 8.5);
  assert.equal(smoothVelocity(69, 1e6, 1 / 60), 70);
  close(chromaOffset(5), 0.011);
  assert.equal(chromaOffset(100), 0.018);
  assert.equal(chromaOffset(-100), -0.018);
});

test('마우스 기울기: 화면 끝에서 카메라 ±50px, 빛은 반대로 카드 폭 × 0.0808', () => {
  const t = tiltFromPointer(1, 1, 1000, 50); // 오른쪽 아래 끝
  assert.deepEqual([t.camX, t.camY], [50, -50]);
  close(t.lightX, -80.8);
  close(t.lightY, 80.8);
});

test('등장 이징(expo.out)·프레임 보정', () => {
  assert.equal(expoOut(0), 0);
  assert.equal(expoOut(1), 1);
  close(expoOut(0.5), 1 - 2 ** -5);
  close(follow(0.085, 1 / 60), 0.085);
  close(follow(0.1, 1 / 30), 0.19);
});
```

- [ ] **Step 2: 실패 확인** — `node --test tests/arc.test.js` → FAIL (module not found)

- [ ] **Step 3: 구현**

```js
// FILE: demos/10-arc/arc.js
// ─────────────────────────────────────────────────────────────
// arc.js — 10 휘어진 호 캐러셀: 원본 숫자와 계산 (순수 함수)
// 숫자 출처: Mathias Adolfsson 포트폴리오(Codrops 2026-11-05) — 실제 사이트에 내려오는 코드의 설정값과
// 캐러셀 계산(computeCarouselTransform · tick · 셰이더 positionNode)을 짝지어 읽음. 코드는 가져오지 않았다.
// 단위: px (카메라를 화면 높이에 맞춰 깊이 0에서 1단위 = 1px)
// ─────────────────────────────────────────────────────────────
import { clamp, lerp, smoothstep } from '../../shared/motion.js?v=3';

export const ARC = {
  fov: 45,
  // 카드: 화면 폭 × 0.58 (최대 1280), 16:9, 간격 50. 작은 화면(768 미만)은 0.8 · 25, 세로 폰은 세로 = 폭 × 1.1
  slide: { wide: 0.58, small: 0.8, max: 1280, aspect: 0.5625, aspectTall: 1.1, gap: 50, gapSmall: 25, smallBelow: 768 },
  arcDeg: 180,   // 전체 호 각도
  oval: 1,       // 앞뒤 납작함 (1 = 원)
  // 가장자리로 갈수록: 최소 0.65배 · 0.35만큼 작아짐 · 매 프레임 15%씩 따라감 · 밝기 0.55 + 0.45×크기 · 추가 휨 0.4 · 끝 15%에서 사라짐
  edge: { minScale: 0.65, shrink: 0.35, follow: 0.15, dimBase: 0.55, curve: 0.4, fade: 0.15 },
  lerp: 0.085,          // 위치·기울기·빛이 매 프레임 목표로 따라가는 비율 (원본 MOTION_LERP)
  velocityLimit: 70,    // 속도 상한 (px/프레임)
  stretch: { per: 0.0016, max: 0.045, squash: 0.6 }, // 가로 늘림 = min(|속도| × 0.0016, 0.045), 세로는 0.6배만큼 눌림
  bulge: 0.06,          // 가운데 줄이 진행 방향으로 속도 × 0.06 불룩
  press: 0.008,         // 세로 눌림 |속도| × 0.008 (가운데 줄일수록)
  curveK: 6e-4,         // 추가 휨: z −= (x² + 0.3y²) × 휨 × 0.0006
  chroma: { per: 0.0022, max: 0.018 }, // 빨강·파랑 어긋남 (uv)
  wheel: 0.6,           // 휠 한 칸 → 목표 −= delta × 0.6
  tilt: 50,             // 마우스 화면 끝에서 카메라 ±50px
  light: { offset: 0.0808, distance: 0.5853, radius: 0.8621, intensity: 0.75 }, // 점빛: 카드 폭 기준
  hover: { pull: 25, follow: 0.17 },  // 마우스 올린 카드가 25px 부풀어 나옴, 매 프레임 17%
  intro: { duration: 1.75, scaleFrom: 0.75 }, // 평평한 줄 → 호, 1.75초 expo.out
  count: 8,
  cornerRadius: 4.5,
};

export function slideMetrics(vw, vh, widthRatio = ARC.slide.wide) {
  const s = ARC.slide;
  const small = vw < s.smallBelow;
  const width = Math.min(s.max, vw * (small ? s.small : widthRatio));
  const height = width * (small && vh > vw ? s.aspectTall : s.aspect);
  return { width, height, spacing: width + (small ? s.gapSmall : s.gap) };
}

export function cameraDistance(vh, fov = ARC.fov) {
  return vh / (2 * Math.tan(((fov * Math.PI) / 180) / 2));
}

export function arcGeometry(count, spacing, arcDeg = ARC.arcDeg) {
  const total = (arcDeg * Math.PI) / 180;
  const loop = count * spacing;
  const radiusX = loop / total;
  return { loop, halfArc: total / 2, radiusX, radiusZ: radiusX * ARC.oval, ovalRatio: ARC.oval };
}

// 카드 index의 목표 자리 (원본 computeCarouselTransform). open = 호가 펴진 정도 (등장 0 → 1)
export function carouselTarget(index, pos, spacing, arc, open = 1) {
  let w = (index * spacing + pos) % arc.loop;
  w = ((w % arc.loop) + arc.loop) % arc.loop;
  if (w > arc.loop / 2) w -= arc.loop;
  const angle = w / arc.radiusX;
  const p = Math.min(1, Math.abs(angle) / arc.halfArc);
  const e = ARC.edge;
  const fade = clamp(1 - Math.max(0, (p - (1 - e.fade)) / e.fade), 0, 1);
  return {
    x: lerp(w, Math.sin(angle) * arc.radiusX, open) || 0,
    z: lerp(0, (Math.cos(angle) - 1) * arc.radiusZ, open) || 0,
    rotY: lerp(0, angle * arc.ovalRatio, open) || 0,
    p,
    scale: lerp(1, Math.max(e.minScale, 1 - p * e.shrink), open),
    curve: lerp(0, p * e.curve, open),
    alpha: lerp(1, fade, open) * open,
  };
}

// 속도로 늘고 눌린 크기 + 밝기 (원본: 크기는 따라간 값, 등장 중엔 0.75배부터)
export function stretchScales(scale, velocity, open = 1) {
  const s = ARC.stretch;
  const y = Math.min(Math.abs(velocity) * s.per, s.max);
  const intro = lerp(ARC.intro.scaleFrom, 1, open);
  return {
    scaleX: scale * (1 + y) * intro,
    scaleY: scale * (1 - y * s.squash) * intro,
    dim: ARC.edge.dimBase + (1 - ARC.edge.dimBase) * scale,
  };
}

// 카드 판의 한 점 (x, y: 평평한 카드 좌표 px, u·v: 0~1) → 휜 자리 (원본 셰이더 positionNode)
export function deformPoint(x, y, u, v, { radius, ovalRatio = 1, wrap = 1, curve = 0, velocity = 0, pull = 0, pullX = 0.5, pullY = 0.5 }) {
  const a = x / radius;
  let px = lerp(x, Math.sin(a) * radius, wrap);
  let py = y;
  let pz = -(1 - Math.cos(a)) * radius * ovalRatio * wrap;
  pz -= (px * px + py * py * 0.3) * curve * ARC.curveK;
  const t = (v - 0.5) * 2;
  const middle = 1 - t * t; // 가운데 줄 1, 위·아래 끝 0
  px += velocity * ARC.bulge * middle;
  py *= 1 - Math.abs(velocity) * ARC.press * middle;
  const near = 1 - smoothstep(0, 0.9, Math.hypot(u - pullX, v - pullY));
  pz += pull * near;
  return [px, py, pz];
}

// 원본은 매 프레임 속도 += (이번 이동 − 속도) × 0.085, ±70 제한. delta는 "60fps 한 프레임" 기준 이동량
export function smoothVelocity(current, delta, dt) {
  const next = current + (delta - current) * follow(ARC.lerp, dt);
  return clamp(next, -ARC.velocityLimit, ARC.velocityLimit);
}

export function chromaOffset(velocity) {
  return clamp(velocity * ARC.chroma.per, -ARC.chroma.max, ARC.chroma.max);
}

// nx·ny: 화면 기준 −1~1 (ny는 아래가 +). 카메라는 마우스 쪽, 빛은 반대로
export function tiltFromPointer(nx, ny, slideWidth, tilt = ARC.tilt) {
  const reach = slideWidth * ARC.light.offset;
  return { camX: nx * tilt, camY: -ny * tilt, lightX: -nx * reach, lightY: ny * reach };
}

export function expoOut(t) {
  return t >= 1 ? 1 : 1 - 2 ** (-10 * t);
}

// "매 프레임 rate만큼" 따라가기를 프레임 길이에 맞게 보정
export function follow(rate, dt) {
  return 1 - (1 - rate) ** (dt * 60);
}
```

- [ ] **Step 4: 통과 확인** — `node --test tests/arc.test.js && npm test`

---

### Task 2: 공통 바둑판 텍스처 + 점빛·색 번짐 재질 + 페이지

- [ ] **Step 1: 공통 바둑판**

```js
// FILE: shared/checker-texture.js
// ─────────────────────────────────────────────────────────────
// checker-texture.js — 바둑판 카드 앞면 텍스처 (09·10 공통). 색은 토큰 이름으로 받는다.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { readToken } from './stage.js?v=6';

export function createCheckerTexture({ columns, rows, cell = 128, colors = ['--card-paper', '--card-lavender'] }) {
  const paint = document.createElement('canvas');
  paint.width = columns * cell;
  paint.height = rows * cell;
  const g = paint.getContext('2d');
  const fills = colors.map((name) => readToken(name));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      g.fillStyle = fills[(r + c) % fills.length];
      g.fillRect(c * cell, r * cell, cell, cell);
    }
  }
  const texture = new THREE.CanvasTexture(paint);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
```

09 `main.js`의 `checkerTexture()`를 지우고 `createCheckerTexture({ columns: 6, rows: 8 })`로 바꾼다 (main.js `?v=` 올림).

- [ ] **Step 2: 점빛·색 번짐**

```js
// FILE: demos/10-arc/arc-material.js
// ─────────────────────────────────────────────────────────────
// arc-material.js — 10: 공통 카드 재질에 원본의 "둥근 점빛"과 "속도 색 번짐"을 덧붙인다 (공통 파일은 그대로)
//   점빛 : 카드 앞 점에서 반경 안쪽일수록 밝게 더한다 (원본: 1 − smoothstep(0, 반경, 거리) × 세기)
//   색 번짐: 빠르게 돌릴 때 빨강은 한쪽, 파랑은 반대쪽으로 uv를 살짝 밀어 읽는다
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

export function addArcLight(material) {
  const uniforms = {
    uLightPos: { value: new THREE.Vector3() },
    uLightRadius: { value: 1 },
    uLightIntensity: { value: 0.75 },
    uChroma: { value: 0 },
  };
  const baseCompile = material.onBeforeCompile;
  const baseKey = material.customProgramCacheKey();
  material.customProgramCacheKey = () => `${baseKey}-arc`;
  material.onBeforeCompile = (shader, renderer) => {
    baseCompile(shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
varying vec3 vArcWorld;`)
      .replace('#include <project_vertex>', `#include <project_vertex>
{
  vec4 arcWorld = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
  arcWorld = instanceMatrix * arcWorld;
  #endif
  vArcWorld = (modelMatrix * arcWorld).xyz;
}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform vec3 uLightPos;
uniform float uLightRadius;
uniform float uLightIntensity;
uniform float uChroma;
varying vec3 vArcWorld;`)
      .replace('#include <map_fragment>', `#ifdef USE_MAP
  vec4 sampledDiffuseColor = texture2D(map, vMapUv);
  if (abs(uChroma) > 0.0001) {
    sampledDiffuseColor.r = texture2D(map, vMapUv + vec2(uChroma, 0.0)).r;
    sampledDiffuseColor.b = texture2D(map, vMapUv - vec2(uChroma, 0.0)).b;
  }
  diffuseColor *= sampledDiffuseColor;
#endif`)
      // 공통 재질이 마지막에 밝기(가장자리 어둠·사라짐)를 곱하기 전에 더해서, 점빛도 같이 어두워지고 사라진다
      .replace('#include <dithering_fragment>', `{
  float arcGlow = 1.0 - smoothstep(0.0, uLightRadius, distance(vArcWorld, uLightPos));
  gl_FragColor.rgb += vec3(arcGlow * uLightIntensity);
}
#include <dithering_fragment>`);
  };
  return uniforms;
}
```

- [ ] **Step 3: main.js**

```js
// FILE: demos/10-arc/main.js
// ─────────────────────────────────────────────────────────────
// 10 휘어진 호 캐러셀 — 가로 카드가 반원 호를 따라 끝없이 돌고, 카드도 같은 원통에 감기듯 휜다.
// 빠르게 돌리면 늘고·불룩하고·색이 번지고, 마우스를 따라 카메라가 살짝 기운다.
// 참고: Mathias Adolfsson 포트폴리오 (Codrops 2026-11-05) — 실제 사이트 코드에서 숫자·식만, 코드는 가져오지 않았다.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { createStage, showWebGLFallback } from '../../shared/stage.js?v=6';
import { createCardMaterial } from '../../shared/card-material.js?v=8';
import { createCheckerTexture } from '../../shared/checker-texture.js?v=1';
import { clamp, prefersReducedMotion } from '../../shared/motion.js?v=3';
import { createPanel, addSettingsButtons } from '../../shared/panel.js?v=2';
import {
  ARC, slideMetrics, cameraDistance, arcGeometry, carouselTarget, stretchScales,
  deformPoint, smoothVelocity, chromaOffset, tiltFromPointer, expoOut, follow,
} from './arc.js?v=1';
import { addArcLight } from './arc-material.js?v=1';

const SEGMENTS = { x: 48, y: 27 };   // 카드 판을 잘게 나눠야 둥글게 휜다 (16:9라 칸이 정사각)
const CHECKER = { columns: 16, rows: 9 }; // 앞면 바둑판 16 × 9칸
const INTRO_DELAY = 0.2;             // 등장 시작까지 (초)

const canvas = document.getElementById('stage-canvas');
const reduced = prefersReducedMotion();

const DEFAULTS = {
  count: ARC.count,                  // 장수 (많을수록 원이 커진다)
  arcDeg: ARC.arcDeg,                // 호 각도
  widthRatio: ARC.slide.wide,        // 카드 폭 (화면 폭 대비)
  velocityGain: 1,                   // 속도 반응 세기 (늘림·불룩·색 번짐)
  tilt: ARC.tilt,                    // 마우스 기울기 (px)
  lightIntensity: ARC.light.intensity,
  chroma: true,                      // 속도 색 번짐
};
const params = structuredClone(DEFAULTS);

let stage;
try {
  stage = createStage({ canvas, fov: ARC.fov });
} catch (error) {
  showWebGLFallback(canvas);
  throw error;
}
const { scene, camera, renderer } = stage;
const map = createCheckerTexture(CHECKER);
map.anisotropy = renderer.capabilities.getMaxAnisotropy();

let slides = [];
let material = null;
let light = null;
let metrics = null;
let arc = null;

function slideGeometry() {
  const geometry = new THREE.PlaneGeometry(metrics.width, metrics.height, SEGMENTS.x, SEGMENTS.y);
  geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
  // 공통 카드 재질이 읽는 카드별 값 (한 장짜리라 1칸씩)
  geometry.setAttribute('instanceDim', new THREE.InstancedBufferAttribute(new Float32Array([1]), 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('instanceFlip', new THREE.InstancedBufferAttribute(new Float32Array([0]), 1));
  geometry.setAttribute('instanceSoft', new THREE.InstancedBufferAttribute(new Float32Array([0]), 1));
  geometry.setAttribute('instanceBend', new THREE.InstancedBufferAttribute(new Float32Array([0]), 1));
  return geometry;
}

function build() {
  for (const slide of slides) {
    scene.remove(slide.mesh);
    slide.mesh.geometry.dispose();
  }
  material?.dispose();
  metrics = slideMetrics(canvas.clientWidth, canvas.clientHeight, params.widthRatio);
  arc = arcGeometry(params.count, metrics.spacing, params.arcDeg);
  material = createCardMaterial({
    cardWidth: metrics.width,
    cardHeight: metrics.height,
    cornerRadius: ARC.cornerRadius,
    cardPosFromUv: true, // 휘어도 둥근 모서리가 카드 모서리에 붙어 있게
  });
  material.map = map;
  material.color.set(0xffffff); // 바둑판 색 그대로 (재질 값)
  material.roughness = 0.85;
  material.metalness = 0;
  material.clearcoat = 0;
  light = addArcLight(material);

  slides = Array.from({ length: params.count }, () => {
    const geometry = slideGeometry();
    const flat = Float32Array.from(geometry.attributes.position.array); // 평평한 카드 좌표
    const mesh = new THREE.InstancedMesh(geometry, material, 1);
    mesh.frustumCulled = false;
    scene.add(mesh);
    return { mesh, flat, scale: 1, curve: 0, pull: 0, pullX: 0.5, pullY: 0.5 };
  });
}

function layout() {
  camera.near = 1;
  camera.far = cameraDistance(canvas.clientHeight) * 6;
  camera.updateProjectionMatrix(); // near·far를 바꿨으니 꼭 반영
  build();
}
window.addEventListener('resize', layout);

// ── 입력: 휠 · 드래그 · 마우스 기울기 · 마우스 올린 카드 ──
const motion = { pos: 0, target: 0, prevPos: 0, velocity: 0 };
const tilt = { camX: 0, camY: 0, lightX: 0, lightY: 0 };
const tiltTarget = { camX: 0, camY: 0, lightX: 0, lightY: 0 };
const pointer = { inside: false, ndc: new THREE.Vector2() };
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const raycaster = new THREE.Raycaster();

canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
  motion.target -= delta * (event.deltaMode === 1 ? 16 : 1) * ARC.wheel;
}, { passive: false });

let dragging = null;
canvas.addEventListener('pointerdown', (event) => {
  dragging = { x: event.clientX };
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', (event) => {
  const rect = canvas.getBoundingClientRect();
  const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const ny = ((event.clientY - rect.top) / rect.height) * 2 - 1;
  pointer.ndc.set(nx, -ny);
  pointer.inside = event.pointerType !== 'touch';
  if (finePointer && !reduced) Object.assign(tiltTarget, tiltFromPointer(nx, ny, metrics.width, params.tilt));
  if (dragging) {
    motion.target += event.clientX - dragging.x;
    dragging.x = event.clientX;
  }
});
for (const type of ['pointerup', 'pointercancel']) canvas.addEventListener(type, () => { dragging = null; });
canvas.addEventListener('pointerleave', () => {
  pointer.inside = false;
  Object.assign(tiltTarget, { camX: 0, camY: 0, lightX: 0, lightY: 0 });
});

// ── 패널 ──
const gui = createPanel('10 휘어진 호 · 조절 패널');
const arcFolder = gui.addFolder('호');
arcFolder.add(params, 'count', 4, 14, 1).name('장수').onChange(build);
arcFolder.add(params, 'arcDeg', 90, 300, 5).name('호 각도 (°)').onChange(build);
arcFolder.add(params, 'widthRatio', 0.3, 0.8, 0.01).name('카드 폭 (화면 대비)').onChange(build);
const motionFolder = gui.addFolder('움직임');
motionFolder.add(params, 'velocityGain', 0, 3, 0.1).name('속도 반응 세기');
motionFolder.add(params, 'tilt', 0, 150, 5).name('마우스 기울기 (px)');
motionFolder.add(params, 'chroma').name('속도 색 번짐');
const lightFolder = gui.addFolder('빛');
lightFolder.add(params, 'lightIntensity', 0, 2, 0.05).name('점빛 세기');
addSettingsButtons(gui, { params, defaults: DEFAULTS, onApply: build });

layout();

// ── 매 프레임 ──
let last = performance.now();
const start = last;
function frame(now) {
  const dt = clamp((now - last) / 1000, 0, 0.1);
  last = now;
  if (dt <= 0) {
    requestAnimationFrame(frame);
    return;
  }
  const time = (now - start) / 1000;
  const k = follow(ARC.lerp, dt);

  motion.pos += (motion.target - motion.pos) * k;
  const moved = (motion.pos - motion.prevPos) / (dt * 60); // 60fps 한 프레임 기준 이동량
  motion.prevPos = motion.pos;
  motion.velocity = smoothVelocity(motion.velocity, moved, dt);
  const velocity = reduced ? 0 : motion.velocity * params.velocityGain;
  const open = reduced ? 1 : expoOut(clamp((time - INTRO_DELAY) / ARC.intro.duration, 0, 1));

  for (const key of Object.keys(tilt)) tilt[key] += (tiltTarget[key] - tilt[key]) * k;
  camera.position.set(tilt.camX, tilt.camY, cameraDistance(canvas.clientHeight));
  camera.lookAt(0, 0, 0);

  light.uLightPos.value.set(tilt.lightX, tilt.lightY, metrics.width * ARC.light.distance);
  light.uLightRadius.value = metrics.width * ARC.light.radius;
  light.uLightIntensity.value = params.lightIntensity;
  light.uChroma.value = params.chroma ? chromaOffset(velocity) : 0;

  // 마우스가 올라간 카드와 그 자리(uv)
  let hovered = -1;
  let hoverUv = null;
  if (finePointer && pointer.inside && !dragging && !reduced) {
    raycaster.setFromCamera(pointer.ndc, camera);
    const hit = raycaster.intersectObjects(slides.map((s) => s.mesh), false)[0];
    if (hit) {
      hovered = slides.findIndex((s) => s.mesh === hit.object);
      hoverUv = hit.uv;
    }
  }

  const kEdge = follow(ARC.edge.follow, dt);
  const kHover = follow(ARC.hover.follow, dt);
  slides.forEach((slide, i) => {
    const target = carouselTarget(i, motion.pos, metrics.spacing, arc, open);
    slide.scale += (target.scale - slide.scale) * kEdge;
    slide.curve += (target.curve - slide.curve) * kEdge;
    slide.pull += ((i === hovered ? ARC.hover.pull : 0) - slide.pull) * kHover;
    if (i === hovered && hoverUv) {
      slide.pullX += (hoverUv.x - slide.pullX) * kHover;
      slide.pullY += (hoverUv.y - slide.pullY) * kHover;
    }
    const { scaleX, scaleY, dim } = stretchScales(slide.scale, velocity, open);

    // 카드 판 휘기 (원통에 감기 + 추가 휨 + 속도 불룩 + 마우스 부풀림)
    const position = slide.mesh.geometry.attributes.position;
    const uv = slide.mesh.geometry.attributes.uv;
    const opts = {
      radius: arc.radiusX, ovalRatio: arc.ovalRatio, wrap: 1, curve: slide.curve,
      velocity, pull: slide.pull, pullX: slide.pullX, pullY: slide.pullY,
    };
    for (let v = 0; v < position.count; v++) {
      const [x, y, z] = deformPoint(slide.flat[v * 3], slide.flat[v * 3 + 1], uv.array[v * 2], uv.array[v * 2 + 1], opts);
      position.array[v * 3] = x;
      position.array[v * 3 + 1] = y;
      position.array[v * 3 + 2] = z;
    }
    position.needsUpdate = true;
    slide.mesh.geometry.computeVertexNormals();
    slide.mesh.geometry.computeBoundingSphere(); // 마우스 판정이 휜 모양을 쓰도록

    slide.mesh.position.set(target.x, 0, target.z);
    slide.mesh.rotation.y = target.rotY;
    slide.mesh.scale.set(scaleX, scaleY, 1);
    const dimAttr = slide.mesh.geometry.attributes.instanceDim;
    dimAttr.array[0] = dim * target.alpha; // 검은 배경이라 어둡게 = 사라지게
    dimAttr.needsUpdate = true;
    slide.mesh.visible = target.alpha > 0.01;
  });

  stage.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

- [ ] **Step 4: index.html** — 09와 같은 화면 고정형 틀, 캡션 "10 · 휘어진 호", 노트·참고.

```html
<!-- FILE: demos/10-arc/index.html -->
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>10 휘어진 호 · Card Archive</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
  <link rel="stylesheet" href="../../shared/tokens.css?v=2">
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
      <canvas id="stage-canvas" aria-label="가로로 긴 바둑판무늬 카드들이 반원 호를 따라 둥글게 휘어 서 있고, 휠을 굴리면 호를 따라 끝없이 도는 3D 장면"></canvas>
      <div class="stage-caption">
        <p class="caption-index">10</p>
        <h1>휘어진 호</h1>
        <p>가로 카드가 반원 호를 따라 둥글게 휘어 돌고, 빠르게 돌리면 늘어나며 불룩해져.</p>
        <p class="caption-hint">휠을 굴리거나 끌어봐 · 마우스를 움직이면 살짝 기울어</p>
        <a class="notes-jump" href="#notes">기법 노트 ↓</a>
      </div>
    </div>
  </section>

  <main class="notes" id="notes">
    <section>
      <h2>이 데모에 쓴 기법</h2>
      <dl>
        <dt>반원 호에 놓기</dt>
        <dd>카드 8장을 한 줄로 이어 놓고, 그 줄 전체를 180° 반원으로 구부렸어. 원 둘레가 줄 길이와 같아서 장수가 많을수록 원이 커져. 줄 위 위치를 각도로 바꿔서 원 위 자리(x = sin, 깊이 = cos − 1)에 놓고, 그 각도만큼 돌려 세워.</dd>
        <dt>카드도 같이 휘기</dt>
        <dd>평평한 판을 원 위에 세우면 그냥 카드처럼 보여서, 카드 판 자체도 같은 반지름의 원통에 감기듯 휘게 했어. 가장자리로 갈수록 조금 더 휘고(0.4), 0.65배까지 작아지고, 어두워지다가(0.55 + 0.45 × 크기) 끝 15%에서 사라져서 고리가 이어지는 게 안 보여.</dd>
        <dt>속도가 보이게</dt>
        <dd>휠·드래그는 목표만 바꾸고 카드는 매 프레임 8.5%씩 따라와. 빨리 돌리면 카드가 가로로 최대 4.5% 늘고 세로로 눌리고, 가운데 줄이 진행 방향으로 불룩해지고(위·아래 끝은 그대로), 빨강·파랑이 살짝 어긋나.</dd>
        <dt>마우스</dt>
        <dd>마우스를 따라 카메라가 최대 50px 기울고, 카드 앞의 둥근 점빛은 반대로 움직여서 살짝 입체적으로 보여. 마우스를 올린 카드는 커서 자리를 중심으로 25px 앞으로 부풀어 나와.</dd>
        <dt>등장</dt>
        <dd>처음엔 평평한 한 줄이었다가 1.75초 동안 호로 펴지면서 0.75배에서 제 크기로 커져.</dd>
      </dl>
    </section>
    <section>
      <h2>참고한 곳</h2>
      <p>숫자와 식만 공부했고, 코드는 가져오지 않았어.</p>
      <p><a href="https://tympanus.net/codrops/2026/11/05/mathias-adolfsson-portfolio/" target="_blank" rel="noopener">Mathias Adolfsson ’26</a> (Codrops): 호 캐러셀·휨·속도 반응 설명.</p>
      <p><a href="https://mathiasadolfsson.dev/" target="_blank" rel="noopener">mathiasadolfsson.dev</a>: 실제 사이트 (설정값을 여기서 확인).</p>
      <p><a href="#stage-canvas">↑ 호로 돌아가기</a></p>
    </section>
  </main>

  <script type="module" src="./main.js?v=1"></script>
</body>
</html>
```

- [ ] **Step 5: 아카이브 목록 · 브라우저 확인** — 09 다음에 10. 원본 사이트(크롬)와 같은 창 크기로 나란히 비교.
