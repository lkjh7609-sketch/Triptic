import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useHomeCityPhoto } from '../homePhotos';
import { useTempUnit } from '@/shared/hooks/useTempUnit';
import { formatTemp } from '@/features/weather/weatherRules';
import { mapConditionCode, weatherIcon } from '@/features/weather/conditionMap';
import { useDestinationWeathers, type DestinationWeather } from '@/features/weather/destinationWeather';
import { useRequireLogin } from '@/features/auth/loginPrompt';
import { cityDescCacheKey } from '@/shared/api/aiCacheKeys';
import { cityDescQueryKey, readCachedCityDescriptions } from '../cityDescription';
import { DestinationPreviewModal, type PreviewDestination } from './DestinationPreviewModal';
import { monthRange } from './homeUtils';
import { designPhotoFor } from './seasonPhotos';
import { useSeasonPicks, type SeasonPick } from './seasonService';
import shared from './shared.module.css';
import styles from './SeasonSection.module.css';

function regionName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** 영어 도시명 + 나라 — 여행 만들기·AI 소개에 넘기는 검색하기 좋은 이름("Kyoto, Japan") */
function cityKey(pick: SeasonPick): string {
  return `${pick.nameEn}, ${regionName(pick.country, 'en')}`;
}

function CityPhoto({ pick, desktop, className }: { pick: SeasonPick; desktop: boolean; className: string }) {
  const own = designPhotoFor(pick.slug, desktop) ?? pick.cover;
  const fallback = useHomeCityPhoto(own ? null : cityKey(pick));
  return <img src={own ?? fallback} alt="" className={className} loading="lazy" decoding="async" />;
}

/** 카드에 보여줄 오늘 날씨 — "16°/24°" 글자와 날씨 아이콘 */
interface CardWeather {
  text: string;
  icon: ReactNode;
}

/** 아이콘 + 기온 글자 한 줄 */
function WeatherLine({ weather, className }: { weather: CardWeather; className: string }) {
  return (
    <span className={className}>
      {weather.icon}
      {weather.text}
    </span>
  );
}

/** 그 달 기후 한 줄 — "평균 16~24° · 월 강수량 120mm"(온도 단위는 사용자 설정) */
function seasonDesc(t: TFunction<'home'>, pick: SeasonPick, unit: 'C' | 'F'): string {
  return t('page.season.desc', { min: formatTemp(pick.stat[1], unit) ?? '–', max: formatTemp(pick.stat[0], unit) ?? '–', rain: Math.round(pick.stat[2]) });
}

function SquareCard({ pick, weather, onOpen }: { pick: SeasonPick; weather: CardWeather | null; onOpen: () => void }) {
  const { t, i18n } = useTranslation('home');
  const unit = useTempUnit();
  const country = regionName(pick.country, i18n.language);
  return (
    <button type="button" className={`${shared.card} ${shared.cardLift} ${styles.square}`} onClick={onOpen}>
      <span className={styles.squareMedia}>
        <CityPhoto pick={pick} desktop className={styles.squarePhoto} />
        <span className={styles.squareBadge}>{t(`page.season.kind.${pick.kind}`)}</span>
      </span>
      <span className={styles.squareBody}>
        <span className={styles.squareName}>{pick.name}</span>
        <span className={styles.squareMeta}>
          {country}
          {weather ? (
            <>
              {' · '}
              <WeatherLine weather={weather} className={styles.weatherInline} />
            </>
          ) : null}
        </span>
        <span className={styles.squareDesc}>{seasonDesc(t, pick, unit)}</span>
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
      <span className={styles.circleName}>{pick.name}</span>
      <span className={`${styles.circleBadge} ${tone === 0 ? styles.toneHot : tone === 1 ? styles.toneAccent : ''}`}>
        {t(`page.season.kind.${pick.kind}`)}
      </span>
      {weather ? <WeatherLine weather={weather} className={styles.circleWeather} /> : null}
    </button>
  );
}

/** "지금 가기 좋은 여행지" — 이번 달이 가기 좋은 달인 도시 6곳(인기 먼저, 도시별 월별 기후 자료 기준) + 도시마다 오늘 날씨(WeatherKit). 카드를 누르면 도시 소개 팝업 → 여행 만들기 */
export function SeasonSection({ desktop }: { desktop: boolean }) {
  const { t, i18n } = useTranslation('home');
  const navigate = useNavigate();
  const requireLogin = useRequireLogin();
  const queryClient = useQueryClient();
  const unit = useTempUnit();
  const month = useMemo(() => new Date().getMonth() + 1, []);
  const { data } = useSeasonPicks(month);
  const picks = useMemo(() => data ?? [], [data]);
  const { data: weathers } = useDestinationWeathers(useMemo(() => picks.map((p) => p.id), [picks]));
  const [preview, setPreview] = useState<{ dest: PreviewDestination; city: string } | null>(null);
  const locale = i18n.language;

  // 이미 DB에 저장된 도시 소개는 한 번에 받아 채워 둔다 — 카드를 눌렀을 때 기다림 없이
  useEffect(() => {
    const keyOf = (p: SeasonPick) => cityKey(p);
    const missing = picks.filter((p) => queryClient.getQueryData(cityDescQueryKey(keyOf(p), locale)) === undefined);
    if (missing.length === 0) return;
    let cancelled = false;
    void readCachedCityDescriptions(missing.map(keyOf), locale).then((byKey) => {
      if (cancelled) return;
      for (const p of missing) {
        const description = byKey[cityDescCacheKey(keyOf(p))];
        if (description) queryClient.setQueryData(cityDescQueryKey(keyOf(p), locale), description);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [picks, queryClient, locale]);

  function weatherOf(pick: SeasonPick): CardWeather | null {
    const w: DestinationWeather | undefined = weathers?.[pick.id];
    if (!w) return null;
    const min = formatTemp(w.tminC, unit);
    const max = formatTemp(w.tmaxC, unit);
    if (min === null && max === null) return null;
    const condition = w.conditionCode ? mapConditionCode(w.conditionCode) : null;
    return { text: `${min ?? '–'}/${max ?? '–'}`, icon: condition ? <span aria-hidden="true" className={styles.weatherIcon}>{weatherIcon(condition, true)}</span> : null };
  }

  function photoOf(pick: SeasonPick): string {
    return designPhotoFor(pick.slug, desktop) ?? pick.cover ?? '';
  }

  function open(pick: SeasonPick) {
    setPreview({
      city: cityKey(pick),
      dest: {
        city: cityKey(pick),
        title: `${regionName(pick.country, locale)} ${pick.name}`,
        image: photoOf(pick),
        fallbackDesc: seasonDesc(t, pick, unit),
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
            <SquareCard key={pick.id} pick={pick} weather={weatherOf(pick)} onOpen={() => open(pick)} />
          ))}
        </div>
      ) : (
        <div className={styles.circles}>
          {picks.map((pick, i) => (
            <CircleCard key={pick.id} pick={pick} tone={i} weather={weatherOf(pick)} onOpen={() => open(pick)} />
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
