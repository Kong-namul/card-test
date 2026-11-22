// ─────────────────────────────────────────────────────────────
// 07 마우스로 도는 카드 — Eduard Bodak 포트폴리오 가격 카드("Card rotating on mouse movement")를 다시 만든 데모
// 등장(탄성) → 끝나면 매 프레임 마우스 x를 따라 돈다 → 무대를 나가면 탄성 복귀.
// ─────────────────────────────────────────────────────────────
import { gsap } from 'gsap';
import { prefersReducedMotion } from '../../shared/motion.js?v=3';
import { createPanel, addSettingsButtons } from '../../shared/panel.js?v=2';
import { INTRO, FOLLOW, LEAVE, REFLECTION, TUNE_DEFAULTS, followRotation, restPose } from './rotation.js?v=1';

const reduced = prefersReducedMotion();
const stage = document.querySelector('.price-stage');
// 진짜 카드 + 반사 복제본. 둘에 같은 값을 준다 (반사는 뒤집힌 상자 안이라 저절로 거울처럼 보임)
const cards = [...stage.querySelectorAll('.price-card')];

const params = structuredClone(TUNE_DEFAULTS);

let ready = false;    // 등장이 끝나야 따라가기 시작 (원본 onComplete → initAnimation)
let hovering = false; // 원본 isHovering
let pointerX = window.innerWidth / 2;

function applyLook() {
  const root = document.documentElement.style;
  root.setProperty('--persp', `${params.perspective}px`);
  root.setProperty('--reflection-opacity', params.reflectionOpacity);
  root.setProperty('--reflection-blur', `${params.reflectionBlur}px`);
  root.setProperty('--reflection-gap', REFLECTION.gap);
  root.setProperty('--reflection-visible', REFLECTION.visible);
}

function playIntro() {
  ready = false;
  gsap.killTweensOf(cards);
  gsap.fromTo(cards, { ...INTRO.from }, {
    ...INTRO.to,
    rotationZ: params.baseTilt,
    duration: INTRO.duration,
    ease: INTRO.ease,
    onComplete: () => { ready = true; },
  });
}

// 원본 mouseMovement: 매 프레임 목표 각도로 0.5초 따라붙는 트윈을 새로 건다
function follow() {
  if (!ready || !hovering) return;
  const { rotationY, rotationZ } = followRotation(pointerX, window.innerWidth, params);
  gsap.to(cards, { rotationY, rotationZ, duration: params.followDuration, ease: FOLLOW.ease });
}

function onEnter() {
  hovering = true;
}

function onLeave() {
  hovering = false;
  if (!ready) return;
  gsap.to(cards, { ...restPose(params), duration: params.leaveDuration, ease: LEAVE.ease });
}

// 조절 패널
const gui = createPanel('07 마우스로 도는 카드 · 조절 패널');
const motionFolder = gui.addFolder('움직임');
motionFolder.add(params, 'rotationFactor', 0, 360, 5).name('회전 세기 (화면 끝 °)');
motionFolder.add(params, 'baseTilt', 0, 20, 0.5).name('기본 기울기 (°)').onChange(() => {
  if (!hovering) gsap.to(cards, { ...restPose(params), duration: 0.3 });
});
motionFolder.add(params, 'followDuration', 0.05, 2, 0.05).name('따라가는 시간 (초)');
motionFolder.add(params, 'leaveDuration', 0.2, 3, 0.1).name('복귀 시간 (초)');
const lookFolder = gui.addFolder('모양');
lookFolder.add(params, 'perspective', 300, 3000, 50).name('원근 (px)').onChange(applyLook);
lookFolder.add(params, 'reflectionOpacity', 0, 1, 0.05).name('반사 세기').onChange(applyLook);
lookFolder.add(params, 'reflectionBlur', 0, 20, 1).name('반사 흐림 (px)').onChange(applyLook);
gui.add({ replay: playIntro }, 'replay').name('등장 다시 보기');
addSettingsButtons(gui, {
  params,
  defaults: TUNE_DEFAULTS,
  onApply: () => {
    applyLook();
    if (!hovering) gsap.set(cards, restPose(params));
  },
});

applyLook();

if (reduced) {
  // 동작 줄이기: 등장·따라가기 없이 기운 카드 그대로 (원본도 이때는 마우스 동작을 안 켬)
  gsap.set(cards, restPose(params));
} else {
  playIntro();
  gsap.ticker.add(follow);

  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    // 마우스: 무대에 들어오면 따라가고, 나가면 복귀.
    // "← 아카이브" 링크와 조절 패널은 무대 밖 요소라, 그 위에 올라가면 무대 mouseleave가 나서 복귀한다 (원본: 메뉴 호버)
    stage.addEventListener('mouseenter', onEnter);
    stage.addEventListener('mouseleave', onLeave);
    stage.addEventListener('mousemove', (event) => {
      pointerX = event.clientX;
      hovering = true; // 처음부터 무대 위에 마우스가 있던 경우도 움직이면 바로 따라가게
    });
  } else {
    // 폰: 손가락을 좌우로 끌면 마우스처럼, 떼면 복귀 (원본 글엔 폰 동작 숫자가 없다)
    stage.addEventListener('pointerdown', (event) => {
      pointerX = event.clientX;
      hovering = true;
    });
    stage.addEventListener('pointermove', (event) => {
      if (hovering) pointerX = event.clientX;
    });
    for (const type of ['pointerup', 'pointercancel', 'pointerleave']) stage.addEventListener(type, onLeave);
  }
}
