// ─────────────────────────────────────────────────────────────
// layout.js — 04 플로팅 필드: 공간에 흩뿌린 카드 위치 + 헤엄치는 카메라 움직임 (Three.js 없이 숫자만)
// 참고: Codrops "Infinite Canvas" (Edoardo Lunardi) — 코드 복사 없이 기법·숫자만. 단위는 레퍼 ÷ 10
//       Framer "Depth Drift Gallery" (Konstantin Nikolaev) — 먼 카드 흐림·진행 방향 기울기 아이디어만
// ─────────────────────────────────────────────────────────────
import { clamp, smoothstep, wrapCentered } from '../../shared/motion.js?v=3';
import { mulberry32 } from '../../shared/random.js?v=1';

export const CHUNK = 11;            // 레퍼 칸 크기 110 ÷ 10. 이 정육면체마다 카드 density장 (레퍼 5장)
export const MAX_ASPECT = 2.4;      // 이 화면비(가로÷세로)까지는 화면 옆에서 카드가 툭 생기지 않게 상자를 넓힌다
const BEHIND = 3;                   // 카메라 뒤쪽 여유: 막 지나친 카드가 바로 반대편으로 안 넘어가게
const BASE_MARGIN = 2;              // 화면 밖 여유: 마우스 시점(0.8) + 둥실 + 여유. 여기에 카드 반 크기(최대 1 × 배율)를 더한다
const EDGE_BAND = 2;                // 상자 가장자리에서 이만큼 구간은 카드가 작아지며 사라진다
export const BLUR_PER_UNIT = 0.027; // 흐림 세기 1: 초점에서 1 멀어질 때마다 가장자리가 0.027씩 퍼진다
export const MAX_BLUR = 0.45;       // 가장자리 퍼짐 상한 (카드 높이가 1.2~2.0)
const LEAN_LIMIT = 0.5;             // 기울기 상한 (라디안, 약 29°)
const DEPTH_WEIGHT = 0.35;          // 겹침 간격을 잴 때 앞뒤 차이는 35%만 친다
const SPACING_TRIES = 40;           // 겹침 방지로 자리를 다시 뽑는 최대 횟수

// mulberry32: 같은 숫자(시드)를 넣으면 항상 같은 순서로 나오는 난수 → 열 때마다 같은 배치 (05에서도 쓰려고 공통 random.js로 옮김)
export { mulberry32 };

// 카메라 주변 상자 크기: 안개가 끝나는 거리(fogFar)까지 화면에 보이는 범위 + 여유
//   세로 반폭 = tan(화각/2) × fogFar, 가로 반폭 = 세로 반폭 × 화면비 2.4
//   여유 = 2 + 카드 배율 (카드를 키우면 큰 카드가 화면 옆에서 툭 생기지 않게 여유도 늘린다)
//   앞쪽은 안개 끝보다 1 더 (거기서 접히면 이미 안개 속이라 안 보임), 뒤쪽은 3
export function fieldBox({ fogFar, fov, cardScale = 1 }) {
  const halfView = Math.tan((fov * Math.PI) / 360) * fogFar;
  const margin = BASE_MARGIN + cardScale;
  return {
    halfX: halfView * MAX_ASPECT + margin,
    halfY: halfView + margin,
    zNear: BEHIND,
    zFar: fogFar + 1,
  };
}

// 밀도 → 카드 수: 칸(11³)마다 density장 × 상자 부피. 레퍼는 칸을 만들고 지우지만 우리는 상자 하나로 끝
export function fieldCount(density, box) {
  const volume = 2 * box.halfX * 2 * box.halfY * (box.zNear + box.zFar);
  return Math.max(1, Math.round((density / CHUNK ** 3) * volume));
}

// 카드 count장을 상자 안에 고르게 흩뿌린다 (처음 카메라 위치 기준 좌표).
//   size: 카드 높이 1.2~2.0 (레퍼 12~20), phase·speed: 카드마다 다른 둥실 박자 (0.5~0.9)
//   minDist: 겹침 방지 간격. 이미 놓인 카드와 이보다 가까우면 자리를 다시 뽑는다 (최대 40번, 끝내 안 되면 가장 먼 자리)
export function createField(count, box, seed = 4, { minDist = 0 } = {}) {
  const random = mulberry32(seed);
  const randomSpot = () => ({
    x: (random() * 2 - 1) * box.halfX,
    y: (random() * 2 - 1) * box.halfY,
    z: -box.zFar + random() * (box.zNear + box.zFar),
  });
  const cards = [];
  for (let i = 0; i < count; i++) {
    let spot = randomSpot();
    if (minDist > 0) {
      let gap = nearestGap(spot, cards, box);
      for (let tries = 1; tries < SPACING_TRIES && gap < minDist; tries++) {
        const other = randomSpot();
        const otherGap = nearestGap(other, cards, box);
        if (otherGap > gap) {
          spot = other;
          gap = otherGap;
        }
      }
    }
    cards.push({
      ...spot,
      size: 1.2 + random() * 0.8,
      phase: random() * Math.PI * 2,
      speed: 0.5 + random() * 0.4,
    });
  }
  return cards;
}

// 두 카드 사이 "겹침 거리": 끝없는 공간이라 상자 반대편 끝은 바로 옆으로 치고,
// 앞뒤 차이는 0.35배만 친다 (정면에서 보면 앞뒤로 좀 떨어져 있어도 겹쳐 보여서)
export function spacingDistance(a, b, box) {
  const dx = wrapCentered(a.x - b.x, box.halfX * 2);
  const dy = wrapCentered(a.y - b.y, box.halfY * 2);
  const dz = wrapCentered(a.z - b.z, box.zNear + box.zFar) * DEPTH_WEIGHT;
  return Math.hypot(dx, dy, dz);
}

// 이미 놓인 카드들 중 가장 가까운 카드까지의 겹침 거리
function nearestGap(spot, cards, box) {
  let gap = Infinity;
  for (const card of cards) gap = Math.min(gap, spacingDistance(spot, card, box));
  return gap;
}

// 카드의 지금 위치: 카메라(cam)가 어디로 가든 카드는 카메라 주변 상자 안으로 접힌다 → 끝없는 공간.
// 우리 카드는 무늬가 없어서 같은 카드가 반대편에서 다시 나와도 티가 안 난다.
//   fade: 상자 옆 가장자리 2만큼 구간에서 1→0 (카드 크기에 곱해서 작아지며 사라지게)
export function fieldSlot(card, cam, box) {
  const depth = box.zNear + box.zFar;
  const zCenter = (box.zNear - box.zFar) / 2;
  const rx = wrapCentered(card.x - cam.x, box.halfX * 2);
  const ry = wrapCentered(card.y - cam.y, box.halfY * 2);
  const rz = wrapCentered(card.z - cam.z - zCenter, depth) + zCenter;
  const fade = (1 - smoothstep(box.halfX - EDGE_BAND, box.halfX, Math.abs(rx)))
    * (1 - smoothstep(box.halfY - EDGE_BAND, box.halfY, Math.abs(ry)));
  return { x: cam.x + rx, y: cam.y + ry, z: cam.z + rz, fade };
}

// 카메라 움직임 상태: 위치(base) · 실제 속도 · 목표 속도 · 휠 누적분 · 마우스 시점(drift)
export function createFloatState() {
  return {
    base: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    target: { x: 0, y: 0, z: 0 },
    wheel: 0,
    drift: { x: 0, y: 0 },
  };
}

// 드래그: 손을 따라 카드가 움직이도록 카메라 목표 속도는 반대로 (화면 y는 아래가 +라서 y는 그대로 더함)
export function pushDrag(state, dxPx, dyPx, perPx) {
  state.target.x -= dxPx * perPx;
  state.target.y += dyPx * perPx;
}

// 휠: 아래로 굴리면 앞으로(화면 안쪽, −z) 파고든다. 레퍼는 반대(뒤로)였는데 "파고들기"가 더 자연스러워서 뒤집음
export function pushWheel(state, deltaPx, perPx) {
  state.wheel -= deltaPx * perPx;
}

// 매 프레임 카메라 움직임 — Codrops 숫자는 60fps 한 프레임 기준이라 프레임 시간으로 보정한다.
//   opts: follow(0.16) · decay(0.9) · maxSpeed(0.32) · wheelKeep(0.8) · driftFollow(0.12) · driftTarget · dragging
export function stepFloat(state, opts, dt) {
  const frames = dt * 60;
  // 1) 휠 누적분을 목표 속도(z)로 흘려보낸다: 60fps면 한 프레임에 전부 더하고 남은 양은 0.8배
  const keep = Math.pow(opts.wheelKeep, frames);
  state.target.z += state.wheel * ((1 - keep) / (1 - opts.wheelKeep));
  state.wheel *= keep;
  // 2) 실제 속도가 목표 속도를 따라가고(쫀득함) → 위치 이동 → 목표 속도는 줄어든다(손 떼면 미끄러지다 멈춤)
  const follow = 1 - Math.pow(1 - opts.follow, frames);
  const decay = Math.pow(opts.decay, frames);
  for (const axis of ['x', 'y', 'z']) {
    state.target[axis] = clamp(state.target[axis], -opts.maxSpeed, opts.maxSpeed);
    state.velocity[axis] += (state.target[axis] - state.velocity[axis]) * follow;
    state.base[axis] += state.velocity[axis] * frames;
    state.target[axis] *= decay;
  }
  // 3) 마우스 시점: 드래그 중엔 그 자리에 멈추고, 아니면 커서 쪽으로 스르르
  if (!opts.dragging) {
    const driftFollow = 1 - Math.pow(1 - opts.driftFollow, frames);
    state.drift.x += (opts.driftTarget.x - state.drift.x) * driftFollow;
    state.drift.y += (opts.driftTarget.y - state.drift.y) * driftFollow;
  }
  return state;
}

// 진행 방향으로 카드 기울이기 (Depth Drift 아이디어): 카드가 화면에서 흘러가는 쪽 가장자리가 살짝 뒤로 눕는다.
//   카메라가 +x로 가면 카드는 화면에서 ← 로 흐른다 → 왼쪽 가장자리가 뒤로 (rotY 음수)
//   strength 1이면 최고 속도(0.32)에서 0.32rad ≈ 18°
export function leanAngles(velocity, strength) {
  return {
    rotX: clamp(velocity.y * strength, -LEAN_LIMIT, LEAN_LIMIT),
    rotY: clamp(-velocity.x * strength, -LEAN_LIMIT, LEAN_LIMIT),
  };
}

// 둥실둥실: 카드마다 다른 박자로 위아래 + 살짝 갸웃 (갸웃은 세기의 1/4 라디안)
export function bob(card, time, amount) {
  const t = time * card.speed + card.phase;
  return { y: Math.sin(t) * amount, roll: Math.sin(t * 0.7 + 1.3) * amount * 0.25 };
}

// 카드별 초점 흐림 반경 (공간 단위).
// 렌즈에서 흐림 원 크기를 "그 거리에서의 공간 크기"로 바꾸면 거리가 약분돼서 |거리 − 초점|에 비례한다.
export function blurRadius(distance, focus, strength) {
  return Math.min(MAX_BLUR, Math.abs(distance - focus) * BLUR_PER_UNIT * strength);
}

// 커서 근처 카드만 휘게: 화면 좌표(−1~1)에서 카드와 커서 사이 거리 → 1(바로 위) ~ 0(반경 밖).
//   화면 좌표는 가로·세로 모두 −1~1이라 가로 차이에 화면비를 곱해 실제 거리로 맞춘다.
//   cardRadius: 카드의 화면상 반 크기. 큰 카드는 중심이 아니라 가장자리부터 잰다
export function cursorInfluence(card, cursor, aspect, radius, cardRadius = 0) {
  const distance = Math.hypot((card.x - cursor.x) * aspect, card.y - cursor.y);
  return 1 - smoothstep(0, radius, Math.max(0, distance - cardRadius));
}

// 종이 탄성: 목표로 끌려가다 살짝 지나쳤다 돌아와서 멈추는 용수철 (휘었다가 탁 펴지는 느낌)
//   stiffness 120 · damping 14 → 약 7% 지나쳤다 돌아온다
export const SPRING = { stiffness: 120, damping: 14 };
export function stepSpring(state, target, dt, { stiffness, damping } = SPRING) {
  state.velocity += ((target - state.value) * stiffness - state.velocity * damping) * dt;
  state.value += state.velocity * dt;
  return state;
}

// 커서 쪽으로 고개 돌리기: 카드 깊이에서 커서가 가리키는 점이 카드 중심에서 (offsetX, offsetY)만큼 떨어져 있을 때,
// 카드 앞 lookahead 거리에서 그 점을 바라보듯 돌린다. 커서가 정중앙이면 정면, 옆으로 갈수록 그쪽을 본다.
//   오른쪽(+x)을 보려면 Y축 +회전, 위(+y)를 보려면 X축 −회전. maxAngle로 상한 (살짝만)
export function hoverTurn(offsetX, offsetY, lookahead, maxAngle) {
  return {
    rotX: clamp(-Math.atan2(offsetY, lookahead), -maxAngle, maxAngle),
    rotY: clamp(Math.atan2(offsetX, lookahead), -maxAngle, maxAngle),
  };
}
