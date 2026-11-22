import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEXTURE_PRESETS, PRESET_NAMES, DEFAULT_PRESET, presetToParams } from '../shared/texture-presets.js';

test('프리셋 5종이 정해진 순서로 있고, 기본값은 홀로그램 박', () => {
  assert.deepEqual(PRESET_NAMES, ['무광 종이', '유광 코팅', '홀로그램 박', '금박', '은박']);
  assert.equal(DEFAULT_PRESET, '홀로그램 박');
  assert.ok(TEXTURE_PRESETS[DEFAULT_PRESET]);
});

test('종이 계열은 종이색, 금박·은박은 박 고유색을 카드 색으로 쓴다', () => {
  const holo = presetToParams('홀로그램 박', '#F4F1EA');
  assert.equal(holo.preset, '홀로그램 박');
  assert.equal(holo.cardColor, '#F4F1EA');
  assert.equal(holo.gloss, TEXTURE_PRESETS['홀로그램 박'].clearcoat);
  assert.equal(holo.rainbow, TEXTURE_PRESETS['홀로그램 박'].iridescence);
  const gold = presetToParams('금박', '#F4F1EA');
  assert.equal(gold.cardColor, TEXTURE_PRESETS['금박'].tint);
});

test('없는 프리셋 이름이면 에러', () => {
  assert.throws(() => presetToParams('플라스틱', '#FFFFFF'), /없는 질감 프리셋/);
});
