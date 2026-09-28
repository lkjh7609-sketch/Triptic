import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ExternalLink, Star } from 'lucide-react';
import { apiUrl } from '@/shared/api/apiUrl';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { openMyrealtripPage, openMyrealtripSearch } from '@/features/plan/partnerLinks';
import styles from './SectionScreen.module.css';

/** api/partnerProducts.js 카드 한 개 */
interface PartnerProduct {
  id: string;
  title: string;
  category: string | null;
  imageUrl: string | null;
  price: number | null;
  currency: string;
  rating: number | null;
  reviewCount: number | null;
  url: string;
}

const PRODUCT_COUNT = 6;

async function fetchMyrealtripProducts(keyword: string): Promise<PartnerProduct[]> {
  const params = new URLSearchParams({ provider: 'myrealtrip', q: keyword, size: String(PRODUCT_COUNT) });
  const res = await fetch(apiUrl(`/api/partnerProducts?${params.toString()}`));
  if (!res.ok) throw new Error(`partnerProducts HTTP ${res.status}`);
  const json = (await res.json()) as { items?: unknown };
  return Array.isArray(json.items) ? (json.items as PartnerProduct[]) : [];
}

function formatPrice(amount: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

/**
 * 마이리얼트립 투어·티켓 상품 카드(Klook 위젯 자리). 추적 링크(마이링크)는 누를 때만 만든다.
 * 상품을 못 받거나 없으면 마이리얼트립 검색으로 보내는 버튼만 보여준다.
 */
export function MyrealtripProducts({ keyword }: { keyword: string }) {
  const { t, i18n } = useTranslation('home');
  const { data, isLoading } = useQuery({
    queryKey: ['partnerProducts', 'myrealtrip', keyword.toLowerCase()],
    queryFn: () => fetchMyrealtripProducts(keyword),
    staleTime: 6 * 60 * 60 * 1000,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className={styles.productGrid}>
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} height="220px" />
        ))}
      </div>
    );
  }

  const seeAll = (
    <button type="button" className={styles.moreButton} onClick={() => void openMyrealtripSearch(keyword, 'city')}>
      {t('activities.seeAllOnMyrealtrip', { keyword })} <ExternalLink size={14} aria-hidden="true" />
    </button>
  );

  if (!data || data.length === 0) return seeAll;

  return (
    <>
      <div className={styles.productGrid}>
        {data.map((p) => (
          <button key={p.id} type="button" className={styles.productCard} onClick={() => void openMyrealtripPage(p.url, 'product')}>
            {p.imageUrl ? (
              <img
                src={p.imageUrl}
                alt=""
                className={styles.productImage}
                loading="lazy"
                // 이미지가 깨지면 깨진 아이콘 대신 빈 자리(배경색)만
                onError={(e) => {
                  e.currentTarget.style.visibility = 'hidden';
                }}
              />
            ) : (
              <span className={styles.productImage} aria-hidden="true" />
            )}
            <span className={styles.productBody}>
              {p.category ? <span className={styles.productCategory}>{p.category}</span> : null}
              <span className={styles.productTitle}>{p.title}</span>
              {p.rating != null ? (
                <span className={styles.productRating}>
                  <Star size={12} aria-hidden="true" /> {p.rating.toFixed(1)}
                  {p.reviewCount ? ` (${p.reviewCount.toLocaleString(i18n.language)})` : ''}
                </span>
              ) : null}
              {p.price != null ? <span className={styles.productPrice}>{formatPrice(p.price, p.currency, i18n.language)}</span> : null}
            </span>
          </button>
        ))}
      </div>
      {seeAll}
    </>
  );
}
