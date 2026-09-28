/**
 * 서버(Vercel 함수 api/parseDocument.js)가 쓰는 파이프라인 진입점 — scripts/build-doc-pipeline.mjs가
 * 이 파일을 api/_lib/documents/pipeline.js로 묶는다.
 */
export { runBookingPipeline } from './pipeline.ts';
export type { PipelineInput, PipelineResult } from './pipeline.ts';
export { createAirportIndex } from './airports.ts';
