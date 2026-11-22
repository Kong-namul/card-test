// ─────────────────────────────────────────────────────────────
// card-geometry.js — 휜 카드 모양 + 카드 여러 장을 한 번에 그리는 묶음
// InstancedMesh: 같은 모양 카드 수십 장을 "한 번에" 그리는 방식.
//   카드마다 위치·회전·크기(행렬)만 다르게 주면 돼서 아주 가볍다.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { bendPositions } from './bend.js?v=1';

// 카드 한 장의 모양. 휘려면 면을 잘게 나눠야 해서 가로 segments칸으로 쪼갠다.
export function createCardGeometry({ width, height, bend, bow = 0.35, segments = 24 }) {
  const rows = Math.round((segments * height) / width);
  const geometry = new THREE.PlaneGeometry(width, height, segments, rows);
  setGeometryBend(geometry, bend, bow);
  return geometry;
}

// 휨 세기를 바꾼다. 휜 뒤엔 법선(빛 방향)을 다시 계산해야 광택이 곡면을 따라 흐른다.
export function setGeometryBend(geometry, bend, bow = 0.35) {
  const position = geometry.attributes.position;
  bendPositions(position.array, bend, bow);
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}

// 카드 count장 묶음. 카드별 밝기(dim)·뒤집기(flip)·가장자리 퍼짐(soft)·추가 휨(bend) 값을 셰이더로 넘기는 통로도 같이 만든다.
export function createCardInstances({ count, width, height, bend, bow = 0.35, material }) {
  const geometry = createCardGeometry({ width, height, bend, bow });

  const dim = new THREE.InstancedBufferAttribute(new Float32Array(count).fill(1), 1);
  const flip = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
  const soft = new THREE.InstancedBufferAttribute(new Float32Array(count), 1); // 0 = 또렷 (기본)
  const flex = new THREE.InstancedBufferAttribute(new Float32Array(count), 1); // 0 = 모양 휨 그대로 (기본)
  dim.setUsage(THREE.DynamicDrawUsage); // 매 프레임 바뀌는 값이라고 GPU에 알려준다
  flip.setUsage(THREE.DynamicDrawUsage);
  soft.setUsage(THREE.DynamicDrawUsage);
  flex.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('instanceDim', dim);
  geometry.setAttribute('instanceFlip', flip);
  geometry.setAttribute('instanceSoft', soft);
  geometry.setAttribute('instanceBend', flex);

  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  // 카드가 매 프레임 움직여서 "화면 밖이면 안 그리기" 판정이 틀릴 수 있다 → 끈다
  mesh.frustumCulled = false;

  return {
    mesh,
    count,
    setDim(i, value) { dim.array[i] = value; },
    setFlip(i, value) { flip.array[i] = value; },
    setSoft(i, value) { soft.array[i] = value; },
    // 이 카드만 더 휘게 (모양 휨 setBend와 별개, 셰이더에서 더해진다)
    setInstanceBend(i, value) { flex.array[i] = value; },
    // 한 프레임 동안 바꾼 값들을 GPU로 보낸다
    commit() {
      mesh.instanceMatrix.needsUpdate = true;
      dim.needsUpdate = true;
      flip.needsUpdate = true;
      soft.needsUpdate = true;
      flex.needsUpdate = true;
      mesh.boundingSphere = null; // 클릭 판정(레이캐스트)이 최신 위치를 쓰도록
    },
    setBend(value) { setGeometryBend(geometry, value, bow); },
    dispose() {
      geometry.dispose();
      mesh.dispose();
    },
  };
}
