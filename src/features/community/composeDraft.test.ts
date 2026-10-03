import { afterEach, describe, expect, it } from 'vitest';
import { clearDraft, isEmptyDraft, readDraft, writeDraft } from './composeDraft';

afterEach(() => localStorage.clear());

const base = {
  destinationId: '',
  body: '',
  tripId: '',
  allowCopy: false,
  images: [],
  category: '' as const,
  tags: [] as string[],
};

describe('composeDraft', () => {
  it('내용이 있으면 저장하고 그대로 읽는다', () => {
    const saved = writeDraft('u1', { ...base, destinationId: 'd1', body: '교토 다녀왔어요', images: [{ storagePath: 'u1/a.webp', width: 10, height: 20 }] }, 1000);
    expect(saved).toBe(true);
    expect(readDraft('u1')).toEqual({
      destinationId: 'd1',
      body: '교토 다녀왔어요',
      tripId: '',
      allowCopy: false,
      images: [{ storagePath: 'u1/a.webp', width: 10, height: 20 }],
      category: '',
      tags: [],
      savedAt: 1000,
    });
  });

  it('비어 있으면 저장하지 않고 이전 저장도 지운다', () => {
    writeDraft('u1', { ...base, body: '글' });
    expect(writeDraft('u1', { ...base, body: '   ' })).toBe(false);
    expect(readDraft('u1')).toBeNull();
  });

  it('사용자마다 따로 저장되고, 지울 수 있다', () => {
    writeDraft('u1', { ...base, body: 'a' });
    writeDraft('u2', { ...base, body: 'b' });
    expect(readDraft('u1')?.body).toBe('a');
    clearDraft('u1');
    expect(readDraft('u1')).toBeNull();
    expect(readDraft('u2')?.body).toBe('b');
  });

  it('깨진 값·모양이 이상한 사진은 무시한다', () => {
    localStorage.setItem('triptic-compose-draft:u1', '{oops');
    expect(readDraft('u1')).toBeNull();
    localStorage.setItem('triptic-compose-draft:u1', JSON.stringify({ body: '글', images: [{ storagePath: 1 }, { storagePath: 'p', width: 1, height: 2 }] }));
    expect(readDraft('u1')?.images).toEqual([{ storagePath: 'p', width: 1, height: 2 }]);
  });

  it('분류·태그를 같이 저장하고, 예전 임시저장(없는 값)은 빈 값으로 읽는다', () => {
    writeDraft('u1', { ...base, body: '글', category: 'qna', tags: ['바투동굴', '#Grab'] }, 5);
    expect(readDraft('u1')).toMatchObject({ category: 'qna', tags: ['바투동굴', 'Grab'] });
    localStorage.setItem(
      'triptic-compose-draft:u2',
      JSON.stringify({ body: '예전 글', category: 'oops', tags: 'x' }),
    );
    expect(readDraft('u2')).toMatchObject({ category: '', tags: [] });
  });

  it('isEmptyDraft: 태그만 있어도 비어 있지 않다', () => {
    expect(isEmptyDraft({ ...base, tags: ['a'] })).toBe(false);
  });

  it('isEmptyDraft: 사진만 있어도 비어 있지 않다', () => {
    expect(isEmptyDraft({ ...base })).toBe(true);
    expect(isEmptyDraft({ ...base, images: [{ storagePath: 'p', width: 1, height: 1 }] })).toBe(false);
  });
});
