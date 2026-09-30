import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
const getSession = vi.fn();
vi.mock('@/shared/api/supabaseClient', () => ({ getSupabaseClient: () => ({ rpc, auth: { getSession } }) }));

const { AiLimitError, fetchNearbyRecommendations, isOutOfRange, needsServerCoords } = await import('./aiRecommendations');
const { fetchCityDescription } = await import('@/features/home/cityDescription');

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

// 기본은 로그인한 상태 — 비로그인 동작은 아래 별도 describe에서
beforeEach(() => {
  getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } });
});

afterEach(() => {
  rpc.mockReset();
  fetchMock.mockReset();
  getSession.mockReset();
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

describe('기준 좌표가 있으면 1.5km 장소 풀부터', () => {
  const row = (id: string, distance: number) => ({
    place_id: id, name: id, lat: 34.7, lng: 135.49, address: null, category: 'spot',
    category_label: null, signature_menu: null, price_range: null, reason: null, tip: null, distance_m: distance,
  });
  const base = { placeName: '오사카역', city: 'Osaka', locale: 'ko', lat: 34.7025, lng: 135.4959, placeId: 'base' };

  it('반경 안에 5곳 이상이면 AI(/api) 없이 풀만 쓴다 — 기준 장소 자신은 뺀다', async () => {
    rpc.mockResolvedValue({ data: [row('base', 0), row('a', 100), row('b', 200), row('c', 300), row('d', 400), row('e', 500)], error: null });
    const recs = await fetchNearbyRecommendations(base);
    expect(recs.map((r) => r.placeId)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(rpc).toHaveBeenCalledWith('get_nearby_ai_places', expect.objectContaining({ p_radius_m: 1500, p_locale: 'ko' }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('5곳 미만이면 서버에 요청해 AI로 더 받는다(기준 place_id 전달)', async () => {
    rpc.mockResolvedValue({ data: [row('a', 100), row('b', 200), row('c', 300), row('d', 400)], error: null });
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ recommendations: [{ name: 'a' }, { name: 'new' }] }) });
    expect(await fetchNearbyRecommendations(base)).toEqual([{ name: 'a' }, { name: 'new' }]);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ lat: 34.7025, lng: 135.4959, placeId: 'base' });
  });
});

describe('AI 생성 API는 로그인 사용자에게만 열려 있다', () => {
  it('로그인 상태면 토큰을 Bearer로 보낸다', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ recommendations: [] }) });
    await fetchNearbyRecommendations({ placeName: 'X', city: 'Y', locale: 'en' });
    expect((fetchMock.mock.calls[0][1] as { headers: Record<string, string> }).headers.Authorization).toBe('Bearer tok');
  });

  it('비로그인이면 추천은 서버를 부르지 않고 로그인 필요 오류를 낸다(캐시 적중은 그대로 보인다)', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    rpc.mockResolvedValue({ data: null, error: null });
    await expect(fetchNearbyRecommendations({ placeName: 'X', city: 'Y', locale: 'en' })).rejects.toThrow('login_required');
    expect(fetchMock).not.toHaveBeenCalled();

    rpc.mockResolvedValue({ data: { recommendations: [{ name: '캐시' }] }, error: null });
    expect(await fetchNearbyRecommendations({ placeName: 'X2', city: 'Y', locale: 'en' })).toEqual([{ name: '캐시' }]);
  });

  it('비로그인 도시 소개는 캐시만 보고, 없으면 생성 API를 부르지 않고 null', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await fetchCityDescription('Paris, France', 'en')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('서버가 401을 돌려주면(토큰 만료 등) 로그인 필요 오류', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
    await expect(fetchNearbyRecommendations({ placeName: 'X', city: 'Y', locale: 'en' })).rejects.toThrow('login_required');
  });
});

describe('오늘의 AI 한도', () => {
  it('서버가 429(daily_limit)를 주면 한도 오류(한도 포함)로 알린다', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    fetchMock.mockResolvedValue({ ok: false, status: 429, json: async () => ({ error: 'daily_limit', limit: 10 }) });
    const err = await fetchNearbyRecommendations({ placeName: 'X', city: 'Y', locale: 'en' }).catch((e) => e);
    expect(err).toBeInstanceOf(AiLimitError);
    expect(err.limit).toBe(10);
  });

  it('호출 빈도 제한(rate_limited)은 한도 오류가 아니다', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    fetchMock.mockResolvedValue({ ok: false, status: 429, json: async () => ({ error: 'rate_limited' }) });
    const err = await fetchNearbyRecommendations({ placeName: 'X', city: 'Y', locale: 'en' }).catch((e) => e);
    expect(err).not.toBeInstanceOf(AiLimitError);
  });

  it('도시 소개는 한도를 넘으면 오류 없이 소개만 비워 둔다', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    fetchMock.mockResolvedValue({ ok: false, status: 429, json: async () => ({ error: 'daily_limit', limit: 10 }) });
    expect(await fetchCityDescription('Rome, Italy', 'en')).toBeNull();
  });
});
