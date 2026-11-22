// ─────────────────────────────────────────────────────────────
// texture-presets.js — 카드 질감 프리셋 5종
// Three.js MeshPhysicalMaterial의 값들을 이름 붙여 묶어둔 표야.
//   clearcoat          : 투명 코팅층 세기 (0=없음, 1=유광 코팅)
//   clearcoatRoughness : 코팅층이 얼마나 뿌연지 (낮을수록 빛줄기가 날카롭다)
//   roughness          : 종이 자체의 거칠기 (높을수록 무광)
//   metalness          : 금속 느낌 (1이면 금속처럼 주변을 반사)
//   iridescence        : 보는 각도에 따라 무지개빛이 도는 정도 (홀로그램 박)
//   tint               : 금속 박의 고유색. null이면 종이색(토큰 --card-paper)을 쓴다
// 금·은 색은 페이지 UI 색이 아니라 "재질 값"이라서 토큰이 아니라 이 표 한곳에만 둔다.
// ─────────────────────────────────────────────────────────────
export const TEXTURE_PRESETS = {
  '무광 종이': { clearcoat: 0, clearcoatRoughness: 0.6, roughness: 0.92, metalness: 0, iridescence: 0, tint: null },
  '유광 코팅': { clearcoat: 1, clearcoatRoughness: 0.08, roughness: 0.55, metalness: 0, iridescence: 0, tint: null },
  '홀로그램 박': { clearcoat: 1, clearcoatRoughness: 0.06, roughness: 0.4, metalness: 0.15, iridescence: 0.7, tint: null },
  '금박': { clearcoat: 0.6, clearcoatRoughness: 0.1, roughness: 0.28, metalness: 1, iridescence: 0, tint: '#D4AF6A' },
  '은박': { clearcoat: 0.6, clearcoatRoughness: 0.1, roughness: 0.22, metalness: 1, iridescence: 0, tint: '#D9DCE1' },
};

export const PRESET_NAMES = Object.keys(TEXTURE_PRESETS);
export const DEFAULT_PRESET = '홀로그램 박';

// 프리셋을 고르면 패널 슬라이더에 들어갈 값들로 바꿔준다.
// (패널에선 광택·거칠기·무지개·카드 색을 다시 손으로 조절할 수 있다)
export function presetToParams(name, paperColor) {
  const preset = TEXTURE_PRESETS[name];
  if (!preset) throw new Error(`없는 질감 프리셋: ${name}`);
  return {
    preset: name,
    gloss: preset.clearcoat,
    roughness: preset.roughness,
    rainbow: preset.iridescence,
    cardColor: preset.tint ?? paperColor,
  };
}
