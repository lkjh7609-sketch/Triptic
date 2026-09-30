import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Coins, Hotel as HotelIcon, MapPin, Utensils } from 'lucide-react';
import { cityDisplayName } from './cityName';
import { formatMoneyCompact, getDayExpenseTotal } from './expenses';
import type { DayMeals, ExpenseItem, MealSlot } from './types';
import styles from './DaySummary.module.css';

const MEAL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner'];

interface DaySummaryProps {
  cityName: string | null;
  /** 이 날의 도착 숙소 이름 — 마지막 날은 숙소가 없어 칸 자체를 숨긴다 */
  hotelName: string | null;
  showHotel: boolean;
  meals: DayMeals | undefined;
  expenses: ExpenseItem[];
  currency: string;
  onCity: () => void;
  onHotel: () => void;
  onMeals: () => void;
  onExpense: () => void;
}

/**
 * 하루 요약 — 도시·숙소·식사·경비를 테두리 없는 아이콘 4개로. 채워진 칸은 브랜드 틴트 원 + 값,
 * 비어 있는 칸은 회색 원 + "추가". 칸을 누르면 각각의 편집 창이 열린다.
 */
export function DaySummary({ cityName, hotelName, showHotel, meals, expenses, currency, onCity, onHotel, onMeals, onExpense }: DaySummaryProps) {
  const { t, i18n } = useTranslation('plan');
  const filledMeals = MEAL_SLOTS.filter((slot) => {
    const info = meals?.[slot];
    return Boolean(info && !info.skip && info.name);
  }).length;
  const expenseTotal = getDayExpenseTotal(expenses, currency).total;

  const cells: Array<{ key: string; weight: number; icon: ReactNode; label: string; value: ReactNode; onClick: () => void }> = [
    {
      key: 'city',
      weight: 1,
      icon: <MapPin size={18} aria-hidden="true" />,
      label: t('tripDetail.cityLabel'),
      value: cityName ? cityDisplayName(cityName) : null,
      onClick: onCity,
    },
  ];
  if (showHotel) {
    cells.push({ key: 'hotel', weight: 1, icon: <HotelIcon size={18} aria-hidden="true" />, label: t('tripDetail.hotelChipLabel'), value: hotelName, onClick: onHotel });
  }
  cells.push(
    {
      key: 'meals',
      weight: 1,
      icon: <Utensils size={18} aria-hidden="true" />,
      label: t('tripDetail.mealsLabel'),
      value: filledMeals > 0 ? `${filledMeals}/${MEAL_SLOTS.length}` : null,
      onClick: onMeals,
    },
    {
      key: 'expense',
      weight: 1,
      icon: <Coins size={18} aria-hidden="true" />,
      label: t('tripDetail.expenseLabel'),
      value: expenses.length > 0 ? formatMoneyCompact(expenseTotal, currency, i18n.language) : null,
      onClick: onExpense,
    },
  );

  return (
    <div className={styles.summary} style={{ gridTemplateColumns: cells.map((c) => `minmax(0, ${c.weight}fr)`).join(' ') }}>
      {cells.map((cell) => (
        <button key={cell.key} type="button" className={`${styles.cell} ${cell.value ? styles.filled : ''}`} onClick={cell.onClick}>
          <span className={styles.iconCircle}>{cell.icon}</span>
          <span className={styles.label}>{cell.label}</span>
          {cell.value ? <span className={styles.value}>{cell.value}</span> : <span className={styles.add}>{t('common:action.add')}</span>}
        </button>
      ))}
    </div>
  );
}
