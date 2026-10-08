import { describe, expect, it } from 'vitest';
import { HOME_PHOTO_SLUGS, homePhotoSlug, homePhotoThumbUrl, homePhotoUrl } from './homePhotos';
import { DEAL_CITY_INFO } from './stitch/dealCities';

describe('homePhotos', () => {
  it('영어 도시명 → 슬러그(별명 포함), 목록에 없으면 null', () => {
    expect(homePhotoSlug('New York, USA')).toBe('newyork');
    expect(homePhotoSlug('Ho Chi Minh City, Vietnam')).toBe('hochiminh');
    expect(homePhotoSlug('Singapore')).toBe('singapore');
    expect(homePhotoSlug('Kota Kinabalu, Malaysia')).toBe('kotakinabalu');
    expect(homePhotoSlug('Atlantis')).toBeNull();
    expect(homePhotoSlug(null)).toBeNull();
  });

  it('홈 특가에 나오는 모든 도시에 저장소 사진이 있다(외부 사진을 받아 오지 않는다)', () => {
    const missing = Object.entries(DEAL_CITY_INFO)
      .map(([code, c]) => [code, c.en])
      .filter(([, en]) => !homePhotoSlug(en));
    expect(missing).toEqual([]);
  });

  it('주소는 우리 저장소 버킷의 home/ 아래', () => {
    expect(HOME_PHOTO_SLUGS.has('tokyo')).toBe(true);
    expect(homePhotoUrl('tokyo')).toMatch(/\/storage\/v1\/object\/public\/destination-covers\/home\/tokyo\.webp$/);
    expect(homePhotoThumbUrl('tokyo')).toMatch(/\/home\/thumbs\/tokyo\.webp$/);
  });
});
