// ─────────────────────────────────────────────────────────────
// settings.js — 조절 패널 값을 글자(JSON)로 바꾸고, 다시 읽어오는 함수
// "설정 복사" / "설정 붙여넣기" 버튼이 이걸 쓴다.
// ─────────────────────────────────────────────────────────────

// defaults에 있는 키만 골라서 보기 좋은 JSON 글자로 만든다.
// 숫자는 소수 4자리로 반올림해서 0.30000000000000004 같은 지저분한 값을 없앤다.
export function serializeSettings(params, defaults) {
  const out = {};
  for (const key of Object.keys(defaults)) {
    const value = params[key];
    out[key] = typeof value === 'number' ? Math.round(value * 10000) / 10000 : value;
  }
  return JSON.stringify(out, null, 2);
}

// 붙여넣은 글자를 읽어서, defaults에 있는 키이고 타입도 같은 값만 돌려준다.
// 오타나 다른 데모의 설정을 붙여넣어도 화면이 깨지지 않게 하기 위해서야.
export function parseSettings(text, defaults) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('설정 형식이 올바르지 않아요 (JSON 글자가 아니에요)');
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('설정 형식이 올바르지 않아요 ({ } 모양이 아니에요)');
  }
  const out = {};
  for (const key of Object.keys(defaults)) {
    if (key in data && typeof data[key] === typeof defaults[key]) out[key] = data[key];
  }
  return out;
}
