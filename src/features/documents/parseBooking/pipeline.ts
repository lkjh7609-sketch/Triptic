/* i18n-exempt-file: 서버 파이프라인 진단용 경고 — 검수 화면 경고 목록에 그대로 쓰이는 기존 문구(validate.ts와 같은 톤) */
/**
 * 예약 서류 인식 파이프라인 (04-document-ai.md §2) — 순수 함수, 외부 호출은 주입받는다.
 * 서버(api/parseDocument.js)는 파일에서 글자를 뽑아(kordoc: PDF 글자층·사진 OCR) 여기로 넘긴다.
 *
 *  1) OCR 결과면 보정 규칙(ocrNormalize.ts) — 날짜·편명·숫자의 O/0 등 혼동
 *  2) 🔒 마스킹(redact.ts) — 이후 단계(특히 LLM)에는 가린 글만 간다
 *  3) 결정론적 파서 — 결과는 LLM 힌트로만 쓴다(단순 정규식이라 여러 구간 문서에서 섞인다)
 *  4) LLM 추출(llm.ts) — 주 결과. 실패하면 파서 결과, 그것도 없으면 빈 결과 + 경고
 *  5) OCR이면 헷갈리는 글자가 든 예약번호 신뢰도 ≤0.6 — 검수 화면에서 확인하게
 *  6) 검증(validate.ts) + 출처 가중치(sourceWeight.ts)
 */
import type { AirportIndex } from './airports.ts';
import { lookupAirport } from './airports.ts';
import { extractWithLLM, type LlmResult, type ProviderKeys } from './llm.ts';
import { hasAmbiguousChars, normalizeOcrText } from './ocrNormalize.ts';
import { ALL_PARSERS, selectParser } from './parsers/index.ts';
import { redact } from './redact.ts';
import type { ParsedBooking, ParsedFlight } from './schema.ts';
import { applySourceWeight, sourceWeight } from './sourceWeight.ts';
import { verifyParsedFlight, verifyParsedLodging } from './validate.ts';

export interface PipelineInput {
  /** kordoc Markdown(또는 PDF 글자층) — 원문. 이 함수 밖으로 나가거나 로그에 남지 않는다 */
  text: string;
  /** 사진·스캔본을 OCR로 읽었으면 true(보정 규칙·예약번호 신뢰도 제한을 건다) */
  fromOcr: boolean;
  tripStartDate: string;
  tripEndDate: string;
}

export interface PipelineDeps {
  airports: AirportIndex;
  keys: ProviderKeys;
  llmBudgetMs?: number;
  /** 테스트용 — 기본은 llm.ts의 extractWithLLM */
  extract?: typeof extractWithLLM;
}

export interface PipelineResult {
  bookings: ParsedBooking[];
  parserUsed: string;
  warnings: string[];
}

/** 파서 결과를 LLM이 읽을 짧은 후보 목록으로 */
function describeHints(bookings: ParsedBooking[]): string {
  return bookings
    .filter((b): b is ParsedFlight => b.kind === 'flight')
    .map((f) =>
      [
        f.flightNumber.value && `flight ${f.flightNumber.value}`,
        f.departure.airportIata.value && `from ${f.departure.airportIata.value}`,
        f.arrival.airportIata.value && `to ${f.arrival.airportIata.value}`,
        f.departure.scheduledLocal.value && `departs ${f.departure.scheduledLocal.value}`,
        f.bookingReference.value && `ref ${f.bookingReference.value}`,
      ]
        .filter(Boolean)
        .join(', '),
    )
    .filter(Boolean)
    .join('\n');
}

/**
 * LLM 항공편과 같은 편명의 파서 결과가 같은 값을 냈으면 그 필드 신뢰도를 올린다(둘 중 큰 값).
 * 파서 값으로 LLM의 빈칸을 채우지는 않는다 — 파서가 여러 구간을 섞어 틀린 값을 낼 수 있다.
 */
function agreeWithParser(llm: ParsedBooking[], parser: ParsedBooking[]): ParsedBooking[] {
  const parserFlights = parser.filter((b): b is ParsedFlight => b.kind === 'flight');
  return llm.map((b) => {
    if (b.kind !== 'flight' || !b.flightNumber.value) return b;
    const p = parserFlights.find((x) => x.flightNumber.value === b.flightNumber.value);
    if (!p) return b;
    const next = structuredClone(b);
    const bump = (a: { value: unknown; confidence: number }, c: { value: unknown; confidence: number }) => {
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

/**
 * 빠른 추출 결과를 다시(추론 켜고) 읽어야 하는지 — 검증 경고(비행시간이 거리와 안 맞음, 도착이
 * 출발보다 빠름 등)가 있거나 핵심값이 비었을 때. 흐린 사진의 다구간 여정에서 시각을 엇갈려
 * 붙이거나, 호텔 예약번호를 놓치는 경우가 여기에 걸린다.
 */
function needsCarefulPass(bookings: ParsedBooking[], ctx: Parameters<typeof verifyParsedFlight>[1]): boolean {
  for (const b of bookings) {
    if (b.kind === 'flight') {
      if (verifyParsedFlight(b, ctx).warnings.length > 0) return true;
      if (!b.flightNumber.value || !b.departure.airportIata.value || !b.arrival.airportIata.value || !b.departure.scheduledLocal.value) return true;
    } else if (b.kind === 'lodging') {
      if (verifyParsedLodging(b, ctx).warnings.length > 0) return true;
      if (!b.propertyName.value || !b.checkInLocal.value || !b.checkOutLocal.value || !b.bookingReference.value) return true;
    }
  }
  return false;
}

/** OCR로 읽은 예약번호에 헷갈리기 쉬운 글자(O·0·I·1·L 등)가 있으면 신뢰도 ≤0.6 */
function capAmbiguousReference(b: ParsedBooking): ParsedBooking {
  const ref = b.bookingReference;
  if (typeof ref.value !== 'string' || !hasAmbiguousChars(ref.value)) return b;
  return { ...b, bookingReference: { value: ref.value, confidence: Math.min(ref.confidence, 0.6) } };
}

export async function runBookingPipeline(input: PipelineInput, deps: PipelineDeps): Promise<PipelineResult> {
  const warnings: string[] = [];
  const isAirport = (code: string) => lookupAirport(deps.airports, code) !== null;

  const corrected = input.fromOcr ? normalizeOcrText(input.text, { isAirport }) : input.text;
  // §1 "원문 텍스트를 저장하거나 로그에 남기지 않는다" — 마스킹 전 글은 이 함수 안에서만 쓰인다
  const { text: masked } = redact(corrected);

  const parseCtx = { tripStartDate: input.tripStartDate, tripEndDate: input.tripEndDate, locale: 'ko' as const, airports: deps.airports };
  const matched = selectParser(ALL_PARSERS, masked);
  const detectScore = matched?.detect(masked);
  const parserBookings = matched ? matched.parse(masked, parseCtx) : [];

  const verifyCtx = { airports: deps.airports, tripStartDate: input.tripStartDate, tripEndDate: input.tripEndDate };
  const extract = deps.extract ?? extractWithLLM;
  const hints = describeHints(parserBookings);
  const deadline = Date.now() + (deps.llmBudgetMs ?? 45_000);
  const remaining = () => Math.max(0, deadline - Date.now());
  // 빠르게(추론 없이) 먼저 — 검증에서 문제가 보이거나 실패하면 추론 low로 한 번 더
  let llm: LlmResult | null = await extract(masked, hints, input.tripStartDate, input.tripEndDate, deps.keys, remaining(), 'fast');
  if (!llm || llm.bookings.length === 0 || needsCarefulPass(llm.bookings, verifyCtx)) {
    const careful = await extract(masked, hints, input.tripStartDate, input.tripEndDate, deps.keys, remaining(), 'careful');
    if (careful && careful.bookings.length > 0) llm = careful;
  }

  let bookings: ParsedBooking[];
  let parserUsed: string;
  if (llm && llm.bookings.length > 0) {
    bookings = agreeWithParser(llm.bookings, parserBookings);
    parserUsed = llm.parserUsed;
  } else if (matched && parserBookings.length > 0) {
    bookings = parserBookings;
    parserUsed = `${matched.id}@${matched.version}`;
  } else {
    bookings = [];
    parserUsed = llm?.parserUsed ?? 'none';
    warnings.push('자동 인식에 실패했습니다 — 직접 입력해 주세요.');
  }

  if (input.fromOcr) bookings = bookings.map(capAmbiguousReference);

  // §7 결정론적 검증 — flight/lodging만 검증기가 있다
  const verified: ParsedBooking[] = [];
  for (const b of bookings) {
    if (b.kind === 'flight') {
      const { flight, warnings: w } = verifyParsedFlight(b, verifyCtx);
      verified.push(flight);
      warnings.push(...w);
    } else if (b.kind === 'lodging') {
      const { lodging, warnings: w } = verifyParsedLodging(b, verifyCtx);
      verified.push(lodging);
      warnings.push(...w);
    } else {
      verified.push(b);
    }
  }

  const weight = sourceWeight(parserUsed, parserUsed.startsWith('llm/') ? undefined : detectScore, input.fromOcr);
  return { bookings: verified.map((b) => applySourceWeight(b, weight)), parserUsed, warnings };
}
