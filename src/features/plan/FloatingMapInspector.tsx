import { useTranslation } from 'react-i18next';
import { Users, Sun, Navigation } from 'lucide-react';
import styles from './FloatingMapInspector.module.css';

interface FloatingMapInspectorProps {
  title: string;
  subtitle: string;
  image?: string;
  recommendation?: string;
  crowdLevel?: 'low' | 'medium' | 'high';
  onFocusMove?: () => void;
}

export function FloatingMapInspector({ title, subtitle, recommendation, crowdLevel, onFocusMove }: FloatingMapInspectorProps) {
  const { t } = useTranslation('plan');
  return (
    <div className={styles.inspectorCard}>
      <div className={styles.content}>
        <div className={styles.header}>
          <h4 className={styles.title}>{title}</h4>
          <span className={styles.subtitle}>{subtitle}</span>
        </div>
        
        <div className={styles.detailsRow}>
          {recommendation && (
            <div className={styles.detailItem}>
              <Sun size={14} />
              <span>{recommendation}</span>
            </div>
          )}
          {crowdLevel && (
            <div className={styles.detailItem}>
              <Users size={14} />
              <span>
                {crowdLevel === 'low'
                  ? t('inspector.crowdLow', { defaultValue: '여유로움' })
                  : crowdLevel === 'medium'
                  ? t('inspector.crowdMedium', { defaultValue: '보통' })
                  : t('inspector.crowdHigh', { defaultValue: '혼잡' })}
              </span>
            </div>
          )}
        </div>

        <button className={styles.actionBtn} onClick={onFocusMove}>
          <Navigation size={14} /> {t('inspector.focusMove', { defaultValue: '포커스 이동', ns: 'plan' })}
        </button>
      </div>
    </div>
  );
}
