import { useState } from 'react';
import modalStyles from '../plan/AddPlaceModal.module.css';
import { Thermometer, Map } from 'lucide-react';

export function UnitSettingsModal({ onClose, profile, updateProfile }: any) {
  const [tempUnit, setTempUnit] = useState(profile?.temp_unit || 'c');
  const [distUnit, setDistUnit] = useState(profile?.distance_unit || 'km');

  const handleSave = () => {
    updateProfile.mutate({ temp_unit: tempUnit, distance_unit: distUnit });
    onClose();
  };

  return (
    <div className={modalStyles.overlay} onClick={onClose}>
      <div className={modalStyles.sheet} onClick={e => e.stopPropagation()}>
        <h2>단위 설정</h2>
        <div className={modalStyles.field}>
          <label className={modalStyles.label}><Thermometer size={16}/> 온도 단위</label>
          <select className={modalStyles.input} value={tempUnit} onChange={e => setTempUnit(e.target.value)}>
            <option value="c">섭씨 (°C)</option>
            <option value="f">화씨 (°F)</option>
          </select>
        </div>
        <div className={modalStyles.field}>
          <label className={modalStyles.label}><Map size={16}/> 거리 단위</label>
          <select className={modalStyles.input} value={distUnit} onChange={e => setDistUnit(e.target.value)}>
            <option value="km">킬로미터 (km)</option>
            <option value="mi">마일 (mi)</option>
          </select>
        </div>
        <div className={modalStyles.actions}>
          <button type="button" className={modalStyles.secondary} onClick={onClose}>취소</button>
          <button type="button" className={modalStyles.primary} onClick={handleSave}>저장</button>
        </div>
      </div>
    </div>
  );
}
