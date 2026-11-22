// ─────────────────────────────────────────────────────────────
// stars.js — 05 우주 표류 배경 별먼지
// 점(Points) 수천 개를 한 번에 그리고, 셰이더에서 별마다 다른 박자로 깜빡이게 한다.
// 색은 공통 토큰(--fg-1)을 받아 쓴다. 더하기 섞기라 겹치면 더 밝아진다.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

const vertexShader = /* glsl */ `
attribute float aSize;
attribute float aPhase;
attribute float aSpeed;
uniform float uTime;
uniform float uTwinkle;
uniform float uPixelRatio;
uniform vec3 uDrift;      // 초당 떠다니는 양 (0이면 제자리)
uniform vec3 uBoxCenter;  // 떠다니는 상자 가운데
uniform vec3 uBoxHalf;    // 떠다니는 상자 반폭 (x가 0이면 떠다니지 않음)
varying float vBrightness;

void main() {
  vec3 p = position;
  if (uBoxHalf.x > 0.0) {
    // 상자 안에서 천천히 떠다니다 넘어가면 반대편에서 다시 나온다 (끝없이)
    p = mod(p + uDrift * uTime - uBoxCenter + uBoxHalf, 2.0 * uBoxHalf) - uBoxHalf + uBoxCenter;
  }
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = aSize * uPixelRatio;                     // 화면 픽셀 크기: 별은 거리와 상관없이 작은 점
  float wave = 0.5 + 0.5 * sin(uTime * aSpeed + aPhase);  // 별마다 다른 박자
  vBrightness = 1.0 - uTwinkle * wave;
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vBrightness;

void main() {
  // 동그랗고 가장자리가 부드러운 점
  float glow = 1.0 - smoothstep(0.0, 0.5, length(gl_PointCoord - 0.5));
  if (glow <= 0.0) discard;
  gl_FragColor = vec4(uColor * vBrightness * uOpacity, glow);
}
`;

// layer: STAR_LAYERS의 한 겹 (떠다니는 양·상자). 없으면 제자리
export function createStarDust({ stars, color, pixelRatio, opacity = 0.85, layer = null }) {
  const count = stars.length;
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  const speeds = new Float32Array(count);
  stars.forEach((star, i) => {
    positions.set([star.x, star.y, star.z], i * 3);
    sizes[i] = star.size;
    phases[i] = star.phase;
    speeds[i] = star.speed;
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uTwinkle: { value: 0.6 },
      uPixelRatio: { value: pixelRatio },
      uColor: { value: color },
      uOpacity: { value: opacity },
      uDrift: { value: new THREE.Vector3(...(layer ? layer.drift : [0, 0, 0])) },
      uBoxCenter: { value: new THREE.Vector3(0, 0, layer ? -(layer.zNear + layer.zFar) / 2 : 0) },
      uBoxHalf: {
        value: layer && Math.hypot(...layer.drift) > 0
          ? new THREE.Vector3(layer.halfX, layer.halfY, (layer.zFar - layer.zNear) / 2)
          : new THREE.Vector3(0, 0, 0),
      },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,                 // 별끼리·카드 뒤에서 깊이를 안 남긴다
    blending: THREE.AdditiveBlending,  // 겹치면 더 밝게 (빛은 더해진다)
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return {
    points,
    setTime(time) { material.uniforms.uTime.value = time; },
    setTwinkle(value) { material.uniforms.uTwinkle.value = value; },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
