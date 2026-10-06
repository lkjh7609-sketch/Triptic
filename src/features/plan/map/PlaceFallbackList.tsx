import { createPortal } from 'react-dom';
import type { RefObject } from 'react';
import type { SelectedPlace } from './usePlaceAutocomplete';
import styles from './PlaceFallbackList.module.css';

interface PlaceFallbackListProps {
  inputRef: RefObject<HTMLInputElement | null>;
  items: SelectedPlace[];
  onPick: (place: SelectedPlace) => void;
}

/** 자동완성이 비었을 때 Text Search 결과 — 입력칸 바로 아래에 구글 자동완성 목록처럼 띄운다 */
export function PlaceFallbackList({ inputRef, items, onPick }: PlaceFallbackListProps) {
  const rect = inputRef.current?.getBoundingClientRect();
  if (items.length === 0 || !rect) return null;
  return createPortal(
    <ul
      className={styles.list}
      style={{ top: rect.bottom + 4, left: rect.left, width: rect.width }}
      role="listbox"
    >
      {items.map((place) => (
        <li key={place.placeId ?? `${place.lat},${place.lng}`} role="option" aria-selected={false}>
          <button
            type="button"
            className={styles.item}
            // 입력칸이 포커스를 잃어 목록이 닫히기 전에 선택되도록
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(place)}
          >
            <span className={styles.name}>{place.name}</span>
            <span className={styles.address}>{place.address}</span>
          </button>
        </li>
      ))}
    </ul>,
    document.body,
  );
}
