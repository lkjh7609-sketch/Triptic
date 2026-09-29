import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  /** 주면 이 개수씩 한 쪽으로 묶어 옆으로 넘겨 본다(일자별 합계처럼 항목이 많이 늘어나는 차트용) */
  pageSize?: number;
}

function chunk<T>(items: T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size));
  return pages;
}

/**
 * 일자별/카테고리별 합계 차트 (02-screens.md §3.7). 별도 차트 라이브러리를
 * 새로 들이지 않고 가로 막대 목록으로 구현했다 — jsPDF 사고(번들 크기 폭증,
 * memory 참고) 이후 이 프로젝트가 번들 크기에 민감하다는 판단.
 */
export function ExpenseChart({ title, data, currency, pageSize }: ExpenseChartProps) {
  // defaultNS가 'common'이라(src/shared/i18n/index.ts) ns 지정 없이 바로 공용 상태 문구를 쓴다
  const { t, i18n } = useTranslation();
  const max = Math.max(1, ...data.map((d) => d.value));
  const pagerRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);

  const pages = pageSize && data.length > pageSize ? chunk(data, pageSize) : null;

  function renderRows(items: ExpenseChartDatum[]) {
    return (
      <div className={styles.rows}>
        {items.map((d) => (
          <div className={styles.row} key={d.label}>
            <span className={styles.label}>{d.label}</span>
            <div className={styles.track}>
              <div className={styles.fill} style={{ width: `${(d.value / max) * 100}%` }} />
            </div>
            <span className={styles.value}>{formatMoney(d.value, currency, i18n.language)}</span>
          </div>
        ))}
      </div>
    );
  }

  function handleScroll() {
    const el = pagerRef.current;
    if (!el || el.clientWidth === 0) return;
    setPage(Math.round(el.scrollLeft / el.clientWidth));
  }

  function goToPage(index: number) {
    const el = pagerRef.current;
    if (!el) return;
    el.scrollTo({ left: index * el.clientWidth, behavior: 'smooth' });
  }

  return (
    <div className={styles.wrap}>
      <h3 className={styles.title}>{title}</h3>
      {data.length === 0 ? (
        <p className={styles.empty}>{t('state.empty')}</p>
      ) : pages ? (
        <>
          <div ref={pagerRef} className={styles.pager} onScroll={handleScroll}>
            {pages.map((items, i) => (
              <div
                key={i}
                className={styles.page}
                role="group"
                aria-label={t('expense.chartPage', { ns: 'plan', page: i + 1, total: pages.length })}
              >
                {renderRows(items)}
              </div>
            ))}
          </div>
          <div className={styles.dots}>
            {pages.map((_, i) => (
              <button
                key={i}
                type="button"
                className={i === page ? styles.dotActive : styles.dot}
                aria-label={t('expense.chartPage', { ns: 'plan', page: i + 1, total: pages.length })}
                aria-current={i === page ? 'true' : undefined}
                onClick={() => goToPage(i)}
              />
            ))}
          </div>
        </>
      ) : (
        renderRows(data)
      )}
    </div>
  );
}
