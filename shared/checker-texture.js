// ─────────────────────────────────────────────────────────────
// checker-texture.js — 바둑판 카드 앞면 텍스처 (09·10 공통). 색은 토큰 이름으로 받는다.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { readToken } from './stage.js?v=6';

export function createCheckerTexture({ columns, rows, cell = 128, colors = ['--card-paper', '--card-lavender'] }) {
  const paint = document.createElement('canvas');
  paint.width = columns * cell;
  paint.height = rows * cell;
  const g = paint.getContext('2d');
  const fills = colors.map((name) => readToken(name));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      g.fillStyle = fills[(r + c) % fills.length];
      g.fillRect(c * cell, r * cell, cell, cell);
    }
  }
  const texture = new THREE.CanvasTexture(paint);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
