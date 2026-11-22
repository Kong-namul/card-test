// ─────────────────────────────────────────────────────────────
// arc.js — 10 휘어진 호 캐러셀: 원본 숫자와 계산 (순수 함수)
// 숫자 출처: Mathias Adolfsson 포트폴리오(Codrops 2026-11-05) — 실제 사이트에 내려오는 코드의 설정값과
// 캐러셀 계산(computeCarouselTransform · tick · 셰이더 positionNode)을 짝지어 읽음. 코드는 가져오지 않았다.
// 단위: px (카메라를 화면 높이에 맞춰 깊이 0에서 1단위 = 1px)
// ─────────────────────────────────────────────────────────────
import { clamp, lerp, smoothstep } from '../../shared/motion.js?v=3';

export const ARC = {
  fov: 45,
  // 카드: 화면 폭 × 0.58 (최대 1280), 16:9, 간격 50. 작은 화면(768 미만)은 0.8 · 25, 세로 폰은 세로 = 폭 × 1.1
  slide: { wide: 0.58, small: 0.8, max: 1280, aspect: 0.5625, aspectTall: 1.1, gap: 50, gapSmall: 25, smallBelow: 768 },
  arcDeg: 180,   // 전체 호 각도
  oval: 1,       // 앞뒤 납작함 (1 = 원)
  // 가장자리로 갈수록: 최소 0.65배 · 0.35만큼 작아짐 · 매 프레임 15%씩 따라감 · 밝기 0.55 + 0.45×크기 · 추가 휨 0.4 · 끝 15%에서 사라짐
  edge: { minScale: 0.65, shrink: 0.35, follow: 0.15, dimBase: 0.55, curve: 0.4, fade: 0.15 },
  lerp: 0.085,          // 위치·기울기·빛이 매 프레임 목표로 따라가는 비율 (원본 MOTION_LERP)
  velocityLimit: 70,    // 속도 상한 (px/프레임)
  stretch: { per: 0.0016, max: 0.045, squash: 0.6 }, // 가로 늘림 = min(|속도| × 0.0016, 0.045), 세로는 0.6배만큼 눌림
  bulge: 0.06,          // 가운데 줄이 진행 방향으로 속도 × 0.06 불룩
  press: 0.008,         // 세로 눌림 |속도| × 0.008 (가운데 줄일수록)
  curveK: 6e-4,         // 추가 휨: z −= (x² + 0.3y²) × 휨 × 0.0006
  chroma: { per: 0.0022, max: 0.018 }, // 빨강·파랑 어긋남 (uv)
  wheel: 0.6,           // 휠 한 칸 → 목표 −= delta × 0.6
  tilt: 50,             // 마우스 화면 끝에서 카메라 ±50px
  light: { offset: 0.0808, distance: 0.5853, radius: 0.8621, intensity: 0.75 }, // 점빛: 카드 폭 기준
  hover: { pull: 25, follow: 0.17 },  // 마우스 올린 카드가 25px 부풀어 나옴, 매 프레임 17%
  intro: { duration: 1.75, scaleFrom: 0.75 }, // 평평한 줄 → 호, 1.75초 expo.out
  count: 6,     // 원본 프로젝트 6개 (Tentipi · Mikuta · Infinite Grid · Tallink Silja · Bonza · Misc) — 장수가 반지름을 정한다
  cornerRadius: 4.5,
};

export function slideMetrics(vw, vh, widthRatio = ARC.slide.wide) {
  const s = ARC.slide;
  const small = vw < s.smallBelow;
  const width = Math.min(s.max, vw * (small ? s.small : widthRatio));
  const height = width * (small && vh > vw ? s.aspectTall : s.aspect);
  return { width, height, spacing: width + (small ? s.gapSmall : s.gap) };
}

// 그림을 카드에 '꽉 채우되 안 늘리기'(CSS object-fit: cover) — 원본 uCoverScale·uCoverOffset과 같은 일.
// cardAspect·textureAspect = 폭 / 높이. 결과는 텍스처 repeat·offset (가운데를 잘라 쓴다)
export function coverUv(cardAspect, textureAspect) {
  if (cardAspect < textureAspect) {
    const repeatX = cardAspect / textureAspect;
    return { repeatX, repeatY: 1, offsetX: (1 - repeatX) / 2, offsetY: 0 };
  }
  if (cardAspect > textureAspect) {
    const repeatY = textureAspect / cardAspect;
    return { repeatX: 1, repeatY, offsetX: 0, offsetY: (1 - repeatY) / 2 };
  }
  return { repeatX: 1, repeatY: 1, offsetX: 0, offsetY: 0 };
}

export function cameraDistance(vh, fov = ARC.fov) {
  return vh / (2 * Math.tan(((fov * Math.PI) / 180) / 2));
}

export function arcGeometry(count, spacing, arcDeg = ARC.arcDeg) {
  const total = (arcDeg * Math.PI) / 180;
  const loop = count * spacing;
  const radiusX = loop / total;
  return { loop, halfArc: total / 2, radiusX, radiusZ: radiusX * ARC.oval, ovalRatio: ARC.oval };
}

// 카드 index의 목표 자리 (원본 computeCarouselTransform). open = 호가 펴진 정도 (등장 0 → 1)
export function carouselTarget(index, pos, spacing, arc, open = 1) {
  let w = (index * spacing + pos) % arc.loop;
  w = ((w % arc.loop) + arc.loop) % arc.loop;
  if (w > arc.loop / 2) w -= arc.loop;
  const angle = w / arc.radiusX;
  const p = Math.min(1, Math.abs(angle) / arc.halfArc);
  const e = ARC.edge;
  const fade = clamp(1 - Math.max(0, (p - (1 - e.fade)) / e.fade), 0, 1);
  return {
    x: lerp(w, Math.sin(angle) * arc.radiusX, open) || 0,
    z: lerp(0, (Math.cos(angle) - 1) * arc.radiusZ, open) || 0,
    rotY: lerp(0, angle * arc.ovalRatio, open) || 0,
    p,
    scale: lerp(1, Math.max(e.minScale, 1 - p * e.shrink), open),
    curve: lerp(0, p * e.curve, open),
    alpha: lerp(1, fade, open) * open,
  };
}

// 속도로 늘고 눌린 크기 + 밝기 (원본: 크기는 따라간 값, 등장 중엔 0.75배부터)
export function stretchScales(scale, velocity, open = 1) {
  const s = ARC.stretch;
  const y = Math.min(Math.abs(velocity) * s.per, s.max);
  const intro = lerp(ARC.intro.scaleFrom, 1, open);
  return {
    scaleX: scale * (1 + y) * intro,
    scaleY: scale * (1 - y * s.squash) * intro,
    dim: ARC.edge.dimBase + (1 - ARC.edge.dimBase) * scale,
  };
}

// 카드 판의 한 점 (x, y: 평평한 카드 좌표 px, u·v: 0~1) → 휜 자리 (원본 셰이더 positionNode)
export function deformPoint(x, y, u, v, { radius, ovalRatio = 1, wrap = 1, curve = 0, velocity = 0, pull = 0, pullX = 0.5, pullY = 0.5 }) {
  const a = x / radius;
  let px = lerp(x, Math.sin(a) * radius, wrap);
  let py = y;
  let pz = -(1 - Math.cos(a)) * radius * ovalRatio * wrap;
  pz -= (px * px + py * py * 0.3) * curve * ARC.curveK;
  const t = (v - 0.5) * 2;
  const middle = 1 - t * t; // 가운데 줄 1, 위·아래 끝 0
  px += velocity * ARC.bulge * middle;
  py *= 1 - Math.abs(velocity) * ARC.press * middle;
  const near = 1 - smoothstep(0, 0.9, Math.hypot(u - pullX, v - pullY));
  pz += pull * near;
  return [px, py, pz];
}

// 원본은 매 프레임 속도 += (이번 이동 − 속도) × 0.085, ±70 제한. delta = 한 프레임 이동량 (dt = 1/60이면 원본처럼 매 프레임 그대로)
export function smoothVelocity(current, delta, dt) {
  const next = current + (delta - current) * follow(ARC.lerp, dt);
  return clamp(next, -ARC.velocityLimit, ARC.velocityLimit);
}

export function chromaOffset(velocity) {
  return clamp(velocity * ARC.chroma.per, -ARC.chroma.max, ARC.chroma.max);
}

// nx·ny: 화면 기준 −1~1 (ny는 아래가 +). 카메라는 마우스 쪽, 빛은 반대로
export function tiltFromPointer(nx, ny, slideWidth, tilt = ARC.tilt) {
  const reach = slideWidth * ARC.light.offset;
  return { camX: nx * tilt, camY: -ny * tilt, lightX: -nx * reach, lightY: ny * reach };
}

export function expoOut(t) {
  return t >= 1 ? 1 : 1 - 2 ** (-10 * t);
}

// "매 프레임 rate만큼" 따라가기를 프레임 길이에 맞게 보정
export function follow(rate, dt) {
  return 1 - (1 - rate) ** (dt * 60);
}
