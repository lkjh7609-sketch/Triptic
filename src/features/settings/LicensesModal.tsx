import { useTranslation } from 'react-i18next';
import { OSS_LICENSES } from './licenses.data';
import modalStyles from '../plan/AddPlaceModal.module.css';
import styles from './LicensesModal.module.css';

interface LicensesModalProps {
  onClose: () => void;
}

/** 오픈소스 라이선스 목록 (02-screens.md §5 정보 섹션, App Store 심사 대비) */
export function LicensesModal({ onClose }: LicensesModalProps) {
  const { t } = useTranslation(['settings', 'common']);
  return (
    <div className={modalStyles.overlay} onClick={onClose}>
      <div className={modalStyles.sheet} onClick={(e) => e.stopPropagation()}>
        <h2 className={modalStyles.title}>{t('licenses.title')}</h2>
        <ul className={styles.list}>
          {OSS_LICENSES.map((entry) => (
            <li key={entry.name} className={styles.item}>
              <span className={styles.name}>{entry.name}</span>
              <span className={styles.meta}>
                v{entry.version} · {entry.license}
              </span>
            </li>
          ))}
        </ul>
        <div className={modalStyles.actions}>
          <button type="button" className={modalStyles.primary} onClick={onClose}>
            {t('action.close', { ns: 'common' })}
          </button>
        </div>
      </div>
    </div>
  );
}
