import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ChevronDown, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Destination } from './types';
import { DestinationPickerModal } from './DestinationPickerModal';
import type { PickerTab } from './destinationRegions';

interface DestinationSelectorProps {
  searchElement?: React.ReactNode;
  /** 도시 선택 버튼 바로 옆에 붙는 것(PC 커뮤니티의 여행경보 버튼) */
  trailing?: React.ReactNode;
  destinations: Destination[];
  /** 있으면 도시를 고를 때 이 콜백만 호출하고 navigate하지 않는다(동행찾기 목록 필터용) */
  onCitySelect?: (city: Destination) => void;
  /** 있으면 선택 창에 "어디든 상관없어요"가 생기고, 누르면 이 콜백으로 필터를 비운다(동행찾기 목록 필터용) */
  onClear?: () => void;
  /** onCitySelect와 같이 써서 현재 필터 중인 도시를 버튼에 보여 준다 */
  selectedDestinationId?: string | null;
}

/** 도시 채널의 브레드크럼('아시아')이 ?continent=AS로 들어오면 선택 창이 그 지역 탭으로 바로 열린다 */
const CONTINENT_TAB: Record<string, PickerTab> = {
  AS: 'asia',
  EU: 'eu',
  NA: 'am',
  SA: 'am',
  AF: 'other',
  OC: 'other',
};

/** 커뮤니티 도시 고르기 — 버튼 하나를 누르면 글쓰기·동행 글과 같은 여행지 선택 창이 열린다 */
export function DestinationSelector({
  destinations,
  searchElement,
  trailing,
  onCitySelect,
  onClear,
  selectedDestinationId,
}: DestinationSelectorProps) {
  const { t } = useTranslation('community');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = CONTINENT_TAB[searchParams.get('continent') ?? ''];
  const [open, setOpen] = useState(() => !!initialTab && !onCitySelect);
  const selected = selectedDestinationId
    ? destinations.find((d) => d.id === selectedDestinationId)
    : undefined;

  return (
    <div className="flex flex-col lg:flex-row items-center justify-between gap-4 w-full">
      <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
        <button
          type="button"
          aria-haspopup="dialog"
          className={`w-full lg:w-auto inline-flex items-center justify-between lg:justify-start gap-2 px-5 py-2.5 rounded-full font-label-md text-label-md transition-all shrink-0 border shadow-sm ${selected ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container-lowest hover:bg-surface-container border-outline-variant/50 text-on-surface-variant'}`}
          onClick={() => setOpen(true)}
        >
          <span className="inline-flex items-center gap-2 min-w-0">
            <MapPin size={18} aria-hidden="true" className="shrink-0" />
            <span className="truncate">{selected ? selected.name : t('picker.openButton')}</span>
          </span>
          <ChevronDown size={18} aria-hidden="true" className="shrink-0" />
        </button>
        {trailing}
      </div>
      {searchElement && <div className="w-full lg:w-auto shrink-0">{searchElement}</div>}

      {open ? (
        <DestinationPickerModal
          destinations={destinations}
          selectedId={selectedDestinationId ?? null}
          initialTab={initialTab}
          onConfirm={(city) =>
            onCitySelect ? onCitySelect(city) : navigate(`/community/d/${city.slug}`)
          }
          onClear={onClear}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}
