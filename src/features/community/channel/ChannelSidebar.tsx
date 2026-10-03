import { Route as RouteIcon, Zap } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { PopularTag } from '../communityService';
import type { CompanionPost, DestinationGuide } from '../types';
import {
  defaultForeignAmount,
  formatKrwApprox,
  formatPriceRange,
  koreaTimeDiffMinutes,
  parseAmount,
  pickText,
  splitDiff,
} from './channelHelpers';
import styles from './ChannelSidebar.module.css';

/** 한국과의 시차 문구 — 항상 한국 기준 */
function useTimeDiffText(timezone: string): string | null {
  const { t } = useTranslation('community');
  const diff = koreaTimeDiffMinutes(timezone);
  if (diff == null) return null;
  if (diff === 0) return t('channel.timeDiff.same');
  const { hours, minutes, ahead } = splitDiff(diff);
  const time =
    hours === 0
      ? t('channel.timeDiff.m', { m: minutes })
      : minutes === 0
        ? t('channel.timeDiff.h', { h: hours })
        : t('channel.timeDiff.hm', { h: hours, m: minutes });
  return t(ahead ? 'channel.timeDiff.ahead' : 'channel.timeDiff.behind', { time });
}

interface TripCardProps {
  city: string;
  timezone: string;
  guide: DestinationGuide | null | undefined;
  onCreateTrip: () => void;
}

/** 여행 일정 만들기 카드 — 추천 기간·최적 시기(내용이 있을 때만)·시차 */
export function TripCard({ city, timezone, guide, onCreateTrip }: TripCardProps) {
  const { t, i18n } = useTranslation('community');
  const timeDiff = useTimeDiffText(timezone);
  const length = pickText(guide?.trip_length, i18n.language);
  const season = pickText(guide?.best_season, i18n.language);

  return (
    <section className={styles.card} aria-labelledby="channel-trip-title">
      <h2 id="channel-trip-title" className={styles.cardTitle}>
        <RouteIcon size={20} aria-hidden="true" className={styles.titleIcon} />
        {t('channel.tripCard.title', { city })}
      </h2>
      <p className={styles.desc}>{t('channel.tripCard.desc')}</p>
      {length || season || timeDiff ? (
        <dl className={styles.facts}>
          {length ? (
            <div className={styles.factRow}>
              <dt>{t('channel.tripCard.length')}</dt>
              <dd>{length}</dd>
            </div>
          ) : null}
          {season ? (
            <div className={styles.factRow}>
              <dt>{t('channel.tripCard.season')}</dt>
              <dd>{season}</dd>
            </div>
          ) : null}
          {timeDiff ? (
            <div className={styles.factRow}>
              <dt>{t('channel.tripCard.timeDiff')}</dt>
              <dd>{timeDiff}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      <button type="button" className={styles.primaryBtn} onClick={onCreateTrip}>
        {t('channel.tripCard.cta')}
      </button>
    </section>
  );
}

/** 물가 예시 줄들 — 현지 통화 금액, 환율이 있으면 원화 어림값을 함께 */
function PriceList({
  guide,
  currency,
  rateToKrw,
}: {
  guide: DestinationGuide;
  currency: string;
  rateToKrw: number | null;
}) {
  const { t, i18n } = useTranslation('community');
  return (
    <ul className={styles.priceList}>
      {guide.prices.map((p) => (
        <li key={p.key} className={styles.priceRow}>
          <span className={styles.priceLabel}>
            {p.label ? pickText(p.label, i18n.language) : t(`channel.prices.${p.key}`)}
          </span>
          <span className={styles.priceValue}>
            <strong>{formatPriceRange(p.min, p.max, currency, i18n.language)}</strong>
            {rateToKrw ? (
              <span className={styles.priceKrw}>
                {formatKrwApprox(p.min, p.max, rateToKrw, i18n.language)}
              </span>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

interface FxCardProps {
  currency: string;
  /** 1 현지 통화 = 몇 원. 환율 테이블에 없는 통화(또는 원화)면 null → 계산기는 숨기고 물가 예시만 */
  rateToKrw: number | null;
  guide: DestinationGuide | null | undefined;
}

/** 실시간 환율 계산기(환율이 있는 도시만) + 물가 예시(내용이 있는 도시만). 둘 다 없으면 아무것도 그리지 않는다 */
export function FxAndPricesCard({ currency, rateToKrw, guide }: FxCardProps) {
  const { t, i18n } = useTranslation('community');
  const hasPrices = !!guide && guide.prices.length > 0;
  if (!rateToKrw && !hasPrices) return null;

  return (
    <section className={styles.card} aria-labelledby="channel-fx-title">
      {rateToKrw ? (
        <>
          <h2 id="channel-fx-title" className={styles.cardTitle}>
            {t('channel.fx.title')}
          </h2>
          <FxCalculator currency={currency} rateToKrw={rateToKrw} language={i18n.language} />
        </>
      ) : (
        <h2 id="channel-fx-title" className={styles.cardTitle}>
          {t('channel.prices.title')}
        </h2>
      )}
      {hasPrices ? (
        <div className={rateToKrw ? styles.pricesBlock : undefined}>
          {rateToKrw ? <h3 className={styles.subTitle}>{t('channel.prices.title')}</h3> : null}
          <PriceList guide={guide} currency={currency} rateToKrw={rateToKrw} />
          <p className={styles.note}>
            {t(rateToKrw ? 'channel.prices.note' : 'channel.prices.notePlain')}
          </p>
        </div>
      ) : null}
    </section>
  );
}

function formatInput(value: number, maxFraction: number, language: string): string {
  return value.toLocaleString(language, { maximumFractionDigits: maxFraction, useGrouping: true });
}

function FxCalculator({
  currency,
  rateToKrw,
  language,
}: {
  currency: string;
  rateToKrw: number;
  language: string;
}) {
  const { t } = useTranslation('community');
  const [foreign, setForeign] = useState(() =>
    formatInput(defaultForeignAmount(rateToKrw), 2, language),
  );
  const [krw, setKrw] = useState(() =>
    formatInput(Math.round(defaultForeignAmount(rateToKrw) * rateToKrw), 0, language),
  );

  function onForeign(text: string) {
    setForeign(text);
    const n = parseAmount(text);
    setKrw(n == null ? '' : formatInput(Math.round(n * rateToKrw), 0, language));
  }

  function onKrw(text: string) {
    setKrw(text);
    const n = parseAmount(text);
    setForeign(n == null ? '' : formatInput(n / rateToKrw, 2, language));
  }

  return (
    <div className={styles.fx}>
      <label className={styles.fxField}>
        <span className={styles.fxCode}>{currency}</span>
        <input
          className={styles.fxInput}
          inputMode="decimal"
          value={foreign}
          onChange={(e) => onForeign(e.target.value)}
          aria-label={t('channel.fx.inputAria', { currency })}
        />
      </label>
      <label className={styles.fxField}>
        <span className={styles.fxCode}>KRW</span>
        <input
          className={styles.fxInput}
          inputMode="decimal"
          value={krw}
          onChange={(e) => onKrw(e.target.value)}
          aria-label={t('channel.fx.inputAria', { currency: 'KRW' })}
        />
      </label>
    </div>
  );
}

/** 급구! 동행 — 출발이 가장 가까운 모집 중 글 */
export function UrgentCompanionsCard({ posts }: { posts: CompanionPost[] }) {
  const { t } = useTranslation('community');
  if (posts.length === 0) return null;

  function departure(post: CompanionPost): string {
    if (!post.start_date) return '';
    const days = differenceInCalendarDays(parseISO(post.start_date), new Date());
    if (days <= 0) return t('channel.urgent.today');
    if (days === 1) return t('channel.urgent.tomorrow');
    return t('channel.urgent.days', { count: days });
  }

  return (
    <section className={styles.card} aria-labelledby="channel-urgent-title">
      <h2 id="channel-urgent-title" className={styles.cardTitle}>
        <Zap size={20} aria-hidden="true" className={styles.titleIcon} />
        {t('channel.urgent.title')}
      </h2>
      <ul className={styles.urgentList}>
        {posts.map((post) => (
          <li key={post.id}>
            <Link to={`/community/companion/${post.id}`} className={styles.urgentItem}>
              <span className={styles.urgentBadge}>{departure(post)}</span>
              <span className={styles.urgentTitle}>{post.title}</span>
              <span className={styles.urgentMeta}>
                {post.start_date && post.end_date
                  ? t('companion.detail.dateRange', { start: post.start_date, end: post.end_date })
                  : t('channel.scheduleTbd')}
                {' · '}
                {t('channel.recruitCount', { count: post.group_size })}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** 이 도시 인기 태그 — 누르면 그 태그가 달린 글만 본다 */
export function PopularTagsCard({
  city,
  tags,
  onTagClick,
}: {
  city: string;
  tags: PopularTag[];
  onTagClick: (tag: string) => void;
}) {
  const { t } = useTranslation('community');
  if (tags.length === 0) return null;
  return (
    <section className={styles.card} aria-labelledby="channel-tags-title">
      <h2 id="channel-tags-title" className={styles.cardTitle}>
        {t('channel.popularTags', { city })}
      </h2>
      <div className={styles.tagCloud}>
        {tags.map((item) => (
          <button
            key={item.tag}
            type="button"
            className={styles.tagBtn}
            onClick={() => onTagClick(item.tag)}
          >
            #{item.tag}
          </button>
        ))}
      </div>
    </section>
  );
}
