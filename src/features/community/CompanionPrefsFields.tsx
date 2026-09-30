import { useTranslation } from 'react-i18next';
import {
  COMPANION_AGES,
  COMPANION_GENDERS,
  COMPANION_TAGS,
  MAX_COMPANION_TAGS,
  toggleAge,
  toggleTag,
  type CompanionPrefs,
} from './companionPrefs';
import styles from './CompanionPrefsFields.module.css';

/** 동행 글쓰기의 "원하는 동행"(나이대 여러 개·성별)과 태그(최대 3개). 모두 선택 사항이고 신청 자격을 막지 않는다 */
export function CompanionPrefsFields({ value, onChange }: { value: CompanionPrefs; onChange: (next: CompanionPrefs) => void }) {
  const { t } = useTranslation('community');

  return (
    <>
      <div className={styles.field}>
        <span className={styles.label}>{t('companion.prefs.ageLabel')}</span>
        <div className={styles.chips} role="group" aria-label={t('companion.prefs.ageLabel')}>
          {COMPANION_AGES.map((age) => (
            <button
              key={age}
              type="button"
              className={`${styles.chip} ${value.ages.includes(age) ? styles.chipOn : ''}`}
              aria-pressed={value.ages.includes(age)}
              onClick={() => onChange({ ...value, ages: toggleAge(value.ages, age) })}
            >
              {t(`companion.ages.${age}`)}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.field}>
        <span className={styles.label}>{t('companion.prefs.genderLabel')}</span>
        <div className={styles.chips} role="radiogroup" aria-label={t('companion.prefs.genderLabel')}>
          {COMPANION_GENDERS.map((gender) => (
            <button
              key={gender}
              type="button"
              role="radio"
              className={`${styles.chip} ${value.gender === gender ? styles.chipOn : ''}`}
              aria-checked={value.gender === gender}
              onClick={() => onChange({ ...value, gender })}
            >
              {t(`companion.gender.${gender}`)}
            </button>
          ))}
        </div>
        <p className={styles.hint}>{t('companion.prefs.hint')}</p>
      </div>

      <div className={styles.field}>
        <span className={styles.label}>{t('companion.prefs.tagLabel', { max: MAX_COMPANION_TAGS })}</span>
        <div className={styles.chips} role="group" aria-label={t('companion.prefs.tagLabel', { max: MAX_COMPANION_TAGS })}>
          {COMPANION_TAGS.map((tag) => {
            const on = value.tags.includes(tag);
            const full = !on && value.tags.length >= MAX_COMPANION_TAGS;
            return (
              <button
                key={tag}
                type="button"
                className={`${styles.chip} ${on ? styles.chipOn : ''}`}
                aria-pressed={on}
                disabled={full}
                onClick={() => onChange({ ...value, tags: toggleTag(value.tags, tag) })}
              >
                #{t(`companion.tags.${tag}`)}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
