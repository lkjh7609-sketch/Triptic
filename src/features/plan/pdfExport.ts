/**
 * PDF 일정표 내보내기 (index.html에서 이식 — ADR-001)
 * 원본: index.html exportToPDF/ensureKoreanFont/cleanPdfText/openPdfModal
 * (2026-09-21 기준 라인 7623~8252). 표(타임라인 요약) + 장소별 상세 카드 +
 * 일자별 경비 요약을 A4 PDF로 그리는 알고리즘·레이아웃·색상을 그대로 옮겼다.
 * 전역 변수(plannerData, hotelsData, flightsData, expensesData, dayCities,
 * directionsCache, tripCity 등) 의존을 인자 하나(PdfExportInput)로 바꾼 것
 * 외에는 legacy와 동일하다.
 */
import { jsPDF } from 'jspdf';
import { getDayHotels, type Hotel } from './map/hotels';
import { getDayCity } from './dayCities';
import { MEAL_META } from './map/meals';
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

let cachedKoreanFontBase64: string | null = null;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function ensureKoreanFont(pdf: jsPDF): Promise<void> {
  if (!cachedKoreanFontBase64) {
    const fontUrl =
      'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/nanumgothic/NanumGothic-Regular.ttf';
    const res = await fetch(fontUrl);
    if (!res.ok) throw new Error('Font load failed');
    const buffer = await res.arrayBuffer();
    cachedKoreanFontBase64 = arrayBufferToBase64(buffer);
  }
  pdf.addFileToVFS('NanumGothic.ttf', cachedKoreanFontBase64);
  pdf.addFont('NanumGothic.ttf', 'NanumGothic', 'normal');
  pdf.setFont('NanumGothic', 'normal');
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

/** MEAL_META는 정식 식사 슬롯(breakfast/lunch/dinner)만 정의한다 — 'cafe'는
 * PlaceItem.mealType에는 있지만 식사 슬롯이 아니므로 legacy와 동일하게 '관광'으로 취급한다. */
function mealSlotLabel(mealType: PlaceItem['mealType']): string | undefined {
  if (mealType === 'breakfast' || mealType === 'lunch' || mealType === 'dinner') {
    return MEAL_META[mealType as MealSlot].label;
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
  await ensureKoreanFont(pdf);

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
      const headText = `${cleanPdfText(curCityName) || '여행'} 일정표 · ${currentDayNum}일차 (계속)`;
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
      { text: '시간', x: colX_time + colW_time / 2, align: 'center' },
      { text: '구분', x: colX_type + colW_type / 2, align: 'center' },
      { text: '일정 및 장소', x: colX_name + 3, align: 'left' },
      { text: '이동 및 비고', x: colX_note + 3, align: 'left' },
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
    const addrLines: string[] = address ? pdf.splitTextToSize(`[주소] ${address}`, textW) : [];
    const memoLines: string[] = memo ? pdf.splitTextToSize(`[메모] ${memo}`, textW) : [];
    const transitLines: string[] = transit ? pdf.splitTextToSize(`[이동 안내] ${transit}`, textW) : [];

    const lineH = 3.9;
    let innerH = 6.0;
    if (addrLines.length > 0) innerH += addrLines.length * lineH + 1.0;
    if (memoLines.length > 0) innerH += memoLines.length * lineH + 1.2;
    if (transitLines.length > 0) innerH += transitLines.length * lineH + 1.0;

    const cardH = innerH + 3.0;

    if (ensureSpace(cardH + 3.0)) {
      drawSectionHeader('2. 장소별 상세 안내 & 메모 (계속)');
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
      ? dateObj.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })
      : '';

    pdf.setFontSize(8);
    pdf.setTextColor(...C_BLUE);
    pdf.text('TRIPTIC ITINERARY GUIDE', marginL, y + 2);

    y += 5.5;
    pdf.setFontSize(15);
    pdf.setTextColor(...C_NAVY);
    const curCityName =
      getDayCity(dayNum, input.dayCitiesData, { name: input.city, lat: null, lng: null }).name || input.city;
    const dayTitle = `${cleanPdfText(curCityName) || '여행'} 일정표 · ${dayNum}일차 (DAY ${dayNum})`;
    pdf.text(dayTitle, marginL, y + 2);
    pdf.text(dayTitle, marginL + 0.15, y + 2);

    y += 6.5;
    pdf.setFontSize(8.5);
    pdf.setTextColor(...C_MUTED);
    const periodText = `여행 기간: ${cleanPdfText(input.startDate)} ~ ${cleanPdfText(input.endDate)} (총 ${input.totalDays}일 중 ${dayNum}일차)  |  ${cleanPdfText(dateStr)}`;
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
        name: `${flightArrival.flightNo} 도착`,
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
        name: `${flightDeparture.flightNo} 출발`,
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
      if (transitInfo) noteParts.push(`이동 약 ${transitInfo.duration}`);
      tableRows.push({
        time: fArr.time || '도착',
        type: '[항공 · 도착]',
        name: `${flightArrival.flightNo} (${fDep.iata || fDep.name || '?'} → ${fArr.iata || fArr.name || '?'})`,
        note: noteParts.join(' | ') || '공항 도착 및 입국',
        isFlight: true,
        isBold: true,
      });
    }

    if (startHotel) {
      const transitInfo = getTransitToNext(startHotel);
      const noteParts: string[] = [];
      if (transitInfo) noteParts.push(`이동 약 ${transitInfo.duration}`);
      else noteParts.push('일정 시작');
      tableRows.push({
        time: '09:00',
        type: '[출발 숙소]',
        name: startHotel.name,
        note: noteParts.join(' | '),
        isHotel: true,
        isBold: true,
      });
    }

    if (dayItems.length === 0 && !flightArrival && !startHotel && !endHotel && !flightDeparture) {
      tableRows.push({
        time: '-',
        type: '[자유 일정]',
        name: '등록된 일정이 없습니다 (자유 여행)',
        note: '-',
        isBold: false,
      });
    } else {
      dayItems.forEach((item, idx) => {
        const slotLabel = mealSlotLabel(item.mealType);
        const mealLabel = slotLabel ? `[식사 · ${slotLabel}]` : '[관광]';
        const transitInfo = getTransitToNext(item);
        const noteParts: string[] = [];
        if (transitInfo) noteParts.push(`이동 약 ${transitInfo.duration}`);
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
        time: '복귀',
        type: '[복귀 숙소]',
        name: endHotel.name,
        note: '체크인 및 휴식',
        isHotel: true,
        isBold: true,
      });
    }

    if (flightDeparture) {
      const gDep = flightDeparture.dep;
      const gArr = flightDeparture.arr;
      tableRows.push({
        time: gDep.time || '출발',
        type: '[항공 · 출발]',
        name: `${flightDeparture.flightNo} (${gDep.iata || gDep.name || '?'} → ${gArr.iata || gArr.name || '?'})`,
        note: flightDeparture.airline || '공항 이동 및 출국',
        isFlight: true,
        isBold: true,
      });
    }

    drawSectionHeader('1. 타임라인 전체 일정 요약 (Timeline Summary Table)');
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
        name: `출발 숙소 : ${startHotel.name}`,
        tag: '숙소 / 출발',
        time: '09:00',
        address: startHotel.address,
        memo: '',
        transit: transitInfo
          ? `다음 장소(${cleanPdfText(transitInfo.nextName)})까지 대중교통 약 ${transitInfo.duration} 소요`
          : '',
        accentColor: C_BLUE,
      });
    }

    dayItems.forEach((item, idx) => {
      const transitInfo = getTransitToNext(item);
      const itemSlotLabel = mealSlotLabel(item.mealType);
      const tag = itemSlotLabel ? `식사 · ${itemSlotLabel}` : '관광 / 일정';
      detailCards.push({
        name: `${idx + 1}. ${item.name}`,
        tag,
        time: item.time ? `예정 ${item.time}` : '',
        address: item.address,
        memo: item.memo,
        transit: transitInfo
          ? `다음 장소(${cleanPdfText(transitInfo.nextName)})까지 대중교통 약 ${transitInfo.duration} 소요`
          : '',
        accentColor: item.mealType ? [180, 83, 9] : C_NAVY,
      });
    });

    if (endHotel && (endHotel.address || endHotel.name)) {
      detailCards.push({
        name: `복귀 숙소 : ${endHotel.name}`,
        tag: '숙소 / 휴식',
        time: '복귀',
        address: endHotel.address,
        memo: '',
        transit: '',
        accentColor: C_BLUE,
      });
    }

    drawSectionHeader('2. 장소별 상세 안내 & 메모 (Place Details & Guide)');
    if (detailCards.length === 0) {
      ensureSpace(10);
      pdf.setFontSize(8.5);
      pdf.setTextColor(...C_MUTED);
      pdf.text('(이 날짜에는 등록된 상세 장소가 없습니다 - 자유 일정)', marginL + 4, y + 4);
      y += 8.0;
    } else {
      detailCards.forEach((card) => drawPlaceDetailCard(card));
    }
    y += 3.0;

    // 3. Render Section 3: Expenses (if any)
    if (dayExpenses.length > 0) {
      drawSectionHeader('3. 일자별 지출 경비 요약 (Daily Expenses)');
      const { total: sum, unconverted } = getDayExpenseTotal(dayExpenses, input.currency);

      ensureSpace(16);
      pdf.setFillColor(...C_SEC_BG);
      pdf.rect(marginL, y, usableW, 6.5, 'F');
      pdf.setFontSize(8);
      pdf.setTextColor(...C_MUTED);
      pdf.text('지출 항목 / 내용', marginL + 4, y + 4.4);
      pdf.text('금액', pageW - marginR - 4, y + 4.4, { align: 'right' });
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
        let amountText = formatMoney(e.amount, itemCurrency);
        if (itemCurrency !== input.currency) {
          const converted = convertToBase(e, input.currency);
          amountText += converted != null ? ` (≈${formatMoney(converted, input.currency)})` : ' (환산 불가)';
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
      pdf.text('지출 합계', marginL + 4, y + 5.0);
      pdf.text('지출 합계', marginL + 4.1, y + 5.0);

      const sumText = cleanPdfText(
        formatMoney(sum, input.currency) + (unconverted > 0 ? ` (환산 불가 ${unconverted}건 제외)` : ''),
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
    pdf.text(`Triptic 여행 플래너 · ${cleanPdfText(input.city) || '여행'} 일정표`, marginL, pageH - 6);
    pdf.text(`${p} / ${totalPages} 페이지`, pageW - marginR, pageH - 6, { align: 'right' });
  }

  const filename =
    mode === 'all'
      ? `여행일정표_${cleanPdfText(input.city) || '여행'}_전체일정.pdf`
      : `여행일정표_${cleanPdfText(input.city) || '여행'}_${input.currentDay}일차.pdf`;

  pdf.save(filename);
}
