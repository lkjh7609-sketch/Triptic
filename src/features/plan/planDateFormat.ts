/**
 * 로케일별 날짜 표시 포맷 (07-i18n.md §5.1)
 * 날짜 "값"은 절대 바꾸지 않는다 — 표시 형식(요일/월 이름의 언어)만 활성
 * 로케일(i18n.language)을 따른다. 항공편 출발/도착처럼 "그 장소의 현지 시각"을
 * 표시하는 곳(§5.3)에는 이 함수를 쓰지 않는다 — 그런 곳은 원본 시각 문자열을
 * 그대로 보여줘야 하고, 이 헬퍼는 여행 일자·카드 등 "표시 언어에 따라 요일/월
 * 표기만 바뀌면 되는" 날짜에만 쓴다.
 */
import { format } from 'date-fns';
import { ko, enUS, zhCN, type Locale } from 'date-fns/locale';

const DATE_FNS_LOCALE: Record<string, Locale> = { ko, en: enUS, 'zh-CN': zhCN };
const DAY_FORMAT: Record<string, string> = { ko: 'M/d (E)', en: 'MMM d (EEE)', 'zh-CN': 'M月d日 (E)' };

/** 유효하지 않은 날짜면 빈 문자열을 반환한다(크래시 방지 — CreateTripModal 비정상 입력 방어와 동일한 원칙) */
export function formatLocalizedDay(date: Date, language: string): string {
  if (Number.isNaN(date.getTime())) return '';
  const locale = DATE_FNS_LOCALE[language] ?? DATE_FNS_LOCALE.ko;
  const pattern = DAY_FORMAT[language] ?? DAY_FORMAT.ko;
  return format(date, pattern, { locale });
}
