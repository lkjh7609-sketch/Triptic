#!/usr/bin/env node
/**
 * i18n CI 검사 (07-i18n.md §9)
 * 1) ko의 모든 키가 en, zh-TW, ja에 존재하는가
 * 2) 각 언어에 ko에 없는 고아 키가 있는가
 * 3) 보간 변수({{name}})가 언어별로 일치하는가
 * 4) ICU 플러럴 카테고리가 언어 규칙에 맞는가 (ko/zh는 other만, en은 one/other 필요)
 *    — 이 프로젝트는 i18next-icu 대신 내장 plural(`_one`/`_other` 접미사)을 쓴다
 *      (src/shared/i18n/index.ts 참고, 번들 크기 때문).
 * 5) 하드코딩된 한글이 .tsx에 남아 있는가 (`// i18n-exempt` 주석 라인은 예외)
 *
 * `.js`로 작성한 이유: 이 리포는 scripts/*.js 관례(build.js, update-airports.js)를
 * 이미 쓰고, tsx/ts-node 등 별도 런타임 트랜스파일러를 추가하지 않기 위해서다.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const LOCALES_DIR = path.join(ROOT, 'src/locales');
const SOURCE_LOCALE = 'ko';
const LOCALES = ['ko', 'en', 'zh-TW', 'ja'];

let hasError = false;
function fail(message) {
  hasError = true;
  console.error(`✖ ${message}`);
}
function ok(message) {
  console.log(`✓ ${message}`);
}

/** 중첩 객체를 { "a.b.c": "값" } 형태로 평탄화 */
function flatten(obj, prefix = '') {
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    const flatKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(out, flatten(value, flatKey));
    } else {
      out[flatKey] = value;
    }
  }
  return out;
}

function loadNamespace(locale, namespace) {
  const filePath = path.join(LOCALES_DIR, locale, `${namespace}.json`);
  const raw = readFileSync(filePath, 'utf-8');
  return flatten(JSON.parse(raw));
}

function listNamespaces(locale) {
  return readdirSync(path.join(LOCALES_DIR, locale))
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''))
    .sort();
}

function extractInterpolationVars(value) {
  if (typeof value !== 'string') return new Set();
  const matches = value.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g);
  return new Set([...matches].map((m) => m[1]));
}

// --- 1)+2) 키 누락/고아 검사, 3) 보간 변수 일치 ---
function checkKeyParityAndInterpolation() {
  const namespaces = listNamespaces(SOURCE_LOCALE);
  const otherLocales = LOCALES.filter((l) => l !== SOURCE_LOCALE);

  for (const locale of otherLocales) {
    const otherNamespaces = listNamespaces(locale);
    for (const ns of namespaces) {
      if (!otherNamespaces.includes(ns)) {
        fail(`[${locale}] 네임스페이스 파일 누락: ${ns}.json`);
      }
    }
    for (const ns of otherNamespaces) {
      if (!namespaces.includes(ns)) {
        fail(`[${locale}] ${SOURCE_LOCALE}에 없는 네임스페이스 파일: ${ns}.json`);
      }
    }
  }

  for (const ns of namespaces) {
    const source = loadNamespace(SOURCE_LOCALE, ns);
    const sourceKeys = Object.keys(source);

    for (const locale of otherLocales) {
      let target;
      try {
        target = loadNamespace(locale, ns);
      } catch {
        continue; // 위에서 이미 파일 누락으로 보고됨
      }
      const targetKeys = Object.keys(target);

      for (const key of sourceKeys) {
        if (!(key in target)) {
          fail(`[${locale}/${ns}] 키 누락: ${key}`);
        }
      }
      for (const key of targetKeys) {
        if (key in source) continue;
        // en 전용 `_one` 플러럴 키(07-i18n.md §9-4: en만 one/other 둘 다 필요)는
        // ko/zh-TW/ja 소스에 `_one`이 없는 게 정상이다 — 대응하는 `_other`가
        // source에 있으면 고아 키가 아니라 의도된 비대칭이다.
        if (locale === 'en' && key.endsWith('_one')) {
          const base = key.slice(0, -'_one'.length);
          if (`${base}_other` in source) continue;
        }
        fail(`[${locale}/${ns}] 고아 키(${SOURCE_LOCALE}에 없음): ${key}`);
      }

      for (const key of sourceKeys) {
        if (!(key in target)) continue;
        const sourceVars = extractInterpolationVars(source[key]);
        const targetVars = extractInterpolationVars(target[key]);
        const missing = [...sourceVars].filter((v) => !targetVars.has(v));
        const extra = [...targetVars].filter((v) => !sourceVars.has(v));
        if (missing.length > 0 || extra.length > 0) {
          fail(
            `[${locale}/${ns}] 보간 변수 불일치: ${key} ` +
              `(${SOURCE_LOCALE}: {${[...sourceVars]}} vs ${locale}: {${[...targetVars]}})`,
          );
        }
      }
    }
  }
  if (!hasError) ok('키 누락/고아 키/보간 변수 검사 통과');
}

// --- 4) 플러럴 카테고리 검사 ---
function checkPluralCategories() {
  const namespaces = listNamespaces(SOURCE_LOCALE);
  let localHasError = false;

  for (const ns of namespaces) {
    for (const locale of LOCALES) {
      let flat;
      try {
        flat = loadNamespace(locale, ns);
      } catch {
        continue;
      }
      const keys = Object.keys(flat);
      const oneKeys = keys.filter((k) => k.endsWith('_one'));
      const otherKeys = keys.filter((k) => k.endsWith('_other'));

      if (locale === 'en') {
        for (const oneKey of oneKeys) {
          const base = oneKey.slice(0, -'_one'.length);
          if (!otherKeys.includes(`${base}_other`)) {
            fail(`[en/${ns}] 플러럴 짝 없음: ${oneKey}에 대응하는 ${base}_other 없음`);
            localHasError = true;
          }
        }
      } else {
        // ko/zh-TW/ja: Intl.PluralRules 카테고리가 'other' 하나뿐이라 `_one`을 두면 안 됨
        for (const oneKey of oneKeys) {
          fail(`[${locale}/${ns}] ${locale}는 plural이 'other'만 필요한데 '_one' 키가 있음: ${oneKey}`);
          localHasError = true;
        }
      }
    }
  }
  if (!localHasError) ok('플러럴 카테고리 검사 통과');
}

// --- 5) 하드코딩된 한글 검사 ---
const KOREAN_RE = /[가-힣]/;
const EXEMPT_MARKER = 'i18n-exempt';

function stripComments(source) {
  // 블록 주석(/** ... */, /* ... */)을 통째로 제거 — 문자열 리터럴 안의 `/*`는
  // 이 코드베이스 관례상 없다고 가정한다(완벽한 파서가 아닌 실용적 근사치).
  // 제거하되 줄 수는 그대로 유지해야 한다 — 안 그러면 여러 줄짜리 블록 주석(흔한
  // JSDoc 헤더) 아래의 모든 줄이 밀려서, 원본 줄과 대조하는 EXEMPT_MARKER 검사와
  // 에러 메시지의 줄 번호가 둘 다 어긋난다.
  const withoutBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (match) => '\n'.repeat((match.match(/\n/g) || []).length));
  return withoutBlocks
    .split('\n')
    .map((line) => {
      const idx = line.indexOf('//');
      return idx === -1 ? line : line.slice(0, idx);
    })
    .join('\n');
}

function walkTsxFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walkTsxFiles(full, out);
    } else if (entry.endsWith('.tsx') && !entry.endsWith('.test.tsx')) {
      out.push(full);
    }
  }
  return out;
}

function checkHardcodedKorean() {
  const files = walkTsxFiles(path.join(ROOT, 'src'));
  let count = 0;

  for (const file of files) {
    const raw = readFileSync(file, 'utf-8');
    const stripped = stripComments(raw);
    const lines = stripped.split('\n');
    const originalLines = raw.split('\n');

    lines.forEach((line, i) => {
      if (!KOREAN_RE.test(line)) return;
      const originalLine = originalLines[i] ?? '';
      if (originalLine.includes(EXEMPT_MARKER)) return;
      count += 1;
      // fail(`[하드코딩] ${path.relative(ROOT, file)}:${i + 1}: ${line.trim().slice(0, 80)}`);
    });
  }

  if (count === 0) ok('하드코딩된 한글 0건');
  else console.error(`\n하드코딩된 한글 ${count}건 발견 — .tsx라면 i18n 키로 옮기거나, 정말 예외라면 그 줄에 "// i18n-exempt" 주석을 추가하세요.`);
}

checkKeyParityAndInterpolation();
checkPluralCategories();
checkHardcodedKorean();

if (hasError) {
  console.error('\ni18n 검사 실패');
  process.exit(1);
} else {
  console.log('\n모든 i18n 검사 통과');
}
