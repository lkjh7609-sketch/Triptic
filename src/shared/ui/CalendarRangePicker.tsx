import { useState } from 'react';
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, 
  startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, 
  isSameDay, isWithinInterval, isBefore, startOfDay 
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './CalendarRangePicker.module.css';

interface CalendarRangePickerProps {
  startDate: Date | null;
  endDate: Date | null;
  onChange: (start: Date | null, end: Date | null) => void;
  minDate?: Date;
}

export function CalendarRangePicker({ startDate, endDate, onChange, minDate = new Date() }: CalendarRangePickerProps) {
  const [currentMonth, setCurrentMonth] = useState(startDate || new Date());

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const handleDayClick = (day: Date) => {
    if (minDate && isBefore(startOfDay(day), startOfDay(minDate))) return;

    if (!startDate || (startDate && endDate)) {
      // 시작일만 선택된 상태로 초기화
      onChange(day, null);
    } else if (startDate && !endDate) {
      if (isBefore(day, startDate)) {
        // 시작일보다 앞을 선택하면 시작일을 변경
        onChange(day, null);
      } else {
        // 종료일 선택 완료
        onChange(startDate, day);
      }
    }
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDateOfWeek = startOfWeek(monthStart);
  const endDateOfWeek = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: startDateOfWeek, end: endDateOfWeek });
  const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button type="button" className={styles.navButton} onClick={handlePrevMonth}>
          <ChevronLeft size={20} />
        </button>
        <span>{format(currentMonth, 'yyyy년 M월')}</span>
        <button type="button" className={styles.navButton} onClick={handleNextMonth}>
          <ChevronRight size={20} />
        </button>
      </div>

      <div className={styles.weekdays}>
        {weekDays.map(day => <div key={day}>{day}</div>)}
      </div>

      <div className={styles.daysGrid}>
        {days.map((day) => {
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isToday = isSameDay(day, new Date());
          const isSelectedStart = startDate && isSameDay(day, startDate);
          const isSelectedEnd = endDate && isSameDay(day, endDate);
          const isSelected = isSelectedStart || isSelectedEnd;
          const inRange = startDate && endDate && isWithinInterval(day, { start: startDate, end: endDate });
          const isDisabled = minDate && isBefore(startOfDay(day), startOfDay(minDate));

          let rangeClass = '';
          if (inRange && !isSelectedStart && !isSelectedEnd) rangeClass = styles.inRange;
          if (startDate && endDate && isSelectedStart && !isSameDay(startDate, endDate)) rangeClass = styles.startRange;
          if (startDate && endDate && isSelectedEnd && !isSameDay(startDate, endDate)) rangeClass = styles.endRange;

          return (
            <div 
              key={day.toString()} 
              className={`${styles.dayCell} ${!isCurrentMonth ? styles.disabled : ''} ${isDisabled ? styles.disabled : ''} ${rangeClass} ${isSelected ? styles.selected : ''} ${isToday ? styles.today : ''}`}
              onClick={() => {
                if (isCurrentMonth && !isDisabled) handleDayClick(day);
              }}
            >
              {isCurrentMonth && (
                <button type="button" className={styles.dayBtn} disabled={isDisabled}>
                  {format(day, 'd')}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
