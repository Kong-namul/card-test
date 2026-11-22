// ─────────────────────────────────────────────────────────────
// motion.js — 움직임에 쓰는 순수 수학 함수 모음
// Three.js 없이 숫자만 다루기 때문에 Node 테스트로 검증할 수 있어.
// ─────────────────────────────────────────────────────────────

// 값을 min~max 사이로 잘라낸다. (예: 밝기가 1을 넘지 않게)
export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

// a에서 b까지 t(0~1)만큼 간 지점. t=0.5면 정확히 가운데.
export const lerp = (a, b, t) => a + (b - a) * t;

// 값을 [-주기/2, 주기/2) 안으로 접는다. 넘어간 카드를 반대편으로 돌려보내서
// 끝없는 루프·공간을 만들 때 쓴다 (03 터널에서 공통으로 옮겨옴)
export function wrapCentered(value, period) {
  const half = period / 2;
  return ((((value + half) % period) + period) % period) - half;
}

// "쫀득한 관성"의 핵심.
// 매 프레임 목표까지 남은 거리의 일부만 따라간다.
// rate가 클수록 빨리 따라붙고, dt(프레임 간격)를 반영해서
// 60fps든 120fps든 같은 속도로 움직인다.
export const damp = (current, target, rate, dt) =>
  lerp(current, target, 1 - Math.exp(-rate * dt));

// edge0~edge1 구간에서 0→1로 부드럽게 올라가는 S자 곡선.
// 카드가 나선 끝에서 서서히 사라지게 할 때 쓴다.
export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

// 빠르게 출발해서 천천히 멈추는 이징. (등장 연출용)
export const easeOutCubic = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

// 천천히 출발 → 빨라졌다가 → 천천히 멈추는 이징. (카드 뒤집기용)
export function easeInOutCubic(t) {
  const x = clamp(t, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

// "깊이 어둠": 진짜 그림자 대신 뒤쪽 카드를 어둡게 칠하는 트릭.
// facing = 카드가 카메라를 얼마나 정면으로 보는지 (1=정면, 0=옆, -1=완전히 뒤)
// 정면은 밝기 1, 옆은 0.5, 뒤로 갈수록 minBrightness까지 어두워진다.
export const depthDim = (facing, minBrightness) =>
  clamp(0.5 + 0.5 * facing, minBrightness, 1);

// "자석": 커서(px, py) 근처에 있는 카드를 커서 쪽으로 살짝 끌어당긴다.
// 거리가 radius보다 멀어질수록 끌림이 종 모양(가우시안)으로 빠르게 약해진다.
// strength 0.1이면 커서까지 거리의 최대 10%만큼 끌려온다.
export function magnetOffset(x, y, px, py, strength, radius) {
  const dx = px - x;
  const dy = py - y;
  const weight = strength * Math.exp(-(dx * dx + dy * dy) / (radius * radius));
  return { x: dx * weight, y: dy * weight };
}

// 스크롤·드래그 입력을 쫀득하게 따라가는 관성 장치.
// target(입력이 원하는 위치)을 current(실제 화면 위치)가 damp로 따라간다.
// velocity는 초당 이동량인데, 매 프레임 튀지 않게 평균을 내서 부드럽게 만든다.
// (잔상 세기를 속도에 맞출 때 이 값을 쓴다)
export class Inertia {
  constructor({ follow = 8, velocitySmoothing = 0.25 } = {}) {
    this.target = 0;
    this.current = 0;
    this.velocity = 0;
    this.follow = follow; // 따라붙는 속도. 클수록 덜 쫀득하고 즉각적이다
    this.velocitySmoothing = velocitySmoothing; // 0~1. 작을수록 속도가 더 부드럽게 변한다
  }

  update(dt) {
    const previous = this.current;
    this.current = damp(this.current, this.target, this.follow, dt);
    // 거의 다 따라왔으면 딱 붙여서 미세한 떨림을 없앤다
    if (Math.abs(this.target - this.current) < 1e-4) this.current = this.target;
    const instant = dt > 0 ? (this.current - previous) / dt : 0;
    this.velocity += (instant - this.velocity) * this.velocitySmoothing;
    return this.current;
  }
}

// 사용자가 운영체제에서 "동작 줄이기"를 켰는지 확인한다.
// 켜져 있으면 자동 회전과 등장 연출을 끈다. (Node 테스트 환경에선 false)
export function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// "던지는 관성": 드래그하는 동안은 손을 바로 따라가고(value += delta),
// 손을 놓으면 마지막 속도로 계속 미끄러지다 마찰(friction)로 서서히 멈춘다.
// 누른 채 가만히 있으면 속도가 빠르게 0이 돼서, 그대로 놓아도 던져지지 않는다.
export class Momentum {
  constructor({ friction = 3 } = {}) {
    this.value = 0;
    this.velocity = 0;        // 초당 이동량
    this.friction = friction; // 클수록 빨리 멈춘다
  }

  drag(delta, dt) {
    this.value += delta;
    // 순간 속도를 바로 쓰면 튀니까 직전 속도와 반반 섞는다
    if (dt > 0) this.velocity = lerp(this.velocity, delta / dt, 0.5);
  }

  update(dt, held) {
    if (held) {
      this.velocity *= Math.exp(-12 * dt); // 누른 채 멈춰 있으면 속도를 빠르게 지운다
      return this.value;
    }
    this.value += this.velocity * dt;
    this.velocity *= Math.exp(-this.friction * dt);
    if (Math.abs(this.velocity) < 1e-4) this.velocity = 0;
    return this.value;
  }
}
