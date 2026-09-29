import { useTranslation } from 'react-i18next';
import styles from './ProBadge.module.css';

/** 프로(유료) 회원 표시 — 본인이 알아볼 수 있게 프로필 이름 옆에 붙는다. profiles.plan === 'pro'일 때만 쓴다 */
export function ProBadge({ className }: { className?: string }) {
  const { t } = useTranslation('common');
  return <span className={`${styles.badge} ${className ?? ''}`}>{t('plan.proBadge')}</span>;
}
