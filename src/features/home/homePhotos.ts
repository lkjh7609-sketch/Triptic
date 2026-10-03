/**
 * 홈의 도시 사진 — 우리 저장소(Supabase Storage 공개 버킷 destination-covers의 home/)에 줄여 둔 사진.
 * 640x480 WebP(약 40KB, 예전 외부 사진 100~340KB) + 160x120 썸네일(약 4KB, 원형 칸용).
 * 예전엔 홈이 위키백과·Unsplash에서 사진을 받아 와서(주소 조회 + 큰 사진 + 외부 접속) 첫 화면이 무거웠다(2026-10-04).
 * 목록에 없는 도시는 기존 도시 사진(useCityImage)으로 간다.
 *
 * 새 도시를 홈에 넣으려면: 사진을 640x480 WebP(quality 72)와 160x120으로 만들어 home/슬러그.webp, home/thumbs/슬러그.webp로
 * 올리고(`supabase storage cp … --experimental --linked --content-type image/webp --cache-control max-age=31536000`) 슬러그를 아래에 추가.
 */
import { useCityImage } from '@/shared/hooks/useCityImage';

export const HOME_PHOTO_SLUGS: ReadonlySet<string> = new Set([
  'bali', 'bangkok', 'barcelona', 'cebu', 'danang', 'fukuoka',
  'guam', 'hanoi', 'hochiminh', 'hongkong', 'interlaken', 'kotakinabalu',
  'kyoto', 'london', 'losangeles', 'nagoya', 'newyork', 'nhatrang',
  'okinawa', 'osaka', 'paris', 'phuquoc', 'rome', 'sapporo',
  'singapore', 'sydney', 'taipei', 'tokyo',
]);

/** 영어 도시명("Ho Chi Minh City, Vietnam")이 슬러그와 다른 경우 */
const ALIASES: Record<string, string> = { hochiminhcity: 'hochiminh' };

/** "New York, USA" → "newyork" */
export function homePhotoSlug(en: string | null | undefined): string | null {
  const name = (en ?? '').split(',')[0].toLowerCase().replace(/[^a-z]/g, '');
  const slug = ALIASES[name] ?? name;
  return HOME_PHOTO_SLUGS.has(slug) ? slug : null;
}

function base(): string {
  return `${import.meta.env.VITE_SUPABASE_URL ?? ''}/storage/v1/object/public/destination-covers/home`;
}

export function homePhotoUrl(slug: string): string {
  return `${base()}/${slug}.webp`;
}

export function homePhotoThumbUrl(slug: string): string {
  return `${base()}/thumbs/${slug}.webp`;
}

/** 홈 카드 사진 — 저장소에 있으면 그 사진, 없으면 기존 도시 사진(위키백과 등) */
export function useHomeCityPhoto(en: string | null | undefined): string {
  const slug = homePhotoSlug(en);
  const fallback = useCityImage(slug ? null : en);
  return slug ? homePhotoUrl(slug) : fallback;
}
