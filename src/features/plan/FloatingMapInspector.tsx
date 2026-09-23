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

export function FloatingMapInspector({ title, subtitle, image, recommendation, crowdLevel, onFocusMove }: FloatingMapInspectorProps) {
  return (
    <div className={styles.inspectorCard}>
      {image && (
        <div className={styles.imageWrap} style={{ backgroundImage: `url(${image})` }} />
      )}
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
              <span>{crowdLevel === 'low' ? '여유로움' : crowdLevel === 'medium' ? '보통' : '혼잡'}</span>
            </div>
          )}
        </div>

        <button className={styles.actionBtn} onClick={onFocusMove}>
          <Navigation size={14} /> 포커스 이동
        </button>
      </div>
    </div>
  );
}
