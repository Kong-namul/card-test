# 08 원형 휠 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eduard Bodak 포트폴리오의 "Cards in a circular position that slightly rotate on scroll"을 CSS + Lenis로 다시 만든 아카이브 데모 08.

**Architecture:** 원본처럼 큰 원(정사각 상자) 안에 칸마다 15°씩 돌린 감싸개를 겹치고, 카드는 감싸개 위쪽 가장자리 바깥(`translateY(−100%)`)에 붙인다. 돌지 않는 그라데이션을 같은 자리에 덮어 위쪽 호만 보이게 하고, 스크롤 진행도(`shared/scroll-progress.js`) × −65°로 원을 돌린다. 숫자·계산은 `wheel.js` 순수 함수.

**Tech Stack:** HTML/CSS/vanilla JS(ES 모듈, importmap), Lenis 1.3.27, lil-gui(공통 패널), node --test.

spec: `docs/superpowers/specs/2026-11-22-card-archive-bodak-design.md` 7장

## Global Constraints

- 반말 문구, 제목 흰색 단색, 글자 크기는 토큰 스케일(72/48/32/24/22/18/14)만.
- 색은 `shared/tokens.css`만 (새 색 없음).
- 공통 CSS를 고치면 부르는 모든 곳의 `?v=`를 올린다.
- 외부 스크립트 버전 고정: `lenis@1.3.27`, `three@0.187.0`.
- 원본 코드는 가져오지 않는다. 숫자·원리만.
- 커밋은 사용자가 요청할 때만.
- 테스트: `npm test`, 시작 시점 115개 통과.

## File Structure

| 파일 | 할 일 |
|---|---|
| `shared/dom-card.css` (수정) | 카드 색 클래스 `.is-lavender/.is-pink/.is-yellow` 옮겨옴 → `?v=2` |
| `demos/06-escape-flip/style.css` (수정) | 색 클래스 삭제 (공통으로 옮김) → `?v=6` |
| `demos/08-wheel/wheel.js` (새) | 원본 숫자 + `visibleSlots`, `wheelRotation`, `overlayStops`, `overlayGradient` |
| `tests/wheel.test.js` (새) | 원본 숫자·계산 테스트 |
| `demos/08-wheel/style.css`, `main.js`, `index.html` (새) | 페이지 |
| `index.html` (수정) | 아카이브 목록에 08 |

---

### Task 1: 원본 숫자 → 계산 (`wheel.js`)

**Files:**
- Create: `demos/08-wheel/wheel.js`
- Test: `tests/wheel.test.js`

**Interfaces:**
- Produces:
  - `WHEEL = { size, cardWidth, slots, angle, hidden: [from, to], rotate, window: {startOffset, endOffset} }`
  - `OVERLAY_STOPS = [{ at, alpha }, …]`, `CARD_COLORS = ['lavender', 'pink', 'yellow']`
  - `TUNE_DEFAULTS = { rotate, wheelScale, fadeEnd }`
  - `visibleSlots() → [{ index, angle, color }]` (호 왼쪽부터 오른쪽 순서)
  - `wheelRotation(progress, tune = TUNE_DEFAULTS) → number` (deg)
  - `overlayStops(fadeEnd) → [{ at, alpha }]`
  - `overlayGradient(fadeEnd) → string` (CSS `linear-gradient(...)`)

- [ ] **Step 1: 실패하는 테스트**

```js
// FILE: tests/wheel.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WHEEL, OVERLAY_STOPS, CARD_COLORS, TUNE_DEFAULTS,
  visibleSlots, wheelRotation, overlayStops, overlayGradient,
} from '../demos/08-wheel/wheel.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('원본 숫자: 지름 70 · 카드 7.5 · 24칸 × 15° · 8~19번 뺌 · −65° · 스크롤 구간 0%, 50%', () => {
  assert.deepEqual(WHEEL, {
    size: 70, cardWidth: 7.5, slots: 24, angle: 15, hidden: [8, 19], rotate: -65,
    window: { startOffset: 0, endOffset: 0.5 },
  });
});

test('원본 그라데이션: 9% · 16% · 22% · 32%에 검정 3d · 80 · b8 · ff', () => {
  assert.deepEqual(OVERLAY_STOPS.map((s) => s.at), [0, 9, 16, 22, 32]);
  assert.deepEqual(OVERLAY_STOPS.map((s) => Math.round(s.alpha * 255)), [0, 0x3d, 0x80, 0xb8, 0xff]);
});

test('보이는 카드 12장: 호 왼쪽 20번(−60°)부터 오른쪽 7번(105°)까지, 각도 = 번호 × 15°', () => {
  const slots = visibleSlots();
  assert.equal(slots.length, 12);
  assert.deepEqual(slots.map((s) => s.index), [20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6, 7]);
  slots.forEach((s) => assert.equal(s.angle, s.index * 15));
});

test('카드 색: 호 왼쪽부터 라벤더 · 분홍 · 노랑 순서로 반복', () => {
  assert.deepEqual(CARD_COLORS, ['lavender', 'pink', 'yellow']);
  assert.deepEqual(visibleSlots().map((s) => s.color).slice(0, 6), ['lavender', 'pink', 'yellow', 'lavender', 'pink', 'yellow']);
});

test('회전: 진행도에 정비례(linear), 끝에서 −65°, 패널 값 반영', () => {
  assert.equal(wheelRotation(0), 0);
  close(wheelRotation(0.5), -32.5);
  assert.equal(wheelRotation(1), -65);
  assert.equal(wheelRotation(1, { ...TUNE_DEFAULTS, rotate: -90 }), -90);
});

test('그라데이션 끝(패널): 32% 기본, 64%로 바꾸면 단계 위치가 전부 2배', () => {
  assert.deepEqual(overlayStops(32), OVERLAY_STOPS);
  assert.deepEqual(overlayStops(64).map((s) => s.at), [0, 18, 32, 44, 64]);
});

test('그라데이션 CSS: 배경색(--bg-1)을 단계별 진하기로 섞는다', () => {
  assert.equal(
    overlayGradient(32),
    'linear-gradient(color-mix(in srgb, var(--bg-1) 0%, transparent) 0%, '
      + 'color-mix(in srgb, var(--bg-1) 23.9%, transparent) 9%, '
      + 'color-mix(in srgb, var(--bg-1) 50.2%, transparent) 16%, '
      + 'color-mix(in srgb, var(--bg-1) 72.2%, transparent) 22%, '
      + 'color-mix(in srgb, var(--bg-1) 100%, transparent) 32%)',
  );
});

test('패널 기본값', () => {
  assert.deepEqual(TUNE_DEFAULTS, { rotate: -65, wheelScale: 1, fadeEnd: 32 });
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/wheel.test.js`
Expected: FAIL — `Cannot find module .../demos/08-wheel/wheel.js`

- [ ] **Step 3: 구현**

```js
// FILE: demos/08-wheel/wheel.js
// ─────────────────────────────────────────────────────────────
// wheel.js — 08 원형 휠: 원본 숫자와 계산 (순수 함수)
// 숫자 출처: Codrops "Built to Move" (Eduard Bodak, 2025-07-29)
// "Cards in a circular position that slightly rotate on scroll" 본문 코드.
// ─────────────────────────────────────────────────────────────

export const WHEEL = {
  size: 70,         // 원 지름 70em (정사각 상자)
  cardWidth: 7.5,   // 카드 폭 7.5em
  slots: 24,        // 24칸
  angle: 15,        // 칸마다 15° (--wheel-angle)
  hidden: [8, 19],  // 8~19번은 그라데이션 뒤라 안 보여서 뺀다 → 12장
  rotate: -65,      // 스크롤 끝까지 −65°, ease linear
  // 글에 offset 숫자 없음 → 첫 화면에 있어 0에서 시작, 구간 아랫변이 화면 가운데 올 때 다 돌게
  window: { startOffset: 0, endOffset: 0.5 },
};

// 원본 .wheel_overlay 그라데이션: 위는 투명 → 32%에서 완전히 검정
export const OVERLAY_STOPS = [
  { at: 0, alpha: 0 },
  { at: 9, alpha: 0x3d / 255 },
  { at: 16, alpha: 0x80 / 255 },
  { at: 22, alpha: 0xb8 / 255 },
  { at: 32, alpha: 1 },
];

// 무지 카드 색 (호 왼쪽부터 순서대로 반복)
export const CARD_COLORS = ['lavender', 'pink', 'yellow'];

// 조절 패널 기본값
export const TUNE_DEFAULTS = {
  rotate: WHEEL.rotate,
  wheelScale: 1, // 원 크기 (1 = 화면 폭 1%를 원본 1em으로)
  fadeEnd: OVERLAY_STOPS[OVERLAY_STOPS.length - 1].at,
};

// 0~360° → −180~180° (호 왼쪽이 음수)
const signed = (angle) => (angle > 180 ? angle - 360 : angle);

export function visibleSlots() {
  const [from, to] = WHEEL.hidden;
  const slots = [];
  for (let index = 0; index < WHEEL.slots; index++) {
    if (index >= from && index <= to) continue;
    slots.push({ index, angle: index * WHEEL.angle });
  }
  return slots
    .sort((a, b) => signed(a.angle) - signed(b.angle))
    .map((slot, order) => ({ ...slot, color: CARD_COLORS[order % CARD_COLORS.length] }));
}

// 원본 gsap.to(wheel, { rotate: −65, ease: 'linear' })을 진행도로 감은 것과 같다
export function wheelRotation(progress, tune = TUNE_DEFAULTS) {
  return progress * tune.rotate || 0;
}

// 그라데이션 끝 위치(패널)에 맞춰 단계 위치를 같은 비율로 늘이고 줄인다
export function overlayStops(fadeEnd) {
  const scale = fadeEnd / OVERLAY_STOPS[OVERLAY_STOPS.length - 1].at;
  return OVERLAY_STOPS.map(({ at, alpha }) => ({ at: at * scale, alpha }));
}

const percent = (value) => `${Math.round(value * 10) / 10}%`;

export function overlayGradient(fadeEnd) {
  const parts = overlayStops(fadeEnd).map(
    ({ at, alpha }) => `color-mix(in srgb, var(--bg-1) ${percent(alpha * 100)}, transparent) ${percent(at)}`,
  );
  return `linear-gradient(${parts.join(', ')})`;
}
```

- [ ] **Step 4: 통과 확인**

Run: `node --test tests/wheel.test.js && npm test`
Expected: 8개 통과, 전체 123개 통과

---

### Task 2: 카드 색 클래스 공통으로 + 08 페이지 + 아카이브 연결

**Files:**
- Modify: `shared/dom-card.css` (끝에 색 클래스), `demos/06-escape-flip/style.css` (색 클래스 삭제), `demos/06-escape-flip/index.html`, `demos/07-mouse-card/index.html` (`dom-card.css?v=2`, 06은 `style.css?v=6`)
- Create: `demos/08-wheel/style.css`, `demos/08-wheel/main.js`, `demos/08-wheel/index.html`
- Modify: `index.html` (07 항목 다음)

**Interfaces:**
- Consumes: Task 1 모든 export, `scrollWindow` · `windowProgress` · `measureSection` from `shared/scroll-progress.js?v=1`, `prefersReducedMotion`, `createPanel` · `addSettingsButtons`

- [ ] **Step 1: 색 클래스를 공통으로**

`shared/dom-card.css` 끝에 추가:

```css
/* 카드 앞면 파스텔 (06·08 공통, 원본 영상 카드 색) — 카드든 미니카드든 이 클래스로 --card-face를 정한다 */
.is-lavender { --card-face: var(--card-lavender); }
.is-pink { --card-face: var(--card-pink); }
.is-yellow { --card-face: var(--card-yellow); }
```

`demos/06-escape-flip/style.css`에서 아래 네 줄 삭제:

```css
/* 카드 앞면 색 (뒷면은 dom-card.css 기본값 = 종이색) */
.is-lavender { --card-face: var(--card-lavender); }
.is-pink { --card-face: var(--card-pink); }
.is-yellow { --card-face: var(--card-yellow); }
```

Run: `sed -i '' 's#dom-card.css?v=1#dom-card.css?v=2#' demos/06-escape-flip/index.html demos/07-mouse-card/index.html && sed -i '' 's#./style.css?v=5#./style.css?v=6#' demos/06-escape-flip/index.html`

- [ ] **Step 2: CSS**

```css
<!-- FILE: demos/08-wheel/style.css -->
/* ─────────────────────────────────────────────────────────────
 * 08 원형 휠 — 배치만. 색·글자 크기는 tokens.css 값만 쓴다.
 * 카드 모양·색은 shared/dom-card.css.
 * 원본 1em 대신 --wheel-unit: 1440 화면에서 원 1008px·카드 108px (원본 영상 비율), 폰에선 최소 8px.
 * ───────────────────────────────────────────────────────────── */
.wheel-stage {
  position: relative;
  min-height: 100svh;
  overflow: clip;
  --wheel-unit: max(calc(1vw * var(--wheel-scale, 1)), 8px);
  --wheel-size: calc(var(--wheel-unit) * 70);
  --card-w: calc(var(--wheel-unit) * 7.5);
  --card-h: calc(var(--card-w) * 490 / 345);
  --wheel-top: calc(var(--card-h) + 72px); /* 카드가 원 바깥 위로 붙으니, 카드 높이만큼 내려서 시작 */
}

/* 원과 그라데이션이 같은 자리에 겹친다 (원본: 둘 다 grid-area 1 / 1). 그라데이션은 돌지 않는다 */
.wheel-frame {
  position: absolute;
  left: 50%;
  top: var(--wheel-top);
  width: var(--wheel-size);
  aspect-ratio: 1;
  transform: translateX(-50%);
  display: grid;
}
.wheel,
.wheel-overlay { grid-area: 1 / 1; }
.wheel { display: grid; }
.wheel-overlay { pointer-events: none; }

/* 칸: 원 높이만큼 길쭉한 감싸개를 가운데에 세우고 각도만큼 돌린다 → 회전 중심 = 원 중심 */
.wheel-item-wrap {
  grid-area: 1 / 1;
  justify-self: center;
  height: 100%;
  transform: rotate(calc(var(--angle) * 1deg));
}
/* 카드는 감싸개 맨 위에서 자기 높이만큼 위로 → 아랫변이 원 윗변에 붙어 바깥을 향해 꽂힌다 */
.wheel-item { transform: translateY(-100%); }

/* 제목: 호 안쪽 가운데 (원본은 이 자리에 가격 글씨) */
.wheel-title {
  position: absolute;
  left: 50%;
  top: calc(var(--wheel-top) + var(--wheel-size) * 0.12);
  transform: translateX(-50%);
  z-index: 1;
  font-size: var(--text-72);
  line-height: var(--lh-72);
  white-space: nowrap;
}
.wheel-stage .stage-caption { z-index: 1; }

@media (max-width: 767px) {
  .wheel-title { font-size: var(--text-48); line-height: var(--lh-48); }
}
```

- [ ] **Step 3: main.js**

```js
// FILE: demos/08-wheel/main.js
// ─────────────────────────────────────────────────────────────
// 08 원형 휠 — Eduard Bodak 포트폴리오의 "Cards in a circular position that slightly rotate on scroll"을 다시 만든 데모
// 원 둘레에 카드를 꽂고, 스크롤 진행도만큼 원을 돌린다 (원본: 진행도로 감는 linear 타임라인).
// ─────────────────────────────────────────────────────────────
import Lenis from 'lenis';
import { scrollWindow, windowProgress, measureSection } from '../../shared/scroll-progress.js?v=1';
import { prefersReducedMotion } from '../../shared/motion.js?v=3';
import { createPanel, addSettingsButtons } from '../../shared/panel.js?v=2';
import { WHEEL, TUNE_DEFAULTS, visibleSlots, wheelRotation, overlayGradient } from './wheel.js?v=1';

const reduced = prefersReducedMotion();
const stage = document.querySelector('.wheel-stage');
const wheel = stage.querySelector('.wheel');
const overlay = stage.querySelector('.wheel-overlay');

// 카드 12장 (원본 HTML은 24칸을 다 만들고 안 보이는 8~19번을 지웠다)
for (const slot of visibleSlots()) {
  const wrap = document.createElement('div');
  wrap.className = 'wheel-item-wrap';
  wrap.style.setProperty('--angle', slot.angle);
  const card = document.createElement('div');
  card.className = `wheel-item dom-card is-${slot.color}`;
  const face = document.createElement('div');
  face.className = 'dom-card__face dom-card__face--front';
  card.appendChild(face);
  wrap.appendChild(card);
  wheel.appendChild(wrap);
}

const params = structuredClone(TUNE_DEFAULTS);

// 부드러운 스크롤(Lenis). 동작 줄이기가 켜져 있으면 쓰지 않는다
const lenis = reduced ? null : new Lenis({ autoRaf: true, syncTouch: false });
const currentScroll = () => (lenis ? lenis.scroll : window.scrollY);

let scrollRange = { start: 0, end: 1 };

function measure() {
  scrollRange = scrollWindow(measureSection(stage), WHEEL.window);
}

function render() {
  const progress = reduced ? 0 : windowProgress(currentScroll(), scrollRange);
  wheel.style.transform = `rotate(${wheelRotation(progress, params)}deg)`;
}

function applyLook() {
  stage.style.setProperty('--wheel-scale', params.wheelScale);
  overlay.style.backgroundImage = overlayGradient(params.fadeEnd);
  measure();
  render();
}

// 조절 패널
const gui = createPanel('08 원형 휠 · 조절 패널');
gui.add(params, 'rotate', -180, 0, 1).name('도는 각도 (°)').onChange(render);
gui.add(params, 'wheelScale', 0.6, 1.6, 0.05).name('원 크기').onChange(applyLook);
gui.add(params, 'fadeEnd', 10, 60, 1).name('그라데이션 끝 (%)').onChange(applyLook);
addSettingsButtons(gui, { params, defaults: TUNE_DEFAULTS, onApply: applyLook });

if (lenis) lenis.on('scroll', render);
else window.addEventListener('scroll', render, { passive: true });

let resizeFrame = 0;
window.addEventListener('resize', () => {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => {
    measure();
    render();
  });
});

applyLook();
```

- [ ] **Step 4: index.html**

```html
<!-- FILE: demos/08-wheel/index.html -->
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>08 원형 휠 · Card Archive</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/lenis@1.3.27/dist/lenis.css">
  <link rel="stylesheet" href="../../shared/tokens.css?v=2">
  <link rel="stylesheet" href="../../shared/base.css?v=4">
  <link rel="stylesheet" href="../../shared/dom-card.css?v=2">
  <link rel="stylesheet" href="./style.css?v=1">
  <script type="importmap">
  {
    "imports": {
      "lenis": "https://cdn.jsdelivr.net/npm/lenis@1.3.27/dist/lenis.mjs",
      "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.187.0/examples/jsm/"
    }
  }
  </script>
</head>
<body>
  <a class="back-link" href="../../">← 아카이브</a>

  <section class="wheel-stage" aria-label="큰 원의 위쪽 둘레에 파스텔 카드 열두 장이 바깥을 향해 꽂혀 있고, 스크롤하면 원이 천천히 도는 장면">
    <div class="wheel-frame">
      <div class="wheel"></div>
      <div class="wheel-overlay"></div>
    </div>
    <h1 class="wheel-title">원형 휠</h1>
    <div class="stage-caption">
      <p class="caption-index">08</p>
      <p>큰 원 둘레에 카드가 꽂혀 있고, 스크롤하면 원이 천천히 돌아.</p>
      <p class="caption-hint">스크롤해봐</p>
    </div>
  </section>

  <main class="notes" id="notes">
    <section>
      <h2>이 데모에 쓴 기법</h2>
      <dl>
        <dt>원 둘레에 카드 꽂기</dt>
        <dd>큰 정사각 상자(원) 안에 원 높이만큼 길쭉한 칸을 가운데에 겹쳐 세우고, 칸마다 15°씩 돌려. 카드는 칸 맨 위에서 자기 높이만큼 위로 올려서, 아랫변이 원 가장자리에 붙고 바깥을 향해 꽂혀. 원 지름과 카드 폭 비율은 원본 그대로 70 : 7.5야.</dd>
        <dt>안 보이는 카드는 빼기</dt>
        <dd>24칸 중 아래쪽 8~19번은 어차피 그라데이션 뒤라 안 보여서 빼고 12장만 놓았어. 색은 호 왼쪽부터 라벤더·분홍·노랑을 번갈아 줘서 원이 도는 게 잘 보여.</dd>
        <dt>위쪽 호만 보이게</dt>
        <dd>원과 같은 자리에 돌지 않는 그라데이션을 덮어. 원 높이의 9%까지는 그대로 보이고 16%·22%를 지나 32%에서 완전히 배경색이 돼서, 위쪽 호의 카드만 보이고 양옆으로 갈수록 스르르 사라져.</dd>
        <dt>스크롤하면 천천히 돌기</dt>
        <dd>스크롤 진행도만큼 원을 일정한 속도로 −65°까지 돌려. 카드가 오른쪽에서 올라와 왼쪽으로 넘어가. 원본 글엔 도는 구간 숫자가 없어서, 원이 화면에 보이는 동안 다 돌게 첫 화면에서 시작해 구간 아래가 화면 가운데에 올 때 끝나게 했어. 원은 화면에 붙지 않고 페이지와 같이 올라가.</dd>
      </dl>
    </section>
    <section>
      <h2>참고한 곳</h2>
      <p>숫자와 원리만 공부했고, 코드는 가져오지 않았어.</p>
      <p><a href="https://tympanus.net/codrops/2025/07/29/built-to-move-a-closer-look-at-the-animations-behind-eduard-bodaks-portfolio/" target="_blank" rel="noopener">Built to Move</a> (Codrops, Eduard Bodak): 원 크기·칸 각도·그라데이션·회전 숫자.</p>
      <p><a href="https://scroll.locomotive.ca/" target="_blank" rel="noopener">Locomotive Scroll</a>: 스크롤 진행도 계산식.</p>
      <p><a href="#">↑ 처음으로</a></p>
    </section>
  </main>

  <script type="module" src="./main.js?v=1"></script>
</body>
</html>
```

- [ ] **Step 5: 아카이브 목록**

`index.html`의 07 항목 `</li>` 다음에:

```html
      <li>
        <a class="demo-item" href="demos/08-wheel/">
          <span class="demo-index">08</span>
          <span class="demo-name">원형 휠</span>
          <span class="demo-status">완성</span>
          <span class="demo-desc">큰 원 둘레에 카드가 꽂혀 있고, 스크롤하면 원이 천천히 돌아.</span>
        </a>
      </li>
```

- [ ] **Step 6: 브라우저 확인**

`http://127.0.0.1:8123/demos/08-wheel/` (1440×900, 375×812):
1. 콘솔 에러 0, 가로 스크롤 없음
2. 위쪽 호에 카드가 바깥으로 꽂혀 있고 양옆으로 사라짐 (영상 12번과 비교)
3. 스크롤하면 반시계로 −65°까지 돎
4. 06 미니카드·카드 색이 그대로 (색 클래스 옮긴 뒤)
5. `npm test` 123개 통과
