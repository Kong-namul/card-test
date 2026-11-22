// ─────────────────────────────────────────────────────────────
// 03 터널 — 휘어진 종이 카드가 세로 원통(튜브)을 감싸고, 휠·터치로 위아래 끝없이 흐른다.
// 카드에 커서를 올리면 시간이 느려지고, 뒤에는 휘어진 격자가 같이 흐른다.
// 가운데에는 거대 크리스탈 나비가 날갯짓한다 (패널에서 없음 / 은 모나크 / 각진 크리스탈).
// 참고: Codrops "Reactive Depth" (Matis Dené) — 코드 복사 없이 기법·비율만
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { createStage, showWebGLFallback, readToken, readTokenRGBA } from '../../shared/stage.js?v=6';
import { createCardMaterial, syncMaterial, setCornerRadius } from '../../shared/card-material.js?v=8';
import { createCardInstances } from '../../shared/card-geometry.js?v=3';
import { lerp, clamp, easeOutCubic, easeInOutCubic, depthDim, prefersReducedMotion } from '../../shared/motion.js?v=3';
import { DEFAULT_PRESET, presetToParams } from '../../shared/texture-presets.js?v=1';
import { createPanel, addSettingsButtons } from '../../shared/panel.js?v=2';
import { addTextureFolder } from '../../shared/texture-panel.js?v=6';
import { tubeSlot, edgeFade, stepTubeMotion, rowSpinFactor } from './layout.js?v=3';
import { createCurvedGrid } from './grid.js?v=2';
import { createCrystalButterfly } from './butterfly.js?v=11';
import { BUTTERFLY_OPTIONS, CRYSTAL_GLASS, flapAngle } from './butterflies.js?v=9';

const CARD_W = 1.6;                  // 01·02와 같은 카드 (Grail 비율 1.42, R 20/345)
const CARD_H = CARD_W * (490 / 345);
const CORNER_RADIUS = CARD_W * (20 / 345);
// Codrops 실제 값: 반지름 4 원통 축에서 6.5 떨어진 카메라, 화각 50°.
// 카메라를 원통 앞면에 바짝(2.5) 붙이고 넓게 봐서, 가까운 카드는 크고 먼 카드는 작게 → 공간을 꽉 채우는 깊이감
const CAMERA_OFFSET = 2.5;           // 튜브 앞면 ~ 카메라 거리
const CAMERA_FOV = 50;
const BASE_ROWS = 5;                 // 줄마다 다른 회전 속도의 묶음 단위 (Codrops 5줄)
const GRID_GAP = 6;                  // 튜브 뒷면 ~ 격자판 거리
const MIN_BRIGHTNESS = 0.15;         // 맨 뒤 카드 밝기
const SCROLL_PER_PX = 0.006;         // 휠 1px = 위아래 0.006만큼 (트랙패드 한 번 ≈ 카드 3줄)
const SPIN_PER_PX = 0.0015;          // 휠 1px = 회전 속도 +0.0015 rad/s
const MAX_SPIN = 2;                  // 회전 속도 상한 (rad/s, Codrops 2) — 01처럼 난리 나지 않게
const TOUCH_MULTIPLIER = 1.5;        // 터치는 손가락 이동이 짧아서 1.5배
const SPEED_LERP = 0.08;             // 슬로모션 배율이 바뀌는 빠르기 (60fps 한 프레임당 8%)
const INTRO_DURATION = 1.8;
const INTRO_RADIUS_SCALE = 2;        // 등장할 때 2배 넓게 퍼져 있다가 모인다
const FLIP_DURATION = 1.1;
const CLICK_TOLERANCE_PX = 6;

function main() {
  const canvas = document.getElementById('stage-canvas');
  let stage;
  try {
    stage = createStage({ canvas, fov: CAMERA_FOV });
  } catch (error) {
    console.warn('WebGL 초기화 실패', error);
    showWebGLFallback(canvas);
    return;
  }

  // ── 기본값 ──────────────────────────────────────────────────
  const paper = readToken('--card-paper');
  const DEFAULTS = {
    ...presetToParams(DEFAULT_PRESET, paper),
    bend: 0.06,          // 원통 곡면에 맞춘 휨: 카드 크기 0.45 ÷ (2 × 반지름 4)
    corner: CORNER_RADIUS,
    rows: 15,            // 줄 수 (Codrops: 5줄 × 3세트로 위아래 화면을 꽉 채움)
    cols: 12,            // 칸 수 (Codrops 12칸)
    radius: 4,           // 원통 반지름 (Codrops 4)
    cardScale: 0.45,     // 카드 크기 배율: 가로 0.72 × 세로 1.02 (Codrops 0.72 × 1)
    rowGapRatio: 2.65,   // 줄 간격 = 카드 높이 × 이 값 → 2.7 (Codrops 2.7, 카드 사이가 숭숭)
    baseSpeed: 0.12,     // 가만히 있어도 도는 속도 (rad/s)
    follow: 0.12,        // 스크롤 따라가기 (60fps 한 프레임당, Codrops 0.12)
    spinDecay: 0.92,     // 회전 속도 감쇠 (60fps 한 프레임당 곱하는 값, Codrops 0.92)
    slowmo: 0.85,        // 슬로모션 세기: 0.85면 속도가 15%까지 느려짐
    grid: true,          // 휘어진 배경 격자
    butterfly: 'monarch',   // 가운데 나비: none / monarch(은 모나크) / faceted(각진 크리스탈)
    butterflySize: 3.2,     // 나비 날개 길이 (원통 반지름 4 안에 꽉 차게)
    flapAmount: 0.45,       // 날갯짓 세기 (라디안, 0이면 멈춤)
    flapSpeed: 2.4,         // 날갯짓 빠르기
    butterflyYaw: 0,        // 방향 조절 (도): 모델별 출발 방향(모나크 135°, 각진 45°)에 더해진다
    leanTilt: 0,            // 앞뒤 기울기 조절 (도, X축 = 끄덕): 모델 기본 자세에 더해진다
    leanRoll: 0,            // 옆 기울기 조절 (도, Z축 = 갸웃). 기본값은 갸웃 없음
    glassThickness: CRYSTAL_GLASS.thickness,   // 유리 두께 (Codrops 10): 두꺼울수록 비친 풍경이 크게 휨
    glassDispersion: CRYSTAL_GLASS.dispersion, // 무지개 번짐 (Codrops 1): 가장자리 빨강·초록·파랑 갈라짐
  };
  const params = structuredClone(DEFAULTS);
  const count = () => params.rows * params.cols;

  // ── 장면 ────────────────────────────────────────────────────
  const material = createCardMaterial({ cardWidth: CARD_W, cardHeight: CARD_H, cornerRadius: CORNER_RADIUS });
  syncMaterial(material, params);
  let cards = createCardInstances({ count: count(), width: CARD_W, height: CARD_H, bend: params.bend, material });
  stage.scene.add(cards.mesh);
  const flips = new Map(); // 카드 번호 → 뒤집기 시작 시각(초)

  const border = readTokenRGBA('--border');
  const grid = createCurvedGrid({ base: new THREE.Color(readToken('--bg-1')), color: border.color, alpha: border.alpha });
  stage.scene.add(grid.mesh);

  // 가운데 크리스탈 나비 (원통 축 위, 카드들 안쪽)
  const butterfly = createCrystalButterfly({ renderer: stage.renderer });
  stage.scene.add(butterfly.group);
  const applyGlass = () => butterfly.setGlass({ thickness: params.glassThickness, dispersion: params.glassDispersion });
  applyGlass();
  butterfly.setLean(params.leanTilt, params.leanRoll);
  butterfly.show(params.butterfly);

  function rebuildCards() {
    stage.scene.remove(cards.mesh);
    cards.dispose();
    cards = createCardInstances({ count: count(), width: CARD_W, height: CARD_H, bend: params.bend, material });
    stage.scene.add(cards.mesh);
    flips.clear();
  }

  function applyAll() {
    syncMaterial(material, params);
    setCornerRadius(material, params.corner);
    if (count() !== cards.count) rebuildCards();
    cards.setBend(params.bend);
    grid.mesh.visible = params.grid;
    butterfly.setLean(params.leanTilt, params.leanRoll);
    applyGlass();
    butterfly.show(params.butterfly);
  }

  // ── 패널 ────────────────────────────────────────────────────
  const gui = createPanel('03 터널 · 조절 패널');
  const texture = addTextureFolder(gui, { params, material, paperColor: paper });
  texture.add(params, 'bend', 0, 0.5, 0.01).name('휨').onChange((value) => cards.setBend(value));

  const tubeFolder = gui.addFolder('튜브');
  tubeFolder.add(params, 'rows', 3, 30, 1).name('줄 수').onFinishChange(rebuildCards);
  tubeFolder.add(params, 'cols', 6, 24, 1).name('칸 수').onFinishChange(rebuildCards);
  tubeFolder.add(params, 'radius', 2, 8, 0.05).name('반지름');
  tubeFolder.add(params, 'cardScale', 0.3, 1.2, 0.01).name('카드 크기');
  tubeFolder.add(params, 'rowGapRatio', 1, 4, 0.01).name('줄 간격');

  const motionFolder = gui.addFolder('움직임');
  motionFolder.add(params, 'baseSpeed', 0, 1, 0.01).name('기본 속도');
  motionFolder.add(params, 'follow', 0.02, 0.4, 0.01).name('따라가기 (쫀득함)');
  motionFolder.add(params, 'spinDecay', 0.8, 0.99, 0.001).name('회전 감쇠');
  motionFolder.add(params, 'slowmo', 0, 0.95, 0.01).name('슬로모션 세기');
  motionFolder.add(params, 'grid').name('배경 격자').onChange((value) => { grid.mesh.visible = value; });

  const butterflyFolder = gui.addFolder('가운데 나비');
  butterflyFolder.add(params, 'butterfly', BUTTERFLY_OPTIONS).name('나비').onChange((key) => butterfly.show(key));
  butterflyFolder.add(params, 'butterflySize', 0.5, 7, 0.05).name('크기');
  butterflyFolder.add(params, 'flapAmount', 0, 1.2, 0.01).name('날갯짓 세기');
  butterflyFolder.add(params, 'flapSpeed', 0, 8, 0.05).name('날갯짓 빠르기');
  butterflyFolder.add(params, 'butterflyYaw', -180, 180, 1).name('방향 조절 (도)');
  const applyLean = () => butterfly.setLean(params.leanTilt, params.leanRoll);
  butterflyFolder.add(params, 'leanTilt', -60, 60, 1).name('앞뒤 기울기 (도) · X축').onChange(applyLean);
  butterflyFolder.add(params, 'leanRoll', -60, 60, 1).name('옆 기울기 (도) · Z축').onChange(applyLean);
  butterflyFolder.add(params, 'glassThickness', 0, 30, 0.1).name('유리 두께').onChange(applyGlass);
  butterflyFolder.add(params, 'glassDispersion', 0, 3, 0.01).name('무지개 번짐').onChange(applyGlass);

  addSettingsButtons(gui, { params, defaults: DEFAULTS, onApply: applyAll });

  // ── 입력: 휠·터치 → 스크롤 목표 + 회전 속도 ─────────────────
  const reduced = prefersReducedMotion();
  const motion = { scrollCurrent: 0, scrollTarget: 0, spinVelocity: 0, angle: 0, speedScale: 1 };

  function push(deltaPx) {
    motion.scrollTarget += deltaPx * SCROLL_PER_PX;
    motion.spinVelocity = clamp(motion.spinVelocity + deltaPx * SPIN_PER_PX, -MAX_SPIN, MAX_SPIN);
  }

  // 튜브가 화면에 꽉 차 있을 때만 휠을 가져간다. 노트를 보는 중이면 페이지 스크롤에 맡긴다
  const stageInView = () => window.scrollY < 4;

  canvas.addEventListener('wheel', (event) => {
    if (!stageInView()) return;
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : 1; // 줄 단위 휠은 px로 환산
    push(event.deltaY * unit);
  }, { passive: false });

  let touchY = null;
  canvas.addEventListener('touchstart', (event) => { touchY = event.touches[0].clientY; }, { passive: true });
  canvas.addEventListener('touchmove', (event) => {
    if (touchY === null) return;
    event.preventDefault();
    const y = event.touches[0].clientY;
    push((touchY - y) * TOUCH_MULTIPLIER);
    touchY = y;
  }, { passive: false });
  canvas.addEventListener('touchend', () => { touchY = null; });

  // ── 호버(슬로모션)·클릭(뒤집기) ─────────────────────────────
  const pointer = { x: 0, y: 0, inside: false };
  const press = { active: false, startX: 0, startY: 0 };
  const raycaster = new THREE.Raycaster();

  function toNdc(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
      y: -(((event.clientY - rect.top) / rect.height) * 2 - 1),
    };
  }
  function pick(ndcX, ndcY) {
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), stage.camera);
    const hit = raycaster.intersectObject(cards.mesh, false)[0];
    return hit && hit.instanceId !== undefined ? hit.instanceId : -1;
  }

  canvas.addEventListener('pointermove', (event) => {
    const ndc = toNdc(event);
    pointer.x = ndc.x;
    pointer.y = ndc.y;
    pointer.inside = event.pointerType !== 'touch';
  });
  canvas.addEventListener('pointerleave', () => { pointer.inside = false; });
  canvas.addEventListener('pointerdown', (event) => {
    press.active = true;
    press.startX = event.clientX;
    press.startY = event.clientY;
  });
  canvas.addEventListener('pointerup', (event) => {
    const moved = Math.hypot(event.clientX - press.startX, event.clientY - press.startY);
    if (press.active && moved < CLICK_TOLERANCE_PX) {
      const ndc = toNdc(event);
      const id = pick(ndc.x, ndc.y);
      if (id >= 0 && !flips.has(id)) flips.set(id, performance.now() / 1000);
    }
    press.active = false;
  });

  // ── 매 프레임 ───────────────────────────────────────────────
  const dummy = new THREE.Object3D();
  const startTime = performance.now() / 1000;
  let lastTime = startTime;
  let butterflyTime = 0; // 나비 전용 시계: 슬로모션 배율을 곱해서 흘러간다

  function frame() {
    const now = performance.now() / 1000;
    const dt = Math.min(0.05, now - lastTime) || 1 / 60;
    lastTime = now;
    const intro = reduced ? 1 : easeOutCubic((now - startTime) / INTRO_DURATION);

    // 1) 호버 중이면 슬로모션 목표로
    const hovered = pointer.inside ? pick(pointer.x, pointer.y) : -1;
    stepTubeMotion(motion, {
      baseSpeed: reduced ? 0 : params.baseSpeed,
      follow: params.follow,
      spinDecay: params.spinDecay,
      speedTarget: hovered >= 0 ? 1 - params.slowmo : 1,
      speedLerp: SPEED_LERP,
    }, dt);

    // 2) 카메라·격자 위치 (폰처럼 세로로 긴 화면이면 조금 뒤로)
    const radius = lerp(params.radius * INTRO_RADIUS_SCALE, params.radius, intro);
    const narrowFit = Math.sqrt(Math.max(1, 1 / stage.camera.aspect));
    stage.camera.position.set(0, 0, (params.radius + CAMERA_OFFSET) * narrowFit);
    grid.mesh.position.z = -(params.radius + GRID_GAP);
    const rowGap = CARD_H * params.cardScale * params.rowGapRatio;
    const loopHeight = params.rows * rowGap;
    // 격자도 같은 움직임 신호로: 가로는 튜브 회전, 세로는 스크롤을 따라 흐른다
    grid.setOffset(motion.angle / (Math.PI * 2), motion.scrollCurrent / loopHeight);

    // 크리스탈 나비: 슬로모션이 걸리면 날갯짓도 같이 느려진다.
    // 방향은 모델별 출발 각도(비스듬히)에서 시작해서 튜브 회전을 따라 계속 돈다
    butterflyTime += dt * motion.speedScale;
    butterfly.setFlap(reduced ? 0 : flapAngle(butterflyTime, params.flapSpeed, params.flapAmount));
    butterfly.pose({
      size: params.butterflySize * intro,
      yaw: THREE.MathUtils.degToRad(params.butterflyYaw) + motion.angle * 0.35,
      bob: reduced ? 0 : Math.sin(butterflyTime * 0.8) * 0.12, // 둥실둥실
      tilt: 0.25,                                             // 살짝 내려다보게 숙임
    });

    // 3) 카드마다 원통 위 위치·밝기·뒤집기
    const scale = params.cardScale * lerp(0.4, 1, intro);
    for (let row = 0; row < params.rows; row++) {
      for (let col = 0; col < params.cols; col++) {
        const i = row * params.cols + col;
        if (i >= cards.count) continue;
        // 줄마다 0.65배~1.55배로 다르게 돌아서 여러 겹의 고리처럼 엇갈린다
        const slot = tubeSlot(row, col, {
          rows: params.rows, cols: params.cols, radius, rowGap,
          angle: motion.angle * rowSpinFactor(row, BASE_ROWS), scroll: motion.scrollCurrent,
        });
        const fade = edgeFade(slot.y, loopHeight, rowGap);
        dummy.position.set(slot.x, slot.y, slot.z);
        dummy.rotation.set(0, slot.rotY, 0);
        dummy.scale.setScalar(scale * fade);
        dummy.updateMatrix();
        cards.mesh.setMatrixAt(i, dummy.matrix);
        cards.setDim(i, depthDim(slot.facing, MIN_BRIGHTNESS) * fade);

        let flipProgress = 0;
        const flipStart = flips.get(i);
        if (flipStart !== undefined) {
          const t = (now - flipStart) / FLIP_DURATION;
          if (t >= 1) flips.delete(i);
          else flipProgress = easeInOutCubic(t);
        }
        cards.setFlip(i, flipProgress);
      }
    }
    cards.commit();

    stage.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

main();
