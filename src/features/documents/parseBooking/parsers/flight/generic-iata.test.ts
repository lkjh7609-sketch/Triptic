import { readFileSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';
import airportsData from '../../../../../../data/airports.json';
import { createAirportIndex } from '../../airports';
import { genericIataParser } from './generic-iata';
import type { ParseContext } from '../registry';

/**
 * 04-document-ai.md §11 골든 테스트 — 실제 사용자 문서 대신 §11.2 원칙에 따른
 * 합성(synthetic) 문서로 구성했다(tests/fixtures/bookings/manifest.json 참고).
 * 전용 항공사 파서가 아직 없어 이 스위트는 폴백 파서(generic-iata) 하나만
 * 검증한다 — 향후 전용 파서가 늘면 같은 픽스처 디렉터리에 케이스를 추가한다.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, '../../../../../../tests/fixtures/bookings/flight');

const ctx: ParseContext = {
  tripStartDate: '2026-05-01',
  tripEndDate: '2026-06-30',
  locale: 'en',
  airports: createAirportIndex(airportsData),
};

const txtFiles = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.txt'));

describe('genericIataParser 골든 테스트', () => {
  it.each(txtFiles)('%s', (file) => {
    const text = readFileSync(resolve(FIXTURES_DIR, file), 'utf-8');
    const expectedPath = resolve(FIXTURES_DIR, file.replace(/\.txt$/, '.expected.json'));
    const expected = JSON.parse(readFileSync(expectedPath, 'utf-8'));

    expect(genericIataParser.detect(text)).toBeGreaterThanOrEqual(0.7);

    const [booking] = genericIataParser.parse(text, ctx);
    if (booking.kind !== 'flight') throw new Error('expected a flight booking');
    const flight = booking;
    expect(flight.carrierIata.value).toBe(expected.carrierIata);
    expect(flight.flightNumber.value).toBe(expected.flightNumber);
    expect(flight.departure.airportIata.value).toBe(expected.departureAirportIata);
    expect(flight.arrival.airportIata.value).toBe(expected.arrivalAirportIata);
    expect(flight.departure.scheduledLocal.value).toBe(expected.departureScheduledLocal);
    expect(flight.arrival.scheduledLocal.value).toBe(expected.arrivalScheduledLocal);
    expect(flight.bookingReference.value).toBe(expected.bookingReference);
  });
});
