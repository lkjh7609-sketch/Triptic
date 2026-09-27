import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import { useSession } from '@/shared/hooks/useSession';
import { useReportContent } from './hooks/useCommunitySafety';
import { REPORT_REASONS, type ReportReason, type ReportTargetType } from './types';
import modalStyles from '@/features/plan/AddPlaceModal.module.css';
import styles from './ReportModal.module.css';

interface ReportModalProps {
  targetType: ReportTargetType;
  targetId: string;
  onClose: () => void;
  /** 신고가 접수된 뒤 모달이 닫힐 때 호출 — 상세 화면은 여기서 목록으로 빠져나간다 */
  onReported?: () => void;
}

const REASONS = REPORT_REASONS;

/** 신고 모달 (06-community.md §5.2) — 모든 글·댓글·이미지·사용자에서 재사용 */
export function ReportModal({ targetType, targetId, onClose, onReported }: ReportModalProps) {
  const { t } = useTranslation(['community', 'common']);
  const { user } = useSession();
  const reportMutation = useReportContent(user?.id ?? null);
  const [reason, setReason] = useState<ReportReason>('spam');
  const [detail, setDetail] = useState('');
  const [done, setDone] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const queryClient = useQueryClient();
  // useFocusTrap은 첫 렌더의 콜백을 계속 쓰므로(Escape) done은 ref로 읽는다
  const doneRef = useRef(false);
  const focusTrapRef = useFocusTrap<HTMLDivElement>(handleClose);

  // 신고 대상은 RLS에서 신고자에게 안 보이게 걸러진다(0045). 접수 직후가 아니라
  // 닫을 때 다시 불러와야 모달을 품은 카드/상세가 먼저 사라지며 완료 안내까지
  // 같이 없어지는 일이 없다.
  function handleClose() {
    if (doneRef.current) {
      queryClient.invalidateQueries({ queryKey: ['community'] });
      onReported?.();
    }
    onClose();
  }

  async function handleSubmit() {
    setErrorMessage(null);
    try {
      await reportMutation.mutateAsync({ targetType, targetId, reason, detail: detail.trim() || undefined });
      doneRef.current = true;
      setDone(true);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : t('report.submitError'));
    }
  }

  return (
    <div className={modalStyles.overlay} onClick={handleClose}>
      <div
        ref={focusTrapRef}
        className={modalStyles.sheet}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('report.dialogLabel')}
      >
        {done ? (
          <>
            <h2 className={modalStyles.title}>{t('report.doneTitle')}</h2>
            <p className={styles.desc}>{t(targetType === 'user' ? 'report.doneDescUser' : 'report.doneDesc')}</p>
            <div className={modalStyles.actions}>
              <button type="button" className={modalStyles.primary} onClick={handleClose}>
                {t('action.close', { ns: 'common' })}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className={modalStyles.title}>{t('report.title')}</h2>
            <p className={styles.desc}>{t('report.reasonPrompt')}</p>
            <div className={styles.reasonList}>
              {REASONS.map((r) => (
                <label className={styles.reasonRow} key={r}>
                  <input
                    type="radio"
                    name="report-reason"
                    checked={reason === r}
                    onChange={() => setReason(r)}
                  />
                  <span>{t(`report.reason.${r}`)}</span>
                </label>
              ))}
            </div>
            <textarea
              className={styles.detailInput}
              placeholder={t('report.detailPlaceholder')}
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              maxLength={500}
            />
            {errorMessage ? <p className={styles.error}>{errorMessage}</p> : null}
            <div className={modalStyles.actions}>
              <button type="button" className={modalStyles.primary} onClick={onClose}>
                {t('action.cancel', { ns: 'common' })}
              </button>
              <button
                type="button"
                className={modalStyles.primary}
                disabled={reportMutation.isPending}
                onClick={handleSubmit}
              >
                {reportMutation.isPending ? t('report.submitting') : t('report.submit')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
