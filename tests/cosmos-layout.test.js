import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../shared/random.js';
import {
  ROW_DEPTH, CARD_RATIO, DIAMOND_CELLS, GRID_FIT, SCATTER, gridMetrics, diamondLayout,
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
  const { cards } = diamondLayout(1440, 900, 9, 1, 0); // 흐트러뜨리기 전 마름모 기준
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

test('gridMetrics: 폭 768px 이하는 17% 마름모를 통째로 narrowZoom배 키운다 (레퍼는 이 폭에서 목록 보기라 우리가 정함)', () => {
  const zoom = GRID_FIT.narrowZoom;
  assert.ok(zoom > 1); // 사용자 "폰에서도 카드 크게"
  const m = gridMetrics(375, 812);
  close(m.cardW, 375 * 0.17 * zoom);
  close(m.cardH, 375 * 0.17 * zoom * CARD_RATIO);
  close(m.colStep, 76.71 * zoom, 0.05);  // 17% 마름모의 가로 한 칸 76.71px × 배율
  close(m.rowStep, 117.18 * zoom, 0.05); // 세로 한 칸 117.18px × 배율
  close(gridMetrics(768, 1024).cardW, 768 * 0.17 * zoom);
  assert.ok(gridMetrics(769, 1024).cardW < 769 * 0.17); // 넘으면 레퍼 13.5%, 배율 없음
});

test('gridMetrics: 카드 크기 배율은 카드만 키우고 칸 간격은 그대로', () => {
  const base = gridMetrics(1440, 900);
  const big = gridMetrics(1440, 900, 1.3);
  close(big.cardW, base.cardW * 1.3);
  close(big.cardH, base.cardH * 1.3);
  close(big.colStep, base.colStep);
  close(big.rowStep, base.rowStep);
});

// 화면에서 기울어진 카드 네 꼭짓점 (px)
function corners(card, w, h) {
  const c = Math.cos(card.tilt);
  const n = Math.sin(card.tilt);
  return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]
    .map(([x, y]) => [card.x + x * c - y * n, card.y + x * n + y * c]);
}
// 두 볼록 사각형 사이 틈: 각 변의 수직 방향으로 그림자를 비춰서 가장 크게 벌어진 값 (분리축). 음수면 겹침
function gapBetween(a, b) {
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
}

test('diamondLayout: 흐트러뜨리고 기울여도 카드끼리 안 겹친다 (기울어진 사각형끼리 4px 넘게), 넓은 화면은 가로로 다 들어오고 폰은 가운데 세 열이 화면 안', () => {
  for (const [w, h] of SIZES) {
    const { cards, cardW, cardH } = diamondLayout(w, h);
    for (let i = 0; i < cards.length; i++) {
      const reach = (Math.abs(cardW * Math.cos(cards[i].tilt)) + Math.abs(cardH * Math.sin(cards[i].tilt))) / 2;
      if (w > GRID_FIT.narrowPx) assert.ok(Math.abs(cards[i].x) + reach <= w / 2, `${w}x${h} ${i}번 가로 넘침`);
      else if (cards[i].cell[0] >= 1 && cards[i].cell[0] <= 3) assert.ok(Math.abs(cards[i].x) < w / 2, `${w}x${h} ${i}번 가운데가 화면 밖`);
      for (let j = i + 1; j < cards.length; j++) {
        const gap = gapBetween(corners(cards[i], cardW, cardH), corners(cards[j], cardW, cardH));
        assert.ok(gap > 4, `${w}x${h} ${i}-${j} 틈 ${gap.toFixed(1)}`);
      }
    }
  }
});

test('diamondLayout 흐트러짐: 0이면 정확한 마름모·정면, 기본(1)이면 자리가 크게 어긋나고 기울기 ±8°·비틀기 좌우 ±12°·위아래 ±8° 안', () => {
  const exact = diamondLayout(1440, 900, 9, 1, 0);
  const scattered = diamondLayout(1440, 900);
  let total = 0;
  for (let i = 0; i < 9; i++) {
    const [cx, cy] = exact.cards[i].cell;
    close(exact.cards[i].x, (cx - 2) * exact.colStep);
    close(exact.cards[i].y, (2 - cy) * exact.rowStep);
    close(exact.cards[i].tilt, 0);
    close(exact.cards[i].turnX, 0);
    close(exact.cards[i].turnY, 0);
    const s = scattered.cards[i];
    total += Math.hypot(s.x - exact.cards[i].x, s.y - exact.cards[i].y);
    const deg = (r) => Math.abs((r * 180) / Math.PI);
    assert.ok(deg(s.tilt) <= SCATTER.tilt + 1e-9 && deg(s.turnY) <= SCATTER.turnY + 1e-9 && deg(s.turnX) <= SCATTER.turnX + 1e-9);
  }
  assert.ok(total / 9 > 60, `평균 ${(total / 9).toFixed(0)}px만 어긋남`); // 사용자 "좀 더 자유분방해도 돼"
  assert.ok(new Set(scattered.cards.map((c) => Math.sign(c.tilt))).size === 2); // 왼쪽·오른쪽으로 섞여 기운다
  assert.deepEqual(diamondLayout(1440, 900), scattered); // 같은 화면이면 늘 같은 흐트러짐
});

test('diamondLayout 흐트러짐: 같은 열 이웃은 서로 반대쪽으로 밀려서 줄이 맞아 보이지 않는다', () => {
  const exact = diamondLayout(1440, 900, 9, 1, 0);
  const { cards } = diamondLayout(1440, 900);
  const shiftX = (cell) => {
    const i = cards.findIndex((c) => c.cell.join() === cell);
    return cards[i].x - exact.cards[i].x;
  };
  for (const [a, b] of [['1,1', '1,3'], ['3,0', '3,2'], ['2,0', '2,4']]) {
    assert.ok(Math.sign(shiftX(a)) !== Math.sign(shiftX(b)), `${a}·${b}가 같은 쪽으로`);
  }
  // 맨 바깥 열은 화면을 넘지 않게 둘 다 안쪽으로 — 대신 밀리는 양을 크게 다르게
  assert.ok(Math.abs(shiftX('4,1') - shiftX('4,3')) > 30);
});

test('diamondLayout: 칸 → 위치 (가운데 칸이 화면 가운데, 위 줄이 위쪽), 개수는 1~9로 가운데 가까운 것부터', () => {
  const layout = diamondLayout(1440, 900, 9, 1, 0);
  const top = layout.cards.find((c) => c.cell[0] === 2 && c.cell[1] === 0);
  close(top.x, 0);
  close(top.y, 2 * layout.rowStep);
  const left = layout.cards.find((c) => c.cell[0] === 0 && c.cell[1] === 2);
  close(left.x, -2 * layout.colStep);
  close(left.y, 0);
  assert.equal(diamondLayout(1440, 900, 5).cards.length, 5);
  assert.deepEqual(diamondLayout(1440, 900, 5, 1, 0).cards, layout.cards.slice(0, 5));
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
