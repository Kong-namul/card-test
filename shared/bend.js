// ─────────────────────────────────────────────────────────────
// bend.js — 평평한 카드를 종이처럼 휘게 만드는 계산
// ─────────────────────────────────────────────────────────────
// positions: [x, y, z, x, y, z, ...] 형태의 정점 좌표 배열
// bend: 휨 세기. 가로 가장자리(x=±1)가 bend만큼 뒤로(-z) 말린다
// bow: 세로 방향 휨 비율. 0.35면 위아래는 가로의 35%만큼만 휜다
//
// z = -(bend·x² + bend·bow·y²)
// x²을 쓰는 이유: 가운데는 거의 그대로, 가장자리로 갈수록 급하게 말려서
// 실제 종이를 양손으로 살짝 쥔 것 같은 곡면이 나온다.
// z를 "더하지" 않고 "덮어쓰기" 때문에 슬라이더로 여러 번 바꿔도 누적되지 않는다.
export function bendPositions(positions, bend, bow = 0.35) {
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    positions[i + 2] = -(bend * x * x + bend * bow * y * y);
  }
  return positions;
}
