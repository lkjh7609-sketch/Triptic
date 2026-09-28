#!/usr/bin/env node
/**
 * 예약 서류 인식 파이프라인(src/features/documents/parseBooking/*.ts)을 Vercel 함수가 바로
 * 읽는 JS 한 파일로 묶는다 → api/_lib/documents/pipeline.js (커밋한다).
 * Vercel이 src의 TS(.ts 확장자 import)를 함수로 컴파일해 주는지 장담할 수 없어서, 묶은 결과를
 * 저장소에 두고 CI에서 `--check`로 최신인지 확인한다(원본을 고치고 다시 안 묶으면 실패).
 * npm 패키지(zod, date-fns-tz)는 묶지 않는다 — Vercel이 package.json대로 설치한다.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outfile = path.join(root, 'api/_lib/documents/pipeline.js');
const HEADER = '// ⚠️ 자동 생성 파일 — 고치지 말 것. 원본: src/features/documents/parseBooking/pipeline.ts\n// 다시 만들기: node scripts/build-doc-pipeline.mjs\n';

const result = await build({
  entryPoints: [path.join(root, 'src/features/documents/parseBooking/server.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  packages: 'external',
  write: false,
  legalComments: 'none',
  logLevel: 'error',
});
const code = HEADER + result.outputFiles[0].text;

if (process.argv.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(outfile, 'utf8');
  } catch {
    // 없으면 아래에서 실패
  }
  if (current !== code) {
    console.error('✖ api/_lib/documents/pipeline.js가 원본과 다릅니다 — `node scripts/build-doc-pipeline.mjs`로 다시 만들어 커밋하세요.');
    process.exit(1);
  }
  console.log('✓ 문서 인식 파이프라인 번들이 최신입니다');
} else {
  writeFileSync(outfile, code);
  console.log(`✓ ${path.relative(root, outfile)} (${(code.length / 1024).toFixed(1)} KB)`);
}
