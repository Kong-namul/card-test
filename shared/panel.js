// ─────────────────────────────────────────────────────────────
// panel.js — 조절 패널 (lil-gui)
// 슬라이더로 값을 만져보고, 마음에 들면 "설정 복사"로 숫자를 통째로 가져간다.
// ─────────────────────────────────────────────────────────────
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import { serializeSettings, parseSettings } from './settings.js?v=1';

export function createPanel(title) {
  const gui = new GUI({ title, width: 300 });
  gui.domElement.classList.add('card-panel'); // base.css의 토큰 테마 적용
  // 부드러운 스크롤(Lenis)을 쓰는 페이지에서도, 패널 위에서 휠을 굴리면 패널 안이 스크롤되게 한다
  gui.domElement.setAttribute('data-lenis-prevent', '');
  if (window.matchMedia('(max-width: 767px)').matches) gui.close(); // 폰에선 접어서 시작
  return gui;
}

// 값이 코드로 바뀌었을 때(붙여넣기, 기본값, 프리셋) 패널 표시를 다시 그린다
export function refreshPanel(gui) {
  gui.controllersRecursive().forEach((controller) => controller.updateDisplay());
}

// 패널 제목 자리에 잠깐 알림을 띄웠다가 원래 제목으로 돌린다
function flashTitle(gui, message) {
  const original = gui._title;
  gui.title(message);
  setTimeout(() => gui.title(original), 1400);
}

export function addSettingsButtons(gui, { params, defaults, onApply }) {
  const actions = {
    async copy() {
      const text = serializeSettings(params, defaults);
      try {
        await navigator.clipboard.writeText(text);
        flashTitle(gui, '설정을 복사했어!');
      } catch {
        // 클립보드 권한이 막힌 환경이면 직접 복사할 수 있게 창으로 보여준다
        window.prompt('자동 복사가 막혀서, 아래 내용을 직접 복사해줘', text);
      }
    },
    paste() {
      const text = window.prompt('복사해 둔 설정(JSON)을 붙여넣어줘');
      if (!text) return;
      try {
        Object.assign(params, parseSettings(text, defaults));
        refreshPanel(gui);
        onApply();
        flashTitle(gui, '설정을 적용했어!');
      } catch (error) {
        window.alert(error.message);
      }
    },
    reset() {
      Object.assign(params, structuredClone(defaults));
      refreshPanel(gui);
      onApply();
    },
  };

  const folder = gui.addFolder('설정');
  folder.add(actions, 'copy').name('설정 복사');
  folder.add(actions, 'paste').name('설정 붙여넣기');
  folder.add(actions, 'reset').name('기본값으로');
}
