import { afterEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
vi.mock('@/shared/api/supabaseClient', () => ({ getSupabaseClient: () => ({ rpc }) }));

const { fetchNearbyRecommendations, isOutOfRange, needsServerCoords } = await import('./aiRecommendations');
const { fetchCityDescription } = await import('@/features/home/cityDescription');

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

afterEach(() => {
  rpc.mockReset();
  fetchMock.mockReset();
});

describe('AI 결과는 DB 캐시에 있으면 /api(LLM)를 부르지 않는다', () => {
  it('주변 추천: 캐시 적중 → 정확한 키로 조회하고 API 호출 없음', async () => {
    rpc.mockResolvedValue({ data: { recommendations: [{ name: '신주쿠 교엔' }] }, error: null });
    const recs = await fetchNearbyRecommendations({ placeName: '  신주쿠 교엔 국립정원 ', city: 'Tokyo', locale: 'ko-KR' });
    expect(recs).toEqual([{ name: '신주쿠 교엔' }]);
    expect(rpc).toHaveBeenCalledWith('get_ai_cache', {
      p_kind: 'nearby',
      p_city_key: 'tokyo',
      p_place_key: '신주쿠 교엔 국립정원',
      p_category: 'all',
      p_locale: 'ko',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('주변 추천: 캐시에 없거나 RPC 오류면 /api/recommend로 넘어간다', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'function does not exist' } });
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ recommendations: [{ name: 'A' }] }) });
    expect(await fetchNearbyRecommendations({ placeName: 'X', city: 'Y', locale: 'en' })).toEqual([{ name: 'A' }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('도시 소개: 캐시 적중이면 API 호출 없음, 없으면 /api/cityDesc', async () => {
    rpc.mockResolvedValueOnce({ data: { description: '도쿄는…' }, error: null });
    expect(await fetchCityDescription('Tokyo, Japan', 'ko')).toBe('도쿄는…');
    expect(rpc).toHaveBeenLastCalledWith('get_ai_cache', expect.objectContaining({ p_kind: 'city_desc', p_city_key: 'tokyo, japan', p_place_key: '' }));
    expect(fetchMock).not.toHaveBeenCalled();

    rpc.mockResolvedValueOnce({ data: null, error: null });
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ description: 'Paris is…' }) });
    expect(await fetchCityDescription('Paris, France', 'en')).toBe('Paris is…');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('needsServerCoords', () => {
  it('좌표도 없고 서버가 찾아본 적도 없는 항목이 있을 때만 서버에 채우기를 요청한다', () => {
    expect(needsServerCoords([{ name: 'A', lat: 1, lng: 2 }])).toBe(false);
    expect(needsServerCoords([{ name: 'A', coordsChecked: true }])).toBe(false);
    expect(needsServerCoords([{ name: 'A', lat: 1, lng: 2 }, { name: 'B' }])).toBe(true);
  });
});

describe('isOutOfRange (1.5km)', () => {
  const osakaStation = { lat: 34.7025, lng: 135.4959 };
  it('오사카역 기준 우메다 스카이빌딩(약 0.6km)은 통과, 도쿄 롯폰기(약 400km)는 제외', () => {
    expect(isOutOfRange({ lat: 34.7052872, lng: 135.4896527 }, osakaStation)).toBe(false);
    expect(isOutOfRange({ lat: 35.661469, lng: 139.7362366 }, osakaStation)).toBe(true);
  });
  it('기준점이나 좌표가 없으면 거르지 않는다', () => {
    expect(isOutOfRange({ lat: 35.66, lng: 139.73 }, null)).toBe(false);
    expect(isOutOfRange({}, osakaStation)).toBe(false);
  });
});
