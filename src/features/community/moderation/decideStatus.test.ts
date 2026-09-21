import { describe, expect, it } from 'vitest';
import { decideStatus } from './decideStatus';

describe('decideStatus', () => {
  it('결정론적 신호(금칙어/스팸)가 0.85 이상이면 즉시 removed', () => {
    const result = decideStatus('post', { badword: 1, spam: 0, textClassifier: 0, imageClassifier: 0 });
    expect(result).toEqual({ status: 'removed', score: 1, failClosed: false });
  });

  it('분류기가 실패(null)하면 fail closed — 글은 pending_review로 간다 (통과시키지 않는다)', () => {
    const result = decideStatus('post', { badword: 0, spam: 0, textClassifier: null, imageClassifier: 0 });
    expect(result.status).toBe('pending_review');
    expect(result.failClosed).toBe(true);
  });

  it('이미지 분류기가 실패해도 fail closed 적용된다', () => {
    const result = decideStatus('post', { badword: 0, spam: 0, textClassifier: 0.1, imageClassifier: null });
    expect(result.status).toBe('pending_review');
    expect(result.failClosed).toBe(true);
  });

  it('댓글은 pending_review 상태가 없어 fail closed 시 removed로 간다', () => {
    const result = decideStatus('comment', { badword: 0, spam: 0, textClassifier: null, imageClassifier: 0 });
    expect(result.status).toBe('removed');
    expect(result.failClosed).toBe(true);
  });

  it('종합 점수가 0.6~0.85면 글은 pending_review', () => {
    const result = decideStatus('post', { badword: 0, spam: 0, textClassifier: 0.7, imageClassifier: 0 });
    expect(result.status).toBe('pending_review');
    expect(result.failClosed).toBe(false);
  });

  it('종합 점수가 0.85 이상이면 removed', () => {
    const result = decideStatus('post', { badword: 0, spam: 0, textClassifier: 0.9, imageClassifier: 0 });
    expect(result.status).toBe('removed');
  });

  it('종합 점수가 0.6 미만이면 published', () => {
    const result = decideStatus('post', { badword: 0, spam: 0.1, textClassifier: 0.2, imageClassifier: 0 });
    expect(result.status).toBe('published');
  });

  it('이미지가 없으면 imageClassifier=0으로 취급해 정상 통과 가능하다', () => {
    const result = decideStatus('post', { badword: 0, spam: 0, textClassifier: 0.05, imageClassifier: 0 });
    expect(result.status).toBe('published');
  });
});
