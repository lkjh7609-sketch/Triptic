import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react';
import styles from './AdminFilters.module.css';

export interface FilterOption {
  value: string;
  label: string;
}

/** 하나만 고르는 알약 묶음 — value가 ''이면 '전체' */
export interface PillFilter {
  key: string;
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
}

/** 날짜 범위(yyyy-MM-dd, 비우면 제한 없음) */
export interface DateRangeFilter {
  key: string;
  label: string;
  from: string;
  to: string;
  fromLabel: string;
  toLabel: string;
  onChange: (from: string, to: string) => void;
}

interface AdminFilterBarProps {
  searchValue: string;
  searchPlaceholder: string;
  onSearchChange: (value: string) => void;
  /** Enter 또는 검색 버튼 */
  onSearchSubmit: () => void;
  pills?: PillFilter[];
  dateRange?: DateRangeFilter;
  /** 검색어와 모든 필터를 비운다 */
  onReset: () => void;
}

/**
 * 운영 콘솔 공통 필터 줄 — 항공권·호텔 화면과 같은 방식: 검색창 옆 '필터' 버튼(걸린 개수 배지)을 누르면 알약 묶음이 펼쳐지고,
 * 알약을 누르는 즉시 적용된다. 접어 두면 걸린 필터가 ×가 달린 칩으로 보여 하나씩 뺄 수 있다.
 */
export function AdminFilterBar({ searchValue, searchPlaceholder, onSearchChange, onSearchSubmit, pills = [], dateRange, onReset }: AdminFilterBarProps) {
  const { t } = useTranslation('community');
  const [open, setOpen] = useState(false);

  const activePills = pills.filter((p) => p.value !== '');
  const dateActive = !!dateRange && (dateRange.from !== '' || dateRange.to !== '');
  const count = activePills.length + (dateActive ? 1 : 0);
  const anyActive = count > 0 || searchValue.trim() !== '';

  return (
    <div className={styles.wrap}>
      <div className={styles.bar}>
        <form
          className={styles.search}
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            onSearchSubmit();
          }}
        >
          <Search size={16} aria-hidden="true" className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            type="search"
            enterKeyHint="search"
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          <button type="submit" className={styles.searchBtn}>
            {t('admin.userSearchButton')}
          </button>
        </form>
        {pills.length > 0 || dateRange ? (
          <button type="button" className={count > 0 || open ? styles.filterBtnOn : styles.filterBtn} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            <SlidersHorizontal size={16} aria-hidden="true" />
            <span className={styles.filterText}>{t('admin.filter.button')}</span>
            {count > 0 ? <span className={styles.badge}>{count}</span> : null}
          </button>
        ) : null}
      </div>

      {open ? (
        <div className={styles.panel}>
          {pills.map((p) => (
            <fieldset key={p.key} className={styles.section}>
              <legend className={styles.sectionTitle}>{p.label}</legend>
              <div className={styles.pills}>
                {[{ value: '', label: t('admin.members.all') }, ...p.options].map((o) => (
                  <button key={o.value || 'all'} type="button" className={p.value === o.value ? styles.pillOn : styles.pill} aria-pressed={p.value === o.value} onClick={() => p.onChange(o.value)}>
                    {o.label}
                  </button>
                ))}
              </div>
            </fieldset>
          ))}
          {dateRange ? (
            <fieldset className={styles.section}>
              <legend className={styles.sectionTitle}>{dateRange.label}</legend>
              <div className={styles.dates}>
                <label className={styles.date}>
                  <span>{dateRange.fromLabel}</span>
                  <input type="date" value={dateRange.from} max={dateRange.to || undefined} onChange={(e) => dateRange.onChange(e.target.value, dateRange.to)} />
                </label>
                <label className={styles.date}>
                  <span>{dateRange.toLabel}</span>
                  <input type="date" value={dateRange.to} min={dateRange.from || undefined} onChange={(e) => dateRange.onChange(dateRange.from, e.target.value)} />
                </label>
              </div>
            </fieldset>
          ) : null}
          <div className={styles.footer}>
            <button type="button" className={styles.resetBtn} disabled={!anyActive} onClick={onReset}>
              <RotateCcw size={14} aria-hidden="true" /> {t('admin.members.reset')}
            </button>
            <button type="button" className={styles.doneBtn} onClick={() => setOpen(false)}>
              {t('admin.filter.done')}
            </button>
          </div>
        </div>
      ) : null}

      {count > 0 ? (
        <div className={styles.chips} aria-label={t('admin.filter.active')}>
          {activePills.map((p) => (
            <button key={p.key} type="button" className={styles.chip} aria-label={t('admin.filter.remove', { name: p.label })} onClick={() => p.onChange('')}>
              {p.label}: {p.options.find((o) => o.value === p.value)?.label ?? p.value}
              <X size={12} aria-hidden="true" />
            </button>
          ))}
          {dateActive && dateRange ? (
            <button type="button" className={styles.chip} aria-label={t('admin.filter.remove', { name: dateRange.label })} onClick={() => dateRange.onChange('', '')}>
              {dateRange.label}: {dateRange.from || '…'} ~ {dateRange.to || '…'}
              <X size={12} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** 필터 줄 없이 쓰는 한 줄 알약 선택(예: 건의함 전체/일반/제휴) — 누르는 즉시 적용 */
export function AdminPillRow({ label, value, options, onChange }: { label: string; value: string; options: FilterOption[]; onChange: (value: string) => void }) {
  return (
    <div className={styles.pills} role="group" aria-label={label} style={{ marginBottom: 'var(--space-3)' }}>
      {options.map((o) => (
        <button key={o.value || 'all'} type="button" className={value === o.value ? styles.pillOn : styles.pill} aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
