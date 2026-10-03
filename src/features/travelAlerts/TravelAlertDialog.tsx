import { TriangleAlert } from 'lucide-react';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import modalStyles from '@/features/plan/AddPlaceModal.module.css';
import type { AlertLevel, CountryAlert } from './alertInfo';
import { useAlertLabels } from './useAlertLabels';
import styles from './TravelAlertDialog.module.css';

interface TravelAlertDialogProps {
  alert: CountryAlert & { baseLevel: AlertLevel };
  onContinue: () => void;
  onClose: () => void;
}

/** 여행 만들기 전 경고 — 목적지 나라가 여행자제(2단계) 이상일 때. 4단계여도 막지 않고 계속할 수 있다 */
export function TravelAlertDialog({ alert, onContinue, onClose }: TravelAlertDialogProps) {
  const { t, countryName, levelName } = useAlertLabels();
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);
  const level = alert.baseLevel;
  const country = countryName(alert);

  return (
    <div className={modalStyles.overlay}>
      <div
        ref={trapRef}
        className={`${modalStyles.sheet} ${styles[`tone${level}`]}`}
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="travel-alert-title"
        aria-describedby="travel-alert-body"
      >
        <h2 id="travel-alert-title" className={`${modalStyles.title} ${styles.heading}`}>
          <TriangleAlert size={22} aria-hidden="true" className={styles.icon} />
          {t('travelAlert.dialog.title')}
        </h2>
        <div id="travel-alert-body" className={styles.body}>
          <p className={styles.lead}>
            {t('travelAlert.dialog.body', { country, level, name: levelName(level) })}
          </p>
          <p className={styles.advice}>{t(`travelAlert.advice.${level}`)}</p>
          {alert.partials.length > 0 ? (
            <ul className={styles.partials}>
              {alert.partials.map((p) => (
                <li key={`${p.level}:${p.remark}`}>
                  {t('travelAlert.partial', {
                    level: p.level,
                    name: levelName(p.level),
                    remark: p.remark,
                  })}
                </li>
              ))}
            </ul>
          ) : null}
          <a
            className={styles.more}
            href="https://www.0404.go.kr"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('travelAlert.dialog.more')}
          </a>
        </div>
        <div className={modalStyles.actions}>
          <button type="button" className={modalStyles.secondary} onClick={onClose}>
            {t('travelAlert.dialog.back')}
          </button>
          <button
            type="button"
            className={`${modalStyles.primary} ${styles.continueBtn}`}
            onClick={() => {
              onClose();
              onContinue();
            }}
          >
            {t('travelAlert.dialog.continue')}
          </button>
        </div>
      </div>
    </div>
  );
}
