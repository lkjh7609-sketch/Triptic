import { COMPANION_GENDERS, sanitizeAges, sanitizeTags, type CompanionGender, type CompanionPrefs } from './companionPrefs';
import { parseYmd } from './dateRangeCalendar';

/** 동행 글쓰기 임시저장 — 이 기기(localStorage)에만, 로그인한 사용자별로 하나 */
export interface CompanionDraft {
  title: string;
  body: string;
  destinationId: string;
  startDate: string | null;
  endDate: string | null;
  datesTbd: boolean;
  groupSize: number;
  prefs: CompanionPrefs;
  savedAt: number;
}

const key = (userId: string) => `triptic-companion-draft:${userId}`;

export const MIN_GROUP_SIZE = 2;
export const MAX_GROUP_SIZE = 20;

/** 적을 내용이 하나도 없으면 임시저장할 이유가 없다(인원 수만 바꾼 것은 내용으로 치지 않는다) */
export function isEmptyCompanionDraft(d: Omit<CompanionDraft, 'savedAt'>): boolean {
  return (
    !d.title.trim() &&
    !d.body.trim() &&
    !d.destinationId &&
    !d.startDate &&
    !d.datesTbd &&
    d.prefs.gender === 'any' &&
    d.prefs.ages.length === 0 &&
    d.prefs.tags.length === 0
  );
}

export function readCompanionDraft(userId: string): CompanionDraft | null {
  try {
    const raw = localStorage.getItem(key(userId));
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<CompanionDraft> & { prefs?: Partial<CompanionPrefs> };
    const start = typeof p.startDate === 'string' && parseYmd(p.startDate) ? p.startDate : null;
    const end = typeof p.endDate === 'string' && parseYmd(p.endDate) ? p.endDate : null;
    const hasRange = !!start && !!end && start <= end;
    const size = typeof p.groupSize === 'number' ? Math.round(p.groupSize) : MIN_GROUP_SIZE;
    const gender: CompanionGender = COMPANION_GENDERS.includes(p.prefs?.gender as CompanionGender) ? (p.prefs!.gender as CompanionGender) : 'any';
    const draft: CompanionDraft = {
      title: typeof p.title === 'string' ? p.title : '',
      body: typeof p.body === 'string' ? p.body : '',
      destinationId: typeof p.destinationId === 'string' ? p.destinationId : '',
      startDate: hasRange ? start : null,
      endDate: hasRange ? end : null,
      datesTbd: !hasRange && p.datesTbd === true,
      groupSize: Math.min(MAX_GROUP_SIZE, Math.max(MIN_GROUP_SIZE, size)),
      prefs: { gender, ages: sanitizeAges(p.prefs?.ages), tags: sanitizeTags(p.prefs?.tags) },
      savedAt: typeof p.savedAt === 'number' ? p.savedAt : 0,
    };
    return isEmptyCompanionDraft(draft) ? null : draft;
  } catch {
    return null;
  }
}

/** 저장한다. 내용이 비었으면 저장하지 않고 지운다. 저장했으면 true */
export function writeCompanionDraft(userId: string, draft: Omit<CompanionDraft, 'savedAt'>, now = Date.now()): boolean {
  try {
    if (isEmptyCompanionDraft(draft)) {
      localStorage.removeItem(key(userId));
      return false;
    }
    localStorage.setItem(key(userId), JSON.stringify({ ...draft, savedAt: now } satisfies CompanionDraft));
    return true;
  } catch {
    return false;
  }
}

export function clearCompanionDraft(userId: string): void {
  try {
    localStorage.removeItem(key(userId));
  } catch {
    // 저장이 막힌 환경 — 없어도 동작한다
  }
}
