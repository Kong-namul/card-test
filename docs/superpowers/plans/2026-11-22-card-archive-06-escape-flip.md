# 06 탈출 & 뒤집기 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eduard Bodak 포트폴리오의 "Flipping 3D cards on scroll"(탈출 → 귀환·뒤집기 → 미니카드 진행 표시)을 CSS 3D + GSAP으로 다시 만든 아카이브 데모 06.

**Architecture:** 카드는 웹페이지 요소(`.dom-card`, 앞뒤 두 면)이고 CSS 3D 변형으로 돈다. 원본 숫자는 `timeline.js` 순수 함수가 GSAP 키프레임 객체로 만들고, `main.js`가 멈춰둔 GSAP 타임라인 2개를 Locomotive v5 식 스크롤 진행도(`shared/scroll-progress.js`)로 감는다. 부드러운 스크롤은 Lenis.

**Tech Stack:** HTML/CSS/vanilla JS(ES 모듈, importmap), GSAP 3.15.1, Lenis 1.3.27, lil-gui(공통 패널, three@0.187.0 addons 경로), node --test.

spec: `docs/superpowers/specs/2026-11-22-card-archive-bodak-design.md`

## Global Constraints

- 반말 문구, 제목은 흰색 단색(보라 금지), 글자 크기는 토큰 스케일(72/48/32/24/22/18/14)만.
- 색·폰트는 `shared/tokens.css`만. 새 색은 사용자 승인된 3개(`--card-lavender #E6DAF6`, `--card-pink #FED3F4`, `--card-yellow #FCDDA8`)만 추가.
- 공통 JS/CSS를 고치면 그 파일을 부르는 모든 곳의 `?v=`를 올린다.
- 외부 스크립트는 정확한 버전 고정: `gsap@3.15.1`, `lenis@1.3.27`, `three@0.187.0`.
- 원본 코드는 가져오지 않는다. 숫자·원리만.
- 커밋은 사용자가 요청할 때만 (이 계획에는 커밋 단계 없음).
- 테스트: `npm test` (= `node --test "tests/*.test.js"`), 시작 시점 88개 통과.

## File Structure

| 파일 | 할 일 |
|---|---|
| `shared/tokens.css` (수정) | 파스텔 색 3개 추가 → 모든 페이지 `tokens.css?v=2` |
| `shared/dom-card.css` (새) | CSS 3D 카드 모양 (Grail 비율·모서리, 앞뒤 면) — 06~08 공통 |
| `shared/scroll-progress.js` (새) | Locomotive v5 진행도 식 (`scrollWindow`, `windowProgress`, `measureSection`) — 06·08 공통 |
| `tests/scroll-progress.test.js` (새) | 위 식 테스트 |
| `demos/06-escape-flip/timeline.js` (새) | 원본 숫자 → 키프레임 객체 순수 함수 |
| `tests/escape-flip-timeline.test.js` (새) | 원본 숫자 테스트 |
| `demos/06-escape-flip/style.css` (새) | 06 배치 |
| `demos/06-escape-flip/main.js` (새) | GSAP 타임라인·Lenis·패널 조립 |
| `demos/06-escape-flip/index.html` (새) | 페이지 + 노트 |
| `index.html` (수정) | 아카이브 목록에 06 추가 |

---

### Task 1: 공통 부품 — 색 토큰, DOM 카드, 스크롤 진행도

**Files:**
- Modify: `shared/tokens.css` (`--card-paper` 줄 아래)
- Modify: `index.html`, `demos/01-spiral/index.html` ~ `demos/05-cosmos/index.html` (`tokens.css?v=1` → `?v=2`)
- Create: `shared/dom-card.css`
- Create: `shared/scroll-progress.js`
- Test: `tests/scroll-progress.test.js`

**Interfaces:**
- Produces:
  - `scrollWindow({ top, height, viewport }, { startOffset = 0, endOffset = 0 } = {}) → { start, end }` (px, 스크롤 위치)
  - `windowProgress(scroll, { start, end }) → number` (0~1)
  - `measureSection(element) → { top, height, viewport }` (브라우저 전용)
  - CSS: `.dom-card`, `.dom-card__face`, `.dom-card__face--front`, `.dom-card__face--back`; 변수 `--card-w`, `--card-face`, `--card-back`
  - 토큰: `--card-lavender`, `--card-pink`, `--card-yellow`

- [ ] **Step 1: 실패하는 테스트 쓰기**

```js
// FILE: tests/scroll-progress.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scrollWindow, windowProgress } from '../shared/scroll-progress.js';

test('첫 화면 안에 있는 요소는 스크롤 0에서 시작한다 (Locomotive "fold") — 06 탈출 구간 0%, 25%', () => {
  const win = scrollWindow({ top: 0, height: 1000, viewport: 1000 }, { startOffset: 0, endOffset: 0.25 });
  assert.deepEqual(win, { start: 0, end: 750 }); // 아랫변이 화면 위에서 25% 내려온 순간 끝
});

test('아래에 있는 요소는 윗변이 화면 아래에서 startOffset만큼 올라온 순간 시작하고, 아랫변이 화면 위에서 endOffset만큼 내려온 순간 끝난다 — 06 귀환 구간 5%, 75%', () => {
  const win = scrollWindow({ top: 1600, height: 3500, viewport: 1000 }, { startOffset: 0.05, endOffset: 0.75 });
  assert.equal(win.start, 1600 - 1000 + 50);
  assert.equal(win.end, 1600 + 3500 - 750);
});

test('offset을 안 주면 0으로 본다', () => {
  assert.deepEqual(scrollWindow({ top: 2000, height: 500, viewport: 1000 }), { start: 1000, end: 2500 });
});

test('끝이 시작보다 앞이거나 같으면 끝 = 시작 + 1 (Locomotive와 같음)', () => {
  // 시작 2000 − 1000 + 900 = 1900, 끝 2010 − 900 = 1110 → 1901
  assert.deepEqual(scrollWindow({ top: 2000, height: 10, viewport: 1000 }, { startOffset: 0.9, endOffset: 0.9 }), { start: 1900, end: 1901 });
});

test('windowProgress는 구간 안에서 0~1, 밖은 0이나 1로 자른다', () => {
  const win = { start: 100, end: 300 };
  assert.equal(windowProgress(0, win), 0);
  assert.equal(windowProgress(100, win), 0);
  assert.equal(windowProgress(200, win), 0.5);
  assert.equal(windowProgress(300, win), 1);
  assert.equal(windowProgress(999, win), 1);
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/scroll-progress.test.js`
Expected: FAIL — `Cannot find module .../shared/scroll-progress.js`

- [ ] **Step 3: 구현**

```js
// FILE: shared/scroll-progress.js
// ─────────────────────────────────────────────────────────────
// scroll-progress.js — 스크롤 위치를 구간 진행도(0~1)로 바꾸는 함수 (06·08 공통)
// Eduard Bodak 포트폴리오가 쓴 Locomotive Scroll v5의 계산식을 그대로 옮겼다
// (locomotive-scroll@5.0.0 배포 코드 _computeIntersection / _computeProgress에서 확인).
//   startOffset · endOffset : 화면 높이 비율. data-scroll-offset="5%, 75%" → 0.05, 0.75
//   시작 = 요소가 첫 화면 안에 있으면 0, 아니면 윗변이 화면 아래에서 startOffset만큼 올라온 순간
//   끝   = 아랫변이 화면 위에서 endOffset만큼 내려온 순간
// ─────────────────────────────────────────────────────────────
import { clamp } from './motion.js?v=3';

export function scrollWindow({ top, height, viewport }, { startOffset = 0, endOffset = 0 } = {}) {
  const start = top < viewport ? 0 : top - viewport + startOffset * viewport;
  let end = top + height - endOffset * viewport;
  if (end <= start) end = start + 1;
  return { start, end };
}

export function windowProgress(scroll, { start, end }) {
  return clamp((scroll - start) / (end - start), 0, 1);
}

// 요소의 페이지 기준 윗변(스크롤 0일 때 위치)·높이와 화면 높이를 잰다. 브라우저 전용.
export function measureSection(element) {
  const rect = element.getBoundingClientRect();
  return { top: rect.top + window.scrollY, height: rect.height, viewport: window.innerHeight };
}
```

- [ ] **Step 4: 통과 확인**

Run: `node --test tests/scroll-progress.test.js`
Expected: PASS 5개

- [ ] **Step 5: 색 토큰 추가**

`shared/tokens.css`에서 `  --card-paper: #F4F1EA;      /* 무지 카드 기본색 (오프화이트) */` 줄 바로 아래에 넣는다:

```css
  /* 06~ Eduard Bodak 카드 앞면 파스텔 — 원본 영상(Codrops 04번 7초) 카드 면 픽셀 평균 */
  --card-lavender: #E6DAF6;
  --card-pink: #FED3F4;
  --card-yellow: #FCDDA8;
```

그리고 `?v=` 올리기:

Run: `sed -i '' 's/tokens\.css?v=1/tokens.css?v=2/' index.html demos/0[1-5]-*/index.html && grep -c "tokens.css?v=2" index.html demos/0[1-5]-*/index.html`
Expected: 6개 파일 모두 `1`

- [ ] **Step 6: DOM 카드 CSS**

```css
<!-- FILE: shared/dom-card.css -->
/* ─────────────────────────────────────────────────────────────
 * dom-card.css — CSS 3D로 돌리는 카드 (06~08 공통)
 * 비율·모서리는 01~05 3D 카드와 같은 Grail 값: 가로:세로 = 345:490, 모서리 = 가로 × 20/345
 * 쓰는 쪽이 정하는 값: --card-w(카드 폭), --card-face(앞면 색), --card-back(뒷면 색). 색 기본값은 종이색.
 * 구조: .dom-card > .dom-card__face--front + .dom-card__face--back
 *       뒷면은 Y축으로 180° 돌려 붙여서, 카드가 뒤집히면 뒷면이 보인다.
 * ───────────────────────────────────────────────────────────── */
.dom-card {
  position: relative;
  width: var(--card-w, 160px);
  aspect-ratio: 345 / 490;
  transform-style: preserve-3d;
}

.dom-card__face {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: calc(var(--card-w, 160px) * 20 / 345);
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

.dom-card__face--front { background: var(--card-face, var(--card-paper)); }

.dom-card__face--back {
  background: var(--card-back, var(--card-paper));
  transform: rotateY(180deg);
}
```

- [ ] **Step 7: 전체 테스트**

Run: `npm test`
Expected: 93개 통과 (88 + 5), 실패 0

---

### Task 2: 06 원본 숫자 → 키프레임 (`timeline.js`)

**Files:**
- Create: `demos/06-escape-flip/timeline.js`
- Test: `tests/escape-flip-timeline.test.js`

**Interfaces:**
- Consumes: `clamp` from `shared/motion.js?v=3`
- Produces:
  - 상수 `STAGGER`, `ESCAPE`, `RETURN`, `FLOAT`, `TINY`, `TUNE_DEFAULTS`
    (`TUNE_DEFAULTS = { float, fanAngle, gather, tilt, overshoot, perspective, veilStart }`)
  - `escapeKeyframes(index, { cardWidth, cardHeight, sectionHeight }, tune = TUNE_DEFAULTS) → { '75%': {x, rotationZ}, '100%': {y, scale, rotateX} }`
  - `returnKeyframes(index, { cardWidth, viewportHeight }, tune = TUNE_DEFAULTS, currentX = () => 0) → { '0%', '40%', '55%', '75%', '82%', '100%' }`
  - `reducedEscapeKeyframes()`, `reducedReturnKeyframes()`
  - `veilOpacity(progress, start) → 0~1`
  - `tinyFill(progress, index) → { fill, lift }`

- [ ] **Step 1: 실패하는 테스트 쓰기**

```js
// FILE: tests/escape-flip-timeline.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  STAGGER, ESCAPE, RETURN, FLOAT, TINY, TUNE_DEFAULTS,
  escapeKeyframes, returnKeyframes, reducedEscapeKeyframes, reducedReturnKeyframes,
  veilOpacity, tinyFill,
} from '../demos/06-escape-flip/timeline.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const closeAll = (list, expected) => list.forEach((value, i) => close(value, expected[i]));

const escapeSize = { cardWidth: 100, cardHeight: 142, sectionHeight: 900 };
const returnSize = { cardWidth: 200, viewportHeight: 1000 };
const all = (make) => [0, 1, 2].map(make);

test('원본 숫자: 카드 시차 0.012, 둥실 ±3% · 1.5~2.5초 · sine.inOut, 구간 offset 0%/25% · 5%/75%', () => {
  assert.equal(STAGGER, 0.012);
  assert.deepEqual(FLOAT, { amount: 3, durationMin: 1.5, durationMax: 2.5, ease: 'sine.inOut' });
  assert.deepEqual(ESCAPE.window, { startOffset: 0, endOffset: 0.25 });
  assert.deepEqual(RETURN.window, { startOffset: 0.05, endOffset: 0.75 });
});

test('패널 기본값은 원본 숫자 (둥실 3, 부채꼴 12°, 모이기 0.9, 눕기 16°, 뒤집기 넘침 10°) + 원근 1200 · 사라짐 0.75', () => {
  assert.deepEqual(TUNE_DEFAULTS, { float: 3, fanAngle: 12, gather: 0.9, tilt: 16, overshoot: 10, perspective: 1200, veilStart: 0.75 });
});

test('탈출 75%: 바깥 두 장이 카드폭 0.9배만큼 가운데로 모이며 −12 / 0 / 12° 부채꼴', () => {
  const frames = all((i) => escapeKeyframes(i, escapeSize));
  closeAll(frames.map((f) => f['75%'].x), [90, 0, -90]);
  assert.deepEqual(frames.map((f) => f['75%'].rotationZ), [-12, 0, 12]);
});

test('탈출 100%: 구간 아래까지 가라앉되 16 / 32 / 48px 덜, 0.85배, 뒤로 −16°', () => {
  const frames = all((i) => escapeKeyframes(i, escapeSize));
  assert.deepEqual(frames.map((f) => f['100%'].y), [900 - 142 - 16, 900 - 142 - 32, 900 - 142 - 48]);
  frames.forEach((f) => {
    assert.equal(f['100%'].scale, 0.85);
    assert.equal(f['100%'].rotateX, -16);
  });
});

test('귀환 0%: 화면 높이 × −0.75 + 1px 위에서, 한 줄 자리(카드폭 1.15배)를 지워 세 장이 가운데 겹치고, 0.2배 · 12 / 0 / −12° · 앞으로 24°', () => {
  const frames = all((i) => returnKeyframes(i, returnSize));
  closeAll(frames.map((f) => f['0%'].x), [-230, 0, 230]); // index 0이 오른쪽 자리(+1.15w) → −1.15w로 가운데
  assert.deepEqual(frames.map((f) => f['0%'].rotationZ), [12, 0, -12]);
  frames.forEach((f) => {
    assert.equal(f['0%'].y, -749);
    assert.equal(f['0%'].scale, 0.2);
    assert.equal(f['0%'].rotateX, 24);
  });
  assert.equal(RETURN.gapRatio, 1.15);
});

test('귀환 40%: 카드 높이 20% 자리로 내려앉아 0.8배, 기울기 5 / 0 / −5°, 똑바로', () => {
  const frames = all((i) => returnKeyframes(i, returnSize));
  assert.deepEqual(frames.map((f) => f['40%'].rotationZ), [5, 0, -5]);
  frames.forEach((f) => {
    assert.equal(f['40%'].y, '20%');
    assert.equal(f['40%'].scale, 0.8);
    assert.equal(f['40%'].rotationY, 0);
    assert.equal(f['40%'].rotateX, 0);
  });
});

test('귀환 55%: 잠깐 멈춤 — y 0, x는 그 순간 x 그대로 (콜백을 그대로 넘긴다)', () => {
  const currentX = () => 123;
  const frame = returnKeyframes(0, returnSize, TUNE_DEFAULTS, currentX)['55%'];
  assert.equal(frame.x, currentX);
  assert.equal(frame.y, 0);
  assert.equal(frame.rotationY, 0);
});

test('귀환 75% · 82% · 100%: 한 줄로 벌어지며 −190° 뒤집혔다 −180°로 착, 마지막에 기울기 0', () => {
  all((i) => returnKeyframes(i, returnSize)).forEach((f) => {
    assert.deepEqual(f['75%'], { x: 0, rotationZ: 0, rotationY: -190, scale: 1 });
    assert.deepEqual(f['82%'], { rotationY: -180 });
    assert.deepEqual(f['100%'], { rotationZ: 0 });
  });
});

test('패널 값이 키프레임에 들어간다: 부채꼴 각도 · 모이는 정도 · 눕는 각도 · 뒤집기 넘침', () => {
  const tune = { ...TUNE_DEFAULTS, fanAngle: 24, gather: 0.5, tilt: 30, overshoot: 20 };
  const escape = escapeKeyframes(0, escapeSize, tune);
  close(escape['75%'].x, 50);
  assert.equal(escape['75%'].rotationZ, -24);
  assert.equal(escape['100%'].rotateX, -30);
  const back = returnKeyframes(0, returnSize, tune);
  assert.equal(back['0%'].rotationZ, 24);
  assert.equal(back['40%'].rotationZ, 10);
  assert.equal(back['75%'].rotationY, -200);
  assert.equal(back['82%'].rotationY, -180);
});

test('동작 줄이기: 탈출은 24px 내려가며 흐려지기만, 귀환은 제자리에서 나타나기만', () => {
  assert.deepEqual(reducedEscapeKeyframes(), { '100%': { y: 24, opacity: 0 } });
  assert.deepEqual(reducedReturnKeyframes(), { '0%': { opacity: 0 }, '40%': { opacity: 1 } });
});

test('막 불투명도: 사라짐 시작 전엔 0, 시작부터 끝까지 0 → 1', () => {
  assert.equal(veilOpacity(0.5, 0.75), 0);
  assert.equal(veilOpacity(0.75, 0.75), 0);
  close(veilOpacity(0.875, 0.75), 0.5);
  assert.equal(veilOpacity(1, 0.75), 1);
  assert.equal(veilOpacity(0.99, 1), 0); // 시작이 1이면 끝에서만 1
  assert.equal(veilOpacity(1, 1), 1);
});

test('미니카드: 진행도 1/3마다 한 장씩 아래→위로 차오르고, 덜 찬 만큼 4px 아래에 있다', () => {
  assert.deepEqual(TINY, { segments: [0, 0.33, 0.66], speed: 3, lift: 4 });
  assert.deepEqual(tinyFill(0, 0), { fill: 0, lift: 4 });
  close(tinyFill(0.165, 0).fill, 0.495);
  close(tinyFill(0.165, 0).lift, 4 * (1 - 0.495));
  assert.equal(tinyFill(0.34, 0).fill, 1);
  assert.equal(tinyFill(0.33, 1).fill, 0);
  close(tinyFill(0.5, 1).fill, 0.51);
  assert.equal(tinyFill(0.6, 2).fill, 0);
  assert.deepEqual(tinyFill(1, 2), { fill: 1, lift: 0 });
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/escape-flip-timeline.test.js`
Expected: FAIL — `Cannot find module .../demos/06-escape-flip/timeline.js`

- [ ] **Step 3: 구현**

```js
// FILE: demos/06-escape-flip/timeline.js
// ─────────────────────────────────────────────────────────────
// timeline.js — 06 탈출 & 뒤집기: 원본 숫자를 GSAP 키프레임 객체로 만드는 순수 함수
// 숫자 출처: Codrops "Built to Move" (Eduard Bodak, 2025-07-29) 본문 코드와 글에 실린 영상.
// GSAP 없이도 테스트할 수 있게 숫자만 만든다. 실제로 감는 건 main.js.
// ─────────────────────────────────────────────────────────────
import { clamp } from '../../shared/motion.js?v=3';

// 카드끼리 시차 (원본 timeline.to(card, …, index * 0.012))
export const STAGGER = 0.012;

// Part 01 — 탈출: 바깥 두 장이 가운데로 모이며 부채꼴 → 가라앉으며 작아지고 뒤로 눕기
export const ESCAPE = {
  window: { startOffset: 0, endOffset: 0.25 }, // data-scroll-offset="0%, 25%"
  rotationZ: [-12, 0, 12],                       // 75% 지점 부채꼴 각도
  gather: 0.9,                                   // 75% 지점 x = −position × 카드폭 × 0.9
  yOffsets: [16, 32, 48],                        // 100% 지점 y = (구간 높이 − 카드 높이) − 이 값
  scale: 0.85,
  rotateX: -16,
  gapRatio: 1.1,                                 // 처음 한 줄 간격 = 카드폭 × 1.1 (영상 02에서 잼)
};

// Part 02 — 귀환: 위에서 작게 날아와 겹쳐 쌓였다가, 한 줄로 벌어지며 뒤집힘
export const RETURN = {
  window: { startOffset: 0.05, endOffset: 0.75 }, // data-scroll-offset="5%, 75%"
  gapRatio: 1.15,                                 // 한 줄 간격 = 카드폭 × 1.15 (0% x가 이걸 지워서 처음엔 겹침)
  startY: -0.75,                                  // 0% y = 화면 높이 × −0.75 + 1px
  startScale: 0.2,
  startRotateX: 24,
  rotationZ: [12, 0, -12],                        // 0% 기울기
  landedY: '20%',                                 // 40% 내려앉은 자리 (카드 높이의 20%)
  landedScale: 0.8,
  rotationZLanded: [5, 0, -5],                    // 40% 기울기
  flip: -190,                                     // 75% 뒤집기 (180°를 10° 넘김)
  settle: -180,                                   // 82% 착
};

// 둥실 (원본: yPercent −3 → 3, random(1.5, 2.5)초, sine.inOut, 무한 왕복, 왕복마다 시간 다시 뽑기)
export const FLOAT = { amount: 3, durationMin: 1.5, durationMax: 2.5, ease: 'sine.inOut' };

// Part 2.1 미니카드: 진행도 1/3마다 한 장씩 아래→위로 차오르고, 덜 찬 만큼 4px 아래에 있다
// (안 찬 부분 35% 흐림은 style.css의 mask-image에 있다)
export const TINY = { segments: [0, 0.33, 0.66], speed: 3, lift: 4 };

// 조절 패널 기본값 = 원본 숫자
export const TUNE_DEFAULTS = {
  float: FLOAT.amount,
  fanAngle: ESCAPE.rotationZ[2],
  gather: ESCAPE.gather,
  tilt: -ESCAPE.rotateX,
  overshoot: RETURN.settle - RETURN.flip,
  perspective: 1200, // 원본 글에 숫자 없음
  veilStart: 0.75,   // 원본 글에 숫자 없음 — 부채꼴이 다 모인 뒤 사라지기 시작
};

// −0을 0으로 (값 비교·디버깅 때 헷갈리지 않게)
const tidy = (value) => value || 0;

// 부채꼴 각도 패널 값(기본 12°)에 비례해 모든 기울기를 키우고 줄인다
const fanScale = (tune) => tune.fanAngle / ESCAPE.rotationZ[2];

export function escapeKeyframes(index, { cardWidth, cardHeight, sectionHeight }, tune = TUNE_DEFAULTS) {
  const position = index - 1; // −1, 0, 1
  return {
    '75%': {
      x: tidy(-position * cardWidth * tune.gather),
      rotationZ: tidy(ESCAPE.rotationZ[index] * fanScale(tune)),
    },
    '100%': {
      y: sectionHeight - cardHeight - ESCAPE.yOffsets[index],
      scale: ESCAPE.scale,
      rotateX: tidy(-tune.tilt),
    },
  };
}

// currentX: 55% 지점에서 "그 순간의 x"를 돌려주는 함수 (main.js가 gsap.getProperty로 넘긴다)
export function returnKeyframes(index, { cardWidth, viewportHeight }, tune = TUNE_DEFAULTS, currentX = () => 0) {
  const position = 2 - index - 1; // 1, 0, −1 → index 0이 오른쪽 자리
  return {
    '0%': {
      y: RETURN.startY * viewportHeight + 1,
      x: tidy(-position * cardWidth * RETURN.gapRatio),
      scale: RETURN.startScale,
      rotationZ: tidy(RETURN.rotationZ[index] * fanScale(tune)),
      rotateX: RETURN.startRotateX,
    },
    '40%': {
      y: RETURN.landedY,
      scale: RETURN.landedScale,
      rotationZ: tidy(RETURN.rotationZLanded[index] * fanScale(tune)),
      rotationY: 0,
      rotateX: 0,
    },
    '55%': { rotationY: 0, y: 0, x: currentX },
    '75%': { x: 0, rotationZ: 0, rotationY: RETURN.settle - tune.overshoot, scale: 1 },
    '82%': { rotationY: RETURN.settle },
    '100%': { rotationZ: 0 },
  };
}

// 동작 줄이기 (원본 글: "카드를 살짝 내리고 흐려지게만")
export function reducedEscapeKeyframes() {
  return { '100%': { y: 24, opacity: 0 } };
}

export function reducedReturnKeyframes() {
  return { '0%': { opacity: 0 }, '40%': { opacity: 1 } };
}

// 탈출 카드를 덮는 막: 진행도가 start를 넘으면 차오르기 시작해 끝(1)에서 완전히 덮는다
export function veilOpacity(progress, start) {
  if (start >= 1) return progress >= 1 ? 1 : 0;
  return clamp((progress - start) / (1 - start), 0, 1);
}

// 원본 CSS: min(var(--progress) - 0.33·i, 구간) × 300% 을 0~1 채움으로
export function tinyFill(progress, index) {
  const fill = clamp((progress - TINY.segments[index]) * TINY.speed, 0, 1);
  return { fill, lift: TINY.lift * (1 - fill) };
}
```

- [ ] **Step 4: 통과 확인**

Run: `node --test tests/escape-flip-timeline.test.js && npm test`
Expected: 12개 통과, 전체 105개 통과 (93 + 12), 실패 0

---

### Task 3: 06 페이지 조립 (HTML · CSS · main.js)

**Files:**
- Create: `demos/06-escape-flip/style.css`
- Create: `demos/06-escape-flip/main.js`
- Create: `demos/06-escape-flip/index.html`

**Interfaces:**
- Consumes: Task 1 (`scrollWindow`, `windowProgress`, `measureSection`, `.dom-card`), Task 2 (모든 export), `prefersReducedMotion` from `shared/motion.js?v=3`, `createPanel` · `addSettingsButtons` from `shared/panel.js?v=2`
- Produces: 브라우저에서 열리는 `demos/06-escape-flip/` 페이지

- [ ] **Step 1: 배치 CSS**

```css
<!-- FILE: demos/06-escape-flip/style.css -->
/* ─────────────────────────────────────────────────────────────
 * 06 탈출 & 뒤집기 — 배치만. 색·글자 크기는 tokens.css 값만 쓴다.
 * 카드 모양은 shared/dom-card.css.
 * ───────────────────────────────────────────────────────────── */

/* 카드 앞면 색 (뒷면은 dom-card.css 기본값 = 종이색) */
.is-lavender { --card-face: var(--card-lavender); }
.is-pink { --card-face: var(--card-pink); }
.is-yellow { --card-face: var(--card-yellow); }

/* 탈출 구간: 첫 화면. 카드 폭은 영상에서 잰 화면 폭 9% (폰에서도 72px 아래로는 안 작아짐) */
.escape {
  position: relative;
  height: 100svh;
  overflow-x: clip;
  perspective: var(--persp, 1200px);
  --card-w: clamp(72px, 9vw, 160px);
}

/* 사이 띠: 원본의 검은 띠 자리. 탈출 카드가 사라진 뒤 귀환이 시작되게 띄운다 */
.gap { height: 60svh; }

/* 귀환 구간: 350svh 동안 안쪽 무대가 화면에 붙어 있다 (원본 service_container / service_sticky)
   카드 폭은 영상에서 잰 화면 폭 24%, 낮은 화면에선 세로 42svh에 맞춘다 */
.return {
  position: relative;
  height: 350svh;
  overflow-x: clip;
}
.return-stage {
  position: sticky;
  top: 0;
  height: 100svh;
  perspective: var(--persp, 1200px);
  --card-w: min(24vw, calc(42svh * 345 / 490));
}

/* 카드 한 줄: 무대 한가운데가 기준점, 카드마다 --slot 칸만큼 옆에 놓는다
   (--gap-ratio는 main.js가 timeline.js 상수로 넣는다 — 키프레임과 같은 값이어야 겹침이 맞는다) */
.card-row {
  position: absolute;
  left: 50%;
  top: 50%;
  transform-style: preserve-3d;
}
.slot {
  position: absolute;
  left: calc(var(--slot) * var(--card-w) * var(--gap-ratio, 1) - var(--card-w) / 2);
  top: calc(var(--card-w) * -245 / 345);
  transform-style: preserve-3d;
}
.float { transform-style: preserve-3d; }

/* 카드를 덮는 막: 스크롤하면 배경색으로 차오르며 카드가 사라진다 (원본 Part 01 끝) */
.veil {
  position: absolute;
  inset: 0;
  background: var(--bg-1);
  opacity: 0;
}

/* 미니카드 진행 표시 (원본 Part 2.1). 오른쪽 위는 조절 패널 자리라 오른쪽 아래에 둔다.
   --fill(0~1)까지 아래→위로 선명, 나머지는 35% 흐림. 덜 찬 만큼 --lift 아래에 있다 */
.tiny-cards {
  position: absolute;
  right: 24px;
  bottom: 24px;
  display: flex;
  gap: 8px;
}
.tiny-card {
  --fill: 0;
  --lift: 4px;
  width: 16px;
  aspect-ratio: 345 / 490;
  border-radius: 2px;
  background: var(--card-face);
  -webkit-mask-image: linear-gradient(to top, #000 calc(var(--fill) * 100%), rgba(0, 0, 0, 0.35) calc(var(--fill) * 100%));
  mask-image: linear-gradient(to top, #000 calc(var(--fill) * 100%), rgba(0, 0, 0, 0.35) calc(var(--fill) * 100%));
  transform: translate3d(0, var(--lift), 0);
}
```

- [ ] **Step 2: main.js**

```js
// FILE: demos/06-escape-flip/main.js
// ─────────────────────────────────────────────────────────────
// 06 탈출 & 뒤집기 — Eduard Bodak 포트폴리오의 "Flipping 3D cards on scroll"을 다시 만든 데모
// 원본처럼 CSS 3D + GSAP. 스크롤 위치를 구간 진행도(0~1)로 바꿔 멈춰둔 타임라인을 감는다.
// ─────────────────────────────────────────────────────────────
import { gsap } from 'gsap';
import Lenis from 'lenis';
import { scrollWindow, windowProgress, measureSection } from '../../shared/scroll-progress.js?v=1';
import { prefersReducedMotion } from '../../shared/motion.js?v=3';
import { createPanel, addSettingsButtons } from '../../shared/panel.js?v=2';
import {
  STAGGER, ESCAPE, RETURN, FLOAT, TUNE_DEFAULTS,
  escapeKeyframes, returnKeyframes, reducedEscapeKeyframes, reducedReturnKeyframes,
  veilOpacity, tinyFill,
} from './timeline.js?v=1';

const reduced = prefersReducedMotion();

const escapeSection = document.querySelector('.escape');
const returnSection = document.querySelector('.return');
const returnStage = returnSection.querySelector('.return-stage');
const escapeCards = [...escapeSection.querySelectorAll('.dom-card')];
const returnCards = [...returnSection.querySelectorAll('.dom-card')];
const veils = [...escapeSection.querySelectorAll('.veil')];
const tinyCards = [...returnSection.querySelectorAll('.tiny-card')];
const floats = [...document.querySelectorAll('.float')];

// 한 줄 간격은 키프레임(귀환 0% x)과 정확히 같아야 세 장이 가운데에 겹친다 → 같은 상수를 CSS로 넘긴다
escapeSection.style.setProperty('--gap-ratio', ESCAPE.gapRatio);
returnSection.style.setProperty('--gap-ratio', RETURN.gapRatio);

const params = structuredClone(TUNE_DEFAULTS);

// 부드러운 스크롤(Lenis). 동작 줄이기가 켜져 있으면 쓰지 않는다 (01·02·05와 같음)
const lenis = reduced ? null : new Lenis({ autoRaf: true, syncTouch: false });
const currentScroll = () => (lenis ? lenis.scroll : window.scrollY);

let escapeWindow = { start: 0, end: 1 };
let returnWindow = { start: 0, end: 1 };
let escapeTimeline = null;
let returnTimeline = null;

// 구간 위치를 잰다 (처음, 그리고 화면 크기가 바뀔 때)
function measure() {
  escapeWindow = scrollWindow(measureSection(escapeSection), ESCAPE.window);
  returnWindow = scrollWindow(measureSection(returnSection), RETURN.window);
}

// 원본 computeDesktopTimeline과 같은 순서:
// 진행도 기억 → 옛 타임라인 지우기 → 카드에 남은 변형 정리 → 새로 만들기 → 진행도 복원.
// 복원 전에 한 번 끝까지 감았다 돌아와서 모든 키프레임 시작값을 미리 기록한다
// (그래야 진행도 0일 때도 0% 자리에 바로 놓인다).
function finish(timeline, progress) {
  timeline.progress(1, true).progress(progress, true);
  return timeline;
}

function buildEscape() {
  const progress = escapeTimeline?.progress() ?? 0;
  escapeTimeline?.kill();
  gsap.set(escapeCards, { clearProps: 'transform,opacity' });
  const timeline = gsap.timeline({ paused: true });
  const sectionHeight = escapeSection.offsetHeight;
  escapeCards.forEach((card, index) => {
    const keyframes = reduced
      ? reducedEscapeKeyframes()
      : escapeKeyframes(index, { cardWidth: card.offsetWidth, cardHeight: card.offsetHeight, sectionHeight }, params);
    timeline.to(card, { force3D: true, keyframes }, index * STAGGER);
  });
  escapeTimeline = finish(timeline, progress);
}

function buildReturn() {
  const progress = returnTimeline?.progress() ?? 0;
  returnTimeline?.kill();
  gsap.set(returnCards, { clearProps: 'transform,opacity' });
  const timeline = gsap.timeline({ paused: true });
  const viewportHeight = returnStage.offsetHeight; // 100svh — 폰 주소창이 들락날락해도 안 흔들리게
  returnCards.forEach((card, index) => {
    const keyframes = reduced
      ? reducedReturnKeyframes()
      : returnKeyframes(index, { cardWidth: card.offsetWidth, viewportHeight }, params, () => gsap.getProperty(card, 'x'));
    timeline.to(card, { force3D: true, keyframes }, index * STAGGER);
  });
  returnTimeline = finish(timeline, progress);
}

// 스크롤할 때마다: 진행도 → 타임라인 감기, 막 불투명도, 미니카드 채움
function render() {
  const scroll = currentScroll();
  const escapeProgress = windowProgress(scroll, escapeWindow);
  const returnProgress = windowProgress(scroll, returnWindow);
  escapeTimeline?.progress(escapeProgress);
  returnTimeline?.progress(returnProgress);

  const veil = reduced ? 0 : veilOpacity(escapeProgress, params.veilStart);
  veils.forEach((element) => { element.style.opacity = veil; });

  tinyCards.forEach((element, index) => {
    const { fill, lift } = tinyFill(returnProgress, index);
    element.style.setProperty('--fill', fill);
    element.style.setProperty('--lift', `${lift}px`);
  });
}

// 둥실: 카드를 감싼 .float에 건다
// (원본은 카드에 직접 yPercent. 귀환 키프레임의 y "20%"와 겹치지 않게 감싸개로 분리 — 보이는 결과는 같음)
function startFloat() {
  gsap.killTweensOf(floats);
  gsap.set(floats, { clearProps: 'transform' });
  if (reduced || params.float === 0) return;
  floats.forEach((element) => {
    gsap.fromTo(element, { yPercent: -params.float }, {
      yPercent: params.float,
      duration: () => gsap.utils.random(FLOAT.durationMin, FLOAT.durationMax),
      ease: FLOAT.ease,
      repeat: -1,
      repeatRefresh: true,
      yoyo: true,
    });
  });
}

function applyPerspective() {
  document.documentElement.style.setProperty('--persp', `${params.perspective}px`);
}

function rebuild() {
  buildEscape();
  buildReturn();
  render();
}

function applyAll() {
  applyPerspective();
  rebuild();
  startFloat();
}

// 조절 패널
const gui = createPanel('06 탈출 & 뒤집기 · 조절 패널');
const motionFolder = gui.addFolder('움직임');
motionFolder.add(params, 'fanAngle', 0, 30, 1).name('부채꼴 각도 (°)').onChange(rebuild);
motionFolder.add(params, 'gather', 0, 1.1, 0.01).name('모이는 정도 (카드폭 배)').onChange(rebuild);
motionFolder.add(params, 'tilt', 0, 45, 1).name('눕는 각도 (°)').onChange(rebuild);
motionFolder.add(params, 'overshoot', 0, 30, 1).name('뒤집기 넘침 (°)').onChange(rebuild);
motionFolder.add(params, 'float', 0, 10, 0.5).name('둥실 세기 (%)').onChange(startFloat);
const spaceFolder = gui.addFolder('공간');
spaceFolder.add(params, 'perspective', 400, 3000, 50).name('원근 (px)').onChange(applyPerspective);
spaceFolder.add(params, 'veilStart', 0, 1, 0.01).name('사라짐 시작 (진행도)').onChange(render);
addSettingsButtons(gui, { params, defaults: TUNE_DEFAULTS, onApply: applyAll });

// 스크롤 · 크기 변경 연결
if (lenis) lenis.on('scroll', render);
else window.addEventListener('scroll', render, { passive: true });

let resizeFrame = 0;
window.addEventListener('resize', () => {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => {
    measure();
    rebuild();
  });
});

measure();
applyAll();
```

- [ ] **Step 3: index.html**

```html
<!-- FILE: demos/06-escape-flip/index.html -->
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>06 탈출 &amp; 뒤집기 · Card Archive</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/lenis@1.3.27/dist/lenis.css">
  <link rel="stylesheet" href="../../shared/tokens.css?v=2">
  <link rel="stylesheet" href="../../shared/base.css?v=4">
  <link rel="stylesheet" href="../../shared/dom-card.css?v=1">
  <link rel="stylesheet" href="./style.css?v=1">
  <script type="importmap">
  {
    "imports": {
      "gsap": "https://cdn.jsdelivr.net/npm/gsap@3.15.1/index.js",
      "lenis": "https://cdn.jsdelivr.net/npm/lenis@1.3.27/dist/lenis.mjs",
      "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.187.0/examples/jsm/"
    }
  }
  </script>
</head>
<body>
  <a class="back-link" href="../../">← 아카이브</a>

  <section class="escape" aria-label="라벤더·분홍·노랑 카드 세 장이 나란히 있다가, 스크롤하면 손에 쥔 카드처럼 부채꼴로 모이며 가라앉아 사라지는 장면">
    <div class="card-row">
      <div class="slot" style="--slot: -1"><div class="float"><div class="dom-card is-lavender">
        <div class="dom-card__face dom-card__face--front"><div class="veil"></div></div>
        <div class="dom-card__face dom-card__face--back"></div>
      </div></div></div>
      <div class="slot" style="--slot: 0"><div class="float"><div class="dom-card is-pink">
        <div class="dom-card__face dom-card__face--front"><div class="veil"></div></div>
        <div class="dom-card__face dom-card__face--back"></div>
      </div></div></div>
      <div class="slot" style="--slot: 1"><div class="float"><div class="dom-card is-yellow">
        <div class="dom-card__face dom-card__face--front"><div class="veil"></div></div>
        <div class="dom-card__face dom-card__face--back"></div>
      </div></div></div>
    </div>
    <div class="stage-caption">
      <p class="caption-index">06</p>
      <h1>탈출 &amp; 뒤집기</h1>
      <p>카드 세 장이 부채꼴로 모여 빠져나갔다가, 다시 날아와 한 줄로 뒤집혀.</p>
      <p class="caption-hint">스크롤해봐</p>
    </div>
  </section>

  <div class="gap" aria-hidden="true"></div>

  <!-- 귀환: DOM 순서 노랑·분홍·라벤더 (원본처럼 index 0이 오른쪽 자리, 마지막 라벤더가 맨 앞) -->
  <section class="return" aria-label="카드 세 장이 위에서 작게 날아와 겹쳐 쌓였다가, 옆으로 벌어지며 한 줄로 뒤집히는 장면">
    <div class="return-stage">
      <div class="card-row">
        <div class="slot" style="--slot: 1"><div class="float"><div class="dom-card is-yellow">
          <div class="dom-card__face dom-card__face--front"></div>
          <div class="dom-card__face dom-card__face--back"></div>
        </div></div></div>
        <div class="slot" style="--slot: 0"><div class="float"><div class="dom-card is-pink">
          <div class="dom-card__face dom-card__face--front"></div>
          <div class="dom-card__face dom-card__face--back"></div>
        </div></div></div>
        <div class="slot" style="--slot: -1"><div class="float"><div class="dom-card is-lavender">
          <div class="dom-card__face dom-card__face--front"></div>
          <div class="dom-card__face dom-card__face--back"></div>
        </div></div></div>
      </div>
      <div class="tiny-cards" aria-hidden="true">
        <div class="tiny-card is-lavender"></div>
        <div class="tiny-card is-pink"></div>
        <div class="tiny-card is-yellow"></div>
      </div>
    </div>
  </section>

  <main class="notes" id="notes">
    <section>
      <h2>이 데모에 쓴 기법</h2>
      <dl>
        <dt>손에 쥔 부채꼴로 빠져나가기</dt>
        <dd>나란히 있던 카드 세 장 중 바깥 두 장이 카드 폭의 0.9배만큼 가운데로 모이면서 −12° · 0° · 12°로 기울어, 손에 쥔 카드처럼 부채꼴이 돼. 그다음 아래로 가라앉으며 0.85배로 작아지고 뒤로 16° 누워. 세 장은 0.012만큼 시차를 두고 움직여서 한 몸처럼 보이지 않아. 마지막엔 카드 위에 배경색 막이 차오르며 사라져.</dd>
        <dt>다시 날아와 뒤집기</dt>
        <dd>다음 구간(화면 3.5장 높이) 동안 무대가 화면에 붙어 있어. 카드는 위에서 0.2배로 작게, 앞으로 24° 숙인 채 가운데에 겹쳐 나타나고, 진행도 40%에 0.8배로 내려앉아. 55%에 잠깐 멈췄다가 75%까지 옆으로 벌어져 한 줄이 되면서 190° 뒤집히고, 82%에 180°로 살짝 되돌아오며 착 멈춰. 넘쳤다 돌아오는 10°가 손맛이야.</dd>
        <dt>미니카드 진행 표시</dt>
        <dd>오른쪽 아래 미니카드 세 장이 귀환 구간 진행도 1/3마다 한 장씩 아래에서 위로 차올라. 안 찬 부분은 35%만 보이고, 다 차면 4px 위로 올라와. (원본은 오른쪽 위인데, 여기선 조절 패널 자리라 아래로 옮겼어.)</dd>
        <dt>둥실</dt>
        <dd>카드마다 위아래로 3%씩 둥실거려. 한 번 오르내리는 시간은 1.5~2.5초 사이에서 매번 새로 뽑아서 자연스러워.</dd>
        <dt>스크롤 진행도</dt>
        <dd>원본이 쓴 Locomotive Scroll v5의 계산식을 그대로 옮겼어. 첫 화면에 있는 탈출 구간은 스크롤 0에서 시작해 구간 아랫변이 화면 위에서 25% 내려온 순간 끝나고, 귀환 구간은 윗변이 화면 아래에서 5% 올라온 순간 시작해 아랫변이 화면 위에서 75% 내려온 순간 끝나. 이 0~1 값으로 멈춰둔 GSAP 타임라인을 감아.</dd>
        <dt>만드는 방식</dt>
        <dd>01~05와 달리 3D 엔진 없이, 웹페이지 요소를 CSS 3D로 돌려. 카드는 앞면·뒷면 두 장을 등 맞대 붙인 거라 뒤집으면 뒷면이 보여. 움직임은 원본과 같은 GSAP 키프레임이라 숫자가 그대로 옮겨졌어.</dd>
      </dl>
    </section>
    <section>
      <h2>참고한 곳</h2>
      <p>숫자와 원리만 공부했고, 코드는 가져오지 않았어.</p>
      <p><a href="https://tympanus.net/codrops/2025/07/29/built-to-move-a-closer-look-at-the-animations-behind-eduard-bodaks-portfolio/" target="_blank" rel="noopener">Built to Move</a> (Codrops, Eduard Bodak): 탈출·귀환 키프레임 숫자, 미니카드 진행 표시, 둥실.</p>
      <p><a href="https://www.eduardbodak.com/" target="_blank" rel="noopener">eduardbodak.com</a>: 원본 포트폴리오 (지금은 디자인이 바뀌었어).</p>
      <p><a href="https://scroll.locomotive.ca/" target="_blank" rel="noopener">Locomotive Scroll</a>: 스크롤 진행도 계산식.</p>
      <p><a href="https://gsap.com/" target="_blank" rel="noopener">GSAP</a>: 키프레임 애니메이션.</p>
      <p><a href="#">↑ 처음으로</a></p>
    </section>
  </main>

  <script type="module" src="./main.js?v=1"></script>
</body>
</html>
```

- [ ] **Step 4: 브라우저 확인**

로컬 서버(8123, 이미 떠 있음)에서 `http://127.0.0.1:8123/demos/06-escape-flip/` 열기.
확인 목록:
1. 콘솔 에러 0
2. 첫 화면: 카드 3장 한 줄, 둥실거림
3. 스크롤 → 바깥 두 장이 가운데로 모이며 부채꼴, 가라앉으며 뒤로 눕고 막에 덮여 사라짐
4. 귀환: 위에서 작게 겹쳐 등장 → 내려앉음 → 한 줄로 벌어지며 뒤집힘(뒷면 종이색) → 착
5. 미니카드 1/3씩 차오름
6. 영상(Codrops 04번)과 같은 진행도에서 비교: 마지막 줄이 화면 가운데쯤인지 (원본 `y "20%"`가 남는지)
7. 폰 크기(375×812)에서 같은 흐름, 가로 스크롤 없음
8. 패널 슬라이더가 바로 반영됨

---

### Task 4: 아카이브 연결 · 문서

**Files:**
- Modify: `index.html` (05 항목 다음, 소개 문구)
- Modify: `docs/superpowers/specs/2026-11-22-card-archive-bodak-design.md` (구현 결과 기록)

- [ ] **Step 1: 아카이브 목록에 06 추가**

`index.html`의 소개 문구 `1차는 3D 카드 5종이야.` → `1차는 3D 카드 5종, 2차는 Eduard Bodak 포트폴리오의 카드 연출이야.`

05 항목 `</li>` 다음에:

```html
      <li>
        <a class="demo-item" href="demos/06-escape-flip/">
          <span class="demo-index">06</span>
          <span class="demo-name">탈출 &amp; 뒤집기</span>
          <span class="demo-status">완성</span>
          <span class="demo-desc">카드 세 장이 부채꼴로 모여 빠져나갔다가, 다시 날아와 한 줄로 뒤집혀.</span>
        </a>
      </li>
```

- [ ] **Step 2: 전체 테스트 + 아카이브 화면 확인**

Run: `npm test`
Expected: 105개 통과, 실패 0
`http://127.0.0.1:8123/`에서 06 항목이 보이고 눌러서 열림.
