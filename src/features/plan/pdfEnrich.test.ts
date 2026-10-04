import { describe, expect, it } from 'vitest';
import { estimateHop, summarizeRoute } from './pdfEnrich';

describe('대중교통 어림', () => {
  it('가까우면 도보, 시내는 지하철·버스, 멀면 기차', () => {
    const shibuya = { lat: 35.658, lng: 139.7016 };
    expect(estimateHop(shibuya, { lat: 35.6655, lng: 139.7016 })).toMatchObject({ modes: ['walk'], estimated: true });
    const shinjuku = estimateHop(shibuya, { lat: 35.6896, lng: 139.7006 });
    expect(shinjuku.modes).toEqual(['metroOrBus']);
    expect(shinjuku.minutes).toBeGreaterThan(10);
    expect(estimateHop(shibuya, { lat: 35.233, lng: 139.107 }).modes).toEqual(['train']); // 하코네
  });

  it('Google 경로 → 탈것을 순서대로(같은 탈것이 이어지면 한 번), 대중교통이 없으면 도보', () => {
    const route = (steps: unknown[], seconds: number) =>
      ({ routes: [{ legs: [{ duration: { value: seconds, text: '' }, steps }] }] }) as unknown as google.maps.DirectionsResult;
    expect(
      summarizeRoute(
        route(
          [
            { travel_mode: 'WALKING' },
            { travel_mode: 'TRANSIT', transit: { line: { vehicle: { type: 'SUBWAY' } } } },
            { travel_mode: 'TRANSIT', transit: { line: { vehicle: { type: 'METRO_RAIL' } } } },
            { travel_mode: 'TRANSIT', transit: { line: { vehicle: { type: 'BUS' } } } },
          ],
          1500,
        ),
      ),
    ).toEqual({ modes: ['subway', 'bus'], minutes: 25, estimated: false });
    expect(summarizeRoute(route([{ travel_mode: 'WALKING' }], 420))).toEqual({ modes: ['walk'], minutes: 7, estimated: false });
  });
});
