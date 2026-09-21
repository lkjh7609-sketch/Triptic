/**
 * 오픈소스 라이선스 목록 (02-screens.md §5 "정보 > 오픈소스 라이선스")
 * package.json dependencies(런타임 번들 대상)의 실제 설치본 package.json에서
 * license 필드를 읽어 생성한 스냅샷이다. 의존성이 바뀌면 다시 생성할 것:
 *   node -e '...'로 각 패키지의 node_modules/<pkg>/package.json을 읽어 갱신
 *   (2026-09-21 기준 node_modules 실측값).
 */
export interface LicenseEntry {
  name: string;
  version: string;
  license: string;
}

export const OSS_LICENSES: LicenseEntry[] = [
  { name: '@capacitor/core', version: '8.5.2', license: 'MIT' },
  { name: '@capacitor/haptics', version: '8.0.2', license: 'MIT' },
  { name: '@capacitor/ios', version: '8.5.2', license: 'MIT' },
  { name: '@capacitor/status-bar', version: '8.0.3', license: 'MIT' },
  { name: '@dnd-kit/core', version: '6.3.1', license: 'MIT' },
  { name: '@dnd-kit/sortable', version: '10.0.0', license: 'MIT' },
  { name: '@dnd-kit/utilities', version: '3.2.2', license: 'MIT' },
  { name: '@googlemaps/js-api-loader', version: '2.1.1', license: 'Apache-2.0' },
  { name: '@hookform/resolvers', version: '5.9.1', license: 'MIT' },
  { name: '@sentry/react', version: '10.75.0', license: 'MIT' },
  { name: '@supabase/supabase-js', version: '2.116.0', license: 'MIT' },
  { name: '@tanstack/react-query', version: '5.103.1', license: 'MIT' },
  { name: 'date-fns', version: '4.4.0', license: 'MIT' },
  { name: 'date-fns-tz', version: '3.2.0', license: 'MIT' },
  { name: 'i18next', version: '25.10.10', license: 'MIT' },
  { name: 'i18next-browser-languagedetector', version: '8.2.1', license: 'MIT' },
  { name: 'i18next-icu', version: '2.4.4', license: 'MIT' },
  { name: 'jose', version: '6.2.12', license: 'MIT' },
  { name: 'jspdf', version: '2.5.2', license: 'MIT' },
  { name: 'motion', version: '12.43.0', license: 'MIT' },
  { name: 'posthog-js', version: '1.434.2', license: 'Apache-2.0 AND MIT' },
  { name: 'react', version: '19.3.0', license: 'MIT' },
  { name: 'react-dom', version: '19.3.0', license: 'MIT' },
  { name: 'react-hook-form', version: '7.88.0', license: 'MIT' },
  { name: 'react-i18next', version: '16.6.6', license: 'MIT' },
  { name: 'react-router', version: '7.18.4', license: 'MIT' },
  { name: 'react-svg-worldmap', version: '2.0.2', license: 'MIT' },
  { name: 'zod', version: '4.6.5', license: 'MIT' },
  { name: 'zustand', version: '5.0.15', license: 'MIT' },
].sort((a, b) => a.name.localeCompare(b.name));
