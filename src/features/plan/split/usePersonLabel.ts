import { useTranslation } from 'react-i18next';
import type { Person } from './splitModel';

/** 사람 한 명의 표시 이름 — 나는 '나', 이름이 없으면 '이름 없음', 나간 사람은 '나간 일행' */
export function usePersonLabel(meId: string | null) {
  const { t } = useTranslation('plan');
  return (p: Person): string => {
    if (p.id === meId) return t('split.me');
    if (p.name) return p.name;
    return p.left ? t('split.left') : t('split.unnamed');
  };
}
