// ─────────────────────────────────────────────────────────────
// layout.js — 01 나선: 카드 하나하나가 나선의 어디에 놓일지 계산
// ─────────────────────────────────────────────────────────────
import { smoothstep } from '../../shared/motion.js?v=3';

// n = 정면 카드로부터 몇 칸 떨어졌는지 (0=정면, +1=다음 카드, -1=이전 카드)
// 카드마다 angleStep(라디안)만큼 돌면서 gapY만큼 올라가면 나선이 된다.
//   x = 반지름 × sin(각도)            → 좌우 위치
//   z = 반지름 × 납작함 × cos(각도)    → 앞뒤 위치. 납작함 0.7이면 깊이를 70%로 눌러
//                                        덜 빙빙 도는 타원이 된다
//   y = n × gapY                       → 앞으로 올 카드는 위에 (Grail처럼 오른쪽으로 갈수록
//                                        올라가는 나선). 감기 위치가 커지면 카드가 아래로 흘러내린다
//   rotY = 각도                        → 카드가 항상 나선 바깥쪽을 보게 돌린다
//   rotZ = -sin(각도) × edgeTwist      → 옆으로 갈수록 카드가 살짝 기운다
//   facing = cos(각도)                 → 1=정면, -1=완전히 뒤 (깊이 어둠 계산용)
export function spiralSlot(n, p) {
  const angle = n * p.angleStep;
  const s = Math.sin(angle);
  const c = Math.cos(angle);
  return {
    x: p.radius * s + n * p.gapX,
    y: n * p.gapY,
    z: p.radius * p.squish * c,
    rotY: angle,
    rotZ: -s * p.edgeTwist,
    facing: c,
  };
}

// 화면에 올리는 카드 묶음(창)의 양 끝 2칸에서 카드가 서서히 작아지며 사라지게 한다.
// 그래야 창이 한 칸씩 밀릴 때 카드가 툭 나타나거나 사라지지 않는다.
export function endFade(n, half) {
  return 1 - smoothstep(half - 2, half, Math.abs(n));
}

// 무한 나선을 카드 count장으로 돌려쓰기 위한 창의 시작 번호.
// 현재 스크롤 위치(offset)를 반올림한 칸이 창 가운데에 오게 한다.
export function windowStart(offset, count) {
  return Math.round(offset) - Math.floor(count / 2);
}

// 세로 간격이 작아서 위아래 층 카드가 겹치면(링 모드 포함)
// 같은 자리에 카드가 겹쳐 깜빡이니까, 한 바퀴(앞뒤 반 바퀴씩)만 보이게 제한한다.
//   한 바퀴에 들어가는 카드 수 = 2π / angleStep
//   한 바퀴 동안 내려가는 높이 = gapY × 그 카드 수
export function visibleHalf(count, angleStep, gapY, cardHeight) {
  const half = Math.floor(count / 2);
  const risePerTurn = gapY * ((Math.PI * 2) / angleStep);
  if (risePerTurn >= cardHeight) return half;
  return Math.min(half, Math.PI / angleStep);
}
