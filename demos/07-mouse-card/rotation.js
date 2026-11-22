// ─────────────────────────────────────────────────────────────
// rotation.js — 07 마우스로 도는 카드: 원본 숫자와 "마우스 x → 각도" 계산 (순수 함수)
// 숫자 출처: Codrops "Built to Move" (Eduard Bodak, 2025-07-29) "Card rotating on mouse movement" 본문 코드.
// ─────────────────────────────────────────────────────────────

// 등장: 옆으로 선 채(−90°) 위에서 내려와 돌면서 정면을 보고, 기본 기울기로 탄력 있게 멈춘다
export const INTRO = {
  from: { rotationZ: 0, rotationY: -90, y: -64 }, // 원본 y −4em (16px 기준)
  to: { rotationY: 0, y: 0 },                      // rotationZ는 기본 기울기(패널 값)로 간다
  duration: 1,
  ease: 'elastic.out(1,0.75)',
};

// 따라가기: 매 프레임 마우스 x로 목표 각도를 정하고 0.5초 동안 따라붙는다
export const FOLLOW = { rotationFactor: 200, baseTilt: 6, duration: 0.5, ease: 'power2.out' };

// 무대를 나가면 정면 + 기본 기울기로 탄력 있게 복귀
export const LEAVE = { duration: 1.5, ease: 'elastic.out(1,0.75)' };

// 바닥 반사 (원본 글에 숫자 없음 → 영상 07번에서 잼): 카드 높이 3% 틈, 15%만 보이고 사라진다
export const REFLECTION = { gap: 0.03, visible: 0.15 };

// 조절 패널 기본값
export const TUNE_DEFAULTS = {
  rotationFactor: FOLLOW.rotationFactor,
  baseTilt: FOLLOW.baseTilt,
  followDuration: FOLLOW.duration,
  leaveDuration: LEAVE.duration,
  perspective: 800,        // 원본 글에 숫자 없음 — 영상 등장 장면과 비교해 정함
  reflectionOpacity: 0.35, // 원본 글에 숫자 없음 — 영상과 비교해 정함
  reflectionBlur: 6,       // px, 원본 글에 숫자 없음
};

// −0을 0으로
const tidy = (value) => value || 0;

// 원본 mouseMovement 계산: 화면 가운데 기준 −1~1로 바꿔 회전 세기를 곱하고,
// 많이 돌수록(180°까지) 기울기가 +기본 → −기본으로 넘어간다
export function followRotation(pointerX, viewportWidth, tune = TUNE_DEFAULTS) {
  const centerX = viewportWidth / 2;
  const normalizedX = (pointerX - centerX) / centerX;
  const rotationY = normalizedX * tune.rotationFactor;
  const rotationProgress = Math.min(Math.abs(rotationY) / 180, 1);
  const rotationZ = tune.baseTilt - rotationProgress * tune.baseTilt * 2;
  return { rotationY: tidy(rotationY), rotationZ: tidy(rotationZ) };
}

// 원본 onMouseLeave 자세
export function restPose(tune = TUNE_DEFAULTS) {
  return { rotationX: 0, rotationY: 0, rotationZ: tune.baseTilt };
}
