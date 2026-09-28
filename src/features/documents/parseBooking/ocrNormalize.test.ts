import { describe, expect, it } from 'vitest';
import { hasAmbiguousChars, normalizeOcrText } from './ocrNormalize';

const AIRPORTS = new Set(['ICN', 'GMP', 'SYD', 'NRT', 'KIX', 'SFO', 'LHR', 'SIN', 'HKG', 'CJU', 'BCN', 'LCN', 'IPC']);
const fix = (s: string) => normalizeOcrText(s, { isAirport: (c) => AIRPORTS.has(c) });

describe('normalizeOcrText — 고쳐야 하는 것', () => {
  it.each([
    // 월 약어(DDMMMYY·DD MMM YYYY)의 O·D·S·G ↔ 0·5·6
    ['070CT26 (수) 19:40', '07OCT26 (수) 19:40'],
    ['03 N0V 2026', '03 NOV 2026'],
    ['070EC26 12:40', '07DEC26 12:40'],
    ['05 5EP 26', '05 SEP 26'],
    ['14 AU6 2026', '14 AUG 2026'],
    ['1O JAN 27', '10 JAN 27'],
    // 편명: 항공사 코드 첫 글자 O→0, 번호 속 O·l→0·1, 띄어 쓴 숫자 코드(02 102)
    ['아시아나항공 0Z104', '아시아나항공 OZ104'],
    ['02 102 ICN 인천', 'OZ 102 ICN 인천'],
    ['02 105NRT 도쿄', 'OZ 105NRT 도쿄'],
    ['EK O19 DXB MAN', 'EK 019 DXB MAN'],
    ['KE 4O1', 'KE 401'],
    ['SQ6O8', 'SQ608'],
    ['7C11O2', '7C1102'],
    // 숫자 덩어리(시각·날짜·금액·우편번호)
    ['O8:1O 출발', '08:10 출발'],
    ['2O26.11.O3(화)', '2026.11.03(화)'],
    ['1,2O4,3OO원', '1,204,300원'],
    ['Anglais, 0600o Nice', 'Anglais, 06000 Nice'],
    // 12시간제 시각의 빠진 콜론
    ['Mon, Nov 16, 2026 1140pm', 'Mon, Nov 16, 2026 11:40pm'],
    ['Boarding 6 15 AM', 'Boarding 6:15 AM'],
    // 원화: ₩ → W·\, 천 단위 쉼표 → 점
    ['W612,480 (3박)', '₩612,480 (3박)'],
    ['운임 KRW 1284.300', '운임 KRW 1,284,300'],
    ['358.000원', '358,000원'],
    // 코드 속 소문자 하나
    ['BOOKING REF W7zK2M', 'BOOKING REF W7ZK2M'],
    // 공항 코드 자리(괄호·화살표)
    ['서울/인천 (1CN)', '서울/인천 (ICN)'],
    ['SF0 → NRT', 'SFO → NRT'],
  ])('%s → %s', (input, expected) => {
    expect(fix(input)).toBe(expected);
  });
});

describe('normalizeOcrText — 건드리면 안 되는 것', () => {
  it.each([
    // 예약번호·항공권 번호 — 글자·숫자가 모두 올 수 있어 고치지 않는다
    '예약번호 6X2KQP',
    'PNR Q0L8IM',
    'Confirmation HJK0O1',
    'Booking ref L1X5QO',
    '항공권 번호 180-2384756190',
    'Ticket 081 2193847560',
    'Itinerary # 7312894455102',
    // 정상 편명·좌석·게이트
    'BA 2714 / 5J 912 / LH1134 / EK 323 / KE401',
    'Seat 32A · Gate G92 · 14C',
    // 숫자만 있는 번호를 항공사로 착각하지 않기
    'Room 10 102',
    'Gate 08 123',
    // 전화·우편번호·금액
    '문의 1588-2001',
    '+82 2 1234 5678',
    'New York, NY 10014',
    'USD 1,048.20 · EUR 1,386.00 · €612.40 · AUD 2,757.37',
    '₩ 1,284,300 · 358,000원',
    // 날짜·시각
    '2026-10-07T16:05',
    'Nov 16, 2026 · 11:40pm',
    '07OCT26 20 MAY 2026 Wed 07 Oct 2026',
    // 영단어·수하물·터미널
    'Status OK · Hotel ICON · 1PC 23KG · Terminal 1 · T2',
    // 이미 맞는 공항 코드
    '서울/인천 (ICN) → 시드니 (SYD)',
  ])('%s', (input) => {
    expect(fix(input)).toBe(input);
  });
});

describe('hasAmbiguousChars', () => {
  it('예약번호에 헷갈리기 쉬운 글자가 있으면 true', () => {
    expect(hasAmbiguousChars('Q0L8IM')).toBe(true);
    expect(hasAmbiguousChars('HJK0O1')).toBe(true);
    expect(hasAmbiguousChars('6X2KQP')).toBe(true); // 2
    expect(hasAmbiguousChars('QF7T9M')).toBe(false);
    expect(hasAmbiguousChars('K7M4XP')).toBe(false);
  });
});
