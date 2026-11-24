// ─────────────────────────────────────────────────────────────
// lens.js — 05 우주 표류: 화면 가장자리 오목 렌즈 숫자 (Three.js 없이). 셰이더는 lens-pass.js, 식은 같다
//   레퍼: Fiddle.Digital Experiments Hub의 LiquidGlassShader 데스크톱 값 (원리·숫자만, 코드는 안 가져옴)
//   네 가장자리 띠에서만 그림을 옮긴다: 가장자리 쪽으로 살짝 흘리기(굴절) + 가운데 기준으로 늘리기(왜곡).
//   화면 가운데는 그대로라 카드가 반듯하고, 가장자리 카드만 늘어나며 굽는다
// ─────────────────────────────────────────────────────────────
import { clamp, smoothstep } from '../../shared/motion.js?v=3';

export const LENS = {
  glassRadius: 0.35,  // 위아래 띠 폭 (화면 높이 비율). 좌우 띠는 1.6배
  refraction: 1.3,    // 유리 테두리에서 꺾이는 정도
  dispersion: 0.004,  // 색 번짐 (빨강·파랑이 엇갈려 무지개 테두리)
  distortion: 0.32,   // 가운데 기준 늘림
  motionBoost: 0.2,   // 빠르게 움직일 때 늘림에 더하는 양
  edgeOffset: 0.09,   // 띠가 화면 밖에서부터 시작하는 여유
};
export const LENS_NARROW_PX = 1024; // 이 폭 이하는 전부 절반 (레퍼 모바일 값)

export function lensConfig(widthPx, base = LENS) {
  if (widthPx > LENS_NARROW_PX) return { ...base };
  return Object.fromEntries(Object.entries(base).map(([key, value]) => [key, value * 0.5]));
}

// 네 가장자리 띠 (왼·오·아래·위): 가장자리에서 0, 띠 안쪽 끝부터 1. 좌우는 화면비만큼 늘려 재고 1.6배 넓게
function edgeBands(u, v, aspect, radius, offset) {
  const wide = radius * 1.6;
  return [
    smoothstep(-offset, wide, u * aspect),
    smoothstep(-offset, wide, (1 - u) * aspect),
    smoothstep(-offset, radius, v),
    smoothstep(-offset, radius, 1 - v),
  ];
}

// 화면 uv(0~1, 아래가 0) → 이 픽셀이 그림을 가져올 자리. mask 0이면 그대로
export function lensSample(u, v, aspect, config, distortion = config.distortion) {
  const [left, right, bottom, top] = edgeBands(u, v, aspect, config.glassRadius, config.edgeOffset);
  const mask = 1 - left * right * bottom * top;
  if (mask < 1e-4) return { u, v, mask: 0 };
  // 가장자리에서 가운데로 향하는 방향
  let inX = (1 - left) - (1 - right);
  let inY = (1 - bottom) - (1 - top);
  const length = Math.hypot(inX, inY);
  if (length > 1e-4) {
    inX /= length;
    inY /= length;
  } else {
    inX = 0;
    inY = 0;
  }
  const flow = Math.sin(mask * Math.PI) * config.refraction * 0.015;
  const cx = u - 0.5;
  const cy = v - 0.5;
  const r2 = cx * cx + cy * cy;
  return {
    u: clamp(u + (-inX * flow - cx * r2 * distortion) * mask, 0, 1),
    v: clamp(v + (-inY * flow - cy * r2 * distortion) * mask, 0, 1),
    mask,
  };
}
