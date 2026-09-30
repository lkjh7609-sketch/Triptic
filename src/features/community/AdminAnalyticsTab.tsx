import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ExternalLink } from 'lucide-react';
import { ErrorState } from '@/shared/ui/states/ErrorState';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import {
  ANALYTICS_RANGES,
  fetchAdminAnalytics,
  fillDailyGaps,
  percentOf,
  type AnalyticsRange,
  type PosthogReport,
  type SentryReport,
} from './analyticsService';
import sales from './AdminSalesTab.module.css';
import styles from './AdminAnalyticsTab.module.css';

function SourceHead({ name, status, url }: { name: string; status: 'ok' | 'not_configured' | 'error'; url: string | null }) {
  const { t } = useTranslation('community');
  return (
    <div className={sales.providerHead}>
      <span className={sales.providerName}>{name}</span>
      <span className={status === 'ok' ? sales.statusOk : status === 'error' ? sales.statusError : sales.statusMuted}>
        {t(`admin.sales.status.${status}`)}
      </span>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className={sales.dashboardLink}>
          {t('admin.sales.openDashboard')} <ExternalLink size={12} aria-hidden="true" />
        </a>
      ) : null}
    </div>
  );
}

function Unavailable({ report }: { report: PosthogReport | SentryReport }) {
  const { t } = useTranslation('community');
  if (report.status === 'not_configured') {
    return <p className={sales.hint}>{t('admin.analytics.notConfigured', { names: (report.missing ?? []).join(', ') })}</p>;
  }
  const status = report.httpStatus ?? null;
  // 상대 서버가 돌려준 HTTP 상태로 원인을 짚어 준다(값·키는 절대 안 보임)
  const hint = status === 401 ? 'auth' : status === 403 ? 'forbidden' : status === 404 ? 'notFound' : status === 400 ? 'badRequest' : null;
  return (
    <>
      <p className={sales.warning}>{t('admin.analytics.sourceError')}</p>
      {hint ? <p className={sales.hint}>{t(`admin.analytics.errorHint.${hint}`, { status })}</p> : status ? <p className={sales.hint}>HTTP {status}</p> : null}
      {'tokenHint' in report && report.tokenHint ? (
        <p className={sales.hint}>
          {t('admin.analytics.tokenShape', { length: report.tokenHint.length, prefix: report.tokenHint.prefix ?? t('admin.analytics.noPrefix') })}
          {report.tokenHint.hadJunk ? ` ${t('admin.analytics.tokenJunk')}` : ''}
        </p>
      ) : null}
    </>
  );
}

function PosthogSection({ report, days }: { report: PosthogReport; days: number }) {
  const { t, i18n } = useTranslation('community');
  const lang = i18n.language;
  const head = <SourceHead name={t('admin.analytics.posthog')} status={report.status} url={report.dashboardUrl} />;
  if (report.status !== 'ok') {
    return (
      <section className={sales.provider}>
        {head}
        <Unavailable report={report} />
      </section>
    );
  }
  const events = report.events ?? [];
  const stat = (name: string) => events.find((e) => e.event === name) ?? { event: name, events: 0, users: 0 };
  const visitors = stat('screen_view').users;
  const daily = fillDailyGaps(report.daily ?? [], days);
  const maxDaily = Math.max(1, ...daily.map((d) => d.users));
  const fmt = (n: number) => n.toLocaleString(lang);

  return (
    <section className={sales.provider}>
      {head}
      <div className={sales.tiles}>
        <div className={sales.tile}>
          <span className={sales.tileLabel}>{t('admin.analytics.visitors')}</span>
          <span className={sales.tileValue}>{fmt(visitors)}</span>
        </div>
        <div className={sales.tile}>
          <span className={sales.tileLabel}>{t('admin.analytics.signups')}</span>
          <span className={sales.tileValue}>{fmt(stat('signup_completed').users)}</span>
        </div>
        <div className={sales.tile}>
          <span className={sales.tileLabel}>{t('admin.analytics.tripMakers')}</span>
          <span className={sales.tileValue}>{fmt(stat('trip_created').users)}</span>
        </div>
      </div>

      <h3 className={sales.listTitle}>{t('admin.analytics.eventsTitle')}</h3>
      <div role="table" aria-label={t('admin.analytics.eventsTitle')}>
        <div role="row" className={styles.eventHead}>
          <span role="columnheader">{t('admin.analytics.colEvent')}</span>
          <span role="columnheader" className={styles.num}>{t('admin.analytics.colUsers')}</span>
          <span role="columnheader" className={styles.num}>{t('admin.analytics.colCount')}</span>
          <span role="columnheader" className={styles.num}>{t('admin.analytics.colRate')}</span>
        </div>
        {events.map((e) => {
          const rate = e.event === 'screen_view' ? null : percentOf(e.users, visitors);
          return (
            <div role="row" key={e.event} className={styles.eventRow}>
              <span role="cell" className={styles.eventName}>{t(`admin.analytics.event.${e.event}`, { defaultValue: e.event })}</span>
              <span role="cell" className={e.users === 0 ? styles.zero : styles.num}>{fmt(e.users)}</span>
              <span role="cell" className={e.events === 0 ? styles.zero : styles.num}>{fmt(e.events)}</span>
              <span role="cell" className={rate == null ? styles.zero : styles.num}>{rate == null ? '–' : `${rate}%`}</span>
            </div>
          );
        })}
      </div>

      <h3 className={sales.listTitle}>{t('admin.analytics.dailyTitle')}</h3>
      <div className={styles.bars} role="img" aria-label={t('admin.analytics.dailyTitle')}>
        {daily.map((d) => (
          <div key={d.day} className={styles.barCol} title={`${d.day} · ${fmt(d.users)}`}>
            {daily.length <= 14 ? <span className={styles.barValue}>{d.users > 0 ? fmt(d.users) : ''}</span> : null}
            <span className={d.users > 0 ? styles.bar : styles.barZero} style={{ height: `${(d.users / maxDaily) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className={styles.barAxis}>
        <span>{daily[0].day.slice(5)}</span>
        <span>{daily[daily.length - 1].day.slice(5)}</span>
      </div>

      <h3 className={sales.listTitle}>{t('admin.analytics.screensTitle')}</h3>
      {(report.screens ?? []).length === 0 ? (
        <p className={sales.hint}>{t('admin.analytics.noData')}</p>
      ) : (
        <ul className={sales.rows}>
          {(report.screens ?? []).map((s) => (
            <li key={s.screen} className={sales.row}>
              <span className={sales.rowMain}>
                <span className={sales.rowTitle}>{s.screen}</span>
              </span>
              <span className={sales.rowAmount}>{fmt(s.views)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SentrySection({ report }: { report: SentryReport }) {
  const { t, i18n } = useTranslation('community');
  const lang = i18n.language;
  const head = <SourceHead name={t('admin.analytics.sentry')} status={report.status} url={report.dashboardUrl} />;
  if (report.status !== 'ok') {
    return (
      <section className={sales.provider}>
        {head}
        <Unavailable report={report} />
      </section>
    );
  }
  const issues = report.issues ?? [];
  return (
    <section className={sales.provider}>
      {head}
      <h3 className={sales.listTitle}>{t('admin.analytics.issuesTitle')}</h3>
      {issues.length === 0 ? (
        <p className={sales.hint}>{t('admin.analytics.noIssues')}</p>
      ) : (
        <ul className={sales.rows}>
          {issues.map((i) => {
            const title = <span className={sales.rowTitle}>{i.title}</span>;
            return (
              <li key={i.id} className={sales.row}>
                <span className={i.level === 'error' || i.level === 'fatal' ? styles.levelError : styles.level}>{i.level}</span>
                <span className={sales.rowMain}>
                  {i.permalink ? (
                    <a href={i.permalink} target="_blank" rel="noopener noreferrer" className={styles.issueLink}>
                      {title}
                    </a>
                  ) : (
                    title
                  )}
                  <span className={sales.rowMeta}>
                    {t('admin.analytics.issueMeta', {
                      count: i.count.toLocaleString(lang),
                      users: i.userCount.toLocaleString(lang),
                      when: i.lastSeen ? new Date(i.lastSeen).toLocaleString(lang, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-',
                    })}
                    {i.culprit ? ` · ${i.culprit}` : ''}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** 관리자 "분석" 탭 — PostHog 이용 분석과 Sentry 오류 요약(api/adminAnalytics.js). 키를 안 넣은 쪽은 "연결 전"으로만 보인다 */
export function AdminAnalyticsTab() {
  const { t, i18n } = useTranslation('community');
  const [days, setDays] = useState<AnalyticsRange>(7);
  const query = useQuery({
    queryKey: ['admin', 'analytics', days],
    queryFn: () => fetchAdminAnalytics(days),
    staleTime: 60 * 1000,
    retry: false,
  });

  return (
    <div>
      <div className={sales.ranges} role="group" aria-label={t('admin.analytics.rangeLabel')}>
        {ANALYTICS_RANGES.map((d) => (
          <button key={d} type="button" aria-pressed={days === d} className={days === d ? sales.rangeOn : sales.rangeOff} onClick={() => setDays(d)}>
            {t('admin.sales.lastDays', { count: d })}
          </button>
        ))}
      </div>

      {query.isLoading ? (
        <Skeleton height="160px" />
      ) : query.isError || !query.data ? (
        <ErrorState summary={t('admin.analytics.loadError')} onRetry={() => query.refetch()} />
      ) : (
        <>
          <div className={sales.providers}>
            <PosthogSection report={query.data.posthog} days={query.data.days} />
            <SentrySection report={query.data.sentry} />
          </div>
          <p className={styles.updated}>
            {t('admin.analytics.updatedAt', { when: new Date(query.data.generatedAt).toLocaleString(i18n.language) })}
          </p>
        </>
      )}
    </div>
  );
}
