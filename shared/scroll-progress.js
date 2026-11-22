// ─────────────────────────────────────────────────────────────
// scroll-progress.js — 스크롤 위치를 구간 진행도(0~1)로 바꾸는 함수 (06·08 공통)
// Eduard Bodak 포트폴리오가 쓴 Locomotive Scroll v5의 계산식을 그대로 옮겼다
// (locomotive-scroll@5.0.0 배포 코드 _computeIntersection / _computeProgress에서 확인).
//   startOffset · endOffset : 화면 높이 비율. data-scroll-offset="5%, 75%" → 0.05, 0.75
//   시작 = 요소가 첫 화면 안에 있으면 0, 아니면 윗변이 화면 아래에서 startOffset만큼 올라온 순간
//   끝   = 아랫변이 화면 위에서 endOffset만큼 내려온 순간
// ─────────────────────────────────────────────────────────────
import { clamp } from './motion.js?v=3';

export function scrollWindow({ top, height, viewport }, { startOffset = 0, endOffset = 0 } = {}) {
  const start = top < viewport ? 0 : top - viewport + startOffset * viewport;
  let end = top + height - endOffset * viewport;
  if (end <= start) end = start + 1;
  return { start, end };
}

export function windowProgress(scroll, { start, end }) {
  return clamp((scroll - start) / (end - start), 0, 1);
}

// 요소의 페이지 기준 윗변(스크롤 0일 때 위치)·높이와 화면 높이를 잰다. 브라우저 전용.
export function measureSection(element) {
  const rect = element.getBoundingClientRect();
  return { top: rect.top + window.scrollY, height: rect.height, viewport: window.innerHeight };
}
