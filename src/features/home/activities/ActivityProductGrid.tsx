import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { MyrealtripLink } from '../MyrealtripLink';
import { openMyrealtripPage, openMyrealtripSearch } from '@/features/plan/partnerLinks';
import { INSTANT_TAG } from './activityFilters';
import type { ActivityProduct } from './activityApi';
import styles from './ActivityProductGrid.module.css';

function formatPrice(amount: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

function ProductCard({ product }: { product: ActivityProduct }) {
  const { t, i18n } = useTranslation('home');
  const instant = product.tags.includes(INSTANT_TAG);
  return (
    // 추적 링크(마이링크, 만들 때마다 유료 호출)는 누를 때만 만든다 — 카드가 화면에 나올 때마다 만들면 필터·더 보기로 호출이 쌓인다
    <button type="button" className={styles.card} onClick={() => void openMyrealtripPage(product.url, 'product')}>
      <span className={styles.media}>
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt=""
            className={styles.image}
            loading="lazy"
            // 이미지가 깨지면 깨진 아이콘 대신 빈 자리(배경색)만
            onError={(e) => {
              e.currentTarget.style.visibility = 'hidden';
            }}
          />
        ) : null}
        {product.category ? <span className={styles.badge}>{product.category}</span> : null}
      </span>
      <span className={styles.body}>
        <span className={styles.title}>{product.title}</span>
        <span className={styles.meta}>
          {product.rating != null ? (
            <>
              <span className={styles.rating}>★ {product.rating.toFixed(1)}</span>
              {product.reviewCount ? <span className={styles.reviews}>({product.reviewCount.toLocaleString(i18n.language)})</span> : null}
            </>
          ) : null}
          {instant ? <span className={styles.instant}>{t('activities.card.instant')}</span> : null}
        </span>
        <span className={styles.footer}>
          {product.price != null ? <span className={styles.price}>{formatPrice(product.price, product.currency, i18n.language)}</span> : <span />}
          <span className={styles.unit}>{t('activities.card.perPerson')}</span>
        </span>
      </span>
    </button>
  );
}

export function ProductSkeletonGrid({ count }: { count: number }) {
  return (
    <div className={styles.grid} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={styles.skeletonCard}>
          <div className={`${styles.skeleton} ${styles.skeletonMedia}`} />
          <div className={`${styles.skeleton} ${styles.skeletonLine}`} style={{ width: '78%' }} />
          <div className={`${styles.skeleton} ${styles.skeletonLine}`} style={{ width: '52%' }} />
          <div className={`${styles.skeleton} ${styles.skeletonLine}`} style={{ width: '34%', marginTop: 12 }} />
        </div>
      ))}
    </div>
  );
}

interface ProductGridProps {
  products: ActivityProduct[];
  hasMore: boolean;
  loadingMore: boolean;
  onMore: () => void;
}

/** 상품 카드 격자(PC 4열·모바일 2열)와 "더 보기" */
export function ActivityProductGrid({ products, hasMore, loadingMore, onMore }: ProductGridProps) {
  const { t } = useTranslation('home');
  return (
    <>
      <div className={styles.grid}>
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
      {hasMore ? (
        <button type="button" className={styles.more} onClick={onMore} disabled={loadingMore} aria-busy={loadingMore}>
          {t('activities.more')} <ChevronDown size={16} aria-hidden="true" />
        </button>
      ) : null}
    </>
  );
}

interface EmptyProps {
  kind: 'empty' | 'error';
  city: string;
  filtersActive: boolean;
  onResetFilters: () => void;
  onRetry: () => void;
}

/** 조건에 맞는 상품이 없거나 못 받았을 때 — 마이리얼트립 검색으로 보내는 길은 항상 둔다 */
export function ActivityEmpty({ kind, city, filtersActive, onResetFilters, onRetry }: EmptyProps) {
  const { t } = useTranslation('home');
  return (
    <div className={styles.empty} role={kind === 'error' ? 'alert' : 'status'}>
      <p className={styles.emptyTitle}>{kind === 'error' ? t('activities.error') : t('activities.empty')}</p>
      {kind === 'empty' ? <p className={styles.emptyHint}>{t('activities.emptyHint')}</p> : null}
      <div className={styles.emptyActions}>
        {kind === 'error' ? (
          <button type="button" className={styles.emptyButton} onClick={onRetry}>
            {t('activities.retry')}
          </button>
        ) : null}
        {kind === 'empty' && filtersActive ? (
          <button type="button" className={styles.emptyButton} onClick={onResetFilters}>
            {t('activities.resetFilters')}
          </button>
        ) : null}
        <MyrealtripLink
          target={{ kind: 'search', q: city }}
          placement="city"
          onFallback={() => void openMyrealtripSearch(city, 'city')}
          className={styles.emptyLink}
        >
          {t('activities.seeAllCity', { city })}
        </MyrealtripLink>
      </div>
    </div>
  );
}
