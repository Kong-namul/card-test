// ─────────────────────────────────────────────────────────────
// timeline.js — 06 탈출 & 뒤집기: 원본 숫자를 GSAP 키프레임 객체로 만드는 순수 함수
// 숫자 출처: Codrops "Built to Move" (Eduard Bodak, 2025-07-29) 본문 코드와 글에 실린 영상.
// GSAP 없이도 테스트할 수 있게 숫자만 만든다. 실제로 감는 건 main.js.
// ─────────────────────────────────────────────────────────────
import { clamp } from '../../shared/motion.js?v=3';

// 카드끼리 시차 (원본 timeline.to(card, …, index * 0.012))
export const STAGGER = 0.012;

// Part 01 — 탈출: 바깥 두 장이 가운데로 모이며 부채꼴 → 가라앉으며 작아지고 뒤로 눕기
export const ESCAPE = {
  window: { startOffset: 0, endOffset: 0.25 }, // data-scroll-offset="0%, 25%"
  rotationZ: [-12, 0, 12],                       // 75% 지점 부채꼴 각도
  gather: 0.9,                                   // 75% 지점 x = −position × 카드폭 × 0.9
  yOffsets: [16, 32, 48],                        // 100% 지점 y = (구간 높이 − 카드 높이) − 이 값
  scale: 0.85,
  rotateX: -16,
  gapRatio: 1.1,                                 // 처음 한 줄 간격 = 카드폭 × 1.1 (영상 02에서 잼)
  // 배경색 막이 덮이는 구간 (글에 숫자 없음 → 영상 05번 1.15~1.35초 프레임 픽셀로 잼).
  // 부채꼴로 모이는 도중에 사라져서, 가라앉고 눕는 뒷부분은 거의 안 보인다
  veil: { start: 0.33, end: 0.53 },
};

// Part 02 — 귀환: 위에서 작게 날아와 겹쳐 쌓였다가, 한 줄로 벌어지며 뒤집힘
export const RETURN = {
  window: { startOffset: 0.05, endOffset: 0.75 }, // data-scroll-offset="5%, 75%"
  gapRatio: 1.15,                                 // 한 줄 간격 = 카드폭 × 1.15 (0% x가 이걸 지워서 처음엔 겹침)
  startY: -0.75,                                  // 0% y = 화면 높이 × −0.75 + 1px
  startScale: 0.2,
  startRotateX: 24,
  rotationZ: [12, 0, -12],                        // 0% 기울기
  landedY: '20%',                                 // 40% 내려앉은 자리 (카드 높이의 20%)
  landedScale: 0.8,
  rotationZLanded: [5, 0, -5],                    // 40% 기울기
  flip: -190,                                     // 75% 뒤집기 (180°를 10° 넘김)
  settle: -180,                                   // 82% 착
  // 막이 걷히며 나타나는 구간 (글의 "사라졌다 나타나는 효과" — 숫자 없음 → 영상 05번 2.55~3.5초 픽셀로 잼).
  // 그 전엔 배경색이라 안 보여서, 화면 아래에서 올라오는 길은 안 보이고 가운데쯤에서 스르르 나타난다
  appear: { start: 0.1, end: 0.21 },
};

// 둥실 (원본: yPercent −3 → 3, random(1.5, 2.5)초, sine.inOut, 무한 왕복, 왕복마다 시간 다시 뽑기)
export const FLOAT = { amount: 3, durationMin: 1.5, durationMax: 2.5, ease: 'sine.inOut' };

// Part 2.1 미니카드: 진행도 1/3마다 한 장씩 아래→위로 차오르고, 덜 찬 만큼 4px 아래에 있다
// (안 찬 부분 35% 흐림은 style.css의 mask-image에 있다)
export const TINY = { segments: [0, 0.33, 0.66], speed: 3, lift: 4 };

// 조절 패널 기본값 = 원본 숫자
export const TUNE_DEFAULTS = {
  float: FLOAT.amount,
  fanAngle: ESCAPE.rotationZ[2],
  gather: ESCAPE.gather,
  tilt: -ESCAPE.rotateX,
  overshoot: RETURN.settle - RETURN.flip,
  perspective: 1200, // 원본 글에 숫자 없음
  veilStart: ESCAPE.veil.start,
  veilEnd: ESCAPE.veil.end,
  appearStart: RETURN.appear.start,
  appearEnd: RETURN.appear.end,
};

// −0을 0으로 (값 비교·디버깅 때 헷갈리지 않게)
const tidy = (value) => value || 0;

// 부채꼴 각도 패널 값(기본 12°)에 비례해 모든 기울기를 키우고 줄인다
const fanScale = (tune) => tune.fanAngle / ESCAPE.rotationZ[2];

export function escapeKeyframes(index, { cardWidth, cardHeight, sectionHeight }, tune = TUNE_DEFAULTS) {
  const position = index - 1; // −1, 0, 1
  return {
    '75%': {
      x: tidy(-position * cardWidth * tune.gather),
      rotationZ: tidy(ESCAPE.rotationZ[index] * fanScale(tune)),
    },
    '100%': {
      y: sectionHeight - cardHeight - ESCAPE.yOffsets[index],
      scale: ESCAPE.scale,
      rotateX: tidy(-tune.tilt),
    },
  };
}

// currentX: 55% 지점에서 "그 순간의 x"를 돌려주는 함수 (main.js가 gsap.getProperty로 넘긴다)
export function returnKeyframes(index, { cardWidth, viewportHeight }, tune = TUNE_DEFAULTS, currentX = () => 0) {
  const position = 2 - index - 1; // 1, 0, −1 → index 0이 오른쪽 자리
  return {
    '0%': {
      y: RETURN.startY * viewportHeight + 1,
      x: tidy(-position * cardWidth * RETURN.gapRatio),
      scale: RETURN.startScale,
      rotationZ: tidy(RETURN.rotationZ[index] * fanScale(tune)),
      rotateX: RETURN.startRotateX,
    },
    '40%': {
      y: RETURN.landedY,
      scale: RETURN.landedScale,
      rotationZ: tidy(RETURN.rotationZLanded[index] * fanScale(tune)),
      rotationY: 0,
      rotateX: 0,
    },
    '55%': { rotationY: 0, y: 0, x: currentX },
    '75%': { x: 0, rotationZ: 0, rotationY: RETURN.settle - tune.overshoot, scale: 1 },
    '82%': { rotationY: RETURN.settle },
    '100%': { rotationZ: 0 },
  };
}

// 카드마다 시작 시각 (타임라인 안 위치). 원본 글 코드는 둘 다 index × 0.012인데,
// 실제 사이트 영상에선 두 장면 모두 맨 앞 라벤더가 제일 먼저 움직인다(제일 아래·제일 큼, 뒤 카드가 오른쪽 위로 삐죽).
// 탈출은 라벤더가 index 0이라 그대로, 귀환은 라벤더가 마지막(index 2)이라 순서를 뒤집는다.
export function escapeDelay(index) {
  return index * STAGGER;
}

export function returnDelay(index, count) {
  return (count - 1 - index) * STAGGER;
}

// 동작 줄이기 (원본 글: "카드를 살짝 내리고 흐려지게만")
export function reducedEscapeKeyframes() {
  return { '100%': { y: 24, opacity: 0 } };
}

export function reducedReturnKeyframes() {
  return { '0%': { opacity: 0 }, '40%': { opacity: 1 } };
}

// 카드를 덮는 배경색 막의 불투명도: 진행도가 start~end를 지나는 동안 0 → 1
// (탈출은 이 값 그대로 덮이고, 귀환은 1 − 이 값으로 걷힌다)
export function veilOpacity(progress, start, end) {
  if (end <= start) return progress >= start ? 1 : 0;
  return clamp((progress - start) / (end - start), 0, 1);
}

// 원본 CSS: min(var(--progress) - 0.33·i, 구간) × 300% 을 0~1 채움으로
export function tinyFill(progress, index) {
  const fill = clamp((progress - TINY.segments[index]) * TINY.speed, 0, 1);
  return { fill, lift: TINY.lift * (1 - fill) };
}
