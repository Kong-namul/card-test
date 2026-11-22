// ─────────────────────────────────────────────────────────────
// 06 탈출 & 뒤집기 — Eduard Bodak 포트폴리오의 "Flipping 3D cards on scroll"을 다시 만든 데모
// 원본처럼 CSS 3D + GSAP. 스크롤 위치를 구간 진행도(0~1)로 바꿔 멈춰둔 타임라인을 감는다.
// ─────────────────────────────────────────────────────────────
import { gsap } from 'gsap';
import Lenis from 'lenis';
import { scrollWindow, windowProgress, measureSection } from '../../shared/scroll-progress.js?v=1';
import { prefersReducedMotion } from '../../shared/motion.js?v=3';
import { createPanel, addSettingsButtons } from '../../shared/panel.js?v=2';
import {
  ESCAPE, RETURN, FLOAT, TUNE_DEFAULTS, escapeDelay, returnDelay,
  escapeKeyframes, returnKeyframes, reducedEscapeKeyframes, reducedReturnKeyframes,
  veilOpacity, tinyFill,
} from './timeline.js?v=3';

const reduced = prefersReducedMotion();

const escapeSection = document.querySelector('.escape');
const returnSection = document.querySelector('.return');
const returnStage = returnSection.querySelector('.return-stage');
const escapeCards = [...escapeSection.querySelectorAll('.dom-card')];
const returnCards = [...returnSection.querySelectorAll('.dom-card')];
const escapeVeils = [...escapeSection.querySelectorAll('.veil')];
const returnVeils = [...returnSection.querySelectorAll('.veil')];
const tinyCards = [...returnSection.querySelectorAll('.tiny-card')];
const floats = [...document.querySelectorAll('.float')];

// 한 줄 간격은 키프레임(귀환 0% x)과 정확히 같아야 세 장이 가운데에 겹친다 → 같은 상수를 CSS로 넘긴다
escapeSection.style.setProperty('--gap-ratio', ESCAPE.gapRatio);
returnSection.style.setProperty('--gap-ratio', RETURN.gapRatio);

const params = structuredClone(TUNE_DEFAULTS);

// 부드러운 스크롤(Lenis). 동작 줄이기가 켜져 있으면 쓰지 않는다 (01·02·05와 같음)
const lenis = reduced ? null : new Lenis({ autoRaf: true, syncTouch: false });
const currentScroll = () => (lenis ? lenis.scroll : window.scrollY);

let escapeWindow = { start: 0, end: 1 };
let returnWindow = { start: 0, end: 1 };
let escapeTimeline = null;
let returnTimeline = null;

// 구간 위치를 잰다 (처음, 그리고 화면 크기가 바뀔 때)
function measure() {
  escapeWindow = scrollWindow(measureSection(escapeSection), ESCAPE.window);
  returnWindow = scrollWindow(measureSection(returnSection), RETURN.window);
}

// 원본 computeDesktopTimeline과 같은 순서:
// 진행도 기억 → 옛 타임라인 지우기 → 카드에 남은 변형 정리 → 새로 만들기 → 진행도 복원.
// 복원 전에 한 번 끝까지 감았다 돌아와서 모든 키프레임 시작값을 미리 기록한다
// (그래야 진행도 0일 때도 0% 자리에 바로 놓인다).
function finish(timeline, progress) {
  timeline.progress(1, true).progress(progress, true);
  return timeline;
}

function buildEscape() {
  const progress = escapeTimeline?.progress() ?? 0;
  escapeTimeline?.kill();
  gsap.set(escapeCards, { clearProps: 'transform,opacity' });
  const timeline = gsap.timeline({ paused: true });
  const sectionHeight = escapeSection.offsetHeight;
  escapeCards.forEach((card, index) => {
    const keyframes = reduced
      ? reducedEscapeKeyframes()
      : escapeKeyframes(index, { cardWidth: card.offsetWidth, cardHeight: card.offsetHeight, sectionHeight }, params);
    timeline.to(card, { force3D: true, keyframes }, escapeDelay(index));
  });
  escapeTimeline = finish(timeline, progress);
}

function buildReturn() {
  const progress = returnTimeline?.progress() ?? 0;
  returnTimeline?.kill();
  gsap.set(returnCards, { clearProps: 'transform,opacity' });
  const timeline = gsap.timeline({ paused: true });
  const viewportHeight = returnStage.offsetHeight; // 100svh — 폰 주소창이 들락날락해도 안 흔들리게
  returnCards.forEach((card, index) => {
    const keyframes = reduced
      ? reducedReturnKeyframes()
      : returnKeyframes(index, { cardWidth: card.offsetWidth, viewportHeight }, params, () => gsap.getProperty(card, 'x'));
    timeline.to(card, { force3D: true, keyframes }, returnDelay(index, returnCards.length));
  });
  returnTimeline = finish(timeline, progress);
}

// 스크롤할 때마다: 진행도 → 타임라인 감기, 막 불투명도, 미니카드 채움
function render() {
  const scroll = currentScroll();
  const escapeProgress = windowProgress(scroll, escapeWindow);
  const returnProgress = windowProgress(scroll, returnWindow);
  escapeTimeline?.progress(escapeProgress);
  returnTimeline?.progress(returnProgress);

  // 배경색 막: 탈출 카드는 덮이며 사라지고, 귀환 카드는 막이 걷히며 나타난다 (동작 줄이기면 막 없이 흐려지기만)
  const escapeVeil = reduced ? 0 : veilOpacity(escapeProgress, params.veilStart, params.veilEnd);
  const returnVeil = reduced ? 0 : 1 - veilOpacity(returnProgress, params.appearStart, params.appearEnd);
  escapeVeils.forEach((element) => { element.style.opacity = escapeVeil; });
  returnVeils.forEach((element) => { element.style.opacity = returnVeil; });

  tinyCards.forEach((element, index) => {
    const { fill, lift } = tinyFill(returnProgress, index);
    element.style.setProperty('--fill', fill);
    element.style.setProperty('--lift', `${lift}px`);
  });
}

// 둥실: 카드를 감싼 .float에 건다
// (원본은 카드에 직접 yPercent. 귀환 키프레임의 y "20%"와 겹치지 않게 감싸개로 분리 — 보이는 결과는 같음)
function startFloat() {
  gsap.killTweensOf(floats);
  gsap.set(floats, { clearProps: 'transform' });
  if (reduced || params.float === 0) return;
  floats.forEach((element) => {
    gsap.fromTo(element, { yPercent: -params.float }, {
      yPercent: params.float,
      duration: () => gsap.utils.random(FLOAT.durationMin, FLOAT.durationMax),
      ease: FLOAT.ease,
      repeat: -1,
      repeatRefresh: true,
      yoyo: true,
    });
  });
}

function applyPerspective() {
  document.documentElement.style.setProperty('--persp', `${params.perspective}px`);
}

function rebuild() {
  buildEscape();
  buildReturn();
  render();
}

function applyAll() {
  applyPerspective();
  rebuild();
  startFloat();
}

// 조절 패널
const gui = createPanel('06 탈출 & 뒤집기 · 조절 패널');
const motionFolder = gui.addFolder('움직임');
motionFolder.add(params, 'fanAngle', 0, 30, 1).name('부채꼴 각도 (°)').onChange(rebuild);
motionFolder.add(params, 'gather', 0, 1.1, 0.01).name('모이는 정도 (카드폭 배)').onChange(rebuild);
motionFolder.add(params, 'tilt', 0, 45, 1).name('눕는 각도 (°)').onChange(rebuild);
motionFolder.add(params, 'overshoot', 0, 30, 1).name('뒤집기 넘침 (°)').onChange(rebuild);
motionFolder.add(params, 'float', 0, 10, 0.5).name('둥실 세기 (%)').onChange(startFloat);
const spaceFolder = gui.addFolder('공간');
spaceFolder.add(params, 'perspective', 400, 3000, 50).name('원근 (px)').onChange(applyPerspective);
const veilFolder = gui.addFolder('사라짐 · 나타남 (구간 진행도)');
veilFolder.add(params, 'veilStart', 0, 1, 0.01).name('탈출 사라짐 시작').onChange(render);
veilFolder.add(params, 'veilEnd', 0, 1, 0.01).name('탈출 사라짐 끝').onChange(render);
veilFolder.add(params, 'appearStart', 0, 1, 0.01).name('귀환 나타남 시작').onChange(render);
veilFolder.add(params, 'appearEnd', 0, 1, 0.01).name('귀환 나타남 끝').onChange(render);
addSettingsButtons(gui, { params, defaults: TUNE_DEFAULTS, onApply: applyAll });

// 스크롤 · 크기 변경 연결
if (lenis) lenis.on('scroll', render);
else window.addEventListener('scroll', render, { passive: true });

let resizeFrame = 0;
window.addEventListener('resize', () => {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => {
    measure();
    rebuild();
  });
});

measure();
applyAll();
