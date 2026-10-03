import { useTranslation } from 'react-i18next';
import { ExternalLink, Ticket } from 'lucide-react';
import { useKlookActivitiesLink } from '@/features/plan/partnerLinks';
import styles from './SectionScreen.module.css';

/**
 * 액티비티 화면의 Klook 자리 — 그 도시의 Klook 투어·액티비티 검색 결과로 가는 카드.
 * 예전엔 트래블페이아웃 투어 위젯(tpembd.com)을 넣었는데 트래블페이아웃을 뺐다(2026-10-04). 링크는 서버(api/partnerLink,
 * brand=klook)가 정하므로, Klook 제휴를 새로 붙이면 서버 레지스트리만 바꾸면 이 카드가 그대로 제휴 링크가 된다.
 */
export function KlookToursWidget({ city, locale }: { city: string; locale: string }) {
  const { t } = useTranslation('home');
  const href = useKlookActivitiesLink(city, locale, 'city');
  return (
    <div className={styles.toursWidget}>
      <div className={styles.klookCard}>
        <span className={styles.klookIcon} aria-hidden="true">
          <Ticket size={22} />
        </span>
        <p className={styles.klookText}>{t('activities.klookCard.title', { city })}</p>
        <a className={styles.klookCta} href={href} target="_blank" rel="sponsored noopener">
          {t('activities.klookCard.cta')}
          <ExternalLink size={14} aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}
