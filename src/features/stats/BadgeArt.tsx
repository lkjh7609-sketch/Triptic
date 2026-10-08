import { Briefcase, Flag, Globe, MapPin, Send, Sun, Users, Lock, type LucideIcon } from 'lucide-react';
import styles from './Stats.module.css';

export type BadgeKind =
  | 'firstTrip' | 'firstAbroad' | 'firstCompanion' | 'oneLap'
  | 'countries3' | 'countries5' | 'countries10'
  | 'trips5' | 'trips10' | 'trips20'
  | 'days30' | 'days100';

const SPECIAL: Record<string, LucideIcon> = { firstTrip: Flag, firstAbroad: Send, firstCompanion: Users, oneLap: Globe };
const MINI: Record<string, LucideIcon> = { countries: MapPin, trips: Briefcase, days: Sun };

/**
 * 기록 뱃지 — 작은 모노라인(선 하나 굵기) 동그라미. 얻으면 브랜드 초록 선 + 연한 초록 바탕, 못 얻으면 점선 회색 + 자물쇠.
 * 가운데는 선 아이콘(깃발·종이비행기·두 사람·지구), 숫자 뱃지는 숫자 + 작은 종류 아이콘.
 */
export function BadgeArt({ kind, locked, size = 44, className }: { kind: BadgeKind; locked: boolean; size?: number; className?: string }) {
  const m = /^(countries|trips|days)(\d+)$/.exec(kind);
  const Icon = m ? null : SPECIAL[kind]!;
  const Mini = m ? MINI[m[1]!]! : null;
  const stroke = 1.6;
  return (
    <span
      className={`${styles.medal} ${locked ? styles.medalLocked : ''} ${className ?? ''}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {Icon ? <Icon size={size * 0.46} strokeWidth={stroke} /> : null}
      {m ? (
        <>
          <span className={styles.medalNum} style={{ fontSize: m[2]!.length >= 3 ? size * 0.27 : size * 0.34 }}>{m[2]}</span>
          {Mini ? <Mini size={size * 0.22} strokeWidth={stroke} /> : null}
        </>
      ) : null}
      {locked ? (
        <span className={styles.medalLock}>
          <Lock size={size * 0.2} strokeWidth={stroke + 0.2} />
        </span>
      ) : null}
    </span>
  );
}
