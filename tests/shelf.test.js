import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SHELF, FORMATS, fovFor, followFactor, wrapOffset, cardPose, edgeFade, easeInOutCubic, easeOutCubic, easeOutExpo,
  ENTRANCE, entrancePose, wheelStep, orbitPosition, START_PHI, fitDetail,
  shapeOf, layoutRow, rowUnit, rowIndexAt, rowPositionOf, rowSnapTarget, rowCenterIndex,
} from '../demos/11-books/shelf.js';
import { CARDS } from '../demos/11-books/cards-data.js';

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

test('FORMATS: 세로형은 레퍼 책 크기 그대로 2.2 × 3.2, 가로형은 16:9 폭 4.4 — 카드 사이 틈은 모양 상관없이 1.2', () => {
  close(FORMATS.portrait.width, 2.2);
  close(FORMATS.portrait.height, 3.2);
  close(FORMATS.landscape.width, 4.4);
  close(FORMATS.landscape.width / FORMATS.landscape.height, 16 / 9);
  assert.equal(SHELF.gap, 1.2);
  close(FORMATS.portrait.width + SHELF.gap, SHELF.spacing); // 세로형만 있으면 레퍼 간격 3.4 그대로
});

test('shapeOf: 세로형·가로형은 전부 그 모양, 섞어서는 카드마다 (shape 없으면 세로형)', () => {
  assert.equal(shapeOf('portrait', { shape: 'landscape' }), 'portrait');
  assert.equal(shapeOf('landscape', {}), 'landscape');
  assert.equal(shapeOf('mixed', { shape: 'landscape' }), 'landscape');
  assert.equal(shapeOf('mixed', { shape: 'portrait' }), 'portrait');
  assert.equal(shapeOf('mixed', {}), 'portrait');
});

test('cards-data: 섞어서 볼 수 있게 가로형 카드가 몇 장 있고, shape 값은 portrait·landscape 둘 중 하나', () => {
  const landscape = CARDS.filter((card) => card.shape === 'landscape').length;
  assert.ok(landscape >= 2 && landscape < CARDS.length);
  for (const card of CARDS) assert.ok(card.shape === undefined || card.shape === 'portrait' || card.shape === 'landscape');
});

test('layoutRow: 폭이 같으면 예전처럼 i × 3.4, 폭이 달라도 카드 사이 틈은 늘 같다 (끝 → 처음도)', () => {
  const same = layoutRow(Array(10).fill(2.2), 1.2);
  same.centers.forEach((c, i) => close(c, i * 3.4));
  close(same.total, 34);
  close(same.pitch, 3.4);
  close(layoutRow(Array(10).fill(4.4), 1.2).pitch, 5.6); // 가로형만이면 예전 간격 5.6
  // 세로 2.2 · 가로 4.4 · 세로 2.2
  const mixed = layoutRow([2.2, 4.4, 2.2], 1.2);
  close(mixed.centers[0], 0);
  close(mixed.centers[1], 1.1 + 1.2 + 2.2);
  close(mixed.centers[2], 4.5 + 2.2 + 1.2 + 1.1);
  close(mixed.total, 2.2 + 4.4 + 2.2 + 3 * 1.2);
  close(mixed.pitch, mixed.total / 3);
  close(mixed.gaps[0], 4.5);
  close(mixed.gaps[1], 4.5);
  close(mixed.gaps[2], 1.1 + 1.2 + 1.1); // 마지막 → 다음 바퀴 첫 카드
});

test('rowUnit: 카드에서 가운데 쪽 이웃까지 거리 — 오른쪽 카드는 왼쪽 이웃, 왼쪽 카드는 오른쪽 이웃', () => {
  const row = layoutRow([2.2, 4.4, 2.2], 1.2);
  close(rowUnit(row, 1, 4.5), row.gaps[0]);
  close(rowUnit(row, 0, 3.4), row.gaps[2]); // 0번이 2번 오른쪽에 있을 때 (반복)
  close(rowUnit(row, 0, -4.5), row.gaps[0]);
  close(rowUnit(row, 2, -3.4), row.gaps[2]);
});

test('rowIndexAt·rowPositionOf·rowSnapTarget·rowCenterIndex: 폭이 같으면 예전과 같고, 섞여도 가장 가까운 카드로', () => {
  const same = layoutRow(Array(10).fill(2.2), 1.2);
  assert.equal(rowIndexAt(-6.8, same), 2);
  close(rowSnapTarget(-6.8, same, 1), -10.2);
  close(rowSnapTarget(-7.5, same, 0), -6.8);
  assert.equal(rowCenterIndex(-34 - 6.8, same), 2);
  assert.equal(rowCenterIndex(3.4, same), 9);

  const row = layoutRow([2.2, 4.4, 2.2], 1.2); // 가운데 자리 0 · 4.5 · 9, 한 바퀴 12.4
  assert.equal(rowIndexAt(-4.0, row), 1);
  assert.equal(rowIndexAt(-2.0, row), 0);
  assert.equal(rowIndexAt(-11, row), 3);     // 다음 바퀴 0번
  assert.equal(rowCenterIndex(-11, row), 0);
  assert.equal(rowIndexAt(1, row), 0);       // 왼쪽으로 조금 → 여전히 0번
  close(rowPositionOf(1, row), -4.5);
  close(rowPositionOf(3, row), -12.4);
  close(rowPositionOf(-1, row), 3.4);        // 이전 바퀴 2번
  close(rowSnapTarget(-4.0, row, 1), -9);
  close(rowSnapTarget(-4.0, row, -1), 0);
  close(rowSnapTarget(-8, row, 0), -9);
  for (let j = -7; j <= 7; j++) assert.equal(rowIndexAt(rowPositionOf(j, row), row), j);
});

test('폰(809px 이하, 레퍼 mobile 변형): 줄을 1.2 올리고, 3D 화면은 그대로(위로 올리지 않음)', () => {
  assert.equal(SHELF.narrowListOffsetY, 1.2);
  assert.equal(SHELF.narrowCanvasLift, undefined); // 375×812에서 잰 −103px은 페이지가 스크롤된 채로 잰 값이었다 (719×947에선 0)
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
  // 섞어서: 회전·깊이는 줄 평균 간격으로(모든 카드가 같은 곡면 위), 크기·밝기는 가운데 쪽 이웃까지 거리로 → 바로 옆 카드는 늘 0.93배·0.35
  const mixedNext = cardPose(4.5, 4.06, 4.5);
  close(mixedNext.scale, 0.93);
  close(mixedNext.shade, 0.35);
  close(mixedNext.rotY, -4.5 * (3.4 / 4.06) * 0.045);
  close(cardPose(2.25, 4.06, 4.5).scale, 1.1 - 0.17 * 0.5);
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

test('orbitPosition: 처음 카메라 자리 = (0, 0.3, √(14² − 0.3²)), 옆으로 돌면 x가 생긴다', () => {
  const p = orbitPosition(0, START_PHI, 14, { x: 0, y: 0, z: 0 });
  close(p.x, 0);
  close(p.y, 0.3);
  close(p.z, Math.sqrt(14 * 14 - 0.09));
  assert.ok(orbitPosition(0.5, START_PHI, 14, { x: 0, y: 0, z: 0 }).x > 0);
  close(SHELF.phiMin, Math.PI * 0.24);
  close(SHELF.phiMax, Math.PI * 0.78);
});

test('fitDetail 폰 "가운데": 글 아래 남는 자리 한가운데, 가로는 가운데, 자리가 모자라면 카드를 줄인다', () => {
  // 719×947 (캔버스 679 × 947, 화각 약 43.5°): 닫기 버튼 아래 끝 470px → 494~923px 자리, 카드 0.9배가 들어감
  const fov = fovFor(679 / 947);
  const roomy = fitDetail({
    free: { left: 0, top: 470, right: 679, bottom: 947 }, canvasWidthPx: 679, canvasHeightPx: 947,
    fovDeg: fov, distance: 8.4, cardWidth: 2.2, cardHeight: 3.2, scale: 0.9,
  });
  const unitsPerPx = (2 * 8.4 * Math.tan((fov * Math.PI) / 360)) / 947;
  close(roomy.x, 0);
  close(roomy.scale, 0.9);
  close(roomy.y, (947 / 2 - (494 + 923) / 2) * unitsPerPx);
  assert.ok(roomy.y < 0); // 화면 가운데보다 아래
  // 375×812 (캔버스 335 × 812, 화각 55°): 위아래 자리가 모자라 줄어든다
  const perPx = (2 * 8.4 * Math.tan((55 * Math.PI) / 360)) / 812;
  const phone = (top, cardWidth, cardHeight) => fitDetail({
    free: { left: 0, top, right: 335, bottom: 812 }, canvasWidthPx: 335, canvasHeightPx: 812,
    fovDeg: 55, distance: 8.4, cardWidth, cardHeight, scale: 0.9,
  });
  const tight = phone(570, 2.2, 3.2);
  assert.ok(tight.scale < 0.9 && tight.scale >= 0.3);
  close(tight.scale * 3.2, (788 - 594) * perPx, 1e-9); // 카드 높이 = 남는 자리 높이
  // 글이 화면을 거의 다 차지해도 0.3배 아래로는 안 줄인다
  close(phone(800, 2.2, 3.2).scale, 0.3);
  // 가로형: 폭(335px − 양옆 24px)에 맞춰 줄인다
  const wide = phone(300, 4.4, 2.475);
  close(wide.scale * 4.4, (335 - 48) * perPx, 1e-9);
  close(wide.x, 0);
});

test('fitDetail 넓은 화면: 레퍼 자리(왼쪽 0.8·0.9배)가 들어가면 그대로, 상세 패널이나 화면 끝에 닿으면 안으로 밀고 그래도 크면 줄인다', () => {
  const desktop = (cardWidth, cardHeight, w = 1365, h = 900, panel = 420) => {
    const fovDeg = fovFor(w / h);
    return {
      fit: fitDetail({
        free: { left: 0, top: 0, right: w - panel, bottom: h }, canvasWidthPx: w, canvasHeightPx: h,
        fovDeg, distance: 8.4, cardWidth, cardHeight, scale: 0.9, want: SHELF.detailOffset,
      }),
      u: (2 * 8.4 * Math.tan((fovDeg * Math.PI) / 360)) / h,
      w, h, panel,
    };
  };
  // 1440×900 세로형: 레퍼 값 그대로
  const portrait = desktop(2.2, 3.2).fit;
  close(portrait.x, -0.8);
  close(portrait.y, 0);
  close(portrait.scale, 0.9);
  // 1440×900 가로형: 크기는 0.9배 그대로, 오른쪽 끝이 패널에서 24px 떨어지게 왼쪽으로
  const land = desktop(4.4, 2.475);
  close(land.fit.scale, 0.9);
  close(land.fit.x + (4.4 * 0.9) / 2, (1365 - 420 - 24 - 1365 / 2) * land.u);
  // 태블릿 810×1080 (캔버스 735, 패널 44% = 323px) 가로형: 패널 왼쪽 빈 칸 폭에 맞춰 줄인다
  const tablet = desktop(4.4, 2.475, 735, 1080, 735 * 0.44);
  close(tablet.fit.scale * 4.4, (735 - 735 * 0.44 - 48) * tablet.u, 1e-9);
});

test('fitDetail: 어떤 화면·모양이어도 상세 카드는 빈 칸 안 여백 24px 안쪽에 다 들어간다 (잘리지 않음)', () => {
  for (const [w, h] of [[1365, 900], [1845, 1080], [1125, 768], [735, 1080], [679, 947], [335, 812], [320, 568]]) {
    const fovDeg = fovFor(w / h);
    const u = (2 * 8.4 * Math.tan((fovDeg * Math.PI) / 360)) / h;
    const free = w >= 735 ? { left: 0, top: 0, right: w - Math.min(420, w * 0.44), bottom: h } : { left: 0, top: h * 0.45, right: w, bottom: h };
    for (const size of Object.values(FORMATS)) {
      const fit = fitDetail({
        free, canvasWidthPx: w, canvasHeightPx: h, fovDeg, distance: 8.4,
        cardWidth: size.width, cardHeight: size.height, scale: 0.9, want: w >= 735 ? SHELF.detailOffset : null,
      });
      const hw = (size.width * fit.scale) / 2;
      const hh = (size.height * fit.scale) / 2;
      const eps = 1e-9;
      assert.ok(fit.x - hw >= (free.left + 24 - w / 2) * u - eps, `${w}×${h} 왼쪽`);
      assert.ok(fit.x + hw <= (free.right - 24 - w / 2) * u + eps, `${w}×${h} 오른쪽`);
      assert.ok(fit.y + hh <= (h / 2 - free.top - 24) * u + eps, `${w}×${h} 위`);
      assert.ok(fit.y - hh >= (h / 2 - free.bottom + 24) * u - eps, `${w}×${h} 아래`);
      assert.ok(fit.scale <= 0.9 + eps);
    }
  }
});
