/**
 * PDF에 그리는 아이콘 — 앱의 경비 카테고리 아이콘과 같은 lucide 선 아이콘(ISC 라이선스, lucide-react 1.47에서 경로만 옮김).
 * jsPDF는 SVG를 못 그려서 그리는 쪽(pdfExport)이 캔버스로 PNG를 만들어 넣는다.
 */
export const PDF_ICON_SVG: Record<string, string> = {
  food: "<path d=\"M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2\"/><path d=\"M7 2v20\"/><path d=\"M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7\"/>",
  transport: "<path d=\"M8 6v6\"/><path d=\"M15 6v6\"/><path d=\"M2 12h19.6\"/><path d=\"M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3\"/><circle cx=\"7\" cy=\"18\" r=\"2\"/><path d=\"M9 18h5\"/><circle cx=\"16\" cy=\"18\" r=\"2\"/>",
  lodging: "<path d=\"M10 22v-6.57\"/><path d=\"M12 11h.01\"/><path d=\"M12 7h.01\"/><path d=\"M14 15.43V22\"/><path d=\"M15 16a5 5 0 0 0-6 0\"/><path d=\"M16 11h.01\"/><path d=\"M16 7h.01\"/><path d=\"M8 11h.01\"/><path d=\"M8 7h.01\"/><rect x=\"4\" y=\"2\" width=\"16\" height=\"20\" rx=\"2\"/>",
  shopping: "<path d=\"M16 10a4 4 0 0 1-8 0\"/><path d=\"M3.103 6.034h17.794\"/><path d=\"M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z\"/>",
  activity: "<circle cx=\"12\" cy=\"12\" r=\"2\"/><path d=\"M12 2v4\"/><path d=\"m6.8 15-3.5 2\"/><path d=\"m20.7 7-3.5 2\"/><path d=\"M6.8 9 3.3 7\"/><path d=\"m20.7 17-3.5-2\"/><path d=\"m9 22 3-8 3 8\"/><path d=\"M8 22h8\"/><path d=\"M18 18.7a9 9 0 1 0-12 0\"/>",
  other: "<path d=\"M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z\"/><path d=\"M12 22V12\"/><polyline points=\"3.29 7 12 12 20.71 7\"/><path d=\"m7.5 4.27 9 5.15\"/>",
  house: "<path d=\"M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8\"/><path d=\"M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\"/>",
  planeTakeoff: "<path d=\"M2 22h20\"/><path d=\"M6.36 17.4 4 17l-2-4 1.1-.55a2 2 0 0 1 1.8 0l.17.1a2 2 0 0 0 1.8 0L8 12 5 6l.9-.45a2 2 0 0 1 2.09.2l4.02 3a2 2 0 0 0 2.1.2l4.19-2.06a2.41 2.41 0 0 1 1.73-.17L21 7a1.4 1.4 0 0 1 .87 1.99l-.38.76c-.23.46-.6.84-1.07 1.08L7.58 17.2a2 2 0 0 1-1.22.18Z\"/>",
  planeLanding: "<path d=\"M2 22h20\"/><path d=\"M3.77 10.77 2 9l2-4.5 1.1.55c.55.28.9.84.9 1.45s.35 1.17.9 1.45L8 8.5l3-6 1.05.53a2 2 0 0 1 1.09 1.52l.72 5.4a2 2 0 0 0 1.09 1.52l4.4 2.2c.42.22.78.55 1.01.96l.6 1.03c.49.88-.06 1.98-1.06 2.1l-1.18.15c-.47.06-.95-.02-1.37-.24L4.29 11.15a2 2 0 0 1-.52-.38Z\"/>",
};

/** 24×24 lucide SVG 문서(선 색·굵기 지정) */
export function iconSvg(name: string, color: string, strokeWidth = 2): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${PDF_ICON_SVG[name] ?? ''}</svg>`;
}
