// ─────────────────────────────────────────────────────────────
// card-material.js — 카드 재질 (흰 종이 + 코팅 + 박)
// Three.js 기본 재질(MeshPhysicalMaterial)에 셰이더 두 가지를 덧붙인다.
//   1) instanceDim  : 카드별 밝기 배율. "깊이 어둠"용.
//                     색에 곱하는 게 아니라 최종 픽셀에 곱해서 코팅 반사까지 같이 어두워진다.
//   2) instanceFlip : 0→1 진행도. 카드가 Y축으로 한 바퀴(360°) 도는데,
//                     윗줄이 먼저 돌고 아랫줄이 20% 늦게 따라와서 물결처럼 뒤집힌다.
//   3) 둥근 모서리   : 카드 모양은 네모 그대로 두고, 모서리 바깥 픽셀만 셰이더에서 잘라낸다.
//                     그래서 휨·뒤집기와 상관없이 항상 둥글다.
//   4) instanceSoft : 카드별 가장자리 퍼짐 폭(카드 자기 좌표 기준). 0이면 픽셀 한 칸만 부드럽게(기본).
//                     무늬 없는 종이는 흐려지면 가장자리만 퍼지니까, 이걸로 카드마다 초점 흐림을 준다 (04)
//   5) instanceBend : 카드별 추가 휨. bend.js와 같은 식(z = −(b·x² + b·0.35·y²))을 셰이더에서 더한다.
//                     모양(geometry) 휨은 모든 카드가 같지만, 이건 카드마다 달라서 커서 근처만 휘게 할 수 있다 (04)
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { TEXTURE_PRESETS, DEFAULT_PRESET } from './texture-presets.js?v=1';

export function createCardMaterial({ cardWidth, cardHeight, cornerRadius }) {
  const material = new THREE.MeshPhysicalMaterial({
    side: THREE.DoubleSide,           // 뒤집혔을 때 뒷면도 보이게
    iridescenceIOR: 1.3,              // 무지개 박 굴절률
    iridescenceThicknessMinimum: 120, // 박 두께 범위(nm) → 이 폭이 넓을수록 무지개 색이 다양해진다
    iridescenceThicknessMaximum: 720, // (three 0.187부터 Range 배열 대신 최소·최대로 나눠 쓴다)
    // 둥근 모서리 가장자리를 계단 없이 부드럽게: 픽셀의 투명도를 MSAA 샘플 개수로 바꿔준다
    alphaToCoverage: true,
  });

  // 셰이더에 넘기는 값들. 객체를 붙잡아 두면 나중에 .value만 바꿔도 화면에 바로 반영된다
  const uniforms = {
    uCardWidth: { value: cardWidth },
    uCardHeight: { value: cardHeight },
    uCornerRadius: { value: cornerRadius },
  };
  material.userData.cardUniforms = uniforms;

  // 같은 재질 코드를 다른 재질과 헷갈리지 않게 캐시 이름을 따로 준다
  material.customProgramCacheKey = () => 'card-instanced-dim-flip-round-soft-bend';

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
attribute float instanceDim;
attribute float instanceFlip;
attribute float instanceSoft;
attribute float instanceBend;
uniform float uCardHeight;
varying float vInstanceDim;
varying float vInstanceSoft;
varying vec2 vCardPos;`)
      // 법선(빛 계산용 방향)을 먼저 돌린다. 각도는 아래 정점 회전에서도 재사용
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
// 카드별 휨의 기울기만큼 법선을 눕힌다 (z = −b(x² + 0.35y²) → 기울기 (2bx, 0.7by)). 0이면 그대로
objectNormal = normalize(objectNormal + vec3(2.0 * instanceBend * position.x, 0.7 * instanceBend * position.y, 0.0));
float cardFlipAngle = 0.0;
{
  float rowT = position.y / uCardHeight + 0.5;                             // 0=아랫줄, 1=윗줄
  float rowP = clamp((instanceFlip - (1.0 - rowT) * 0.2) / 0.8, 0.0, 1.0); // 아랫줄일수록 늦게 출발
  cardFlipAngle = rowP * 6.28318530718;                                    // 한 바퀴 = 2π
}
float cardFlipCos = cos(cardFlipAngle);
float cardFlipSin = sin(cardFlipAngle);
objectNormal = vec3(
  objectNormal.x * cardFlipCos + objectNormal.z * cardFlipSin,
  objectNormal.y,
  -objectNormal.x * cardFlipSin + objectNormal.z * cardFlipCos);`)
      // 정점 위치도 같은 각도로 돌린다
      .replace('#include <begin_vertex>', `#include <begin_vertex>
transformed.z -= instanceBend * (transformed.x * transformed.x + 0.35 * transformed.y * transformed.y);
transformed = vec3(
  transformed.x * cardFlipCos + transformed.z * cardFlipSin,
  transformed.y,
  -transformed.x * cardFlipSin + transformed.z * cardFlipCos);
vInstanceDim = instanceDim;
vInstanceSoft = instanceSoft;
vCardPos = position.xy; // 휨은 z만 바꾸니까 x·y는 평평한 카드 기준 좌표 그대로`);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uCardWidth;
uniform float uCardHeight;
uniform float uCornerRadius;
varying float vInstanceDim;
varying float vInstanceSoft;
varying vec2 vCardPos;`)
      // 둥근 사각형 거리 계산(SDF): d가 0보다 크면 모서리 바깥 → 투명하게 잘라낸다.
      // fwidth로 픽셀 한 칸 폭만큼 부드럽게 넘어가서 가장자리가 계단지지 않는다.
      // instanceSoft가 더 크면 그 폭만큼 안팎으로 퍼진다 (초점 흐림).
      // 진짜 렌즈로 흐리면 모서리가 더 둥글어진다. 둥글기를 그대로 두고 퍼뜨리기만 하면 카드 안쪽 밝은 부분이
      // 각진 네모로 남아 "뿌연 테두리를 두른 뾰족한 네모"가 되므로, 퍼지는 폭만큼 둥글기도 같이 키운다.
      .replace('#include <alphatest_fragment>', `#include <alphatest_fragment>
{
  vec2 halfSize = vec2(uCardWidth, uCardHeight) * 0.5;
  float radius = min(uCornerRadius + vInstanceSoft, min(halfSize.x, halfSize.y));
  vec2 q = abs(vCardPos) - (halfSize - radius);
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
  float aa = max(fwidth(d), vInstanceSoft);
  diffuseColor.a *= 1.0 - smoothstep(-aa, aa, d);
  if (diffuseColor.a <= 0.0) discard;
}`)
      // 모든 조명·반사 계산이 끝난 마지막 픽셀에 밝기 배율을 곱한다
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
gl_FragColor.rgb *= vInstanceDim;`);
  };

  return material;
}

// 모서리 둥글기(R)를 바꾼다. 셰이더를 다시 만들 필요 없이 값만 바뀐다
export function setCornerRadius(material, radius) {
  material.userData.cardUniforms.uCornerRadius.value = radius;
}

// 패널 값(params) → 재질에 반영.
// 금속감(metalness)과 코팅 뿌옇기(clearcoatRoughness)는 프리셋이 정하고,
// 나머지(광택·거칠기·무지개·색)는 패널에서 손으로 덮어쓸 수 있다.
export function syncMaterial(material, params) {
  const preset = TEXTURE_PRESETS[params.preset] ?? TEXTURE_PRESETS[DEFAULT_PRESET];
  material.color.set(params.cardColor);
  material.clearcoat = params.gloss;
  material.clearcoatRoughness = preset.clearcoatRoughness;
  material.roughness = params.roughness;
  material.metalness = preset.metalness;
  material.iridescence = params.rainbow;
}
