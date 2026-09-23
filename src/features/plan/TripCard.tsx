import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { TripRow } from '@/shared/api/tripService';
import { useCityImage } from '@/shared/hooks/useCityImage';
import { getDDay } from './tripStatus';
import styles from './TripCard.module.css';

interface TripCardProps {
  trip: TripRow;
  onRename: (tripId: string, newTitle: string) => void;
  onDuplicate: (tripId: string) => void;
  onDelete: (tripId: string) => void;
  showMenu?: boolean;
}

export function TripCard({ trip, onRename, onDuplicate, onDelete, showMenu = true }: TripCardProps) {
  const { t } = useTranslation(['plan', 'common']);
  const [menuOpen, setMenuOpen] = useState(false);
  const dday = getDDay(trip.start_date);
  const bgImage = useCityImage(trip.city);

  function handleMenuClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen((v) => !v);
  }

  function handleRename(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen(false);
    const next = window.prompt(t('tripCard.renamePrompt'), trip.title);
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
    if (window.confirm(t('tripCard.deleteConfirm', { title: trip.title }))) {
      onDelete(trip.id);
    }
  }

  return (
    <div className={styles.cardWrap}>
      <Link to={`/plan/${trip.id}`} className={styles.card}>
        <div className={styles.thumbnail} style={{ backgroundImage: `url('${bgImage}')` }}>
          {dday !== null ? (
            <span className={styles.dday}>{dday === 0 ? 'D-DAY' : `D-${dday}`}</span>
          ) : null}
        </div>
        <div className={styles.content}>
          <div className={styles.header}>
            <h3 className={styles.title}>{trip.title}</h3>
            {showMenu ? (
              <button
                type="button"
                className={styles.menuButton}
                aria-label={t('tripCard.menuAria')}
                onClick={handleMenuClick}
              >
                ⋮
              </button>
            ) : null}
          </div>
          <p className={styles.dates}>
            {trip.start_date && trip.end_date ? `${trip.start_date} ~ ${trip.end_date}` : t('tripCard.periodUndecided')}
          </p>
          {trip.city ? (
            <div className={styles.chips}>
              <span className={styles.chip}>{trip.city}</span>
            </div>
          ) : null}
        </div>
      </Link>

      {showMenu && menuOpen ? (
        <div className={styles.menu}>
          <button type="button" className={styles.menuItem} onClick={handleRename}>
            {t('tripCard.rename')}
          </button>
          <button type="button" className={styles.menuItem} onClick={handleDuplicate}>
            {t('tripCard.duplicate')}
          </button>
          <button type="button" className={`${styles.menuItem} ${styles.danger}`} onClick={handleDelete}>
            {t('action.delete', { ns: 'common' })}
          </button>
        </div>
      ) : null}
    </div>
  );
}
