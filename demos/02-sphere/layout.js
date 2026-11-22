// ─────────────────────────────────────────────────────────────
// layout.js — 02 구: 카드를 공 표면에 배치하고 깊이 밝기를 계산 (Three.js 없이 숫자만)
// 참고: Seventeen Sphere Interaction의 배치·밝기 비율 (코드 복사 X, 기법만)
// ─────────────────────────────────────────────────────────────
import { clamp } from '../../shared/motion.js?v=3';

// 피보나치 구: 해바라기 씨앗처럼 황금비(1.618…)만큼씩 돌려가며 점을 놓으면
// 공 표면에 빈틈 없이 고르게 퍼진다.
// y를 위아래 축으로 쓰고, (i + 0.5)로 반 칸 밀어서 정확히 꼭짓점에 놓이는 카드가 없게 한다.
// (꼭짓점에 카드가 있으면 "바깥 보기" 방향 계산이 흔들린다)
export function fibonacciSphere(count, radius) {
  const golden = (1 + Math.sqrt(5)) / 2;
  const points = [];
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const polar = Math.acos(1 - 2 * t);         // 0(꼭대기) → π(바닥)
    const azimuth = (2 * Math.PI * i) / golden; // 황금비만큼씩 돌기
    points.push({
      x: radius * Math.sin(polar) * Math.cos(azimuth),
      y: radius * Math.cos(polar),
      z: radius * Math.sin(polar) * Math.sin(azimuth),
    });
  }
  return points;
}

// Seventeen식 깊이 밝기: 카메라 쪽(+z)일수록 밝고 뒤(-z)일수록 어둡다.
// 공 반지름의 1.4배 범위를 0~1로 펴서 min~max로 바꾼다 (Seventeen: 0.1 ~ 1.0)
export function depthBrightness(z, radius, min, max) {
  const range = radius * 1.4;
  return min + (max - min) * clamp((z + range) / (range * 2), 0, 1);
}
