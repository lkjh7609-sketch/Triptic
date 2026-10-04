/**
 * PDF 여행 일정표 내보내기(2026-10-04 새 양식 — 사용자 결정)
 *  1쪽  표지 + 예약 요약: 제목·도시·기간·함께하는 사람·일차별 도시 흐름(한 줄), 항공편(출국·귀국)·숙소(체크인~체크아웃)
 *  일차 하루에 꼭 한 쪽: 동선 지도(공식 지도 대신 귀여운 도식 — 번호 핀·이름표·점선 동선·방위·축척) + 타임라인
 *  체크리스트: 출발 전 체크리스트 전체를 빈 네모 칸으로(인쇄해서 직접 체크)
 *  경비 기록표: 여행 전에 뽑아 가는 용도라 빈 표 — 일차마다 몇 줄, 용도는 앱 경비 아이콘에 동그라미, 금액 칸에 통화 단위
 * '현재 일차만'은 그날 한 쪽만. 글꼴은 문자 종류별(한글·가나·번체)로 그때그때 고른다.
 * 배치 계산은 pdfLayout.ts(순수 함수·테스트), 아이콘 경로는 pdfIcons.ts.
 */
import { jsPDF } from 'jspdf';
import i18next, { normalizeLocale } from '@/shared/i18n';
import { getDayHotels } from './map/hotels';
import { getDayCity } from './dayCities';
import { flightAirlineLabel, returnFlightDay } from './flights';
import { sharedDirectionsCache } from './map/useTripRoutes';
import { CHECKLIST_PAGES } from './checklistData';
import { iconSvg } from './pdfIcons';
import {
  cityRuns,
  ellipsize,
  hasCoord,
  hotelStays,
  nearCluster,
  niceScale,
  placeLabels,
  project,
  rowBudget,
  spreadOverlaps,
  type Box,
  type LatLng,
} from './pdfLayout';
import type { MealSlot } from './types';
import type {
  DayCitiesData,
  ExpenseCategory,
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
  /** 예전 양식의 경비 요약용 — 새 양식은 빈 기록표라 쓰지 않는다(호출부 호환을 위해 남김) */
  expensesData: ExpensesData;
  dayCitiesData: DayCitiesData;
  /** 함께하는 사람 이름(표지) */
  members?: string[];
}

/**
 * PDF 글꼴 — jsPDF는 글자별 대체 글꼴이 없어서, 문자열마다 들어 있는 문자 종류를 보고
 * 글꼴을 고른다. 각 글꼴은 그 문자열이 처음 필요할 때만 내려받고 세션 동안 재사용한다.
 * (jsPDF는 Identity-H 인코딩에서 실제로 쓴 글리프만 PDF에 넣으므로 결과 파일은 작다.)
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

/** PDF 문구 번역 (plan:pdf.*) */
function L(key: string, vars?: Record<string, unknown>): string {
  return i18next.t(`plan:pdf.${key}`, vars);
}

/** PDF 폰트는 이모지 글리프가 없으므로 렌더링 전에 제거한다 */
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

/** 정식 식사 슬롯(아침·점심·저녁)만 식사로 — 'cafe'는 식사 슬롯이 아니다 */
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

type RGB = [number, number, number];

/** 핀·이름표 색 — 번호마다 다른 색(타임라인 번호와 같은 색) */
const PIN_COLORS: RGB[] = [
  [124, 58, 237],
  [234, 88, 12],
  [13, 148, 136],
  [220, 38, 38],
  [37, 99, 235],
  [219, 39, 119],
  [22, 163, 74],
  [202, 138, 4],
];
const C_BRAND: RGB = [46, 79, 79];
const C_INK: RGB = [28, 25, 23];
const C_MUTED: RGB = [100, 116, 139];
const C_FAINT: RGB = [148, 163, 184];
const C_LINE: RGB = [226, 232, 240];
const C_SOFT: RGB = [241, 246, 245];
const C_MAP_BG: RGB = [247, 250, 252];
const C_GRID: RGB = [232, 238, 245];
const C_HOTEL: RGB = [46, 79, 79];

const EXPENSE_CATEGORIES: ExpenseCategory[] = ['food', 'transport', 'lodging', 'shopping', 'activity', 'other'];

/** 아이콘(lucide SVG) → PNG 데이터 주소. 캔버스가 없거나 실패하면 null(그 자리는 비운다) */
async function iconPng(name: string, color: string, px = 96): Promise<string | null> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return null;
  try {
    const svg = iconSvg(name, color, 2);
    const img = new Image();
    img.src = `data:image/svg+xml;base64,${btoa(svg)}`;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = px;
    canvas.height = px;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, px, px);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

/** 금액 단위 — PDF 글꼴에 확실히 있는 기호만 기호로, 나머지는 통화 코드 */
function currencyUnit(currency: string, locale: string): string {
  const code = (currency || 'KRW').toUpperCase();
  try {
    const sym = new Intl.NumberFormat(locale, { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' })
      .formatToParts(0)
      .find((p) => p.type === 'currency')?.value;
    if (sym && ['₩', '¥', '$', '€', '£'].includes(sym)) return `${code} (${sym})`;
  } catch {
    // 모르는 통화 코드
  }
  return code;
}

export async function exportToPdf(input: PdfExportInput, mode: 'all' | 'current'): Promise<void> {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const locale = normalizeLocale(i18next.language);
  const neededFonts = new Set<PdfFontKey>([primaryFont(locale), 'hangul']);
  const allText = JSON.stringify(input) + i18next.t('plan:pdf.coverEyebrow');
  if (KANA_RE.test(allText)) neededFonts.add('jp');
  if (HAN_RE.test(allText)) neededFonts.add(locale === 'zh-TW' ? 'tc' : 'jp');
  await registerPdfFonts(pdf, neededFonts);

  // 아이콘(경비 용도·숙소·비행기)을 미리 만든다
  const iconColor = '#2E4F4F';
  const iconEntries = await Promise.all(
    [...EXPENSE_CATEGORIES, 'house', 'planeTakeoff', 'planeLanding'].map(async (k) => [k, await iconPng(k, iconColor)] as const),
  );
  const icons = Object.fromEntries(iconEntries) as Record<string, string | null>;
  const whiteHouse = await iconPng('house', '#FFFFFF');

  const pageW = 210;
  const pageH = 297;
  const mL = 14;
  const mR = 14;
  const usableW = pageW - mL - mR;
  const bottomLimit = pageH - 14;

  // ── 글자 도우미 ────────────────────────────────────────────────
  const fontOf = (text: string) => PDF_FONTS[pdfFontFor(text, locale)].name;
  function text(str: string, x: number, y: number, opts: { size: number; color?: RGB; bold?: boolean; align?: 'left' | 'center' | 'right'; angle?: number }) {
    const s = cleanPdfText(str);
    if (!s) return;
    pdf.setFont(fontOf(s), 'normal');
    pdf.setFontSize(opts.size);
    pdf.setTextColor(...(opts.color ?? C_INK));
    const o = { align: opts.align ?? 'left', angle: opts.angle } as const;
    pdf.text(s, x, y, o);
    if (opts.bold) pdf.text(s, x + opts.size * 0.006, y, o);
  }
  function width(str: string, size: number): number {
    const s = cleanPdfText(str);
    pdf.setFont(fontOf(s), 'normal');
    pdf.setFontSize(size);
    return pdf.getTextWidth(s);
  }
  const fit = (str: string, size: number, maxW: number) => ellipsize(cleanPdfText(str), (s) => width(s, size) <= maxW);
  function wrap(str: string, size: number, maxW: number): string[] {
    const s = cleanPdfText(str);
    pdf.setFont(fontOf(s), 'normal');
    pdf.setFontSize(size);
    return pdf.splitTextToSize(s, maxW) as string[];
  }
  function icon(name: string, x: number, y: number, size: number, data?: string | null) {
    const img = data ?? icons[name];
    if (img) pdf.addImage(img, 'PNG', x, y, size, size);
  }

  const cityOrTrip = (name: string | null | undefined) => cleanPdfText(name) || L('cityFallback');
  const cityOfDay = (d: number) =>
    cityOrTrip(getDayCity(d, input.dayCitiesData, { name: input.city, lat: null, lng: null }).name || input.city);
  const shortDate = (d: Date | null) =>
    d ? d.toLocaleDateString(locale, { month: 'numeric', day: 'numeric', weekday: 'short' }) : '';
  const fullDate = (d: Date | null) => (d ? d.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' }) : '');

  function sectionTitle(label: string, y: number) {
    pdf.setFillColor(...C_BRAND);
    pdf.roundedRect(mL, y - 3.6, 1.6, 4.6, 0.8, 0.8, 'F');
    text(label, mL + 4, y, { size: 11, color: C_INK, bold: true });
  }

  // ── 1쪽: 표지 + 예약 요약 ─────────────────────────────────────
  function drawCover() {
    let y = 18;
    text(L('coverEyebrow'), mL, y, { size: 8, color: C_BRAND, bold: true });
    y += 11;
    const titleLines = wrap(input.title || cityOrTrip(input.city), 22, usableW).slice(0, 2);
    titleLines.forEach((ln) => {
      text(ln, mL, y, { size: 22, color: C_INK, bold: true });
      y += 9.5;
    });
    const start = dayDateOf(input.startDate, 1);
    const end = dayDateOf(input.startDate, input.totalDays);
    text(
      `${cityOrTrip(input.city)}  ·  ${L('coverPeriod', { start: fullDate(start), end: fullDate(end), nights: Math.max(0, input.totalDays - 1), days: input.totalDays })}`,
      mL,
      y,
      { size: 10, color: C_MUTED },
    );
    y += 9;

    // 함께하는 사람
    const members = (input.members ?? []).map((m) => cleanPdfText(m)).filter(Boolean);
    if (members.length > 0) {
      text(L('members'), mL, y, { size: 8.5, color: C_MUTED, bold: true });
      let x = mL + width(L('members'), 8.5) + 4;
      let rowY = y;
      for (const m of members) {
        const label = fit(m, 8.5, 40);
        const w = width(label, 8.5) + 6;
        if (x + w > pageW - mR) {
          x = mL + width(L('members'), 8.5) + 4;
          rowY += 7;
          if (rowY > y + 14) break;
        }
        pdf.setFillColor(...C_SOFT);
        pdf.roundedRect(x, rowY - 4.2, w, 6, 3, 3, 'F');
        text(label, x + 3, rowY, { size: 8.5, color: C_BRAND });
        x += w + 2;
      }
      y = rowY + 9;
    }

    // 일차별 도시 — 한 줄
    text(L('route'), mL, y, { size: 8.5, color: C_MUTED, bold: true });
    const runs = cityRuns(cityOfDay, input.totalDays);
    const chain = runs
      .map((r) => `${r.city} ${r.from === r.to ? L('dayOne', { day: r.from }) : L('dayRange', { from: r.from, to: r.to })}`)
      .join('  →  ');
    const chainX = mL + width(L('route'), 8.5) + 4;
    let chainSize = 9.5;
    while (chainSize > 7 && width(chain, chainSize) > pageW - mR - chainX) chainSize -= 0.25;
    text(fit(chain, chainSize, pageW - mR - chainX), chainX, y, { size: chainSize, color: C_INK });
    y += 8;

    pdf.setDrawColor(...C_LINE);
    pdf.setLineWidth(0.3);
    pdf.line(mL, y, pageW - mR, y);
    y += 10;

    // 예약 요약 — 항공편
    sectionTitle(L('reservations'), y);
    y += 7;
    const flights: { label: string; f: FlightInfo; icon: string }[] = [];
    if (input.flightsData.outbound) flights.push({ label: L('flightOut'), f: input.flightsData.outbound, icon: 'planeTakeoff' });
    if (input.flightsData.return) flights.push({ label: L('flightBack'), f: input.flightsData.return, icon: 'planeLanding' });
    if (flights.length === 0) {
      text(L('noFlights'), mL + 4, y + 4, { size: 9, color: C_MUTED });
      y += 10;
    } else {
      const cardW = flights.length === 2 ? (usableW - 4) / 2 : usableW;
      flights.forEach(({ label, f, icon: ic }, i) => {
        const x = mL + i * (cardW + 4);
        const h = 34;
        pdf.setFillColor(255, 255, 255);
        pdf.setDrawColor(...C_LINE);
        pdf.setLineWidth(0.3);
        pdf.roundedRect(x, y, cardW, h, 3, 3, 'FD');
        icon(ic, x + 4, y + 3.5, 5);
        text(label, x + 11, y + 7.3, { size: 9, color: C_BRAND, bold: true });
        const date = f.date ? fullDate(new Date(`${f.date}T00:00:00`)) : '';
        if (date) text(date, x + cardW - 4, y + 7.3, { size: 8, color: C_MUTED, align: 'right' });
        const head = `${f.flightNo}${f.airline ? `  ·  ${flightAirlineLabel(f, locale)}` : ''}`;
        text(fit(head, 10, cardW - 8), x + 4, y + 14, { size: 10, color: C_INK, bold: true });
        const terminal = (t?: string) => (t ? ` ${L(`terminal.${t}`)}` : '');
        const left = `${f.dep.iata || f.dep.name || '?'} ${f.dep.time || ''}${terminal(f.dep.terminal)}`;
        const right = `${f.arr.iata || f.arr.name || '?'} ${f.arr.time || ''}${terminal(f.arr.terminal)}`;
        text(left, x + 4, y + 22, { size: 11, color: C_INK, bold: true });
        text('→', x + cardW / 2, y + 22, { size: 11, color: C_FAINT, align: 'center' });
        text(right, x + cardW - 4, y + 22, { size: 11, color: C_INK, bold: true, align: 'right' });
        const names = `${fit(f.dep.name || '', 7.5, cardW / 2 - 6)}`;
        const namesR = `${fit(f.arr.name || '', 7.5, cardW / 2 - 6)}`;
        text(names, x + 4, y + 27.5, { size: 7.5, color: C_MUTED });
        text(namesR, x + cardW - 4, y + 27.5, { size: 7.5, color: C_MUTED, align: 'right' });
        if (f.arrDate && f.arrDate !== f.date) {
          text(L('arrivesOn', { date: fullDate(new Date(`${f.arrDate}T00:00:00`)) }), x + cardW - 4, y + 31.5, { size: 7, color: C_MUTED, align: 'right' });
        }
      });
      y += 34 + 9;
    }

    // 예약 요약 — 숙소
    text(L('hotels'), mL, y, { size: 9.5, color: C_INK, bold: true });
    icon('house', mL + width(L('hotels'), 9.5) + 2, y - 3.6, 4.4);
    y += 4;
    const stays = hotelStays(input.hotelsData as Record<number, { name: string; address?: string }>, input.totalDays);
    if (stays.length === 0) {
      text(L('noHotels'), mL + 4, y + 5, { size: 9, color: C_MUTED });
      y += 10;
    } else {
      const maxRows = Math.max(1, Math.floor((bottomLimit - 8 - y) / 15));
      stays.slice(0, maxRows).forEach((s) => {
        pdf.setFillColor(...C_SOFT);
        pdf.roundedRect(mL, y, usableW, 13, 2.5, 2.5, 'F');
        text(fit(s.name, 10, usableW * 0.55), mL + 4, y + 5.6, { size: 10, color: C_INK, bold: true });
        if (s.address) text(fit(s.address, 7.5, usableW * 0.55), mL + 4, y + 10.2, { size: 7.5, color: C_MUTED });
        const inDate = shortDate(dayDateOf(input.startDate, s.fromDay));
        const outDate = shortDate(dayDateOf(input.startDate, s.toDay));
        text(`${L('checkIn')} ${inDate}  →  ${L('checkOut')} ${outDate}`, pageW - mR - 4, y + 5.6, { size: 8.5, color: C_INK, align: 'right' });
        text(L('nights', { count: s.nights }), pageW - mR - 4, y + 10.2, { size: 7.5, color: C_BRAND, align: 'right', bold: true });
        y += 15;
      });
      if (stays.length > maxRows) text(L('moreHotels', { count: stays.length - maxRows }), mL + 4, y + 2, { size: 8, color: C_MUTED });
    }
  }

  // ── 일차 한 쪽 ───────────────────────────────────────────────
  interface MapPoint extends LatLng {
    kind: 'place' | 'hotel';
    num?: number;
    color: RGB;
    title: string;
    sub: string;
  }
  interface TimelineRow {
    badge: { kind: 'num'; num: number; color: RGB } | { kind: 'icon'; icon: string };
    time: string;
    name: string;
    sub: string;
    memo: string;
    transit: string;
  }

  function transitBetween(a: { lat?: number | null; lng?: number | null } | null, b: { lat?: number | null; lng?: number | null } | null): string {
    if (!a || !b || !hasCoord(a) || !hasCoord(b)) return '';
    const cached = sharedDirectionsCache.get({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng });
    return cached && cached.status === 'OK' && cached.duration ? L('transitShort', { duration: cached.duration }) : '';
  }

  function drawMap(box: Box, points: MapPoint[]) {
    // 바탕: 옅은 모눈
    pdf.setFillColor(...C_MAP_BG);
    pdf.setDrawColor(...C_LINE);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(box.x, box.y, box.w, box.h, 4, 4, 'FD');
    pdf.setDrawColor(...C_GRID);
    pdf.setLineWidth(0.15);
    for (let gx = box.x + 10; gx < box.x + box.w - 2; gx += 10) pdf.line(gx, box.y + 2, gx, box.y + box.h - 2);
    for (let gy = box.y + 10; gy < box.y + box.h - 2; gy += 10) pdf.line(box.x + 2, gy, box.x + box.w - 2, gy);

    // 방위
    const cx = box.x + box.w - 9;
    const cy = box.y + 10;
    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(...C_LINE);
    pdf.circle(cx, cy, 4.2, 'FD');
    pdf.setFillColor(220, 38, 38);
    pdf.triangle(cx, cy - 3, cx - 1.3, cy, cx + 1.3, cy, 'F');
    pdf.setFillColor(...C_FAINT);
    pdf.triangle(cx, cy + 3, cx - 1.3, cy, cx + 1.3, cy, 'F');
    text('N', cx, cy - 5.3, { size: 7, color: C_MUTED, bold: true, align: 'center' });

    if (points.length === 0) {
      text(L('freeDay'), box.x + box.w / 2, box.y + box.h / 2, { size: 11, color: C_MUTED, align: 'center', bold: true });
      return;
    }

    const proj = project(points, box, { x: 26, y: 15 });
    const xy = spreadOverlaps(points.map((p) => proj.toXY(p)), 8);

    // 이름표 크기
    const sizes = points.map((p) => {
      const title = fit(p.title, 8.5, 44);
      const sub = fit(p.sub, 6.3, 44);
      return { w: Math.max(width(title, 8.5), width(sub, 6.3)) + 7, h: p.sub ? 10 : 7 };
    });
    const labels = placeLabels(xy, sizes, { x: box.x + 2, y: box.y + 2, w: box.w - 2, h: box.h - 12 });
    // 장소가 많은 날은 깔끔하게 놓을 자리가 없는 이름표를 뺀다(번호 핀과 타임라인으로 알아볼 수 있다)
    const showLabel = labels.map((r) => r.clear || points.length <= 6);

    // 동선(방문 순서) — 점선
    pdf.setLineDashPattern([1.2, 1.2], 0);
    pdf.setLineWidth(0.5);
    for (let i = 1; i < xy.length; i += 1) {
      pdf.setDrawColor(...points[i].color.map((c) => Math.round(c + (255 - c) * 0.35)) as RGB);
      pdf.line(xy[i - 1].x, xy[i - 1].y - 3, xy[i].x, xy[i].y - 3);
    }
    pdf.setLineDashPattern([], 0);

    // 핀과 이름표 사이 잇는 선
    pdf.setLineWidth(0.25);
    labels.forEach((r, i) => {
      if (!showLabel[i]) return;
      const tint = points[i].color.map((c) => Math.round(c + (255 - c) * 0.55)) as RGB;
      pdf.setDrawColor(...tint);
      const tx = Math.min(Math.max(xy[i].x, r.x), r.x + r.w);
      const ty = Math.min(Math.max(xy[i].y - 4, r.y), r.y + r.h);
      if (Math.hypot(tx - xy[i].x, ty - (xy[i].y - 4)) > 2) pdf.line(xy[i].x, xy[i].y - 4, tx, ty);
    });

    // 이름표 — 흰 카드 + 왼쪽 색 띠
    labels.forEach((r, i) => {
      if (!showLabel[i]) return;
      const p = points[i];
      pdf.setFillColor(255, 255, 255);
      pdf.setDrawColor(...C_LINE);
      pdf.setLineWidth(0.2);
      pdf.roundedRect(r.x, r.y, r.w, r.h, 1.8, 1.8, 'FD');
      pdf.setFillColor(...p.color);
      pdf.roundedRect(r.x, r.y, 1.4, r.h, 0.7, 0.7, 'F');
      text(fit(p.title, 8.5, 44), r.x + 3.6, r.y + (p.sub ? 4.4 : 4.7), { size: 8.5, color: C_INK, bold: true });
      if (p.sub) text(fit(p.sub, 6.3, 44), r.x + 3.6, r.y + 8.2, { size: 6.3, color: C_MUTED });
    });

    // 핀 — 물방울 모양(번호) / 숙소는 집
    points.forEach((p, i) => {
      const { x, y } = xy[i];
      const r = 3.2;
      const top = y - r * 1.55;
      pdf.setFillColor(...p.color);
      pdf.triangle(x - r * 0.72, top + r * 0.55, x + r * 0.72, top + r * 0.55, x, y, 'F');
      pdf.circle(x, top, r, 'F');
      pdf.setFillColor(255, 255, 255);
      if (p.kind === 'hotel') {
        if (whiteHouse) pdf.addImage(whiteHouse, 'PNG', x - 2, top - 2, 4, 4);
      } else {
        pdf.circle(x, top, r * 0.62, 'F');
        text(String(p.num), x, top + 0.95, { size: 6.4, color: p.color, bold: true, align: 'center' });
      }
    });

    // 축척
    const scale = niceScale(proj.mmPerKm, box.w);
    const sx = box.x + 6;
    const sy = box.y + box.h - 6;
    pdf.setDrawColor(...C_MUTED);
    pdf.setLineWidth(0.4);
    pdf.line(sx, sy, sx + scale.mm, sy);
    pdf.line(sx, sy - 1, sx, sy + 0.2);
    pdf.line(sx + scale.mm, sy - 1, sx + scale.mm, sy + 0.2);
    text(scale.km >= 1 ? `${scale.km} km` : `${Math.round(scale.km * 1000)} m`, sx + scale.mm + 2, sy + 1, { size: 6.5, color: C_MUTED });
  }

  function drawDay(dayNum: number) {
    const date = dayDateOf(input.startDate, dayNum);
    const city = cityOfDay(dayNum);
    let y = 16;

    // 머리말 — DAY 알약 + 날짜 + 도시
    const pill = L('dayPill', { day: dayNum });
    const pillW = width(pill, 9) + 8;
    pdf.setFillColor(...C_BRAND);
    pdf.roundedRect(mL, y - 5, pillW, 7.4, 3.7, 3.7, 'F');
    text(pill, mL + pillW / 2, y, { size: 9, color: [255, 255, 255], bold: true, align: 'center' });
    text(city, mL + pillW + 4, y + 0.4, { size: 15, color: C_INK, bold: true });
    text(shortDate(date), pageW - mR, y, { size: 10, color: C_MUTED, align: 'right' });
    y += 5;
    text(fit(input.title, 8, usableW), mL, y + 3, { size: 8, color: C_FAINT });
    y += 6;

    const isFirst = dayNum === 1;
    const { startHotel, endHotel } = getDayHotels(dayNum, input.totalDays, input.hotelsData);
    const flightArrival: FlightInfo | null = isFirst ? input.flightsData.outbound : null;
    const flightDeparture: FlightInfo | null =
      dayNum === returnFlightDay(input.flightsData.return, input.startDate, input.totalDays) ? input.flightsData.return : null;
    const items: PlaceItem[] = (input.plannerData[dayNum] || []).filter((it) => it && it.name);

    const subOf = (it: PlaceItem) => {
      const parts = [it.time, mealSlotLabel(it.mealType) ?? (it.category ? i18next.t(`plan:placeCategory.${it.category}`) : '')].filter(Boolean);
      return parts.join(' · ');
    };

    // 지도 점(공항·멀리 떨어진 곳은 빼고 타임라인에만)
    const sameHotel = startHotel && endHotel && startHotel.name === endHotel.name;
    const mapCandidates: MapPoint[] = [];
    if (startHotel && hasCoord(startHotel))
      mapCandidates.push({ kind: 'hotel', lat: startHotel.lat, lng: startHotel.lng, color: C_HOTEL, title: startHotel.name, sub: L('hotelTag') });
    items.forEach((it, i) => {
      if (hasCoord(it))
        mapCandidates.push({ kind: 'place', num: i + 1, lat: it.lat, lng: it.lng, color: PIN_COLORS[i % PIN_COLORS.length], title: it.name, sub: subOf(it) });
    });
    if (endHotel && hasCoord(endHotel) && !sameHotel)
      mapCandidates.push({ kind: 'hotel', lat: endHotel.lat, lng: endHotel.lng, color: C_HOTEL, title: endHotel.name, sub: L('hotelTag') });
    const near = new Set(nearCluster(mapCandidates));
    const mapPoints = mapCandidates.filter((p) => near.has(p));
    const outside = mapCandidates.filter((p) => !near.has(p) && p.kind === 'place');

    // 지도 높이 — 타임라인 줄이 적으면 지도를 키워 쪽을 채운다(하루 한 쪽 안에서)
    const rowCount = items.length + (startHotel ? 1 : 0) + (endHotel ? 1 : 0) + (flightArrival ? 1 : 0) + (flightDeparture ? 1 : 0);
    const timelineNeed = Math.max(1, rowCount) * 9.5 + 26;
    const mapH = Math.min(150, Math.max(100, bottomLimit - y - timelineNeed));
    const mapBox: Box = { x: mL, y, w: usableW, h: mapH };
    drawMap(mapBox, mapPoints);
    // 지도 밖(멀리 떨어진) 장소는 지도 왼쪽 위에 작게 알린다
    if (outside.length > 0) {
      const note = `${L('offMap')}  ${outside.map((p) => `${p.num} ${cleanPdfText(p.title)}`).join(', ')}`;
      const nw = Math.min(usableW - 30, width(note, 7) + 6);
      pdf.setFillColor(255, 255, 255);
      pdf.setDrawColor(...C_LINE);
      pdf.roundedRect(mapBox.x + 4, mapBox.y + 4, nw, 6, 3, 3, 'FD');
      text(fit(note, 7, nw - 6), mapBox.x + 7, mapBox.y + 8.1, { size: 7, color: C_MUTED });
    }
    // 이동 순서 한 줄(지도 아래쪽 안)
    const orderPlaces = items.map((it, i) => `${i + 1} ${cleanPdfText(it.name)}`);
    if (orderPlaces.length > 1) {
      const label = L('mapRoute');
      const bandY = mapBox.y + mapBox.h + 3;
      pdf.setFillColor(...C_SOFT);
      pdf.roundedRect(mL, bandY, usableW, 7.5, 3.75, 3.75, 'F');
      text(label, mL + 4, bandY + 5, { size: 8, color: C_BRAND, bold: true });
      const lx = mL + 6 + width(label, 8);
      text(fit(orderPlaces.join('  →  '), 8, pageW - mR - 4 - lx), lx, bandY + 5, { size: 8, color: C_INK });
    }
    y = mapBox.y + mapBox.h + (orderPlaces.length > 1 ? 19 : 10);

    // 타임라인
    sectionTitle(L('timeline'), y);
    y += 4;
    const rows: TimelineRow[] = [];
    if (flightArrival) {
      rows.push({
        badge: { kind: 'icon', icon: 'planeLanding' },
        time: flightArrival.arr.time || '',
        name: L('flightArrive', { flightNo: flightArrival.flightNo }),
        sub: `${flightArrival.dep.iata || '?'} → ${flightArrival.arr.iata || '?'}${flightArrival.airline ? ` · ${flightAirlineLabel(flightArrival, locale)}` : ''}`,
        memo: '',
        transit: '',
      });
    }
    if (startHotel) {
      rows.push({
        badge: { kind: 'icon', icon: 'house' },
        time: '',
        name: startHotel.name,
        sub: L('startHotel'),
        memo: '',
        transit: transitBetween(startHotel, items[0] ?? null),
      });
    }
    items.forEach((it, i) => {
      rows.push({
        badge: { kind: 'num', num: i + 1, color: PIN_COLORS[i % PIN_COLORS.length] },
        time: it.time || '',
        name: it.name,
        sub: mealSlotLabel(it.mealType) ?? (it.category ? i18next.t(`plan:placeCategory.${it.category}`) : ''),
        memo: it.memo || it.address || '',
        transit: transitBetween(it, items[i + 1] ?? endHotel ?? null),
      });
    });
    if (endHotel) {
      rows.push({ badge: { kind: 'icon', icon: 'house' }, time: '', name: endHotel.name, sub: L('endHotel'), memo: '', transit: '' });
    }
    if (flightDeparture) {
      rows.push({
        badge: { kind: 'icon', icon: 'planeTakeoff' },
        time: flightDeparture.dep.time || '',
        name: L('flightDepart', { flightNo: flightDeparture.flightNo }),
        sub: `${flightDeparture.dep.iata || '?'} → ${flightDeparture.arr.iata || '?'}${flightDeparture.airline ? ` · ${flightAirlineLabel(flightDeparture, locale)}` : ''}`,
        memo: '',
        transit: '',
      });
    }
    if (rows.length === 0) {
      text(L('noPlans'), mL + 4, y + 7, { size: 9.5, color: C_MUTED });
      return;
    }

    const budget = rowBudget(rows.length, bottomLimit - 4 - y);
    const fs = budget.fontSize;
    const colTime = mL + 10;
    const colName = mL + 26;
    const colMemo = mL + 104;
    const colTransit = pageW - mR;
    rows.slice(0, budget.shown).forEach((row, i) => {
      const top = y + i * budget.rowH;
      const mid = top + budget.rowH / 2;
      if (i % 2 === 1) {
        pdf.setFillColor(250, 251, 252);
        pdf.rect(mL, top, usableW, budget.rowH, 'F');
      }
      const r = Math.min(2.6, budget.rowH * 0.32);
      if (row.badge.kind === 'num') {
        pdf.setFillColor(...row.badge.color);
        pdf.circle(mL + 4, mid, r, 'F');
        text(String(row.badge.num), mL + 4, mid + fs * 0.12, { size: fs * 0.78, color: [255, 255, 255], bold: true, align: 'center' });
      } else {
        icon(row.badge.icon, mL + 4 - r, mid - r, r * 2);
      }
      if (row.time) text(row.time, colTime, mid + fs * 0.13, { size: fs, color: C_INK, bold: true });
      const nameW = colMemo - colName - 4;
      const name = fit(row.name, fs, nameW * (row.sub ? 0.68 : 1));
      text(name, colName, mid + fs * 0.13, { size: fs, color: C_INK, bold: true });
      if (row.sub) {
        const sx = colName + width(name, fs) + 2.5;
        text(fit(row.sub, fs * 0.82, colMemo - 3 - sx), sx, mid + fs * 0.13, { size: fs * 0.82, color: C_MUTED });
      }
      const transitW = row.transit ? width(row.transit, fs * 0.82) + 3 : 0;
      if (row.memo) text(fit(row.memo, fs * 0.85, colTransit - colMemo - transitW - 2), colMemo, mid + fs * 0.13, { size: fs * 0.85, color: C_MUTED });
      if (row.transit) text(row.transit, colTransit, mid + fs * 0.13, { size: fs * 0.82, color: C_BRAND, align: 'right' });
      pdf.setDrawColor(...C_LINE);
      pdf.setLineWidth(0.15);
      pdf.line(mL, top + budget.rowH, pageW - mR, top + budget.rowH);
    });
    if (budget.shown < rows.length) {
      const top = y + budget.shown * budget.rowH;
      text(L('more', { count: rows.length - budget.shown }), colName, top + budget.rowH / 2 + fs * 0.13, { size: fs * 0.9, color: C_MUTED });
    }
  }

  // ── 체크리스트(빈 칸) ─────────────────────────────────────────
  function drawChecklist() {
    const ck = (key: string) => i18next.t(`plan:desktop.checklist.${key}`);
    const colW = (usableW - 8) / 2;
    const colX = [mL, mL + colW + 8];
    let col = 0;
    let y = 0;
    const startPage = () => {
      pdf.addPage();
      text(L('checklistTitle'), mL, 20, { size: 15, color: C_INK, bold: true });
      text(L('checklistHint'), mL, 27, { size: 8.5, color: C_MUTED });
      col = 0;
      y = 36;
    };
    startPage();
    const need = (h: number) => {
      if (y + h <= bottomLimit) return;
      if (col === 0) {
        col = 1;
        y = 36;
      } else startPage();
    };
    for (const page of CHECKLIST_PAGES) {
      for (const group of page.groups) {
        need(14);
        const x = colX[col];
        pdf.setFillColor(...C_SOFT);
        pdf.roundedRect(x, y, colW, 7, 2, 2, 'F');
        text(ck(`groups.${group.key}`), x + 3, y + 4.9, { size: 9, color: C_BRAND, bold: true });
        y += 10;
        for (const item of group.items) {
          const tag = item.carry ? ck(`carry.${item.carry}`) : '';
          const tagW = tag ? width(tag, 6.5) + 4 : 0;
          const lines = wrap(ck(`items.${item.key}`), 8.5, colW - 9 - tagW).slice(0, 3);
          const h = Math.max(6, lines.length * 4 + 2.4);
          need(h);
          const ix = colX[col];
          pdf.setDrawColor(...C_MUTED);
          pdf.setLineWidth(0.35);
          pdf.roundedRect(ix + 0.5, y - 0.2, 3.8, 3.8, 0.6, 0.6, 'S');
          lines.forEach((ln, li) => text(ln, ix + 7, y + 2.9 + li * 4, { size: 8.5, color: C_INK }));
          if (tag) {
            const tx = ix + colW - tagW;
            pdf.setFillColor(...(item.carry === 'cabin' ? ([225, 236, 233] as RGB) : ([241, 245, 249] as RGB)));
            pdf.roundedRect(tx, y - 0.4, tagW, 4.4, 2.2, 2.2, 'F');
            text(tag, tx + tagW / 2, y + 2.7, { size: 6.5, color: C_BRAND, align: 'center' });
          }
          y += h;
        }
        y += 3;
      }
    }
  }

  // ── 경비 기록표(빈 표) ────────────────────────────────────────
  function drawExpenseSheet() {
    const unit = currencyUnit(input.currency, locale);
    const rowH = 8.6;
    // 일차마다 몇 줄 — 첫 쪽을 채우되 4~8줄
    const firstPageRows = Math.floor((bottomLimit - 12 - 47.5 - 14) / rowH);
    const rowsPerDay = Math.max(4, Math.min(8, Math.floor(firstPageRows / Math.max(1, input.totalDays))));
    const cellUnit = /\((.+)\)/.exec(unit)?.[1] ?? unit;
    const colDate = { x: mL, w: 24 };
    const colWhat = { x: mL + 24, w: 58 };
    const colUse = { x: mL + 82, w: 60 };
    const colAmt = { x: mL + 142, w: usableW - 142 };
    let y = 0;
    const header = () => {
      pdf.addPage();
      text(L('expenseTitle'), mL, 20, { size: 15, color: C_INK, bold: true });
      text(L('expenseHint'), mL, 27, { size: 8.5, color: C_MUTED });
      // 용도 범례
      let lx = mL;
      const ly = 34;
      for (const cat of EXPENSE_CATEGORIES) {
        icon(cat, lx, ly - 3.4, 4.2);
        const name = i18next.t(`plan:expense.category.${cat}`);
        text(name, lx + 5.2, ly, { size: 8, color: C_INK });
        lx += 5.2 + width(name, 8) + 5;
      }
      text(L('unit', { unit }), pageW - mR, ly, { size: 8, color: C_BRAND, bold: true, align: 'right' });
      y = 40;
      pdf.setFillColor(...C_BRAND);
      pdf.roundedRect(mL, y, usableW, 7.5, 1.5, 1.5, 'F');
      const hy = y + 5;
      text(L('colDate'), colDate.x + colDate.w / 2, hy, { size: 8.5, color: [255, 255, 255], bold: true, align: 'center' });
      text(L('colWhat'), colWhat.x + 3, hy, { size: 8.5, color: [255, 255, 255], bold: true });
      text(L('colUse'), colUse.x + colUse.w / 2, hy, { size: 8.5, color: [255, 255, 255], bold: true, align: 'center' });
      text(L('colAmount'), colAmt.x + colAmt.w / 2, hy, { size: 8.5, color: [255, 255, 255], bold: true, align: 'center' });
      y += 7.5;
    };
    header();
    const drawRow = (dateLabel: string, first: boolean) => {
      if (y + rowH > bottomLimit - 12) header();
      pdf.setDrawColor(...C_LINE);
      pdf.setLineWidth(first ? 0.35 : 0.15);
      pdf.line(mL, y, pageW - mR, y);
      if (first && dateLabel) {
        const [d1, d2] = dateLabel.split('\n');
        text(d1, colDate.x + colDate.w / 2, y + 3.8, { size: 8, color: C_BRAND, bold: true, align: 'center' });
        if (d2) text(d2, colDate.x + colDate.w / 2, y + 7.4, { size: 6.8, color: C_MUTED, align: 'center' });
      }
      // 용도 아이콘 6개(동그라미 치는 자리)
      const step = colUse.w / EXPENSE_CATEGORIES.length;
      EXPENSE_CATEGORIES.forEach((cat, i) => icon(cat, colUse.x + i * step + (step - 4.4) / 2, y + (rowH - 4.4) / 2, 4.4));
      // 금액 칸 단위(오른쪽 옅게)
      text(cellUnit, pageW - mR - 2.5, y + rowH / 2 + 1.2, { size: 7.5, color: C_FAINT, align: 'right' });
      // 세로 칸선
      pdf.setDrawColor(...C_LINE);
      pdf.setLineWidth(0.15);
      for (const x of [colWhat.x, colUse.x, colAmt.x]) pdf.line(x, y, x, y + rowH);
      y += rowH;
    };
    for (let d = 1; d <= input.totalDays; d += 1) {
      if (y + rowH * rowsPerDay > bottomLimit - 12) header();
      const label = `${L('dayOne', { day: d })}\n${shortDate(dayDateOf(input.startDate, d))}`;
      for (let r = 0; r < rowsPerDay; r += 1) drawRow(label, r === 0);
    }
    pdf.setDrawColor(...C_LINE);
    pdf.setLineWidth(0.35);
    pdf.line(mL, y, pageW - mR, y);
    // 합계 칸
    if (y + 12 > bottomLimit) header();
    y += 3;
    pdf.setFillColor(...C_SOFT);
    pdf.roundedRect(colUse.x, y, usableW - (colUse.x - mL), 9, 2, 2, 'F');
    text(L('total'), colUse.x + 4, y + 6, { size: 9.5, color: C_BRAND, bold: true });
    text(cellUnit, pageW - mR - 3, y + 6, { size: 8.5, color: C_MUTED, align: 'right' });
  }

  // ── 쪽 순서 ─────────────────────────────────────────────────
  if (mode === 'current') {
    drawDay(input.currentDay);
  } else {
    drawCover();
    for (let d = 1; d <= input.totalDays; d += 1) {
      pdf.addPage();
      drawDay(d);
    }
    drawChecklist();
    drawExpenseSheet();
  }

  // 아래쪽: 여행 이름 · 쪽 번호
  const totalPages = pdf.getNumberOfPages();
  for (let p = 1; p <= totalPages; p += 1) {
    pdf.setPage(p);
    text(L('footer', { title: cleanPdfText(input.title) || cityOrTrip(input.city) }), mL, pageH - 7, { size: 7, color: C_FAINT });
    text(L('pageOf', { page: p, total: totalPages }), pageW - mR, pageH - 7, { size: 7, color: C_FAINT, align: 'right' });
  }

  pdf.save(
    mode === 'all'
      ? L('fileAll', { city: cityOrTrip(input.city) })
      : L('fileDay', { city: cityOrTrip(input.city), day: input.currentDay }),
  );
}
