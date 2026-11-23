import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GATHER, CYLINDER, SEAM, expoInOut, staggerProgress, curvedPoint, cylinderPoint, collapseYaw, outwardAngles, bandYaw, turnProgress } from '../demos/02-sphere/gather.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('기본값: 등불이 기본 (사용자 선택), 물줄기 옵션은 출발 간격 0.5 · 앞 카드부터 · 가로 띠로 먼저', () => {
  assert.deepEqual(GATHER, { mode: 'cylinder', spread: 0.5, frontFirst: true, verticalFirst: true, waypointNear: 0.95, waypointFar: 0.095 });
});

test('expoInOut: GSAP expo.inOut 모양 — 0·1 고정, 가운데 0.5, 앞뒤 대칭, 처음엔 거의 안 움직임', () => {
  assert.equal(expoInOut(0), 0);
  assert.equal(expoInOut(1), 1);
  close(expoInOut(0.5), 0.5);
  close(expoInOut(0.2) + expoInOut(0.8), 1);
  assert.ok(expoInOut(0.1) < 0.01);
  assert.equal(expoInOut(-1), 0);
  assert.equal(expoInOut(2), 1);
});

test('staggerProgress: 첫 장은 바로, 마지막 장은 시간차만큼 늦게 출발하고 모두 끝에 도착', () => {
  // 32장, 시간차 0.5 → 카드마다 자기 몫은 전체의 절반
  assert.equal(staggerProgress(0, 0, 32, 0.5), 0);
  close(staggerProgress(0.25, 0, 32, 0.5), 0.5);
  assert.equal(staggerProgress(0.5, 0, 32, 0.5), 1);
  assert.equal(staggerProgress(0.5, 31, 32, 0.5), 0);   // 마지막 장은 이제 출발
  close(staggerProgress(0.75, 31, 32, 0.5), 0.5);
  assert.equal(staggerProgress(1, 31, 32, 0.5), 1);
  // 순위가 뒤일수록 늦다
  assert.ok(staggerProgress(0.4, 5, 32, 0.5) > staggerProgress(0.4, 20, 32, 0.5));
  // 시간차 0이면 다 같이
  close(staggerProgress(0.3, 31, 32, 0), 0.3);
});

test('curvedPoint: 출발·도착은 정확히, 위아래 먼저면 중간에 높이가 거의 다 맞춰지고 옆은 덜 왔다', () => {
  const from = { x: 4, y: 3, z: 2 };
  const to = { x: 0, y: 0, z: 0 };
  assert.deepEqual(curvedPoint(from, to, 0, true), from);
  const end = curvedPoint(from, to, 1, true);
  close(end.x, 0); close(end.y, 0); close(end.z, 0);

  const mid = curvedPoint(from, to, 0.5, true);
  const yDone = (from.y - mid.y) / from.y;
  const xDone = (from.x - mid.x) / from.x;
  assert.ok(yDone > 0.7 && xDone < 0.3, `위아래 ${yDone}, 옆 ${xDone}`);
  close((from.z - mid.z) / from.z, xDone); // 앞뒤는 옆과 같이

  // 옆 먼저(원본 Thumbnail Flow 방향)는 반대
  const side = curvedPoint(from, to, 0.5, false);
  assert.ok((from.x - side.x) / from.x > 0.7 && (from.y - side.y) / from.y < 0.3);
});

test('원통 자리: 공 위 각도(좌우)는 그대로, 반지름은 원통으로 통일, 높이는 줄여서', () => {
  const R = CYLINDER.radius;
  // 꼭대기 근처 카드(옆 반지름이 작음)도 원통 반지름까지 밀려난다
  const top = cylinderPoint({ x: 0.3, y: 4.4, z: 0.4 });
  close(Math.hypot(top.x, top.z), R);
  close(top.y, 4.4 * CYLINDER.heightScale);
  close(Math.atan2(top.x, top.z), Math.atan2(0.3, 0.4));
  close(top.yaw, Math.atan2(0.3, 0.4));
  // 정면·뒤 카드: 정면은 0, 뒤는 ±π
  close(cylinderPoint({ x: 0, y: 0, z: 4.5 }).yaw, 0);
  close(Math.abs(cylinderPoint({ x: 0, y: 0, z: -4.5 }).yaw), Math.PI);
});

test('원통 → 가운데에서 도는 양: 세로축으로 자기 각도만큼 (정면 0, 옆 90°, 뒤 180°) — 좌우 대칭', () => {
  close(collapseYaw(0, 0.5), 0);
  close(collapseYaw(Math.PI / 2, 0), Math.PI / 2);   // 아직 출발 전
  close(collapseYaw(Math.PI / 2, 1), 0);             // 도착하면 정면
  close(collapseYaw(Math.PI, 0.5), Math.PI / 2);     // 뒤 카드는 반쯤 왔을 때 90°만큼 남음
  close(collapseYaw(-2, 0.25), -1.5);                // 왼쪽은 반대로
});

test('등불: 한 번에(같은 진행도), 원통 정도 1(완전한 원통) · 펴지는 속도 0.8(진행도 0~0.8에 걸쳐) — 사용자가 패널로 고른 값', () => {
  assert.deepEqual(
    [CYLINDER.amount, CYLINDER.unfold, CYLINDER.collapse, CYLINDER.spread],
    [1, [0, 0.8], [0, 1], 0],
  );
});

test('cylinderPoint는 원통 정도만큼만 섞어 쓸 수 있다 (0 = 공 그대로, 1 = 완전한 원통)', () => {
  const p = { x: 0.3, y: 4.4, z: 0.4 };
  const full = cylinderPoint(p);
  const half = { x: p.x + (full.x - p.x) * 0.5, y: p.y + (full.y - p.y) * 0.5, z: p.z + (full.z - p.z) * 0.5 };
  // 공 → 원통 섞기는 main에서 lerp(공, 원통, 진행 × 원통 정도)로 한다: 정도 0.5면 끝까지 가도 50% 지점
  close(half.y, (4.4 + 4.4 * CYLINDER.heightScale) / 2);
});

test('바깥 보기 방향 나누기: 좌우 각도(yaw)와 위아래 숙임(pitch) — 시안 1·2가 세로축으로만 돌리는 기준', () => {
  const front = outwardAngles({ x: 0, y: 0, z: 2 });
  close(front.yaw, 0); close(front.pitch, 0);
  close(outwardAngles({ x: 3, y: 0, z: 0 }).yaw, Math.PI / 2);
  close(Math.abs(outwardAngles({ x: 0, y: 0, z: -1 }).yaw), Math.PI);
  close(outwardAngles({ x: 0, y: 1, z: 1 }).pitch, -Math.PI / 4); // 위쪽 카드는 위를 본다 (X축 음의 회전)
});

const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
const wrapPi = (a) => a - Math.round(a / (2 * Math.PI)) * 2 * Math.PI; // 각도 차이를 −180°~180°로

test('뒤쪽 띠 기본 넓이: 반폭 120° (60°~300°) — 띠 가운데가 너무 빨리 돌지 않게 넓게 (사용자 "영역을 길게", "속도가 비일관")', () => {
  close(SEAM.halfWidth, rad(120));
});

test('띠는 천천히 좁아진다: 반폭 × (1 − 모인 정도²) — 0.6에서 64%, 0.9에서 19% 남고 다 모이면 0', () => {
  // 모인 정도 0.6에서 정반대편 근처(띠 안)를 지날 때 도는 양이 앞쪽의 7배를 넘지 않는다 (예전 1−t는 12배)
  const t = 0.6;
  let peak = 0;
  for (let d = 90; d < 270; d += 0.5) peak = Math.max(peak, Math.abs(wrapPi(bandYaw(rad(d + 0.5), t) - bandYaw(rad(d), t))) / rad(0.5));
  assert.ok(peak / (1 - t) < 7, `띠 가운데가 앞쪽의 ${(peak / (1 - t)).toFixed(1)}배`);
});

test('bandYaw: 띠 밖(앞·옆)은 지금처럼 자기 각도만큼 — 정면 0°, 옆 60°는 반쯤 모이면 30°', () => {
  close(bandYaw(0, 0.5), 0);
  close(bandYaw(rad(60), 0.5), rad(30));
  close(bandYaw(rad(-50), 0.25), rad(-37.5));
});

test('bandYaw: 모이기 0이면 원래 방향 그대로, 다 모이면 전부 정면 (뒤쪽 카드 포함)', () => {
  for (let d = -179; d <= 180; d += 7) {
    close(wrapPi(bandYaw(rad(d), 0) - rad(d)), 0);
    close(wrapPi(bandYaw(rad(d), 1)), 0);
  }
});

test('고치기 전 방식은 정반대편(180°)에서 이웃 카드끼리 크게 갈린다 — 띠 방식은 0.1° 옆 카드와 2° 미만 (다 모여가는 0.9에선 띠가 좁아 3° 미만)', () => {
  // 고치기 전: 179.9° 와 −179.9° (0.2° 떨어진 이웃) 이 반쯤 모이면 180° 가까이 다르게 돈다
  const naiveGap = Math.abs(wrapPi(collapseYaw(rad(179.9), 0.5) - collapseYaw(rad(-179.9), 0.5)));
  assert.ok(naiveGap > rad(170), `고치기 전 이웃 차이 ${deg(naiveGap)}°`);
  for (const t of [0.1, 0.3, 0.5, 0.7, 0.9]) {
    let worst = 0;
    let prev = bandYaw(rad(-180), t);
    for (let d = -179.9; d <= 180; d += 0.1) {
      const now = bandYaw(rad(d), t);
      worst = Math.max(worst, Math.abs(wrapPi(now - prev)));
      prev = now;
    }
    const limit = t >= 0.9 ? 3 : 2;
    assert.ok(worst < rad(limit), `모인 정도 ${t}: 이웃 차이 최대 ${deg(worst).toFixed(2)}°`);
  }
});

test('같은 자리 카드는 모이는 동안 휙 뒤집히지 않는다 (모인 정도 0.9까지 — 그 뒤 마지막 구간엔 정반대편 바로 옆 카드만 빨리 돌아 정면을 맞춘다, 더미 맨 뒤라 가려짐)', () => {
  for (const d of [100, 150, 175, 179, 181, 200, 250]) {
    let worst = 0;
    let prev = bandYaw(rad(d), 0);
    for (let t = 0.002; t <= 0.9001; t += 0.002) {
      const now = bandYaw(rad(d), t);
      worst = Math.max(worst, Math.abs(wrapPi(now - prev)));
      prev = now;
    }
    assert.ok(worst < rad(10), `${d}°: 한 걸음 최대 ${deg(worst).toFixed(2)}°`);
  }
});

test('도는 것은 모이기 85%에서 끝난다 — 더미에 들어올 땐 정반대편 근처 카드도 이미 정면 (사용자 스크린샷: 마지막에 비스듬한 카드가 앞으로 삐져나옴)', () => {
  close(SEAM.finishBy, 0.85);
  close(turnProgress(0), 0);
  close(turnProgress(0.425), 0.5);
  close(turnProgress(0.85), 1);
  close(turnProgress(0.97), 1);
  // 고치기 전: 다 모이기 직전(0.97)에 179° 카드가 아직 크게 돌아 있어서 더미 앞으로 삐져나왔다
  assert.ok(Math.abs(wrapPi(bandYaw(rad(179), 0.97))) > rad(60), '고치기 전엔 0.97에서도 크게 돌아 있어야 한다');
  // 고친 뒤: 85%부터는 어느 자리 카드든 정면
  for (const toward of [0.85, 0.9, 0.97, 1]) {
    for (let d = -179.5; d <= 180; d += 0.5) close(wrapPi(bandYaw(rad(d), turnProgress(toward))), 0);
  }
});
