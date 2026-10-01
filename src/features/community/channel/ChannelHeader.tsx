import { ArrowLeft, Banknote, CalendarPlus, Users } from 'lucide-react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { WeatherIcon } from '@/features/home/stitch/weatherIcon';
import type { FxRates } from '@/features/plan/fxRates';
import { formatTemp } from '@/features/weather/weatherRules';
import { useTempUnit } from '@/shared/hooks/useTempUnit';
import { getRate } from '@/features/plan/fxRates';
import type { CurrentWeather } from '../hooks/useDestinationChannel';
import type { Destination, LocalizedText } from '../types';
import { continentOf, pickText, weatherKey } from './channelHelpers';
import styles from './ChannelHeader.module.css';

interface ChannelHeaderProps {
  destination: Destination;
  landmarks: LocalizedText[];
  fxRates: FxRates | undefined;
  weather: CurrentWeather | undefined;
  followerCount: number | undefined;
  isFollowing: boolean;
  followDisabled: boolean;
  followPending: boolean;
  onToggleFollow: () => void;
  onCreateTrip: () => void;
  onLandmarkClick: (name: string) => void;
}

/** 도시 채널 머리말 — 브레드크럼, 영문명(크게)+현재 언어명(작게), 환율·날씨·팔로워 줄, 팔로우·일정 만들기, 대표 명소 태그 */
export function ChannelHeader({
  destination,
  landmarks,
  fxRates,
  weather,
  followerCount,
  isFollowing,
  followDisabled,
  followPending,
  onToggleFollow,
  onCreateTrip,
  onLandmarkClick,
}: ChannelHeaderProps) {
  const { t, i18n } = useTranslation('community');
  const unit = useTempUnit();
  const continent = continentOf(destination.country_code);
  const englishName = destination.nameEn ?? destination.name;
  const showLocalName = destination.name !== englishName;

  // 환율 칸은 환율 테이블에 있는 통화(원화 제외)의 도시에서만 보인다
  const rate =
    destination.currency && destination.currency !== 'KRW'
      ? getRate(fxRates, destination.currency, 'KRW')
      : null;
  const wKey = weather ? weatherKey(weather.code) : null;
  const stories = destination.post_count;

  return (
    <header className={styles.header}>
      <nav className={styles.breadcrumb} aria-label={t('channel.breadcrumbNav')}>
        <Link to="/community" className={styles.crumbLink}>
          <ArrowLeft size={16} aria-hidden="true" />
          {t('channel.breadcrumbAll')}
        </Link>
        {continent ? (
          <>
            <span className={styles.crumbSep} aria-hidden="true">
              /
            </span>
            <Link to={`/community?continent=${continent}`} className={styles.crumbPlain}>
              {t(`continent.${continent}.name`)}
            </Link>
          </>
        ) : null}
        <span className={styles.crumbSep} aria-hidden="true">
          /
        </span>
        <span className={styles.crumbCurrent} aria-current="page">
          {destination.name}
        </span>
      </nav>

      <div className={styles.top}>
        <div className={styles.titleBlock}>
          <span className={styles.eyebrow}>
            <span className={styles.eyebrowDot} aria-hidden="true" />
            {destination.country_code} · {destination.timezone.toUpperCase()}
          </span>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{englishName}</h1>
            {showLocalName ? <span className={styles.localName}>{destination.name}</span> : null}
          </div>
          <div className={styles.facts}>
            {rate && destination.currency ? (
              <span className={styles.fact}>
                <Banknote size={16} aria-hidden="true" />
                {t('channel.rate', {
                  currency: destination.currency,
                  amount: rate.toLocaleString(i18n.language, {
                    maximumFractionDigits: rate < 10 ? 2 : 1,
                  }),
                })}
              </span>
            ) : null}
            {weather ? (
              <span className={styles.fact}>
                <WeatherIcon code={weather.code} size={16} />
                {t('channel.weatherNow', {
                  temp: `${formatTemp(weather.temp, unit)}${unit}`,
                  condition: wKey ? t(`channel.weather.${wKey}`) : '',
                }).trim()}
                {weather.feelsLike != null
                  ? ` ${t('channel.weatherFeels', { temp: `${formatTemp(weather.feelsLike, unit)}${unit}` })}`
                  : ''}
              </span>
            ) : null}
            <span className={styles.fact}>
              <Users size={16} aria-hidden="true" />
              {followerCount != null
                ? `${t('channel.followers', { count: followerCount })} · `
                : ''}
              {t('channel.stories', { count: stories })}
            </span>
          </div>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={isFollowing ? styles.followingBtn : styles.followBtn}
            aria-pressed={isFollowing}
            disabled={followDisabled || followPending}
            onClick={onToggleFollow}
          >
            {isFollowing ? t('channel.following') : t('channel.follow')}
          </button>
          <button type="button" className={styles.tripBtn} onClick={onCreateTrip}>
            <CalendarPlus size={18} aria-hidden="true" />
            {t('channel.createTrip', { city: destination.name })}
          </button>
        </div>
      </div>

      {landmarks.length > 0 ? (
        <div className={styles.landmarks}>
          <span className={styles.landmarksLabel}>{t('channel.landmarks')}</span>
          {landmarks.map((spot) => {
            const name = pickText(spot, i18n.language);
            return (
              <button
                key={spot.en}
                type="button"
                className={styles.landmark}
                aria-label={t('channel.landmarkSearch', { name })}
                onClick={() => onLandmarkClick(name)}
              >
                # {name}
              </button>
            );
          })}
        </div>
      ) : null}
    </header>
  );
}
