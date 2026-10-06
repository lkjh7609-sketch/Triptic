// 예약 서류에서 글자 뽑기 — PDF는 첫 장만(대부분 정보가 첫 장에 있고, API 사용량을 늘리지 않게).
//  - PDF: 첫 장 글자층을 무료로 읽는다(unpdf). 글자층이 없을 때만(스캔본) Google Vision에 첫 장만 보낸다.
//  - 사진(JPEG/PNG/WEBP): Google Vision OCR 한 번.
// Vision 키는 서버 전용(GOOGLE_VISION_API_KEY, 없으면 GOOGLE_PLACES_SERVER_KEY) — 웹에 공개되는
// 지도 키는 쓰지 않는다(공개 키에 Vision을 열면 누구나 우리 계정으로 Vision을 부를 수 있다).
import { getDocumentProxy } from 'unpdf';

const VISION = 'https://vision.googleapis.com/v1';
const VISION_TIMEOUT_MS = 20_000;
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export class UnsupportedDocumentError extends Error {}

export function visionKey() {
    return process.env.GOOGLE_VISION_API_KEY || process.env.GOOGLE_PLACES_SERVER_KEY || null;
}

/**
 * PDF 첫 장 글자를 줄·간격대로 이어 붙인다. 글자 조각을 공백으로만 이으면 한글이
 * "전자 항 공권"처럼 쪼개져 뒤 단계가 값을 못 찾는다 — 조각 사이 간격으로 띄어쓰기를 정한다.
 */
export async function pdfFirstPageText(bytes) {
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const page = await pdf.getPage(1);
    const { items } = await page.getTextContent();
    const pieces = items
        .filter((i) => typeof i.str === 'string' && i.str.length > 0)
        .map((i) => ({ s: i.str, x: i.transform[4], y: i.transform[5], w: i.width, h: Math.abs(i.transform[3]) || Math.abs(i.height) || 10 }));
    pieces.sort((a, b) => b.y - a.y || a.x - b.x);
    const lines = [];
    for (const p of pieces) {
        // 글자 높이의 절반 안쪽이면 같은 줄
        const line = lines.find((l) => Math.abs(l.y - p.y) < Math.max(2, l.h * 0.5));
        if (line) line.items.push(p);
        else lines.push({ y: p.y, h: p.h, items: [p] });
    }
    lines.sort((a, b) => b.y - a.y);
    const text = lines
        .map((l) => {
            let s = '';
            let prevEnd = null;
            for (const p of l.items.sort((a, b) => a.x - b.x)) {
                if (prevEnd !== null) {
                    const gap = p.x - prevEnd;
                    // 글자 높이의 1.5배 넘게 떨어지면 칸 구분(공백 두 칸), 0.2배 넘으면 띄어쓰기, 아니면 붙인다
                    if (gap > p.h * 1.5) s += '  ';
                    else if (gap > p.h * 0.2 && !s.endsWith(' ') && !p.s.startsWith(' ')) s += ' ';
                }
                s += p.s;
                prevEnd = p.x + p.w;
            }
            return s.replace(/\s+$/, '');
        })
        .join('\n');
    return { text, pageCount: pdf.numPages };
}

/** 글자층이 있다고 볼 만한지 — 글자·숫자 30개 이상, 깨진 글자(�·사용자 영역) 10% 미만 */
export function hasUsableText(text) {
    const chars = (text.match(/[\p{L}\p{N}]/gu) ?? []).length;
    const broken = (text.match(/[�-]/g) ?? []).length;
    return chars >= 30 && broken / Math.max(1, chars) < 0.1;
}

async function vision(path, body, key) {
    const res = await fetch(`${VISION}/${path}?key=${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(VISION_TIMEOUT_MS),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || json?.error) throw new Error(`vision ${path}: ${json?.error?.status ?? res.status}`);
    return json;
}

const OCR_FEATURES = [{ type: 'DOCUMENT_TEXT_DETECTION' }];
const OCR_CONTEXT = { languageHints: ['ko', 'en'] };

export async function visionImageText(bytes, key) {
    const json = await vision('images:annotate', { requests: [{ image: { content: Buffer.from(bytes).toString('base64') }, features: OCR_FEATURES, imageContext: OCR_CONTEXT }] }, key);
    const r = json.responses?.[0];
    if (r?.error) throw new Error(`vision image: ${r.error.message}`);
    return r?.fullTextAnnotation?.text ?? '';
}

/** 스캔본 PDF — 첫 장만(pages: [1]) */
export async function visionPdfFirstPageText(bytes, key) {
    const json = await vision('files:annotate', {
        requests: [{ inputConfig: { content: Buffer.from(bytes).toString('base64'), mimeType: 'application/pdf' }, features: OCR_FEATURES, imageContext: OCR_CONTEXT, pages: [1] }],
    }, key);
    const r = json.responses?.[0]?.responses?.[0];
    if (r?.error) throw new Error(`vision pdf: ${r.error.message}`);
    return r?.fullTextAnnotation?.text ?? '';
}

/**
 * @returns {Promise<{ text: string, fromOcr: boolean, pageCount: number }>}
 * 지원하지 않는 형식·OCR 키 없음·읽은 글이 없음은 UnsupportedDocumentError(사용자에게 그대로 보여줄 문구).
 */
export async function extractDocumentText(bytes, mimeType, { beforeVision } = {}) {
    if (mimeType === 'application/pdf') {
        const { text, pageCount } = await pdfFirstPageText(bytes);
        if (hasUsableText(text)) return { text, fromOcr: false, pageCount };
        const key = visionKey();
        if (!key) throw new UnsupportedDocumentError('스캔본 PDF는 아직 읽을 수 없어요. 글자가 들어 있는 PDF나 사진으로 올려 주세요.');
        await beforeVision?.();
        const ocr = await visionPdfFirstPageText(bytes, key);
        if (!hasUsableText(ocr)) throw new UnsupportedDocumentError('문서에서 글자를 찾지 못했어요.');
        return { text: ocr, fromOcr: true, pageCount };
    }
    if (IMAGE_TYPES.includes(mimeType)) {
        const key = visionKey();
        if (!key) throw new UnsupportedDocumentError('사진 인식을 아직 쓸 수 없어요. PDF로 올려 주세요.');
        await beforeVision?.();
        const text = await visionImageText(bytes, key);
        if (!hasUsableText(text)) throw new UnsupportedDocumentError('사진에서 글자를 찾지 못했어요. 더 밝고 선명하게 찍어 주세요.');
        return { text, fromOcr: true, pageCount: 1 };
    }
    throw new UnsupportedDocumentError('PDF나 사진(JPG·PNG)만 올릴 수 있어요.');
}
