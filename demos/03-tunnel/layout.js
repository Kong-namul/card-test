// ─────────────────────────────────────────────────────────────
// layout.js — 03 터널(튜브): 원통 위 카드 위치 + 쫀득한 움직임 계산 (Three.js 없이 숫자만)
// 참고: Codrops "Reactive Depth" (Matis Dené) — 코드 복사 없이 기법·비율만
// ─────────────────────────────────────────────────────────────
import { smoothstep, wrapCentered } from '../../shared/motion.js?v=3';

// wrapCentered: 값을 [-주기/2, 주기/2) 안으로 접는다 (04에서도 쓰려고 공통 motion.js로 옮김).
// 카드 높이를 이걸로 접으면, 위로 넘어간 줄이 아래에서 다시 나타나서 끝없는 튜브가 된다.
export { wrapCentered };

// row줄 col칸 카드의 원통 위 위치.
//   각도 = 칸 비율 × 한 바퀴 + 튜브가 돈 각도(angle). 홀수 줄은 반 칸 엇갈려서 벽돌처럼 쌓인다
//   높이 = 줄 × 간격 − 스크롤, 그리고 (줄 수 × 간격) 범위로 접어서 무한 루프
//   카드는 원통 바깥(카메라 쪽)을 보도록 rotY = 각도
export function tubeSlot(row, col, { rows, cols, radius, rowGap, angle = 0, scroll = 0 }) {
  const stagger = row % 2 === 1 ? Math.PI / cols : 0;
  const a = (col / cols) * Math.PI * 2 + stagger + angle;
  return {
    x: radius * Math.sin(a),
    y: wrapCentered(row * rowGap - scroll, rows * rowGap),
    z: radius * Math.cos(a),
    rotY: a,
    facing: Math.cos(a),
  };
}

// 루프 경계(±루프 높이/2) 근처 band 구간에서 카드가 작아지며 사라지게 한다.
// 그래야 맨 위 줄이 맨 아래로 순간이동할 때 안 보인다
export function edgeFade(y, loopHeight, band) {
  const half = loopHeight / 2;
  return 1 - smoothstep(half - band, half, Math.abs(y));
}

// 매 프레임 움직임 계산 (Codrops식 감쇠를 프레임레이트와 무관하게):
//   스크롤 현재값이 목표를 follow(60fps 한 프레임당 12%)씩 따라간다 → 쫀득함
//   회전 속도는 spinDecay(한 프레임당 0.92배)로 줄어든다 → 휠을 세게 굴리면 휙 돌다 서서히 멈춤
//   속도 배율은 speedTarget(호버 시 슬로모션)으로 speedLerp씩 다가간다 → 시간이 서서히 느려짐
//   각도 += (기본 속도 + 회전 속도) × dt × 속도 배율
export function stepTubeMotion(state, { baseSpeed, follow, spinDecay, speedTarget, speedLerp }, dt) {
  const frames = dt * 60;
  state.scrollCurrent += (state.scrollTarget - state.scrollCurrent) * (1 - Math.pow(1 - follow, frames));
  state.spinVelocity *= Math.pow(spinDecay, frames);
  state.speedScale += (speedTarget - state.speedScale) * (1 - Math.pow(1 - speedLerp, frames));
  state.angle += (baseSpeed + state.spinVelocity) * dt * state.speedScale;
  return state;
}

// 줄마다 다른 회전 속도 (Codrops 튜브의 핵심 깊이감):
// 기본 baseRows줄 묶음 안에서 첫 줄 0.65배 → 마지막 줄 1.55배로 점점 빨라지고, 묶음마다 반복한다.
// 줄끼리 서로 엇갈려 돌아서 튜브가 한 덩어리가 아니라 여러 겹의 고리처럼 보인다.
export function rowSpinFactor(row, baseRows) {
  if (baseRows <= 1) return 0.65;
  return 0.65 + 0.9 * ((row % baseRows) / (baseRows - 1));
}
