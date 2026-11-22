// ─────────────────────────────────────────────────────────────
// 09 천 포스터 — 카드 10장이 대각선 띠를 따라 흐르고, 한 장 한 장이 천처럼 끌려가며 구겨진다.
// 참고: Codrops DomGL Cloth (Jesper Landberg) — 원본도 천 계산은 CPU. 숫자·원리만 옮기고 코드는 가져오지 않았다.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { createStage, showWebGLFallback } from '../../shared/stage.js?v=6';
import { createCardMaterial } from '../../shared/card-material.js?v=8';
import { createCheckerTexture } from '../../shared/checker-texture.js?v=1';
import { clamp, prefersReducedMotion } from '../../shared/motion.js?v=3';
import { createPanel, addSettingsButtons } from '../../shared/panel.js?v=2';
import { CLOTH, Cloth, nailOffset } from './cloth.js?v=3';
import {
  RIG, STRIP, rollFor, fovFromFocal, toRoom, facing, toCard, slideOffsets, cardSize, easeToward, dragDelta,
} from './strip.js?v=2';

const CHECKER = { columns: 6, rows: 8, cell: 128 }; // 앞면 바둑판: 6 × 8칸 (3:4라 칸이 정사각)
// 원본처럼 보이는 카드 근처만 천 계산 (나머지는 평평하게 따라만 간다)
const SIM_REACH = 1.6;              // 화면 가운데에서 (화면 폭 + 높이) × 이 배율 안의 카드만
// 원본처럼 기기가 느리면 단계를 6 → 4 → 3으로 줄인다 (원본 FINE [6, 4, 3])
const FINE = [6, 4, 3];
const BUDGET_MS = 8;                // 천 계산이 프레임당 평균 이보다 오래 걸리면 한 단계 줄인다
const CORNER_RATIO = 20 / 345;                      // 01~08과 같은 카드 모서리 (폭 대비)

const canvas = document.getElementById('stage-canvas');
const reduced = prefersReducedMotion();

// 패널 기본값 = 원본 숫자
const DEFAULTS = {
  starch: CLOTH.starch,        // 펴지는 힘
  bendSoft: CLOTH.bend * 1e5,  // 굽힘 부드러움 (×10⁻⁵)
  drag: CLOTH.drag,            // 공기 저항
  damp: CLOTH.damp,            // 감쇠
  ease: STRIP.ease,            // 스크롤 무게 (작을수록 묵직하게 따라옴)
  rollDeg: Math.round((RIG.roll * 180) / Math.PI), // 띠 기울기 (넓은 화면, 32°)
};
const params = structuredClone(DEFAULTS);
const tune = { ...CLOTH }; // 모든 천이 같이 보는 값 → 패널이 바꾸면 바로 반영

function applyTune() {
  tune.starch = params.starch;
  tune.bend = params.bendSoft * 1e-5;
  tune.drag = params.drag;
  tune.damp = params.damp;
}


let stage;
try {
  stage = createStage({ canvas, fov: fovFromFocal() });
} catch (error) {
  showWebGLFallback(canvas);
  throw error;
}
const { scene, camera, renderer } = stage;
camera.near = 10;
camera.far = 20000;
// 원본 빛 방향 (−0.42, −0.6, 0.68)은 화면 y 아래 기준 → y를 뒤집어 왼쪽 위 앞에서 비춘다
stage.keyLight.position.set(-0.42, 0.6, 0.68);
const map = createCheckerTexture(CHECKER);
map.anisotropy = renderer.capabilities.getMaxAnisotropy();

let cards = [];
let material = null;
let size = null;
let roll = RIG.roll;
let rotation = facing();
const rotationMatrix = new THREE.Matrix4();

function rollNow() {
  const wide = (params.rollDeg * Math.PI) / 180;
  const tall = rollFor(canvas.clientWidth, canvas.clientHeight) === RIG.rollTall;
  return tall ? wide * (RIG.rollTall / RIG.roll) : wide;
}

function setRotation() {
  roll = rollNow();
  rotation = facing(RIG.turn - RIG.yaw, roll);
  const m = rotation;
  rotationMatrix.set(m[0], m[1], m[2], 0, m[3], m[4], m[5], 0, m[6], m[7], m[8], 0, 0, 0, 0, 1);
  for (const card of cards) {
    card.mesh.matrix.copy(rotationMatrix);
    card.mesh.matrixWorldNeedsUpdate = true;
  }
}

function cardGeometry(cloth) {
  const geometry = new THREE.PlaneGeometry(size.width, size.height, CLOTH.nx - 1, CLOTH.ny - 1);
  // 천 입자 배열을 그대로 정점 배열로 쓴다 (순서가 같다: 왼쪽 위부터 줄마다)
  geometry.setAttribute('position', new THREE.BufferAttribute(cloth.pos, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('normal', new THREE.BufferAttribute(cloth.normal, 3).setUsage(THREE.DynamicDrawUsage));
  // 공통 카드 재질이 읽는 카드별 값 (한 장짜리라 1칸씩): 밝기 1, 뒤집기·퍼짐·추가 휨 0
  geometry.setAttribute('instanceDim', new THREE.InstancedBufferAttribute(new Float32Array([1]), 1));
  geometry.setAttribute('instanceFlip', new THREE.InstancedBufferAttribute(new Float32Array([0]), 1));
  geometry.setAttribute('instanceSoft', new THREE.InstancedBufferAttribute(new Float32Array([0]), 1));
  geometry.setAttribute('instanceBend', new THREE.InstancedBufferAttribute(new Float32Array([0]), 1));
  return geometry;
}

function build() {
  for (const card of cards) {
    scene.remove(card.mesh);
    card.mesh.geometry.dispose();
  }
  material?.dispose();
  size = cardSize(canvas.clientWidth);
  material = createCardMaterial({
    cardWidth: size.width,
    cardHeight: size.height,
    cornerRadius: size.width * CORNER_RATIO,
    cardPosFromUv: true, // 구겨져도 둥근 모서리가 카드 모서리에 붙어 있게
  });
  material.map = map;
  material.color.set(0xffffff); // 바둑판 색 그대로 (재질 값)
  material.roughness = 0.85;
  material.metalness = 0;
  material.clearcoat = 0;
  material.sheen = 0.3;          // 원본: 비스듬히 볼 때 윤기 0.3
  material.sheenRoughness = 0.6;
  material.sheenColor.set(0xffffff);

  cards = Array.from({ length: STRIP.count }, (_, key) => {
    // 원본처럼 카드마다 다른 곳을 잡는다 → 장마다 늘어지는 모양이 다르다.
    // 단 카드는 가운데가 띠 자리에 반듯하게 서고(원본: 시트 기준점 = 천 가운데), 잡는 점은 끌려가는 힘에만 쓴다
    const nail = nailOffset(key, size.width, size.height);
    const cloth = new Cloth(size.width, size.height, tune, nail);
    const mesh = new THREE.InstancedMesh(cardGeometry(cloth), material, 1);
    mesh.matrixAutoUpdate = false;
    mesh.frustumCulled = false; // 매 프레임 모양이 바뀌어서 "화면 밖" 판정을 끈다
    scene.add(mesh);
    return { cloth, mesh, nail };
  });
  setRotation();
}

// ── 스크롤 (원본: 페이지는 고정, 휠·드래그가 목표를 바꾸고 값은 매 프레임 목표로 다가간다) ──
let scroll = 0;
let target = 0;
let ease = params.ease;
let entering = !reduced;
let enterAt = 0;

function takeOver() {
  if (!entering) return;
  entering = false;
  ease = params.ease;
}

canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  const unit = event.deltaMode === 1 ? 16 : 1;
  target += (event.deltaY + event.deltaX) * unit;
  takeOver();
}, { passive: false });

let dragging = null;
canvas.addEventListener('pointerdown', (event) => {
  dragging = { x: event.clientX, y: event.clientY };
  canvas.setPointerCapture(event.pointerId);
  takeOver();
});
canvas.addEventListener('pointermove', (event) => {
  if (!dragging) return;
  target -= dragDelta(event.clientX - dragging.x, event.clientY - dragging.y, roll);
  dragging = { x: event.clientX, y: event.clientY };
});
for (const type of ['pointerup', 'pointercancel']) {
  canvas.addEventListener(type, () => { dragging = null; });
}

// ── 패널 ──
const gui = createPanel('09 천 포스터 · 조절 패널');
const clothFolder = gui.addFolder('천');
clothFolder.add(params, 'starch', 5, 120, 1).name('펴지는 힘').onChange(applyTune);
clothFolder.add(params, 'bendSoft', 0.1, 20, 0.1).name('굽힘 부드러움 (×10⁻⁵)').onChange(applyTune);
clothFolder.add(params, 'drag', 0, 30, 0.5).name('공기 저항').onChange(applyTune);
clothFolder.add(params, 'damp', 0, 5, 0.1).name('감쇠').onChange(applyTune);
const stripFolder = gui.addFolder('띠');
stripFolder.add(params, 'ease', 0.02, 0.3, 0.01).name('스크롤 무게').onChange(() => { if (!entering) ease = params.ease; });
stripFolder.add(params, 'rollDeg', 0, 60, 1).name('띠 기울기 (°)').onChange(setRotation);
addSettingsButtons(gui, {
  params,
  defaults: DEFAULTS,
  onApply: () => {
    applyTune();
    setRotation();
    if (!entering) ease = params.ease;
  },
});

// ── 화면 크기 ──
function layout() {
  camera.position.set(0, 0, RIG.focal * canvas.clientHeight); // 눈 = 화면 높이 × 1.5 → 카드 면 1px = 화면 1px
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix(); // near·far를 바꿨으니 반영 (안 하면 처음 값 200까지만 보여서 카드가 다 잘린다)
  const next = cardSize(canvas.clientWidth);
  if (!size || Math.abs(next.width - size.width) > 0.5) build();
  else setRotation();
}
window.addEventListener('resize', layout);

applyTune();
layout();

// 등장: 띠를 화면 폭 1.5배 밖에 두고, 0.15초 뒤 4%씩 다가오게 (원본 Strip.vue)
if (entering) {
  scroll = -canvas.clientWidth * STRIP.enter.from;
  target = scroll;
  ease = STRIP.enter.ease;
}

let last = performance.now();
const start = last;
function frame(now) {
  const dt = clamp((now - last) / 1000, 0, 0.1);
  last = now;
  const time = (now - start) / 1000;
  if (entering && !enterAt && time > STRIP.enter.wait) {
    enterAt = now;
    target = 0;
  }
  if (entering && enterAt && Math.abs(target - scroll) < 0.5) takeOver();
  scroll = easeToward(scroll, target, ease, dt);

  const offsets = slideOffsets(STRIP.count, size.spacing, scroll);
  const reach = (canvas.clientWidth + canvas.clientHeight) * SIM_REACH;
  const simStart = performance.now();
  cards.forEach((card, i) => {
    const [cx, cy, cz] = toCard(toRoom(offsets[i], 0, 0, roll), rotation);
    // 카드 가운데 = 띠 자리 → 잡는 점은 그 옆(nail)만큼 떨어진 곳
    const x = cx + card.nail[0];
    const y = cy + card.nail[1];
    const z = cz;
    let changed;
    if (reduced || Math.abs(offsets[i]) > reach) {
      card.cloth.place(x, y, z); // 동작 줄이기 · 화면 밖: 평평하게 따라만 간다
      changed = true;
    } else {
      changed = card.cloth.step(dt, x, y, z, time);
    }
    if (changed) {
      card.mesh.geometry.attributes.position.needsUpdate = true;
      card.mesh.geometry.attributes.normal.needsUpdate = true;
    }
  });
  budget(performance.now() - simStart);
  stage.render();
  requestAnimationFrame(frame);
}

// 천 계산 시간을 60프레임씩 재서, 평균이 BUDGET_MS를 넘으면 단계를 줄인다
let fine = 0;
let spent = 0;
let counted = 0;
function budget(ms) {
  spent += ms;
  counted++;
  if (counted < 60) return;
  if (spent / counted > BUDGET_MS && fine < FINE.length - 1) {
    fine++;
    tune.steps = FINE[fine];
  }
  spent = 0;
  counted = 0;
}
requestAnimationFrame(frame);
