import type { UploadedPostImage } from './imageProcessing';

/** 글쓰기 임시저장 — 이 기기(localStorage)에만, 로그인한 사용자별로 하나. 사진은 이미 올라간 것의 저장 경로만 담는다 */
export interface ComposeDraft {
  destinationId: string;
  body: string;
  tripId: string;
  allowCopy: boolean;
  images: UploadedPostImage[];
  savedAt: number;
}

const key = (userId: string) => `triptic-compose-draft:${userId}`;

/** 적을 내용이 하나도 없으면 임시저장할 이유가 없다 */
export function isEmptyDraft(d: Pick<ComposeDraft, 'destinationId' | 'body' | 'tripId' | 'images'>): boolean {
  return !d.destinationId && !d.body.trim() && !d.tripId && d.images.length === 0;
}

export function readDraft(userId: string): ComposeDraft | null {
  try {
    const raw = localStorage.getItem(key(userId));
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<ComposeDraft>;
    const images = Array.isArray(p.images)
      ? p.images.filter(
          (i): i is UploadedPostImage => !!i && typeof i.storagePath === 'string' && typeof i.width === 'number' && typeof i.height === 'number',
        )
      : [];
    const draft: ComposeDraft = {
      destinationId: typeof p.destinationId === 'string' ? p.destinationId : '',
      body: typeof p.body === 'string' ? p.body : '',
      tripId: typeof p.tripId === 'string' ? p.tripId : '',
      allowCopy: p.allowCopy === true,
      images,
      savedAt: typeof p.savedAt === 'number' ? p.savedAt : 0,
    };
    return isEmptyDraft(draft) ? null : draft;
  } catch {
    return null;
  }
}

/** 저장한다. 내용이 비었으면 저장하지 않고 지운다. 저장했으면 true */
export function writeDraft(userId: string, draft: Omit<ComposeDraft, 'savedAt'>, now = Date.now()): boolean {
  try {
    if (isEmptyDraft(draft)) {
      localStorage.removeItem(key(userId));
      return false;
    }
    localStorage.setItem(key(userId), JSON.stringify({ ...draft, savedAt: now } satisfies ComposeDraft));
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(userId: string): void {
  try {
    localStorage.removeItem(key(userId));
  } catch {
    // 저장이 막힌 환경 — 없어도 동작한다
  }
}
