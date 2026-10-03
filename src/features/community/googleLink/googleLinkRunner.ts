import {
  pickPlaceMatch,
  searchQueryFor,
  type MatchResult,
  type PlaceCandidate,
} from './googleLinkMatch';

export interface LinkTarget {
  id: string;
  slug: string;
  nameEn: string;
  countryEn: string;
  lat: number;
  lng: number;
}

export interface LinkOutcome {
  target: LinkTarget;
  result: MatchResult;
  /** 구글 검색 자체가 실패했을 때의 상태 값 */
  error?: string;
}

export interface LinkDeps {
  /** 검색어와 우리 좌표 근처로 구글 장소를 찾는다. 한도 초과는 'OVER_QUERY_LIMIT'를 던진다 */
  search: (query: string, center: { lat: number; lng: number }) => Promise<PlaceCandidate[]>;
  /** 확정된 장소 ID를 저장한다 */
  save: (target: LinkTarget, placeId: string) => Promise<void>;
  wait?: (ms: number) => Promise<void>;
  shouldStop?: () => boolean;
  onProgress?: (outcome: LinkOutcome, done: number, total: number) => void;
}

const defaultWait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * 장소 ID가 비어 있는 여행지들을 차례로 구글에 연동한다. 기준 거리 안에서 도시 단위 장소가 잡히면 바로 저장하고(matched),
 * 멀거나 없으면 저장하지 않고 결과만 돌려준다(관리자가 보고 정한다). 한도 초과는 잠깐 쉬었다 두 번까지 다시 시도한다.
 */
export async function linkDestinations(
  targets: readonly LinkTarget[],
  deps: LinkDeps,
): Promise<LinkOutcome[]> {
  const wait = deps.wait ?? defaultWait;
  const outcomes: LinkOutcome[] = [];
  for (const target of targets) {
    if (deps.shouldStop?.()) break;
    let candidates: PlaceCandidate[] = [];
    let error: string | undefined;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        candidates = await deps.search(searchQueryFor(target.nameEn, target.countryEn), {
          lat: target.lat,
          lng: target.lng,
        });
        error = undefined;
        break;
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
        if (error !== 'OVER_QUERY_LIMIT') break;
        await wait(2000 * (attempt + 1));
      }
    }
    const result = error ? pickPlaceMatch([], target) : pickPlaceMatch(candidates, target);
    if (result.status === 'matched' && result.placeId) {
      try {
        await deps.save(target, result.placeId);
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
      }
    }
    const outcome: LinkOutcome = { target, result, ...(error ? { error } : {}) };
    outcomes.push(outcome);
    deps.onProgress?.(outcome, outcomes.length, targets.length);
    await wait(250); // 구글 검색 한도를 넘지 않게 천천히
  }
  return outcomes;
}
