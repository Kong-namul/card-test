// ─────────────────────────────────────────────────────────────
// gather.js — 02 구: "공 → 한 더미" 줄줄이 곡선 모이기 계산 (Three.js 없이 숫자만)
// 참고: Codrops "Creating a Thumbnail Flow Animation with GSAP MotionPath"(2026-06) —
//       한 장씩 시간차로, 휜 길(한 방향 95% · 다른 방향 9.5% 지점을 거쳐), expo.inOut. 코드는 가져오지 않고 원리만.
// 실험 페이지에서 세 방식(줄줄이+세워서 / 줄줄이 곡선 / 01처럼 접기)을 나란히 보고 사용자가 고른 방식.
// 팽이·등불 (사용자 아이디어): 카드가 비스듬한 축으로 엎어지지 않고 세로축으로 자기 각도만큼(정면 0°, 뒤 180°) 돌게.
// ─────────────────────────────────────────────────────────────

export const GATHER = {
  mode: 'classicSpin', // 모이기 방식 4가지 (모두 사용자 확정 시안): classicSpin 팽이(기본) · cylinder 등불 · classic 눈뭉치 · flow 물줄기
  spread: 0.5,         // 첫 장과 마지막 장 출발 차이 (모이기 구간 대비)
  frontFirst: true,    // 카메라에 가까운 카드부터 출발
  verticalFirst: true, // 위아래 먼저 맞추고 옆에서 접혀 들어오기 (끄면 옆 먼저 → 가운데 세로 기둥)
  waypointNear: 0.95,  // 휜 길이 거치는 지점: 먼저 맞추는 방향은 95%까지 (Thumbnail Flow)
  waypointFar: 0.095,  //                     나중 방향은 9.5%만
};

// 등불: 공이 원통이 되면서 가운데로 모인다 (사용자: "원통이 된 다음이 아니라, 원통형이 되면서 합쳐지게 — 이어지게").
// 원통 반지름 4.0(공 4.5보다 살짝 안쪽), 높이는 0.7배. 진행도는 한 번에(다 같이 같은 값), 시간차 없음.
// 사용자 "원통 조금만 덜, 더 느리게" → 원통은 60%까지만(공 느낌이 남은 통 모양), 진행도 0~0.9에 걸쳐 천천히 되고,
// 가운데로는 처음부터 끝까지(0~1) 줄어든다. amount·unfold 끝은 패널에서 조절
export const CYLINDER = {
  radius: 4.0,
  heightScale: 0.7,
  amount: 0.6,
  unfold: [0, 0.9],
  collapse: [0, 1],
  spread: 0,
};

const clamp01 = (t) => Math.min(1, Math.max(0, t));

// GSAP expo.inOut과 같은 모양: 처음·끝은 거의 멈춰 있고 가운데서 확 움직인다
export function expoInOut(t) {
  t = clamp01(t);
  if (t === 0 || t === 1) return t;
  return t < 0.5 ? 2 ** (20 * t - 10) / 2 : (2 - 2 ** (-20 * t + 10)) / 2;
}

// 한 장씩 시간차: 전체 진행 lin(0~1) 중 순위 rank 카드의 몫(0~1).
// 첫 장은 0에서, 마지막 장은 spread에서 출발하고 모두 1에서 도착한다
export function staggerProgress(lin, rank, count, spread) {
  if (count <= 1 || spread <= 0) return clamp01(lin);
  const start = spread * (rank / (count - 1));
  return clamp01((lin - start) / (1 - spread));
}

// 휜 길: 2차 베지어. 거치는 지점은 한 방향은 95%, 다른 방향은 9.5%만 간 곳.
// verticalFirst = true:  위아래가 먼저 맞춰져 가로 띠가 되고, 옆(가로·앞뒤)에서 접혀 들어온다
// verticalFirst = false: 옆으로 먼저 쓸려 들어오고 위아래는 나중에 (Thumbnail Flow 원래 방향)
export function curvedPoint(from, to, t, verticalFirst = GATHER.verticalFirst) {
  const side = verticalFirst ? GATHER.waypointFar : GATHER.waypointNear;
  const up = verticalFirst ? GATHER.waypointNear : GATHER.waypointFar;
  const w = {
    x: from.x + (to.x - from.x) * side,
    y: from.y + (to.y - from.y) * up,
    z: from.z + (to.z - from.z) * side,
  };
  const a = (1 - t) * (1 - t);
  const b = 2 * (1 - t) * t;
  const c = t * t;
  return {
    x: a * from.x + b * w.x + c * to.x,
    y: a * from.y + b * w.y + c * to.y,
    z: a * from.z + b * w.z + c * to.z,
  };
}

// 공 위 p에서 바깥을 보는 방향을 "좌우 각도(yaw) + 위아래 숙임(pitch)"으로 나눈다.
// 회전 순서 YXZ(숙이고 → 돌기)로 다시 합치면 원래 방향과 정확히 같다
export function outwardAngles(p) {
  const len = Math.hypot(p.x, p.y, p.z) || 1;
  return { yaw: Math.atan2(p.x, p.z), pitch: -Math.asin(p.y / len) };
}

// 등불: 공 위 p의 원통 자리. 좌우 각도는 그대로, 가운데에서의 거리는 원통 반지름으로, 높이는 줄여서
export function cylinderPoint(p, { radius, heightScale } = CYLINDER) {
  const yaw = Math.atan2(p.x, p.z);
  return { x: radius * Math.sin(yaw), y: p.y * heightScale, z: radius * Math.cos(yaw), yaw };
}

// 세로축으로 자기 각도만큼 돌아 정면으로: 남은 각도 = yaw × (1 − t). 정면 카드는 조금, 뒤 카드는 180°
export function collapseYaw(yaw, t) {
  return yaw * (1 - clamp01(t));
}
