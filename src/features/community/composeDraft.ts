import type { UploadedPostImage } from './imageProcessing';
import { isPostCategory, normalizeTags, type PostCategory } from './postMeta';

/** 글쓰기 임시저장 — 이 기기(localStorage)에만, 로그인한 사용자별로 하나. 사진은 이미 올라간 것의 저장 경로만 담는다 */
export interface ComposeDraft {
  destinationId: string;
  /** 글 제목(0086) — 제목이 생기기 전에 저장된 임시저장 글은 '' */
  title: string;
  body: string;
  tripId: string;
  allowCopy: boolean;
  images: UploadedPostImage[];
  /** 글 분류(0077) — 아직 안 골랐으면 '' */
  category: PostCategory | '';
  tags: string[];
  savedAt: number;
}

const key = (userId: string) => `triptic-compose-draft:${userId}`;

/** 적을 내용이 하나도 없으면 임시저장할 이유가 없다 */
export function isEmptyDraft(
  d: Pick<ComposeDraft, 'destinationId' | 'title' | 'body' | 'tripId' | 'images' | 'tags'>,
): boolean {
  return (
    !d.destinationId && !d.title.trim() && !d.body.trim() && !d.tripId && d.images.length === 0 && d.tags.length === 0
  );
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
      title: typeof p.title === 'string' ? p.title : '',
      body: typeof p.body === 'string' ? p.body : '',
      tripId: typeof p.tripId === 'string' ? p.tripId : '',
      allowCopy: p.allowCopy === true,
      images,
      // 분류·태그가 생기기 전에 저장된 임시저장 글은 이 값들이 없다
      category: isPostCategory(p.category) ? p.category : '',
      tags: Array.isArray(p.tags)
        ? normalizeTags(p.tags.filter((t): t is string => typeof t === 'string'))
        : [],
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
