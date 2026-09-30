import { beforeEach, describe, expect, it, vi } from 'vitest';

const { saveTrip } = vi.hoisted(() => ({ saveTrip: vi.fn() }));
vi.mock('@/shared/api/tripService', async () => {
  const actual = await vi.importActual<typeof import('@/shared/api/tripService')>('@/shared/api/tripService');
  return { ...actual, tripService: { ...actual.tripService, saveTrip, toLocalProject: actual.tripService.toLocalProject.bind(actual.tripService) } };
});

import { TripLimitError } from '@/shared/api/tripService';
import {
  GUEST_TRIP_LIMIT,
  GuestTripLimitError,
  createGuestTrip,
  deleteGuestTrip,
  getGuestTrip,
  importGuestTrips,
  isGuestTripId,
  isLocalTripId,
  listGuestTrips,
  renameGuestTrip,
  resetGuestTripsCacheForTest,
  updateGuestTripContent,
} from './guestTrips';
import { SAMPLE_TRIP_ID } from './sampleTrip';

const project = { city: 'Tokyo, Japan', cityLat: 35.6, cityLng: 139.7, startDate: '2026-10-15', endDate: '2026-10-18', totalDays: 4, currency: 'JPY' };

beforeEach(() => {
  localStorage.clear();
  resetGuestTripsCacheForTest();
  saveTrip.mockReset();
});

describe('임시 여행 저장소', () => {
  it('만들면 이 기기에 저장되고 다시 읽으면 그대로 나온다', () => {
    const row = createGuestTrip(project, '도쿄 여행');
    expect(isGuestTripId(row.id)).toBe(true);
    expect(isLocalTripId(row.id)).toBe(true);
    expect(isLocalTripId(SAMPLE_TRIP_ID)).toBe(true);
    expect(isLocalTripId('3f1c2d4e-0000-4000-8000-000000000000')).toBe(false);
    resetGuestTripsCacheForTest(); // 새로 고침을 흉내: 메모리 캐시 없이 저장소에서 다시 읽는다
    expect(getGuestTrip(row.id)?.title).toBe('도쿄 여행');
    expect(getGuestTrip(row.id)?.total_days).toBe(4);
  });

  it(`임시 여행은 ${GUEST_TRIP_LIMIT}개까지만 만들 수 있다`, () => {
    for (let i = 0; i < GUEST_TRIP_LIMIT; i++) createGuestTrip(project, `여행 ${i}`);
    expect(() => createGuestTrip(project, '하나 더')).toThrow(GuestTripLimitError);
    expect(listGuestTrips()).toHaveLength(GUEST_TRIP_LIMIT);
  });

  it('일정 내용·이름을 고치고 지운다', () => {
    const row = createGuestTrip(project, '도쿄');
    updateGuestTripContent(row.id, { data: { 1: [{ name: '센소지' }] } });
    expect(getGuestTrip(row.id)?.content?.data).toEqual({ 1: [{ name: '센소지' }] });
    renameGuestTrip(row.id, '도쿄 3박');
    expect(getGuestTrip(row.id)?.title).toBe('도쿄 3박');
    deleteGuestTrip(row.id);
    expect(getGuestTrip(row.id)).toBeNull();
  });
});

describe('로그인 후 계정으로 옮기기', () => {
  it('성공한 여행만 이 기기에서 지우고, 미리 정한 uuid로 저장해 다시 시도해도 중복되지 않게 한다', async () => {
    const a = createGuestTrip(project, '여행 A');
    const b = createGuestTrip(project, '여행 B');
    saveTrip.mockImplementation(async (p: { supabaseId?: string }, name: string) => ({ id: p.supabaseId, title: name }));
    const result = await importGuestTrips();
    expect(result.imported.map((r) => r.guestId)).toEqual([a.id, b.id]);
    expect(listGuestTrips()).toHaveLength(0);
    const ids = saveTrip.mock.calls.map(([p]) => (p as { supabaseId: string }).supabaseId);
    expect(new Set(ids).size).toBe(2);
    expect(ids.every((id) => /^[0-9a-f-]{36}$/.test(id))).toBe(true);
    expect(saveTrip.mock.calls[0][1]).toBe('여행 A');
  });

  it('로그인 이벤트가 겹쳐 여러 번 불려도 한 번만 옮긴다', async () => {
    createGuestTrip(project, '여행 A');
    let release: () => void = () => {};
    saveTrip.mockImplementation(
      (p: { supabaseId?: string }) => new Promise((resolve) => (release = () => resolve({ id: p.supabaseId, title: 'x' }))),
    );
    const first = importGuestTrips();
    const second = importGuestTrips();
    expect(second).toBe(first);
    release();
    const result = await first;
    expect(saveTrip).toHaveBeenCalledTimes(1);
    expect(result.imported).toHaveLength(1);
  });

  it('무료 한도에 걸리면 남은 여행은 이 기기에 그대로 둔다', async () => {
    createGuestTrip(project, '여행 A');
    const b = createGuestTrip(project, '여행 B');
    saveTrip
      .mockImplementationOnce(async (p: { supabaseId?: string }) => ({ id: p.supabaseId, title: 'A' }))
      .mockRejectedValueOnce(new TripLimitError('한도'));
    const result = await importGuestTrips();
    expect(result.imported).toHaveLength(1);
    expect(result.limitReached).toBe(true);
    expect(listGuestTrips().map((r) => r.id)).toEqual([b.id]);
  });

  it('서버가 돌려준 한도 오류(hint)도 한도로 본다', async () => {
    createGuestTrip(project, '여행 A');
    saveTrip.mockRejectedValueOnce({ hint: 'trip_limit_reached', message: 'limit' });
    const result = await importGuestTrips();
    expect(result.limitReached).toBe(true);
    expect(listGuestTrips()).toHaveLength(1);
  });

  it('네트워크 등으로 실패하면 지우지 않고 실패로 알린다', async () => {
    createGuestTrip(project, '여행 A');
    saveTrip.mockRejectedValueOnce(new Error('network'));
    const result = await importGuestTrips();
    expect(result.failed).toBe(true);
    expect(result.limitReached).toBe(false);
    expect(listGuestTrips()).toHaveLength(1);
  });

  it('옮길 게 없으면 서버를 부르지 않는다', async () => {
    const result = await importGuestTrips();
    expect(result.imported).toHaveLength(0);
    expect(saveTrip).not.toHaveBeenCalled();
  });
});
