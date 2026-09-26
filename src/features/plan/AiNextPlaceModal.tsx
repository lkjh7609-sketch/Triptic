import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, MapPin, Clock, Info, Check, X, ArrowLeft } from 'lucide-react';
import styles from './AiNextPlaceModal.module.css';
import { TimeWheelPicker } from '@/shared/ui/TimeWheelPicker';
import modalStyles from './AddPlaceModal.module.css';
import { tripService } from '@/shared/api/tripService';
import { apiUrl } from '@/shared/api/apiUrl';
import type { TripRow } from '@/shared/api/tripService';

interface AiNextPlaceModalProps {
  trip: TripRow;
  currentDay: number;
  baseItem: any;
  insertIndex: number;
  onClose: () => void;
  onAddPlace: (place: any) => void;
}

export function AiNextPlaceModal({ trip, currentDay, baseItem, onClose, onAddPlace }: AiNextPlaceModalProps) {
  const { t } = useTranslation(['plan', 'common']);
  const [loading, setLoading] = useState(true);
  const [recs, setRecs] = useState<any[]>([]);
  const [confirmingRec, setConfirmingRec] = useState<any | null>(null);
  const [time, setTime] = useState('');

  useEffect(() => {
    async function fetchRecommendations() {
      try {
        const project = tripService.toLocalProject(trip);
        const dayCity = (project.dayCities as Record<number, any>)?.[currentDay]?.name;
        const city = dayCity ? dayCity.split(',')[0].trim() : (trip.title || '현지');
        const placeName = baseItem?.name || '도심 중심가';

        const res = await fetch(apiUrl('/api/recommend'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            placeName,
            city,
            category: 'all'
          })
        });

        if (!res.ok) {
          throw new Error('API Error');
        }

        const data = await res.json();
        if (data.success && data.recommendations) {
          const formatted = data.recommendations.map((r: any, i: number) => ({
            id: `rec_${i}_${Date.now()}`,
            name: r.name,
            address: r.address || r.distance || '',
            memo: r.tip || '',
            category: r.categoryLabel || r.category,
            distance: r.distance,
            duration: r.priceRange || '예상 체류 60분',
            reason: r.reason,
            rating: r.estimatedRating || 4.5,
            raw: r
          }));
          setRecs(formatted);
        }
      } catch (err) {
        console.error('AI Recommendation Error:', err);
        setRecs([
          {
            id: 'error_fallback',
            name: '추천 서버에 연결할 수 없습니다.',
            category: '오류',
            distance: '',
            duration: '',
            reason: '현재 AI 서버 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.',
            rating: 0,
            raw: {}
          }
        ]);
      } finally {
        setLoading(false);
      }
    }

    fetchRecommendations();
  }, [trip, currentDay, baseItem]);

  const handleFinalAdd = () => {
    if (!confirmingRec) return;
    if (!confirmingRec.raw?.lat || !confirmingRec.raw?.lng) {
      alert("구글 맵스에서 이 장소의 정확한 좌표를 찾지 못했습니다. 앱 내 일반 검색창을 이용해 직접 추가해 주세요.");
      return;
    }
    const newItem = {
      key: crypto.randomUUID(),
      type: 'place',
      name: confirmingRec.name,
      address: confirmingRec.raw?.address || confirmingRec.raw?.distance || '',
      lat: confirmingRec.raw.lat,
      lng: confirmingRec.raw.lng,
      placeId: confirmingRec.raw.placeId,
      time: time || undefined,
      memo: confirmingRec.raw?.tip || '',
      category: 'spot',
      completed: false
    };
    onAddPlace(newItem);
    onClose();
  };

  return (
    <div className={modalStyles.overlay} onClick={onClose}>
      <div className={`${modalStyles.sheet} ${styles.aiSheet}`} onClick={(e) => e.stopPropagation()}>
        
        {confirmingRec ? (
          <>
            <div className={styles.header}>
              <button className={styles.backBtn} onClick={() => setConfirmingRec(null)}><ArrowLeft size={20}/></button>
              <h2>언제 방문하실 건가요?</h2>
              <p>'{confirmingRec.name}' 일정을 추가합니다.</p>
            </div>
            <div className={styles.timeConfirmView}>
              <div className={modalStyles.field} style={{ marginBottom: 'var(--space-4)' }}>
                <label className={modalStyles.label}>방문 예정 시간</label>
                <TimeWheelPicker value={time} onChange={setTime} />
              </div>
              <div className={modalStyles.actions}>
                <button type="button" className={modalStyles.secondary} onClick={() => setConfirmingRec(null)}>뒤로 가기</button>
                <button type="button" className={modalStyles.primary} onClick={handleFinalAdd}>최종 추가하기</button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className={styles.header}>
              <h2><Sparkles size={18} color="#0D9488" /> AI Travel Assistant</h2>
              <p>'{baseItem?.name || '현재 위치'}' 기준으로 다음 장소를 제안합니다.</p>
            </div>

            {loading ? (
              <div className={styles.loadingState}>
                <div className={styles.spinner} />
                <p>현재 시간, 이동 거리, 오늘 일정을 분석 중입니다...</p>
              </div>
            ) : (
              <div className={styles.list}>
                {recs.map(rec => (
                  <div key={rec.id} className={styles.card}>
                    <div className={styles.cardHeader}>
                      <h3>{rec.name}</h3>
                      {rec.rating > 0 && <span className={styles.rating}>⭐ {rec.rating}</span>}
                    </div>
                    <div className={styles.metaInfo}>
                      {rec.distance && <span><MapPin size={14}/> {rec.distance}</span>}
                      {rec.duration && <span><Clock size={14}/> {rec.duration}</span>}
                      <span className={styles.categoryTag}>{rec.category}</span>
                    </div>
                    
                    <div className={styles.reasonBox}>
                      <div className={styles.reasonTitle}><Info size={14}/> 왜 추천했나요?</div>
                      <p>{rec.reason}</p>
                    </div>

                    <div className={styles.actionButtons}>
                      <button type="button" className={styles.rejectBtn} onClick={() => setRecs(recs.filter(r => r.id !== rec.id))}>
                        <X size={16}/> 관심 없음
                      </button>
                      <button type="button" className={styles.acceptBtn} onClick={() => setConfirmingRec(rec)}>
                        <Check size={16}/> 일정에 추가
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className={modalStyles.actions}>
              <button type="button" className={modalStyles.secondary} onClick={onClose}>
                {t('common:action.close')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
