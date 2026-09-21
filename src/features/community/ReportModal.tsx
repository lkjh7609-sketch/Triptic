import { useState } from 'react';
import { useSession } from '@/shared/hooks/useSession';
import { useReportContent } from './hooks/useCommunitySafety';
import { REPORT_REASON_LABELS, type ReportReason, type ReportTargetType } from './types';
import modalStyles from '@/features/plan/AddPlaceModal.module.css';
import styles from './ReportModal.module.css';

interface ReportModalProps {
  targetType: ReportTargetType;
  targetId: string;
  onClose: () => void;
  onReported?: () => void;
}

const REASONS = Object.keys(REPORT_REASON_LABELS) as ReportReason[];

/** 신고 모달 (06-community.md §5.2) — 모든 글·댓글·이미지·사용자에서 재사용 */
export function ReportModal({ targetType, targetId, onClose, onReported }: ReportModalProps) {
  const { user } = useSession();
  const reportMutation = useReportContent(user?.id ?? null);
  const [reason, setReason] = useState<ReportReason>('spam');
  const [detail, setDetail] = useState('');
  const [done, setDone] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit() {
    setErrorMessage(null);
    try {
      await reportMutation.mutateAsync({ targetType, targetId, reason, detail: detail.trim() || undefined });
      setDone(true);
      onReported?.();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : '신고 접수에 실패했습니다.');
    }
  }

  return (
    <div className={modalStyles.overlay} onClick={onClose}>
      <div className={modalStyles.sheet} onClick={(e) => e.stopPropagation()}>
        {done ? (
          <>
            <h2 className={modalStyles.title}>🚩 신고가 접수됐어요</h2>
            <p className={styles.desc}>
              신고해 주신 콘텐츠는 이제 회원님 화면에서 보이지 않아요. 24시간 이내에 검토 후 처리 결과를 알려드릴게요.
            </p>
            <div className={modalStyles.actions}>
              <button type="button" className={modalStyles.primary} onClick={onClose}>
                닫기
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className={modalStyles.title}>🚩 신고하기</h2>
            <p className={styles.desc}>신고 사유를 선택해 주세요.</p>
            <div className={styles.reasonList}>
              {REASONS.map((r) => (
                <label className={styles.reasonRow} key={r}>
                  <input
                    type="radio"
                    name="report-reason"
                    checked={reason === r}
                    onChange={() => setReason(r)}
                  />
                  <span>{REPORT_REASON_LABELS[r]}</span>
                </label>
              ))}
            </div>
            <textarea
              className={styles.detailInput}
              placeholder="상세 설명 (선택)"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              maxLength={500}
            />
            {errorMessage ? <p className={styles.error}>{errorMessage}</p> : null}
            <div className={modalStyles.actions}>
              <button type="button" className={modalStyles.primary} onClick={onClose}>
                취소
              </button>
              <button
                type="button"
                className={modalStyles.primary}
                disabled={reportMutation.isPending}
                onClick={handleSubmit}
              >
                {reportMutation.isPending ? '신고하는 중…' : '신고'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
