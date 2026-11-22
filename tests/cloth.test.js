import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLOTH, NAIL, capPull, nailOffset, Cloth } from '../demos/09-cloth/cloth.js';

const finite = (array) => array.every((v) => Number.isFinite(v));
const maxOff = (cloth, x, y, z) => {
  let most = 0;
  for (let i = 0; i < cloth.count; i++) {
    most = Math.max(most,
      Math.abs(cloth.pos[i * 3] - (x + cloth.home[i * 2])),
      Math.abs(cloth.pos[i * 3 + 1] - (y + cloth.home[i * 2 + 1])),
      Math.abs(cloth.pos[i * 3 + 2] - z));
  }
  return most;
};

test('원본 숫자 (DomGL Cloth sim.ts): 입자 25 × 33, 6단계, 고정 1.5칸, 전단 5e−7 · 굽힘 2.5e−5, 힘 42 · 8 · 11 · 0.8, 제한 2200 · 16000', () => {
  assert.deepEqual(CLOTH, {
    nx: 25, ny: 33, steps: 6, crown: 1.5,
    shear: 5e-7, bend: 2.5e-5,
    starch: 42, hold: 8, reached: 110, beyond: 0.12,
    drag: 11, damp: 0.8,
    eddy: 0.09, gale: 1400,
    fastest: 5000, carry: 2200, jolt: 16000,
    rest: 0.25, proof: 12, settle: 0.14, snap: 0.02,
  });
});

test('천 한 장: 입자 825개, 실 4662개(가로·세로 1592 + 대각선 1536 + 두 칸 1534), 가운데 9개 고정', () => {
  const cloth = new Cloth(576, 768);
  assert.equal(cloth.count, 825);
  assert.equal(cloth.linkCount, 1592 + 1536 + 1534);
  assert.equal(cloth.pinnedCount, 9);
});

test('평평한 자리: 고정점 기준, x 오른쪽 · y 위, 첫 입자가 왼쪽 위 (PlaneGeometry 정점 순서와 같음)', () => {
  const cloth = new Cloth(576, 768);
  assert.deepEqual([cloth.home[0], cloth.home[1]], [-288, 384]);
  const last = cloth.count - 1;
  assert.deepEqual([cloth.home[last * 2], cloth.home[last * 2 + 1]], [288, -384]);
  cloth.place(10, 20, 30);
  assert.deepEqual([cloth.pos[0], cloth.pos[1], cloth.pos[2]], [-278, 404, 30]);
  assert.equal(cloth.awake, false);
});

test('끌기 제한: 고정점 속도는 초당 2200px, 속도 변화는 초당 16000px까지만', () => {
  const frame = 1 / 60;
  const [x] = capPull(5000, 0, 0, [0, 0, 0], frame);
  assert.ok(Math.abs(x - 16000 * frame) < 1e-9);
  assert.deepEqual(capPull(3000, 0, 0, [2200, 0, 0], frame), [2200, 0, 0]);
  assert.deepEqual(capPull(100, 0, 0, [90, 0, 0], frame), [100, 0, 0]);
});

test('얼굴 방향(z)으로 끌면 고정점은 그대로 따라가고 가장자리는 공기에 밀려 뒤처진다', () => {
  const cloth = new Cloth(576, 768);
  cloth.place(0, 0, 0);
  let z = 0;
  for (let f = 0; f < 30; f++) {
    z += 10;
    cloth.step(1 / 60, 0, 0, z, f / 60);
  }
  assert.ok(finite(cloth.pos));
  const center = 16 * 25 + 12;
  assert.ok(Math.abs(cloth.pos[center * 3 + 2] - z) < 1e-3);
  assert.ok(z - cloth.pos[2] > 5, `왼쪽 위 모서리가 덜 따라옴: ${cloth.pos[2]} vs ${z}`);
});

test('멈추면 다시 평평해지고 계산을 쉰다', () => {
  const cloth = new Cloth(576, 768);
  cloth.place(0, 0, 0);
  for (let f = 0; f < 20; f++) cloth.step(1 / 60, f * 15, 0, f * 8, f / 60);
  const x = 19 * 15;
  const z = 19 * 8;
  let frames = 0;
  while (cloth.awake && frames < 2400) {
    cloth.step(1 / 60, x, 0, z, frames / 60);
    frames++;
  }
  assert.equal(cloth.awake, false, `${frames}프레임 뒤에도 깨어 있음`);
  assert.ok(maxOff(cloth, x, 0, z) < 0.05);
  assert.equal(cloth.step(1 / 60, x, 0, z, 0), false); // 쉬는 천은 안 움직이면 계산 안 함
});

test('한 프레임에 아주 멀리 순간이동해도(띠 끝에서 반대편으로) 터지지 않고 천이 통째로 옮겨진다', () => {
  const cloth = new Cloth(576, 768);
  cloth.place(0, 0, 0);
  cloth.step(1 / 60, 6000, 0, -3000, 0);
  assert.ok(finite(cloth.pos));
  assert.ok(maxOff(cloth, 6000, 0, -3000) < 200);
});

test('잡는 점 (원본 nail): 카드마다 가운데에서 폭·높이의 8~16% 떨어진 곳, 방향은 카드마다 황금각(2.39996rad)씩 돈다', () => {
  assert.deepEqual(NAIL, { least: 0.08, most: 0.16, turn: 2.39996 });
  for (let key = 0; key < 10; key++) {
    const [u, v] = nailOffset(key, 360, 480);
    const far = Math.hypot(u / 360, v / 480);
    assert.ok(far >= 0.08 - 1e-9 && far <= 0.16 + 1e-9, `${key}: ${far}`);
    const angle = Math.atan2(-v / 480, u / 360); // y 위 좌표라 원본(y 아래) 각도로 되돌려 비교
    const expected = Math.atan2(Math.sin(key * 2.39996), Math.cos(key * 2.39996));
    assert.ok(Math.abs(angle - expected) < 1e-6, `${key}: ${angle} vs ${expected}`);
  }
});

test('잡는 점을 옮기면: 그 점 둘레 1.5칸만 고정되고, 평평한 자리는 그 점 기준이 된다', () => {
  const cloth = new Cloth(360, 480, CLOTH, [40, -30]);
  for (let i = 0; i < cloth.count; i++) {
    const col = i % 25;
    const row = Math.floor(i / 25);
    const fx = (col - 12) * 15 - 40;  // 칸 15px × 15px (360/24, 480/32)
    const fy = (16 - row) * 15 + 30;
    assert.ok(Math.abs(cloth.home[i * 2] - fx) < 1e-3 && Math.abs(cloth.home[i * 2 + 1] - fy) < 1e-3);
    const ring = Math.hypot(fx / 15, fy / 15);
    assert.equal(cloth.inv[i], ring <= 1.5 ? 0 : 1);
  }
});

test('두 프레임 시간 차가 0이어도(같은 시각에 두 번 불림) 계산을 건너뛰고 망가지지 않는다', () => {
  const cloth = new Cloth(360, 480);
  cloth.place(0, 0, 0);
  assert.equal(cloth.step(0, 0, 0, 0, 0), false);
  assert.equal(cloth.step(0, 50, 0, 20, 0), false);
  cloth.step(1 / 60, 60, 0, 30, 0.016);
  assert.ok(finite(cloth.pos) && finite(cloth.normal));
});


// 왼쪽 위 모서리 삼각형(i + j < 6)을 대각선 i + j = 6에 비춰 접어서 위(+z 2px)에 올린다
function foldCorner(cloth) {
  const dx = cloth.width / 24;
  const dy = cloth.height / 32;
  for (let j = 0; j < 33; j++) {
    for (let i = 0; i < 25; i++) {
      if (i + j >= 6) continue;
      const k = (j * 25 + i) * 3;
      const mi = 6 - j;
      const mj = 6 - i;
      cloth.pos[k] = cloth.x + (mi - 12) * dx;
      cloth.pos[k + 1] = cloth.y + (16 - mj) * dy;
      cloth.pos[k + 2] = cloth.z + 2;
    }
  }
}

test('모서리가 접힌 채 멈춰도 평평한 자리로 당기는 힘으로 10초 안에 펴지고 쉰다 (원본의 접힘 펴기·다림질 없이도)', () => {
  const cloth = new Cloth(360, 480);
  cloth.place(0, 0, 0);
  cloth.step(1 / 60, 1, 0, 1, 0); // 깨우기
  foldCorner(cloth);
  let frames = 0;
  while (cloth.awake && frames < 600) {
    cloth.step(1 / 60, 1, 0, 1, frames / 60);
    frames++;
  }
  assert.equal(cloth.awake, false, `${frames}프레임 뒤에도 깨어 있음`);
  assert.ok(maxOff(cloth, 1, 0, 1) < 0.05);
  assert.ok(finite(cloth.pos));
});
