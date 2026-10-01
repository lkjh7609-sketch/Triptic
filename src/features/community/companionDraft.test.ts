import { afterEach, describe, expect, it } from 'vitest';
import { clearCompanionDraft, readCompanionDraft, writeCompanionDraft, type CompanionDraft } from './companionDraft';

afterEach(() => localStorage.clear());

const base: Omit<CompanionDraft, 'savedAt'> = {
  title: '',
  body: '',
  destinationId: '',
  startDate: null,
  endDate: null,
  datesTbd: false,
  groupSize: 2,
  prefs: { gender: 'any', ages: [], tags: [] },
};

describe('companionDraft', () => {
  it('내용이 없으면 저장하지 않고, 저장돼 있던 것도 지운다', () => {
    expect(writeCompanionDraft('u', { ...base, title: '오사카' })).toBe(true);
    expect(writeCompanionDraft('u', base)).toBe(false);
    expect(readCompanionDraft('u')).toBeNull();
  });

  it('쓴 내용을 그대로 돌려준다', () => {
    const draft = {
      ...base,
      title: '오사카 같이',
      body: '먹방',
      destinationId: 'd1',
      startDate: '2026-10-12',
      endDate: '2026-10-16',
      groupSize: 4,
      prefs: { gender: 'female' as const, ages: ['20s_late' as const], tags: ['photo' as const] },
    };
    writeCompanionDraft('u', draft, 123);
    expect(readCompanionDraft('u')).toEqual({ ...draft, datesTbd: false, savedAt: 123 });
  });

  it('날짜 미정은 날짜 없이 저장된다', () => {
    writeCompanionDraft('u', { ...base, title: 'a', datesTbd: true });
    expect(readCompanionDraft('u')).toMatchObject({ datesTbd: true, startDate: null, endDate: null });
  });

  it('사용자별로 따로 저장되고 지울 수 있다', () => {
    writeCompanionDraft('u1', { ...base, title: 'a' });
    expect(readCompanionDraft('u2')).toBeNull();
    clearCompanionDraft('u1');
    expect(readCompanionDraft('u1')).toBeNull();
  });

  it('깨진 값은 걸러낸다(옛 나이대 키·범위 밖 인원·거꾸로 된 날짜)', () => {
    localStorage.setItem(
      'triptic-companion-draft:u',
      JSON.stringify({ title: 'a', startDate: '2026-10-20', endDate: '2026-10-10', groupSize: 99, prefs: { gender: 'x', ages: ['20s', '40s'], tags: ['nope'] } }),
    );
    expect(readCompanionDraft('u')).toMatchObject({ startDate: null, endDate: null, groupSize: 20, prefs: { gender: 'any', ages: ['40s'], tags: [] } });
    localStorage.setItem('triptic-companion-draft:u', '{broken');
    expect(readCompanionDraft('u')).toBeNull();
  });
});
