import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useHomeCityPhoto } from '../homePhotos';
import { useTempUnit } from '@/shared/hooks/useTempUnit';
import { formatTemp } from '@/features/weather/weatherRules';
import { useRequireLogin } from '@/features/auth/loginPrompt';
import { cityDescCacheKey } from '@/shared/api/aiCacheKeys';
import { cityDescQueryKey, readCachedCityDescriptions } from '../cityDescription';
import { DestinationPreviewModal, type PreviewDestination } from './DestinationPreviewModal';
import { monthRange } from './homeUtils';
import { seasonPicksFor, type SeasonPick } from './seasonData';
import { WeatherIcon } from './weatherIcon';
import { useSeasonTemps } from './useSeasonTemps';
import shared from './shared.module.css';
import styles from './SeasonSection.module.css';

function regionName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

function CityPhoto({ pick, desktop, className }: { pick: SeasonPick; desktop: boolean; className: string }) {
  const photo = pick.city.photo;
  const own = desktop ? (photo?.pc ?? photo?.mobile) : (photo?.mobile ?? photo?.pc);
  const fallback = useHomeCityPhoto(own ? null : pick.city.en);
  return <img src={own ?? fallback} alt="" className={className} loading="lazy" decoding="async" />;
}

/** 카드에 보여줄 지금 날씨 — 기온 글자("17°C")와 날씨 아이콘용 코드 */
interface CardWeather {
  text: string;
  code: number | null;
}

/** 기온 글자 + 날씨 아이콘 한 줄 */
function WeatherLine({ weather, className }: { weather: CardWeather; className: string }) {
  return (
    <span className={className}>
      <WeatherIcon code={weather.code} />
      {weather.text}
    </span>
  );
}

function SquareCard({ pick, weather, onOpen }: { pick: SeasonPick; weather: CardWeather | null; onOpen: () => void }) {
  const { t, i18n } = useTranslation('home');
  const country = regionName(pick.city.country, i18n.language);
  return (
    <button type="button" className={`${shared.card} ${shared.cardLift} ${styles.square}`} onClick={onOpen}>
      <span className={styles.squareMedia}>
        <CityPhoto pick={pick} desktop className={styles.squarePhoto} />
        <span className={styles.squareBadge}>{t(`page.season.${pick.id}.${pick.entry}.badge`)}</span>
      </span>
      <span className={styles.squareBody}>
        <span className={styles.squareName}>{t(`page.season.cities.${pick.id}`)}</span>
        <span className={styles.squareMeta}>
          {country}
          {weather ? (
            <>
              {' · '}
              <WeatherLine weather={weather} className={styles.weatherInline} />
            </>
          ) : null}
        </span>
        <span className={styles.squareDesc}>{t(`page.season.${pick.id}.${pick.entry}.desc`)}</span>
      </span>
    </button>
  );
}

function CircleCard({ pick, weather, tone, onOpen }: { pick: SeasonPick; weather: CardWeather | null; tone: number; onOpen: () => void }) {
  const { t } = useTranslation('home');
  return (
    <button type="button" className={styles.circle} onClick={onOpen}>
      <span className={styles.circleMedia}>
        <CityPhoto pick={pick} desktop={false} className={styles.circlePhoto} />
      </span>
      <span className={styles.circleName}>{t(`page.season.cities.${pick.id}`)}</span>
      <span className={`${styles.circleBadge} ${tone === 0 ? styles.toneHot : tone === 1 ? styles.toneAccent : ''}`}>
        {t(`page.season.${pick.id}.${pick.entry}.badge`)}
      </span>
      {weather ? <WeatherLine weather={weather} className={styles.circleWeather} /> : null}
    </button>
  );
}

/** "지금 가기 좋은 여행지" — 이달 추천 6도시(월별 큐레이션 표) + 도시마다 지금 기온. 카드를 누르면 도시 소개 팝업 → 여행 만들기 */
export function SeasonSection({ desktop }: { desktop: boolean }) {
  const { t, i18n } = useTranslation('home');
  const navigate = useNavigate();
  const requireLogin = useRequireLogin();
  const queryClient = useQueryClient();
  const unit = useTempUnit();
  const month = useMemo(() => new Date().getMonth() + 1, []);
  const picks = useMemo(() => seasonPicksFor(month), [month]);
  const { data: temps } = useSeasonTemps(picks);
  const [preview, setPreview] = useState<{ dest: PreviewDestination; city: string } | null>(null);
  const locale = i18n.language;

  // 이미 DB에 저장된 도시 소개는 한 번에 받아 채워 둔다 — 카드를 눌렀을 때 기다림 없이
  useEffect(() => {
    const missing = picks.filter((p) => queryClient.getQueryData(cityDescQueryKey(p.city.en, locale)) === undefined);
    if (missing.length === 0) return;
    let cancelled = false;
    void readCachedCityDescriptions(missing.map((p) => p.city.en), locale).then((byKey) => {
      if (cancelled) return;
      for (const p of missing) {
        const description = byKey[cityDescCacheKey(p.city.en)];
        if (description) queryClient.setQueryData(cityDescQueryKey(p.city.en, locale), description);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [picks, queryClient, locale]);

  function weatherOf(id: string): CardWeather | null {
    const current = temps?.[id];
    const value = formatTemp(current?.temp, unit);
    return value ? { text: `${value}${unit}`, code: current?.code ?? null } : null;
  }

  function photoOf(pick: SeasonPick): string {
    const photo = pick.city.photo;
    return (desktop ? (photo?.pc ?? photo?.mobile) : (photo?.mobile ?? photo?.pc)) ?? '';
  }

  function open(pick: SeasonPick) {
    setPreview({
      city: pick.city.en,
      dest: {
        city: pick.city.en,
        title: `${regionName(pick.city.country, locale)} ${t(`page.season.cities.${pick.id}`)}`,
        image: photoOf(pick),
        fallbackDesc: t(`page.season.${pick.id}.${pick.entry}.desc`),
      },
    });
  }

  function start(city: string) {
    // 계획 만들기는 로그인해야 한다 — 로그인 창을 띄운다
    if (!requireLogin()) return;
    navigate(`/plan?autoCreate=${encodeURIComponent(city)}`);
  }

  if (picks.length === 0) return null;

  return (
    <section className={shared.section} aria-labelledby="home-season-title">
      <div className={shared.head}>
        <div className={shared.headText}>
          {desktop ? <div className={shared.eyebrow}>{t('page.season.eyebrow')}</div> : null}
          <h2 id="home-season-title" className={shared.title}>
            {t('page.season.title')}
          </h2>
          <p className={shared.sub}>{desktop ? t('page.season.sub') : t('page.season.subMobile')}</p>
        </div>
        {desktop ? <span className={`${shared.pill} ${styles.range}`}>{t('page.season.best', { range: monthRange(month, locale) })}</span> : null}
      </div>
      {desktop ? (
        <div className={styles.squares}>
          {picks.map((pick) => (
            <SquareCard key={pick.id} pick={pick} weather={weatherOf(pick.id)} onOpen={() => open(pick)} />
          ))}
        </div>
      ) : (
        <div className={styles.circles}>
          {picks.map((pick, i) => (
            <CircleCard key={pick.id} pick={pick} tone={i} weather={weatherOf(pick.id)} onOpen={() => open(pick)} />
          ))}
        </div>
      )}
      {preview ? (
        <DestinationPreviewModal
          dest={preview.dest}
          onClose={() => setPreview(null)}
          onStart={() => {
            const city = preview.city;
            setPreview(null);
            start(city);
          }}
        />
      ) : null}
    </section>
  );
}
