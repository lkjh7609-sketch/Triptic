import { describe, expect, it, vi } from 'vitest';
import { linkDestinations, type LinkTarget } from './googleLinkRunner';
import type { PlaceCandidate } from './googleLinkMatch';

const target = (slug: string, lat: number, lng: number): LinkTarget => ({
  id: slug + '-id',
  slug,
  nameEn: slug,
  countryEn: 'Japan',
  lat,
  lng,
});
const place = (
  placeId: string,
  lat: number,
  lng: number,
  types = ['locality'],
): PlaceCandidate => ({ placeId, name: placeId, lat, lng, types });
const noWait = () => Promise.resolve();

describe('linkDestinations', () => {
  it('가까운 도시 장소는 저장하고, 먼 것·없는 것은 저장하지 않고 알린다', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const search = vi.fn(async (q: string) =>
      q.startsWith('tokyo')
        ? [place('P-tokyo', 35.68, 139.69)]
        : q.startsWith('osaka')
          ? [place('P-far', 10, 10)]
          : [],
    );
    const out = await linkDestinations(
      [
        target('tokyo', 35.6762, 139.6503),
        target('osaka', 34.69, 135.5),
        target('kyoto', 35.0, 135.7),
      ],
      { search, save, wait: noWait },
    );
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ slug: 'tokyo' }), 'P-tokyo');
    expect(out.map((o) => o.result.status)).toEqual(['matched', 'far', 'none']);
  });

  it('검색어는 영어 도시 이름 + 나라', async () => {
    const search = vi.fn().mockResolvedValue([]);
    await linkDestinations([target('kyoto', 35, 135)], { search, save: vi.fn(), wait: noWait });
    expect(search).toHaveBeenCalledWith('kyoto, Japan', { lat: 35, lng: 135 });
  });

  it('한도 초과(OVER_QUERY_LIMIT)는 쉬었다 다시 시도한다', async () => {
    const search = vi
      .fn()
      .mockRejectedValueOnce(new Error('OVER_QUERY_LIMIT'))
      .mockResolvedValueOnce([place('P', 35.68, 139.69)]);
    const waits: number[] = [];
    const out = await linkDestinations([target('tokyo', 35.6762, 139.6503)], {
      search,
      save: vi.fn().mockResolvedValue(undefined),
      wait: async (ms) => void waits.push(ms),
    });
    expect(search).toHaveBeenCalledTimes(2);
    expect(waits[0]).toBe(2000);
    expect(out[0].result.status).toBe('matched');
    expect(out[0].error).toBeUndefined();
  });

  it('다른 오류는 다시 시도하지 않고 그 도시를 오류로 기록한다', async () => {
    const search = vi.fn().mockRejectedValue(new Error('REQUEST_DENIED'));
    const save = vi.fn();
    const out = await linkDestinations([target('tokyo', 35, 139)], { search, save, wait: noWait });
    expect(search).toHaveBeenCalledTimes(1);
    expect(save).not.toHaveBeenCalled();
    expect(out[0].error).toBe('REQUEST_DENIED');
    expect(out[0].result.status).toBe('none');
  });

  it('저장이 실패하면 오류로 기록하되 다음 도시로 계속 간다', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('db')).mockResolvedValue(undefined);
    const search = vi.fn().mockResolvedValue([place('P', 35.68, 139.69)]);
    const out = await linkDestinations([target('a', 35.68, 139.69), target('b', 35.68, 139.69)], {
      search,
      save,
      wait: noWait,
    });
    expect(out[0].error).toBe('db');
    expect(out[1].error).toBeUndefined();
  });

  it('멈추라고 하면 그 자리에서 끝낸다, 진행 상황을 알린다', async () => {
    let stop = false;
    const progress: number[] = [];
    const out = await linkDestinations([target('a', 0, 0), target('b', 0, 0), target('c', 0, 0)], {
      search: vi.fn().mockResolvedValue([]),
      save: vi.fn(),
      wait: noWait,
      shouldStop: () => stop,
      onProgress: (_o, done) => {
        progress.push(done);
        if (done === 1) stop = true;
      },
    });
    expect(out).toHaveLength(1);
    expect(progress).toEqual([1]);
  });
});
