import { useState, useEffect } from 'react';

const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1506929562872-bb421503ef21?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1473625247510-8ceb1760943f?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80'
];

export const CONTINENT_TO_COUNTRIES: Record<string, string[]> = {
  '아시아': ['한국', '일본', '대만', '베트남', '태국', '싱가포르', '인도네시아', '필리핀', '말레이시아'],
  '유럽': ['프랑스', '영국', '이탈리아', '체코', '스페인', '네덜란드', '스위스', '오스트리아', '헝가리'],
  '아메리카': ['미국'],
  '오세아니아': ['호주'],
  '중동': ['아랍에미리트']
};

export const COUNTRY_TO_CITIES: Record<string, string[]> = {
  '한국': ['서울', '제주'],
  '일본': ['도쿄', '오사카', '후쿠오카', '교토', '삿포로', '오키나와'],
  '대만': ['타이베이'],
  '베트남': ['다낭', '나트랑', '호치민'],
  '태국': ['방콕', '치앙마이'],
  '싱가포르': ['싱가포르'],
  '인도네시아': ['발리'],
  '필리핀': ['세부', '보라카이'],
  '말레이시아': ['쿠알라룸푸르'],
  '호주': ['시드니'],
  '프랑스': ['파리'],
  '영국': ['런던'],
  '이탈리아': ['로마', '베네치아', '피렌체'],
  '체코': ['프라하'],
  '스페인': ['바르셀로나', '마드리드'],
  '네덜란드': ['암스테르담'],
  '스위스': ['인터라켄'],
  '오스트리아': ['비엔나'],
  '헝가리': ['부다페스트'],
  '미국': ['뉴욕', '하와이', '호놀룰루', '로스앤젤레스', '라스베가스', '샌프란시스코'],
  '아랍에미리트': ['두바이']
};

export const CURATED_CITIES: Record<string, string> = {
  '서울': 'https://images.unsplash.com/photo-1588668214407-6ea9a6d8c272?auto=format&fit=crop&w=800&q=80',
  'seoul': 'https://images.unsplash.com/photo-1588668214407-6ea9a6d8c272?auto=format&fit=crop&w=800&q=80',
  '제주': 'https://images.unsplash.com/photo-1601625463689-0824b2326759?auto=format&fit=crop&w=800&q=80',
  'jeju': 'https://images.unsplash.com/photo-1601625463689-0824b2326759?auto=format&fit=crop&w=800&q=80',
  '도쿄': 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=800&q=80',
  'tokyo': 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=800&q=80',
  '오사카': 'https://images.unsplash.com/photo-1528698827591-e19ccd7bc23d?auto=format&fit=crop&w=800&q=80',
  'osaka': 'https://images.unsplash.com/photo-1528698827591-e19ccd7bc23d?auto=format&fit=crop&w=800&q=80',
  '후쿠오카': 'https://images.unsplash.com/photo-1522850959516-58f958dde2c1?auto=format&fit=crop&w=800&q=80',
  'fukuoka': 'https://images.unsplash.com/photo-1522850959516-58f958dde2c1?auto=format&fit=crop&w=800&q=80',
  '교토': 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=800&q=80',
  'kyoto': 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=800&q=80',
  '삿포로': 'https://images.unsplash.com/photo-1598994392943-424a5ccafdf2?auto=format&fit=crop&w=800&q=80',
  'sapporo': 'https://images.unsplash.com/photo-1598994392943-424a5ccafdf2?auto=format&fit=crop&w=800&q=80',
  '오키나와': 'https://images.unsplash.com/photo-1590253232675-ebcb239fdb23?auto=format&fit=crop&w=800&q=80',
  'okinawa': 'https://images.unsplash.com/photo-1590253232675-ebcb239fdb23?auto=format&fit=crop&w=800&q=80',
  '타이베이': 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=800&q=80',
  'taipei': 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=800&q=80',
  '다낭': 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=800&q=80',
  'danang': 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=800&q=80',
  '나트랑': 'https://images.unsplash.com/photo-1582236814674-320e8b2b73ee?auto=format&fit=crop&w=800&q=80',
  'nha trang': 'https://images.unsplash.com/photo-1582236814674-320e8b2b73ee?auto=format&fit=crop&w=800&q=80',
  '호치민': 'https://images.unsplash.com/photo-1583417657208-ded6081013bc?auto=format&fit=crop&w=800&q=80',
  'ho chi minh': 'https://images.unsplash.com/photo-1583417657208-ded6081013bc?auto=format&fit=crop&w=800&q=80',
  '방콕': 'https://images.unsplash.com/photo-1508009603885-247a57a11c0e?auto=format&fit=crop&w=800&q=80',
  'bangkok': 'https://images.unsplash.com/photo-1508009603885-247a57a11c0e?auto=format&fit=crop&w=800&q=80',
  '치앙마이': 'https://images.unsplash.com/photo-1512686866952-321285265be7?auto=format&fit=crop&w=800&q=80',
  'chiang mai': 'https://images.unsplash.com/photo-1512686866952-321285265be7?auto=format&fit=crop&w=800&q=80',
  '싱가포르': 'https://images.unsplash.com/photo-1525625299905-2895ab5f1710?auto=format&fit=crop&w=800&q=80',
  'singapore': 'https://images.unsplash.com/photo-1525625299905-2895ab5f1710?auto=format&fit=crop&w=800&q=80',
  '발리': 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=800&q=80',
  'bali': 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=800&q=80',
  '세부': 'https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&w=800&q=80',
  'cebu': 'https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&w=800&q=80',
  '보라카이': 'https://images.unsplash.com/photo-1540843405786-4daea61c37b0?auto=format&fit=crop&w=800&q=80',
  'boracay': 'https://images.unsplash.com/photo-1540843405786-4daea61c37b0?auto=format&fit=crop&w=800&q=80',
  '쿠알라룸푸르': 'https://images.unsplash.com/photo-1502255743415-ee0013093b11?auto=format&fit=crop&w=800&q=80',
  'kuala lumpur': 'https://images.unsplash.com/photo-1502255743415-ee0013093b11?auto=format&fit=crop&w=800&q=80',
  '시드니': 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?auto=format&fit=crop&w=800&q=80',
  'sydney': 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?auto=format&fit=crop&w=800&q=80',
  '파리': 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=800&q=80',
  'paris': 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=800&q=80',
  '런던': 'https://images.unsplash.com/photo-1513635269975-59693e0908c7?auto=format&fit=crop&w=800&q=80',
  'london': 'https://images.unsplash.com/photo-1513635269975-59693e0908c7?auto=format&fit=crop&w=800&q=80',
  '로마': 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=800&q=80',
  'rome': 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=800&q=80',
  '프라하': 'https://images.unsplash.com/photo-1519677100203-a0e668c92439?auto=format&fit=crop&w=800&q=80',
  'prague': 'https://images.unsplash.com/photo-1519677100203-a0e668c92439?auto=format&fit=crop&w=800&q=80',
  '바르셀로나': 'https://images.unsplash.com/photo-1583422409516-2895a77ef244?auto=format&fit=crop&w=800&q=80',
  'barcelona': 'https://images.unsplash.com/photo-1583422409516-2895a77ef244?auto=format&fit=crop&w=800&q=80',
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
  '피렌체': 'https://images.unsplash.com/photo-1543429253-dc95c52bb3bd?auto=format&fit=crop&w=800&q=80',
  'florence': 'https://images.unsplash.com/photo-1543429253-dc95c52bb3bd?auto=format&fit=crop&w=800&q=80',
  '뉴욕': 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?auto=format&fit=crop&w=800&q=80',
  'new york': 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?auto=format&fit=crop&w=800&q=80',
  '하와이': 'https://images.unsplash.com/photo-1542259009477-d625272157b7?auto=format&fit=crop&w=800&q=80',
  'hawaii': 'https://images.unsplash.com/photo-1542259009477-d625272157b7?auto=format&fit=crop&w=800&q=80',
  '호놀룰루': 'https://images.unsplash.com/photo-1542259009477-d625272157b7?auto=format&fit=crop&w=800&q=80',
  'honolulu': 'https://images.unsplash.com/photo-1542259009477-d625272157b7?auto=format&fit=crop&w=800&q=80',
  '로스앤젤레스': 'https://images.unsplash.com/photo-1580659324483-16279f0464f9?auto=format&fit=crop&w=800&q=80',
  'la': 'https://images.unsplash.com/photo-1580659324483-16279f0464f9?auto=format&fit=crop&w=800&q=80',
  '라스베가스': 'https://images.unsplash.com/photo-1581351114352-7c30a21cf9a9?auto=format&fit=crop&w=800&q=80',
  'las vegas': 'https://images.unsplash.com/photo-1581351114352-7c30a21cf9a9?auto=format&fit=crop&w=800&q=80',
  '샌프란시스코': 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?auto=format&fit=crop&w=800&q=80',
  'san francisco': 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?auto=format&fit=crop&w=800&q=80',
  '두바이': 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=800&q=80',
  'dubai': 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=800&q=80',
};

const imageCache = new Map<string, string>();

function getDeterministicFallback(city: string): string {
  let hash = 0;
  for (let i = 0; i < city.length; i++) {
    hash = city.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % FALLBACK_IMAGES.length;
  return FALLBACK_IMAGES[index];
}

async function fetchWikipediaImage(city: string, lang: string): Promise<string | null> {
  try {
    const res = await fetch(`https://${lang}.wikipedia.org/w/api.php?action=query&prop=pageimages&format=json&piprop=original&titles=${encodeURIComponent(city)}&origin=*`);
    const data = await res.json();
    const pages = data?.query?.pages;
    if (pages) {
      const pageId = Object.keys(pages)[0];
      if (pageId !== '-1' && pages[pageId].original?.source) {
        return pages[pageId].original.source;
      }
    }
    return null;
  } catch (err) {
    return null;
  }
}

export function useCityImage(city: string | null | undefined): string {
  const [imageUrl, setImageUrl] = useState<string>(() => {
    if (!city) return FALLBACK_IMAGES[0];
    const cityLower = city.toLowerCase();
    
    // 1. Check curated list
    for (const [key, url] of Object.entries(CURATED_CITIES)) {
      if (cityLower.includes(key)) {
        return url;
      }
    }
    
    // 2. Check memory cache for previously fetched Wikipedia image
    if (imageCache.has(cityLower)) {
      return imageCache.get(cityLower)!;
    }
    
    // 3. Fallback immediately to prevent empty UI while fetching
    return getDeterministicFallback(city);
  });

  useEffect(() => {
    if (!city) return;
    const cityLower = city.toLowerCase();
    
    // If it's a curated city, we already have the best image
    for (const key of Object.keys(CURATED_CITIES)) {
      if (cityLower.includes(key)) return;
    }
    
    // If it's already cached, no need to refetch
    if (imageCache.has(cityLower)) return;

    let mounted = true;

    async function loadDynamicImage() {
      // Try Korean Wikipedia first
      let img = await fetchWikipediaImage(city!, 'ko');
      
      // Try English Wikipedia if no image found
      if (!img) {
        img = await fetchWikipediaImage(city!, 'en');
      }

      if (img && mounted) {
        imageCache.set(cityLower, img);
        setImageUrl(img);
      } else if (mounted) {
        // Cache the fallback so we don't fetch again
        imageCache.set(cityLower, getDeterministicFallback(city!));
      }
    }

    loadDynamicImage();

    return () => {
      mounted = false;
    };
  }, [city]);

  return imageUrl;
}
