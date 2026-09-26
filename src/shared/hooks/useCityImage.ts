/* i18n-exempt-file: 도시명 매칭용 키(한국어/영어 도시명)만 있고 화면 문구는 없다. */
import { useEffect, useState } from 'react';

/**
 * 도시 대표 이미지. 순서: 검증된 큐레이션 이미지 → 위키백과 대표 이미지(썸네일 800px)
 * → 도시명 기반 고정 폴백. 어떤 URL이든 실제로 로드되는지 확인한 뒤에만 쓴다 —
 * 예전 목록에는 존재하지 않는 Unsplash 사진 ID가 15개 섞여 있어 깨진 이미지가 보였다.
 */
const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1506929562872-bb421503ef21?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1473625247510-8ceb1760943f?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80',
];

/** 로드 확인을 마친 큐레이션 이미지(2026-09-26). 키는 소문자 도시명 */
const CURATED_CITIES: Record<string, string> = {
  '서울': 'https://images.unsplash.com/photo-1588668214407-6ea9a6d8c272?auto=format&fit=crop&w=800&q=80',
  'seoul': 'https://images.unsplash.com/photo-1588668214407-6ea9a6d8c272?auto=format&fit=crop&w=800&q=80',
  '도쿄': 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=800&q=80',
  'tokyo': 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=800&q=80',
  '오사카': 'https://images.unsplash.com/photo-1528698827591-e19ccd7bc23d?auto=format&fit=crop&w=800&q=80',
  'osaka': 'https://images.unsplash.com/photo-1528698827591-e19ccd7bc23d?auto=format&fit=crop&w=800&q=80',
  '후쿠오카': 'https://images.unsplash.com/photo-1522850959516-58f958dde2c1?auto=format&fit=crop&w=800&q=80',
  'fukuoka': 'https://images.unsplash.com/photo-1522850959516-58f958dde2c1?auto=format&fit=crop&w=800&q=80',
  '교토': 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=800&q=80',
  'kyoto': 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=800&q=80',
  '타이베이': 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=800&q=80',
  'taipei': 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=800&q=80',
  '다낭': 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=800&q=80',
  'danang': 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=800&q=80',
  '발리': 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=800&q=80',
  'bali': 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=800&q=80',
  '세부': 'https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&w=800&q=80',
  'cebu': 'https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&w=800&q=80',
  '시드니': 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?auto=format&fit=crop&w=800&q=80',
  'sydney': 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?auto=format&fit=crop&w=800&q=80',
  '파리': 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=800&q=80',
  'paris': 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=800&q=80',
  '로마': 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=800&q=80',
  'rome': 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=800&q=80',
  '프라하': 'https://images.unsplash.com/photo-1519677100203-a0e668c92439?auto=format&fit=crop&w=800&q=80',
  'prague': 'https://images.unsplash.com/photo-1519677100203-a0e668c92439?auto=format&fit=crop&w=800&q=80',
  '마드리드': 'https://images.unsplash.com/photo-1539037116277-4db20889f2d4?auto=format&fit=crop&w=800&q=80',
  'madrid': 'https://images.unsplash.com/photo-1539037116277-4db20889f2d4?auto=format&fit=crop&w=800&q=80',
  '암스테르담': 'https://images.unsplash.com/photo-1512470876302-972faa2aa9a4?auto=format&fit=crop&w=800&q=80',
  'amsterdam': 'https://images.unsplash.com/photo-1512470876302-972faa2aa9a4?auto=format&fit=crop&w=800&q=80',
  '인터라켄': 'https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?auto=format&fit=crop&w=800&q=80',
  'interlaken': 'https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?auto=format&fit=crop&w=800&q=80',
  '비엔나': 'https://images.unsplash.com/photo-1516550893923-42d28e5677af?auto=format&fit=crop&w=800&q=80',
  'vienna': 'https://images.unsplash.com/photo-1516550893923-42d28e5677af?auto=format&fit=crop&w=800&q=80',
  '부다페스트': 'https://images.unsplash.com/photo-1549877452-9c387954fbc2?auto=format&fit=crop&w=800&q=80',
  'budapest': 'https://images.unsplash.com/photo-1549877452-9c387954fbc2?auto=format&fit=crop&w=800&q=80',
  '베네치아': 'https://images.unsplash.com/photo-1514890547357-a9ee288728e0?auto=format&fit=crop&w=800&q=80',
  'venice': 'https://images.unsplash.com/photo-1514890547357-a9ee288728e0?auto=format&fit=crop&w=800&q=80',
  '뉴욕': 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?auto=format&fit=crop&w=800&q=80',
  'new york': 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?auto=format&fit=crop&w=800&q=80',
  '하와이': 'https://images.unsplash.com/photo-1542259009477-d625272157b7?auto=format&fit=crop&w=800&q=80',
  'hawaii': 'https://images.unsplash.com/photo-1542259009477-d625272157b7?auto=format&fit=crop&w=800&q=80',
  '호놀룰루': 'https://images.unsplash.com/photo-1542259009477-d625272157b7?auto=format&fit=crop&w=800&q=80',
  'honolulu': 'https://images.unsplash.com/photo-1542259009477-d625272157b7?auto=format&fit=crop&w=800&q=80',
  '샌프란시스코': 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?auto=format&fit=crop&w=800&q=80',
  'san francisco': 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?auto=format&fit=crop&w=800&q=80',
  '두바이': 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=800&q=80',
  'dubai': 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=800&q=80',
};

/** 도시 문자열 → 최종 이미지 URL (앱 실행 중 메모리 캐시) */
const resolved = new Map<string, string>();

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 큐레이션 키 매칭. 부분 문자열로 비교하면 'la'가 'las vegas'·'manila'에 걸리는 식의 오매칭이
 * 생겨서 단어 경계로 비교한다. 한국어는 '오사카시', '제주도'처럼 한 글자 접미사까지 허용한다.
 */
export function matchCuratedCity(city: string): string | null {
  const lower = city.toLowerCase();
  const tokens = lower.split(/[\s,]+/).filter(Boolean);
  for (const [key, url] of Object.entries(CURATED_CITIES)) {
    if (/[가-힣]/.test(key)) {
      if (tokens.some((tok) => tok === key || (tok.startsWith(key) && tok.length - key.length <= 1))) return url;
    } else if (new RegExp(`(^|[\\s,])${escapeRegExp(key)}($|[\\s,])`).test(lower)) {
      return url;
    }
  }
  return null;
}

export function fallbackCityImage(city: string): string {
  let hash = 0;
  for (let i = 0; i < city.length; i++) {
    hash = city.charCodeAt(i) + ((hash << 5) - hash);
  }
  return FALLBACK_IMAGES[Math.abs(hash) % FALLBACK_IMAGES.length];
}

function wikiLangFor(title: string): string {
  if (/[가-힣]/.test(title)) return 'ko';
  if (/[\u3040-\u30ff]/.test(title)) return 'ja';
  if (/[\u4e00-\u9fff]/.test(title)) return 'zh';
  return 'en';
}

async function fetchWikipediaImage(title: string, lang: string): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      action: 'query',
      prop: 'pageimages',
      format: 'json',
      piprop: 'thumbnail',
      pithumbsize: '800',
      redirects: '1',
      titles: title,
      origin: '*',
    });
    const res = await fetch(`https://${lang}.wikipedia.org/w/api.php?${params}`);
    const data = await res.json();
    const pages = data?.query?.pages as Record<string, { thumbnail?: { source?: string } }> | undefined;
    if (!pages) return null;
    const page = Object.entries(pages).find(([id]) => id !== '-1')?.[1];
    return page?.thumbnail?.source ?? null;
  } catch {
    return null;
  }
}

function canLoad(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

async function resolveCityImage(city: string): Promise<string> {
  const curated = matchCuratedCity(city);
  if (curated && (await canLoad(curated))) return curated;

  const title = city.split(',')[0].trim();
  const lang = wikiLangFor(title);
  const wiki = await fetchWikipediaImage(title, lang);
  if (wiki && (await canLoad(wiki))) return wiki;
  if (lang !== 'en') {
    const enWiki = await fetchWikipediaImage(title, 'en');
    if (enWiki && (await canLoad(enWiki))) return enWiki;
  }
  return fallbackCityImage(city);
}

function initialUrl(city: string): string {
  if (!city) return FALLBACK_IMAGES[0];
  return resolved.get(city) ?? matchCuratedCity(city) ?? fallbackCityImage(city);
}

export function useCityImage(city: string | null | undefined): string {
  const key = (city ?? '').trim();
  const [state, setState] = useState(() => ({ key, url: initialUrl(key) }));

  // 도시가 바뀌면(예: 여행 데이터가 늦게 도착) 새 도시 기준으로 다시 시작한다.
  // 예전엔 초기값을 첫 렌더에서만 계산해서, 처음에 도시가 비어 있으면 끝까지 기본 이미지였다.
  let current = state;
  if (state.key !== key) {
    current = { key, url: initialUrl(key) };
    setState(current);
  }

  useEffect(() => {
    if (!key || resolved.has(key)) return;
    let cancelled = false;
    void resolveCityImage(key).then((url) => {
      resolved.set(key, url);
      if (!cancelled) setState({ key, url });
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return current.url;
}
