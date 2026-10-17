import styles from './TimeBox.module.css';

interface TimeBoxProps {
  /** 'HH:mm', 없으면 '' */
  value: string;
  onChange: (next: string) => void;
  ariaLabel: string;
  id?: string;
}

/**
 * 시각 입력 칸(type=time). iPhone은 높이를 키운 시간 입력의 글자를 위에 붙이고 회색 바탕·파란 글자로 그린다 —
 * 테두리·높이·바탕은 감싼 label이 맡고, 입력은 테두리 없이 그 안 세로 가운데에 둔다. 칸 어디를 눌러도 시간 선택이 열린다.
 */
export function TimeBox({ value, onChange, ariaLabel, id }: TimeBoxProps) {
  return (
    <label className={styles.box}>
      <input id={id} type="time" className={styles.input} aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
