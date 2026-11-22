// ─────────────────────────────────────────────────────────────
// grid.js — 03 터널 뒤에 깔리는 휘어진 격자판
// 평평한 판의 가장자리는 카메라 쪽으로, 가운데는 뒤로 밀어서 오목한 곡면을 만든다.
// 격자 선은 픽셀 셰이더에서 그리고, 튜브가 움직일 때 같이 흐르게 오프셋을 받는다.
// 참고: Codrops "Reactive Depth"의 격자 변형 아이디어 (코드 복사 X)
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

const vertexShader = /* glsl */ `
uniform float uEdgeWidth;   // 가장자리에서 얼마나 안쪽까지 휘게 할지 (판 크기 대비 비율)
uniform float uEdgeAmp;     // 가장자리를 카메라 쪽으로 미는 양
uniform float uCenterRadius;
uniform float uCenterAmp;   // 가운데를 뒤로 미는 양 (음수)
varying vec2 vUv;

void main() {
  vUv = uv;
  vec3 p = position;
  // 가장 가까운 가장자리까지 거리 → 가장자리일수록 1
  float edgeDistance = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
  float edgeMask = 1.0 - smoothstep(0.0, uEdgeWidth, edgeDistance);
  // 가운데까지 거리 → 가운데일수록 1
  float centerMask = 1.0 - smoothstep(0.0, uCenterRadius, distance(uv, vec2(0.5)));
  p.z += edgeMask * uEdgeAmp + centerMask * uCenterAmp;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uBase;    // 판 바탕색 = 무대 배경색 (그래서 판 테두리가 안 보인다)
uniform vec3 uColor;
uniform float uAlpha;
uniform vec2 uCells;   // 가로·세로 칸 수
uniform vec2 uOffset;  // 튜브 움직임을 따라 흐르는 양
varying vec2 vUv;

void main() {
  vec2 g = (vUv + uOffset) * uCells;
  // 칸 경계까지의 거리를 픽셀 폭(fwidth)으로 나눠서, 화면에서 항상 1px 두께의 선이 나오게
  vec2 d = abs(fract(g - 0.5) - 0.5) / fwidth(g);
  float line = 1.0 - min(min(d.x, d.y), 1.0);
  // 반투명으로 겹치는 대신 배경색 위에 선 색을 직접 섞는다 → 겉보기는 같고, 불투명이라 유리 나비 속에 비친다
  gl_FragColor = vec4(mix(uBase, uColor, line * uAlpha), 1.0);
}
`;

// base: 무대 배경색(--bg-1). 유리(transmission)는 불투명한 것만 비춰주기 때문에 격자를 불투명 판으로 만든다
export function createCurvedGrid({ base, color, alpha, width = 44, height = 26, cells = [22, 13] }) {
  const geometry = new THREE.PlaneGeometry(width, height, 88, 52);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uBase: { value: base },
      uColor: { value: color },
      uAlpha: { value: alpha },
      uCells: { value: new THREE.Vector2(cells[0], cells[1]) },
      uOffset: { value: new THREE.Vector2() },
      uEdgeWidth: { value: 0.22 },
      uEdgeAmp: { value: 5 },
      uCenterRadius: { value: 0.45 },
      uCenterAmp: { value: -2.5 },
    },
    vertexShader,
    fragmentShader,
  });
  const mesh = new THREE.Mesh(geometry, material);
  return {
    mesh,
    setOffset(x, y) { material.uniforms.uOffset.value.set(x, y); },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
