// ─────────────────────────────────────────────────────────────
// texture-panel.js — 모든 데모에 똑같이 들어가는 "질감" 패널 폴더
// 프리셋·광택·거칠기·무지개·카드 색·모서리 R. (휨은 데모마다 적용 방식이 달라서 데모가 직접 붙인다)
// ─────────────────────────────────────────────────────────────
import { syncMaterial, setCornerRadius } from './card-material.js?v=8';
import { PRESET_NAMES, presetToParams } from './texture-presets.js?v=1';
import { refreshPanel } from './panel.js?v=2';

export function addTextureFolder(gui, { params, material, paperColor }) {
  const sync = () => syncMaterial(material, params);
  const folder = gui.addFolder('질감');
  folder.add(params, 'preset', PRESET_NAMES).name('질감 프리셋').onChange((name) => {
    // 프리셋을 고르면 광택·거칠기·무지개·색을 프리셋 값으로 채운다
    Object.assign(params, presetToParams(name, paperColor));
    sync();
    refreshPanel(gui);
  });
  folder.add(params, 'gloss', 0, 1, 0.01).name('광택 (코팅)').onChange(sync);
  folder.add(params, 'roughness', 0, 1, 0.01).name('거칠기').onChange(sync);
  folder.add(params, 'rainbow', 0, 1, 0.01).name('무지개 세기').onChange(sync);
  folder.addColor(params, 'cardColor').name('카드 색').onChange(sync);
  folder.add(params, 'corner', 0, 0.4, 0.005).name('모서리 둥글기 (R)').onChange((value) => setCornerRadius(material, value));
  return folder;
}
