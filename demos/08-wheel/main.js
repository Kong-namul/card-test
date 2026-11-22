// ─────────────────────────────────────────────────────────────
// 08 원형 휠 — Eduard Bodak 포트폴리오의 "Cards in a circular position that slightly rotate on scroll"을 다시 만든 데모
// 원 둘레에 카드를 꽂고, 스크롤 진행도만큼 원을 돌린다 (원본: 진행도로 감는 linear 타임라인).
// ─────────────────────────────────────────────────────────────
import Lenis from 'lenis';
import { scrollWindow, windowProgress, measureSection } from '../../shared/scroll-progress.js?v=1';
import { prefersReducedMotion } from '../../shared/motion.js?v=3';
import { createPanel, addSettingsButtons } from '../../shared/panel.js?v=2';
import { WHEEL, TUNE_DEFAULTS, visibleSlots, wheelRotation, overlayGradient } from './wheel.js?v=2';

const reduced = prefersReducedMotion();
const stage = document.querySelector('.wheel-stage');
const wheel = stage.querySelector('.wheel');
const overlay = stage.querySelector('.wheel-overlay');

// 카드 12장 (원본 HTML은 24칸을 다 만들고 안 보이는 8~19번을 지웠다)
for (const slot of visibleSlots()) {
  const wrap = document.createElement('div');
  wrap.className = 'wheel-item-wrap';
  wrap.style.setProperty('--angle', slot.angle);
  const card = document.createElement('div');
  card.className = `wheel-item dom-card is-${slot.color}`;
  const face = document.createElement('div');
  face.className = 'dom-card__face dom-card__face--front';
  card.appendChild(face);
  wrap.appendChild(card);
  wheel.appendChild(wrap);
}

const params = structuredClone(TUNE_DEFAULTS);

// 부드러운 스크롤(Lenis). 동작 줄이기가 켜져 있으면 쓰지 않는다
const lenis = reduced ? null : new Lenis({ autoRaf: true, syncTouch: false });
const currentScroll = () => (lenis ? lenis.scroll : window.scrollY);

let scrollRange = { start: 0, end: 1 };

function measure() {
  scrollRange = scrollWindow(measureSection(stage), WHEEL.window);
}

function render() {
  const progress = reduced ? 0 : windowProgress(currentScroll(), scrollRange);
  wheel.style.transform = `rotate(${wheelRotation(progress, params)}deg)`;
}

function applyLook() {
  stage.style.setProperty('--wheel-scale', params.wheelScale);
  overlay.style.backgroundImage = overlayGradient(params.fadeEnd);
  measure();
  render();
}

// 조절 패널
const gui = createPanel('08 원형 휠 · 조절 패널');
gui.add(params, 'rotate', -180, 0, 1).name('도는 각도 (°)').onChange(render);
gui.add(params, 'wheelScale', 0.6, 1.6, 0.05).name('원 크기').onChange(applyLook);
gui.add(params, 'fadeEnd', 10, 60, 1).name('그라데이션 끝 (%)').onChange(applyLook);
addSettingsButtons(gui, { params, defaults: TUNE_DEFAULTS, onApply: applyLook });

if (lenis) lenis.on('scroll', render);
else window.addEventListener('scroll', render, { passive: true });

let resizeFrame = 0;
window.addEventListener('resize', () => {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => {
    measure();
    render();
  });
});

applyLook();
