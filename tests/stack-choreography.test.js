import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scrollStages, stackSlot, stackIndexFromRank } from '../shared/stack-choreography.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('scrollStages: 스크롤 0이면 연출 전, 3화면이면 연출 끝', () => {
  const start = scrollStages(0);
  close(start.gather, 0); close(start.single, 0); close(start.flip, 0); close(start.settle, 0);
  const end = scrollStages(3);
  close(end.gather, 1); close(end.single, 1); close(end.flip, 1); close(end.settle, 1);
});

test('scrollStages: 각 구간 한가운데에서 0.5, 앞 구간이 끝나야 다음 구간 시작', () => {
  close(scrollStages(0.45).gather, 0.5); // 0.18~0.72 의 가운데
  const s = scrollStages(1.0);
  close(s.gather, 1); close(s.single, 0); // 모이기는 끝났고 한 장 남기기는 아직
  close(scrollStages(1.44).single, 0.5); // 1.18~1.7 의 가운데
});

test('stackSlot: 더미 가운데 카드는 제자리, 나머지는 살짝씩 어긋나며 뒤로 쌓인다', () => {
  const center = stackSlot(0);
  close(center.x, 0); close(center.y, 0); close(center.z, 0);
  const right = stackSlot(2);
  close(right.x, 0.008); close(right.y, 0.007); close(right.z, -0.024);
  const left = stackSlot(-2);
  close(left.x, -0.008); close(left.y, -0.007);
  // 양쪽 다 뒤로 가되, 같은 깊이면 겹친 부분이 깜빡이니까(z-파이팅) 왼쪽이 반 칸 더 뒤
  close(left.z, -0.03);
});

test('stackIndexFromRank: 앞에서부터 순위를 더미 위치로 — 0, 1, -1, 2, -2 … 번갈아', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(stackIndexFromRank), [0, 1, -1, 2, -2, 3]);
});
