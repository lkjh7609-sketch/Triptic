import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Check, ExternalLink, ListChecks } from 'lucide-react';
import { tripService, type TripRow } from '@/shared/api/tripService';
import { AFFILIATE_LINKS } from '@/shared/config';
import { openFlightsSearchForTrip, useTripFlightsLink } from './flightsSearchLink';
import { usePartnerLandingLink } from './partnerLinks';
import type { FlightsData } from './types';
import styles from './PlanDesktop.module.css';

type ItemKey = 'flights' | 'hotel' | 'esim' | 'insurance' | 'passport' | 'money';

function storageKey(tripId: string) {
  return `triptic.checklist.${tripId}`;
}

/** 직접 체크한 항목은 이 기기에만 저장(여행별) — 저장이 막힌 환경에서도 화면은 동작한다 */
function readChecked(tripId: string): ItemKey[] {
  try {
    const raw = localStorage.getItem(storageKey(tripId));
    return raw ? (JSON.parse(raw) as ItemKey[]) : [];
  } catch {
    return [];
  }
}

function writeChecked(tripId: string, keys: ItemKey[]) {
  try {
    localStorage.setItem(storageKey(tripId), JSON.stringify(keys));
  } catch {
    // 프라이빗 모드 등 — 이번 화면에서만 기억
  }
}

/**
 * 출발 전 체크리스트(다음 여행). 항공권·숙소는 일정에 들어가 있으면 자동 완료,
 * eSIM·보험은 제휴 링크, 여권·환전은 직접 체크.
 */
export function DepartureChecklist({ trip }: { trip: TripRow }) {
  const { t, i18n } = useTranslation('plan');
  const [checked, setChecked] = useState<ItemKey[]>(() => readChecked(trip.id));
  const [findingFlights, setFindingFlights] = useState(false);
  const esimUrl = usePartnerLandingLink('yesim', AFFILIATE_LINKS.esimFallback);

  const project = tripService.toLocalProject(trip);
  const flights = (project.flights ?? { outbound: null, return: null }) as FlightsData;
  const auto: Partial<Record<ItemKey, boolean>> = {
    flights: !!flights.outbound,
    hotel: Object.keys((project.hotels ?? {}) as Record<string, unknown>).length > 0,
  };
  // 항공권이 아직 없을 때만 마이리얼트립 결과 링크를 미리 받아 둔다(누르면 바로 열리게)
  const prefetchedFlights = useTripFlightsLink(trip, i18n.language, !auto.flights);

  function toggle(key: ItemKey) {
    setChecked((cur) => {
      const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
      writeChecked(trip.id, next);
      return next;
    });
  }

  const items: { key: ItemKey; action?: ReactNode }[] = [
    {
      key: 'flights',
      action: (
        <button
          type="button"
          className={styles.checklistAction}
          disabled={findingFlights}
          onClick={() => {
            setFindingFlights(true);
            void openFlightsSearchForTrip(trip, i18n.language, prefetchedFlights).finally(() => setFindingFlights(false));
          }}
        >
          {t('desktop.checklist.find')}
        </button>
      ),
    },
    { key: 'hotel', action: <Link to="/hotels" className={styles.checklistAction}>{t('desktop.checklist.find')}</Link> },
    {
      key: 'esim',
      action: (
        <a href={esimUrl} target="_blank" rel="sponsored noopener" className={styles.checklistAction}>
          {t('desktop.checklist.view')} <ExternalLink size={12} aria-hidden="true" />
        </a>
      ),
    },
    {
      key: 'insurance',
      action: AFFILIATE_LINKS.insurance ? (
        <a href={AFFILIATE_LINKS.insurance} target="_blank" rel="sponsored noopener" className={styles.checklistAction}>
          {t('desktop.checklist.view')} <ExternalLink size={12} aria-hidden="true" />
        </a>
      ) : undefined,
    },
    { key: 'passport' },
    { key: 'money' },
  ];

  return (
    <div className={styles.checklistBlock}>
      <h4 className={styles.membersTitle}>
        <ListChecks size={16} aria-hidden="true" /> {t('desktop.checklist.title')}
      </h4>
      <ul className={styles.checklist}>
        {items.map(({ key, action }) => {
          const isAuto = auto[key] === true;
          const done = isAuto || checked.includes(key);
          return (
            <li key={key} className={styles.checklistRow}>
              <label className={styles.checklistLabel}>
                <input
                  type="checkbox"
                  className={styles.checklistInput}
                  checked={done}
                  disabled={isAuto}
                  onChange={() => toggle(key)}
                />
                <span className={done ? styles.checklistBoxDone : styles.checklistBox} aria-hidden="true">
                  {done ? <Check size={12} /> : null}
                </span>
                <span className={done ? styles.checklistTextDone : undefined}>{t(`desktop.checklist.${key}`)}</span>
              </label>
              {!done && action ? action : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
