import { useTranslation } from 'react-i18next';
import { Briefcase, Globe2, Calendar, MapPin, Navigation2, Users } from 'lucide-react';
import type { TravelStats } from './useHomeStats';
import styles from './StatsTiles.module.css';

interface StatsTilesProps {
  stats: TravelStats;
}

export function StatsTiles({ stats }: StatsTilesProps) {
  const { t } = useTranslation('home');
  return (
    <div className={styles.grid}>
      <Tile icon={<Briefcase size={20} />} value={stats.tripCount} label={t('tile.trips')} />
      <Tile icon={<Globe2 size={20} />} value={stats.countryCount} label={t('tile.countries')} />
      <Tile icon={<Calendar size={20} />} value={stats.dayCount} label={t('tile.days')} />
      <Tile icon={<MapPin size={20} />} value={stats.cityCount} label={t('tile.cities')} />
      <Tile icon={<Navigation2 size={20} />} value={stats.placeCount} label={t('tile.places')} />
      <Tile icon={<Users size={20} />} value={stats.companionCount ?? 0} label={t('tile.companions')} />
    </div>
  );
}

function Tile({ icon, value, label }: { icon: React.ReactNode, value: number | string; label: string }) {
  return (
    <div className={styles.tile}>
      <div className={styles.iconWrap}>{icon}</div>
      <div className={styles.infoWrap}>
        <span className={styles.value}>{typeof value === 'number' ? value.toLocaleString() : value}</span>
        <span className={styles.label}>{label}</span>
      </div>
    </div>
  );
}
