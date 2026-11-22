// ─────────────────────────────────────────────────────────────
// stack-choreography.js — "하나로 모이기" 스크롤 연출 (Grail 홈 화면 타이밍 참고)
// 01 나선, 02 구가 같이 쓴다. 숫자만 다루는 순수 함수라 Node 테스트로 검증한다.
// 단위: 화면 높이 몇 개만큼 스크롤했나 (1 = 화면 한 높이)
// ─────────────────────────────────────────────────────────────
import { smoothstep } from './motion.js?v=3';

// 각 구간은 smoothstep으로 0→1 부드럽게 진행한다
export const SCROLL_STAGES = {
  gather: [0.18, 0.72], // 카드가 한 더미로 착 모인다
  single: [1.18, 1.7],  // 맨 앞 한 장만 남고 커지면서 평평해진다
  flip: [1.95, 2.55],   // 남은 한 장이 물결처럼 뒤집힌다
  settle: [2.15, 2.6],  // 살짝 작아지면서 위로 올라간다
};

export function scrollStages(screens) {
  const progress = (name) => smoothstep(SCROLL_STAGES[name][0], SCROLL_STAGES[name][1], screens);
  return {
    gather: progress('gather'),
    single: progress('single'),
    flip: progress('flip'),
    settle: progress('settle'),
  };
}

// 더미로 모였을 때 카드 위치. c = 더미 가운데로부터 몇 번째인지 (0 = 맨 앞 카드)
// 가로·세로로 아주 살짝씩 어긋나게(0.004, 0.0035) 쌓고, 가운데에서 멀수록 뒤로(0.012씩) 보낸다.
// 완벽히 겹치면 한 장처럼 보여서, 이 미세한 어긋남이 "카드 더미" 느낌을 만든다.
// 왼쪽(c<0) 카드는 반 칸(0.006) 더 뒤로: 좌우 같은 번째 카드가 같은 깊이에 있으면
// 겹친 부분이 깜빡이기(z-파이팅) 때문이다.
export function stackSlot(c) {
  return {
    x: c * 0.004,
    y: c * 0.0035,
    z: -Math.abs(c) * 0.012 - (c < 0 ? 0.006 : 0),
  };
}

// 앞에서부터 매긴 순위(0 = 가장 앞)를 더미 안 위치 c로 바꾼다: 0, 1, -1, 2, -2, …
// 가장 앞에 있던 카드가 더미 맨 앞(c=0)이 되고, 나머지는 좌우로 번갈아 뒤에 쌓인다.
export function stackIndexFromRank(rank) {
  if (rank === 0) return 0;
  const step = Math.ceil(rank / 2);
  return rank % 2 === 1 ? step : -step;
}

// 모이기 연출 크기·위치 (Grail 참고): 더미일 때 1.15배, 한 장 남을 때 1.35배,
// 마지막에 86%로 줄며 0.55만큼 위로
export const STACK_LOOK = {
  stackScale: 1.15,
  singleScale: 1.35,
  settleScale: 0.86,
  settleRise: 0.55,
};
