import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serializeSettings, parseSettings } from '../shared/settings.js';

const DEFAULTS = { preset: '홀로그램 박', gloss: 1, count: 36, cardColor: '#F4F1EA', auto: true };

test('직렬화 → 파싱 왕복하면 같은 값이 나온다', () => {
  const params = { ...DEFAULTS, gloss: 0.5, count: 20 };
  const parsed = parseSettings(serializeSettings(params, DEFAULTS), DEFAULTS);
  assert.deepEqual(parsed, { preset: '홀로그램 박', gloss: 0.5, count: 20, cardColor: '#F4F1EA', auto: true });
});

test('직렬화는 defaults에 있는 키만, 숫자는 소수 4자리로 반올림', () => {
  const text = serializeSettings({ ...DEFAULTS, gloss: 0.123456, extra: 1 }, DEFAULTS);
  const data = JSON.parse(text);
  assert.equal(data.gloss, 0.1235);
  assert.equal('extra' in data, false);
});

test('모르는 키와 타입이 다른 값은 버린다', () => {
  const parsed = parseSettings('{"gloss":"많이","zzz":1,"count":20}', DEFAULTS);
  assert.deepEqual(parsed, { count: 20 });
});

test('JSON이 아니거나 객체가 아니면 에러', () => {
  assert.throws(() => parseSettings('그냥 글자', DEFAULTS), /설정 형식이 올바르지 않아요/);
  assert.throws(() => parseSettings('[1,2]', DEFAULTS), /설정 형식이 올바르지 않아요/);
  assert.throws(() => parseSettings('null', DEFAULTS), /설정 형식이 올바르지 않아요/);
});
