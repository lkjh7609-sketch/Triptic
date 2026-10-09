/**
 * 운영 콘솔 메뉴 구성 — 하는 일별로 묶었다.
 *  · 개요      대시보드
 *  · 운영      신고 큐 · 자동 플래그 큐 · 건의함      (들어오는 일을 처리)
 *  · 회원      회원 · 정지 기록                        (사람 관리)
 *  · 콘텐츠    공지 · 보관함
 *  · 데이터    판매 · 분석
 */
export type AdminSection =
  | 'dashboard'
  | 'reports'
  | 'pending'
  | 'feedback'
  | 'members'
  | 'suspensions'
  | 'notices'
  | 'archive'
  | 'sales'
  | 'analytics';

export type AdminGroupKey = 'overview' | 'moderation' | 'members' | 'content' | 'insights';

export const ADMIN_GROUPS: { key: AdminGroupKey; sections: AdminSection[] }[] = [
  { key: 'overview', sections: ['dashboard'] },
  { key: 'moderation', sections: ['reports', 'pending', 'feedback'] },
  { key: 'members', sections: ['members', 'suspensions'] },
  { key: 'content', sections: ['notices', 'archive'] },
  { key: 'insights', sections: ['sales', 'analytics'] },
];

const ALL = new Set<string>(ADMIN_GROUPS.flatMap((g) => g.sections));

/** 주소의 ?tab= 값을 섹션으로 — 모르는 값은 대시보드 */
export function parseSection(value: string | null): AdminSection {
  return value && ALL.has(value) ? (value as AdminSection) : 'dashboard';
}
