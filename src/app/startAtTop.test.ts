import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SCROLL_STORAGE_KEY, startAtTop } from './startAtTop';

function navigationType(type: string | null) {
  vi.spyOn(performance, 'getEntriesByType').mockReturnValue((type ? [{ type }] : []) as unknown as PerformanceEntryList);
}

describe('startAtTop', () => {
  beforeEach(() => {
    sessionStorage.setItem(SCROLL_STORAGE_KEY, '{"abc":1200}');
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  });
  afterEach(() => vi.restoreAllMocks());

  it('주소로 처음 열거나 새로고침하면 저장된 스크롤 위치를 지우고 맨 위로 간다', () => {
    for (const type of ['navigate', 'reload']) {
      sessionStorage.setItem(SCROLL_STORAGE_KEY, '{"abc":1200}');
      navigationType(type);
      startAtTop();
      expect(sessionStorage.getItem(SCROLL_STORAGE_KEY)).toBeNull();
    }
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('브라우저의 뒤로·앞으로 가기로 열린 로드는 건드리지 않는다', () => {
    navigationType('back_forward');
    startAtTop();
    expect(sessionStorage.getItem(SCROLL_STORAGE_KEY)).toBe('{"abc":1200}');
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('탐색 기록을 알 수 없으면(구형 브라우저) 맨 위에서 시작한다', () => {
    navigationType(null);
    startAtTop();
    expect(sessionStorage.getItem(SCROLL_STORAGE_KEY)).toBeNull();
  });
});
