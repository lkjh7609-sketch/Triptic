import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import type { Destination } from './types';
import { useTranslation } from 'react-i18next';
import styles from './DestinationSelector.module.css';

const CONTINENT_KEYS = ['AS', 'EU', 'AM_OC'];
const COUNTRY_KEYS: Record<string, string[]> = {
  AS: ['KR', 'JP', 'VN', 'TH', 'PH', 'MY', 'SG', 'ID', 'TW', 'HK', 'MO', 'CN'],
  EU: ['FR', 'GB', 'IT', 'ES', 'CZ', 'AT', 'CH', 'NL', 'PT', 'TR'],
  AM_OC: ['US', 'CA', 'AU']
};

interface DestinationSelectorProps {
  destinations: Destination[];
}

export function DestinationSelector({ destinations }: DestinationSelectorProps) {
  const { t } = useTranslation('community');
  const navigate = useNavigate();
  const [continent, setContinent] = useState<string | null>(null);
  const [country, setCountry] = useState<string | null>(null);

  const availableCountries = useMemo(() => {
    if (!continent) return [];
    const codes = COUNTRY_KEYS[continent] || [];
    return codes.filter(c => destinations.some(d => d.country_code === c));
  }, [continent, destinations]);

  const availableCities = useMemo(() => {
    if (!country) return [];
    if (country === 'US') {
      return destinations.filter(d => ['US', 'GU', 'MP'].includes(d.country_code));
    }
    return destinations.filter(d => d.country_code === country);
  }, [country, destinations]);

  return (
    <div className={styles.container}>
      
      <div className={styles.row}>
        {CONTINENT_KEYS.map((key) => (
          <button 
            key={key} 
            className={`${styles.chip} ${continent === key ? styles.active : ''}`}
            onClick={() => { setContinent(key); setCountry(null); }}
          >
            {t(`continent.${key}.name`)}
          </button>
        ))}
      </div>

      {continent && availableCountries.length > 0 && (
        <div className={styles.row}>
          {availableCountries.map(code => (
            <button 
              key={code} 
              className={`${styles.chip} ${styles.chipCountry} ${country === code ? styles.active : ''}`}
              onClick={() => setCountry(code)}
            >
              {t(`continent.${continent}.countries.${code}`)}
            </button>
          ))}
        </div>
      )}

      {country && availableCities.length > 0 && (
        <div className={styles.row}>
          {availableCities.map(city => (
            <button 
              key={city.id} 
              className={`${styles.chip} ${styles.chipCity}`}
              onClick={() => navigate(`/community/d/${city.slug}`)}
            >
              {city.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
