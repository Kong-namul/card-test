import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bendPositions } from '../shared/bend.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('가운데는 그대로, 양옆 가장자리는 뒤로(-z), 좌우 대칭, 세로는 bow 비율만큼', () => {
  // 정점 4개: 가운데, 오른쪽 끝, 왼쪽 끝, 위쪽 끝
  const pos = new Float32Array([0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 1, 0]);
  bendPositions(pos, 0.1, 0.35);
  close(pos[2], 0);
  close(pos[5], -0.1);
  close(pos[8], -0.1);
  close(pos[11], -0.035);
});

test('bend 0이면 평평하고, 다시 휘어도 누적되지 않는다', () => {
  const a = new Float32Array([1, 0, 0]);
  bendPositions(a, 0.2);
  bendPositions(a, 0.1);
  close(a[2], -0.1);
  bendPositions(a, 0);
  close(a[2], 0);
});
