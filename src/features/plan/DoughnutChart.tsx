import { useTranslation } from 'react-i18next';
import { formatMoney } from './expenses';
import styles from './DoughnutChart.module.css';

interface ExpenseChartDatum {
  label: string;
  value: number;
}

interface DoughnutChartProps {
  title: string;
  data: ExpenseChartDatum[];
  currency: string;
}

const COLORS = ['#F28B82', '#FBBC04', '#34A853', '#4285F4', '#8E24AA', '#F48FB1', '#81C995', '#AECBFA'];

export function DoughnutChart({ title, data, currency }: DoughnutChartProps) {
  const { t, i18n } = useTranslation(['plan', 'common']);
  
  const total = data.reduce((acc, curr) => acc + curr.value, 0);
  
  let currentPercent = 0;
  const gradientStops = data.map((d, i) => {
    const percent = (d.value / total) * 100;
    const start = currentPercent;
    const end = currentPercent + percent;
    currentPercent = end; // eslint-disable-line
    const color = COLORS[i % COLORS.length];
    return `${color} ${start}% ${end}%`;
  }).join(', ');

  const hasData = total > 0;

  return (
    <div className={styles.wrap}>
      <h3 className={styles.title}>{title}</h3>
      {!hasData ? (
        <p className={styles.empty}>{t('common:state.empty')}</p>
      ) : (
        <div className={styles.content}>
          <div className={styles.chartContainer}>
            <div 
              className={styles.doughnut} 
              style={{ background: `conic-gradient(${gradientStops})` }}
            >
              <div className={styles.hole}>
                <span className={styles.totalText}>{t('expense.totalLabel')}</span>
                <span className={styles.totalValue}>{formatMoney(total, currency, i18n.language)}</span>
              </div>
            </div>
          </div>
          <div className={styles.legend}>
            {data.map((d, i) => (
              <div key={d.label} className={styles.legendItem}>
                <div className={styles.legendColor} style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className={styles.legendLabel}>{d.label}</span>
                <span className={styles.legendValue}>{((d.value / total) * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
