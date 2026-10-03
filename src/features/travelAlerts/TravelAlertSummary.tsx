import { useState } from 'react';
import { ChevronDown, TriangleAlert } from 'lucide-react';
import { WARN_LEVEL, type AlertLevel, type CountryAlert } from './alertInfo';
import { useTravelAlerts } from './useTravelAlerts';
import { useAlertLabels } from './useAlertLabels';
import styles from './TravelAlertSummary.module.css';

const LEVELS: AlertLevel[] = [4, 3, 2];

/** 커뮤니티 홈의 '현재 여행경보 현황' 카드 — 여행자제(2단계) 이상인 나라를 단계별로. 접어 두었다가 펼친다. 글이 아니라 현재 경보를 읽어 보여 주므로 매일 갱신·해제가 저절로 반영된다 */
export function TravelAlertSummary() {
  const { alerts } = useTravelAlerts();
  const { t, countryName, levelName } = useAlertLabels();
  const [open, setOpen] = useState(false);

  const byLevel = new Map<AlertLevel, CountryAlert[]>();
  for (const alert of alerts.values()) {
    if (alert.baseLevel < WARN_LEVEL) continue;
    const list = byLevel.get(alert.baseLevel as AlertLevel) ?? [];
    list.push(alert);
    byLevel.set(alert.baseLevel as AlertLevel, list);
  }
  const total = [...byLevel.values()].reduce((n, l) => n + l.length, 0);
  if (total === 0) return null;

  return (
    <section className={styles.card} aria-label={t('travelAlert.summary.title')}>
      <button
        type="button"
        className={styles.head}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <TriangleAlert size={18} aria-hidden="true" className={styles.icon} />
        <span className={styles.title}>{t('travelAlert.summary.title')}</span>
        <span className={styles.count}>{t('travelAlert.summary.count', { count: total })}</span>
        <ChevronDown
          size={18}
          aria-hidden="true"
          className={open ? styles.chevronOpen : styles.chevron}
        />
      </button>
      {open ? (
        <div className={styles.body}>
          {LEVELS.filter((level) => byLevel.has(level)).map((level) => (
            <div key={level} className={styles.group}>
              <h3 className={`${styles.level} ${styles[`tone${level}`]}`}>
                {t('travelAlert.summary.level', { level, name: levelName(level) })}
              </h3>
              <p className={styles.countries}>
                {byLevel
                  .get(level)!
                  .map((a) => countryName(a))
                  .sort((a, b) => a.localeCompare(b))
                  .join(' · ')}
              </p>
            </div>
          ))}
          <p className={styles.note}>{t('travelAlert.summary.note')}</p>
        </div>
      ) : null}
    </section>
  );
}
