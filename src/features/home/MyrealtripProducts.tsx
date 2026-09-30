import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ExternalLink, Star } from 'lucide-react';
import { apiUrl } from '@/shared/api/apiUrl';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { openMyrealtripPage, openMyrealtripSearch, type PartnerPlacement } from '@/features/plan/partnerLinks';
import { MyrealtripLink } from './MyrealtripLink';
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

/** tna: 투어·티켓 검색 · sim: 그 도시에서 쓸 유심·eSIM(서버가 "도시 + 유심"으로 찾아 유심 상품만) */
type ProductKind = 'tna' | 'sim';

async function fetchMyrealtripProducts(keyword: string, kind: ProductKind, count: number): Promise<PartnerProduct[]> {
  // v: 빈 목록이 서버 캐시(CDN 6시간)에 박혀 있던 것을 새 키로 건너뛴다 — 캐시 모양을 바꿀 때 올린다
  const params = new URLSearchParams({ provider: 'myrealtrip', q: keyword, size: String(count), v: '2' });
  if (kind === 'sim') params.set('kind', 'sim');
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

interface MyrealtripProductsProps {
  keyword: string;
  kind?: ProductKind;
  count?: number;
  /** 상품 카드를 눌렀을 때의 위치 꼬리표 */
  placement?: PartnerPlacement;
  /** 세로를 줄인 카드(항공 탭 유심·eSIM 2단) — 사진을 낮추고 분류 글을 뺀다 */
  compact?: boolean;
  /** "더 보기" 버튼 — 기본은 이 키워드로 마이리얼트립 검색 */
  seeAll?: { label: string; keyword: string; placement: PartnerPlacement };
}

/**
 * 마이리얼트립 상품 카드(액티비티 탭 추천, 항공 탭 유심·eSIM). 추적 링크(마이링크)는 누를 때만 만든다.
 * 상품을 못 받거나 없으면 마이리얼트립 검색으로 보내는 버튼만 보여준다.
 */
export function MyrealtripProducts({ keyword, kind = 'tna', count = 6, placement = 'product', seeAll, compact = false }: MyrealtripProductsProps) {
  const { t, i18n } = useTranslation('home');
  const more = seeAll ?? { label: t('activities.seeAllOnMyrealtrip', { keyword }), keyword, placement: 'city' as const };
  const { data, isLoading } = useQuery({
    queryKey: ['partnerProducts', 'myrealtrip', kind, count, keyword.toLowerCase()],
    queryFn: () => fetchMyrealtripProducts(keyword, kind, count),
    // 빈 목록·실패는 오래 붙잡지 않는다(IndexedDB에도 24시간 저장되므로, 한 번 비면 모바일에서 더보기 버튼만 계속 보였다)
    staleTime: (query) => (query.state.data && query.state.data.length > 0 ? 6 * 60 * 60 * 1000 : 0),
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className={count === 4 ? `${styles.productGrid} ${styles.productGridFour}` : styles.productGrid}>
        {Array.from({ length: Math.min(count, 3) }, (_, i) => (
          <Skeleton key={i} height="220px" />
        ))}
      </div>
    );
  }

  const seeAllButton = (
    <MyrealtripLink
      target={{ kind: 'search', q: more.keyword }}
      placement={more.placement}
      onFallback={() => void openMyrealtripSearch(more.keyword, more.placement)}
      className={compact ? `${styles.moreButton} ${styles.moreButtonCompact}` : styles.moreButton}
    >
      {more.label} <ExternalLink size={14} aria-hidden="true" />
    </MyrealtripLink>
  );

  if (!data || data.length === 0) return seeAllButton;

  return (
    <>
      <div className={[styles.productGrid, count === 4 ? styles.productGridFour : '', compact ? styles.productGridCompact : ''].filter(Boolean).join(' ')}>
        {data.map((p) => (
          <MyrealtripLink
            key={p.id}
            target={{ kind: 'page', url: p.url }}
            placement={placement}
            onFallback={() => void openMyrealtripPage(p.url, placement)}
            className={styles.productCard}
          >
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
          </MyrealtripLink>
        ))}
      </div>
      {seeAllButton}
    </>
  );
}
