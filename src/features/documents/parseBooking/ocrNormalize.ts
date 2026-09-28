/* i18n-exempt-file: 예약 문서 OCR 결과(한국어 통화 표기 포함)를 고치는 정규식 */
/**
 * OCR 결과 보정 (문서 인식 파이프라인 — 추출 직후, 마스킹·파싱 전)
 *
 * 사진·스캔본을 OCR로 읽으면 모양이 비슷한 글자를 자주 바꿔 읽는다(O↔0, I·L↔1, S↔5, B↔8,
 * Z↔2, D↔0 등). 그 결과 날짜(07OCT26 → 070CT26), 편명(OZ 102 → 02 102), 금액·시각이 깨지면
 * 뒤 단계(정규식 파서·LLM)가 값을 못 찾거나 틀린 값을 낸다.
 *
 * 원칙 — 문맥이 확실한 곳만 고친다:
 *  - 날짜: "숫자 + 3글자 + 숫자" 자리에서 3글자가 헷갈리는 글자만 바꿔 월 약어가 될 때만
 *  - 편명: 항공사 코드 목록에 있는 코드가 될 때만(원래 코드가 이미 유효하면 건드리지 않음)
 *  - 공항 코드: 괄호 안·화살표 옆처럼 공항 코드 자리에서, 공항 DB에 있는 코드가 될 때만
 *  - 숫자: 숫자로 시작하는 숫자 덩어리 안의 o·O·l·I만(예약번호처럼 글자가 섞인 코드는 제외)
 * 예약번호(PNR)는 고치지 않는다 — 글자·숫자가 모두 올 수 있어 무엇이 맞는지 알 수 없다.
 * 대신 헷갈리는 글자가 있으면 hasAmbiguousChars()로 신뢰도를 낮추게 한다.
 */

/** 주요 항공사 IATA 코드(편명 보정용 — 여기 없는 코드는 보정하지 않을 뿐 그대로 둔다) */
export const AIRLINE_CODES: ReadonlySet<string> = new Set(
  (
    // 한국
    'KE OZ 7C LJ TW ZE BX RS RF YP 4V ' +
    // 일본·중화권
    'JL NH MM GK BC 7G HD NU 6J IJ CX UO HX KA CI BR IT JX AE B7 CA MU CZ HU 3U ZH MF FM HO 9C SC GS KN NS ' +
    // 동남아·남아시아
    'SQ TR MI 3K TG FD SL WE VZ PG VN VJ QH BL PR 5J Z2 DG MH AK D7 OD GA QZ JT ID BI AI 6E UK SG IX QG UL KC ' +
    // 중동·아프리카
    'EK EY QR WY GF SV MS TK PC RJ ME KU XY FZ G9 ET KQ SA AT WB ' +
    // 유럽
    'LH LX OS SN LO OK EW 4U AF KL BA VS EI FR U2 W6 VY IB UX TP AZ SK AY DY DX A3 OA RO JU OU LG BT ' +
    // 미주·대양주
    'AA UA DL AS B6 WN NK F9 HA AC WS LA AV AM CM AR G3 AD QF VA JQ NZ FJ'
  ).split(' '),
);

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** OCR이 서로 바꿔 읽는 글자 — 숫자 쪽 → 글자 후보 */
const DIGIT_TO_LETTERS: Record<string, string[]> = {
  '0': ['O', 'D', 'Q'],
  '1': ['I', 'L'],
  '2': ['Z'],
  '5': ['S'],
  '6': ['G'],
  '8': ['B'],
};
/** 글자 쪽 → 숫자 */
const LETTER_TO_DIGIT: Record<string, string> = { O: '0', o: '0', D: '0', Q: '0', I: '1', l: '1', L: '1', '|': '1', Z: '2', z: '2', S: '5', s: '5', G: '6', B: '8' };

/** 헷갈리는 글자를 바꿔 만들 수 있는 모든 글자 조합(최대 2자리까지 바꿈) */
function letterVariants(token: string): string[] {
  const upper = token.toUpperCase();
  let variants = [''];
  let changed = 0;
  for (const ch of upper) {
    const options = DIGIT_TO_LETTERS[ch];
    if (options) {
      changed += 1;
      variants = variants.flatMap((v) => options.map((o) => v + o));
    } else {
      variants = variants.map((v) => v + ch);
    }
    if (changed > 2) return [];
  }
  return variants;
}

/** 월 약어 보정: 070CT26 → 07OCT26, 03 0EC 2026 → 03 DEC 2026 (날짜 자리에서만) */
function fixMonthTokens(text: string): string {
  return text.replace(/\b(\d{1,2})(\s?)([A-Za-z0-9]{3})(\s?)(\d{2}(?:\d{2})?)?(?![A-Za-z0-9])/g, (m, day, s1, mon, s2, year) => {
    const upperMon = mon.toUpperCase();
    if (MONTHS.includes(upperMon)) return m; // 이미 월 약어 — 그대로(대소문자도 원문 유지)
    if (!/\d/.test(mon) || !/[A-Za-z]/.test(mon)) return m; // 글자·숫자가 섞인 경우만 보정 대상
    const hit = letterVariants(mon).find((v) => MONTHS.includes(v));
    if (!hit) return m;
    const out = mon === mon.toLowerCase() ? hit.toLowerCase() : mon === upperMon ? hit : hit[0] + hit.slice(1).toLowerCase();
    return `${day}${s1}${out}${s2}${year ?? ''}`;
  });
}

function toDigits(s: string): string {
  return s.replace(/[OoDQIlL|ZzSsGB]/g, (c) => LETTER_TO_DIGIT[c] ?? c);
}

/**
 * 편명 보정: 02 102 → OZ 102, EK O19 → EK 019, KEl23 → KE123.
 * 코드가 항공사 목록에 있고 번호에 숫자가 하나 이상 있을 때만.
 */
function fixFlightNumbers(text: string): string {
  // 번호 뒤에 공항 코드가 띄어쓰기 없이 붙어 읽힌 경우(02 105NRI)도 편명으로 본다
  return text.replace(/(?<![A-Za-z0-9./:-])([A-Za-z0-9]{2})(\s?)([0-9OoIlL|]{1,4})(?![a-z0-9:]|[A-Z](?![A-Z]{2}(?![A-Za-z0-9])))/g, (m, code, sp, num) => {
    if (!/\d/.test(num)) return m;
    const upperCode = code.toUpperCase();
    let fixedCode: string | null = AIRLINE_CODES.has(upperCode) && code === upperCode ? upperCode : null;
    if (!fixedCode) {
      // 숫자만으로 된 코드(02)는 0→O, 2→Z처럼 흔한 혼동만 — 날짜·번호 오탐을 줄이려고
      const allDigits = /^\d{2}$/.test(code);
      // 후보는 헷갈림이 흔한 순서(0→O가 D·Q보다 먼저)로 나오므로 첫 번째를 쓴다.
      // 숫자만으로 된 코드는 가장 흔한 0→O, 2→Z만(10 → LO처럼 번호를 항공사로 착각하지 않게)
      const variants = allDigits ? (/0/.test(code) ? [code.replace(/0/g, 'O').replace(/2/g, 'Z')] : []) : letterVariants(code);
      const candidate = variants.find((v) => AIRLINE_CODES.has(v) && /^[A-Z]{2}$|^[A-Z0-9]{2}$/.test(v) && /[A-Z]/.test(v));
      if (!candidate) return m;
      // 숫자만으로 된 코드(02 → OZ)는 띄어쓰기로 번호와 떨어져 있고 번호가 3자리 이상일 때만 —
      // 우편번호(0600o)·날짜 같은 숫자 덩어리를 편명으로 착각하지 않게
      if (allDigits && (sp === '' || num.length < 3)) return m;
      if (!allDigits && code !== upperCode && !/^[a-z][A-Z0-9]|[A-Z0-9][a-z]$/.test(code)) return m;
      fixedCode = candidate;
    }
    const fixedNum = toDigits(num);
    if (!/^\d{1,4}$/.test(fixedNum)) return m;
    if (fixedCode === code && fixedNum === num) return m;
    return `${fixedCode}${sp}${fixedNum}`;
  });
}

/**
 * 숫자 덩어리 안의 글자 → 숫자: 2O26.11.O3 → 2026.11.03, O8:1O → 08:10, 06ooo → 06000.
 * 숫자로 시작하거나(o8:10 같은 경우) 숫자가 절반 넘는 덩어리만 — 예약번호(6X2KQP)처럼
 * 다른 글자가 섞인 코드는 이 모양에 맞지 않아 건드리지 않는다.
 */
function fixNumericRuns(text: string): string {
  return text.replace(/(?<![A-Za-z0-9])[0-9OoIl|][0-9OoIl|.,:/-]*[0-9OoIl|](?![A-Za-z0-9])/g, (m) => {
    if (!/[OoIl|]/.test(m)) return m;
    const digits = (m.match(/\d/g) ?? []).length;
    const letters = (m.match(/[OoIl|]/g) ?? []).length;
    if (digits === 0) return m;
    const fixed = m.replace(/[OoIl|]/g, (c) => LETTER_TO_DIGIT[c]);
    // 숫자로 시작하거나 숫자가 더 많을 때, 또는 바꾼 결과가 시각·날짜 모양일 때만(O8:1O → 08:10)
    const looksLikeTimeOrDate = /^\d{1,2}:\d{2}$|^\d{4}[./-]\d{1,2}[./-]\d{1,2}$|^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(fixed);
    if (!/^\d/.test(m) && digits <= letters && !looksLikeTimeOrDate) return m;
    return fixed;
  });
}

/** 12시간제 시각의 빠진 콜론: 1140pm → 11:40pm, 6 15 AM → 6:15 AM */
function fixCompactTimes(text: string): string {
  return text.replace(/\b(\d{1,2})[\s.]?(\d{2})\s?([AaPp][Mm])\b/g, (m, h, mm, ap) => {
    const hour = Number(h);
    const min = Number(mm);
    if (hour < 1 || hour > 12 || min > 59) return m;
    if (m.includes(':')) return m;
    const space = /\s[AaPp][Mm]$/.test(m) ? ' ' : '';
    return `${hour}:${mm}${space}${ap}`;
  });
}

/**
 * 원화 금액: ₩를 W·\로 읽은 것(W612,480 → ₩612,480), 원화 천 단위 구분자를 점으로 읽은 것
 * (KRW 1284.300 → KRW 1,284,300 — 원화는 소수점이 없다).
 */
function fixKrwAmounts(text: string): string {
  let s = text.replace(/(?<![A-Za-z])[W\\]\s?(?=\d{1,3}(?:[,.]\d{3})+(?!\d))/g, '₩');
  s = s.replace(/(KRW|₩)(\s?)(\d{1,3}(?:[.,]?\d{3})+)(?![\d.,])/g, (m, cur, sp, num) => {
    if (!num.includes('.')) return m;
    const plain = num.replace(/[.,]/g, '');
    return `${cur}${sp}${Number(plain).toLocaleString('en-US')}`;
  });
  s = s.replace(/(?<![\d.,])(\d{1,3}(?:[.,]\d{3})+)(\s?원)/g, (m, num, won) => {
    if (!num.includes('.')) return m;
    return `${Number(num.replace(/[.,]/g, '')).toLocaleString('en-US')}${won}`;
  });
  return s;
}

/** 대문자·숫자 코드 안에 소문자 하나가 섞인 것(W7zK2M → W7ZK2M) */
function fixCodeCase(text: string): string {
  return text.replace(/(?<![A-Za-z0-9])[A-Za-z0-9]{5,10}(?![A-Za-z0-9])/g, (m) => {
    const lower = (m.match(/[a-z]/g) ?? []).length;
    const upper = (m.match(/[A-Z]/g) ?? []).length;
    const digits = (m.match(/\d/g) ?? []).length;
    if (lower === 0 || lower > 2 || upper < 2 || digits < 1) return m;
    return m.toUpperCase();
  });
}

/** 공항 코드 자리(괄호 안, 화살표·하이픈 옆)의 헷갈린 글자: (1CN) → (ICN) — 공항 DB에 있을 때만 */
function fixAirportCodes(text: string, isAirport: (code: string) => boolean): string {
  const fix = (code: string) => {
    if (isAirport(code) && code === code.toUpperCase()) return code;
    return letterVariants(code).find(isAirport) ?? code;
  };
  let s = text.replace(/\(([A-Za-z0-9]{3})\)/g, (m, code) => {
    if (!/\d/.test(code) && code === code.toUpperCase()) return m;
    return `(${fix(code)})`;
  });
  s = s.replace(/(?<![A-Za-z0-9])([A-Za-z0-9]{3})(\s?(?:→|->|–|-)\s?)([A-Za-z0-9]{3})(?![A-Za-z0-9])/g, (_m, a, arrow, b) => {
    const fa = /\d/.test(a) ? fix(a) : a;
    const fb = /\d/.test(b) ? fix(b) : b;
    return `${fa}${arrow}${fb}`;
  });
  return s;
}

export interface OcrNormalizeOptions {
  /** 공항 코드 존재 확인(공항 DB) — 없으면 공항 코드 보정을 건너뛴다 */
  isAirport?: (code: string) => boolean;
}

/** OCR 텍스트에만 적용한다(PDF 글자층에는 이런 혼동이 없다) */
export function normalizeOcrText(text: string, options: OcrNormalizeOptions = {}): string {
  let s = text;
  s = fixMonthTokens(s);
  s = fixNumericRuns(s);
  s = fixFlightNumbers(s);
  s = fixCompactTimes(s);
  s = fixKrwAmounts(s);
  s = fixCodeCase(s);
  if (options.isAirport) s = fixAirportCodes(s, options.isAirport);
  return s;
}

/** 예약번호 등에 OCR이 헷갈리기 쉬운 글자(O·0·I·1·L·S·5·B·8·Z·2)가 있으면 true — 신뢰도를 낮춰 검수하게 */
export function hasAmbiguousChars(code: string): boolean {
  return /[O0I1LS5B8Z2]/.test(code.toUpperCase());
}
