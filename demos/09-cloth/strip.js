// ─────────────────────────────────────────────────────────────
// strip.js — 09 천 포스터: 띠 배치 · 원근 · 카드 크기 · 스크롤 수학 (순수 함수)
// 숫자 출처: DomGL Cloth 저장소 app/shaders/rig.ts, app/components/Strip.vue (코드는 가져오지 않았다).
// 원본은 화면처럼 y가 아래인 좌표라, Three.js(y 위)에 맞게 y를 뒤집어 같은 배치를 만든다. 단위는 px.
// ─────────────────────────────────────────────────────────────
import { wrapCentered } from '../../shared/motion.js?v=3';

export const RIG = {
  roll: 0.56,     // 띠 기울기 (rad, 32°)
  rollTall: 0.34, // 세로로 긴 화면 (19°)
  yaw: 0.5,       // 띠를 y축으로 비틀어 오른쪽이 멀어지게
  focal: 1.5,     // 눈 거리 = 화면 높이 × 1.5
  turn: 1.15,     // 카드가 띠에 대해 돌아선 각도 (실제 카드 방향 = turn − yaw)
};

export const STRIP = {
  count: 10,
  aspect: 4 / 3,                    // 카드 세로 / 가로 (3:4)
  // 카드 폭·간격 (rem). 원본 1rem = 10 × 화면 폭 / size (px), 5px 아래로는 안 작아짐
  wide: { width: 36, gap: 2, size: 1440 },  // 화면 650px 이상: 1440 화면에서 360px · 간격 20px
  narrow: { width: 28, gap: 1, size: 390 }, // 좁은 화면: 390 화면에서 280px · 간격 10px
  breakpoint: 650,
  remMin: 5,
  ease: 0.1,                        // 매 프레임 목표까지 남은 거리의 10%씩
  enter: { from: 1.5, wait: 0.15, ease: 0.04 }, // 등장: 화면 폭 1.5배 밖에서, 0.15초 뒤, 4%씩
  dragGear: 1.5,                    // 드래그 배율 (원근으로 줄어든 만큼 ÷ cos(yaw)를 더 곱한다)
};

export function rollFor(width, height) {
  return height > width ? RIG.rollTall : RIG.roll;
}

// 눈이 화면 높이 × focal 거리에 있을 때 세로 화각(도)
export function fovFromFocal(focal = RIG.focal) {
  return (2 * Math.atan(0.5 / focal) * 180) / Math.PI;
}

// 띠 좌표(x = 띠 방향) → 방 좌표. 원본 toRoom을 y 뒤집어 옮김
export function toRoom(x, y, z, roll = RIG.roll, yaw = RIG.yaw) {
  const down = -y;
  const ax = x * Math.cos(yaw) + z * Math.sin(yaw);
  const az = -x * Math.sin(yaw) + z * Math.cos(yaw);
  const rx = ax * Math.cos(roll) + down * Math.sin(roll);
  const ry = -ax * Math.sin(roll) + down * Math.cos(roll);
  return [rx, -ry, az];
}

// 카드 자기 좌표 → 방 좌표 회전 (행 우선 3×3). 원본 facing(about, roll)을 y 뒤집기(F·M·F)로 옮김
export function facing(about = RIG.turn - RIG.yaw, roll = RIG.roll) {
  const ca = Math.cos(about);
  const sa = Math.sin(about);
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);
  const m = [ca * cr, sr, -sa * cr, -ca * sr, cr, sa * sr, sa, 0, ca];
  return [m[0], -m[1], m[2], -m[3], m[4], -m[5], m[6], -m[7], m[8]];
}

// 방 좌표의 점을 카드 자기 좌표로 (회전의 역 = 전치)
export function toCard(point, m) {
  const [x, y, z] = point;
  return [
    m[0] * x + m[3] * y + m[6] * z,
    m[1] * x + m[4] * y + m[7] * z,
    m[2] * x + m[5] * y + m[8] * z,
  ];
}

// 카드 i의 띠 위 위치 (화면 가운데 = 0). 띠 길이(count × spacing)로 감겨 끝없이 돈다
export function slideOffsets(count, spacing, scroll) {
  const loop = count * spacing;
  return Array.from({ length: count }, (_, i) => wrapCentered(i * spacing - scroll, loop));
}

export function cardSize(viewportWidth) {
  const s = viewportWidth >= STRIP.breakpoint ? STRIP.wide : STRIP.narrow;
  const rem = Math.max(STRIP.remMin, (10 * viewportWidth) / s.size);
  const width = s.width * rem;
  const gap = s.gap * rem;
  return { width, height: width * STRIP.aspect, gap, spacing: width + gap };
}

// 원본 column: 매 프레임 목표까지 남은 거리의 ease만큼 (프레임 길이에 맞게 보정)
export function easeToward(current, target, ease, dt) {
  return current + (target - current) * (1 - (1 - ease) ** (dt * 60));
}

// 화면 드래그(px, y 아래) → 띠 스크롤 양. 띠 방향 성분만, 원근으로 줄어든 만큼 키운다
export function dragDelta(dx, dy, roll = RIG.roll, yaw = RIG.yaw) {
  return ((dx * Math.cos(roll) - dy * Math.sin(roll)) * STRIP.dragGear) / Math.cos(yaw);
}
