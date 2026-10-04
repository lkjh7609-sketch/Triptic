import { useTranslation } from 'react-i18next';
import { COMPANION_AGES } from './companionPrefs';
import type { MemberAgeBand, MemberGender } from '@/shared/api/profileService';
import styles from './CompanionPrefsFields.module.css';

const GENDERS: MemberGender[] = ['female', 'male'];

/**
 * 내 성별·나잇대(선택) — 동행 모집글 "원하는 동행" 버튼과 같은 모양. 같은 버튼을 한 번 더 누르면 선택이 풀린다.
 * 팝업(DemographicsPrompt)과 설정 화면이 같이 쓴다.
 */
export function DemographicsFields({
  gender,
  ageBand,
  onChange,
}: {
  gender: MemberGender | null;
  ageBand: MemberAgeBand | null;
  onChange: (next: { gender: MemberGender | null; ageBand: MemberAgeBand | null }) => void;
}) {
  const { t } = useTranslation('community');
  return (
    <div className={styles.fields}>
      <div className={styles.field}>
        <div className={styles.labelRow}>
          <span id="demo-gender-label" className={styles.label}>
            {t('demographics.genderLabel')}
          </span>
        </div>
        <div className={styles.segmented} style={{ gridTemplateColumns: 'repeat(2, 1fr)' }} role="radiogroup" aria-labelledby="demo-gender-label">
          {GENDERS.map((g) => (
            <button
              key={g}
              type="button"
              role="radio"
              className={`${styles.segment} ${gender === g ? styles.segmentOn : ''}`}
              aria-checked={gender === g}
              onClick={() => onChange({ gender: gender === g ? null : g, ageBand })}
            >
              {t(`companion.gender.${g}`)}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.field}>
        <div className={styles.labelRow}>
          <span id="demo-age-label" className={styles.label}>
            {t('demographics.ageLabel')}
          </span>
        </div>
        <div className={styles.ages} role="radiogroup" aria-labelledby="demo-age-label">
          {COMPANION_AGES.map((age) => (
            <button
              key={age}
              type="button"
              role="radio"
              className={`${styles.age} ${ageBand === age ? styles.ageOn : ''}`}
              aria-checked={ageBand === age}
              onClick={() => onChange({ gender, ageBand: ageBand === age ? null : age })}
            >
              {t(`companion.ages.${age}`)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
