import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronLeft, ChevronRight, Clock, MapPin, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import {
  PICKER_TABS,
  filterDestinations,
  groupBySubregion,
  isGroupedTab,
  forgetRecentDestination,
  readRecentDestinationIds,
  rememberDestination,
  type PickerTab,
} from './destinationRegions';
import type { Destination } from './types';
import styles from './DestinationPickerModal.module.css';
import { coverThumbUrl } from './coverThumb';

interface DestinationPickerModalProps {
  destinations: Destination[];
  /** 지금 골라 둔 도시 id — 처음 선택 상태로 보인다 */
  selectedId: string | null;
  /** "선택 완료"를 눌렀을 때 */
  onConfirm: (destination: Destination) => void;
  onClose: () => void;
  /** 있으면 위쪽 줄에 "어디든 상관없어요" 버튼이 생긴다 — 누르면 여행지를 비우고 닫는다(동행 글처럼 여행지가 선택 사항일 때) */
  onClear?: () => void;
  /** 처음 열 때 보여 줄 지역 탭 — 없으면 '전체' */
  initialTab?: PickerTab;
}

const CLOSE_MS = 200;

/**
 * 여행지 선택 창 — PC는 가운데 모달, 모바일은 같은 내용의 하단 시트(CSS). Companions 시안 구조:
 * 검색창 → 최근 선택 칩 → 지역 탭 → 도시 카드(2열) → 하단 "선택 현황 + 닫기 / 선택 완료".
 * 카드를 누르면 임시로 고르고, "선택 완료"를 눌러야 반영된다. 바깥(어두운 배경)을 눌러도 닫히지 않는다 — 닫기 버튼·Esc로만 닫는다.
 */
export function DestinationPickerModal({ destinations, selectedId, onConfirm, onClose, onClear, initialTab }: DestinationPickerModalProps) {
  const { t, i18n } = useTranslation('community');
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<number | undefined>(undefined);
  const [tab, setTab] = useState<PickerTab>(initialTab ?? 'all');
  const [query, setQuery] = useState('');
  // 아시아·유럽·미주·기타 탭에서 고른 하위 지역(없으면 하위 지역 카드를 보여 준다)
  const [region, setRegion] = useState<string | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(selectedId);
  const [recentIds, setRecentIds] = useState<string[]>(() => readRecentDestinationIds());

  const regionNames = useMemo(() => {
    try {
      return new Intl.DisplayNames([i18n.language], { type: 'region' });
    } catch {
      return null;
    }
  }, [i18n.language]);
  const countryName = (code: string) => regionNames?.of(code) ?? code;

  const byId = useMemo(() => new Map(destinations.map((d) => [d.id, d])), [destinations]);
  const results = useMemo(
    () => filterDestinations(destinations, { tab, query, countryName }),
    // countryName은 regionNames에서만 바뀐다
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [destinations, tab, query, regionNames],
  );
  const grouped = isGroupedTab(tab) && !query.trim();
  const groups = useMemo(() => (isGroupedTab(tab) ? groupBySubregion(destinations, tab) : []), [destinations, tab]);
  const regionCities = grouped && region ? (groups.find((g) => g.key === region)?.destinations ?? []) : null;
  const picked = pickedId ? byId.get(pickedId) : undefined;
  const recent = recentIds.map((id) => byId.get(id)).filter((d): d is Destination => !!d);

  /** 사라지는 애니메이션을 틀고 닫는다 */
  function requestClose(after?: () => void) {
    if (closing) return;
    setClosing(true);
    closeTimer.current = window.setTimeout(() => {
      after?.();
      onClose();
    }, CLOSE_MS);
  }

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  const trapRef = useFocusTrap<HTMLDivElement>(() => requestClose());

  function handleConfirm() {
    if (!picked) return;
    setRecentIds(rememberDestination(picked.id));
    requestClose(() => onConfirm(picked));
  }

  function selectTab(key: PickerTab) {
    setTab(key);
    setRegion(null);
  }

  const listTitle = query.trim()
    ? t('picker.searchResults')
    : regionCities
      ? t(`picker.regions.${region}`)
      : grouped
        ? t('picker.chooseRegion', { tab: t(`picker.tabs.${tab}`) })
        : tab === 'all'
          ? t('picker.popular')
          : t('picker.tabResults', { tab: t(`picker.tabs.${tab}`) });
  const shown = regionCities ?? results;
  const showCards = grouped && !region;

  return createPortal(
    <div className={`${styles.overlay} ${closing ? styles.overlayOut : ''}`}>
      <div
        ref={trapRef}
        className={`${styles.panel} ${closing ? styles.panelOut : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="destination-picker-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.handle} aria-hidden="true" />
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <span className={styles.headerIcon}>
              <MapPin size={18} aria-hidden="true" />
            </span>
            <h2 id="destination-picker-title" className={styles.title}>
              {t('picker.title')}
            </h2>
          </div>
          <div className={styles.headerActions}>
            {onClear ? (
              <button type="button" className={styles.anyBtn} onClick={() => requestClose(onClear)}>
                {t('picker.any')}
              </button>
            ) : null}
            <button type="button" className={styles.iconBtn} onClick={() => requestClose()} aria-label={t('picker.close')}>
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className={styles.searchArea}>
          <div className={styles.search}>
            <Search size={18} aria-hidden="true" className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('picker.searchPlaceholder')}
              aria-label={t('picker.searchPlaceholder')}
            />
            {query ? (
              <button type="button" className={styles.clear} onClick={() => setQuery('')} aria-label={t('picker.clearSearch')}>
                <X size={16} aria-hidden="true" />
              </button>
            ) : null}
          </div>

          {recent.length > 0 ? (
            <div className={styles.recent}>
              <span className={styles.recentLabel}>
                <Clock size={14} aria-hidden="true" />
                {t('picker.recent')}
              </span>
              <div className={styles.recentChips}>
                {recent.map((d) => (
                  <span key={d.id} className={styles.recentChip}>
                    <button type="button" className={styles.recentPick} onClick={() => setPickedId(d.id)}>
                      #{d.name}
                    </button>
                    <button
                      type="button"
                      className={styles.recentRemove}
                      onClick={() => setRecentIds(forgetRecentDestination(d.id))}
                      aria-label={t('picker.removeRecent', { name: d.name })}
                    >
                      <X size={12} aria-hidden="true" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className={styles.tabs} role="tablist" aria-label={t('picker.tabsLabel')}>
          {PICKER_TABS.map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={`${styles.tab} ${tab === key ? styles.tabOn : ''}`}
              onClick={() => selectTab(key)}
            >
              {t(`picker.tabs.${key}`)}
            </button>
          ))}
        </div>

        <div className={styles.listArea}>
          {regionCities ? (
            <button type="button" className={styles.back} onClick={() => setRegion(null)}>
              <ChevronLeft size={16} aria-hidden="true" />
              {t('picker.backTo', { tab: t(`picker.tabs.${tab}`) })}
            </button>
          ) : null}
          <div className={styles.listHead}>
            <span className={styles.listTitle}>{listTitle}</span>
            <span className={styles.count}>
              {showCards ? t('picker.regionCount', { count: groups.length }) : t('picker.count', { count: shown.length })}
            </span>
          </div>
          {showCards ? (
            <ul className={styles.grid}>
              {groups.map((g) => (
                <li key={g.key}>
                  <button type="button" className={styles.regionCard} onClick={() => setRegion(g.key)}>
                    <span className={styles.cardText}>
                      <span className={styles.cardName}>{t(`picker.regions.${g.key}`)}</span>
                      <span className={styles.cardSub}>{t('picker.count', { count: g.destinations.length })}</span>
                    </span>
                    <ChevronRight size={18} aria-hidden="true" className={styles.regionArrow} />
                  </button>
                </li>
              ))}
            </ul>
          ) : shown.length === 0 ? (
            <p className={styles.empty}>{t('picker.empty')}</p>
          ) : (
            <ul className={styles.grid}>
              {shown.map((d) => {
                const on = pickedId === d.id;
                return (
                  <li key={d.id}>
                    <button type="button" className={`${styles.card} ${on ? styles.cardOn : ''}`} onClick={() => setPickedId(d.id)} aria-pressed={on}>
                      {d.cover_url ? (
                        <img src={coverThumbUrl(d.cover_url)} alt="" className={styles.thumb} loading="lazy" decoding="async" />
                      ) : (
                        <span className={`${styles.thumb} ${styles.thumbEmpty}`} aria-hidden="true">
                          <MapPin size={18} />
                        </span>
                      )}
                      <span className={styles.cardText}>
                        <span className={styles.cardName}>{d.name}</span>
                        <span className={styles.cardSub}>{countryName(d.country_code)}</span>
                      </span>
                      {on ? <Check size={18} aria-hidden="true" className={styles.check} /> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className={styles.footer}>
          <div className={styles.status}>
            <span className={styles.statusLabel}>{t('picker.selected')}</span>
            {picked ? (
              <span className={styles.statusChip}>
                <MapPin size={14} aria-hidden="true" />
                {picked.name}, {countryName(picked.country_code)}
              </span>
            ) : (
              <span className={styles.statusNone}>{t('picker.none')}</span>
            )}
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.secondary} onClick={() => requestClose()}>
              {t('picker.close')}
            </button>
            <button type="button" className={styles.primary} disabled={!picked} onClick={handleConfirm}>
              {t('picker.confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
