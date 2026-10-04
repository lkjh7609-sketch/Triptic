import { PlaneLanding, PlaneTakeoff, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import {
  delayMinutes,
  formatHhmm,
  statusInfo,
  terminalLabel,
  type BoardDirection,
  type BoardFlight,
} from './boardParse';
import styles from './FlightDetailDialog.module.css';

interface FlightDetailDialogProps {
  flight: BoardFlight;
  direction: BoardDirection;
  korean: boolean;
  /** 데이터 출처 — 아래 안내 문구(인천국제공항공사 / 한국공항공사) */
  source?: 'icn' | 'kac';
  onClose: () => void;
}

/** 전광판 줄을 누르면 열리는 편 상세 — 모바일은 하단 시트, PC는 가운데 창. 바깥을 눌러도 닫히지 않는다(닫기·Esc로만) */
export function FlightDetailDialog({
  flight,
  direction,
  korean,
  source = 'icn',
  onClose,
}: FlightDetailDialogProps) {
  const { t } = useTranslation('home');
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);
  const departures = direction === 'departures';
  const info = statusInfo(flight.remark);
  const terminal = terminalLabel(flight.terminal);
  const changed = flight.estimated !== flight.scheduled;
  const late = delayMinutes(flight) > 0;
  const Icon = departures ? PlaneTakeoff : PlaneLanding;
  const place = korean ? flight.city || flight.airportCode : flight.airportCode || flight.city;
  const placeSub = korean ? flight.airportCode : flight.city;

  const rows: { label: string; value: string }[] = [
    { label: t('airport.detail.scheduled'), value: formatHhmm(flight.scheduled) },
    ...(changed
      ? [
          {
            label: t(
              late || info?.tone !== 'done' ? 'airport.detail.estimated' : 'airport.detail.actual',
            ),
            value: formatHhmm(flight.estimated),
          },
        ]
      : []),
    {
      label: t('airport.col.terminal'),
      value: terminal.key ? t(`airport.terminal.${terminal.key}`) : terminal.raw,
    },
    ...(departures
      ? [
          { label: t('airport.col.gate'), value: flight.gate },
          { label: t('airport.detail.counter'), value: flight.counter },
        ]
      : [
          { label: t('airport.detail.gateArr'), value: flight.gate },
          { label: t('airport.col.carousel'), value: flight.carousel },
          { label: t('airport.detail.exit'), value: flight.exit },
        ]),
    ...(flight.stopovers.length > 0
      ? [{ label: t('airport.detail.stopovers'), value: flight.stopovers.join(' → ') }]
      : []),
  ].filter((r) => r.value);

  return createPortal(
    <div className={styles.overlay}>
      <div
        ref={trapRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="flight-detail-title"
      >
        <div className={styles.handle} aria-hidden="true" />
        <div className={styles.head}>
          <span className={styles.icon} aria-hidden="true">
            <Icon size={20} />
          </span>
          <div className={styles.headText}>
            <h2 id="flight-detail-title" className={styles.title}>
              {flight.id}
            </h2>
            <p className={styles.airline}>{flight.airline}</p>
          </div>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label={t('airport.detail.close')}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className={styles.route}>
          <span className={styles.routeLabel}>
            {t(departures ? 'airport.detail.routeTo' : 'airport.detail.routeFrom')}
          </span>
          <span className={styles.routePlace}>{place}</span>
          {placeSub && placeSub !== place ? (
            <span className={styles.routeSub}>{placeSub}</span>
          ) : null}
        </div>

        {flight.remark ? (
          <p className={`${styles.status} ${styles[`tone_${info?.tone ?? 'neutral'}`]}`}>
            {info ? t(`airport.status.${info.key}`) : flight.remark}
          </p>
        ) : null}

        <dl className={styles.facts}>
          {rows.map((row) => (
            <div key={row.label} className={styles.fact}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>

        {flight.codeshares.length > 0 ? (
          <div className={styles.codeshare}>
            <h3 className={styles.codeshareTitle}>{t('airport.detail.codeshare')}</h3>
            <ul className={styles.codeshareList}>
              {flight.codeshares.map((c) => (
                <li key={c.id} className={styles.codeshareItem}>
                  <strong>{c.id}</strong>
                  <span>{c.airline}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className={styles.note}>{t(source === 'kac' ? 'airport.detail.noteKac' : 'airport.detail.note')}</p>
      </div>
    </div>,
    document.body,
  );
}
