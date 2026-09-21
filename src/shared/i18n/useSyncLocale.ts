import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useProfile } from '@/shared/hooks/useProfile';

/**
 * 로그인 사용자의 `profiles.locale`을 표시 언어의 최종 권위로 삼는다
 * (07-i18n.md §2.2 감지 순서의 최상위, 02-screens.md §5.2 "즉시 반영, 앱
 * 재시작 불필요"). 부팅 시 감지된 언어(localStorage/navigator)와 다르면
 * 프로필 로드 직후 한 번 맞춰준다. 비로그인이거나 로딩 중이면 아무것도
 * 하지 않는다 — 이미 감지된 언어를 그대로 둔다.
 */
export function useSyncLocale(): void {
  const { i18n } = useTranslation();
  const { data: profile } = useProfile();

  useEffect(() => {
    if (!profile?.locale) return;
    if (profile.locale === i18n.language) return;
    void i18n.changeLanguage(profile.locale);
  }, [profile?.locale, i18n]);
}

/** App 최상단(QueryClientProvider 안, Suspense 안)에 렌더만 해두면 되는 훅 래퍼. */
export function LocaleSync(): null {
  useSyncLocale();
  return null;
}
