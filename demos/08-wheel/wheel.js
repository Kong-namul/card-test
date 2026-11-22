// ─────────────────────────────────────────────────────────────
// wheel.js — 08 원형 휠: 원본 숫자와 계산 (순수 함수)
// 숫자 출처: Codrops "Built to Move" (Eduard Bodak, 2025-07-29)
// "Cards in a circular position that slightly rotate on scroll" 본문 코드.
// ─────────────────────────────────────────────────────────────

export const WHEEL = {
  size: 70,         // 원 지름 70em (정사각 상자)
  cardWidth: 7.5,   // 카드 폭 7.5em
  slots: 24,        // 24칸
  angle: 15,        // 칸마다 15° (--wheel-angle)
  hidden: [8, 19],  // 8~19번은 그라데이션 뒤라 안 보여서 뺀다 → 12장
  rotate: -65,      // 스크롤 끝까지 −65°, ease linear
  // 글에 offset 숫자 없음 → Locomotive 기본값(0%, 0%): 첫 화면에 있어 0에서 시작, 구간이 화면 위로 다 올라가면 끝.
  // (처음엔 0%, 50%로 빨리 돌게 했더니 반쯤 돌 때 원이 화면 밖으로 나갔다 — 원본은 "살짝" 돈다)
  window: { startOffset: 0, endOffset: 0 },
};

// 원본 .wheel_overlay 그라데이션: 위는 투명 → 32%에서 완전히 검정
export const OVERLAY_STOPS = [
  { at: 0, alpha: 0 },
  { at: 9, alpha: 0x3d / 255 },
  { at: 16, alpha: 0x80 / 255 },
  { at: 22, alpha: 0xb8 / 255 },
  { at: 32, alpha: 1 },
];

// 무지 카드 색 (호 왼쪽부터 순서대로 반복)
export const CARD_COLORS = ['lavender', 'pink', 'yellow'];

// 조절 패널 기본값
export const TUNE_DEFAULTS = {
  rotate: WHEEL.rotate,
  wheelScale: 1, // 원 크기 (1 = 화면 폭 1%를 원본 1em으로)
  fadeEnd: OVERLAY_STOPS[OVERLAY_STOPS.length - 1].at,
};

// 0~360° → −180~180° (호 왼쪽이 음수)
const signed = (angle) => (angle > 180 ? angle - 360 : angle);

export function visibleSlots() {
  const [from, to] = WHEEL.hidden;
  const slots = [];
  for (let index = 0; index < WHEEL.slots; index++) {
    if (index >= from && index <= to) continue;
    slots.push({ index, angle: index * WHEEL.angle });
  }
  return slots
    .sort((a, b) => signed(a.angle) - signed(b.angle))
    .map((slot, order) => ({ ...slot, color: CARD_COLORS[order % CARD_COLORS.length] }));
}

// 원본 gsap.to(wheel, { rotate: −65, ease: 'linear' })을 진행도로 감은 것과 같다
export function wheelRotation(progress, tune = TUNE_DEFAULTS) {
  return progress * tune.rotate || 0;
}

// 그라데이션 끝 위치(패널)에 맞춰 단계 위치를 같은 비율로 늘이고 줄인다
export function overlayStops(fadeEnd) {
  const scale = fadeEnd / OVERLAY_STOPS[OVERLAY_STOPS.length - 1].at;
  return OVERLAY_STOPS.map(({ at, alpha }) => ({ at: at * scale, alpha }));
}

const percent = (value) => `${Math.round(value * 10) / 10}%`;

export function overlayGradient(fadeEnd) {
  const parts = overlayStops(fadeEnd).map(
    ({ at, alpha }) => `color-mix(in srgb, var(--bg-1) ${percent(alpha * 100)}, transparent) ${percent(at)}`,
  );
  return `linear-gradient(${parts.join(', ')})`;
}
