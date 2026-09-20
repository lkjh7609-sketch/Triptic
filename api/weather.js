// Vercel Serverless Function: WeatherKit REST 프록시 + DB 캐시
// 출처: docs/specs/05-weather.md
// 목적: WEATHERKIT_PRIVATE_KEY(ES256 서명키)를 서버에만 두고 브라우저에는 절대
// 노출하지 않는다. AVIATIONSTACK_API_KEY를 api/flight.js가 다루는 것과 동일한 원칙.
// Endpoint: GET /api/weather?lat=35.6762&lng=139.6503&start=2026-05-20&end=2026-05-23&lang=ko
//
// ⚠️ conditionCode는 원본(WeatherKit) 코드를 그대로 돌려준다 — 9종 압축 매핑은
// src/features/weather/conditionMap.ts "한 곳에만" 둔다(05-weather.md §4).
//
// ⚠️ Apple Developer Program 미가입 상태라 WEATHERKIT_* 환경변수는 아직 비어있다
// (사용자 명시 승인 — Phase 1과 동일한 제약). 그 동안 이 엔드포인트는 항상 503을
// 반환하고, 클라이언트는 §6.3 규칙대로 날씨 영역을 조용히 숨긴다.

import { SignJWT, importPKCS8 } from 'jose';
import { createClient } from '@supabase/supabase-js';

const ALLOWED_ORIGINS = new Set([
    'https://triptic.my',
    'https://www.triptic.my',
    'https://triptic-ten.vercel.app',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'capacitor://localhost'
]);

const hits = new Map();
function isRateLimited(ip, limit = 30, windowMs = 60_000) {
    const now = Date.now();
    const rec = hits.get(ip);
    if (!rec || now - rec.start > windowMs) {
        hits.set(ip, { start: now, count: 1 });
        return false;
    }
    rec.count += 1;
    return rec.count > limit;
}

function applyCors(req, res) {
    const origin = req.headers.origin;
    if (origin && ALLOWED_ORIGINS.has(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const LANG_RE = /^[a-z]{2}(-[A-Z]{2})?$/;
// 여행 한 건 조회를 한 번에 처리하되, 남용 방지를 위해 상한을 둔다(§9 Phase7 전까지는
// 앱에서 만들 수 있는 최대 여행 기간에 대한 별도 제약이 없어 넉넉히 잡는다).
const MAX_RANGE_DAYS = 31;
// §5.1: 예보는 오늘부터 이 일수까지만 실제 값, 그 이후는 평년값
const FORECAST_RANGE_DAYS = 10;

function gridKey(lat, lng) {
    return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}

function todayUTC() {
    return new Date().toISOString().slice(0, 10);
}

function addDaysUTC(dateStr, n) {
    const d = new Date(`${dateStr}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
}

function daysUntil(dateStr, today) {
    return Math.round((new Date(`${dateStr}T00:00:00Z`) - new Date(`${today}T00:00:00Z`)) / 86_400_000);
}

function dateRange(start, end) {
    const dates = [];
    let cur = start;
    while (cur <= end) {
        dates.push(cur);
        cur = addDaysUTC(cur, 1);
    }
    return dates;
}

function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

let cachedToken = null; // { token, exp } — 인스턴스 메모리 캐시(§2.3 "매 요청 서명은 낭비다")
async function weatherKitToken() {
    const now = Math.floor(Date.now() / 1000);
    if (cachedToken && cachedToken.exp - now > 60) return cachedToken.token;
    const pk = process.env.WEATHERKIT_PRIVATE_KEY.replace(/\\n/g, '\n');
    const key = await importPKCS8(pk, 'ES256');
    const exp = now + 3600;
    const token = await new SignJWT({ sub: process.env.WEATHERKIT_SERVICE_ID })
        .setProtectedHeader({
            alg: 'ES256',
            kid: process.env.WEATHERKIT_KEY_ID,
            id: `${process.env.WEATHERKIT_TEAM_ID}.${process.env.WEATHERKIT_SERVICE_ID}`,
        })
        .setIssuer(process.env.WEATHERKIT_TEAM_ID)
        .setIssuedAt(now)
        .setExpirationTime(exp)
        .sign(key);
    cachedToken = { token, exp };
    return token;
}

/** service_role 클라이언트 — weather_cache/climate_normals 쓰기는 이 권한만 허용된다(RLS).
 * 아직 키가 없으면 null을 돌려주고, 캐시 없이(=매번 WeatherKit 직접 호출) 동작한다. */
function supabaseAdmin() {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) return null;
    return createClient(url, serviceKey, { auth: { persistSession: false } });
}

function cacheTtlMs(dateStr, today) {
    return dateStr === today ? 60 * 60 * 1000 : 3 * 60 * 60 * 1000; // §3.3
}

async function readCachedDay(db, key, dateStr, today) {
    if (!db) return null;
    const { data, error } = await db
        .from('weather_cache')
        .select('payload, fetched_at')
        .eq('grid_key', key)
        .eq('date', dateStr)
        .eq('provider', 'weatherkit')
        .maybeSingle();
    if (error || !data) return null;
    const ageMs = Date.now() - new Date(data.fetched_at).getTime();
    if (ageMs > cacheTtlMs(dateStr, today)) return null;
    return data.payload;
}

async function writeCachedDay(db, key, dateStr, payload) {
    if (!db) return;
    await db.from('weather_cache').upsert(
        { grid_key: key, date: dateStr, provider: 'weatherkit', payload, fetched_at: new Date().toISOString() },
        { onConflict: 'grid_key,date,provider' },
    );
}

/** §5.2: 정확히 일치하는 격자가 없으면 반경 50km 내 가장 가까운 격자를 쓰고, 그것도 없으면 null */
async function readClimateNormal(db, key, month) {
    if (!db) return null;
    const { data: exact } = await db
        .from('climate_normals')
        .select('tmin_c, tmax_c, precip_mm')
        .eq('grid_key', key)
        .eq('month', month)
        .maybeSingle();
    if (exact) return exact;

    const [latStr, lngStr] = key.split(',');
    const lat = Number(latStr);
    const lng = Number(lngStr);
    const { data: candidates } = await db
        .from('climate_normals')
        .select('grid_key, tmin_c, tmax_c, precip_mm')
        .eq('month', month)
        .limit(2000); // climate_normals는 도시 수백 곳 규모라 전체 스캔이 감당 가능하다(§5.2)
    if (!candidates || candidates.length === 0) return null;

    let nearest = null;
    let nearestDist = Infinity;
    for (const c of candidates) {
        const [cLatStr, cLngStr] = c.grid_key.split(',');
        const dist = haversineKm(lat, lng, Number(cLatStr), Number(cLngStr));
        if (dist < nearestDist) {
            nearestDist = dist;
            nearest = c;
        }
    }
    return nearest && nearestDist <= 50 ? nearest : null;
}

async function fetchWeatherKit(lat, lng, lang, rangeStart, rangeEnd, needCurrent, needHourly) {
    const token = await weatherKitToken();
    const dataSets = ['forecastDaily'];
    if (needCurrent) dataSets.push('currentWeather');
    if (needHourly) dataSets.push('forecastHourly');
    const params = new URLSearchParams({
        dataSets: dataSets.join(','),
        timezone: 'UTC',
        dailyStart: `${rangeStart}T00:00:00Z`,
        dailyEnd: `${addDaysUTC(rangeEnd, 1)}T00:00:00Z`,
    });
    if (needHourly) {
        params.set('hourlyStart', `${rangeStart}T00:00:00Z`);
        params.set('hourlyEnd', `${addDaysUTC(rangeStart, 2)}T00:00:00Z`);
    }
    const url = `https://weatherkit.apple.com/api/v1/weather/${lang}/${lat}/${lng}?${params.toString()}`;
    const upstream = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!upstream.ok) {
        const text = await upstream.text().catch(() => '');
        throw new Error(`WeatherKit ${upstream.status}: ${text.slice(0, 200)}`);
    }
    return upstream.json();
}

export default async function handler(req, res) {
    applyCors(req, res);

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
    if (isRateLimited(ip)) {
        return res.status(429).json({ error: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.' });
    }

    const { lat, lng, start, end } = req.query || {};
    const lang = typeof req.query?.lang === 'string' && LANG_RE.test(req.query.lang) ? req.query.lang : 'ko';

    const latNum = Number(lat);
    const lngNum = Number(lng);
    if (!Number.isFinite(latNum) || latNum < -90 || latNum > 90) {
        return res.status(400).json({ error: '유효하지 않은 위도입니다.' });
    }
    if (!Number.isFinite(lngNum) || lngNum < -180 || lngNum > 180) {
        return res.status(400).json({ error: '유효하지 않은 경도입니다.' });
    }
    if (typeof start !== 'string' || !DATE_RE.test(start)) {
        return res.status(400).json({ error: '유효하지 않은 시작일입니다.' });
    }
    if (typeof end !== 'string' || !DATE_RE.test(end)) {
        return res.status(400).json({ error: '유효하지 않은 종료일입니다.' });
    }
    if (end < start) {
        return res.status(400).json({ error: '종료일은 시작일 이후여야 합니다.' });
    }

    const dates = dateRange(start, end);
    if (dates.length > MAX_RANGE_DAYS) {
        return res.status(400).json({ error: `한 번에 최대 ${MAX_RANGE_DAYS}일까지 조회할 수 있습니다.` });
    }

    const configured = !!(
        process.env.WEATHERKIT_TEAM_ID &&
        process.env.WEATHERKIT_SERVICE_ID &&
        process.env.WEATHERKIT_KEY_ID &&
        process.env.WEATHERKIT_PRIVATE_KEY
    );
    if (!configured) {
        return res.status(503).json({ error: '날씨 조회 서비스가 아직 설정되지 않았습니다.' });
    }

    const key = gridKey(latNum, lngNum);
    const today = todayUTC();
    const db = supabaseAdmin();

    const daily = [];
    const hourly = [];
    let current = null;
    let usedForecast = false;
    let usedClimateNormal = false;

    // §5.1: 오늘부터 FORECAST_RANGE_DAYS까지만 실제 예보, 그 이후는 평년값, 과거는 다루지 않는다
    // (WeatherKit REST의 과거 관측 데이터셋은 이번 라운드 스코프 밖 — §6.3대로 조용히 비운다)
    const forecastDates = dates.filter((d) => {
        const n = daysUntil(d, today);
        return n >= 0 && n <= FORECAST_RANGE_DAYS;
    });
    const climateDates = dates.filter((d) => daysUntil(d, today) > FORECAST_RANGE_DAYS);

    if (forecastDates.length > 0) {
        const uncached = [];
        for (const d of forecastDates) {
            const cached = await readCachedDay(db, key, d, today);
            if (cached) {
                daily.push(cached.daily);
                if (cached.current && d === today) current = cached.current;
                if (cached.hourly?.length) hourly.push(...cached.hourly);
            } else {
                uncached.push(d);
            }
        }

        if (uncached.length > 0) {
            const needCurrent = uncached.includes(today);
            const needHourly = uncached.includes(today) || uncached.includes(addDaysUTC(today, 1));
            try {
                const wk = await fetchWeatherKit(
                    latNum, lngNum, lang,
                    uncached[0], uncached[uncached.length - 1],
                    needCurrent, needHourly,
                );
                usedForecast = true;
                const days = wk.forecastDaily?.days ?? [];
                for (const day of days) {
                    const dateStr = day.forecastStart.slice(0, 10);
                    if (!uncached.includes(dateStr)) continue;

                    const dayHourly = needHourly
                        ? (wk.forecastHourly?.hours ?? [])
                              .filter((h) => h.forecastStart.slice(0, 10) === dateStr)
                              .map((h) => ({ time: h.forecastStart, tempC: h.temperature, conditionCode: h.conditionCode }))
                        : [];
                    const dayCurrent =
                        wk.currentWeather && dateStr === today
                            ? {
                                  tempC: wk.currentWeather.temperature,
                                  condition: wk.currentWeather.conditionCode,
                                  conditionCode: wk.currentWeather.conditionCode,
                                  isDaylight: wk.currentWeather.daylight,
                              }
                            : null;
                    const entry = {
                        date: dateStr,
                        tempMinC: day.temperatureMin,
                        tempMaxC: day.temperatureMax,
                        conditionCode: day.conditionCode,
                        precipChance: day.precipitationChance,
                        source: 'forecast',
                    };

                    daily.push(entry);
                    if (dayCurrent) current = dayCurrent;
                    hourly.push(...dayHourly);
                    await writeCachedDay(db, key, dateStr, { daily: entry, current: dayCurrent, hourly: dayHourly });
                }
            } catch (e) {
                console.error('[api/weather] WeatherKit upstream error:', e.message);
                // §6.3: 실패한 날짜는 daily에서 조용히 빠진다 — 에러를 응답 전체로 전파하지 않는다
            }
        }
    }

    for (const d of climateDates) {
        const month = Number(d.slice(5, 7));
        const normal = await readClimateNormal(db, key, month);
        if (normal) {
            usedClimateNormal = true;
            daily.push({
                date: d,
                tempMinC: normal.tmin_c,
                tempMaxC: normal.tmax_c,
                conditionCode: null,
                precipChance: null,
                source: 'climate_normal',
            });
        }
        // 평년값도 없으면 이 날짜는 daily에 아예 안 들어간다(§5.1 "영역 자체를 비운다")
    }

    daily.sort((a, b) => a.date.localeCompare(b.date));

    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=86400');
    return res.status(200).json({
        gridKey: key,
        source: usedForecast ? 'forecast' : usedClimateNormal ? 'climate_normal' : 'cache',
        fetchedAt: new Date().toISOString(),
        current,
        daily,
        hourly,
    });
}
