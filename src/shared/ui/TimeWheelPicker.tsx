import { useEffect, useRef, useState } from 'react';
import styles from './TimeWheelPicker.module.css';

interface TimeWheelPickerProps {
  value: string; // 'HH:mm'
  onChange: (val: string) => void;
}

export function TimeWheelPicker({ value, onChange }: TimeWheelPickerProps) {
  const [hour, setHour] = useState('12');
  const [minute, setMinute] = useState('00');
  
  const hourRef = useRef<HTMLDivElement>(null);
  const minRef = useRef<HTMLDivElement>(null);
  const isScrolling = useRef(false);

  useEffect(() => {
    if (value) {
      const [h, m] = value.split(':');
      // eslint-disable-next-line
      setHour(h);
      setMinute(m);
    }
  }, [value]);

  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0'));

  const handleScroll = (ref: React.RefObject<HTMLDivElement | null>, type: 'hour' | 'min') => {
    if (!ref.current) return;
    const el = ref.current;
    
    if (isScrolling.current) {
      clearTimeout(isScrolling.current as any);
    }
    
    isScrolling.current = setTimeout(() => {
      const scrollTop = el.scrollTop;
      const index = Math.round(scrollTop / 40);
      
      let newVal = '';
      if (type === 'hour') {
        newVal = hours[Math.min(index, hours.length - 1)];
        if (newVal !== hour) {
          setHour(newVal);
          onChange(`${newVal}:${minute}`);
        }
      } else {
        newVal = minutes[Math.min(index, minutes.length - 1)];
        if (newVal !== minute) {
          setMinute(newVal);
          onChange(`${hour}:${newVal}`);
        }
      }
    }, 150) as any;
  };

  useEffect(() => {
    if (hourRef.current) {
      const idx = hours.indexOf(hour);
      if (idx !== -1) hourRef.current.scrollTop = idx * 40;
    }
  }, [hour, hours]);

  useEffect(() => {
    if (minRef.current) {
      const idx = minutes.indexOf(minute);
      if (idx !== -1) minRef.current.scrollTop = idx * 40;
    }
  }, [minute, minutes]);

  return (
    <div className={styles.container}>
      <div className={styles.highlight} />
      
      <div className={styles.column} ref={hourRef} onScroll={() => handleScroll(hourRef, 'hour')}>
        <div className={styles.pad} />
        {hours.map(h => (
          <div key={h} className={styles.item} style={{ color: h === hour ? 'var(--brand)' : '' }}>{h}</div>
        ))}
        <div className={styles.pad} />
      </div>

      <div className={styles.separator}>:</div>

      <div className={styles.column} ref={minRef} onScroll={() => handleScroll(minRef, 'min')}>
        <div className={styles.pad} />
        {minutes.map(m => (
          <div key={m} className={styles.item} style={{ color: m === minute ? 'var(--brand)' : '' }}>{m}</div>
        ))}
        <div className={styles.pad} />
      </div>
    </div>
  );
}
