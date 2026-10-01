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

/**
 * 동행 글쓰기의 "선호 조건" — 원하는 성별(하나)·나이대(여러 개)·태그(최대 3개). 모두 선택 사항이고 신청 자격을 막지 않는다.
 * 안내 문구와 카드/머리글은 쓰는 쪽(글쓰기 화면)이 맡는다.
 */
export function CompanionPrefsFields({ value, onChange }: { value: CompanionPrefs; onChange: (next: CompanionPrefs) => void }) {
  const { t } = useTranslation('community');

  return (
    <div className={styles.fields}>
      <div className={styles.field}>
        <div className={styles.labelRow}>
          <span id="prefs-gender-label" className={styles.label}>
            {t('companion.prefs.genderLabel')}
          </span>
          <span className={styles.labelHint}>{t('companion.prefs.genderHint')}</span>
        </div>
        <div className={styles.segmented} role="radiogroup" aria-labelledby="prefs-gender-label">
          {COMPANION_GENDERS.map((gender) => (
            <button
              key={gender}
              type="button"
              role="radio"
              className={`${styles.segment} ${value.gender === gender ? styles.segmentOn : ''}`}
              aria-checked={value.gender === gender}
              onClick={() => onChange({ ...value, gender })}
            >
              {t(`companion.gender.${gender}`)}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.field}>
        <div className={styles.labelRow}>
          <span id="prefs-age-label" className={styles.label}>
            {t('companion.prefs.ageLabel')}
          </span>
          <span className={styles.labelHint}>{t('companion.prefs.ageHint')}</span>
        </div>
        <div className={styles.ages} role="group" aria-labelledby="prefs-age-label">
          {COMPANION_AGES.map((age) => (
            <button
              key={age}
              type="button"
              className={`${styles.age} ${value.ages.includes(age) ? styles.ageOn : ''}`}
              aria-pressed={value.ages.includes(age)}
              onClick={() => onChange({ ...value, ages: toggleAge(value.ages, age) })}
            >
              {t(`companion.ages.${age}`)}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.field}>
        <div className={styles.labelRow}>
          <span id="prefs-tag-label" className={styles.label}>
            {t('companion.prefs.tagLabel', { max: MAX_COMPANION_TAGS })}
          </span>
          <span className={styles.counter} aria-live="polite">
            {value.tags.length}/{MAX_COMPANION_TAGS}
          </span>
        </div>
        <div className={styles.tags} role="group" aria-labelledby="prefs-tag-label">
          {COMPANION_TAGS.map((tag) => {
            const on = value.tags.includes(tag);
            const full = !on && value.tags.length >= MAX_COMPANION_TAGS;
            return (
              <button
                key={tag}
                type="button"
                className={`${styles.tag} ${on ? styles.tagOn : ''}`}
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
    </div>
  );
}
