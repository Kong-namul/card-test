// ─────────────────────────────────────────────────────────────
// shelf.js — 11 책 캐러셀: 카드 자리·화각·끝없이 반복·스냅·휠·등장·카메라 궤도 (Three.js 없이 숫자만)
// 레퍼: Bookish (Framer 템플릿)의 3D 책장 컴포넌트 — 기본값과 사이트가 넘긴 값을 읽어 숫자만 옮김 (코드는 안 가져옴)
// ─────────────────────────────────────────────────────────────
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const SHELF = {
  spacing: 3.4,            // 카드 간격 (사이트 값, 기본 3) — 책 폭 2.2 + 틈 1.2. 회전·깊이 기준
  gap: 1.2,                // 카드 사이 틈 (모양이 섞여도 늘 같게)
  camZ: 14,                // 카메라 거리
  camY: 0.3,               // 카메라 높이 (살짝 내려다봄)
  minFov: 22,
  maxFov: 55,
  follow: 0.4,             // 줄 따라가기: 60fps 한 프레임에 남은 거리의 40% (사이트 damping, 기본 0.085)
  cardFollow: 0.16,        // 카드 자리·크기·밝기 따라가기 (1 − 0.84)
  depthFactor: 0.09,       // 가운데에서 1만큼 떨어질 때마다 0.09 뒤로
  turnFactor: 0.045,       // 1만큼마다 0.045rad 안쪽으로 돈다
  focusScale: 0.1,         // 가운데 카드 1.1배, 나머지 0.93배
  darkness: 0.35,          // 옆 카드 밝기
  edgeFadeStart: 0.85,     // 줄 반폭의 85%부터
  edgeFadeEnd: 0.99,       //          99%에서 사라진다
  wheelThreshold: 30,      // 휠 30px 넘으면 한 장
  wheelIdleMs: 250,        // 250ms 쉬면 처음부터 다시 셈
  snapDuration: 0.5,       // 한 장 넘어가는 시간 (사이트 값, 기본 1.6)
  wheelSpeed: 0.0034,      // 스냅 없을 때(폰) 휠 1px당 줄 이동
  dragSpeed: 0.035,        // 카드 위에서 끌 때 1px당 줄 이동
  releaseSnap: 0.2,        // 끌다 놓으면 가까운 장으로 (스냅 0.5초 × 0.4)
  orbitSpeed: 0.0042,      // 빈 곳을 끌면 1px당 시점이 도는 양 (rad)
  phiMin: Math.PI * 0.24,  // 위아래로 돌 수 있는 범위
  phiMax: Math.PI * 0.78,
  parallaxTheta: 0.12,     // 커서 따라 좌우로 도는 최대 (rad)
  parallaxPhi: 0.055,      //          위아래
  orbitFollow: 0.14,       // 카메라 회전·거리 따라가기 (1 − 0.86)
  parallaxFollow: 0.05,    // 커서 시점 따라가기 (1 − 0.95)
  parallaxWeightFollow: 0.12, // 끄는 동안 커서 시점을 껐다 켜는 빠르기 (1 − 0.88)
  clickThreshold: 6,       // 6px 안 움직이면 클릭
  focusDistance: 8.4,      // 상세 볼 때 카메라 거리
  detailScale: 0.9,        // 상세 카드 크기 (사이트 값)
  detailOffset: { x: -0.8, y: 0 },           // 상세 카드 자리 (사이트 값, 오른쪽 패널 자리 비우기)
  narrowDetailOffset: { x: 1.45, y: -3.35 }, // 폰 (사이트 폰 값)
  narrowListOffsetY: 1.2,  // 폰: 카드 줄을 이만큼 위로 (사이트 mobile 변형 listOffsetY). 캔버스는 화면 꽉 그대로
};

// 카드 모양: 세로형은 레퍼 책 크기 그대로 2.2 × 3.2 (사용자 "카드 크기·모양 레퍼랑 맞추자"), 가로형은 16:9.
// 카드 사이 틈은 모양 상관없이 SHELF.gap(1.2) → 세로형만이면 간격 3.4, 가로형만이면 5.6
export const FORMATS = {
  portrait: { width: 2.2, height: 3.2 },
  landscape: { width: 4.4, height: 2.475 },
};

// 카드 하나의 모양: 세로형·가로형은 전부 그 모양, "섞어서"는 카드 내용의 shape를 따른다 (없으면 세로형)
export function shapeOf(format, card) {
  if (format !== 'mixed') return format;
  return card.shape === 'landscape' ? 'landscape' : 'portrait';
}

// 폭이 다른 카드 줄: 카드 사이 틈이 늘 gap이 되게 가운데 자리를 쌓는다.
//   centers[i]: i번 카드 가운데 (0번이 0), gaps[i]: i번 → 다음 카드 가운데까지 (마지막은 다음 바퀴 0번까지)
//   total: 한 바퀴 길이(끝없이 반복), pitch: 평균 간격 (회전·깊이 기준)
export function layoutRow(widths, gap) {
  const n = widths.length;
  const centers = new Array(n);
  const gaps = new Array(n);
  let x = 0;
  for (let i = 0; i < n; i++) {
    centers[i] = x;
    gaps[i] = widths[i] / 2 + gap + widths[(i + 1) % n] / 2;
    x += gaps[i];
  }
  return { centers, gaps, total: x, pitch: x / n };
}

// 카드 i가 가운데에서 r만큼 떨어져 있을 때, 가운데 쪽 이웃까지 거리 (밝기·크기 기준 → 바로 옆 카드는 늘 완전히 어둡게)
export function rowUnit(row, i, r) {
  const n = row.gaps.length;
  return r > 0 ? row.gaps[(i - 1 + n) % n] : row.gaps[i];
}

// 화각: 카메라 거리 14에서 보이는 높이가 max(6.8, 8 ÷ 화면비)가 되게 (좁은 화면은 넓게), 22°~55°
export function fovFor(aspect) {
  const view = Math.max(6.8, 8 / aspect);
  const degrees = (2 * Math.atan(view / (2 * SHELF.camZ)) * 180) / Math.PI;
  return clamp(degrees, SHELF.minFov, SHELF.maxFov);
}

// 60fps 한 프레임 기준 비율을 dt에 맞춰 바꾼다
export function followFactor(rate, dt) {
  return 1 - Math.pow(1 - rate, dt * 60);
}

// 끝없이 반복: 줄 전체 길이(total) 안에서 가운데 기준 −반폭~+반폭으로
export function wrapOffset(x, total) {
  return x - Math.round(x / total) * total;
}

// 가운데까지 거리 r인 카드: 뒤로 물러남·안쪽으로 회전·크기·밝기.
// 회전·깊이는 r을 간격 비율로 줄여서, 가로형(간격 5.6)도 같은 장 수만큼 떨어진 카드가 세로형과 같은 각도.
// 섞어서: spacing = 줄 평균 간격(모든 카드가 같은 곡면 위), unit = 가운데 쪽 이웃까지 거리(크기·밝기)
export function cardPose(r, spacing, unit = spacing) {
  const k = SHELF.spacing / spacing;
  const near = Math.min(Math.abs(r) / unit, 1);
  return {
    z: -Math.abs(r) * k * SHELF.depthFactor,
    rotY: -r * k * SHELF.turnFactor,
    scale: 1 + SHELF.focusScale - SHELF.focusScale * 1.7 * near,
    shade: 1 + (SHELF.darkness - 1) * Math.pow(near, 1.2),
  };
}

// 화면 끝(줄 반폭의 85%→99%)에서 부드럽게 사라진다 → 반복되며 반대편에서 나타나는 순간이 안 보인다
export function edgeFade(r, halfWidth) {
  const start = halfWidth * SHELF.edgeFadeStart;
  const end = halfWidth * SHELF.edgeFadeEnd;
  const d = Math.abs(r);
  if (d <= start) return 1;
  const t = clamp((d - start) / Math.max(1e-4, end - start), 0, 1);
  return 1 - t * t * (3 - 2 * t);
}

export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
export const easeOutCubic = (t) => 1 - (1 - t) ** 3;
export const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));

// 등장 "rise" (사이트 값): 카드 번호가 줄 가운데에서 i번째(a = |i|)인 카드가
// (x i×0.6, y −22 − a×0.5, z −3, 0.9배)에서 올라와 0.95초에 제자리, a×0.06초 늦게 출발, easeOutExpo, 밝기 최소 0.2
export const ENTRANCE = { stagger: 0.06, duration: 0.95, spreadX: 0.6, dropY: 22, dropPerStep: 0.5, z: -3, scale: 0.9, minShade: 0.2 };

export function entrancePose(index, count, time) {
  const i = index - (count - 1) / 2;
  const a = Math.abs(i);
  const t = clamp((time - a * ENTRANCE.stagger) / ENTRANCE.duration, 0, 1);
  if (t >= 1) return { x: 0, y: 0, z: 0, scale: 1, shade: 1 };
  const e = easeOutExpo(t);
  const rest = 1 - e;
  return {
    x: i * ENTRANCE.spreadX * rest,
    y: (-ENTRANCE.dropY - a * ENTRANCE.dropPerStep) * rest,
    z: ENTRANCE.z * rest,
    scale: 1 + (ENTRANCE.scale - 1) * rest,
    shade: Math.max(ENTRANCE.minShade, e),
  };
}

// 휠: 30px 넘게 굴리면 한 장 (250ms 쉬면 처음부터 다시 센다). 결과의 step: −1·0·1
export function wheelStep(state, delta, nowMs) {
  const acc = (nowMs - state.last > SHELF.wheelIdleMs ? 0 : state.acc) + delta;
  if (Math.abs(acc) >= SHELF.wheelThreshold) return { step: acc > 0 ? 1 : -1, state: { acc: 0, last: nowMs } };
  return { step: 0, state: { acc, last: nowMs } };
}

// 줄 위치(scroll) → 가운데에 가장 가까운 카드 번호 (반복 전: 바퀴 × 장수 + 번호). 카드 i는 scroll = −centers[i]일 때 가운데
export function rowIndexAt(scroll, row) {
  const n = row.centers.length;
  const x = -scroll;
  const lap = Math.floor(x / row.total);
  const local = x - lap * row.total;
  let best = 0;
  let bestDistance = Infinity;
  for (let i = 0; i <= n; i++) {
    const c = i < n ? row.centers[i] : row.total; // n = 다음 바퀴 0번
    const d = Math.abs(local - c);
    if (d < bestDistance) {
      bestDistance = d;
      best = i;
    }
  }
  return lap * n + best;
}

// 번호(반복 전) j인 카드가 가운데 오는 줄 위치
export function rowPositionOf(j, row) {
  const n = row.centers.length;
  const lap = Math.floor(j / n);
  return -(row.centers[j - lap * n] + lap * row.total);
}

// step장 옮긴 자리 (0이면 가장 가까운 장)
export function rowSnapTarget(scroll, row, step) {
  return rowPositionOf(rowIndexAt(scroll, row) + step, row);
}

// 반복을 접은 가운데 카드 번호 0 ~ 장수−1
export function rowCenterIndex(scroll, row) {
  const n = row.centers.length;
  return ((rowIndexAt(scroll, row) % n) + n) % n;
}

// 카메라: 초점 둘레 구면 위 (θ 좌우, φ 위에서 잰 각도)
export function orbitPosition(theta, phi, radius, focus) {
  const s = Math.sin(phi);
  return {
    x: focus.x + radius * s * Math.sin(theta),
    y: focus.y + radius * Math.cos(phi),
    z: focus.z + radius * s * Math.cos(theta),
  };
}

// 처음 카메라는 (0, 0.3, 거의 14) → 그 φ
export const START_PHI = Math.acos(SHELF.camY / SHELF.camZ);

// 상세 카드 자리·크기 (사용자: "가로든 세로든 잘리면 안 돼, 좌우·위아래 여백 안에 들어가게").
//   free: 카드가 들어갈 빈 칸 (캔버스 위 px 사각형 left·top·right·bottom) — 넓은 화면은 오른쪽 상세 패널 왼쪽, 폰 "가운데"는 글(닫기 버튼) 아래
//   want: 바라는 자리 (화면 가운데 기준 공간 좌표). 넓은 화면은 레퍼 값(왼쪽 0.8), 없으면 빈 칸 한가운데
//   scale: 바라는 크기 (레퍼 0.9배). 빈 칸 안 여백 marginPx 안쪽에 다 들어가게 — 크면 줄이고(최소 0.3배), 삐져나가면 안쪽으로 민다
//   돌려주는 x·y는 화면 가운데 기준 공간 좌표(초점 평면, 카메라 거리 distance), scale은 카드 크기 배율
export function fitDetail({
  free, canvasWidthPx, canvasHeightPx, fovDeg, distance, cardWidth, cardHeight, scale, want = null, marginPx = 24,
}) {
  const u = (2 * distance * Math.tan((fovDeg * Math.PI) / 360)) / canvasHeightPx; // 1px이 공간에서 얼마인지
  const left = (free.left + marginPx - canvasWidthPx / 2) * u;
  const right = (free.right - marginPx - canvasWidthPx / 2) * u;
  const top = (canvasHeightPx / 2 - free.top - marginPx) * u;
  const bottom = (canvasHeightPx / 2 - free.bottom + marginPx) * u;
  const fitted = Math.min(scale, Math.max(0, right - left) / cardWidth, Math.max(0, top - bottom) / cardHeight);
  const s = Math.max(0.3, fitted);
  const halfW = (cardWidth * s) / 2;
  const halfH = (cardHeight * s) / 2;
  // 바라는 자리에서 빈 칸 안으로 밀어 넣기 (0.3배로도 안 들어가면 빈 칸 한가운데)
  const place = (value, lo, hi) => (lo > hi ? (lo + hi) / 2 : clamp(value, lo, hi));
  const cx = (left + right) / 2;
  const cy = (top + bottom) / 2;
  return {
    x: place(want ? want.x : cx, left + halfW, right - halfW),
    y: place(want ? want.y : cy, bottom + halfH, top - halfH),
    scale: s,
  };
}
