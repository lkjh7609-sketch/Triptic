import { describe, expect, it } from 'vitest';
import { reconstructTripContent, type TripItineraryRaw } from './itineraryTransform';

const tripCity = { name: 'Tokyo, Japan', lat: 35.68, lng: 139.76 };

function baseRaw(overrides: Partial<TripItineraryRaw> = {}): TripItineraryRaw {
  return {
    days: [{ id: 'day-1', day_index: 1, city_name: 'Tokyo, Japan', city_lat: 35.68, city_lng: 139.76 }],
    items: [],
    expenses: [],
    ...overrides,
  };
}

describe('reconstructTripContent', () => {
  it('일반 장소 항목을 data[day]로 복원한다', () => {
    const raw = baseRaw({
      items: [
        {
          day_id: 'day-1',
          position: 0,
          type: 'place',
          title: 'Tokyo Tower',
          subtitle: null,
          category: 'sight',
          google_place_id: 'abc123',
          lat: 35.65,
          lng: 139.74,
          address: 'Minato',
          start_local: '2026-10-10T11:30',
          memo: '메모',
          extra: null,
        },
      ],
    });
    const result = reconstructTripContent(raw, tripCity);
    expect(result.data[1]).toEqual([
      {
        name: 'Tokyo Tower',
        address: 'Minato',
        lat: 35.65,
        lng: 139.74,
        time: '11:30',
        memo: '메모',
        placeId: 'abc123',
        category: 'sight',
      },
    ]);
  });

  it('숙소 항목은 hotels[day]로 분리되고 data에는 안 들어간다', () => {
    const raw = baseRaw({
      items: [
        {
          day_id: 'day-1',
          position: 0,
          type: 'lodging',
          title: 'Park Hyatt',
          subtitle: null,
          category: null,
          google_place_id: null,
          lat: 35.6,
          lng: 139.7,
          address: 'Shinjuku',
          start_local: null,
          memo: null,
          extra: null,
        },
      ],
    });
    const result = reconstructTripContent(raw, tripCity);
    expect(result.hotels[1]).toEqual({ name: 'Park Hyatt', address: 'Shinjuku', lat: 35.6, lng: 139.7 });
    expect(result.data[1]).toEqual([]);
  });

  it('식사 항목은 data에 mealType과 함께 남고 meals[day][slot]에도 복원된다', () => {
    const raw = baseRaw({
      items: [
        {
          day_id: 'day-1',
          position: 0,
          type: 'meal',
          title: '스시야',
          subtitle: '점심',
          category: null,
          google_place_id: null,
          lat: 35.6,
          lng: 139.7,
          address: '긴자',
          start_local: '2026-10-10T12:30',
          memo: null,
          extra: null,
        },
      ],
    });
    const result = reconstructTripContent(raw, tripCity);
    expect(result.data[1]).toEqual([
      { name: '스시야', address: '긴자', lat: 35.6, lng: 139.7, time: '12:30', memo: undefined, placeId: undefined, category: undefined, mealType: 'lunch' },
    ]);
    expect(result.meals[1]?.lunch).toEqual({ skip: false, name: '스시야', address: '긴자', lat: 35.6, lng: 139.7 });
  });

  it('항공편은 extra.leg로 outbound/return을 정확히 판정한다', () => {
    const outboundFlight = {
      flightNo: 'KE801',
      date: '2026-10-10',
      dep: { iata: 'ICN', name: 'Incheon', lat: 37.4691, lng: 126.451, time: '08:00' },
      arr: { iata: 'NRT', name: 'Narita', lat: 35.7719, lng: 140.3929, time: '10:30' },
    };
    const raw = baseRaw({
      items: [
        {
          day_id: 'day-1',
          position: 0,
          type: 'flight',
          title: 'KE801',
          subtitle: 'ICN → NRT',
          category: null,
          google_place_id: null,
          lat: 37.4691,
          lng: 126.451,
          address: null,
          start_local: '2026-10-10T08:00',
          memo: null,
          extra: { leg: 'outbound', flight: outboundFlight },
        },
      ],
    });
    const result = reconstructTripContent(raw, tripCity);
    expect(result.flights.outbound).toEqual(outboundFlight);
    expect(result.flights.return).toBeNull();
    expect(result.data[1]).toEqual([]);
  });

  it('note 타입(좌표 없는 방어적 보존 항목)은 재구성에서 제외한다', () => {
    const raw = baseRaw({
      items: [
        {
          day_id: 'day-1',
          position: 0,
          type: 'note',
          title: '좌표 없는 메모',
          subtitle: null,
          category: null,
          google_place_id: null,
          lat: null,
          lng: null,
          address: null,
          start_local: null,
          memo: null,
          extra: null,
        },
      ],
    });
    const result = reconstructTripContent(raw, tripCity);
    expect(result.data[1]).toEqual([]);
  });

  it('trip_days.city_name이 여행 기본 도시와 다르면 dayCities override로 복원한다', () => {
    const raw: TripItineraryRaw = {
      days: [
        { id: 'day-1', day_index: 1, city_name: 'Tokyo, Japan', city_lat: 35.68, city_lng: 139.76 },
        { id: 'day-2', day_index: 2, city_name: 'Osaka, Japan', city_lat: 34.69, city_lng: 135.5 },
      ],
      items: [],
      expenses: [],
    };
    const result = reconstructTripContent(raw, tripCity);
    expect(result.dayCities[1]).toBeUndefined();
    expect(result.dayCities[2]).toEqual({ name: 'Osaka, Japan', lat: 34.69, lng: 135.5 });
  });

  it('경비 항목을 day별로 복원한다', () => {
    const raw = baseRaw({
      expenses: [
        {
          day_id: 'day-1',
          category: 'food',
          description: '스시',
          amount: 1000,
          currency: 'JPY',
          fx_rate_to_base: 8.79,
          payment_method: 'card',
        },
      ],
    });
    const result = reconstructTripContent(raw, tripCity);
    expect(result.expenses[1]).toEqual([
      { desc: '스시', amount: 1000, currency: 'JPY', category: 'food', paymentMethod: 'card', fxRateToBase: 8.79 },
    ]);
  });

  it('day_id가 없는 경비는 건너뛴다', () => {
    const raw = baseRaw({
      expenses: [
        {
          day_id: null,
          category: 'other',
          description: '연결 안 된 경비',
          amount: 500,
          currency: 'KRW',
          fx_rate_to_base: null,
          payment_method: null,
        },
      ],
    });
    const result = reconstructTripContent(raw, tripCity);
    expect(result.expenses[1]).toBeUndefined();
  });
});
