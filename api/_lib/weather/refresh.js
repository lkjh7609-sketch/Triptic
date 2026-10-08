// 하루 한 번 — 등록 도시마다 오늘 날씨(최고·최저·날씨 상태·강수 확률)를 WeatherKit에서 받아 destination_weather에 저장한다.
// 홈 "지금 가기 좋은 여행지"와 도시 채널은 이 표만 읽는다(화면이 열릴 때마다 외부 날씨 서비스를 부르지 않는다).
// 순수 계산(현지 날짜 고르기·행 만들기·동시 실행 제한)을 여기 두고, 실제 WeatherKit 호출은 fetchDays로 받아 시험할 수 있게 했다.

/** 그 시간대의 날짜(YYYY-MM-DD) */
export function localDate(timeZone, now = new Date()) {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** WeatherKit forecastDaily.days 중 그 도시의 '오늘'(현지 날짜)에 해당하는 날 — 없으면 null */
export function pickLocalDay(days, timeZone, localToday) {
    for (const day of Array.isArray(days) ? days : []) {
        if (typeof day?.forecastStart !== 'string') continue;
        const t = new Date(day.forecastStart);
        if (!Number.isNaN(t.getTime()) && localDate(timeZone, t) === localToday) return day;
    }
    return null;
}

const round1 = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 10) / 10 : null);

/** destination_weather 한 행. 최고·최저가 모두 없으면 null(저장하지 않는다) */
export function toRow(destinationId, day, localToday, now = new Date()) {
    const tmax = round1(day?.temperatureMax);
    const tmin = round1(day?.temperatureMin);
    if (tmax === null && tmin === null) return null;
    const chance = typeof day?.precipitationChance === 'number' && Number.isFinite(day.precipitationChance) ? Math.min(1, Math.max(0, Math.round(day.precipitationChance * 100) / 100)) : null;
    return {
        destination_id: destinationId,
        date: localToday,
        tmax_c: tmax,
        tmin_c: tmin,
        condition_code: typeof day?.conditionCode === 'string' ? day.conditionCode : null,
        precip_chance: chance,
        updated_at: now.toISOString(),
    };
}

/** items를 동시에 limit개까지만 처리한다(순서대로 결과를 돌려준다) */
export async function mapLimit(items, limit, fn) {
    const results = new Array(items.length);
    let next = 0;
    async function worker() {
        while (next < items.length) {
            const i = next++;
            results[i] = await fn(items[i], i);
        }
    }
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return results;
}

/**
 * @param {{ destinations: Array<{id: string, slug: string, lat: number, lng: number, timezone: string}>,
 *           fetchDays: (dest: object, startIso: string, endIso: string) => Promise<any[]>,
 *           now?: Date, concurrency?: number }} args
 * @returns {Promise<{ rows: object[], failed: string[] }>} 받지 못한 도시(slug)는 failed에 — 다른 도시는 계속 처리한다
 */
export async function refreshDestinations({ destinations, fetchDays, now = new Date(), concurrency = 12 }) {
    const failed = [];
    const rows = [];
    await mapLimit(destinations, concurrency, async (dest) => {
        try {
            const today = localDate(dest.timezone, now);
            // 현지 '오늘'이 UTC 어제/오늘/내일 어디든 걸리게 앞뒤로 하루씩 넉넉히 요청
            const start = new Date(now.getTime() - 24 * 3_600_000).toISOString().slice(0, 19) + 'Z';
            const end = new Date(now.getTime() + 36 * 3_600_000).toISOString().slice(0, 19) + 'Z';
            const days = await fetchDays(dest, start, end);
            const day = pickLocalDay(days, dest.timezone, today);
            const row = day ? toRow(dest.id, day, today, now) : null;
            if (row) rows.push(row);
            else failed.push(dest.slug);
        } catch {
            failed.push(dest.slug);
        }
    });
    return { rows, failed };
}
