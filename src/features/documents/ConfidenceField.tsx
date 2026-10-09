import styles from './ConfidenceField.module.css';

interface ConfidenceFieldProps {
  label: string;
  value: string | null;
  onChange: (next: string) => void;
}

/**
 * 서류 검수 입력 칸 (01-design-system.md §6.6)
 * 예전엔 신뢰도에 따라 '확인해 주세요'·'추출 실패 — 직접 입력'·원본 보기를 띄우고 낮으면 칸을 비웠지만,
 * 2026-10-09 사용자 결정으로 문구 없이 읽은 값을 항상 칸에 그대로 넣는다 — 틀리면 사용자가 고친다.
 */
export function ConfidenceField({ label, value, onChange }: ConfidenceFieldProps) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>{label}</label>
      <input className={styles.input} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
