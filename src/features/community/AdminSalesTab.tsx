import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ExternalLink } from 'lucide-react';
import { ErrorState } from '@/shared/ui/states/ErrorState';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import {
  SALES_RANGES,
  fetchAdminSales,
  isCancelled,
  salesRange,
  summarizeSales,
  type SalesProvider,
  type SalesRange,
} from './salesService';
import styles from './AdminSalesTab.module.css';

function formatKrw(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(amount);
}

function formatDate(value: string | null, locale: string): string {
  if (!value) return '';
  // 예약 시각은 UTC(끝에 Z 없이 옴), 정산일은 날짜만
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : `${value}Z`);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

function ProviderSales({ provider }: { provider: SalesProvider }) {
  const { t, i18n } = useTranslation('community');
  const lang = i18n.language;
  const placementLabel = (p: string | null) => t(`admin.sales.placement.${p ?? 'unknown'}`, { defaultValue: p ?? '' });

  const header = (
    <div className={styles.providerHead}>
      <span className={styles.providerName}>{provider.name}</span>
      <span className={provider.status === 'ok' ? styles.statusOk : provider.status === 'error' ? styles.statusError : styles.statusMuted}>
        {t(`admin.sales.status.${provider.status}`)}
      </span>
      {provider.dashboardUrl ? (
        <a href={provider.dashboardUrl} target="_blank" rel="noopener noreferrer" className={styles.dashboardLink}>
          {t('admin.sales.openDashboard')} <ExternalLink size={12} aria-hidden="true" />
        </a>
      ) : null}
    </div>
  );

  if (provider.status !== 'ok') {
    return (
      <section className={styles.provider}>
        {header}
        {provider.status === 'not_configured' ? <p className={styles.hint}>{t('admin.sales.notConfiguredHint')}</p> : null}
        {provider.status === 'not_integrated' ? <p className={styles.hint}>{t('admin.sales.notIntegratedHint')}</p> : null}
      </section>
    );
  }

  const summary = summarizeSales(provider);
  const reservations = provider.reservations ?? [];
  const revenues = provider.revenues ?? [];

  return (
    <section className={styles.provider}>
      {header}
      {provider.failed && provider.failed.length > 0 ? <p className={styles.warning}>{t('admin.sales.partialError')}</p> : null}

      <div className={styles.tiles}>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>{t('admin.sales.bookings')}</span>
          <span className={styles.tileValue}>{summary.bookings.toLocaleString(lang)}</span>
          {summary.cancelled > 0 ? <span className={styles.tileSub}>{t('admin.sales.cancelled', { count: summary.cancelled })}</span> : null}
        </div>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>{t('admin.sales.salesAmount')}</span>
          <span className={styles.tileValue}>{formatKrw(summary.salesAmount, lang)}</span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>{t('admin.sales.commission')}</span>
          <span className={styles.tileValue}>{formatKrw(summary.commission, lang)}</span>
        </div>
      </div>

      <h3 className={styles.listTitle}>{t('admin.sales.reservations')}</h3>
      {reservations.length === 0 ? (
        <p className={styles.hint}>{t('admin.sales.noReservations')}</p>
      ) : (
        <ul className={styles.rows}>
          {reservations.map((r, i) => (
            <li key={`${r.kind}-${r.reservationNo ?? i}`} className={isCancelled(r) ? styles.rowCancelled : styles.row}>
              <span className={styles.rowDate}>{formatDate(r.reservedAt, lang)}</span>
              <span className={styles.rowMain}>
                <span className={styles.rowTitle}>
                  {r.kind === 'flight' ? `${t('admin.sales.flight')} · ` : ''}
                  {r.title ?? r.reservationNo}
                </span>
                <span className={styles.rowMeta}>
                  {[r.statusLabel ?? r.status, placementLabel(r.placement), r.reservationNo].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span className={styles.rowAmount}>{r.amount != null ? formatKrw(r.amount, lang) : ''}</span>
            </li>
          ))}
        </ul>
      )}

      <h3 className={styles.listTitle}>{t('admin.sales.revenues')}</h3>
      <p className={styles.hint}>{t('admin.sales.revenueNote')}</p>
      {revenues.length === 0 ? (
        <p className={styles.hint}>{t('admin.sales.noRevenues')}</p>
      ) : (
        <ul className={styles.rows}>
          {revenues.map((r, i) => (
            <li key={`${r.kind}-${r.reservationNo ?? ''}-${i}`} className={styles.row}>
              <span className={styles.rowDate}>{formatDate(r.date, lang)}</span>
              <span className={styles.rowMain}>
                <span className={styles.rowTitle}>
                  {r.kind === 'flight' ? `${t('admin.sales.flight')} · ` : ''}
                  {r.title ?? r.reservationNo}
                </span>
                <span className={styles.rowMeta}>
                  {[r.closingType, r.commissionRate != null ? `${r.commissionRate}%` : null, placementLabel(r.placement)].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span className={r.commission < 0 ? styles.rowAmountNegative : styles.rowAmount}>{formatKrw(r.commission, lang)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** 관리자 "판매" 탭 — 제휴사별 예약·수익(api/adminSales.js). 판매 API가 없는 제휴사는 "연동 전"으로만 */
export function AdminSalesTab() {
  const { t } = useTranslation('community');
  const [days, setDays] = useState<SalesRange>(30);
  const { from, to } = salesRange(days);
  const query = useQuery({
    queryKey: ['admin', 'sales', from, to],
    queryFn: () => fetchAdminSales(from, to),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  return (
    <div>
      <div className={styles.ranges} role="group" aria-label={t('admin.sales.rangeLabel', { from, to })}>
        {SALES_RANGES.map((d) => (
          <button key={d} type="button" aria-pressed={days === d} className={days === d ? styles.rangeOn : styles.rangeOff} onClick={() => setDays(d)}>
            {t('admin.sales.lastDays', { count: d })}
          </button>
        ))}
        <span className={styles.rangeText}>{t('admin.sales.rangeLabel', { from, to })}</span>
      </div>

      {query.isLoading ? (
        <Skeleton height="160px" />
      ) : query.isError || !query.data ? (
        <ErrorState summary={t('admin.sales.loadError')} onRetry={() => query.refetch()} />
      ) : (
        <div className={styles.providers}>
          {query.data.providers.map((p) => (
            <ProviderSales key={p.id} provider={p} />
          ))}
        </div>
      )}
    </div>
  );
}
