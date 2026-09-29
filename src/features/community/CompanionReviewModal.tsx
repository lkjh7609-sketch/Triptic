import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
import { clearInvalid, flagInvalid } from '@/shared/ui/invalidField';
import styles from './CompanionReviewModal.module.css';

interface CompanionReviewModalProps {
  post: CompanionPost;
  onClose: () => void;
}

/** 일정 종료(closed) 후 체크인 + 동행 별점(0047) — 나머지 멤버 전원을 평가해야 제출된다 */
export function CompanionReviewModal({ post, onClose }: CompanionReviewModalProps) {
  const { t } = useTranslation(['community', 'common']);
  const { user } = useSession();
  const queryClient = useQueryClient();
  // useFocusTrap은 첫 렌더의 콜백을 계속 쓰므로(Escape) 완료 여부는 ref로 읽는다
  const doneRef = useRef(false);
  const wentWellRef = useRef<HTMLFieldSetElement>(null);
  const ratingRefs = useRef(new Map<string, HTMLDivElement>());
  const trapRef = useFocusTrap<HTMLDivElement>(handleClose);
  const membersQuery = useCompanionMatchMembers(post);
  const submitReview = useSubmitCompanionReview(post.id);
  const [wentWell, setWentWell] = useState<boolean | null>(null);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [done, setDone] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const others = (membersQuery.data ?? []).filter((m) => m.user_id !== user?.id);
  const canSubmit = wentWell !== null && others.every((m) => (ratings[m.user_id] ?? 0) > 0) && !membersQuery.isLoading;

  // 별점은 커뮤니티 전역 닉네임 옆에 뜨므로 ['community'] 전체를 다시 불러온다. 제출 직후가
  // 아니라 닫을 때 해야, 후기 여부가 바뀌며 이 모달(채팅 배너/자동 요청)이 감사 화면을
  // 보여주기도 전에 사라지는 일이 없다 — ReportModal과 같은 이유.
  function handleClose() {
    if (doneRef.current) queryClient.invalidateQueries({ queryKey: ['community'] });
    onClose();
  }

  async function handleSubmit() {
    if (membersQuery.isLoading) return;
    if (!canSubmit || wentWell === null) {
      flagInvalid(
        wentWell === null ? wentWellRef.current : null,
        ...others.filter((m) => !((ratings[m.user_id] ?? 0) > 0)).map((m) => ratingRefs.current.get(m.user_id)),
      );
      return;
    }
    setErrorMessage(null);
    try {
      await submitReview.mutateAsync({
        wentWell,
        ratings: others.map((m) => ({ userId: m.user_id, rating: ratings[m.user_id] })),
      });
      doneRef.current = true;
      setDone(true);
    } catch (err) {
      // 다른 기기에서 이미 남겼으면 완료로 본다
      if (err instanceof Error && err.message.includes('already reviewed')) {
        doneRef.current = true;
        setDone(true);
        return;
      }
      captureError(err, { context: 'submitCompanionReview' });
      setErrorMessage(t('companion.review.submitError'));
    }
  }

  return (
    <div className={modalStyles.overlay} onClick={handleClose}>
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
              <button type="button" className={modalStyles.primary} onClick={handleClose}>
                {t('action.close', { ns: 'common' })}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 id="companion-review-title" className={modalStyles.title}>{t('companion.review.title')}</h2>
            <p className={styles.desc}>{post.title}</p>

            <fieldset ref={wentWellRef} className={styles.fieldset}>
              <legend className={styles.question}>{t('companion.review.wentWellQuestion')}</legend>
              <div className={styles.choiceRow}>
                <button
                  type="button"
                  className={wentWell === true ? styles.choiceActive : styles.choice}
                  aria-pressed={wentWell === true}
                  onClick={() => {
                    setWentWell(true);
                    clearInvalid(wentWellRef.current);
                  }}
                >
                  {t('companion.review.wentWellYes')}
                </button>
                <button
                  type="button"
                  className={wentWell === false ? styles.choiceActive : styles.choice}
                  aria-pressed={wentWell === false}
                  onClick={() => {
                    setWentWell(false);
                    clearInvalid(wentWellRef.current);
                  }}
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
                    <div
                      ref={(el) => {
                        if (el) ratingRefs.current.set(member.user_id, el);
                        else ratingRefs.current.delete(member.user_id);
                      }}
                      className={styles.stars}
                      role="radiogroup"
                      aria-label={member.profile?.display_name ?? ''}
                    >
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
                            onClick={() => {
                              setRatings((cur) => ({ ...cur, [member.user_id]: n }));
                              clearInvalid(ratingRefs.current.get(member.user_id));
                            }}
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
              <button type="button" className={modalStyles.secondary} onClick={handleClose}>
                {t('companion.review.later')}
              </button>
              <button
                type="button"
                className={modalStyles.primary}
                disabled={submitReview.isPending}
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
