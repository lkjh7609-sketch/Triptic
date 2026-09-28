import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { Search, Tent } from 'lucide-react';
import { trackScreenView } from '@/shared/monitoring';
import { useTrips } from '@/features/plan/hooks/useTrips';
import { useProfile } from '@/shared/hooks/useProfile';
import { cityDisplayName } from '@/features/plan/cityName';
import { openKlookSearch, openMyrealtripSearch, useKlookActivitiesLink } from '@/features/plan/partnerLinks';
import { ACTIVITY_PROVIDERS, readActivityProvider, saveActivityProvider, type ActivityProvider } from './activityProviders';
import { FEATURED, type FeaturedDestination } from './featuredDestinations';
import { DEFAULT_KLOOK_CITY_ID, nearestKlookCityId } from './klookCities';
import { KlookToursWidget } from './KlookToursWidget';
import { MyrealtripProducts } from './MyrealtripProducts';
import { HomeSectionTabs } from './HomeSectionTabs';
import styles from './SectionScreen.module.css';

/** 도시 하나 = 제휴 링크 하나(훅은 map 안에서 못 불러서 카드 단위 컴포넌트로) */
function CityActivityCard({ dest }: { dest: FeaturedDestination }) {
  const { t, i18n } = useTranslation('home');
  const href = useKlookActivitiesLink(dest.city, i18n.language, 'city');
  return (
    <a href={href} target="_blank" rel="sponsored noopener" className={styles.cityCard}>
      <img src={dest.image} alt="" className={styles.cityImage} loading="lazy" />
      <span className={styles.cityName}>{t(`desktop.dest${dest.key}`)}</span>
    </a>
  );
}

/** 마이리얼트립은 도시 검색 결과로 — 링크는 누를 때 만든다(카드마다 미리 만들지 않게) */
function MyrealtripCityCard({ dest }: { dest: FeaturedDestination }) {
  const { t } = useTranslation('home');
  const name = t(`desktop.dest${dest.key}`);
  return (
    <button type="button" className={styles.cityCard} onClick={() => void openMyrealtripSearch(name, 'city')}>
      <img src={dest.image} alt="" className={styles.cityImage} loading="lazy" />
      <span className={styles.cityName}>{name}</span>
    </button>
  );
}

/** 가장 가까운(진행 중이거나 곧 떠나는) 내 여행 — 좌표가 있는 것만 */
function useNearestTrip() {
  const { data: trips } = useTrips();
  return useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return (trips ?? [])
      .filter((trip) => trip.city_lat != null && trip.city_lng != null && (trip.end_date ?? trip.start_date ?? '') >= today)
      .sort((a, b) => (a.start_date ?? '9999').localeCompare(b.start_date ?? '9999'))[0];
  }, [trips]);
}

/**
 * 액티비티 탭 — 제휴사 선택(Klook | 마이리얼트립), 검색창(키워드 그대로 그 제휴사에서 검색),
 * 내 다음 여행 도시 추천(Klook 위젯 / 마이리얼트립 상품 카드), 인기 도시
 */
export function ActivitiesScreen() {
  const { t, i18n } = useTranslation('home');
  const [keyword, setKeyword] = useState('');
  const [provider, setProvider] = useState<ActivityProvider>(readActivityProvider);
  const nearestTrip = useNearestTrip();
  // 투어 가격은 설정의 기본 통화로, 문구는 앱 언어로
  const { data: profile } = useProfile();
  const currency = profile?.base_currency ?? 'KRW';
  const tripCityId = nearestTrip ? nearestKlookCityId(nearestTrip.city_lat!, nearestTrip.city_lng!) : null;

  useEffect(() => {
    trackScreenView('activities');
  }, []);

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    const q = keyword.trim();
    if (!q) return;
    if (provider === 'myrealtrip') void openMyrealtripSearch(q, 'search');
    else void openKlookSearch(q, i18n.language);
  }

  function chooseProvider(next: ActivityProvider) {
    setProvider(next);
    saveActivityProvider(next);
  }

  const tripCity = nearestTrip ? cityDisplayName(nearestTrip.city) : '';

  return (
    <div className={styles.page}>
      <HomeSectionTabs />
      <div className={styles.wrap}>
        <header className={styles.header}>
          <h1 className={styles.title}>
            <Tent size={22} aria-hidden="true" /> {t('activities.title')}
          </h1>
          <p className={styles.subtitle}>{t('activities.subtitle')}</p>
        </header>

        <div className={styles.providerToggle} role="group" aria-label={t('activities.providerLabel')}>
          {ACTIVITY_PROVIDERS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={provider === p}
              className={provider === p ? styles.providerOn : styles.providerOff}
              onClick={() => chooseProvider(p)}
            >
              {t(`activities.provider.${p}`)}
            </button>
          ))}
        </div>

        <form className={styles.searchForm} onSubmit={handleSearch} role="search">
          <Search size={18} className={styles.searchIcon} aria-hidden="true" />
          <input
            type="search"
            className={styles.searchInput}
            placeholder={t('activities.searchPlaceholder')}
            aria-label={t('activities.searchPlaceholder')}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            enterKeyHint="search"
          />
          <button type="submit" className={styles.searchButton} disabled={!keyword.trim()}>
            {t('activities.searchButton')}
          </button>
        </form>

        {provider === 'myrealtrip' ? (
          <>
            <h2 className={styles.sectionTitle}>
              {tripCity ? t('activities.forTrip', { city: tripCity }) : t('activities.recommended')}
            </h2>
            <MyrealtripProducts keyword={tripCity || t('activities.myrealtripDefaultKeyword')} />
          </>
        ) : (
          <>
            <h2 className={styles.sectionTitle}>
              {tripCityId && nearestTrip ? t('activities.forTrip', { city: tripCity }) : t('activities.recommended')}
            </h2>
            <KlookToursWidget cityId={tripCityId ?? DEFAULT_KLOOK_CITY_ID} locale={i18n.language} currency={currency} />
          </>
        )}

        <h2 className={styles.sectionTitle}>{t('activities.popular')}</h2>
        <div className={styles.cityGrid}>
          {FEATURED.map((dest) =>
            provider === 'myrealtrip' ? <MyrealtripCityCard key={dest.key} dest={dest} /> : <CityActivityCard key={dest.key} dest={dest} />,
          )}
        </div>
      </div>
    </div>
  );
}
