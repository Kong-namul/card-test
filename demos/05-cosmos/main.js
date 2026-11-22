// ─────────────────────────────────────────────────────────────
// 05 우주 표류 — 별먼지 속에 종이 카드 5장이 가운데를 느슨하게 둘러싸고 비스듬히 떠 있고 (레퍼: 우표 배치),
// 보이지 않는 빛이 훑고 지나갈 때 각도가 맞는 카드가 번쩍이며 반짝이 알갱이가 반짝인다.
// 04처럼 끌고 헤엄치는 장면이 아니라, 가만히 바라보는 장면 (마우스로 시점만 살짝).
// 스크롤하면 01·02와 같은 "하나로 모이기" 연출: 흩어진 카드 → 한 더미 → 한 장 → 물결 뒤집기 → 정리
// 반짝임 원리 참고(코드 X): 포켓몬 홀로 카드 CSS 글레어 · 포일 스티커 셰이더 알갱이 · Ziggy 카드
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import Lenis from 'lenis';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { createStage, showWebGLFallback, readToken } from '../../shared/stage.js?v=6';
import { createCardMaterial, syncMaterial, setCornerRadius } from '../../shared/card-material.js?v=8';
import { createCardInstances } from '../../shared/card-geometry.js?v=3';
import { lerp, damp, smoothstep, easeOutCubic, easeInOutCubic, prefersReducedMotion } from '../../shared/motion.js?v=3';
import { scrollStages, stackSlot, stackIndexFromRank, STACK_LOOK } from '../../shared/stack-choreography.js?v=3';
import { DEFAULT_PRESET, presetToParams } from '../../shared/texture-presets.js?v=1';
import { createPanel, addSettingsButtons } from '../../shared/panel.js?v=2';
import { addTextureFolder } from '../../shared/texture-panel.js?v=6';
import {
  ROW_DEPTH, COMPOSITION, compositionPosition, compositionCardHeight, compositionRanks, settleIn,
  createCosmos, floatOffset, wobbleAngles, glintPosition, depthDim, STAR_LAYERS, createStarLayer,
} from './layout.js?v=14';
import { addGlint } from './glint-material.js?v=2';
import { createStarDust } from './stars.js?v=2';

const CARD_W = 1.6;                    // 01~04와 같은 카드 (Grail 비율 1.42)
const CARD_H = CARD_W * (490 / 345);
// 모서리: Grail 비율(R 20/345)의 1.5배. 카드가 화면에서 작게 보이면 같은 비율로는 뾰족해 보여서 (04에서 배움)
const CORNER_RADIUS = CARD_W * (30 / 345);
const CAMERA_FOV = 40;                 // 01~03(38°)과 비슷한 차분한 화각
const PARALLAX_RATE = 2.5;             // 마우스 시점이 따라가는 빠르기 (초당, 클수록 빨리)
// 모이는 중간에 카드끼리 뚫고 지나가며 잘려 보였다 (5장이 거의 같은 거리에서 기운 채로 겹쳐서).
// → 모이기 전반(0~60%)에 먼저 똑바로 세운다. 앞뒤 순서는 처음부터 가운데 카드가 맨 앞으로 정해둔다
const STRAIGHTEN_UNTIL = 0.6;          // 모이기 진행도 이만큼에서 이미 정면
const FLIP_DURATION = 1.1;
const CLICK_TOLERANCE_PX = 6;
const MOTION_SEED = 7;                 // 카드마다 둥실·흔들림 박자를 정하는 번호
// 모이면(더미·한 장) 카드가 카메라를 정면으로 봐서 지나가는 빛을 통째로 받는다 → 빛을 이만큼까지 줄인다
const GATHERED_GLOW = 0.35;
// 무대 기본 조명(공통 0.6)은 평행한 빛이라 매끈한 코팅에 카드 전체가 통째로 반사돼 번쩍이며 번졌다
// (글레어·반짝이를 꺼도 번지는 걸로 확인). 05는 지나가는 전구가 주인공이라 기본 조명은 약하게,
// 대신 주변광(공통 0.4)을 조금 올려 종이 밝기를 맞춘다
const KEY_LIGHT = 0.15;
const ENVIRONMENT = 0.55;
// 홀로그램 박 코팅(광택 1)은 거울처럼 매끈해서 주변 조명판이 카드 전체에 엄청 밝게 비쳤다
// (빛 번짐 문턱을 2로 올려도 번짐). 05는 코팅 광택을 0.3으로 낮춘다 (패널에서 바꿀 수 있음)
const GLOSS = 0.3;
// 모이기 연출 (01·02와 같게): 카드들이 놓인 바로 그 자리 한가운데(같은 거리)에 더미를 쌓고,
// 크기도 원래 카드 기준으로 더미 1.15배 · 한 장 1.35배 · 정리 0.86배 (STACK_LOOK).
// 처음엔 카메라 쪽(거리 10)으로 끌어당겨 모아서 갑자기 커지며 튀어나왔다 → "1·2랑 많이 다르다"는 피드백.
// 정리할 때 위로 올라가는 거리는 02(카메라에서 10)와 화면에서 같은 비율이 되게 거리 비율만큼 키운다
const SETTLE_RISE = STACK_LOOK.settleRise * (ROW_DEPTH / 10);
const STAR_SEED = 5;
const TAU = Math.PI * 2;

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
    gloss: GLOSS,
    bend: 0.04,             // 아주 살짝 휜 종이 → 글레어가 카드 위를 띠처럼 지나간다
    corner: CORNER_RADIUS,
    count: 5,               // 카드 수: 26 → 20 → "너무 많아, 5개로" (사용자). 배치 자리가 5개라 최대 5
    seed: MOTION_SEED,      // 박자 번호: 카드마다 둥실·흔들림 박자 (자리는 균일 배치)
    cardScale: 1,           // 카드 크기 배율 (1 = 화면 높이의 20%)
    speed: 1,               // 떠다니는 속도 (시간 배율)
    floatAmount: 1,         // 둥실 폭 (위아래 0.18 × 이 값)
    wobble: 12,             // 각도 흔들림 최대 (도)
    parallax: 0.9,          // 마우스 시점: 커서 쪽으로 카메라가 옮겨가는 최대 거리 (카드·먼지 거리가 달라서 깊이감이 생긴다)
    lightPeriod: 18,        // 빛이 8자로 한 바퀴 도는 데 걸리는 시간 (초)
    // 빛은 "눈 뚫리겠다"는 피드백으로 확 낮춤: 글레어는 빛 번짐 문턱을 못 넘는 은은한 빛 점,
    // 반짝이 알갱이만 살짝 문턱을 넘어 작게 번진다
    glare: 0.22,            // 글레어 세기 (종이 0.85 + 0.22 → 문턱 1.3 아래)
    glareSharpness: 400,    // 글레어 날카로움 (클수록 작고 또렷한 빛 점)
    sparkleOn: false,       // 반짝이 알갱이: 기본은 꺼짐 (사용자 요청 "우선은 off"). 켜면 아래 값으로
    sparkleAmount: 0.06,    // 반짝이 알갱이가 박힌 칸 비율
    sparkle: 2,             // 반짝이 세기
    bloom: false,           // 빛 번짐: 기본은 꺼짐 (사용자 요청). 켜면 아래 값으로
    bloomStrength: 0.12,    // 빛 번짐 세기
    bloomRadius: 0.2,       // 빛 번짐 퍼짐
    bloomThreshold: 1.4,    // 이 밝기를 넘는 곳만 번진다 (종이·글레어는 안 번지고 반짝이 알갱이만)
    starCount: 1800,        // 먼 별 개수
    dustCount: 600,         // 카드 사이 먼지 개수 (천천히 떠다님)
    nearDust: 60,           // 카메라 바로 앞 먼지 개수 (크고 흐릿한 빛망울, 조금 빨리 지나감)
    twinkle: 0.6,           // 별 깜빡임 (0이면 안 깜빡임)
  };
  const params = structuredClone(DEFAULTS);

  // ── 장면 ────────────────────────────────────────────────────
  stage.keyLight.intensity = KEY_LIGHT;
  stage.scene.environmentIntensity = ENVIRONMENT;
  const material = createCardMaterial({ cardWidth: CARD_W, cardHeight: CARD_H, cornerRadius: CORNER_RADIUS });
  syncMaterial(material, params);
  const glint = addGlint(material); // 공통 재질 위에 글레어 + 반짝이를 덧붙인다 (05 전용)

  const flips = new Map(); // 카드 번호 → 뒤집기 시작 시각(초)
  let field = [];
  let cards = null;
  let appliedBend = -1;    // 마지막으로 카드 모양에 적용한 휨 (-1 = 다음 프레임에 다시 적용)
  function buildField() {
    field = createCosmos(Math.min(params.count, COMPOSITION.length), params.seed);
    if (cards) {
      stage.scene.remove(cards.mesh);
      cards.dispose();
    }
    cards = createCardInstances({ count: field.length, width: CARD_W, height: CARD_H, bend: params.bend, material });
    stage.scene.add(cards.mesh);
    flips.clear();
    appliedBend = -1;
  }
  buildField();

  // 별먼지 3겹: 먼 별(제자리) · 카드 사이 먼지 · 카메라 앞 먼지(떠다님). 색은 공통 토큰(--fg-1)
  const starColor = new THREE.Color(readToken('--fg-1'));
  let dustLayers = [];
  function buildStars() {
    for (const dust of dustLayers) {
      stage.scene.remove(dust.points);
      dust.dispose();
    }
    const counts = { far: params.starCount, mid: params.dustCount, near: params.nearDust };
    dustLayers = ['far', 'mid', 'near'].map((key, i) => {
      const layer = STAR_LAYERS[key];
      const dust = createStarDust({
        stars: createStarLayer(counts[key], STAR_SEED + i, layer),
        color: starColor,
        pixelRatio: stage.renderer.getPixelRatio(),
        opacity: layer.opacity,
        layer,
      });
      stage.scene.add(dust.points);
      return dust;
    });
  }
  buildStars();

  // 빛 번짐: 1보다 밝은 곳(글레어·반짝이)만 은은하게 번진다
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), params.bloomStrength, params.bloomRadius, params.bloomThreshold);
  stage.addEffect(bloom);
  stage.resize();

  function applyAll() {
    syncMaterial(material, params);
    setCornerRadius(material, params.corner);
    buildField();
    buildStars();
  }

  // ── 패널 ────────────────────────────────────────────────────
  const gui = createPanel('05 우주 표류 · 조절 패널');
  const texture = addTextureFolder(gui, { params, material, paperColor: paper });
  texture.add(params, 'bend', 0, 0.5, 0.01).name('휨').onChange(() => { appliedBend = -1; });

  const spaceFolder = gui.addFolder('공간');
  spaceFolder.add(params, 'count', 1, COMPOSITION.length, 1).name('카드 수').onFinishChange(buildField);
  spaceFolder.add(params, 'seed', 1, 999, 1).name('박자 번호').onFinishChange(buildField);
  spaceFolder.add(params, 'cardScale', 0.5, 2, 0.01).name('카드 크기');

  const motionFolder = gui.addFolder('움직임');
  motionFolder.add(params, 'speed', 0, 3, 0.05).name('떠다니는 속도');
  motionFolder.add(params, 'floatAmount', 0, 3, 0.05).name('둥실 폭');
  motionFolder.add(params, 'wobble', 0, 40, 1).name('흔들림 각도 (도)');
  motionFolder.add(params, 'parallax', 0, 2, 0.05).name('마우스 시점');

  const glintFolder = gui.addFolder('반짝임');
  glintFolder.add(params, 'lightPeriod', 4, 60, 1).name('빛 한 바퀴 (초)');
  glintFolder.add(params, 'glare', 0, 4, 0.05).name('글레어 세기');
  glintFolder.add(params, 'glareSharpness', 5, 300, 1).name('글레어 날카로움');
  glintFolder.add(params, 'sparkleOn').name('반짝이 켜기');
  glintFolder.add(params, 'sparkleAmount', 0, 0.6, 0.01).name('반짝이 양');
  glintFolder.add(params, 'sparkle', 0, 20, 0.1).name('반짝이 세기');

  const bloomFolder = gui.addFolder('빛 번짐');
  bloomFolder.add(params, 'bloom').name('켜기');
  bloomFolder.add(params, 'bloomStrength', 0, 3, 0.05).name('세기');
  bloomFolder.add(params, 'bloomRadius', 0, 1, 0.01).name('퍼짐');
  bloomFolder.add(params, 'bloomThreshold', 0, 2, 0.01).name('문턱');

  const starFolder = gui.addFolder('별먼지');
  starFolder.add(params, 'starCount', 0, 5000, 100).name('먼 별').onFinishChange(buildStars);
  starFolder.add(params, 'dustCount', 0, 3000, 50).name('카드 사이 먼지').onFinishChange(buildStars);
  starFolder.add(params, 'nearDust', 0, 300, 5).name('앞쪽 먼지').onFinishChange(buildStars);
  starFolder.add(params, 'twinkle', 0, 1, 0.01).name('깜빡임');

  addSettingsButtons(gui, { params, defaults: DEFAULTS, onApply: applyAll });

  // ── 입력: 스크롤(모이기) · 마우스 시점 · 누르면 뒤집기 ─────────
  const reduced = prefersReducedMotion();
  // 부드러운 스크롤(Lenis). 동작 줄이기가 켜져 있으면 쓰지 않는다 (01·02와 같음)
  const lenis = reduced ? null : new Lenis({ autoRaf: true, syncTouch: false });
  const scrollScreens = () => (lenis ? lenis.scroll : window.scrollY) / window.innerHeight;
  const raycaster = new THREE.Raycaster();
  const pointer = { x: 0, y: 0, inside: false };
  const press = { active: false, x: 0, y: 0 };

  function toNdc(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * 2 - 1,
      y: -(((clientY - rect.top) / rect.height) * 2 - 1),
    };
  }
  canvas.addEventListener('pointermove', (event) => {
    const ndc = toNdc(event.clientX, event.clientY);
    pointer.x = ndc.x;
    pointer.y = ndc.y;
    pointer.inside = event.pointerType !== 'touch';
  });
  canvas.addEventListener('pointerleave', () => { pointer.inside = false; });
  canvas.addEventListener('pointerdown', (event) => {
    press.active = true;
    press.x = event.clientX;
    press.y = event.clientY;
  });
  canvas.addEventListener('pointerup', (event) => {
    const moved = Math.hypot(event.clientX - press.x, event.clientY - press.y);
    if (press.active && moved < CLICK_TOLERANCE_PX) {
      const ndc = toNdc(event.clientX, event.clientY);
      raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), stage.camera);
      const hit = raycaster.intersectObject(cards.mesh, false)[0];
      if (hit && hit.instanceId !== undefined && !flips.has(hit.instanceId)) {
        flips.set(hit.instanceId, performance.now() / 1000);
      }
    }
    press.active = false;
  });

  // ── 매 프레임 ───────────────────────────────────────────────
  const dummy = new THREE.Object3D();
  const startTime = performance.now() / 1000;
  let lastTime = startTime;
  let driftClock = 0;  // 떠다니는 시계: 떠다니는 속도를 곱해서 흐른다 (속도를 바꿔도 위치가 튀지 않게)
  let lightAngle = 0;  // 빛이 8자로 도는 각도
  let sparkleClock = 0;
  const camOffset = { x: 0, y: 0 };
  const euler = new THREE.Euler();
  const floatQuat = new THREE.Quaternion();
  const facingCamera = new THREE.Quaternion(); // 회전 없음 = 카메라를 정면으로 봄 (더미 상태)
  const stackCenter = new THREE.Vector3(0, 0, -ROW_DEPTH); // 카드들이 놓인 자리 한가운데

  function frame() {
    const now = performance.now() / 1000;
    const dt = Math.min(0.05, now - lastTime) || 1 / 60;
    lastTime = now;
    const sinceStart = reduced ? Infinity : now - startTime; // 등장 시계
    if (!reduced) {
      driftClock += dt * params.speed;
      lightAngle += (dt * TAU) / params.lightPeriod;
      sparkleClock += dt;
    }

    // 0) 스크롤 연출 진행도: gather(모이기) → single(한 장) → flip(뒤집기) → settle(정리)
    const stages = scrollStages(scrollScreens());

    // 1) 카메라: 커서 쪽으로 아주 천천히 (모일수록 줄여서 더미가 화면 가운데에 오게).
    //    회전 없이 위치만 옮겨서 빛 위치를 화면 기준으로 그대로 쓸 수 있다
    const followCursor = pointer.inside && !reduced;
    const parallax = params.parallax * (1 - stages.gather);
    camOffset.x = damp(camOffset.x, followCursor ? pointer.x * parallax : 0, PARALLAX_RATE, dt);
    camOffset.y = damp(camOffset.y, followCursor ? pointer.y * parallax : 0, PARALLAX_RATE, dt);
    stage.camera.position.set(camOffset.x, camOffset.y, 0);

    // 2) 빛·반짝임·빛 번짐·별: 패널 값을 매 프레임 그대로 넘긴다
    // 전구는 장면 기준으로 움직이고, 셰이더엔 카메라 기준 위치로 넘긴다 (카메라는 회전 없이 위치만 옮기니까 빼기만)
    const [gx, gy, gz] = glintPosition(lightAngle);
    glint.uGlintPos.value.set(gx, gy, gz).sub(stage.camera.position);
    const glow = lerp(1, GATHERED_GLOW, stages.gather); // 모일수록 빛을 줄인다
    glint.uGlare.value = params.glare * glow;
    glint.uGlareSharpness.value = params.glareSharpness;
    glint.uSparkleAmount.value = params.sparkleAmount;
    glint.uSparkle.value = params.sparkleOn ? params.sparkle * glow : 0;
    glint.uTime.value = sparkleClock;
    bloom.enabled = params.bloom;
    bloom.strength = params.bloomStrength * glow;
    bloom.radius = params.bloomRadius;
    bloom.threshold = params.bloomThreshold;
    for (const dust of dustLayers) {
      dust.setTime(sparkleClock);
      dust.setTwinkle(reduced ? 0 : params.twinkle);
    }

    // 3) 배치 자리 (좁은 화면이면 배치 전체를 줄인다). 앞뒤 순서는 가운데 카드가 맨 앞 → 더미 순서와 같다.
    //    등장: 레퍼 그대로 묶음 전체가 110%에서 1초 동안 100%로 내려앉는다 (위치·크기를 화면 가운데 기준으로 같이)
    const view = { fov: CAMERA_FOV, aspect: stage.camera.aspect };
    const slots = COMPOSITION.slice(0, field.length);
    const ranks = compositionRanks(slots);
    const settle = settleIn(sinceStart);
    const bases = slots.map((slot, i) => compositionPosition({ sx: slot.sx * settle, sy: slot.sy * settle, depth: slot.depth }, ranks[i], view));
    const rowScale = (compositionCardHeight(view) / CARD_H) * params.cardScale * settle;

    // 4) 휨: 한 장만 남을 때 평평해진다. 값이 바뀔 때만 다시 계산
    const bendNow = params.bend * (1 - stages.single);
    if (Math.abs(bendNow - appliedBend) > 1e-4) {
      cards.setBend(bendNow);
      appliedBend = bendNow;
    }

    // 5) 카드: 배치 자리(비스듬히 기운 채 둥실·흔들림) → 더미 → 한가운데, 순서로 섞는다
    const maxWobble = THREE.MathUtils.degToRad(params.wobble);
    const straighten = smoothstep(0, STRAIGHTEN_UNTIL, stages.gather); // 겹치기 전에 먼저 똑바로
    for (let i = 0; i < field.length; i++) {
      const card = field[i];
      const base = bases[i];
      const drift = floatOffset(card, driftClock, params.floatAmount);
      const angles = wobbleAngles(card, driftClock, maxWobble);
      const c = stackIndexFromRank(ranks[i]);
      const stack = stackSlot(c);

      // 크기 (01·02와 같게 원래 카드 기준): 더미 1.15배, 한 장만 남을 땐 맨 앞(c=0)만 1.35배 나머지는 0, 마지막엔 86%
      let scale = lerp(rowScale, rowScale * STACK_LOOK.stackScale, stages.gather); // 종이는 커지지 않는다
      scale = lerp(scale, c === 0 ? rowScale * STACK_LOOK.singleScale : 0, stages.single);
      scale *= lerp(1, STACK_LOOK.settleScale, stages.settle);

      // 방향: 자리 기울기 + 흔들림 → 모일수록 카메라 정면
      euler.set(angles.rotX, angles.rotY, slots[i].tilt);
      floatQuat.setFromEuler(euler);
      dummy.quaternion.slerpQuaternions(floatQuat, facingCamera, straighten);

      dummy.position.set(
        lerp(lerp(base.x + drift.x, stackCenter.x + stack.x, stages.gather), stackCenter.x, stages.single),
        lerp(lerp(base.y + drift.y, stackCenter.y + stack.y, stages.gather), stackCenter.y, stages.single)
          + SETTLE_RISE * stages.settle,
        lerp(lerp(base.z, stackCenter.z + stack.z, stages.gather), stackCenter.z, stages.single),
      );
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      cards.mesh.setMatrixAt(i, dummy.matrix);
      cards.setDim(i, lerp(depthDim(slots[i].depth), 1, stages.gather)); // 먼 카드일수록 어둡게, 모이면 다 밝게

      let flipProgress = 0;
      const flipStart = flips.get(i);
      if (flipStart !== undefined) {
        const t = (now - flipStart) / FLIP_DURATION;
        if (t >= 1) flips.delete(i);
        else flipProgress = easeInOutCubic(t);
      }
      cards.setFlip(i, Math.max(flipProgress, stages.flip)); // 클릭 뒤집기와 스크롤 연출 뒤집기 중 큰 쪽
    }
    cards.commit();

    stage.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

main();
