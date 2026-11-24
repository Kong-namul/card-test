// ─────────────────────────────────────────────────────────────
// lens-pass.js — 05 우주 표류: 화면 가장자리 오목 렌즈 후처리
//   다 그린 화면을 한 장의 그림으로 받아, 가장자리 띠에서만 "어디서 가져올지"를 옮겨 휘어 보이게 한다.
//   식은 lens.js(lensSample)와 같다. 레퍼: Fiddle.Digital LiquidGlassShader — 원리·숫자만, 셰이더는 우리 식으로 다시 씀.
//   색 번짐: 빨강은 가장자리 쪽, 파랑은 반대쪽으로 조금씩 엇갈려 가져와서 가장자리에 무지개 테두리가 생긴다
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { LENS } from './lens.js?v=1';

const LensShader = {
  uniforms: {
    tDiffuse: { value: null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uGlassRadius: { value: LENS.glassRadius },
    uRefraction: { value: LENS.refraction },
    uDistortion: { value: LENS.distortion },
    uDispersion: { value: LENS.dispersion },
    uEdgeOffset: { value: LENS.edgeOffset },
  },
  vertexShader: `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
  fragmentShader: `
uniform sampler2D tDiffuse;
uniform vec2 uResolution;
uniform float uGlassRadius;
uniform float uRefraction;
uniform float uDistortion;
uniform float uDispersion;
uniform float uEdgeOffset;
varying vec2 vUv;

const float PI = 3.14159265;

// 네 가장자리 띠 (왼·오·아래·위): 가장자리에서 0, 띠 안쪽 끝부터 1. 좌우는 화면비만큼 늘려 재고 1.6배 넓게
vec4 edgeBands(vec2 uv, float aspect, float radius, float offset) {
  float wide = radius * 1.6;
  return vec4(
    smoothstep(-offset, wide, uv.x * aspect),
    smoothstep(-offset, wide, (1.0 - uv.x) * aspect),
    smoothstep(-offset, radius, uv.y),
    smoothstep(-offset, radius, 1.0 - uv.y));
}

void main() {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec4 band = edgeBands(vUv, aspect, uGlassRadius, uEdgeOffset);
  float mask = 1.0 - band.x * band.y * band.z * band.w; // 0 = 가운데(그대로), 1에 가까울수록 가장자리
  if (mask < 0.0001) {
    gl_FragColor = texture2D(tDiffuse, vUv);
    return;
  }

  // 가장자리에서 가운데로 향하는 방향
  vec2 inward = vec2((1.0 - band.x) - (1.0 - band.y), (1.0 - band.z) - (1.0 - band.w));
  float inwardLength = length(inward);
  inward = inwardLength > 0.0001 ? inward / inwardLength : vec2(0.0);

  vec2 flow = -inward * sin(mask * PI) * uRefraction * 0.015;            // 유리 테두리에서 꺾이는 빛
  vec2 fromCenter = vUv - 0.5;
  vec2 stretch = fromCenter * dot(fromCenter, fromCenter) * uDistortion; // 가장자리로 갈수록 크게 늘림
  vec2 texel = 1.0 / uResolution;
  vec2 sampleUv = clamp(vUv + (flow - stretch) * mask, texel * 2.0, 1.0 - texel * 2.0);

  // 색 번짐: 절반 폭 띠 안에서, 띠 속 위치에 따라 부풀었다 줄어드는 세기로 빨강·파랑을 엇갈려 가져온다
  float thinRadius = uGlassRadius * 0.5;
  vec4 thin = edgeBands(vUv, aspect, thinRadius, uEdgeOffset * 0.5);
  float thinMask = 1.0 - thin.x * thin.y * thin.z * thin.w;
  float wideThin = thinRadius * 1.6;
  vec2 wave = vec2(
    sin(clamp(vUv.x * aspect / wideThin, 0.0, 1.0) * PI) * (1.0 - thin.x)
      - sin(clamp((1.0 - vUv.x) * aspect / wideThin, 0.0, 1.0) * PI) * (1.0 - thin.y),
    sin(clamp(vUv.y / thinRadius, 0.0, 1.0) * PI) * (1.0 - thin.z)
      - sin(clamp((1.0 - vUv.y) / thinRadius, 0.0, 1.0) * PI) * (1.0 - thin.w));
  vec2 split = wave * uDispersion * (0.35 + thinMask * 0.65);

  gl_FragColor = vec4(
    texture2D(tDiffuse, sampleUv + split).r,
    texture2D(tDiffuse, sampleUv).g,
    texture2D(tDiffuse, sampleUv - split).b,
    1.0);
}`,
};

export function createLensPass() {
  const pass = new ShaderPass(LensShader);
  const u = pass.uniforms;
  return {
    pass,
    // 매 프레임: 그림판 크기와 렌즈 값(좁은 화면이면 절반)·늘림(빠른 스크롤이면 더)을 넘긴다
    update({ width, height, config, distortion, enabled }) {
      pass.enabled = enabled;
      u.uResolution.value.set(width, height);
      u.uGlassRadius.value = config.glassRadius;
      u.uRefraction.value = config.refraction;
      u.uDistortion.value = distortion;
      u.uDispersion.value = config.dispersion;
      u.uEdgeOffset.value = config.edgeOffset;
    },
  };
}
