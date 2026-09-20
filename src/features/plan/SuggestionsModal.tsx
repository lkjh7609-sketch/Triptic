import type { Suggestion } from '@/shared/api/tripService';
import { useRejectSuggestion } from './hooks/useTrips';
import { captureError } from '@/shared/monitoring';
import styles from './SuggestionsModal.module.css';
import modalStyles from './AddPlaceModal.module.css';

interface SuggestionsModalProps {
  tripId: string;
  suggestions: Suggestion[];
  onClose: () => void;
  onAccept: (suggestion: Suggestion) => Promise<void>;
}

/**
 * 받은 제안 목록 (index.html openReviewSuggestionModal/renderSuggestionList/
 * acceptSuggestion/rejectSuggestion 이식). 공유 뷰어에서 동행자가 건의한 장소를
 * 소유자가 검토해 일정에 추가하거나 거절한다.
 */
export function SuggestionsModal({ tripId, suggestions, onClose, onAccept }: SuggestionsModalProps) {
  const rejectSuggestion = useRejectSuggestion(tripId);

  async function handleAccept(s: Suggestion) {
    try {
      await onAccept(s);
      rejectSuggestion.mutate(s.id);
    } catch (err) {
      captureError(err, { context: 'acceptSuggestion' });
    }
  }

  return (
    <div className={modalStyles.overlay} onClick={onClose}>
      <div className={modalStyles.sheet} onClick={(e) => e.stopPropagation()}>
        <h2 className={modalStyles.title}>💡 동행자 추천 제안 ({suggestions.length}건)</h2>

        <div className={styles.list}>
          {suggestions.length === 0 ? (
            <p className={styles.empty}>아직 동행자가 보낸 제안이 없습니다.</p>
          ) : (
            suggestions.map((s) => (
              <div key={s.id} className={styles.card}>
                <div className={styles.name}>{s.name}</div>
                {s.address ? <div className={styles.address}>{s.address}</div> : null}
                <div className={styles.dayTag}>📍 {s.day}일차 추천</div>
                {s.memo ? <div className={styles.memo}>💬 {s.memo}</div> : null}
                {s.proposer ? (
                  <div className={styles.proposer}>
                    보낸 사람: <b>{s.proposer}</b>
                  </div>
                ) : null}
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={modalStyles.secondary}
                    disabled={rejectSuggestion.isPending}
                    onClick={() => rejectSuggestion.mutate(s.id)}
                  >
                    거절
                  </button>
                  <button
                    type="button"
                    className={modalStyles.primary}
                    disabled={rejectSuggestion.isPending}
                    onClick={() => handleAccept(s)}
                  >
                    일정에 추가
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className={modalStyles.actions}>
          <button type="button" className={modalStyles.secondary} onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
