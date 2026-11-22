// ─────────────────────────────────────────────────────────────
// glint-material.js — 05 우주 표류: 공통 카드 재질에 "글레어 + 반짝이 알갱이"를 덧붙인다 (공통 파일은 그대로)
//   글레어 : 카메라 앞을 지나가는 작은 전구(uGlintPos) 쪽 방향(L)과 카메라 쪽 방향(V)의 딱 중간(H)이
//            카드 법선과 맞을수록 밝아지는 빛 점. 픽셀마다 전구 방향이 달라서 카드 전체가 아니라 점으로 맺히고,
//            전구가 움직이면 빛 점이 카드 위를 쓱 지나간다 (포켓몬 홀로 카드 글레어 원리)
//   반짝이 : 카드 표면을 작은 칸으로 나눠 일부 칸에 "알갱이"를 박고, 알갱이마다 법선을 살짝 비튼다.
//            아주 날카로운 반사라서 각도가 딱 맞는 알갱이만 번쩍 → 반짝반짝 (포일 스티커 원리)
//   둘 다 코드는 안 가져오고 원리만. 결과는 1보다 밝게(HDR) 더해서 빛 번짐이 번쩍이는 곳만 잡는다
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

export function addGlint(material) {
  const uniforms = {
    uGlintPos: { value: new THREE.Vector3(0, 0, -3) }, // 화면(카메라) 기준 전구 위치
    uGlare: { value: 1 },
    uGlareSharpness: { value: 150 },
    uSparkleDensity: { value: 40 },                   // 카드 1단위당 칸 수 (카드 가로 1.6 → 64칸)
    uSparkleAmount: { value: 0.12 },
    uSparkle: { value: 6 },
    uTime: { value: 0 },
  };

  // 공통 재질의 셰이더 덧붙이기(휨·뒤집기·둥근 모서리)를 먼저 하고, 그 위에 반짝임을 더한다
  const baseCompile = material.onBeforeCompile;
  const baseKey = material.customProgramCacheKey();
  material.customProgramCacheKey = () => `${baseKey}-glint`;
  material.onBeforeCompile = (shader, renderer) => {
    baseCompile(shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform vec3 uGlintPos;
uniform float uGlare;
uniform float uGlareSharpness;
uniform float uSparkleDensity;
uniform float uSparkleAmount;
uniform float uSparkle;
uniform float uTime;
// 칸 번호 → 0~1 난수 (같은 칸은 항상 같은 값)
float glintHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
{
  vec3 viewDir = normalize(vViewPosition);            // 이 픽셀 → 카메라
  vec3 lightDir = normalize(uGlintPos + vViewPosition); // 이 픽셀 → 전구 (픽셀 위치 = −vViewPosition)
  vec3 halfDir = normalize(lightDir + viewDir);         // 전구와 카메라의 딱 중간 방향
  float facing = max(dot(normal, halfDir), 0.0);      // 1이면 빛을 정확히 카메라로 반사
  float glare = pow(facing, uGlareSharpness) * uGlare;

  vec2 cell = floor(vCardPos * uSparkleDensity);      // 카드 위 칸 번호
  float seed = glintHash(cell);
  float isFlake = step(1.0 - uSparkleAmount, seed);   // 일부 칸에만 알갱이
  vec3 flakeNormal = normalize(normal + vec3(glintHash(cell + 17.3) - 0.5, glintHash(cell + 41.7) - 0.5, 0.0) * 0.6);
  float flake = pow(max(dot(flakeNormal, halfDir), 0.0), 300.0); // 아주 날카롭게 → 각도 맞는 알갱이만
  float twinkle = 0.6 + 0.4 * sin(uTime * 5.0 + seed * 40.0);    // 알갱이마다 다른 박자로 깜빡
  float nearGlare = pow(facing, 6.0);                            // 글레어가 지나가는 근처에서만 반짝
  float sparkle = isFlake * flake * twinkle * uSparkle * nearGlare;

  gl_FragColor.rgb += vec3(glare + sparkle);
}`);
  };
  return uniforms;
}
