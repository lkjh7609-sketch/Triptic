/**
 * 공항 DB 갱신 스크립트 (04-document-ai.md §7.1)
 * 출처: OurAirports(퍼블릭 도메인) — https://ourairports.com/data/
 * "aviationstack에 공항 좌표를 의존하지 않는다"(§7.1) — 네트워크 실패에
 * 취약하고 호출 한도를 먹기 때문에, 번들에 포함하는 정적 JSON으로 둔다.
 *
 * 실행: node scripts/update-airports.js
 * 분기마다 재실행해 data/airports.json을 갱신한다(신규 공항·IATA 코드 변경 반영).
 *
 * 시간대(tz)는 OurAirports 데이터에 없어 tz-lookup(devDependency, 좌표→IANA
 * 시간대 오프라인 조회, CC0)으로 계산한다.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import tzlookup from 'tz-lookup';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.resolve(__dirname, '../data/airports.json');
const SOURCE_URL = 'https://davidmegginson.github.io/ourairports-data/airports.csv';

/** 따옴표로 감싼 필드(내부에 콤마·이스케이프된 "" 포함 가능) 대응 CSV 파서 */
function parseCsvLine(line) {
  const fields = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

async function main() {
  console.log(`📡 Fetching ${SOURCE_URL} ...`);
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  const csv = await res.text();

  const lines = csv.split('\n').filter(Boolean);
  const header = parseCsvLine(lines[0]);
  const col = Object.fromEntries(header.map((name, i) => [name, i]));

  const airports = {};
  let skippedNoTz = 0;

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]);
    const iata = fields[col.iata_code]?.trim();
    if (!iata || iata.length !== 3) continue;

    const lat = Number(fields[col.latitude_deg]);
    const lng = Number(fields[col.longitude_deg]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    let tz;
    try {
      tz = tzlookup(lat, lng);
    } catch {
      skippedNoTz++;
      continue;
    }

    airports[iata] = {
      name: fields[col.name]?.trim() || iata,
      city: fields[col.municipality]?.trim() || '',
      country: fields[col.iso_country]?.trim() || '',
      lat: Math.round(lat * 1e4) / 1e4,
      lng: Math.round(lng * 1e4) / 1e4,
      tz,
    };
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(airports, null, 0));

  const count = Object.keys(airports).length;
  const sizeKb = (fs.statSync(OUT_PATH).size / 1024).toFixed(0);
  console.log(`✅ ${count}개 공항 저장 완료 (${sizeKb}KB) → ${path.relative(process.cwd(), OUT_PATH)}`);
  if (skippedNoTz > 0) console.log(`⚠️ 시간대 조회 실패로 건너뛴 공항: ${skippedNoTz}개`);
}

main().catch((err) => {
  console.error('❌ 공항 DB 갱신 실패:', err);
  process.exit(1);
});
