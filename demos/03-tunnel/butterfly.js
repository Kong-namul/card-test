// ─────────────────────────────────────────────────────────────
// butterfly.js — 03 터널 가운데 거대 크리스탈 나비
// 재질은 Codrops "Reactive Depth" 터널 장면 가운데 헬멧 숫자를 참고 (CRYSTAL_GLASS):
//   빛 통과 1, 두께 10, 굴절률 1.9, 무지개 번짐 1, 금속 0.1 + 검은 스튜디오 조명 → 투명 크리스탈 유리
//   Three.js가 유리 뒤에 있는 불투명한 것들(카드·격자·배경)을 먼저 그려두고, 그걸 휘어서 유리 안에 비춘다.
// 날갯짓은 모델에 날개 부품이 따로 없어서 셰이더로: 몸통 중심선(경첩)을 축으로
// 몸에서 먼 꼭짓점일수록 위아래로 접는다 (로드리게스 회전).
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { BUTTERFLIES, CRYSTAL_GLASS, STUDIO } from './butterflies.js?v=9';

// 검은 공간에 하얀 빛 판(띠)만 떠 있는 작은 장면 → 유리에 비칠 조명 사진(envMap)으로 굽는다
function createStudioScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(STUDIO.background);
  const box = new THREE.BoxGeometry(1, 1, 1);
  for (const light of STUDIO.lights) {
    // 색을 1보다 크게 곱해서 실제 조명처럼 쨍한 빛 (HDR)
    const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(light.intensity) });
    const panel = new THREE.Mesh(box, material);
    panel.position.set(...light.position);
    panel.scale.set(...light.size);
    scene.add(panel);
  }
  return scene;
}

export function createCrystalButterfly({ renderer }) {
  // 조명 띠가 유리 면에 또렷한 줄로 맺히도록 아주 살짝만 흐리게(0.02)
  const pmrem = new THREE.PMREMGenerator(renderer);
  const studio = createStudioScene();
  const envMap = pmrem.fromScene(studio, 0.02).texture;
  pmrem.dispose();
  studio.traverse((node) => {
    if (node.isMesh) node.material.dispose();
  });

  // 날갯짓 셰이더에 넘기는 값 (모델을 바꾸면 축·몸통 폭도 바뀐다)
  const uniforms = {
    uFlap: { value: 0 },
    uSpanAxis: { value: new THREE.Vector3(0, 0, 1) },
    uHingeAxis: { value: new THREE.Vector3(1, 0, 0) },
    uBodyHalf: { value: 0.1 },
  };

  const material = new THREE.MeshPhysicalMaterial({
    ...CRYSTAL_GLASS,
    color: 0xffffff, // 유리 자체 색은 없음 (레퍼의 "transparent"는 Three.js에서 흰색으로 처리됨)
    envMap,
    envMapIntensity: 1,
    side: THREE.DoubleSide, // 날개가 얇은 판이라 뒤에서 봐도 보이게
  });
  material.customProgramCacheKey = () => 'crystal-butterfly-flap';
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
uniform float uFlap;
uniform vec3 uSpanAxis;
uniform vec3 uHingeAxis;
uniform float uBodyHalf;
// 경첩 축(uHingeAxis)을 중심으로 점 p를 각도 a만큼 돌린다
vec3 flapRotate(vec3 p, float a) {
  vec3 k = uHingeAxis;
  float c = cos(a);
  float s = sin(a);
  return p * c + cross(k, p) * s + k * dot(k, p) * (1.0 - c);
}
// 몸통(반폭 uBodyHalf) 안쪽은 0, 바깥으로 갈수록 uFlap까지. 좌우 날개는 반대로 돌아야 대칭이 된다
float wingAngleAt(vec3 p) {
  float side = dot(p, uSpanAxis);
  return uFlap * sign(side) * smoothstep(uBodyHalf, uBodyHalf * 2.5, abs(side));
}`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
float wingAngle = wingAngleAt(position);
objectNormal = flapRotate(objectNormal, wingAngle);`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
transformed = flapRotate(transformed, wingAngle);`);
  };

  const group = new THREE.Group();   // 크기·흔들림은 이 그룹에
  const loader = new GLTFLoader();
  const prepared = new Map();        // 한 번 불러온 모델은 다시 안 불러온다
  let current = null;
  let requested = 'none';
  let viewYaw = 0; // 지금 모델의 기본 방향 (라디안)
  const lean = { tilt: 0, roll: 0 }; // 패널 기울기 조절 (라디안): 앞뒤(X축)·옆(Z축). 기본 자세엔 갸웃 없음

  // 모델 기본 자세 + 패널 기울기를 wrapper에 적용하고, 날개까지 포함한 덩어리 중심을 원점에 맞춘다.
  // (날개가 위로 솟은 모양이면 위로 쏠려 보이니까. 셰이더는 메시 자기 좌표라 옮겨도 경첩은 그대로)
  function applyLean() {
    if (!current) return;
    const { wrapper, entry } = current;
    const { spec } = entry;
    wrapper.rotation.set(spec.baseTilt + lean.tilt, spec.baseYaw, lean.roll);
    wrapper.position.set(0, 0, 0);
    wrapper.updateMatrix();
    const center = entry.bounds.clone().applyMatrix4(wrapper.matrix).getCenter(new THREE.Vector3());
    wrapper.position.copy(center).negate();
  }

  // 모델을 불러와서 (1) 모든 부품의 위치·회전을 꼭짓점에 구워 넣고 (2) 경첩이 원점에 오게 옮기고
  // (3) 날개 길이를 1로 맞춘다. 이렇게 해야 셰이더의 축·몸통 폭이 모델 좌표 그대로 맞는다
  async function prepare(key) {
    if (prepared.has(key)) return prepared.get(key);
    const spec = BUTTERFLIES[key];
    const gltf = await loader.loadAsync(new URL(spec.file, import.meta.url).href);
    gltf.scene.updateMatrixWorld(true);
    const pivot = new THREE.Vector3(...spec.pivot);
    const holder = new THREE.Group();
    const bounds = new THREE.Box3();
    gltf.scene.traverse((node) => {
      if (!node.isMesh) return;
      const geometry = node.geometry.clone();
      geometry.applyMatrix4(node.matrixWorld);
      geometry.translate(-pivot.x, -pivot.y, -pivot.z);
      geometry.computeBoundingBox();
      bounds.union(geometry.boundingBox);
      holder.add(new THREE.Mesh(geometry, material));
    });
    const spanAxis = new THREE.Vector3(...spec.spanAxis);
    const size = bounds.getSize(new THREE.Vector3());
    const spanLength = Math.abs(size.dot(spanAxis));
    const entry = { spec, holder, spanLength, bounds };
    prepared.set(key, entry);
    return entry;
  }

  async function show(key) {
    requested = key;
    if (current) {
      group.remove(current.wrapper);
      current = null;
    }
    if (key === 'none' || !BUTTERFLIES[key]) return;
    const entry = await prepare(key);
    if (requested !== key) return; // 불러오는 사이에 다른 걸 골랐으면 버린다
    const { spec, holder, spanLength } = entry;
    uniforms.uSpanAxis.value.set(...spec.spanAxis);
    uniforms.uHingeAxis.value.set(...spec.hingeAxis);
    uniforms.uBodyHalf.value = spec.bodyHalf * spanLength;
    // 날개 길이 1로 맞추고, 날개가 화면 가로로 펼쳐 보이게 돌려둔다
    const wrapper = new THREE.Group();
    wrapper.add(holder);
    wrapper.scale.setScalar(1 / spanLength);
    group.add(wrapper);
    current = { wrapper, entry };
    applyLean();
    viewYaw = THREE.MathUtils.degToRad(spec.viewYaw);
  }

  return {
    group,
    show,
    // 패널 기울기 조절 (도): 앞뒤로 눕히기(X축 = 끄덕)·옆으로 갸웃(Z축). 모델 기본 자세에 더해진다
    setLean(tiltDeg, rollDeg) {
      lean.tilt = THREE.MathUtils.degToRad(tiltDeg);
      lean.roll = THREE.MathUtils.degToRad(rollDeg);
      applyLean();
    },
    // 날갯짓 각도 (라디안)
    setFlap(angle) { uniforms.uFlap.value = angle; },
    // 유리 조절: 두께(뒤 풍경이 휘는 정도)·무지개 번짐
    setGlass({ thickness, dispersion }) {
      material.thickness = thickness;
      material.dispersion = dispersion;
    },
    // 크기(날개 길이)·방향 조절(모델 기본 방향에 더해짐)·위아래 흔들림·앞으로 숙임
    pose({ size, yaw, bob, tilt }) {
      group.scale.setScalar(size);
      group.rotation.set(tilt, viewYaw + yaw, 0);
      group.position.y = bob;
    },
  };
}
