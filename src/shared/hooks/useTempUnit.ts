import { useProfile } from './useProfile';

/** profiles.temp_unit('c'|'f')을 weatherRules.formatTemp가 기대하는 'C'|'F'로 변환.
 * 비로그인·로딩 중·미설정이면 기본값 'C' (스키마 기본값과 동일). */
export function useTempUnit(): 'C' | 'F' {
  const { data: profile } = useProfile();
  return profile?.temp_unit === 'f' ? 'F' : 'C';
}
