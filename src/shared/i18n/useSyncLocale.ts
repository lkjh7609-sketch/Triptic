import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useProfile } from '@/shared/hooks/useProfile';

/**
 * 로그인 사용자의 `profiles.locale`을 표시 언어의 최종 권위로 삼는다.
 * 단, 프로필 로드 직후 한 번만 맞춰주며, 그 후 유저가 수동으로 변경한
 * 사항을 뒤집지 않는다(DB 업데이트 실패 시 UI가 롤백되는 문제 방지).
 */
export function useSyncLocale(): void {
  const { i18n } = useTranslation();
  const { data: profile } = useProfile();
  const hasSyncedRef = useRef(false);

  useEffect(() => {
    if (!profile?.locale) return;
    if (hasSyncedRef.current) return;
    if (profile.locale !== i18n.language) {
      void i18n.changeLanguage(profile.locale);
    }
    hasSyncedRef.current = true;
  }, [profile?.locale, i18n.language]);
}

/** App 최상단(QueryClientProvider 안, Suspense 안)에 렌더만 해두면 되는 훅 래퍼. */
export function LocaleSync(): null {
  useSyncLocale();
  return null;
}
