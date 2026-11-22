// ─────────────────────────────────────────────────────────────
// layout.js — 05 우주 표류: 균일 배치·둥실·흔들림·빛 위치·별먼지 (Three.js 없이 숫자만)
// 반짝임 원리 참고(코드 X): 포켓몬 홀로 카드 CSS의 글레어, 포일 스티커 셰이더의 반짝이 알갱이
// ─────────────────────────────────────────────────────────────
import { clamp, smoothstep } from '../../shared/motion.js?v=3';
import { mulberry32 } from '../../shared/random.js?v=1';

const TAU = Math.PI * 2;
// 배치: 사용자가 보내준 레퍼(Paul Smith "Collectors Club" 우표 4장)처럼 카드가 가운데를 느슨하게 둘러싸고,
// 각자 다른 각도로 비스듬히 기울어 손으로 툭툭 놓은 듯 균형 있게. (무작위 → 격자 → 이 배치)
//   sx·sy: 화면 세로 반폭을 1로 본 위치 (사진에서 우표 중심을 재서 옮김), tilt: 화면 안에서 기운 각도(라디안, +는 반시계)
//   5번째(왼쪽 위)는 사진에 없는 자리라 비어 있는 쪽에 균형 맞춰 추가
//   다듬기 (사용자 선택 "가운데로 모으기 + 크기 고르게"): 우리 장면엔 레퍼처럼 가운데 큰 글자가 없어서
//   둘러싸기만 하면 가운데가 휑했다 → 우표 위치·기울기 비율은 그대로, 무리 전체를 가운데로 30% 좁혀 한 덩어리로.
//   그다음 "오른쪽·왼쪽 겹침 해제" → 겹치던 왼쪽 두 장, 맞닿던 오른쪽 두 장을 조금씩 벌려서
//   둥실거려도 모든 카드 사이에 틈이 0.07 넘게 (기울어진 사각형끼리 계산)
//   depth: 카메라에서의 거리. 깊이감을 주려고 다 다르게 했는데 12~24는 크기가 들쭉날쭉해서 14~19로 좁힘
//          (크기 차이 ±15% 안, 깊이감은 밝기 차이·마우스 시차·별먼지로)
export const ROW_DEPTH = 16;              // 기본 거리 (카드 크기·모이는 자리 기준)
export const COMPOSITION = [
  { sx: -0.13, sy: -0.38, tilt: 0.28, depth: 14 },  // 분홍 우표 자리 (가운데 아래, 16°) — 가장 가까움
  { sx: 0.38, sy: 0.33, tilt: -0.18, depth: 15 },   // 주황 우표 자리 (오른쪽 위, −10°)
  { sx: -0.4, sy: 0.25, tilt: 0.21, depth: 17 },    // 추가 (왼쪽 위, 12°)
  { sx: -0.57, sy: -0.24, tilt: 0.45, depth: 19 },  // 파랑 우표 자리 (왼쪽 아래, 26°) — 가장 멂
  { sx: 0.55, sy: -0.21, tilt: -0.27, depth: 18 },  // 초록 우표 자리 (오른쪽, −15°)
];
export const COMPOSITION_CARD = 0.4;      // 카드 높이 = 화면 세로 반폭 × 0.4 → 화면 높이의 20% (사진 우표 18%)
export const COMPOSITION_WIDTH = 0.8;     // 배치가 가로로 차지하는 반폭 (세로 반폭 단위). 이보다 좁은 화면은 전체를 줄인다
const LAYER_GAP = 0.05;                   // 겹칠 때 깜빡이지 않게 순서(0 = 맨 앞)마다 이만큼씩 뒤로

// 화면이 배치보다 좁으면(폰 세로) 배치 전체를 같은 비율로 줄여서 다 들어오게
export function compositionScale(aspect) {
  return Math.min(1, aspect / COMPOSITION_WIDTH);
}

// 배치 자리 → 공간 좌표 (카메라는 원점에서 −z를 본다). 거리 d에서 화면 세로 반폭 = tan(화각/2) × d
//   그 카드의 거리(depth)에서 계산해서, 거리가 달라도 화면 위치는 배치 그대로.
//   layer: 앞뒤 순서 (0 = 맨 앞). compositionRanks로 정한 순서를 넘긴다
export function compositionPosition(slot, layer, { fov, aspect }) {
  const depth = slot.depth ?? ROW_DEPTH;
  const unit = Math.tan((fov * Math.PI) / 360) * depth * compositionScale(aspect);
  return { x: slot.sx * unit, y: slot.sy * unit, z: -depth - layer * LAYER_GAP };
}

// 앞뒤 순서: 가장 가까운 카드가 0번(맨 앞), 거리가 같으면 화면 가운데에 가까운 쪽. 모이기 더미의 순서와 같아서
// 흩어져 있을 때부터 다 모일 때까지 앞뒤가 한 번도 안 바뀐다 → 겹치는 도중에 위아래가 뒤집히지 않음
export function compositionRanks(slots) {
  const depthOf = (slot) => slot.depth ?? ROW_DEPTH;
  const order = slots.map((_, i) => i).sort((a, b) => depthOf(slots[a]) - depthOf(slots[b])
    || Math.hypot(slots[a].sx, slots[a].sy) - Math.hypot(slots[b].sx, slots[b].sy));
  const ranks = new Array(slots.length);
  order.forEach((slotIndex, rank) => { ranks[slotIndex] = rank; });
  return ranks;
}

// 카드 높이(공간 단위): 모든 카드가 같은 크기
export function compositionCardHeight({ fov, aspect }) {
  return Math.tan((fov * Math.PI) / 360) * ROW_DEPTH * compositionScale(aspect) * COMPOSITION_CARD;
}

// 등장: 레퍼(Paul Smith Collectors Club) 실제 사이트 코드에서 확인한 그대로.
//   우표 묶음 전체가 Vue 전환 "scale-down"으로 들어온다:
//     .scale-down-enter-from { opacity: 0; transform: scale(1.1) } → .scale-down-enter-to { opacity: 1; transform: scale(1) }
//     .scale-down-enter-active { transition: transform 1s }  (투명도엔 전환이 없어서 바로 보이고, 크기만 1초 동안 줄어든다)
//   날아오거나 돌거나 휘지 않는다 — 우표를 종이에 꾹 찍어 붙이는 느낌.
//   (그동안 화면 밖에서 날아오기 → 커지며 모이기 → 떨어지기 → 책장 넘기기를 해봤는데 다 과했다)
export const SETTLE_IN = { from: 1.1, duration: 1 };

// 3차 베지어 한 축 값 (시작 0, 끝 1, 조절점 p1·p2)
function bezierAxis(u, p1, p2) {
  const v = 1 - u;
  return 3 * v * v * u * p1 + 3 * v * u * u * p2 + u * u * u;
}

// CSS 기본 이징 "ease" = cubic-bezier(0.25, 0.1, 0.25, 1): 시간 t(0~1) → 진행도. 가로축을 반으로 나눠 찾아서 세로축 값을 돌려준다
export function cssEase(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  let low = 0;
  let high = 1;
  let u = t;
  for (let i = 0; i < 40; i++) {
    const x = bezierAxis(u, 0.25, 0.25);
    if (Math.abs(x - t) < 1e-7) break;
    if (x < t) low = u;
    else high = u;
    u = (low + high) / 2;
  }
  return bezierAxis(u, 0.1, 1);
}

// 페이지를 연 뒤 time초 때 묶음 전체 크기 배율 (1.1 → 1)
export function settleIn(time) {
  const t = clamp(time / SETTLE_IN.duration, 0, 1);
  return SETTLE_IN.from + (1 - SETTLE_IN.from) * cssEase(t);
}

// 카드마다 둥실·흔들림 박자 (같은 시드면 같은 박자). 자리는 균일 배치가 정한다
export function createCosmos(count, seed) {
  const random = mulberry32(seed);
  const cards = [];
  for (let i = 0; i < count; i++) {
    cards.push({
      floatPeriod: 14 + random() * 10,   // 한 번 오르내리는 데 14~24초
      floatPhase: random() * TAU,
      wobblePeriodX: 9 + random() * 8,   // 각도가 한 번 흔들리는 데 9~17초
      wobblePeriodY: 9 + random() * 8,
      wobblePhaseX: random() * TAU,
      wobblePhaseY: random() * TAU,
    });
  }
  return cards;
}

// 둥실둥실: 위아래 0.18 + 좌우 0.08 (× amount), 카드마다 다른 박자. clock은 "떠다니는 시계"(초)
export function floatOffset(card, clock, amount) {
  const t = (clock * TAU) / card.floatPeriod + card.floatPhase;
  return { x: Math.cos(t * 0.6) * 0.08 * amount, y: Math.sin(t) * 0.18 * amount };
}

// 각도 흔들림: 정면에서 최대 maxAngle(라디안) 안에서 천천히. 카드마다 박자가 달라서 빛 받는 순간도 다르다
export function wobbleAngles(card, clock, maxAngle) {
  return {
    rotX: Math.sin((clock * TAU) / card.wobblePeriodX + card.wobblePhaseX) * maxAngle,
    rotY: Math.sin((clock * TAU) / card.wobblePeriodY + card.wobblePhaseY) * maxAngle,
  };
}

// 글레어 빛 위치: 카메라 바로 앞(z −3)에서 카드들 앞을 8자(리사주)로 훑는 작은 전구.
// 처음엔 아주 먼 곳의 평행한 빛(방향)으로 했더니, 평평한 카드는 어디서나 같은 각도로 반사해서
// 각도가 맞으면 카드 전체가 통째로 하얗게 터졌다. 가까운 전구는 카드 위치마다 빛이 오는 방향이 달라서
// 반사가 "빛 점"으로 맺히고, 전구가 움직이면 빛 점이 카드 위를 쓱 지나간다 (거울에 비친 손전등 원리).
//   angle: 0→2π가 한 바퀴
export const GLINT_SWEEP = { x: 9, y: 5.5, z: -3 };
export function glintPosition(angle) {
  return [Math.sin(angle) * GLINT_SWEEP.x, Math.sin(angle * 0.7 + 1) * GLINT_SWEEP.y, GLINT_SWEEP.z];
}

// 먼 카드일수록 어둡게 (깊이 어둠): 가장 가까운 거리 1 → 가장 먼 거리 1 − amount
export const DEPTH_DIM = { near: 14, far: 19, amount: 0.35 };
export function depthDim(depth) {
  return 1 - DEPTH_DIM.amount * smoothstep(DEPTH_DIM.near, DEPTH_DIM.far, depth);
}

// 별먼지 3겹 (깊이감): 먼 별 · 카드 사이 먼지 · 카메라 바로 앞 먼지.
//   zNear·zFar: 카메라에서의 거리 범위, halfX·halfY: 퍼지는 반폭 (그 거리에서 화면 밖까지 덮게, 화면비 2.4 기준),
//   sizeMin·sizeMax: 화면 픽셀 크기, drift: 초당 떠다니는 양 (상자를 넘으면 반대편에서 다시 나온다), opacity: 밝기
//   가까운 먼지일수록 크고 흐릿하고 빨리 지나가서, 마우스로 시점을 옮기면 먼 별·카드·먼지가 서로 다르게 움직인다
export const STAR_LAYERS = {
  far: { zNear: 38, zFar: 98, halfX: 85, halfY: 48, sizeMin: 0.6, sizeMax: 2.2, drift: [0, 0, 0], opacity: 0.85 },
  mid: { zNear: 8, zFar: 30, halfX: 28, halfY: 13, sizeMin: 0.5, sizeMax: 1.6, drift: [0.05, 0.1, 0], opacity: 0.6 },
  near: { zNear: 2, zFar: 7, halfX: 7.5, halfY: 4, sizeMin: 2.5, sizeMax: 5, drift: [0.08, 0.18, 0], opacity: 0.3 },
};

// 한 겹의 별먼지: 상자 안에 흩뿌린 점 (대부분 작고 가끔 큰 점). phase·speed: 점마다 다른 깜빡임 박자
export function createStarLayer(count, seed, layer) {
  const random = mulberry32(seed);
  const stars = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: (random() * 2 - 1) * layer.halfX,
      y: (random() * 2 - 1) * layer.halfY,
      z: -(layer.zNear + random() * (layer.zFar - layer.zNear)),
      size: layer.sizeMin + Math.pow(random(), 3) * (layer.sizeMax - layer.sizeMin),
      phase: random() * TAU,
      speed: 0.6 + random() * 1.6,
    });
  }
  return stars;
}

// 먼 별 (예전 이름 그대로)
export function createStars(count, seed) {
  return createStarLayer(count, seed, STAR_LAYERS.far);
}
