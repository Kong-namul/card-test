// ─────────────────────────────────────────────────────────────
// gather.js — 02 구: "공 → 한 더미" 줄줄이 곡선 모이기 계산 (Three.js 없이 숫자만)
// 참고: Codrops "Creating a Thumbnail Flow Animation with GSAP MotionPath"(2026-06) —
//       한 장씩 시간차로, 휜 길(한 방향 95% · 다른 방향 9.5% 지점을 거쳐), expo.inOut. 코드는 가져오지 않고 원리만.
// 실험 페이지에서 세 방식(줄줄이+세워서 / 줄줄이 곡선 / 01처럼 접기)을 나란히 보고 사용자가 고른 방식.
// 팽이·등불 (사용자 아이디어): 카드가 비스듬한 축으로 엎어지지 않고 세로축으로 자기 각도만큼(정면 0°, 뒤 180°) 돌게.
// 뒤쪽 갈림은 넓은 띠로 풀어서(bandYaw) 구가 계속 돌아도 휙 뒤집히거나 섞이지 않게.
// ─────────────────────────────────────────────────────────────

export const GATHER = {
  mode: 'cylinder',    // 모이기 방식 4가지 (모두 사용자 확정 시안): cylinder 등불(기본) · classicSpin 팽이 · classic 눈뭉치 · flow 물줄기
  spread: 0.5,         // 첫 장과 마지막 장 출발 차이 (모이기 구간 대비)
  frontFirst: true,    // 카메라에 가까운 카드부터 출발
  verticalFirst: true, // 위아래 먼저 맞추고 옆에서 접혀 들어오기 (끄면 옆 먼저 → 가운데 세로 기둥)
  waypointNear: 0.95,  // 휜 길이 거치는 지점: 먼저 맞추는 방향은 95%까지 (Thumbnail Flow)
  waypointFar: 0.095,  //                     나중 방향은 9.5%만
};

// 등불: 공이 원통이 되면서 가운데로 모인다 (사용자: "원통이 된 다음이 아니라, 원통형이 되면서 합쳐지게 — 이어지게").
// 원통 반지름 4.0(공 4.5보다 살짝 안쪽), 높이는 0.7배. 진행도는 한 번에(다 같이 같은 값), 시간차 없음.
// 사용자가 패널로 고른 값: 원통 정도 1(완전한 원통), 펴지는 속도 0.8(진행도 0~0.8에 걸쳐 천천히 펴짐).
// 가운데로는 처음부터 끝까지(0~1) 줄어든다. amount·unfold 끝은 패널에서 조절
export const CYLINDER = {
  radius: 4.0,
  heightScale: 0.7,
  amount: 1,
  unfold: [0, 0.8],
  collapse: [0, 1],
  spread: 0,
};

// 뒤쪽 띠: 정면 기준으로 도는 양이 오른쪽(+)과 왼쪽(−)으로 갈리는 경계를 정반대편(180°) 한 점이 아니라
// 뒤쪽 넓은 띠에 걸쳐 천천히 넘어가게 한다 (사용자 "180°에서 딱 갈리는 게 너무 잘 보여, 영역을 길게").
// 반폭 120° = 60°~300°. 띠는 화면 뒤에 고정, 모일수록 천천히 좁아지다(반폭 × (1 − t²)) 다 모이면 사라진다.
// (사용자 "속도가 비일관" → 반폭 90°·(1 − t)에서 넓히고 천천히 좁히니 띠 가운데 최고 속도가 절반쯤으로). 패널에서 조절
// finishBy: 도는 것은 모이기 85%에서 끝낸다. 띠가 사라지기 직전 정반대편 근처 카드가 급하게 도는데,
// 그게 더미에 들어온 뒤에 일어나면 비스듬한 카드가 맨 앞 카드 앞으로 삐져나온다 (사용자 스크린샷).
// 85%에 끝내면 그 순간은 카드들이 아직 더미에서 떨어져 있을 때 지나가고, 더미에선 모두 정면.
export const SEAM = {
  halfWidth: (Math.PI * 2) / 3,
  finishBy: 0.85,
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

// 띠를 쓴 도는 양: 띠 밖(앞·옆)은 collapseYaw 그대로(자기 각도만큼), 띠 안에서는 오른쪽 방향 → 왼쪽 방향으로 서서히 바뀐다.
// 띠 오른쪽 끝에선 오른쪽 규칙과, 왼쪽 끝에선 왼쪽 규칙과 (한 바퀴 차이로) 같은 방향이라 이음매가 없다.
// 띠 반폭은 모일수록 halfWidth × (1 − t²)로 천천히 좁아져서 다 모이면(t = 1) 모든 카드가 정면을 본다.
export function bandYaw(yaw, t, halfWidth = SEAM.halfWidth) {
  t = clamp01(t);
  const turn = Math.PI * 2;
  yaw -= Math.round(yaw / turn) * turn; // 어떤 값이 와도 −180°~180°로 맞춰서 센다
  const width = halfWidth * (1 - t * t);
  const around = yaw > 0 ? yaw : yaw + turn; // 0~360°로 펴서 세기 (뒤가 180°)
  if (width <= 0 || Math.abs(around - Math.PI) >= width) return collapseYaw(yaw, t);
  const x = (around - (Math.PI - width)) / (2 * width);
  const s = x * x * (3 - 2 * x); // 띠 안 위치 0(오른쪽 끝) → 1(왼쪽 끝), 부드럽게
  return around * (1 - t) + s * turn * t;
}

// 도는 진행도: 자리 이동 진행도(toward)보다 먼저 1이 된다 — 모이기 85%에서 다 돌아 정면
export function turnProgress(toward, finishBy = SEAM.finishBy) {
  return clamp01(toward / finishBy);
}
