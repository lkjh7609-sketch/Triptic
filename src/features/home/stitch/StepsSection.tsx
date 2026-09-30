import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, CirclePlus, FileUp, RefreshCw } from 'lucide-react';
import { useSession } from '@/shared/hooks/useSession';
import shared from './shared.module.css';
import styles from './StepsSection.module.css';

const STEPS = [1, 2, 3] as const;

function Mockup({ step }: { step: 1 | 2 | 3 }) {
  const { t } = useTranslation('home');
  if (step === 1) {
    return (
      <div className={`${styles.mock} ${styles.mockCenter}`} aria-hidden="true">
        <FileUp size={36} className={styles.mockIcon} />
        <div className={styles.mockFile}>flight_confirmation_2026.pdf</div>
        <div className={styles.mockOk}>
          <CheckCircle2 size={14} /> {t('page.steps.mock1Done')}
        </div>
      </div>
    );
  }
  if (step === 2) {
    return (
      <div className={styles.mock} aria-hidden="true">
        <div className={styles.mockRow}>
          <span className={styles.mockLabel}>
            <span className={styles.mockDot} /> {t('page.steps.mock2a')}
          </span>
          <span className={styles.mockSide}>{t('page.steps.mock2aSide')}</span>
        </div>
        <div className={styles.mockBar} />
        <div className={styles.mockRow}>
          <span className={styles.mockLabel}>
            <span className={styles.mockDot} /> {t('page.steps.mock2b')}
          </span>
          <span className={styles.mockSide}>{t('page.steps.mock2bSide')}</span>
        </div>
      </div>
    );
  }
  return (
    <div className={`${styles.mock} ${styles.mockBetween}`} aria-hidden="true">
      <div className={styles.faces}>
        {t('page.steps.mock3Initials')
          .split('')
          .map((c, i) => (
            <span key={i} className={styles.face}>
              {c}
            </span>
          ))}
      </div>
      <span className={styles.mockOk}>
        <RefreshCw size={16} /> {t('page.steps.mock3Live')}
      </span>
    </div>
  );
}

/** "트립틱 이렇게 써요" — 서류 올리기 → AI 동선 → 함께 편집. PC는 모형 그림이 있는 카드 3장, 모바일은 번호 목록(+ 비로그인만 "새 여행 만들기" 버튼) */
export function StepsSection({ desktop }: { desktop: boolean }) {
  const { t } = useTranslation('home');
  const { user } = useSession();

  if (desktop) {
    return (
      <section className={`${shared.section} ${styles.pcSection}`} aria-labelledby="home-steps-title">
        <div className={styles.pcHead}>
          <div className={shared.eyebrow}>{t('page.steps.eyebrow')}</div>
          <h2 id="home-steps-title" className={styles.pcTitle}>
            {t('page.steps.title')}
          </h2>
          <p className={styles.pcSub}>{t('page.steps.sub')}</p>
        </div>
        <ol className={styles.pcGrid}>
          {STEPS.map((n) => (
            <li key={n} className={`${shared.card} ${shared.cardHover} ${styles.pcCard}`}>
              <div>
                <div className={styles.pcCardHead}>
                  <span className={styles.pcNum}>{n}</span>
                  <h3 className={styles.pcCardTitle}>{t(`page.steps.s${n}Title`)}</h3>
                </div>
                <p className={styles.pcCardDesc}>{t(`page.steps.s${n}Desc`)}</p>
              </div>
              <Mockup step={n} />
            </li>
          ))}
        </ol>
      </section>
    );
  }

  return (
    <section className={styles.mSection} aria-labelledby="home-steps-title">
      <div className={styles.mHead}>
        <span className={styles.mEyebrow}>{t('page.steps.eyebrow')}</span>
        <h2 id="home-steps-title" className={styles.mTitle}>
          {t('page.steps.title')}
        </h2>
        <p className={styles.mSub}>{t('page.steps.subMobile')}</p>
      </div>
      <ol className={styles.mList}>
        {STEPS.map((n) => (
          <li key={n} className={styles.mItem}>
            <span className={styles.mNum}>{n}</span>
            <div>
              <h3 className={styles.mItemTitle}>{t(`page.steps.s${n}Title`)}</h3>
              <p className={styles.mItemDesc}>{t(`page.steps.m${n}Desc`)}</p>
            </div>
          </li>
        ))}
      </ol>
      {user ? null : (
        <Link to="/plan" className={styles.mButton}>
          <CirclePlus size={18} aria-hidden="true" />
          <span>{t('page.steps.create')}</span>
        </Link>
      )}
    </section>
  );
}
