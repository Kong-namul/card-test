import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../shared/random.js';
import {
  ROW_DEPTH, COMPOSITION, COMPOSITION_CARD, COMPOSITION_WIDTH, compositionScale, compositionPosition,
  compositionCardHeight, compositionRanks, SETTLE_IN, cssEase, settleIn, createCosmos,
  floatOffset, wobbleAngles, glintPosition, GLINT_SWEEP, createStars, depthDim, DEPTH_DIM,
  STAR_LAYERS, createStarLayer,
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

test('COMPOSITION: 레퍼(우표 배치)처럼 5장이 가운데를 둘러싸되 한 무리로 모여 있고, 각자 10~26° 기울어 있다', () => {
  assert.equal(COMPOSITION.length, 5);
  for (const slot of COMPOSITION) {
    assert.ok(Math.abs(slot.sx) <= COMPOSITION_WIDTH && Math.abs(slot.sy) <= 0.8);
    const degrees = Math.abs((slot.tilt * 180) / Math.PI);
    assert.ok(degrees >= 8 && degrees <= 28);
    const distance = Math.hypot(slot.sx, slot.sy);
    assert.ok(distance > 0.3 && distance < 0.65, `가운데에서 ${distance}`); // 가운데로 모이되 한가운데는 조금 비운다
  }
  for (let i = 0; i < COMPOSITION.length; i++) {
    for (let j = i + 1; j < COMPOSITION.length; j++) {
      const a = COMPOSITION[i];
      const b = COMPOSITION[j];
      assert.ok(Math.hypot(a.sx - b.sx, a.sy - b.sy) > 0.25, `${i}-${j} 거의 포개짐`); // 살짝 겹쳐도 포개지진 않게
    }
  }
  // 왼쪽·오른쪽, 위·아래 모두에 카드가 있다 (한쪽으로 쏠리지 않게)
  assert.ok(COMPOSITION.some((s) => s.sx < -0.2) && COMPOSITION.some((s) => s.sx > 0.2));
  assert.ok(COMPOSITION.some((s) => s.sy > 0.15) && COMPOSITION.some((s) => s.sy < -0.15));
});

test('compositionScale·Position·CardHeight: 넓은 화면은 원래 크기, 좁은 화면은 배치 전체를 줄인다. 모두 같은 거리·같은 크기', () => {
  close(compositionScale(1.6), 1);
  close(compositionScale(COMPOSITION_WIDTH), 1);
  close(compositionScale(0.5), 0.5 / COMPOSITION_WIDTH);
  const view = { fov: 40, aspect: 1.6 };
  const half = Math.tan((20 * Math.PI) / 180) * ROW_DEPTH;
  const p = compositionPosition({ sx: 0.5, sy: -0.25 }, 0, view);
  close(p.x, 0.5 * half);
  close(p.y, -0.25 * half);
  close(p.z, -ROW_DEPTH); // 거리를 안 주면 기본 거리
  // 거리를 주면 그 거리에서 같은 화면 위치에 오도록 (화면 위치 = 공간 위치 ÷ 거리가 같다)
  const near = compositionPosition({ sx: 0.5, sy: -0.25, depth: 12 }, 0, view);
  close(near.z, -12);
  close(near.x / 12, p.x / ROW_DEPTH);
  close(near.y / 12, p.y / ROW_DEPTH);
  // 겹칠 때 깜빡이지 않게 순서(0 = 맨 앞)대로 아주 조금씩 뒤로
  assert.ok(compositionPosition({ sx: 0, sy: 0 }, 3, view).z < p.z);
  assert.ok(Math.abs(compositionPosition({ sx: 0, sy: 0 }, 4, view).z + ROW_DEPTH) < 0.5);
  close(compositionCardHeight(view), COMPOSITION_CARD * half);
  const narrow = { fov: 40, aspect: 0.5 };
  close(compositionCardHeight(narrow), COMPOSITION_CARD * half * compositionScale(0.5));
  close(compositionPosition({ sx: 0.5, sy: 0 }, 0, narrow).x, 0.5 * half * compositionScale(0.5));
});

test('createCosmos: 카드마다 둥실·흔들림 박자만 정한다 (같은 시드면 같은 박자)', () => {
  const cards = createCosmos(5, 3);
  assert.deepEqual(cards, createCosmos(5, 3));
  assert.equal(cards.length, 5);
  for (const c of cards) {
    assert.ok(c.floatPeriod >= 14 && c.floatPeriod <= 24);
    assert.ok(c.wobblePeriodX >= 9 && c.wobblePeriodX <= 17 && c.wobblePeriodY >= 9 && c.wobblePeriodY <= 17);
  }
});

test('floatOffset·wobbleAngles: 세기 0이면 제자리·정면, 아니면 정해진 폭 안에서', () => {
  const card = createCosmos(1, 9)[0];
  const still = floatOffset(card, 5, 0);
  close(still.x, 0);
  close(still.y, 0);
  const flat = wobbleAngles(card, 5, 0);
  close(flat.rotX, 0);
  close(flat.rotY, 0);
  for (let t = 0; t < 60; t += 0.7) {
    const f = floatOffset(card, t, 1);
    assert.ok(Math.abs(f.y) <= 0.18 + 1e-9 && Math.abs(f.x) <= 0.08 + 1e-9);
    const w = wobbleAngles(card, t, 0.2);
    assert.ok(Math.abs(w.rotX) <= 0.2 + 1e-9 && Math.abs(w.rotY) <= 0.2 + 1e-9);
  }
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

test('compositionRanks: 가장 가까운 카드가 0번(맨 앞) — 모일 때 더미 맨 앞이 되고, 처음부터 끝까지 앞뒤 순서가 같다', () => {
  const ranks = compositionRanks(COMPOSITION);
  assert.deepEqual([...ranks].sort((a, b) => a - b), [0, 1, 2, 3, 4]);
  for (let i = 0; i < COMPOSITION.length; i++) {
    for (let j = 0; j < COMPOSITION.length; j++) {
      if (ranks[i] < ranks[j]) assert.ok(COMPOSITION[i].depth <= COMPOSITION[j].depth);
    }
  }
});

test('COMPOSITION 깊이: 거리는 다 다르지만(14~19) 크기 차이는 ±20% 안 — 레퍼처럼 크기가 고르다', () => {
  const depths = COMPOSITION.map((s) => s.depth);
  assert.ok(new Set(depths).size === COMPOSITION.length); // 다 다른 거리 (밝기·시차로 깊이감)
  // 화면에서의 카드 크기 = 기본 거리 ÷ 거리 → 가장 큰 카드와 작은 카드 차이
  const sizes = depths.map((d) => ROW_DEPTH / d);
  const ratio = Math.max(...sizes) / Math.min(...sizes);
  assert.ok(ratio > 1.1 && ratio < 1.4, `크기 차이 ${ratio}`);
});

test('depthDim: 가장 가까운 카드는 1, 가장 먼 카드는 1 − DEPTH_DIM.amount, 사이는 그 사이', () => {
  close(depthDim(DEPTH_DIM.near), 1);
  close(depthDim(DEPTH_DIM.far), 1 - DEPTH_DIM.amount);
  const mid = depthDim((DEPTH_DIM.near + DEPTH_DIM.far) / 2);
  assert.ok(mid < 1 && mid > 1 - DEPTH_DIM.amount);
});

test('STAR_LAYERS: 먼 별은 가장 먼 카드보다 뒤, 카드 사이 먼지는 카드들 거리에 걸쳐, 앞쪽 먼지는 가장 가까운 카드보다 앞', () => {
  const depths = COMPOSITION.map((s) => s.depth);
  assert.ok(STAR_LAYERS.far.zNear > Math.max(...depths));
  assert.ok(STAR_LAYERS.mid.zNear < Math.min(...depths) && STAR_LAYERS.mid.zFar > Math.max(...depths));
  assert.ok(STAR_LAYERS.near.zFar < Math.min(...depths));
  assert.ok(STAR_LAYERS.near.sizeMin > STAR_LAYERS.far.sizeMax - 1); // 앞쪽 먼지는 크게(흐릿한 빛망울)
  for (const key of ['mid', 'near']) assert.ok(Math.hypot(...STAR_LAYERS[key].drift) > 0); // 먼지는 천천히 떠다닌다
  assert.equal(Math.hypot(...STAR_LAYERS.far.drift), 0);                                  // 먼 별은 제자리
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

test('cssEase: CSS 기본 ease(cubic-bezier(0.25, 0.1, 0.25, 1))와 같다 — 0→0, 1→1, 절반 시간에 약 80%', () => {
  close(cssEase(0), 0);
  close(cssEase(1), 1);
  close(cssEase(0.5), 0.8024, 0.005);
  close(cssEase(0.25), 0.4094, 0.005);
  let previous = 0;
  for (let t = 0; t <= 1; t += 0.05) {
    assert.ok(cssEase(t) >= previous - 1e-9);
    previous = cssEase(t);
  }
});

test('settleIn: 레퍼(Paul Smith Collectors Club) 그대로 — 묶음 전체가 110%에서 1초 동안 100%로 내려앉는다', () => {
  assert.equal(SETTLE_IN.from, 1.1);
  assert.equal(SETTLE_IN.duration, 1);
  close(settleIn(0), 1.1);
  close(settleIn(1), 1);
  close(settleIn(5), 1);
  close(settleIn(Infinity), 1); // 동작 줄이기: 처음부터 제자리
  close(settleIn(0.5), 1.1 - 0.1 * cssEase(0.5));
  let previous = Infinity;
  for (let t = 0; t <= 1.2; t += 0.05) {
    assert.ok(settleIn(t) <= previous + 1e-9); // 줄어들기만 한다 (날아오거나 커지지 않음)
    previous = settleIn(t);
  }
});

test('모든 카드 쌍이 둥실거려도 화면에서 안 겹친다 — 기울어진 사각형끼리 0.06 넘게 떨어져 있다 (오른쪽·왼쪽 겹침 해제)', () => {
  // 화면에서 카드 네 꼭짓점 (세로 반폭 단위): 거리만큼 크기가 바뀌고 기울기만큼 돈다
  const corners = (slot) => {
    const halfH = (COMPOSITION_CARD / 2) * (ROW_DEPTH / slot.depth);
    const halfW = halfH * 0.704;
    const c = Math.cos(slot.tilt);
    const n = Math.sin(slot.tilt);
    return [[-halfW, -halfH], [halfW, -halfH], [halfW, halfH], [-halfW, halfH]]
      .map(([x, y]) => [slot.sx + x * c - y * n, slot.sy + x * n + y * c]);
  };
  // 두 볼록 사각형 사이 틈: 각 변의 수직 방향으로 그림자를 비춰서 가장 크게 벌어진 값 (분리축)
  const gapBetween = (a, b) => {
    let best = -Infinity;
    for (const shape of [a, b]) {
      for (let i = 0; i < 4; i++) {
        const [x1, y1] = shape[i];
        const [x2, y2] = shape[(i + 1) % 4];
        const ax = -(y2 - y1);
        const ay = x2 - x1;
        const length = Math.hypot(ax, ay);
        const project = (points) => points.map(([x, y]) => (x * ax + y * ay) / length);
        const pa = project(a);
        const pb = project(b);
        best = Math.max(best, Math.min(...pb) - Math.max(...pa), Math.min(...pa) - Math.max(...pb));
      }
    }
    return best;
  };
  for (let i = 0; i < COMPOSITION.length; i++) {
    for (let j = i + 1; j < COMPOSITION.length; j++) {
      const gap = gapBetween(corners(COMPOSITION[i]), corners(COMPOSITION[j]));
      assert.ok(gap > 0.06, `${i}-${j} 틈 ${gap.toFixed(3)}`); // 둥실 폭(위아래 약 0.03씩)을 넉넉히 넘게
    }
  }
});
