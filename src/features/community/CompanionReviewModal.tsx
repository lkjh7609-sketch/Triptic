import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Star } from 'lucide-react';
import { useSession } from '@/shared/hooks/useSession';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import { captureError } from '@/shared/monitoring';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { AuthorName } from './AuthorName';
import { useCompanionMatchMembers, useSubmitCompanionReview } from './hooks/useCompanionPosts';
import type { CompanionPost } from './types';
import modalStyles from '@/features/plan/AddPlaceModal.module.css';
import styles from './CompanionReviewModal.module.css';

interface CompanionReviewModalProps {
  post: CompanionPost;
  onClose: () => void;
}

/** 일정 종료(closed) 후 체크인 + 동행 별점(0047) — 나머지 멤버 전원을 평가해야 제출된다 */
export function CompanionReviewModal({ post, onClose }: CompanionReviewModalProps) {
  const { t } = useTranslation(['community', 'common']);
  const { user } = useSession();
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);
  const membersQuery = useCompanionMatchMembers(post);
  const submitReview = useSubmitCompanionReview(post.id);
  const [wentWell, setWentWell] = useState<boolean | null>(null);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [done, setDone] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const others = (membersQuery.data ?? []).filter((m) => m.user_id !== user?.id);
  const canSubmit = wentWell !== null && others.every((m) => (ratings[m.user_id] ?? 0) > 0) && !membersQuery.isLoading;

  async function handleSubmit() {
    if (!canSubmit || wentWell === null) return;
    setErrorMessage(null);
    try {
      await submitReview.mutateAsync({
        wentWell,
        ratings: others.map((m) => ({ userId: m.user_id, rating: ratings[m.user_id] })),
      });
      setDone(true);
    } catch (err) {
      // 다른 기기에서 이미 남겼으면 완료로 본다
      if (err instanceof Error && err.message.includes('already reviewed')) {
        setDone(true);
        return;
      }
      captureError(err, { context: 'submitCompanionReview' });
      setErrorMessage(t('companion.review.submitError'));
    }
  }

  return (
    <div className={modalStyles.overlay} onClick={onClose}>
      <div
        ref={trapRef}
        className={modalStyles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="companion-review-title"
        onClick={(e) => e.stopPropagation()}
      >
        {done ? (
          <>
            <h2 id="companion-review-title" className={modalStyles.title}>{t('companion.review.doneTitle')}</h2>
            <p className={styles.desc}>{t('companion.review.doneDesc')}</p>
            <div className={modalStyles.actions}>
              <button type="button" className={modalStyles.primary} onClick={onClose}>
                {t('action.close', { ns: 'common' })}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 id="companion-review-title" className={modalStyles.title}>{t('companion.review.title')}</h2>
            <p className={styles.desc}>{post.title}</p>

            <fieldset className={styles.fieldset}>
              <legend className={styles.question}>{t('companion.review.wentWellQuestion')}</legend>
              <div className={styles.choiceRow}>
                <button
                  type="button"
                  className={wentWell === true ? styles.choiceActive : styles.choice}
                  aria-pressed={wentWell === true}
                  onClick={() => setWentWell(true)}
                >
                  {t('companion.review.wentWellYes')}
                </button>
                <button
                  type="button"
                  className={wentWell === false ? styles.choiceActive : styles.choice}
                  aria-pressed={wentWell === false}
                  onClick={() => setWentWell(false)}
                >
                  {t('companion.review.wentWellNo')}
                </button>
              </div>
              {wentWell === false ? <p className={styles.hint}>{t('companion.review.problemHint')}</p> : null}
            </fieldset>

            {membersQuery.isLoading ? (
              <Skeleton height="60px" />
            ) : others.length > 0 ? (
              <div className={styles.memberList}>
                <p className={styles.question}>{t('companion.review.rateMembers')}</p>
                {others.map((member) => (
                  <div key={member.user_id} className={styles.memberRow}>
                    <span className={styles.memberName}><AuthorName profile={member.profile} /></span>
                    <div className={styles.stars} role="radiogroup" aria-label={member.profile?.display_name ?? ''}>
                      {[1, 2, 3, 4, 5].map((n) => {
                        const selected = (ratings[member.user_id] ?? 0) >= n;
                        return (
                          <button
                            key={n}
                            type="button"
                            role="radio"
                            aria-checked={ratings[member.user_id] === n}
                            aria-label={t('companion.review.starLabel', { count: n })}
                            className={styles.starBtn}
                            onClick={() => setRatings((cur) => ({ ...cur, [member.user_id]: n }))}
                          >
                            <Star size={24} className={selected ? styles.starOn : styles.starOff} aria-hidden="true" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {errorMessage ? <p className={styles.error}>{errorMessage}</p> : null}

            <div className={modalStyles.actions}>
              <button type="button" className={modalStyles.secondary} onClick={onClose}>
                {t('companion.review.later')}
              </button>
              <button
                type="button"
                className={modalStyles.primary}
                disabled={!canSubmit || submitReview.isPending}
                onClick={handleSubmit}
              >
                {submitReview.isPending ? t('companion.review.submitting') : t('companion.review.submit')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
