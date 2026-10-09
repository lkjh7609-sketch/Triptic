import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Delete } from 'lucide-react';
import { PIN_LENGTH } from './adminPinService';
import styles from './AdminPinPad.module.css';


const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

interface PinKeypadProps {
  /** 지금까지 누른 숫자 */
  digits: string;
  /** 틀렸을 때 점이 흔들리는 효과 */
  shake?: boolean;
  /** 보내는 중·잠김 등으로 누를 수 없을 때 */
  disabled?: boolean;
  /** 점과 숫자판 사이에 보이는 안내(남은 횟수·잠금 시간 등) */
  message?: ReactNode;
  onDigit: (digit: string) => void;
  onErase: () => void;
}

/**
 * 6자리 보안코드 입력판 — 키보드로 치지 않고 화면의 숫자 버튼을 누른다(점 6개 + 3×4 숫자판).
 * 관리자 로그인 화면과 강제 탈퇴 확인 창이 같이 쓴다. 입력값은 부모가 들고 있고, 이 부품은 그리기만 한다.
 */
export function PinKeypad({ digits, shake = false, disabled = false, message, onDigit, onErase }: PinKeypadProps) {
  const { t } = useTranslation('community');
  return (
    <>
      <div className={`${styles.dots} ${shake ? styles.shake : ''}`} role="img" aria-label={t('admin.pin.entered', { count: digits.length, total: PIN_LENGTH })}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span key={i} className={i < digits.length ? styles.dotOn : styles.dot} />
        ))}
      </div>

      <p className={styles.message} role="status" aria-live="polite">
        {message}
      </p>

      <div className={styles.pad}>
        {DIGITS.map((d) => (
          <button key={d} type="button" className={styles.key} disabled={disabled} onClick={() => onDigit(d)}>
            {d}
          </button>
        ))}
        <span aria-hidden="true" />
        <button type="button" className={styles.key} disabled={disabled} onClick={() => onDigit('0')}>
          0
        </button>
        <button type="button" className={styles.keyMuted} disabled={disabled || digits.length === 0} aria-label={t('admin.pin.erase')} onClick={onErase}>
          <Delete size={20} aria-hidden="true" />
        </button>
      </div>
    </>
  );
}
