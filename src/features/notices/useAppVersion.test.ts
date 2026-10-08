import { describe, expect, it } from 'vitest';
import { FALLBACK_APP_VERSION, latestUpdateVersion } from './useAppVersion';
import type { Announcement } from './noticeService';

function a(over: Partial<Announcement>): Announcement {
  return {
    id: Math.random().toString(36),
    kind: 'update',
    title: 't',
    body: 'b',
    version: null,
    pinned: false,
    published: true,
    published_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    ...over,
  };
}

describe('설정 화면 버전 = 가장 최근 업데이트 공지의 버전', () => {
  it('업데이트 공지가 없으면 null(→ 기본값 사용)', () => {
    expect(latestUpdateVersion(undefined)).toBeNull();
    expect(latestUpdateVersion([])).toBeNull();
    expect(FALLBACK_APP_VERSION).toBe('1.0.2');
  });

  it('여러 업데이트 중 게시일이 가장 늦은 것의 버전', () => {
    const list = [
      a({ version: '1.1.0', published_at: '2026-10-02T00:00:00Z' }),
      a({ version: '1.2.0', published_at: '2026-10-08T00:00:00Z' }),
      a({ version: '1.0.5', published_at: '2026-09-20T00:00:00Z' }),
    ];
    expect(latestUpdateVersion(list)).toBe('1.2.0');
  });

  it('고정(pinned) 여부와 상관없이 게시일 기준', () => {
    const list = [a({ version: '1.1.0', pinned: true, published_at: '2026-10-01T00:00:00Z' }), a({ version: '1.3.0', published_at: '2026-10-09T00:00:00Z' })];
    expect(latestUpdateVersion(list)).toBe('1.3.0');
  });

  it('공지(notice) 종류·버전 없는 업데이트·초안은 건너뛴다', () => {
    const list = [
      a({ kind: 'notice', version: '9.9.9', published_at: '2026-10-10T00:00:00Z' }),
      a({ version: '  ', published_at: '2026-10-09T00:00:00Z' }),
      a({ version: '8.8.8', published: false, published_at: '2026-10-08T00:00:00Z' }),
      a({ version: '1.1.0', published_at: '2026-10-02T00:00:00Z' }),
    ];
    expect(latestUpdateVersion(list)).toBe('1.1.0');
  });
});
