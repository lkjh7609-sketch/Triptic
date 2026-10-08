import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Check, ChevronLeft, ChevronRight, ExternalLink, ListChecks, Luggage, Plane, TriangleAlert } from 'lucide-react';
import { tripService, type TripRow } from '@/shared/api/tripService';
import { AFFILIATE_LINKS } from '@/shared/config';
import { openFlightsSearchForTrip } from './flightsSearchLink';
import {
  CHECKLIST_PAGES,
  FINAL_CABIN,
  FINAL_CHECKED,
  firstIncompletePage,
  isPageComplete,
  migrateChecked,
  type Carry,
  type ChecklistItem,
  type ItemKey,
} from './checklistData';
import type { FlightsData } from './types';
import styles from './PlanDesktop.module.css';
import own from './DepartureChecklist.module.css';

/** 한 페이지를 다 체크한 뒤 다음 페이지로 넘어가기까지 — 체크 표시가 잠깐 보이게 */
const AUTO_ADVANCE_MS = 700;

function storageKey(tripId: string) {
  return `triptic.checklist.${tripId}`;
}

function ackKey(tripId: string) {
  return `triptic.checklist.${tripId}.ack`;
}

/** 직접 체크한 항목은 이 기기에만 저장(여행별) — 저장이 막힌 환경에서도 화면은 동작한다 */
function readChecked(tripId: string): ItemKey[] {
  try {
    const raw = localStorage.getItem(storageKey(tripId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? migrateChecked(parsed.filter((k): k is string => typeof k === 'string')) : [];
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

function readAck(tripId: string): boolean {
  try {
    return localStorage.getItem(ackKey(tripId)) === '1';
  } catch {
    return false;
  }
}

function writeAck(tripId: string, value: boolean) {
  try {
    if (value) localStorage.setItem(ackKey(tripId), '1');
    else localStorage.removeItem(ackKey(tripId));
  } catch {
    // 저장이 막혀도 이번 화면에서는 그대로
  }
}

function CarryTag({ carry }: { carry: Carry }) {
  const { t } = useTranslation('plan');
  const Icon = carry === 'cabin' ? Plane : Luggage;
  return (
    <span className={carry === 'cabin' ? own.tagCabin : own.tagChecked}>
      <Icon size={12} aria-hidden="true" />
      {t(`desktop.checklist.carry.${carry}`)}
    </span>
  );
}

/**
 * 출발 전 체크리스트(다음 여행) — 4페이지(1/4 … 4/4)로 나눠 한 페이지씩 챙긴다. 한 페이지를 다 체크하면 잠깐 뒤 다음 페이지로 넘어가고
 * 이전·다음 버튼으로 언제든 오갈 수 있다. 선택 항목(꿀템)은 체크하지 않아도 마칠 수 있다. 4/4까지 마치면 기내/위탁 "마지막 확인" 카드가 나온다.
 * 항공권·숙소는 일정에 들어가 있으면 자동 완료, eSIM·여행자보험은 제휴 링크, 나머지는 직접 체크.
 */
export function DepartureChecklist({ trip }: { trip: TripRow }) {
  const { t } = useTranslation('plan');
  const [checked, setChecked] = useState<ItemKey[]>(() => readChecked(trip.id));
  const [acknowledged, setAcknowledged] = useState(() => readAck(trip.id));
  const [findingFlights, setFindingFlights] = useState(false);

  const project = tripService.toLocalProject(trip);
  const flights = (project.flights ?? { outbound: null, return: null }) as FlightsData;
  const auto: Partial<Record<ItemKey, boolean>> = {
    flights: !!flights.outbound,
    hotel: Object.keys((project.hotels ?? {}) as Record<string, unknown>).length > 0,
  };
  const isDone = (key: ItemKey) => auto[key] === true || checked.includes(key);

  // 처음엔 아직 안 마친 첫 페이지부터
  const [pageIndex, setPageIndex] = useState(() => {
    const initial = readChecked(trip.id);
    return firstIncompletePage((key) => initial.includes(key));
  });
  const lastIndex = CHECKLIST_PAGES.length - 1;
  const page = CHECKLIST_PAGES[pageIndex];
  const pageComplete = isPageComplete(page, isDone);

  const advanceTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(advanceTimer.current), []);

  function goTo(index: number) {
    window.clearTimeout(advanceTimer.current);
    setPageIndex(Math.min(Math.max(index, 0), lastIndex));
  }

  function toggle(key: ItemKey) {
    const next = checked.includes(key) ? checked.filter((k) => k !== key) : [...checked, key];
    setChecked(next);
    writeChecked(trip.id, next);
    // 이 체크로 이 페이지를 막 마쳤으면 잠깐 뒤 다음 페이지로(마지막 페이지는 마지막 확인 카드가 나온다)
    window.clearTimeout(advanceTimer.current);
    const nowDone = (k: ItemKey) => auto[k] === true || next.includes(k);
    if (!pageComplete && isPageComplete(page, nowDone) && pageIndex < lastIndex) {
      advanceTimer.current = window.setTimeout(() => setPageIndex((i) => Math.min(i + 1, lastIndex)), AUTO_ADVANCE_MS);
    }
  }

  function setAck(value: boolean) {
    setAcknowledged(value);
    writeAck(trip.id, value);
  }

  function actionFor(item: ChecklistItem): ReactNode {
    switch (item.link) {
      case 'flights':
        return (
          <button
            type="button"
            className={styles.checklistAction}
            disabled={findingFlights}
            onClick={() => {
              setFindingFlights(true);
              void openFlightsSearchForTrip(trip).finally(() => setFindingFlights(false));
            }}
          >
            {t('desktop.checklist.find')}
          </button>
        );
      case 'hotel':
        return (
          <Link to="/hotels" className={styles.checklistAction}>
            {t('desktop.checklist.find')}
          </Link>
        );
      case 'insurance':
        return AFFILIATE_LINKS.insurance ? (
          <a href={AFFILIATE_LINKS.insurance} target="_blank" rel="sponsored noopener" className={styles.checklistAction}>
            {t('desktop.checklist.view')} <ExternalLink size={12} aria-hidden="true" />
          </a>
        ) : null;
      default:
        return null;
    }
  }

  return (
    <div className={styles.checklistBlock}>
      <div className={own.header}>
        <h4 className={styles.membersTitle}>
          <ListChecks size={16} aria-hidden="true" /> {t('desktop.checklist.title')}
        </h4>
        <span className={own.counter} aria-live="polite">
          {t('desktop.checklist.nav.page', { page: pageIndex + 1, total: CHECKLIST_PAGES.length })}
        </span>
      </div>

      <ol className={own.steps} aria-label={t('desktop.checklist.nav.label')}>
        {CHECKLIST_PAGES.map((p, i) => {
          const done = isPageComplete(p, isDone);
          return (
            <li key={p.key}>
              <button
                type="button"
                className={`${own.step} ${i === pageIndex ? own.stepCurrent : done ? own.stepDone : ''}`}
                aria-current={i === pageIndex ? 'step' : undefined}
                aria-label={done ? t('desktop.checklist.nav.pageDone', { page: i + 1 }) : t('desktop.checklist.nav.pageCurrent', { page: i + 1 })}
                onClick={() => goTo(i)}
              />
            </li>
          );
        })}
      </ol>

      <h5 className={own.pageTitle}>{t(`desktop.checklist.pages.${page.key}`)}</h5>

      {page.groups.map((group) => (
        <section key={group.key} className={own.group}>
          <div className={own.groupHead}>
            <span className={own.groupTitle}>{t(`desktop.checklist.groups.${group.key}`)}</span>
            {group.optional ? <span className={own.optionalBadge}>{t('desktop.checklist.optional')}</span> : null}
          </div>
          {group.noNote ? null : <p className={own.groupNote}>{t(`desktop.checklist.groupNotes.${group.key}`)}</p>}
          <ul className={styles.checklist}>
            {group.items.map((item) => {
              const isAuto = auto[item.key] === true;
              const done = isDone(item.key);
              const action = !done ? actionFor(item) : null;
              return (
                <li key={item.key} className={styles.checklistRow}>
                  <label className={styles.checklistLabel}>
                    <input type="checkbox" className={styles.checklistInput} checked={done} disabled={isAuto} onChange={() => toggle(item.key)} />
                    <span className={done ? styles.checklistBoxDone : styles.checklistBox} aria-hidden="true">
                      {done ? <Check size={12} /> : null}
                    </span>
                    <span className={done ? styles.checklistTextDone : own.itemText}>{t(`desktop.checklist.items.${item.key}`)}</span>
                    {item.carry ? <CarryTag carry={item.carry} /> : null}
                  </label>
                  {action}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <div className={own.nav}>
        <button type="button" className={own.navButton} disabled={pageIndex === 0} onClick={() => goTo(pageIndex - 1)}>
          <ChevronLeft size={14} aria-hidden="true" /> {t('desktop.checklist.nav.prev')}
        </button>
        {pageIndex < lastIndex ? (
          <button type="button" className={pageComplete ? own.navNextReady : own.navButton} onClick={() => goTo(pageIndex + 1)}>
            {t('desktop.checklist.nav.next')} <ChevronRight size={14} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {pageIndex === lastIndex && pageComplete ? (
        <section className={acknowledged ? own.finalDone : own.final} aria-labelledby="checklist-final-title">
          <h5 id="checklist-final-title" className={own.finalTitle}>
            {acknowledged ? <Check size={16} aria-hidden="true" /> : <TriangleAlert size={16} aria-hidden="true" />}
            {acknowledged ? t('desktop.checklist.final.confirmed') : t('desktop.checklist.final.title')}
          </h5>
          {acknowledged ? null : (
            <>
              <p className={own.finalIntro}>{t('desktop.checklist.final.intro')}</p>
              <div className={own.finalBlock}>
                <strong className={own.finalHeading}>
                  <Plane size={14} aria-hidden="true" /> {t('desktop.checklist.final.cabinTitle')}
                </strong>
                <ul className={own.finalList}>
                  {FINAL_CABIN.map((key) => (
                    <li key={key}>{t(`desktop.checklist.final.cabin.${key}`)}</li>
                  ))}
                </ul>
              </div>
              <div className={own.finalBlock}>
                <strong className={own.finalHeading}>
                  <Luggage size={14} aria-hidden="true" /> {t('desktop.checklist.final.checkedTitle')}
                </strong>
                <ul className={own.finalList}>
                  {FINAL_CHECKED.map((key) => (
                    <li key={key}>{t(`desktop.checklist.final.checked.${key}`)}</li>
                  ))}
                </ul>
              </div>
              <div className={own.finalBlock}>
                <strong className={own.finalHeading}>{t('desktop.checklist.final.liquidsTitle')}</strong>
                <p className={own.finalText}>{t('desktop.checklist.final.liquids')}</p>
              </div>
            </>
          )}
          <button type="button" className={acknowledged ? own.finalUndo : own.finalConfirm} onClick={() => setAck(!acknowledged)}>
            {acknowledged ? t('desktop.checklist.final.undo') : t('desktop.checklist.final.confirm')}
          </button>
        </section>
      ) : null}
    </div>
  );
}
