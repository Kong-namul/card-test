# 07 마우스로 도는 카드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eduard Bodak 포트폴리오 가격 카드("Card rotating on mouse movement")를 CSS 3D + GSAP으로 다시 만든 아카이브 데모 07.

**Architecture:** 카드는 `shared/dom-card.css`의 앞뒤 두 면 카드. 원본 숫자와 "마우스 x → 각도" 계산은 `rotation.js` 순수 함수, `main.js`가 등장 트윈 → 매 프레임 따라가기 트윈(원본 `gsap.ticker` 방식) → 나가면 탄성 복귀를 조립한다. 바닥 반사는 같은 카드를 `scaleY(−1)` 상자에 넣고 같은 회전 값을 준다.

**Tech Stack:** HTML/CSS/vanilla JS(ES 모듈, importmap), GSAP 3.15.1, lil-gui(공통 패널, three@0.187.0 addons 경로), node --test.

spec: `docs/superpowers/specs/2026-11-22-card-archive-bodak-design.md` 6장

## Global Constraints

- 반말 문구, 제목 흰색 단색(보라 금지), 글자 크기는 토큰 스케일(72/48/32/24/22/18/14)만.
- 색은 `shared/tokens.css`만 (새 색 없음: 앞면 `--card-paper`, 뒷면 `--card-lavender`).
- 외부 스크립트 버전 고정: `gsap@3.15.1`, `three@0.187.0`.
- 원본 코드는 가져오지 않는다. 숫자·원리만.
- 커밋은 사용자가 요청할 때만.
- 테스트: `npm test`, 시작 시점 107개 통과.

## File Structure

| 파일 | 할 일 |
|---|---|
| `demos/07-mouse-card/rotation.js` (새) | 원본 숫자 상수 + `followRotation`, `restPose` |
| `tests/mouse-card-rotation.test.js` (새) | 원본 숫자·각도 계산 테스트 |
| `demos/07-mouse-card/style.css` (새) | 배치·반사 |
| `demos/07-mouse-card/main.js` (새) | 등장·따라가기·복귀·폰·패널 |
| `demos/07-mouse-card/index.html` (새) | 페이지 + 노트 |
| `index.html` (수정) | 아카이브 목록에 07 |

---

### Task 1: 원본 숫자 → 각도 (`rotation.js`)

**Files:**
- Create: `demos/07-mouse-card/rotation.js`
- Test: `tests/mouse-card-rotation.test.js`

**Interfaces:**
- Produces:
  - 상수 `INTRO = { from: {rotationZ, rotationY, y}, to: {rotationY, y}, duration, ease }`, `FOLLOW = { rotationFactor, baseTilt, duration, ease }`, `LEAVE = { duration, ease }`, `REFLECTION = { gap, visible }`, `TUNE_DEFAULTS = { rotationFactor, baseTilt, followDuration, leaveDuration, perspective, reflectionOpacity, reflectionBlur }`
  - `followRotation(pointerX, viewportWidth, tune = TUNE_DEFAULTS) → { rotationY, rotationZ }`
  - `restPose(tune = TUNE_DEFAULTS) → { rotationX: 0, rotationY: 0, rotationZ: tune.baseTilt }`

- [ ] **Step 1: 실패하는 테스트**

```js
// FILE: tests/mouse-card-rotation.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  INTRO, FOLLOW, LEAVE, REFLECTION, TUNE_DEFAULTS, followRotation, restPose,
} from '../demos/07-mouse-card/rotation.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('원본 숫자: 등장은 옆으로 선 채(−90°) 64px 위에서 정면으로, 1초 elastic.out(1,0.75)', () => {
  assert.deepEqual(INTRO, {
    from: { rotationZ: 0, rotationY: -90, y: -64 },
    to: { rotationY: 0, y: 0 },
    duration: 1,
    ease: 'elastic.out(1,0.75)',
  });
});

test('원본 숫자: 따라가기 회전 세기 200 · 기본 기울기 6° · 0.5초 power2.out, 복귀 1.5초 elastic.out(1,0.75)', () => {
  assert.deepEqual(FOLLOW, { rotationFactor: 200, baseTilt: 6, duration: 0.5, ease: 'power2.out' });
  assert.deepEqual(LEAVE, { duration: 1.5, ease: 'elastic.out(1,0.75)' });
});

test('마우스가 화면 가운데면 정면 + 기본 기울기 6°', () => {
  assert.deepEqual(followRotation(500, 1000), { rotationY: 0, rotationZ: 6 });
});

test('화면 끝이면 ±200° 돌고, 180°를 넘으면 기울기는 −6°에서 멈춘다', () => {
  assert.deepEqual(followRotation(1000, 1000), { rotationY: 200, rotationZ: -6 });
  assert.deepEqual(followRotation(0, 1000), { rotationY: -200, rotationZ: -6 });
});

test('사이 값: 화면 3/4 지점이면 100°, 기울기 6 − (100/180) × 12', () => {
  const pose = followRotation(750, 1000);
  close(pose.rotationY, 100);
  close(pose.rotationZ, 6 - (100 / 180) * 12);
});

test('패널 값 반영: 회전 세기 90이면 끝에서 90°·기울기 0, 기본 기울기 10이면 가운데서 10°', () => {
  assert.deepEqual(followRotation(1000, 1000, { ...TUNE_DEFAULTS, rotationFactor: 90 }), { rotationY: 90, rotationZ: 0 });
  assert.deepEqual(followRotation(500, 1000, { ...TUNE_DEFAULTS, baseTilt: 10 }), { rotationY: 0, rotationZ: 10 });
});

test('복귀 자세: X·Y 0, Z는 기본 기울기', () => {
  assert.deepEqual(restPose(), { rotationX: 0, rotationY: 0, rotationZ: 6 });
  assert.equal(restPose({ ...TUNE_DEFAULTS, baseTilt: 10 }).rotationZ, 10);
});

test('반사(영상에서 잼: 틈 3% · 15%만 보임)와 패널 기본값', () => {
  assert.deepEqual(REFLECTION, { gap: 0.03, visible: 0.15 });
  assert.deepEqual(TUNE_DEFAULTS, {
    rotationFactor: 200, baseTilt: 6, followDuration: 0.5, leaveDuration: 1.5,
    perspective: 800, reflectionOpacity: 0.35, reflectionBlur: 6,
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/mouse-card-rotation.test.js`
Expected: FAIL — `Cannot find module .../demos/07-mouse-card/rotation.js`

- [ ] **Step 3: 구현**

```js
// FILE: demos/07-mouse-card/rotation.js
// ─────────────────────────────────────────────────────────────
// rotation.js — 07 마우스로 도는 카드: 원본 숫자와 "마우스 x → 각도" 계산 (순수 함수)
// 숫자 출처: Codrops "Built to Move" (Eduard Bodak, 2025-07-29) "Card rotating on mouse movement" 본문 코드.
// ─────────────────────────────────────────────────────────────

// 등장: 옆으로 선 채(−90°) 위에서 내려와 돌면서 정면을 보고, 기본 기울기로 탄력 있게 멈춘다
export const INTRO = {
  from: { rotationZ: 0, rotationY: -90, y: -64 }, // 원본 y −4em (16px 기준)
  to: { rotationY: 0, y: 0 },                      // rotationZ는 기본 기울기(패널 값)로 간다
  duration: 1,
  ease: 'elastic.out(1,0.75)',
};

// 따라가기: 매 프레임 마우스 x로 목표 각도를 정하고 0.5초 동안 따라붙는다
export const FOLLOW = { rotationFactor: 200, baseTilt: 6, duration: 0.5, ease: 'power2.out' };

// 무대를 나가면 정면 + 기본 기울기로 탄력 있게 복귀
export const LEAVE = { duration: 1.5, ease: 'elastic.out(1,0.75)' };

// 바닥 반사 (원본 글에 숫자 없음 → 영상 07번에서 잼): 카드 높이 3% 틈, 15%만 보이고 사라진다
export const REFLECTION = { gap: 0.03, visible: 0.15 };

// 조절 패널 기본값
export const TUNE_DEFAULTS = {
  rotationFactor: FOLLOW.rotationFactor,
  baseTilt: FOLLOW.baseTilt,
  followDuration: FOLLOW.duration,
  leaveDuration: LEAVE.duration,
  perspective: 800,        // 원본 글에 숫자 없음 — 영상 등장 장면과 비교해 정함
  reflectionOpacity: 0.35, // 원본 글에 숫자 없음 — 영상과 비교해 정함
  reflectionBlur: 6,       // px, 원본 글에 숫자 없음
};

// −0을 0으로
const tidy = (value) => value || 0;

// 원본 mouseMovement 계산: 화면 가운데 기준 −1~1로 바꿔 회전 세기를 곱하고,
// 많이 돌수록(180°까지) 기울기가 +기본 → −기본으로 넘어간다
export function followRotation(pointerX, viewportWidth, tune = TUNE_DEFAULTS) {
  const centerX = viewportWidth / 2;
  const normalizedX = (pointerX - centerX) / centerX;
  const rotationY = normalizedX * tune.rotationFactor;
  const rotationProgress = Math.min(Math.abs(rotationY) / 180, 1);
  const rotationZ = tune.baseTilt - rotationProgress * tune.baseTilt * 2;
  return { rotationY: tidy(rotationY), rotationZ: tidy(rotationZ) };
}

// 원본 onMouseLeave 자세
export function restPose(tune = TUNE_DEFAULTS) {
  return { rotationX: 0, rotationY: 0, rotationZ: tune.baseTilt };
}
```

- [ ] **Step 4: 통과 확인**

Run: `node --test tests/mouse-card-rotation.test.js && npm test`
Expected: 8개 통과, 전체 115개 통과

---

### Task 2: 07 페이지 (CSS · main.js · HTML) + 아카이브 연결

**Files:**
- Create: `demos/07-mouse-card/style.css`, `demos/07-mouse-card/main.js`, `demos/07-mouse-card/index.html`
- Modify: `index.html` (06 항목 다음)

**Interfaces:**
- Consumes: Task 1 모든 export, `prefersReducedMotion` from `shared/motion.js?v=3`, `createPanel` · `addSettingsButtons` from `shared/panel.js?v=2`, `.dom-card` from `shared/dom-card.css?v=1`

- [ ] **Step 1: CSS**

```css
<!-- FILE: demos/07-mouse-card/style.css -->
/* ─────────────────────────────────────────────────────────────
 * 07 마우스로 도는 카드 — 배치·반사만. 색·글자 크기는 tokens.css 값만 쓴다.
 * 카드 모양은 shared/dom-card.css.
 * ───────────────────────────────────────────────────────────── */

/* 무대: 가운데에 큰 제목과 카드. 카드 폭은 원본 영상에서 잰 화면 폭 9% (폰에서 110px 아래로는 안 작아짐) */
.price-stage {
  position: relative;
  min-height: 100svh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 96px 16px 160px;
  overflow: clip;
  touch-action: pan-y; /* 폰: 세로로 밀면 페이지 스크롤, 가로로 끌면 카드가 돈다 */
  --card-w: clamp(110px, 9vw, 180px);
}

.price-title {
  font-size: var(--text-72);
  line-height: var(--lh-72);
  text-align: center;
}

/* 카드가 제목 아랫줄을 절반쯤 가리며 앞에 선다 (원본 가격 페이지 구도) */
.price-card-area {
  position: relative;
  width: var(--card-w);
  margin-top: calc(var(--lh-72) / -2);
}
.price-slot { perspective: var(--persp, 800px); }
.price-card { --card-back: var(--card-lavender); }

/* 바닥 반사: 같은 카드를 위아래로 뒤집어 바로 아래에 두고, 흐리게 + 카드 높이 15%만 보이다 사라지게.
   (원본은 그라데이션·backdrop-filter를 덮었는데, 같은 모습을 흐림 + 마스크로 낸다) */
.price-reflection {
  position: absolute;
  left: 0;
  top: calc(100% + var(--card-w) * 490 / 345 * var(--reflection-gap, 0.03));
  width: 100%;
  pointer-events: none;
  filter: blur(var(--reflection-blur, 6px));
  -webkit-mask-image: linear-gradient(to bottom, rgba(0, 0, 0, var(--reflection-opacity, 0.35)) 0, transparent calc(var(--card-w) * 490 / 345 * var(--reflection-visible, 0.15)));
  mask-image: linear-gradient(to bottom, rgba(0, 0, 0, var(--reflection-opacity, 0.35)) 0, transparent calc(var(--card-w) * 490 / 345 * var(--reflection-visible, 0.15)));
}
/* 뒤집힌 상자 안이라, 같은 회전 값을 줘도 기울기는 반대로 보인다 (원본 rotationZMirror와 같은 결과) */
.price-reflection__flip { transform: scaleY(-1); }

@media (max-width: 767px) {
  .price-title { font-size: var(--text-48); line-height: var(--lh-48); }
  .price-card-area { margin-top: calc(var(--lh-48) / -2); }
}
```

- [ ] **Step 2: main.js**

```js
// FILE: demos/07-mouse-card/main.js
// ─────────────────────────────────────────────────────────────
// 07 마우스로 도는 카드 — Eduard Bodak 포트폴리오 가격 카드("Card rotating on mouse movement")를 다시 만든 데모
// 등장(탄성) → 끝나면 매 프레임 마우스 x를 따라 돈다 → 무대를 나가면 탄성 복귀.
// ─────────────────────────────────────────────────────────────
import { gsap } from 'gsap';
import { prefersReducedMotion } from '../../shared/motion.js?v=3';
import { createPanel, addSettingsButtons } from '../../shared/panel.js?v=2';
import { INTRO, FOLLOW, LEAVE, REFLECTION, TUNE_DEFAULTS, followRotation, restPose } from './rotation.js?v=1';

const reduced = prefersReducedMotion();
const stage = document.querySelector('.price-stage');
// 진짜 카드 + 반사 복제본. 둘에 같은 값을 준다 (반사는 뒤집힌 상자 안이라 저절로 거울처럼 보임)
const cards = [...stage.querySelectorAll('.price-card')];

const params = structuredClone(TUNE_DEFAULTS);

let ready = false;    // 등장이 끝나야 따라가기 시작 (원본 onComplete → initAnimation)
let hovering = false; // 원본 isHovering
let pointerX = window.innerWidth / 2;

function applyLook() {
  const root = document.documentElement.style;
  root.setProperty('--persp', `${params.perspective}px`);
  root.setProperty('--reflection-opacity', params.reflectionOpacity);
  root.setProperty('--reflection-blur', `${params.reflectionBlur}px`);
  root.setProperty('--reflection-gap', REFLECTION.gap);
  root.setProperty('--reflection-visible', REFLECTION.visible);
}

function playIntro() {
  ready = false;
  gsap.killTweensOf(cards);
  gsap.fromTo(cards, { ...INTRO.from }, {
    ...INTRO.to,
    rotationZ: params.baseTilt,
    duration: INTRO.duration,
    ease: INTRO.ease,
    onComplete: () => { ready = true; },
  });
}

// 원본 mouseMovement: 매 프레임 목표 각도로 0.5초 따라붙는 트윈을 새로 건다
function follow() {
  if (!ready || !hovering) return;
  const { rotationY, rotationZ } = followRotation(pointerX, window.innerWidth, params);
  gsap.to(cards, { rotationY, rotationZ, duration: params.followDuration, ease: FOLLOW.ease });
}

function onEnter() {
  hovering = true;
}

function onLeave() {
  hovering = false;
  if (!ready) return;
  gsap.to(cards, { ...restPose(params), duration: params.leaveDuration, ease: LEAVE.ease });
}

// 조절 패널
const gui = createPanel('07 마우스로 도는 카드 · 조절 패널');
const motionFolder = gui.addFolder('움직임');
motionFolder.add(params, 'rotationFactor', 0, 360, 5).name('회전 세기 (화면 끝 °)');
motionFolder.add(params, 'baseTilt', 0, 20, 0.5).name('기본 기울기 (°)').onChange(() => {
  if (!hovering) gsap.to(cards, { ...restPose(params), duration: 0.3 });
});
motionFolder.add(params, 'followDuration', 0.05, 2, 0.05).name('따라가는 시간 (초)');
motionFolder.add(params, 'leaveDuration', 0.2, 3, 0.1).name('복귀 시간 (초)');
const lookFolder = gui.addFolder('모양');
lookFolder.add(params, 'perspective', 300, 3000, 50).name('원근 (px)').onChange(applyLook);
lookFolder.add(params, 'reflectionOpacity', 0, 1, 0.05).name('반사 세기').onChange(applyLook);
lookFolder.add(params, 'reflectionBlur', 0, 20, 1).name('반사 흐림 (px)').onChange(applyLook);
gui.add({ replay: playIntro }, 'replay').name('등장 다시 보기');
addSettingsButtons(gui, {
  params,
  defaults: TUNE_DEFAULTS,
  onApply: () => {
    applyLook();
    if (!hovering) gsap.set(cards, restPose(params));
  },
});

applyLook();

if (reduced) {
  // 동작 줄이기: 등장·따라가기 없이 기운 카드 그대로 (원본도 이때는 마우스 동작을 안 켬)
  gsap.set(cards, restPose(params));
} else {
  playIntro();
  gsap.ticker.add(follow);

  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    // 마우스: 무대에 들어오면 따라가고, 나가면 복귀.
    // "← 아카이브" 링크와 조절 패널은 무대 밖 요소라, 그 위에 올라가면 무대 mouseleave가 나서 복귀한다 (원본: 메뉴 호버)
    stage.addEventListener('mouseenter', onEnter);
    stage.addEventListener('mouseleave', onLeave);
    stage.addEventListener('mousemove', (event) => {
      pointerX = event.clientX;
      hovering = true; // 처음부터 무대 위에 마우스가 있던 경우도 움직이면 바로 따라가게
    });
  } else {
    // 폰: 손가락을 좌우로 끌면 마우스처럼, 떼면 복귀 (원본 글엔 폰 동작 숫자가 없다)
    stage.addEventListener('pointerdown', (event) => {
      pointerX = event.clientX;
      hovering = true;
    });
    stage.addEventListener('pointermove', (event) => {
      if (hovering) pointerX = event.clientX;
    });
    for (const type of ['pointerup', 'pointercancel', 'pointerleave']) stage.addEventListener(type, onLeave);
  }
}
```

- [ ] **Step 3: index.html**

```html
<!-- FILE: demos/07-mouse-card/index.html -->
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>07 마우스로 도는 카드 · Card Archive</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
  <link rel="stylesheet" href="../../shared/tokens.css?v=2">
  <link rel="stylesheet" href="../../shared/base.css?v=4">
  <link rel="stylesheet" href="../../shared/dom-card.css?v=1">
  <link rel="stylesheet" href="./style.css?v=1">
  <script type="importmap">
  {
    "imports": {
      "gsap": "https://cdn.jsdelivr.net/npm/gsap@3.15.1/index.js",
      "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.187.0/examples/jsm/"
    }
  }
  </script>
</head>
<body>
  <a class="back-link" href="../../">← 아카이브</a>

  <section class="price-stage" aria-label="큰 제목 앞에 종이 카드 한 장이 기운 채 서 있고, 마우스를 좌우로 움직이면 크게 돌아 라벤더 뒷면이 보이는 장면">
    <h1 class="price-title">마우스로<br>도는 카드</h1>
    <div class="price-card-area">
      <div class="price-slot"><div class="dom-card price-card">
        <div class="dom-card__face dom-card__face--front"></div>
        <div class="dom-card__face dom-card__face--back"></div>
      </div></div>
      <div class="price-reflection" aria-hidden="true"><div class="price-reflection__flip"><div class="price-slot"><div class="dom-card price-card">
        <div class="dom-card__face dom-card__face--front"></div>
        <div class="dom-card__face dom-card__face--back"></div>
      </div></div></div></div>
    </div>
    <div class="stage-caption">
      <p class="caption-index">07</p>
      <p>카드가 툭 튕겨 들어오고, 마우스를 좌우로 움직이면 크게 돌아서 뒷면이 보여.</p>
      <p class="caption-hint">마우스를 좌우로 · 폰은 좌우로 끌기</p>
    </div>
  </section>

  <main class="notes" id="notes">
    <section>
      <h2>이 데모에 쓴 기법</h2>
      <dl>
        <dt>툭 튕겨 들어오는 등장</dt>
        <dd>페이지가 열리면 카드가 옆으로 선 채(−90°) 64px 위에서 내려오면서 돌아 정면을 보고, 6° 기운 채로 1초 동안 탄력 있게 멈춰. 탄성은 GSAP elastic(1, 0.75)이야.</dd>
        <dt>마우스를 따라 돌기</dt>
        <dd>등장이 끝나면 매 프레임 마우스가 화면 가운데에서 얼마나 떨어졌는지(−1~1)에 200°를 곱해서 그만큼 돌려. 화면 끝까지 가면 200°라 뒷면(라벤더)이 보여. 많이 돌수록 기울기가 6°에서 −6°로 넘어가서 손으로 돌리는 느낌이 나. 목표 각도로 0.5초 동안 부드럽게 따라붙어.</dd>
        <dt>나가면 제자리</dt>
        <dd>마우스가 무대를 나가거나 "← 아카이브" 링크·조절 패널 위로 올라가면, 1.5초 동안 탄력 있게 정면 6°로 돌아와.</dd>
        <dt>바닥 반사</dt>
        <dd>같은 카드를 위아래로 뒤집어 바로 아래에 두고 같은 각도로 돌려. 뒤집힌 상자 안이라 기울기는 저절로 반대로 보여서 거울처럼 비쳐. 흐리게 하고 카드 높이 15%만 보이다 사라지게 했어 (원본 영상에서 잰 길이).</dd>
        <dt>폰</dt>
        <dd>폰엔 마우스가 없어서, 손가락을 좌우로 끌면 마우스처럼 돌고 떼면 제자리로 돌아와.</dd>
      </dl>
    </section>
    <section>
      <h2>참고한 곳</h2>
      <p>숫자와 원리만 공부했고, 코드는 가져오지 않았어.</p>
      <p><a href="https://tympanus.net/codrops/2025/07/29/built-to-move-a-closer-look-at-the-animations-behind-eduard-bodaks-portfolio/" target="_blank" rel="noopener">Built to Move</a> (Codrops, Eduard Bodak): 등장·따라가기·복귀 숫자, 반사 아이디어.</p>
      <p><a href="https://www.osmo.supply/" target="_blank" rel="noopener">Osmo</a>: 원본 작가가 마우스 따라가기의 출발점으로 쓴 무료 리소스.</p>
      <p><a href="https://gsap.com/" target="_blank" rel="noopener">GSAP</a>: 트윈·탄성 이징.</p>
      <p><a href="#">↑ 처음으로</a></p>
    </section>
  </main>

  <script type="module" src="./main.js?v=1"></script>
</body>
</html>
```

- [ ] **Step 4: 아카이브 목록**

`index.html`의 06 항목 `</li>` 다음에:

```html
      <li>
        <a class="demo-item" href="demos/07-mouse-card/">
          <span class="demo-index">07</span>
          <span class="demo-name">마우스로 도는 카드</span>
          <span class="demo-status">완성</span>
          <span class="demo-desc">카드가 툭 튕겨 들어오고, 마우스를 좌우로 움직이면 크게 돌아서 뒷면이 보여.</span>
        </a>
      </li>
```

- [ ] **Step 5: 브라우저 확인**

`http://127.0.0.1:8123/demos/07-mouse-card/`:
1. 콘솔 에러 0
2. 등장: 옆으로 선 카드가 위에서 내려와 돌며 정면, 6° 기운 채 탄력 있게 멈춤 (영상 07번 0~0.5초와 비교 → 원근 값 조정)
3. 마우스 좌우 → 크게 돌고 끝에서 라벤더 뒷면, 기울기 넘어감
4. 패널·링크 위로 → 탄력 복귀
5. 반사가 카드 아래 짧고 흐릿하게 (영상 07번 1초와 비교 → 세기·흐림 조정)
6. 폰 크기: 제목 48px, 가로 스크롤 없음, 좌우로 끌면 돎
7. `npm test` 115개 통과
