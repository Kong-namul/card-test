// ─────────────────────────────────────────────────────────────
// arc-material.js — 10: 공통 카드 재질에 원본의 "둥근 점빛"과 "속도 색 번짐"을 덧붙인다 (공통 파일은 그대로)
//   점빛 : 카드 앞 점에서 반경 안쪽일수록 밝게 더한다 (원본: 1 − smoothstep(0, 반경, 거리) × 세기)
//   색 번짐: 빠르게 돌릴 때 빨강은 한쪽, 파랑은 반대쪽으로 uv를 살짝 밀어 읽는다
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

export function addArcLight(material) {
  const uniforms = {
    uLightPos: { value: new THREE.Vector3() },
    uLightRadius: { value: 1 },
    uLightIntensity: { value: 0.75 },
    uChroma: { value: 0 },
  };
  const baseCompile = material.onBeforeCompile;
  const baseKey = material.customProgramCacheKey();
  material.customProgramCacheKey = () => `${baseKey}-arc`;
  material.onBeforeCompile = (shader, renderer) => {
    baseCompile(shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
varying vec3 vArcWorld;`)
      .replace('#include <project_vertex>', `#include <project_vertex>
{
  vec4 arcWorld = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
  arcWorld = instanceMatrix * arcWorld;
  #endif
  vArcWorld = (modelMatrix * arcWorld).xyz;
}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform vec3 uLightPos;
uniform float uLightRadius;
uniform float uLightIntensity;
uniform float uChroma;
varying vec3 vArcWorld;`)
      .replace('#include <map_fragment>', `#ifdef USE_MAP
  vec4 sampledDiffuseColor = texture2D(map, vMapUv);
  if (abs(uChroma) > 0.0001) {
    sampledDiffuseColor.r = texture2D(map, vMapUv + vec2(uChroma, 0.0)).r;
    sampledDiffuseColor.b = texture2D(map, vMapUv - vec2(uChroma, 0.0)).b;
  }
  diffuseColor *= sampledDiffuseColor;
#endif`)
      // 공통 재질이 마지막에 밝기(가장자리 어둠·사라짐)를 곱하기 전에 더해서, 점빛도 같이 어두워지고 사라진다
      .replace('#include <dithering_fragment>', `{
  float arcGlow = 1.0 - smoothstep(0.0, uLightRadius, distance(vArcWorld, uLightPos));
  gl_FragColor.rgb += vec3(arcGlow * uLightIntensity);
}
#include <dithering_fragment>`);
  };
  return uniforms;
}
