import { useState } from 'react';
import modalStyles from '@/features/plan/AddPlaceModal.module.css';

interface GuestNameModalProps {
  projectName: string;
  onConfirm: (name: string) => void;
}

/** 게스트 이름 입력 (index.html openGuestNameModal/confirmGuestName 이식) */
export function GuestNameModal({ projectName, onConfirm }: GuestNameModalProps) {
  const [name, setName] = useState('');

  return (
    <div className={modalStyles.overlay}>
      <div className={modalStyles.sheet} onClick={(e) => e.stopPropagation()}>
        <h2 className={modalStyles.title}>✈️ {projectName}</h2>
        <p className={modalStyles.hint}>
          동행하시는 분의 성함이나 별명을 알려주세요.
          <br />
          장소를 건의할 때 작성자로 표시됩니다.
        </p>
        <div className={modalStyles.field}>
          <label className={modalStyles.label}>내 이름</label>
          <input
            className={modalStyles.input}
            placeholder="예: 민수"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onConfirm(name);
            }}
          />
        </div>
        <div className={modalStyles.actions}>
          <button type="button" className={modalStyles.primary} onClick={() => onConfirm(name)}>
            입장하기
          </button>
        </div>
      </div>
    </div>
  );
}
