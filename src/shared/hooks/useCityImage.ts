import { useState, useEffect } from 'react';

const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1506929562872-bb421503ef21?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1473625247510-8ceb1760943f?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80'
];

const CURATED_CITIES: Record<string, string> = {
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
  '타이베이': 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=800&q=80',
  'taipei': 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=800&q=80',
  '다낭': 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=800&q=80',
  'danang': 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=800&q=80',
  '방콕': 'https://images.unsplash.com/photo-1508009603885-247a57a11c0e?auto=format&fit=crop&w=800&q=80',
  'bangkok': 'https://images.unsplash.com/photo-1508009603885-247a57a11c0e?auto=format&fit=crop&w=800&q=80',
  '싱가포르': 'https://images.unsplash.com/photo-1525625299905-2895ab5f1710?auto=format&fit=crop&w=800&q=80',
  'singapore': 'https://images.unsplash.com/photo-1525625299905-2895ab5f1710?auto=format&fit=crop&w=800&q=80',
  '발리': 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=800&q=80',
  'bali': 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=800&q=80',
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
  '인터라켄': 'https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?auto=format&fit=crop&w=800&q=80',
  'interlaken': 'https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?auto=format&fit=crop&w=800&q=80',
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
