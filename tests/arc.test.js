import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ARC, slideMetrics, cameraDistance, arcGeometry, carouselTarget, stretchScales,
  deformPoint, smoothVelocity, chromaOffset, tiltFromPointer, expoOut, follow, coverUv,
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
    count: 6, cornerRadius: 4.5,
  });
});

test('원본 실측(1512×828): 6장이면 가운데 카드가 화면에서 824px 폭 · 가운데 494px 높이로 보인다', () => {
  const m = slideMetrics(1512, 828);
  const arc = arcGeometry(ARC.count, m.spacing);
  const D = cameraDistance(828);
  const project = ([x, y, z]) => [x * D / (D - z), y * D / (D - z)];
  const [edgeX] = project(deformPoint(m.width / 2, 0, 1, 0.5, { radius: arc.radiusX }));
  const [, topY] = project(deformPoint(0, m.height / 2, 0.5, 1, { radius: arc.radiusX }));
  assert.ok(Math.abs(edgeX * 2 - 824) < 3, `폭 ${edgeX * 2}`);
  assert.ok(Math.abs(topY * 2 - 494) < 3, `높이 ${topY * 2}`);
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
  close(edge.alpha, 0);
  const near = carouselTarget(0, arc.loop / 2 * 0.9, 885.2, arc, 1); // p = 0.9
  close(near.alpha, 1 - (0.9 - 0.85) / 0.15);
  close(carouselTarget(9, 0, 885.2, arc, 1).x, carouselTarget(1, 0, 885.2, arc, 1).x);
});

test('등장 전(호가 안 펴짐): 평평한 한 줄 그대로, 크기 1, 안 보임', () => {
  const arc = arcGeometry(8, 885.2);
  const flat = carouselTarget(1, 0, 885.2, arc, 0);
  [flat.x, flat.z, flat.rotY, flat.scale, flat.alpha].forEach((v, i) => close(v, [885.2, 0, 0, 1, 0][i]));
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

test('그림 채우기(cover): 카드 비율이 그림과 다르면 가운데를 잘라 쓴다 — 안 늘어난다 (원본 uCoverScale·uCoverOffset)', () => {
  // 같은 비율이면 그대로
  assert.deepEqual(coverUv(16 / 9, 16 / 9), { repeatX: 1, repeatY: 1, offsetX: 0, offsetY: 0 });
  // 세로 폰 카드(폭 1 : 높이 1.1)에 16:9 그림 → 가로 가운데 51%만
  const tall = coverUv(1 / 1.1, 16 / 9);
  close(tall.repeatX, (1 / 1.1) / (16 / 9));
  close(tall.offsetX, (1 - tall.repeatX) / 2);
  assert.equal(tall.repeatY, 1);
  assert.equal(tall.offsetY, 0);
  // 더 납작한 카드 → 세로 가운데만
  const wide = coverUv(3, 16 / 9);
  close(wide.repeatY, (16 / 9) / 3);
  close(wide.offsetY, (1 - wide.repeatY) / 2);
  assert.equal(wide.repeatX, 1);
});
