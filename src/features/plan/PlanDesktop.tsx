import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { Plus, Map, Calendar } from 'lucide-react';
import type { TripRow } from '@/shared/api/tripService';
import { useCityImage } from '@/shared/hooks/useCityImage';
import { getDDay } from './tripStatus';
import { CreateTripModal } from './CreateTripModal';
import { BackupModal } from './BackupModal';
import styles from './PlanDesktop.module.css';

interface PlanDesktopProps {
  trips: TripRow[];
  ongoing: TripRow[];
  upcoming: TripRow[];
  past: TripRow[];
  onRefetch: () => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

export function PlanDesktop({ trips, ongoing, upcoming, past, onRefetch, onRename, onDuplicate, onDelete }: PlanDesktopProps) {
  const { t } = useTranslation(['plan', 'common']);
  const [showCreate, setShowCreate] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const autoCreateCity = searchParams.get('autoCreate');
  const [filter, setFilter] = useState<'all' | 'active' | 'past'>('all');
  useEffect(() => {
    if (autoCreateCity) {
      setShowCreate(true);
    }
  }, [autoCreateCity]);

  const activeTrips = ongoing.length + upcoming.length;

  let heroTrip: TripRow | undefined;
  let gridTrips: TripRow[] = [];

  if (filter === 'all') {
    heroTrip = ongoing[0] || upcoming[0];
    gridTrips = trips.filter(t => t.id !== heroTrip?.id);
  } else if (filter === 'active') {
    const activeList = [...ongoing, ...upcoming];
    heroTrip = activeList[0];
    gridTrips = activeList.filter(t => t.id !== heroTrip?.id);
  } else if (filter === 'past') {
    heroTrip = undefined;
    gridTrips = past;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.statsRow}>
          <button 
            className={`${styles.statChip} ${filter === 'active' ? styles.activeFilter : ''}`} 
            onClick={() => setFilter(filter === 'active' ? 'all' : 'active')}
          >
            <Map size={14} style={{ display: 'inline', marginRight: 4 }} /> {activeTrips} {t('desktop.activeJourneys')}
          </button>
          <button 
            className={`${styles.statChip} ${filter === 'past' ? styles.activeFilter : ''}`} 
            onClick={() => setFilter(filter === 'past' ? 'all' : 'past')}
          >
            <Calendar size={14} style={{ display: 'inline', marginRight: 4 }} /> {past.length} {t('desktop.pastExpeditions')}
          </button>
        </div>
        <div className={styles.actions}>
          <button className={styles.btnPrimary} onClick={() => setShowCreate(true)}>
            <Plus size={18} /> {t('planScreen.createTripAria', { defaultValue: 'Create New Journey' })}
          </button>
        </div>
      </div>

      {heroTrip ? (
        <>
          <h2 className={styles.sectionTitle}>{t('desktop.featuredJourney')}</h2>
          <HeroCard trip={heroTrip} onRename={onRename} onDuplicate={onDuplicate} onDelete={onDelete} />
        </>
      ) : filter === 'past' && gridTrips.length === 0 ? (
        <div className={styles.emptyState}>
          <h3 style={{ fontSize: 24, marginBottom: 8 }}>{t('desktop.noPastTripsTitle', { defaultValue: '지난 여행이 없어요' })}</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>{t('desktop.noPastTripsDesc', { defaultValue: '아직 다녀온 여행이 기록되지 않았습니다.' })}</p>
        </div>
      ) : filter === 'past' && gridTrips.length > 0 ? null : (
        <div className={styles.emptyState}>
          <h3 style={{ fontSize: 24, marginBottom: 8 }}>{t('planScreen.firstTripMessage')}</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>{t('desktop.startPlanningDesc')}</p>
          <button className={styles.btnPrimary} style={{ margin: '0 auto' }} onClick={() => setShowCreate(true)}>
            <Plus size={18} /> {t('planScreen.createTripAria')}
          </button>
        </div>
      )}

      {gridTrips.length > 0 && (
        <>
          <h2 className={styles.sectionTitle}>{t('desktop.yourCollection')}</h2>
          <div className={styles.grid}>
            {gridTrips.map(trip => (
              <GridCard key={trip.id} trip={trip} onRename={onRename} onDuplicate={onDuplicate} onDelete={onDelete} />
            ))}
          </div>
        </>
      )}

      {showCreate && <CreateTripModal autoCreateCity={autoCreateCity} onClose={() => { setShowCreate(false); if (autoCreateCity) { searchParams.delete('autoCreate'); setSearchParams(searchParams, { replace: true }); } }} />}
      {showBackup && <BackupModal trips={trips} onClose={() => setShowBackup(false)} onImported={onRefetch} />}
    </div>
  );
}

function HeroCard({ trip, onRename, onDuplicate, onDelete }: { trip: TripRow, onRename: any, onDuplicate: any, onDelete: any }) {
  const { t } = useTranslation(['plan', 'common']);
  const [menuOpen, setMenuOpen] = useState(false);
  const bgImage = useCityImage(trip.city);
  const dday = getDDay(trip.start_date);

  function handleMenuClick(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation(); setMenuOpen(v => !v);
  }
  function handleRename(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation(); setMenuOpen(false);
    const next = window.prompt(t('tripCard.renamePrompt'), trip.title);
    if (next && next.trim()) onRename(trip.id, next.trim());
  }
  function handleDuplicate(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation(); setMenuOpen(false); onDuplicate(trip.id);
  }
  function handleDelete(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation(); setMenuOpen(false);
    if (window.confirm(t('tripCard.deleteConfirm', { title: trip.title }))) onDelete(trip.id);
  }

  return (
    <div style={{ position: 'relative' }}>
      <Link to={`/plan/${trip.id}`} className={styles.heroCard}>
        <div className={styles.heroImage} style={{ backgroundImage: `url('${bgImage}')` }}>
          {dday !== null && (
            <span className={styles.dday}>{dday === 0 ? 'D-DAY' : `D-${dday}`}</span>
          )}
        </div>
        <div className={styles.heroContent}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className={styles.heroTitle} style={{ marginBottom: 0 }}>{trip.title}</h3>
            <button type="button" aria-label="Menu" onClick={handleMenuClick} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 24, cursor: 'pointer', padding: '0 8px' }}>⋮</button>
          </div>
          <p className={styles.heroDates} style={{ marginTop: 8 }}>
            {trip.start_date && trip.end_date ? `${trip.start_date} ~ ${trip.end_date}` : t('tripCard.periodUndecided')}
          </p>
          <div className={styles.cardChips}>
            {trip.city && <span className={styles.chip}>{trip.city}</span>}
            <span className={styles.chip} style={{ background: 'var(--brand)', color: 'white' }}>{t('desktop.openLiveItinerary')}</span>
          </div>
        </div>
      </Link>
      {menuOpen && (
        <div style={{ position: 'absolute', top: 60, right: 24, background: 'var(--surface-card)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', zIndex: 10, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <button type="button" onClick={handleRename} style={{ padding: '12px 24px', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: 14 }}>{t('tripCard.rename')}</button>
          <button type="button" onClick={handleDuplicate} style={{ padding: '12px 24px', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: 14 }}>{t('tripCard.duplicate')}</button>
          <button type="button" onClick={handleDelete} style={{ padding: '12px 24px', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: 14, color: 'var(--color-danger)' }}>{t('action.delete', { ns: 'common' })}</button>
        </div>
      )}
    </div>
  );
}

function GridCard({ trip, onRename, onDuplicate, onDelete }: { trip: TripRow, onRename: any, onDuplicate: any, onDelete: any }) {
  const { t } = useTranslation(['plan', 'common']);
  const [menuOpen, setMenuOpen] = useState(false);
  const bgImage = useCityImage(trip.city);
  const dday = getDDay(trip.start_date);

  function handleMenuClick(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation(); setMenuOpen(v => !v);
  }
  function handleRename(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation(); setMenuOpen(false);
    const next = window.prompt(t('tripCard.renamePrompt'), trip.title);
    if (next && next.trim()) onRename(trip.id, next.trim());
  }
  function handleDuplicate(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation(); setMenuOpen(false); onDuplicate(trip.id);
  }
  function handleDelete(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation(); setMenuOpen(false);
    if (window.confirm(t('tripCard.deleteConfirm', { title: trip.title }))) onDelete(trip.id);
  }

  return (
    <div style={{ position: 'relative' }}>
      <Link to={`/plan/${trip.id}`} className={styles.card}>
        <div className={styles.cardImage} style={{ backgroundImage: `url('${bgImage}')` }}>
          {dday !== null && (
            <span className={styles.dday}>{dday === 0 ? 'D-DAY' : `D-${dday}`}</span>
          )}
        </div>
        <div className={styles.cardBody}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className={styles.cardTitle} style={{ marginBottom: 0 }}>{trip.title}</h3>
            <button type="button" aria-label="Menu" onClick={handleMenuClick} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer', padding: '0 4px' }}>⋮</button>
          </div>
          <p className={styles.cardDates} style={{ marginTop: 8 }}>
            {trip.start_date && trip.end_date ? `${trip.start_date} ~ ${trip.end_date}` : t('tripCard.periodUndecided')}
          </p>
          <div className={styles.cardChips}>
            {trip.city && <span className={styles.chip}>{trip.city}</span>}
          </div>
        </div>
      </Link>
      {menuOpen && (
        <div style={{ position: 'absolute', top: 160, right: 16, background: 'var(--surface-card)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', zIndex: 10, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <button type="button" onClick={handleRename} style={{ padding: '12px 24px', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: 14 }}>{t('tripCard.rename')}</button>
          <button type="button" onClick={handleDuplicate} style={{ padding: '12px 24px', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: 14 }}>{t('tripCard.duplicate')}</button>
          <button type="button" onClick={handleDelete} style={{ padding: '12px 24px', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: 14, color: 'var(--color-danger)' }}>{t('action.delete', { ns: 'common' })}</button>
        </div>
      )}
    </div>
  );
}
