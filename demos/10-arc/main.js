// ─────────────────────────────────────────────────────────────
// 10 휘어진 호 캐러셀 — 가로 카드가 반원 호를 따라 끝없이 돌고, 카드도 같은 원통에 감기듯 휜다.
// 빠르게 돌리면 늘고·불룩하고·색이 번지고, 마우스를 따라 카메라가 살짝 기운다.
// 참고: Mathias Adolfsson 포트폴리오 (Codrops 2026-11-05) — 실제 사이트 코드에서 숫자·식만, 코드는 가져오지 않았다.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { createStage, showWebGLFallback } from '../../shared/stage.js?v=6';
import { createCardMaterial } from '../../shared/card-material.js?v=8';
import { createCheckerTexture } from '../../shared/checker-texture.js?v=1';
import { clamp, prefersReducedMotion } from '../../shared/motion.js?v=3';
import { createPanel, addSettingsButtons } from '../../shared/panel.js?v=2';
import {
  ARC, slideMetrics, cameraDistance, arcGeometry, carouselTarget, stretchScales,
  deformPoint, smoothVelocity, chromaOffset, tiltFromPointer, expoOut, coverUv,
} from './arc.js?v=3';
import { addArcLight } from './arc-material.js?v=1';

const SEGMENTS = { x: 48, y: 27 };   // 카드 판을 잘게 나눠야 둥글게 휜다 (16:9라 칸이 정사각)
const CHECKER = { columns: 16, rows: 9 }; // 앞면 바둑판 16 × 9칸
const INTRO_DELAY = 0.2;             // 등장 시작까지 (초)

const canvas = document.getElementById('stage-canvas');
const reduced = prefersReducedMotion();

const DEFAULTS = {
  count: ARC.count,                  // 장수 (많을수록 원이 커진다)
  arcDeg: ARC.arcDeg,                // 호 각도
  widthRatio: ARC.slide.wide,        // 카드 폭 (화면 폭 대비)
  velocityGain: 1,                   // 속도 반응 세기 (늘림·불룩·색 번짐)
  tilt: ARC.tilt,                    // 마우스 기울기 (px)
  lightIntensity: ARC.light.intensity,
  chroma: true,                      // 속도 색 번짐
};
const params = structuredClone(DEFAULTS);

let stage;
try {
  stage = createStage({ canvas, fov: ARC.fov });
} catch (error) {
  showWebGLFallback(canvas);
  throw error;
}
const { scene, camera, renderer } = stage;
const map = createCheckerTexture(CHECKER);
map.anisotropy = renderer.capabilities.getMaxAnisotropy();

let slides = [];
let material = null;
let light = null;
let metrics = null;
let arc = null;

function slideGeometry() {
  const geometry = new THREE.PlaneGeometry(metrics.width, metrics.height, SEGMENTS.x, SEGMENTS.y);
  geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
  // 공통 카드 재질이 읽는 카드별 값 (한 장짜리라 1칸씩)
  geometry.setAttribute('instanceDim', new THREE.InstancedBufferAttribute(new Float32Array([1]), 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('instanceFlip', new THREE.InstancedBufferAttribute(new Float32Array([0]), 1));
  geometry.setAttribute('instanceSoft', new THREE.InstancedBufferAttribute(new Float32Array([0]), 1));
  geometry.setAttribute('instanceBend', new THREE.InstancedBufferAttribute(new Float32Array([0]), 1));
  return geometry;
}

function build() {
  for (const slide of slides) {
    scene.remove(slide.mesh);
    slide.mesh.geometry.dispose();
  }
  material?.dispose();
  metrics = slideMetrics(canvas.clientWidth, canvas.clientHeight, params.widthRatio);
  arc = arcGeometry(params.count, metrics.spacing, params.arcDeg);
  material = createCardMaterial({
    cardWidth: metrics.width,
    cardHeight: metrics.height,
    cornerRadius: ARC.cornerRadius,
    cardPosFromUv: true, // 휘어도 둥근 모서리가 카드 모서리에 붙어 있게
  });
  // 세로 폰 카드에서도 칸이 늘어나지 않게 가운데를 잘라 쓴다 (원본 cover)
  const cover = coverUv(metrics.width / metrics.height, CHECKER.columns / CHECKER.rows);
  map.repeat.set(cover.repeatX, cover.repeatY);
  map.offset.set(cover.offsetX, cover.offsetY);
  material.map = map;
  material.color.set(0xffffff); // 바둑판 색 그대로 (재질 값)
  material.roughness = 0.85;
  material.metalness = 0;
  material.clearcoat = 0;
  light = addArcLight(material);

  slides = Array.from({ length: params.count }, () => {
    const geometry = slideGeometry();
    const flat = Float32Array.from(geometry.attributes.position.array); // 평평한 카드 좌표
    const mesh = new THREE.InstancedMesh(geometry, material, 1);
    mesh.frustumCulled = false;
    scene.add(mesh);
    return { mesh, flat, scale: 1, curve: 0, pull: 0, pullX: 0.5, pullY: 0.5 };
  });
}

function layout() {
  camera.near = 1;
  camera.far = cameraDistance(canvas.clientHeight) * 6;
  camera.updateProjectionMatrix(); // near·far를 바꿨으니 꼭 반영
  build();
}
window.addEventListener('resize', layout);

// ── 입력: 휠 · 드래그 · 마우스 기울기 · 마우스 올린 카드 ──
const motion = { pos: 0, target: 0, prevPos: 0, velocity: 0 };
const tilt = { camX: 0, camY: 0, lightX: 0, lightY: 0 };
const tiltTarget = { camX: 0, camY: 0, lightX: 0, lightY: 0 };
const pointer = { inside: false, ndc: new THREE.Vector2() };
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const raycaster = new THREE.Raycaster();

canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
  motion.target -= delta * (event.deltaMode === 1 ? 16 : 1) * ARC.wheel;
}, { passive: false });

let dragging = null;
canvas.addEventListener('pointerdown', (event) => {
  dragging = { x: event.clientX };
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', (event) => {
  const rect = canvas.getBoundingClientRect();
  const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const ny = ((event.clientY - rect.top) / rect.height) * 2 - 1;
  pointer.ndc.set(nx, -ny);
  pointer.inside = event.pointerType !== 'touch';
  if (finePointer && !reduced) Object.assign(tiltTarget, tiltFromPointer(nx, ny, metrics.width, params.tilt));
  if (dragging) {
    motion.target += event.clientX - dragging.x;
    dragging.x = event.clientX;
  }
});
for (const type of ['pointerup', 'pointercancel']) canvas.addEventListener(type, () => { dragging = null; });
canvas.addEventListener('pointerleave', () => {
  pointer.inside = false;
  Object.assign(tiltTarget, { camX: 0, camY: 0, lightX: 0, lightY: 0 });
});

// ── 패널 ──
const gui = createPanel('10 휘어진 호 · 조절 패널');
const arcFolder = gui.addFolder('호');
arcFolder.add(params, 'count', 4, 14, 1).name('장수').onChange(build);
arcFolder.add(params, 'arcDeg', 90, 300, 5).name('호 각도 (°)').onChange(build);
arcFolder.add(params, 'widthRatio', 0.3, 0.8, 0.01).name('카드 폭 (화면 대비)').onChange(build);
const motionFolder = gui.addFolder('움직임');
motionFolder.add(params, 'velocityGain', 0, 3, 0.1).name('속도 반응 세기');
motionFolder.add(params, 'tilt', 0, 150, 5).name('마우스 기울기 (px)');
motionFolder.add(params, 'chroma').name('속도 색 번짐');
const lightFolder = gui.addFolder('빛');
lightFolder.add(params, 'lightIntensity', 0, 2, 0.05).name('점빛 세기');
addSettingsButtons(gui, { params, defaults: DEFAULTS, onApply: build });

layout();

// ── 매 프레임 ──
const ONE_FRAME = 1 / 60; // smoothVelocity에 '한 프레임'으로 넘기는 값
let last = performance.now();
const start = last;
function frame(now) {
  const dt = clamp((now - last) / 1000, 0, 0.1);
  last = now;
  if (dt <= 0) {
    requestAnimationFrame(frame);
    return;
  }
  const time = (now - start) / 1000;
  // 원본처럼 '매 프레임' 따라가기 (시간 보정 없음): 120Hz 화면에선 60Hz보다 두 배 빨리 감긴다 — 원본도 그렇다
  const k = ARC.lerp;

  motion.pos += (motion.target - motion.pos) * k;
  const moved = motion.pos - motion.prevPos; // 이번 프레임 이동량
  motion.prevPos = motion.pos;
  motion.velocity = smoothVelocity(motion.velocity, moved, ONE_FRAME);
  const velocity = reduced ? 0 : motion.velocity * params.velocityGain;
  const open = reduced ? 1 : expoOut(clamp((time - INTRO_DELAY) / ARC.intro.duration, 0, 1));

  for (const key of Object.keys(tilt)) tilt[key] += (tiltTarget[key] - tilt[key]) * k;
  camera.position.set(tilt.camX, tilt.camY, cameraDistance(canvas.clientHeight));
  camera.lookAt(0, 0, 0);

  light.uLightPos.value.set(tilt.lightX, tilt.lightY, metrics.width * ARC.light.distance);
  light.uLightRadius.value = metrics.width * ARC.light.radius;
  light.uLightIntensity.value = params.lightIntensity;
  light.uChroma.value = params.chroma ? chromaOffset(velocity) : 0;

  // 마우스가 올라간 카드와 그 자리(uv)
  let hovered = -1;
  let hoverUv = null;
  if (finePointer && pointer.inside && !dragging && !reduced) {
    raycaster.setFromCamera(pointer.ndc, camera);
    const hit = raycaster.intersectObjects(slides.map((s) => s.mesh), false)[0];
    if (hit) {
      hovered = slides.findIndex((s) => s.mesh === hit.object);
      hoverUv = hit.uv;
    }
  }

  const kEdge = ARC.edge.follow;
  const kHover = ARC.hover.follow;
  slides.forEach((slide, i) => {
    const target = carouselTarget(i, motion.pos, metrics.spacing, arc, open);
    slide.scale += (target.scale - slide.scale) * kEdge;
    slide.curve += (target.curve - slide.curve) * kEdge;
    slide.pull += ((i === hovered ? ARC.hover.pull : 0) - slide.pull) * kHover;
    if (i === hovered && hoverUv) {
      slide.pullX += (hoverUv.x - slide.pullX) * kHover;
      slide.pullY += (hoverUv.y - slide.pullY) * kHover;
    }
    const { scaleX, scaleY, dim } = stretchScales(slide.scale, velocity, open);

    // 카드 판 휘기 (원통에 감기 + 추가 휨 + 속도 불룩 + 마우스 부풀림)
    const position = slide.mesh.geometry.attributes.position;
    const uv = slide.mesh.geometry.attributes.uv;
    const opts = {
      radius: arc.radiusX, ovalRatio: arc.ovalRatio, wrap: 1, curve: slide.curve,
      velocity, pull: slide.pull, pullX: slide.pullX, pullY: slide.pullY,
    };
    for (let v = 0; v < position.count; v++) {
      const [x, y, z] = deformPoint(slide.flat[v * 3], slide.flat[v * 3 + 1], uv.array[v * 2], uv.array[v * 2 + 1], opts);
      position.array[v * 3] = x;
      position.array[v * 3 + 1] = y;
      position.array[v * 3 + 2] = z;
    }
    position.needsUpdate = true;
    slide.mesh.geometry.computeVertexNormals();
    slide.mesh.geometry.computeBoundingSphere(); // 마우스 판정이 휜 모양을 쓰도록

    slide.mesh.position.set(target.x, 0, target.z);
    slide.mesh.rotation.y = target.rotY;
    slide.mesh.scale.set(scaleX, scaleY, 1);
    const dimAttr = slide.mesh.geometry.attributes.instanceDim;
    dimAttr.array[0] = dim * target.alpha; // 검은 배경이라 어둡게 = 사라지게
    dimAttr.needsUpdate = true;
    slide.mesh.visible = target.alpha > 0.01;
  });

  stage.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
