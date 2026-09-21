import '@testing-library/jest-dom/vitest';
import i18n from '@/shared/i18n';

/**
 * i18next 네임스페이스는 lazy(backend.ts의 동적 import)로 로드되고, react-i18next는
 * useSuspense:true라 로드 전 t()를 쓰면 컴포넌트가 suspend한다. 테스트는 Suspense
 * 경계 없이 render()를 바로 호출하므로, 실행 전에 필요한 네임스페이스를 전부
 * 로드해두고 로케일도 'ko'로 고정한다(jsdom navigator.language 감지에 기대지 않음 —
 * 기존 테스트 assertion이 한국어 문자열을 기대한다).
 */
await i18n.changeLanguage('ko');
await i18n.loadNamespaces(['common', 'home', 'plan', 'documents', 'community', 'settings', 'weather']);
