/**
 * 출발 전 체크리스트의 구성 — 4페이지(필수 서류·결제 / 전자기기·통신 / 옷·위생 / 의약품·꿀템).
 * 문구는 번역 키 plan:desktop.checklist.items.{key} · groups.{group} · groupNotes.{group} · pages.{page}
 */

export type ItemKey =
  | 'flights' | 'hotel' | 'passport' | 'passportCopy' | 'ticketVoucher' | 'visa' | 'card' | 'cash' | 'idp' | 'insurance'
  | 'powerBank' | 'gadgets' | 'cables' | 'cordlessIron' | 'adapter' | 'powerStrip' | 'corded' | 'esim'
  | 'clothes' | 'outer' | 'sleepwear' | 'shoes' | 'accessories' | 'skincare' | 'toiletries' | 'shaver' | 'hygiene'
  | 'basicMeds' | 'topicals' | 'prescription' | 'filter' | 'pouch' | 'scale' | 'pen' | 'sleepKit';

/** 기내에 들고 타야 하는 것 / 위탁 수하물로 부치는 것 */
export type Carry = 'cabin' | 'checked';

/** 일정·제휴 링크와 이어지는 항목: 항공권·숙소는 일정에 있으면 자동 완료, 나머지는 제휴 링크 버튼 */
export type ItemLink = 'flights' | 'hotel' | 'insurance';

export interface ChecklistItem {
  key: ItemKey;
  carry?: Carry;
  link?: ItemLink;
}

export type GroupKey = 'docs' | 'devices' | 'comms' | 'clothes' | 'hygiene' | 'meds' | 'extras';
export type PageKey = 'docs' | 'devices' | 'clothes' | 'meds';

export interface ChecklistGroup {
  key: GroupKey;
  /** 선택 항목 — 체크하지 않아도 페이지를 마칠 수 있다 */
  optional?: boolean;
  /** 구역 설명 문구가 없으면 true (groupNotes.{key}가 없는 구역) */
  noNote?: boolean;
  items: ChecklistItem[];
}

export interface ChecklistPage {
  key: PageKey;
  groups: ChecklistGroup[];
}

export const CHECKLIST_PAGES: readonly ChecklistPage[] = [
  {
    key: 'docs',
    groups: [
      {
        key: 'docs',
        items: [
          { key: 'flights', link: 'flights' },
          { key: 'hotel', link: 'hotel' },
          { key: 'passport' },
          { key: 'passportCopy' },
          { key: 'ticketVoucher' },
          { key: 'visa' },
          { key: 'card' },
          { key: 'cash' },
          { key: 'idp' },
          { key: 'insurance', link: 'insurance' },
        ],
      },
    ],
  },
  {
    key: 'devices',
    groups: [
      {
        key: 'devices',
        items: [
          { key: 'powerBank', carry: 'cabin' },
          { key: 'gadgets', carry: 'cabin' },
          { key: 'cables', carry: 'cabin' },
          { key: 'cordlessIron', carry: 'cabin' },
          { key: 'adapter', carry: 'checked' },
          { key: 'powerStrip', carry: 'checked' },
          { key: 'corded', carry: 'checked' },
        ],
      },
      // 통신 준비(유심·eSIM·포켓 와이파이)는 챙길 것 알림만 — Yesim 제휴 링크는 2026-10-04에 뺐다(트래블페이아웃)
      { key: 'comms', noNote: true, items: [{ key: 'esim' }] },
    ],
  },
  {
    key: 'clothes',
    groups: [
      { key: 'clothes', items: [{ key: 'clothes' }, { key: 'outer' }, { key: 'sleepwear' }, { key: 'shoes' }, { key: 'accessories' }] },
      { key: 'hygiene', items: [{ key: 'skincare' }, { key: 'toiletries' }, { key: 'shaver', carry: 'checked' }, { key: 'hygiene' }] },
    ],
  },
  {
    key: 'meds',
    groups: [
      { key: 'meds', items: [{ key: 'basicMeds' }, { key: 'topicals' }, { key: 'prescription' }] },
      {
        key: 'extras',
        optional: true,
        items: [{ key: 'filter' }, { key: 'pouch' }, { key: 'scale' }, { key: 'pen', carry: 'cabin' }, { key: 'sleepKit' }],
      },
    ],
  },
];

/** 예전 체크리스트(항목 6개)에서 저장한 값을 새 항목으로 옮긴다 — "환전·카드"는 둘로 나뉘었다 */
export function migrateChecked(saved: readonly string[]): ItemKey[] {
  const out = new Set<string>();
  for (const key of saved) {
    if (key === 'money') {
      out.add('card');
      out.add('cash');
    } else {
      out.add(key);
    }
  }
  return [...out] as ItemKey[];
}

/** 이 페이지를 마치려면 체크해야 하는 항목(선택 구역 제외) */
export function requiredItems(page: ChecklistPage): ChecklistItem[] {
  return page.groups.filter((g) => !g.optional).flatMap((g) => g.items);
}

export function isPageComplete(page: ChecklistPage, isDone: (key: ItemKey) => boolean): boolean {
  return requiredItems(page).every((item) => isDone(item.key));
}

/** 처음 열었을 때 보여 줄 페이지 — 아직 안 마친 첫 페이지, 다 마쳤으면 마지막 */
export function firstIncompletePage(isDone: (key: ItemKey) => boolean): number {
  const index = CHECKLIST_PAGES.findIndex((page) => !isPageComplete(page, isDone));
  return index === -1 ? CHECKLIST_PAGES.length - 1 : index;
}

/** 마지막 확인 카드의 항목 — 문구는 plan:desktop.checklist.final.cabin.{key} / final.checked.{key} */
export const FINAL_CABIN = ['docs', 'powerBank', 'gadgets', 'battery'] as const;
export const FINAL_CHECKED = ['adapter', 'corded', 'shaver'] as const;
