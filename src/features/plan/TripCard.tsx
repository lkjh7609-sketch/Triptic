import { useState } from 'react';
import { Link } from 'react-router';
import type { TripRow } from '@/shared/api/tripService';
import { getDDay } from './tripStatus';
import styles from './TripCard.module.css';

interface TripCardProps {
  trip: TripRow;
  onRename: (tripId: string, newTitle: string) => void;
  onDuplicate: (tripId: string) => void;
  onDelete: (tripId: string) => void;
  /** 홈 대시보드의 "지난 여행" 가로 스크롤(02-screens.md §2.1)처럼 카드를 훑어보기만
   * 하는 자리에서는 이름변경/복제/삭제 메뉴가 의미가 없어 숨긴다. 기본은 표시(true). */
  showMenu?: boolean;
}

/**
 * 여행 목록 카드 (02-screens.md §3.1): 여행명 · 기간 · D-day 배지 · 도시 칩
 * 스펙은 "스와이프: 복제/삭제"를 명시하지만, 이번 라운드는 ⋮ 메뉴로 대체한다
 * (스와이프 제스처는 후속 다듬기 — 기능 자체(복제/삭제/이름변경)는 패리티 항목이라 먼저 갖춘다).
 */
export function TripCard({ trip, onRename, onDuplicate, onDelete, showMenu = true }: TripCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const dday = getDDay(trip.start_date);

  function handleMenuClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen((v) => !v);
  }

  function handleRename(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen(false);
    const next = window.prompt('새 여행 이름을 입력해 주세요', trip.title);
    if (next && next.trim()) onRename(trip.id, next.trim());
  }

  function handleDuplicate(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen(false);
    onDuplicate(trip.id);
  }

  function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen(false);
    if (window.confirm(`'${trip.title}' 여행을 삭제할까요? 되돌릴 수 없어요.`)) {
      onDelete(trip.id);
    }
  }

  return (
    <div className={styles.cardWrap}>
      <Link to={`/plan/${trip.id}`} className={styles.card}>
        <div className={styles.header}>
          <h3 className={styles.title}>{trip.title}</h3>
          <div className={styles.headerRight}>
            {dday !== null ? (
              <span className={styles.dday}>{dday === 0 ? 'D-DAY' : `D-${dday}`}</span>
            ) : null}
            {showMenu ? (
              <button
                type="button"
                className={styles.menuButton}
                aria-label="여행 메뉴"
                onClick={handleMenuClick}
              >
                ⋮
              </button>
            ) : null}
          </div>
        </div>
        <p className={styles.dates}>
          {trip.start_date && trip.end_date ? `${trip.start_date} ~ ${trip.end_date}` : '기간 미정'}
        </p>
        {trip.city ? (
          <div className={styles.chips}>
            <span className={styles.chip}>{trip.city}</span>
          </div>
        ) : null}
      </Link>

      {showMenu && menuOpen ? (
        <div className={styles.menu}>
          <button type="button" className={styles.menuItem} onClick={handleRename}>
            이름 변경
          </button>
          <button type="button" className={styles.menuItem} onClick={handleDuplicate}>
            복제
          </button>
          <button type="button" className={`${styles.menuItem} ${styles.danger}`} onClick={handleDelete}>
            삭제
          </button>
        </div>
      ) : null}
    </div>
  );
}
