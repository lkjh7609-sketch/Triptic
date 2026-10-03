import { TriangleAlert } from 'lucide-react';
import { isWarned } from './alertInfo';
import { useTravelAlerts } from './useTravelAlerts';
import { useAlertLabels } from './useAlertLabels';
import styles from './ChannelAlertBanner.module.css';

/** 도시 채널 머리말 아래 경보 띠 — 그 도시가 있는 나라가 여행자제(2단계) 이상일 때만. 글이 아니라 현재 경보를 읽어 보여 주므로 해제되면 저절로 사라진다 */
export function ChannelAlertBanner({ countryCode }: { countryCode: string }) {
  const { alerts } = useTravelAlerts();
  const { t, countryName, levelName } = useAlertLabels();
  const alert = alerts.get(countryCode);
  if (!isWarned(alert)) return null;
  const level = alert.baseLevel;

  return (
    <div className={`${styles.banner} ${styles[`tone${level}`]}`} role="note">
      <TriangleAlert size={18} aria-hidden="true" className={styles.icon} />
      <div className={styles.text}>
        <strong className={styles.title}>
          {t('travelAlert.title', { country: countryName(alert), level, name: levelName(level) })}
        </strong>
        <span>{t(`travelAlert.advice.${level}`)}</span>
        {alert.partials.map((p) => (
          <span key={`${p.level}:${p.remark}`} className={styles.partial}>
            {t('travelAlert.partial', {
              level: p.level,
              name: levelName(p.level),
              remark: p.remark,
            })}
          </span>
        ))}
        <a
          className={styles.source}
          href="https://www.0404.go.kr"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('travelAlert.source')}
        </a>
      </div>
    </div>
  );
}
