// ─────────────────────────────────────────────────────────────
// 04 플로팅 필드 — 휘어진 종이 카드가 어두운 공간 앞뒤로 흩어져 둥실 떠 있고,
// 드래그·휠로 그 사이를 헤엄치듯 끝없이 돌아다닌다. 먼 카드는 안개와 초점 흐림으로 사라진다.
// 참고: Codrops "Infinite Canvas"(Edoardo Lunardi) 뼈대 + Framer "Depth Drift Gallery" 아이디어
//       — 코드 복사 없이 기법·숫자만 (단위는 레퍼 ÷ 10)
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { createStage, showWebGLFallback, readToken } from '../../shared/stage.js?v=6';
import { createCardMaterial, syncMaterial, setCornerRadius } from '../../shared/card-material.js?v=8';
import { createCardInstances } from '../../shared/card-geometry.js?v=3';
import { easeOutCubic, easeInOutCubic, prefersReducedMotion } from '../../shared/motion.js?v=3';
import { DEFAULT_PRESET, presetToParams } from '../../shared/texture-presets.js?v=1';
import { createPanel, addSettingsButtons } from '../../shared/panel.js?v=2';
import { addTextureFolder } from '../../shared/texture-panel.js?v=6';
import {
  fieldBox, fieldCount, createField, fieldSlot, createFloatState, stepFloat,
  pushDrag, pushWheel, leanAngles, bob, blurRadius, cursorInfluence, stepSpring, hoverTurn,
} from './layout.js?v=4';

const CARD_W = 1.6;                    // 01~03과 같은 카드 (Grail 비율 1.42, R 20/345)
const CARD_H = CARD_W * (490 / 345);
// 모서리 둥글기: 01~03은 Grail 비율(가로 345px에 R 20px)인데, 04는 카드가 화면에서 작게 보여서
// 같은 비율이면 몇 픽셀밖에 안 돼 뾰족해 보인다는 피드백 → 2배 (R 40/345)
const CORNER_RADIUS = CARD_W * (40 / 345);
const CAMERA_FOV = 60;                 // Codrops 60°
const HALF_FOV_TAN = Math.tan((CAMERA_FOV * Math.PI) / 360); // 거리 1에서 화면 세로 반폭
const HOVER_LOOKAHEAD = 4;             // 고개 돌리기: 카드 앞 4만큼 떨어진 곳에서 커서를 바라보듯 (작을수록 많이 돈다)
const DRAG_PER_PX = 0.0025;            // 마우스 드래그 1px (Codrops 0.025 ÷ 10)
const TOUCH_PER_PX = 0.002;            // 손가락 드래그 1px (Codrops 0.02 ÷ 10)
const WHEEL_PER_PX = 0.0006;           // 휠·두 손가락 벌리기 1px (Codrops 0.006 ÷ 10)
const WHEEL_KEEP = 0.8;                // 휠로 쌓인 양이 프레임마다 남는 비율 (Codrops 0.8)
const MAX_SPEED = 0.32;                // 목표 속도 상한 (Codrops 3.2 ÷ 10)
const DRIFT_FOLLOW = 0.12;             // 마우스 시점이 따라가는 빠르기 (Codrops 0.12)
const MAX_LOCAL_SOFT = CARD_W * 0.35;  // 카드 자기 크기 기준 가장자리 퍼짐 상한 (카드가 통째로 사라지지 않게)
const INTRO_DURATION = 2.2;
const INTRO_DISTANCE = 14;             // 처음엔 14만큼 뒤에서 미끄러져 들어온다
const FLIP_DURATION = 1.1;
const CLICK_TOLERANCE_PX = 6;
const FIELD_SEED = 323;                // 고정 시드 → 열 때마다 같은 배치. 600개 중 첫 화면 코앞(거리 6 이내)에 카드가 없고, 중간 거리(6~15) 8장이 화면에서 서로 안 겹치는 번호

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
    bend: 0,             // 평소엔 빳빳한 종이 (사용자 요청). 커서가 다가가면 그 카드만 휜다
    corner: CORNER_RADIUS,
    density: 1.5,        // 칸(11×11×11)마다 카드 수. Codrops 5장은 징그럽다 → 2 → "좀만 더 듬성하게" → 1.5
    spacing: 2.2,        // 겹침 방지 간격 (카드 크기 배율에 곱함 → 기본 3.5). 0이면 그냥 무작위
    cardScale: 1.6,      // 카드 크기 배율: 높이 1.9~3.2 (Codrops 12~20 ÷ 10을 1.6배, 하나하나 크게)
    fogNear: 5,          // 이 거리부터 흐려지기 시작. Codrops는 120(÷10 = 12)인데, 무지 흰 카드끼리 겹치면
                         // 한 덩어리로 보여서 앞뒤 카드 밝기가 달라지도록 더 가까이서 시작
    fogFar: 26,          // 이 거리에서 완전히 사라짐 (Codrops 투명도 끝 260)
    dragSpeed: 1,        // 드래그 감도 배율
    wheelSpeed: 1,       // 휠 감도 배율
    follow: 0.16,        // 속도가 목표를 따라가는 빠르기 (Codrops 0.16)
    decay: 0.9,          // 관성: 손 뗀 뒤 목표 속도가 프레임마다 남는 비율 (Codrops 0.9, 클수록 오래 미끄러짐)
    drift: 0.8,          // 마우스 시점 세기: 커서 쪽으로 카메라가 옮겨가는 최대 거리 (Codrops 8 ÷ 10)
    bobAmount: 0.15,     // 둥실 세기 (위아래 폭)
    lean: 1,             // 기울기 세기: 1이면 최고 속도에서 약 18°
    dof: false,          // 초점 흐림: 기본은 꺼짐 (사용자 요청). 켜면 아래 값으로
    focus: 15,           // 초점 거리: 이 거리의 카드가 가장 또렷 (사용자가 패널로 고른 값)
    blur: 0.1,           // 흐림 세기 (사용자가 패널로 고른 값: 아주 은은하게)
    hoverTilt: 15,       // 커서 근처 카드가 커서 쪽으로 고개 돌리는 최대 각도 (도)
    hoverRadius: 0.45,   // 커서 영향 반경 (화면 세로 절반 = 1)
  };
  const params = structuredClone(DEFAULTS);

  // ── 장면 ────────────────────────────────────────────────────
  // 먼 카드는 배경색 안개 속으로 사라진다 (Codrops: 안개 + 투명도를 합친 느낌)
  stage.scene.fog = new THREE.Fog(new THREE.Color(readToken('--bg-1')), params.fogNear, params.fogFar);

  const material = createCardMaterial({ cardWidth: CARD_W, cardHeight: CARD_H, cornerRadius: CORNER_RADIUS });
  // 카드 가장자리를 반투명하게 퍼뜨리려면(초점 흐림) 투명 모드로 그리고, 매 프레임 먼 카드부터 칠한다.
  // 알파→MSAA 변환(alphaToCoverage)은 투명 섞기와 겹치면 가장자리가 두 번 흐려져서 끈다
  material.transparent = true;
  material.depthWrite = false;
  material.alphaToCoverage = false;
  syncMaterial(material, params);

  const flips = new Map(); // 카드 번호 → 뒤집기 시작 시각(초)
  let box;
  let field = [];
  let cards = null;
  let order = [];  // 그리는 순서 (먼 카드부터) → 카드 번호
  let slots = [];
  let turns = [];  // 카드마다 고개 돌리기 용수철 상태 (X축·Y축 회전)

  function buildField() {
    box = fieldBox({ fogFar: params.fogFar, fov: CAMERA_FOV, cardScale: params.cardScale });
    field = createField(fieldCount(params.density, box), box, FIELD_SEED, { minDist: params.spacing * params.cardScale });
    if (cards) {
      stage.scene.remove(cards.mesh);
      cards.dispose();
    }
    cards = createCardInstances({ count: field.length, width: CARD_W, height: CARD_H, bend: params.bend, material });
    stage.scene.add(cards.mesh);
    order = field.map((_, i) => i);
    slots = field.map(() => null);
    turns = field.map(() => ({ x: { value: 0, velocity: 0 }, y: { value: 0, velocity: 0 } }));
    flips.clear();
  }
  buildField();

  function applyFog() {
    stage.scene.fog.near = params.fogNear;
    stage.scene.fog.far = params.fogFar;
  }

  function applyAll() {
    syncMaterial(material, params);
    setCornerRadius(material, params.corner);
    applyFog();
    buildField();
  }

  // ── 패널 ────────────────────────────────────────────────────
  const gui = createPanel('04 플로팅 필드 · 조절 패널');
  const texture = addTextureFolder(gui, { params, material, paperColor: paper });
  texture.add(params, 'bend', 0, 0.5, 0.01).name('휨').onChange((value) => cards.setBend(value));

  const spaceFolder = gui.addFolder('공간');
  spaceFolder.add(params, 'density', 0.5, 15, 0.1).name('카드 밀도').onFinishChange(buildField);
  spaceFolder.add(params, 'spacing', 0, 4, 0.1).name('겹침 방지 간격').onFinishChange(buildField);
  spaceFolder.add(params, 'cardScale', 0.4, 3, 0.01).name('카드 크기').onFinishChange(buildField);
  spaceFolder.add(params, 'fogNear', 0, 40, 0.5).name('흐려지기 시작').onChange(applyFog);
  spaceFolder.add(params, 'fogFar', 8, 60, 0.5).name('완전히 사라짐').onChange(applyFog).onFinishChange(buildField);

  const motionFolder = gui.addFolder('움직임');
  motionFolder.add(params, 'dragSpeed', 0.2, 3, 0.05).name('드래그 감도');
  motionFolder.add(params, 'wheelSpeed', 0.2, 3, 0.05).name('휠 감도');
  motionFolder.add(params, 'follow', 0.02, 0.5, 0.01).name('따라가기 (쫀득함)');
  motionFolder.add(params, 'decay', 0.5, 0.98, 0.01).name('관성 (미끄러짐)');
  motionFolder.add(params, 'drift', 0, 3, 0.05).name('마우스 시점 세기');
  motionFolder.add(params, 'bobAmount', 0, 0.6, 0.01).name('둥실 세기');
  motionFolder.add(params, 'lean', 0, 3, 0.05).name('기울기 세기');

  const hoverFolder = gui.addFolder('커서 쪽으로 고개 돌리기');
  hoverFolder.add(params, 'hoverTilt', 0, 40, 1).name('최대 각도 (도)');
  hoverFolder.add(params, 'hoverRadius', 0.1, 1, 0.01).name('영향 반경');

  const focusFolder = gui.addFolder('초점 흐림');
  focusFolder.add(params, 'dof').name('켜기');
  focusFolder.add(params, 'focus', 1, 25, 0.1).name('초점 거리');
  focusFolder.add(params, 'blur', 0, 3, 0.05).name('흐림 세기');

  addSettingsButtons(gui, { params, defaults: DEFAULTS, onApply: applyAll });

  // ── 입력: 드래그(헤엄치기)·휠(앞뒤)·터치·클릭(뒤집기) ─────────
  const reduced = prefersReducedMotion();
  const motion = createFloatState();
  const raycaster = new THREE.Raycaster();
  const pointer = { x: 0, y: 0, inside: false };
  const drag = { active: false, lastX: 0, lastY: 0, startX: 0, startY: 0 };
  const touch = { active: false, x: 0, y: 0, startX: 0, startY: 0, pinch: 0, multi: false };
  canvas.style.cursor = 'grab'; // 잡아서 끄는 공간이라는 신호 (Codrops와 같음)

  function toNdc(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * 2 - 1,
      y: -(((clientY - rect.top) / rect.height) * 2 - 1),
    };
  }
  // 누른 곳의 카드 번호. 그리는 순서가 매 프레임 바뀌어서 order로 진짜 카드 번호를 찾는다
  function flipAt(clientX, clientY) {
    const ndc = toNdc(clientX, clientY);
    raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), stage.camera);
    const hit = raycaster.intersectObject(cards.mesh, false)[0];
    if (!hit || hit.instanceId === undefined) return;
    const id = order[hit.instanceId];
    if (!flips.has(id)) flips.set(id, performance.now() / 1000);
  }

  // 마우스 (터치는 두 손가락 벌리기 때문에 아래 터치 이벤트에서 따로)
  canvas.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'touch') return;
    drag.active = true;
    drag.lastX = drag.startX = event.clientX;
    drag.lastY = drag.startY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = 'grabbing';
  });
  canvas.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return;
    const ndc = toNdc(event.clientX, event.clientY);
    pointer.x = ndc.x;
    pointer.y = ndc.y;
    pointer.inside = true;
    if (!drag.active) return;
    pushDrag(motion, event.clientX - drag.lastX, event.clientY - drag.lastY, DRAG_PER_PX * params.dragSpeed);
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
  });
  const endDrag = (event) => {
    if (event.pointerType === 'touch' || !drag.active) return;
    drag.active = false;
    canvas.style.cursor = 'grab';
    const moved = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (event.type === 'pointerup' && moved < CLICK_TOLERANCE_PX) flipAt(event.clientX, event.clientY);
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointerleave', () => { pointer.inside = false; });

  // 휠: 공간이 화면에 꽉 차 있을 때만 가져간다. 노트를 보는 중이면 페이지 스크롤에 맡긴다
  const stageInView = () => window.scrollY < 4;
  canvas.addEventListener('wheel', (event) => {
    if (!stageInView()) return;
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : 1; // 줄 단위 휠은 px로 환산
    pushWheel(motion, event.deltaY * unit, WHEEL_PER_PX * params.wheelSpeed);
  }, { passive: false });

  // 터치: 한 손가락 = 헤엄치기, 두 손가락 벌리기 = 앞으로, 톡 = 뒤집기
  const touchDistance = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  canvas.addEventListener('touchstart', (event) => {
    touch.active = true;
    if (event.touches.length === 1) {
      touch.x = touch.startX = event.touches[0].clientX;
      touch.y = touch.startY = event.touches[0].clientY;
      touch.multi = false;
    } else {
      touch.pinch = touchDistance(event.touches);
      touch.multi = true;
    }
  }, { passive: true });
  canvas.addEventListener('touchmove', (event) => {
    if (!touch.active) return;
    event.preventDefault();
    if (event.touches.length >= 2) {
      const distance = touchDistance(event.touches);
      pushWheel(motion, distance - touch.pinch, WHEEL_PER_PX * params.wheelSpeed);
      touch.pinch = distance;
      return;
    }
    const t = event.touches[0];
    pushDrag(motion, t.clientX - touch.x, t.clientY - touch.y, TOUCH_PER_PX * params.dragSpeed);
    touch.x = t.clientX;
    touch.y = t.clientY;
  }, { passive: false });
  canvas.addEventListener('touchend', (event) => {
    if (event.touches.length === 1) {
      // 두 손가락 중 하나를 떼면 남은 손가락 위치에서 이어서 헤엄친다
      touch.x = event.touches[0].clientX;
      touch.y = event.touches[0].clientY;
      return;
    }
    if (event.touches.length > 0) return;
    const t = event.changedTouches[0];
    const moved = Math.hypot(t.clientX - touch.startX, t.clientY - touch.startY);
    if (!touch.multi && moved < CLICK_TOLERANCE_PX) flipAt(t.clientX, t.clientY);
    touch.active = false;
  });

  // ── 매 프레임 ───────────────────────────────────────────────
  const dummy = new THREE.Object3D();
  const center = new THREE.Vector3(); // 카드 중심의 화면 좌표 계산용
  const startTime = performance.now() / 1000;
  let lastTime = startTime;

  function frame() {
    const now = performance.now() / 1000;
    const dt = Math.min(0.05, now - lastTime) || 1 / 60;
    lastTime = now;
    const intro = reduced ? 1 : easeOutCubic((now - startTime) / INTRO_DURATION);

    // 1) 카메라: 입력 → 속도 → 위치, 그리고 커서 쪽으로 살짝 (마우스 시점)
    const followCursor = pointer.inside && !reduced;
    stepFloat(motion, {
      follow: params.follow,
      decay: params.decay,
      maxSpeed: MAX_SPEED,
      wheelKeep: WHEEL_KEEP,
      driftFollow: DRIFT_FOLLOW,
      driftTarget: followCursor ? { x: pointer.x * params.drift, y: pointer.y * params.drift } : { x: 0, y: 0 },
      dragging: drag.active || touch.active,
    }, dt);
    const cam = { x: motion.base.x, y: motion.base.y, z: motion.base.z + (1 - intro) * INTRO_DISTANCE };
    stage.camera.position.set(cam.x + motion.drift.x, cam.y + motion.drift.y, cam.z);
    stage.camera.updateMatrixWorld(); // 아래에서 카드 중심을 화면 좌표로 바꿀 때 최신 카메라를 쓰게

    // 커서(또는 한 손가락 터치) 위치. 없으면 아무 카드도 안 휜다
    let cursor = null;
    if (pointer.inside) cursor = pointer;
    else if (touch.active && !touch.multi) cursor = toNdc(touch.x, touch.y);

    // 2) 카드 위치를 카메라 주변 상자 안으로 접고, 먼 카드부터 그리게 정렬 (반투명 가장자리가 제대로 섞이게)
    for (let i = 0; i < field.length; i++) slots[i] = fieldSlot(field[i], cam, box);
    order.sort((a, b) => slots[a].z - slots[b].z);

    // 3) 카드마다 둥실·기울기·커서 쪽 고개 돌리기·초점 흐림·뒤집기
    const lean = leanAngles(motion.velocity, reduced ? 0 : params.lean);
    const time = now - startTime;
    for (let k = 0; k < order.length; k++) {
      const i = order[k];
      const card = field[i];
      const slot = slots[i];
      const wobble = bob(card, time, reduced ? 0 : params.bobAmount);
      const scale = (card.size / CARD_H) * params.cardScale * slot.fade;
      const distance = cam.z - slot.z;

      // 커서 쪽으로 고개 돌리기: 카드 중심을 화면 좌표로 옮겨 커서와의 거리로 영향(1~0)을 정하고,
      // 카드 깊이에서 커서가 가리키는 점을 바라보는 각도 × 영향을 목표로 용수철이 따라간다
      let turnX = 0;
      let turnY = 0;
      if (cursor && distance > 0.5) {
        center.set(slot.x, slot.y + wobble.y, slot.z).project(stage.camera);
        // 카드의 화면상 반 크기: 가까운 큰 카드는 커서가 카드 위에만 있어도 다 반응하게
        const cardRadius = (card.size * params.cardScale * slot.fade * 0.5) / (distance * HALF_FOV_TAN);
        const influence = cursorInfluence(center, cursor, stage.camera.aspect, params.hoverRadius, cardRadius * 0.6);
        if (influence > 0) {
          const offsetX = (cursor.x - center.x) * distance * HALF_FOV_TAN * stage.camera.aspect;
          const offsetY = (cursor.y - center.y) * distance * HALF_FOV_TAN;
          const turn = hoverTurn(offsetX, offsetY, HOVER_LOOKAHEAD, THREE.MathUtils.degToRad(params.hoverTilt));
          turnX = turn.rotX * influence;
          turnY = turn.rotY * influence;
        }
      }
      stepSpring(turns[i].x, turnX, dt);
      stepSpring(turns[i].y, turnY, dt);

      dummy.position.set(slot.x, slot.y + wobble.y, slot.z);
      dummy.rotation.set(lean.rotX + turns[i].x.value, lean.rotY + turns[i].y.value, wobble.roll);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      cards.mesh.setMatrixAt(k, dummy.matrix);

      // 초점 흐림: 공간에서 퍼지는 폭을 카드 자기 크기 기준으로 바꿔서 둥근 가장자리를 그만큼 부드럽게
      const blur = params.dof ? blurRadius(distance, params.focus, params.blur) : 0;
      cards.setSoft(k, Math.min(MAX_LOCAL_SOFT, blur / Math.max(scale, 1e-3)));


      let flipProgress = 0;
      const flipStart = flips.get(i);
      if (flipStart !== undefined) {
        const t = (now - flipStart) / FLIP_DURATION;
        if (t >= 1) flips.delete(i);
        else flipProgress = easeInOutCubic(t);
      }
      cards.setFlip(k, flipProgress);
    }
    cards.commit();

    stage.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

main();
