// 호텔명 검색 색인(0106 agoda_hotels)을 채운다 — extract_hotels.py 가 만든 NDJSON을 REST로 묶어서 upsert.
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/agoda/load_hotels.mjs <hotels.ndjson>
// 키는 환경 변수로만 받고 출력하지 않는다. 같은 hotel_id는 덮어쓴다(파일 갱신 때 다시 돌리면 된다).
import fs from 'node:fs';
import readline from 'node:readline';

const BATCH = 2000;
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const file = process.argv[2];
if (!url || !key || !file) {
    console.error('usage: SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/agoda/load_hotels.mjs <hotels.ndjson>');
    process.exit(1);
}

async function send(rows, attempt = 1) {
    const res = await fetch(`${url}/rest/v1/agoda_hotels?on_conflict=hotel_id`, {
        method: 'POST',
        headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(rows),
    });
    if (res.ok) return;
    const body = await res.text();
    if (attempt < 4 && (res.status >= 500 || res.status === 429)) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
        return send(rows, attempt + 1);
    }
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`);
}

const lines = readline.createInterface({ input: fs.createReadStream(file, 'utf8'), crlfDelay: Infinity });
let batch = [];
let total = 0;
const started = Date.now();
for await (const line of lines) {
    if (!line.trim()) continue;
    batch.push(JSON.parse(line));
    if (batch.length === BATCH) {
        await send(batch);
        total += batch.length;
        batch = [];
        if (total % 20000 === 0) console.log(`${total} rows, ${Math.round((Date.now() - started) / 1000)}s`);
    }
}
if (batch.length) {
    await send(batch);
    total += batch.length;
}
console.log(`done: ${total} rows in ${Math.round((Date.now() - started) / 1000)}s`);
