import { formatMoney } from './expenses';
import styles from './ExpenseChart.module.css';

interface ExpenseChartDatum {
  label: string;
  value: number;
}

interface ExpenseChartProps {
  title: string;
  data: ExpenseChartDatum[];
  currency: string;
}

/**
 * 일자별/카테고리별 합계 차트 (02-screens.md §3.7). 별도 차트 라이브러리를
 * 새로 들이지 않고 가로 막대 목록으로 구현했다 — jsPDF 사고(번들 크기 폭증,
 * memory 참고) 이후 이 프로젝트가 번들 크기에 민감하다는 판단.
 */
export function ExpenseChart({ title, data, currency }: ExpenseChartProps) {
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className={styles.wrap}>
      <h3 className={styles.title}>{title}</h3>
      {data.length === 0 ? (
        <p className={styles.empty}>표시할 데이터가 없습니다.</p>
      ) : (
        <div className={styles.rows}>
          {data.map((d) => (
            <div className={styles.row} key={d.label}>
              <span className={styles.label}>{d.label}</span>
              <div className={styles.track}>
                <div className={styles.fill} style={{ width: `${(d.value / max) * 100}%` }} />
              </div>
              <span className={styles.value}>{formatMoney(d.value, currency)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
