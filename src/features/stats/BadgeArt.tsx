import { useId } from 'react';

export type BadgeKind =
  | 'firstTrip' | 'firstAbroad' | 'firstCompanion' | 'oneLap'
  | 'countries3' | 'countries5' | 'countries10'
  | 'trips5' | 'trips10' | 'trips20'
  | 'days30' | 'days100';

interface Palette {
  light: string;
  main: string;
  dark: string;
  ribbon: string;
}

const TIER: Record<string, Palette> = {
  special: { light: '#FFF1B8', main: '#FFC93C', dark: '#B7791F', ribbon: '#FF7A90' },
  countries: { light: '#D5F5F0', main: '#55C7BD', dark: '#1F7A72', ribbon: '#FF7A90' },
  trips: { light: '#FFE3C2', main: '#FF9F43', dark: '#B45309', ribbon: '#FF7A90' },
  days: { light: '#D8F7DF', main: '#6FD08C', dark: '#237A45', ribbon: '#FF7A90' },
};
const LOCKED: Palette = { light: '#F4F2EE', main: '#DAD6CF', dark: '#A8A29E', ribbon: '#CFCAC2' };

function Sparkle({ x, y, s = 1, fill }: { x: number; y: number; s?: number; fill: string }) {
  return <path transform={`translate(${x} ${y}) scale(${s})`} d="M0 -6 L1.7 -1.7 L6 0 L1.7 1.7 L0 6 L-1.7 1.7 L-6 0 L-1.7 -1.7Z" fill={fill} />;
}

/** 가운데 그림 — 흰 바탕에 짙은 테두리를 두른 스티커 느낌의 둥근 그림 */
function Icon({ kind, c }: { kind: string; c: Palette }) {
  const stroke = { stroke: c.dark, strokeWidth: 2.6, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  switch (kind) {
    case 'firstTrip':
      return (
        <g>
          <path d="M-9 -17 L-9 19" fill="none" {...stroke} strokeWidth={3.4} />
          <path d="M-9 -16 C0 -23 7 -10 17 -17 L17 3 C7 10 0 -3 -9 3 Z" fill="#fff" {...stroke} />
          <circle cx={-9} cy={-19} r={2.6} fill={c.main} {...stroke} strokeWidth={1.8} />
        </g>
      );
    case 'firstAbroad':
      return (
        <g transform="rotate(-8)">
          <path d="M-19 -1 L19 -16 L7 17 L-1 5 Z" fill="#fff" {...stroke} />
          <path d="M-1 5 L19 -16" fill="none" {...stroke} strokeWidth={2} />
          <path d="M-1 5 L-3 15 L4 9" fill={c.light} {...stroke} strokeWidth={2} />
        </g>
      );
    case 'firstCompanion':
      return (
        <g>
          {[-10, 10].map((x, i) => (
            <g key={x} transform={`translate(${x} 0)`}>
              <path d="M-9 20 a9 9 0 0 1 18 0 Z" fill={i === 0 ? c.light : '#fff'} {...stroke} strokeWidth={2.2} />
              <circle cx={0} cy={-4} r={9} fill="#fff" {...stroke} strokeWidth={2.2} />
              <circle cx={-3.2} cy={-4.5} r={1.3} fill={c.dark} />
              <circle cx={3.2} cy={-4.5} r={1.3} fill={c.dark} />
              <path d="M-2.5 -0.4 Q0 2.4 2.5 -0.4" fill="none" stroke={c.dark} strokeWidth={1.6} strokeLinecap="round" />
              <circle cx={-6} cy={-1.4} r={1.4} fill="#FF9DB0" opacity={0.7} />
              <circle cx={6} cy={-1.4} r={1.4} fill="#FF9DB0" opacity={0.7} />
            </g>
          ))}
        </g>
      );
    case 'oneLap':
      return (
        <g>
          <circle r={18} fill="#fff" {...stroke} />
          <path d="M-8 -12 C-3 -14 0 -9 -4 -6 C-8 -4 -12 -6 -8 -12 Z" fill={c.main} />
          <path d="M5 -3 C11 -6 15 0 11 6 C8 11 3 9 4 4 C4 1 3 -1 5 -3 Z" fill={c.main} />
          <path d="M-12 7 C-8 5 -6 9 -9 12 C-12 12 -14 9 -12 7 Z" fill={c.main} />
          <ellipse rx={7} ry={18} fill="none" stroke={c.dark} strokeWidth={1.4} opacity={0.5} />
          <path d="M-18 0 H18" stroke={c.dark} strokeWidth={1.4} opacity={0.5} />
          <circle cx={-6} cy={-8} r={2} fill="#fff" opacity={0.9} />
        </g>
      );
    default:
      return null;
  }
}

function MiniIcon({ group, c }: { group: string; c: Palette }) {
  const stroke = { stroke: c.dark, strokeWidth: 1.8, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  if (group === 'countries') {
    return <path d="M0 8 C-8 0 -6 -8 0 -8 C6 -8 8 0 0 8 Z" fill="#fff" {...stroke} />;
  }
  if (group === 'trips') {
    return (
      <g>
        <path d="M-3 -4 V-6 H3 V-4" fill="none" {...stroke} />
        <rect x={-8} y={-4} width={16} height={11} rx={3} fill="#fff" {...stroke} />
      </g>
    );
  }
  return (
    <g>
      <circle r={4.5} fill="#fff" {...stroke} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <path key={a} d="M0 -7 V-9.5" transform={`rotate(${a})`} fill="none" {...stroke} />
      ))}
    </g>
  );
}

/**
 * 기록 뱃지 — 귀여운 벡터 메달(도트 아님). 물결 테두리 + 점선 링 + 리본, 가운데는 깃발·종이비행기·두 친구·지구 또는 숫자.
 * 못 얻은 것은 회색 메달에 자물쇠가 붙는다.
 */
export function BadgeArt({ kind, locked, size, className }: { kind: BadgeKind; locked: boolean; size: number; className?: string }) {
  const uid = useId().replace(/:/g, '');
  const m = /^(countries|trips|days)(\d+)$/.exec(kind);
  const group = m ? m[1]! : 'special';
  const c = locked ? LOCKED : TIER[group]!;
  const gradId = `bg${uid}`;
  const digits = m ? m[2]! : '';
  const fontSize = digits.length >= 3 ? 21 : 28;

  return (
    <svg className={className} width={size} height={size * 1.1} viewBox="0 0 100 110" role="img" aria-hidden="true">
      <defs>
        <radialGradient id={gradId} cx="38%" cy="30%" r="80%">
          <stop offset="0%" stopColor={c.light} />
          <stop offset="100%" stopColor={c.main} />
        </radialGradient>
      </defs>
      {/* 리본 꼬리 */}
      <path d="M30 66 L50 74 L43 104 L34 94 L22 100 Z" fill={c.ribbon} stroke={c.dark} strokeWidth={2.4} strokeLinejoin="round" />
      <path d="M70 66 L50 74 L57 104 L66 94 L78 100 Z" fill={c.ribbon} stroke={c.dark} strokeWidth={2.4} strokeLinejoin="round" />
      {/* 물결 테두리 */}
      <g fill={c.main} stroke={c.dark} strokeWidth={2.4}>
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return <circle key={i} cx={50 + Math.cos(a) * 35} cy={46 + Math.sin(a) * 35} r={7.5} />;
        })}
      </g>
      <circle cx={50} cy={46} r={36} fill={c.main} />
      <circle cx={50} cy={46} r={30} fill={`url(#${gradId})`} stroke={c.dark} strokeWidth={2.4} />
      <circle cx={50} cy={46} r={26} fill="none" stroke="#fff" strokeWidth={2.4} strokeDasharray="0.1 5.2" strokeLinecap="round" opacity={0.9} />
      {/* 반짝임 */}
      <path d="M26 36 C28 27 36 21 44 20" fill="none" stroke="#fff" strokeWidth={3.4} strokeLinecap="round" opacity={0.65} />
      <Sparkle x={86} y={18} s={1.1} fill={locked ? '#fff' : '#FFF6C9'} />
      <Sparkle x={13} y={26} s={0.7} fill={locked ? '#fff' : '#FFF6C9'} />
      {/* 가운데 */}
      <g transform="translate(50 47)">
        {m ? (
          <g>
            <text
              x={0}
              y={digits.length >= 3 ? 3 : 4}
              textAnchor="middle"
              fontSize={fontSize}
              fontWeight={900}
              fontFamily="'Plus Jakarta Sans', 'Pretendard Variable', system-ui, sans-serif"
              fill="#fff"
              stroke={c.dark}
              strokeWidth={5}
              strokeLinejoin="round"
              paintOrder="stroke"
            >
              {digits}
            </text>
            <g transform="translate(0 15) scale(0.62)">
              <MiniIcon group={group} c={c} />
            </g>
          </g>
        ) : (
          <Icon kind={kind} c={c} />
        )}
      </g>
      {locked ? (
        <g transform="translate(76 72)">
          <circle r={11} fill="#fff" stroke={c.dark} strokeWidth={2.2} />
          <rect x={-5} y={-1} width={10} height={8} rx={2} fill={c.dark} />
          <path d="M-3 -1 V-4 a3 3 0 0 1 6 0 V-1" fill="none" stroke={c.dark} strokeWidth={2} strokeLinecap="round" />
        </g>
      ) : null}
    </svg>
  );
}
