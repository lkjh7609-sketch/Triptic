// 주변 추천 구성 — 식당 3 · 카페 3 · 볼거리/즐길거리 3(모두 9곳). 클라이언트(src/features/plan/aiRecommendations.ts)에 같은 규칙이 있다.
// 장소 풀은 거리순으로만 쌓이므로, 보여 줄 때 이 규칙으로 골라 담는다.

export const GROUP_SIZE = 3;
export const GROUPS = ['restaurant', 'cafe', 'sight'];

/** AI가 붙이는 카테고리(restaurant | cafe | culture | spot) → 구성 묶음. 문화·명소는 모두 '볼거리' */
export function groupOf(category) {
    if (category === 'restaurant') return 'restaurant';
    if (category === 'cafe') return 'cafe';
    return 'sight';
}

/** 묶음마다 3곳 이상 있는지 — 있으면 AI를 부르지 않는다 */
export function isMixComplete(rows) {
    const counts = missingCounts(rows);
    return GROUPS.every((g) => counts[g] === 0);
}

/** 묶음별로 몇 곳이 모자란지(0이면 충분) — AI에게 모자란 만큼만 요청한다 */
export function missingCounts(rows) {
    const have = { restaurant: 0, cafe: 0, sight: 0 };
    for (const r of rows) have[groupOf(r.category)] += 1;
    return Object.fromEntries(GROUPS.map((g) => [g, Math.max(0, GROUP_SIZE - have[g])]));
}

/** 무작위로 섞은 사본(Fisher–Yates). random은 시험에서 고정하려고 바꿀 수 있다 */
export function shuffled(rows, random = Math.random) {
    const a = [...rows];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/**
 * 쌓인 장소 중에서 묶음마다 **무작위로** 3곳씩 골라 식당 → 카페 → 볼거리 순으로 돌려준다 — 비슷한 자리에서 열 때마다(기준 장소마다)
 * 같은 가까운 곳만 나오지 않게. 어떤 묶음이 3곳에 못 미치면 남은 곳 중 무작위로 채워 최대 9곳까지(목록이 덜 비어 보이지 않게).
 */
export function pickBalanced(rowsInput, random = Math.random) {
    const rows = shuffled(rowsInput, random);
    const picked = new Set();
    const out = [];
    for (const g of GROUPS) {
        for (const r of rows) {
            if (out.length >= GROUP_SIZE * GROUPS.length) break;
            if (groupOf(r.category) !== g || picked.has(r)) continue;
            if (countIn(out, g) >= GROUP_SIZE) break;
            picked.add(r);
            out.push(r);
        }
    }
    for (const r of rows) {
        if (out.length >= GROUP_SIZE * GROUPS.length) break;
        if (!picked.has(r)) {
            picked.add(r);
            out.push(r);
        }
    }
    return out;
}

function countIn(list, group) {
    return list.filter((r) => groupOf(r.category) === group).length;
}
