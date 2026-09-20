import { useState } from 'react';
import { usePlaceAutocomplete, type SelectedPlace } from './map/usePlaceAutocomplete';
import { captureError } from '@/shared/monitoring';
import type { DayCityInfo } from './types';
import styles from './DayCityModal.module.css';
import modalStyles from './AddPlaceModal.module.css';

interface DayCityModalProps {
  currentDay: number;
  totalDays: number;
  currentCity: DayCityInfo;
  onClose: () => void;
  /** scope: 'rest'면 currentDay~totalDays 전체, 'single'이면 currentDay만 (index.html submitDayCityChange 이식) */
  onSave: (city: DayCityInfo, scope: 'rest' | 'single') => Promise<void>;
}

/**
 * 일차별 활동 도시 변경 (index.html openDayCityModal/submitDayCityChange 이식)
 * 도시만 검색되도록 Places Autocomplete를 '(cities)' 타입으로 제한한다.
 */
export function DayCityModal({ currentDay, totalDays, currentCity, onClose, onSave }: DayCityModalProps) {
  const [selected, setSelected] = useState<SelectedPlace | null>(null);
  const [scope, setScope] = useState<'rest' | 'single'>('rest');
  const [saving, setSaving] = useState(false);
  const { inputRef } = usePlaceAutocomplete(setSelected, { types: ['(cities)'] });

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    try {
      await onSave({ name: selected.name, lat: selected.lat, lng: selected.lng }, scope);
      onClose();
    } catch (err) {
      captureError(err, { context: 'setDayCity' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={modalStyles.overlay} onClick={onClose}>
      <div className={modalStyles.sheet} onClick={(e) => e.stopPropagation()}>
        <h2 className={modalStyles.title}>📍 {currentDay}일차 활동 도시 설정</h2>

        <div className={styles.currentBanner}>
          <span className={styles.currentLabel}>{currentDay}일차 현재 도시</span>
          <strong className={styles.currentName}>{currentCity.name || '미설정'}</strong>
        </div>

        <input
          ref={inputRef}
          className={modalStyles.input}
          placeholder="도시 검색 (예: Kyoto, Japan)"
        />

        <div className={styles.scopeSection}>
          <label className={`${styles.scopeCard} ${scope === 'rest' ? styles.scopeCardSelected : ''}`}>
            <input
              type="radio"
              name="day-city-scope"
              checked={scope === 'rest'}
              onChange={() => setScope('rest')}
            />
            <div>
              <div className={styles.scopeTitle}>
                이 날부터 여행 끝까지 일괄 적용 <span className={styles.scopeBadge}>추천 ⭐️</span>
              </div>
              <div className={styles.scopeDesc}>
                {currentDay}일차부터 {totalDays}일차까지 모든 일정의 도시를 변경합니다.
              </div>
            </div>
          </label>

          <label className={`${styles.scopeCard} ${scope === 'single' ? styles.scopeCardSelected : ''}`}>
            <input
              type="radio"
              name="day-city-scope"
              checked={scope === 'single'}
              onChange={() => setScope('single')}
            />
            <div>
              <div className={styles.scopeTitle}>이 날({currentDay}일차)만 적용</div>
              <div className={styles.scopeDesc}>오직 {currentDay}일차 하루만 이 도시로 지정합니다.</div>
            </div>
          </label>
        </div>

        <div className={modalStyles.actions}>
          <button type="button" className={modalStyles.secondary} onClick={onClose}>
            취소
          </button>
          <button type="button" className={modalStyles.primary} disabled={!selected || saving} onClick={handleSave}>
            {saving ? '적용 중…' : '도시 적용'}
          </button>
        </div>
      </div>
    </div>
  );
}
