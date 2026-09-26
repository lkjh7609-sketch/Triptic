import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { Plus, Calendar, Plane, Search, Filter, Sun, Navigation, Shield, Lightbulb, Download } from 'lucide-react';
import type { TripRow } from '@/shared/api/tripService';
import { useCityImage } from '@/shared/hooks/useCityImage';
import { getDDay } from './tripStatus';
import { CreateTripModal } from './CreateTripModal';
import styles from './PlanDesktop.module.css';

interface PlanDesktopProps {
  trips: TripRow[];
  ongoing: TripRow[];
  upcoming: TripRow[];
  past: TripRow[];
  onRefetch: () => void;
  onRename: (id: string, newTitle: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

export function PlanDesktop({ trips, ongoing, upcoming, past }: PlanDesktopProps) {
  useTranslation(['plan', 'common']);
  const [searchParams, setSearchParams] = useSearchParams();
  const autoCreateCity = searchParams.get('autoCreate');
  const [filter] = useState<'all' | 'active' | 'past'>('all');
  const [showCreate, setShowCreate] = useState(false);

  const activeTrips = ongoing.length + upcoming.length;

  let displayUpcoming: TripRow[] = [];
  let displayPast: TripRow[] = [];

  if (filter === 'all') {
    displayUpcoming = [...ongoing, ...upcoming];
    displayPast = past;
  } else if (filter === 'active') {
    displayUpcoming = [...ongoing, ...upcoming];
    displayPast = [];
  } else if (filter === 'past') {
    displayUpcoming = [];
    displayPast = past;
  }

  return (
    <main className={styles.container}>
      <section className={styles.headerSection}>
        <div className={styles.headerTop}>
          <div>
            <div className={styles.greetingBadge}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>verified</span>
              <span>Member Edition • Slow Curations</span>
            </div>
            <h1 className={styles.pageTitle}>Your Journeys & Field Notes</h1>
            <p className={styles.pageSubtitle}>
              Welcome back, Julian. Your autumn expedition departs in <span style={{ color: '#001428', fontWeight: 600, textDecoration: 'underline', textDecorationColor: '#ae3115', textUnderlineOffset: 4 }}>18 days</span>.
            </p>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.btnAi}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>auto_awesome</span>
              Start with AI Concierge
            </button>
            <button className={styles.btnCreate} onClick={() => setShowCreate(true)}>
              <Plus size={20} /> Create New Journey
            </button>
          </div>
        </div>

        <div className={styles.metricsBar}>
          <div className={styles.metricsLeft}>
            <div className={styles.metricBadge}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#fd6a49' }}></div>
              <div>
                <span className={styles.metricValue}>{activeTrips}</span>
                <span className={styles.metricLabel}>Active Journeys</span>
              </div>
            </div>
            <div className={styles.metricBadge}>
              <Calendar size={16} color="#74777e" />
              <div>
                <span className={styles.metricValue}>12</span>
                <span className={styles.metricLabel}>Curated Days</span>
              </div>
            </div>
          </div>
          <div className={styles.searchCapsule}>
            <Search size={20} color="#74777e" />
            <input className={styles.searchInput} placeholder="Search itinerary, place, tag..." type="text" />
            <div className={styles.searchDivider}></div>
            <button className={styles.filterBtn}>Season & Region <span className="material-symbols-outlined" style={{ fontSize: 16 }}>expand_more</span></button>
            <div className={styles.searchDivider}></div>
            <button className={styles.filterBtn}>Status: All <Filter size={16} /></button>
            <button className={styles.tuneBtn}><span className="material-symbols-outlined" style={{ fontSize: 18 }}>tune</span></button>
          </div>
        </div>
      </section>

      <div className={styles.pageLayout}>
        <div className={styles.mainColumn}>
          {displayUpcoming.length > 0 && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionTitleRow}>
                  <h2 className={styles.sectionTitle}>Upcoming & In-Progress</h2>
                  <span className={styles.sectionBadge}>{displayUpcoming.length} Active</span>
                </div>
                <a href="#calendar" className={styles.sectionLink}>
                  Route Calendar <Calendar size={16} />
                </a>
              </div>
              <div className={styles.compactGrid}>
                {displayUpcoming.map(trip => (
                  <CompactTripCard key={trip.id} trip={trip} />
                ))}
              </div>
            </section>
          )}

          {displayPast.length > 0 && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className={styles.tabsRow}>
                <div className={styles.tabsList}>
                  <button className={`${styles.tabBtn} ${styles.active}`}>All Journeys ({trips.length})</button>
                  <button className={styles.tabBtn}>Upcoming ({activeTrips})</button>
                  <button className={styles.tabBtn}>Past Expeditions ({past.length})</button>
                </div>
                <div className={styles.viewToggles}>
                  <button className={`${styles.viewToggle} ${styles.active}`}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>grid_view</span> Editorial</button>
                  <button className={styles.viewToggle}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>view_list</span> List</button>
                </div>
              </div>
              <div className={styles.pastGrid}>
                {displayPast.map(trip => (
                  <PastTripCard key={trip.id} trip={trip} />
                ))}
              </div>
            </section>
          )}

          {displayUpcoming.length === 0 && displayPast.length === 0 && (
            <div className={styles.emptyState}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#ffffff', border: '1px solid #e3e2df', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ae3115' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 22 }}>add_location_alt</span>
                </div>
                <div>
                  <h4 style={{ fontSize: 16, fontWeight: 600, color: '#001428', margin: '0 0 4px 0' }}>Begin a Blank Slate Itinerary</h4>
                  <p style={{ fontSize: 13, color: '#43474d', margin: 0 }}>Curate day-by-day routes, pin curated stays, and synchronize transport schedules.</p>
                </div>
              </div>
              <button className={styles.btnCreate} style={{ padding: '0.375rem 1rem', fontSize: 13 }} onClick={() => setShowCreate(true)}>
                Start Canvas
              </button>
            </div>
          )}
        </div>

        <aside className={styles.rightRail}>
          <div className={styles.toolkitWidget}>
            <div className={styles.toolkitHeader}>
              <div className={styles.toolkitTitleRow}>
                <span className="material-symbols-outlined" style={{ fontSize: 22, color: '#ae3115' }}>design_services</span>
                <h3 className={styles.toolkitTitle}>Curator’s Toolkit</h3>
              </div>
              <span className={styles.syncBadge}>Sync Active</span>
            </div>
            
            <div className={styles.toolkitBox}>
              <div className={styles.toolkitBoxHeader}>
                <span>Next Destination Climate</span>
                <span style={{ color: '#ae3115' }}>Kyoto, Japan</span>
              </div>
              <div className={styles.toolkitBoxContent}>
                <div className={styles.toolkitBoxLeft}>
                  <Sun size={32} color="#ae3115" />
                  <div>
                    <div className={styles.toolkitValue}>19°C</div>
                    <div className={styles.toolkitSub}>Mild Autumn Crisp</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: 12, color: '#74777e' }}>
                  <div>Precip: 10%</div>
                  <div>Foliage: Peak Amber</div>
                </div>
              </div>
            </div>

            <div className={styles.toolkitAlert}>
              <Plane size={22} color="#ae3115" style={{ marginTop: 2 }} />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 16, fontWeight: 600, color: '#8c1900' }}>ANA NH0846</span>
                  <span style={{ padding: '2px 8px', borderRadius: 9999, background: '#ae3115', color: '#ffffff', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>On Time</span>
                </div>
                <p style={{ fontSize: 12, color: '#8c1900', margin: 0 }}>
                  Departing SFO → HND in 18 days. Seat 2A & 2B confirmed. Automated boarding alerts synced.
                </p>
              </div>
            </div>

            <div className={styles.toolkitLink}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div className={styles.toolkitLinkIcon}>
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>menu_book</span>
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#001428' }}>Printable Pocket Guide</div>
                  <div style={{ fontSize: 12, color: '#74777e' }}>Export tailored PDF folio with maps</div>
                </div>
              </div>
              <Download size={18} color="#74777e" />
            </div>

            <div style={{ paddingTop: '0.5rem', borderTop: '1px solid #e3e2df', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h4 style={{ fontSize: 16, fontWeight: 600, color: '#001428', margin: 0 }}>Co-Curators</h4>
                <button style={{ background: 'none', border: 'none', color: '#ae3115', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer' }}><Plus size={14} /> Invite New</button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem', borderRadius: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#0f2942', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>JC</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#001428' }}>Julian Cole (You)</div>
                    <div style={{ fontSize: 11, color: '#74777e' }}>Primary Curator • Full Access</div>
                  </div>
                </div>
                <Shield size={16} color="#74777e" />
              </div>
            </div>
            
            <div style={{ background: '#efeeeb', padding: '1rem', borderRadius: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: '#ae3115', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <Lightbulb size={16} /> Curator Note
              </div>
              <p style={{ fontSize: 12, color: '#43474d', fontStyle: 'italic', margin: 0 }}>
                "Leave at least two mornings per week unscripted. The most memorable encounters happen when the itinerary is temporarily folded."
              </p>
            </div>
          </div>
        </aside>
      </div>

      {(showCreate || autoCreateCity) && (
        <CreateTripModal
          autoCreateCity={autoCreateCity}
          onClose={() => {
            setShowCreate(false);
            if (autoCreateCity) {
              searchParams.delete('autoCreate');
              setSearchParams(searchParams, { replace: true });
            }
          }}
        />
      )}
    </main>
  );
}

function CompactTripCard({ trip }: { trip: TripRow }) {
  const bgImage = useCityImage(trip.city);
  const dday = getDDay(trip.start_date);
  const progress = trip.status === 'ongoing' ? 90 : 44;

  return (
    <Link to={`/plan/${trip.id}`} className={styles.compactCard}>
      <div className={styles.cardTop}>
        <div className={styles.cardImageWrap}>
          <img src={bgImage} className={styles.cardImage} alt={trip.title} />
          {dday !== null && (
            <span className={styles.dateBadge}>{dday === 0 ? 'D-DAY' : (dday < 30 ? `In ${dday}D` : 'Upcoming')}</span>
          )}
        </div>
        <div className={styles.cardInfo}>
          <div className={styles.cardStatusRow}>
            <div className={styles.statusIndicator}>
              <div className={styles.statusDot} style={{ background: trip.status === 'ongoing' ? '#10b981' : '#fd6a49' }}></div>
              <span style={{ color: trip.status === 'ongoing' ? '#74777e' : '#ae3115' }}>
                {trip.status === 'ongoing' ? 'In Progress' : 'Drafting'} · {trip.total_days || 0}D
              </span>
            </div>
            <span className={styles.travelersBadge}>2 Travelers</span>
          </div>
          <h3 className={styles.cardTitle}>{trip.title}</h3>
          <p className={styles.cardDesc}>Curated journey through {trip.city || 'multiple destinations'}.</p>
          <div className={styles.cardRoute}>
            <Navigation size={14} color="#ae3115" /> {trip.city || 'Unknown Location'}
          </div>
        </div>
      </div>

      <div className={styles.cardProgressArea}>
        <div className={styles.progressRow}>
          <span style={{ color: '#43474d' }}>Itinerary Completeness</span>
          <span style={{ color: '#001428', fontWeight: 700 }}>{progress}% Planned</span>
        </div>
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${progress}%`, background: trip.status === 'ongoing' ? '#fd6a49' : '#ae3115' }}></div>
        </div>
        <div className={styles.logisticsChips}>
          <span className={styles.logisticsChip}><span className="material-symbols-outlined" style={{ fontSize: 13, color: '#ae3115' }}>hotel</span> Hotel</span>
          <span className={styles.logisticsChip}><span className="material-symbols-outlined" style={{ fontSize: 13, color: '#ae3115' }}>flight_takeoff</span> Flight</span>
          <span className={styles.logisticsChip}><span className="material-symbols-outlined" style={{ fontSize: 13, color: '#ae3115' }}>train</span> Transport</span>
        </div>
      </div>

      <div className={styles.cardBottom}>
        <div className={styles.avatars}>
          <div className={styles.avatar} style={{ background: '#0f2942', color: '#ffffff' }}>JC</div>
          <div className={styles.avatar} style={{ background: '#e3e2df', color: '#43474d' }}>ES</div>
        </div>
        <div className={styles.btnOpen} style={{ background: trip.status === 'ongoing' ? '#0f2942' : 'transparent', color: trip.status === 'ongoing' ? '#ffffff' : '#001428', border: trip.status === 'ongoing' ? 'none' : '1px solid #c3c6ce' }}>
          Open Itinerary <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_forward</span>
        </div>
      </div>
    </Link>
  );
}

function PastTripCard({ trip }: { trip: TripRow }) {
  const bgImage = useCityImage(trip.city);
  return (
    <Link to={`/plan/${trip.id}`} className={styles.pastCard}>
      <div className={styles.pastImageWrap}>
        <img src={bgImage} className={styles.pastImage} alt={trip.title} />
        <div style={{ position: 'absolute', top: 10, left: 10, padding: '2px 8px', borderRadius: 9999, fontSize: 11, background: 'rgba(0, 20, 40, 0.7)', backdropFilter: 'blur(12px)', color: '#ffffff' }}>
          Completed · {trip.total_days || 0} Days
        </div>
      </div>
      <div className={styles.pastBody}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: '#74777e', textTransform: 'uppercase', marginBottom: 4 }}>
            <span>{trip.city || 'Unknown Location'}</span>
            <span>Confirmed</span>
          </div>
          <h4 style={{ fontFamily: 'Newsreader', fontSize: 18, color: '#001428', margin: '0 0 4px 0' }}>{trip.title}</h4>
          <p style={{ fontSize: 13, color: '#43474d', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Recorded field notes and complete itineraries from past expeditions.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 10, borderTop: '1px solid #e3e2df' }}>
          <div style={{ fontSize: 12, color: '#43474d', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#ae3115' }}>near_me</span> Total Track
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#ae3115', display: 'flex', alignItems: 'center' }}>
            Inspect <span className="material-symbols-outlined" style={{ fontSize: 15 }}>chevron_right</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
