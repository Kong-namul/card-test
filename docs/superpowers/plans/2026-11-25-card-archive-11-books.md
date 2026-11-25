# 11 책 캐러셀 (Bookish 틀) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bookish(Framer 템플릿)의 틀·글자·움직임을 거의 그대로, 카드만 우리 종이 카드(세로형/가로형 16:9)로 바꾼 11번 데모를 만든다.

**Architecture:** 숫자 계산(카드 자리·화각·반복·스냅·휠·등장·카메라 궤도)은 `shelf.js`에 Three.js 없이 두고 node로 테스트한다. 틀(왼쪽 띠·버튼·소개 패널·정보·상세 패널)은 공통 `shared/bookish-frame.css` + 토큰 "Bookish 세트". `main.js`가 공통 무대·종이 카드에 입력(휠·끌기·클릭·키)과 DOM을 연결한다.

**Tech Stack:** Three.js 0.187 (importmap), 공통 stage·card-geometry·card-material·panel, Google Fonts(Anybody·Chivo Mono·Inter) + Fontshare(General Sans), `node --test`.

## Global Constraints

- 설계: `docs/superpowers/specs/2026-11-25-card-archive-11-books-design.md`
- 레퍼 코드는 원리·숫자만, 복사 X. 사이트 이름·문구·이미지(BOOKISH, 큐레이터, 책 표지)는 안 씀.
- 색·글꼴·크기는 공통 토큰만 (이번에 허락받은 Bookish 세트 포함). 공통 CSS·토큰을 고치면 `?v=` 올림: `tokens.css?v=2 → v=3` (모든 페이지).
- 주석·노트는 한국어 반말. 카드 예시 문구는 영어(Bookish 글꼴에 한글이 없음).
- 커밋·푸시는 사용자가 말할 때만.

---

### Task 1: 공통 토큰 "Bookish 세트" + 틀 CSS

**Files:**
- Modify: `shared/tokens.css` (`:root` 끝에 추가)
- Create: `shared/bookish-frame.css`
- Modify: 모든 HTML의 `tokens.css?v=2` → `?v=3`

- [ ] **Step 1: `shared/tokens.css`의 `:root` 닫는 `}` 바로 앞에 추가**

```css

  /* ── Bookish 세트 (11 책 캐러셀) ─────────────────────────────
     레퍼 Bookish(Framer 템플릿) 틀을 그대로 쓰려고 사용자 허락을 받아 추가 (2026-11-25 "레퍼 세트 그대로 추가").
     글꼴 넷 다 한글이 없어서 한글은 Pretendard로 대신 보인다 */
  --font-bk-title: 'Anybody', 'Pretendard Variable', Pretendard, sans-serif;      /* 큰 제목 */
  --font-bk-mono: 'Chivo Mono', 'Pretendard Variable', Pretendard, monospace;     /* 작은 라벨·버튼·왼쪽 띠 */
  --font-bk-ui: 'Inter', 'Pretendard Variable', Pretendard, sans-serif;           /* 상세 번호·분류, 소개 본문 */
  --font-bk-text: 'General Sans', 'Pretendard Variable', Pretendard, sans-serif;  /* 상세 설명 */
  --text-42: 42px;
  --text-26: 26px;
  --text-16: 16px;
  --text-12: 12px;
  --text-11: 11px;
  --text-10: 10px;
  --lh-42: 41px;   /* 0.98 */
  --lh-26: 31px;   /* 1.2 */
  --lh-16: 22px;   /* 1.4 */
  --lh-12: 14px;   /* 1.2 */
  --lh-11: 11px;   /* 1 */
  --lh-10: 12px;   /* 1.2 */
  --bk-neon: #ECFF5C;                          /* 왼쪽 띠 글자, 오른쪽 위 버튼 */
  --bk-ink: #000000;                           /* 네온 버튼 위 글자 */
  --bk-side: #2B2B29;                          /* 왼쪽 띠·바깥·소개 패널 */
  --bk-stage: #171614;                         /* 3D 장면·상세 패널 */
  --bk-line: rgba(244, 241, 234, 0.28);        /* 알약 버튼 테두리 */
  --bk-line-strong: rgba(244, 241, 234, 0.55); /* 알약 버튼 테두리 (마우스 올림) */
  --bk-fill-hover: rgba(244, 241, 234, 0.08);  /* 알약 버튼 배경 (마우스 올림) */
```

- [ ] **Step 2: `shared/bookish-frame.css` 만들기**

```css
/* ─────────────────────────────────────────────────────────────
 * bookish-frame.css — 11 책 캐러셀의 틀 (왼쪽 띠·오른쪽 위 버튼·소개 패널·왼쪽 아래 정보·상세 패널·낟알 무늬)
 * 레퍼: Bookish (Framer 템플릿) — 화면에서 잰 위치·크기·자간·전환 값만 옮기고 CSS는 우리가 다시 씀.
 * 색·글꼴·크기는 tokens.css의 Bookish 세트만. 다른 페이지에서도 이 틀을 그대로 쓸 수 있게 공통에 둔다.
 * ───────────────────────────────────────────────────────────── */
.bk-page {
  --bk-side-w: 75px;                        /* 왼쪽 띠 폭 (폰 40px) */
  --bk-about-w: 450px;                      /* 소개 패널 폭 = 페이지가 밀리는 거리 */
  --bk-ease: cubic-bezier(.22, 1, .36, 1);  /* 레퍼 정보·상세 패널 전환 곡선 */
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: var(--bk-side);
  color: var(--fg-1);
}

/* 소개 패널이 열리면 왼쪽 띠·장면이 통째로 왼쪽으로 밀린다 */
.bk-shift {
  position: absolute;
  inset: 0;
  transition: transform 0.55s var(--bk-ease);
}
.bk-page.is-about .bk-shift { transform: translateX(calc(-1 * var(--bk-about-w))); }

/* 왼쪽 띠: 세로 글자 (위 아카이브 링크, 아래 데모 이름) */
.bk-side {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  z-index: 3;
  width: var(--bk-side-w);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  padding: 38px 0 30px;
  background: var(--bk-side);
}
.bk-side__text {
  writing-mode: vertical-rl;
  font-family: var(--font-bk-mono);
  font-size: var(--text-12);
  line-height: 1.2;
  letter-spacing: -0.04em;
  text-transform: uppercase;
  white-space: nowrap;
  color: var(--bk-neon);
  text-decoration: none;
}
a.bk-side__text:hover { text-decoration: underline; text-underline-offset: 4px; }

/* 3D 장면 */
.bk-stage {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: var(--bk-side-w);
  overflow: hidden;
  background: var(--bk-stage);
}
.bk-stage canvas {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
  cursor: grab;
}
.bk-stage canvas:active { cursor: grabbing; }
.bk-stage.is-pointing canvas { cursor: pointer; }

/* 화면 전체 낟알 무늬 5% (SVG 잡음) */
.bk-grain {
  position: absolute;
  inset: -120px;
  z-index: 2;
  pointer-events: none;
  opacity: 0.05;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E");
}

/* 왼쪽 아래 정보: 번호 · 제목 · 이름 · 연도 — 분류 */
.bk-meta {
  position: absolute;
  left: 32px;
  bottom: 40px;
  z-index: 4;
  max-width: 40%;
  pointer-events: none;
  transition: opacity 0.3s var(--bk-ease), transform 0.3s var(--bk-ease);
}
.bk-meta.is-changing { opacity: 0; }
.bk-page.is-detail .bk-meta { opacity: 0; transform: translateY(-10px); }
.bk-meta::before {
  content: '';
  display: block;
  width: 46px;
  height: 1px;
  margin-bottom: 20px;
  background: currentColor;
  opacity: 0.3;
}
.bk-meta__index {
  margin: 0;
  font-family: var(--font-bk-mono);
  font-size: var(--text-12);
  font-weight: 500;
  line-height: 1;
  letter-spacing: 0.36em;
  text-transform: uppercase;
}
.bk-meta__title {
  margin: 14px 0 0;
  font-family: var(--font-bk-title);
  font-size: var(--text-24);
  font-weight: 400;
  line-height: 1.2;
  letter-spacing: -0.016em;
  color: var(--fg-1);
}
.bk-meta__author {
  margin: 14px 0 0;
  font-family: var(--font-bk-mono);
  font-size: var(--text-12);
  line-height: var(--lh-12);
  letter-spacing: 0.24em;
  text-transform: uppercase;
  opacity: 0.72;
}
.bk-specs {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 18px 0 0;
  text-transform: uppercase;
  opacity: 0.5;
}
.bk-meta .bk-specs {
  font-family: var(--font-bk-mono);
  font-size: var(--text-10);
  font-weight: 300;
  line-height: var(--lh-10);
  letter-spacing: 0.26em;
}
.bk-sep {
  display: block;
  flex: none;
  width: 20px;
  height: 1px;
  background: currentColor;
  opacity: 0.3;
}

/* 오른쪽 상세 패널 (카드를 누르면) */
.bk-detail {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 10;
  width: min(420px, 44%);
  overflow-y: auto;
  padding: 8vh clamp(28px, 4vw, 56px);
  background: var(--bk-stage);
  opacity: 0;
  transform: translateX(32px);
  visibility: hidden;
  pointer-events: none;
  transition: opacity 0.55s var(--bk-ease), transform 0.55s var(--bk-ease), visibility 0s 0.55s;
}
.bk-page.is-detail .bk-detail {
  opacity: 1;
  transform: none;
  visibility: visible;
  pointer-events: auto;
  transition: opacity 0.55s var(--bk-ease), transform 0.55s var(--bk-ease);
}
.bk-detail__index {
  margin: 0;
  font-family: var(--font-bk-ui);
  font-size: var(--text-11);
  font-weight: 300;
  line-height: var(--lh-11);
  letter-spacing: 0.36em;
  text-transform: uppercase;
}
.bk-detail__rule {
  width: 46px;
  height: 1px;
  margin: 22px 0;
  background: currentColor;
  opacity: 0.32;
}
.bk-detail__title {
  margin: 0;
  font-family: var(--font-bk-title);
  font-size: var(--text-42);
  font-weight: 400;
  line-height: var(--lh-42);
  letter-spacing: -0.016em;
  color: var(--fg-1);
}
.bk-detail .bk-specs {
  margin-top: 20px;
  font-family: var(--font-bk-ui);
  font-size: var(--text-11);
  font-weight: 300;
  line-height: var(--lh-11);
  letter-spacing: 0.26em;
}
.bk-detail__divider {
  height: 1px;
  margin: 32px 0 28px;
  background: currentColor;
  opacity: 0.14;
}
.bk-detail__blurb {
  margin: 0;
  font-family: var(--font-bk-text);
  font-size: var(--text-16);
  line-height: var(--lh-16);
  letter-spacing: -0.02em;
  opacity: 0.88;
}
.bk-detail__actions {
  display: flex;
  gap: 14px;
  margin-top: 42px;
}
.bk-pill {
  display: inline-flex;
  align-items: center;
  padding: 13px 24px;
  border: 1px solid var(--bk-line);
  border-radius: 100px;
  background: none;
  color: inherit;
  font-family: var(--font-bk-mono);
  font-size: var(--text-10);
  line-height: 1;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background-color 0.2s, border-color 0.2s;
}
.bk-pill:hover { border-color: var(--bk-line-strong); background: var(--bk-fill-hover); }

/* 오른쪽 위 네온 버튼 → 소개 패널 */
.bk-about-btn {
  position: absolute;
  top: 20px;
  right: 18px;
  z-index: 20;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  height: 41px;
  padding: 0 16px;
  border: 0;
  border-radius: 2px;
  background: var(--bk-neon);
  color: var(--bk-ink);
  font-family: var(--font-bk-mono);
  font-size: var(--text-12);
  line-height: 1.6;
  letter-spacing: -0.02em;
  text-transform: uppercase;
  cursor: pointer;
}
.bk-about-btn svg { width: 14px; height: 14px; }

/* 소개 패널: 오른쪽에서 나오고, 페이지는 그만큼 왼쪽으로 밀린다 */
.bk-about {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 15;
  width: var(--bk-about-w);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 16px;
  padding: 40px 48px 60px;
  background: var(--bk-side);
  transform: translateX(100%);
  transition: transform 0.55s var(--bk-ease);
}
.bk-page.is-about .bk-about { transform: none; }
.bk-about__title {
  margin: 0;
  font-family: var(--font-bk-mono);
  font-size: var(--text-26);
  font-weight: 600;
  line-height: var(--lh-26);
  letter-spacing: -0.02em;
  text-transform: uppercase;
  color: var(--fg-1);
}
.bk-about__body {
  margin: 0;
  font-family: var(--font-bk-ui);
  font-size: var(--text-16);
  font-weight: 500;
  line-height: var(--lh-16);
  letter-spacing: -0.04em;
}
.bk-about__links {
  display: flex;
  gap: 24px;
  margin: 16px 0 0;
  font-family: var(--font-bk-ui);
  font-size: var(--text-16);
  font-weight: 500;
  line-height: var(--lh-16);
}
.bk-about__links a { color: var(--fg-1); text-decoration: none; }
.bk-about__links a::after { content: ' ↗'; }

/* 조절 패널이 네온 버튼을 가리지 않게 그 아래로 */
.bk-page ~ .lil-gui.card-panel.autoPlace { top: 72px; }

/* 폰 (레퍼 Framer 폰 크기 809px 이하): 띠 40px, 버튼 "ABOUT", 정보 80px 위로, 상세·소개 패널 화면 가득 */
@media (max-width: 809px) {
  .bk-page { --bk-side-w: 40px; --bk-about-w: 100vw; }
  .bk-side { padding: 34px 0 30px; }
  .bk-about-btn { top: 18px; height: 43px; }
  .bk-about-btn__long { display: none; }
  .bk-meta { bottom: 120px; max-width: calc(100% - 64px); }
  .bk-detail { width: 100%; padding: 12vh 28px 8vh; background: none; } /* 상세 카드가 아래에 보이게 */
  .bk-about { padding: 40px 28px 60px; }
}
```

- [ ] **Step 3: 모든 HTML의 토큰 버전 올리기**

Run: `grep -rl "tokens.css?v=2" --include='*.html' . | while read f; do sed -i '' 's/tokens\.css?v=2/tokens.css?v=3/' "$f"; done; grep -rhoE "tokens\.css\?v=[0-9]+" --include='*.html' . | sort | uniq -c`
Expected: `12 tokens.css?v=3`

---

### Task 2: 캐러셀 계산 (`shelf.js`)

**Files:**
- Create: `demos/11-books/shelf.js`
- Test: `tests/shelf.test.js`

**Interfaces — Produces:**
- `SHELF` 설정 객체 (아래 코드), `FORMATS = { portrait: {width,height,spacing}, landscape: {...} }`
- `fovFor(aspect) → 도`, `followFactor(rate, dt)`, `wrapOffset(x, total)`
- `cardPose(r, spacing) → { z, rotY, scale, shade }`, `edgeFade(r, halfWidth) → 0~1`
- `easeInOutCubic(t)`, `easeOutCubic(t)`, `easeOutExpo(t)`
- `ENTRANCE`, `entrancePose(index, count, time) → { x, y, z, scale, shade }`
- `wheelStep(state{acc,last}, delta, nowMs) → { step: -1|0|1, state }`
- `indexAt(scroll, spacing)`, `snapTarget(scroll, spacing, step)`, `centerIndex(scroll, spacing, count)`
- `orbitPosition(theta, phi, radius, focus{x,y,z}) → {x,y,z}`, `START_PHI`

- [ ] **Step 1: 테스트 먼저** — `tests/shelf.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SHELF, FORMATS, fovFor, followFactor, wrapOffset, cardPose, edgeFade, easeInOutCubic, easeOutCubic, easeOutExpo,
  ENTRANCE, entrancePose, wheelStep, indexAt, snapTarget, centerIndex, orbitPosition, START_PHI,
} from '../demos/11-books/shelf.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const deg = (r) => (r * 180) / Math.PI;

test('SHELF: 레퍼 사이트가 넘긴 값 — 간격 3.4, 따라가기 0.4, 스냅 0.5초, 상세 0.9배·왼쪽 0.8, 카메라 14 → 8.4', () => {
  assert.equal(SHELF.spacing, 3.4);
  assert.equal(SHELF.follow, 0.4);
  assert.equal(SHELF.snapDuration, 0.5);
  assert.equal(SHELF.detailScale, 0.9);
  assert.deepEqual(SHELF.detailOffset, { x: -0.8, y: 0 });
  assert.deepEqual(SHELF.narrowDetailOffset, { x: 1.45, y: -3.35 });
  assert.equal(SHELF.camZ, 14);
  assert.equal(SHELF.focusDistance, 8.4);
});

test('FORMATS: 세로형은 높이 3.2·공통 카드 비율·간격 3.4, 가로형은 16:9·간격 = 폭 + 1.2', () => {
  close(FORMATS.portrait.height, 3.2);
  close(FORMATS.portrait.width / FORMATS.portrait.height, 345 / 490);
  close(FORMATS.portrait.spacing, 3.4);
  close(FORMATS.landscape.width / FORMATS.landscape.height, 16 / 9);
  close(FORMATS.landscape.spacing - FORMATS.landscape.width, 1.2);
});

test('fovFor: 보이는 높이 max(6.8, 8 ÷ 화면비)로 — 넓은 화면 약 27.3°, 좁은 폰은 55°에서 멈춘다', () => {
  const wide = deg(2 * Math.atan(6.8 / 28));
  close(fovFor(1.6), wide);
  close(fovFor(3), wide);
  close(fovFor(375 / 812), 55);
  close(fovFor(1), deg(2 * Math.atan(8 / 28)));
});

test('followFactor: 60fps 한 프레임이면 그 비율, 30fps면 두 프레임만큼', () => {
  close(followFactor(0.4, 1 / 60), 0.4);
  close(followFactor(0.4, 1 / 30), 1 - 0.6 ** 2);
});

test('wrapOffset: 줄이 끝없이 반복 — 늘 −반폭~+반폭 안', () => {
  close(wrapOffset(18, 34), -16);
  close(wrapOffset(-20, 34), 14);
  close(wrapOffset(3.4, 34), 3.4);
  for (let x = -200; x < 200; x += 7.3) {
    const r = wrapOffset(x, 34);
    assert.ok(r >= -17 - 1e-9 && r <= 17 + 1e-9);
  }
});

test('cardPose: 가운데는 1.1배·정면·밝게, 한 칸 옆은 0.93배·밝기 0.35·안쪽으로 돌며 물러남, 가로형도 같은 장 수면 같은 각도', () => {
  const center = cardPose(0, 3.4);
  close(center.scale, 1.1);
  close(center.rotY, 0);
  close(center.z, 0);
  close(center.shade, 1);
  const next = cardPose(3.4, 3.4);
  close(next.scale, 0.93);
  close(next.shade, 0.35);
  close(next.rotY, -3.4 * 0.045);
  close(next.z, -3.4 * 0.09);
  const wide = cardPose(5.6, 5.6);
  close(wide.rotY, next.rotY);
  close(wide.z, next.z);
  close(wide.scale, 0.93);
  assert.ok(cardPose(-3.4, 3.4).rotY > 0); // 왼쪽 카드는 반대로 돈다
});

test('edgeFade: 줄 반폭의 85%까지 1, 99%부터 0, 사이는 부드럽게', () => {
  close(edgeFade(14, 17), 1);
  close(edgeFade(17, 17), 0);
  const mid = edgeFade(15.6, 17);
  assert.ok(mid > 0 && mid < 1);
  close(edgeFade(-15.6, 17), mid);
});

test('이징: 0→0, 1→1, easeInOutCubic은 절반에 절반, easeOutExpo는 빨리 다가간다', () => {
  for (const f of [easeInOutCubic, easeOutCubic, easeOutExpo]) {
    close(f(0), 0);
    close(f(1), 1);
  }
  close(easeInOutCubic(0.5), 0.5);
  close(easeOutCubic(0.5), 0.875);
  close(easeOutExpo(0.5), 1 - 2 ** -5);
});

test('entrancePose: rise — 아래(−22)에서 0.95초에 올라오고, 가운데에서 먼 카드일수록 0.06초씩 늦게', () => {
  const first = entrancePose(4, 10, 0); // i = −0.5, a = 0.5
  close(first.x, -0.5 * ENTRANCE.spreadX);
  close(first.y, -22 - 0.25);
  close(first.z, -3);
  close(first.scale, 0.9);
  close(first.shade, 0.2);
  const done = entrancePose(4, 10, 0.5 * 0.06 + 0.95);
  assert.deepEqual(done, { x: 0, y: 0, z: 0, scale: 1, shade: 1 });
  const late = entrancePose(0, 10, 4.5 * 0.06); // a = 4.5 → 아직 출발 전
  close(late.y, -22 - 4.5 * 0.5);
  let previous = -Infinity;
  for (let t = 0; t <= 1.6; t += 0.05) {
    const y = entrancePose(4, 10, t).y;
    assert.ok(y >= previous - 1e-9);
    previous = y;
  }
  assert.deepEqual(entrancePose(7, 10, Infinity), { x: 0, y: 0, z: 0, scale: 1, shade: 1 });
});

test('wheelStep: 30px 넘게 굴리면 한 장(방향대로), 250ms 쉬면 처음부터 다시 센다', () => {
  let s = { acc: 0, last: -Infinity };
  let r = wheelStep(s, 20, 1000);
  assert.equal(r.step, 0);
  r = wheelStep(r.state, 15, 1100);
  assert.equal(r.step, 1);
  assert.equal(r.state.acc, 0);
  r = wheelStep(r.state, -25, 1200);
  assert.equal(r.step, 0);
  r = wheelStep(r.state, -10, 1600); // 400ms 쉼 → 다시 셈
  assert.equal(r.step, 0);
  close(r.state.acc, -10);
  r = wheelStep(r.state, -40, 1650);
  assert.equal(r.step, -1);
});

test('indexAt·snapTarget·centerIndex: 가운데 카드 번호와 한 장 옮길 자리, 반복해도 0~장수−1', () => {
  assert.equal(indexAt(-6.8, 3.4), 2);
  close(snapTarget(-6.8, 3.4, 1), -10.2);
  close(snapTarget(-7.5, 3.4, 0), -6.8);
  assert.equal(centerIndex(-34 - 6.8, 3.4, 10), 2);
  assert.equal(centerIndex(3.4, 3.4, 10), 9);
});

test('orbitPosition: 처음 카메라 자리 = (0, 0.3, √(14² − 0.3²)), 옆으로 돌면 x가 생긴다', () => {
  const p = orbitPosition(0, START_PHI, 14, { x: 0, y: 0, z: 0 });
  close(p.x, 0);
  close(p.y, 0.3);
  close(p.z, Math.sqrt(14 * 14 - 0.09));
  assert.ok(orbitPosition(0.5, START_PHI, 14, { x: 0, y: 0, z: 0 }).x > 0);
  close(SHELF.phiMin, Math.PI * 0.24);
  close(SHELF.phiMax, Math.PI * 0.78);
});
```

- [ ] **Step 2: 실패 확인** — Run: `node --test tests/shelf.test.js` / Expected: FAIL (모듈 없음)

- [ ] **Step 3: `demos/11-books/shelf.js` 만들기**

```js
// ─────────────────────────────────────────────────────────────
// shelf.js — 11 책 캐러셀: 카드 자리·화각·끝없이 반복·스냅·휠·등장·카메라 궤도 (Three.js 없이 숫자만)
// 레퍼: Bookish (Framer 템플릿)의 3D 책장 컴포넌트 — 기본값과 사이트가 넘긴 값을 읽어 숫자만 옮김 (코드는 안 가져옴)
// ─────────────────────────────────────────────────────────────
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const SHELF = {
  spacing: 3.4,            // 카드 간격 (사이트 값, 기본 3) — 책 폭 2.2 + 틈 1.2
  camZ: 14,                // 카메라 거리
  camY: 0.3,               // 카메라 높이 (살짝 내려다봄)
  minFov: 22,
  maxFov: 55,
  follow: 0.4,             // 줄 따라가기: 60fps 한 프레임에 남은 거리의 40% (사이트 damping, 기본 0.085)
  cardFollow: 0.16,        // 카드 자리·크기·밝기 따라가기 (1 − 0.84)
  depthFactor: 0.09,       // 가운데에서 1만큼 떨어질 때마다 0.09 뒤로
  turnFactor: 0.045,       // 1만큼마다 0.045rad 안쪽으로 돈다
  focusScale: 0.1,         // 가운데 카드 1.1배, 나머지 0.93배
  darkness: 0.35,          // 옆 카드 밝기
  edgeFadeStart: 0.85,     // 줄 반폭의 85%부터
  edgeFadeEnd: 0.99,       //          99%에서 사라진다
  wheelThreshold: 30,      // 휠 30px 넘으면 한 장
  wheelIdleMs: 250,        // 250ms 쉬면 처음부터 다시 셈
  snapDuration: 0.5,       // 한 장 넘어가는 시간 (사이트 값, 기본 1.6)
  wheelSpeed: 0.0034,      // 스냅 없을 때(폰) 휠 1px당 줄 이동
  dragSpeed: 0.035,        // 카드 위에서 끌 때 1px당 줄 이동
  releaseSnap: 0.2,        // 끌다 놓으면 가까운 장으로 (스냅 0.5초 × 0.4)
  orbitSpeed: 0.0042,      // 빈 곳을 끌면 1px당 시점이 도는 양 (rad)
  phiMin: Math.PI * 0.24,  // 위아래로 돌 수 있는 범위
  phiMax: Math.PI * 0.78,
  parallaxTheta: 0.12,     // 커서 따라 좌우로 도는 최대 (rad)
  parallaxPhi: 0.055,      //          위아래
  orbitFollow: 0.14,       // 카메라 회전·거리 따라가기 (1 − 0.86)
  parallaxFollow: 0.05,    // 커서 시점 따라가기 (1 − 0.95)
  parallaxWeightFollow: 0.12, // 끄는 동안 커서 시점을 껐다 켜는 빠르기 (1 − 0.88)
  clickThreshold: 6,       // 6px 안 움직이면 클릭
  focusDistance: 8.4,      // 상세 볼 때 카메라 거리
  detailScale: 0.9,        // 상세 카드 크기 (사이트 값)
  detailOffset: { x: -0.8, y: 0 },           // 상세 카드 자리 (사이트 값, 오른쪽 패널 자리 비우기)
  narrowDetailOffset: { x: 1.45, y: -3.35 }, // 폰 (사이트 폰 값)
};

// 카드 모양: 세로형은 레퍼 책 높이 3.2에 공통 카드 비율(345:490), 가로형은 16:9.
// 가로형 간격은 세로형 틈 1.2와 같게 폭 + 1.2
export const FORMATS = {
  portrait: { width: 3.2 * (345 / 490), height: 3.2, spacing: 3.4 },
  landscape: { width: 4.4, height: 2.475, spacing: 5.6 },
};

// 화각: 카메라 거리 14에서 보이는 높이가 max(6.8, 8 ÷ 화면비)가 되게 (좁은 화면은 넓게), 22°~55°
export function fovFor(aspect) {
  const view = Math.max(6.8, 8 / aspect);
  const degrees = (2 * Math.atan(view / (2 * SHELF.camZ)) * 180) / Math.PI;
  return clamp(degrees, SHELF.minFov, SHELF.maxFov);
}

// 60fps 한 프레임 기준 비율을 dt에 맞춰 바꾼다
export function followFactor(rate, dt) {
  return 1 - Math.pow(1 - rate, dt * 60);
}

// 끝없이 반복: 줄 전체 길이(total) 안에서 가운데 기준 −반폭~+반폭으로
export function wrapOffset(x, total) {
  return x - Math.round(x / total) * total;
}

// 가운데까지 거리 r인 카드: 뒤로 물러남·안쪽으로 회전·크기·밝기.
// 회전·깊이는 r을 간격 비율로 줄여서, 가로형(간격 5.6)도 같은 장 수만큼 떨어진 카드가 세로형과 같은 각도
export function cardPose(r, spacing) {
  const k = SHELF.spacing / spacing;
  const near = Math.min(Math.abs(r) / spacing, 1);
  return {
    z: -Math.abs(r) * k * SHELF.depthFactor,
    rotY: -r * k * SHELF.turnFactor,
    scale: 1 + SHELF.focusScale - SHELF.focusScale * 1.7 * near,
    shade: 1 + (SHELF.darkness - 1) * Math.pow(near, 1.2),
  };
}

// 화면 끝(줄 반폭의 85%→99%)에서 부드럽게 사라진다 → 반복되며 반대편에서 나타나는 순간이 안 보인다
export function edgeFade(r, halfWidth) {
  const start = halfWidth * SHELF.edgeFadeStart;
  const end = halfWidth * SHELF.edgeFadeEnd;
  const d = Math.abs(r);
  if (d <= start) return 1;
  const t = clamp((d - start) / Math.max(1e-4, end - start), 0, 1);
  return 1 - t * t * (3 - 2 * t);
}

export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
export const easeOutCubic = (t) => 1 - (1 - t) ** 3;
export const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));

// 등장 "rise" (사이트 값): 카드 번호가 줄 가운데에서 i번째(a = |i|)인 카드가
// (x i×0.6, y −22 − a×0.5, z −3, 0.9배)에서 올라와 0.95초에 제자리, a×0.06초 늦게 출발, easeOutExpo, 밝기 최소 0.2
export const ENTRANCE = { stagger: 0.06, duration: 0.95, spreadX: 0.6, dropY: 22, dropPerStep: 0.5, z: -3, scale: 0.9, minShade: 0.2 };

export function entrancePose(index, count, time) {
  const i = index - (count - 1) / 2;
  const a = Math.abs(i);
  const t = clamp((time - a * ENTRANCE.stagger) / ENTRANCE.duration, 0, 1);
  if (t >= 1) return { x: 0, y: 0, z: 0, scale: 1, shade: 1 };
  const e = easeOutExpo(t);
  const rest = 1 - e;
  return {
    x: i * ENTRANCE.spreadX * rest,
    y: (-ENTRANCE.dropY - a * ENTRANCE.dropPerStep) * rest,
    z: ENTRANCE.z * rest,
    scale: 1 + (ENTRANCE.scale - 1) * rest,
    shade: Math.max(ENTRANCE.minShade, e),
  };
}

// 휠: 30px 넘게 굴리면 한 장 (250ms 쉬면 처음부터 다시 센다). 결과의 step: −1·0·1
export function wheelStep(state, delta, nowMs) {
  const acc = (nowMs - state.last > SHELF.wheelIdleMs ? 0 : state.acc) + delta;
  if (Math.abs(acc) >= SHELF.wheelThreshold) return { step: acc > 0 ? 1 : -1, state: { acc: 0, last: nowMs } };
  return { step: 0, state: { acc, last: nowMs } };
}

// 줄 위치(scroll) → 가운데 카드 번호 (반복 전). 카드 i는 scroll = −i × 간격일 때 가운데
export function indexAt(scroll, spacing) {
  return Math.round(-scroll / spacing);
}

// step장 옮긴 자리 (0이면 가장 가까운 장)
export function snapTarget(scroll, spacing, step) {
  return -(indexAt(scroll, spacing) + step) * spacing;
}

// 반복을 접은 가운데 카드 번호 0 ~ 장수−1
export function centerIndex(scroll, spacing, count) {
  return ((indexAt(scroll, spacing) % count) + count) % count;
}

// 카메라: 초점 둘레 구면 위 (θ 좌우, φ 위에서 잰 각도)
export function orbitPosition(theta, phi, radius, focus) {
  const s = Math.sin(phi);
  return {
    x: focus.x + radius * s * Math.sin(theta),
    y: focus.y + radius * Math.cos(phi),
    z: focus.z + radius * s * Math.cos(theta),
  };
}

// 처음 카메라는 (0, 0.3, 거의 14) → 그 φ
export const START_PHI = Math.acos(SHELF.camY / SHELF.camZ);
```

- [ ] **Step 4: 통과 확인** — Run: `node --test tests/shelf.test.js` / Expected: PASS 13개

---

### Task 3: 예시 내용 (`cards-data.js`)

**Files:**
- Create: `demos/11-books/cards-data.js`

- [ ] **Step 1: 만들기** (지어낸 예시, 바꾸기 쉽게 한 파일)

```js
// ─────────────────────────────────────────────────────────────
// cards-data.js — 11 책 캐러셀 카드 내용 (예시). 이 파일만 바꾸면 카드 장수·글이 바뀐다.
// Bookish 글꼴(Anybody·Chivo Mono·Inter·General Sans)에 한글이 없어서 예시는 영어로.
// 모두 지어낸 이름·문구 (레퍼 사이트의 책·문구는 쓰지 않음)
// ─────────────────────────────────────────────────────────────
export const CARDS = [
  { title: 'Paper Weather', name: 'Mira Hollis', year: '2019', category: 'Essays', blurb: 'Notes on folding, creasing and the small weather that lives inside a sheet of paper. Every chapter begins with a single fold and follows it until it becomes a shape.' },
  { title: 'The Quiet Index', name: 'Theo Laurent', year: '2021', category: 'Fiction', blurb: 'A night archivist starts finding cards that were never filed. Each one describes a room in the building that should not exist.' },
  { title: 'Salt & Static', name: 'June Okafor', year: '2016', category: 'Poetry', blurb: 'Short poems written between radio stations on a long coastal drive, where the sea and the signal kept interrupting each other.' },
  { title: 'A Room of Cards', name: 'Ilse Morrow', year: '2023', category: 'Design', blurb: 'A field guide to the card as an interface: how a rectangle learned to hold a person, a product and a promise at the same time.' },
  { title: 'Northbound Letters', name: 'Sam Reyes', year: '2012', category: 'Memoir', blurb: 'Letters sent north every winter for ten years, and the slow realisation that the person reading them had changed more than the writer.' },
  { title: 'Glass Orchard', name: 'Noa Kim', year: '2020', category: 'Fantasy', blurb: 'In a valley where fruit grows clear as glass, a gardener notices one tree that reflects a different season than the rest.' },
  { title: 'Lines We Kept', name: 'Arlo Bennett', year: '2018', category: 'Drama', blurb: 'Three actors rehearse the same play in three decades, each keeping one line the others cut, until the lines start to answer each other.' },
  { title: 'Small Hours', name: 'Petra Lind', year: '2024', category: 'Mystery', blurb: 'A clock repairer is asked to fix a watch that runs perfectly, and to find out why its owner insists it is always ten minutes late.' },
  { title: 'The Long Shelf', name: 'Hugo Varga', year: '2015', category: 'History', blurb: 'How shelves shaped reading, from chained libraries to bedside piles, told through the furniture that held the books.' },
  { title: 'Margins', name: 'Ruth Calder', year: '2022', category: 'Literary Fiction', blurb: 'A used-book seller collects the notes strangers leave in margins, and slowly pieces together a conversation that spans fifty years.' },
];
```

---

### Task 4: 페이지 (`index.html`) + 연결 (`main.js`) + 아카이브 목록

**Files:**
- Create: `demos/11-books/index.html`, `demos/11-books/main.js`
- Modify: `index.html` (10 다음에 11 추가)

**Interfaces — Consumes:** Task 2 `shelf.js` 전부, Task 3 `CARDS`, 공통 `createStage`·`readToken`·`showWebGLFallback`(stage.js?v=6), `createCardMaterial`·`syncMaterial`(card-material.js?v=8, `material.userData.cardUniforms.uCardWidth/uCardHeight`), `createCardInstances`(card-geometry.js?v=3: `mesh`, `setDim`, `commit`, `dispose`), `prefersReducedMotion`(motion.js?v=3), `DEFAULT_PRESET`·`presetToParams`(texture-presets.js?v=1), `createPanel`·`addSettingsButtons`(panel.js?v=2), `addTextureFolder`(texture-panel.js?v=6).

- [ ] **Step 1: `demos/11-books/index.html`**

```html
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>11 책 캐러셀 · Card Archive</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
  <!-- Bookish 세트 글꼴: Anybody·Chivo Mono·Inter (Google Fonts), General Sans (Fontshare) -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anybody:wght@400&family=Chivo+Mono:wght@300;400;500;600&family=Inter:wght@300;400;500&display=swap">
  <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=general-sans@400&display=swap">
  <link rel="stylesheet" href="../../shared/tokens.css?v=3">
  <link rel="stylesheet" href="../../shared/base.css?v=5">
  <link rel="stylesheet" href="../../shared/bookish-frame.css?v=1">
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
  <div class="bk-page" id="bk-page">
    <div class="bk-shift">
      <aside class="bk-side">
        <a class="bk-side__text" href="../../">Card Archive</a>
        <span class="bk-side__text">11 — Book Carousel</span>
      </aside>
      <main class="bk-stage" id="bk-stage">
        <canvas id="stage-canvas" aria-label="종이 카드가 책처럼 가로 한 줄로 서 있는 3D 장면. 휠로 한 장씩 넘기고, 누르면 커지면서 오른쪽에 정보가 나와"></canvas>
        <div class="bk-grain" aria-hidden="true"></div>
        <div class="bk-meta" id="bk-meta" aria-live="polite">
          <p class="bk-meta__index" id="bk-meta-index"></p>
          <h1 class="bk-meta__title" id="bk-meta-title"></h1>
          <p class="bk-meta__author" id="bk-meta-author"></p>
          <p class="bk-specs"><span id="bk-meta-year"></span><span class="bk-sep"></span><span id="bk-meta-category"></span></p>
        </div>
        <section class="bk-detail" id="bk-detail" aria-label="카드 정보">
          <p class="bk-detail__index" id="bk-detail-index"></p>
          <div class="bk-detail__rule"></div>
          <h2 class="bk-detail__title" id="bk-detail-title"></h2>
          <p class="bk-specs"><span id="bk-detail-year"></span><span class="bk-sep"></span><span id="bk-detail-category"></span></p>
          <div class="bk-detail__divider"></div>
          <p class="bk-detail__blurb" id="bk-detail-blurb"></p>
          <div class="bk-detail__actions"><button class="bk-pill" id="bk-close" type="button">Close</button></div>
        </section>
      </main>
    </div>
    <button class="bk-about-btn" id="bk-about-btn" type="button" aria-expanded="false" aria-controls="bk-about">
      <span>About</span><span class="bk-about-btn__long">&nbsp;this demo</span>
      <svg viewBox="0 0 14 14" aria-hidden="true"><path d="M1 3.5h12M1 7h12M1 10.5h12" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>
    </button>
    <aside class="bk-about" id="bk-about" aria-label="이 데모 소개">
      <h2 class="bk-about__title">About this demo</h2>
      <p class="bk-about__body">Bookish(Framer 템플릿)의 3D 책장과 틀을 우리 종이 카드로 다시 만들었어. 사이트 코드에서 숫자만 읽고(간격 3.4, 한 장 0.5초, 상세 0.9배, 아래에서 올라오는 등장), 코드는 새로 썼어.</p>
      <p class="bk-about__body">휠: 한 장씩 · 카드를 끌면 줄이 밀리고, 빈 곳을 끌면 시점이 돌아서 뒷면이 보여 · 누르면 커지면서 오른쪽에 정보 · ← → 키, Esc로 닫기. 카드 모양(세로형 / 가로형 16:9)은 오른쪽 조절 패널에서.</p>
      <p class="bk-about__links"><a href="https://boookish.framer.website/" target="_blank" rel="noopener">Bookish</a><a href="../../">Archive</a></p>
    </aside>
  </div>

  <script type="module" src="./main.js?v=1"></script>
</body>
</html>
```

- [ ] **Step 2: `demos/11-books/main.js`**

```js
// ─────────────────────────────────────────────────────────────
// 11 책 캐러셀 — 종이 카드가 책처럼 가로 한 줄로 서 있고, 휠로 한 장씩 넘기고, 누르면 커지며 오른쪽에 정보가 나온다.
// 레퍼: Bookish (Framer 템플릿, boookish.framer.website) — 3D 책장 컴포넌트의 기본값과 사이트가 넘긴 값을 읽어 숫자만 옮김.
//   코드는 가져오지 않았다. 틀(왼쪽 띠·버튼·정보·상세·소개 패널)은 shared/bookish-frame.css
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { createStage, showWebGLFallback, readToken } from '../../shared/stage.js?v=6';
import { createCardMaterial, syncMaterial } from '../../shared/card-material.js?v=8';
import { createCardInstances } from '../../shared/card-geometry.js?v=3';
import { prefersReducedMotion } from '../../shared/motion.js?v=3';
import { DEFAULT_PRESET, presetToParams } from '../../shared/texture-presets.js?v=1';
import { createPanel, addSettingsButtons } from '../../shared/panel.js?v=2';
import { addTextureFolder } from '../../shared/texture-panel.js?v=6';
import {
  SHELF, FORMATS, fovFor, followFactor, wrapOffset, cardPose, edgeFade, easeInOutCubic, easeOutCubic,
  entrancePose, wheelStep, indexAt, snapTarget, centerIndex, orbitPosition, START_PHI,
} from './shelf.js?v=1';
import { CARDS } from './cards-data.js?v=1';

const CORNER_RADIUS = 0.13;  // 공통 카드 모서리 비율(Grail 20/345)을 세로형 폭 2.25에 맞춘 값
const NARROW = window.matchMedia('(max-width: 809px)'); // 레퍼(Framer) 폰 크기
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const pad = (n) => String(n).padStart(2, '0');

function main() {
  const page = document.getElementById('bk-page');
  const stageEl = document.getElementById('bk-stage');
  const canvas = document.getElementById('stage-canvas');
  let stage;
  try {
    stage = createStage({ canvas, fov: fovFor(1.6) });
  } catch (error) {
    console.warn('WebGL 초기화 실패', error);
    showWebGLFallback(canvas);
    return;
  }
  stage.scene.background = new THREE.Color(readToken('--bk-stage'));
  const reduced = prefersReducedMotion();

  // ── 기본값 ──────────────────────────────────────────────────
  const paper = readToken('--card-paper');
  const DEFAULTS = {
    ...presetToParams(DEFAULT_PRESET, paper),
    format: 'portrait',                 // 카드 모양: 세로형(기본) / 가로형 16:9
    spacing: FORMATS.portrait.spacing,  // 카드 간격 (세로형 3.4, 가로형 5.6)
  };
  const params = structuredClone(DEFAULTS);

  // ── 카드 ────────────────────────────────────────────────────
  const material = createCardMaterial({
    cardWidth: FORMATS.portrait.width, cardHeight: FORMATS.portrait.height, cornerRadius: CORNER_RADIUS,
  });
  syncMaterial(material, params);
  let cards = null;
  // 카드마다 천천히 따라가는 값: 상세로 갈 때의 추가 이동·회전, 크기, 밝기
  const poses = CARDS.map(() => ({ offX: 0, offY: 0, offZ: 0, turn: 0, scale: 1, shade: 1 }));
  function buildCards() {
    const format = FORMATS[params.format];
    material.userData.cardUniforms.uCardWidth.value = format.width; // 둥근 모서리 계산도 새 크기로
    material.userData.cardUniforms.uCardHeight.value = format.height;
    if (cards) {
      stage.scene.remove(cards.mesh);
      cards.dispose();
    }
    cards = createCardInstances({ count: CARDS.length, width: format.width, height: format.height, bend: 0, material });
    stage.scene.add(cards.mesh);
  }
  buildCards();

  // ── 상태 ────────────────────────────────────────────────────
  const state = {
    scrollTarget: 0,
    scrollCurrent: 0,
    snap: null,                 // { from, to, start, duration, ease } 한 장 넘어가는 중
    wheel: { acc: 0, last: -Infinity },
    drag: null,                 // { mode: 'card' | 'orbit', x, y, distance, card }
    selected: -1,               // 상세로 연 카드 (-1 = 없음)
    activeIndex: -1,            // 왼쪽 아래 정보에 보이는 카드
    entranceStart: performance.now() / 1000,
  };
  const orbit = {
    theta: 0, phi: START_PHI, radius: SHELF.camZ,
    thetaTarget: 0, phiTarget: START_PHI, radiusTarget: SHELF.camZ,
    savedRadius: SHELF.camZ,
    px: 0, py: 0, pxTarget: 0, pyTarget: 0, weight: 1,
  };
  const snapOn = () => !NARROW.matches; // 레퍼: 폰은 스냅 없이 부드럽게

  // 지금 가운데 카드를 지키면서 간격·모양을 바꾼다
  function keepCenter(apply) {
    const index = indexAt(state.scrollCurrent, params.spacing);
    apply();
    state.snap = null;
    state.scrollTarget = -index * params.spacing;
    state.scrollCurrent = state.scrollTarget;
  }

  // ── 글 (왼쪽 아래 정보·상세 패널) ─────────────────────────────
  const $ = (id) => document.getElementById(id);
  const meta = $('bk-meta');
  let metaTimer = 0;
  function fillMeta(i) {
    const card = CARDS[i];
    $('bk-meta-index').textContent = `${pad(i + 1)} / ${pad(CARDS.length)}`;
    $('bk-meta-title').textContent = card.title;
    $('bk-meta-author').textContent = card.name;
    $('bk-meta-year').textContent = card.year;
    $('bk-meta-category').textContent = card.category;
  }
  // 가운데 카드가 바뀌면 잠깐 흐려졌다가(0.15초) 새 글로 (레퍼 0.3초 전환)
  function showMeta(i, instant = false) {
    state.activeIndex = i;
    clearTimeout(metaTimer);
    if (instant) {
      fillMeta(i);
      return;
    }
    meta.classList.add('is-changing');
    metaTimer = setTimeout(() => {
      fillMeta(state.activeIndex);
      meta.classList.remove('is-changing');
    }, 150);
  }
  function fillDetail(i) {
    const card = CARDS[i];
    $('bk-detail-index').textContent = `${pad(i + 1)} / ${pad(CARDS.length)}`;
    $('bk-detail-title').textContent = card.title;
    $('bk-detail-year').textContent = card.year;
    $('bk-detail-category').textContent = card.category;
    $('bk-detail-blurb').textContent = card.blurb;
  }
  showMeta(0, true);

  function openDetail(i) {
    if (state.selected === i) return;
    if (state.selected < 0) orbit.savedRadius = orbit.radiusTarget;
    state.selected = i;
    fillDetail(i);
    page.classList.add('is-detail');
    stageEl.classList.remove('is-pointing');
    orbit.radiusTarget = SHELF.focusDistance; // 카메라가 14 → 8.4로 다가간다
  }
  function closeDetail() {
    if (state.selected < 0) return;
    state.selected = -1;
    page.classList.remove('is-detail');
    orbit.radiusTarget = orbit.savedRadius;
  }
  function setAbout(open) {
    page.classList.toggle('is-about', open);
    $('bk-about-btn').setAttribute('aria-expanded', String(open));
  }

  // 한 장 넘기기 (0.5초 easeInOutCubic, 넘어가는 동안 잠금)
  function step(direction) {
    if (state.snap || state.selected >= 0) return;
    const to = snapTarget(state.scrollTarget, params.spacing, direction);
    state.snap = { from: state.scrollCurrent, to, start: performance.now() / 1000, duration: SHELF.snapDuration, ease: easeInOutCubic };
    state.scrollTarget = to;
  }

  // ── 패널 ────────────────────────────────────────────────────
  const gui = createPanel('11 책 캐러셀 · 조절 패널');
  gui.close(); // 틀을 그대로 보이게 접어서 시작
  const shapeFolder = gui.addFolder('형태');
  shapeFolder.add(params, 'format', { '세로형': 'portrait', '가로형 16:9': 'landscape' }).name('카드 모양').onChange(() => {
    keepCenter(() => { params.spacing = FORMATS[params.format].spacing; });
    buildCards();
    gui.controllersRecursive().forEach((controller) => controller.updateDisplay());
  });
  shapeFolder.add(params, 'spacing', 2, 8, 0.05).name('카드 간격').onChange(() => keepCenter(() => {}));
  addTextureFolder(gui, { params, material, paperColor: paper });
  addSettingsButtons(gui, {
    params,
    defaults: DEFAULTS,
    onApply: () => {
      syncMaterial(material, params);
      keepCenter(() => {});
      buildCards();
    },
  });

  // ── 입력 ────────────────────────────────────────────────────
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pick(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return -1;
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, stage.camera);
    const hit = raycaster.intersectObject(cards.mesh, false)[0];
    return hit && hit.instanceId !== undefined ? hit.instanceId : -1;
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (page.classList.contains('is-about')) return;
    try { canvas.setPointerCapture(event.pointerId); } catch { /* 무시 */ }
    const card = pick(event.clientX, event.clientY);
    // 카드 위에서 누르면 줄 밀기, 빈 곳(또는 상세 중)이면 시점 돌리기 (레퍼와 같음)
    state.drag = { mode: card >= 0 && state.selected < 0 ? 'card' : 'orbit', x: event.clientX, y: event.clientY, distance: 0, card };
  });
  window.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      orbit.pxTarget = clamp(nx, -1, 1) * SHELF.parallaxTheta;
      orbit.pyTarget = clamp(ny, -1, 1) * SHELF.parallaxPhi;
    }
    const drag = state.drag;
    if (!drag) {
      if (event.target === canvas) stageEl.classList.toggle('is-pointing', state.selected < 0 && pick(event.clientX, event.clientY) >= 0);
      return;
    }
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    drag.x = event.clientX;
    drag.y = event.clientY;
    drag.distance += Math.abs(dx) + Math.abs(dy);
    if (drag.mode === 'card') {
      state.snap = null;
      state.scrollTarget += dx * SHELF.dragSpeed;
      state.scrollCurrent = state.scrollTarget;
    } else {
      orbit.thetaTarget -= dx * SHELF.orbitSpeed;
      orbit.phiTarget = clamp(orbit.phiTarget - dy * SHELF.orbitSpeed, SHELF.phiMin, SHELF.phiMax);
    }
  });
  function endDrag() {
    const drag = state.drag;
    if (!drag) return;
    state.drag = null;
    const click = drag.distance < SHELF.clickThreshold;
    if (drag.mode === 'card' && !click && snapOn()) {
      // 끌다 놓으면 가장 가까운 장으로 (스냅 0.5초 × 0.4, easeOut)
      const to = snapTarget(state.scrollTarget, params.spacing, 0);
      state.snap = { from: state.scrollCurrent, to, start: performance.now() / 1000, duration: Math.max(0.15, SHELF.releaseSnap), ease: easeOutCubic };
      state.scrollTarget = to;
    }
    if (click) {
      if (drag.card >= 0) openDetail(drag.card);
      else if (state.selected >= 0) closeDetail(); // 상세 중 빈 곳을 누르면 닫기
    }
  }
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);

  window.addEventListener('wheel', (event) => {
    if (event.target.closest?.('.lil-gui, .bk-about, .bk-detail')) return; // 패널 안 스크롤은 그대로
    event.preventDefault();
    if (state.selected >= 0 || page.classList.contains('is-about')) return;
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (snapOn()) {
      if (state.snap) return;
      const result = wheelStep(state.wheel, delta, performance.now());
      state.wheel = result.state;
      if (result.step) step(result.step);
      return;
    }
    state.scrollTarget -= delta * SHELF.wheelSpeed; // 폰: 스냅 없이
  }, { passive: false });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (state.selected >= 0) closeDetail();
      else setAbout(false);
      return;
    }
    if (state.selected >= 0) return;
    if (event.key === 'ArrowRight') step(1);
    if (event.key === 'ArrowLeft') step(-1);
  });
  $('bk-close').addEventListener('click', closeDetail);
  $('bk-about-btn').addEventListener('click', () => setAbout(!page.classList.contains('is-about')));

  // ── 매 프레임 ───────────────────────────────────────────────
  const dummy = new THREE.Object3D();
  const focus = { x: 0, y: 0, z: 0 };
  let lastTime = performance.now() / 1000;

  function frame() {
    const now = performance.now() / 1000;
    const dt = Math.min(0.05, now - lastTime) || 1 / 60;
    lastTime = now;
    const count = CARDS.length;
    const spacing = params.spacing;
    const total = spacing * count;

    // 1) 줄: 한 장 넘기는 중이면 곡선대로, 아니면 목표를 40%씩 따라간다
    if (state.snap) {
      const s = state.snap;
      const t = clamp((now - s.start) / s.duration, 0, 1);
      state.scrollCurrent = s.from + (s.to - s.from) * s.ease(t);
      state.scrollTarget = state.scrollCurrent;
      if (t >= 1) {
        state.scrollCurrent = s.to;
        state.scrollTarget = s.to;
        state.snap = null;
      }
    } else {
      state.scrollCurrent += (state.scrollTarget - state.scrollCurrent) * followFactor(SHELF.follow, dt);
    }

    // 2) 카드: 가운데까지 거리 r → 물러남·회전·크기·밝기, 상세면 고른 카드만 가운데로, 등장·화면 끝 사라짐
    const follow = followFactor(SHELF.cardFollow, dt);
    const entranceTime = reduced ? Infinity : now - state.entranceStart;
    const detailOffset = NARROW.matches ? SHELF.narrowDetailOffset : SHELF.detailOffset;
    let nearest = 0;
    let nearestDistance = Infinity;
    for (let i = 0; i < count; i++) {
      const r = wrapOffset(i * spacing + state.scrollCurrent, total);
      const pose = cardPose(r, spacing);
      let offX = 0;
      let offY = 0;
      let offZ = 0;
      let turn = 0;
      let scale = pose.scale;
      let shade = pose.shade;
      if (state.selected >= 0) {
        if (i === state.selected) {
          offX = -r + detailOffset.x; // 가운데로 와서 (오른쪽 패널 자리를 비우게) 옆으로
          offY = detailOffset.y;
          offZ = -pose.z;             // 물러남·회전을 되돌려 정면으로
          turn = -pose.rotY;
          scale = SHELF.detailScale;
          shade = 1;
        } else {
          shade = 0;
        }
      }
      const p = poses[i];
      p.offX += (offX - p.offX) * follow;
      p.offY += (offY - p.offY) * follow;
      p.offZ += (offZ - p.offZ) * follow;
      p.turn += (turn - p.turn) * follow;
      p.scale += (scale - p.scale) * follow;
      p.shade += (shade - p.shade) * follow;

      const rise = entrancePose(i, count, entranceTime);
      const visible = state.selected >= 0 && i !== state.selected
        ? 0
        : Math.max(0.05, p.shade * edgeFade(r, total / 2) * rise.shade);
      dummy.position.set(r + p.offX + rise.x, p.offY + rise.y, pose.z + p.offZ + rise.z);
      dummy.rotation.set(0, pose.rotY + p.turn, 0);
      dummy.scale.setScalar(visible > 0.02 ? p.scale * rise.scale : 0);
      dummy.updateMatrix();
      cards.mesh.setMatrixAt(i, dummy.matrix);
      cards.setDim(i, visible);
      if (Math.abs(r) < nearestDistance) {
        nearestDistance = Math.abs(r);
        nearest = i;
      }
    }
    cards.commit();
    if (state.selected < 0 && nearest !== state.activeIndex) showMeta(centerIndex(state.scrollCurrent, spacing, count));

    // 3) 카메라: 초점 둘레를 돌고(끌기), 커서를 살짝 따라가고(끄는 동안은 끔), 상세면 다가간다
    const kOrbit = followFactor(SHELF.orbitFollow, dt);
    orbit.theta += (orbit.thetaTarget - orbit.theta) * kOrbit;
    orbit.phi += (orbit.phiTarget - orbit.phi) * kOrbit;
    orbit.radius += (orbit.radiusTarget - orbit.radius) * kOrbit;
    const kParallax = followFactor(SHELF.parallaxFollow, dt);
    orbit.px += (orbit.pxTarget - orbit.px) * kParallax;
    orbit.py += (orbit.pyTarget - orbit.py) * kParallax;
    orbit.weight += ((state.drag || reduced ? 0 : 1) - orbit.weight) * followFactor(SHELF.parallaxWeightFollow, dt);
    const theta = orbit.theta + orbit.px * orbit.weight;
    const phi = clamp(orbit.phi + orbit.py * orbit.weight, SHELF.phiMin, SHELF.phiMax);
    const cam = orbitPosition(theta, phi, orbit.radius, focus);
    stage.camera.position.set(cam.x, cam.y, cam.z);
    stage.camera.lookAt(focus.x, focus.y, focus.z);
    const fov = fovFor(stage.camera.aspect);
    if (Math.abs(stage.camera.fov - fov) > 1e-3) {
      stage.camera.fov = fov;
      stage.camera.updateProjectionMatrix();
    }

    stage.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

main();
```

- [ ] **Step 3: 문법 확인** — Run: `node --check demos/11-books/main.js` / Expected: 출력 없음

- [ ] **Step 4: 아카이브 `index.html`에 11 추가** (10 `</li>` 다음)

```html
      <li>
        <a class="demo-item" href="demos/11-books/">
          <span class="demo-index">11</span>
          <span class="demo-name">책 캐러셀</span>
          <span class="demo-status">완성</span>
          <span class="demo-desc">종이 카드가 책처럼 한 줄로 서 있고, 휠로 한 장씩 넘기다 누르면 커지면서 정보가 나와.</span>
        </a>
      </li>
```

---

### Task 5: 전체 테스트 + 레퍼와 나란히 확인

- [ ] **Step 1:** Run: `npm test` / Expected: fail 0
- [ ] **Step 2:** 로컬 서버(백그라운드 `python3 -m http.server 8123`) → 내장 브라우저 1440×900로 `http://127.0.0.1:8123/demos/11-books/`. 콘솔 에러 0, 파일·글꼴 로딩 실패 0, 계산된 글꼴(Anybody·Chivo Mono·Inter·General Sans) 확인.
- [ ] **Step 3:** 레퍼 `https://boookish.framer.website/`와 같은 크기 스크린샷 비교: 왼쪽 띠·버튼·왼쪽 아래 정보 위치와 글자 값(크기·자간·두께), 가운데·양옆 카드 크기·각도.
- [ ] **Step 4:** 휠 한 장(0.5초) → 정보 바뀜, 카드 끌기 → 놓으면 가까운 장, 빈 곳 끌기 → 시점 회전, 클릭 → 상세(카드 왼쪽 0.8·0.9배, 오른쪽 패널), Close·Esc·빈 곳 클릭으로 닫기, ← → 키, 소개 패널(페이지 450px 밀림).
- [ ] **Step 5:** 패널 가로형 16:9 전환(가운데 카드 유지), 폰 375×812(띠 40px·ABOUT·스냅 없이·상세 위치). 마치면 화면 크기 원래대로, 서버 끄기, 메모리 갱신. 커밋은 사용자가 말할 때.
