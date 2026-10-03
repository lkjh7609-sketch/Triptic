import { describe, expect, it } from 'vitest';
import { cityPredictionLabel, cityPredictionName } from './cityPredictions';

const p = (
  main: string,
  secondary: string | undefined,
  description = `${main}, ${secondary ?? ''}`,
) => ({
  place_id: 'x',
  description,
  structured_formatting: { main_text: main, secondary_text: secondary },
});

describe('cityPredictionLabel', () => {
  it('도시 이름 + (나라)', () => {
    expect(cityPredictionLabel(p('도쿄', '일본'))).toBe('도쿄(일본)');
    expect(cityPredictionLabel(p('Tokyo', 'Japan'))).toBe('Tokyo(Japan)');
  });

  it('같은 이름 도시를 가르는 주 정보도 괄호 안에 함께 나온다', () => {
    expect(cityPredictionLabel(p('Portland', 'OR, USA'))).toBe('Portland(OR, USA)');
  });

  it('설명이 없거나 이름과 같으면(싱가포르) 이름만', () => {
    expect(cityPredictionLabel(p('Singapore', undefined, 'Singapore'))).toBe('Singapore');
    expect(cityPredictionLabel(p('Singapore', 'Singapore'))).toBe('Singapore');
  });

  it('구조화된 이름이 없으면 전체 설명을 쓴다', () => {
    expect(cityPredictionLabel({ place_id: 'x', description: 'Kyoto, Japan' })).toBe(
      'Kyoto, Japan',
    );
  });
});

describe('cityPredictionName', () => {
  it('입력칸에 남기는 건 도시 이름만', () => {
    expect(cityPredictionName(p('교토', '일본'))).toBe('교토');
    expect(cityPredictionName({ place_id: 'x', description: 'Kyoto, Japan' })).toBe('Kyoto, Japan');
  });
});
