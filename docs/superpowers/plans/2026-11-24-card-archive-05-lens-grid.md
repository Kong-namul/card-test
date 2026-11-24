# 05 우주 표류 — 오목 렌즈 그리드 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 05 우주 표류를 Fiddle.Digital 그리드 보기처럼 "다이아몬드 9장 + 화면 가장자리 오목 렌즈 + 마우스 밀림·면 일렁임·등장"으로 바꾼다.

**Architecture:** 숫자 계산(배치·밀림·움직임 세기·등장·일렁임)은 `layout.js`, 렌즈 숫자는 `lens.js`에 Three.js 없이 두고 node 테스트로 확인한다. 렌즈 셰이더는 `lens-pass.js`(공통 `stage.addEffect`로 빛 번짐 다음·출력 직전), 면 일렁임은 05 전용 `glint-material.js`의 정점 셰이더에 더한다. `main.js`는 이것들을 매 프레임 연결한다.

**Tech Stack:** Three.js 0.187 (importmap), EffectComposer `ShaderPass`, Lenis, lil-gui, `node --test`.

## Global Constraints

- 설계: `docs/superpowers/specs/2026-11-24-card-archive-05-lens-grid-design.md`
- 레퍼 코드는 원리·숫자만, 복사 X. 셰이더는 우리 이름·주석으로 다시 쓴다.
- 공통 파일(`shared/*`)은 안 바꾼다. 필요해지면 먼저 사용자에게 묻는다.
- 바뀐 05 파일은 `?v=` 올린다: `layout.js?v=15`, `glint-material.js?v=3`, `main.js?v=19`, 새 `lens.js?v=1`, `lens-pass.js?v=1`.
- 주석·노트·사용자에게 보이는 글은 한국어 반말.
- 커밋·푸시는 사용자가 말할 때만 (계획의 "커밋" 단계 없음).

---

### Task 1: 배치·밀림·움직임 세기·등장·일렁임 숫자 (`layout.js`)

**Files:**
- Modify: `demos/05-cosmos/layout.js` (전체 다시 쓰기: 우표 배치·둥실·흔들림·settleIn·cssEase·깊이 어둠 삭제, 글레어 빛·별먼지는 그대로)
- Test: `tests/cosmos-layout.test.js` (전체 다시 쓰기)

**Interfaces — Produces:**
- `ROW_DEPTH = 16`, `LAYER_GAP = 0.05`, `CARD_RATIO = 490/345`
- `DIAMOND_CELLS: [x, y][]` (9칸, 1440×900에서 가운데에 가까운 순서)
- `GRID_FIT` 객체, `gridMetrics(widthPx, heightPx, cardScale=1) → { cardW, cardH, colStep, rowStep }` (px)
- `diamondLayout(widthPx, heightPx, count=9, cardScale=1) → { cardW, cardH, colStep, rowStep, cards: [{ cell, x, y }] }` (x·y: 화면 가운데 기준 px, 위가 +, 0번이 가운데에 가장 가까움)
- `INTRO`, `easeInOutQuart(t)`, `introScale(time) → 0.5~1`, `appearTime(rank) → 초`
- `PARALLAX`, `followPointer(current{x,y}, target{x,y}, following:boolean, dt) → {x,y}`, `parallaxOffset(card{x,y}, pointer{x,y}, view{width,height}, strength=2) → {x,y}` (px, 위가 +)
- `SPEED_SIGNAL`, `speedEnergy(current, screensPerSecond, dt) → 0~1`
- `RIPPLE`, `rippleClock(clock, dt)`, `rippleWeight(energy)`, `rippleHeight(u, v, time, seed, depth, weight)`
- 그대로: `GLINT_SWEEP`, `glintPosition(angle)`, `STAR_LAYERS`, `createStarLayer(count, seed, layer)`, `createStars(count, seed)`

- [ ] **Step 1: 테스트 먼저 (전체 교체)** — `tests/cosmos-layout.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../shared/random.js';
import {
  ROW_DEPTH, CARD_RATIO, DIAMOND_CELLS, gridMetrics, diamondLayout,
  INTRO, easeInOutQuart, introScale, appearTime, PARALLAX, followPointer, parallaxOffset,
  speedEnergy, RIPPLE, rippleClock, rippleWeight, rippleHeight,
  glintPosition, GLINT_SWEEP, createStars, STAR_LAYERS, createStarLayer,
} from '../demos/05-cosmos/layout.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const SIZES = [[1440, 900], [1920, 1080], [1280, 720], [1024, 768], [768, 1024], [375, 812]];

test('mulberry32 (공통 random.js): 같은 시드면 같은 순서, 0 이상 1 미만', () => {
  const a = mulberry32(5);
  const b = mulberry32(5);
  for (let i = 0; i < 50; i++) {
    const v = a();
    assert.equal(v, b());
    assert.ok(v >= 0 && v < 1);
  }
});

test('DIAMOND_CELLS: 레퍼 그리드 9칸 그대로, 가운데(2,2)는 비우고, 1440×900에서 가운데에 가까운 순서', () => {
  assert.equal(DIAMOND_CELLS.length, 9);
  const cells = new Set(DIAMOND_CELLS.map((c) => c.join(',')));
  for (const c of ['2,0', '3,0', '1,1', '4,1', '0,2', '3,2', '1,3', '4,3', '2,4']) assert.ok(cells.has(c), c);
  assert.ok(!cells.has('2,2'));
  const { cards } = diamondLayout(1440, 900);
  for (let i = 1; i < cards.length; i++) {
    assert.ok(Math.hypot(cards[i].x, cards[i].y) >= Math.hypot(cards[i - 1].x, cards[i - 1].y) - 1e-9, `${i}번 순서`);
  }
});

test('gridMetrics: 1440×900에서 레퍼 간격 식 그대로 — 카드 177×252px, 가로 한 칸 303px, 세로 한 칸 187px', () => {
  const m = gridMetrics(1440, 900);
  close(m.cardW, 1440 * 0.135 * (1 + (1440 / 1000 - 1) * -0.2), 1e-9);
  close(m.cardH, m.cardW * CARD_RATIO, 1e-9);
  close(m.colStep, 303.15, 0.05);
  close(m.rowStep, 186.67, 0.05); // 세로 배율은 최대 0.5로 묶인다
});

test('gridMetrics: 폭 768px 이하는 카드 폭 = 화면 폭 17% (레퍼는 이 폭에서 목록 보기라 우리가 정함)', () => {
  close(gridMetrics(375, 812).cardW, 375 * 0.17);
  close(gridMetrics(768, 1024).cardW, 768 * 0.17);
  assert.ok(gridMetrics(769, 1024).cardW < 769 * 0.17); // 넘으면 레퍼 13.5%
});

test('gridMetrics: 카드 크기 배율은 카드만 키우고 칸 간격은 그대로', () => {
  const base = gridMetrics(1440, 900);
  const big = gridMetrics(1440, 900, 1.3);
  close(big.cardW, base.cardW * 1.3);
  close(big.cardH, base.cardH * 1.3);
  close(big.colStep, base.colStep);
  close(big.rowStep, base.rowStep);
});

test('diamondLayout: 여러 화면에서 카드끼리 10px 넘게 떨어져 있고, 가로로는 화면 안에 다 들어온다', () => {
  for (const [w, h] of SIZES) {
    const { cards, cardW, cardH } = diamondLayout(w, h);
    for (let i = 0; i < cards.length; i++) {
      assert.ok(Math.abs(cards[i].x) + cardW / 2 <= w / 2, `${w}x${h} ${i}번 가로 넘침`);
      for (let j = i + 1; j < cards.length; j++) {
        const gapX = Math.abs(cards[i].x - cards[j].x) - cardW;
        const gapY = Math.abs(cards[i].y - cards[j].y) - cardH;
        assert.ok(Math.max(gapX, gapY) > 10, `${w}x${h} ${i}-${j} 틈 ${Math.max(gapX, gapY).toFixed(1)}`);
      }
    }
  }
});

test('diamondLayout: 칸 → 위치 (가운데 칸이 화면 가운데, 위 줄이 위쪽), 개수는 1~9로 가운데 가까운 것부터', () => {
  const layout = diamondLayout(1440, 900);
  const top = layout.cards.find((c) => c.cell[0] === 2 && c.cell[1] === 0);
  close(top.x, 0);
  close(top.y, 2 * layout.rowStep);
  const left = layout.cards.find((c) => c.cell[0] === 0 && c.cell[1] === 2);
  close(left.x, -2 * layout.colStep);
  close(left.y, 0);
  assert.equal(diamondLayout(1440, 900, 5).cards.length, 5);
  assert.deepEqual(diamondLayout(1440, 900, 5).cards, layout.cards.slice(0, 5));
  assert.equal(diamondLayout(1440, 900, 0).cards.length, 1);
  assert.equal(diamondLayout(1440, 900, 20).cards.length, 9);
});

test('introScale·appearTime: 레퍼 등장 — 0.5배에서 3.6초 동안 1배(easeInOutQuart), 카드는 0.3초 뒤부터 0.15초 간격', () => {
  assert.equal(INTRO.scaleFrom, 0.5);
  assert.equal(INTRO.duration, 3.6);
  close(introScale(0), 0.5);
  close(introScale(1.8), 0.75); // 대칭 이징이라 절반 시간에 절반
  close(introScale(3.6), 1);
  close(introScale(Infinity), 1); // 동작 줄이기: 처음부터 제 크기
  close(easeInOutQuart(0.25), 8 * 0.25 ** 4);
  close(easeInOutQuart(0.75), 1 - (-2 * 0.75 + 2) ** 4 / 2);
  let previous = 0;
  for (let t = 0; t <= 4; t += 0.1) {
    assert.ok(introScale(t) >= previous - 1e-9);
    previous = introScale(t);
  }
  close(appearTime(0), 0.3);
  close(appearTime(8), 0.3 + 0.15 * 8);
});

test('parallaxOffset: 커서 반대쪽으로 밀리고, 가운데에서 먼 카드일수록 많이, 최대 360px', () => {
  const view = { width: 1440, height: 900 };
  const half = Math.hypot(1440, 900) / 2;
  const still = parallaxOffset({ x: 300, y: 100 }, { x: 0, y: 0 }, view);
  close(still.x, 0);
  close(still.y, 0);
  const pointer = { x: 600, y: 0 };
  const center = parallaxOffset({ x: 0, y: 0 }, pointer, view);
  const edge = parallaxOffset({ x: 700, y: 0 }, pointer, view);
  assert.ok(center.x < 0 && edge.x < center.x); // 커서가 오른쪽이면 왼쪽으로, 가장자리 카드가 더 많이
  close(center.x, PARALLAX.maxOffsetPx * PARALLAX.strength * PARALLAX.minimumInfluence * (600 / half));
  close(parallaxOffset({ x: half, y: 0 }, { x: half, y: 0 }, view).x, -360);
  const up = parallaxOffset({ x: 0, y: 200 }, { x: 0, y: 300 }, view);
  assert.ok(up.y < 0 && Math.abs(up.x) < 1e-9); // 커서가 위면 아래로
  close(parallaxOffset({ x: 0, y: 0 }, pointer, view, 0).x, 0); // 세기 0이면 안 밀림
});

test('followPointer: 60fps 한 프레임에 남은 거리의 8%, 30fps면 두 프레임만큼', () => {
  close(followPointer({ x: 0, y: 0 }, { x: 100, y: -50 }, true, 1 / 60).x, 8);
  close(followPointer({ x: 0, y: 0 }, { x: 100, y: -50 }, true, 1 / 60).y, -4);
  close(followPointer({ x: 0, y: 0 }, { x: 100, y: 0 }, true, 1 / 30).x, 100 * (1 - 0.92 ** 2));
  close(followPointer({ x: 100, y: 0 }, { x: 0, y: 0 }, false, 1 / 60).x, 92); // 커서가 나가면 같은 빠르기로 돌아온다
});

test('speedEnergy: 느린 스크롤(데드존 45% 아래)은 0, 빠르면 1 가까이, 멈추면 0으로', () => {
  let energy = 0;
  for (let i = 0; i < 60; i++) energy = speedEnergy(energy, 0.5, 1 / 60);
  assert.equal(energy, 0);
  for (let i = 0; i < 60; i++) energy = speedEnergy(energy, 3, 1 / 60);
  assert.ok(energy > 0.9, `빠를 때 ${energy}`);
  for (let i = 0; i < 60; i++) energy = speedEnergy(energy, 0, 1 / 60);
  assert.equal(energy, 0);
});

test('RIPPLE: 레퍼 깊이 0.2662를 우리 카드 폭에 맞추고(×1.6/4.67), 시계는 초당 0.16, 가만히 있을 때 12%', () => {
  close(RIPPLE.depth, (0.2662 * 1.6) / 4.67);
  assert.equal(RIPPLE.spatialScale, 0.86);
  close(rippleClock(0, 1), 0.16);
  close(rippleClock(Math.PI * 2 - 0.06, 1), 0.1); // 한 바퀴(2π)를 넘으면 되돌린다
  close(rippleWeight(0), 0.12);
  close(rippleWeight(1), 1);
  close(rippleWeight(5), 1);
});

test('rippleHeight: 깊이×가중을 넘지 않고, 카드 테두리는 가운데보다 덜 움직인다', () => {
  let inner = 0;
  let border = 0;
  for (let time = 0; time < 6.3; time += 0.3) {
    for (let u = 0; u <= 1.0001; u += 0.05) {
      for (let v = 0; v <= 1.0001; v += 0.05) {
        const h = Math.abs(rippleHeight(u, v, time, 1.7, 1, 1));
        assert.ok(h <= 1 + 1e-9);
        const onBorder = u < 0.01 || u > 0.99 || v < 0.01 || v > 0.99;
        if (onBorder) border = Math.max(border, h);
        else if (u > 0.3 && u < 0.7 && v > 0.3 && v < 0.7) inner = Math.max(inner, h);
      }
    }
  }
  assert.ok(border < inner * 0.5, `테두리 ${border} · 가운데 ${inner}`);
  close(rippleHeight(0.4, 0.6, 1, 2, 0.1, 0.12), rippleHeight(0.4, 0.6, 1, 2, 1, 1) * 0.1 * 0.12);
});

test('glintPosition: 카메라와 카드 사이(z −3)에서 좌우 ±9·위아래 ±5.5 안으로 8자로 훑는다', () => {
  let minX = Infinity;
  let maxX = -Infinity;
  for (let a = 0; a < Math.PI * 20; a += 0.05) {
    const [x, y, z] = glintPosition(a);
    assert.equal(z, GLINT_SWEEP.z);
    assert.ok(z < 0 && z > -ROW_DEPTH);
    assert.ok(Math.abs(x) <= GLINT_SWEEP.x && Math.abs(y) <= GLINT_SWEEP.y);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
  }
  assert.ok(minX < -6 && maxX > 6);
});

test('createStars: 같은 시드면 같은 별, 카드보다 훨씬 뒤(거리 38~98) 넓은 상자 안, 크기 0.6~2.2px', () => {
  const stars = createStars(500, 5);
  assert.deepEqual(stars, createStars(500, 5));
  assert.equal(stars.length, 500);
  for (const s of stars) {
    assert.ok(Math.abs(s.x) <= 85 && Math.abs(s.y) <= 48);
    assert.ok(s.z <= -38 && s.z >= -98 && s.z < -ROW_DEPTH);
    assert.ok(s.size >= 0.6 && s.size <= 2.2);
  }
});

test('STAR_LAYERS: 먼 별은 카드 뒤, 카드 사이 먼지는 카드 거리에 걸쳐, 앞쪽 먼지는 카드 앞', () => {
  assert.ok(STAR_LAYERS.far.zNear > ROW_DEPTH);
  assert.ok(STAR_LAYERS.mid.zNear < ROW_DEPTH && STAR_LAYERS.mid.zFar > ROW_DEPTH);
  assert.ok(STAR_LAYERS.near.zFar < ROW_DEPTH);
  assert.ok(STAR_LAYERS.near.sizeMin > STAR_LAYERS.far.sizeMax - 1);
  for (const key of ['mid', 'near']) assert.ok(Math.hypot(...STAR_LAYERS[key].drift) > 0);
  assert.equal(Math.hypot(...STAR_LAYERS.far.drift), 0);
});

test('createStarLayer: 같은 시드면 같은 배치, 층의 상자·크기 범위 안', () => {
  for (const key of ['far', 'mid', 'near']) {
    const layer = STAR_LAYERS[key];
    const stars = createStarLayer(300, 9, layer);
    assert.deepEqual(stars, createStarLayer(300, 9, layer));
    for (const s of stars) {
      assert.ok(-s.z >= layer.zNear && -s.z <= layer.zFar);
      assert.ok(Math.abs(s.x) <= layer.halfX && Math.abs(s.y) <= layer.halfY);
      assert.ok(s.size >= layer.sizeMin && s.size <= layer.sizeMax);
    }
  }
});
```

- [ ] **Step 2: 실패 확인** — Run: `node --test tests/cosmos-layout.test.js` / Expected: FAIL (`DIAMOND_CELLS` 등 내보내기 없음)

- [ ] **Step 3: `demos/05-cosmos/layout.js` 전체 교체**

```js
// ─────────────────────────────────────────────────────────────
// layout.js — 05 우주 표류: 다이아몬드 그리드 배치·마우스 밀림·움직임 세기·등장·면 일렁임·빛 위치·별먼지
//   (Three.js 없이 숫자만)
// 배치·밀림·일렁임·등장 숫자: Fiddle.Digital Experiments Hub(exp.fiddle.digital) 그리드 보기의
//   실제 코드에서 읽은 값 (원리·숫자만, 코드는 안 가져옴)
// 반짝임 원리 참고(코드 X): 포켓몬 홀로 카드 CSS의 글레어, 포일 스티커 셰이더의 반짝이 알갱이
// ─────────────────────────────────────────────────────────────
import { clamp, smoothstep } from '../../shared/motion.js?v=3';
import { mulberry32 } from '../../shared/random.js?v=1';

const TAU = Math.PI * 2;
export const ROW_DEPTH = 16;          // 모든 카드가 같은 거리 (레퍼처럼 평평한 그리드 → 렌즈 휨이 깔끔)
export const LAYER_GAP = 0.05;        // 겹칠 때 깜빡이지 않게 순서(0 = 맨 앞)마다 이만큼씩 뒤로
export const CARD_RATIO = 490 / 345;  // 공통 종이 카드 세로 ÷ 가로

// 레퍼 그리드 칸 (x 0~4 왼→오, y 0~4 위→아래). 가운데 (2,2)는 비운다 (레퍼는 로고 자리).
// 순서는 1440×900에서 화면 가운데에 가까운 칸부터 → 0번이 더미 맨 앞, 먼저 나타남.
// (화면 크기마다 거리를 다시 재서 정렬하면 창 크기를 바꿀 때 카드 번호가 뒤바뀌어서 순서를 고정)
export const DIAMOND_CELLS = [
  [3, 2], [1, 1], [1, 3], [2, 0], [2, 4], [3, 0], [0, 2], [4, 1], [4, 3],
];

// 레퍼 grid.fit · cardSizeMultiplier · gapMultiplier 값. 바깥 카드 가장자리까지 화면 폭 98%·높이 82%에 펼친다
export const GRID_FIT = {
  width: 0.98,
  height: 0.82,
  cardWidth: 0.135,                                                     // 카드 폭 = 화면 폭 13.5% × 크기 배율
  size: { referencePx: 1000, strength: -0.2, min: -3, max: 3 },
  gapX: { referencePx: 1024, strength: -0.1, min: -100, max: 100 },
  gapY: { referencePx: 640, strength: -0.5, min: -1, max: 0.5 },
  narrowPx: 768,          // 레퍼는 이 폭 이하에서 그리드 대신 목록 → 카드 크기는 우리가 정함
  narrowCardWidth: 0.17,  // 13.5%면 폰에서 너무 작고, 20%면 같은 줄 옆 칸(2,0)·(3,0)이 겹친다
};

// 화면 크기에 따라 1에서 조금씩 바뀌는 배율 (레퍼 식): 1 + (크기 ÷ 기준 − 1) × 세기, 범위 안으로
const sizeMultiplier = (sizePx, { referencePx, strength, min, max }) => clamp(1 + (sizePx / referencePx - 1) * strength, min, max);

// 카드 크기와 칸 간격 (px). 간격은 크기 배율 1 기준 카드로 정하고, cardScale은 카드만 키운다
export function gridMetrics(widthPx, heightPx, cardScale = 1) {
  const fit = GRID_FIT;
  const baseW = widthPx <= fit.narrowPx
    ? widthPx * fit.narrowCardWidth
    : widthPx * fit.cardWidth * sizeMultiplier(widthPx, fit.size);
  const baseH = baseW * CARD_RATIO;
  // 한 칸 = 카드 + 틈. 틈 = (차지할 넓이 − 카드)/4 − 카드 → 바깥 카드 가장자리까지 넓이 안에 (음수면 이웃 줄과 엇갈려 겹침)
  const colStep = baseW + ((fit.width * widthPx - baseW) / 4 - baseW) * sizeMultiplier(widthPx, fit.gapX);
  const rowStep = baseH + ((fit.height * heightPx - baseH) / 4 - baseH) * sizeMultiplier(heightPx, fit.gapY);
  return { cardW: baseW * cardScale, cardH: baseH * cardScale, colStep, rowStep };
}

// 다이아몬드 배치: 칸 → 화면 가운데 기준 px (위가 +). count장만 가운데 가까운 칸부터
export function diamondLayout(widthPx, heightPx, count = DIAMOND_CELLS.length, cardScale = 1) {
  const metrics = gridMetrics(widthPx, heightPx, cardScale);
  const n = clamp(Math.round(count), 1, DIAMOND_CELLS.length);
  const cards = DIAMOND_CELLS.slice(0, n).map(([cx, cy]) => ({
    cell: [cx, cy],
    x: (cx - 2) * metrics.colStep,
    y: (2 - cy) * metrics.rowStep,
  }));
  return { ...metrics, cards };
}

// 등장 (레퍼 intro): 묶음 전체가 화면 가운데 기준 0.5배에서 3.6초 동안 1배로 (easeInOutQuart),
// 카드는 0.3초 뒤부터 0.15초 간격으로 바로 나타난다 (나타나는 데 걸리는 시간 0)
export const INTRO = { scaleFrom: 0.5, duration: 3.6, appearDelay: 0.3, appearStagger: 0.15 };

export function easeInOutQuart(t) {
  const x = clamp(t, 0, 1);
  return x < 0.5 ? 8 * x ** 4 : 1 - (-2 * x + 2) ** 4 / 2;
}

export function introScale(time) {
  return INTRO.scaleFrom + (1 - INTRO.scaleFrom) * easeInOutQuart(time / INTRO.duration);
}

export function appearTime(rank) {
  return INTRO.appearDelay + INTRO.appearStagger * rank;
}

// 마우스 밀림 (레퍼 grid.cardParallax): 카드가 커서 반대쪽으로 밀린다(최대 −180px × 세기 2).
// 가운데에서 먼 카드일수록 많이(√거리, 최소 10%), 커서가 가운데에서 멀수록 많이. 커서는 한 프레임에 8%씩 따라간다
export const PARALLAX = {
  maxOffsetPx: -180,
  strength: 2,
  minimumInfluence: 0.1,
  centerInfluencePower: 0.5,
  followLerp: 0.08,
  returnLerp: 0.08,
};

// 커서 위치(화면 가운데 기준 px)를 천천히 따라간다. 60fps 한 프레임 기준 비율을 dt에 맞춰 바꾼다
export function followPointer(current, target, following, dt) {
  const rate = following ? PARALLAX.followLerp : PARALLAX.returnLerp;
  const t = 1 - Math.pow(1 - clamp(rate, 0, 1), dt * 60);
  return { x: current.x + (target.x - current.x) * t, y: current.y + (target.y - current.y) * t };
}

// card: 카드 자리, pointer: 따라간 커서 (둘 다 화면 가운데 기준 px, 위가 +) → 카드가 밀릴 px
export function parallaxOffset(card, pointer, view, strength = PARALLAX.strength) {
  const reach = Math.hypot(pointer.x, pointer.y);
  const halfDiagonal = Math.hypot(view.width, view.height) / 2;
  if (reach === 0 || halfDiagonal === 0) return { x: 0, y: 0 };
  const pointerAmount = Math.min(1, reach / halfDiagonal);
  const cardDistance = Math.min(1, Math.hypot(card.x, card.y) / halfDiagonal);
  const influence = PARALLAX.minimumInfluence
    + (1 - PARALLAX.minimumInfluence) * Math.pow(cardDistance, PARALLAX.centerInfluencePower);
  const amount = PARALLAX.maxOffsetPx * strength * influence * pointerAmount;
  return { x: (pointer.x / reach) * amount, y: (pointer.y / reach) * amount };
}

// 움직임 세기 (레퍼 speed 신호): 스크롤 빠르기(화면/초)를 0~1로. 1.5화면/초를 1로 본다(우리가 정한 기준).
// 데드존 45% 아래는 0, 세제곱으로 올라가고, 올라갈 땐 초당 8 · 내려갈 땐 6 · 멈추면 16 빠르기로 따라간다
export const SPEED_SIGNAL = {
  fullSpeed: 1.5,
  deadZone: 0.45,
  buildExponent: 3,
  attackRate: 8,
  releaseRate: 6,
  settleRate: 16,
  restSpeed: 0.001,
};

export function speedEnergy(current, screensPerSecond, dt) {
  const s = SPEED_SIGNAL;
  const ratio = clamp(Math.abs(screensPerSecond) / s.fullSpeed, 0, 1);
  const target = Math.pow(clamp((ratio - s.deadZone) / (1 - s.deadZone), 0, 1), s.buildExponent);
  let rate = s.releaseRate;
  if (target > current) rate = s.attackRate;
  else if (Math.abs(screensPerSecond) < s.restSpeed) rate = s.settleRate;
  const next = current + (target - current) * (1 - Math.exp(-rate * dt));
  return next < 5e-4 ? 0 : next;
}

// 카드 면 일렁임 (레퍼 cardMotion.idle): 두 물결이 엇갈려 지나가며 카드 면이 깊이 방향으로 아주 살짝.
// 깊이 0.2662는 레퍼 카드 폭 4.67 기준 → 우리 카드 폭 1.6에 맞춰 줄인다. 시계는 초당 0.16, 가만히 있을 땐 12%
export const RIPPLE = { depth: (0.2662 * 1.6) / 4.67, spatialScale: 0.86, speed: 0.16, restWeight: 0.12 };

export function rippleClock(clock, dt) {
  return (clock + dt * RIPPLE.speed) % TAU;
}

export function rippleWeight(energy) {
  return RIPPLE.restWeight + (1 - RIPPLE.restWeight) * clamp(energy, 0, 1);
}

// 셰이더(glint-material.js)와 같은 식. u·v: 카드 위 위치 0~1, seed: 카드마다 다른 시작 위상
export function rippleHeight(u, v, time, seed, depth, weight) {
  const px = u - 0.5;
  const py = v - 0.5;
  const waveA = Math.sin((px * 3.1 + py * 1.7) * RIPPLE.spatialScale + time + seed);
  const waveB = Math.sin((px * -1.35 + py * 3.75) * RIPPLE.spatialScale - time * 2 + seed * 1.61803398875);
  const field = waveA * 0.68 + waveB * 0.32;
  const edge = (t) => smoothstep(0, 0.16, t);
  const interior = edge(u) * edge(1 - u) * edge(v) * edge(1 - v);
  const steady = 0.32 + (1 - 0.32) * interior; // 테두리 16% 안쪽은 0.32배까지 덜 움직인다
  return field * steady * (1 - 0.3 * (px * px + py * py)) * depth * weight;
}

// 글레어 빛 위치: 카메라 바로 앞(z −3)에서 카드들 앞을 8자(리사주)로 훑는 작은 전구.
// 처음엔 아주 먼 곳의 평행한 빛(방향)으로 했더니, 평평한 카드는 어디서나 같은 각도로 반사해서
// 각도가 맞으면 카드 전체가 통째로 하얗게 터졌다. 가까운 전구는 카드 위치마다 빛이 오는 방향이 달라서
// 반사가 "빛 점"으로 맺히고, 전구가 움직이면 빛 점이 카드 위를 쓱 지나간다 (거울에 비친 손전등 원리).
//   angle: 0→2π가 한 바퀴
export const GLINT_SWEEP = { x: 9, y: 5.5, z: -3 };
export function glintPosition(angle) {
  return [Math.sin(angle) * GLINT_SWEEP.x, Math.sin(angle * 0.7 + 1) * GLINT_SWEEP.y, GLINT_SWEEP.z];
}

// 별먼지 3겹 (깊이감): 먼 별 · 카드 사이 먼지 · 카메라 바로 앞 먼지.
//   zNear·zFar: 카메라에서의 거리 범위, halfX·halfY: 퍼지는 반폭 (그 거리에서 화면 밖까지 덮게, 화면비 2.4 기준),
//   sizeMin·sizeMax: 화면 픽셀 크기, drift: 초당 떠다니는 양 (상자를 넘으면 반대편에서 다시 나온다), opacity: 밝기
//   가까운 먼지일수록 크고 흐릿하고 빨리 지나가서 깊이감이 난다. 화면 가장자리에선 렌즈를 따라 같이 휜다
export const STAR_LAYERS = {
  far: { zNear: 38, zFar: 98, halfX: 85, halfY: 48, sizeMin: 0.6, sizeMax: 2.2, drift: [0, 0, 0], opacity: 0.85 },
  mid: { zNear: 8, zFar: 30, halfX: 28, halfY: 13, sizeMin: 0.5, sizeMax: 1.6, drift: [0.05, 0.1, 0], opacity: 0.6 },
  near: { zNear: 2, zFar: 7, halfX: 7.5, halfY: 4, sizeMin: 2.5, sizeMax: 5, drift: [0.08, 0.18, 0], opacity: 0.3 },
};

// 한 겹의 별먼지: 상자 안에 흩뿌린 점 (대부분 작고 가끔 큰 점). phase·speed: 점마다 다른 깜빡임 박자
export function createStarLayer(count, seed, layer) {
  const random = mulberry32(seed);
  const stars = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: (random() * 2 - 1) * layer.halfX,
      y: (random() * 2 - 1) * layer.halfY,
      z: -(layer.zNear + random() * (layer.zFar - layer.zNear)),
      size: layer.sizeMin + Math.pow(random(), 3) * (layer.sizeMax - layer.sizeMin),
      phase: random() * TAU,
      speed: 0.6 + random() * 1.6,
    });
  }
  return stars;
}

// 먼 별 (예전 이름 그대로)
export function createStars(count, seed) {
  return createStarLayer(count, seed, STAR_LAYERS.far);
}
```

- [ ] **Step 4: 통과 확인** — Run: `node --test tests/cosmos-layout.test.js` / Expected: PASS 16개

---

### Task 2: 렌즈 숫자 (`lens.js`)

**Files:**
- Create: `demos/05-cosmos/lens.js`
- Test: `tests/cosmos-lens.test.js`

**Interfaces — Produces:**
- `LENS = { glassRadius, refraction, dispersion, distortion, motionBoost, edgeOffset }`, `LENS_NARROW_PX = 1024`
- `lensConfig(widthPx, base = LENS) → 같은 모양 객체` (1024px 이하면 전부 ×0.5)
- `lensSample(u, v, aspect, config, distortion = config.distortion) → { u, v, mask }` (셰이더와 같은 식, 화면 uv 0~1)

- [ ] **Step 1: 테스트 먼저** — `tests/cosmos-lens.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LENS, LENS_NARROW_PX, lensConfig, lensSample } from '../demos/05-cosmos/lens.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('LENS: 레퍼 LiquidGlass 데스크톱 값 그대로', () => {
  assert.deepEqual(LENS, { glassRadius: 0.35, refraction: 1.3, dispersion: 0.004, distortion: 0.32, motionBoost: 0.2, edgeOffset: 0.09 });
  assert.equal(LENS_NARROW_PX, 1024);
});

test('lensConfig: 폭 1024px 이하면 전부 절반, 넘으면 그대로', () => {
  assert.deepEqual(lensConfig(1440), LENS);
  const narrow = lensConfig(1024);
  for (const key of Object.keys(LENS)) close(narrow[key], LENS[key] / 2);
  close(lensConfig(375, { ...LENS, refraction: 2 }).refraction, 1); // 패널에서 바꾼 값도 절반
});

test('lensSample: 화면 가운데 쪽은 그대로, 가장자리 띠에서만 옮긴다', () => {
  const aspect = 1.6;
  const middle = lensSample(0.5, 0.5, aspect, LENS);
  close(middle.u, 0.5);
  close(middle.v, 0.5);
  assert.equal(middle.mask, 0);
  const clean = lensSample(0.36, 0.62, aspect, LENS); // 좌우 띠(0.35×1.6 = 0.56)·위아래 띠(0.35) 밖
  close(clean.u, 0.36);
  close(clean.v, 0.62);
  const edge = lensSample(0.02, 0.5, aspect, LENS);
  assert.ok(edge.mask > 0.5);
  assert.ok(edge.u > 0.02 + 0.01, `왼쪽 끝은 가운데 쪽 그림을 끌어온다 ${edge.u}`);
  close(edge.v, 0.5);
});

test('lensSample: 좌우·위아래 대칭이고, 늘림을 키우면(빠른 스크롤) 더 많이 옮긴다', () => {
  const aspect = 1.6;
  const left = lensSample(0.02, 0.5, aspect, LENS);
  const right = lensSample(0.98, 0.5, aspect, LENS);
  close(right.u, 1 - left.u);
  const bottom = lensSample(0.5, 0.03, aspect, LENS);
  const top = lensSample(0.5, 0.97, aspect, LENS);
  close(top.v, 1 - bottom.v);
  const boosted = lensSample(0.02, 0.5, aspect, LENS, LENS.distortion + LENS.motionBoost);
  assert.ok(boosted.u > left.u);
});
```

- [ ] **Step 2: 실패 확인** — Run: `node --test tests/cosmos-lens.test.js` / Expected: FAIL (모듈 없음)

- [ ] **Step 3: `demos/05-cosmos/lens.js` 만들기**

```js
// ─────────────────────────────────────────────────────────────
// lens.js — 05 우주 표류: 화면 가장자리 오목 렌즈 숫자 (Three.js 없이). 셰이더는 lens-pass.js, 식은 같다
//   레퍼: Fiddle.Digital Experiments Hub의 LiquidGlassShader 데스크톱 값 (원리·숫자만, 코드는 안 가져옴)
//   네 가장자리 띠에서만 그림을 옮긴다: 가장자리 쪽으로 살짝 흘리기(굴절) + 가운데 기준으로 늘리기(왜곡).
//   화면 가운데는 그대로라 카드가 반듯하고, 가장자리 카드만 늘어나며 굽는다
// ─────────────────────────────────────────────────────────────
import { clamp, smoothstep } from '../../shared/motion.js?v=3';

export const LENS = {
  glassRadius: 0.35,  // 위아래 띠 폭 (화면 높이 비율). 좌우 띠는 1.6배
  refraction: 1.3,    // 유리 테두리에서 꺾이는 정도
  dispersion: 0.004,  // 색 번짐 (빨강·파랑이 엇갈려 무지개 테두리)
  distortion: 0.32,   // 가운데 기준 늘림
  motionBoost: 0.2,   // 빠르게 움직일 때 늘림에 더하는 양
  edgeOffset: 0.09,   // 띠가 화면 밖에서부터 시작하는 여유
};
export const LENS_NARROW_PX = 1024; // 이 폭 이하는 전부 절반 (레퍼 모바일 값)

export function lensConfig(widthPx, base = LENS) {
  if (widthPx > LENS_NARROW_PX) return { ...base };
  return Object.fromEntries(Object.entries(base).map(([key, value]) => [key, value * 0.5]));
}

// 네 가장자리 띠 (왼·오·아래·위): 가장자리에서 0, 띠 안쪽 끝부터 1. 좌우는 화면비만큼 늘려 재고 1.6배 넓게
function edgeBands(u, v, aspect, radius, offset) {
  const wide = radius * 1.6;
  return [
    smoothstep(-offset, wide, u * aspect),
    smoothstep(-offset, wide, (1 - u) * aspect),
    smoothstep(-offset, radius, v),
    smoothstep(-offset, radius, 1 - v),
  ];
}

// 화면 uv(0~1, 아래가 0) → 이 픽셀이 그림을 가져올 자리. mask 0이면 그대로
export function lensSample(u, v, aspect, config, distortion = config.distortion) {
  const [left, right, bottom, top] = edgeBands(u, v, aspect, config.glassRadius, config.edgeOffset);
  const mask = 1 - left * right * bottom * top;
  if (mask < 1e-4) return { u, v, mask: 0 };
  // 가장자리에서 가운데로 향하는 방향
  let inX = (1 - left) - (1 - right);
  let inY = (1 - bottom) - (1 - top);
  const length = Math.hypot(inX, inY);
  if (length > 1e-4) {
    inX /= length;
    inY /= length;
  } else {
    inX = 0;
    inY = 0;
  }
  const flow = Math.sin(mask * Math.PI) * config.refraction * 0.015;
  const cx = u - 0.5;
  const cy = v - 0.5;
  const r2 = cx * cx + cy * cy;
  return {
    u: clamp(u + (-inX * flow - cx * r2 * distortion) * mask, 0, 1),
    v: clamp(v + (-inY * flow - cy * r2 * distortion) * mask, 0, 1),
    mask,
  };
}
```

- [ ] **Step 4: 통과 확인** — Run: `node --test tests/cosmos-lens.test.js` / Expected: PASS 4개

---

### Task 3: 렌즈 후처리 셰이더 (`lens-pass.js`)

**Files:**
- Create: `demos/05-cosmos/lens-pass.js`

**Interfaces:**
- Consumes: `LENS` (lens.js)
- Produces: `createLensPass() → { pass: ShaderPass, update({ width, height, config, distortion, enabled }) }` (width·height: 그림판 실제 픽셀)

- [ ] **Step 1: 만들기** (node 테스트 대상 아님 — three를 쓴다. Task 7 브라우저에서 확인)

```js
// ─────────────────────────────────────────────────────────────
// lens-pass.js — 05 우주 표류: 화면 가장자리 오목 렌즈 후처리
//   다 그린 화면을 한 장의 그림으로 받아, 가장자리 띠에서만 "어디서 가져올지"를 옮겨 휘어 보이게 한다.
//   식은 lens.js(lensSample)와 같다. 레퍼: Fiddle.Digital LiquidGlassShader — 원리·숫자만, 셰이더는 우리 식으로 다시 씀.
//   색 번짐: 빨강은 가장자리 쪽, 파랑은 반대쪽으로 조금씩 엇갈려 가져와서 가장자리에 무지개 테두리가 생긴다
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { LENS } from './lens.js?v=1';

const LensShader = {
  uniforms: {
    tDiffuse: { value: null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uGlassRadius: { value: LENS.glassRadius },
    uRefraction: { value: LENS.refraction },
    uDistortion: { value: LENS.distortion },
    uDispersion: { value: LENS.dispersion },
    uEdgeOffset: { value: LENS.edgeOffset },
  },
  vertexShader: `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
  fragmentShader: `
uniform sampler2D tDiffuse;
uniform vec2 uResolution;
uniform float uGlassRadius;
uniform float uRefraction;
uniform float uDistortion;
uniform float uDispersion;
uniform float uEdgeOffset;
varying vec2 vUv;

const float PI = 3.14159265;

// 네 가장자리 띠 (왼·오·아래·위): 가장자리에서 0, 띠 안쪽 끝부터 1. 좌우는 화면비만큼 늘려 재고 1.6배 넓게
vec4 edgeBands(vec2 uv, float aspect, float radius, float offset) {
  float wide = radius * 1.6;
  return vec4(
    smoothstep(-offset, wide, uv.x * aspect),
    smoothstep(-offset, wide, (1.0 - uv.x) * aspect),
    smoothstep(-offset, radius, uv.y),
    smoothstep(-offset, radius, 1.0 - uv.y));
}

void main() {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec4 band = edgeBands(vUv, aspect, uGlassRadius, uEdgeOffset);
  float mask = 1.0 - band.x * band.y * band.z * band.w; // 0 = 가운데(그대로), 1에 가까울수록 가장자리
  if (mask < 0.0001) {
    gl_FragColor = texture2D(tDiffuse, vUv);
    return;
  }

  // 가장자리에서 가운데로 향하는 방향
  vec2 inward = vec2((1.0 - band.x) - (1.0 - band.y), (1.0 - band.z) - (1.0 - band.w));
  float inwardLength = length(inward);
  inward = inwardLength > 0.0001 ? inward / inwardLength : vec2(0.0);

  vec2 flow = -inward * sin(mask * PI) * uRefraction * 0.015;            // 유리 테두리에서 꺾이는 빛
  vec2 fromCenter = vUv - 0.5;
  vec2 stretch = fromCenter * dot(fromCenter, fromCenter) * uDistortion; // 가장자리로 갈수록 크게 늘림
  vec2 texel = 1.0 / uResolution;
  vec2 sampleUv = clamp(vUv + (flow - stretch) * mask, texel * 2.0, 1.0 - texel * 2.0);

  // 색 번짐: 절반 폭 띠 안에서, 띠 속 위치에 따라 부풀었다 줄어드는 세기로 빨강·파랑을 엇갈려 가져온다
  float thinRadius = uGlassRadius * 0.5;
  vec4 thin = edgeBands(vUv, aspect, thinRadius, uEdgeOffset * 0.5);
  float thinMask = 1.0 - thin.x * thin.y * thin.z * thin.w;
  float wideThin = thinRadius * 1.6;
  vec2 wave = vec2(
    sin(clamp(vUv.x * aspect / wideThin, 0.0, 1.0) * PI) * (1.0 - thin.x)
      - sin(clamp((1.0 - vUv.x) * aspect / wideThin, 0.0, 1.0) * PI) * (1.0 - thin.y),
    sin(clamp(vUv.y / thinRadius, 0.0, 1.0) * PI) * (1.0 - thin.z)
      - sin(clamp((1.0 - vUv.y) / thinRadius, 0.0, 1.0) * PI) * (1.0 - thin.w));
  vec2 split = wave * uDispersion * (0.35 + thinMask * 0.65);

  gl_FragColor = vec4(
    texture2D(tDiffuse, sampleUv + split).r,
    texture2D(tDiffuse, sampleUv).g,
    texture2D(tDiffuse, sampleUv - split).b,
    1.0);
}`,
};

export function createLensPass() {
  const pass = new ShaderPass(LensShader);
  const u = pass.uniforms;
  return {
    pass,
    // 매 프레임: 그림판 크기와 렌즈 값(좁은 화면이면 절반)·늘림(빠른 스크롤이면 더)을 넘긴다
    update({ width, height, config, distortion, enabled }) {
      pass.enabled = enabled;
      u.uResolution.value.set(width, height);
      u.uGlassRadius.value = config.glassRadius;
      u.uRefraction.value = config.refraction;
      u.uDistortion.value = distortion;
      u.uDispersion.value = config.dispersion;
      u.uEdgeOffset.value = config.edgeOffset;
    },
  };
}
```

---

### Task 4: 카드 면 일렁임 (`glint-material.js`)

**Files:**
- Modify: `demos/05-cosmos/glint-material.js` — uniforms 4개 추가, 정점 셰이더 덧붙이기

**Interfaces — Produces:** `addGlint(material)`이 돌려주는 uniforms에 `uRippleTime`, `uRippleDepth`, `uRippleWeight`, `uRippleScale` 추가 (기존 이름 그대로)

- [ ] **Step 1: uniforms에 추가** (`uTime` 아래)

```js
    // 면 일렁임 (레퍼 cardMotion.idle, layout.js rippleHeight와 같은 식)
    uRippleTime: { value: 0 },
    uRippleDepth: { value: 0 },   // 카드 단위 깊이 (모이면 0)
    uRippleWeight: { value: 0.12 },
    uRippleScale: { value: 0.86 },
```

- [ ] **Step 2: `baseCompile(shader, renderer); Object.assign(...)` 바로 다음에 정점 셰이더 덧붙이기.** 공통 재질은 `#include <begin_vertex>` 바로 뒤에 휨·뒤집기를 넣으니, 그 사이(휨·뒤집기 전, 카드 평면 기준)에 넣는다. `uCardWidth`·`uCardHeight`는 공통 재질이 이미 선언.

```js
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
uniform float uRippleTime;
uniform float uRippleDepth;
uniform float uRippleWeight;
uniform float uRippleScale;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
{
  // 카드 위 위치 0~1 (휨은 z만 바꾸니 x·y는 평평한 카드 기준)
  vec2 cardUv = position.xy / vec2(uCardWidth, uCardHeight) + 0.5;
  vec2 p = cardUv - 0.5;
  float seed = fract(sin(float(gl_InstanceID) * 12.9898) * 43758.5453) * 6.28318530718; // 카드마다 다른 시작 위상
  float waveA = sin(dot(p, vec2(3.1, 1.7)) * uRippleScale + uRippleTime + seed);
  float waveB = sin(dot(p, vec2(-1.35, 3.75)) * uRippleScale - uRippleTime * 2.0 + seed * 1.61803398875);
  float field = waveA * 0.68 + waveB * 0.32;
  float interior = smoothstep(0.0, 0.16, cardUv.x) * smoothstep(0.0, 0.16, 1.0 - cardUv.x)
    * smoothstep(0.0, 0.16, cardUv.y) * smoothstep(0.0, 0.16, 1.0 - cardUv.y);
  float steady = mix(0.32, 1.0, interior); // 테두리는 덜 움직인다
  transformed.z += field * steady * (1.0 - 0.3 * dot(p, p)) * uRippleDepth * uRippleWeight;
}`);
```

- [ ] **Step 3: 파일 머리 주석에 한 줄 추가** — `//   면 일렁임 : 두 물결이 엇갈려 지나가며 카드 면이 깊이 방향으로 살짝 (레퍼 Fiddle.Digital, 원리만). 식은 layout.js rippleHeight`

---

### Task 5: `main.js` 연결·패널

**Files:**
- Modify: `demos/05-cosmos/main.js` (머리 주석, import, 상수, DEFAULTS, buildField, 패널, frame 전체)

**Interfaces — Consumes:** Task 1~4의 이름 그대로.

- [ ] **Step 1: 머리 주석·import·상수 교체**

```js
// ─────────────────────────────────────────────────────────────
// 05 우주 표류 — 별먼지 속에 종이 카드 9장이 다이아몬드 그리드로 떠 있고, 화면 가장자리가 오목 렌즈처럼 휜다.
// 배치·렌즈·움직임 레퍼: Fiddle.Digital Experiments Hub 그리드 보기 (실제 코드에서 원리·숫자만 읽음, 코드는 안 가져옴)
//   마우스를 움직이면 카드가 커서 반대쪽으로 밀리고(가장자리 카드일수록 많이), 카드 면은 아주 살짝 일렁인다.
// 보이지 않는 빛이 훑고 지나갈 때 카드가 번쩍인다 (글레어. 반짝이 알갱이·빛 번짐은 기본 끔).
// 스크롤하면 01·02와 같은 "하나로 모이기" 연출: 흩어진 카드 → 한 더미 → 한 장 → 물결 뒤집기 → 정리
// 반짝임 원리 참고(코드 X): 포켓몬 홀로 카드 CSS 글레어 · 포일 스티커 셰이더 알갱이 · Ziggy 카드
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import Lenis from 'lenis';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { createStage, showWebGLFallback, readToken } from '../../shared/stage.js?v=6';
import { createCardMaterial, syncMaterial, setCornerRadius } from '../../shared/card-material.js?v=8';
import { createCardInstances } from '../../shared/card-geometry.js?v=3';
import { lerp, easeInOutCubic, prefersReducedMotion } from '../../shared/motion.js?v=3';
import { scrollStages, stackSlot, stackIndexFromRank, STACK_LOOK } from '../../shared/stack-choreography.js?v=3';
import { DEFAULT_PRESET, presetToParams } from '../../shared/texture-presets.js?v=1';
import { createPanel, addSettingsButtons } from '../../shared/panel.js?v=2';
import { addTextureFolder } from '../../shared/texture-panel.js?v=6';
import {
  ROW_DEPTH, LAYER_GAP, DIAMOND_CELLS, diamondLayout, introScale, appearTime, PARALLAX, followPointer, parallaxOffset,
  speedEnergy, RIPPLE, rippleClock, rippleWeight, glintPosition, STAR_LAYERS, createStarLayer,
} from './layout.js?v=15';
import { LENS, lensConfig } from './lens.js?v=1';
import { createLensPass } from './lens-pass.js?v=1';
import { addGlint } from './glint-material.js?v=3';
import { createStarDust } from './stars.js?v=2';

const CARD_W = 1.6;                    // 01~04와 같은 카드 (Grail 비율 1.42)
const CARD_H = CARD_W * (490 / 345);
// 모서리: Grail 비율(R 20/345)의 1.5배. 카드가 화면에서 작게 보이면 같은 비율로는 뾰족해 보여서 (04에서 배움)
const CORNER_RADIUS = CARD_W * (30 / 345);
const CAMERA_FOV = 40;                 // 01~03(38°)과 비슷한 차분한 화각
const FLIP_DURATION = 1.1;
const CLICK_TOLERANCE_PX = 6;
// 모이면(더미·한 장) 카드가 카메라를 정면으로 봐서 지나가는 빛을 통째로 받는다 → 빛을 이만큼까지 줄인다
const GATHERED_GLOW = 0.35;
// 무대 기본 조명(공통 0.6)은 평행한 빛이라 매끈한 코팅에 카드 전체가 통째로 반사돼 번쩍이며 번졌다.
// 05는 지나가는 전구가 주인공이라 기본 조명은 약하게, 대신 주변광을 조금 올려 종이 밝기를 맞춘다
const KEY_LIGHT = 0.15;
const ENVIRONMENT = 0.55;
// 홀로그램 박 코팅(광택 1)은 거울처럼 매끈해서 주변 조명판이 카드 전체에 엄청 밝게 비쳤다 → 0.3
const GLOSS = 0.3;
// 정리할 때 위로 올라가는 거리는 02(카메라에서 10)와 화면에서 같은 비율이 되게 거리 비율만큼 키운다
const SETTLE_RISE = STACK_LOOK.settleRise * (ROW_DEPTH / 10);
const STAR_SEED = 5;
const TAU = Math.PI * 2;
```

- [ ] **Step 2: DEFAULTS에서 `count`~`parallax` 줄을 바꾸고 렌즈 값을 더한다** (`seed`·`speed`·`floatAmount`·`wobble` 삭제)

```js
    count: DIAMOND_CELLS.length, // 카드 수: 레퍼 그리드 9칸 (가운데에 가까운 칸부터)
    cardScale: 1,           // 카드 크기 배율 (1 = 레퍼 크기: 화면 폭 13.5%, 768px 이하 17%)
    parallax: PARALLAX.strength,  // 마우스 밀림 세기 (레퍼 2 → 가장자리 카드 최대 360px)
    ripple: RIPPLE.depth,   // 면 일렁임 깊이 (카드 단위, 레퍼 0.2662를 우리 카드 폭에 맞춤)
    lens: true,             // 화면 가장자리 오목 렌즈
    lensRadius: LENS.glassRadius,
    lensRefraction: LENS.refraction,
    lensDistortion: LENS.distortion,
    lensDispersion: LENS.dispersion,
```

- [ ] **Step 3: buildField 교체**

```js
  const flips = new Map(); // 카드 번호 → 뒤집기 시작 시각(초)
  let cardCount = 0;
  let cards = null;
  let appliedBend = -1;    // 마지막으로 카드 모양에 적용한 휨 (-1 = 다음 프레임에 다시 적용)
  function buildField() {
    cardCount = Math.min(Math.max(1, Math.round(params.count)), DIAMOND_CELLS.length);
    if (cards) {
      stage.scene.remove(cards.mesh);
      cards.dispose();
    }
    cards = createCardInstances({ count: cardCount, width: CARD_W, height: CARD_H, bend: params.bend, material });
    stage.scene.add(cards.mesh);
    flips.clear();
    appliedBend = -1;
  }
  buildField();
```

- [ ] **Step 3-1: 일렁임 공간 배율은 layout.js 값 하나만 쓰게** (`const glint = addGlint(material);` 다음 줄)

```js
  glint.uRippleScale.value = RIPPLE.spatialScale; // 일렁임 물결 공간 배율 (레퍼 0.86)
```

- [ ] **Step 4: 빛 번짐 다음에 렌즈 끼우기** (`stage.addEffect(bloom);` 다음, `stage.resize();` 앞)

```js
  // 화면 가장자리 오목 렌즈: 빛 번짐까지 다 그린 화면을 마지막 출력 직전에 휜다
  const lens = createLensPass();
  stage.addEffect(lens.pass);
```

- [ ] **Step 5: 패널 "공간"·"움직임" 폴더 교체, "렌즈" 폴더 추가** (반짝임·빛 번짐·별먼지 폴더는 그대로)

```js
  const spaceFolder = gui.addFolder('공간');
  spaceFolder.add(params, 'count', 1, DIAMOND_CELLS.length, 1).name('카드 수').onFinishChange(buildField);
  spaceFolder.add(params, 'cardScale', 0.5, 2, 0.01).name('카드 크기');

  const motionFolder = gui.addFolder('움직임');
  motionFolder.add(params, 'parallax', 0, 4, 0.05).name('마우스 밀림');
  motionFolder.add(params, 'ripple', 0, 0.4, 0.005).name('면 일렁임');

  const lensFolder = gui.addFolder('렌즈');
  lensFolder.add(params, 'lens').name('켜기');
  lensFolder.add(params, 'lensRadius', 0, 0.6, 0.01).name('유리 반경');
  lensFolder.add(params, 'lensRefraction', 0, 4, 0.05).name('굴절');
  lensFolder.add(params, 'lensDistortion', 0, 1, 0.01).name('늘림');
  lensFolder.add(params, 'lensDispersion', 0, 0.02, 0.0005).name('색 번짐');
```

- [ ] **Step 6: "매 프레임" 블록 전체 교체** (`const dummy = …`부터 `requestAnimationFrame(frame);` 끝까지)

```js
  // ── 매 프레임 ───────────────────────────────────────────────
  const dummy = new THREE.Object3D();
  const startTime = performance.now() / 1000;
  let lastTime = startTime;
  let lightAngle = 0;   // 빛이 8자로 도는 각도
  let sparkleClock = 0;
  let rippleTime = 0;   // 면 일렁임 시계
  let energy = 0;       // 움직임 세기 0~1 (빠른 스크롤)
  let lastScroll = scrollScreens();
  let pointerPx = { x: 0, y: 0 }; // 천천히 따라간 커서 (화면 가운데 기준 px, 위가 +)
  const stackCenter = new THREE.Vector3(0, 0, -ROW_DEPTH); // 카드들이 놓인 평면 한가운데
  const drawSize = new THREE.Vector2();

  function frame() {
    const now = performance.now() / 1000;
    const dt = Math.min(0.05, now - lastTime) || 1 / 60;
    lastTime = now;
    const sinceStart = reduced ? Infinity : now - startTime; // 등장 시계
    if (!reduced) {
      lightAngle += (dt * TAU) / params.lightPeriod;
      sparkleClock += dt;
      rippleTime = rippleClock(rippleTime, dt);
    }

    // 0) 스크롤 연출 진행도: gather(모이기) → single(한 장) → flip(뒤집기) → settle(정리) + 움직임 세기
    const scrollNow = scrollScreens();
    const stages = scrollStages(scrollNow);
    energy = reduced ? 0 : speedEnergy(energy, (scrollNow - lastScroll) / dt, dt);
    lastScroll = scrollNow;

    // 1) 화면 크기(px)와 커서. 커서는 천천히 따라가고, 화면을 벗어나면 같은 빠르기로 가운데로 돌아온다
    const view = { width: canvas.clientWidth || window.innerWidth, height: canvas.clientHeight || window.innerHeight };
    const following = pointer.inside && !reduced;
    const target = following ? { x: (pointer.x * view.width) / 2, y: (pointer.y * view.height) / 2 } : { x: 0, y: 0 };
    pointerPx = followPointer(pointerPx, target, following, dt);

    // 2) 빛·반짝임·빛 번짐·별·일렁임·렌즈: 패널 값을 매 프레임 그대로 넘긴다 (카메라는 원점에 고정)
    const [gx, gy, gz] = glintPosition(lightAngle);
    glint.uGlintPos.value.set(gx, gy, gz);
    const glow = lerp(1, GATHERED_GLOW, stages.gather); // 모일수록 빛을 줄인다
    glint.uGlare.value = params.glare * glow;
    glint.uGlareSharpness.value = params.glareSharpness;
    glint.uSparkleAmount.value = params.sparkleAmount;
    glint.uSparkle.value = params.sparkleOn ? params.sparkle * glow : 0;
    glint.uTime.value = sparkleClock;
    glint.uRippleTime.value = rippleTime;
    glint.uRippleDepth.value = reduced ? 0 : params.ripple * (1 - stages.gather); // 모이면 평평하게
    glint.uRippleWeight.value = rippleWeight(energy);
    bloom.enabled = params.bloom;
    bloom.strength = params.bloomStrength * glow;
    bloom.radius = params.bloomRadius;
    bloom.threshold = params.bloomThreshold;
    for (const dust of dustLayers) {
      dust.setTime(sparkleClock);
      dust.setTwinkle(reduced ? 0 : params.twinkle);
    }
    stage.renderer.getDrawingBufferSize(drawSize);
    const lensSettings = lensConfig(window.innerWidth, {
      glassRadius: params.lensRadius,
      refraction: params.lensRefraction,
      dispersion: params.lensDispersion,
      distortion: params.lensDistortion,
      motionBoost: LENS.motionBoost,
      edgeOffset: LENS.edgeOffset,
    });
    lens.update({
      width: drawSize.x,
      height: drawSize.y,
      config: lensSettings,
      distortion: lensSettings.distortion + energy * lensSettings.motionBoost,
      enabled: params.lens,
    });

    // 3) 다이아몬드 자리 (화면 가운데 기준 px) → 같은 거리(ROW_DEPTH) 평면의 공간 좌표.
    //    등장: 묶음 전체(위치·크기)가 0.5배에서 3.6초 동안 1배로, 카드는 가운데에 가까운 것부터 0.15초 간격으로 나타남
    const layout = diamondLayout(view.width, view.height, cardCount, params.cardScale);
    const intro = introScale(sinceStart);
    const worldPerPx = (2 * Math.tan((CAMERA_FOV * Math.PI) / 360) * ROW_DEPTH) / view.height;
    const rowScale = (layout.cardH * intro * worldPerPx) / CARD_H;
    const push = reduced ? 0 : 1 - stages.gather; // 모이면 마우스 밀림 0 → 더미가 가운데

    // 4) 휨: 한 장만 남을 때 평평해진다. 값이 바뀔 때만 다시 계산
    const bendNow = params.bend * (1 - stages.single);
    if (Math.abs(bendNow - appliedBend) > 1e-4) {
      cards.setBend(bendNow);
      appliedBend = bendNow;
    }

    // 5) 카드: 다이아몬드 자리(마우스 밀림) → 더미 → 한가운데, 순서로 섞는다. 앞뒤 순서 = 가운데에 가까운 순서 = 더미 순서
    for (let i = 0; i < cardCount; i++) {
      const slot = layout.cards[i];
      const baseX = slot.x * intro;
      const baseY = slot.y * intro;
      const offset = parallaxOffset({ x: baseX, y: baseY }, pointerPx, view, params.parallax);
      const x = (baseX + offset.x * push) * worldPerPx;
      const y = (baseY + offset.y * push) * worldPerPx;
      const z = -ROW_DEPTH - i * LAYER_GAP;
      const c = stackIndexFromRank(i);
      const stack = stackSlot(c);

      // 크기 (01·02와 같게 원래 카드 기준): 더미 1.15배, 한 장만 남을 땐 맨 앞(c=0)만 1.35배 나머지는 0, 마지막엔 86%
      let scale = lerp(rowScale, rowScale * STACK_LOOK.stackScale, stages.gather);
      scale = lerp(scale, c === 0 ? rowScale * STACK_LOOK.singleScale : 0, stages.single);
      scale *= lerp(1, STACK_LOOK.settleScale, stages.settle);
      if (sinceStart < appearTime(i)) scale = 0; // 아직 나타날 차례가 아님

      dummy.quaternion.identity(); // 레퍼처럼 반듯하게 (기울기 없음)
      dummy.position.set(
        lerp(lerp(x, stackCenter.x + stack.x, stages.gather), stackCenter.x, stages.single),
        lerp(lerp(y, stackCenter.y + stack.y, stages.gather), stackCenter.y, stages.single)
          + SETTLE_RISE * stages.settle,
        lerp(lerp(z, stackCenter.z + stack.z, stages.gather), stackCenter.z, stages.single),
      );
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      cards.mesh.setMatrixAt(i, dummy.matrix);

      let flipProgress = 0;
      const flipStart = flips.get(i);
      if (flipStart !== undefined) {
        const t = (now - flipStart) / FLIP_DURATION;
        if (t >= 1) flips.delete(i);
        else flipProgress = easeInOutCubic(t);
      }
      cards.setFlip(i, Math.max(flipProgress, stages.flip)); // 클릭 뒤집기와 스크롤 연출 뒤집기 중 큰 쪽
    }
    cards.commit();

    stage.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
```

- [ ] **Step 7: 입력 블록 정리** — 위 프레임이 `pointer`·`press`·`raycaster`·`scrollScreens`를 그대로 쓰므로 입력 블록은 그대로 둔다. 머리 주석 `// ── 입력: 스크롤(모이기) · 마우스 시점 · 누르면 뒤집기` → `// ── 입력: 스크롤(모이기) · 마우스 밀림 · 누르면 뒤집기`.

- [ ] **Step 8: 문법 확인** — Run: `node --check demos/05-cosmos/main.js` / Expected: 출력 없음 (모듈 import는 브라우저에서 확인)

---

### Task 6: 페이지 노트·캡션·버전, 아카이브 설명

**Files:**
- Modify: `demos/05-cosmos/index.html` (캔버스 설명, 캡션, 노트 "이 데모에 쓴 기법"·"참고한 곳", `main.js?v=19`)
- Modify: `index.html` (05 설명 한 줄)

- [ ] **Step 1: 캔버스 aria-label** → `별먼지 속에 흰 종이 카드 9장이 다이아몬드로 떠 있고 화면 가장자리가 오목 렌즈처럼 휘는 3D 장면`
- [ ] **Step 2: 캡션** → 설명 `종이 카드가 별먼지 속에 다이아몬드로 떠 있고, 화면 가장자리는 오목 렌즈처럼 휘어.`, 힌트 `스크롤하면 한 장으로 모여 · 마우스를 움직이면 카드가 밀려 · 누르면 뒤집혀`
- [ ] **Step 3: 노트 교체** — "우표처럼 놓인 배치", "둥실·흔들림", "꾹 찍어 붙이듯 등장", "깊이감" 항목을 빼고 아래 5개를 맨 앞에. "스크롤하면 한 장으로"는 기운 카드 이야기를 빼고 짧게. 글레어·반짝이·빛 번짐·별먼지 3겹은 그대로.

```html
        <dt>다이아몬드 그리드</dt>
        <dd>Fiddle.Digital Experiments Hub 그리드 보기의 실제 코드에서 칸 9개를 그대로 옮겼어. 5×5 칸 중 가운데를 비우고 마름모로 둘러싸. 바깥 카드 가장자리까지 화면 폭 98%·높이 82%에 펼치는 레퍼 간격 식을 써서, 이웃 열은 반 칸씩 엇갈려 안 겹쳐. 카드 폭은 화면 폭의 13.5%(폰처럼 768px 이하는 17%, 레퍼는 폰에서 목록 보기라 우리가 정했어). 모든 카드가 같은 거리라 평평해. (우표 배치 → 이 배치로)</dd>
        <dt>화면 가장자리 오목 렌즈</dt>
        <dd>카드는 평평하게 다 그린 다음, 그 화면을 가장자리 띠에서만 한 번 더 휘어. 굴절 1.3·늘림 0.32라 가장자리 카드가 늘어나며 굽고, 빨강·파랑을 0.4%씩 엇갈려 가져와서 무지개 테두리가 생겨. 가운데는 그대로 반듯해. 빠르게 스크롤하면 늘림이 0.2만큼 더 세지고, 화면이 1024px 이하면 전부 절반이야. 별먼지도 가장자리에서 같이 휘어.</dd>
        <dt>마우스 따라 밀리기</dt>
        <dd>카드가 커서 반대쪽으로 밀려. 가운데에서 먼 카드일수록 많이 밀려서(가장자리 카드 최대 360px) 렌즈 속을 들여다보는 느낌이 나. 커서는 한 프레임에 8%씩 천천히 따라가. 한 장으로 모일 땐 안 밀려.</dd>
        <dt>카드 면 일렁임</dt>
        <dd>두 물결이 서로 다른 방향으로 지나가면서 카드 면이 깊이 방향으로 아주 살짝 일렁여. 테두리는 덜 움직이고, 가만히 있을 땐 12%만, 빠르게 스크롤하면 끝까지 커져. 모이면 평평해져.</dd>
        <dt>등장</dt>
        <dd>레퍼 값 그대로 묶음 전체가 절반 크기에서 3.6초 동안 제 크기로 커지고(easeInOutQuart), 카드는 가운데에 가까운 것부터 0.15초 간격으로 나타나.</dd>
```

```html
        <dt>스크롤하면 한 장으로</dt>
        <dd>01 나선·02 구와 같은 연출이야. 카드들이 놓인 평면 한가운데에 더미가 생기고(가운데에 가까운 카드가 맨 앞), 크기도 원래 카드 기준으로 더미 1.15배 → 한 장 1.35배 → 정리 0.86배야. 맨 앞 한 장만 남아 커지면서 평평해졌다가, 물결처럼 뒤집히고, 살짝 작아지며 위로 올라가. 모이는 동안에도 빛은 계속 지나가서 더미 위로 글레어가 흘러.</dd>
```

- [ ] **Step 4: 참고한 곳** — Paul Smith 줄을 빼고 맨 앞에 추가: `<p><a href="https://exp.fiddle.digital/" target="_blank" rel="noopener">Fiddle.Digital Experiments Hub</a>: 그리드 보기의 다이아몬드 배치·가장자리 렌즈(LiquidGlass)·마우스 밀림·면 일렁임·등장 숫자. 실제 코드에서 원리와 숫자만 읽었어.</p>`
- [ ] **Step 5: `main.js?v=18` → `?v=19`**
- [ ] **Step 6: 아카이브 `index.html`의 05 설명** → `종이 카드가 별먼지 속에 다이아몬드로 떠 있고, 화면 가장자리가 오목 렌즈처럼 휘어.`
- [ ] **Step 7: 설계 문서 5장 파일 목록에 `lens.js`(숫자·테스트용 식) / `lens-pass.js`(셰이더) 나눈 걸 반영**

---

### Task 7: 전체 테스트 + 원본과 나란히 브라우저 확인

- [ ] **Step 1:** Run: `npm test` / Expected: fail 0 (05 옛 테스트 14개 → 새 16 + 렌즈 4)
- [ ] **Step 2:** 로컬 서버(백그라운드 `python3 -m http.server 8123`) → 내장 브라우저 1440×900로 `http://127.0.0.1:8123/demos/05-cosmos/` 열기. 콘솔 에러 0, 파일 로딩 실패 0.
- [ ] **Step 3:** 원본 `https://exp.fiddle.digital/` GRID 보기와 같은 크기로 스크린샷 비교: 카드 9장 자리(다이아몬드, 가운데 빔), 가장자리 카드 휨·무지개 테두리, 가운데 카드 반듯함.
- [ ] **Step 4:** 커서를 오른쪽 위로 → 카드가 왼쪽 아래로, 가장자리 카드가 더 많이 밀리는지 (setMatrixAt 기록으로 숫자 확인).
- [ ] **Step 5:** 스크롤 0 → 0.42 → 0.64 → 1.45 → 2.25 → 2.7: 모이기 → 한 장 → 뒤집기 → 정리, 모일 때 밀림·일렁임 0.
- [ ] **Step 6:** 375×812: 카드 안 겹침, 렌즈 절반. 마치면 화면 크기·스크롤 원래대로, 서버 끄기.
- [ ] **Step 7:** 메모리(card-archive-05-cosmos-fiddle-ref, card-archive-project) 갱신. 커밋은 사용자가 말할 때.
