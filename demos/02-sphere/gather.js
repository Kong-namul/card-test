// ─────────────────────────────────────────────────────────────
// gather.js — 02 구: "공 → 한 더미" 줄줄이 곡선 모이기 계산 (Three.js 없이 숫자만)
// 참고: Codrops "Creating a Thumbnail Flow Animation with GSAP MotionPath"(2026-06) —
//       한 장씩 시간차로, 휜 길(한 방향 95% · 다른 방향 9.5% 지점을 거쳐), expo.inOut. 코드는 가져오지 않고 원리만.
// 실험 페이지에서 세 방식(줄줄이+세워서 / 줄줄이 곡선 / 01처럼 접기)을 나란히 보고 사용자가 고른 방식.
// ─────────────────────────────────────────────────────────────

export const GATHER = {
  mode: 'flow',        // flow = 줄줄이 곡선 (기본) · classic = 원래 방식 (다 같이 직선으로)
  spread: 0.5,         // 첫 장과 마지막 장 출발 차이 (모이기 구간 대비)
  frontFirst: true,    // 카메라에 가까운 카드부터 출발
  verticalFirst: true, // 위아래 먼저 맞추고 옆에서 접혀 들어오기 (끄면 옆 먼저 → 가운데 세로 기둥)
  waypointNear: 0.95,  // 휜 길이 거치는 지점: 먼저 맞추는 방향은 95%까지 (Thumbnail Flow)
  waypointFar: 0.095,  //                     나중 방향은 9.5%만
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
