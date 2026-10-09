// 좌표 → 가장 가까운 아고다 도시. 아고다 제휴 API는 이름이 아니라 숫자 도시 ID로만 검색되므로, 구글 자동완성이 준 좌표로 도시를 찾는다.
import CITY_TABLE from './cityTable.js';

/** 이보다 멀리 떨어진 도시만 있으면(바다 한가운데 등) 못 찾은 것으로 본다 */
export const MAX_DISTANCE_KM = 80;

function haversineKm(lat1, lng1, lat2, lng2) {
    const p = Math.PI / 180;
    const a = Math.sin(((lat2 - lat1) * p) / 2) ** 2 + Math.cos(lat1 * p) * Math.cos(lat2 * p) * Math.sin(((lng2 - lng1) * p) / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(a));
}

/**
 * @param {number} lat
 * @param {number} lng
 * @param {Array<[number, number, number, number, string, string]>} [table]
 * @returns {{ id: number, name: string, country: string, distanceKm: number } | null}
 */
export function nearestCity(lat, lng, table = CITY_TABLE) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    let best = null;
    let bestDistance = Infinity;
    for (const row of table) {
        // 위도 차이만으로도 이미 멀면 건너뛴다(대략 111km/도)
        if (Math.abs(row[1] - lat) * 111 > bestDistance) continue;
        const d = haversineKm(lat, lng, row[1], row[2]);
        if (d < bestDistance) {
            bestDistance = d;
            best = row;
        }
    }
    if (!best || bestDistance > MAX_DISTANCE_KM) return null;
    return { id: best[0], name: best[4], country: best[5], distanceKm: Math.round(bestDistance * 10) / 10 };
}

/** 도시 ID → 도시 정보(표에 없으면 null — 호텔이 25곳 미만인 작은 도시) */
export function cityById(id, table = CITY_TABLE) {
    const row = table.find((r) => r[0] === id);
    return row ? { id: row[0], name: row[4], country: row[5], distanceKm: 0 } : null;
}
