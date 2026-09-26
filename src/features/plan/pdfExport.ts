/**
 * PDF 일정표 내보내기 (index.html에서 이식 — ADR-001)
 * 원본: index.html exportToPDF/ensureKoreanFont/cleanPdfText/openPdfModal (문구는 plan:pdf.* 번역 키, 글꼴은 문자 종류별)
 * (2026-09-21 기준 라인 7623~8252). 표(타임라인 요약) + 장소별 상세 카드 +
 * 일자별 경비 요약을 A4 PDF로 그리는 알고리즘·레이아웃·색상을 그대로 옮겼다.
 * 전역 변수(plannerData, hotelsData, flightsData, expensesData, dayCities,
 * directionsCache, tripCity 등) 의존을 인자 하나(PdfExportInput)로 바꾼 것
 * 외에는 legacy와 동일하다.
 */
import { jsPDF } from 'jspdf';
import i18next, { normalizeLocale } from '@/shared/i18n';
import { getDayHotels, type Hotel } from './map/hotels';
import { getDayCity } from './dayCities';
import type { MealSlot } from './types';
import { sharedDirectionsCache } from './map/useTripRoutes';
import { convertToBase, formatMoney, getDayExpenseTotal } from './expenses';
import type {
  DayCitiesData,
  ExpensesData,
  FlightInfo,
  FlightsData,
  HotelsData,
  PlaceItem,
  PlannerData,
} from './types';

export interface PdfExportInput {
  title: string;
  city: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  currency: string;
  currentDay: number;
  plannerData: PlannerData;
  hotelsData: HotelsData;
  flightsData: FlightsData;
  expensesData: ExpensesData;
  dayCitiesData: DayCitiesData;
}

interface SeqPoint {
  name: string;
  lat: number | null | undefined;
  lng: number | null | undefined;
  address?: string;
}

interface TableRow {
  time: string;
  type: string;
  name: string;
  note: string;
  isFlight?: boolean;
  isHotel?: boolean;
  isMeal?: boolean;
  isBold?: boolean;
}

interface DetailCard {
  name: string;
  tag: string;
  time: string;
  address?: string;
  memo?: string;
  transit: string;
  accentColor: [number, number, number];
}

/**
 * PDF 글꼴 — jsPDF는 글자별 대체 글꼴이 없어서, 문자열마다 들어 있는 문자 종류를 보고
 * 글꼴을 고른다. 각 글꼴은 그 문자열이 처음 필요할 때만 내려받고 세션 동안 재사용한다.
 * (jsPDF는 Identity-H 인코딩에서 실제로 쓴 글리프만 PDF에 넣으므로 결과 파일은 작다.)
 * - hangul: 나눔고딕 — 한글·라틴 (한자·가나는 없음)
 * - jp: M PLUS 1p — 가나·일본어 한자·라틴
 * - tc: LXGW WenKai TC — 번체 한자·가나·라틴 (정적 TTF 중 번체 커버리지가 완전한 것)
 */
type PdfFontKey = 'hangul' | 'jp' | 'tc';

const PDF_FONTS: Record<PdfFontKey, { url: string; file: string; name: string }> = {
  hangul: {
    url: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/nanumgothic/NanumGothic-Regular.ttf',
    file: 'NanumGothic.ttf',
    name: 'NanumGothic',
  },
  jp: {
    url: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/mplus1p/MPLUS1p-Regular.ttf',
    file: 'MPLUS1p.ttf',
    name: 'MPLUS1p',
  },
  tc: {
    url: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/lxgwwenkaitc/LXGWWenKaiTC-Regular.ttf',
    file: 'LXGWWenKaiTC.ttf',
    name: 'LXGWWenKaiTC',
  },
};

const fontBase64Cache: Partial<Record<PdfFontKey, string>> = {};

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

const HANGUL_RE = /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/;
const KANA_RE = /[\u3040-\u30ff]/;
const HAN_RE = /[\u3400-\u9fff\uf900-\ufaff]/;

/** 표시 언어의 기본 글꼴(라틴·숫자만 있는 문자열에 쓴다) */
function primaryFont(locale: string): PdfFontKey {
  if (locale === 'ja') return 'jp';
  if (locale === 'zh-TW') return 'tc';
  return 'hangul';
}

export function pdfFontFor(text: string, locale: string): PdfFontKey {
  if (HANGUL_RE.test(text)) return 'hangul';
  if (KANA_RE.test(text)) return 'jp';
  if (HAN_RE.test(text)) return locale === 'zh-TW' ? 'tc' : 'jp';
  return primaryFont(locale);
}

async function registerPdfFonts(pdf: jsPDF, keys: Set<PdfFontKey>): Promise<void> {
  await Promise.all(
    [...keys].map(async (key) => {
      const font = PDF_FONTS[key];
      if (!fontBase64Cache[key]) {
        const res = await fetch(font.url);
        if (!res.ok) throw new Error(`PDF font load failed: ${font.name}`);
        fontBase64Cache[key] = arrayBufferToBase64(await res.arrayBuffer());
      }
      pdf.addFileToVFS(font.file, fontBase64Cache[key]!);
      pdf.addFont(font.file, font.name, 'normal');
    }),
  );
}

/**
 * pdf.text / splitTextToSize를 감싸, 호출할 때마다 그 문자열에 맞는 글꼴로 바꾼다.
 * (splitTextToSize도 현재 글꼴의 글자 폭으로 줄을 나누므로 같이 감싼다)
 */
function installFontSwitching(pdf: jsPDF, locale: string): void {
  const pick = (text: unknown) => {
    const joined = Array.isArray(text) ? text.join('') : String(text ?? '');
    pdf.setFont(PDF_FONTS[pdfFontFor(joined, locale)].name, 'normal');
  };
  const originalText = pdf.text.bind(pdf);
  const originalSplit = pdf.splitTextToSize.bind(pdf);
  pdf.text = ((text: string | string[], ...rest: unknown[]) => {
    pick(text);
    return (originalText as (...args: unknown[]) => jsPDF)(text, ...rest);
  }) as jsPDF['text'];
  pdf.splitTextToSize = ((text: string, ...rest: unknown[]) => {
    pick(text);
    return (originalSplit as (...args: unknown[]) => string[])(text, ...rest);
  }) as jsPDF['splitTextToSize'];
}

/** PDF 문구 번역 (plan:pdf.*) */
function L(key: string, vars?: Record<string, unknown>): string {
  return i18next.t(`plan:pdf.${key}`, vars);
}

/** PDF 폰트는 이모지 글리프가 없으므로 렌더링 전에 제거한다 (legacy cleanPdfText) */
function cleanPdfText(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
    .replace(/[\u{2600}-\u{27BF}]/gu, '')
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '')
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, '')
    .replace(/[\u{200D}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 정식 식사 슬롯(breakfast/lunch/dinner)만 식사로 표시한다 — 'cafe'는
 * PlaceItem.mealType에는 있지만 식사 슬롯이 아니므로 legacy와 동일하게 관광 일정으로 취급한다. */
function mealSlotLabel(mealType: PlaceItem['mealType']): string | undefined {
  if (mealType === 'breakfast' || mealType === 'lunch' || mealType === 'dinner') {
    return i18next.t(`plan:mealSlot.${mealType as MealSlot}`);
  }
  return undefined;
}

function dayDateOf(startDate: string, dayNum: number): Date | null {
  if (!startDate) return null;
  const start = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(start.getTime())) return null;
  return new Date(start.getTime() + (dayNum - 1) * 86_400_000);
}

/** 여행 일정표 PDF를 생성해 즉시 다운로드한다 (legacy exportToPDF) */
export async function exportToPdf(input: PdfExportInput, mode: 'all' | 'current'): Promise<void> {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const locale = normalizeLocale(i18next.language);
  // 입력 데이터 + 표시 언어로 필요한 글꼴만 미리 내려받는다
  const neededFonts = new Set<PdfFontKey>([primaryFont(locale)]);
  const allText = JSON.stringify(input);
  if (HANGUL_RE.test(allText)) neededFonts.add('hangul');
  if (KANA_RE.test(allText)) neededFonts.add('jp');
  if (HAN_RE.test(allText)) neededFonts.add(locale === 'zh-TW' ? 'tc' : 'jp');
  await registerPdfFonts(pdf, neededFonts);
  installFontSwitching(pdf, locale);
  const cityOrTrip = (name: string | null | undefined) => cleanPdfText(name) || L('cityFallback');

  const pageW = 210;
  const pageH = 297;
  const marginL = 14;
  const marginR = 14;
  const marginT = 14;
  const marginB = 14;
  const usableW = pageW - marginL - marginR; // 182mm

  const C_NAVY: [number, number, number] = [30, 58, 95];
  const C_BLUE: [number, number, number] = [37, 99, 235];
  const C_TEXT: [number, number, number] = [15, 23, 42];
  const C_MUTED: [number, number, number] = [71, 85, 105];
  const C_LINE: [number, number, number] = [226, 232, 240];
  const C_BG_ALT: [number, number, number] = [248, 250, 252];
  const C_CARD: [number, number, number] = [250, 251, 253];
  const C_SEC_BG: [number, number, number] = [241, 245, 249];

  // Table columns: 22 + 26 + 78 + 56 = 182mm
  const colW_time = 22;
  const colW_type = 26;
  const colW_name = 78;
  const colW_note = 56;

  const colX_time = marginL;
  const colX_type = colX_time + colW_time;
  const colX_name = colX_type + colW_type;
  const colX_note = colX_name + colW_name;

  let y = marginT;
  let currentDayNum = 1;

  function newPage(isContinuation = false) {
    pdf.addPage();
    y = marginT;
    if (isContinuation) {
      const curCityName =
        getDayCity(currentDayNum, input.dayCitiesData, { name: input.city, lat: null, lng: null }).name ||
        input.city;
      const headText = L('continuationHeader', { city: cityOrTrip(curCityName), day: currentDayNum });
      pdf.text(headText, marginL, y + 3);
      pdf.setDrawColor(...C_LINE);
      pdf.setLineWidth(0.2);
      pdf.line(marginL, y + 5, pageW - marginR, y + 5);
      y += 9;
    }
  }

  function ensureSpace(needMm: number, isContinuation = true): boolean {
    if (y + needMm > pageH - marginB) {
      newPage(isContinuation);
      return true;
    }
    return false;
  }

  function drawSectionHeader(title: string) {
    ensureSpace(12, false);
    const h = 6.2;
    pdf.setFillColor(...C_SEC_BG);
    pdf.rect(marginL, y, usableW, h, 'F');

    pdf.setFillColor(...C_NAVY);
    pdf.rect(marginL, y, 2.5, h, 'F');

    pdf.setFontSize(9);
    pdf.setTextColor(...C_NAVY);
    pdf.text(title, marginL + 5, y + 4.4);
    pdf.text(title, marginL + 5.1, y + 4.4);
    y += h + 3.0;
  }

  function drawTableHeader() {
    const h = 7.5;
    pdf.setFillColor(...C_NAVY);
    pdf.rect(marginL, y, usableW, h, 'F');

    pdf.setFontSize(8.5);
    pdf.setTextColor(255, 255, 255);
    const headers: { text: string; x: number; align: 'center' | 'left' }[] = [
      { text: L('colTime'), x: colX_time + colW_time / 2, align: 'center' },
      { text: L('colType'), x: colX_type + colW_type / 2, align: 'center' },
      { text: L('colPlace'), x: colX_name + 3, align: 'left' },
      { text: L('colNote'), x: colX_note + 3, align: 'left' },
    ];
    headers.forEach((hd) => {
      if (hd.align === 'center') {
        pdf.text(hd.text, hd.x, y + 5.0, { align: 'center' });
        pdf.text(hd.text, hd.x + 0.1, y + 5.0, { align: 'center' });
      } else {
        pdf.text(hd.text, hd.x, y + 5.0);
        pdf.text(hd.text, hd.x + 0.1, y + 5.0);
      }
    });
    y += h;
  }

  function drawTableRow(row: TableRow, isAlt: boolean) {
    const timeStr = cleanPdfText(row.time || '-');
    const typeStr = cleanPdfText(row.type || '');
    const nameStr = cleanPdfText(row.name || '');
    const noteStr = cleanPdfText(row.note || '-');

    pdf.setFontSize(8.5);
    const nameLines: string[] = pdf.splitTextToSize(nameStr, colW_name - 6);
    pdf.setFontSize(8);
    const noteLines: string[] = pdf.splitTextToSize(noteStr, colW_note - 6);

    const maxLines = Math.max(1, nameLines.length, noteLines.length);
    const rowH = Math.max(7.5, maxLines * 4.2 + 3.2);

    if (ensureSpace(rowH)) {
      drawTableHeader();
    }

    if (isAlt) {
      pdf.setFillColor(...C_BG_ALT);
      pdf.rect(marginL, y, usableW, rowH, 'F');
    }

    pdf.setDrawColor(...C_LINE);
    pdf.setLineWidth(0.15);
    pdf.line(marginL, y + rowH, pageW - marginR, y + rowH);

    pdf.setFontSize(8.5);
    pdf.setTextColor(...C_TEXT);
    pdf.text(timeStr, colX_time + colW_time / 2, y + 5.0, { align: 'center' });

    pdf.setFontSize(8);
    if (row.isFlight) {
      pdf.setTextColor(...C_NAVY);
    } else if (row.isHotel) {
      pdf.setTextColor(...C_BLUE);
    } else if (row.isMeal) {
      pdf.setTextColor(180, 83, 9);
    } else {
      pdf.setTextColor(...C_MUTED);
    }
    pdf.text(typeStr, colX_type + colW_type / 2, y + 5.0, { align: 'center' });

    pdf.setFontSize(8.5);
    pdf.setTextColor(...C_TEXT);
    let curLineY = y + 5.0;
    nameLines.forEach((ln) => {
      pdf.text(ln, colX_name + 3, curLineY);
      if (row.isBold) pdf.text(ln, colX_name + 3.1, curLineY);
      curLineY += 4.2;
    });

    pdf.setFontSize(8);
    pdf.setTextColor(...C_MUTED);
    curLineY = y + 5.0;
    noteLines.forEach((ln) => {
      pdf.text(ln, colX_note + 3, curLineY);
      curLineY += 4.2;
    });

    y += rowH;
  }

  function drawPlaceDetailCard(cardData: DetailCard) {
    const name = cleanPdfText(cardData.name);
    const tag = cleanPdfText(cardData.tag);
    const time = cleanPdfText(cardData.time);
    const address = cleanPdfText(cardData.address);
    const memo = cleanPdfText(cardData.memo);
    const transit = cleanPdfText(cardData.transit);

    const textW = usableW - 10;
    pdf.setFontSize(8);
    const addrLines: string[] = address ? pdf.splitTextToSize(L('addressLine', { text: address }), textW) : [];
    const memoLines: string[] = memo ? pdf.splitTextToSize(L('memoLine', { text: memo }), textW) : [];
    const transitLines: string[] = transit ? pdf.splitTextToSize(L('transitLine', { text: transit }), textW) : [];

    const lineH = 3.9;
    let innerH = 6.0;
    if (addrLines.length > 0) innerH += addrLines.length * lineH + 1.0;
    if (memoLines.length > 0) innerH += memoLines.length * lineH + 1.2;
    if (transitLines.length > 0) innerH += transitLines.length * lineH + 1.0;

    const cardH = innerH + 3.0;

    if (ensureSpace(cardH + 3.0)) {
      drawSectionHeader(L('section2Continued'));
    }

    pdf.setFillColor(...C_CARD);
    pdf.setDrawColor(...C_LINE);
    pdf.setLineWidth(0.2);
    pdf.roundedRect(marginL, y, usableW, cardH, 1.2, 1.2, 'FD');

    const accentColor = cardData.accentColor || C_NAVY;
    pdf.setFillColor(...accentColor);
    pdf.rect(marginL, y, 1.8, cardH, 'F');

    let cardY = y + 5.0;
    pdf.setFontSize(9.5);
    pdf.setTextColor(...C_NAVY);
    pdf.text(name, marginL + 5, cardY);
    pdf.text(name, marginL + 5.1, cardY);

    let rightTagStr = '';
    if (time) rightTagStr += `[${time}] `;
    if (tag) rightTagStr += tag;
    if (rightTagStr) {
      pdf.setFontSize(8);
      pdf.setTextColor(...C_MUTED);
      pdf.text(rightTagStr, pageW - marginR - 4, cardY, { align: 'right' });
    }

    if (addrLines.length > 0) {
      cardY += 4.5;
      pdf.setFontSize(8);
      pdf.setTextColor(...C_MUTED);
      addrLines.forEach((ln) => {
        pdf.text(ln, marginL + 5, cardY);
        cardY += lineH;
      });
    }

    if (memoLines.length > 0) {
      cardY += 4.5;
      pdf.setFontSize(8);
      pdf.setTextColor(...C_TEXT);
      memoLines.forEach((ln) => {
        pdf.text(ln, marginL + 5, cardY);
        cardY += lineH;
      });
    }

    if (transitLines.length > 0) {
      cardY += 4.5;
      pdf.setFontSize(7.8);
      pdf.setTextColor(...C_BLUE);
      transitLines.forEach((ln) => {
        pdf.text(ln, marginL + 5, cardY);
        cardY += lineH;
      });
    }

    y += cardH + 2.8;
  }

  const targetDays =
    mode === 'all'
      ? Array.from({ length: input.totalDays }, (_, i) => i + 1)
      : [input.currentDay];

  targetDays.forEach((dayNum, loopIdx) => {
    currentDayNum = dayNum;
    if (loopIdx > 0) newPage(false);

    const dateObj = dayDateOf(input.startDate, dayNum);
    const dateStr = dateObj
      ? dateObj.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })
      : '';

    pdf.setFontSize(8);
    pdf.setTextColor(...C_BLUE);
    pdf.text('TRIPTIC ITINERARY GUIDE', marginL, y + 2);

    y += 5.5;
    pdf.setFontSize(15);
    pdf.setTextColor(...C_NAVY);
    const curCityName =
      getDayCity(dayNum, input.dayCitiesData, { name: input.city, lat: null, lng: null }).name || input.city;
    const dayTitle = L('dayTitle', { city: cityOrTrip(curCityName), day: dayNum });
    pdf.text(dayTitle, marginL, y + 2);
    pdf.text(dayTitle, marginL + 0.15, y + 2);

    y += 6.5;
    pdf.setFontSize(8.5);
    pdf.setTextColor(...C_MUTED);
    const periodText = L('period', {
      start: cleanPdfText(input.startDate),
      end: cleanPdfText(input.endDate),
      total: input.totalDays,
      day: dayNum,
      date: cleanPdfText(dateStr),
    });
    pdf.text(periodText, marginL, y + 2);

    y += 5.0;
    pdf.setDrawColor(...C_NAVY);
    pdf.setLineWidth(0.6);
    pdf.line(marginL, y, pageW - marginR, y);
    y += 6.0;

    const isFirst = dayNum === 1;
    const isLast = dayNum === input.totalDays;
    const { startHotel, endHotel } = getDayHotels(dayNum, input.totalDays, input.hotelsData);
    const flightArrival: FlightInfo | null = isFirst ? input.flightsData.outbound : null;
    const flightDeparture: FlightInfo | null = isLast ? input.flightsData.return : null;
    const dayItems: PlaceItem[] = (input.plannerData[dayNum] || []).filter((item) => item && item.name);
    const dayExpenses = input.expensesData[dayNum] || [];

    // Sequence for transit calculations (legacy seq)
    const seq: SeqPoint[] = [];
    if (flightArrival?.arr) {
      seq.push({
        name: L('flightArrivalPoint', { flightNo: flightArrival.flightNo }),
        lat: flightArrival.arr.lat,
        lng: flightArrival.arr.lng,
        address: flightArrival.arr.name || '',
      });
    }
    if (startHotel) seq.push(startHotel);
    dayItems.forEach((p) => seq.push(p));
    if (endHotel) seq.push(endHotel);
    if (flightDeparture?.dep) {
      seq.push({
        name: L('flightDeparturePoint', { flightNo: flightDeparture.flightNo }),
        lat: flightDeparture.dep.lat,
        lng: flightDeparture.dep.lng,
        address: flightDeparture.dep.name || '',
      });
    }

    function getTransitToNext(itemObj: SeqPoint | Hotel | PlaceItem): { duration: string; nextName: string } | null {
      const idx = seq.indexOf(itemObj as SeqPoint);
      if (idx !== -1 && idx + 1 < seq.length) {
        const a = seq[idx];
        const b = seq[idx + 1];
        if (a.lat != null && a.lng != null && b.lat != null && b.lng != null) {
          const cached = sharedDirectionsCache.get({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng });
          if (cached && cached.status === 'OK' && cached.duration) {
            return { duration: cached.duration, nextName: b.name };
          }
        }
      }
      return null;
    }

    // 1. Build Table Rows
    const tableRows: TableRow[] = [];
    if (flightArrival) {
      const fArr = flightArrival.arr;
      const fDep = flightArrival.dep;
      const transitInfo = seq.length > 0 ? getTransitToNext(seq[0]) : null;
      const noteParts: string[] = [];
      if (flightArrival.airline) noteParts.push(flightArrival.airline);
      if (transitInfo) noteParts.push(L('transitAbout', { duration: transitInfo.duration }));
      tableRows.push({
        time: fArr.time || L('arrival'),
        type: L('typeFlightArrival'),
        name: `${flightArrival.flightNo} (${fDep.iata || fDep.name || '?'} → ${fArr.iata || fArr.name || '?'})`,
        note: noteParts.join(' | ') || L('airportArrival'),
        isFlight: true,
        isBold: true,
      });
    }

    if (startHotel) {
      const transitInfo = getTransitToNext(startHotel);
      const noteParts: string[] = [];
      if (transitInfo) noteParts.push(L('transitAbout', { duration: transitInfo.duration }));
      else noteParts.push(L('dayStart'));
      tableRows.push({
        time: '09:00',
        type: L('typeStartHotel'),
        name: startHotel.name,
        note: noteParts.join(' | '),
        isHotel: true,
        isBold: true,
      });
    }

    if (dayItems.length === 0 && !flightArrival && !startHotel && !endHotel && !flightDeparture) {
      tableRows.push({
        time: '-',
        type: L('typeFree'),
        name: L('noPlans'),
        note: '-',
        isBold: false,
      });
    } else {
      dayItems.forEach((item, idx) => {
        const slotLabel = mealSlotLabel(item.mealType);
        const mealLabel = slotLabel ? L('typeMeal', { meal: slotLabel }) : L('typeSight');
        const transitInfo = getTransitToNext(item);
        const noteParts: string[] = [];
        if (transitInfo) noteParts.push(L('transitAbout', { duration: transitInfo.duration }));
        if (item.memo) {
          const cleanM = cleanPdfText(item.memo);
          const excerpt = cleanM.length > 20 ? `${cleanM.substring(0, 18)}...` : cleanM;
          noteParts.push(excerpt);
        }
        tableRows.push({
          time: item.time || '-',
          type: mealLabel,
          name: `${idx + 1}. ${item.name}`,
          note: noteParts.join(' | ') || '-',
          isMeal: !!item.mealType,
          isBold: false,
        });
      });
    }

    if (endHotel) {
      tableRows.push({
        time: L('return'),
        type: L('typeEndHotel'),
        name: endHotel.name,
        note: L('checkInRest'),
        isHotel: true,
        isBold: true,
      });
    }

    if (flightDeparture) {
      const gDep = flightDeparture.dep;
      const gArr = flightDeparture.arr;
      tableRows.push({
        time: gDep.time || L('departure'),
        type: L('typeFlightDeparture'),
        name: `${flightDeparture.flightNo} (${gDep.iata || gDep.name || '?'} → ${gArr.iata || gArr.name || '?'})`,
        note: flightDeparture.airline || L('airportDeparture'),
        isFlight: true,
        isBold: true,
      });
    }

    drawSectionHeader(L('section1'));
    drawTableHeader();
    tableRows.forEach((row, rIdx) => {
      drawTableRow(row, rIdx % 2 === 1);
    });
    y += 5.0;

    // 2. Build Detail Cards for Section 2
    const detailCards: DetailCard[] = [];
    if (startHotel && (startHotel.address || startHotel.name)) {
      const transitInfo = getTransitToNext(startHotel);
      detailCards.push({
        name: L('cardStartHotel', { name: startHotel.name }),
        tag: L('tagStartHotel'),
        time: '09:00',
        address: startHotel.address,
        memo: '',
        transit: transitInfo
          ? L('transitToNext', { name: cleanPdfText(transitInfo.nextName), duration: transitInfo.duration })
          : '',
        accentColor: C_BLUE,
      });
    }

    dayItems.forEach((item, idx) => {
      const transitInfo = getTransitToNext(item);
      const itemSlotLabel = mealSlotLabel(item.mealType);
      const tag = itemSlotLabel ? L('tagMeal', { meal: itemSlotLabel }) : L('tagSight');
      detailCards.push({
        name: `${idx + 1}. ${item.name}`,
        tag,
        time: item.time ? L('plannedAt', { time: item.time }) : '',
        address: item.address,
        memo: item.memo,
        transit: transitInfo
          ? L('transitToNext', { name: cleanPdfText(transitInfo.nextName), duration: transitInfo.duration })
          : '',
        accentColor: item.mealType ? [180, 83, 9] : C_NAVY,
      });
    });

    if (endHotel && (endHotel.address || endHotel.name)) {
      detailCards.push({
        name: L('cardEndHotel', { name: endHotel.name }),
        tag: L('tagEndHotel'),
        time: L('return'),
        address: endHotel.address,
        memo: '',
        transit: '',
        accentColor: C_BLUE,
      });
    }

    drawSectionHeader(L('section2'));
    if (detailCards.length === 0) {
      ensureSpace(10);
      pdf.setFontSize(8.5);
      pdf.setTextColor(...C_MUTED);
      pdf.text(L('noDetails'), marginL + 4, y + 4);
      y += 8.0;
    } else {
      detailCards.forEach((card) => drawPlaceDetailCard(card));
    }
    y += 3.0;

    // 3. Render Section 3: Expenses (if any)
    if (dayExpenses.length > 0) {
      drawSectionHeader(L('section3'));
      const { total: sum, unconverted } = getDayExpenseTotal(dayExpenses, input.currency);

      ensureSpace(16);
      pdf.setFillColor(...C_SEC_BG);
      pdf.rect(marginL, y, usableW, 6.5, 'F');
      pdf.setFontSize(8);
      pdf.setTextColor(...C_MUTED);
      pdf.text(L('expenseItem'), marginL + 4, y + 4.4);
      pdf.text(L('expenseAmount'), pageW - marginR - 4, y + 4.4, { align: 'right' });
      y += 6.5;

      dayExpenses.forEach((e, eIdx) => {
        const rowH = 6.2;
        ensureSpace(rowH);
        if (eIdx % 2 === 1) {
          pdf.setFillColor(...C_BG_ALT);
          pdf.rect(marginL, y, usableW, rowH, 'F');
        }
        pdf.setDrawColor(...C_LINE);
        pdf.setLineWidth(0.15);
        pdf.line(marginL, y + rowH, pageW - marginR, y + rowH);

        pdf.setFontSize(8.2);
        pdf.setTextColor(...C_TEXT);
        pdf.text(cleanPdfText(e.desc || '-'), marginL + 4, y + 4.3);
        const itemCurrency = e.currency ?? input.currency;
        let amountText = formatMoney(e.amount, itemCurrency, locale);
        if (itemCurrency !== input.currency) {
          const converted = convertToBase(e, input.currency);
          amountText += converted != null ? ` (≈${formatMoney(converted, input.currency, locale)})` : ` ${L('notConvertible')}`;
        }
        pdf.text(cleanPdfText(amountText), pageW - marginR - 4, y + 4.3, {
          align: 'right',
        });
        y += rowH;
      });

      const totalH = 7.5;
      ensureSpace(totalH);
      pdf.setFillColor(...C_SEC_BG);
      pdf.rect(marginL, y, usableW, totalH, 'F');
      pdf.setFontSize(9);
      pdf.setTextColor(...C_NAVY);
      pdf.text(L('expenseTotal'), marginL + 4, y + 5.0);
      pdf.text(L('expenseTotal'), marginL + 4.1, y + 5.0);

      const sumText = cleanPdfText(
        formatMoney(sum, input.currency, locale) + (unconverted > 0 ? ` ${L('excludedCount', { count: unconverted })}` : ''),
      );
      pdf.text(sumText, pageW - marginR - 4, y + 5.0, { align: 'right' });
      pdf.text(sumText, pageW - marginR - 4.1, y + 5.0, { align: 'right' });
      y += totalH + 4.0;
    }
  });

  // Running Footer across all pages
  const totalPages = pdf.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p);
    pdf.setDrawColor(...C_LINE);
    pdf.setLineWidth(0.2);
    pdf.line(marginL, pageH - 10, pageW - marginR, pageH - 10);

    pdf.setFontSize(8);
    pdf.setTextColor(...C_MUTED);
    pdf.text(L('footer', { city: cityOrTrip(input.city) }), marginL, pageH - 6);
    pdf.text(L('pageOf', { page: p, total: totalPages }), pageW - marginR, pageH - 6, { align: 'right' });
  }

  const filename =
    mode === 'all'
      ? L('fileAll', { city: cityOrTrip(input.city) })
      : L('fileDay', { city: cityOrTrip(input.city), day: input.currentDay });

  pdf.save(filename);
}
