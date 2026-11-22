// ─────────────────────────────────────────────────────────────
// stage.js — 3D 무대 기본 세팅 (모든 데모 공통)
//   렌더러: 화면에 그리는 장치
//   카메라: 화각 38°의 좁은 "망원" 카메라 → 왜곡이 적어 고급스럽다
//   조명 환경: 스튜디오 방(RoomEnvironment)을 비춰서 코팅·박에 진짜 같은 반사가 생긴다
//   후처리(composer): 그린 화면에 잔상·빛 번짐 같은 효과를 덧입히는 단계
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// tokens.css의 CSS 변수 값을 JS에서 읽는다. (색을 JS에 직접 적지 않기 위해)
export function readToken(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// rgba(…) 토큰을 3D에서 쓸 수 있게 색과 투명도로 나눠 읽는다. (예: --border → 흰색 + 0.12)
export function readTokenRGBA(name) {
  const value = readToken(name);
  const match = value.match(/rgba?\(([^)]+)\)/);
  if (!match) return { color: new THREE.Color(value), alpha: 1 };
  const [r, g, b, a = '1'] = match[1].split(',').map((part) => part.trim());
  return { color: new THREE.Color(`rgb(${r}, ${g}, ${b})`), alpha: parseFloat(a) };
}

export function createStage({ canvas, fov = 38 }) {
  // WebGL을 못 쓰는 환경이면 여기서 에러가 난다 → 데모 쪽에서 안내 문구로 대체
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });

  // 화면 선명도 상한: 데스크톱 2배, 터치 기기 1.5배 (너무 높으면 폰이 버벅인다)
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarse ? 1.5 : 2));
  // 톤 매핑은 끈다. 켜면 아주 어두운 배경색(--bg-1)이 새까맣게 눌려서
  // 3D 장면 배경과 페이지 배경 색이 달라진다. (실측: Neutral 0,0,1 / 끔 11,11,12)
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();
  // 배경색은 clearColor가 아니라 scene.background로 넣어야 후처리를 거쳐도 색이 정확하다.
  // (clearColor로 넣으면 밝기 변환이 두 번 걸려서 11 → 59로 밝아지는 걸 실측으로 확인)
  scene.background = new THREE.Color(readToken('--bg-1'));
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 200);

  // 스튜디오 조명 환경 → 코팅(clearcoat)과 금속 박이 반사할 "주변 풍경"
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  // 톤 매핑을 껐으니 빛이 세면 흰 종이가 새하얗게 날아간다.
  // 실측으로 정면 카드가 종이색(244,241,234) 근처 + 광택 여유가 남는 값을 골랐다 (정면 235,229,224)
  scene.environmentIntensity = 0.4;

  // 하이라이트를 또렷하게 해주는 주 조명 하나 (오른쪽 위 앞에서 비춘다)
  const keyLight = new THREE.DirectionalLight(0xffffff, 0.6);
  keyLight.position.set(3, 4, 6);
  scene.add(keyLight);

  // 후처리 체인: [장면 그리기] → (데모별 효과) → [색 출력]
  // samples: 4 → 후처리를 거쳐도 카드 가장자리가 계단지지 않게 (안티앨리어싱)
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new OutputPass());

  function resize() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    // 화면에 아직 안 보이는 순간(크기 0)에 맞추면 그림판 크기가 0이 돼서 에러가 난다 → 건너뛴다
    if (width === 0 || height === 0) return;
    renderer.setSize(width, height, false);
    composer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  return {
    renderer,
    scene,
    camera,
    composer,
    keyLight,
    // 효과는 항상 마지막 [색 출력] 바로 앞에 끼워 넣는다
    addEffect(pass) {
      composer.insertPass(pass, composer.passes.length - 1);
    },
    resize,
    render() {
      composer.render();
    },
  };
}

// WebGL을 못 쓸 때 캔버스 자리에 안내 문구를 띄운다
export function showWebGLFallback(canvas) {
  const message = document.createElement('p');
  message.className = 'fallback';
  message.textContent = '이 브라우저에선 3D를 볼 수 없어요. 최신 크롬이나 사파리에서 열어줘!';
  canvas.style.display = 'none';
  canvas.parentElement.appendChild(message);
}
