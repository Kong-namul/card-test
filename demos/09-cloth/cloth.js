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

// 잡는 점 (원본 layer.ts nail): 카드마다 가운데에서 폭·높이의 8~16% 떨어진 곳을 잡는다.
// 방향은 카드 번호 × 황금각이라 장마다 다르게 늘어지고, 줄도 살짝 들쭉날쭉해진다
export const NAIL = { least: 0.08, most: 0.16, turn: 2.39996 };

// 카드 key의 잡는 점 = 카드 가운데 기준 (x 오른쪽, y 위) px. 원본은 y 아래라 y 부호를 뒤집는다
export function nailOffset(key, width, height) {
  const roll = Math.sin(key * 78.233 + 1.7) * 43758.5453;
  const far = NAIL.least + (NAIL.most - NAIL.least) * (roll - Math.floor(roll));
  const turn = key * NAIL.turn;
  return [width * Math.cos(turn) * far, -height * Math.sin(turn) * far];
}

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
  // nail: 잡는 점 (카드 가운데 기준 px, x 오른쪽 · y 위). 기본은 정가운데
  constructor(width, height, tune = CLOTH, nail = [0, 0]) {
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
    this.home = new Float32Array(n * 2);  // 평평할 때 자리 (잡는 점 기준)
    this.inv = new Float32Array(n);       // 0 = 고정, 1 = 자유
    this.tether = new Float32Array(n);    // 고정점까지 원래 거리²
    this.gust = new Float32Array(n);
    this.felt = [0, 0, 0];

    const dx = width / (nx - 1);
    const dy = height / (ny - 1);
    const midI = (nx - 1) / 2;
    const midJ = (ny - 1) / 2;
    // 잡는 점에서 몇 칸 떨어졌나 (고정 범위·실 푸는 순서에 쓴다)
    const ring = (i, j) => Math.hypot((i - midI) - nail[0] / dx, (midJ - j) - nail[1] / dy);

    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        const hx = (i - midI) * dx - nail[0];
        const hy = (midJ - j) * dy - nail[1]; // j = 0이 맨 위
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
    // 같은 시각에 두 번 불리면(시간 차 0) 속도 = 거리 ÷ 0이 돼서 천이 망가진다 → 건너뛴다
    if (!(dt > 0)) return false;
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
