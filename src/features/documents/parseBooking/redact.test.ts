import { describe, it, expect } from 'vitest';
import { redact } from './redact';

/**
 * 04-document-ai.md §5.2 "이 테스트가 깨지면 배포 불가" 원문 케이스 그대로.
 */
describe('redact', () => {
  const CASES: Array<[string, string]> = [
    ['Passport No: M12345678', 'M12345678'],
    ['여권번호 M87654321', 'M87654321'],
    ['Card 4111-1111-1111-1111', '4111'],
    ['카드 4111 1111 1111 1111', '4111'],
    ['주민번호 900101-1234567', '900101'],
    ['DOB: 1990-01-01', '1990-01-01'],
    ['email: a.b+c@example.co.kr', 'example.co.kr'],
    ['Tel +82-10-1234-5678', '1234'],
  ];

  it.each(CASES)('%s 를 가린다', (input, secret) => {
    expect(redact(input).text).not.toContain(secret);
  });

  it('편명과 공항코드는 남긴다', () => {
    const { text } = redact('KE801 ICN 08:00 NRT 11:00 2026-05-20');
    expect(text).toContain('KE801');
    expect(text).toContain('ICN');
    expect(text).toContain('08:00');
  });

  it('마스킹된 값의 원문은 hits에도 남지 않는다', () => {
    const { hits } = redact('Passport No: M12345678');
    expect(hits.join(' ')).not.toContain('M12345678');
    expect(hits).toContain('[PASSPORT]');
  });

  it('마스킹할 게 없으면 원문 그대로 반환한다', () => {
    const input = '신주쿠 교엔 국립정원 산책';
    expect(redact(input).text).toBe(input);
    expect(redact(input).hits).toEqual([]);
  });
});
