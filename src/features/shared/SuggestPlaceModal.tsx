import { useState } from 'react';
import { usePlaceAutocomplete, type SelectedPlace } from '@/features/plan/map/usePlaceAutocomplete';
import { getGuestName, saveGuestName } from './guestName';
import { captureError } from '@/shared/monitoring';
import modalStyles from '@/features/plan/AddPlaceModal.module.css';

interface SuggestPlaceModalProps {
  totalDays: number;
  defaultDay: number;
  onClose: () => void;
  onSubmit: (suggestion: {
    day: number;
    name: string;
    address: string | null;
    lat: number | null;
    lng: number | null;
    memo: string | null;
    proposer: string | null;
  }) => Promise<void>;
}

/**
 * 장소 추가 건의하기 (index.html openSuggestModal/submitSuggestion 이식)
 * 공유 뷰어(로그인 불필요)에서 동행자가 여행 소유자에게 장소를 제안한다.
 */
export function SuggestPlaceModal({ totalDays, defaultDay, onClose, onSubmit }: SuggestPlaceModalProps) {
  const [selected, setSelected] = useState<SelectedPlace | null>(null);
  const [day, setDay] = useState(defaultDay);
  const [memo, setMemo] = useState('');
  const [proposer, setProposer] = useState(getGuestName());
  const [submitting, setSubmitting] = useState(false);
  const { inputRef } = usePlaceAutocomplete(setSelected);

  async function handleSubmit() {
    if (!selected) return;
    setSubmitting(true);
    try {
      saveGuestName(proposer);
      await onSubmit({
        day,
        name: selected.name,
        address: selected.address || null,
        lat: selected.lat,
        lng: selected.lng,
        memo: memo.trim() || null,
        proposer: proposer.trim() || null,
      });
      onClose();
    } catch (err) {
      captureError(err, { context: 'submitSuggestion' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={modalStyles.overlay} onClick={onClose}>
      <div className={modalStyles.sheet} onClick={(e) => e.stopPropagation()}>
        <h2 className={modalStyles.title}>💡 장소 추가 건의하기</h2>

        <div className={modalStyles.field}>
          <label className={modalStyles.label}>추가할 장소 검색</label>
          <input ref={inputRef} className={modalStyles.input} placeholder="장소 이름을 검색하세요" />
          {selected ? (
            <div className={modalStyles.selectedCard}>
              <div className={modalStyles.selectedName}>{selected.name}</div>
              {selected.address ? <div className={modalStyles.selectedAddress}>{selected.address}</div> : null}
            </div>
          ) : null}
        </div>

        <div className={modalStyles.field}>
          <label className={modalStyles.label}>추천 일차</label>
          <select
            className={modalStyles.input}
            value={day}
            onChange={(e) => setDay(Number(e.target.value))}
          >
            {Array.from({ length: totalDays }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {d}일차
              </option>
            ))}
          </select>
        </div>

        <div className={modalStyles.field}>
          <label className={modalStyles.label}>한마디 메모 (선택)</label>
          <input
            className={modalStyles.input}
            placeholder="예: 여기 디저트 유명하대요!"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
        </div>

        <div className={modalStyles.field}>
          <label className={modalStyles.label}>작성자 이름</label>
          <input
            className={modalStyles.input}
            placeholder="예: 민수"
            value={proposer}
            onChange={(e) => setProposer(e.target.value)}
          />
        </div>

        <div className={modalStyles.actions}>
          <button type="button" className={modalStyles.secondary} onClick={onClose}>
            취소
          </button>
          <button type="button" className={modalStyles.primary} disabled={!selected || submitting} onClick={handleSubmit}>
            {submitting ? '보내는 중…' : '건의 보내기'}
          </button>
        </div>
      </div>
    </div>
  );
}
