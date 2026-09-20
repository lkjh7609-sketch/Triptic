import styles from './ConfidenceField.module.css';

interface ConfidenceFieldProps {
  label: string;
  value: string | null;
  confidence: number;
  onChange: (next: string) => void;
  /** §6.6 "원본 PDF 해당 위치로 스크롤" — 이번 라운드는 문서 자체를 새 탭에서 여는 걸로 단순화했다 */
  onViewOriginal?: () => void;
}

/**
 * 신뢰도 필드 (01-design-system.md §6.6, 서류 검수 전용)
 * ≥0.9 일반 입력 / 0.8~0.9 경고 배경+아이콘 / <0.8 빈 입력+플레이스홀더+원본 보기.
 * 색만으로 정보를 전달하지 않는다(§ 접근성 체크리스트) — 항상 아이콘+문구를 같이 쓴다.
 */
export function ConfidenceField({ label, value, confidence, onChange, onViewOriginal }: ConfidenceFieldProps) {
  const low = confidence < 0.8;
  const medium = confidence >= 0.8 && confidence < 0.9;

  return (
    <div className={styles.field}>
      <label className={styles.label}>
        {label}
        {medium ? <span className={styles.warningBadge}>⚠️ 확인해 주세요</span> : null}
        {low ? <span className={styles.emptyBadge}>추출 실패 — 직접 입력</span> : null}
      </label>
      <input
        className={`${styles.input} ${medium ? styles.mediumConfidence : ''} ${low ? styles.lowConfidence : ''}`}
        value={low ? '' : (value ?? '')}
        placeholder={low ? value ?? '' : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {low && onViewOriginal ? (
        <button type="button" className={styles.viewOriginal} onClick={onViewOriginal}>
          원본 보기
        </button>
      ) : null}
    </div>
  );
}
