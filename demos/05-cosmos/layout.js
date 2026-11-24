// ─────────────────────────────────────────────────────────────
// layout.js — 05 우주 표류: 다이아몬드 그리드 배치·마우스 밀림·움직임 세기·등장·면 일렁임·빛 위치·별먼지
//   (Three.js 없이 숫자만)
// 배치·밀림·일렁임·등장 숫자: Fiddle.Digital Experiments Hub(exp.fiddle.digital) 그리드 보기의
//   실제 코드에서 읽은 값 (원리·숫자만, 코드는 안 가져옴)
// 반짝임 원리 참고(코드 X): 포켓몬 홀로 카드 CSS의 글레어, 포일 스티커 셰이더의 반짝이 알갱이
// ─────────────────────────────────────────────────────────────
import { clamp, smoothstep } from '../../shared/motion.js?v=3';
import { mulberry32 } from '../../shared/random.js?v=1';

const TAU = Math.PI * 2;
export const ROW_DEPTH = 16;          // 모든 카드가 같은 거리 (레퍼처럼 평평한 그리드 → 렌즈 휨이 깔끔)
export const LAYER_GAP = 0.05;        // 겹칠 때 깜빡이지 않게 순서(0 = 맨 앞)마다 이만큼씩 뒤로
export const CARD_RATIO = 490 / 345;  // 공통 종이 카드 세로 ÷ 가로

// 레퍼 그리드 칸 (x 0~4 왼→오, y 0~4 위→아래). 가운데 (2,2)는 비운다 (레퍼는 로고 자리).
// 순서는 1440×900에서 화면 가운데에 가까운 칸부터 → 0번이 더미 맨 앞, 먼저 나타남.
// (화면 크기마다 거리를 다시 재서 정렬하면 창 크기를 바꿀 때 카드 번호가 뒤바뀌어서 순서를 고정)
export const DIAMOND_CELLS = [
  [3, 2], [1, 1], [1, 3], [2, 0], [2, 4], [3, 0], [0, 2], [4, 1], [4, 3],
];

// 레퍼 grid.fit · cardSizeMultiplier · gapMultiplier 값. 바깥 카드 가장자리까지 화면 폭 98%·높이 82%에 펼친다
export const GRID_FIT = {
  width: 0.98,
  height: 0.82,
  cardWidth: 0.135,                                                     // 카드 폭 = 화면 폭 13.5% × 크기 배율
  size: { referencePx: 1000, strength: -0.2, min: -3, max: 3 },
  gapX: { referencePx: 1024, strength: -0.1, min: -100, max: 100 },
  gapY: { referencePx: 640, strength: -0.5, min: -1, max: 0.5 },
  narrowPx: 768,          // 레퍼는 이 폭 이하에서 그리드 대신 목록 → 카드 크기는 우리가 정함
  narrowCardWidth: 0.17,  // 마름모 5칸이 가로로 들어가는 크기 (20%면 같은 줄 옆 칸(2,0)·(3,0)이 겹친다)
  narrowZoom: 1.5,        // 폰에선 그 마름모를 통째로 키운다 (카드·간격 같이 → 안 겹침, 바깥 열은 화면 밖으로).
                          // 사용자 "폰에서도 카드 크게, 좀 잘려도 돼"
};

// 흐트러짐 (사용자 "정확히 마름모라 너무 반듯해, 흐트러뜨리고 정면 기준으로 약간 회전도" → "좀 더 자유분방해도 돼"):
//   자리·기울기: 칸마다 손으로 정한 방향(같은 열 이웃은 서로 반대쪽 — 맨 바깥 열만 화면 안쪽으로 둘 다, 크기를 다르게 —
//                카드 폭 ±45%·높이 ±40%까지, 기울기 ±8°).
//                겹치는 쌍이 생기면 그 두 장만 원래 칸 쪽으로 10%씩 되돌려서 안 겹칠 때까지 → 여유 있는 카드는 크게 움직인다.
//                (처음엔 레퍼 grid.jitter처럼 틈의 45% 안으로 묶었더니 PC에서 ±45px뿐이라 반듯해 보였다)
//   비틀기: 좌우 ±12° · 위아래 ±8° (카드 번호 난수). 빛을 받는 순간도 카드마다 달라진다
//   offsets 순서는 DIAMOND_CELLS와 같다: [가로(카드 폭 단위), 세로(카드 높이 단위, 위가 +), 기울기(도)]
export const SCATTER = {
  offsets: [
    [-0.35, 0.2, -5],  // (3,2)
    [-0.45, 0.3, 7],   // (1,1)
    [0.4, -0.25, -4],  // (1,3)
    [-0.3, -0.15, 6],  // (2,0)
    [0.35, 0.25, -7],  // (2,4)
    [0.45, 0.3, -8],   // (3,0)
    [0.25, -0.4, 8],   // (0,2)
    [-0.4, -0.3, 5],   // (4,1)
    [-0.1, 0.35, -6],  // (4,3) 맨 바깥 열은 화면 안쪽으로만 (같은 열 (4,1)은 더 많이)
  ],
  tilt: 8,
  turnY: 12,
  turnX: 8,
  pullBack: 0.9,     // 겹치면 이만큼씩 칸 쪽으로 되돌린다
  rounds: 80,
  minGap: 6,         // 카드 사이 최소 틈 (px), 카드 폭의 4%가 더 크면 그만큼
};

// 카드 번호 → 0~1 난수 (늘 같은 값). 레퍼 그리드 흐트러짐과 같은 사인 해시
export function cardHash(n) {
  const v = Math.sin(n * 12.9898) * 43758.5453;
  return v - Math.floor(v);
}

// 화면 크기에 따라 1에서 조금씩 바뀌는 배율 (레퍼 식): 1 + (크기 ÷ 기준 − 1) × 세기, 범위 안으로
const sizeMultiplier = (sizePx, { referencePx, strength, min, max }) => clamp(1 + (sizePx / referencePx - 1) * strength, min, max);

// 카드 크기와 칸 간격 (px). 간격은 크기 배율 1 기준 카드로 정하고, cardScale은 카드만 키운다
export function gridMetrics(widthPx, heightPx, cardScale = 1) {
  const fit = GRID_FIT;
  const baseW = widthPx <= fit.narrowPx
    ? widthPx * fit.narrowCardWidth
    : widthPx * fit.cardWidth * sizeMultiplier(widthPx, fit.size);
  const baseH = baseW * CARD_RATIO;
  // 한 칸 = 카드 + 틈. 틈 = (차지할 넓이 − 카드)/4 − 카드 → 바깥 카드 가장자리까지 넓이 안에 (음수면 이웃 줄과 엇갈려 겹침)
  const colStep = baseW + ((fit.width * widthPx - baseW) / 4 - baseW) * sizeMultiplier(widthPx, fit.gapX);
  const rowStep = baseH + ((fit.height * heightPx - baseH) / 4 - baseH) * sizeMultiplier(heightPx, fit.gapY);
  const zoom = widthPx <= fit.narrowPx ? fit.narrowZoom : 1;
  return { cardW: baseW * zoom * cardScale, cardH: baseH * zoom * cardScale, colStep: colStep * zoom, rowStep: rowStep * zoom };
}

// 기울어진 카드 두 장 사이 틈 (px, 음수면 겹침): 네 변에 수직인 방향으로 그림자를 비춰 가장 크게 벌어진 값 (분리축)
function tiltedCorners(card, w, h) {
  const c = Math.cos(card.tilt);
  const n = Math.sin(card.tilt);
  return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]
    .map(([x, y]) => [card.x + x * c - y * n, card.y + x * n + y * c]);
}
export function tiltedGap(a, b, w, h) {
  const pa = tiltedCorners(a, w, h);
  const pb = tiltedCorners(b, w, h);
  let best = -Infinity;
  for (const shape of [pa, pb]) {
    for (let i = 0; i < 4; i++) {
      const [x1, y1] = shape[i];
      const [x2, y2] = shape[(i + 1) % 4];
      const ax = -(y2 - y1);
      const ay = x2 - x1;
      const length = Math.hypot(ax, ay);
      const project = (points) => points.map(([x, y]) => (x * ax + y * ay) / length);
      const qa = project(pa);
      const qb = project(pb);
      best = Math.max(best, Math.min(...qb) - Math.max(...qa), Math.min(...qa) - Math.max(...qb));
    }
  }
  return best;
}

// 다이아몬드 배치: 칸 → 화면 가운데 기준 px (위가 +). count장만 가운데 가까운 칸부터.
// scatter: 흐트러짐 배율 (0 = 정확한 마름모·정면, 1 = 기본). tilt·turnX·turnY는 라디안
export function diamondLayout(widthPx, heightPx, count = DIAMOND_CELLS.length, cardScale = 1, scatter = 1) {
  const metrics = gridMetrics(widthPx, heightPx, cardScale);
  const { cardW, cardH, colStep, rowStep } = metrics;
  const n = clamp(Math.round(count), 1, DIAMOND_CELLS.length);
  const toRad = (deg) => (deg * Math.PI) / 180;
  const slots = DIAMOND_CELLS.slice(0, n).map(([cx, cy], i) => {
    const [ox, oy, tilt] = SCATTER.offsets[i];
    return {
      cell: [cx, cy],
      baseX: (cx - 2) * colStep,
      baseY: (2 - cy) * rowStep,
      offsetX: ox * cardW * scatter,
      offsetY: oy * cardH * scatter,
      tilt: toRad(tilt) * scatter,
      keep: 1, // 흐트러짐을 얼마나 남길지 (겹치면 줄어든다)
    };
  });
  const place = (slot) => ({
    x: slot.baseX + slot.offsetX * slot.keep,
    y: slot.baseY + slot.offsetY * slot.keep,
    tilt: slot.tilt * slot.keep,
  });
  // 겹치는 쌍은 둘 다 칸 쪽으로 조금씩 되돌린다 (다 되돌리면 정확한 마름모라 반드시 풀린다)
  const minGap = Math.max(SCATTER.minGap, cardW * 0.04);
  for (let round = 0; round < SCATTER.rounds; round++) {
    let overlapped = false;
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        if (tiltedGap(place(slots[i]), place(slots[j]), cardW, cardH) < minGap) {
          slots[i].keep *= SCATTER.pullBack;
          slots[j].keep *= SCATTER.pullBack;
          overlapped = true;
        }
      }
    }
    if (!overlapped) break;
  }
  const cards = slots.map((slot, i) => ({
    cell: slot.cell,
    ...place(slot),
    turnX: (cardHash(i * 19 + 47.9) * 2 - 1) * toRad(SCATTER.turnX) * scatter,
    turnY: (cardHash(i * 23 + 59.3) * 2 - 1) * toRad(SCATTER.turnY) * scatter,
  }));
  return { ...metrics, cards };
}

// 등장 (레퍼 intro): 묶음 전체가 화면 가운데 기준 0.5배에서 3.6초 동안 1배로 (easeInOutQuart),
// 카드는 0.3초 뒤부터 0.15초 간격으로 바로 나타난다 (나타나는 데 걸리는 시간 0)
export const INTRO = { scaleFrom: 0.5, duration: 3.6, appearDelay: 0.3, appearStagger: 0.15 };

export function easeInOutQuart(t) {
  const x = clamp(t, 0, 1);
  return x < 0.5 ? 8 * x ** 4 : 1 - (-2 * x + 2) ** 4 / 2;
}

export function introScale(time) {
  return INTRO.scaleFrom + (1 - INTRO.scaleFrom) * easeInOutQuart(time / INTRO.duration);
}

export function appearTime(rank) {
  return INTRO.appearDelay + INTRO.appearStagger * rank;
}

// 마우스 밀림 (레퍼 grid.cardParallax): 카드가 커서 반대쪽으로 밀린다(최대 −180px × 세기 2).
// 가운데에서 먼 카드일수록 많이(√거리, 최소 10%), 커서가 가운데에서 멀수록 많이. 커서는 한 프레임에 8%씩 따라간다
export const PARALLAX = {
  maxOffsetPx: -180,
  strength: 2,
  minimumInfluence: 0.1,
  centerInfluencePower: 0.5,
  followLerp: 0.08,
  returnLerp: 0.08,
};

// 커서 위치(화면 가운데 기준 px)를 천천히 따라간다. 60fps 한 프레임 기준 비율을 dt에 맞춰 바꾼다
export function followPointer(current, target, following, dt) {
  const rate = following ? PARALLAX.followLerp : PARALLAX.returnLerp;
  const t = 1 - Math.pow(1 - clamp(rate, 0, 1), dt * 60);
  return { x: current.x + (target.x - current.x) * t, y: current.y + (target.y - current.y) * t };
}

// card: 카드 자리, pointer: 따라간 커서 (둘 다 화면 가운데 기준 px, 위가 +) → 카드가 밀릴 px
export function parallaxOffset(card, pointer, view, strength = PARALLAX.strength) {
  const reach = Math.hypot(pointer.x, pointer.y);
  const halfDiagonal = Math.hypot(view.width, view.height) / 2;
  if (reach === 0 || halfDiagonal === 0) return { x: 0, y: 0 };
  const pointerAmount = Math.min(1, reach / halfDiagonal);
  const cardDistance = Math.min(1, Math.hypot(card.x, card.y) / halfDiagonal);
  const influence = PARALLAX.minimumInfluence
    + (1 - PARALLAX.minimumInfluence) * Math.pow(cardDistance, PARALLAX.centerInfluencePower);
  const amount = PARALLAX.maxOffsetPx * strength * influence * pointerAmount;
  return { x: (pointer.x / reach) * amount, y: (pointer.y / reach) * amount };
}

// 움직임 세기 (레퍼 speed 신호): 스크롤 빠르기(화면/초)를 0~1로. 1.5화면/초를 1로 본다(우리가 정한 기준).
// 데드존 45% 아래는 0, 세제곱으로 올라가고, 올라갈 땐 초당 8 · 내려갈 땐 6 · 멈추면 16 빠르기로 따라간다
export const SPEED_SIGNAL = {
  fullSpeed: 1.5,
  deadZone: 0.45,
  buildExponent: 3,
  attackRate: 8,
  releaseRate: 6,
  settleRate: 16,
  restSpeed: 0.001,
};

export function speedEnergy(current, screensPerSecond, dt) {
  const s = SPEED_SIGNAL;
  const ratio = clamp(Math.abs(screensPerSecond) / s.fullSpeed, 0, 1);
  const target = Math.pow(clamp((ratio - s.deadZone) / (1 - s.deadZone), 0, 1), s.buildExponent);
  let rate = s.releaseRate;
  if (target > current) rate = s.attackRate;
  else if (Math.abs(screensPerSecond) < s.restSpeed) rate = s.settleRate;
  const next = current + (target - current) * (1 - Math.exp(-rate * dt));
  return next < 5e-4 ? 0 : next;
}

// 카드 면 일렁임 (레퍼 cardMotion.idle): 두 물결이 엇갈려 지나가며 카드 면이 깊이 방향으로 아주 살짝.
// 깊이 0.2662는 레퍼 카드 폭 4.67 기준 → 우리 카드 폭 1.6에 맞춰 줄인다. 시계는 초당 0.16, 가만히 있을 땐 12%
export const RIPPLE = { depth: (0.2662 * 1.6) / 4.67, spatialScale: 0.86, speed: 0.16, restWeight: 0.12 };

export function rippleClock(clock, dt) {
  return (clock + dt * RIPPLE.speed) % TAU;
}

export function rippleWeight(energy) {
  return RIPPLE.restWeight + (1 - RIPPLE.restWeight) * clamp(energy, 0, 1);
}

// 셰이더(glint-material.js)와 같은 식. u·v: 카드 위 위치 0~1, seed: 카드마다 다른 시작 위상
export function rippleHeight(u, v, time, seed, depth, weight) {
  const px = u - 0.5;
  const py = v - 0.5;
  const waveA = Math.sin((px * 3.1 + py * 1.7) * RIPPLE.spatialScale + time + seed);
  const waveB = Math.sin((px * -1.35 + py * 3.75) * RIPPLE.spatialScale - time * 2 + seed * 1.61803398875);
  const field = waveA * 0.68 + waveB * 0.32;
  const edge = (t) => smoothstep(0, 0.16, t);
  const interior = edge(u) * edge(1 - u) * edge(v) * edge(1 - v);
  const steady = 0.32 + (1 - 0.32) * interior; // 테두리 16% 안쪽은 0.32배까지 덜 움직인다
  return field * steady * (1 - 0.3 * (px * px + py * py)) * depth * weight;
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

// 별먼지 3겹 (깊이감): 먼 별 · 카드 사이 먼지 · 카메라 바로 앞 먼지.
//   zNear·zFar: 카메라에서의 거리 범위, halfX·halfY: 퍼지는 반폭 (그 거리에서 화면 밖까지 덮게, 화면비 2.4 기준),
//   sizeMin·sizeMax: 화면 픽셀 크기, drift: 초당 떠다니는 양 (상자를 넘으면 반대편에서 다시 나온다), opacity: 밝기
//   가까운 먼지일수록 크고 흐릿하고 빨리 지나가서 깊이감이 난다. 화면 가장자리에선 렌즈를 따라 같이 휜다
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
