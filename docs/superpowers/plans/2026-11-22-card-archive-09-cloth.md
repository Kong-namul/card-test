# 09 천 포스터 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Codrops DomGL Cloth(Jesper Landberg)의 "천 포스터 캐러셀"을 Three.js(WebGL) + CPU 천 계산으로 다시 만든 아카이브 데모 09.

**Architecture:** 카드 10장이 대각선 띠를 따라 끝없이 돌고, 카드마다 입자 25 × 33 천(XPBD)이 가운데 고정점에 끌려 다닌다. 천 계산(`cloth.js`)과 배치·스크롤 수학(`strip.js`)은 순수 함수로 테스트하고, `main.js`가 공통 3D 무대·카드 재질로 그린다. 공통 카드 재질에 "카드 좌표를 uv에서 읽기" 옵션을 더해 구겨져도 둥근 모서리가 맞게 한다.

**Tech Stack:** Three.js 0.187.0(importmap), 공통 `shared/stage.js` · `card-material.js` · `panel.js` · `motion.js`, node --test.

spec: `docs/superpowers/specs/2026-11-22-card-archive-threejs-2-design.md` 3장

## Global Constraints

- 반말 문구, 제목 흰색 단색, 글자 크기 토큰 스케일만, 색은 tokens.css만(새 색 없음).
- 공통 JS를 고치면 부르는 곳의 `?v=`를 모두 올린다. `three@0.187.0` 고정.
- 원본(라이선스 없음) 코드는 복사하지 않는다. 숫자·원리만.
- 커밋은 사용자가 요청할 때만. 시작 시점 테스트 123개 통과.

## File Structure

| 파일 | 할 일 |
|---|---|
| `demos/09-cloth/cloth.js` (새) | 천 한 장 계산 (원본 sim.ts 핵심) |
| `tests/cloth.test.js` (새) | 원본 숫자·천 동작 테스트 |
| `demos/09-cloth/strip.js` (새) | 띠 배치(rig)·원근·카드 크기·스크롤 수학 |
| `tests/cloth-strip.test.js` (새) | 배치 수학 테스트 |
| `shared/card-material.js` (수정) | `cardPosFromUv` 옵션 → v7, `texture-panel.js` v5, 01~05 import 올림 |
| `demos/09-cloth/main.js`, `index.html` (새) | 페이지 |
| `index.html` (수정) | 아카이브 목록 09 |

---

### Task 1: 천 계산 (`cloth.js`)

**Interfaces — Produces:** `CLOTH`(상수), `capPull(wx, wy, wz, felt, frame, tune) → [x, y, z]`, `class Cloth(width, height, tune)` — `.pos/.normal`(Float32Array, 정점 순서 = PlaneGeometry), `.count`, `.pinnedCount`, `.awake`, `.place(x, y, z)`, `.step(dt, x, y, z, time) → boolean`(바뀌었으면 true)

- [ ] **Step 1: 실패하는 테스트**

```js
// FILE: tests/cloth.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLOTH, capPull, Cloth } from '../demos/09-cloth/cloth.js';

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
```

- [ ] **Step 2: 실패 확인** — Run: `node --test tests/cloth.test.js` → FAIL (`Cannot find module .../cloth.js`)

- [ ] **Step 3: 구현**

```js
// FILE: demos/09-cloth/cloth.js
// ─────────────────────────────────────────────────────────────
// cloth.js — 09 천 포스터: 천 한 장 계산 (순수, CPU)
// 원본(DomGL Cloth, Jesper Landberg — app/cloth/sim.ts)의 핵심을 숫자 그대로 옮겼다. 단위 px · 초. 코드는 가져오지 않았다.
//   입자 25 × 33을 거리 제약 3종(가로·세로 / 대각선 / 두 칸 건너)으로 엮고 XPBD로 프레임당 6단계 푼다.
//   가운데 1.5칸 안 입자(9개)는 고정점을 그대로 따라간다. 중력은 없다.
//   단계마다 속도에 더하는 힘: 평평한 자리로 당김 · 고정점 속도 따라가기 · 면 방향 공기 저항 · 감쇠 (+ 바람 결)
// 좌표: 카드 자기 좌표 (카드 면 = z 0, x 오른쪽, y 위). 입력은 이 좌표에서 고정점이 어디로 갔는지 하나.
// 뺀 것: 접힘 펴기, 마우스로 쓸기, 상세 시트 충돌, 다림질 (1차 범위 밖)
// ─────────────────────────────────────────────────────────────

export const CLOTH = {
  nx: 25, ny: 33,        // 입자 수 (가로 × 세로)
  steps: 6,              // 프레임(1/60초)당 나눠 푸는 단계
  crown: 1.5,            // 고정점에서 이 칸 수 안 입자는 고정
  shear: 5e-7,           // 대각선 실의 무름 (XPBD compliance, 가로·세로 실은 0 = 안 늘어남)
  bend: 2.5e-5,          // 두 칸 건너 실의 무름 → 클수록 잘 휜다
  starch: 42,            // 평평한 자리로 당기는 세기
  hold: 8,               // 고정점 속도를 따라가는 세기
  reached: 110,          // 평평한 자리에서 이만큼(px) 넘게 멀어지면
  beyond: 0.12,          //   넘는 부분은 이 배율로만 당긴다
  drag: 11,              // 면 방향 공기 저항
  damp: 0.8,             // 감쇠
  eddy: 0.09,            // 바람 결 세기 (고정점 속도에 곱함)
  gale: 1400,            // 바람 결에 쓰는 고정점 속도 상한
  fastest: 5000,         // 입자 속도 상한 (고정점 기준, px/초)
  carry: 2200,           // 천이 느끼는 끌기 속도 상한 (px/초) — 넘는 만큼은 통째로 옮긴다
  jolt: 16000,           // 끌기 속도 변화 상한 (px/초²)
  rest: 0.25,            // 한 프레임에 이만큼(px) 덜 움직이면 "고요"
  proof: 12,             // 고요가 이만큼 이어지면 평평하게 맞추고 쉰다
  settle: 0.14,          // 쉬러 갈 때 한 프레임에 평평한 자리로 붙는 비율
  snap: 0.02,            // 이만큼(px) 안이면 딱 맞추고 계산 멈춤
};

// CARRY · JOLT: 고정점 속도(w)와 그 변화(felt = 지난 프레임에 천이 느낀 속도)를 제한한다
export function capPull(wx, wy, wz, felt, frame, tune = CLOTH) {
  let x = wx;
  let y = wy;
  let z = wz;
  const fast = Math.hypot(x, y, z);
  if (fast > tune.carry) {
    const k = tune.carry / fast;
    x *= k; y *= k; z *= k;
  }
  const jx = x - felt[0];
  const jy = y - felt[1];
  const jz = z - felt[2];
  const jolt = Math.hypot(jx, jy, jz);
  const most = tune.jolt * frame;
  if (jolt > most) {
    const k = most / jolt;
    x = felt[0] + jx * k;
    y = felt[1] + jy * k;
    z = felt[2] + jz * k;
  }
  return [x, y, z];
}

export class Cloth {
  constructor(width, height, tune = CLOTH) {
    this.tune = tune; // 패널이 이 객체 값을 바꾸면 바로 반영된다
    const { nx, ny } = tune;
    this.nx = nx;
    this.ny = ny;
    this.count = nx * ny;
    this.width = width;
    this.height = height;

    const n = this.count;
    this.pos = new Float32Array(n * 3);
    this.prev = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.was = new Float32Array(n * 3);
    this.normal = new Float32Array(n * 3);
    this.home = new Float32Array(n * 2);  // 평평할 때 자리 (고정점 기준)
    this.inv = new Float32Array(n);       // 0 = 고정, 1 = 자유
    this.tether = new Float32Array(n);    // 고정점까지 원래 거리²
    this.gust = new Float32Array(n);
    this.felt = [0, 0, 0];

    const dx = width / (nx - 1);
    const dy = height / (ny - 1);
    const midI = (nx - 1) / 2;
    const midJ = (ny - 1) / 2;
    const ring = (i, j) => Math.hypot(i - midI, j - midJ);

    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        const hx = (i - midI) * dx;
        const hy = (midJ - j) * dy; // j = 0이 맨 위
        this.home[k * 2] = hx;
        this.home[k * 2 + 1] = hy;
        this.tether[k] = hx * hx + hy * hy;
        this.inv[k] = ring(i, j) <= tune.crown ? 0 : 1;
      }
    }
    this.pinnedCount = this.inv.reduce((sum, w) => sum + (w === 0 ? 1 : 0), 0);

    // 실: 종류 0 = 가로·세로, 1 = 대각선, 2 = 두 칸 건너. 고정점에서 가까운 것부터 풀도록 정렬
    const links = [];
    const link = (i0, j0, i1, j1, kind) => {
      if (i1 < 0 || i1 >= nx || j1 >= ny) return;
      links.push({
        a: j0 * nx + i0,
        b: j1 * nx + i1,
        rest: Math.hypot((i1 - i0) * dx, (j1 - j0) * dy),
        kind,
        near: Math.min(ring(i0, j0), ring(i1, j1)),
      });
    };
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        link(i, j, i + 1, j, 0);
        link(i, j, i, j + 1, 0);
        link(i, j, i + 1, j + 1, 1);
        link(i, j, i - 1, j + 1, 1);
        link(i, j, i + 2, j, 2);
        link(i, j, i, j + 2, 2);
      }
    }
    links.sort((p, q) => p.near - q.near);
    this.linkCount = links.length;
    this.a = Uint16Array.from(links, (l) => l.a);
    this.b = Uint16Array.from(links, (l) => l.b);
    this.rest = Float32Array.from(links, (l) => l.rest);
    this.kind = Uint8Array.from(links, (l) => l.kind);

    this.place(0, 0, 0);
  }

  // 고정점 (x, y, z)에 평평하게 놓고 쉰다
  place(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    for (let i = 0; i < this.count; i++) {
      this.pos[i * 3] = x + this.home[i * 2];
      this.pos[i * 3 + 1] = y + this.home[i * 2 + 1];
      this.pos[i * 3 + 2] = z;
      this.normal[i * 3] = 0;
      this.normal[i * 3 + 1] = 0;
      this.normal[i * 3 + 2] = 1;
    }
    this.prev.set(this.pos);
    this.vel.fill(0);
    this.felt = [0, 0, 0];
    this.awake = false;
    this.calm = 0;
  }

  // 한 프레임: 고정점이 (x, y, z)로 갔다. 계산했으면 true
  step(dt, x, y, z, time) {
    const t = this.tune;
    const moved = Math.abs(x - this.x) + Math.abs(y - this.y) + Math.abs(z - this.z);
    const still = moved < 0.01;
    if (!this.awake && still) return false;
    this.awake = true;
    if (this.calm > t.proof && still) return this.settleDown();

    const { count, pos, prev, vel, normal, home, inv, tether, gust, a, b, rest, kind } = this;
    const frame = Math.min(dt, 1 / 30);
    const steps = Math.max(2, Math.min(t.steps * 2, Math.round(frame * 60 * t.steps)));
    const h = frame / steps;
    const hh = h * h;
    const soft = [0, t.shear / hh, t.bend / hh];

    let fromX = this.x;
    let fromY = this.y;
    let fromZ = this.z;
    const [wx, wy, wz] = capPull((x - fromX) / frame, (y - fromY) / frame, (z - fromZ) / frame, this.felt, frame, t);
    this.felt = [wx, wy, wz];

    // 제한을 넘은 만큼은 천 전체를 통째로 옮긴다 (아주 빠른 드래그·띠 끝 순간이동)
    const cx = x - fromX - wx * frame;
    const cy = y - fromY - wy * frame;
    const cz = z - fromZ - wz * frame;
    if (cx || cy || cz) {
      for (let i = 0; i < count; i++) {
        pos[i * 3] += cx;
        pos[i * 3 + 1] += cy;
        pos[i * 3 + 2] += cz;
      }
      fromX += cx;
      fromY += cy;
      fromZ += cz;
    }
    this.was.set(pos);

    const px = (x - fromX) / frame; // 이번 프레임 고정점 속도
    const py = (y - fromY) / frame;
    const pz = (z - fromZ) / frame;
    const eddy = Math.min(Math.hypot(px, py, pz), t.gale) * t.eddy;

    this.computeNormals();
    for (let i = 0; i < count; i++) {
      const k = i * 3;
      gust[i] = eddy * (Math.sin(pos[k] * 0.011 + time * 2.3) + Math.sin(pos[k + 1] * 0.016 - time * 1.7 + pos[k] * 0.004));
    }

    const top = t.fastest * t.fastest;
    for (let s = 1; s <= steps; s++) {
      const f = s / steps;
      const ox = fromX + (x - fromX) * f;
      const oy = fromY + (y - fromY) * f;
      const oz = fromZ + (z - fromZ) * f;

      // 1) 힘 → 속도 → 위치
      for (let i = 0; i < count; i++) {
        const k = i * 3;
        prev[k] = pos[k];
        prev[k + 1] = pos[k + 1];
        prev[k + 2] = pos[k + 2];
        const hx = ox + home[i * 2];
        const hy = oy + home[i * 2 + 1];
        if (!inv[i]) {
          pos[k] = hx;
          pos[k + 1] = hy;
          pos[k + 2] = oz;
          continue;
        }
        let vx = vel[k];
        let vy = vel[k + 1];
        let vz = vel[k + 2];
        const nX = normal[k];
        const nY = normal[k + 1];
        const nZ = normal[k + 2];
        const into = vx * nX + vy * nY + (vz - gust[i]) * nZ;
        const farX = pos[k] - hx;
        const farY = pos[k + 1] - hy;
        const farZ = pos[k + 2] - oz;
        const off = Math.sqrt(farX * farX + farY * farY + farZ * farZ);
        const pull = t.starch * (off > t.reached ? (t.reached + (off - t.reached) * t.beyond) / off : 1);
        vx += (-pull * farX - t.hold * (vx - px) - t.drag * into * nX - t.damp * vx) * h;
        vy += (-pull * farY - t.hold * (vy - py) - t.drag * into * nY - t.damp * vy) * h;
        vz += (-pull * farZ - t.hold * (vz - pz) - t.drag * into * nZ - t.damp * vz) * h;
        pos[k] += vx * h;
        pos[k + 1] += vy * h;
        pos[k + 2] += vz * h;
      }

      // 2) 실 (XPBD 거리 제약)
      for (let c = 0; c < a.length; c++) {
        const i0 = a[c];
        const i1 = b[c];
        const w0 = inv[i0];
        const w1 = inv[i1];
        const w = w0 + w1;
        if (!w) continue;
        const k0 = i0 * 3;
        const k1 = i1 * 3;
        const ex = pos[k1] - pos[k0];
        const ey = pos[k1 + 1] - pos[k0 + 1];
        const ez = pos[k1 + 2] - pos[k0 + 2];
        const len = Math.sqrt(ex * ex + ey * ey + ez * ez);
        if (len < 1e-6) continue;
        const push = (len - rest[c]) / (w + soft[kind[c]]) / len;
        pos[k0] += ex * push * w0;
        pos[k0 + 1] += ey * push * w0;
        pos[k0 + 2] += ez * push * w0;
        pos[k1] -= ex * push * w1;
        pos[k1 + 1] -= ey * push * w1;
        pos[k1 + 2] -= ez * push * w1;
      }

      // 3) 끈(고정점에서 원래 거리 넘지 않기) + 속도 갱신·상한
      for (let i = 0; i < count; i++) {
        if (!inv[i]) continue;
        const k = i * 3;
        const tx = pos[k] - ox;
        const ty = pos[k + 1] - oy;
        const tz = pos[k + 2] - oz;
        const out = tx * tx + ty * ty + tz * tz;
        if (out > tether[i]) {
          const back = Math.sqrt(tether[i] / out);
          pos[k] = ox + tx * back;
          pos[k + 1] = oy + ty * back;
          pos[k + 2] = oz + tz * back;
        }
        let vx = (pos[k] - prev[k]) / h;
        let vy = (pos[k + 1] - prev[k + 1]) / h;
        let vz = (pos[k + 2] - prev[k + 2]) / h;
        const fast = (vx - px) ** 2 + (vy - py) ** 2 + (vz - pz) ** 2;
        if (fast > top) {
          const keep = Math.sqrt(top / fast);
          vx = px + (vx - px) * keep;
          vy = py + (vy - py) * keep;
          vz = pz + (vz - pz) * keep;
        }
        vel[k] = vx;
        vel[k + 1] = vy;
        vel[k + 2] = vz;
      }
    }

    this.x = x;
    this.y = y;
    this.z = z;
    this.computeNormals();

    let drift = 0;
    const shift = [x - fromX, y - fromY, z - fromZ];
    for (let k = 0; k < count * 3; k++) {
      const d = Math.abs(pos[k] - this.was[k] - shift[k % 3]);
      if (d > drift) drift = d;
    }
    this.calm = drift < t.rest && still && this.isLevel() ? this.calm + 1 : 0;
    return true;
  }

  // 고요가 이어지면: 평평한 자리로 조금씩 붙이다가 거의 맞으면 딱 맞추고 쉰다
  settleDown() {
    const t = this.tune;
    let most = 0;
    for (let i = 0; i < this.count; i++) {
      const k = i * 3;
      const tx = this.x + this.home[i * 2];
      const ty = this.y + this.home[i * 2 + 1];
      this.pos[k] += (tx - this.pos[k]) * t.settle;
      this.pos[k + 1] += (ty - this.pos[k + 1]) * t.settle;
      this.pos[k + 2] += (this.z - this.pos[k + 2]) * t.settle;
      most = Math.max(most, Math.abs(tx - this.pos[k]), Math.abs(ty - this.pos[k + 1]), Math.abs(this.z - this.pos[k + 2]));
    }
    this.vel.fill(0);
    this.prev.set(this.pos);
    if (most < t.snap) this.place(this.x, this.y, this.z);
    else this.computeNormals();
    return true;
  }

  isLevel() {
    for (let i = 0; i < this.count; i++) {
      if (Math.abs(this.pos[i * 3 + 2] - this.z) > 0.5) return false;
    }
    return true;
  }

  // 이웃 입자로 면 방향(법선)을 구한다. 오른쪽 이웃 − 왼쪽 이웃 × 위 이웃 − 아래 이웃 → 앞(+z)
  computeNormals() {
    const { nx, ny, pos, normal } = this;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const l = (j * nx + Math.max(0, i - 1)) * 3;
        const r = (j * nx + Math.min(nx - 1, i + 1)) * 3;
        const u = (Math.max(0, j - 1) * nx + i) * 3;
        const d = (Math.min(ny - 1, j + 1) * nx + i) * 3;
        const ax = pos[r] - pos[l];
        const ay = pos[r + 1] - pos[l + 1];
        const az = pos[r + 2] - pos[l + 2];
        const bx = pos[u] - pos[d];
        const by = pos[u + 1] - pos[d + 1];
        const bz = pos[u + 2] - pos[d + 2];
        const nX = ay * bz - az * by;
        const nY = az * bx - ax * bz;
        const nZ = ax * by - ay * bx;
        const len = Math.sqrt(nX * nX + nY * nY + nZ * nZ) || 1;
        const k = (j * nx + i) * 3;
        normal[k] = nX / len;
        normal[k + 1] = nY / len;
        normal[k + 2] = nZ / len;
      }
    }
  }
}
```

- [ ] **Step 4: 통과 확인** — Run: `node --test tests/cloth.test.js && npm test` → 7개 통과, 전체 130개

---

### Task 2: 띠 배치·스크롤 수학 (`strip.js`)

**Interfaces — Produces:** `RIG`, `STRIP`, `rollFor(w, h)`, `fovFromFocal(focal)`, `toRoom(x, y, z, roll, yaw) → [x, y, z]`, `facing(about, roll) → number[9]`(행 우선), `toCard(point, m) → [x, y, z]`, `slideOffsets(count, spacing, scroll) → number[]`, `cardSize(viewportWidth) → {width, height, gap, spacing}`, `easeToward(current, target, ease, dt)`, `dragDelta(dx, dy, roll, yaw)`

- [ ] **Step 1: 실패하는 테스트**

```js
// FILE: tests/cloth-strip.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RIG, STRIP, rollFor, fovFromFocal, toRoom, facing, toCard, slideOffsets, cardSize, easeToward, dragDelta,
} from '../demos/09-cloth/strip.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const closeAll = (list, expected, eps) => list.forEach((v, i) => close(v, expected[i], eps));

test('원본 숫자 (rig.ts · Strip.vue): 기울기 0.56 / 세로 화면 0.34, 비틀기 0.5, 눈 거리 화면 높이 × 1.5, 카드 방향 1.15', () => {
  assert.deepEqual(RIG, { roll: 0.56, rollTall: 0.34, yaw: 0.5, focal: 1.5, turn: 1.15 });
  assert.deepEqual(STRIP, {
    count: 10, aspect: 4 / 3,
    wide: { width: 576, gap: 32 }, narrow: { width: 448, gap: 16 }, breakpoint: 650,
    ease: 0.1, enter: { from: 1.5, wait: 0.15, ease: 0.04 }, dragGear: 1.5,
  });
});

test('세로로 긴 화면은 띠를 덜 기울인다', () => {
  assert.equal(rollFor(1440, 900), 0.56);
  assert.equal(rollFor(375, 812), 0.34);
});

test('눈이 화면 높이 1.5배 거리면 세로 화각 = 2·atan(1/3) ≈ 36.87°', () => {
  close(fovFromFocal(1.5), (2 * Math.atan(1 / 3) * 180) / Math.PI);
  close(fovFromFocal(1.5), 36.8699, 1e-3);
});

test('띠 방향: 오른쪽 위로 기울고(y 위) 오른쪽이 멀어진다(z −)', () => {
  closeAll(toRoom(1, 0, 0), [Math.cos(0.5) * Math.cos(0.56), Math.cos(0.5) * Math.sin(0.56), -Math.sin(0.5)]);
  closeAll(toRoom(0, 1, 0), [-Math.sin(0.56), Math.cos(0.56), 0]);
});

test('카드 방향 행렬은 회전(직교 · 행렬식 1)이고, 0·0이면 그대로', () => {
  const m = facing();
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const dot = m[r * 3] * m[c * 3] + m[r * 3 + 1] * m[c * 3 + 1] + m[r * 3 + 2] * m[c * 3 + 2];
      close(dot, r === c ? 1 : 0);
    }
  }
  const det = m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);
  close(det, 1);
  closeAll(facing(0, 0), [1, 0, 0, 0, 1, 0, 0, 0, 1]);
});

test('띠를 따라 움직이면 카드 입장에선 대부분 얼굴 방향(z)으로 밀린다 → 가장자리가 공기에 접힌다', () => {
  const local = toCard(toRoom(1, 0, 0), facing());
  assert.ok(Math.abs(local[2]) > 0.8, `z 성분 ${local[2]}`);
});

test('카드 위치: 10장이 간격마다 놓이고 띠 길이로 감긴다 (가운데 = 0)', () => {
  closeAll(slideOffsets(10, 608, 0), [0, 608, 1216, 1824, 2432, -3040, -2432, -1824, -1216, -608]);
  closeAll(slideOffsets(10, 608, 608), [-608, 0, 608, 1216, 1824, 2432, -3040, -2432, -1824, -1216]);
});

test('카드 크기: 650px 이상 576 × 768 · 간격 32, 좁으면 448 · 간격 16', () => {
  assert.deepEqual(cardSize(1440), { width: 576, height: 768, gap: 32, spacing: 608 });
  const narrow = cardSize(375);
  assert.equal(narrow.width, 448);
  close(narrow.height, 448 * 4 / 3);
  assert.equal(narrow.spacing, 464);
});

test('스크롤 무게: 60fps 한 프레임에 남은 거리의 10%, 프레임이 길면 그만큼 더', () => {
  close(easeToward(0, 100, 0.1, 1 / 60), 10);
  close(easeToward(0, 100, 0.1, 1 / 30), 19);
});

test('드래그: 띠 방향 성분 × 1.5 ÷ cos(비틀기)', () => {
  close(dragDelta(100, 0, 0, 0), 150);
  close(dragDelta(0, -100, Math.PI / 2, 0), 150);
  close(dragDelta(100, 0, 0, 0.5), 150 / Math.cos(0.5));
});
```

- [ ] **Step 2: 실패 확인** — Run: `node --test tests/cloth-strip.test.js` → FAIL

- [ ] **Step 3: 구현**

```js
// FILE: demos/09-cloth/strip.js
// ─────────────────────────────────────────────────────────────
// strip.js — 09 천 포스터: 띠 배치 · 원근 · 카드 크기 · 스크롤 수학 (순수 함수)
// 숫자 출처: DomGL Cloth 저장소 app/shaders/rig.ts, app/components/Strip.vue (코드는 가져오지 않았다).
// 원본은 화면처럼 y가 아래인 좌표라, Three.js(y 위)에 맞게 y를 뒤집어 같은 배치를 만든다. 단위는 px.
// ─────────────────────────────────────────────────────────────
import { wrapCentered } from '../../shared/motion.js?v=3';

export const RIG = {
  roll: 0.56,     // 띠 기울기 (rad, 32°)
  rollTall: 0.34, // 세로로 긴 화면 (19°)
  yaw: 0.5,       // 띠를 y축으로 비틀어 오른쪽이 멀어지게
  focal: 1.5,     // 눈 거리 = 화면 높이 × 1.5
  turn: 1.15,     // 카드가 띠에 대해 돌아선 각도 (실제 카드 방향 = turn − yaw)
};

export const STRIP = {
  count: 10,
  aspect: 4 / 3,                    // 카드 세로 / 가로 (3:4)
  wide: { width: 576, gap: 32 },    // 화면 650px 이상: 36rem, 간격 2rem
  narrow: { width: 448, gap: 16 },  // 좁은 화면: 28rem, 간격 1rem
  breakpoint: 650,
  ease: 0.1,                        // 매 프레임 목표까지 남은 거리의 10%씩
  enter: { from: 1.5, wait: 0.15, ease: 0.04 }, // 등장: 화면 폭 1.5배 밖에서, 0.15초 뒤, 4%씩
  dragGear: 1.5,                    // 드래그 배율 (원근으로 줄어든 만큼 ÷ cos(yaw)를 더 곱한다)
};

export function rollFor(width, height) {
  return height > width ? RIG.rollTall : RIG.roll;
}

// 눈이 화면 높이 × focal 거리에 있을 때 세로 화각(도)
export function fovFromFocal(focal = RIG.focal) {
  return (2 * Math.atan(0.5 / focal) * 180) / Math.PI;
}

// 띠 좌표(x = 띠 방향) → 방 좌표. 원본 toRoom을 y 뒤집어 옮김
export function toRoom(x, y, z, roll = RIG.roll, yaw = RIG.yaw) {
  const down = -y;
  const ax = x * Math.cos(yaw) + z * Math.sin(yaw);
  const az = -x * Math.sin(yaw) + z * Math.cos(yaw);
  const rx = ax * Math.cos(roll) + down * Math.sin(roll);
  const ry = -ax * Math.sin(roll) + down * Math.cos(roll);
  return [rx, -ry, az];
}

// 카드 자기 좌표 → 방 좌표 회전 (행 우선 3×3). 원본 facing(about, roll)을 y 뒤집기(F·M·F)로 옮김
export function facing(about = RIG.turn - RIG.yaw, roll = RIG.roll) {
  const ca = Math.cos(about);
  const sa = Math.sin(about);
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);
  const m = [ca * cr, sr, -sa * cr, -ca * sr, cr, sa * sr, sa, 0, ca];
  return [m[0], -m[1], m[2], -m[3], m[4], -m[5], m[6], -m[7], m[8]];
}

// 방 좌표의 점을 카드 자기 좌표로 (회전의 역 = 전치)
export function toCard(point, m) {
  const [x, y, z] = point;
  return [
    m[0] * x + m[3] * y + m[6] * z,
    m[1] * x + m[4] * y + m[7] * z,
    m[2] * x + m[5] * y + m[8] * z,
  ];
}

// 카드 i의 띠 위 위치 (화면 가운데 = 0). 띠 길이(count × spacing)로 감겨 끝없이 돈다
export function slideOffsets(count, spacing, scroll) {
  const loop = count * spacing;
  return Array.from({ length: count }, (_, i) => wrapCentered(i * spacing - scroll, loop));
}

export function cardSize(viewportWidth) {
  const size = viewportWidth >= STRIP.breakpoint ? STRIP.wide : STRIP.narrow;
  return { width: size.width, height: size.width * STRIP.aspect, gap: size.gap, spacing: size.width + size.gap };
}

// 원본 column: 매 프레임 목표까지 남은 거리의 ease만큼 (프레임 길이에 맞게 보정)
export function easeToward(current, target, ease, dt) {
  return current + (target - current) * (1 - (1 - ease) ** (dt * 60));
}

// 화면 드래그(px, y 아래) → 띠 스크롤 양. 띠 방향 성분만, 원근으로 줄어든 만큼 키운다
export function dragDelta(dx, dy, roll = RIG.roll, yaw = RIG.yaw) {
  return ((dx * Math.cos(roll) - dy * Math.sin(roll)) * STRIP.dragGear) / Math.cos(yaw);
}
```

- [ ] **Step 4: 통과 확인** — Run: `node --test tests/cloth-strip.test.js && npm test` → 10개, 전체 140개

---

### Task 3: 공통 재질 옵션 + 페이지

- [ ] **Step 1: `shared/card-material.js`** — `createCardMaterial({ cardWidth, cardHeight, cornerRadius, cardPosFromUv = false })`.
  캐시 키에 `-uvpos`를 붙이고, 정점 셰이더에 `uniform float uCardWidth;`를 선언하고,
  `vCardPos = position.xy;` 를 옵션이 켜지면 `vCardPos = (uv - 0.5) * vec2(uCardWidth, uCardHeight);` 로.
  `?v=6` → `?v=7` (01~05 main.js, texture-panel.js), `texture-panel.js?v=4` → `?v=5` (01~05 main.js).
  01~05를 브라우저로 열어 모서리·뒤집기·휨이 그대로인지 확인.

- [ ] **Step 2: main.js**

```js
// FILE: demos/09-cloth/main.js
// ─────────────────────────────────────────────────────────────
// 09 천 포스터 — 카드 10장이 대각선 띠를 따라 흐르고, 한 장 한 장이 천처럼 끌려가며 구겨진다.
// 참고: Codrops DomGL Cloth (Jesper Landberg) — 원본도 천 계산은 CPU. 숫자·원리만 옮기고 코드는 가져오지 않았다.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { createStage, showWebGLFallback, readToken } from '../../shared/stage.js?v=6';
import { createCardMaterial } from '../../shared/card-material.js?v=7';
import { clamp, prefersReducedMotion } from '../../shared/motion.js?v=3';
import { createPanel, addSettingsButtons } from '../../shared/panel.js?v=2';
import { CLOTH, Cloth } from './cloth.js?v=1';
import {
  RIG, STRIP, rollFor, fovFromFocal, toRoom, facing, toCard, slideOffsets, cardSize, easeToward, dragDelta,
} from './strip.js?v=1';

const CHECKER = { columns: 6, rows: 8, cell: 128 }; // 앞면 바둑판: 6 × 8칸 (3:4라 칸이 정사각)
const CORNER_RATIO = 20 / 345;                      // 01~08과 같은 카드 모서리 (폭 대비)

const canvas = document.getElementById('stage-canvas');
const reduced = prefersReducedMotion();

// 패널 기본값 = 원본 숫자
const DEFAULTS = {
  starch: CLOTH.starch,        // 펴지는 힘
  bendSoft: CLOTH.bend * 1e5,  // 굽힘 부드러움 (×10⁻⁵)
  drag: CLOTH.drag,            // 공기 저항
  damp: CLOTH.damp,            // 감쇠
  ease: STRIP.ease,            // 스크롤 무게 (작을수록 묵직하게 따라옴)
  rollDeg: Math.round((RIG.roll * 180) / Math.PI), // 띠 기울기 (넓은 화면, 32°)
};
const params = structuredClone(DEFAULTS);
const tune = { ...CLOTH }; // 모든 천이 같이 보는 값 → 패널이 바꾸면 바로 반영

function applyTune() {
  tune.starch = params.starch;
  tune.bend = params.bendSoft * 1e-5;
  tune.drag = params.drag;
  tune.damp = params.damp;
}

function checkerTexture() {
  const { columns, rows, cell } = CHECKER;
  const paint = document.createElement('canvas');
  paint.width = columns * cell;
  paint.height = rows * cell;
  const g = paint.getContext('2d');
  const colors = [readToken('--card-paper'), readToken('--card-lavender')];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      g.fillStyle = colors[(r + c) % 2];
      g.fillRect(c * cell, r * cell, cell, cell);
    }
  }
  const texture = new THREE.CanvasTexture(paint);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

let stage;
try {
  stage = createStage({ canvas, fov: fovFromFocal() });
} catch (error) {
  showWebGLFallback(canvas);
  throw error;
}
const { scene, camera, renderer } = stage;
camera.near = 10;
camera.far = 20000;
// 원본 빛 방향 (−0.42, −0.6, 0.68)은 화면 y 아래 기준 → y를 뒤집어 왼쪽 위 앞에서 비춘다
stage.keyLight.position.set(-0.42, 0.6, 0.68);
const map = checkerTexture();
map.anisotropy = renderer.capabilities.getMaxAnisotropy();

let cards = [];
let material = null;
let size = null;
let roll = RIG.roll;
let rotation = facing();
const rotationMatrix = new THREE.Matrix4();

function rollNow() {
  const wide = (params.rollDeg * Math.PI) / 180;
  const tall = rollFor(canvas.clientWidth, canvas.clientHeight) === RIG.rollTall;
  return tall ? wide * (RIG.rollTall / RIG.roll) : wide;
}

function setRotation() {
  roll = rollNow();
  rotation = facing(RIG.turn - RIG.yaw, roll);
  const m = rotation;
  rotationMatrix.set(m[0], m[1], m[2], 0, m[3], m[4], m[5], 0, m[6], m[7], m[8], 0, 0, 0, 0, 1);
  for (const card of cards) {
    card.mesh.matrix.copy(rotationMatrix);
    card.mesh.matrixWorldNeedsUpdate = true;
  }
}

function cardGeometry(cloth) {
  const geometry = new THREE.PlaneGeometry(size.width, size.height, CLOTH.nx - 1, CLOTH.ny - 1);
  // 천 입자 배열을 그대로 정점 배열로 쓴다 (순서가 같다: 왼쪽 위부터 줄마다)
  geometry.setAttribute('position', new THREE.BufferAttribute(cloth.pos, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('normal', new THREE.BufferAttribute(cloth.normal, 3).setUsage(THREE.DynamicDrawUsage));
  // 공통 카드 재질이 읽는 카드별 값 (한 장짜리라 1칸씩): 밝기 1, 뒤집기·퍼짐·추가 휨 0
  geometry.setAttribute('instanceDim', new THREE.InstancedBufferAttribute(new Float32Array([1]), 1));
  geometry.setAttribute('instanceFlip', new THREE.InstancedBufferAttribute(new Float32Array([0]), 1));
  geometry.setAttribute('instanceSoft', new THREE.InstancedBufferAttribute(new Float32Array([0]), 1));
  geometry.setAttribute('instanceBend', new THREE.InstancedBufferAttribute(new Float32Array([0]), 1));
  return geometry;
}

function build() {
  for (const card of cards) {
    scene.remove(card.mesh);
    card.mesh.geometry.dispose();
  }
  material?.dispose();
  size = cardSize(canvas.clientWidth);
  material = createCardMaterial({
    cardWidth: size.width,
    cardHeight: size.height,
    cornerRadius: size.width * CORNER_RATIO,
    cardPosFromUv: true, // 구겨져도 둥근 모서리가 카드 모서리에 붙어 있게
  });
  material.map = map;
  material.color.set(0xffffff); // 바둑판 색 그대로 (재질 값)
  material.roughness = 0.85;
  material.metalness = 0;
  material.clearcoat = 0;
  material.sheen = 0.3;          // 원본: 비스듬히 볼 때 윤기 0.3
  material.sheenRoughness = 0.6;
  material.sheenColor.set(0xffffff);

  cards = Array.from({ length: STRIP.count }, () => {
    const cloth = new Cloth(size.width, size.height, tune);
    const mesh = new THREE.InstancedMesh(cardGeometry(cloth), material, 1);
    mesh.matrixAutoUpdate = false;
    mesh.frustumCulled = false; // 매 프레임 모양이 바뀌어서 "화면 밖" 판정을 끈다
    scene.add(mesh);
    return { cloth, mesh };
  });
  setRotation();
}

// ── 스크롤 (원본: 페이지는 고정, 휠·드래그가 목표를 바꾸고 값은 매 프레임 목표로 다가간다) ──
let scroll = 0;
let target = 0;
let ease = params.ease;
let entering = !reduced;
let enterAt = 0;

function takeOver() {
  if (!entering) return;
  entering = false;
  ease = params.ease;
}

canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  const unit = event.deltaMode === 1 ? 16 : 1;
  target += (event.deltaY + event.deltaX) * unit;
  takeOver();
}, { passive: false });

let dragging = null;
canvas.addEventListener('pointerdown', (event) => {
  dragging = { x: event.clientX, y: event.clientY };
  canvas.setPointerCapture(event.pointerId);
  takeOver();
});
canvas.addEventListener('pointermove', (event) => {
  if (!dragging) return;
  target -= dragDelta(event.clientX - dragging.x, event.clientY - dragging.y, roll);
  dragging = { x: event.clientX, y: event.clientY };
});
for (const type of ['pointerup', 'pointercancel']) {
  canvas.addEventListener(type, () => { dragging = null; });
}

// ── 패널 ──
const gui = createPanel('09 천 포스터 · 조절 패널');
const clothFolder = gui.addFolder('천');
clothFolder.add(params, 'starch', 5, 120, 1).name('펴지는 힘').onChange(applyTune);
clothFolder.add(params, 'bendSoft', 0.1, 20, 0.1).name('굽힘 부드러움 (×10⁻⁵)').onChange(applyTune);
clothFolder.add(params, 'drag', 0, 30, 0.5).name('공기 저항').onChange(applyTune);
clothFolder.add(params, 'damp', 0, 5, 0.1).name('감쇠').onChange(applyTune);
const stripFolder = gui.addFolder('띠');
stripFolder.add(params, 'ease', 0.02, 0.3, 0.01).name('스크롤 무게').onChange(() => { if (!entering) ease = params.ease; });
stripFolder.add(params, 'rollDeg', 0, 60, 1).name('띠 기울기 (°)').onChange(setRotation);
addSettingsButtons(gui, {
  params,
  defaults: DEFAULTS,
  onApply: () => {
    applyTune();
    setRotation();
    if (!entering) ease = params.ease;
  },
});

// ── 화면 크기 ──
function layout() {
  camera.position.set(0, 0, RIG.focal * canvas.clientHeight); // 눈 = 화면 높이 × 1.5 → 카드 면 1px = 화면 1px
  camera.lookAt(0, 0, 0);
  const next = cardSize(canvas.clientWidth);
  if (!size || next.width !== size.width) build();
  else setRotation();
}
window.addEventListener('resize', layout);

applyTune();
layout();

// 등장: 띠를 화면 폭 1.5배 밖에 두고, 0.15초 뒤 4%씩 다가오게 (원본 Strip.vue)
if (entering) {
  scroll = -canvas.clientWidth * STRIP.enter.from;
  target = scroll;
  ease = STRIP.enter.ease;
}

let last = performance.now();
const start = last;
function frame(now) {
  const dt = clamp((now - last) / 1000, 0, 0.1);
  last = now;
  const time = (now - start) / 1000;
  if (entering && !enterAt && time > STRIP.enter.wait) {
    enterAt = now;
    target = 0;
  }
  if (entering && enterAt && Math.abs(target - scroll) < 0.5) takeOver();
  scroll = easeToward(scroll, target, ease, dt);

  const offsets = slideOffsets(STRIP.count, size.spacing, scroll);
  cards.forEach((card, i) => {
    const [x, y, z] = toCard(toRoom(offsets[i], 0, 0, roll), rotation);
    let changed;
    if (reduced) {
      card.cloth.place(x, y, z);
      changed = true;
    } else {
      changed = card.cloth.step(dt, x, y, z, time);
    }
    if (changed) {
      card.mesh.geometry.attributes.position.needsUpdate = true;
      card.mesh.geometry.attributes.normal.needsUpdate = true;
    }
  });
  stage.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

- [ ] **Step 3: index.html**

```html
<!-- FILE: demos/09-cloth/index.html -->
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>09 천 포스터 · Card Archive</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
  <link rel="stylesheet" href="../../shared/tokens.css?v=2">
  <link rel="stylesheet" href="../../shared/base.css?v=4">
  <script type="importmap">
  {
    "imports": {
      "three": "https://cdn.jsdelivr.net/npm/three@0.187.0/build/three.module.js",
      "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.187.0/examples/jsm/"
    }
  }
  </script>
</head>
<body>
  <a class="back-link" href="../../">← 아카이브</a>

  <section class="stage-wrap is-fixed">
    <div class="stage">
      <canvas id="stage-canvas" aria-label="바둑판무늬 카드 열 장이 대각선 띠를 따라 흐르고, 움직일 때마다 천처럼 끌려가며 구겨졌다가 멈추면 다시 펴지는 3D 장면"></canvas>
      <div class="stage-caption">
        <p class="caption-index">09</p>
        <h1>천 포스터</h1>
        <p>카드가 천처럼 끌려가며 구겨지고, 멈추면 다시 펴져.</p>
        <p class="caption-hint">휠을 굴리거나 끌어봐</p>
        <a class="notes-jump" href="#notes">기법 노트 ↓</a>
      </div>
    </div>
  </section>

  <main class="notes" id="notes">
    <section>
      <h2>이 데모에 쓴 기법</h2>
      <dl>
        <dt>카드 한 장 = 천 한 장</dt>
        <dd>카드마다 점 25 × 33개를 실로 엮었어. 가로·세로 이웃은 안 늘어나는 실, 대각선은 아주 살짝 늘어나는 실, 두 칸 건너는 휘어지게 해주는 실이야. 한 프레임을 6단계로 잘게 나눠서 풀어.</dd>
        <dt>가운데를 잡고 끌기</dt>
        <dd>가운데 9개 점만 띠에 붙어서 끌려가고, 나머지는 뒤따라와. 중력은 없어. 점마다 평평한 자리로 돌아가려는 힘(42), 잡은 곳 속도를 따라가려는 힘(8), 면 방향 공기 저항(11), 감쇠(0.8)가 걸려. 그래서 움직일 땐 구겨지고 멈추면 다시 반듯하게 펴져.</dd>
        <dt>얼굴부터 밀리게</dt>
        <dd>띠는 오른쪽 위로 32° 기울고 오른쪽이 멀어지게 비틀려 있고, 카드는 띠에 비스듬히 돌아서 있어. 그래서 띠를 따라 움직이면 카드 입장에선 거의 얼굴 쪽으로 밀려서, 공기에 가장자리가 뒤로 접혀.</dd>
        <dt>너무 세게 끌어도 괜찮게</dt>
        <dd>천이 느끼는 속도는 초당 2200px, 속도 변화는 초당 16000px까지만이야. 넘는 만큼은 천 전체를 통째로 옮겨서, 아주 빨리 끌어도 적당히 스크롤한 것처럼만 구겨지고 서로 뚫고 지나가지 않아.</dd>
        <dt>쉬는 천</dt>
        <dd>거의 안 움직이고 판판해진 천은 평평하게 딱 맞춘 뒤 계산을 멈춰. 그래서 멈춰 있을 땐 가벼워.</dd>
      </dl>
    </section>
    <section>
      <h2>참고한 곳</h2>
      <p>숫자와 원리만 공부했고, 코드는 가져오지 않았어.</p>
      <p><a href="https://tympanus.net/codrops/2026/11/17/cloth-posters-webgpu/" target="_blank" rel="noopener">An Infinite Carousel of Cloth Posters with WebGPU</a> (Codrops, Jesper Landberg): 천 계산 방식과 숫자, 띠 배치, 스크롤.</p>
      <p><a href="https://tympanus.net/Demos/ClothCarousel/" target="_blank" rel="noopener">원본 데모</a> (WebGPU 되는 브라우저에서만 열려).</p>
      <p><a href="#stage-canvas">↑ 천으로 돌아가기</a></p>
    </section>
  </main>

  <script type="module" src="./main.js?v=1"></script>
</body>
</html>
```

- [ ] **Step 4: 아카이브 목록** — `index.html` 08 항목 다음에 09 (`demos/09-cloth/`, "천 포스터", "카드가 천처럼 끌려가며 구겨지고, 멈추면 다시 펴져.").

- [ ] **Step 5: 브라우저 확인** — 콘솔 에러 0, 등장, 휠·드래그로 구겨짐, 멈추면 펴짐, 원본 데모와 나란히 비교, 폰 크기, 01~05 회귀.
