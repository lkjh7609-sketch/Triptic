import { useTranslation } from 'react-i18next';
import type { Suggestion } from '@/shared/api/tripService';
import { useRejectSuggestion } from './hooks/useTrips';

import { captureError } from '@/shared/monitoring';
import styles from './SuggestionsModal.module.css';
import modalStyles from './AddPlaceModal.module.css';
import { Lightbulb, MapPin, MessageCircle } from 'lucide-react';

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
  const { t } = useTranslation(['plan', 'common']);
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
        <h2 className={modalStyles.title}><span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><Lightbulb size={18} /> {t('suggestions.title', { count: suggestions.length })}</span></h2>

        <div className={styles.list}>
          {suggestions.length === 0 ? (
            <p className={styles.empty}>{t('suggestions.empty')}</p>
          ) : (
            suggestions.map((s) => (
              <div key={s.id} className={styles.card}>
                <div className={styles.name}>{s.name}</div>
                {s.address ? <div className={styles.address}>{s.address}</div> : null}
                <div className={styles.dayTag}><span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><MapPin size={16} /> {t('suggestions.dayTag', { day: s.day })}</span></div>
                {s.memo ? <div className={styles.memo}><span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><MessageCircle size={16} /> {s.memo}</span></div> : null}
                {s.proposer ? (
                  <div className={styles.proposer}>
                    {t('suggestions.sentBy')}: <b>{s.proposer}</b>
                  </div>
                ) : null}
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={modalStyles.secondary}
                    disabled={rejectSuggestion.isPending}
                    onClick={() => rejectSuggestion.mutate(s.id)}
                  >
                    {t('suggestions.reject')}
                  </button>
                  <button
                    type="button"
                    className={modalStyles.primary}
                    disabled={rejectSuggestion.isPending}
                    onClick={() => handleAccept(s)}
                  >
                    {t('suggestions.addToItinerary')}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className={modalStyles.actions}>
          <button type="button" className={modalStyles.secondary} onClick={onClose}>
            {t('common:action.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
