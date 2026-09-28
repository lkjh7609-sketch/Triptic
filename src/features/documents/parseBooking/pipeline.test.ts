import { describe, expect, it, vi } from 'vitest';
import { createAirportIndex } from './airports';
import type { extractWithLLM, LlmResult } from './llm';
import { runBookingPipeline } from './pipeline';
import type { ParsedFlight } from './schema';

const airports = createAirportIndex({
  ICN: { name: 'Incheon', city: 'Seoul', country: 'KR', lat: 37.46, lng: 126.44, tz: 'Asia/Seoul' },
  SYD: { name: 'Sydney', city: 'Sydney', country: 'AU', lat: -33.94, lng: 151.18, tz: 'Australia/Sydney' },
});

const leaf = <T,>(value: T | null, confidence = 0.95) => ({ value, confidence });

function llmFlight(overrides: Partial<ParsedFlight> = {}): ParsedFlight {
  return {
    kind: 'flight',
    carrierIata: leaf('KE'),
    carrierName: leaf('Korean Air'),
    flightNumber: leaf('KE401'),
    departure: { airportIata: leaf('ICN'), airportName: leaf(null, 0), terminal: leaf('2'), scheduledLocal: leaf('2026-10-07T19:40') },
    arrival: { airportIata: leaf('SYD'), airportName: leaf(null, 0), terminal: leaf('1'), scheduledLocal: leaf('2026-10-08T07:05') },
    bookingReference: leaf('Q0L8IM'),
    seat: leaf(null, 0),
    cabinClass: leaf('economy'),
    ...overrides,
  };
}

const input = (text: string, fromOcr: boolean) => ({ text, fromOcr, tripStartDate: '2026-10-07', tripEndDate: '2026-10-14' });

describe('runBookingPipeline', () => {
  it('OCR 결과는 보정 규칙을 거치고, 개인정보를 가린 글만 AI에 넘긴다', async () => {
    const extract = vi.fn<typeof extractWithLLM>(async (): Promise<LlmResult> => ({ bookings: [llmFlight()], parserUsed: 'llm/deepseek-flash' }));
    await runBookingPipeline(input('KE401 ICN 070CT26 19:40 SYD 080CT26 07:05 여권번호 M12345678', true), { airports, keys: {}, extract });
    const sent = extract.mock.calls[0][0];
    expect(sent).toContain('07OCT26');
    expect(sent).toContain('[PASSPORT]');
    expect(sent).not.toContain('M12345678');
  });

  it('PDF 글자층은 보정 규칙을 건너뛴다', async () => {
    const extract = vi.fn<typeof extractWithLLM>(async (): Promise<LlmResult> => ({ bookings: [llmFlight()], parserUsed: 'llm/deepseek-flash' }));
    await runBookingPipeline(input('KE401 070CT26', false), { airports, keys: {}, extract });
    expect(extract.mock.calls[0][0]).toContain('070CT26');
  });

  it('OCR이면 헷갈리는 글자가 든 예약번호 신뢰도를 0.6×가중치 아래로', async () => {
    const extract = async (): Promise<LlmResult> => ({ bookings: [llmFlight()], parserUsed: 'llm/deepseek-flash' });
    const ocr = await runBookingPipeline(input('KE401 ICN SYD 19:40', true), { airports, keys: {}, extract });
    const pdf = await runBookingPipeline(input('KE401 ICN SYD 19:40', false), { airports, keys: {}, extract });
    expect(ocr.bookings[0].bookingReference.confidence).toBeCloseTo(0.6 * 0.8);
    expect(pdf.bookings[0].bookingReference.confidence).toBeCloseTo(0.95 * 0.85);
  });

  it('AI가 실패하면 정규식 파서 결과로, 그것도 없으면 빈 결과 + 경고', async () => {
    const extract = async () => null;
    const withParser = await runBookingPipeline(input('KE401 ICN 2026-10-07 19:40 SYD 07:05', false), { airports, keys: {}, extract });
    expect(withParser.parserUsed).toMatch(/^flight\/generic-iata@/);
    expect((withParser.bookings[0] as ParsedFlight).flightNumber.value).toBe('KE401');
    const empty = await runBookingPipeline(input('영수증입니다', false), { airports, keys: {}, extract });
    expect(empty.bookings).toEqual([]);
    expect(empty.warnings.length).toBe(1);
  });

  it('빠른 결과에 문제가 있으면(핵심값 빔·검증 경고) 추론 켜고 한 번 더, 괜찮으면 한 번만', async () => {
    const good = vi.fn<typeof extractWithLLM>(async () => ({ bookings: [llmFlight()], parserUsed: 'llm/deepseek-flash' }));
    await runBookingPipeline(input('KE401', false), { airports, keys: {}, extract: good });
    expect(good.mock.calls.map((c) => c[6])).toEqual(['fast']);

    const incomplete = llmFlight({ arrival: { airportIata: leaf(null, 0), airportName: leaf(null, 0), terminal: leaf(null, 0), scheduledLocal: leaf(null, 0) } });
    const escalate = vi.fn<typeof extractWithLLM>(async (...args) => ({
      bookings: [args[6] === 'careful' ? llmFlight() : incomplete],
      parserUsed: 'llm/deepseek-flash',
    }));
    const { bookings } = await runBookingPipeline(input('KE401', false), { airports, keys: {}, extract: escalate });
    expect(escalate.mock.calls.map((c) => c[6])).toEqual(['fast', 'careful']);
    expect((bookings[0] as ParsedFlight).arrival.airportIata.value).toBe('SYD');
  });

  it('검증: 공항 DB에 없는 코드는 비우고 좌표를 채운다', async () => {
    const extract = async (): Promise<LlmResult> => ({
      bookings: [llmFlight({ arrival: { airportIata: leaf('ZZZ'), airportName: leaf(null, 0), terminal: leaf(null, 0), scheduledLocal: leaf('2026-10-08T07:05') } })],
      parserUsed: 'llm/deepseek-flash',
    });
    const { bookings } = await runBookingPipeline(input('KE401', false), { airports, keys: {}, extract });
    const f = bookings[0] as ParsedFlight;
    expect(f.arrival.airportIata.value).toBeNull();
    expect(f.departure.airportLat).toBeCloseTo(37.46);
  });
});
