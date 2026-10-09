import { Check } from 'lucide-react';
import { usePersonLabel } from './usePersonLabel';
import { PixelSprite } from '@/features/stats/PixelSprite';
import { avatarGrid } from '@/features/stats/pixelArt';
import type { Person } from './splitModel';
import styles from './Split.module.css';

/** 도트 캐릭터 한 명 — 크기는 도트 한 칸의 화면 px */
export function PersonAvatar({ person, pixel = 3, label }: { person: Person; pixel?: number; label?: string }) {
  return <PixelSprite grid={avatarGrid(person.seed)} pixel={pixel} className={styles.avatar} label={label} />;
}

interface MemberPickerProps {
  people: Person[];
  meId: string | null;
  selected: string[];
  onChange: (next: string[]) => void;
  /** multi: 여러 명 고르기(나눌 사람), single: 한 명 고르기(돈 낸 사람) */
  mode: 'multi' | 'single';
  ariaLabel: string;
}

/** 도트 캐릭터와 그 아래 이름으로 사람을 고르는 칸 */
export function MemberPicker({ people, meId, selected, onChange, mode, ariaLabel }: MemberPickerProps) {
  const labelOf = usePersonLabel(meId);

  function toggle(id: string) {
    if (mode === 'single') {
      onChange([id]);
      return;
    }
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  return (
    <div className={styles.picker} role={mode === 'single' ? 'radiogroup' : 'group'} aria-label={ariaLabel}>
      {people.map((p) => {
        const on = selected.includes(p.id);
        const name = labelOf(p);
        return (
          <button
            key={p.id}
            type="button"
            role={mode === 'single' ? 'radio' : undefined}
            aria-checked={mode === 'single' ? on : undefined}
            aria-pressed={mode === 'multi' ? on : undefined}
            className={on ? styles.pickBtnOn : styles.pickBtn}
            onClick={() => toggle(p.id)}
          >
            <span className={styles.pickAvatar}>
              <PersonAvatar person={p} pixel={2} />
              {on ? (
                <span className={styles.pickCheck} aria-hidden="true">
                  <Check size={12} strokeWidth={3} />
                </span>
              ) : null}
            </span>
            <span className={styles.pickName}>{name}</span>
          </button>
        );
      })}
    </div>
  );
}
