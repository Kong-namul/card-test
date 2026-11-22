import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUTTERFLIES, BUTTERFLY_OPTIONS, CRYSTAL_GLASS, STUDIO, flapAngle } from '../demos/03-tunnel/butterflies.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const len = (v) => Math.hypot(...v);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

test('나비 선택지: 없음 · 은 모나크 · 각진 크리스탈', () => {
  assert.deepEqual(Object.values(BUTTERFLY_OPTIONS), ['none', 'monarch', 'faceted']);
});

test('모델마다 파일·출처가 있고, 날개 축과 경첩 축은 길이 1이며 서로 직각', () => {
  for (const key of ['monarch', 'faceted']) {
    const b = BUTTERFLIES[key];
    assert.ok(b.file.endsWith('.glb'));
    assert.ok(b.author && b.source.startsWith('https://poly.pizza/'));
    close(len(b.spanAxis), 1);
    close(len(b.hingeAxis), 1);
    close(dot(b.spanAxis, b.hingeAxis), 0);
    assert.ok(b.bodyHalf > 0 && b.bodyHalf < 0.2);
    assert.equal(typeof b.viewYaw, 'number'); // 모델별로 보기 좋은 기본 방향(도)
  }
});

test('모나크는 정면(180°)에서 45° 비스듬한 135°에서 출발 — 엉덩이(0°)로 시작하지 않게', () => {
  assert.equal(BUTTERFLIES.monarch.viewYaw, 135);
});

test('각진 크리스탈 기본 자세 = 사용자가 패널로 직접 맞춘 값 (방향 45°+87°, 앞뒤 −43°+8°)', () => {
  assert.equal(BUTTERFLIES.faceted.viewYaw, 132);
  close(BUTTERFLIES.faceted.baseTilt, -0.75 + (8 * Math.PI) / 180, 1e-3);
});

test('각진 크리스탈은 뒤집히지 않게 반대 방향(음수)으로 세운다', () => {
  assert.ok(BUTTERFLIES.faceted.baseTilt < 0);
});

test('나비 재질 = Codrops 터널 장면 헬멧의 유리 (쇠덩이 X): 빛 통과 1, 금속 0.1, 두께 10, 굴절률 1.9, 무지개 번짐 1', () => {
  assert.equal(CRYSTAL_GLASS.transmission, 1);
  assert.equal(CRYSTAL_GLASS.metalness, 0.1);
  assert.equal(CRYSTAL_GLASS.roughness, 0);
  assert.equal(CRYSTAL_GLASS.thickness, 10);
  assert.equal(CRYSTAL_GLASS.ior, 1.9);
  assert.equal(CRYSTAL_GLASS.dispersion, 1);
});

test('나비가 비추는 조명 = 검은 스튜디오 + 하얀 조명 띠 몇 개 (밝은 회색 방이면 유리가 우윳빛이 됨)', () => {
  assert.equal(STUDIO.background, 0x000000);
  assert.ok(STUDIO.lights.length >= 3);
  for (const light of STUDIO.lights) {
    assert.equal(light.position.length, 3);
    assert.equal(light.size.length, 3);
    assert.ok(light.intensity > 1); // 1보다 밝아야 검은 유리 위에 하얀 띠가 또렷하게 맺힌다
    assert.ok(Math.min(...light.size) < 0.5); // 얇은 판(띠)
  }
});

test('flapAngle: 시작은 0, 사인파로 ±세기만큼 오르내린다', () => {
  close(flapAngle(0, 2, 0.5), 0);
  close(flapAngle(Math.PI / 4, 2, 0.5), 0.5);   // sin(π/2) = 1
  close(flapAngle(3 * Math.PI / 4, 2, 0.5), -0.5);
});

test('각진 크리스탈은 벽처럼 딱 서지 않게 앞뒤로만 45° 안쪽으로 눕힌다 (X축)', () => {
  assert.ok(Math.abs(BUTTERFLIES.faceted.baseTilt) < Math.PI / 4); // 69°(1.2)로 세웠던 걸 45° 미만으로
});

test('기본 자세엔 옆으로 갸웃(Z축)이 없다 — 갸웃은 패널 슬라이더로만', () => {
  for (const key of ['monarch', 'faceted']) assert.equal('baseRoll' in BUTTERFLIES[key], false);
});
