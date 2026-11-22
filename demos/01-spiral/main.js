// ─────────────────────────────────────────────────────────────
// 01 나선 — Grail식 휜 카드 나선
// 나선은 자동 흐름 + 드래그로만 감기고(관성으로 쫀득하게),
// 페이지 스크롤은 연출을 재생한다: 나선 → 한 더미로 모임 → 맨 앞 한 장만 남음 → 물결 뒤집기.
// 매 프레임 이 둘을 섞어서 카드 위치·밝기·뒤집기를 다시 계산한다.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js';
import Lenis from 'lenis';
import { createStage, showWebGLFallback, readToken } from '../../shared/stage.js?v=6';
import { createCardMaterial, syncMaterial, setCornerRadius } from '../../shared/card-material.js?v=6';
import { createCardInstances } from '../../shared/card-geometry.js?v=3';
import {
  damp, clamp, lerp, easeOutCubic, easeInOutCubic,
  depthDim, magnetOffset, Inertia, prefersReducedMotion,
} from '../../shared/motion.js?v=3';
import { DEFAULT_PRESET, presetToParams } from '../../shared/texture-presets.js?v=1';
import { createPanel, addSettingsButtons } from '../../shared/panel.js?v=2';
import { addTextureFolder } from '../../shared/texture-panel.js?v=4';
import { scrollStages, stackSlot, STACK_LOOK } from '../../shared/stack-choreography.js?v=3';
import { spiralSlot, endFade, windowStart, visibleHalf } from './layout.js?v=6';

// ── Grail 숫자를 우리 단위로 환산한 값들 ─────────────────────
// Grail 카드: 텍스처 345×490px, 평면 가로 2.4 × 카드 크기 0.65 = 실제 가로 1.56
const CARD_W = 1.6;                 // 카드 가로 (3D 공간 단위)
const CARD_H = CARD_W * (490 / 345); // 카드 세로: Grail과 같은 1.42 비율
// 모서리 둥글기(R): Grail 카드가 가로 345px에 R 20px → 가로의 약 5.8%. 같은 비율로 맞춘다
const CORNER_RADIUS = CARD_W * (20 / 345);
const CAMERA_DISTANCE = 6.5;        // 정면 카드 ~ 카메라 거리 (Grail 6.5)
const DRAG_CARDS_PER_PX = 0.012;    // 마우스로 1px 드래그하면 카드 0.012장만큼 감긴다
// 스크롤 연출 크기(더미 1.15배, 한 장 1.35배, 마지막 86% + 0.55 위로)는 공통 STACK_LOOK에서
const { stackScale: STACK_SCALE, singleScale: SINGLE_SCALE, settleScale: SETTLE_SCALE, settleRise: SETTLE_RISE } = STACK_LOOK;
const MAGNET_RADIUS = 3;            // 자석이 닿는 거리 (3D 공간 단위, Grail과 같음)
const MIN_BRIGHTNESS = 0.32;        // 완전히 뒤쪽 카드의 밝기 (Grail 32%)
const INTRO_DURATION = 2.2;        // 등장 연출 시간(초)
const INTRO_RADIUS_SCALE = 3.5;    // 등장할 때 반지름이 최종의 3.5배에서 시작해 오므라든다
const FLIP_DURATION = 1.1;         // 카드 뒤집기 시간(초)
const CLICK_TOLERANCE_PX = 6;      // 이만큼 이하로 움직였으면 드래그가 아니라 클릭

function main() {
  const canvas = document.getElementById('stage-canvas');
  let stage;
  try {
    stage = createStage({ canvas, fov: 38 });
  } catch (error) {
    console.warn('WebGL 초기화 실패', error);
    showWebGLFallback(canvas);
    return;
  }

  // ── 기본값 (패널 "기본값으로" 버튼이 되돌아가는 값) ─────────
  const paper = readToken('--card-paper');
  const DEFAULTS = {
    ...presetToParams(DEFAULT_PRESET, paper), // preset, gloss, roughness, rainbow, cardColor
    // 아래 값들은 Grail 기본값을 우리 단위로 환산한 것 (괄호 안이 Grail 원래 값)
    // Grail 홈 화면은 기본값 위에 홈 전용 설정(반지름 3, 카드 크기 0.5)을 덮어써서 그걸 따른다
    bend: 0.09,       // 휨: 가장자리가 0.043만큼 뒤로 말리게 (Grail 0.06 × 평면 크기 환산)
    corner: CORNER_RADIUS, // 모서리 둥글기(R)
    count: 18,        // 카드 수 (18)
    angleStep: 0.65,  // 감기 정도: 카드 한 장마다 도는 각도(라디안). 0.65 ≈ 37° (0.65)
    radius: 3,        // 나선 반지름 (홈 3)
    squish: 0.7,      // 납작함: 앞뒤 깊이를 70%로 눌러 타원으로 (0.7)
    gapY: 0.4,        // 세로 간격: 카드 한 장마다 올라가는 높이, 0이면 링 (0.4)
    gapX: -0.05,      // 가로 흐름: 카드 한 장마다 옆으로 밀리는 양 (-0.05)
    edgeTwist: -0.06, // 가장자리 기울기 (-0.06)
    cardScale: 0.75,  // 카드 크기 배율: 1.6 × 0.75 = 1.2 (홈: 2.4 × 0.5)
    magnet: 0.1,      // 자석 세기 (0.1)
    mouseTilt: 0.12,  // 마우스 기울기 세기(라디안) (0.12)
    autoSpeed: 0.15,  // 자동 흐름 속도, 초당 카드 장수 (0.15)
    trail: 0.6,       // 잔상 최대 세기 (0.85는 빨리 감을 때 리본처럼 너무 진해서 낮춤)
  };
  const params = structuredClone(DEFAULTS);

  // ── 장면 조립 ───────────────────────────────────────────────
  const material = createCardMaterial({ cardWidth: CARD_W, cardHeight: CARD_H, cornerRadius: CORNER_RADIUS });
  syncMaterial(material, params);

  const spiral = new THREE.Group(); // 마우스 기울기는 이 그룹 전체를 돌린다
  stage.scene.add(spiral);

  let cards = createCardInstances({ count: params.count, width: CARD_W, height: CARD_H, bend: params.bend, material });
  spiral.add(cards.mesh);
  // 마지막으로 카드 모양에 적용한 휨 값. 스크롤 연출로 휨이 변할 때만 다시 계산하려고 기억해 둔다
  // (-1 = "다음 프레임에 무조건 다시 적용")
  let appliedBend = -1;

  // 카드 수가 바뀌면 묶음을 새로 만든다 (재질은 그대로 재사용)
  function rebuildCards() {
    spiral.remove(cards.mesh);
    cards.dispose();
    cards = createCardInstances({ count: params.count, width: CARD_W, height: CARD_H, bend: params.bend, material });
    spiral.add(cards.mesh);
    appliedBend = -1;
  }

  // 패널 값을 한꺼번에 화면에 반영 (설정 붙여넣기·기본값으로 버튼용)
  function applyAll() {
    syncMaterial(material, params);
    setCornerRadius(material, params.corner);
    if (params.count !== cards.count) rebuildCards();
    appliedBend = -1; // 휨은 매 프레임 루프가 스크롤 연출까지 반영해서 다시 적용한다
  }

  // ── 조절 패널 ───────────────────────────────────────────────
  const gui = createPanel('01 나선 · 조절 패널');
  const texture = addTextureFolder(gui, { params, material, paperColor: paper });
  texture.add(params, 'bend', 0, 0.5, 0.01).name('휨'); // 실제 적용은 매 프레임 루프에서

  const shape = gui.addFolder('나선 모양');
  shape.add(params, 'angleStep', 0.2, 1.2, 0.01).name('감기 정도');
  shape.add(params, 'radius', 1.5, 7, 0.1).name('반지름');
  shape.add(params, 'squish', 0.3, 1, 0.01).name('납작함');
  shape.add(params, 'gapY', 0, 1.2, 0.01).name('세로 간격 (0=링)');
  shape.add(params, 'gapX', -0.3, 0.3, 0.01).name('가로 흐름');
  shape.add(params, 'edgeTwist', -0.3, 0.3, 0.01).name('가장자리 기울기');
  shape.add(params, 'cardScale', 0.4, 1.6, 0.01).name('카드 크기');
  shape.add(params, 'count', 8, 80, 1).name('카드 수').onFinishChange(rebuildCards);

  const motionFolder = gui.addFolder('움직임');
  motionFolder.add(params, 'autoSpeed', 0, 2, 0.01).name('자동 속도');
  motionFolder.add(params, 'magnet', 0, 0.5, 0.01).name('자석');
  motionFolder.add(params, 'mouseTilt', 0, 0.4, 0.01).name('마우스 기울기');
  motionFolder.add(params, 'trail', 0, 0.95, 0.01).name('잔상 세기');

  addSettingsButtons(gui, { params, defaults: DEFAULTS, onApply: applyAll });

  // 속도 잔상: 시작은 0(잔상 없음), 매 프레임 속도에 맞춰 바꾼다
  const afterimage = new AfterimagePass(0);
  stage.addEffect(afterimage);

  // ── 입력 상태 ───────────────────────────────────────────────
  const reduced = prefersReducedMotion();
  // 부드러운 스크롤(Lenis): 휠·트랙패드 스크롤을 미끄럽게 보간한다 (Grail도 Lenis를 쓴다).
  // 동작 줄이기가 켜져 있으면 쓰지 않고 브라우저 기본 스크롤 그대로 둔다
  const lenis = reduced ? null : new Lenis({ autoRaf: true, syncTouch: false });
  // 화면 높이 몇 개만큼 스크롤했나 → 연출 진행도 계산에 쓴다
  const scrollScreens = () => (lenis ? lenis.scroll : window.scrollY) / window.innerHeight;
  const inertia = new Inertia({ follow: 8 }); // 따라붙는 속도 (Grail 8)
  let autoOffset = 0; // 자동 흐름이 누적한 감기 양
  let dragOffset = 0; // 드래그가 누적한 감기 양
  const pointer = { x: 0, y: 0, inside: false }; // 캔버스 안 커서 위치 (-1~1)
  const press = { active: false, dragging: false, startX: 0, startY: 0, lastY: 0 };

  function toNdc(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
      y: -(((event.clientY - rect.top) / rect.height) * 2 - 1),
    };
  }

  canvas.addEventListener('pointermove', (event) => {
    const ndc = toNdc(event);
    pointer.x = ndc.x;
    pointer.y = ndc.y;
    pointer.inside = event.pointerType !== 'touch';
    if (press.dragging) {
      const dy = event.clientY - press.lastY;
      press.lastY = event.clientY;
      dragOffset += dy * DRAG_CARDS_PER_PX; // 아래로 끌면 카드도 나선을 따라 아래로 흐른다
    }
  });

  canvas.addEventListener('pointerleave', () => {
    pointer.inside = false;
    press.dragging = false;
  });

  canvas.addEventListener('pointerdown', (event) => {
    press.active = true;
    press.startX = event.clientX;
    press.startY = event.clientY;
    press.lastY = event.clientY;
    // 터치는 드래그 대신 네이티브 스크롤(= 스크롤 연출)에 맡긴다
    if (event.pointerType !== 'touch') {
      press.dragging = true;
      canvas.setPointerCapture(event.pointerId);
    }
  });

  canvas.addEventListener('pointerup', (event) => {
    const moved = Math.hypot(event.clientX - press.startX, event.clientY - press.startY);
    if (press.active && moved < CLICK_TOLERANCE_PX) handleClick(event);
    press.active = false;
    press.dragging = false;
  });

  canvas.addEventListener('pointercancel', () => {
    press.active = false;
    press.dragging = false;
  });

  // ── 클릭 → 카드 뒤집기 ──────────────────────────────────────
  // 카드 묶음은 창이 밀릴 때마다 돌려쓰니까, 뒤집기는 "나선 위 칸 번호(slot)"에 기록한다
  const raycaster = new THREE.Raycaster();
  const flips = new Map(); // slot 번호 → 뒤집기 시작 시각(초)
  let currentStart = 0;    // 이번 프레임 창의 시작 slot 번호

  function handleClick(event) {
    const ndc = toNdc(event);
    raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), stage.camera);
    const hit = raycaster.intersectObject(cards.mesh, false)[0];
    if (!hit || hit.instanceId === undefined) return;
    const slot = currentStart + hit.instanceId;
    if (!flips.has(slot)) flips.set(slot, performance.now() / 1000);
  }

  // ── 매 프레임 ───────────────────────────────────────────────
  const dummy = new THREE.Object3D();
  const startTime = performance.now() / 1000;
  let lastTime = startTime;
  let tiltX = 0;
  let tiltZ = 0;
  let stackAnchor = null; // 더미로 모이기 시작한 순간의 감기 위치 (모이는 동안 창을 고정)

  function frame() {
    const now = performance.now() / 1000;
    const dt = Math.min(0.05, now - lastTime) || 1 / 60; // 탭 전환 후 큰 점프 방지
    lastTime = now;

    // 등장 연출 진행도 0→1 (동작 줄이기가 켜져 있으면 바로 1)
    const intro = reduced ? 1 : easeOutCubic((now - startTime) / INTRO_DURATION);

    // 0) 스크롤 연출 진행도: gather(모이기) → single(한 장) → flip(뒤집기) → settle(정리), 각각 0~1
    const stages = scrollStages(scrollScreens());
    const collapse = Math.max(stages.gather, stages.single); // 나선 모양에서 벗어난 정도

    // 1) 감기: 자동 흐름 + 드래그만 합쳐서 관성으로 따라간다 (스크롤은 감기에 안 씀)
    //    등장하는 동안엔 4배 빠르게 돌다가 정상 속도로 감속, 카드가 모이기 시작하면 멈춘다
    if (!reduced) autoOffset += params.autoSpeed * lerp(4, 1, intro) * dt * (1 - stages.gather);
    inertia.target = autoOffset + dragOffset;
    const offset = inertia.update(dt);

    // 2) 등장: 큰 반지름에서 오므라든다. 카메라도 같이 당겨서 정면 카드 크기는 유지
    //    세로로 긴 폰 화면(가로/세로 < 1)에선 좌우가 잘리니까 카메라를 조금 뒤로 뺀다.
    //    √(1/비율)만 곱해서, 나선 폭이 다 보이되 카드가 너무 작아지지 않게 타협한다
    const radius = lerp(params.radius * INTRO_RADIUS_SCALE, params.radius, intro);
    const narrowFit = Math.sqrt(Math.max(1, 1 / stage.camera.aspect));
    stage.camera.position.set(0, 0, radius * params.squish + CAMERA_DISTANCE * narrowFit);

    // 3) 마우스 기울기: 커서 쪽으로 장면 전체가 살짝 기운다 (damp로 부드럽게)
    const px = pointer.inside ? pointer.x : 0;
    const py = pointer.inside ? pointer.y : 0;
    tiltX = damp(tiltX, -py * params.mouseTilt, 4, dt);
    tiltZ = damp(tiltZ, -px * params.mouseTilt, 4, dt);
    // 카드가 모일수록 기울기를 줄여서 더미·한 장 상태에선 반듯하게
    spiral.rotation.set(tiltX * intro * (1 - collapse), 0, tiltZ * intro * (1 - collapse));

    // 4) 커서의 3D 위치 (z=0 평면 기준) → 자석 계산용
    const halfHeight = Math.tan(THREE.MathUtils.degToRad(stage.camera.fov / 2)) * stage.camera.position.z;
    const cursorX = px * halfHeight * stage.camera.aspect;
    const cursorY = py * halfHeight;

    // 5) 휨: 한 장만 남을 때 평평해진다. 값이 바뀔 때만 카드 모양을 다시 계산한다 (매번 하면 무거움)
    const bendNow = params.bend * (1 - stages.single);
    if (Math.abs(bendNow - appliedBend) > 1e-4) {
      cards.setBend(bendNow);
      appliedBend = bendNow;
    }

    // 6) 카드마다 위치·밝기·뒤집기 계산
    const layout = { ...params, radius };
    const cardScale = params.cardScale * lerp(0.6, 1, intro);
    const half = visibleHalf(cards.count, params.angleStep, params.gapY, CARD_H * cardScale);
    // 모이기 시작하면 창을 그 자리에 고정한다. 안 그러면 더미 안에서 카드 순서가 뒤바뀐다
    if (stages.gather > 0.001) stackAnchor ??= Math.round(offset);
    else stackAnchor = null;
    currentStart = windowStart(stackAnchor ?? offset, cards.count);
    const stackCenter = Math.floor(cards.count / 2);

    for (let i = 0; i < cards.count; i++) {
      const slotIndex = currentStart + i;
      const n = slotIndex - offset; // 정면에서 몇 칸 떨어졌는지 (소수 가능)
      const slot = spiralSlot(n, layout);
      const c = i - stackCenter;    // 더미 안 순서 (0 = 맨 앞 카드)
      const stack = stackSlot(c);
      const fade = endFade(n, half);

      // 나선 위 위치 (+ 자석). 자석은 모일수록 약해진다
      let spiralX = slot.x;
      let spiralY = slot.y;
      if (pointer.inside && params.magnet > 0) {
        const pull = magnetOffset(spiralX, spiralY, cursorX, cursorY, params.magnet * intro * (1 - stages.gather), MAGNET_RADIUS);
        spiralX += pull.x;
        spiralY += pull.y;
      }

      // 나선 → 더미 → 한가운데, 순서로 섞는다
      const x = lerp(lerp(spiralX, stack.x, stages.gather), 0, stages.single);
      const y = lerp(lerp(spiralY, stack.y, stages.gather), 0, stages.single) + SETTLE_RISE * stages.settle;
      const z = lerp(lerp(slot.z, stack.z, stages.gather), 0, stages.single);
      // 회전도 모이면서 정면(0)으로. 멀리 있던 카드는 크게 돌면서 들어와서 휘몰아치는 느낌이 난다
      const rotY = lerp(slot.rotY, 0, stages.gather);
      const rotZ = lerp(slot.rotZ, 0, stages.gather);
      // 크기: 더미일 땐 살짝 크게, 한 장만 남을 땐 맨 앞(c=0)만 더 크게 나머지는 0으로, 마지막엔 86%로
      let scale = lerp(cardScale * fade, params.cardScale * STACK_SCALE, stages.gather);
      scale = lerp(scale, c === 0 ? params.cardScale * SINGLE_SCALE : 0, stages.single);
      scale *= lerp(1, SETTLE_SCALE, stages.settle);

      dummy.position.set(x, y, z);
      dummy.rotation.set(0, rotY, rotZ);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      cards.mesh.setMatrixAt(i, dummy.matrix);
      // 깊이 어둠도 모일수록 사라져서 더미는 다 밝게
      cards.setDim(i, lerp(depthDim(slot.facing, MIN_BRIGHTNESS) * fade, 1, stages.gather));

      // 뒤집기: 클릭으로 뒤집은 것과 스크롤 연출 뒤집기 중 큰 쪽
      let clickFlip = 0;
      const flipStart = flips.get(slotIndex);
      if (flipStart !== undefined) {
        const t = (now - flipStart) / FLIP_DURATION;
        if (t >= 1) flips.delete(slotIndex);
        else clickFlip = easeInOutCubic(t);
      }
      cards.setFlip(i, Math.max(clickFlip, stages.flip));
    }
    cards.commit();

    // 7) 속도 잔상: 빠를수록 이전 화면을 많이 남긴다 (최대 trail)
    //    속도(초당 카드 장수) × 0.25 → 초당 4장 이상 감으면 잔상이 최대
    afterimage.damp = reduced ? 0 : clamp(Math.abs(inertia.velocity) * 0.25, 0, 1) * params.trail;

    stage.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

main();
