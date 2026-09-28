// ⚠️ 자동 생성 파일 — 고치지 말 것. 원본: src/features/documents/parseBooking/pipeline.ts
// 다시 만들기: node scripts/build-doc-pipeline.mjs
// src/features/documents/parseBooking/airports.ts
function createAirportIndex(data) {
  return data;
}
function lookupAirport(index, iataCode) {
  if (!iataCode) return null;
  return index[iataCode.toUpperCase()] ?? null;
}

// src/features/documents/parseBooking/llm.ts
import { z as z2 } from "zod";

// src/features/documents/parseBooking/schema.ts
import { z } from "zod";
var Confidence = z.number().min(0).max(1);
var LOCAL_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
function F(v) {
  return z.object({ value: v.nullable(), confidence: Confidence });
}
var ParsedFlight = z.object({
  kind: z.literal("flight"),
  carrierIata: F(z.string().regex(/^[A-Z0-9]{2}$/)),
  carrierName: F(z.string()),
  flightNumber: F(z.string().regex(/^[A-Z0-9]{2}\d{1,4}$/)),
  departure: z.object({
    airportIata: F(z.string().length(3)),
    airportName: F(z.string()),
    terminal: F(z.string()),
    scheduledLocal: F(z.string().regex(LOCAL_DATETIME_RE)),
    /** LLM/파서가 채우지 않아도 된다(optional) — resolveFlightAirports()가 공항 DB
     * 조회 결과로 채운다. 커밋 시(§9) 지도 렌더링에 좌표가 필요해서 스키마에 넣었다
     * (신뢰도 없음 — 추출값이 아니라 DB 조회값). */
    airportLat: z.number().nullable().optional(),
    airportLng: z.number().nullable().optional()
  }),
  arrival: z.object({
    airportIata: F(z.string().length(3)),
    airportName: F(z.string()),
    terminal: F(z.string()),
    scheduledLocal: F(z.string().regex(LOCAL_DATETIME_RE)),
    airportLat: z.number().nullable().optional(),
    airportLng: z.number().nullable().optional()
  }),
  bookingReference: F(z.string()),
  seat: F(z.string()),
  cabinClass: F(z.enum(["economy", "premium_economy", "business", "first"]))
});
var ParsedLodging = z.object({
  kind: z.literal("lodging"),
  propertyName: F(z.string()),
  address: F(z.string()),
  checkInLocal: F(z.string().regex(LOCAL_DATETIME_RE)),
  checkOutLocal: F(z.string().regex(LOCAL_DATETIME_RE)),
  roomType: F(z.string()),
  guestCount: F(z.number().int().positive()),
  bookingReference: F(z.string()),
  phone: F(z.string())
});
var ParsedRail = z.object({
  kind: z.literal("rail"),
  carrierName: F(z.string()),
  trainNumber: F(z.string()),
  departure: z.object({
    stationName: F(z.string()),
    scheduledLocal: F(z.string().regex(LOCAL_DATETIME_RE))
  }),
  arrival: z.object({
    stationName: F(z.string()),
    scheduledLocal: F(z.string().regex(LOCAL_DATETIME_RE))
  }),
  seat: F(z.string()),
  bookingReference: F(z.string())
});
var ParsedCarRental = z.object({
  kind: z.literal("car_rental"),
  company: F(z.string()),
  vehicleType: F(z.string()),
  pickup: z.object({
    locationName: F(z.string()),
    scheduledLocal: F(z.string().regex(LOCAL_DATETIME_RE))
  }),
  dropoff: z.object({
    locationName: F(z.string()),
    scheduledLocal: F(z.string().regex(LOCAL_DATETIME_RE))
  }),
  bookingReference: F(z.string())
});
var ParsedActivity = z.object({
  kind: z.literal("activity"),
  name: F(z.string()),
  address: F(z.string()),
  scheduledLocal: F(z.string().regex(LOCAL_DATETIME_RE)),
  durationMinutes: F(z.number().int().positive()),
  bookingReference: F(z.string())
});
var ParsedBooking = z.discriminatedUnion("kind", [
  ParsedFlight,
  ParsedLodging,
  ParsedRail,
  ParsedCarRental,
  ParsedActivity
]);
var ParseResponse = z.object({
  documentId: z.string().uuid(),
  bookings: z.array(ParsedBooking),
  /** 'flight/korean-air@1.2' 또는 'llm/deepseek-flash' */
  parserUsed: z.string(),
  warnings: z.array(z.string())
});

// src/features/documents/parseBooking/llmNormalize.ts
var clamp01 = (n) => Math.max(0, Math.min(1, n));
function readLeaf(raw) {
  if (raw && typeof raw === "object" && !Array.isArray(raw) && "value" in raw) {
    const c = Number(raw.confidence);
    return { value: raw.value, confidence: Number.isFinite(c) ? clamp01(c) : 0.5 };
  }
  return { value: raw, confidence: 0.5 };
}
function leaf(raw, coerce) {
  const { value, confidence } = readLeaf(raw);
  if (value === null || value === void 0 || value === "") return { value: null, confidence: 0 };
  const v = coerce(value);
  return v === null ? { value: null, confidence: 0 } : { value: v, confidence };
}
var str = (v) => {
  if (typeof v === "number") return String(v);
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s : null;
};
var iata3 = (v) => {
  const s = str(v)?.toUpperCase().replace(/[^A-Z]/g, "");
  return s && s.length === 3 ? s : null;
};
var carrier2 = (v) => {
  const s = str(v)?.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return s && /^[A-Z0-9]{2}$/.test(s) ? s : null;
};
var flightNo = (v) => {
  const s = str(v)?.toUpperCase().replace(/[\s-]/g, "");
  return s && /^[A-Z0-9]{2}\d{1,4}$/.test(s) ? s : null;
};
var TERMINAL_PREFIX = /^(terminal|term\.?|t|터미널)\s*/i;
var terminal = (v) => {
  const s = str(v);
  if (!s) return null;
  const t = s.replace(TERMINAL_PREFIX, "").trim();
  return t || null;
};
function localDateTime(v) {
  const s = str(v);
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{1,2}):(\d{2}))?/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  if (Number(mo) < 1 || Number(mo) > 12 || Number(d) < 1 || Number(d) > 31) return null;
  if (h === void 0) return { value: `${y}-${mo}-${d}T00:00`, dateOnly: true };
  if (Number(h) > 23 || Number(mi) > 59) return null;
  return { value: `${y}-${mo}-${d}T${h.padStart(2, "0")}:${mi}`, dateOnly: false };
}
function dateTimeLeaf(raw) {
  const { value, confidence } = readLeaf(raw);
  const dt = localDateTime(value);
  if (!dt) return { value: null, confidence: 0 };
  return { value: dt.value, confidence: dt.dateOnly ? Math.min(confidence, 0.3) : confidence };
}
var cabin = (v) => {
  const s = str(v)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (!s) return null;
  if (/premium/.test(s) || s === "w") return "premium_economy";
  if (/econom|coach|일반|이코노미/.test(s) || s === "y") return "economy";
  if (/business|비즈니스|프레스티지|prestige/.test(s) || s === "c" || s === "j") return "business";
  if (/first|일등|퍼스트/.test(s) || s === "f") return "first";
  return null;
};
var positiveInt = (v) => {
  const n = typeof v === "number" ? v : Number(str(v)?.replace(/[^\d.]/g, ""));
  return Number.isInteger(n) && n > 0 ? n : null;
};
var obj = (v) => v && typeof v === "object" && !Array.isArray(v) ? v : {};
function flight(raw) {
  const dep = obj(raw.departure);
  const arr2 = obj(raw.arrival);
  const number = leaf(raw.flightNumber, flightNo);
  const carrier = leaf(raw.carrierIata, carrier2);
  if (!carrier.value && number.value) {
    carrier.value = number.value.slice(0, 2);
    carrier.confidence = number.confidence;
  }
  return {
    kind: "flight",
    carrierIata: carrier,
    carrierName: leaf(raw.carrierName, str),
    flightNumber: number,
    departure: {
      airportIata: leaf(dep.airportIata, iata3),
      airportName: leaf(dep.airportName, str),
      terminal: leaf(dep.terminal, terminal),
      scheduledLocal: dateTimeLeaf(dep.scheduledLocal)
    },
    arrival: {
      airportIata: leaf(arr2.airportIata, iata3),
      airportName: leaf(arr2.airportName, str),
      terminal: leaf(arr2.terminal, terminal),
      scheduledLocal: dateTimeLeaf(arr2.scheduledLocal)
    },
    bookingReference: leaf(raw.bookingReference, str),
    seat: leaf(raw.seat, str),
    cabinClass: leaf(raw.cabinClass, cabin)
  };
}
function lodging(raw) {
  return {
    kind: "lodging",
    propertyName: leaf(raw.propertyName, str),
    address: leaf(raw.address, str),
    checkInLocal: dateTimeLeaf(raw.checkInLocal),
    checkOutLocal: dateTimeLeaf(raw.checkOutLocal),
    roomType: leaf(raw.roomType, str),
    guestCount: leaf(raw.guestCount, positiveInt),
    bookingReference: leaf(raw.bookingReference, str),
    phone: leaf(raw.phone, str)
  };
}
function rail(raw) {
  const dep = obj(raw.departure);
  const arr2 = obj(raw.arrival);
  return {
    kind: "rail",
    carrierName: leaf(raw.carrierName, str),
    trainNumber: leaf(raw.trainNumber, str),
    departure: { stationName: leaf(dep.stationName, str), scheduledLocal: dateTimeLeaf(dep.scheduledLocal) },
    arrival: { stationName: leaf(arr2.stationName, str), scheduledLocal: dateTimeLeaf(arr2.scheduledLocal) },
    seat: leaf(raw.seat, str),
    bookingReference: leaf(raw.bookingReference, str)
  };
}
function carRental(raw) {
  const pu = obj(raw.pickup);
  const dof = obj(raw.dropoff);
  return {
    kind: "car_rental",
    company: leaf(raw.company, str),
    vehicleType: leaf(raw.vehicleType, str),
    pickup: { locationName: leaf(pu.locationName, str), scheduledLocal: dateTimeLeaf(pu.scheduledLocal) },
    dropoff: { locationName: leaf(dof.locationName, str), scheduledLocal: dateTimeLeaf(dof.scheduledLocal) },
    bookingReference: leaf(raw.bookingReference, str)
  };
}
function activity(raw) {
  return {
    kind: "activity",
    name: leaf(raw.name, str),
    address: leaf(raw.address, str),
    scheduledLocal: dateTimeLeaf(raw.scheduledLocal),
    durationMinutes: leaf(raw.durationMinutes, positiveInt),
    bookingReference: leaf(raw.bookingReference, str)
  };
}
function hasContent(b) {
  switch (b.kind) {
    case "flight":
      return !!(b.flightNumber.value || b.departure.scheduledLocal.value || b.departure.airportIata.value);
    case "lodging":
      return !!(b.propertyName.value || b.checkInLocal.value);
    case "rail":
      return !!(b.trainNumber.value || b.departure.scheduledLocal.value);
    case "car_rental":
      return !!(b.company.value || b.pickup.scheduledLocal.value);
    case "activity":
      return !!(b.name.value || b.scheduledLocal.value);
  }
}
var arr = (v) => Array.isArray(v) ? v.map(obj) : [];
function normalizeLlmEnvelope(raw) {
  const env = obj(raw);
  const out = [
    ...arr(env.flights).map(flight),
    ...arr(env.lodgings).map(lodging),
    ...arr(env.rail).map(rail),
    ...arr(env.carRentals).map(carRental),
    ...arr(env.activities).map(activity)
  ];
  for (const b of arr(env.bookings)) {
    if (b.kind === "flight") out.push(flight(b));
    else if (b.kind === "lodging") out.push(lodging(b));
    else if (b.kind === "rail") out.push(rail(b));
    else if (b.kind === "car_rental") out.push(carRental(b));
    else if (b.kind === "activity") out.push(activity(b));
  }
  return out.filter(hasContent);
}

// src/features/documents/parseBooking/llm.ts
var Envelope = z2.object({
  flights: z2.array(ParsedFlight.omit({ kind: true })),
  lodgings: z2.array(ParsedLodging.omit({ kind: true })),
  rail: z2.array(ParsedRail.omit({ kind: true })),
  carRentals: z2.array(ParsedCarRental.omit({ kind: true })),
  activities: z2.array(ParsedActivity.omit({ kind: true }))
});
var RESPONSE_SCHEMA = z2.toJSONSchema(Envelope);
var EXTRACTION_RULES = `You extract travel bookings from one document. The text came from PDF text extraction or from OCR of a photo/screenshot, converted to Markdown (tables may be Markdown pipes or HTML).

Output
1. Output one JSON object matching the provided schema. No prose, no markdown fences.
2. Every leaf is {"value": ..., "confidence": 0.0-1.0}. Confidence = how directly the value is printed; lower it when you inferred or corrected something.
3. NEVER invent values. If a field is not clearly present, use {"value": null, "confidence": 0}.
4. One entry per flight segment (a round trip is 2 flights; multi-city = one per leg). One entry per hotel stay. Train tickets (KTX, SRT, Shinkansen, Eurostar, Amtrak...) go to "rail", never "flights"; rail.trainNumber keeps the train type as printed ("KTX 023", "SRT 341", "ICE 578"). Tours, attraction tickets and activities go to "activities".

Dates and times
5. Return LOCAL date-time as printed at that place: "YYYY-MM-DDTHH:mm" (24-hour, no seconds, no timezone).
6. Convert 12-hour times: "3:00 PM" -> 15:00, "11:40pm" -> 23:40, "\uC624\uD6C4 4:00" -> 16:00, "\uC624\uC804 11:00" -> 11:00. "2355" in a ticket time column means 23:55.
7. Date formats you will see: 07OCT26, 07 Oct 2026, Wed 07 Oct 2026, Nov 16, 2026, 2026.10.07, 2026-10-07, 2026\uB144 10\uC6D4 7\uC77C, 10\uC6D4 7\uC77C (\uC218), 22/03/2027 (day/month/year outside the US). If the year is missing, choose the year that puts the date inside or nearest to the trip dates.
8. "+1" / "+1\uC77C" / "(+1)" after a time means the next calendar day. Long overnight flights arrive on a later date than they depart.
9. A printed departure time (Departure, Dep, STD, \uCD9C\uBC1C, \uCD9C\uBC1C \uC2DC\uAC01) is the departure time, also on boarding passes. Only when NO departure time is printed and the document shows just the flight date plus a boarding time (Boarding, \uD0D1\uC2B9 \uC2DC\uAC01), return the date alone ("YYYY-MM-DD") for departure.scheduledLocal with confidence <= 0.3 \u2014 the boarding time is not the departure time. Leave arrival null if it is not printed.
10. Hotel check-in/check-out: combine the date with the stated time ("from 3:00 PM" -> 15:00, "14:00 \uC774\uD6C4" -> 14:00, "until 12:00 PM" -> 12:00, "11:00 \uC774\uC804" -> 11:00). If no time is printed, use T00:00 with confidence <= 0.3.

OCR errors (the text may contain them)
11. Look-alike characters get swapped: letter O vs digit 0, I/l vs 1, S vs 5, B vs 8, Z vs 2, D vs 0, T vs I. Inside dates, times, flight numbers and airport codes, read them as the only sensible value (070CT26 = 07OCT26, 0Z104 = OZ104, O8:1O = 08:10, 1140pm = 11:40pm). If you corrected a character, cap that field's confidence at 0.7.
12. Airport codes: use the city names and the other segments of the same document to pick the right code when OCR mangled it (e.g. a Tokyo route printed as "NRI" is NRT). Only return a code that is printed or clearly intended; never derive a code from a city name alone.
13. OCR of tables may split one value across lines or cells, or glue a label onto a value (e.g. "QF7T9M Frequent flyer" in one cell, a name split over two lines, "BA" and "2714" in separate lines). Reassemble values by meaning, not by position.
14. Korean OCR can misspell common words (\uD2B8\uC6D0 -> \uD2B8\uC708, \uC2A4\uD150\uB2E4\uB4DC -> \uC2A4\uD0E0\uB2E4\uB4DC, \uC2B9\uACA9 -> \uC2B9\uAC1D). Fix obvious typos in common words, but copy proper nouns (hotel, property, place and person names) exactly as printed.

Identifiers
15. bookingReference: the airline PNR / \uC608\uC57D\uBC88\uD638 / booking or confirmation code, usually 5-8 letters and digits. It is NOT the 13-digit ticket number (e.g. 180-2384756190, 081 2193847560) and NOT a payment or order id when a separate PNR exists. For a flight booked through a travel agency, prefer the airline PNR ("airline confirmation", "\uD56D\uACF5\uC0AC \uC608\uC57D\uBC88\uD638") over the agency itinerary number. For lodging use the hotel or booking-site confirmation number.
16. Numeric booking numbers are often printed in groups separated by spaces, dots or hyphens (1587 2093 44, 4127.339.058, IP-7734-2291), and OCR may shift the spaces (15872093 44). Keep every group of the same number together in one reference. Copy booking references exactly as printed; never "correct" their characters. If one contains O, 0, I, 1, L, S, 5, B, 8, Z or 2, cap its confidence at 0.6.
17. flightNumber: 2-character airline code + 1-4 digits, no space ("BA 2714" -> "BA2714", "OZ 102" -> "OZ102"). carrierIata = that code. For code-share lines ("Operated by ..."), keep the flight number printed for the segment.
18. terminal: only the identifier ("T1", "Terminal 1", "\uD130\uBBF8\uB110 1" -> "1"). cabinClass: economy / premium_economy / business / first (\uC77C\uBC18\uC11D, Economy, Y and other economy fare letters -> economy; \uBE44\uC988\uB2C8\uC2A4, Business, C, J -> business; First, \uC77C\uB4F1\uC11D, F -> first).
19. Values like [PASSPORT], [CARD], [EMAIL], [PHONE], [NATIONAL_ID], [MEMBER_NO] are redacted. Treat them as absent and do not reconstruct them.`;
function buildPrompt(maskedText, hints, tripStart, tripEnd) {
  return `${EXTRACTION_RULES}

Rule-based candidates (a simple regex pass \u2014 often incomplete or mixed up on multi-segment documents; the document text always wins when they conflict):
${hints || "(none)"}

Trip dates: ${tripStart} to ${tripEnd}

Document text:
${maskedText}`;
}
function extractJson(text) {
  let jsonStr = text.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  }
  try {
    return JSON.parse(jsonStr);
  } catch {
    const m = jsonStr.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : null;
  }
}
function providers(keys, effort) {
  const list = [];
  if (keys.deepseekApiKey) {
    list.push({
      id: "llm/deepseek-flash",
      url: "https://api.deepseek.com/chat/completions",
      key: keys.deepseekApiKey,
      model: "deepseek-flash",
      // 기본은 추론 켜짐·강도 high(느리고 가끔 40초 넘게 걸림) — 명시적으로 고른다
      extra: effort === "fast" ? { thinking: { type: "disabled" } } : { reasoning_effort: "low" }
    });
  }
  if (keys.openrouterApiKey) {
    list.push({
      id: "llm/openrouter-deepseek",
      url: "https://openrouter.ai/api/v1/chat/completions",
      key: keys.openrouterApiKey,
      model: "deepseek/deepseek-chat",
      headers: { "HTTP-Referer": "https://triptic.my", "X-Title": "Triptic" }
    });
  }
  return list;
}
var MIN_ATTEMPT_MS = 1500;
var ATTEMPT_CAP_MS = { fast: 12e3, careful: 3e4 };
async function callProvider(p, prompt, deadline, capMs) {
  if (deadline - Date.now() < MIN_ATTEMPT_MS) return null;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), Math.max(500, Math.min(capMs, deadline - Date.now() - 200)));
  try {
    const res = await fetch(p.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${p.key}`, "Content-Type": "application/json", ...p.headers },
      body: JSON.stringify({
        model: p.model,
        messages: [
          {
            role: "system",
            content: "You extract structured travel booking JSON. Always respond strictly in valid JSON without markdown formatting, matching this schema: " + JSON.stringify(RESPONSE_SCHEMA)
          },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0,
        ...p.extra
      }),
      signal: controller.signal
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text) return null;
    const raw = extractJson(text);
    if (!raw || typeof raw !== "object") return null;
    return normalizeLlmEnvelope(raw);
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
async function extractWithLLM(maskedText, hints, tripStart, tripEnd, keys, totalBudgetMs = 3e4, effort = "fast") {
  const list = providers(keys, effort);
  if (list.length === 0) return null;
  const deadline = Date.now() + totalBudgetMs;
  const prompt = buildPrompt(maskedText, hints, tripStart, tripEnd);
  const attempts = effort === "fast" ? [list[0], list[0], ...list.slice(1)] : list;
  for (const p of attempts) {
    if (Date.now() >= deadline) break;
    const bookings = await callProvider(p, prompt, deadline, ATTEMPT_CAP_MS[effort]);
    if (bookings) return { bookings, parserUsed: p.id };
  }
  return null;
}

// src/features/documents/parseBooking/ocrNormalize.ts
var AIRLINE_CODES = new Set(
  // 한국
  "KE OZ 7C LJ TW ZE BX RS RF YP 4V JL NH MM GK BC 7G HD NU 6J IJ CX UO HX KA CI BR IT JX AE B7 CA MU CZ HU 3U ZH MF FM HO 9C SC GS KN NS SQ TR MI 3K TG FD SL WE VZ PG VN VJ QH BL PR 5J Z2 DG MH AK D7 OD GA QZ JT ID BI AI 6E UK SG IX QG UL KC EK EY QR WY GF SV MS TK PC RJ ME KU XY FZ G9 ET KQ SA AT WB LH LX OS SN LO OK EW 4U AF KL BA VS EI FR U2 W6 VY IB UX TP AZ SK AY DY DX A3 OA RO JU OU LG BT AA UA DL AS B6 WN NK F9 HA AC WS LA AV AM CM AR G3 AD QF VA JQ NZ FJ".split(" ")
);
var MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
var DIGIT_TO_LETTERS = {
  "0": ["O", "D", "Q"],
  "1": ["I", "L"],
  "2": ["Z"],
  "5": ["S"],
  "6": ["G"],
  "8": ["B"]
};
var LETTER_TO_DIGIT = { O: "0", o: "0", D: "0", Q: "0", I: "1", l: "1", L: "1", "|": "1", Z: "2", z: "2", S: "5", s: "5", G: "6", B: "8" };
function letterVariants(token) {
  const upper = token.toUpperCase();
  let variants = [""];
  let changed = 0;
  for (const ch of upper) {
    const options = DIGIT_TO_LETTERS[ch];
    if (options) {
      changed += 1;
      variants = variants.flatMap((v) => options.map((o) => v + o));
    } else {
      variants = variants.map((v) => v + ch);
    }
    if (changed > 2) return [];
  }
  return variants;
}
function fixMonthTokens(text) {
  return text.replace(/\b(\d{1,2})(\s?)([A-Za-z0-9]{3})(\s?)(\d{2}(?:\d{2})?)?(?![A-Za-z0-9])/g, (m, day, s1, mon, s2, year) => {
    const upperMon = mon.toUpperCase();
    if (MONTHS.includes(upperMon)) return m;
    if (!/\d/.test(mon) || !/[A-Za-z]/.test(mon)) return m;
    const hit = letterVariants(mon).find((v) => MONTHS.includes(v));
    if (!hit) return m;
    const out = mon === mon.toLowerCase() ? hit.toLowerCase() : mon === upperMon ? hit : hit[0] + hit.slice(1).toLowerCase();
    return `${day}${s1}${out}${s2}${year ?? ""}`;
  });
}
function toDigits(s) {
  return s.replace(/[OoDQIlL|ZzSsGB]/g, (c) => LETTER_TO_DIGIT[c] ?? c);
}
function fixFlightNumbers(text) {
  return text.replace(/(?<![A-Za-z0-9./:-])([A-Za-z0-9]{2})(\s?)([0-9OoIlL|]{1,4})(?![a-z0-9:]|[A-Z](?![A-Z]{2}(?![A-Za-z0-9])))/g, (m, code, sp, num) => {
    if (!/\d/.test(num)) return m;
    const upperCode = code.toUpperCase();
    let fixedCode = AIRLINE_CODES.has(upperCode) && code === upperCode ? upperCode : null;
    if (!fixedCode) {
      const allDigits = /^\d{2}$/.test(code);
      const variants = allDigits ? /0/.test(code) ? [code.replace(/0/g, "O").replace(/2/g, "Z")] : [] : letterVariants(code);
      const candidate = variants.find((v) => AIRLINE_CODES.has(v) && /^[A-Z]{2}$|^[A-Z0-9]{2}$/.test(v) && /[A-Z]/.test(v));
      if (!candidate) return m;
      if (allDigits && (sp === "" || num.length < 3)) return m;
      if (!allDigits && code !== upperCode && !/^[a-z][A-Z0-9]|[A-Z0-9][a-z]$/.test(code)) return m;
      fixedCode = candidate;
    }
    const fixedNum = toDigits(num);
    if (!/^\d{1,4}$/.test(fixedNum)) return m;
    if (fixedCode === code && fixedNum === num) return m;
    return `${fixedCode}${sp}${fixedNum}`;
  });
}
function fixNumericRuns(text) {
  return text.replace(/(?<![A-Za-z0-9])[0-9OoIl|][0-9OoIl|.,:/-]*[0-9OoIl|](?![A-Za-z0-9])/g, (m) => {
    if (!/[OoIl|]/.test(m)) return m;
    const digits = (m.match(/\d/g) ?? []).length;
    const letters = (m.match(/[OoIl|]/g) ?? []).length;
    if (digits === 0) return m;
    const fixed = m.replace(/[OoIl|]/g, (c) => LETTER_TO_DIGIT[c]);
    const looksLikeTimeOrDate = /^\d{1,2}:\d{2}$|^\d{4}[./-]\d{1,2}[./-]\d{1,2}$|^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(fixed);
    if (!/^\d/.test(m) && digits <= letters && !looksLikeTimeOrDate) return m;
    return fixed;
  });
}
function fixCompactTimes(text) {
  return text.replace(/\b(\d{1,2})[\s.]?(\d{2})\s?([AaPp][Mm])\b/g, (m, h, mm, ap) => {
    const hour = Number(h);
    const min = Number(mm);
    if (hour < 1 || hour > 12 || min > 59) return m;
    if (m.includes(":")) return m;
    const space = /\s[AaPp][Mm]$/.test(m) ? " " : "";
    return `${hour}:${mm}${space}${ap}`;
  });
}
function fixKrwAmounts(text) {
  let s = text.replace(/(?<![A-Za-z])[W\\]\s?(?=\d{1,3}(?:[,.]\d{3})+(?!\d))/g, "\u20A9");
  s = s.replace(/(KRW|₩)(\s?)(\d{1,3}(?:[.,]?\d{3})+)(?![\d.,])/g, (m, cur, sp, num) => {
    if (!num.includes(".")) return m;
    const plain = num.replace(/[.,]/g, "");
    return `${cur}${sp}${Number(plain).toLocaleString("en-US")}`;
  });
  s = s.replace(/(?<![\d.,])(\d{1,3}(?:[.,]\d{3})+)(\s?원)/g, (m, num, won) => {
    if (!num.includes(".")) return m;
    return `${Number(num.replace(/[.,]/g, "")).toLocaleString("en-US")}${won}`;
  });
  return s;
}
function fixCodeCase(text) {
  return text.replace(/(?<![A-Za-z0-9])[A-Za-z0-9]{5,10}(?![A-Za-z0-9])/g, (m) => {
    const lower = (m.match(/[a-z]/g) ?? []).length;
    const upper = (m.match(/[A-Z]/g) ?? []).length;
    const digits = (m.match(/\d/g) ?? []).length;
    if (lower === 0 || lower > 2 || upper < 2 || digits < 1) return m;
    return m.toUpperCase();
  });
}
function fixAirportCodes(text, isAirport) {
  const fix = (code) => {
    if (isAirport(code) && code === code.toUpperCase()) return code;
    return letterVariants(code).find(isAirport) ?? code;
  };
  let s = text.replace(/\(([A-Za-z0-9]{3})\)/g, (m, code) => {
    if (!/\d/.test(code) && code === code.toUpperCase()) return m;
    return `(${fix(code)})`;
  });
  s = s.replace(/(?<![A-Za-z0-9])([A-Za-z0-9]{3})(\s?(?:→|->|–|-)\s?)([A-Za-z0-9]{3})(?![A-Za-z0-9])/g, (_m, a, arrow, b) => {
    const fa = /\d/.test(a) ? fix(a) : a;
    const fb = /\d/.test(b) ? fix(b) : b;
    return `${fa}${arrow}${fb}`;
  });
  return s;
}
function normalizeOcrText(text, options = {}) {
  let s = text;
  s = fixMonthTokens(s);
  s = fixNumericRuns(s);
  s = fixFlightNumbers(s);
  s = fixCompactTimes(s);
  s = fixKrwAmounts(s);
  s = fixCodeCase(s);
  if (options.isAirport) s = fixAirportCodes(s, options.isAirport);
  return s;
}
function hasAmbiguousChars(code) {
  return /[O0I1LS5B8Z2]/.test(code.toUpperCase());
}

// src/features/documents/parseBooking/patterns.ts
var FLIGHT_NUMBER = /\b([A-Z]{2}|[A-Z]\d|\d[A-Z])\s?(\d{1,4})\b/g;
var PNR = /\b([A-Z0-9]{6})\b/g;
var TIME_24H = /\b([01]?\d|2[0-3]):([0-5]\d)\b/g;

// src/features/documents/parseBooking/parsers/flight/generic-iata.ts
var AIRPORT_CODE_CANDIDATE = /\b[A-Z]{3}\b/g;
var PNR_LABEL_NEAR = /(booking reference|confirmation|pnr|예약번호|예약\s*번호)/i;
function field(value, confidence) {
  return { value, confidence };
}
function findAirportCodes(text, ctx) {
  const found = [];
  const seen = /* @__PURE__ */ new Set();
  for (const m of text.matchAll(AIRPORT_CODE_CANDIDATE)) {
    const code = m[0];
    if (seen.has(code)) continue;
    if (!lookupAirport(ctx.airports, code)) continue;
    seen.add(code);
    found.push(code);
  }
  return found;
}
function findFirstDateIso(text) {
  const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const slash = text.match(/(\d{4})[./](\d{1,2})[./](\d{1,2})/);
  if (slash) return `${slash[1]}-${slash[2].padStart(2, "0")}-${slash[3].padStart(2, "0")}`;
  return null;
}
function findBookingReference(text) {
  const lines = text.split("\n");
  for (const line of lines) {
    if (PNR_LABEL_NEAR.test(line)) {
      const m2 = line.match(/\b([A-Z0-9]{6})\b/);
      if (m2) return field(m2[1], 0.8);
    }
  }
  PNR.lastIndex = 0;
  const m = PNR.exec(text);
  return m ? field(m[1], 0.4) : field(null, 0);
}
var genericIataParser = {
  id: "flight/generic-iata",
  version: "1.0.0",
  detect(text) {
    FLIGHT_NUMBER.lastIndex = 0;
    const hasFlightNo = FLIGHT_NUMBER.test(text);
    TIME_24H.lastIndex = 0;
    const hasTime = TIME_24H.test(text);
    const airportCount = new Set(text.match(AIRPORT_CODE_CANDIDATE) ?? []).size;
    if (hasFlightNo && hasTime && airportCount >= 2) return 0.75;
    if (hasFlightNo && airportCount >= 2) return 0.5;
    return 0;
  },
  parse(text, ctx) {
    FLIGHT_NUMBER.lastIndex = 0;
    const flightMatch = FLIGHT_NUMBER.exec(text);
    const flightNumber = flightMatch ? `${flightMatch[1]}${flightMatch[2]}` : null;
    const airportCodes = findAirportCodes(text, ctx);
    const depCode = airportCodes[0] ?? null;
    const arrCode = airportCodes[1] ?? null;
    TIME_24H.lastIndex = 0;
    const times = [];
    for (const m of text.matchAll(TIME_24H)) times.push(`${m[1].padStart(2, "0")}:${m[2]}`);
    const depTime = times[0] ?? null;
    const arrTime = times[1] ?? null;
    const dateIso = findFirstDateIso(text);
    const depLocal = dateIso && depTime ? `${dateIso}T${depTime}` : null;
    const arrLocal = dateIso && arrTime ? `${dateIso}T${arrTime}` : null;
    const depAirport = depCode ? lookupAirport(ctx.airports, depCode) : null;
    const arrAirport = arrCode ? lookupAirport(ctx.airports, arrCode) : null;
    const flight2 = {
      kind: "flight",
      carrierIata: field(flightNumber ? flightNumber.slice(0, 2) : null, flightNumber ? 0.7 : 0),
      carrierName: field(null, 0),
      flightNumber: field(flightNumber, flightNumber ? 0.8 : 0),
      departure: {
        airportIata: field(depCode, depAirport ? 0.9 : 0),
        airportName: field(depAirport?.name ?? null, depAirport ? 0.9 : 0),
        terminal: field(null, 0),
        scheduledLocal: field(depLocal, depLocal ? 0.7 : 0)
      },
      arrival: {
        airportIata: field(arrCode, arrAirport ? 0.9 : 0),
        airportName: field(arrAirport?.name ?? null, arrAirport ? 0.9 : 0),
        terminal: field(null, 0),
        scheduledLocal: field(arrLocal, arrLocal ? 0.7 : 0)
      },
      bookingReference: findBookingReference(text),
      seat: field(null, 0),
      cabinClass: field(null, 0)
    };
    return [flight2];
  }
};

// src/features/documents/parseBooking/parsers/registry.ts
function selectParser(parsers, text) {
  let best = null;
  let bestScore = 0;
  for (const parser of parsers) {
    const score = parser.detect(text);
    if (score >= 0.7 && score > bestScore) {
      best = parser;
      bestScore = score;
    }
  }
  return best;
}

// src/features/documents/parseBooking/parsers/index.ts
var ALL_PARSERS = [genericIataParser];

// src/features/documents/parseBooking/redact.ts
function luhnValid(digits) {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}
var RULES = [
  // 여권번호 (한국 M12345678, 일반 2글자+7~8자리)
  [/\b[A-Z]{1,2}\d{7,8}\b/g, "[PASSPORT]"],
  // 신용카드 (13~19자리, 공백·하이픈 구분 허용) — 카드 검증식을 통과할 때만
  [/(?<![\w-])\d(?:[ -]?\d){12,18}(?![\w-])/g, (m) => luhnValid(m.replace(/\D/g, "")) ? "[CARD]" : null],
  // 주민등록번호
  [/\b\d{6}[-\s]?[1-4]\d{6}\b/g, "[NATIONAL_ID]"],
  // 생년월일 라벨 뒤 값
  [/\b(DOB|Date of Birth|생년월일|出生日期)\s*[:：]?\s*\S+/gi, "$1: [DOB]"],
  // 이메일
  [/\b[\w.+-]+@[\w-]+\.[\w.]+\b/g, "[EMAIL]"],
  // 전화번호 — 국제(+82 2 1234 5678, +82-10-1234-5678)
  [/(?<![\w+])\+\d{1,3}(?:[\s.-]?\(?\d{1,4}\)?){2,4}(?![\w-])/g, "[PHONE]"],
  // 전화번호 — 한국(010-1234-5678, 02-123-4567, 01012345678, 031 123 4567)
  [/(?<![\w-])0\d{1,2}[-\s.)]?\d{3,4}[-\s.]?\d{4}(?![\w-])/g, "[PHONE]"],
  // 전화번호 — 북미((212) 555-1234, 212-555-1234)
  [/(?<![\w-])(?:\(\d{3}\)\s?|\d{3}[-.\s])\d{3}[-.\s]\d{4}(?![\w-])/g, "[PHONE]"],
  // 마일리지·회원번호
  [/\b(FFP|Membership|회원번호|마일리지)\s*[:：]?\s*\S+/gi, "$1: [MEMBER_NO]"]
];
function redact(text) {
  const hits = [];
  let out = text;
  for (const [re, rep] of RULES) {
    out = out.replace(re, (m, ...args) => {
      if (typeof rep === "function") {
        const replaced = rep(m);
        if (replaced === null) return m;
        hits.push(replaced);
        return replaced;
      }
      hits.push(rep.replace(/\$\d/g, ""));
      const g0 = args[0];
      return typeof g0 === "string" && rep.includes("$1") ? rep.replace("$1", g0) : rep;
    });
  }
  return { text: out, hits };
}

// src/features/documents/parseBooking/sourceWeight.ts
function sourceWeight(parserUsed, detectScore, fromOcr = false) {
  if (parserUsed.startsWith("pkpass/") || parserUsed.startsWith("ics/")) return 1;
  if (parserUsed.startsWith("llm/")) return fromOcr ? 0.8 : 0.85;
  const base = detectScore != null && detectScore >= 0.9 ? 0.98 : 0.92;
  return fromOcr ? base - 0.1 : base;
}
function isConfidenceLeaf(v) {
  return typeof v === "object" && v !== null && "value" in v && "confidence" in v && typeof v.confidence === "number";
}
function applySourceWeight(booking, weight) {
  if (isConfidenceLeaf(booking)) {
    return { value: booking.value, confidence: Math.max(0, Math.min(1, booking.confidence * weight)) };
  }
  if (Array.isArray(booking)) {
    return booking.map((item) => applySourceWeight(item, weight));
  }
  if (booking && typeof booking === "object") {
    const out = {};
    for (const [k, v] of Object.entries(booking)) {
      out[k] = applySourceWeight(v, weight);
    }
    return out;
  }
  return booking;
}

// src/features/documents/parseBooking/validate.ts
import { fromZonedTime } from "date-fns-tz";
var FLIGHT_NUMBER_RE = /^[A-Z0-9]{2}\d{1,4}$/;
var CRUISE_KMH = 800;
var GROUND_OVERHEAD_MIN = 30;
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function isWithinTripRange(dateLocal, ctx) {
  const date = dateLocal.slice(0, 10);
  const start = addDaysIso(ctx.tripStartDate, -1);
  const end = addDaysIso(ctx.tripEndDate, 1);
  return date >= start && date <= end;
}
function addDaysIso(iso, days) {
  const d = /* @__PURE__ */ new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function verifyParsedFlight(flight2, ctx) {
  const warnings = [];
  const next = structuredClone(flight2);
  const depAirport = lookupAirport(ctx.airports, next.departure.airportIata.value);
  if (next.departure.airportIata.value && !depAirport) {
    next.departure.airportIata = { value: null, confidence: 0 };
    warnings.push("\uCD9C\uBC1C \uACF5\uD56D \uCF54\uB4DC\uAC00 \uC2E4\uC7AC \uACF5\uD56D DB\uC5D0 \uC5C6\uC5B4 \uBE44\uC6E0\uC2B5\uB2C8\uB2E4.");
  }
  next.departure.airportLat = depAirport?.lat ?? null;
  next.departure.airportLng = depAirport?.lng ?? null;
  const arrAirport = lookupAirport(ctx.airports, next.arrival.airportIata.value);
  if (next.arrival.airportIata.value && !arrAirport) {
    next.arrival.airportIata = { value: null, confidence: 0 };
    warnings.push("\uB3C4\uCC29 \uACF5\uD56D \uCF54\uB4DC\uAC00 \uC2E4\uC7AC \uACF5\uD56D DB\uC5D0 \uC5C6\uC5B4 \uBE44\uC6E0\uC2B5\uB2C8\uB2E4.");
  }
  next.arrival.airportLat = arrAirport?.lat ?? null;
  next.arrival.airportLng = arrAirport?.lng ?? null;
  if (next.flightNumber.value && !FLIGHT_NUMBER_RE.test(next.flightNumber.value)) {
    next.flightNumber.confidence = Math.min(next.flightNumber.confidence, 0.3);
    warnings.push("\uD3B8\uBA85 \uD615\uC2DD\uC774 \uC77C\uBC18\uC801\uC774\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
  }
  const depLocal = next.departure.scheduledLocal.value;
  const arrLocal = next.arrival.scheduledLocal.value;
  if (depAirport && arrAirport && depLocal && arrLocal) {
    const depUtc = fromZonedTime(depLocal, depAirport.tz);
    const arrUtc = fromZonedTime(arrLocal, arrAirport.tz);
    const durationMin = (arrUtc.getTime() - depUtc.getTime()) / 6e4;
    if (durationMin <= 0) {
      next.arrival.scheduledLocal.confidence = Math.min(next.arrival.scheduledLocal.confidence, 0.4);
      warnings.push("\uB3C4\uCC29 \uC2DC\uAC01\uC774 \uCD9C\uBC1C \uC2DC\uAC01\uBCF4\uB2E4 \uBE60\uB974\uAC70\uB098 \uAC19\uC2B5\uB2C8\uB2E4.");
    } else {
      const distanceKm = haversineKm(depAirport.lat, depAirport.lng, arrAirport.lat, arrAirport.lng);
      const expectedMin = distanceKm / CRUISE_KMH * 60 + GROUND_OVERHEAD_MIN;
      const ratio = durationMin / expectedMin;
      if (ratio < 0.6 || ratio > 2) {
        next.arrival.scheduledLocal.confidence = Math.min(next.arrival.scheduledLocal.confidence, 0.5);
        warnings.push("\uBE44\uD589 \uC2DC\uAC04\uC774 \uB450 \uACF5\uD56D \uAC04 \uAC70\uB9AC\uC5D0 \uBE44\uD574 \uBE44\uC815\uC0C1\uC801\uC785\uB2C8\uB2E4.");
      }
    }
  }
  if (depLocal && !isWithinTripRange(depLocal, ctx)) {
    next.departure.scheduledLocal.confidence = Math.min(next.departure.scheduledLocal.confidence, 0.5);
    warnings.push("\uCD9C\uBC1C\uC77C\uC774 \uC5EC\uD589 \uAE30\uAC04\uACFC \uB9DE\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4 \u2014 \uB2E4\uB978 \uC5EC\uD589\uC758 \uC608\uC57D\uC778\uAC00\uC694?");
  }
  return { flight: next, warnings };
}
function verifyParsedLodging(lodging2, ctx) {
  const warnings = [];
  const next = structuredClone(lodging2);
  const checkIn = next.checkInLocal.value;
  const checkOut = next.checkOutLocal.value;
  if (checkIn && checkOut && checkOut <= checkIn) {
    next.checkOutLocal.confidence = Math.min(next.checkOutLocal.confidence, 0.4);
    warnings.push("\uCCB4\uD06C\uC544\uC6C3\uC774 \uCCB4\uD06C\uC778\uBCF4\uB2E4 \uBE60\uB974\uAC70\uB098 \uAC19\uC2B5\uB2C8\uB2E4.");
  }
  if (checkIn && !isWithinTripRange(checkIn, ctx)) {
    next.checkInLocal.confidence = Math.min(next.checkInLocal.confidence, 0.5);
    warnings.push("\uCCB4\uD06C\uC778 \uB0A0\uC9DC\uAC00 \uC5EC\uD589 \uAE30\uAC04\uACFC \uB9DE\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4 \u2014 \uB2E4\uB978 \uC5EC\uD589\uC758 \uC608\uC57D\uC778\uAC00\uC694?");
  }
  return { lodging: next, warnings };
}

// src/features/documents/parseBooking/pipeline.ts
function describeHints(bookings) {
  return bookings.filter((b) => b.kind === "flight").map(
    (f) => [
      f.flightNumber.value && `flight ${f.flightNumber.value}`,
      f.departure.airportIata.value && `from ${f.departure.airportIata.value}`,
      f.arrival.airportIata.value && `to ${f.arrival.airportIata.value}`,
      f.departure.scheduledLocal.value && `departs ${f.departure.scheduledLocal.value}`,
      f.bookingReference.value && `ref ${f.bookingReference.value}`
    ].filter(Boolean).join(", ")
  ).filter(Boolean).join("\n");
}
function agreeWithParser(llm, parser) {
  const parserFlights = parser.filter((b) => b.kind === "flight");
  return llm.map((b) => {
    if (b.kind !== "flight" || !b.flightNumber.value) return b;
    const p = parserFlights.find((x) => x.flightNumber.value === b.flightNumber.value);
    if (!p) return b;
    const next = structuredClone(b);
    const bump = (a, c) => {
      if (a.value !== null && a.value === c.value) a.confidence = Math.max(a.confidence, c.confidence);
    };
    bump(next.flightNumber, p.flightNumber);
    bump(next.departure.airportIata, p.departure.airportIata);
    bump(next.arrival.airportIata, p.arrival.airportIata);
    bump(next.departure.scheduledLocal, p.departure.scheduledLocal);
    bump(next.arrival.scheduledLocal, p.arrival.scheduledLocal);
    bump(next.bookingReference, p.bookingReference);
    return next;
  });
}
function needsCarefulPass(bookings, ctx) {
  for (const b of bookings) {
    if (b.kind === "flight") {
      if (verifyParsedFlight(b, ctx).warnings.length > 0) return true;
      if (!b.flightNumber.value || !b.departure.airportIata.value || !b.arrival.airportIata.value || !b.departure.scheduledLocal.value) return true;
    } else if (b.kind === "lodging") {
      if (verifyParsedLodging(b, ctx).warnings.length > 0) return true;
      if (!b.propertyName.value || !b.checkInLocal.value || !b.checkOutLocal.value || !b.bookingReference.value) return true;
    }
  }
  return false;
}
function capAmbiguousReference(b) {
  const ref = b.bookingReference;
  if (typeof ref.value !== "string" || !hasAmbiguousChars(ref.value)) return b;
  return { ...b, bookingReference: { value: ref.value, confidence: Math.min(ref.confidence, 0.6) } };
}
async function runBookingPipeline(input, deps) {
  const warnings = [];
  const isAirport = (code) => lookupAirport(deps.airports, code) !== null;
  const corrected = input.fromOcr ? normalizeOcrText(input.text, { isAirport }) : input.text;
  const { text: masked } = redact(corrected);
  const parseCtx = { tripStartDate: input.tripStartDate, tripEndDate: input.tripEndDate, locale: "ko", airports: deps.airports };
  const matched = selectParser(ALL_PARSERS, masked);
  const detectScore = matched?.detect(masked);
  const parserBookings = matched ? matched.parse(masked, parseCtx) : [];
  const verifyCtx = { airports: deps.airports, tripStartDate: input.tripStartDate, tripEndDate: input.tripEndDate };
  const extract = deps.extract ?? extractWithLLM;
  const hints = describeHints(parserBookings);
  const deadline = Date.now() + (deps.llmBudgetMs ?? 45e3);
  const remaining = () => Math.max(0, deadline - Date.now());
  let llm = await extract(masked, hints, input.tripStartDate, input.tripEndDate, deps.keys, remaining(), "fast");
  if (!llm || llm.bookings.length === 0 || needsCarefulPass(llm.bookings, verifyCtx)) {
    const careful = await extract(masked, hints, input.tripStartDate, input.tripEndDate, deps.keys, remaining(), "careful");
    if (careful && careful.bookings.length > 0) llm = careful;
  }
  let bookings;
  let parserUsed;
  if (llm && llm.bookings.length > 0) {
    bookings = agreeWithParser(llm.bookings, parserBookings);
    parserUsed = llm.parserUsed;
  } else if (matched && parserBookings.length > 0) {
    bookings = parserBookings;
    parserUsed = `${matched.id}@${matched.version}`;
  } else {
    bookings = [];
    parserUsed = llm?.parserUsed ?? "none";
    warnings.push("\uC790\uB3D9 \uC778\uC2DD\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4 \u2014 \uC9C1\uC811 \uC785\uB825\uD574 \uC8FC\uC138\uC694.");
  }
  if (input.fromOcr) bookings = bookings.map(capAmbiguousReference);
  const verified = [];
  for (const b of bookings) {
    if (b.kind === "flight") {
      const { flight: flight2, warnings: w } = verifyParsedFlight(b, verifyCtx);
      verified.push(flight2);
      warnings.push(...w);
    } else if (b.kind === "lodging") {
      const { lodging: lodging2, warnings: w } = verifyParsedLodging(b, verifyCtx);
      verified.push(lodging2);
      warnings.push(...w);
    } else {
      verified.push(b);
    }
  }
  const weight = sourceWeight(parserUsed, parserUsed.startsWith("llm/") ? void 0 : detectScore, input.fromOcr);
  return { bookings: verified.map((b) => applySourceWeight(b, weight)), parserUsed, warnings };
}
export {
  createAirportIndex,
  runBookingPipeline
};
