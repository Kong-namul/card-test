// ─────────────────────────────────────────────────────────────
// butterflies.js — 03 터널 가운데 크리스탈 나비 선택지 (숫자만, Three.js 없이)
// 두 모델 모두 Poly Pizza · CC-BY (무료, 출처 표기 필수) → 기법 노트 "참고한 곳"에 출처를 적는다.
//
// 모델이 날개를 따로 떼어둔 부품이 아니라서, 날갯짓은 셰이더로 한다:
//   spanAxis  : 날개가 펼쳐진 방향 (몸통에서 이 방향으로 멀수록 날개)
//   hingeAxis : 몸통 중심선 = 날개가 접히는 경첩 축
//   pivot     : 원래 모델 좌표에서 경첩이 지나는 점 (모델을 열어서 몸통 위치를 재서 정함)
//   bodyHalf  : 몸통 반폭 (날개 길이 대비 비율). 이 안쪽은 안 움직이고 바깥으로 갈수록 접힌다
//   baseYaw   : 날개가 화면 가로로 펼쳐 보이게 처음에 돌려두는 각도
//   baseTilt  : 날개가 바닥에 누운 모델은 등이 카메라를 보도록 세우는 각도 (부호가 틀리면 뒤집혀 보임)
//   viewYaw   : 출발 방향(도). 여기서 시작해서 튜브를 따라 계속 돈다. 패널 "방향 조절"은 여기에 더해진다
// ─────────────────────────────────────────────────────────────
export const BUTTERFLIES = {
  none: { label: '없음' },
  monarch: {
    label: '은 모나크 (1번)',
    file: 'models/monarch-butterfly.glb',
    title: 'Monarch Butterfly',
    author: 'Paul Spooner',
    source: 'https://poly.pizza/m/eeO11BVjvsO',
    spanAxis: [0, 0, 1],
    hingeAxis: [1, 0, 0],
    pivot: [0.5, -0.6, 0],
    bodyHalf: 0.04,
    baseYaw: Math.PI / 2,
    baseTilt: 0,          // 날개가 V자로 서 있는 모델이라 그대로
    viewYaw: 135,         // 0°=엉덩이, 90°=왼쪽 옆, 180°=정면 (화면에서 재서 확인) → 정면에서 45° 비스듬히 출발
  },
  faceted: {
    label: '각진 크리스탈 (3번)',
    file: 'models/faceted-butterfly.glb',
    title: 'Butterfly',
    author: 'Poly by Google',
    source: 'https://poly.pizza/m/2ZwYwkTVnfG',
    spanAxis: [1, 0, 0],
    hingeAxis: [0, 0, 1],
    pivot: [-0.016, 0.05, -0.045],
    bodyHalf: 0.05,
    baseYaw: 0,
    // 날개가 바닥에 누운 모델을 세운다. 69°는 벽처럼 딱 서 보였고, +면 배가 보여 뒤집힘.
    // −43°에 사용자가 패널로 +8° 더 눕힌 값 → 약 −35°
    baseTilt: -0.6104,
    viewYaw: 132,         // 0°=정면(징그러움). 45°에 사용자가 패널로 +87° 돌린 값
  },
};

// 나비 재질: Codrops 터널 장면(FiberScene) 헬멧과 같은 유리.
// 처음엔 같은 저장소의 다른 장면(공) 헬멧 숫자(금속 1)를 잘못 가져와서 쇠덩이 크롬이 됐었다.
//   transmission 1 : 빛이 완전히 통과 → 뒤의 카드·격자가 비쳐 보임
//   thickness 10   : 유리 두께. 두꺼울수록 뒤 풍경이 크게 휘어 보임 (모델 크기에 곱해짐)
//   ior 1.9        : 굴절률 (물 1.33, 유리 1.5, 다이아몬드 2.4). 높을수록 많이 꺾임
//   dispersion 1   : 빛이 색깔별로 다르게 꺾여서 가장자리에 빨강·초록·파랑 무지개 번짐
//   metalness 0.1  : 거의 금속이 아님 (1이면 거울 같은 쇠)
export const CRYSTAL_GLASS = {
  transmission: 1,
  thickness: 10,
  roughness: 0,
  metalness: 0.1,
  ior: 1.9,
  dispersion: 1,
  clearcoat: 0.1,
  clearcoatRoughness: 1, // 레퍼는 1.1인데 Three.js가 1까지만 받아서 1
};

// 나비가 비추는 조명 (Codrops는 drei "studio" 사진 조명: 거의 까맣고 하얀 조명 띠 몇 개).
// 사방이 밝은 회색 방(RoomEnvironment)을 쓰면 유리가 우윳빛이 돼서, 검은 공간에 얇은 빛 판만 띄운다.
//   position: 나비(원점) 기준 위치, size: 판 크기 [가로, 세로, 깊이], intensity: 밝기 (1보다 크면 더 쨍함)
export const STUDIO = {
  background: 0x000000,
  lights: [
    { position: [0, 5, 0], size: [10, 0.2, 2], intensity: 6 },      // 천장 긴 띠
    { position: [-5, 0.5, 1], size: [0.2, 6, 1.2], intensity: 4 },  // 왼쪽 세로 띠
    { position: [5, 0.5, -1], size: [0.2, 6, 1.2], intensity: 4 },  // 오른쪽 세로 띠
    { position: [1.5, 1, 6], size: [3, 1.2, 0.2], intensity: 2 },   // 카메라 쪽 소프트박스 (앞면에 하얀 줄)
  ],
};

// 패널 드롭다운용: { 보이는 이름: 키 }
export const BUTTERFLY_OPTIONS = Object.fromEntries(
  Object.entries(BUTTERFLIES).map(([key, b]) => [b.label, key]),
);

// 날갯짓 각도: 사인파로 ±amount 라디안을 오르내린다
export function flapAngle(time, speed, amount) {
  return amount * Math.sin(time * speed);
}
