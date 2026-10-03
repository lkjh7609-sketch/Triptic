import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { AlertLevel, CountryAlert } from './alertInfo';

/** 경보 문구에 쓰는 이름들 — 나라 이름은 현재 언어로(브라우저 나라 이름표), 단계 이름은 번역 파일에서 */
export function useAlertLabels() {
  const { t, i18n } = useTranslation('common');
  const countryName = useCallback(
    (alert: Pick<CountryAlert, 'code' | 'nameKo'>) => {
      try {
        return (
          new Intl.DisplayNames([i18n.language], { type: 'region' }).of(alert.code) ?? alert.nameKo
        );
      } catch {
        return alert.nameKo;
      }
    },
    [i18n.language],
  );
  const levelName = useCallback((level: AlertLevel) => t(`travelAlert.levelName.${level}`), [t]);
  return { t, countryName, levelName };
}
