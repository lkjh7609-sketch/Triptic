import { useTranslation } from 'react-i18next';
import type { AdminSection } from './adminSections';

/** 섹션 이름 — 기존 탭 이름(admin.tabs.*)을 그대로 쓴다('회원' 섹션만 예전 키가 users) */
export function useSectionLabel() {
  const { t } = useTranslation('community');
  return (s: AdminSection): string => (s === 'members' ? t('admin.tabs.users') : t(`admin.tabs.${s}`));
}
