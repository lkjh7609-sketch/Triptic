/**
 * 텍스트 추출 (04-document-ai.md §2 파이프라인 B단계, §3.1)
 *
 * ⚠️ 이번 라운드는 "PDF 텍스트 레이어가 있는 경우"만 구현했다 — 실제 예약
 * 문서 대부분(항공사 e-티켓, OTA 확인서)이 텍스트 PDF라 커버리지가 가장
 * 크고, 위험(개인정보 비전 모델 전송, 이미지 렌더링 파이프라인)도 가장
 * 작다. 스캔본(비전 경로)·.pkpass·.ics는 다음 라운드로 미룬다 — 지원
 * 형식이 아닌 파일은 명확한 에러로 실패시키고(§3.2 "20MB를 넘는 파일은…"과
 * 같은 톤), 조용히 빈 결과를 반환하지 않는다.
 *
 * ⚠️ Deno Edge Function 런타임에서 pdfjs-dist를 워커 없이(disableWorker)
 * 동기적으로 돌리는 경로다 — 로컬에 Deno가 없어 실제로 실행해보지 못했다.
 * 배포 후 가장 먼저 실제 텍스트 PDF로 확인할 지점이다.
 */
import * as pdfjsLib from 'pdfjs-dist';

export interface ExtractedDocument {
  text: string;
  pageCount: number;
}

export class UnsupportedDocumentError extends Error {}

export async function extractText(bytes: Uint8Array, mimeType: string): Promise<ExtractedDocument> {
  if (mimeType === 'application/pdf') {
    return extractPdfText(bytes);
  }
  throw new UnsupportedDocumentError(
    `아직 지원하지 않는 파일 형식입니다(${mimeType}). PDF만 지원됩니다 — 스캔본/이미지/.pkpass/.ics는 다음 업데이트에서 지원 예정입니다.`,
  );
}

async function extractPdfText(bytes: Uint8Array): Promise<ExtractedDocument> {
  const doc = await pdfjsLib.getDocument({ data: bytes, disableWorker: true }).promise;
  const pageCount = doc.numPages;
  if (pageCount > 30) {
    throw new Error('30페이지를 넘는 문서는 처리할 수 없습니다.');
  }

  const pageTexts: string[] = [];
  let totalChars = 0;
  for (let i = 1; i <= pageCount; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => ('str' in item ? item.str : '')).join(' ');
    totalChars += pageText.trim().length;
    pageTexts.push(pageText);
  }

  // 텍스트 레이어가 사실상 없으면(스캔본) 지금은 지원하지 않는다고 명확히 알린다 —
  // 빈 문자열로 조용히 다음 단계(마스킹·파싱)까지 흘려보내지 않는다.
  if (totalChars < 20) {
    throw new UnsupportedDocumentError(
      '텍스트 레이어가 없는 스캔본으로 보입니다 — 스캔본 인식은 다음 업데이트에서 지원 예정입니다.',
    );
  }

  return { text: pageTexts.join('\n'), pageCount };
}
