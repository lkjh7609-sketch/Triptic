import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { extractDocumentText, hasUsableText, pdfFirstPageText, UnsupportedDocumentError } from './extract.js';

// jsdom 환경에선 import.meta.url이 웹 주소라 저장소 루트 기준 경로로 읽는다
const fixture = (name) => readFileSync(path.resolve(process.cwd(), 'api/_lib/documents/__fixtures__', name));

afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
});

describe('pdfFirstPageText — 첫 장만', () => {
    it('두 쪽짜리 PDF에서 첫 장 글만 읽고, 한글 단어를 쪼개지 않는다', async () => {
        const { text, pageCount } = await pdfFirstPageText(fixture('two-pages.pdf'));
        expect(pageCount).toBe(2);
        expect(text).toContain('전자항공권 확인증');
        expect(text).toContain('6X2KQP');
        expect(text).toContain('KE401');
        expect(text).not.toContain('SECOND PAGE');
    });
});

describe('hasUsableText', () => {
    it('글자층이 있다고 볼 만한지', () => {
        expect(hasUsableText('')).toBe(false);
        expect(hasUsableText('  \n  ')).toBe(false);
        expect(hasUsableText('전자항공권 확인증 예약번호 6X2KQP 편명 KE401 인천 시드니')).toBe(true);
        expect(hasUsableText('�'.repeat(40) + 'abc')).toBe(false);
    });
});

describe('extractDocumentText', () => {
    it('글자층 있는 PDF는 Vision을 부르지 않는다(첫 장만, 무료)', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        vi.stubEnv('GOOGLE_VISION_API_KEY', 'test-key');
        const r = await extractDocumentText(fixture('two-pages.pdf'), 'application/pdf');
        expect(r.fromOcr).toBe(false);
        expect(r.text).not.toContain('SECOND PAGE');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('글자층 없는 스캔 PDF는 Vision에 첫 장만 보낸다', async () => {
        vi.stubEnv('GOOGLE_VISION_API_KEY', 'test-key');
        const fetchMock = vi.fn(async (url, init) => {
            expect(String(url)).toContain('files:annotate');
            expect(JSON.parse(init.body).requests[0].pages).toEqual([1]);
            return { ok: true, json: async () => ({ responses: [{ responses: [{ fullTextAnnotation: { text: '인터파크 항공권 여정 예약번호 K7M2ZP 아시아나항공 OZ104 김포 GMP 2026.11.03 08:10' } }] }] }) };
        });
        vi.stubGlobal('fetch', fetchMock);
        const r = await extractDocumentText(fixture('scan.pdf'), 'application/pdf');
        expect(fetchMock).toHaveBeenCalledTimes(1);
        // pageCount는 문서 전체 쪽수(documents.page_count) — 읽는 건 첫 장뿐
        expect(r.fromOcr).toBe(true);
        expect(r.pageCount).toBeGreaterThanOrEqual(1);
        expect(r.text).toContain('K7M2ZP');
    });

    it('사진은 Vision 한 번, 키가 없으면 안내 문구로 거절', async () => {
        vi.stubEnv('GOOGLE_VISION_API_KEY', '');
        vi.stubEnv('GOOGLE_PLACES_SERVER_KEY', '');
        await expect(extractDocumentText(new Uint8Array([1, 2, 3]), 'image/jpeg')).rejects.toBeInstanceOf(UnsupportedDocumentError);

        vi.stubEnv('GOOGLE_PLACES_SERVER_KEY', 'server-key');
        const fetchMock = vi.fn(async (url) => {
            expect(String(url)).toContain('images:annotate');
            expect(String(url)).toContain('key=server-key');
            return { ok: true, json: async () => ({ responses: [{ fullTextAnnotation: { text: 'SINGAPORE AIRLINES BOARDING PASS SQ 608 SEOUL ICN SINGAPORE SIN 14 MAY 2027' } }] }) };
        });
        vi.stubGlobal('fetch', fetchMock);
        const r = await extractDocumentText(new Uint8Array([1, 2, 3]), 'image/png');
        expect(r).toMatchObject({ fromOcr: true, pageCount: 1 });
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('지원하지 않는 형식은 거절', async () => {
        await expect(extractDocumentText(new Uint8Array([1]), 'application/zip')).rejects.toBeInstanceOf(UnsupportedDocumentError);
    });
});
