import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useProfile } from '@/shared/hooks/useProfile';
import { normalizeLocale } from './index';

/**
 * 로그인 사용자의 `profiles.locale`을 표시 언어의 최종 권위로 삼는다
 * (07-i18n.md §2.2). 사용자(계정)마다 프로필이 처음 로드됐을 때 한 번만 맞춘다 —
 * 이후 언어 설정 화면에서 바꾼 값은 LanguageModal이 프로필에 저장하므로, 여기서
 * 다시 되돌리지 않는다. 계정이 바뀌면(로그아웃 후 다른 계정 로그인) 다시 맞춘다.
 * 0027 이전에 저장된 'zh-CN'은 normalizeLocale이 'zh-TW'로 바꾼다.
 */
export function useSyncLocale(): void {
  const { i18n } = useTranslation();
  const { data: profile } = useProfile();
  const syncedUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (!profile?.locale || syncedUserRef.current === profile.id) return;
    syncedUserRef.current = profile.id;
    const locale = normalizeLocale(profile.locale);
    if (locale !== i18n.language) void i18n.changeLanguage(locale);
  }, [profile?.id, profile?.locale, i18n]);
}

/** App 최상단(QueryClientProvider 안, Suspense 안)에 렌더만 해두면 되는 훅 래퍼. */
export function LocaleSync(): null {
  useSyncLocale();
  return null;
}
