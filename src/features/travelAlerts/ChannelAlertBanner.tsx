import { useState } from 'react';
import { ChevronRight, TriangleAlert } from 'lucide-react';
import { AlertPopup } from './AlertPopup';
import { isWarned } from './alertInfo';
import { useTravelAlerts } from './useTravelAlerts';
import { useAlertLabels } from './useAlertLabels';
import styles from './ChannelAlertBanner.module.css';

/** 도시 채널의 경보 한 줄 — 그 도시가 있는 나라가 여행자제(2단계) 이상일 때만. 누르면 팝업에서 자세한 안내·일부 지역 경보를 본다. 글이 아니라 현재 경보를 읽어 보여 주므로 해제되면 저절로 사라진다 */
export function ChannelAlertBanner({ countryCode }: { countryCode: string }) {
  const { alerts } = useTravelAlerts();
  const { t, countryName, levelName } = useAlertLabels();
  const [open, setOpen] = useState(false);
  const alert = alerts.get(countryCode);
  if (!isWarned(alert)) return null;
  const level = alert.baseLevel;
  const title = t('travelAlert.title', {
    country: countryName(alert),
    level,
    name: levelName(level),
  });

  return (
    <>
      <button
        type="button"
        className={`${styles.banner} ${styles[`tone${level}`]}`}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <TriangleAlert size={18} aria-hidden="true" className={styles.icon} />
        <span className={styles.title}>{title}</span>
        <span className={styles.more}>{t('travelAlert.view')}</span>
        <ChevronRight size={16} aria-hidden="true" className={styles.chevron} />
      </button>
      {open ? (
        <AlertPopup title={title} onClose={() => setOpen(false)}>
          <div className={`${styles.detail} ${styles[`tone${level}`]}`}>
            <p className={styles.advice}>{t(`travelAlert.advice.${level}`)}</p>
            {alert.partials.map((p) => (
              <p key={`${p.level}:${p.remark}`} className={styles.partial}>
                {t('travelAlert.partial', {
                  level: p.level,
                  name: levelName(p.level),
                  remark: p.remark,
                })}
              </p>
            ))}
          </div>
          <a
            className={styles.source}
            href="https://www.0404.go.kr"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('travelAlert.source')}
          </a>
        </AlertPopup>
      ) : null}
    </>
  );
}
