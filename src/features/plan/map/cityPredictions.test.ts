import { describe, expect, it } from 'vitest';
import { buildCityOptions, splitSecondary, stripAdminSuffix } from './cityPredictions';

const p = (placeId: string, main: string, secondary?: string) => ({
  place_id: placeId,
  description: `${main}, ${secondary ?? ''}`,
  structured_formatting: { main_text: main, secondary_text: secondary },
});

describe('stripAdminSuffix', () => {
  it('한국어: 교토시→교토, 서울특별시→서울, 부산광역시→부산, 호찌민시→호찌민', () => {
    expect(stripAdminSuffix('교토시', 'ko')).toBe('교토');
    expect(stripAdminSuffix('서울특별시', 'ko')).toBe('서울');
    expect(stripAdminSuffix('부산광역시', 'ko')).toBe('부산');
    expect(stripAdminSuffix('호찌민시', 'ko')).toBe('호찌민');
  });

  it('한국어: 이름 일부인 글자는 떼지 않는다(멕시코시티·솔트레이크시티·도쿄)', () => {
    expect(stripAdminSuffix('멕시코시티', 'ko')).toBe('멕시코시티');
    expect(stripAdminSuffix('솔트레이크시티', 'ko')).toBe('솔트레이크시티');
    expect(stripAdminSuffix('도쿄', 'ko')).toBe('도쿄');
    expect(stripAdminSuffix('도쿄도', 'ko')).toBe('도쿄');
  });

  it('일본어·번체: 京都市→京都, 東京都→東京, 京都는 그대로(남는 글자가 한 글자)', () => {
    expect(stripAdminSuffix('京都市', 'ja')).toBe('京都');
    expect(stripAdminSuffix('東京都', 'ja')).toBe('東京');
    expect(stripAdminSuffix('京都', 'ja')).toBe('京都');
    expect(stripAdminSuffix('成都市', 'zh-TW')).toBe('成都');
    expect(stripAdminSuffix('成都', 'zh-TW')).toBe('成都');
  });

  it('영어는 손대지 않는다', () => {
    expect(stripAdminSuffix('Kyoto', 'en')).toBe('Kyoto');
    expect(stripAdminSuffix('Mexico City', 'en')).toBe('Mexico City');
  });
});

describe('splitSecondary — 나라와 나머지(주·도)를 가른다', () => {
  it('한국어: "일본 교토부" → 나라 일본', () => {
    expect(splitSecondary('일본 교토부', 'ko')).toEqual({ country: '일본', region: '교토부' });
    expect(splitSecondary('미국 오리건 주', 'ko')).toEqual({
      country: '미국',
      region: '오리건 주',
    });
    expect(splitSecondary('대한민국', 'ko')).toEqual({ country: '대한민국', region: '' });
  });

  it('일본어(、)·번체(붙여 씀)', () => {
    expect(splitSecondary('日本、京都府', 'ja')).toEqual({ country: '日本', region: '京都府' });
    expect(splitSecondary('日本京都府', 'zh-TW')).toEqual({ country: '日本', region: '京都府' });
  });

  it('영어: 나라가 끝', () => {
    expect(splitSecondary('Kyoto Prefecture, Japan', 'en')).toEqual({
      country: 'Japan',
      region: 'Kyoto Prefecture',
    });
    expect(splitSecondary('OR, USA', 'en')).toEqual({ country: 'USA', region: 'OR' });
    expect(splitSecondary('Japan', 'en')).toEqual({ country: 'Japan', region: '' });
  });

  it('나라가 두 낱말인 경우도 가장 긴 이름으로(뉴질랜드·스리랑카·사우디아라비아)', () => {
    expect(splitSecondary('뉴질랜드 오클랜드', 'ko').country).toBe('뉴질랜드');
    expect(splitSecondary('스리랑카 중부 주', 'ko').country).toBe('스리랑카');
  });

  it('비었으면 빈 값', () => {
    expect(splitSecondary(undefined, 'ko')).toEqual({ country: '', region: '' });
  });
});

describe('buildCityOptions', () => {
  it('한국어 화면에서 교토시(일본 교토부) → 교토(일본)', () => {
    const [o] = buildCityOptions([p('a', '교토시', '일본 교토부')], 'ko');
    expect(o).toEqual({ placeId: 'a', label: '교토(일본)', name: '교토' });
  });

  it('도시와 나라가 같으면(싱가포르) 이름만', () => {
    expect(buildCityOptions([p('a', '싱가포르', '싱가포르')], 'ko')[0].label).toBe('싱가포르');
    expect(buildCityOptions([p('a', 'Singapore', undefined)], 'en')[0].label).toBe('Singapore');
  });

  it('같은 이름의 다른 도시는 주까지 붙여 가른다', () => {
    const o = buildCityOptions(
      [
        p('a', '포틀랜드', '미국 오리건 주'),
        p('b', '포틀랜드', '미국 메인 주'),
        p('c', '포르투', '포르투갈'),
      ],
      'ko',
    );
    expect(o.map((x) => x.label)).toEqual([
      '포틀랜드(미국, 오리건 주)',
      '포틀랜드(미국, 메인 주)',
      '포르투(포르투갈)',
    ]);
    const en = buildCityOptions(
      [p('a', 'Portland', 'OR, USA'), p('b', 'Portland', 'ME, USA')],
      'en',
    );
    expect(en.map((x) => x.label)).toEqual(['Portland(USA, OR)', 'Portland(USA, ME)']);
  });

  it('구조화된 이름이 없으면 전체 설명을 쓴다', () => {
    expect(buildCityOptions([{ place_id: 'a', description: 'Kyoto, Japan' }], 'en')[0]).toEqual({
      placeId: 'a',
      label: 'Kyoto, Japan',
      name: 'Kyoto, Japan',
    });
  });

  it('일본어·번체 화면', () => {
    expect(buildCityOptions([p('a', '京都市', '日本、京都府')], 'ja')[0].label).toBe('京都(日本)');
    expect(buildCityOptions([p('a', '京都市', '日本京都府')], 'zh-TW')[0].label).toBe('京都(日本)');
  });
});
