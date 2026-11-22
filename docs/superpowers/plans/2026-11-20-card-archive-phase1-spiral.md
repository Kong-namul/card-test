# 카드 아카이브 1단계 (공통 기반 + 01 나선) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 3D 카드 아카이브의 공통 부품(`shared/`)과 첫 데모 "01 나선"(Grail식 휜 카드 나선), 아카이브 첫 화면(`index.html`)을 만든다.

**Architecture:** 빌드 도구 없는 순수 HTML + ES 모듈. Three.js는 CDN importmap으로 불러온다. 계산만 하는 순수 함수(관성, 휨, 나선 배치, 설정 직렬화, 질감 프리셋)는 Three.js 없이 따로 두고 Node 내장 테스트 러너로 TDD 한다. Three.js를 쓰는 부품(무대, 재질, 지오메트리, 패널)은 앱 안 브라우저에서 눈으로 검증한다.

**Tech Stack:** three@0.187.0 (WebGLRenderer, MeshPhysicalMaterial, InstancedMesh, EffectComposer, AfterimagePass, RoomEnvironment, lil-gui), Pretendard 1.3.9, Node 25 `node --test`, Python 3 `http.server`.

**Spec:** `docs/superpowers/specs/2026-11-20-card-archive-3d-design.md`

## Global Constraints

- Three.js는 `three@0.187.0`으로 고정한다. importmap: `"three": "https://cdn.jsdelivr.net/npm/three@0.187.0/build/three.module.js"`, `"three/addons/": "https://cdn.jsdelivr.net/npm/three@0.187.0/examples/jsm/"`.
- Pretendard는 `https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css`로 고정한다.
- 빌드 도구, React, npm 의존성은 쓰지 않는다. `package.json`에는 테스트 스크립트만 둔다.
- 색·폰트·글자 크기는 `shared/tokens.css`(SSOT)에서만 가져온다. 페이지 CSS나 JS에 UI 색을 하드코딩하지 않는다. 글자 크기는 72/48/32/24/22/18/14px만 쓴다. 토큰에 없는 값이 필요하면 만들지 말고 사용자에게 먼저 묻는다.
- 제목은 흰색 단색이다. 보라 등 포인트 색은 넣지 않는다.
- 공통 CSS/JS를 수정하면 그 파일을 불러오는 모든 곳의 `?v=` 숫자를 올린다. 이번 단계는 모두 `?v=1`로 시작한다.
- 코드 주석은 한국어로, "무엇을 하는지 + 왜 이 숫자인지"를 적는다.
- Grail 코드는 복사하지 않는다. 기법만 참고해 새로 작성한다.
- 이 폴더는 git 저장소가 아니다. 커밋 단계는 없다(사용자가 원하면 그때 추가).
- 로컬 서버: `card/` 폴더에서 `python3 -m http.server 8123`. 앱 안 브라우저 주소는 `http://localhost:8123/`.

## 파일 구조

| 파일 | 역할 | 테스트 |
|---|---|---|
| `package.json` | `npm test` 스크립트만 | — |
| `.claude/launch.json` | 앱 안 브라우저용 로컬 서버 설정 | — |
| `shared/motion.js` | 순수 수학: clamp, lerp, damp, smoothstep, 이징, 깊이 어둠, 자석, `Inertia`, 모션 줄이기 감지 | `tests/motion.test.js` |
| `shared/bend.js` | 순수: 카드 정점 배열을 휘게 만드는 함수 | `tests/bend.test.js` |
| `shared/texture-presets.js` | 순수: 질감 프리셋 5종 표 + 프리셋 → 패널 값 변환 | `tests/texture-presets.test.js` |
| `shared/settings.js` | 순수: 설정 JSON 직렬화/파싱 | `tests/settings.test.js` |
| `shared/tokens.css` | 색·폰트·크기 토큰 (SSOT) | 브라우저 |
| `shared/base.css` | 데모 페이지·아카이브 공통 레이아웃, lil-gui 테마 | 브라우저 |
| `shared/stage.js` | 렌더러·카메라·조명 환경·후처리·리사이즈, WebGL 실패 안내 | 브라우저 |
| `shared/card-material.js` | MeshPhysicalMaterial + 인스턴스별 어둡기·뒤집기 셰이더 패치, 프리셋 반영 | 브라우저 |
| `shared/card-geometry.js` | 휜 카드 지오메트리, 카드 인스턴스 묶음 | 브라우저 |
| `shared/panel.js` | lil-gui 패널 생성 + 설정 복사/붙여넣기/기본값 버튼 | 브라우저 |
| `demos/01-spiral/layout.js` | 순수: 나선 위 카드 위치 계산 | `tests/spiral-layout.test.js` |
| `demos/01-spiral/main.js` | 01 나선 장면 조립, 입력, 애니메이션 루프, 패널 | 브라우저 |
| `demos/01-spiral/index.html` | 01 나선 페이지 | 브라우저 |
| `index.html` | 아카이브 첫 화면 | 브라우저 |

**스펙과 다른 점 (1단계 한정):** 첫 화면 썸네일 이미지는 캡처 도구가 따로 필요해서 1단계에선 넣지 않고, 번호·이름·설명·상태만 있는 글자 목록으로 만든다. 데모가 여러 개 쌓이면 2단계에서 추가한다.

---

### Task 1: 프로젝트 뼈대 + 순수 수학 `motion.js`

**Files:**
- Create: `package.json`
- Create: `.claude/launch.json`
- Create: `shared/motion.js`
- Test: `tests/motion.test.js`

**Interfaces:**
- Produces (`shared/motion.js`):
  - `clamp(v: number, min: number, max: number): number`
  - `lerp(a: number, b: number, t: number): number`
  - `damp(current: number, target: number, rate: number, dt: number): number` — 프레임레이트와 무관한 감쇠 보간
  - `smoothstep(edge0: number, edge1: number, x: number): number`
  - `easeOutCubic(t: number): number`, `easeInOutCubic(t: number): number` — 입력은 0~1로 잘린다
  - `depthDim(facing: number, minBrightness: number): number` — facing은 -1(뒤)~1(정면)
  - `magnetOffset(x, y, px, py, strength, radius): {x: number, y: number}`
  - `class Inertia { target; current; velocity; constructor({follow = 8, velocitySmoothing = 0.25} = {}); update(dt: number): number }`
  - `prefersReducedMotion(): boolean`

- [ ] **Step 1: 프로젝트 설정 파일 작성**

`package.json`:
```json
{
  "name": "card-archive",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test \"tests/*.test.js\""
  }
}
```

`.claude/launch.json`:
```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "card",
      "runtimeExecutable": "python3",
      "runtimeArgs": ["-m", "http.server", "8123"],
      "port": 8123
    }
  ]
}
```

- [ ] **Step 2: 실패하는 테스트 작성** — `tests/motion.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clamp, lerp, damp, smoothstep, easeOutCubic, easeInOutCubic,
  depthDim, magnetOffset, Inertia,
} from '../shared/motion.js';

// 부동소수점 비교용: 아주 작은 오차는 같은 값으로 본다
const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('clamp는 범위 밖 값을 경계로 자른다', () => {
  assert.equal(clamp(5, 0, 1), 1);
  assert.equal(clamp(-1, 0, 1), 0);
  close(clamp(0.3, 0, 1), 0.3);
});

test('lerp는 t=0이면 a, t=1이면 b, 중간이면 사이값', () => {
  close(lerp(2, 10, 0), 2);
  close(lerp(2, 10, 1), 10);
  close(lerp(2, 10, 0.5), 6);
});

test('damp는 프레임을 둘로 쪼개도 결과가 같다 (프레임레이트 무관)', () => {
  const once = damp(0, 10, 8, 0.1);
  const twice = damp(damp(0, 10, 8, 0.05), 10, 8, 0.05);
  close(once, twice);
  assert.ok(once > 0 && once < 10);
});

test('smoothstep 경계 밖은 0과 1, 가운데는 0.5', () => {
  close(smoothstep(0, 1, -1), 0);
  close(smoothstep(0, 1, 2), 1);
  close(smoothstep(0, 1, 0.5), 0.5);
});

test('이징 함수는 0→0, 1→1, 범위 밖은 잘린다', () => {
  close(easeOutCubic(0), 0);
  close(easeOutCubic(1), 1);
  close(easeOutCubic(2), 1);
  close(easeInOutCubic(0), 0);
  close(easeInOutCubic(1), 1);
  close(easeInOutCubic(0.5), 0.5);
});

test('depthDim: 정면 1, 정반대 뒤는 최소 밝기, 옆은 0.5', () => {
  close(depthDim(1, 0.3), 1);
  close(depthDim(-1, 0.3), 0.3);
  close(depthDim(0, 0.3), 0.5);
});

test('magnetOffset: 세기 0이면 그대로, 멀면 거의 0, 가까우면 커서 쪽으로', () => {
  const none = magnetOffset(0, 0, 1, 0, 0, 3);
  close(none.x, 0);
  close(none.y, 0);
  const far = magnetOffset(0, 0, 100, 0, 0.1, 3);
  close(far.x, 0, 1e-9);
  const near = magnetOffset(0, 0, 1, 0, 0.1, 3);
  close(near.x, 0.1 * Math.exp(-1 / 9));
  close(near.y, 0);
});

test('Inertia는 목표를 서서히 따라가고, 속도가 생겼다가 멈추면 사라진다', () => {
  const inertia = new Inertia({ follow: 8 });
  inertia.target = 10;
  inertia.update(1 / 60);
  assert.ok(inertia.current > 0 && inertia.current < 10);
  assert.ok(inertia.velocity > 0);
  for (let i = 0; i < 600; i++) inertia.update(1 / 60);
  close(inertia.current, 10, 1e-3);
  assert.ok(Math.abs(inertia.velocity) < 0.01);
});
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

Run: `cd "/Users/sang/Desktop/ai for work/card" && npm test`
Expected: FAIL — `Cannot find module '.../shared/motion.js'`

- [ ] **Step 4: `shared/motion.js` 구현**

```js
// ─────────────────────────────────────────────────────────────
// motion.js — 움직임에 쓰는 순수 수학 함수 모음
// Three.js 없이 숫자만 다루기 때문에 Node 테스트로 검증할 수 있어.
// ─────────────────────────────────────────────────────────────

// 값을 min~max 사이로 잘라낸다. (예: 밝기가 1을 넘지 않게)
export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

// a에서 b까지 t(0~1)만큼 간 지점. t=0.5면 정확히 가운데.
export const lerp = (a, b, t) => a + (b - a) * t;

// "쫀득한 관성"의 핵심.
// 매 프레임 목표까지 남은 거리의 일부만 따라간다.
// rate가 클수록 빨리 따라붙고, dt(프레임 간격)를 반영해서
// 60fps든 120fps든 같은 속도로 움직인다.
export const damp = (current, target, rate, dt) =>
  lerp(current, target, 1 - Math.exp(-rate * dt));

// edge0~edge1 구간에서 0→1로 부드럽게 올라가는 S자 곡선.
// 카드가 나선 끝에서 서서히 사라지게 할 때 쓴다.
export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

// 빠르게 출발해서 천천히 멈추는 이징. (등장 연출용)
export const easeOutCubic = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

// 천천히 출발 → 빨라졌다가 → 천천히 멈추는 이징. (카드 뒤집기용)
export function easeInOutCubic(t) {
  const x = clamp(t, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

// "깊이 어둠": 진짜 그림자 대신 뒤쪽 카드를 어둡게 칠하는 트릭.
// facing = 카드가 카메라를 얼마나 정면으로 보는지 (1=정면, 0=옆, -1=완전히 뒤)
// 정면은 밝기 1, 옆은 0.5, 뒤로 갈수록 minBrightness까지 어두워진다.
export const depthDim = (facing, minBrightness) =>
  clamp(0.5 + 0.5 * facing, minBrightness, 1);

// "자석": 커서(px, py) 근처에 있는 카드를 커서 쪽으로 살짝 끌어당긴다.
// 거리가 radius보다 멀어질수록 끌림이 종 모양(가우시안)으로 빠르게 약해진다.
// strength 0.1이면 커서까지 거리의 최대 10%만큼 끌려온다.
export function magnetOffset(x, y, px, py, strength, radius) {
  const dx = px - x;
  const dy = py - y;
  const weight = strength * Math.exp(-(dx * dx + dy * dy) / (radius * radius));
  return { x: dx * weight, y: dy * weight };
}

// 스크롤·드래그 입력을 쫀득하게 따라가는 관성 장치.
// target(입력이 원하는 위치)을 current(실제 화면 위치)가 damp로 따라간다.
// velocity는 초당 이동량인데, 매 프레임 튀지 않게 평균을 내서 부드럽게 만든다.
// (잔상 세기를 속도에 맞출 때 이 값을 쓴다)
export class Inertia {
  constructor({ follow = 8, velocitySmoothing = 0.25 } = {}) {
    this.target = 0;
    this.current = 0;
    this.velocity = 0;
    this.follow = follow; // 따라붙는 속도. 클수록 덜 쫀득하고 즉각적이다
    this.velocitySmoothing = velocitySmoothing; // 0~1. 작을수록 속도가 더 부드럽게 변한다
  }

  update(dt) {
    const previous = this.current;
    this.current = damp(this.current, this.target, this.follow, dt);
    // 거의 다 따라왔으면 딱 붙여서 미세한 떨림을 없앤다
    if (Math.abs(this.target - this.current) < 1e-4) this.current = this.target;
    const instant = dt > 0 ? (this.current - previous) / dt : 0;
    this.velocity += (instant - this.velocity) * this.velocitySmoothing;
    return this.current;
  }
}

// 사용자가 운영체제에서 "동작 줄이기"를 켰는지 확인한다.
// 켜져 있으면 자동 회전과 등장 연출을 끈다. (Node 테스트 환경에선 false)
export function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd "/Users/sang/Desktop/ai for work/card" && npm test`
Expected: PASS — `# pass 8`, `# fail 0`

---

### Task 2: 순수 부품 3종 — 휨, 질감 프리셋, 설정 직렬화

**Files:**
- Create: `shared/bend.js`, `shared/texture-presets.js`, `shared/settings.js`
- Test: `tests/bend.test.js`, `tests/texture-presets.test.js`, `tests/settings.test.js`

**Interfaces:**
- Produces (`shared/bend.js`): `bendPositions(positions: Float32Array, bend: number, bow = 0.35): Float32Array` — z를 절대값으로 덮어쓰므로 여러 번 불러도 누적되지 않는다.
- Produces (`shared/texture-presets.js`):
  - `TEXTURE_PRESETS: Record<string, {clearcoat, clearcoatRoughness, roughness, metalness, iridescence, tint: string|null}>`
  - `PRESET_NAMES: string[]` = `['무광 종이', '유광 코팅', '홀로그램 박', '금박', '은박']`
  - `DEFAULT_PRESET = '홀로그램 박'`
  - `presetToParams(name: string, paperColor: string): {preset, gloss, roughness, rainbow, cardColor}`
- Produces (`shared/settings.js`):
  - `serializeSettings(params: object, defaults: object): string`
  - `parseSettings(text: string, defaults: object): object` — 실패 시 `Error('설정 형식이 올바르지 않아요 …')`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/bend.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bendPositions } from '../shared/bend.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('가운데는 그대로, 양옆 가장자리는 뒤로(-z), 좌우 대칭, 세로는 bow 비율만큼', () => {
  // 정점 4개: 가운데, 오른쪽 끝, 왼쪽 끝, 위쪽 끝
  const pos = new Float32Array([0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 1, 0]);
  bendPositions(pos, 0.1, 0.35);
  close(pos[2], 0);
  close(pos[5], -0.1);
  close(pos[8], -0.1);
  close(pos[11], -0.035);
});

test('bend 0이면 평평하고, 다시 휘어도 누적되지 않는다', () => {
  const a = new Float32Array([1, 0, 0]);
  bendPositions(a, 0.2);
  bendPositions(a, 0.1);
  close(a[2], -0.1);
  bendPositions(a, 0);
  close(a[2], 0);
});
```

`tests/texture-presets.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEXTURE_PRESETS, PRESET_NAMES, DEFAULT_PRESET, presetToParams } from '../shared/texture-presets.js';

test('프리셋 5종이 정해진 순서로 있고, 기본값은 홀로그램 박', () => {
  assert.deepEqual(PRESET_NAMES, ['무광 종이', '유광 코팅', '홀로그램 박', '금박', '은박']);
  assert.equal(DEFAULT_PRESET, '홀로그램 박');
  assert.ok(TEXTURE_PRESETS[DEFAULT_PRESET]);
});

test('종이 계열은 종이색, 금박·은박은 박 고유색을 카드 색으로 쓴다', () => {
  const holo = presetToParams('홀로그램 박', '#F4F1EA');
  assert.equal(holo.preset, '홀로그램 박');
  assert.equal(holo.cardColor, '#F4F1EA');
  assert.equal(holo.gloss, TEXTURE_PRESETS['홀로그램 박'].clearcoat);
  assert.equal(holo.rainbow, TEXTURE_PRESETS['홀로그램 박'].iridescence);
  const gold = presetToParams('금박', '#F4F1EA');
  assert.equal(gold.cardColor, TEXTURE_PRESETS['금박'].tint);
});

test('없는 프리셋 이름이면 에러', () => {
  assert.throws(() => presetToParams('플라스틱', '#FFFFFF'), /없는 질감 프리셋/);
});
```

`tests/settings.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serializeSettings, parseSettings } from '../shared/settings.js';

const DEFAULTS = { preset: '홀로그램 박', gloss: 1, count: 36, cardColor: '#F4F1EA', auto: true };

test('직렬화 → 파싱 왕복하면 같은 값이 나온다', () => {
  const params = { ...DEFAULTS, gloss: 0.5, count: 20 };
  const parsed = parseSettings(serializeSettings(params, DEFAULTS), DEFAULTS);
  assert.deepEqual(parsed, { preset: '홀로그램 박', gloss: 0.5, count: 20, cardColor: '#F4F1EA', auto: true });
});

test('직렬화는 defaults에 있는 키만, 숫자는 소수 4자리로 반올림', () => {
  const text = serializeSettings({ ...DEFAULTS, gloss: 0.123456, extra: 1 }, DEFAULTS);
  const data = JSON.parse(text);
  assert.equal(data.gloss, 0.1235);
  assert.equal('extra' in data, false);
});

test('모르는 키와 타입이 다른 값은 버린다', () => {
  const parsed = parseSettings('{"gloss":"많이","zzz":1,"count":20}', DEFAULTS);
  assert.deepEqual(parsed, { count: 20 });
});

test('JSON이 아니거나 객체가 아니면 에러', () => {
  assert.throws(() => parseSettings('그냥 글자', DEFAULTS), /설정 형식이 올바르지 않아요/);
  assert.throws(() => parseSettings('[1,2]', DEFAULTS), /설정 형식이 올바르지 않아요/);
  assert.throws(() => parseSettings('null', DEFAULTS), /설정 형식이 올바르지 않아요/);
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd "/Users/sang/Desktop/ai for work/card" && npm test`
Expected: FAIL — `bend.js`, `texture-presets.js`, `settings.js`를 찾을 수 없음 (motion 테스트 8개는 통과)

- [ ] **Step 3: 세 파일 구현**

`shared/bend.js`:
```js
// ─────────────────────────────────────────────────────────────
// bend.js — 평평한 카드를 종이처럼 휘게 만드는 계산
// ─────────────────────────────────────────────────────────────
// positions: [x, y, z, x, y, z, ...] 형태의 정점 좌표 배열
// bend: 휨 세기. 가로 가장자리(x=±1)가 bend만큼 뒤로(-z) 말린다
// bow: 세로 방향 휨 비율. 0.35면 위아래는 가로의 35%만큼만 휜다
//
// z = -(bend·x² + bend·bow·y²)
// x²을 쓰는 이유: 가운데는 거의 그대로, 가장자리로 갈수록 급하게 말려서
// 실제 종이를 양손으로 살짝 쥔 것 같은 곡면이 나온다.
// z를 "더하지" 않고 "덮어쓰기" 때문에 슬라이더로 여러 번 바꿔도 누적되지 않는다.
export function bendPositions(positions, bend, bow = 0.35) {
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    positions[i + 2] = -(bend * x * x + bend * bow * y * y);
  }
  return positions;
}
```

`shared/texture-presets.js`:
```js
// ─────────────────────────────────────────────────────────────
// texture-presets.js — 카드 질감 프리셋 5종
// Three.js MeshPhysicalMaterial의 값들을 이름 붙여 묶어둔 표야.
//   clearcoat          : 투명 코팅층 세기 (0=없음, 1=유광 코팅)
//   clearcoatRoughness : 코팅층이 얼마나 뿌연지 (낮을수록 빛줄기가 날카롭다)
//   roughness          : 종이 자체의 거칠기 (높을수록 무광)
//   metalness          : 금속 느낌 (1이면 금속처럼 주변을 반사)
//   iridescence        : 보는 각도에 따라 무지개빛이 도는 정도 (홀로그램 박)
//   tint               : 금속 박의 고유색. null이면 종이색(토큰 --card-paper)을 쓴다
// 금·은 색은 페이지 UI 색이 아니라 "재질 값"이라서 토큰이 아니라 이 표 한곳에만 둔다.
// ─────────────────────────────────────────────────────────────
export const TEXTURE_PRESETS = {
  '무광 종이': { clearcoat: 0, clearcoatRoughness: 0.6, roughness: 0.92, metalness: 0, iridescence: 0, tint: null },
  '유광 코팅': { clearcoat: 1, clearcoatRoughness: 0.08, roughness: 0.55, metalness: 0, iridescence: 0, tint: null },
  '홀로그램 박': { clearcoat: 1, clearcoatRoughness: 0.06, roughness: 0.4, metalness: 0.15, iridescence: 0.7, tint: null },
  '금박': { clearcoat: 0.6, clearcoatRoughness: 0.1, roughness: 0.28, metalness: 1, iridescence: 0, tint: '#D4AF6A' },
  '은박': { clearcoat: 0.6, clearcoatRoughness: 0.1, roughness: 0.22, metalness: 1, iridescence: 0, tint: '#D9DCE1' },
};

export const PRESET_NAMES = Object.keys(TEXTURE_PRESETS);
export const DEFAULT_PRESET = '홀로그램 박';

// 프리셋을 고르면 패널 슬라이더에 들어갈 값들로 바꿔준다.
// (패널에선 광택·거칠기·무지개·카드 색을 다시 손으로 조절할 수 있다)
export function presetToParams(name, paperColor) {
  const preset = TEXTURE_PRESETS[name];
  if (!preset) throw new Error(`없는 질감 프리셋: ${name}`);
  return {
    preset: name,
    gloss: preset.clearcoat,
    roughness: preset.roughness,
    rainbow: preset.iridescence,
    cardColor: preset.tint ?? paperColor,
  };
}
```

`shared/settings.js`:
```js
// ─────────────────────────────────────────────────────────────
// settings.js — 조절 패널 값을 글자(JSON)로 바꾸고, 다시 읽어오는 함수
// "설정 복사" / "설정 붙여넣기" 버튼이 이걸 쓴다.
// ─────────────────────────────────────────────────────────────

// defaults에 있는 키만 골라서 보기 좋은 JSON 글자로 만든다.
// 숫자는 소수 4자리로 반올림해서 0.30000000000000004 같은 지저분한 값을 없앤다.
export function serializeSettings(params, defaults) {
  const out = {};
  for (const key of Object.keys(defaults)) {
    const value = params[key];
    out[key] = typeof value === 'number' ? Math.round(value * 10000) / 10000 : value;
  }
  return JSON.stringify(out, null, 2);
}

// 붙여넣은 글자를 읽어서, defaults에 있는 키이고 타입도 같은 값만 돌려준다.
// 오타나 다른 데모의 설정을 붙여넣어도 화면이 깨지지 않게 하기 위해서야.
export function parseSettings(text, defaults) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('설정 형식이 올바르지 않아요 (JSON 글자가 아니에요)');
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('설정 형식이 올바르지 않아요 ({ } 모양이 아니에요)');
  }
  const out = {};
  for (const key of Object.keys(defaults)) {
    if (key in data && typeof data[key] === typeof defaults[key]) out[key] = data[key];
  }
  return out;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd "/Users/sang/Desktop/ai for work/card" && npm test`
Expected: PASS — `# pass 17`, `# fail 0`

---

### Task 3: 디자인 토큰 + 공통 CSS + 아카이브 첫 화면

**Files:**
- Create: `shared/tokens.css`, `shared/base.css`, `index.html`

**Interfaces:**
- Produces (CSS 변수): `--bg-1`, `--bg-2`, `--card-paper`, `--fg-1`, `--fg-2`, `--fg-3`, `--border`, `--font-body`, `--text-{72,48,32,24,22,18,14}`, `--lh-{72,48,32,24,22,18,14}`
- Produces (CSS 클래스, 데모 페이지용): `.back-link`, `.stage-wrap`, `.stage`, `.stage-caption`, `.caption-index`, `.caption-hint`, `.notes`, `.fallback`, `.lil-gui.card-panel`
- Produces (CSS 클래스, 아카이브용): `.archive-main`, `.archive-intro`, `.demo-list`, `.demo-item`, `.demo-index`, `.demo-name`, `.demo-desc`, `.demo-status`, `.is-soon`

- [ ] **Step 1: `shared/tokens.css` 작성**

```css
/* ─────────────────────────────────────────────────────────────
 * tokens.css — card 아카이브의 색·폰트·글자 크기 공통 파일 (SSOT)
 * 모든 페이지와 3D 장면은 여기 있는 값만 쓴다.
 * 새 값이 필요하면 임의로 만들지 말고 먼저 물어본 뒤 여기에 추가한다.
 * ───────────────────────────────────────────────────────────── */
:root {
  /* 배경 */
  --bg-1: #0B0B0C;            /* 페이지·3D 장면 배경 */
  --bg-2: #161618;            /* 노트 영역, 목록 카드 배경 */

  /* 카드 */
  --card-paper: #F4F1EA;      /* 무지 카드 기본색 (오프화이트) */

  /* 글자 */
  --fg-1: #FFFFFF;                    /* 제목, 강조 */
  --fg-2: rgba(255, 255, 255, 0.64);  /* 본문 */
  --fg-3: rgba(255, 255, 255, 0.40);  /* 캡션, 메타 정보 */

  /* 선 */
  --border: rgba(255, 255, 255, 0.12);

  /* 폰트 */
  --font-body: 'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif;

  /* 글자 크기 — 이 스케일에 있는 값만 쓴다 */
  --text-72: 72px;
  --text-48: 48px;
  --text-32: 32px;
  --text-24: 24px;
  --text-22: 22px;
  --text-18: 18px;
  --text-14: 14px;

  /* 줄 간격 — 각 글자 크기와 짝 */
  --lh-72: 88px;
  --lh-48: 58px;
  --lh-32: 40px;
  --lh-24: 32px;
  --lh-22: 32px;
  --lh-18: 28px;
  --lh-14: 20px;
}
```

- [ ] **Step 2: `shared/base.css` 작성**

```css
/* ─────────────────────────────────────────────────────────────
 * base.css — 데모 페이지와 아카이브 첫 화면의 공통 레이아웃
 * 색·크기는 전부 tokens.css 변수만 쓴다.
 * ───────────────────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; }

html, body {
  margin: 0;
  background: var(--bg-1);
  color: var(--fg-2);
  font-family: var(--font-body);
  font-size: var(--text-18);
  line-height: var(--lh-18);
  -webkit-font-smoothing: antialiased;
}

h1 {
  margin: 0;
  color: var(--fg-1);
  font-size: var(--text-48);
  line-height: var(--lh-48);
  font-weight: 600;
  letter-spacing: -0.02em;
}

h2 {
  margin: 0 0 16px;
  color: var(--fg-1);
  font-size: var(--text-24);
  line-height: var(--lh-24);
  font-weight: 600;
}

a { color: var(--fg-1); }

/* ── 데모 페이지 ──────────────────────────────────────────── */

/* 왼쪽 위 "← 아카이브" 링크 */
.back-link {
  position: fixed;
  top: 20px;
  left: 24px;
  z-index: 10;
  color: var(--fg-2);
  font-size: var(--text-14);
  line-height: var(--lh-14);
  text-decoration: none;
}
.back-link:hover { color: var(--fg-1); }

/* 스크롤 공간: 이 높이만큼 스크롤하는 동안 3D 장면이 화면에 붙어 있고,
   스크롤 양이 카드를 감는 입력이 된다. 다 내리면 노트가 나온다. */
.stage-wrap { height: 400svh; }

.stage {
  position: sticky;
  top: 0;
  height: 100svh;
  overflow: hidden;
}

.stage canvas {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: pan-y; /* 모바일에선 세로 스와이프 = 페이지 스크롤 = 카드 감기 */
  cursor: grab;
}
.stage canvas:active { cursor: grabbing; }

/* 왼쪽 아래 데모 이름·설명·조작법 */
.stage-caption {
  position: absolute;
  left: 24px;
  bottom: 24px;
  max-width: 360px;
  pointer-events: none;
}
.stage-caption p { margin: 8px 0 0; }
.caption-index {
  color: var(--fg-3);
  font-size: var(--text-14);
  line-height: var(--lh-14);
}
.caption-hint {
  color: var(--fg-3);
  font-size: var(--text-14);
  line-height: var(--lh-14);
}

/* 스크롤 아래 기법 노트 */
.notes {
  max-width: 720px;
  margin: 0 auto;
  padding: 96px 24px 128px;
}
.notes section + section { margin-top: 64px; }
.notes dl { margin: 0; }
.notes dt {
  margin-top: 24px;
  color: var(--fg-1);
  font-weight: 600;
}
.notes dd { margin: 4px 0 0; }

/* WebGL을 못 쓰는 브라우저 안내 */
.fallback {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  color: var(--fg-2);
  text-align: center;
}

/* 조절 패널(lil-gui) 테마 — 토큰 색만 연결한다 */
.lil-gui.card-panel {
  --background-color: var(--bg-2);
  --title-background-color: var(--bg-2);
  --title-text-color: var(--fg-1);
  --text-color: var(--fg-2);
  --widget-color: var(--border);
  --hover-color: var(--border);
  --focus-color: var(--border);
  --number-color: var(--fg-1);
  --string-color: var(--fg-1);
  --font-family: var(--font-body);
  --font-size: var(--text-14);
  --input-font-size: var(--text-14);
  --widget-height: 28px;
  --spacing: 8px;
}

/* ── 아카이브 첫 화면 ─────────────────────────────────────── */
.archive-main {
  max-width: 960px;
  margin: 0 auto;
  padding: 120px 24px 128px;
}
.archive-intro { margin: 16px 0 0; }

.demo-list {
  margin: 72px 0 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--border);
}

.demo-item {
  display: grid;
  grid-template-columns: 72px 1fr auto;
  gap: 8px 24px;
  align-items: baseline;
  padding: 32px 0;
  border-bottom: 1px solid var(--border);
  color: inherit;
  text-decoration: none;
}
a.demo-item:hover .demo-name { text-decoration: underline; text-underline-offset: 6px; }

.demo-index {
  color: var(--fg-3);
  font-size: var(--text-14);
  line-height: var(--lh-14);
}
.demo-name {
  color: var(--fg-1);
  font-size: var(--text-32);
  line-height: var(--lh-32);
  font-weight: 600;
}
.demo-desc {
  grid-column: 2 / 3;
  font-size: var(--text-18);
  line-height: var(--lh-18);
}
.demo-status {
  grid-column: 3 / 4;
  grid-row: 1 / 2;
  color: var(--fg-3);
  font-size: var(--text-14);
  line-height: var(--lh-14);
}
.demo-item.is-soon .demo-name { color: var(--fg-3); }

@media (max-width: 767px) {
  .demo-item { grid-template-columns: 40px 1fr; }
  .demo-status { grid-column: 2 / 3; grid-row: auto; }
}
```

- [ ] **Step 3: `index.html` (아카이브 첫 화면) 작성**

```html
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Card Archive</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
  <link rel="stylesheet" href="shared/tokens.css?v=1">
  <link rel="stylesheet" href="shared/base.css?v=1">
</head>
<body>
  <main class="archive-main">
    <h1>Card Archive</h1>
    <p class="archive-intro">멋진 카드 UI를 직접 만들어 모아두는 곳. 1차는 3D 카드 5종이야.</p>

    <ol class="demo-list">
      <li>
        <a class="demo-item" href="demos/01-spiral/">
          <span class="demo-index">01</span>
          <span class="demo-name">나선</span>
          <span class="demo-status">완성</span>
          <span class="demo-desc">휘어진 종이 카드가 납작한 나선을 따라 흘러.</span>
        </a>
      </li>
      <li>
        <div class="demo-item is-soon">
          <span class="demo-index">02</span>
          <span class="demo-name">구</span>
          <span class="demo-status">준비 중</span>
          <span class="demo-desc">카드가 공 표면을 덮고, 드래그로 돌린다.</span>
        </div>
      </li>
      <li>
        <div class="demo-item is-soon">
          <span class="demo-index">03</span>
          <span class="demo-name">터널</span>
          <span class="demo-status">준비 중</span>
          <span class="demo-desc">스크롤하면 카드 벽 터널 안으로 전진한다.</span>
        </div>
      </li>
      <li>
        <div class="demo-item is-soon">
          <span class="demo-index">04</span>
          <span class="demo-name">플로팅 필드</span>
          <span class="demo-status">준비 중</span>
          <span class="demo-desc">공간에 흩어진 카드가 마우스를 따라 깊이감 있게 움직인다.</span>
        </div>
      </li>
      <li>
        <div class="demo-item is-soon">
          <span class="demo-index">05</span>
          <span class="demo-name">우주 표류</span>
          <span class="demo-status">준비 중</span>
          <span class="demo-desc">우주를 떠다니는 카드가 빛을 받아 반짝인다.</span>
        </div>
      </li>
    </ol>
  </main>
</body>
</html>
```

- [ ] **Step 4: 브라우저로 확인**

1. `preview_start` name `card` 로 서버 시작 → `http://localhost:8123/`
2. `get_page_text`로 "Card Archive"와 데모 5개 이름이 보이는지 확인.
3. 스크린샷: 검정 배경, 흰 제목(48px), Pretendard 폰트, 01만 진한 글자이고 02~05는 흐린 글자.
4. `resize_window` preset `mobile` → 목록이 2열(번호 | 내용)로 접히고 가로 스크롤이 없는지 확인 → preset `desktop`으로 되돌림.
5. `read_console_messages` onlyErrors → 에러 0개.

Expected: 위 항목 모두 만족. 01 링크는 아직 404(Task 4에서 생성).

---

### Task 4: Three.js 공통 부품 + 01 나선 정지 화면

**Files:**
- Create: `shared/stage.js`, `shared/card-material.js`, `shared/card-geometry.js`
- Create: `demos/01-spiral/layout.js`, `demos/01-spiral/index.html`, `demos/01-spiral/main.js`
- Test: `tests/spiral-layout.test.js`

**Interfaces:**
- Consumes: `bendPositions`(Task 2), `TEXTURE_PRESETS`·`DEFAULT_PRESET`·`presetToParams`(Task 2), `smoothstep`·`depthDim`(Task 1), 토큰 `--bg-1`·`--card-paper`(Task 3)
- Produces (`shared/stage.js`):
  - `readToken(name: string): string` — CSS 변수 값
  - `createStage({ canvas, fov = 38 }): { renderer, scene, camera, composer, addEffect(pass), resize(), render() }` — WebGL 실패 시 throw
  - `showWebGLFallback(canvas: HTMLCanvasElement): void`
- Produces (`shared/card-material.js`):
  - `createCardMaterial({ cardHeight: number }): THREE.MeshPhysicalMaterial` — 셰이더에 `instanceDim`(밝기 배율), `instanceFlip`(0~1 뒤집기 진행) 인스턴스 속성을 쓴다
  - `syncMaterial(material, params: {preset, gloss, roughness, rainbow, cardColor}): void`
- Produces (`shared/card-geometry.js`):
  - `createCardGeometry({ width, height, bend, bow = 0.35, segments = 24 }): THREE.PlaneGeometry`
  - `setGeometryBend(geometry, bend, bow = 0.35): void`
  - `createCardInstances({ count, width, height, bend, bow = 0.35, material }): { mesh: THREE.InstancedMesh, count, setDim(i, v), setFlip(i, v), commit(), setBend(b), dispose() }`
- Produces (`demos/01-spiral/layout.js`):
  - `spiralSlot(n: number, p: {angleStep, radius, squish, gapY, gapX, edgeTwist}): {x, y, z, rotY, rotZ, facing}`
  - `endFade(n: number, half: number): number`
  - `windowStart(offset: number, count: number): number`
  - `visibleHalf(count, angleStep, gapY, cardHeight): number`

- [ ] **Step 1: 나선 배치 실패 테스트 작성** — `tests/spiral-layout.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spiralSlot, endFade, windowStart, visibleHalf } from '../demos/01-spiral/layout.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const P = { angleStep: 0.5, radius: 3, squish: 0.7, gapY: 0.4, gapX: 0, edgeTwist: 0.1 };

test('n=0 카드는 정면 가운데에서 카메라를 본다', () => {
  const s = spiralSlot(0, P);
  close(s.x, 0); close(s.y, 0); close(s.z, 2.1);
  close(s.rotY, 0); close(s.rotZ, 0); close(s.facing, 1);
});

test('반 바퀴 떨어진 카드는 뒤쪽에 있고 facing이 -1', () => {
  const s = spiralSlot(Math.PI / P.angleStep, P);
  close(s.z, -2.1); close(s.facing, -1);
});

test('앞으로 올 카드(n>0)는 아래쪽에 있다 (스크롤하면 위로 올라온다)', () => {
  close(spiralSlot(2, P).y, -0.8);
  close(spiralSlot(-2, P).y, 0.8);
});

test('endFade: 가운데는 1, 창 끝에선 0', () => {
  close(endFade(0, 10), 1);
  close(endFade(10, 10), 0);
  close(endFade(-10, 10), 0);
});

test('windowStart: offset을 반올림한 위치가 창 가운데에 오도록', () => {
  assert.equal(windowStart(5.4, 10), 0);
  assert.equal(windowStart(5.6, 10), 1);
});

test('visibleHalf: 층이 안 겹치면 절반, 겹치면 한 바퀴 반경으로 제한', () => {
  assert.equal(visibleHalf(36, 0.5, 0.42, 2.24), 18);
  close(visibleHalf(36, 0.5, 0, 2.24), Math.PI / 0.5);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd "/Users/sang/Desktop/ai for work/card" && npm test`
Expected: FAIL — `demos/01-spiral/layout.js`를 찾을 수 없음 (나머지 17개는 통과)

- [ ] **Step 3: `demos/01-spiral/layout.js` 구현**

```js
// ─────────────────────────────────────────────────────────────
// layout.js — 01 나선: 카드 하나하나가 나선의 어디에 놓일지 계산
// ─────────────────────────────────────────────────────────────
import { smoothstep } from '../../shared/motion.js?v=1';

// n = 정면 카드로부터 몇 칸 떨어졌는지 (0=정면, +1=다음 카드, -1=이전 카드)
// 카드마다 angleStep(라디안)만큼 돌면서 gapY만큼 내려가면 나선이 된다.
//   x = 반지름 × sin(각도)            → 좌우 위치
//   z = 반지름 × 납작함 × cos(각도)    → 앞뒤 위치. 납작함 0.7이면 깊이를 70%로 눌러
//                                        덜 빙빙 도는 타원이 된다
//   y = -n × gapY                      → 앞으로 올 카드는 아래에. 스크롤하면 위로 올라온다
//   rotY = 각도                        → 카드가 항상 나선 바깥쪽을 보게 돌린다
//   rotZ = -sin(각도) × edgeTwist      → 옆으로 갈수록 카드가 살짝 기운다
//   facing = cos(각도)                 → 1=정면, -1=완전히 뒤 (깊이 어둠 계산용)
export function spiralSlot(n, p) {
  const angle = n * p.angleStep;
  const s = Math.sin(angle);
  const c = Math.cos(angle);
  return {
    x: p.radius * s + n * p.gapX,
    y: -n * p.gapY,
    z: p.radius * p.squish * c,
    rotY: angle,
    rotZ: -s * p.edgeTwist,
    facing: c,
  };
}

// 화면에 올리는 카드 묶음(창)의 양 끝 2칸에서 카드가 서서히 작아지며 사라지게 한다.
// 그래야 창이 한 칸씩 밀릴 때 카드가 툭 나타나거나 사라지지 않는다.
export function endFade(n, half) {
  return 1 - smoothstep(half - 2, half, Math.abs(n));
}

// 무한 나선을 카드 count장으로 돌려쓰기 위한 창의 시작 번호.
// 현재 스크롤 위치(offset)를 반올림한 칸이 창 가운데에 오게 한다.
export function windowStart(offset, count) {
  return Math.round(offset) - Math.floor(count / 2);
}

// 세로 간격이 작아서 위아래 층 카드가 겹치면(링 모드 포함)
// 같은 자리에 카드가 겹쳐 깜빡이니까, 한 바퀴(앞뒤 반 바퀴씩)만 보이게 제한한다.
//   한 바퀴에 들어가는 카드 수 = 2π / angleStep
//   한 바퀴 동안 내려가는 높이 = gapY × 그 카드 수
export function visibleHalf(count, angleStep, gapY, cardHeight) {
  const half = Math.floor(count / 2);
  const risePerTurn = gapY * ((Math.PI * 2) / angleStep);
  if (risePerTurn >= cardHeight) return half;
  return Math.min(half, Math.PI / angleStep);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd "/Users/sang/Desktop/ai for work/card" && npm test`
Expected: PASS — `# pass 23`, `# fail 0`

- [ ] **Step 5: `shared/stage.js` 작성**

```js
// ─────────────────────────────────────────────────────────────
// stage.js — 3D 무대 기본 세팅 (모든 데모 공통)
//   렌더러: 화면에 그리는 장치
//   카메라: 화각 38°의 좁은 "망원" 카메라 → 왜곡이 적어 고급스럽다
//   조명 환경: 스튜디오 방(RoomEnvironment)을 비춰서 코팅·박에 진짜 같은 반사가 생긴다
//   후처리(composer): 그린 화면에 잔상·빛 번짐 같은 효과를 덧입히는 단계
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// tokens.css의 CSS 변수 값을 JS에서 읽는다. (색을 JS에 직접 적지 않기 위해)
export function readToken(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function createStage({ canvas, fov = 38 }) {
  // WebGL을 못 쓰는 환경이면 여기서 에러가 난다 → 데모 쪽에서 안내 문구로 대체
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });

  // 화면 선명도 상한: 데스크톱 2배, 터치 기기 1.5배 (너무 높으면 폰이 버벅인다)
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarse ? 1.5 : 2));
  renderer.setClearColor(new THREE.Color(readToken('--bg-1')), 1);
  // 흰색이 누렇게 뜨지 않는 톤 매핑. 실제 적용은 마지막 OutputPass에서 일어난다
  renderer.toneMapping = THREE.NeutralToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 200);

  // 스튜디오 조명 환경 → 코팅(clearcoat)과 금속 박이 반사할 "주변 풍경"
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  // 하이라이트를 또렷하게 해주는 주 조명 하나 (오른쪽 위 앞에서 비춘다)
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
  keyLight.position.set(3, 4, 6);
  scene.add(keyLight);

  // 후처리 체인: [장면 그리기] → (데모별 효과) → [색 출력]
  // samples: 4 → 후처리를 거쳐도 카드 가장자리가 계단지지 않게 (안티앨리어싱)
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new OutputPass());

  function resize() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    renderer.setSize(width, height, false);
    composer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  return {
    renderer,
    scene,
    camera,
    composer,
    // 효과는 항상 마지막 [색 출력] 바로 앞에 끼워 넣는다
    addEffect(pass) {
      composer.insertPass(pass, composer.passes.length - 1);
    },
    resize,
    render() {
      composer.render();
    },
  };
}

// WebGL을 못 쓸 때 캔버스 자리에 안내 문구를 띄운다
export function showWebGLFallback(canvas) {
  const message = document.createElement('p');
  message.className = 'fallback';
  message.textContent = '이 브라우저에선 3D를 볼 수 없어요. 최신 크롬이나 사파리에서 열어줘!';
  canvas.style.display = 'none';
  canvas.parentElement.appendChild(message);
}
```

- [ ] **Step 6: `shared/card-material.js` 작성**

```js
// ─────────────────────────────────────────────────────────────
// card-material.js — 카드 재질 (흰 종이 + 코팅 + 박)
// Three.js 기본 재질(MeshPhysicalMaterial)에 셰이더 두 가지를 덧붙인다.
//   1) instanceDim  : 카드별 밝기 배율. "깊이 어둠"용.
//                     색에 곱하는 게 아니라 최종 픽셀에 곱해서 코팅 반사까지 같이 어두워진다.
//   2) instanceFlip : 0→1 진행도. 카드가 Y축으로 한 바퀴(360°) 도는데,
//                     윗줄이 먼저 돌고 아랫줄이 20% 늦게 따라와서 물결처럼 뒤집힌다.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { TEXTURE_PRESETS, DEFAULT_PRESET } from './texture-presets.js?v=1';

export function createCardMaterial({ cardHeight }) {
  const material = new THREE.MeshPhysicalMaterial({
    side: THREE.DoubleSide,            // 뒤집혔을 때 뒷면도 보이게
    iridescenceIOR: 1.3,               // 무지개 박 굴절률
    iridescenceThicknessRange: [120, 720], // 박 두께 범위 → 무지개 색 폭
  });

  // 같은 재질 코드를 다른 재질과 헷갈리지 않게 캐시 이름을 따로 준다
  material.customProgramCacheKey = () => 'card-instanced-dim-flip';

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uCardHeight = { value: cardHeight };

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
attribute float instanceDim;
attribute float instanceFlip;
uniform float uCardHeight;
varying float vInstanceDim;`)
      // 법선(빛 계산용 방향)을 먼저 돌린다. 각도는 아래 정점 회전에서도 재사용
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
float cardFlipAngle = 0.0;
{
  float rowT = position.y / uCardHeight + 0.5;                       // 0=아랫줄, 1=윗줄
  float rowP = clamp((instanceFlip - (1.0 - rowT) * 0.2) / 0.8, 0.0, 1.0); // 아랫줄일수록 늦게 출발
  cardFlipAngle = rowP * 6.28318530718;                              // 한 바퀴 = 2π
}
float cardFlipCos = cos(cardFlipAngle);
float cardFlipSin = sin(cardFlipAngle);
objectNormal = vec3(
  objectNormal.x * cardFlipCos + objectNormal.z * cardFlipSin,
  objectNormal.y,
  -objectNormal.x * cardFlipSin + objectNormal.z * cardFlipCos);`)
      // 정점 위치도 같은 각도로 돌린다
      .replace('#include <begin_vertex>', `#include <begin_vertex>
transformed = vec3(
  transformed.x * cardFlipCos + transformed.z * cardFlipSin,
  transformed.y,
  -transformed.x * cardFlipSin + transformed.z * cardFlipCos);
vInstanceDim = instanceDim;`);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying float vInstanceDim;`)
      // 모든 조명·반사 계산이 끝난 마지막 픽셀에 밝기 배율을 곱한다
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
gl_FragColor.rgb *= vInstanceDim;`);
  };

  return material;
}

// 패널 값(params) → 재질에 반영.
// 금속감(metalness)과 코팅 뿌옇기(clearcoatRoughness)는 프리셋이 정하고,
// 나머지(광택·거칠기·무지개·색)는 패널에서 손으로 덮어쓸 수 있다.
export function syncMaterial(material, params) {
  const preset = TEXTURE_PRESETS[params.preset] ?? TEXTURE_PRESETS[DEFAULT_PRESET];
  material.color.set(params.cardColor);
  material.clearcoat = params.gloss;
  material.clearcoatRoughness = preset.clearcoatRoughness;
  material.roughness = params.roughness;
  material.metalness = preset.metalness;
  material.iridescence = params.rainbow;
}
```

- [ ] **Step 7: `shared/card-geometry.js` 작성**

```js
// ─────────────────────────────────────────────────────────────
// card-geometry.js — 휜 카드 모양 + 카드 여러 장을 한 번에 그리는 묶음
// InstancedMesh: 같은 모양 카드 수십 장을 "한 번에" 그리는 방식.
//   카드마다 위치·회전·크기(행렬)만 다르게 주면 돼서 아주 가볍다.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { bendPositions } from './bend.js?v=1';

// 카드 한 장의 모양. 휘려면 면을 잘게 나눠야 해서 가로 segments칸으로 쪼갠다.
export function createCardGeometry({ width, height, bend, bow = 0.35, segments = 24 }) {
  const rows = Math.round((segments * height) / width);
  const geometry = new THREE.PlaneGeometry(width, height, segments, rows);
  setGeometryBend(geometry, bend, bow);
  return geometry;
}

// 휨 세기를 바꾼다. 휜 뒤엔 법선(빛 방향)을 다시 계산해야 광택이 곡면을 따라 흐른다.
export function setGeometryBend(geometry, bend, bow = 0.35) {
  const position = geometry.attributes.position;
  bendPositions(position.array, bend, bow);
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}

// 카드 count장 묶음. 카드별 밝기(dim)·뒤집기(flip) 값을 셰이더로 넘기는 통로도 같이 만든다.
export function createCardInstances({ count, width, height, bend, bow = 0.35, material }) {
  const geometry = createCardGeometry({ width, height, bend, bow });

  const dim = new THREE.InstancedBufferAttribute(new Float32Array(count).fill(1), 1);
  const flip = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
  dim.setUsage(THREE.DynamicDrawUsage);   // 매 프레임 바뀌는 값이라고 GPU에 알려준다
  flip.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('instanceDim', dim);
  geometry.setAttribute('instanceFlip', flip);

  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  // 카드가 매 프레임 움직여서 "화면 밖이면 안 그리기" 판정이 틀릴 수 있다 → 끈다
  mesh.frustumCulled = false;

  return {
    mesh,
    count,
    setDim(i, value) { dim.array[i] = value; },
    setFlip(i, value) { flip.array[i] = value; },
    // 한 프레임 동안 바꾼 값들을 GPU로 보낸다
    commit() {
      mesh.instanceMatrix.needsUpdate = true;
      dim.needsUpdate = true;
      flip.needsUpdate = true;
      mesh.boundingSphere = null; // 클릭 판정(레이캐스트)이 최신 위치를 쓰도록
    },
    setBend(value) { setGeometryBend(geometry, value, bow); },
    dispose() {
      geometry.dispose();
      mesh.dispose();
    },
  };
}
```

- [ ] **Step 8: `demos/01-spiral/index.html` 작성**

```html
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>01 나선 · Card Archive</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
  <link rel="stylesheet" href="../../shared/tokens.css?v=1">
  <link rel="stylesheet" href="../../shared/base.css?v=1">
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

  <section class="stage-wrap">
    <div class="stage">
      <canvas id="stage-canvas" aria-label="휘어진 흰 카드들이 납작한 나선을 그리며 흐르는 3D 장면"></canvas>
      <div class="stage-caption">
        <p class="caption-index">01</p>
        <h1>나선</h1>
        <p>휘어진 종이 카드가 납작한 나선을 따라 흘러.</p>
        <p class="caption-hint">스크롤·드래그로 감기 · 카드를 누르면 뒤집혀</p>
      </div>
    </div>
  </section>

  <main class="notes">
    <section>
      <h2>이 데모에 쓴 기법</h2>
      <dl>
        <dt>휜 카드</dt>
        <dd>카드 면을 잘게 나누고 가장자리로 갈수록 뒤로 밀어서(x²) 종이처럼 휘게 했어. 휘어 있으니까 빛이 표면을 따라 흘러.</dd>
        <dt>깊이 어둠</dt>
        <dd>진짜 그림자 대신 뒤쪽에 있는 카드일수록 어둡게 칠해. 계산은 가볍고 깊이감은 확실해.</dd>
        <dt>쫀득한 관성</dt>
        <dd>스크롤 위치를 바로 따라가지 않고, 매 프레임 남은 거리의 일부만 따라가. 그래서 미끄러지듯 멈춰.</dd>
        <dt>속도 잔상</dt>
        <dd>빠르게 돌수록 이전 화면을 조금씩 남겨서 잔상이 생겨 (AfterimagePass).</dd>
        <dt>자석과 기울기</dt>
        <dd>커서 근처 카드는 커서 쪽으로 끌려오고, 장면 전체가 커서 쪽으로 살짝 기울어.</dd>
        <dt>망원 카메라</dt>
        <dd>화각을 38°로 좁게 잡아서 원근 왜곡을 줄였어. 장난감 같지 않고 고급스러워 보이는 이유야.</dd>
        <dt>코팅과 박</dt>
        <dd>MeshPhysicalMaterial의 코팅층(clearcoat)과 무지개 박(iridescence)에 스튜디오 조명 환경을 비췄어.</dd>
        <dt>물결 뒤집기</dt>
        <dd>카드 윗줄이 먼저 돌고 아랫줄이 조금 늦게 따라와서 물결처럼 뒤집혀.</dd>
      </dl>
    </section>
    <section>
      <h2>참고한 곳</h2>
      <p><a href="https://grail-app.com" target="_blank" rel="noopener">Grail</a>: 메인 화면의 퀘스트 나선. 코드는 복사하지 않고 기법만 공부해서 다시 만들었어.</p>
    </section>
  </main>

  <script type="module" src="./main.js?v=1"></script>
</body>
</html>
```

- [ ] **Step 9: `demos/01-spiral/main.js` — 정지 화면 버전 작성**

(움직임·입력·패널은 Task 5·6에서 이 파일을 통째로 교체/확장한다)

```js
// ─────────────────────────────────────────────────────────────
// 01 나선 — Task 4 정지 화면 버전: 공통 부품이 제대로 붙는지 확인용
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { createStage, showWebGLFallback, readToken } from '../../shared/stage.js?v=1';
import { createCardMaterial, syncMaterial } from '../../shared/card-material.js?v=1';
import { createCardInstances } from '../../shared/card-geometry.js?v=1';
import { depthDim } from '../../shared/motion.js?v=1';
import { DEFAULT_PRESET, presetToParams } from '../../shared/texture-presets.js?v=1';
import { spiralSlot, endFade, windowStart, visibleHalf } from './layout.js?v=1';

const CARD_W = 1.6;  // 카드 가로 (3D 공간 단위)
const CARD_H = 2.24; // 카드 세로 = 가로 × 1.4 (카드 비율)

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

  const params = {
    ...presetToParams(DEFAULT_PRESET, readToken('--card-paper')),
    bend: 0.12, count: 36, angleStep: 0.55, radius: 3.4, squish: 0.7,
    gapY: 0.42, gapX: 0, edgeTwist: 0.06, cardScale: 1,
  };

  const material = createCardMaterial({ cardHeight: CARD_H });
  syncMaterial(material, params);
  const cards = createCardInstances({ count: params.count, width: CARD_W, height: CARD_H, bend: params.bend, material });
  stage.scene.add(cards.mesh);

  // 카메라는 정면 카드에서 9만큼 떨어진 곳
  stage.camera.position.set(0, 0, params.radius * params.squish + 9);

  const dummy = new THREE.Object3D();
  const offset = 0;
  const start = windowStart(offset, cards.count);
  const half = visibleHalf(cards.count, params.angleStep, params.gapY, CARD_H * params.cardScale);
  for (let i = 0; i < cards.count; i++) {
    const n = start + i - offset;
    const slot = spiralSlot(n, params);
    const fade = endFade(n, half);
    dummy.position.set(slot.x, slot.y, slot.z);
    dummy.rotation.set(0, slot.rotY, slot.rotZ);
    dummy.scale.setScalar(params.cardScale * fade);
    dummy.updateMatrix();
    cards.mesh.setMatrixAt(i, dummy.matrix);
    cards.setDim(i, depthDim(slot.facing, 0.3) * fade);
    cards.setFlip(i, 0);
  }
  cards.commit();

  function frame() {
    stage.render();
    requestAnimationFrame(frame);
  }
  frame();
}

main();
```

- [ ] **Step 10: 브라우저로 확인**

1. `http://localhost:8123/demos/01-spiral/` 열기.
2. `read_console_messages` onlyErrors → 에러 0개 (셰이더 컴파일 에러가 있으면 `#include` 치환 문자열이 three 0.187 셰이더에 있는지 확인).
3. 스크린샷: 검정 배경에 오프화이트 카드가 납작한 나선으로 배치, 정면 카드는 밝고 뒤쪽 카드는 어둡다. 카드 가장자리가 휘어 보이고, 코팅 반사·은은한 무지개빛이 보인다. 위아래 끝 카드는 작아지며 사라진다.
4. 왼쪽 아래 캡션(01 · 나선 · 설명 · 조작법), 왼쪽 위 "← 아카이브" 링크가 보인다.

Expected: 위 항목 모두 만족. 아직 움직이지 않는다.

---

### Task 5: 01 나선 움직임 — 관성·스크롤·드래그·자석·기울기·등장·잔상·뒤집기

**Files:**
- Modify: `demos/01-spiral/main.js` (파일 전체 교체)

**Interfaces:**
- Consumes: `damp`, `clamp`, `lerp`, `easeOutCubic`, `easeInOutCubic`, `depthDim`, `magnetOffset`, `Inertia`, `prefersReducedMotion`(Task 1), `stage.addEffect`(Task 4), `cards.setFlip`/`commit`(Task 4)
- Produces (main.js 내부, Task 6이 사용): `DEFAULTS`(객체), `params`(객체), `paper`(문자열), `material`, `cards`(let), `rebuildCards()`, `applyAll()` — 모두 `main()` 함수 안의 지역 이름

- [ ] **Step 1: `demos/01-spiral/main.js` 전체 교체**

```js
// ─────────────────────────────────────────────────────────────
// 01 나선 — Grail식 휜 카드 나선
// 입력(스크롤·드래그·자동 회전)을 하나의 "감기 위치"로 합치고,
// 관성으로 쫀득하게 따라가면서 매 프레임 카드 위치·밝기·뒤집기를 다시 계산한다.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js';
import { createStage, showWebGLFallback, readToken } from '../../shared/stage.js?v=1';
import { createCardMaterial, syncMaterial } from '../../shared/card-material.js?v=1';
import { createCardInstances } from '../../shared/card-geometry.js?v=1';
import {
  damp, clamp, lerp, easeOutCubic, easeInOutCubic,
  depthDim, magnetOffset, Inertia, prefersReducedMotion,
} from '../../shared/motion.js?v=1';
import { DEFAULT_PRESET, presetToParams } from '../../shared/texture-presets.js?v=1';
import { spiralSlot, endFade, windowStart, visibleHalf } from './layout.js?v=1';

const CARD_W = 1.6;               // 카드 가로 (3D 공간 단위)
const CARD_H = 2.24;              // 카드 세로 = 가로 × 1.4
const CAMERA_DISTANCE = 9;        // 정면 카드 ~ 카메라 거리
const SCROLL_CARDS_PER_SCREEN = 6; // 화면 한 높이만큼 스크롤하면 카드 6장만큼 감긴다
const DRAG_CARDS_PER_PX = 0.012;   // 마우스로 1px 드래그하면 카드 0.012장만큼 감긴다
const MAGNET_RADIUS = 3;           // 자석이 닿는 거리 (3D 공간 단위)
const MIN_BRIGHTNESS = 0.3;        // 완전히 뒤쪽 카드의 밝기 (30%)
const INTRO_DURATION = 2.2;        // 등장 연출 시간(초)
const INTRO_RADIUS_SCALE = 3.5;    // 등장할 때 반지름이 최종의 3.5배에서 시작해 오므라든다
const FLIP_DURATION = 1.1;         // 카드 뒤집기 시간(초)
const CLICK_TOLERANCE_PX = 6;      // 이만큼 이하로 움직였으면 드래그가 아니라 클릭

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

  // ── 기본값 (패널 "기본값으로" 버튼이 되돌아가는 값) ─────────
  const paper = readToken('--card-paper');
  const DEFAULTS = {
    ...presetToParams(DEFAULT_PRESET, paper), // preset, gloss, roughness, rainbow, cardColor
    bend: 0.12,       // 휨
    count: 36,        // 카드 수
    angleStep: 0.55,  // 감기 정도: 카드 한 장마다 도는 각도(라디안). 0.55 ≈ 31.5°
    radius: 3.4,      // 나선 반지름
    squish: 0.7,      // 납작함: 앞뒤 깊이를 70%로 눌러 타원으로
    gapY: 0.42,       // 세로 간격: 카드 한 장마다 내려가는 높이 (0이면 링)
    gapX: 0,          // 가로 흐름: 카드 한 장마다 옆으로 밀리는 양
    edgeTwist: 0.06,  // 가장자리 기울기
    cardScale: 1,     // 카드 크기 배율
    magnet: 0.12,     // 자석 세기
    mouseTilt: 0.12,  // 마우스 기울기 세기(라디안)
    autoSpeed: 0.18,  // 자동 흐름 속도 (초당 카드 장수)
    trail: 0.85,      // 잔상 최대 세기
  };
  const params = structuredClone(DEFAULTS);

  // ── 장면 조립 ───────────────────────────────────────────────
  const material = createCardMaterial({ cardHeight: CARD_H });
  syncMaterial(material, params);

  const spiral = new THREE.Group(); // 마우스 기울기는 이 그룹 전체를 돌린다
  stage.scene.add(spiral);

  let cards = createCardInstances({ count: params.count, width: CARD_W, height: CARD_H, bend: params.bend, material });
  spiral.add(cards.mesh);

  // 카드 수가 바뀌면 묶음을 새로 만든다 (재질은 그대로 재사용)
  function rebuildCards() {
    spiral.remove(cards.mesh);
    cards.dispose();
    cards = createCardInstances({ count: params.count, width: CARD_W, height: CARD_H, bend: params.bend, material });
    spiral.add(cards.mesh);
  }

  // 패널 값을 한꺼번에 화면에 반영 (설정 붙여넣기·기본값으로 버튼용)
  function applyAll() {
    syncMaterial(material, params);
    if (params.count !== cards.count) rebuildCards();
    cards.setBend(params.bend);
  }

  // 속도 잔상: 시작은 0(잔상 없음), 매 프레임 속도에 맞춰 바꾼다
  const afterimage = new AfterimagePass(0);
  stage.addEffect(afterimage);

  // ── 입력 상태 ───────────────────────────────────────────────
  const reduced = prefersReducedMotion();
  const inertia = new Inertia({ follow: 6 });
  let autoOffset = 0; // 자동 흐름이 누적한 감기 양
  let dragOffset = 0; // 드래그가 누적한 감기 양
  const pointer = { x: 0, y: 0, inside: false }; // 캔버스 안 커서 위치 (-1~1)
  const press = { active: false, dragging: false, startX: 0, startY: 0, lastY: 0 };

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
    if (press.dragging) {
      const dy = event.clientY - press.lastY;
      press.lastY = event.clientY;
      dragOffset -= dy * DRAG_CARDS_PER_PX; // 위로 끌면 카드도 위로 올라온다
    }
  });

  canvas.addEventListener('pointerleave', () => {
    pointer.inside = false;
    press.dragging = false;
  });

  canvas.addEventListener('pointerdown', (event) => {
    press.active = true;
    press.startX = event.clientX;
    press.startY = event.clientY;
    press.lastY = event.clientY;
    // 터치는 드래그 대신 네이티브 스크롤(= 페이지 스크롤로 감기)에 맡긴다
    if (event.pointerType !== 'touch') {
      press.dragging = true;
      canvas.setPointerCapture(event.pointerId);
    }
  });

  canvas.addEventListener('pointerup', (event) => {
    const moved = Math.hypot(event.clientX - press.startX, event.clientY - press.startY);
    if (press.active && moved < CLICK_TOLERANCE_PX) handleClick(event);
    press.active = false;
    press.dragging = false;
  });

  canvas.addEventListener('pointercancel', () => {
    press.active = false;
    press.dragging = false;
  });

  // ── 클릭 → 카드 뒤집기 ──────────────────────────────────────
  // 카드 묶음은 창이 밀릴 때마다 돌려쓰니까, 뒤집기는 "나선 위 칸 번호(slot)"에 기록한다
  const raycaster = new THREE.Raycaster();
  const flips = new Map(); // slot 번호 → 뒤집기 시작 시각(초)
  let currentStart = 0;    // 이번 프레임 창의 시작 slot 번호

  function handleClick(event) {
    const ndc = toNdc(event);
    raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), stage.camera);
    const hit = raycaster.intersectObject(cards.mesh, false)[0];
    if (!hit || hit.instanceId === undefined) return;
    const slot = currentStart + hit.instanceId;
    if (!flips.has(slot)) flips.set(slot, performance.now() / 1000);
  }

  // ── 매 프레임 ───────────────────────────────────────────────
  const dummy = new THREE.Object3D();
  const startTime = performance.now() / 1000;
  let lastTime = startTime;
  let tiltX = 0;
  let tiltZ = 0;

  function frame() {
    const now = performance.now() / 1000;
    const dt = Math.min(0.05, now - lastTime) || 1 / 60; // 탭 전환 후 큰 점프 방지
    lastTime = now;

    // 등장 연출 진행도 0→1 (동작 줄이기가 켜져 있으면 바로 1)
    const intro = reduced ? 1 : easeOutCubic((now - startTime) / INTRO_DURATION);

    // 1) 입력 합치기 → 관성으로 따라가기
    //    등장하는 동안엔 4배 빠르게 돌다가 정상 속도로 감속
    if (!reduced) autoOffset += params.autoSpeed * lerp(4, 1, intro) * dt;
    const scrollOffset = (window.scrollY / window.innerHeight) * SCROLL_CARDS_PER_SCREEN;
    inertia.target = autoOffset + dragOffset + scrollOffset;
    const offset = inertia.update(dt);

    // 2) 등장: 큰 반지름에서 오므라든다. 카메라도 같이 당겨서 정면 카드 크기는 유지
    const radius = lerp(params.radius * INTRO_RADIUS_SCALE, params.radius, intro);
    stage.camera.position.set(0, 0, radius * params.squish + CAMERA_DISTANCE);

    // 3) 마우스 기울기: 커서 쪽으로 장면 전체가 살짝 기운다 (damp로 부드럽게)
    const px = pointer.inside ? pointer.x : 0;
    const py = pointer.inside ? pointer.y : 0;
    tiltX = damp(tiltX, -py * params.mouseTilt, 4, dt);
    tiltZ = damp(tiltZ, -px * params.mouseTilt, 4, dt);
    spiral.rotation.set(tiltX * intro, 0, tiltZ * intro);

    // 4) 커서의 3D 위치 (z=0 평면 기준) → 자석 계산용
    const halfHeight = Math.tan(THREE.MathUtils.degToRad(stage.camera.fov / 2)) * stage.camera.position.z;
    const cursorX = px * halfHeight * stage.camera.aspect;
    const cursorY = py * halfHeight;

    // 5) 카드마다 위치·밝기·뒤집기 계산
    const layout = { ...params, radius };
    const cardScale = params.cardScale * lerp(0.6, 1, intro);
    const half = visibleHalf(cards.count, params.angleStep, params.gapY, CARD_H * cardScale);
    currentStart = windowStart(offset, cards.count);

    for (let i = 0; i < cards.count; i++) {
      const slotIndex = currentStart + i;
      const n = slotIndex - offset; // 정면에서 몇 칸 떨어졌는지 (소수 가능)
      const slot = spiralSlot(n, layout);

      let x = slot.x;
      let y = slot.y;
      if (pointer.inside && params.magnet > 0) {
        const pull = magnetOffset(x, y, cursorX, cursorY, params.magnet * intro, MAGNET_RADIUS);
        x += pull.x;
        y += pull.y;
      }

      const fade = endFade(n, half);
      dummy.position.set(x, y, slot.z);
      dummy.rotation.set(0, slot.rotY, slot.rotZ);
      dummy.scale.setScalar(cardScale * fade);
      dummy.updateMatrix();
      cards.mesh.setMatrixAt(i, dummy.matrix);
      cards.setDim(i, depthDim(slot.facing, MIN_BRIGHTNESS) * fade);

      let flipProgress = 0;
      const flipStart = flips.get(slotIndex);
      if (flipStart !== undefined) {
        const t = (now - flipStart) / FLIP_DURATION;
        if (t >= 1) flips.delete(slotIndex);
        else flipProgress = easeInOutCubic(t);
      }
      cards.setFlip(i, flipProgress);
    }
    cards.commit();

    // 6) 속도 잔상: 빠를수록 이전 화면을 많이 남긴다 (최대 trail)
    afterimage.damp = reduced ? 0 : clamp(Math.abs(inertia.velocity) * 0.35, 0, 1) * params.trail;

    stage.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

main();
```

- [ ] **Step 2: 브라우저로 확인**

1. `http://localhost:8123/demos/01-spiral/` 새로고침. 콘솔 에러 0개.
2. 처음 2초: 큰 원에서 오므라들며 빠르게 돌다가 천천히 흐르는 속도로 감속(등장 연출).
3. 가만두면 카드가 천천히 위로 흐른다.
4. `computer` scroll down 5틱 → 카드가 쫀득하게 위로 감기고, 빨리 감을 때 흰 잔상이 남았다가 멈추면 사라진다. 스크린샷.
5. 캔버스 위에서 위로 드래그(`left_click_drag`) → 카드가 위로 감긴다.
6. 커서를 화면 오른쪽 위로 `hover` → 장면이 그쪽으로 살짝 기울고, 커서 근처 카드가 끌려온다. 스크린샷.
7. 정면 카드 `left_click` → 윗줄이 먼저 도는 물결 뒤집기가 1.1초 동안 일어난다. 연속 스크린샷 2장(0.4초 간격)으로 확인.
8. 끝까지 스크롤 → 기법 노트·참고한 곳이 보인다.

Expected: 위 항목 모두 만족. 콘솔 에러 0개.

---

### Task 6: 조절 패널 + 설정 복사/붙여넣기/기본값

**Files:**
- Create: `shared/panel.js`
- Modify: `demos/01-spiral/main.js` (import 1줄 추가, 패널 블록 추가)

**Interfaces:**
- Consumes: `serializeSettings`, `parseSettings`(Task 2), `PRESET_NAMES`, `presetToParams`(Task 2), main.js 지역 이름 `DEFAULTS`, `params`, `paper`, `material`, `cards`, `rebuildCards`, `applyAll`(Task 5)
- Produces (`shared/panel.js`):
  - `createPanel(title: string): GUI` — 모바일 폭(767px 이하)에서는 접힌 채 시작
  - `addSettingsButtons(gui: GUI, { params, defaults, onApply: () => void }): void`
  - `refreshPanel(gui: GUI): void` — 모든 컨트롤 표시값 갱신

- [ ] **Step 1: `shared/panel.js` 작성**

```js
// ─────────────────────────────────────────────────────────────
// panel.js — 조절 패널 (lil-gui)
// 슬라이더로 값을 만져보고, 마음에 들면 "설정 복사"로 숫자를 통째로 가져간다.
// ─────────────────────────────────────────────────────────────
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import { serializeSettings, parseSettings } from './settings.js?v=1';

export function createPanel(title) {
  const gui = new GUI({ title, width: 300 });
  gui.domElement.classList.add('card-panel'); // base.css의 토큰 테마 적용
  if (window.matchMedia('(max-width: 767px)').matches) gui.close(); // 폰에선 접어서 시작
  return gui;
}

// 값이 코드로 바뀌었을 때(붙여넣기, 기본값, 프리셋) 패널 표시를 다시 그린다
export function refreshPanel(gui) {
  gui.controllersRecursive().forEach((controller) => controller.updateDisplay());
}

// 패널 제목 자리에 잠깐 알림을 띄웠다가 원래 제목으로 돌린다
function flashTitle(gui, message) {
  const original = gui._title;
  gui.title(message);
  setTimeout(() => gui.title(original), 1400);
}

export function addSettingsButtons(gui, { params, defaults, onApply }) {
  const actions = {
    async copy() {
      const text = serializeSettings(params, defaults);
      try {
        await navigator.clipboard.writeText(text);
        flashTitle(gui, '설정을 복사했어!');
      } catch {
        // 클립보드 권한이 막힌 환경이면 직접 복사할 수 있게 창으로 보여준다
        window.prompt('자동 복사가 막혀서, 아래 내용을 직접 복사해줘', text);
      }
    },
    paste() {
      const text = window.prompt('복사해 둔 설정(JSON)을 붙여넣어줘');
      if (!text) return;
      try {
        Object.assign(params, parseSettings(text, defaults));
        refreshPanel(gui);
        onApply();
        flashTitle(gui, '설정을 적용했어!');
      } catch (error) {
        window.alert(error.message);
      }
    },
    reset() {
      Object.assign(params, structuredClone(defaults));
      refreshPanel(gui);
      onApply();
    },
  };

  const folder = gui.addFolder('설정');
  folder.add(actions, 'copy').name('설정 복사');
  folder.add(actions, 'paste').name('설정 붙여넣기');
  folder.add(actions, 'reset').name('기본값으로');
}
```

- [ ] **Step 2: `demos/01-spiral/main.js`에 import 추가**

`import { DEFAULT_PRESET, presetToParams } from '../../shared/texture-presets.js?v=1';` 줄을 아래로 교체하고, 바로 다음 줄에 panel import를 추가:
```js
import { DEFAULT_PRESET, PRESET_NAMES, presetToParams } from '../../shared/texture-presets.js?v=1';
import { createPanel, addSettingsButtons, refreshPanel } from '../../shared/panel.js?v=1';
```

- [ ] **Step 3: `demos/01-spiral/main.js`에 패널 블록 추가**

`const afterimage = new AfterimagePass(0);` 줄 바로 위에 추가:
```js
  // ── 조절 패널 ───────────────────────────────────────────────
  const gui = createPanel('01 나선 · 조절 패널');
  const syncTexture = () => syncMaterial(material, params);

  const texture = gui.addFolder('질감');
  texture.add(params, 'preset', PRESET_NAMES).name('질감 프리셋').onChange((name) => {
    // 프리셋을 고르면 광택·거칠기·무지개·색을 프리셋 값으로 채운다
    Object.assign(params, presetToParams(name, paper));
    syncTexture();
    refreshPanel(gui);
  });
  texture.add(params, 'gloss', 0, 1, 0.01).name('광택 (코팅)').onChange(syncTexture);
  texture.add(params, 'roughness', 0, 1, 0.01).name('거칠기').onChange(syncTexture);
  texture.add(params, 'rainbow', 0, 1, 0.01).name('무지개 세기').onChange(syncTexture);
  texture.addColor(params, 'cardColor').name('카드 색').onChange(syncTexture);
  texture.add(params, 'bend', 0, 0.5, 0.01).name('휨').onChange((value) => cards.setBend(value));

  const shape = gui.addFolder('나선 모양');
  shape.add(params, 'angleStep', 0.2, 1.2, 0.01).name('감기 정도');
  shape.add(params, 'radius', 1.5, 7, 0.1).name('반지름');
  shape.add(params, 'squish', 0.3, 1, 0.01).name('납작함');
  shape.add(params, 'gapY', 0, 1.2, 0.01).name('세로 간격 (0=링)');
  shape.add(params, 'gapX', -0.3, 0.3, 0.01).name('가로 흐름');
  shape.add(params, 'edgeTwist', -0.3, 0.3, 0.01).name('가장자리 기울기');
  shape.add(params, 'cardScale', 0.4, 1.6, 0.01).name('카드 크기');
  shape.add(params, 'count', 8, 80, 1).name('카드 수').onFinishChange(rebuildCards);

  const motionFolder = gui.addFolder('움직임');
  motionFolder.add(params, 'autoSpeed', 0, 2, 0.01).name('자동 속도');
  motionFolder.add(params, 'magnet', 0, 0.5, 0.01).name('자석');
  motionFolder.add(params, 'mouseTilt', 0, 0.4, 0.01).name('마우스 기울기');
  motionFolder.add(params, 'trail', 0, 0.95, 0.01).name('잔상 세기');

  addSettingsButtons(gui, { params, defaults: DEFAULTS, onApply: applyAll });
```

- [ ] **Step 4: 브라우저로 확인**

1. 새로고침, 콘솔 에러 0개. 오른쪽 위에 "01 나선 · 조절 패널"이 토큰 색(어두운 배경, 흰 글자, 14px Pretendard)으로 보인다.
2. 질감 프리셋을 `금박` → 카드가 금색 금속 반사로, `무광 종이` → 반사 없는 종이로 바뀐다. 각각 스크린샷.
3. `휨` 0 → 평평한 카드, 0.4 → 많이 휜 카드.
4. `세로 간격` 0 → 겹쳐 깜빡이지 않는 한 바퀴 링이 된다. 스크린샷.
5. `카드 수` 20 → 카드 묶음이 다시 만들어지고 에러가 없다.
6. `설정 복사` → 패널 제목이 "설정을 복사했어!"로 잠깐 바뀐다. (`javascript_tool`로 `navigator.clipboard.readText()`가 막히면 prompt 창 경로 확인)
7. 값을 몇 개 바꾼 뒤 `기본값으로` → 전부 기본값으로 돌아간다.
8. `설정 붙여넣기`: `javascript_tool`로 `window.prompt = () => JSON.stringify({ gapY: 0, count: 12 })` 를 미리 심고 버튼 클릭 → 링 모드 + 카드 12장으로 바뀌고 패널 표시도 갱신된다.
9. `resize_window` preset `mobile` → 패널이 접힌 채 시작(새로고침 후), 캡션·링크가 겹치지 않는다. preset `desktop`으로 되돌림.

Expected: 위 항목 모두 만족.

---

### Task 7: 마무리 검증 + 튜닝

**Files:**
- Modify: `demos/01-spiral/main.js` (`DEFAULTS` 숫자만, 필요할 때)

- [ ] **Step 1: 전체 테스트**

Run: `cd "/Users/sang/Desktop/ai for work/card" && npm test`
Expected: PASS — `# pass 23`, `# fail 0`

- [ ] **Step 2: 동작 줄이기 확인**

브라우저 도구로는 운영체제 "동작 줄이기" 설정을 켤 수 없으므로 코드로 확인한다. `main.js`에서 `reduced`를 쓰는 곳이 정확히 3곳인지 본다: `intro`(바로 1), `autoOffset`(증가 안 함), `afterimage.damp`(0). 스크롤·드래그·클릭은 그대로 동작해야 한다.

- [ ] **Step 3: Grail 대비 튜닝**

데스크톱 1440×900에서 스크린샷을 찍어 Grail 레퍼런스(카드 밀도, 정면 카드 크기, 뒤쪽 어둠 정도)와 비교한다. 차이가 크면 `DEFAULTS`의 `angleStep`, `radius`, `gapY`, `cardScale`만 조정하고 다시 스크린샷. 최대 3회 반복.

- [ ] **Step 4: 아카이브 첫 화면 → 데모 이동 확인**

`http://localhost:8123/` → 01 나선 클릭 → 데모 열림 → "← 아카이브" → 첫 화면 복귀.

- [ ] **Step 5: 사용자에게 보여주고 "개멋짐" 판정 받기**

앱 안 브라우저에 01 나선을 띄운 상태로 사용자에게 확인을 요청한다. 수정 요청이 오면 반영 후 Step 1부터 다시.
