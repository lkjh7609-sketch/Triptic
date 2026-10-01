import { Building2, PlaneTakeoff, Ticket } from 'lucide-react';

/** 항공·호텔·투어 캡슐의 칸 — 홈·항공·호텔·액티비티 화면이 같이 쓴다 */
export const CAPSULE_TABS = [
  { key: 'flights', to: '/flights', Icon: PlaneTakeoff },
  { key: 'hotels', to: '/hotels', Icon: Building2 },
  { key: 'tours', to: '/activities', Icon: Ticket },
] as const;

export type CapsuleTabKey = (typeof CAPSULE_TABS)[number]['key'];

/** 지금 주소에 해당하는 탭(항공·호텔·투어 화면이 아니면 없음) */
export function capsuleTabForPath(pathname: string): CapsuleTabKey | undefined {
  return CAPSULE_TABS.find((tab) => tab.to === pathname)?.key;
}

