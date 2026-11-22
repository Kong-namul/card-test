// ─────────────────────────────────────────────────────────────
// 02 구 — 휘어진 종이 카드가 커다란 공 표면에 듬성듬성 붙어 돌고,
// 스크롤하면 한 장씩 줄줄이 휜 길로 한 더미에 모였다가 → 맨 앞 한 장만 남아 → 물결처럼 뒤집힌다.
// 참고: Seventeen(seventeenagency.com/about) Sphere Interaction의 공 배치·깊이 밝기,
//       Grail(grail-app.com)의 모이기 연출 단계, Codrops Thumbnail Flow(줄줄이 휜 길) — 모두 코드 복사 없이 기법만
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import Lenis from 'lenis';
import { createStage, showWebGLFallback, readToken } from '../../shared/stage.js?v=6';
import { createCardMaterial, syncMaterial, setCornerRadius } from '../../shared/card-material.js?v=8';
import { createCardInstances } from '../../shared/card-geometry.js?v=3';
import { damp, lerp, clamp, easeOutCubic, easeInOutCubic, Momentum, prefersReducedMotion } from '../../shared/motion.js?v=3';
import { DEFAULT_PRESET, presetToParams } from '../../shared/texture-presets.js?v=1';
import { createPanel, addSettingsButtons } from '../../shared/panel.js?v=2';
import { addTextureFolder } from '../../shared/texture-panel.js?v=6';
import { scrollStages, stackSlot, stackIndexFromRank, STACK_LOOK, SCROLL_STAGES } from '../../shared/stack-choreography.js?v=3';
import { fibonacciSphere, depthBrightness } from './layout.js?v=3';
import { GATHER, expoInOut, staggerProgress, curvedPoint } from './gather.js?v=1';

const CARD_W = 1.6;                  // 01과 같은 카드 (Grail 비율 1.42, R 20/345)
const CARD_H = CARD_W * (490 / 345);
const CORNER_RADIUS = CARD_W * (20 / 345);
// 카메라 거리 10에 반지름 4.5짜리 공 → 공의 겉보기 반지름이 약 27°.
// 화면 세로 절반(19°)을 훌쩍 넘어서 공이 화면 위아래를 넘칠 만큼 크게 보인다 ("엄청 큰 원")
const CAMERA_DISTANCE = 10;
const MIN_BRIGHTNESS = 0.1;          // Seventeen: 맨 뒤 10%
const MAX_BRIGHTNESS = 1.0;
const DRAG_RADIANS_PER_PX = 0.004;   // 1px 드래그 = 0.004라디안 회전 (공이 커져서 01보다 살짝 둔하게)
const INTRO_DURATION = 1.8;
const INTRO_RADIUS_SCALE = 1.8;      // 등장할 때 1.8배 크게 흩어져 있다가 모인다
const FLIP_DURATION = 1.1;
const CLICK_TOLERANCE_PX = 6;

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

  // ── 기본값 ──────────────────────────────────────────────────
  const paper = readToken('--card-paper');
  const DEFAULTS = {
    ...presetToParams(DEFAULT_PRESET, paper),
    bend: 0.08,        // 공 곡면에 맞춘 휨: 카드 크기 0.75 ÷ (2 × 반지름 4.5)
    corner: CORNER_RADIUS,
    count: 32,         // 카드 수 (40 → 32: 빡빡하지 않게)
    radius: 4.5,       // 공 반지름 (2.75 → 4.5: 화면을 넘칠 만큼 크게)
    cardScale: 0.75,   // 카드 크기 배율 (가로 1.2)
    autoSpin: 0.12,    // 자전 속도 (초당 라디안)
    friction: 3,       // 관성 마찰: 클수록 빨리 멈춘다
    lift: 0.45,        // 커서 아래 카드가 바깥으로 떠오르는 높이
    gatherMode: GATHER.mode,             // 모이기: flow 줄줄이 곡선(기본) · classic 원래 방식
    spread: GATHER.spread,               // 줄줄이 시간차
    frontFirst: GATHER.frontFirst,       // 앞 카드부터
    verticalFirst: GATHER.verticalFirst, // 위아래 먼저
  };
  const params = structuredClone(DEFAULTS);

  // ── 장면 ────────────────────────────────────────────────────
  const material = createCardMaterial({ cardWidth: CARD_W, cardHeight: CARD_H, cornerRadius: CORNER_RADIUS });
  syncMaterial(material, params);
  let cards = createCardInstances({ count: params.count, width: CARD_W, height: CARD_H, bend: params.bend, material });
  stage.scene.add(cards.mesh);
  let lifts = new Float32Array(params.count); // 카드별 현재 떠오른 높이
  const flips = new Map();                    // 카드 번호 → 뒤집기 시작 시각(초)
  let stackRanks = null;                      // 모이기 시작한 순간 앞에서부터 매긴 순위 (모이는 동안 고정)
  let appliedBend = -1;                       // 마지막으로 카드 모양에 적용한 휨 (-1 = 다음 프레임에 다시 적용)

  function rebuildCards() {
    stage.scene.remove(cards.mesh);
    cards.dispose();
    cards = createCardInstances({ count: params.count, width: CARD_W, height: CARD_H, bend: params.bend, material });
    stage.scene.add(cards.mesh);
    lifts = new Float32Array(params.count);
    flips.clear();
    stackRanks = null;
    appliedBend = -1;
  }

  function applyAll() {
    syncMaterial(material, params);
    setCornerRadius(material, params.corner);
    if (params.count !== cards.count) rebuildCards();
    appliedBend = -1;
  }

  // ── 패널 ────────────────────────────────────────────────────
  const gui = createPanel('02 구 · 조절 패널');
  const texture = addTextureFolder(gui, { params, material, paperColor: paper });
  texture.add(params, 'bend', 0, 0.5, 0.01).name('휨'); // 실제 적용은 매 프레임 루프에서

  const sphereFolder = gui.addFolder('공');
  sphereFolder.add(params, 'radius', 2, 8, 0.05).name('반지름');
  sphereFolder.add(params, 'count', 12, 80, 1).name('카드 수').onFinishChange(rebuildCards);
  sphereFolder.add(params, 'cardScale', 0.3, 1.4, 0.01).name('카드 크기');
  sphereFolder.add(params, 'autoSpin', 0, 1, 0.01).name('자전 속도');
  sphereFolder.add(params, 'friction', 0.5, 8, 0.1).name('관성 마찰');
  sphereFolder.add(params, 'lift', 0, 1.2, 0.01).name('떠오름');

  const gatherFolder = gui.addFolder('모이기 (스크롤)');
  gatherFolder.add(params, 'gatherMode', { '줄줄이 곡선 (기본)': 'flow', '원래 방식 (다 같이 직선)': 'classic' }).name('방식');
  gatherFolder.add(params, 'spread', 0, 0.8, 0.01).name('줄줄이 시간차');
  gatherFolder.add(params, 'frontFirst').name('앞 카드부터');
  gatherFolder.add(params, 'verticalFirst').name('위아래 먼저');

  addSettingsButtons(gui, { params, defaults: DEFAULTS, onApply: applyAll });

  // ── 입력 ────────────────────────────────────────────────────
  const reduced = prefersReducedMotion();
  // 부드러운 스크롤(Lenis). 동작 줄이기가 켜져 있으면 쓰지 않는다
  const lenis = reduced ? null : new Lenis({ autoRaf: true, syncTouch: false });
  const scrollScreens = () => (lenis ? lenis.scroll : window.scrollY) / window.innerHeight;

  const spinY = new Momentum({ friction: params.friction }); // 좌우 드래그 → Y축 회전
  const spinX = new Momentum({ friction: params.friction }); // 상하 드래그 → X축 회전
  const pointer = { x: 0, y: 0, inside: false };
  const press = { active: false, held: false, startX: 0, startY: 0, lastX: 0, lastY: 0, lastT: 0 };

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
    if (press.held) {
      const dt = (event.timeStamp - press.lastT) / 1000;
      spinY.drag((event.clientX - press.lastX) * DRAG_RADIANS_PER_PX, dt);
      spinX.drag((event.clientY - press.lastY) * DRAG_RADIANS_PER_PX, dt);
      press.lastX = event.clientX;
      press.lastY = event.clientY;
      press.lastT = event.timeStamp;
    }
  });
  canvas.addEventListener('pointerleave', () => {
    pointer.inside = false;
    press.held = false;
  });
  canvas.addEventListener('pointerdown', (event) => {
    press.active = true;
    press.startX = press.lastX = event.clientX;
    press.startY = press.lastY = event.clientY;
    press.lastT = event.timeStamp;
    if (event.pointerType !== 'touch') { // 터치는 스크롤(= 모이기 연출)에 맡긴다
      press.held = true;
      canvas.setPointerCapture(event.pointerId);
    }
  });
  canvas.addEventListener('pointerup', (event) => {
    const moved = Math.hypot(event.clientX - press.startX, event.clientY - press.startY);
    if (press.active && moved < CLICK_TOLERANCE_PX) handleClick(event);
    press.active = false;
    press.held = false;
  });
  canvas.addEventListener('pointercancel', () => {
    press.active = false;
    press.held = false;
  });

  // ── 클릭 → 뒤집기, 호버 → 떠오르기 ─────────────────────────
  const raycaster = new THREE.Raycaster();

  function pick(ndcX, ndcY) {
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), stage.camera);
    const hit = raycaster.intersectObject(cards.mesh, false)[0];
    return hit && hit.instanceId !== undefined ? hit.instanceId : -1;
  }
  function handleClick(event) {
    const ndc = toNdc(event);
    const id = pick(ndc.x, ndc.y);
    if (id >= 0 && !flips.has(id)) flips.set(id, performance.now() / 1000);
  }

  // ── 매 프레임 ───────────────────────────────────────────────
  const dummy = new THREE.Object3D();
  const facer = new THREE.Object3D();          // "바깥을 보는 방향" 계산용 도우미
  const sphereRotation = new THREE.Matrix4();
  const euler = new THREE.Euler();
  const position = new THREE.Vector3();
  const outward = new THREE.Vector3();
  const sphereQuat = new THREE.Quaternion();
  const facingCamera = new THREE.Quaternion(); // 회전 없음 = 카메라를 정면으로 봄 (더미 상태)
  const startTime = performance.now() / 1000;
  let lastTime = startTime;
  let spherePositions = [];

  // p에서 바깥(원점 반대쪽)을 보면서, 화면 기준으로 항상 똑바로 선 방향
  // (lookAt의 기준 위쪽 = 월드 Y라서 카드가 거꾸로 뒤집히지 않는다)
  function faceOutward(target, p) {
    facer.position.copy(p);
    facer.lookAt(p.x * 2, p.y * 2, p.z * 2);
    target.copy(facer.quaternion);
  }

  function frame() {
    const now = performance.now() / 1000;
    const dt = Math.min(0.05, now - lastTime) || 1 / 60;
    lastTime = now;
    const intro = reduced ? 1 : easeOutCubic((now - startTime) / INTRO_DURATION);

    // 1) 스크롤 연출 진행도: gather(모이기) → single(한 장) → flip(뒤집기) → settle(정리)
    const stages = scrollStages(scrollScreens());
    const [gatherFrom, gatherTo] = SCROLL_STAGES.gather;
    const gatherLin = clamp((scrollScreens() - gatherFrom) / (gatherTo - gatherFrom), 0, 1); // 줄줄이용: 부드럽게 하기 전 진행도

    // 2) 회전: 자전(모이기 전까지) + 드래그 던지기 관성
    spinY.friction = spinX.friction = params.friction;
    if (!reduced && !press.held) spinY.value += params.autoSpin * dt * (1 - stages.gather);
    spinY.update(dt, press.held);
    spinX.update(dt, press.held);

    // 3) 카메라: 폰처럼 세로로 긴 화면이면 조금 뒤로 (01과 같은 √(1/비율) 타협)
    const narrowFit = Math.sqrt(Math.max(1, 1 / stage.camera.aspect));
    stage.camera.position.set(0, 0, CAMERA_DISTANCE * narrowFit);

    // 4) 공 위 위치(회전 적용)를 먼저 전부 계산
    const radius = lerp(params.radius * INTRO_RADIUS_SCALE, params.radius, intro);
    euler.set(spinX.value, spinY.value, 0);
    sphereRotation.makeRotationFromEuler(euler);
    spherePositions = fibonacciSphere(cards.count, radius).map((p) =>
      new THREE.Vector3(p.x, p.y, p.z).applyMatrix4(sphereRotation));

    // 5) 모이기 시작한 순간, 카메라에 가까운 카드부터 순위를 매겨 고정한다.
    //    그래야 원래 앞에 있던 카드가 더미 맨 앞에 오고, 모이는 동안 순서가 안 바뀐다
    if (stages.gather > 0.001) {
      if (!stackRanks) {
        const order = spherePositions.map((p, i) => i).sort((a, b) => spherePositions[b].z - spherePositions[a].z);
        stackRanks = new Array(cards.count);
        order.forEach((cardIndex, rank) => { stackRanks[cardIndex] = rank; });
      }
    } else {
      stackRanks = null;
    }

    // 6) 휨: 한 장만 남을 때 평평해진다. 값이 바뀔 때만 다시 계산
    const bendNow = params.bend * (1 - stages.single);
    if (Math.abs(bendNow - appliedBend) > 1e-4) {
      cards.setBend(bendNow);
      appliedBend = bendNow;
    }

    // 7) 호버: 커서 아래 카드 (드래그 중이거나 모이는 중엔 안 함)
    const hovered = pointer.inside && !press.held && stages.gather < 0.01 ? pick(pointer.x, pointer.y) : -1;
    const sphereScale = params.cardScale * lerp(0.4, 1, intro);

    for (let i = 0; i < cards.count; i++) {
      const spherePos = spherePositions[i];
      faceOutward(sphereQuat, spherePos);

      // 떠오르기: 공 바깥 방향으로 (모일수록 사라짐)
      lifts[i] = damp(lifts[i], i === hovered ? params.lift : 0, 10, dt);
      outward.copy(spherePos).normalize();
      const sphereX = spherePos.x + outward.x * lifts[i];
      const sphereY = spherePos.y + outward.y * lifts[i];
      const sphereZ = spherePos.z + outward.z * lifts[i];

      // 더미 안 위치: 앞에서부터 순위 → 0, 1, -1, 2, -2 …
      const rank = stackRanks ? stackRanks[i] : 0;
      const c = stackRanks ? stackIndexFromRank(rank) : 0;
      const stack = stackSlot(c);

      // 이 카드가 더미로 간 정도 (0 = 공 위, 1 = 더미)
      //   줄줄이 곡선: 카드마다 출발 시각이 다르고(앞 카드부터) expo.inOut으로, 휜 길을 따라
      //   원래 방식:   다 같이 같은 진행도로, 직선으로
      let toward;
      let gathered;
      if (params.gatherMode === 'flow') {
        const order = params.frontFirst ? rank : cards.count - 1 - rank;
        toward = stackRanks ? expoInOut(staggerProgress(gatherLin, order, cards.count, params.spread)) : 0;
        gathered = curvedPoint({ x: sphereX, y: sphereY, z: sphereZ }, stack, toward, params.verticalFirst);
      } else {
        toward = stages.gather;
        gathered = {
          x: lerp(sphereX, stack.x, toward),
          y: lerp(sphereY, stack.y, toward),
          z: lerp(sphereZ, stack.z, toward),
        };
      }

      // 공 → 더미 → 한가운데, 순서로 섞는다
      position.set(
        lerp(gathered.x, 0, stages.single),
        lerp(gathered.y, 0, stages.single) + STACK_LOOK.settleRise * stages.settle,
        lerp(gathered.z, 0, stages.single),
      );
      // 방향: 공 바깥 보기 → 카메라 정면 보기
      dummy.quaternion.slerpQuaternions(sphereQuat, facingCamera, toward);

      // 크기: 더미일 땐 살짝 크게, 한 장만 남을 땐 맨 앞(c=0)만 더 크게 나머지는 0, 마지막엔 86%
      let scale = lerp(sphereScale, params.cardScale * STACK_LOOK.stackScale, toward);
      scale = lerp(scale, c === 0 ? params.cardScale * STACK_LOOK.singleScale : 0, stages.single);
      scale *= lerp(1, STACK_LOOK.settleScale, stages.settle);

      dummy.position.copy(position);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      cards.mesh.setMatrixAt(i, dummy.matrix);
      // 깊이 밝기: 줄줄이는 날아가는 중의 깊이로 → 안 출발한 뒤쪽 카드는 어두운 채 공 모양을 지킨다. 더미에 닿을수록 밝게
      const depthZ = params.gatherMode === 'flow' ? gathered.z : sphereZ;
      cards.setDim(i, lerp(depthBrightness(depthZ, params.radius, MIN_BRIGHTNESS, MAX_BRIGHTNESS), 1, toward));

      // 뒤집기: 클릭으로 뒤집은 것과 스크롤 연출 뒤집기 중 큰 쪽
      let clickFlip = 0;
      const flipStart = flips.get(i);
      if (flipStart !== undefined) {
        const t = (now - flipStart) / FLIP_DURATION;
        if (t >= 1) flips.delete(i);
        else clickFlip = easeInOutCubic(t);
      }
      cards.setFlip(i, Math.max(clickFlip, stages.flip));
    }
    cards.commit();

    stage.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

main();
