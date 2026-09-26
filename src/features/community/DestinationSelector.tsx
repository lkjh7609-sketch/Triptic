import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import type { Destination } from './types';
import { useTranslation } from 'react-i18next';


const CONTINENT_KEYS = ['AS', 'EU', 'AM_OC'];
const COUNTRY_KEYS: Record<string, string[]> = {
  AS: ['KR', 'JP', 'VN', 'TH', 'PH', 'MY', 'SG', 'ID', 'TW', 'HK', 'MO', 'CN'],
  EU: ['FR', 'GB', 'IT', 'ES', 'CZ', 'AT', 'CH', 'NL', 'PT', 'TR'],
  AM_OC: ['US', 'CA', 'AU']
};

interface DestinationSelectorProps {
  searchElement?: React.ReactNode;
  destinations: Destination[];
  /** 있으면 도시 클릭 시 이 콜백만 호출하고 navigate하지 않는다(동행찾기 목록 필터용) */
  onCitySelect?: (city: Destination) => void;
  /** onCitySelect와 같이 써서 현재 필터 중인 도시를 강조 표시한다 */
  selectedDestinationId?: string | null;
}

export function DestinationSelector({
  destinations,
  searchElement,
  onCitySelect,
  selectedDestinationId,
}: DestinationSelectorProps) {
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
    <div className="flex flex-col gap-3 w-full">
      
      <div className="flex flex-col lg:flex-row items-center justify-between gap-4 w-full">
        <div className="flex items-center gap-2 overflow-x-auto w-full pb-1 no-scrollbar justify-start">

        {CONTINENT_KEYS.map((key) => (
          <button 
            key={key} 
            className={`px-4 py-1.5 rounded-full font-label-md text-label-md transition-all shrink-0 border ${continent === key ? 'bg-primary text-on-primary border-primary shadow-sm' : 'bg-surface-container-lowest hover:bg-surface-container border-outline-variant/50 text-on-surface-variant'}`}
            onClick={() => { setContinent(key); setCountry(null); }}
          >
            {t(`continent.${key}.name`)}
          </button>
        ))}
      
        </div>
        {searchElement && (
          <div className="w-full lg:w-auto shrink-0">
            {searchElement}
          </div>
        )}
      </div>

      {continent && availableCountries.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto w-full pb-1 no-scrollbar justify-start">
          {availableCountries.map(code => (
            <button 
              key={code} 
              className={`px-4 py-1.5 rounded-full font-label-md text-label-md transition-all shrink-0 border ${country === code ? 'bg-primary text-on-primary border-primary shadow-sm' : 'bg-surface-container-lowest hover:bg-surface-container border-outline-variant/50 text-on-surface-variant'}`}
              onClick={() => setCountry(code)}
            >
              {t(`continent.${continent}.countries.${code}`)}
            </button>
          ))}
        </div>
      )}

      {country && availableCities.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto w-full pb-1 no-scrollbar justify-start">
          {availableCities.map(city => (
            <button
              key={city.id}
              className={`px-4 py-1.5 rounded-full font-label-md text-label-md transition-all shrink-0 border ${selectedDestinationId === city.id ? 'bg-primary text-on-primary border-primary shadow-sm' : 'bg-surface-container-low hover:bg-surface-container-high border-outline-variant/50 text-primary'}`}
              onClick={() => (onCitySelect ? onCitySelect(city) : navigate(`/community/d/${city.slug}`))}
            >
              {city.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
